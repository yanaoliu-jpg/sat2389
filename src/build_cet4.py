#!/usr/bin/env python3
"""第五十三次优化：《四级词汇2022版》→ data/cet4.js、data/cet4_rich.js

用法：python3 src/build_cet4.py           （35 个 List 都得有 src/cet4/Lxx.tsv）
      python3 src/build_cet4.py --check   （只核对已经写好的 Lxx.tsv，不写文件）
      python3 src/build_cet4.py --partial （只拿写好的 List 生成，中途看网页用，正式发布不能用）

正本：src/cet4/raw.json（extract_cet4.py 从 xls 取的）+ src/cet4/in/Lxx.tsv（prep_cet4.js 配好的现成音标、候选例句）
+ src/cet4/Lxx.tsv（子代理整理的，每行 编号§单词§音标§释义§例句§译文§备注，见 PROMPT.md）。核对不过就报错，一个文件都不写：
- 行数、编号和原表一样；单词和原表不一样时备注要写「改词形」
- 音标 `=` 只能用在有现成音标的词上；不是 `=` 的要像 IPA（没有中文、斜杠）
- 释义有中文、有词性；例句、译文都是 `=`（只在有候选例句时）或都是自己写的；自写译文恰好一处 **…**
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, 'cet4')
DATA = os.path.join(HERE, '..', 'data')
CHECK = '--check' in sys.argv
PARTIAL = '--partial' in sys.argv
NAME = '四级词汇'
U0 = 6001
CJK = re.compile(r'[一-鿿]')
POS = re.compile(r'(^|\s|）)(n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|aux)\.')


def main():
    raw = json.load(open(os.path.join(DIR, 'raw.json'), encoding='utf-8'))
    lists = sorted({x['list'] for x in raw})
    errs, words, rich, units = [], [], {}, []
    for l in lists:
        book = [x for x in raw if x['list'] == l]
        p = os.path.join(DIR, 'L%02d.tsv' % l)
        if not os.path.exists(p):
            if not CHECK and not PARTIAL:
                errs.append('L%02d.tsv 还没有' % l)
            continue
        inp = [s.split('§') for s in open(os.path.join(DIR, 'in', 'L%02d.tsv' % l), encoding='utf-8').read().split('\n') if s.strip()]
        lines = [s for s in open(p, encoding='utf-8').read().split('\n') if s.strip()]
        if len(lines) != len(book):
            errs.append('L%02d：%d 行，原表 %d 个词' % (l, len(lines), len(book)))
            continue
        uw = []
        for s, x, q in zip(lines, book, inp):
            c = [v.strip() for v in s.split('§')]
            tag = 'L%02d %s' % (l, x['w'])
            if len(c) != 7:
                errs.append('%s：%d 栏' % (tag, len(c)))
                continue
            i, w, ipa, z, e, t, note = c
            if i != str(x['i']):
                errs.append('%s：编号对不上（%s）' % (tag, i))
                continue
            if w != x['w'].strip() and '改词形' not in note:
                errs.append('%s：单词改成 %s，备注没写「改词形」' % (tag, w))
            if not re.match(r"^[A-Za-z][A-Za-z\-' ]*$", w):
                errs.append('%s：单词「%s」不像一个词' % (tag, w))
            if ipa == '=':
                ipa = q[3]
                if not ipa:
                    errs.append('%s：音标写了 = 但没有现成音标' % tag)
            if not ipa or CJK.search(ipa) or re.search(r'[/\[\]]', ipa):
                errs.append('%s：音标不对（%s）' % (tag, ipa))
            if not CJK.search(z) or not POS.search(z):
                errs.append('%s：释义没有中文或词性（%s）' % (tag, z))
            if (e == '=') != (t == '='):
                errs.append('%s：例句和译文一个 = 一个不是' % tag)
            if e == '=':
                e, t = q[4], q[5]
                if not e:
                    errs.append('%s：例句写了 = 但没有候选例句' % tag)
            if not e or not t or CJK.search(e):
                errs.append('%s：例句或译文是空的 / 例句里有中文' % tag)
            if t.count('**') != 2 or re.search(r'\*\*\s*\*\*', t):
                errs.append('%s：译文里 ** 不是恰好一处' % tag)
            rec = {'i': x['i'], 'u': U0 + l - 1, 'w': w, 'p': ipa, 'z': z}
            words.append(rec)
            uw.append(rec)
            rich[x['i']] = {'w': w, 'e': e, 't': t}
        if uw:
            units.append({'u': U0 + l - 1, 'n': len(uw), 'a': uw[0]['w'], 'b': uw[-1]['w'], 't': '%s · List %02d' % (NAME, l)})
    if errs:
        print('\n'.join(errs[:200]))
        print('共 %d 处不对' % len(errs))
        sys.exit(1)
    print('核对通过：%d 个 List、%d 个词' % (len(units), len(words)))
    if CHECK:
        return
    j = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(DATA, 'cet4.js'), 'w', encoding='utf-8') as f:
        f.write('/* 《四级词汇2022版》（浙江教育出版社，第五十三次优化）：35 个 List，一个 List 一个单元，\n'
                '   「四级词汇 · List 01」到「List 35」，i 40001 起、u 6001–6035，照原表顺序。\n'
                '   由 src/build_cet4.py 从 src/cet4/raw.json + src/cet4/Lxx.tsv 生成。例句在 data/cet4_rich.js。 */\n')
        f.write('window.SAT_WORDS=(window.SAT_WORDS||[]).concat([\n' + ',\n'.join(j(w) for w in words) + '\n]);\n')
        f.write('window.SAT_UNITS=(window.SAT_UNITS||[]).concat(' + j(units) + ');\n')
    with open(os.path.join(DATA, 'cet4_rich.js'), 'w', encoding='utf-8') as f:
        f.write('/* 四级词汇的例句（第五十三次优化），按词条编号 i 存，并进 IELTS_RICH（rich() 先查它，编号和单词都对得上才用）。\n'
                '   《雅思词根+联想记忆》里有的词沿用书上那句，其余是整理时新写的，见 src/cet4/Lxx.tsv。 */\n')
        f.write('window.IELTS_RICH=window.IELTS_RICH||{};Object.assign(window.IELTS_RICH,{\n'
                + ',\n'.join('%d:%s' % (k, j(v)) for k, v in rich.items()) + '\n});\n')
    print('已写 data/cet4.js、data/cet4_rich.js' + ('（partial）' if PARTIAL else ''))


main()
