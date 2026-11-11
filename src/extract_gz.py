#!/usr/bin/env python3
"""第五十九次优化：../新版高中词汇.xlsx → src/gz/raw.json

原表第一张 Sheet「进度」是录入记录，跳过；后面 40 张 Sheet「List 1」到「List 40」（List30、List32 名字里没空格），
一张一个 List，每行两格「单词 + 中文释义」（List30 多出三栏空格子），没有表头表尾。
这里照原表顺序原样取出单词和释义（单词去掉首尾空格、全角转半角，释义把全角空格换成半角、去掉首尾空格），
词形（eastward(s)、toward(s)……）、释义格式和错字留给子代理处理，见 src/gz/PROMPT.md。
can 在 List 4 里出现两次（46219 情态动词「可能；能够」，46222 名词「罐头」），是两个词，照原表都留着。
i 从 46001 起、u 从 6201 起。
"""
import json, os, re, unicodedata
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', '新版高中词汇.xlsx')
OUT = os.path.join(HERE, 'gz', 'raw.json')

wb = openpyxl.load_workbook(SRC, read_only=True)
out, i = [], 46001
for ws in wb.worksheets:
    m = re.fullmatch(r'List\s*(\d+)', ws.title.strip())
    if not m:
        continue
    l = int(m.group(1))
    for row in ws.iter_rows(values_only=True):
        w = unicodedata.normalize('NFKC', str(row[0] or '')).strip()
        z = str(row[1] or '').replace('　', ' ').strip() if len(row) > 1 else ''
        if not w and not z:
            continue
        assert w and not any(c not in (None, '') for c in row[2:]), (ws.title, row)
        out.append({'i': 0, 'list': l, 'w': w, 'z': z})
assert [x['list'] for x in out] == sorted(x['list'] for x in out)
for k, x in enumerate(out):
    x['i'] = i + k
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(out), '个词，', len({x['list'] for x in out}), '个 List，释义空着', sum(1 for x in out if not x['z']))
