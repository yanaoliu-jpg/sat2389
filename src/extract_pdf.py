#!/usr/bin/env python3
"""Rebuild data/words.js and data/units.js straight from SAT词汇2300打印版.pdf.

Why this is not a plain text extraction
---------------------------------------
The PDF embeds two subset fonts whose /ToUnicode CMaps are empty, so every
glyph comes out of pdfplumber as "(cid:N)" — the raw glyph id. The base font
orders its glyphs by codepoint, which makes the mapping a step function that
this script hard-codes (verified glyph-by-glyph against rendered pages):

    cid 3..97      -> U+0020 + (cid - 3)      ASCII        (offset +29)
    cid 171        -> U+2026                  …
    cid 321..340   -> U+2460 + (cid - 321)    ①②③        (offset +8991)
    cid 451        -> U+3001                  、
    cid 708..790   -> U+FF08 + (cid - 708)    fullwidth    (offset +64580)
    cid >= 1072    -> U+4E00 + (cid - 1072)   CJK          (offset +18896)

The CJK run is contiguous end to end: cid 1072 = 一 (U+4E00) and the highest
cid used, 21935, = 齿 (U+9F7F), and 21935-1072 == 0x9F7F-0x4E00 exactly.

Phonetics use the TOPhonetic font, whose ToUnicode maps glyphs to ASCII while
the glyphs themselves draw IPA symbols. PHON below is that mapping (read off
the rendered glyphs), followed by the rewrite rules that turn the book's older
DJ notation into modern British IPA.

    python3 extract_pdf.py [path/to/SAT词汇2300打印版.pdf]
"""
import collections, json, os, re, sys

import pdfplumber

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_PDF = os.path.join(os.path.dirname(ROOT), "SAT词汇2300打印版.pdf")
COLUMN_SPLIT = 415      # page is landscape A4, two columns of entries
WORD_SIZE = 9.8         # headwords are set at 10.6pt, everything else at 9pt
CID = re.compile(r"^\(cid:(\d+)\)$")

PHON = {"0": "ð", "1": "æ", "2": "ɑ", "3": "ɔ", "4": "ə", "5": "ʃ", "6": "ŋ",
        "7": "θ", "8": "ʌ", "9": "ʒ", "A": "e", "'": "ˈ", ",": "ˌ", "`": "ˌ",
        ":": "ː", "[": "", "]": "", "\\": "", "/": "", "c": "k"}


def decode(cid):
    if cid is None:
        return ""
    if 3 <= cid <= 97:
        return chr(cid + 29)
    if cid == 171:
        return "…"
    if 321 <= cid <= 340:
        return chr(cid + 8991)
    if cid == 451:
        return "、"
    if 708 <= cid <= 790:
        return chr(cid + 64580)
    if cid >= 1072:
        return chr(cid + 18896)
    raise ValueError(f"unmapped glyph id {cid} — extend the table above")


def to_ipa(raw):
    s = "".join(PHON.get(c, c) for c in raw)
    s = s.replace("əː", "ɜː").replace("ɔi", "\x04ɪ")
    s = s.replace("ɔː", "\x01").replace("ɔ", "ɒ").replace("\x01", "ɔː").replace("\x04", "ɔ")
    s = s.replace("aː", "ɑː")
    s = s.replace("iː", "\x02").replace("i", "ɪ").replace("\x02", "iː")
    s = s.replace("uː", "\x03").replace("u", "ʊ").replace("\x03", "uː")
    return re.sub(r"ɪ$", "i", re.sub(r"\s+", "", s))


def parse(pdf_path):
    entries = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            for col, (lo, hi) in enumerate(((0, COLUMN_SPLIT), (COLUMN_SPLIT, 900))):
                chars = sorted((c for c in page.chars if lo <= c["x0"] < hi),
                               key=lambda c: -c["matrix"][5])
                if not chars:
                    continue
                lines, cur, prev = [], [chars[0]], chars[0]["matrix"][5]
                for c in chars[1:]:                     # group by text baseline,
                    y = c["matrix"][5]                  # not by bounding box
                    if prev - y <= 4:
                        cur.append(c)
                    else:
                        lines.append(cur)
                        cur = [c]
                    prev = y
                lines.append(cur)

                entry = None
                for line in lines:
                    line.sort(key=lambda c: c["x0"])
                    heads = [c for c in line if "Phonetic" not in c["fontname"] and c["size"] > WORD_SIZE]
                    phon = [c for c in line if "Phonetic" in c["fontname"]]
                    gloss = [c for c in line if "Phonetic" not in c["fontname"] and c["size"] <= WORD_SIZE]
                    if heads:                            # a headword starts a new entry
                        entry = {"page": page_no, "col": col, "y": line[0]["matrix"][5],
                                 "word": "", "phon": "", "zh": ""}
                        entry["word"] = "".join(decode(cid_of(c)) for c in heads).strip()
                        entries.append(entry)
                    if entry is None:
                        continue                         # nothing above to attach to
                    entry["phon"] += "".join(c["text"] for c in phon)
                    entry["zh"] += "".join(decode(cid_of(c)) for c in gloss)
    entries.sort(key=lambda e: (e["page"], e["col"], -e["y"]))
    return entries


def cid_of(c):
    m = CID.match(c["text"])
    return int(m.group(1)) if m else None


def main():
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
    entries = parse(pdf_path)
    for e in entries:
        if not e["phon"].endswith("]"):     # one entry's closing bracket wraps
            e["phon"] += "]"
        e["ipa"] = to_ipa(e["phon"])

    words = [{"i": n, "u": e["page"], "w": e["word"], "p": e["ipa"], "z": e["zh"]}
             for n, e in enumerate(entries, 1)]
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))

    with open(os.path.join(ROOT, "data", "words.js"), "w", encoding="utf-8") as f:
        f.write("window.SAT_WORDS=[\n")
        for w in words:
            f.write(dump(w) + ",\n")
        f.write("];\n")

    by_unit = collections.OrderedDict()
    for w in words:
        by_unit.setdefault(w["u"], []).append(w["w"])
    with open(os.path.join(ROOT, "data", "units.js"), "w", encoding="utf-8") as f:
        f.write("window.SAT_UNITS=[\n")
        for u, ws in by_unit.items():
            f.write(dump({"u": u, "n": len(ws), "a": ws[0], "b": ws[-1]}) + ",\n")
        f.write("];\n")

    print(f"{len(words)} entries across {len(by_unit)} units -> data/words.js, data/units.js")


if __name__ == "__main__":
    main()
