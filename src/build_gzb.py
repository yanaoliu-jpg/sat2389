#!/usr/bin/env python3
"""第六十次优化：《高中英语词汇 念念不忘 便携版》→ data/gzb.js、data/gzb_rich.js（照 build_gz.py 改的）

用法：python3 src/build_gzb.py           （23 课都得有 src/gzb/Lxx.tsv）
      python3 src/build_gzb.py --check   （只核对已经写好的 Lxx.tsv，不写文件）
      python3 src/build_gzb.py --partial （只拿写好的课生成，中途看网页用，正式发布不能用）

正本：src/gzb/raw.json（extract_gzb.py 从 xlsx 取的）+ src/gzb/in/Lxx.tsv（prep_gzb.js 配好的参考：
《新版高中词汇》/《四级词汇2022版》/《四级词汇海豚版》里同一个词的音标、释义、例句）+ src/gzb/Lxx.tsv（子代理整理的，每行
编号§单词§音标§释义§例句§译文§备注，见 PROMPT.md，`=` 表示沿用参考）。核对不过就报错，一个文件都不写：
- 行数、编号和原表一样；单词和原表不一样时备注要写「改词形」
- 音标 / 释义 / 例句 `=` 只能用在有参考的词上；音标要像 IPA；释义有中文、有词性，没有 a. ad. 旧缩写、半角逗号分号、尖括号
- 单词和参考单词拼法不同时例句不能 `=`（参考句里是另一种拼法）；译文恰好一处 **…**
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, 'gzb')
DATA = os.path.join(HERE, '..', 'data')
CHECK = '--check' in sys.argv
PARTIAL = '--partial' in sys.argv
NAME = '高中便携版'
U0 = 6301
CJK = re.compile(r'[一-鿿]')
POS = re.compile(r'(^|\s|）|/)(n|v|vt|vi|adj|adv|prep|conj|pron|num|art|int|aux)\.')
OLD = re.compile(r'(^|\s|/)(a|ad|cong|ept)\.')


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
                ipa = q[4]
                if not ipa:
                    errs.append('%s：音标写了 = 但没有现成音标' % tag)
            if not ipa or CJK.search(ipa) or re.search(r'[/\[\]]', ipa):
                errs.append('%s：音标不对（%s）' % (tag, ipa))
            if z == '=':
                z = q[5]
                if not z:
                    errs.append('%s：释义写了 = 但没有参考释义' % tag)
            if not CJK.search(z) or not POS.search(z):
                errs.append('%s：释义没有中文或词性（%s）' % (tag, z))
            if OLD.search(z) or re.search(r'[<>]', z) or re.search(r'[,;:]', re.sub(r'\[[^\]]*\]|（[^）]*）', '', z)):
                errs.append('%s：释义里还有旧缩写 / 尖括号 / 半角标点（%s）' % (tag, z))
            if (e == '=') != (t == '='):
                errs.append('%s：例句和译文一个 = 一个不是' % tag)
            if e == '=':
                e, t = q[6], q[7]
                if not e:
                    errs.append('%s：例句写了 = 但没有参考例句' % tag)
                elif q[3] and q[3].lower() != w.lower() and not re.search(r'\b' + re.escape(w[:-1] if len(w) >= 5 else w), e, re.I):
                    errs.append('%s：单词和参考单词（%s）拼法不同，参考例句里没有 %s' % (tag, q[3], w))
            if not e or not t or CJK.search(e):
                errs.append('%s：例句或译文是空的 / 例句里有中文' % tag)
            if t.count('**') != 2 or re.search(r'\*\*\s*\*\*', t):
                errs.append('%s：译文里 ** 不是恰好一处' % tag)
            rec = {'i': x['i'], 'u': U0 + l - 1, 'w': w, 'p': ipa, 'z': z}
            words.append(rec)
            uw.append(rec)
            rich[x['i']] = {'w': w, 'e': e, 't': t}
        if uw:
            units.append({'u': U0 + l - 1, 'n': len(uw), 'a': uw[0]['w'], 'b': uw[-1]['w'], 't': '%s · Lesson %02d' % (NAME, l)})
    if errs:
        print('\n'.join(errs[:200]))
        print('共 %d 处不对' % len(errs))
        sys.exit(1)
    print('核对通过：%d 课、%d 个词' % (len(units), len(words)))
    if CHECK:
        return
    j = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(DATA, 'gzb.js'), 'w', encoding='utf-8') as f:
        f.write('/* 《高中英语词汇 念念不忘 便携版》（第六十次优化）：23 课，一课一个单元，\n'
                '   「高中便携版 · Lesson 01」到「Lesson 23」，i 49001 起、u 6301–6323，照原表顺序。\n'
                '   由 src/build_gzb.py 从 src/gzb/raw.json + src/gzb/Lxx.tsv 生成。例句在 data/gzb_rich.js。 */\n')
        f.write('window.SAT_WORDS=(window.SAT_WORDS||[]).concat([\n' + ',\n'.join(j(w) for w in words) + '\n]);\n')
        f.write('window.SAT_UNITS=(window.SAT_UNITS||[]).concat(' + j(units) + ');\n')
    with open(os.path.join(DATA, 'gzb_rich.js'), 'w', encoding='utf-8') as f:
        f.write('/* 高中便携版的例句（第六十次优化），按词条编号 i 存，并进 IELTS_RICH（rich() 先查它，编号和单词都对得上才用）。\n'
                '   大部分沿用新版高中词汇 / 四级两本书里同一个词的例句，其余是整理时新写的，见 src/gzb/Lxx.tsv。 */\n')
        f.write('window.IELTS_RICH=window.IELTS_RICH||{};Object.assign(window.IELTS_RICH,{\n'
                + ',\n'.join('%d:%s' % (k, j(v)) for k, v in rich.items()) + '\n});\n')
    print('已写 data/gzb.js、data/gzb_rich.js' + ('（partial）' if PARTIAL else ''))


main()
