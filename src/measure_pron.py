"""量牛津 / 剑桥录音（第二十八次优化）：把 src/oxscan.jsonl 里用到的每个录音都真的取一遍，
确认地址能打开、是完整的音频，顺便量响度，结果写 src/oxlufs.tsv（断了重跑会接着量）。

  python3 src/measure_pron.py

每行：录音路径 \t 响度 LUFS \t 时长（秒）；取不到就是 NA。
"""
import concurrent.futures as cf, json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OX = 'https://www.oxfordlearnersdictionaries.com/media/english/'
CAM = 'https://dictionary.cambridge.org/us/media/english/'
LD = 'https://www.ldoceonline.com/media/english/'
WK = os.path.join(ROOT, 'data', 'audio') + os.sep     # 维基词典的录音放在自己仓库里，来源见 data/audio/CREDITS.txt
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'


def measure(job):
    path, base = job
    url = base + path
    data = open(url, 'rb').read() if base == WK else b''
    for _ in range(3):
        if len(data) >= 500:
            break
        data = subprocess.run(['curl', '-sf', '--max-time', '20', '-A', UA, url], capture_output=True).stdout
        if len(data) >= 500:
            break
    if len(data) < 500:
        return path, 'NA', 'NA'
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', 'pipe:0', '-af', 'ebur128', '-f', 'null', '-'],
                         input=data, capture_output=True).stderr.decode('utf8', 'replace')
    lu = re.findall(r'I:\s+(-?[\d.]+) LUFS', out)
    t = re.findall(r'time=(\d+):(\d+):([\d.]+)', out)
    dur = int(t[-1][0]) * 3600 + int(t[-1][1]) * 60 + float(t[-1][2]) if t else 0
    return path, lu[-1] if lu else 'NA', '%.2f' % dur


def main():
    out_path = os.path.join(ROOT, 'src', 'oxlufs.tsv')
    done = set()
    if os.path.exists(out_path):
        done = {l.split('\t')[0] for l in open(out_path, encoding='utf8') if l.count('\t') == 2 and '\tNA' not in l}
    jobs = {}
    for line in open(os.path.join(ROOT, 'src', 'oxscan.jsonl'), encoding='utf8'):
        for e in json.loads(line)['e']:
            for k in ('gb', 'us'):
                if e.get(k) and e[k] not in done:
                    jobs[e[k]] = CAM if e.get('camb') else LD if e.get('ld') else WK if e.get('wk') else OX
    print('to do', len(jobs), 'already', len(done), flush=True)
    with open(out_path, 'a', encoding='utf8') as f, cf.ThreadPoolExecutor(8) as ex:
        for k, r in enumerate(ex.map(measure, jobs.items()), 1):
            f.write('\t'.join(r) + '\n')
            if k % 500 == 0:
                f.flush()
                print(k, '/', len(jobs), flush=True)
    print('done', flush=True)


if __name__ == '__main__':
    main()
