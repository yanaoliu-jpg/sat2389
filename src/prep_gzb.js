/* 第六十次优化：src/gzb/raw.json → src/gzb/in/L01–L23.tsv（给子代理的输入；照 prep_gz.js 改的）
   跟 prep_gz.js 不同：参考先拿《新版高中词汇》（data/gz.js，第五十九次刚整理、核对过，最贴高中），再拿四级 2022 版、海豚版；
   原表写成「apologise;apologize」的，两个写法都去找。
   以下是 prep_gz.js 原来的说明：
   第五十九次优化：src/gz/raw.json → src/gz/in/L01–L40.tsv（给子代理的输入）
   每行 编号§原表单词§原表释义§参考单词§参考音标§参考释义§参考例句§参考译文
   参考：高中词大部分在《四级词汇2022版》（data/cet4.js）或《四级词汇海豚版》（data/cet4d.js）里已经整理、核对过，
   先拿那边同一个词（同词、英式拼法换美式、eastward(s) 这种去掉括号、a/b 取前一个）的音标、释义、例句、译文，2022 版优先；
   两本都没有的，照 prep_cet4d.js 的办法取网站里别的书的音标（牛津发音表优先）和《雅思词根+联想记忆》的例句。
   跟 prep_cet4d.js 不同：不做「拼错一两个字母找最像的」那一步——这份原表拼写干净，模糊匹配只会配错。 */
global.window = {};
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..', 'data');
for (const f of ['words', 'extra', 'toefl', 'ielts', 'ielts_root', 'sat1000', 'cet4', 'cet4d', 'gz', 'rich', 'ielts_rich', 'ielts_root_rich', 'cet4_rich', 'cet4d_rich', 'gz_rich', 'pron'])
  eval(fs.readFileSync(path.join(D, f + '.js'), 'utf8'));
const W = window.SAT_WORDS, IR = window.IELTS_RICH, P = window.PRON.w;
const C4 = {};   // 新版高中词汇先占，再 2022 版，海豚版补
W.filter(x => x.i >= 46001 && x.i <= 48265).concat(W.filter(x => x.i >= 40001 && x.i <= 42751)).concat(W.filter(x => x.i >= 43001 && x.i <= 45661))
  .forEach(x => { const k = x.w.toLowerCase(); if (!C4[k] && IR[x.i] && IR[x.i].w === x.w) C4[k] = x; });
const byw = {};
W.forEach(x => (byw[x.w.toLowerCase()] = byw[x.w.toLowerCase()] || []).push(x));
const rank = x => x.i >= 20001 && x.i < 30000 ? 0 : x.i >= 30001 && x.i <= 31000 ? 1 : x.i < 5000 ? 2 : 3;
const clean = s => String(s || '').replace(/[§\t\n]/g, ' ').trim();
function variants(k) {
  const v = [k, k.replace(/[()（）]/g, ''), k.split('/')[0], k.replace(/\(.*?\)|（.*?）/g, '')];
  for (const x of v.slice()) {
    v.push(x.replace(/our(s|able|ite|hood|ed|ing|ful)?$/, 'or$1'), x.replace(/yse$/, 'yze'), x.replace(/tre$/, 'ter'),
           x.replace(/ise$/, 'ize'), x.replace(/isation$/, 'ization'), x.replace(/yre$/, 'ire'), x.replace(/ogue$/, 'og'),
           x.replace(/ence$/, 'ense'), x.replace(/-/g, ''), x.replace(/-/g, ' '), x.replace(/ll(ed|ing|er)$/, 'l$1'));
  }
  return [...new Set(v)];
}
function ref(w) {
  for (const p of w.split(';')) for (const v of variants(p.toLowerCase().trim())) if (C4[v]) return C4[v];
  return null;
}
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'gzb', 'raw.json'), 'utf8'));
fs.mkdirSync(path.join(__dirname, 'gzb', 'in'), { recursive: true });
const lists = {};
let hit = 0, other = [];
for (const x of raw) {
  const r = ref(x.w);
  let row;
  if (r) {
    hit++;
    if (r.w.toLowerCase() !== x.w.toLowerCase()) other.push(x.w + '→' + r.w);
    const e = IR[r.i];
    row = [x.i, x.w, x.z, r.w, r.p, r.z, e.e, e.t];
  } else {
    const k = x.w.split(';')[0].toLowerCase(), pr = P[x.w.split(';')[0]] || P[k];
    const same = (byw[k] || []).slice().sort((a, b) => rank(a) - rank(b));
    const ipa = (pr && pr[0][2]) || (same.find(y => y.p) || {}).p || '';
    const rt = same.find(y => rank(y) === 0 && IR[y.i] && IR[y.i].e);
    const ex = rt ? IR[rt.i] : null;
    row = [x.i, x.w, x.z, '', ipa, '', ex ? ex.e : '', ex ? ex.t : ''];
  }
  (lists[x.list] = lists[x.list] || []).push(row.map(clean).join('§'));
}
for (const l in lists)
  fs.writeFileSync(path.join(__dirname, 'gzb', 'in', 'L' + String(l).padStart(2, '0') + '.tsv'), lists[l].join('\n') + '\n');
console.log(Object.keys(lists).length, 'files；四级两本里找到', hit, '/', raw.length, '；不同写法：', other.join(' '));
const miss = raw.filter(x => !ref(x.w));
console.log('没找到', miss.length, '：', miss.map(x => x.w).join(' '));
