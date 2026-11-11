'use strict';
/* 真题1000（《SAT 冲刺终极词汇 1000》，第四十九次优化）的数据回归：
   5 个单元、每个 200 词，编号 30001–31000 连续；每个词条有音标、释义、真题例句和恰好一处 ** 的译文；
   例句里高亮找得到词（应用自己的 wordPat / blankAt）。跑法：cd sat2300-web && node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('../pure.js');

const win = {};
const ctx = vm.createContext({ window: win });
['sat1000.js', 'sat1000_rich.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'), ctx);
});
const WORDS = win.SAT_WORDS;
const UNITS = win.SAT_UNITS;
const R = win.IELTS_RICH;

test('真题1000：5 个单元、1000 个词条、编号连续', function () {
  assert.strictEqual(UNITS.length, 5);
  assert.strictEqual(WORDS.length, 1000);
  WORDS.forEach(function (w, k) {
    assert.strictEqual(w.i, 30001 + k);
    assert.strictEqual(w.u, 5001 + Math.floor(k / 200));
  });
  UNITS.forEach(function (u, k) {
    assert.strictEqual(u.n, 200);
    assert.strictEqual(u.t, '真题1000 · Unit ' + String(k + 1).padStart(2, '0'));
  });
});

test('真题1000：每个词条有音标、释义、例句、恰好一处加粗的译文', function () {
  WORDS.forEach(function (w) {
    const r = R[w.i];
    assert.ok(w.p && w.z && w.z.length <= 60, w.w + ' 音标/释义');
    assert.ok(r && r.w === w.w && r.e && r.t, w.w + ' 例句');
    assert.strictEqual((r.t.match(/\*\*/g) || []).length, 2, w.w + ' 译文 ** ');
    if (r.x) {
      assert.strictEqual(r.x.length, 2);
      assert.strictEqual((r.x[1].match(/\*\*/g) || []).length, 2, w.w + ' 译文2 ** ');
    }
  });
});

test('真题1000：例句里找得到这个词（高亮、填空）', function () {
  const miss = WORDS.filter(function (w) {
    return !new RegExp('\\b(' + P.wordPat(w.w) + ')', 'i').test(R[w.i].e) && !P.blankAt(R[w.i].e, w.w);
  }).map(function (w) { return w.w; });
  assert.ok(miss.length <= 30, '找不到的太多：' + miss.join(', '));
});

/* 第五十七次优化：换成 11-10 新版。新词占了被删词的编号，打开时一次性清掉那些编号的旧记录，
   curate 的记录从 30052 挪到 30005，别的编号不动 */
test('真题1000 新版：新词在被删词的编号上，没有重复的词', function () {
  const at = {};
  WORDS.forEach(function (w) { at[w.i] = w.w; });
  assert.strictEqual(at[30005], 'curate');
  assert.strictEqual(at[30052], 'counteract');
  assert.strictEqual(at[30091], 'serene');     // 第五十八次换成 (5) 版，91 号是 serene（之前留的是 anecdote）
  assert.strictEqual(at[30628], 'indelible');
  assert.strictEqual(new Set(WORDS.map(function (w) { return w.w; })).size, 1000);
  ['highwayman', 'quay', 'ponder', 'breadth'].forEach(function (w) {
    assert.ok(!WORDS.some(function (x) { return x.w === w; }), w + ' 应该删掉了');
  });
});

test('真题1000 新版：reslotIds 清掉被删词的记录，curate 的跟着挪，别的不动', function () {
  const st = {
    prog: { 30005: 3, 30052: 1, 30091: 3, 30628: 1, 30001: 3 },
    hist: { 30052: 2, 30085: 1 },
    star: { 30005: 1, 30625: 1, 30002: 1 },
    sel: { 30052: 1 },
    col: { 30098: 'r', 30003: 'g' },
    hide: { 30443: { p: 3 } }
  };
  const n = P.reslotIds(st, P.T1000_V2_DROP, P.T1000_V2_MOVE);
  assert.deepStrictEqual(st.prog, { 30005: 1, 30091: 3, 30001: 3 });
  assert.deepStrictEqual(st.hist, { 30005: 2 });
  assert.deepStrictEqual(st.star, { 30002: 1 });
  assert.deepStrictEqual(st.sel, { 30005: 1 });
  assert.deepStrictEqual(st.col, { 30003: 'g' });
  assert.deepStrictEqual(st.hide, {});
  assert.strictEqual(n, 7);   // highwayman 的 prog、star，30628、30085、30625、30098、30443 各一条
  assert.strictEqual(P.T1000_V2_DROP.length, 26);
});

test('真题1000 (5) 版：第二次 reslot 只清 91/408/691/692 四个换了词的编号', function () {
  const st = {
    prog: { 30091: 3, 30408: 1, 30090: 2, 30693: 1 },
    star: { 30691: 1, 30692: 1, 30011: 1 },
    hist: { 30408: 4 }
  };
  const n = P.reslotIds(st, P.T1000_V3_DROP, {});
  assert.deepStrictEqual(st.prog, { 30090: 2, 30693: 1 });
  assert.deepStrictEqual(st.star, { 30011: 1 });
  assert.deepStrictEqual(st.hist, {});
  assert.strictEqual(n, 5);
  assert.deepStrictEqual(P.T1000_V3_DROP, [30091, 30408, 30691, 30692]);
});

test('真题1000 (5) 版：四个新词在数据里', function () {
  const words = {};
  WORDS.forEach(function (w) { words[w.i] = w.w; });
  assert.strictEqual(words[30091], 'serene');
  assert.strictEqual(words[30408], 'reconcile');
  assert.strictEqual(words[30691], 'characterize');
  assert.strictEqual(words[30692], 'onerous');
});
