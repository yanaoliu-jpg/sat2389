#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""../雅思核心词汇.xlsx + src/ielts_zh/L*.tsv -> data/ielts.js + data/ielts_rich.js

第十八次优化建了词表；第十九次优化改成每 90 词一个单元，并给每个词条配上例句。

【分单元】原表只有一张数据 Sheet「雅思核心词汇总表」（639 词，按话题分类排列），
不像托福那样一 Sheet 一个 List，所以按原表顺序每 90 词切一个单元：639 = 7×90 + 9，
共 8 个单元，最后一个只有 9 词。词条编号 i 只跟原表顺序有关、跟单元多大无关
（第十八次优化每单元 70 词时也是 10001–10639），所以改单元大小不会让已有的
认识 / 星标 / 颜色记录挪位置——那些都是按 i 存的。

【例句】用原表自带的「例句」列（639 句，每个词条一句，偏短的雅思风格），
中文翻译由 src/ielts_zh/L01–L08.tsv 提供，一个 List 一个文件，每行：
    编号§单词§例句§译文          译文里恰好一处 **…** 标出对应词义
TSV 是例句的正本。这里逐行核对「编号、单词、例句」跟原表对得上，对不上就整个报错、
一个文件都不写——别让没对齐的数据悄悄进站（照 check_ex3.py 的思路）。
例句跟原表有出入的只有 EDITED 里登记的几句，原因都一样：应用要在例句里找到这个词
（卡片高亮用 wordPat、填空题用 blankAt），原句里是 rose / grew / Overconsumption
这种找不到的形式，所以改写成带原词形的说法。

「例句里找得到词」这条要用应用自己的函数验，见 test/ielts.test.js（node --test），
不在这里拿 Python 重写一遍：试过，Python 版的规则漏了 consumption / phobia 两句。

i 从 10001 起、u 从 2001 起：托福用到 i 5001-9249 / u 1001-1048，
这里没有贴着接上去，也是给"以后又要给托福那边加什么"留出空间。

