'use strict';
/* 「讲透」样板（第三十九次优化）：data/sense.js 的内容格式，和近义词的排序。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { nearOrder, cleanSense, sensePrompt, dsModel, dsBody } = require('../pure.js');

const win = {};
const ctx = vm.createContext({ window: win });
['words.js', 'sense.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'), ctx);
});
const WORDS = new Set(win.SAT_WORDS.map(function (w) { return w.w; }));
const SENSE = win.SAT_SENSE;

test('讲透：样板是 30 个词，都在 SAT 词表里', function () {
  const keys = Object.keys(SENSE);
  assert.strictEqual(keys.length, 30);
  keys.forEach(function (k) { assert.ok(WORDS.has(k), k + ' 不在词表里'); });
});

test('讲透：每个词都有大白话、锚点词和至少一条辨析', function () {
  Object.keys(SENSE).forEach(function (k) {
    const s = SENSE[k];
    assert.ok(s.g && s.g.length <= 60, k + ' 的大白话要有，且不超过 60 字');
    assert.ok(s.a && s.a !== k, k + ' 的锚点词要有，且不能是它自己');
    assert.ok(s.n.length >= 1, k + ' 至少一条辨析');
    s.n.forEach(function (x) {
      assert.ok(x[0] !== k && x[1], k + ' 的辨析要有别的词和说明');
    });
  });
});

test('nearOrder：认识的词排前面，其余保持原来的顺序', function () {
  const near = [['a', '1'], ['b', '2'], ['c', '3']];
  const known = function (w) { return w === 'c'; };
  assert.deepEqual(nearOrder(near, known), [['c', '3'], ['a', '1'], ['b', '2']]);
});

test('nearOrder：都不认识时不动顺序，也不改原数组', function () {
  const near = [['a', '1'], ['b', '2']];
  assert.deepEqual(nearOrder(near, function () { return false; }), near);
  assert.deepEqual(near, [['a', '1'], ['b', '2']]);
});

test('cleanSense：整理模型的返回，去掉多余空白', function () {
  assert.deepEqual(cleanSense({ g: ' 大白话 ', a: ' die down ', n: [[' ebb ', ' 说明 ']] }, 'abate'),
    { g: '大白话', a: 'die down', n: [['ebb', '说明']] });
});

test('cleanSense：缺大白话或简单说法就不收', function () {
  assert.strictEqual(cleanSense({ a: 'x', n: [] }, 'abate'), null);
  assert.strictEqual(cleanSense({ g: 'x', a: '  ', n: [] }, 'abate'), null);
  assert.strictEqual(cleanSense({ g: 1, a: 'x', n: [] }, 'abate'), null);
  assert.strictEqual(cleanSense(null, 'abate'), null);
});

test('cleanSense：简单说法不能是这个词自己', function () {
  assert.strictEqual(cleanSense({ g: 'x', a: 'Abate', n: [] }, 'abate'), null);
});

test('cleanSense：没有近义词也收下，坏的条目和这个词自己去掉，最多留 3 条', function () {
  assert.deepEqual(cleanSense({ g: 'x', a: 'y' }, 'abate').n, []);
  const n = cleanSense({ g: 'x', a: 'y', n: [['ABATE', '自己'], 'ebb', ['wane'], ['a', '1'], ['b', '2'], ['c', '3'], ['d', '4']] }, 'abate').n;
  assert.deepEqual(n, [['a', '1'], ['b', '2'], ['c', '3']]);
});

test('cleanSense：这个词的变形不算近义词，也不能当简单说法', function () {
  const n = cleanSense({ g: 'x', a: 'y', n: [['enervated', '1'], ['Enervates', '2'], ['enervating', '3'], ['energize', '4']] }, 'enervate').n;
  assert.deepEqual(n, [['energize', '4']]);
  assert.strictEqual(cleanSense({ g: 'x', a: 'abated', n: [] }, 'abate'), null);
  assert.ok(cleanSense({ g: 'x', a: 'die down', n: [] }, 'abate'));
});

test('cleanSense：双写辅音和 y 变 i 的变形也认得出', function () {
  assert.deepEqual(cleanSense({ g: 'x', a: 'y', n: [['abhorred', '1'], ['abhorring', '2'], ['detest', '3']] }, 'abhor').n, [['detest', '3']]);
  assert.deepEqual(cleanSense({ g: 'x', a: 'y', n: [['mollified', '1'], ['mollifies', '2'], ['soothe', '3']] }, 'mollify').n, [['soothe', '3']]);
});

test('sensePrompt：有例句时说明例句只用来判断义项，没有例句时不提', function () {
  const rule = '例句只用来判断是哪个义项';
  assert.ok(sensePrompt({ w: 'fallacious', z: 'a.谬误的', e: 'The reasoning is fallacious.' }, []).includes(rule));
  assert.ok(!sensePrompt({ w: 'fallacious', z: 'a.谬误的' }, []).includes(rule));
});

test('sensePrompt：规定词性、不收变形、不用英文双引号', function () {
  const p = sensePrompt({ w: 'tenuous', z: 'a.细的' }, []);
  ['词性和用法要和这个词一样', '不能是这个词的变形', '不要用英文双引号'].forEach(function (s) {
    assert.ok(p.includes(s), '提示词里要有 ' + s);
  });
});

test('sensePrompt：带上单词、释义、例句和范例，要求返回 JSON', function () {
  const p = sensePrompt({ w: 'tenuous', z: 'a.细的,稀薄的', e: 'The link is tenuous.' },
    [['flimsy', SENSE.flimsy]]);
  ['tenuous', 'a.细的,稀薄的', 'The link is tenuous.', SENSE.flimsy.g, 'JSON'].forEach(function (s) {
    assert.ok(p.includes(s), '提示词里要有 ' + s);
  });
});

test('sensePrompt：没有例句时不写例句这一行，范例里不出现要讲的词', function () {
  const p = sensePrompt({ w: 'flimsy', z: 'a.薄弱的' }, [['flimsy', SENSE.flimsy], ['terse', SENSE.terse]]);
  assert.ok(!p.includes('例句：'));
  assert.ok(!p.includes(SENSE.flimsy.g));
  assert.ok(p.includes(SENSE.terse.g));
});

test('dsModel：停用的旧名字和空值换成 deepseek-flash，其他的不动', function () {
  ['deepseek-chat', 'deepseek-reasoner', '', undefined].forEach(function (m) {
    assert.strictEqual(dsModel(m), 'deepseek-flash');
  });
  assert.strictEqual(dsModel('deepseek-v4-pro'), 'deepseek-v4-pro');
});

test('dsBody：关掉思考模式，按需要 JSON', function () {
  const b = dsBody('问题', 'deepseek-chat');
  assert.strictEqual(b.model, 'deepseek-flash');
  assert.deepEqual(b.messages, [{ role: 'user', content: '问题' }]);
  assert.deepEqual(b.thinking, { type: 'disabled' });
  assert.deepEqual(b.response_format, { type: 'json_object' });
  assert.ok(!('response_format' in dsBody('问题', 'deepseek-flash', true)));
});
