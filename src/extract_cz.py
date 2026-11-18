#!/usr/bin/env python3
"""第六十二次优化：../初中英语词汇乱序版（浙江教育）.xlsx → src/cz/raw.json

原表一张 Sheet1，表头「单词 / 美式发音 / 英式发音 / 释义」；「Word List1」「Word list 11」「WordList 20」这种行是
List 的标题（写法不统一，后三格空着或是空格），共 33 个 List、1997 个词条。
**表头两栏发音标反了**：B 栏（标「美式」）是英音（junior [ˈdʒuːniə(r)]、scare [skeə(r)]），C 栏（标「英式」）是美音。
网站用英音，取 B 栏，去掉方括号；C 栏存成 pu 备查。
释义是词典式长条目（多行，每行一个词性，带【名】人名、<古> <罕> 等），这里原样取出（全角空格换半角、去首尾空格），
精简、整理留给子代理，见 src/cz/PROMPT.md。单词去掉首尾空格、全角转半角，其余照原表（honour/honor、humour&humor
这种两种写法的也照留）。有 8 个词出现两次（outside、or、meet……），照原表都留。i 从 51001 起、u 从 6401 起。
"""
import json, os, re, unicodedata
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', '初中英语词汇乱序版（浙江教育）.xlsx')
OUT = os.path.join(HERE, 'cz', 'raw.json')


def ipa(s):
    s = unicodedata.normalize('NFC', str(s or '')).strip()
    return re.sub(r'^\[|\]$', '', s).strip()


wb = openpyxl.load_workbook(SRC, read_only=True)
out, l = [], 0
for k, row in enumerate(wb.worksheets[0].iter_rows(values_only=True)):
    row = list(row) + [None] * 4
    if k == 0:
        assert row[0] == '单词', row
        continue
    w = unicodedata.normalize('NFKC', str(row[0] or '')).strip()
    z = str(row[3] or '').replace('　', ' ').strip()
    if not w and not z:
        continue
    m = re.fullmatch(r'word\s*list\s*(\d+)', w, re.I)
    if m and not z:
        l = int(m.group(1))
        assert l == len({x['list'] for x in out}) + 1, w
        continue
    assert w and z and l, row
    out.append({'i': 0, 'list': l, 'w': w, 'p': ipa(row[1]), 'pu': ipa(row[2]), 'z': z})
for k, x in enumerate(out):
    x['i'] = 51001 + k
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(out), '个词，', len({x['list'] for x in out}), '个 List')
