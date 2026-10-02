'use strict';
/* 自建词编号（第二十次优化）。
   自己导入／手动加的词，编号原来从 10000 往上排；后来内置的雅思词占了 10001–10639，
   2026-09-26 之前存下来的自建词就和雅思词撞了号。进度、星标、颜色都是按编号存的，
   撞号的两个词于是共用了同一份记录。这里钉住两件事：
     · 新词的编号从一个远高于所有内置词表的下限起排（nextCustomId）；
     · 已经存下来的撞号自建词，一次性换到下限之上的新编号，那份共用的记录整份跟着自建词走，
       内置词那边回到「未学」（renumberCollidingCustom）。
   跑法：cd sat2300-web && node --test */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { CUSTOM_ID_FLOOR: F, nextCustomId, renumberCollidingCustom } = require('../pure.js');

/* 内置词表的缩影：SAT / 托福 / 雅思各取一段。10000 和 10640 都不是内置编号（跟真实数据一样），
   10001–10003、10639 是雅思词。 */
const BUILTIN = [1, 2538, 5001, 9249, 10001, 10002, 10003, 10639]
  .map(i => ({ i, u: 0, w: 'b' + i, p: '', z: '' }));
const cw = (i, u) => ({ i, u, w: 'c' + i, p: '', z: '释义' });
const store = (custom, tables) => Object.assign(
  { custom, prog: {}, hist: {}, sel: {}, star: {}, col: {} }, tables);

test('nextCustomId：没有自建词时，第一个新词拿到下限本身', () => {
  assert.equal(nextCustomId([]), F);
  assert.equal(nextCustomId(BUILTIN), F);
});

test('nextCustomId：已经有自建词时接在最大的后面（不能和现有编号重复）', () => {
  assert.equal(nextCustomId(BUILTIN.concat([cw(F, 100), cw(F + 4, 100)])), F + 5);
});

test('撞号的自建词换新编号，五张进度表里的记录整份跟着走，内置词那边一条不留', () => {
  const st = store([{ u: 100, t: '我加的词', manual: 1, words: [cw(10000, 100), cw(10003, 100)] }], {
    prog: { 5001: 3, 10003: 3 }, hist: { 10003: 2 }, sel: { 10003: 1 },
    star: { 10003: 1 }, col: { 10003: 'c4' }
  });
  const out = renumberCollidingCustom(st, BUILTIN);
  assert.equal(out.moved, 1);
  assert.deepEqual(out.custom[0].words.map(w => w.i), [10000, F]);   // 10000 没有内置词，不撞，不动
  assert.deepEqual(out.prog, { 5001: 3, [F]: 3 });                   // 5001 是别的内置词自己的记录，原样留着
  assert.deepEqual(out.hist, { [F]: 2 });
  assert.deepEqual(out.sel, { [F]: 1 });
  assert.deepEqual(out.star, { [F]: 1 });
  assert.deepEqual(out.col, { [F]: 'c4' });
});

test('多个单元里撞号的词各拿各的新编号（按出现顺序），每张表里的记录跟着自己那个词', () => {
  const st = store([
    { u: 100, t: '我加的词', manual: 1, words: [cw(10001, 100), cw(10002, 100)] },
    { u: 101, t: '导入 · 某词表', words: [cw(10003, 101), cw(10640, 101)] }
  ], {
    prog: { 10001: 3 }, hist: { 10001: 2, 10003: 1 }, star: { 10002: 1 },
    sel: { 10003: 1 }, col: { 10001: 'c2', 10640: 'c5' }
  });
  const out = renumberCollidingCustom(st, BUILTIN);
  assert.equal(out.moved, 3);
  assert.deepEqual(out.custom.map(c => c.words.map(w => w.i)), [[F, F + 1], [F + 2, 10640]]);
  assert.deepEqual(out.prog, { [F]: 3 });
  assert.deepEqual(out.hist, { [F]: 2, [F + 2]: 1 });
  assert.deepEqual(out.star, { [F + 1]: 1 });
  assert.deepEqual(out.sel, { [F + 2]: 1 });
  assert.deepEqual(out.col, { [F]: 'c2', 10640: 'c5' });             // 10640 没撞，颜色留在原处
  // 单元归属、词本身的字段一个没变
  assert.deepEqual(out.custom.map(c => [c.u, c.t, c.manual]), [[100, '我加的词', 1], [101, '导入 · 某词表', undefined]]);
  assert.deepEqual(out.custom[1].words.map(w => [w.u, w.w, w.z]), [[101, 'c10003', '释义'], [101, 'c10640', '释义']]);
});

