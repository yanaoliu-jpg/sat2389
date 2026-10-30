"""查词典（第二十八次优化）：一个词依次查牛津、剑桥、朗文，返回 {w, e: [词条…]}，写进 src/oxscan.jsonl 的就是这个。
每个词条：h 词头、pos 词性、gb/us 录音路径、gi/ui 音标；camb / ld 标明来自剑桥 / 朗文，没有就是牛津。
由 src/update_pron.py 调用。

只收词头和这个词完全一样的条目，或者只是英美拼写不同的（behavior / behaviour）。
牛津常把变体跳到别的词上（aluminum → aluminium、bookstore → bookshop），读音并不一样，这类一律不要，交给下一家。"""
import html, re, subprocess, time, unicodedata, urllib.parse

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'
OX = 'https://www.oxfordlearnersdictionaries.com/'


def get(url):
    for n in range(4):
        out = subprocess.run(['curl', '-sL', '--max-time', '25', '-A', UA, '-w', '\n%{http_code} %{url_effective}', url],
                             capture_output=True).stdout.decode('utf8', 'replace')
        body, _, tail = out.rpartition('\n')
        code = tail.split(' ')[0]
        if code in ('200', '404'):
            return code, tail.split(' ', 1)[-1], body
        time.sleep(3 * (n + 1))
    return 'ERR', '', ''


def norm(x):
    x = unicodedata.normalize('NFKD', re.sub(r'\d+$', '', x.strip()))
    return ''.join(c for c in x.lower() if c.isalpha())


def spelling(x):                   # 英美拼写折叠成一样：our/or、re/er、ise/ize、yse/yze、ll/l、ogue/og
    x = norm(x)
    for a, b in ((r'our', 'or'), (r're$', 'er'), (r'isation', 'ization'), (r'ise$', 'ize'), (r'yse$', 'yze'),
                 (r'll', 'l'), (r'ogue$', 'og'), (r'ae', 'e')):
        x = re.sub(a, b, x)
    return x


def top_of(h):
    i = h.find('class="top-container"')
    if i < 0:
        return ''
    ends = [x for x in (h.find('class="senses_multiple"', i), h.find('class="sense_single"', i)) if x > 0]
    return h[i:min(ends) if ends else i + 6000]


def sound(block):
    m = re.search(r'data-src-mp3="([^"]+)"', block)
    ipa = [re.sub(r'<[^>]+>', '', html.unescape(x)) for x in re.findall(r'<span class="phon">(.*?)</span>', block)]
    return (m.group(1).split('/media/english/')[1] if m else None), ipa


def parse_ox(h, word):
    top = top_of(h)
    hw = re.search(r'<h1 class="headword"[^>]*>(.*?)</h1>', top)
    if not hw:
        return None
    head = re.sub(r'<[^>]+>', '', html.unescape(hw.group(1))).strip()
    variants = [re.sub(r'<[^>]+>', '', html.unescape(x)) for x in re.findall(r'<span class="v"[^>]*>(.*?)</span>', top)]
    if norm(head) != norm(word) and not (word.lower() in [v.lower() for v in variants] and spelling(head) == spelling(word)):
        return None
    ib, iu = top.find('<div class="phons_br"'), top.find('<div class="phons_n_am"')
    gb, gi = sound(top[ib:iu if iu > ib else None]) if ib >= 0 else (None, [])
    us, ui = sound(top[iu:]) if iu >= 0 else (None, [])
    pos = [html.unescape(x) for x in re.findall(r'<span class="pos"[^>]*>(.*?)</span>', top)]
    return {'h': head, 'pos': pos, 'gb': gb, 'gi': gi[:2], 'us': us, 'ui': ui[:2]}


def oxford(word):
    code, url, h = get(OX + 'search/english/direct/?q=' + urllib.parse.quote(word))
    if code == 'ERR':
        raise IOError('oxford ' + word)
    m = re.search(r'/definition/english/([^/?#]+)', url)
    e = parse_ox(h, word) if code == '200' and m else None
    if not e:
        return []
    slug = urllib.parse.unquote(m.group(1))
    out, seen = [e], {slug}
    base = re.sub(r'_?\d+$', '', slug)
    for n in range(1, 8):                 # 同形词：desert_1 / affect1 两种写法都有
        hit = False
        for s in ('%s%d' % (base, n), '%s_%d' % (base, n)):
            if s in seen:
                hit = True
                continue
            code, _, h = get(OX + 'definition/english/' + urllib.parse.quote(s))
            e = parse_ox(h, word) if code == '200' else None
            if e:
                seen.add(s)
                out.append(e)
                hit = True
        if not hit and n >= 2:
            break
    return out


def cambridge(word):
    _, _, h = get('https://dictionary.cambridge.org/us/dictionary/english/' + urllib.parse.quote(re.sub(r' +', '-', word.lower())))
    out = []
    for blk in re.split(r'<div class="[^"]*entry-body__el[^"]*"', h)[1:]:
        hw = re.search(r'<span class="hw dhw">([^<]*)', blk)
        if not hw or norm(hw.group(1)) != norm(word):
            continue

        def side(tag):
            i = blk.find('<span class="%s dpron-i' % tag)
            if i < 0:
                return None, []
            seg = blk[i:i + 1600]
            nx = seg.find('dpron-i', 30)
            seg = seg[:nx] if nx > 0 else seg
            mp = re.search(r'src="/us/media/english/([^"]+\.mp3)"', seg)
            ip = re.search(r'class="ipa dipa[^"]*">(.*?)</span>/', seg, re.S)
            return (mp.group(1) if mp else None), ([re.sub(r'<[^>]+>', '', html.unescape(ip.group(1)))] if ip else [])
        gb, gi = side('uk')
        us, ui = side('us')
        if gb or us:
            out.append({'h': hw.group(1).strip(), 'pos': re.findall(r'class="pos dpos"[^>]*>([^<]*)', blk)[:1],
                        'gb': gb, 'gi': gi, 'us': us, 'ui': ui, 'camb': 1})
    return out


def longman(word):
    _, url, h = get('https://www.ldoceonline.com/dictionary/' + urllib.parse.quote(re.sub(r' +', '-', word.lower())))
    if 'spellcheck' in url:
        return []
    hy = re.search(r'class="HYPHENATION">([^<]*)', h) or re.search(r'class="pagetitle">([^<]*)', h)
    if not hy or norm(hy.group(1).replace('‧', '')) != norm(word):
        return []
    br = re.search(r'data-src-mp3="[^"]*/media/english/(breProns/[^"?]+\.mp3)', h)
    am = re.search(r'data-src-mp3="[^"]*/media/english/(ameProns/[^"?]+\.mp3)', h)
    pr = re.search(r'class="PRON">(.*?)</span>\s*(?:<span class="(?!PRON)|</span>)', h, re.S)
    if not (br or am):
        return []
    ipa = [re.sub(r'<[^>]+>', '', html.unescape(pr.group(1))).strip()] if pr else []
    pos = re.search(r'class="POS">\s*([a-z ]+)', h)
    return [{'h': word, 'pos': [pos.group(1).strip()] if pos else [], 'gb': br and br.group(1), 'gi': ipa,
             'us': am and am.group(1), 'ui': ipa, 'ld': 1}]


def lookup(word):
    has_clip = lambda es: [e for e in es if e['gb'] or e['us']]    # 牛津有的词条没有录音（intersection），要接着查下一家
    return {'w': word, 'e': has_clip(oxford(word)) or has_clip(cambridge(word)) or has_clip(longman(word))}
