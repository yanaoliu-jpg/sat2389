#!/usr/bin/env python3
"""第五十三次优化：../四级词汇2022版-浙江教育出版社.xls → src/cet4/raw.json

原表一张 Sheet 一个 List，35 个 List、2751 行；第一行是「list 1」这种表头，下面每行 单词 + 中文释义
（有的表释义在第 2 栏、有的在第 3 栏，list3 还有十几个空栏），只有这两样，没有音标和例句。
这里只原样取出来（单词去掉首尾空格、全角字母转半角），错字、错位的释义留给子代理改，见 src/cet4/PROMPT.md。
i 从 40001 起、u 从 6001 起，照原表顺序。
"""
import json, os, unicodedata
import xlrd

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', '四级词汇2022版-浙江教育出版社.xls')
OUT = os.path.join(HERE, 'cet4', 'raw.json')

b = xlrd.open_workbook(SRC)
out, i = [], 40001
for l, s in enumerate(b.sheets(), 1):
    for r in range(1, s.nrows):
        row = [str(c.value).strip() for c in s.row(r)]
        w = unicodedata.normalize('NFKC', row[0]).strip()
        z = ' '.join(x for x in row[1:] if x).replace('　', ' ').strip()
        if not w:
            assert not z, (s.name, r)
            continue
        out.append({'i': i, 'list': l, 'w': w, 'z': z})
        i += 1
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(out), '个词，', l, '个 List')
