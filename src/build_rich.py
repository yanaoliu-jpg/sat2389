#!/usr/bin/env python3
"""Assemble data/rich.js.

   src/ex3/*.tsv    单词 § 例句 § 翻译 § 词根注释(可空)      ← 现在的正本
   src/rich/*.tsv   单词 § 旧例句一 § 旧翻译 § 近义词 § 订正释义(可选)
   src/rich2/*.tsv  单词 § 旧例句二 § 旧翻译二

   第三次优化把「两个短例句」换成「一个长例句」（生词必须是句子的主干），
   并给难词加了词根。新句子写在 src/ex3/ 里；rich/ 保留下来有两个用处：
   它是订正释义 (z) 的唯一来源，也是还没重写到的词的兜底例句。
   rich2/ 只在 --keep2 时才读，平时整个不输出。

   字段分隔符是 U+00A7（或 TAB）。输出 {e,t,z?,r?}。
"""
import json, glob, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP2 = "--keep2" in sys.argv

words = {}
for src in ("words.js", "extra.js"):
    path = os.path.join(ROOT, "data", src)
    if not os.path.exists(path):
        continue
    for line in open(path, encoding="utf-8"):
        line = line.strip().rstrip(",").rstrip("]);").rstrip(",")
        if line.startswith("{") and line.endswith("}"):
            o = json.loads(line)
            words.setdefault(o["w"], o)


def rows(sub, want):
    """yield (file, line-no, parts) for every data row under src/<sub>/"""
    for path in sorted(glob.glob(os.path.join(ROOT, "src", sub, "*.tsv"))):
        for ln, line in enumerate(open(path, encoding="utf-8"), 1):
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.split("§") if "§" in line else line.split("\t")
            if len(parts) not in want:
                bad.append(f"{sub}/{os.path.basename(path)}:{ln} has {len(parts)} columns")
                continue
            yield os.path.basename(path), ln, [p.strip() for p in parts]


rich, bad, unknown, dupes = {}, [], [], []

# 1. rich/ — 订正释义 + 兜底例句
for f, ln, p in rows("rich", (4, 5)):
    w, e, t = p[0], p[1], p[2]
    if w not in words:
        unknown.append(f"rich/{f}:{ln} {w}"); continue
    if w in rich:
        dupes.append(w); continue
    rich[w] = {"e": e, "t": t, "_old": 1}
    if len(p) == 5 and p[4]:
        rich[w]["z"] = p[4]

if KEEP2:
    for f, ln, p in rows("rich2", (3,)):
        w, e, t = p
        if w in rich:
            rich[w]["e2"], rich[w]["t2"] = e, t

# 2. ex3/ — 现在的正本，覆盖掉旧例句
n3 = 0
for f, ln, p in rows("ex3", (3, 4)):
    w, e, t = p[0], p[1], p[2]
    r = p[3] if len(p) == 4 else ""
    if w not in words:
        unknown.append(f"ex3/{f}:{ln} {w}"); continue
    d = rich.setdefault(w, {})
    if not d.pop("_old", None) and "e" in d and d.get("_new"):
        dupes.append(w); continue
    d["e"], d["t"], d["_new"] = e, t, 1
    if r:
        d["r"] = r
    n3 += 1

out = os.path.join(ROOT, "data", "rich.js")
order = ["e", "t", "z", "r"] + (["e2", "t2"] if KEEP2 else [])
with open(out, "w", encoding="utf-8") as fh:
    fh.write("window.SAT_RICH={\n")
    for w in sorted(rich):
        rec = {k: rich[w][k] for k in order if k in rich[w]}
        fh.write(json.dumps(w, ensure_ascii=False) + ":" +
                 json.dumps(rec, ensure_ascii=False, separators=(",", ":")) + ",\n")
    fh.write("};\n")

total = len(words)
have = len(rich)
newed = sum(1 for w in rich if rich[w].get("_new"))
roots = sum(1 for w in rich if "r" in rich[w])
lens = [len(rich[w]["e"].split()) for w in rich if rich[w].get("_new")]
print(f"例句      {have}/{total}  ({100*have/total:.1f}%)")
print(f"已重写    {newed}/{total}  ({100*newed/total:.1f}%)" +
      (f"   平均 {sum(lens)/len(lens):.1f} 词" if lens else ""))
print(f"词根      {roots}/{total}  ({100*roots/total:.1f}%)")
todo = [w for w in words if not rich.get(w, {}).get("_new")]
if todo:
    per = collections.Counter(words[w]["u"] for w in todo)
    print("待重写:", ", ".join(f"U{u}:{n}" for u, n in sorted(per.items())))
if bad:     print("BAD ROWS:", *bad[:10], sep="\n  ")
if unknown: print("NOT IN WORD LIST:", *unknown[:10], sep="\n  ")
if dupes:   print("DUPLICATE ROWS:", len(dupes), dupes[:8])
