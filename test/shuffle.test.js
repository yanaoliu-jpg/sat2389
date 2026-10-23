'use strict';
/* 乱序版的数据回归（第二十一次优化）：单元照《2300 高密度便携版》的竖列分、单元里打乱，
   单元本身不带词条，ids 指向原书词条（进度按 i 存，所以跟原书单元共用）。
   跑法：cd sat2300-web && node --test */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const win = {};
const ctx = vm.createContext({ window: win });
['units.js', 'words.js', 'extra.js', 'shuffle.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'), ctx);
});

const UNITS = win.SAT_UNITS.filter(function (u) { return u.u >= 3001 && u.u < 4000; });
const BOOK = {};                                   // 原书 36 个单元的词条
win.SAT_WORDS.forEach(function (w) { if (w.u >= 1 && w.u <= 36) BOOK[w.i] = w; });

test('乱序：PDF 10 列 = 10 个单元，前 9 列各 233 词、第 10 列 232 词', function () {
  /* UNITS 是 vm 里造出来的数组，原型跟这边的不是同一个，deepStrictEqual 会嫌弃 —— 用 Array.from 拷到这边再比 */
  assert.deepStrictEqual(Array.from(UNITS, function (u) { return u.n; }), [233, 233, 233, 233, 233, 233, 233, 233, 233, 232]);
});

test('乱序：跨单元重复的只有 PDF 自己印了两遍的 continual、discretion、intrusive', function () {
  const seen = {};
  UNITS.forEach(function (u) { u.ids.forEach(function (i) { seen[i] = (seen[i] || 0) + 1; }); });
  const twice = Object.keys(seen).filter(function (i) { return seen[i] > 1; })
    .map(function (i) { return BOOK[i].w; }).sort();
  assert.deepStrictEqual(twice, ['continual', 'discretion', 'intrusive']);
  assert.strictEqual(Object.keys(seen).length, 2326);
});

test('乱序：单元号从 3001 连续排，标题是「乱序 NN」', function () {
  assert.ok(UNITS.length >= 1);
  UNITS.forEach(function (u, k) {
    assert.strictEqual(u.u, 3001 + k);
    assert.strictEqual(u.t, '乱序 ' + String(k + 1).padStart(2, '0'));
  });
});

test('乱序：每个编号都指向原书词条，同一单元里不重复；词数、首尾词跟 ids 对得上', function () {
  UNITS.forEach(function (u) {
    assert.strictEqual(u.n, u.ids.length, u.t + ' 登记的词数不对');
    assert.strictEqual(new Set(u.ids).size, u.ids.length, u.t + ' 里有重复的词条');
    u.ids.forEach(function (i) { assert.ok(BOOK[i], u.t + ' 的 #' + i + ' 不是原书词条'); });
    assert.strictEqual(u.a, BOOK[u.ids[0]].w);
    assert.strictEqual(u.b, BOOK[u.ids[u.ids.length - 1]].w);
  });
});

test('乱序：单元不带自己的词条，进度只有原书那一份', function () {
  win.SAT_WORDS.forEach(function (w) { assert.ok(!(w.u >= 3001 && w.u < 4000), '#' + w.i + ' 挂在了乱序单元上'); });
});

test('乱序：一列从 a 贯穿到 z，而且真的打乱了', function () {
  UNITS.forEach(function (u) {
    const ws = u.ids.map(function (i) { return BOOK[i].w; });
    const heads = new Set(ws.map(function (w) { return w[0].toLowerCase(); }));
    assert.ok(heads.size >= 20, u.t + ' 只覆盖了 ' + heads.size + ' 个首字母');
    let up = 0;
    for (let k = 1; k < ws.length; k++) if (ws[k - 1] < ws[k]) up++;
    const r = up / (ws.length - 1);                // 随机排列里相邻两个升序的约占一半；照字母排就接近 1
    assert.ok(r > 0.35 && r < 0.65, u.t + ' 相邻升序比例 ' + r.toFixed(2) + '，不像打乱过');
  });
});
