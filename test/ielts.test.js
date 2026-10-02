'use strict';
/* 雅思词表的数据回归（第十九次优化）：每 90 词一个单元、每个词条都有自己的例句，
   以及「例句里找得到词」——这条必须用应用自己的函数验：卡片高亮走 wordPat，填空题走 blankAt。
   当初拿 Python 重写一遍规则就漏了 consumption / phobia 两句（词藏在 Overconsumption / Arachnophobia 里）。
   跑法：cd sat2300-web && node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const P = require('../pure.js');

const PER_LIST = 90;

/* 数据文件是写给浏览器的（window.SAT_WORDS = …），放进一个假的 window 里跑一遍再取值 */
const win = {};
const ctx = vm.createContext({ window: win });
['units.js', 'words.js', 'extra.js', 'toefl.js', 'ielts.js', 'rich.js', 'toefl_rich.js', 'ielts_rich.js']
  .forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'), ctx);
  });

const WORDS = win.SAT_WORDS.filter(function (w) { return w.i >= 10001 && w.i < 20000; });
const UNITS = win.SAT_UNITS.filter(function (u) { return u.u >= 2001 && u.u < 3000; });
const R = win.IELTS_RICH;

test('雅思：词条编号从 10001 连续排下去（进度按编号存，不能挪）', function () {
  assert.ok(WORDS.length > 0);
  WORDS.forEach(function (w, k) { assert.strictEqual(w.i, 10001 + k, '第 ' + k + ' 个词条编号不对：' + w.w); });
});

test('雅思：每 90 词一个单元，最后一个装余数', function () {
  assert.strictEqual(UNITS.length, Math.ceil(WORDS.length / PER_LIST));
  UNITS.forEach(function (u, k) {
    assert.strictEqual(u.u, 2001 + k, '单元号要连续');
    const mine = WORDS.filter(function (w) { return w.u === u.u; });
    assert.strictEqual(u.n, mine.length, u.t + ' 登记的词数跟实际成员对不上');
    if (k < UNITS.length - 1) assert.strictEqual(u.n, PER_LIST, u.t + ' 应该正好 ' + PER_LIST + ' 词');
    else assert.ok(u.n >= 1 && u.n <= PER_LIST);
    assert.strictEqual(u.a, mine[0].w, u.t + ' 的首词');
    assert.strictEqual(u.b, mine[mine.length - 1].w, u.t + ' 的末词');
  });
  WORDS.forEach(function (w, k) {
    assert.strictEqual(w.u, 2001 + Math.floor(k / PER_LIST), w.w + ' 不在它该在的单元');
  });
});

test('雅思：每个词条都有自己的例句和译文，条目里的单词跟词条对得上', function () {
  const bad = [];
  WORDS.forEach(function (w) {
    const o = R[w.i];
    if (!o) { bad.push(w.i + ' ' + w.w + ' 没有例句'); return; }
    if (o.w !== w.w) bad.push(w.i + ' 条目里是 ' + o.w + '，词条是 ' + w.w);
    if (!String(o.e || '').trim()) bad.push(w.i + ' ' + w.w + ' 例句是空的');
    if (!String(o.t || '').trim()) bad.push(w.i + ' ' + w.w + ' 译文是空的');
  });
  assert.deepStrictEqual(bad, []);
});

test('雅思：例句里找得到词（高亮用 wordPat，填空用 blankAt）', function () {
  const bad = [];
  WORDS.forEach(function (w) {
    const e = R[w.i].e;
    if (!new RegExp('\\b(' + P.wordPat(w.w) + ')', 'i').test(e)) bad.push(w.i + ' ' + w.w + ' 高亮找不到：' + e);
    if (!P.blankAt(e, w.w)) bad.push(w.i + ' ' + w.w + ' 填空找不到：' + e);
  });
  assert.deepStrictEqual(bad, []);
});

test('雅思：译文恰好一处 ** 标记，而且标记里有字', function () {
  const bad = [];
  WORDS.forEach(function (w) {
    const marks = R[w.i].t.match(/\*\*(.+?)\*\*/g) || [];
    if (marks.length !== 1) bad.push(w.i + ' ' + w.w + ' 有 ' + marks.length + ' 处标记');
    else if (!marks[0].replace(/\*/g, '').trim()) bad.push(w.i + ' ' + w.w + ' 标记是空的');
  });
  assert.deepStrictEqual(bad, []);
});

test('雅思：例句数据只占雅思自己的编号，不会碰到 SAT / 托福的', function () {
  const keys = Object.keys(R).map(Number);
  assert.strictEqual(keys.length, WORDS.length);
  keys.forEach(function (k) { assert.ok(k >= 10001 && k < 10001 + WORDS.length, '多出来的编号 ' + k); });
});