test('没撞号的自建词，以及内置词自己的记录，一个字都不动', () => {
  const st = store([{ u: 100, t: '我加的词', manual: 1, words: [cw(10000, 100), cw(10640, 100), cw(F + 5, 100)] }], {
    prog: { 5001: 3, 10000: 2, 10640: 1 }, hist: { 10002: 1, 10640: 1 }, sel: { 10000: 1 },
    star: { 10001: 1, [F + 5]: 1 }, col: { 10000: 'c1' }
  });
  const out = renumberCollidingCustom(st, BUILTIN);
  assert.equal(out.moved, 0);
  ['custom', 'prog', 'hist', 'sel', 'star', 'col'].forEach(k => assert.deepEqual(out[k], st[k], k));
});

test('撞号的词身上没有任何记录：只换编号，各张表里不会冒出空键', () => {
  const st = store([{ u: 100, t: '我加的词', manual: 1, words: [cw(10002, 100)] }], { prog: { 5001: 3 } });
  const out = renumberCollidingCustom(st, BUILTIN);
  assert.equal(out.moved, 1);
  assert.deepEqual(out.custom[0].words.map(w => w.i), [F]);
  assert.deepEqual(out.prog, { 5001: 3 });
  ['hist', 'sel', 'star', 'col'].forEach(k => assert.deepEqual(out[k], {}, k));
});

test('新编号不会撞上已经存在的高编号自建词', () => {
  const st = store([{ u: 100, t: '我加的词', manual: 1, words: [cw(F, 100), cw(10001, 100), cw(F + 7, 100)] }], {
    star: { 10001: 1 }
  });
  const out = renumberCollidingCustom(st, BUILTIN);
  const ids = out.custom[0].words.map(w => w.i);
  assert.equal(new Set(ids).size, ids.length, '编号重复了：' + ids);
  assert.ok(ids[1] > F + 7 && ids[0] === F && ids[2] === F + 7, '原来就在下限之上的两个词不该被动：' + ids);
  assert.deepEqual(out.star, { [ids[1]]: 1 });
});

test('不改传进来的东西（出错时内存里的 store 不会改了一半）', () => {
  const st = store([{ u: 100, t: '我加的词', manual: 1, words: [cw(10003, 100)] }], {
    prog: { 10003: 3 }, star: { 10003: 1 }
  });
  const before = JSON.stringify(st);
  renumberCollidingCustom(st, BUILTIN);
  assert.equal(JSON.stringify(st), before);
});

test('对结果再跑一遍什么都不会变（万一迁移被重复执行也不会再挪一次）', () => {
  const st = store([{ u: 100, t: '我加的词', manual: 1, words: [cw(10001, 100), cw(10003, 100)] }], {
    prog: { 10001: 2 }, hist: { 10003: 1 }, star: { 10003: 1 }
  });
  const once = renumberCollidingCustom(st, BUILTIN);
  const twice = renumberCollidingCustom(once, BUILTIN);
  assert.equal(twice.moved, 0);
  ['custom', 'prog', 'hist', 'sel', 'star', 'col'].forEach(k => assert.deepEqual(twice[k], once[k], k));
});

/* ---- 下面两条用真实的内置词表（跟 ielts.test.js 一样，把 data/*.js 放进假的 window 里跑一遍）---- */
const win = {};
const ctx = vm.createContext({ window: win });
['units.js', 'words.js', 'extra.js', 'toefl.js', 'ielts.js'].forEach(f => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'), ctx);
});
const REAL = win.SAT_WORDS;

test('下限比所有内置词表的编号都大：以后新加的自建词不会撞上 SAT / 托福 / 雅思', () => {
  const top = Math.max.apply(null, REAL.map(w => w.i));
  assert.ok(F > top, '内置词表里已经有编号 ' + top + ' 不低于自建词下限 ' + F + '，要么调高下限，要么别让内置词表长到那里');
  assert.equal(nextCustomId(REAL), F);
});

test('老版本存下来的自建词（编号从 10000 排起）对着真实内置词表迁移：一个不撞，记录一条不丢', () => {
  const words = [];
  for (let k = 0; k < 700; k++) words.push(cw(10000 + k, 100));    // 当年导入的 700 个词，全学过
  const st = store([{ u: 100, t: '我加的词', manual: 1, words }], {});
  words.forEach(w => { st.prog[w.i] = 3; });
  const builtin = new Set(REAL.map(w => w.i));
  const clash = words.filter(w => builtin.has(w.i));
  assert.ok(clash.length > 0, '这个场景应该真的有撞号的词');

  const out = renumberCollidingCustom(st, REAL);
  assert.equal(out.moved, clash.length);
  const ids = out.custom[0].words.map(w => w.i);
  assert.equal(new Set(ids).size, ids.length, '自建词之间编号重复了');
  ids.forEach(i => assert.ok(!builtin.has(i), i + ' 还和内置词撞着'));
  assert.equal(Object.keys(out.prog).length, words.length, '有的记录丢了');
  clash.forEach(w => assert.equal(out.prog[w.i], undefined, w.i + ' 那个内置词身上还留着自建词的进度'));
});
