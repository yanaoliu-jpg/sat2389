#!/usr/bin/env python3
"""Sanity-check src/ex3/*.tsv before it reaches the site.

   每行必须是 单词 § 例句 § 翻译 § 词根(可空)，并且
   · 例句里出现该词（允许常见词形变化）
   · 例句 14–26 词
   · 译文恰好一处 **…** 标记
"""
import glob, os, re, sys, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def word_pat(w):
    """same rule as bold() in app.js — headword plus its usual inflections.
       Slice first, escape after: re.escape() would otherwise pad the string
       (it escapes spaces) and the slice would cut inside an escape."""
    w = w.lower()
    if len(w) > 6:
        return re.escape(w[:len(w) - 3]) + "[a-z']*"
    if re.search(r"[^aeiou]y$", w):
        return re.escape(w[:-1]) + "(?:y|ies|ied|ier|iest|ying)"
    if w.endswith("e"):
        return re.escape(w[:-1]) + "(?:e|es|ed|ing)"
    if len(w) >= 5:
        return re.escape(w) + "[a-z']*"
    return re.escape(w) + "(?:s|es|ed|ing|ly)?"


bad = []
n = 0
lens = collections.Counter()
for path in sorted(glob.glob(os.path.join(ROOT, "src", "ex3", "*.tsv"))):
    f = os.path.basename(path)
    seen = set()
    for ln, line in enumerate(open(path, encoding="utf-8"), 1):
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("#"):
            continue
        p = line.split("§")
        if len(p) != 4:
            bad.append(f"{f}:{ln} 列数 {len(p)}"); continue
        w, e, t, r = (x.strip() for x in p)
        n += 1
        if w in seen: bad.append(f"{f}:{ln} 重复 {w}")
        seen.add(w)
        if not re.search(word_pat(w), e, re.I):
            bad.append(f"{f}:{ln} {w} 例句里没出现这个词")
        nw = len(e.split())
        lens[nw] += 1
        if nw < 14 or nw > 26:
            bad.append(f"{f}:{ln} {w} 例句 {nw} 词（应在 14–26）")
        marks = re.findall(r"\*\*(.+?)\*\*", t)
        if len(marks) != 1:
            bad.append(f"{f}:{ln} {w} 译文有 {len(marks)} 处 ** 标记（应为 1）")
        elif not marks[0].strip():
            bad.append(f"{f}:{ln} {w} ** 标记是空的")
        if "§" in r or "\t" in line:
            bad.append(f"{f}:{ln} {w} 分隔符异常")
tot = sum(lens.values())
avg = sum(k * v for k, v in lens.items()) / tot if tot else 0
print(f"检查 {n} 行 · 例句平均 {avg:.1f} 词 · 问题 {len(bad)} 处")
for b in bad[:40]:
    print("  " + b)
sys.exit(1 if bad else 0)
