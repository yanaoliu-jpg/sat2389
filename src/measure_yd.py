"""量有道单词录音的响度（第二十四次优化）：有道的录音不带跨域头，网页里拿不到采样，
没法边播边调音量；只好在这边先把每个词、两种口音的响度量出来，生成 data/ydgain.js。

  python3 src/measure_yd.py <词表.txt> <结果.tsv>      # 量（断了重跑会接着量）
  python3 src/measure_yd.py --build <结果.tsv>          # 生成 data/ydgain.js

src/ydlufs.tsv 是量好的结果，只改 TARGET 的话直接 --build 它就行，不用重新量。

结果每行：词 \t 口音(1 英 / 2 美) \t 响度 LUFS（取不到就是 NA）。
"""
import concurrent.futures as cf, json, os, re, subprocess, sys, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = -21.0      # 比这个响的压到这里；比它轻的放不大（volume 最多 1），原样播。
                    # 美音有一成录音挤在 -22 到 -26，目标定高了这批还是轻；定到 -21 整体小 4.8 dB，
                    # 美音的离散度从 2.45 dB 降到 0.71 dB，只剩约 2% 比目标轻 3 dB 以上


def lufs(word, typ):
    url = 'https://dict.youdao.com/dictvoice?type=%d&audio=%s' % (typ, urllib.parse.quote(word))
    for _ in range(3):           # 用 curl 取：走系统代理和证书，Python 自带的证书库在这台机器上不全
        data = subprocess.run(['curl', '-sf', '--max-time', '20', url], capture_output=True).stdout
        if len(data) >= 500:
            break
    if len(data) < 500:
        return 'NA'
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', 'pipe:0', '-af', 'ebur128', '-f', 'null', '-'],
                         input=data, capture_output=True).stderr.decode('utf8', 'replace')
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', out)
    return m[-1] if m else 'NA'


def measure(words_path, out_path):
    words = [w for w in open(words_path, encoding='utf8').read().split('\n') if w]
    done = set()
    if os.path.exists(out_path):
        for line in open(out_path, encoding='utf8'):
            p = line.rstrip('\n').split('\t')
            if len(p) == 3:
                done.add((p[0], p[1]))
    jobs = [(w, t) for w in words for t in (1, 2) if (w, str(t)) not in done]
    print('to do', len(jobs), 'already', len(done), flush=True)
    with open(out_path, 'a', encoding='utf8') as f, cf.ThreadPoolExecutor(16) as ex:
        futs = {ex.submit(lufs, w, t): (w, t) for w, t in jobs}
        for k, fu in enumerate(cf.as_completed(futs), 1):
            w, t = futs[fu]
            f.write('%s\t%d\t%s\n' % (w, t, fu.result()))
            if k % 200 == 0:
                f.flush()
                print(k, '/', len(jobs), flush=True)


def build(out_path):
    cuts = {'1': {}, '2': {}}
    for line in open(out_path, encoding='utf8'):
        p = line.rstrip('\n').split('\t')
        if len(p) == 3 and p[2] not in ('NA', '-inf'):
            cuts[p[1]][p[0]] = round(max(0.0, float(p[2]) - TARGET))
    gain = {}
    for k, c in cuts.items():
        d = sorted(c.values())[len(c) // 2]     # 中位数：跟它一样的词不用列，自己加的词也按它压
        gain['d' + k] = d
        gain[k] = {w: v for w, v in c.items() if v != d}
    js = ('/* 有道单词录音的音量表（第二十四次优化），由 src/measure_yd.py 生成：\n'
          '   每个数是要压低多少 dB，把偏响的录音压到 %.0f LUFS。\n'
          '   1 = 英音，2 = 美音；d1 / d2 是没列出的词用的值（中位数）。 */\n'
          'window.YD_GAIN=%s;\n') % (TARGET, json.dumps(gain, ensure_ascii=False, separators=(',', ':')))
    open(os.path.join(ROOT, 'data', 'ydgain.js'), 'w', encoding='utf8').write(js)
    print('data/ydgain.js', len(js.encode()) // 1024, 'KB', {k: (len(v) if isinstance(v, dict) else v) for k, v in gain.items()})


if __name__ == '__main__':
    if sys.argv[1] == '--build':
        build(sys.argv[2])
    else:
        measure(sys.argv[1], sys.argv[2])
