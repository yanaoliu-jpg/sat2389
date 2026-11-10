/* 第五十三次优化：src/cet4/raw.json → src/cet4/in/L01–L35.tsv（给子代理的输入）
   每行 编号§原表单词§原表释义§现成音标§候选例句§候选译文
   现成音标：网站里已有的，先取牛津发音表（data/pron.js 英音），再取雅思词根、真题1000、SAT、托福那几本的音标。
   候选例句：同一个词在《雅思词根+联想记忆》里的书上例句和译文（已标好 **），子代理看合不合四级释义再决定用不用。 */
global.window = {};
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..', 'data');
for (const f of ['words', 'extra', 'toefl', 'ielts', 'ielts_root', 'sat1000', 'rich', 'ielts_rich', 'ielts_root_rich', 'pron'])
  eval(fs.readFileSync(path.join(D, f + '.js'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'cet4', 'raw.json'), 'utf8'));
const W = window.SAT_WORDS, IR = window.IELTS_RICH, P = window.PRON.w;
const byw = {};
W.forEach(x => (byw[x.w.toLowerCase()] = byw[x.w.toLowerCase()] || []).push(x));
const rank = x => x.i >= 20001 && x.i < 30000 ? 0 : x.i >= 30001 && x.i <= 31000 ? 1 : x.i < 5000 ? 2 : 3;
const clean = s => String(s || '').replace(/[§\t\n]/g, ' ').trim();
const lists = {};
for (const x of raw) {
  const k = x.w.toLowerCase();
  const pr = P[x.w] || P[k];
  const same = (byw[k] || []).slice().sort((a, b) => rank(a) - rank(b));
  const ipa = (pr && pr[0][2]) || (same.find(y => y.p) || {}).p || '';
  const rt = same.find(y => rank(y) === 0 && IR[y.i] && IR[y.i].e);
  const ex = rt ? IR[rt.i] : null;
  (lists[x.list] = lists[x.list] || []).push([x.i, x.w, x.z, ipa, ex ? ex.e : '', ex ? ex.t : ''].map(clean).join('§'));
}
for (const l in lists)
  fs.writeFileSync(path.join(__dirname, 'cet4', 'in', 'L' + String(l).padStart(2, '0') + '.tsv'), lists[l].join('\n') + '\n');
console.log(Object.keys(lists).length, 'files');
