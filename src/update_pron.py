#!/usr/bin/env python3
"""发音全流程（第二十八次优化）：新词进发音表，一条命令走完。

  python3 src/update_pron.py                     # 内置词表里新加、还没查过的词
  python3 src/update_pron.py 新词.txt            # 再加上这个文件里的词，一行一个
  pbpaste | python3 src/update_pron.py -         # 设置里「复制还没进发音表的词」之后直接这样跑
  加 --push 跑完提交并推到 GitHub，网站几分钟后更新

流程：查词典（src/scan_pron.py）→ 真的取一遍每个录音、量音量（src/measure_pron.py）
→ 生成 data/pron.js（src/build_pron.py）→ 跑测试 → 生成单文件版 → 提交推送。
测试不过就停下，不会推送。
"""
import concurrent.futures as cf, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import scan_pron

SCAN = os.path.join(HERE, 'oxscan.jsonl')


def run(*cmd):
    print('$', ' '.join(cmd), flush=True)
    subprocess.run(cmd, cwd=ROOT, check=True)


def main():
    args = sys.argv[1:]
    push = '--push' in args
    args = [a for a in args if a != '--push']
    listed = []
    for a in args:
        text = sys.stdin.read() if a == '-' else open(a, encoding='utf8').read()
        listed += [x.strip() for x in text.split('\n') if x.strip()]
    junk = [x for x in listed if not re.fullmatch(r"[^\W\d_][\w'’ -]*", x) or len(x.split()) > 6]
    for x in junk:
        print('跳过，不像单词：', x, flush=True)     # 比如剪贴板里其实是命令本身
    listed = [x for x in listed if x not in junk]

    meta_path = os.path.join(tempfile.gettempdir(), 'sat2389_words.json')
    run('node', os.path.join(HERE, 'dump_words.js'), meta_path)
    meta = json.load(open(meta_path, encoding='utf8'))
    rows = {}
    for line in open(SCAN, encoding='utf8'):
        r = json.loads(line)
        rows[r['w']] = r
    todo = [w for w in list(meta) + listed if w not in rows or (w in listed and not rows[w]['e'])]
    todo = list(dict.fromkeys(todo))
    print('要查 %d 个词' % len(todo), flush=True)
    with cf.ThreadPoolExecutor(6) as ex:
        for k, r in enumerate(ex.map(scan_pron.lookup, todo), 1):
            rows[r['w']] = r
            print(k, r['w'], '有' if r['e'] else '词典都没有', flush=True)
    with open(SCAN, 'w', encoding='utf8') as f:
        for w in sorted(rows):
            f.write(json.dumps(rows[w], ensure_ascii=False, separators=(',', ':')) + '\n')

    run(sys.executable, os.path.join(HERE, 'measure_pron.py'))
    run(sys.executable, os.path.join(HERE, 'build_pron.py'), meta_path)
    run('node', '--test')
    run(sys.executable, os.path.join(HERE, 'build_single.py'), 'SAT2389-单文件版.html')
    if push:
        run('git', 'add', 'data/pron.js', 'src/oxscan.jsonl', 'src/oxlufs.tsv', 'SAT2389-单文件版.html')
        run('git', 'commit', '-m', '发音表补上 %d 个新词' % len(todo))
        run('git', 'push')
    print('完成。', '已推送，网站几分钟后更新。' if push else '加 --push 才会发布到网站。')


if __name__ == '__main__':
    main()
