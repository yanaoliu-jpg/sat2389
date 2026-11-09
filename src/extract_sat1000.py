"""拆《SAT 冲刺终极词汇 1000》HTML（第四十九次优化）→ src/sat1000/raw.json
每个词条：n 序号、w 核心词、p 音标（去斜杠）、pos 词性、tier 频度难度、senses [{k: dnum/构词/辨析, pos, ext, text}]、
kin 搭配说明 [文本]、note 例句旁的易误读警示、ex [{src, en, mark, zh, more}]。变体词表、词频统计不要。"""
import html, json, re, sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[2] / 'SAT冲刺终极1000真题词[博思SAT教研](2).html'
OUT = Path(__file__).resolve().parent / 'sat1000' / 'raw.json'

def txt(s):
    s = re.sub(r'<br\s*/?>', ' ', s)
    s = re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()

def main():
    s = SRC.read_text(encoding='utf-8')
    parts = re.split(r"<div class='card' id='w(\d+)'>", s)
    out = []
    for k in range(1, len(parts), 2):
        n, b = int(parts[k]), parts[k + 1]
        b = b[:b.find("<div class='cfoot'>")]
        g = lambda c: txt(re.search(r"<span class='%s'>(.*?)</span>" % c, b).group(1))
        tier = re.search(r"<span class='tier [^']*'>(.*?)</span>", b)
        e = {'n': n, 'w': g('hword'), 'p': g('ipa').strip('/ '), 'pos': g('pos'),
             'tier': txt(tier.group(1)) if tier else '', 'senses': [], 'kin': [], 'note': '', 'ex': []}
        ul = re.search(r"<ul class='senses'>(.*?)</ul>", b, re.S).group(1)
        for li in re.findall(r'<li>(.*?)</li>', ul, re.S):
            st = re.search(r"<span class='st (\w+)'>(.*?)</span>", li)
            sb = li[li.find("<span class='sb'>"):]
            pc = re.search(r"<span class='poschip \w+'>(.*?)</span>", sb)
            ext = "class='extchip'" in sb
            sb = re.sub(r"<span class='(poschip \w+|extchip)'>.*?</span>", '', sb)
            e['senses'].append({'k': 'dnum' if st.group(1) == 'dnum' else txt(st.group(2)),
                                'pos': txt(pc.group(1)) if pc else '', 'ext': ext, 'text': txt(sb)})
        kin = re.search(r"<div class='kin'>(.*?)</div>\s*<div class='lbl'>", b, re.S)
        if kin: e['kin'] = [txt(x) for x in re.findall(r'<div>(.*?)</div>', kin.group(1), re.S)]
        nt = re.search(r"<div class='exnote'>(.*?)</div>", b, re.S)
        if nt: e['note'] = txt(nt.group(1))
        for m in re.finditer(r"<div class='ex( more)?'><div class='src'>(.*?)</div>\s*<div class='en'>(.*?)</div>(?:\s*<div class='zh'>(.*?)</div>)?", b, re.S):
            en = m.group(3)
            mk = re.search(r'<mark>(.*?)</mark>', en)
            e['ex'].append({'src': txt(m.group(2)), 'en': txt(en), 'mark': txt(mk.group(1)) if mk else '',
                            'zh': txt(m.group(4) or ''), 'more': bool(m.group(1))})
        out.append(e)
    assert [x['n'] for x in out] == list(range(1, 1001)), 'numbering'
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding='utf-8')
    print(len(out), 'entries,', sum(len(x['ex']) for x in out), 'examples')

if __name__ == '__main__':
    main()
