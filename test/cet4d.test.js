'use strict';
/* 四级词汇海豚版（《四级词汇教师-海豚版》，第五十五次优化）的数据回归：
   35 个单元、2661 个词条，编号 43001 起连续；每个词条有音标、释义、例句和恰好一处 ** 的译文；
   例句里高亮 / 填空找得到词（应用自己的 wordPat / blankAt）。跑法：cd sat2300-web && node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('../pure.js');

const win = {};
const ctx = vm.createContext({ window: win });
['cet4d.js', 'cet4d_rich.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'), ctx);
});
const WORDS = win.SAT_WORDS;
const UNITS = win.SAT_UNITS;
const R = win.IELTS_RICH;

test('四级海豚版：35 个单元、2661 个词条、编号连续', function () {
  assert.strictEqual(UNITS.length, 35);
  assert.strictEqual(WORDS.length, 2661);
  WORDS.forEach(function (w, k) { assert.strictEqual(w.i, 43001 + k); });
  UNITS.forEach(function (u, k) {
    assert.strictEqual(u.u, 6101 + k);
    assert.strictEqual(u.t, '四级海豚版 · List ' + String(k + 1).padStart(2, '0'));
    assert.strictEqual(u.n, WORDS.filter(function (w) { return w.u === u.u; }).length);
  });
});

test('四级海豚版：每个词条有音标、释义、例句、恰好一处加粗的译文', function () {
  WORDS.forEach(function (w) {
    const r = R[w.i];
    assert.ok(w.p && /[一-鿿]/.test(w.z), w.w + ' 音标/释义');
    assert.ok(r && r.w === w.w && r.e && r.t, w.w + ' 例句');
    assert.strictEqual((r.t.match(/\*\*/g) || []).length, 2, w.w + ' 译文 ** ');
  });
});

test('四级海豚版：例句里找得到这个词（高亮、填空）', function () {
  const miss = WORDS.filter(function (w) {
    return !new RegExp('\\b(' + P.wordPat(w.w) + ')', 'i').test(R[w.i].e) && !P.blankAt(R[w.i].e, w.w);
  }).map(function (w) { return w.w; });
  assert.ok(miss.length <= 30, '找不到的太多：' + miss.join(', '));
});
