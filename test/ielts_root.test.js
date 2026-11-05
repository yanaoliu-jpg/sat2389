'use strict';
/* 雅思词根联想（《雅思词汇词根+联想记忆法 乱序版》，第四十七次优化）的数据回归：
   50 个 Word List 一个 List 一个单元、词条编号从 20001 连续、每个词条都有音标、例句和恰好一处 ** 的译文，
   例句里找得到词（用应用自己的 wordPat / wordRe / blankAt 验，不另写一套规则）。
   跑法：cd sat2300-web && node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('../pure.js');

const win = {};
const ctx = vm.createContext({ window: win });
['ielts_root.js', 'ielts_root_rich.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'), ctx);
});
const WORDS = win.SAT_WORDS;
const UNITS = win.SAT_UNITS;
const R = win.IELTS_RICH;
const RAW = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'ielts_root', 'raw.json'), 'utf8'));

test('词根联想：50 个 List 都在，词条数和书上拆出来的一样', function () {
  assert.strictEqual(UNITS.length, 50);
  assert.strictEqual(WORDS.length, RAW.length);
});

test('词根联想：编号从 20001 连续，单元 4001–4050 一个 List 一个，首末词和词数对得上', function () {
  WORDS.forEach(function (w, k) {
    assert.strictEqual(w.i, 20001 + k, '第 ' + k + ' 个词条编号不对：' + w.w);
    assert.strictEqual(w.w, RAW[k].w, w.i + ' 单词和书上不一样');
    assert.strictEqual(w.u, 4000 + RAW[k].list, w.w + ' 不在它的 List 里');
  });
  UNITS.forEach(function (u, k) {
    assert.strictEqual(u.u, 4001 + k);
    assert.strictEqual(u.t, '雅思词根联想 · List ' + String(k + 1).padStart(2, '0'));
    const mine = WORDS.filter(function (w) { return w.u === u.u; });
    assert.strictEqual(u.n, mine.length, u.t + ' 登记的词数不对');
    assert.strictEqual(u.a, mine[0].w, u.t + ' 的首词');
    assert.strictEqual(u.b, mine[mine.length - 1].w, u.t + ' 的末词');
  });
});

test('词根联想：每个词条都有音标、释义、例句和译文，译文恰好一处 ** 而且里面有字', function () {
  const bad = [];
  WORDS.forEach(function (w) {
    const o = R[w.i];
    if (!String(w.p || '').trim()) bad.push(w.i + ' ' + w.w + ' 没有音标');
    if (!String(w.z || '').trim()) bad.push(w.i + ' ' + w.w + ' 没有释义');
    if (!o) { bad.push(w.i + ' ' + w.w + ' 没有例句'); return; }
    if (o.w !== w.w) bad.push(w.i + ' 条目里是 ' + o.w + '，词条是 ' + w.w);
    if (!String(o.e || '').trim() || !String(o.t || '').trim()) bad.push(w.i + ' ' + w.w + ' 例句或译文是空的');
    const marks = String(o.t || '').match(/\*\*(.+?)\*\*/g) || [];
    if (marks.length !== 1 || String(o.t).split('**').length !== 3) bad.push(w.i + ' ' + w.w + ' 译文标记不是恰好一处');
    else if (!marks[0].replace(/\*/g, '').trim()) bad.push(w.i + ' ' + w.w + ' 标记是空的');
  });
  assert.deepStrictEqual(bad, []);
});

test('词根联想：例句里找得到词（卡片高亮 wordPat，接不住时 wordRe；填空 blankAt）', function () {
  const bad = [];
  WORDS.forEach(function (w) {
    const e = R[w.i].e;
    const hl = new RegExp('\\b(' + P.wordPat(w.w) + ')', 'i').test(e) || P.wordRe(w.w).test(e);
    if (!hl) bad.push(w.i + ' ' + w.w + ' 高亮找不到：' + e);
    if (!P.blankAt(e, w.w)) bad.push(w.i + ' ' + w.w + ' 填空找不到：' + e);
  });
  assert.deepStrictEqual(bad, []);
});

test('词根联想：例句数据只占自己的编号（20001 起），不碰雅思核心词汇 10001 起的', function () {
  const keys = Object.keys(R).map(Number);
  assert.strictEqual(keys.length, WORDS.length);
  keys.forEach(function (k) { assert.ok(k >= 20001 && k < 20001 + WORDS.length, '多出来的编号 ' + k); });
});
