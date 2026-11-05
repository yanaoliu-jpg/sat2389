"""第四十七次优化：《雅思词汇词根+联想记忆法 乱序版》两个脚本共用的东西。"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, 'ielts_root')
I0, U0 = 20001, 4001          # 词条编号 i 从 20001 起，单元 u 4001–4050


def load_raw():
    d = json.load(open(os.path.join(DIR, 'raw.json'), encoding='utf-8'))
    for k, x in enumerate(d):
        x['i'] = I0 + k
        x['u'] = U0 + x['list'] - 1
    return d


CJK = re.compile(r'[一-鿿]')


def split_ex(s):
    """「英文句子 中文翻译」拆成两半：中文从第一个汉字前面最后一个句末标点之后开始。"""
    k = CJK.search(s)
    if not k:
        return s.strip(), ''
    pre = s[:k.start()]
    m = None
    for m in re.finditer(r'[.?!"”’)]', pre):
        pass
    cut = m.end() if m else k.start()
    return s[:cut].strip(), s[cut:].strip()


def book_examples(x):
    """书上的例句，[(英文, 中文), …]。一栏里用 // 隔开的是几句。
    书上有十几处把例句印在「搭」那一栏里（lower、robust…），没有「例」时把「搭」里整句带中文句号的当例句。"""
    items = list(x.get('例', []))
    if not items:
        items = [v for v in x.get('搭', []) if v.endswith('。') and re.search(r'[A-Za-z]+ [a-z]+ [a-z]+', v)]
    out = []
    for v in items:
        for part in v.split('//'):
            e, t = split_ex(part)
            if e and t:
                out.append((e, t))
    return out


def has_word(sent, w):
    """粗查：例句里有没有这个词（含常见变形）。只用来挑第一句，最后以网页的 blankAt 为准。"""
    b = re.escape(w.lower().rstrip('e').rstrip('y'))
    return re.search(r'\b' + b, sent.lower()) is not None


def pick_example(x):
    ex = book_examples(x)
    for e, t in ex:
        if has_word(e, x['w']):
            return e, t
    return ex[0] if ex else ('', '')
