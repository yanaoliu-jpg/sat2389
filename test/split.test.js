'use strict';
/* 拆单元（第四十四次优化）：导入的表前面是单词、后面是短语，拆成两个单元。
   跑法：cd sat2300-web && node --test */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isPhrase, phraseStart, splitCustomUnit } = require('../pure.js');

const W = (w, i) => ({ i: i, u: 101, w: w, p: '', z: '释义' + i });

test('带空格的是短语', () => {
  assert.equal(isPhrase('insight into'), true);
  assert.equal(isPhrase('well-behaved'), false);
  assert.equal(isPhrase('  exploit  '), false);
});

test('phraseStart 只认前面单词、后面短语', () => {
  assert.equal(phraseStart([W('a', 1), W('b', 2), W('c d', 3), W('e f', 4)]), 2);
  assert.equal(phraseStart([W('a', 1), W('b', 2)]), -1);              // 没有短语
  assert.equal(phraseStart([W('a b', 1), W('c d', 2)]), -1);          // 全是短语
  assert.equal(phraseStart([W('a', 1), W('b c', 2), W('d', 3)]), -1); // 中间夹着
  assert.equal(phraseStart([]), -1);
});

test('拆开以后编号不变，新单元紧跟在原单元后面', () => {
  const custom = [
    { u: 100, t: '我加的词', manual: 1, words: [W('x', 99)] },
    { u: 101, t: '导入 · 表', words: [W('a', 1), W('b', 2), W('c d', 3), W('e f', 4)] },
    { u: 102, t: '导入 · 别的', words: [W('g', 5)] }
  ];
  const before = JSON.stringify(custom);
  const out = splitCustomUnit(custom, 101, 2, '词汇', '短语', 103);
  assert.equal(JSON.stringify(custom), before);                       // 不改传进来的
  assert.deepEqual(out.map(c => c.u), [100, 101, 103, 102]);
  assert.equal(out[1].t, '词汇');
  assert.deepEqual(out[1].words.map(w => w.i), [1, 2]);
  assert.equal(out[2].t, '短语');
  assert.deepEqual(out[2].words.map(w => w.i), [3, 4]);
  assert.ok(out[2].words.every(w => w.u === 103));
  assert.ok(out[1].words.every(w => w.u === 101));
  assert.equal(out[2].manual, undefined);
});

test('拆的位置不对就原样返回', () => {
  const custom = [{ u: 101, t: '表', words: [W('a', 1), W('b', 2)] }];
  assert.deepEqual(splitCustomUnit(custom, 101, 0, 'x', 'y', 102), custom);
  assert.deepEqual(splitCustomUnit(custom, 101, 2, 'x', 'y', 102), custom);
  assert.deepEqual(splitCustomUnit(custom, 999, 1, 'x', 'y', 102), custom);
});
