#!/usr/bin/env python3
"""第五十五次优化：../四级词汇教师-海豚版(1).xlsx → src/cet4d/raw.json

原表是给老师用的「VIP学员词汇测试」卷：一张 Sheet 一个 List，35 个 List；每行三组（list 20 四组）「英文 + 中文意思」，
上下夹着表头（VIP学员词汇测试、学员姓名、英文/中文意思）和表尾（测试时间、正确数量、共 76 词）。
这里照「从左到右、从上到下」的读法原样取出单词和释义（单词去掉首尾空格、全角转半角），释义空着的照样留空，
错字、错位、空着的释义留给子代理处理，见 src/cet4d/PROMPT.md。
几处录坏的格子在这里拆开：一格里写了几个词（「definite  cautious  prayer」「signal encourage」「provided curiosity」）
拆开：同一 List 里另有的那几个（cautious、prayer、encourage）不再多算一次，只有 curiosity 单列一个词条、释义空着；list 35 有一个词（accuracy）录在了「中文意思」那一栏。
i 从 43001 起、u 从 6101 起。
"""
import json, os, re, unicodedata
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', '..', '四级词汇教师-海豚版(1).xlsx')
OUT = os.path.join(HERE, 'cet4d', 'raw.json')
JUNK = re.compile(r'^(VIP|学员|测试|正确|英文$|.*共.*词)')
SPLIT = {'definite cautious prayer', 'signal encourage', 'provided curiosity'}

wb = openpyxl.load_workbook(SRC)
out, i = [], 43001
for l, ws in enumerate(wb.worksheets, 1):
    for row in ws.iter_rows(values_only=True):
        for j in range(0, len(row) - 1, 2):
            w = unicodedata.normalize('NFKC', str(row[j] or '')).strip()
            z = str(row[j + 1] or '').replace('\u3000', ' ').strip()
            if not w and re.fullmatch(r'[a-z]+', z):
                w, z = z, ''
            if not w and not z:
                continue
            if JUNK.match(w):
                continue
            assert w, (ws.title, row)
            parts = w.split() if ' '.join(w.split()) in SPLIT else [w]
            for k, p in enumerate(parts):
                out.append({'list': l, 'w': p, 'z': z if k == 0 else '', 'extra': k > 0})
seen = {}
for x in out:
    if not x['extra']:
        seen.setdefault((x['list'], x['w'].lower()), 1)
out = [x for x in out if not (x['extra'] and (x['list'], x['w'].lower()) in seen)]
for k, x in enumerate(out):
    del x['extra']
    x['i'] = i + k
    out[k] = {'i': x['i'], 'list': x['list'], 'w': x['w'], 'z': x['z']}
json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
print(len(out), '个词，', l, '个 List，释义空着', sum(1 for x in out if not x['z']))
