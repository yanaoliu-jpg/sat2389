#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""../雅思核心词汇.xlsx -> data/ielts.js（第十八次优化）

原表只有一张数据 Sheet「雅思核心词汇总表」（639 词，按话题分类排列），
不像托福那样一 Sheet 一个 List，所以这里按原表顺序每 70 词切一个单元。
源表自带「例句 / 常用搭配 / 话题分类」几列，这一轮先不收——只建词表，
例句留到以后单独一轮再照抄 aiPrompt() 的路子补（跟托福词表当初的两步走一样）。

i 从 10001 起、u 从 2001 起：托福用到 i 5001-9249 / u 1001-1048，
这里没有贴着接上去，也是给"以后又要给托福那边加什么"留出空间。

校验规则照抄 build_toefl.py 那一套：单词要以字母开头、不含中文、最多 6 个词；
释义必须含中文字符。不满足就跳过并打印警告——这份原表实测是干净的（639 行全过），
但规则还是留着，防的是下次源表换了个心眼。
"""
import os
import re
import json
import shutil
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), "雅思核心词汇.xlsx")
OUT = os.path.join(ROOT, "data", "ielts.js")

I_START = 10001
U_START = 2001
PER_LIST = 70

CJK = re.compile(r"[一-鿿]")


def phrase_ok(w):
    return bool(w) and re.match(r"^[A-Za-z]", w) and len(w) <= 60 \
        and not CJK.search(w) and len(w.split()) <= 6


wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb["雅思核心词汇总表"]

rows = []
warnings = []
for r in ws.iter_rows(min_row=2, values_only=True):
    word = r[1]
    if word is None or not str(word).strip():
        continue
    w = str(word).strip()
    if not phrase_ok(w):
        warnings.append(f"跳过「{w}」—— 不像一个单词/词组")
        continue
    p = str(r[2]).strip().strip("/[] ") if r[2] else ""
    pos = str(r[3]).strip() if r[3] else ""
    meaning = str(r[4]).strip() if r[4] else ""
    if not CJK.search(meaning):
        warnings.append(f"跳过「{w}」—— 释义格里没有中文：{meaning!r}")
        continue
    z = (pos + " " + meaning).strip() if pos else meaning
    rows.append({"w": w, "p": p, "z": z})

words = []
units = []
i = I_START
u = U_START
for li in range(0, len(rows), PER_LIST):
    batch = rows[li:li + PER_LIST]
    unit_words = []
    for rec in batch:
        row = {"i": i, "u": u, "w": rec["w"], "p": rec["p"], "z": rec["z"]}
        words.append(row)
        unit_words.append(row)
        i += 1
    units.append({
        "u": u, "n": len(unit_words),
        "a": unit_words[0]["w"], "b": unit_words[-1]["w"],
        "t": "雅思核心词汇 · List %02d" % (u - U_START + 1),
    })
    u += 1

dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
with open(OUT, "w", encoding="utf-8") as f:
    f.write("/* 雅思核心词汇：原表按话题分类排列、共 %d 词，这里按原表顺序每 %d 词切一个单元（第十八次优化）。\n" % (len(rows), PER_LIST))
    f.write("   由 src/build_ielts.py 从 ../雅思核心词汇.xlsx 生成，\n")
    f.write("   i 从 %d 起、u 从 %d 起，跟托福数据（i 5001-9249 · u 1001-1048）分开。\n" % (I_START, U_START))
    f.write("   例句这一轮没收：原表自带的「例句/搭配/话题分类」几列先不用，留到以后单独补。 */\n")
    f.write("window.SAT_WORDS=(window.SAT_WORDS||[]).concat([\n")
    for r in words:
        f.write(dump(r) + ",\n")
    f.write("]);\n")
    f.write("window.SAT_UNITS=(window.SAT_UNITS||[]).concat(" + dump(units) + ");\n")

print(f"{len(words)} words -> {len(units)} units (i {words[0]['i']}-{words[-1]['i']}, u {units[0]['u']}-{units[-1]['u']})")
if warnings:
    print(f"\n{len(warnings)} 条警告（没有静默跳过，都在这）：")
    for wmsg in warnings:
        print("  " + wmsg)
