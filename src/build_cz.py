#!/usr/bin/env python3
"""第六十二次优化：《初中英语词汇 乱序版》（浙江教育）→ data/cz.js、data/cz_rich.js（照 build_gzb.py 改的）

用法：python3 src/build_cz.py           （33 个 List 都得有 src/cz/Lxx.tsv）
      python3 src/build_cz.py --check   （只核对已经写好的 Lxx.tsv，不写文件）
      python3 src/build_cz.py --partial （只拿写好的 List 生成，中途看网页用，正式发布不能用）

正本：src/cz/raw.json（extract_cz.py 从 xlsx 取的）+ src/cz/in/Lxx.tsv（prep_cz.js 配好的：原表音标、原表释义，
加上网站里高中 / 四级书同一个词的音标、释义、例句做参考，9 栏）+ src/cz/Lxx.tsv（子代理整理的，每行
编号§单词§音标§释义§例句§译文§备注，见 PROMPT.md；音标 `=` 表示沿用原表音标，例句 `=` 表示沿用参考例句，释义不能 `=`）。核对不过就报错，一个文件都不写：
- 行数、编号和原表一样；单词和原表不一样时备注要写「改词形」
- 音标 `=` 要原表有音标、例句 `=` 要有参考例句；音标要像 IPA；释义有中文、有词性，没有 a. ad. 旧缩写、半角逗号分号冒号、
  半角括号、尖括号、【名】、‖，精简过（不超过 90 个字符）
- 单词和参考单词拼法不同时例句不能 `=`（参考句里是另一种拼法）；译文恰好一处 **…**
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, 'cz')
DATA = os.path.join(HERE, '..', 'data')
CHECK = '--check' in sys.argv
PARTIAL = '--partial' in sys.argv
NAME = '初中词汇'
U0 = 6401
ZMAX = 90
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
            if not re.match(r"^[A-Za-z][A-Za-z\-'. ]*$", w):
                errs.append('%s：单词「%s」不像一个词' % (tag, w))
            if ipa == '=':
                ipa = q[2]
                if not ipa:
                    errs.append('%s：音标写了 = 但原表没有音标' % tag)
            if not ipa or CJK.search(ipa) or re.search(r'[/\[\],\'"]', ipa):
                errs.append('%s：音标不对（%s）' % (tag, ipa))
            if z == '=':
                errs.append('%s：释义不能写 =' % tag)
            if len(z) > ZMAX:
                errs.append('%s：释义 %d 个字符，没精简（%s）' % (tag, len(z), z))
            if re.search(r'【名】|‖|人名', z):
                errs.append('%s：释义里还有人名 / ‖（%s）' % (tag, z))
            if not CJK.search(z) or not POS.search(z):
                errs.append('%s：释义没有中文或词性（%s）' % (tag, z))
            if OLD.search(z) or re.search(r'[<>()]', z) or re.search(r'[,;:]', re.sub(r'\[[^\]]*\]|（[^）]*）', '', z)):
                errs.append('%s：释义里还有旧缩写 / 尖括号 / 半角标点（%s）' % (tag, z))
            if (e == '=') != (t == '='):
                errs.append('%s：例句和译文一个 = 一个不是' % tag)
            if e == '=':
                e, t = q[7], q[8]
                if not e:
                    errs.append('%s：例句写了 = 但没有参考例句' % tag)
                elif q[4] and q[4].lower() != w.lower() and not re.search(r'\b' + re.escape(w[:-1] if len(w) >= 5 else w), e, re.I):
                    errs.append('%s：单词和参考单词（%s）拼法不同，参考例句里没有 %s' % (tag, q[4], w))
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
    with open(os.path.join(DATA, 'cz.js'), 'w', encoding='utf-8') as f:
        f.write('/* 《初中英语词汇 乱序版》（浙江教育，第六十二次优化）：33 个 List，一个 List 一个单元，\n'
                '   「初中词汇 · List 01」到「List 33」，i 51001 起、u 6401–6433，照原表顺序。释义从原表的词典式长条目精简到初中常用。\n'
                '   由 src/build_cz.py 从 src/cz/raw.json + src/cz/Lxx.tsv 生成。例句在 data/cz_rich.js。 */\n')
        f.write('window.SAT_WORDS=(window.SAT_WORDS||[]).concat([\n' + ',\n'.join(j(w) for w in words) + '\n]);\n')
        f.write('window.SAT_UNITS=(window.SAT_UNITS||[]).concat(' + j(units) + ');\n')
    with open(os.path.join(DATA, 'cz_rich.js'), 'w', encoding='utf-8') as f:
        f.write('/* 初中词汇的例句（第六十二次优化），按词条编号 i 存，并进 IELTS_RICH（rich() 先查它，编号和单词都对得上才用）。\n'
                '   一部分沿用高中 / 四级书里同一个词的例句，其余是整理时按初中难度新写的，见 src/cz/Lxx.tsv。 */\n')
        f.write('window.IELTS_RICH=window.IELTS_RICH||{};Object.assign(window.IELTS_RICH,{\n'
                + ',\n'.join('%d:%s' % (k, j(v)) for k, v in rich.items()) + '\n});\n')
    print('已写 data/cz.js、data/cz_rich.js' + ('（partial）' if PARTIAL else ''))


main()
