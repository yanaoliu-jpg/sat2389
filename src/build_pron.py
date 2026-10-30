"""生成 data/pron.js（第二十八次优化）：词 → 牛津 / 剑桥的录音地址、英美音标、每个录音要压多少 dB。

  python3 src/build_pron.py <词表信息.json>

输入 src/oxscan.jsonl（抓下来的词条）、src/oxlufs.tsv（src/measure_pron.py 量的响度），
词表信息是 {词: {pos: [词性…]}}。格式说明见 pure.js 的 pronList。
读音不同的条目按这个词在词表里出现的词性筛：词表只收动词，就不放名词的读音。
"""
import json, os, re, statistics, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = -21.0      # 跟 src/measure_yd.py 一样：比这个响的压到这里，比它轻的原样播
POS = {'noun': 'n', 'verb': 'v', 'adjective': 'a', 'adverb': 'ad', 'preposition': 'prep', 'conjunction': 'conj',
       'pronoun': 'pron', 'exclamation': 'int', 'determiner': 'det', 'number': 'num', 'phrasal verb': 'v',
       'idiom': 'phr', 'modal verb': 'v', 'auxiliary verb': 'v', 'abbreviation': 'abbr', 'ordinal number': 'num'}
LABEL = {'n': 'n.', 'v': 'v.', 'a': 'adj.', 'ad': 'adv.', 'prep': 'prep.', 'conj': 'conj.', 'pron': 'pron.',
         'int': 'int.', 'det': 'det.', 'num': 'num.', 'phr': 'phr.', 'abbr': 'abbr.'}


def clean(ipa):
    return ipa.strip().strip('/[]').strip().replace('.', '').replace('·', '').replace('-', '')     # 剑桥用点分音节，朗文用短横


def clip(word, path, gb, e):
    if not path:
        return ''
    if e.get('camb'):
        return '~' + path[:-4]
    if e.get('ld'):
        return '^' + path[:-4]
    if e.get('wk'):
        return '@' + path[:-4]
    rest = path.split('/', 1)[1][:-4]          # uk_pron/a/ama/amate/x__gb_1.mp3 → a/ama/amate/x__gb_1
    stem = rest.rsplit('/', 1)[1]
    if rest != '%s/%s/%s/%s' % (stem[0], stem[:3], stem[:5], stem):
        return rest
    pre = re.sub(r'[ -]', '_', word.lower()) + '__' + ('gb' if gb else 'us') + '_'
    tail = stem[len(pre):] if stem.startswith(pre) else ''
    return tail if tail[:1].isdigit() else stem


def main():
    meta = json.load(open(sys.argv[1], encoding='utf8'))
    lufs = {}
    for line in open(os.path.join(ROOT, 'src', 'oxlufs.tsv'), encoding='utf8'):
        p = line.rstrip('\n').split('\t')
        if len(p) == 3 and p[1] != 'NA' and float(p[2]) >= 0.2:
            lufs[p[0]] = max(0.0, float(p[1]) - TARGET)
    cuts = [[], []]
    rows = []
    for line in open(os.path.join(ROOT, 'src', 'oxscan.jsonl'), encoding='utf8'):
        rows.append(json.loads(line))
    for r in rows:
        for e in r['e']:
            for s, k in enumerate(('gb', 'us')):
                if e.get(k) in lufs:
                    cuts[s].append(round(lufs[e[k]]))
    d = [int(statistics.median(c)) for c in cuts]
    out, stats, none = {}, {'ox': 0, 'cam': 0, 'ld': 0, 'wk': 0, 'multi': 0}, []
    for r in rows:
        w = r['w']
        want = (meta.get(w) or {}).get('pos') or []
        ents = []
        for e in r['e']:
            gb, us = e.get('gb') if e.get('gb') in lufs else None, e.get('us') if e.get('us') in lufs else None
            gi, ui = clean((e.get('gi') or [''])[0]), clean((e.get('ui') or [''])[0])
            if not (gi or ui) or (e.get('wk') and ('(' in gi or 'ɫ' in gi)):    # 没写音标，或者维基词典写法太杂，用词表自己的
                gi = ui = clean((meta.get(w) or {}).get('p', ''))
            if not (gb or us):
                continue
            ents.append((POS.get((e.get('pos') or [''])[0], ''), gb, gi or ui, us, ui or gi, e))
        if not ents:
            none.append(w)
            continue
        if ents[0][5].get('camb') or ents[0][5].get('ld'):     # 剑桥一个词有好几本词典的条目，音标写法略有出入，每个词性留第一条
            ents = [x for n, x in enumerate(ents) if x[0] not in [y[0] for y in ents[:n]]]
        kept = [x for x in ents if x[0] in want] or ents       # 词表里没有的词性不放
        kept.sort(key=lambda x: want.index(x[0]) if x[0] in want else 99)
        row = []
        for pos, gb, gi, us, ui, src in kept:
            item = [LABEL.get(pos, ''), clip(w, gb, True, src), gi, clip(w, us, False, src), '' if ui == gi else ui]
            cg, cu = round(lufs.get(gb, 0)), round(lufs.get(us, 0))
            if cg != d[0] or cu != d[1]:
                item += [cg, cu]
            row.append(item)
        out[w] = row
        stats['cam' if kept[0][5].get('camb') else 'ld' if kept[0][5].get('ld') else 'wk' if kept[0][5].get('wk') else 'ox'] += 1
        if len({x[4] for x in kept}) > 1 or len({x[2] for x in kept}) > 1:
            stats['multi'] += 1
    js = ('/* 单词发音表（第二十八次优化），由 src/build_pron.py 生成，格式见 pure.js 的 pronList。\n'
          '   录音都在牛津 / 剑桥网站上，这里只存地址。 */\n'
          'window.PRON=%s;\n') % json.dumps({'d': d, 'w': out}, ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(ROOT, 'data', 'pron.js'), 'w', encoding='utf8').write(js)
    print('data/pron.js', len(js.encode()) // 1024, 'KB', stats, 'default cut', d, 'no clip', len(none))
    print('no clip:', ' / '.join(none))


if __name__ == '__main__':
    main()
