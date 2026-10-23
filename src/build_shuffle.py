#!/usr/bin/env python3
"""Build data/shuffle.js — the 乱序版 units — from 2300 高密度便携版.pdf.

The PDF is one big table: 24 Lists of 10 rows x 10 columns, words running
alphabetically left to right, row after row. Read straight down, each of the
10 columns runs through all 9 pages from a to z; one column is one 乱序 unit
(233 words, the last column 232). Inside a unit the order is shuffled once
with a fixed seed and written out, so rebuilding never moves a word.

A unit carries no entries of its own: "ids" points, in order, at the existing
SAT entries (data/words.js, i 1-2389). Progress, stars and colours are all
keyed by i, so they are shared with the 36 book units for free.

The PDF has a dozen spelling slips (amlgamate, tumoil, sef-critical ...);
FIXES maps them to the spelling the app's entry uses. Three more PDF words
have no entry of that form (charismatic, colloquial, combative); FIXES points
them at the entry with the same root, as the user chose on 2026-10-23. A cell
that still matches no entry, or a unit holding the same entry twice, stops
the build before any file is written.

Also decided then: the PDF prints continual, discretion and intrusive twice,
in neighbouring columns, so each sits in two units, as on paper; and the 35
book entries the PDF lacks (abhor, anecdote, benefit ...) stay out of the
乱序版 - they are still in the 36 book units.

    python3 build_shuffle.py [path/to/2300 高密度便携版.pdf]
"""
import json, os, random, re, sys

import pdfplumber

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PDF = os.path.join(os.path.dirname(ROOT), "2300 高密度便携版.pdf")
OUT = os.path.join(ROOT, "data", "shuffle.js")
EDGES = [61, 133, 203, 286, 356, 428, 503, 571, 637, 720, 802]   # cell borders in pt
FIRST_U = 3001       # 托福 1001-1048、雅思 2001-2008，乱序版接着往后排

FIXES = {
    "amlgamate": "amalgamate", "charlantan": "charlatan", "enbolden": "embolden",
    "perspective": "perceptive",          # 夹在 penurious 和 perennial 之间，是 perceptive 打错了
    "retionalization": "rationalization", "retrenchmetnt": "retrenchment",
    "self-centred": "self-centered", "sef-critical": "self-critical",
    "stabiliztion": "stabilization", "supersede": "supercede",
    "tranquillize": "tranquillise", "tumoil": "turmoil",
    # 下面三个不是拼错：App 里没有这个词形，用同词根的那条（用户定的）
    "charismatic": "charisma", "colloquial": "colloquially", "combative": "combat",
}


def norm(s):
    return re.sub(r"[^a-z]", "", s.lower())


def column_of(x):
    for k in range(10):
        if EDGES[k] - 2 <= x < EDGES[k + 1] - 2:
            return k + 1
    raise ValueError(f"word at x={x:.0f} falls outside the table")


def read_cells(pdf_path):
    """Every table cell as {"l": list, "r": row, "c": column, "w": word}, in reading order."""
    cells, lst, last = [], 0, {}
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            lines = {}
            for w in page.extract_words():
                mid = round((w["top"] + w["bottom"]) / 2)
                key = next((k for k in lines if abs(k - mid) <= 3), mid)
                lines.setdefault(key, []).append(w)
            for key in sorted(lines):
                ws = sorted(lines[key], key=lambda w: w["x0"])
                head = " ".join(w["text"] for w in ws if w["x0"] < EDGES[0])
                body = [w for w in ws if w["x0"] >= EDGES[0]]
                m = re.fullmatch(r"List\s*(\d+)", " ".join(w["text"] for w in ws))
                if m:
                    lst = int(m.group(1))
                elif head.startswith("SAT"):
                    continue
                elif not head:                   # a long word wrapped inside its cell: counterproduct|ive
                    for w in body:
                        last[column_of(w["x0"])]["w"] += w["text"]
                elif re.fullmatch(r"\d+", head):
                    last = {}
                    for w in body:
                        c = column_of(w["x0"])
                        if c in last:
                            last[c]["w"] += " " + w["text"]
                        else:
                            last[c] = {"l": lst, "r": int(head), "c": c, "w": w["text"]}
                            cells.append(last[c])
                else:
                    raise ValueError(f"unexpected line: {head!r} {[w['text'] for w in body]}")
    return cells


def load_words():
    src = open(os.path.join(ROOT, "data", "words.js"), encoding="utf-8").read()
    return [json.loads(l.rstrip(",")) for l in src.splitlines() if l.startswith('{"i":')]


def main():
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
    cells = read_cells(pdf_path)
    words = load_words()
    first = {}                                   # 原书里重复收录的词（assiduous 有两条……）取编号小的那条
    for w in words:
        first.setdefault(norm(w["w"]), w)

    units, problems = [], []
    for c in range(1, 11):
        col = [x for x in cells if x["c"] == c]
        hits = []
        for x in col:
            w = first.get(norm(FIXES.get(x["w"], x["w"])))
            if w is None:
                problems.append(f"第 {c} 列 List {x['l']} 第 {x['r']} 行：{x['w']} 在原书词条里找不到")
            else:
                hits.append(w)
        seen = {}
        for w in hits:
            if w["i"] in seen:
                problems.append(f"第 {c} 列：{w['w']}（#{w['i']}）出现了两次")
            seen[w["i"]] = 1
        print(f"第 {c:2d} 列  {len(col)} 格  对上 {len(hits)}")
        random.Random(f"2300 高密度便携版 · 第 {c} 列").shuffle(hits)
        units.append({"u": FIRST_U + c - 1, "n": len(hits), "a": hits[0]["w"], "b": hits[-1]["w"],
                      "t": f"乱序 {c:02d}", "ids": [w["i"] for w in hits]})

    for p in problems:
        print("✗ " + p)
    if problems:
        sys.exit("有对不上的格子，没写文件")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* 乱序版（第二十一次优化）：照 ../2300 高密度便携版.pdf 的竖列分单元。那份 PDF 是一张大表，\n"
                "   24 个 List、每个 List 10 行 × 10 列，词从左到右、一行接一行按字母排；竖着读，每一列都贯穿 9 页、\n"
                "   从 a 到 z，一列就是一个单元（233 词，最后一列 232），单元里的顺序用固定种子打乱一次后写死。\n"
                "   单元不自带词条：ids 按顺序指向原书词条（data/words.js 的 i），认识／不认识／星标／颜色都按 i 存，\n"
                "   所以跟原书 36 个单元共用一份进度。PDF 把 continual、discretion、intrusive 印了两遍（在相邻两列），\n"
                "   这三个词各在两个单元里。u 从 3001 起。由 src/build_shuffle.py 生成，别手改。 */\n")
        f.write("window.SAT_UNITS=(window.SAT_UNITS||[]).concat([\n")
        for u in units:
            f.write(json.dumps(u, ensure_ascii=False, separators=(",", ":")) + ",\n")
        f.write("]);\n")
    print(f"{OUT}  {len(units)} 个单元：" + "、".join(f"{u['t']} {u['n']} 词" for u in units))


if __name__ == "__main__":
    main()
