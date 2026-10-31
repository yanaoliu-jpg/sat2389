'use strict';
/* 覆盖 pure.js 里的纯逻辑（第十五次优化 1）。跑法：
     node --test
   这几个函数挑出来测是因为历年出过好几次回归——IPA 正则、导入去重、
   填空定位都在评论里留了「第 N 次优化踩过的坑」，测试就照着那些坑写。 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseLine, parseTable, mergeRows, lcsMark, blankAt, poolSig } = require('../pure.js');

test('parseLine：几种常见写法都认得出来', () => {
  assert.deepEqual(parseLine('1. abate /əˈbeɪt/ v.减弱'), { w: 'abate', p: 'əˈbeɪt', z: 'v.减弱' });
  assert.deepEqual(parseLine('abate  əˈbeɪt  减弱'), { w: 'abate', p: 'əˈbeɪt', z: '减弱' });
  assert.deepEqual(parseLine('abate — 减弱'), { w: 'abate', p: '', z: '减弱' });
  assert.deepEqual(parseLine('abate,减弱'), { w: 'abate', p: '', z: '减弱' });
});

test('parseLine：词组也认（第五次优化 5）', () => {
  assert.deepEqual(parseLine('prone to 容易…的'), { w: 'prone to', p: '', z: '容易…的' });
  assert.deepEqual(parseLine('come to terms with — 接受'), { w: 'come to terms with', p: '', z: '接受' });
});

test('parseLine：词性标记贴在英文尾巴上时挪回中文那边', () => {
  assert.deepEqual(parseLine('abate v.减弱'), { w: 'abate', p: '', z: 'v.减弱' });
});

test('parseLine：没有中文、或者「词」超过 6 个英文单词，认不出就是 null', () => {
  assert.equal(parseLine('just some english text no chinese'), null);
  assert.equal(parseLine('this sentence has way way way way way too many english words 减弱'), null);
});

test('parseTable：单词/音标/释义三列能认出来', () => {
  const rows = [['abate', 'əˈbeɪt', '减弱'], ['abandon', 'əˈbændən', '放弃']];
  assert.deepEqual(parseTable(rows), [
    { w: 'abate', p: 'əˈbeɪt', z: '减弱' },
    { w: 'abandon', p: 'əˈbændən', z: '放弃' }
  ]);
});

test('parseTable：表头那一行（"word/ipa/meaning"）不当词条', () => {
  const rows = [['word', 'ipa', 'meaning'], ['abate', 'əˈbeɪt', '减弱']];
  assert.deepEqual(parseTable(rows), [{ w: 'abate', p: 'əˈbeɪt', z: '减弱' }]);
});

test('parseTable：编号列不会被当成单词列（第五次优化踩过的坑）', () => {
  // 「序号 | 单词 | 释义」——编号列（1, 2, ...）形似 CODEY，不该抢了单词列的位置
  const rows = [['编号', '单词', '释义'], ['1', 'abate', '减弱'], ['2', 'abandon', '放弃']];
  assert.deepEqual(parseTable(rows), [
    { w: 'abate', p: '', z: '减弱' },
    { w: 'abandon', p: '', z: '放弃' }
  ]);
});

test('mergeRows：同一个词两种释义，合并成一条，用「；」隔开（第八次优化 2）', () => {
  const rows = [
    { w: 'at the expense of', p: '', z: '以…为代价' },
    { w: 'at the expense of', p: '', z: '牺牲…' }
  ];
  assert.deepEqual(mergeRows(rows), {
    rows: [{ w: 'at the expense of', p: '', z: '以…为代价；牺牲…' }],
    merged: 1
  });
});

test('mergeRows：大小写不同也当同一个词；释义完全一样不重复拼接，缺的音标补上', () => {
  const rows = [{ w: 'abate', p: '', z: '减弱' }, { w: 'Abate', p: 'əˈbeɪt', z: '减弱' }];
  assert.deepEqual(mergeRows(rows), {
    rows: [{ w: 'abate', p: 'əˈbeɪt', z: '减弱' }],
    merged: 0
  });
});

test('lcsMark：完全一样时整串都标「对」', () => {
  const d = lcsMark('abate', 'abate');
  assert.deepEqual(d.a, [['a', 1], ['b', 1], ['a', 1], ['t', 1], ['e', 1]]);
  assert.deepEqual(d.b, d.a);
});

test('lcsMark：少打一个字母，只有那一个位置标「错」', () => {
  const d = lcsMark('abte', 'abate');
  assert.deepEqual(d.a, [['a', 1], ['b', 1], ['t', 1], ['e', 1]]);
  assert.deepEqual(d.b, [['a', 1], ['b', 1], ['a', 0], ['t', 1], ['e', 1]]);
});

test('blankAt：能挖到词的一般变形', () => {
  const m = blankAt('The storm abated near dawn.', 'abate');
  assert.ok(m);
  assert.equal(m[0], 'abated');
});

test('blankAt：不会把别的词里嵌着的字母当成这个词（词界要卡住）', () => {
  // "department" 里嵌着 "art"，但两边都不是词界，不该被挖空
  assert.equal(blankAt('The department released new guidelines.', 'art'), null);
});

test('blankAt：句子里完全没有这个词或它的任何变形，返回 null', () => {
  assert.equal(blankAt('Nothing relevant here at all.', 'xylophone'), null);
});

test('blankAt：严格变形找不到时，退回前缀式，接住 abatement 这类派生词', () => {
  const m = blankAt('The judge granted a partial abatement of the fine.', 'abate');
  assert.ok(m);
  assert.equal(m[0], 'abate');   // 前缀式不卡后词界，挖到的只是 "abatement" 里打头的 "abate"
});

test('poolSig：同一批词换了顺序还是同一个题库（第三十二次优化）', () => {
  assert.equal(poolSig([{ i: 3 }, { i: 10 }, { i: 2 }]), poolSig([{ i: 10 }, { i: 2 }, { i: 3 }]));
});

test('poolSig：多一个词、少一个词、换一个词都算题库变了', () => {
  const sig = poolSig([{ i: 1 }, { i: 2 }, { i: 3 }]);
  assert.notEqual(poolSig([{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }]), sig);
  assert.notEqual(poolSig([{ i: 1 }, { i: 2 }]), sig);
  assert.notEqual(poolSig([{ i: 1 }, { i: 2 }, { i: 9 }]), sig);
});
