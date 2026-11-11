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

# 线上 index.html 里本站的 js/css 后面带 ?v=内容摘要（第五十一次优化）。GitHub Pages 每个文件各缓存 10 分钟，
# 不带版本时浏览器可能拿旧 index.html 配新 app.js（新数据没载进来）。文件一改摘要就变，浏览器只能取新的。
# 每次发布都要跑这个脚本，所以顺手在这里把 index.html 的版本号盖上。
import hashlib
def stamp(m):
    path = m.group(2)
    full = os.path.join(ROOT, path)
    if not os.path.isfile(full):
        return m.group(0)
    v = hashlib.md5(open(full, "rb").read()).hexdigest()[:8]
    return m.group(1) + path + "?v=" + v + '"'
stamped = re.sub(r'((?:src|href)=")((?:data/)?[\w.-]+\.(?:js|css))(?:\?v=\w+)?"', stamp, html)
if stamped != html:
    open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(stamped)
    html = stamped

body = re.search(r"<body>(.*)</body>", html, re.S).group(1)
body = re.sub(r'\s*<script src="[^"]+"></script>', "", body)

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link rel="preconnect" href="https://www.oxfordlearnersdictionaries.com">\n'
         '<link rel="preconnect" href="https://dict.youdao.com">\n'
         '<link href="https://fonts.googleapis.com/css2?family=Faustina:ital,wght@0,400..700;1,400..600'
         '&family=Space+Grotesk:wght@400;500;700&family=Noto+Sans:wght@400;500&display=swap" rel="stylesheet">')

parts = ["<title>SAT 2389 背单词</title>", FONTS,
         "<style>\n" + read("app.css") + "</style>",
         body.strip(),
         "<script>\n" + "".join(read("data", f) for f in
             ("units.js", "words.js", "extra.js", "shuffle.js", "toefl.js", "ielts.js", "ielts_root.js", "sat1000.js", "cet4.js", "cet4d.js", "gz.js", "rich.js", "toefl_rich.js", "ielts_rich.js", "ielts_root_rich.js", "sat1000_rich.js", "cet4_rich.js", "cet4d_rich.js", "gz_rich.js", "sense.js", "ydgain.js", "pron.js")) + read("pure.js") + read("app.js") + "</script>"]
doc = "\n".join(parts)

if not fragment:
    doc = ('<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n'
           '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
           + "\n".join(parts[:3]) + "\n</head>\n<body>\n" + "\n".join(parts[3:]) + "\n</body>\n</html>\n")

open(out_path, "w", encoding="utf-8").write(doc)
print(f"{out_path}  {len(doc.encode()) / 1024:.0f} KB  (fragment={fragment})")
