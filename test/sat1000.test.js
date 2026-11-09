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