校验规则照抄 build_toefl.py 那一套：单词要以字母开头、不含中文、最多 6 个词；
释义必须含中文字符。不满足就跳过并打印警告——这份原表实测是干净的（639 行全过），
但规则还是留着，防的是下次源表换了个心眼。
"""
import os
import re
import sys
import glob
import json
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(os.path.dirname(ROOT), "雅思核心词汇.xlsx")
ZH_DIR = os.path.join(ROOT, "src", "ielts_zh")
OUT = os.path.join(ROOT, "data", "ielts.js")
OUT_RICH = os.path.join(ROOT, "data", "ielts_rich.js")

I_START = 10001
U_START = 2001
PER_LIST = 90

CJK = re.compile(r"[一-鿿]")
MARK = re.compile(r"\*\*(.+?)\*\*")

# 原表的笔误：这一行的例句写的是 culture shock，词条却写成了 cultural shock
WORD_FIXES = {"cultural shock": "culture shock"}

# 有意改写过的例句：编号 -> 原表里的原句（用来确认原表没在背后变过）。
EDITED = {
    10223: "Overconsumption places a heavy burden on the planet.",
    10365: "Citizens have the right to a fair trial.",
    10392: "Inner-city schools often face the greatest challenges.",
    10496: "Arachnophobia is an extreme fear of spiders.",
    10586: "Sales rose sharply in December.",
    10588: "The population grew steadily over the decade.",
    10597: "Attendance fell to its lowest level.",
    10604: "Unemployment levelled off at around 5%.",
    10605: "Prices remained stable over the period.",
}


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
    w = WORD_FIXES.get(w, w)
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
    e = str(r[5]).strip() if r[5] else ""
    rows.append({"w": w, "p": p, "z": z, "e": e})

# ---------- 例句 + 译文：src/ielts_zh/L*.tsv ----------
problems = []
zh = {}
for path in sorted(glob.glob(os.path.join(ZH_DIR, "L*.tsv"))):
    fn = os.path.basename(path)
    for ln, line in enumerate(open(path, encoding="utf-8"), 1):
        line = line.rstrip("\n")
        if not line.strip() or line.startswith("#"):
            continue
        parts = [x.strip() for x in line.split("§")]
        if len(parts) != 4 or not parts[0].isdigit():
            problems.append(f"{fn}:{ln} 应是 编号§单词§例句§译文 四列，实际 {len(parts)} 列")
            continue
        n = int(parts[0])
        if n in zh:
            problems.append(f"{fn}:{ln} 编号 {n} 重复（前一处在 {zh[n]['at']}）")
        zh[n] = {"w": parts[1], "e": parts[2], "t": parts[3], "at": f"{fn}:{ln}"}

rich = {}
for idx, row in enumerate(rows):
    i = I_START + idx
    rec = zh.get(i)
    if not rec:
        problems.append(f"编号 {i}「{row['w']}」没有译文")
        continue
    at = rec["at"]
    if rec["w"] != row["w"]:
        problems.append(f"{at} 编号 {i} 写的是「{rec['w']}」，原表是「{row['w']}」——行对不齐了")
        continue
    src_e = row["e"]
    if i in EDITED:
        if src_e != EDITED[i]:
            problems.append(f"{at} 原表第 {i} 号的例句变了（现在是 {src_e!r}），"
                            f"EDITED 里登记的原句对不上，先核对再改")
        elif rec["e"] == src_e:
            problems.append(f"{at} 编号 {i} 登记了要改写，但 TSV 里还是原句")
    elif rec["e"] != src_e:
        problems.append(f"{at} 编号 {i}「{row['w']}」例句跟原表不一致：\n"
                        f"      原表：{src_e}\n      TSV ：{rec['e']}")
    nw = len(rec["e"].split())
    if nw < 4 or nw > 26:
        problems.append(f"{at} 编号 {i}「{row['w']}」例句 {nw} 词（应在 4–26）")
    marks = MARK.findall(rec["t"])
    if len(marks) != 1:
        problems.append(f"{at} 编号 {i}「{row['w']}」译文有 {len(marks)} 处 ** 标记（应为 1）")
    elif not marks[0].strip():
        problems.append(f"{at} 编号 {i}「{row['w']}」** 标记是空的")
    if not CJK.search(rec["t"]):
        problems.append(f"{at} 编号 {i}「{row['w']}」译文里没有中文")
    rich[i] = {"w": row["w"], "e": rec["e"], "t": rec["t"]}

known = {I_START + idx for idx in range(len(rows))}
stray = sorted(set(zh) - known)
if stray:
    problems.append(f"TSV 里有原表没有的编号：{stray[:10]}")

if problems:
    print(f"{len(problems)} 个问题，没有写任何文件：")
    for msg in problems[:80]:
        print("  " + msg)
    if len(problems) > 80:
        print(f"  …… 还有 {len(problems) - 80} 个")
    sys.exit(1)

# ---------- 单元 ----------
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
    f.write("/* 雅思核心词汇：原表按话题分类排列、共 %d 词，这里按原表顺序每 %d 词切一个单元（第十九次优化，原来是 70）。\n" % (len(rows), PER_LIST))
    f.write("   由 src/build_ielts.py 从 ../雅思核心词汇.xlsx 生成，\n")
    f.write("   i 从 %d 起、u 从 %d 起，跟托福数据（i 5001-9249 · u 1001-1048）分开。\n" % (I_START, U_START))
    f.write("   例句在 data/ielts_rich.js。 */\n")
    f.write("window.SAT_WORDS=(window.SAT_WORDS||[]).concat([\n")
    for r in words:
        f.write(dump(r) + ",\n")
    f.write("]);\n")
    f.write("window.SAT_UNITS=(window.SAT_UNITS||[]).concat(" + dump(units) + ");\n")

with open(OUT_RICH, "w", encoding="utf-8") as f:
    f.write("/* 雅思核心词汇的例句（第十九次优化）：%d 条，按词条编号 i 存，不按单词存。\n" % len(rich))
    f.write("   雅思词有一半在 SAT / 托福里也有，那边的例句是为那边的词义写的（比如 academic 那句用的是「空谈」义），\n")
    f.write("   所以雅思词优先用这里的：原表自带、对着雅思释义写的例句 + 中文翻译。\n")
    f.write("   条目里带着 w：rich() 查的时候编号和单词都对得上才用——自己导入的词编号也是从 10000 往上排的。\n")
    f.write("   由 src/build_ielts.py 从 ../雅思核心词汇.xlsx + src/ielts_zh/L*.tsv 生成。 */\n")
    f.write("window.IELTS_RICH={\n")
    for n in sorted(rich):
        f.write("%d:%s,\n" % (n, dump(rich[n])))
    f.write("};\n")

print(f"{len(words)} words -> {len(units)} units (i {words[0]['i']}-{words[-1]['i']}, u {units[0]['u']}-{units[-1]['u']}); "
      f"unit sizes {[x['n'] for x in units]}")
print(f"{len(rich)} examples -> data/ielts_rich.js")
if warnings:
    print(f"\n{len(warnings)} 条警告（没有静默跳过，都在这）：")
    for wmsg in warnings:
        print("  " + wmsg)
