/* 第五十五次优化：src/cet4d/raw.json → src/cet4d/in/L01–L35.tsv（给子代理的输入）
   每行 编号§原表单词§原表释义§参考单词§参考音标§参考释义§参考例句§参考译文
   参考：海豚版的词九成八在《四级词汇2022版》（第五十三次优化，data/cet4.js）里已经整理过，先拿那边同一个词
   （同词、英式拼法换美式、a/b 两种写法取前一个、拼错一两个字母、本身又不是个词的，找最像的那个）的音标、释义、例句、译文；
   2022 版里没有的，照 prep_cet4.js 的办法取网站里别的书的音标（牛津发音表优先）和《雅思词根+联想记忆》的例句。 */
global.window = {};
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..', 'data');
for (const f of ['words', 'extra', 'toefl', 'ielts', 'ielts_root', 'sat1000', 'rich', 'ielts_rich', 'ielts_root_rich', 'cet4', 'cet4_rich', 'pron'])
  eval(fs.readFileSync(path.join(D, f + '.js'), 'utf8'));
const W = window.SAT_WORDS, IR = window.IELTS_RICH, P = window.PRON.w;
const C4 = W.filter(x => x.i >= 40001 && x.i <= 42751);
const c4 = {};
C4.forEach(x => { const k = x.w.toLowerCase(); if (!c4[k]) c4[k] = x; });
const byw = {};
W.forEach(x => (byw[x.w.toLowerCase()] = byw[x.w.toLowerCase()] || []).push(x));
const rank = x => x.i >= 20001 && x.i < 30000 ? 0 : x.i >= 30001 && x.i <= 31000 ? 1 : x.i < 5000 ? 2 : 3;
const clean = s => String(s || '').replace(/[§\t\n]/g, ' ').trim();
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function variants(k) {
  const v = [k, k.replace(/[()（）]/g, ''), k.split('/')[0], k.replace(/\(.*?\)|（.*?）/g, '')];
  for (const x of v.slice()) {
    v.push(x.replace(/our(s|able|ite|hood|ed|ing)?$/, 'or$1'), x.replace(/yse$/, 'yze'), x.replace(/tre$/, 'ter'),
           x.replace(/ise$/, 'ize'), x.replace(/isation$/, 'ization'), x.replace(/^despatch$/, 'dispatch'), x.replace(/yre$/, 'ire'));
  }
  return [...new Set(v)];
}
function ref(w) {
  const k = w.toLowerCase().trim();
  for (const v of variants(k)) if (c4[v]) return c4[v];
  if (P[w] || P[k] || byw[k] || k === 'saucer') return null;      // 本身是个真词（senator、diploma、accuracy……）就不去找长得像的别的词
  let best = null, bd = 3;
  for (const x of C4) {
    const y = x.w.toLowerCase();
    if (Math.abs(y.length - k.length) > 2 || y[0] !== k[0]) continue;
    const d = lev(k, y);
    if (d < bd) { bd = d; best = x; }
  }
  return bd <= (k.length >= 7 ? 2 : 1) ? best : null;
}
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'cet4d', 'raw.json'), 'utf8'));
const lists = {};
let hit = 0, fuzzy = [];
for (const x of raw) {
  const r = ref(x.w);
  let row;
  if (r) {
    hit++;
    if (r.w.toLowerCase() !== x.w.toLowerCase()) fuzzy.push(x.w + '→' + r.w);
    const e = IR[r.i];
    row = [x.i, x.w, x.z, r.w, r.p, r.z, e.e, e.t];
  } else {
    const k = x.w.toLowerCase(), pr = P[x.w] || P[k];
    const same = (byw[k] || []).slice().sort((a, b) => rank(a) - rank(b));
    const ipa = (pr && pr[0][2]) || (same.find(y => y.p) || {}).p || '';
    const rt = same.find(y => rank(y) === 0 && IR[y.i] && IR[y.i].e);
    const ex = rt ? IR[rt.i] : null;
    row = [x.i, x.w, x.z, '', ipa, '', ex ? ex.e : '', ex ? ex.t : ''];
  }
  (lists[x.list] = lists[x.list] || []).push(row.map(clean).join('§'));
}
for (const l in lists)
  fs.writeFileSync(path.join(__dirname, 'cet4d', 'in', 'L' + String(l).padStart(2, '0') + '.tsv'), lists[l].join('\n') + '\n');
console.log(Object.keys(lists).length, 'files；2022 版里找到', hit, '/', raw.length, '；不同写法：', fuzzy.join(' '));
console.log('没找到：', raw.filter(x => !ref(x.w)).map(x => x.w).join(' '));
