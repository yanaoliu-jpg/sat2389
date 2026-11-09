"""《SAT 冲刺终极词汇 1000》（第四十九次优化）→ data/sat1000.js（词条、单元）+ data/sat1000_rich.js（例句等）
输入：src/sat1000/raw.json（src/extract_sat1000.py 从 HTML 拆的）+ src/sat1000/U01–U20.tsv（子代理照 PROMPT.md 整理的）
每行 12 栏：编号§单词§音标§释义§例句§译文§例句2§译文2§构词§搭配§辨析§备注

核对（不过就报错、不写文件）：
- 每个 Unit 50 行，编号、单词和原书一样；释义、例句、译文不空
- 例句和原书第一句一字不差，除非备注写了「改例句」；例句2 不空时和原书补充语境一字不差，除非备注写了「改例句」
- 译文（和不空的译文2）恰好一处 **…**；例句2、译文2 要么都有要么都空
- 音标改了必须在备注写「改音标」
用法：python3 src/build_sat1000.py [--check 只核对] [--partial 只拿写好的 Unit，中途看网页用]"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
SRC = os.path.join(HERE, 'sat1000')
CHECK = '--check' in sys.argv
PARTIAL = '--partial' in sys.argv
NAME = '真题1000'
I0, U0, PER, NU = 30000, 5000, 50, 20   # 子代理按 50 个一份做（U01–U20.tsv）
UPER = 200                               # 网站上 200 个词一个单元（用户定的），共 5 个
J = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))


def tidy(s):
    return re.sub(r'\s+', ' ', s).strip()


def main():
    raw = json.load(open(os.path.join(SRC, 'raw.json'), encoding='utf-8'))
    errs, words, units, rich = [], [], [], {}
    for k in range(1, NU + 1):
        path = os.path.join(SRC, 'U%02d.tsv' % k)
        if not os.path.exists(path):
            if PARTIAL: continue
            errs.append('缺 U%02d.tsv' % k); continue
        rows = [l.rstrip('\n') for l in open(path, encoding='utf-8') if l.strip()]
        if len(rows) != PER: errs.append('U%02d 有 %d 行' % (k, len(rows)))
        u = U0 + (k - 1) * PER // UPER + 1
        for n, line in enumerate(rows):
            c = line.split('§')
            where = 'U%02d 第 %d 行' % (k, n + 1)
            if len(c) != 12: errs.append('%s 有 %d 栏' % (where, len(c))); continue
            i, w, p, z, e, t, e2, t2, r, col, note, memo = [tidy(x) for x in c]
            src = raw[(k - 1) * PER + n]
            if i != str(I0 + src['n']) or w != src['w']:
                errs.append('%s 编号/单词对不上：%s %s ≠ %d %s' % (where, i, w, I0 + src['n'], src['w'])); continue
            if not z or not e or not t: errs.append('%s %s 释义/例句/译文有空的' % (where, w))
            if p != src['p'] and '改音标' not in memo: errs.append('%s %s 音标改了没登记' % (where, w))
            ex1 = [x for x in src['ex'] if not x['more']]
            ex2 = [x for x in src['ex'] if x['more']]
            if e != tidy(ex1[0]['en']) and '改例句' not in memo: errs.append('%s %s 例句和原书不一样' % (where, w))
            if e2 and (not ex2 or e2 != tidy(ex2[0]['en'])) and '改例句' not in memo:
                errs.append('%s %s 例句2 和原书不一样' % (where, w))
            if bool(e2) != bool(t2): errs.append('%s %s 例句2/译文2 只有一个' % (where, w))
            for tt, lab in ((t, '译文'), (t2, '译文2')):
                if tt and (tt.count('**') != 2 or not re.search(r'\*\*[^*]+\*\*', tt)):
                    errs.append('%s %s %s不是恰好一处 **' % (where, w, lab))
            words.append({'i': int(i), 'u': u, 'w': w, 'p': p, 'z': z})
            o = {'w': w, 'e': e, 't': t}
            if e2: o['x'] = [e2, t2]
            if r: o['r'] = r
            if col: o['c'] = col
            if note: o['n'] = note
            rich[int(i)] = o
    for u in sorted(set(x['u'] for x in words)):
        us = [x for x in words if x['u'] == u]
        units.append({'u': u, 'n': len(us), 'a': us[0]['w'], 'b': us[-1]['w'], 't': '%s · Unit %02d' % (NAME, u - U0)})
    if errs:
        print('\n'.join(errs[:80])); print('共 %d 处问题' % len(errs)); sys.exit(1)
    print('核对通过：%d 个词条、%d 个单元' % (len(words), len(units)))
    if CHECK: return
    head = ('/* 《SAT 冲刺终极词汇 1000》（第四十九次优化）：1000 个 SAT 真题高频词，照原书顺序（真题独立语境数从多到少）\n'
            '   每 200 个一个单元，「真题1000 · Unit 01」到「Unit 05」，i 30001–31000、u 5001–5005。\n'
            '   由 src/build_sat1000.py 从 src/sat1000/raw.json + src/sat1000/Uxx.tsv 生成。例句等在 data/sat1000_rich.js。 */\n')
    with open(os.path.join(DATA, 'sat1000.js'), 'w', encoding='utf-8') as f:
        f.write(head + 'window.SAT_WORDS=(window.SAT_WORDS||[]).concat([\n' + ',\n'.join(J(x) for x in words) + '\n]);\n')
        f.write('window.SAT_UNITS=(window.SAT_UNITS||[]).concat(' + J(units) + ');\n')
    head = ('/* 真题1000 的例句（第四十九次优化），按词条编号 i 存，并进 IELTS_RICH（rich() 先查它，编号和单词都对得上才用）。\n'
            '   e/t 真题原句和译文（译文对不上的子代理改过，见 src/sat1000/Uxx.tsv 的备注）；x 第二句真题原句 [英文, 译文]；\n'
            '   r 构词；c 搭配；n 辨析。 */\n')
    with open(os.path.join(DATA, 'sat1000_rich.js'), 'w', encoding='utf-8') as f:
        f.write(head + 'window.IELTS_RICH=window.IELTS_RICH||{};Object.assign(window.IELTS_RICH,{\n' +
                ',\n'.join('%d:%s' % (k, J(v)) for k, v in rich.items()) + '\n});\n')
    print('写好 data/sat1000.js、data/sat1000_rich.js')


if __name__ == '__main__':
    main()
