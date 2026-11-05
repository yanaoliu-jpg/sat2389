"""第四十七次优化：从《雅思词汇词根+联想记忆法 乱序版》PDF 拆出词条，写 src/ielts_root/raw.json。

用法：python3 src/extract_ielts_root.py [PDF 路径]
默认 PDF 是仓库外面那份 ../雅思词汇词根+联想记忆法_乱序版_2022(2).pdf。
PDF 是 calibre 生成的，文字能直接取（不是扫描），用 pdftotext（不加 -layout）。

每个词条：list（第几个 Word List）、w、star（书上带 * 的）、p（音标，书上没有就是空）、
z（释义，原样；一词多音的写成「vt. 拒绝 [ˈriːdʒekt] n. 被拒货品」）、
记 / 搭 / 例 / 派 / 同 / 反（书上的几栏，各是一个列表）。
例句一栏是「英文 中文」连在一起的，拆开在 build_ielts_root.py 里做。
"""
import json, os, re, subprocess, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
PDF = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', '..', '雅思词汇词根+联想记忆法_乱序版_2022(2).pdf')
OUT = os.path.join(HERE, 'ielts_root', 'raw.json')

text = subprocess.run(['pdftotext', PDF, '-'], capture_output=True, check=True).stdout.decode('utf-8')
L = text.split('\n')
# 正文：第二次出现的「Word List 01」（第一次是目录）到书末附录「一 雅思必备词根、词缀」
start = [i for i, l in enumerate(L) if l.strip() == 'Word List 01'][1]
end = next(i for i, l in enumerate(L) if l.strip().startswith('一 雅思必备词根') and i > start)
L = L[start:end]
n = len(L)

POS = r'(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|int|interj|abbr|aux|art|pl|a)\.'
POS_RE = re.compile(r'^\s*\(?' + POS)
HEAD_RE = re.compile(r"^([A-Za-z][A-Za-z\-'’ .()/]*?)(\*?)\s*(\[[^\]]*\])?\s*$")
HEAD_ONE = re.compile(r"^([A-Za-z][A-Za-z\-'’ .()/]*?)(\*?)\s*(\[[^\]]*\])\s*(\S.*)$")
IPA_LINE = re.compile(r'^(\[[^\]]*\])\s*(.*)$')
MARK_RE = re.compile(r'^\s*([例记搭派同反])\s+(.*)$')
NOISE = {'音频', '影视剧场景'}


def skip(s):
    return not s or re.fullmatch(r'\d{1,4}', s) or s in NOISE


def nxt(k):
    k += 1
    while k < n and skip(L[k].strip()):
        k += 1
    return k, (L[k].strip() if k < n else '')


def head_at(i):
    """第 i 行是不是词头：返回 (单词, 带*, 音标, 释义第一行, 释义从哪一行之后接着读) 或 None"""
    s = L[i].strip()
    one = HEAD_ONE.match(s)   # 「intimate [ˈɪntɪmət] adj. 亲密的…」：词头、音标、释义都在一行
    if one and POS_RE.match(one.group(4)):
        return one.group(1).strip(), bool(one.group(2)), one.group(3)[1:-1].strip(), one.group(4), i
    h = HEAD_RE.match(s)
    if not h or not h.group(1).strip():
        return None
    k, ns = nxt(i)
    ipa, first = h.group(3), None
    if not ipa:
        m = IPA_LINE.match(ns)
        if m:
            ipa = m.group(1)
            if m.group(2):
                first = m.group(2)   # 「[ˈdezət] n. 沙漠」：音标和释义在同一行
            else:
                k, ns = nxt(k)
    if first is None:
        if not POS_RE.match(ns):
            return None
        first = ns
    if not POS_RE.match(first):
        return None
    return h.group(1).strip(), bool(h.group(2)), (ipa or '')[1:-1].strip(), first, k


# 第一遍：找出所有像词头的行
cands = {}
for i in range(n):
    r = head_at(i)
    if r:
        cands[i] = r
idx = sorted(cands)


def block_has_marker(i):
    """从这个词头到下一个候选词头之间有没有「例 / 记 / 搭…」"""
    j = next((x for x in idx if x > i), n)
    return any(MARK_RE.match(L[k].strip()) for k in range(i + 1, j)), j


