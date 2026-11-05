"""第四十七次优化：《雅思词汇词根+联想记忆法 乱序版》→ data/ielts_root.js、data/ielts_root_rich.js

用法：python3 src/build_ielts_root.py          （50 个 List 都得有 src/ielts_root/Lxx.tsv）
      python3 src/build_ielts_root.py --check  （只核对已经写好的 Lxx.tsv，不写文件）
      python3 src/build_ielts_root.py --partial（只拿写好的 List 生成，中途看网页用）

正本：src/ielts_root/raw.json（extract_ielts_root.py 从 PDF 拆的）+ src/ielts_root/Lxx.tsv（子代理标好的，
每行 编号§单词§音标§例句§译文§备注，见 PROMPT.md）。核对不过就报错，一个文件都不写：
- 行数、编号、单词和书上一样
- 音标：书上有的不能改（确实印错的改了要写「改音标」）；书上没有的要补，备注写「补音标」
- 例句：和书上一字不差；不一样时备注必须写「改例句」（书上有）或「补例句」（书上没有）
- 译文：恰好一处 **…**；去掉 ** 后和书上一字不差，除非备注写了「改译文」或「补例句」
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ielts_root_common import load_raw, pick_example, DIR, U0

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
CHECK = '--check' in sys.argv
PARTIAL = '--partial' in sys.argv   # 只拿已写好的 List 生成（中途在预览里看网页用，正式发布不能用）
NAME = '雅思词根联想'

raw = load_raw()
lists = sorted({x['list'] for x in raw})
errs, rows = [], {}
for l in lists:
    p = os.path.join(DIR, 'L%02d.tsv' % l)
    book = [x for x in raw if x['list'] == l]
    if not os.path.exists(p):
        if not CHECK and not PARTIAL:
            errs.append('L%02d.tsv 还没有' % l)
        continue
    lines = [s for s in open(p, encoding='utf-8').read().split('\n') if s.strip()]
    if len(lines) != len(book):
        errs.append('L%02d：%d 行，书上 %d 个词' % (l, len(lines), len(book)))
        continue
    for s, x in zip(lines, book):
        c = s.split('§')
        tag = 'L%02d %s' % (l, x['w'])
        if len(c) != 6:
            errs.append('%s：%d 栏' % (tag, len(c)))
            continue
        i, w, ipa, e, t, note = [v.strip() for v in c]
        if i != str(x['i']) or w != x['w']:
            errs.append('%s：编号或单词对不上（%s %s）' % (tag, i, w))
            continue
        be, bt = pick_example(x)
        if x['p'] and ipa != x['p'] and '改音标' not in note:
            errs.append('%s：书上的音标被改了，备注没写' % tag)
        if not ipa or (not x['p'] and '补音标' not in note):
            errs.append('%s：音标是空的或补了没登记' % tag)
        if not e or not t:
            errs.append('%s：例句或译文是空的' % tag)
        if e != be and not (('改例句' in note and be) or ('补例句' in note and not be)):
            errs.append('%s：例句和书上不一样，备注没写' % tag)
        if t.count('**') != 2 or re.search(r'\*\*\s*\*\*', t):
            errs.append('%s：译文里 ** 不是恰好一处' % tag)
        if t.replace('**', '') != bt and not ('改译文' in note or '补例句' in note):
            errs.append('%s：译文和书上不一样，备注没写' % tag)
        if '§' in e + t or '\t' in e + t:
            errs.append('%s：有分隔符' % tag)
        rows[x['i']] = {'p': ipa, 'e': e, 't': t, 'note': note}

done = sorted({x['list'] for x in raw if x['i'] in rows})
print('已有 %d 个 List、%d 个词条' % (len(done), len(rows)))
if errs:
    print('\n'.join(errs[:80]))
    print('共 %d 处不对' % len(errs))
    sys.exit(1)
if CHECK:
    notes = {}
    for v in rows.values():
        for k in re.findall(r'(补音标|改音标|补例句|改例句|改译文)', v['note']):
            notes[k] = notes.get(k, 0) + 1
    print('核对通过', notes)
    sys.exit(0)


def zfix(z):
    z = re.sub(r'(?<=[^\s])\[', ' [', z)                  # 「密友[ˈɪntɪmeɪt] vt.」→ 一词多音前面空一格
    z = re.sub(r'\b(n|v|vt|vi|adj|adv|prep|conj)\.(?=[一-鿿（])', r'\1. ', z)
    return z


def tidy(v):
    return re.sub(r'\s+）', '）', re.sub(r'\s+（', '（', v))   # 书上「nutritional （adj. …）」括号前空一格，网页上很难看


def joined(x, k):
    return tidy('；'.join(x.get(k, [])))


words, rich, units = [], {}, []
raw = [x for x in raw if x['i'] in rows]
lists = sorted({x['list'] for x in raw})
for x in raw:
    r = rows[x['i']]
    words.append({'i': x['i'], 'u': x['u'], 'w': x['w'], 'p': r['p'], 'z': zfix(x['z'])})
    o = {'w': x['w'], 'e': r['e'], 't': r['t']}
    for k, f in (('记', 'r'), ('搭', 'c'), ('派', 'd'), ('同', 'y'), ('反', 'f')):
        v = joined(x, k)
        if k == '搭' and not x.get('例'):
            v = tidy('；'.join(s for s in x.get('搭', []) if not s.endswith('。')))   # 书上印错栏的例句不当搭配
        if v:
            o[f] = v
    rich[x['i']] = o
for l in lists:
    ws = [x for x in raw if x['list'] == l]
    units.append({'u': U0 + l - 1, 'n': len(ws), 'a': ws[0]['w'], 'b': ws[-1]['w'], 't': '%s · List %02d' % (NAME, l)})

J = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
with open(os.path.join(DATA, 'ielts_root.js'), 'w', encoding='utf-8') as f:
    f.write('/* 《雅思词汇词根+联想记忆法 乱序版》（第四十七次优化）：50 个 Word List，一个 List 一个单元，照书里的顺序。\n'
            '   由 src/build_ielts_root.py 从 src/ielts_root/raw.json（PDF 拆的）+ src/ielts_root/Lxx.tsv 生成，\n'
            '   i 从 20001 起、u 4001–4050，跟雅思核心词汇（i 10001–10639 · u 2001–2008）分开。例句等在 data/ielts_root_rich.js。 */\n')
    f.write('window.SAT_WORDS=(window.SAT_WORDS||[]).concat([\n' + ',\n'.join(J(w) for w in words) + '\n]);\n')
    f.write('window.SAT_UNITS=(window.SAT_UNITS||[]).concat(' + J(units) + ');\n')
with open(os.path.join(DATA, 'ielts_root_rich.js'), 'w', encoding='utf-8') as f:
    f.write('/* 雅思词根联想 3539 个词条的例句（第四十七次优化），按词条编号 i 存，并进 IELTS_RICH（rich() 先查它）。\n'
            '   e/t 例句和译文（书上的，书上没有的补写，见 src/ielts_root/Lxx.tsv 的备注）；r 记（书上的词根、联想记忆）；\n'
            '   c 搭配；d 派生；y 同义；f 反义。 */\n')
    f.write('window.IELTS_RICH=window.IELTS_RICH||{};Object.assign(window.IELTS_RICH,{\n' +
            ',\n'.join('%d:%s' % (i, J(o)) for i, o in rich.items()) + '\n});\n')
print('写好 data/ielts_root.js（%d 词、%d 个单元）和 data/ielts_root_rich.js' % (len(words), len(units)))
