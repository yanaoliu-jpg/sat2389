#!/usr/bin/env python3
"""第六十次优化：../高中英语词汇 念念不忘 便携版.xlsx → src/gzb/raw.json

原表只有一张 Sheet1，每行两格「单词 + 中文释义」；「Lesson 1」到「Lesson 23」（4、5 写成小写 lesson）单独占一行、
第二格空着，是课的标题。这里照原表顺序取出单词和释义（单词去掉首尾空格、全角转半角，释义把全角空格换成半角、
去掉首尾空格），一课一个单元。词形、释义格式和错字留给子代理处理，见 src/gzb/PROMPT.md。
preference 出现两次，照原表都留着。i 从 49001 起、u 从 6301 起。
"""
import json, os, re, unicodedata
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', '高中英语词汇 念念不忘 便携版.xlsx')
OUT = os.path.join(HERE, 'gzb', 'raw.json')

wb = openpyxl.load_workbook(SRC, read_only=True)
out, l = [], 0
for row in wb.worksheets[0].iter_rows(values_only=True):
    w = unicodedata.normalize('NFKC', str(row[0] or '')).strip()
    z = str(row[1] or '').replace('　', ' ').strip() if len(row) > 1 else ''
    if not w and not z:
        continue
    m = re.fullmatch(r'lesson\s*(\d+)', w, re.I)
    if m and not z:
        l = int(m.group(1))
        assert l == len({x['list'] for x in out}) + 1, w
        continue
    assert w and z and l, row
    out.append({'i': 0, 'list': l, 'w': w, 'z': z})
for k, x in enumerate(out):
    x['i'] = 49001 + k
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(out), '个词，', len({x['list'] for x in out}), '课')
