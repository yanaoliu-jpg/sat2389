#!/usr/bin/env python3
"""Inline the site into one self-contained HTML file.

  python3 build_single.py <out.html> [--fragment]

--fragment omits <!DOCTYPE>/<html>/<head>/<body> (for publishing as an Artifact,
which supplies that skeleton itself).
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
read = lambda *p: open(os.path.join(ROOT, *p), encoding="utf-8").read()

out_path = sys.argv[1]
fragment = "--fragment" in sys.argv

html = read("index.html")
body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
body = re.sub(r'\s*<script src="[^"]+"></script>', "", body)

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Faustina:ital,wght@0,400..700;1,400..600'
         '&family=Space+Grotesk:wght@400;500;700&family=Noto+Sans:wght@400;500&display=swap" rel="stylesheet">')

parts = ["<title>SAT 2389 背单词</title>", FONTS,
         "<style>\n" + read("app.css") + "</style>",
         body.strip(),
         "<script>\n" + "".join(read("data", f) for f in
             ("units.js", "words.js", "extra.js", "toefl.js", "ielts.js", "rich.js", "toefl_rich.js")) + read("pure.js") + read("app.js") + "</script>"]
doc = "\n".join(parts)

if not fragment:
    doc = ('<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
           + "\n".join(parts[:3]) + "\n</head>\n<body>\n" + "\n".join(parts[3:]) + "\n</body>\n</html>\n")

open(out_path, "w", encoding="utf-8").write(doc)
print(f"{out_path}  {len(doc.encode()) / 1024:.0f} KB  (fragment={fragment})")
