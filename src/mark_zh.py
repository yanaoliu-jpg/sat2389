#!/usr/bin/env python3
"""Mark, inside each Chinese translation, the span that renders the target word.

The card bolds the English word in the example; this puts the matching red
emphasis on the Chinese side. Spans are written into the tsv files as **…**.

    python3 mark_zh.py --dry     # report coverage, change nothing
    python3 mark_zh.py           # auto-mark what can be matched, leave the rest
    python3 mark_zh.py --misses  # list the rows still unmarked, one per line

Auto-marking only fires on an exact match against one of the word's own glosses
(from data/words.js / data/extra.js), longest gloss first. Anything looser gets
the highlight wrong often enough to be worse than no highlight, so the rest are
listed by --misses and marked by hand.
"""
import glob, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POS = re.compile(r'\(?(?:vt|vi|aux|prep|conj|pron|interj|phr|adv|adj|abbr|art|num|n|v|a|ad)\.\)?')
SPLIT = re.compile(r'[,，、;；:：/·。\s]+')
CIRCLED = re.compile(r'[①-⑳]')

def load_words():
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
    return words

def glosses(z):
    z = CIRCLED.sub("", POS.sub("|", z)).replace("…", "|").replace("＜", "|").replace("<", "|").replace(">", "|")
    out = []
    for part in SPLIT.split(z.replace("|", " ")):
        part = part.strip("（）()[]【】 ")
        if len(part) >= 2 and re.search(r'[一-鿿]', part):
            out.append(part)
    return sorted(set(out), key=len, reverse=True)

TRAIL = "的地儿了着过们"

def candidates(gl):
    out = list(gl)
    for g in gl:
        bare = g.rstrip(TRAIL)
        if len(bare) >= 2 and bare not in out:
            out.append(bare)
    return sorted(set(out), key=len, reverse=True)

def put(trans, span):
    i = trans.find(span)
    return trans[:i] + "**" + span + "**" + trans[i + len(span):] if i >= 0 else None

def mark(trans, gl, extra=()):
    for g in list(extra) + candidates(gl):        # exact gloss, then gloss without 的/地
        hit = put(trans, g)
        if hit:
            return hit
    return None                                    # anything looser mis-aligns word boundaries

def load_marks():
    path = os.path.join(ROOT, "src", "zh_marks.tsv")
    marks = {}
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.rstrip("\n")
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.split("§")
            if len(parts) == 3:
                marks[(parts[0].strip(), parts[1].strip())] = parts[2].strip()
    return marks

def main():
    dry = "--dry" in sys.argv
    show = "--misses" in sys.argv
    sample = "--sample" in sys.argv
    shown = []
    words = load_words()
    marks = load_marks()
    hit = miss = already = 0
    misses, stray = [], []
    known = {}                                     # span already used for the word's other example
    for path in sorted(glob.glob(os.path.join(ROOT, "src", "rich", "*.tsv")) +
                       glob.glob(os.path.join(ROOT, "src", "rich2", "*.tsv"))):
        out, changed = [], False
        for line in open(path, encoding="utf-8"):
            raw = line.rstrip("\n")
            if not raw.strip() or raw.startswith("#"):
                out.append(line); continue
            parts = raw.split("§")
            if len(parts) < 3:
                out.append(line); continue
            w, trans = parts[0].strip(), parts[2]
            if "**" in trans:
                already += 1
                known.setdefault(w, trans.split("**")[1])
                out.append(line); continue
            n = "2" if os.sep + "rich2" + os.sep in path else "1"
            extra = []
            if (w, n) in marks:
                if marks[(w, n)] in trans: extra.append(marks[(w, n)])
                else: stray.append(f"{w}\t{n}\t{marks[(w, n)]}\t{trans}")
            if w in known: extra.append(known[w])
            marked = mark(trans, glosses(words[w]["z"]), extra) if w in words else None
            if marked:
                hit += 1; parts[2] = marked; changed = True
                known.setdefault(w, marked.split("**")[1])
                if sample and hit % 37 == 0:
                    shown.append(f"{w}  ·  {words[w]['z'][:34]}  ·  {marked}")
                out.append("§".join(parts) + "\n")
            else:
                miss += 1
                misses.append(f"{w}\t{n}\t{trans}")
                out.append(line)
        if changed and not dry:
            open(path, "w", encoding="utf-8").write("".join(out))
    total = hit + miss + already
    print(f"已标 {already} · 本次自动标出 {hit} · 仍缺 {miss} / 共 {total}"
          f"  ({100*(already+hit)/total:.1f}%)")
    if stray:
        print(f"zh_marks.tsv 里有 {len(stray)} 条片段在译文里找不到：")
        print("\n".join("  " + x for x in stray[:20]))
    if sample:
        print("\n".join(shown))
    if show:
        print("\n".join(misses))

if __name__ == "__main__":
    main()
