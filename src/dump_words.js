/* 把内置词表和词性写成 JSON，给 src/update_pron.py 用：{词: {pos: [词性…], p: 音标}} */
const fs = require('fs'), vm = require('vm'), path = require('path');
const R = path.join(__dirname, '..', 'data');
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of ['units', 'words', 'extra', 'toefl', 'ielts', 'rich', 'toefl_rich', 'ielts_rich'])
  vm.runInContext(fs.readFileSync(path.join(R, f + '.js'), 'utf8'), ctx);
const RICH = ctx.window.SAT_RICH || {};
const POS = /(?:^|[^a-zA-Z])(vt|vi|prep|conj|pron|interj|int|num|art|adv|adj|ad|a|n|v)\./g;
const same = { vt: 'v', vi: 'v', adj: 'a', adv: 'ad', interj: 'int' };
const out = {};
for (const w of ctx.window.SAT_WORDS) {
  const m = out[w.w] || (out[w.w] = { pos: [], p: w.p });
  for (const z of [w.z, (RICH[w.w] || {}).z || '']) {
    POS.lastIndex = 0;
    let x;
    while ((x = POS.exec(z))) { const t = same[x[1]] || x[1]; if (!m.pos.includes(t)) m.pos.push(t); }
  }
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