lists, cur, entry, field = [], None, None, None
in_preview = False
i = 0
while i < n:
    s = L[i].strip()
    m = re.fullmatch(r'Word List (\d\d)', s)
    if m:
        cur = {'list': int(m.group(1)), 'words': []}
        lists.append(cur)
        entry, field, in_preview = None, None, True
        i += 1
        continue
    if skip(s):
        i += 1
        continue
    if i in cands:
        w, star, ipa, first, k = cands[i]
        ok = True
        if in_preview:
            # 每个 List 开头的「词根/词缀预习表」里也有「单词 + 词性」，排版拆散以后会被当成词头：
            # 预习表里的词没有音标，后面也没有「记 / 例」。List 44 整个 List 书上都没印音标，所以看后面有没有「记 / 例」。
            has, j = block_has_marker(i)
            junk = any('例词及释义' in L[x] or '含义' in L[x] for x in range(i + 1, j))
            # 预习表里词性单独占一行（「vi.」下一行才是「干」），真词条的词性后面同一行就有释义
            bare = re.fullmatch(r'[a-z./&]+', first.strip()) is not None
            ok = (bool(ipa) or has) and not junk and not bare
        if ok:
            entry = {'w': w, 'star': star, 'p': ipa, 'z': [first], 'parts': collections.OrderedDict()}
            cur['words'].append(entry)
            in_preview, field = False, 'z'
            i = k + 1
            continue
    if in_preview or entry is None:
        i += 1
        continue
    mm = MARK_RE.match(s)
    if mm:
        field = mm.group(1)
        entry['parts'].setdefault(field, []).append([mm.group(2)])
    elif field == 'z':
        entry['z'].append(s)
    else:
        entry['parts'][field][-1].append(s)
    i += 1


def join(parts):
    out = ''
    for p in parts:
        if out and re.search(r'[A-Za-z0-9,.;:!?’”)\]…]$', out) and re.match(r'[A-Za-z0-9(“‘\[]', p):
            out += ' ' + p
        else:
            out += p
    return out.strip()


# pdftotext 有时把例句译文的最后一行（换页处）排到了释义第一行后面：heal 的释义成了「调停合。」，
# 例句译文停在「才愈」。释义有不止一行、最后一行是短短一截以句末标点结尾、例句译文又没结束时，把它挪回例句。
FRAG = re.compile(r'^[\u4e00-\u9fff0-9，、“”‘’：；…—（）《》A-Za-z ]{0,16}[。？！”）]$')
moved = []
for lst in lists:
    for e in lst['words']:
        ex = e['parts'].get('例')
        if len(e['z']) > 1 and FRAG.match(e['z'][-1]) and ex and not re.search(r'[。？！”）)]$', ex[-1][-1]):
            ex[-1].append(e['z'].pop())
            moved.append(e['w'])
# 书上有几处把搭配印在「例」那一栏（List 21 的 destination、welfare…）：不是整句、没有句末标点、带「；」或很短的，挪到「搭」
recl = []
for lst in lists:
    for e in lst['words']:
        ex = e['parts'].get('例')
        if not ex:
            continue
        keep = []
        for item in ex:
            t = join(item)
            if not re.search(r'[。？！”）)…」]$', t) and ('；' in t or len(re.findall(r'[A-Za-z]+', t)) < 6):
                e['parts'].setdefault('搭', []).append(item)
                recl.append(e['w'])
            else:
                keep.append(item)
        if keep:
            e['parts']['例'] = keep
        else:
            del e['parts']['例']
if recl:
    print('「例」栏里其实是搭配的 %d 处：%s' % (len(recl), ' '.join(recl)))
if moved:
    print('挪回例句的译文尾巴 %d 处：%s' % (len(moved), ' '.join(moved)))

res = []
for lst in lists:
    for e in lst['words']:
        d = {'list': lst['list'], 'w': e['w'], 'star': e['star'], 'p': e['p'], 'z': join(e['z'])}
        for k, v in e['parts'].items():
            d[k] = [join(x) for x in v]
        res.append(d)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('[\n' + ',\n'.join(json.dumps(d, ensure_ascii=False) for d in res) + '\n]\n')
c = collections.Counter(d['list'] for d in res)
print(len(res), '个词条，', len(c), '个 List：', ' '.join('%d:%d' % kv for kv in sorted(c.items())))
