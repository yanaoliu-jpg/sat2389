#!/usr/bin/env python3
"""Turn src/extra_words.tsv into data/extra.js — the 错词本 unit that is not in the book.

The file appends to the arrays data/words.js and data/units.js already defined,
so extract_pdf.py can keep regenerating those two from the PDF untouched.
Columns: 单词§音标§中文释义§日期段
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UNIT = 37
LABEL = "错词本 · 7/3–8/30"

base = 0
for line in open(os.path.join(ROOT, "data", "words.js"), encoding="utf-8"):
    line = line.strip().rstrip(",")
    if line.startswith("{"):
        base = max(base, json.loads(line)["i"])

rows = []
for line in open(os.path.join(ROOT, "src", "extra_words.tsv"), encoding="utf-8"):
    line = line.rstrip("\n")
    if not line.strip() or line.startswith("#"):
        continue
    w, p, z, d = (x.strip() for x in line.split("§"))
    rows.append({"i": base + len(rows) + 1, "u": UNIT, "w": w, "p": p, "z": z, "d": d})

dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
with open(os.path.join(ROOT, "data", "extra.js"), "w", encoding="utf-8") as f:
    f.write("/* 错词本单元：不在原书里，来自单独整理的 xls */\n")
    f.write("window.SAT_WORDS=(window.SAT_WORDS||[]).concat([\n")
    for r in rows:
        f.write(dump(r) + ",\n")
    f.write("]);\n")
    f.write("window.SAT_UNITS=(window.SAT_UNITS||[]).concat([" +
            dump({"u": UNIT, "n": len(rows), "a": rows[0]["w"], "b": rows[-1]["w"], "t": LABEL}) + "]);\n")
print(f"{len(rows)} words -> unit {UNIT} (ids {rows[0]['i']}–{rows[-1]['i']})")
