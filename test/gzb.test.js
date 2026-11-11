'use strict';
/* 高中便携版（《高中英语词汇 念念不忘 便携版》，第六十次优化）的数据回归：
   23 个单元、1469 个词条，编号 49001 起连续；每个词条有音标、释义、例句和恰好一处 ** 的译文；
   例句里高亮 / 填空找得到词（应用自己的 wordPat / blankAt）。跑法：cd sat2300-web && node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('../pure.js');

const win = {};
const ctx = vm.createContext({ window: win });
['gzb.js', 'gzb_rich.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'), ctx);
});
const WORDS = win.SAT_WORDS;
const UNITS = win.SAT_UNITS;
const R = win.IELTS_RICH;

test('高中便携版：23 个单元、1469 个词条、编号连续', function () {
  assert.strictEqual(UNITS.length, 23);
  assert.strictEqual(WORDS.length, 1469);
  WORDS.forEach(function (w, k) { assert.strictEqual(w.i, 49001 + k); });
  UNITS.forEach(function (u, k) {
    assert.strictEqual(u.u, 6301 + k);
    assert.strictEqual(u.t, '高中便携版 · Lesson ' + String(k + 1).padStart(2, '0'));
    assert.strictEqual(u.n, WORDS.filter(function (w) { return w.u === u.u; }).length);
  });
});

test('高中便携版：每个词条有音标、释义、例句、恰好一处加粗的译文', function () {
  WORDS.forEach(function (w) {
    const r = R[w.i];
    assert.ok(w.p && /[一-鿿]/.test(w.z), w.w + ' 音标/释义');
    assert.ok(r && r.w === w.w && r.e && r.t, w.w + ' 例句');
    assert.strictEqual((r.t.match(/\*\*/g) || []).length, 2, w.w + ' 译文 ** ');
  });
});

test('高中便携版：例句里找得到这个词（高亮、填空）', function () {
  const miss = WORDS.filter(function (w) {
    return !new RegExp('\\b(' + P.wordPat(w.w) + ')', 'i').test(R[w.i].e) && !P.blankAt(R[w.i].e, w.w);
  }).map(function (w) { return w.w; });
  assert.ok(miss.length <= 20, '找不到的太多：' + miss.join(', '));
});

test('高中便携版：单词和原表（src/gzb/raw.json）一样，不一样的备注里写了「改词形」', function () {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'gzb', 'raw.json'), 'utf8'));
  const note = {};
  fs.readdirSync(path.join(__dirname, '..', 'src', 'gzb')).filter(function (f) { return /^L\d+\.tsv$/.test(f); }).forEach(function (f) {
    fs.readFileSync(path.join(__dirname, '..', 'src', 'gzb', f), 'utf8').split('\n').forEach(function (s) {
      const c = s.split('§');
      if (c.length === 7) note[c[0]] = c[6];
    });
  });
  assert.strictEqual(raw.length, WORDS.length);
  raw.forEach(function (x, k) {
    assert.strictEqual(WORDS[k].i, x.i);
    assert.strictEqual(WORDS[k].u, 6300 + x.list);
    if (WORDS[k].w !== x.w) assert.ok(/改词形/.test(note[x.i] || ''), x.w + ' → ' + WORDS[k].w + ' 没写改词形');
  });
});
