'use strict';
/* 批量删词（第五十次优化）。单元列表里勾一批词一次删掉：
     · 自建／导入的词真删，连同进度、曾错过、生词本、颜色、选中；单元删空就连单元和分组里的引用一起删；
     · 内置词藏进 store.hide，记录跟着收进去，随时恢复；
     · deleteWords 的快照交给 undoDelete，整个撤回。
   跑法：cd sat2300-web && node --test */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applyHidden, hiddenIn, deleteWords, restoreHidden, undoDelete } = require('../pure.js');

const B = [                                  // 内置：单元 1 三个词，乱序单元 3001 引用 1 和 3
  { i: 1, u: 1, w: 'abate', p: '', z: '减弱' },
  { i: 2, u: 1, w: 'abhor', p: '', z: '憎恶' },
  { i: 3, u: 1, w: 'abide', p: '', z: '忍受' },
  { i: 4, u: 2, w: 'abate', p: '', z: '同名词，另一本书' }
];
const UNITS = [
  { u: 1, n: 3, a: 'abate', b: 'abide' },
  { u: 2, n: 1, a: 'abate', b: 'abate' },
  { u: 3001, n: 2, a: 'abide', b: 'abate', t: '乱序 01', ids: [3, 1] }
];
const cw = (i, u, w) => ({ i, u, w, p: '', z: '释义' });
function mk() {
  return {
    custom: [
      { u: 100, t: '我加的词', manual: 1, words: [cw(100001, 100, 'foo'), cw(100002, 100, 'bar'), cw(100003, 100, 'baz')] },
      { u: 101, t: '导入 · 表', words: [cw(100004, 101, 'qux')] }
    ],
    groups: [{ id: 'g1', name: '组', us: [1, 101, 100] }],
    prog: { 1: 3, 2: 1, 100001: 1, 100004: 3 }, hist: { 2: 1, 100001: 1 },
    star: { 1: 1, 100002: 1 }, col: { 3: 'c2', 100001: 'c1' },
    sel: { 1: 1, 2: 1, 100001: 1, 100004: 1, 999: 1 },
    gen: { abhor: ['g'], foo: ['g'], abate: ['g'] }, sense: { foo: { g: 1 } },
    hide: {}
  };
}
const clone = o => JSON.parse(JSON.stringify(o));

test('自建词真删：词条、进度、曾错过、星标、颜色、选中、例句都不留', () => {
  const s = mk();
  const snap = deleteWords(s, [100001, 100002], B);
  assert.equal(snap.n, 2);
  assert.deepEqual(s.custom[0].words.map(w => w.i), [100003]);
  assert.ok(!(100001 in s.prog) && !(100001 in s.hist) && !(100001 in s.col) && !(100001 in s.sel));
  assert.ok(!(100002 in s.star));
  assert.ok(!('foo' in s.gen) && !('foo' in s.sense));
  assert.deepEqual(s.hide, {}, '自建词不进隐藏表');
  assert.equal(s.sel[100004], 1, '别的选中不动');
  assert.equal(s.sel[999], 1);
});

test('内置词藏起来：记录收进 hide，活的表里不留；同名词条还在时例句不动', () => {
  const s = mk();
  const snap = deleteWords(s, [1, 2], B);
  assert.deepEqual(snap.hid.sort(), [1, 2]);
  assert.deepEqual(s.hide[1], { p: 3, s: 1 });
  assert.deepEqual(s.hide[2], { p: 1, h: 1, g: ['g'] }, 'abhor 没有别的词条了，例句跟着收进去');
  assert.ok(!(1 in s.prog) && !(1 in s.star) && !(1 in s.sel) && !(2 in s.hist));
  assert.ok(!('abhor' in s.gen));
  assert.deepEqual(s.gen.abate, ['g'], '另一本书还有 abate，例句留着');
});

test('applyHidden：词表去掉藏起来的词，原书单元和乱序单元都重算 n/a/b，没碰到的单元原样', () => {
  const r = applyHidden(B, UNITS, { 1: {} });
  assert.deepEqual(r.words.map(w => w.i), [2, 3, 4]);
  assert.deepEqual([r.units[0].n, r.units[0].a, r.units[0].b], [2, 'abhor', 'abide']);
  assert.strictEqual(r.units[1], UNITS[1]);
  assert.deepEqual([r.units[2].n, r.units[2].a, r.units[2].b], [1, 'abide', 'abide']);
  assert.deepEqual(r.units[2].ids, [3, 1], 'ids 本身不改，恢复了还能排回原位');
  assert.equal(UNITS[0].n, 3, '原单元对象不被改');
  const none = applyHidden(B, UNITS, {});
  assert.equal(none.words.length, 4);
});

test('hiddenIn：按单元自己的顺序列出藏起来的词', () => {
  const hide = { 1: {}, 3: {} };
  assert.deepEqual(hiddenIn(UNITS[0], B, hide).map(w => w.i), [1, 3]);
  assert.deepEqual(hiddenIn(UNITS[2], B, hide).map(w => w.i), [3, 1]);
  assert.deepEqual(hiddenIn(UNITS[1], B, hide), []);
});

test('restoreHidden：放回来，记录和例句原样回来；回来前又标过的不覆盖', () => {
  const s = mk();
  deleteWords(s, [1, 2], B);
  s.prog[1] = 1;                            // 理论上藏着时标不到，保险：不覆盖
  assert.equal(restoreHidden(s, [1, 2, 3], B), 2);
  assert.deepEqual(s.hide, {});
  assert.equal(s.prog[1], 1);
  assert.equal(s.star[1], 1);
  assert.equal(s.prog[2], 1); assert.equal(s.hist[2], 1);
  assert.deepEqual(s.gen.abhor, ['g']);
  assert.ok(!(1 in s.sel), '过很久再恢复，不把它重新勾上');
});

test('单元删空：单元和分组里的引用一起删；撤回原样回到原位', () => {
  const s = mk(), before = clone(s);
  const snap = deleteWords(s, [100004], B);
  assert.deepEqual(s.custom.map(c => c.u), [100]);
  assert.deepEqual(s.groups[0].us, [1, 100]);
  undoDelete(s, snap, B);
  assert.deepEqual(s, before);
});

test('混着删（自建 + 内置 + 删空一个单元）再撤回，store 跟删之前一模一样', () => {
  const s = mk(), before = clone(s);
  const snap = deleteWords(s, [1, 2, 100001, 100003, 100004], B);
  assert.equal(snap.n, 5);
  assert.deepEqual(s.custom.map(c => c.words.map(w => w.i)), [[100002]]);
  undoDelete(s, snap, B);
  assert.deepEqual(s, before);
});

test('不存在的编号、已经藏起来的词不算数，也不会出错', () => {
  const s = mk();
  deleteWords(s, [1], B);
  const snap = deleteWords(s, [1, 424242], B);
  assert.equal(snap.n, 0);
  assert.deepEqual(Object.keys(s.hide), ['1']);
});

test('旧数据没有 hide 字段也能删', () => {
  const s = mk(); delete s.hide;
  deleteWords(s, [3], B);
  assert.deepEqual(s.hide, { 3: { c: 'c2' } });
});
