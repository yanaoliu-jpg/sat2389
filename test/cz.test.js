'use strict';
/* 初中词汇（《初中英语词汇 乱序版》浙江教育，第六十二次优化）的数据回归：
   33 个单元、1997 个词条，编号 51001 起连续；每个词条有音标、释义、例句和恰好一处 ** 的译文；
   例句里高亮 / 填空找得到词（应用自己的 wordPat / blankAt）。跑法：cd sat2300-web && node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('../pure.js');

const win = {};
const ctx = vm.createContext({ window: win });
['cz.js', 'cz_rich.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'), ctx);
});
const WORDS = win.SAT_WORDS;
const UNITS = win.SAT_UNITS;
const R = win.IELTS_RICH;

test('初中词汇：33 个单元、1997 个词条、编号连续', function () {
  assert.strictEqual(UNITS.length, 33);
  assert.strictEqual(WORDS.length, 1997);
  WORDS.forEach(function (w, k) { assert.strictEqual(w.i, 51001 + k); });
  UNITS.forEach(function (u, k) {
    assert.strictEqual(u.u, 6401 + k);
    assert.strictEqual(u.t, '初中词汇 · List ' + String(k + 1).padStart(2, '0'));
    assert.strictEqual(u.n, WORDS.filter(function (w) { return w.u === u.u; }).length);
  });
});

test('初中词汇：每个词条有音标、释义、例句、恰好一处加粗的译文', function () {
  WORDS.forEach(function (w) {
    const r = R[w.i];
    assert.ok(w.p && /[一-鿿]/.test(w.z), w.w + ' 音标/释义');
    assert.ok(r && r.w === w.w && r.e && r.t, w.w + ' 例句');
    assert.strictEqual((r.t.match(/\*\*/g) || []).length, 2, w.w + ' 译文 ** ');
  });
});

test('初中词汇：释义精简过（不超过 90 个字符、没有人名行）', function () {
  WORDS.forEach(function (w) {
    assert.ok(w.z.length <= 90 && !/【名】|‖|人名/.test(w.z), w.w + ' 释义：' + w.z);
  });
});

test('初中词汇：例句里找得到这个词（高亮、填空）', function () {
  const misses = WORDS.filter(function (w) {
    return !P.blankAt(R[w.i].e, w.w);
  }).map(function (w) { return w.w; });
  assert.strictEqual(misses.length, 0, '找不到例句里的词：' + misses.join(', '));
});

test('初中词汇：单词和原表（src/cz/raw.json）一样，不一样的备注里写了「改词形」', function () {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'cz', 'raw.json'), 'utf8'));
  const note = {};
  fs.readdirSync(path.join(__dirname, '..', 'src', 'cz')).filter(function (f) { return /^L\d+\.tsv$/.test(f); }).forEach(function (f) {
    fs.readFileSync(path.join(__dirname, '..', 'src', 'cz', f), 'utf8').split('\n').forEach(function (s) {
      const c = s.split('§');
      if (c.length === 7) note[c[0]] = c[6];
    });
  });
  assert.strictEqual(raw.length, WORDS.length);
  raw.forEach(function (x, k) {
    assert.strictEqual(WORDS[k].i, x.i);
    assert.strictEqual(WORDS[k].u, 6400 + x.list);
    if (WORDS[k].w !== x.w) assert.ok(/改词形/.test(note[x.i] || ''), x.w + ' → ' + WORDS[k].w + ' 没写改词形');
  });
});
