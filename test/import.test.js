'use strict';
/* 导入前数重复（第四十二次优化）：只数表格自己里面的重复，不和内置词表比。
   跑法：cd sat2300-web && node --test */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { importScan } = require('../pure.js');

const G = [
  { name: 'List 1', rows: [{ w: 'abate', p: '', z: '减弱' }, { w: 'bland', p: '', z: '平淡的' },
                           { w: 'Abate', p: 'əˈbeɪt', z: '减轻' }] },
  { name: 'List 2', rows: [{ w: 'abate', p: '', z: '减弱' }, { w: 'cogent', p: '', z: '有说服力的' }] }
];

test('importScan：行数、不同的词、重复的词分别数对', () => {
  const s = importScan(G, true);
  assert.equal(s.total, 5);
  assert.equal(s.uniq, 3);
  assert.deepEqual(s.dups, [{ w: 'abate', p: 'əˈbeɪt', z: '减弱；减轻', n: 3, in: ['List 1', 'List 2'] }]);
});

test('importScan：默认重复的只留第一次出现的那条，释义并过去，后面的分页去掉', () => {
  const s = importScan(G, true);
  assert.deepEqual(s.groups, [
    { name: 'List 1', dropped: 1, rows: [{ w: 'abate', p: 'əˈbeɪt', z: '减弱；减轻', n: 3 }, { w: 'bland', p: '', z: '平淡的', n: 1 }] },
    { name: 'List 2', dropped: 1, rows: [{ w: 'cogent', p: '', z: '有说服力的', n: 1 }] }
  ]);
});

test('importScan：关掉以后一行一条原样留着，分页全在', () => {
  const s = importScan(G, false);
  assert.deepEqual(s.groups.map(g => g.rows.map(r => r.w + r.n)), [['abate3', 'bland1', 'Abate3'], ['abate3', 'cogent1']]);
  assert.equal(s.uniq, 3);
});

test('importScan：去重后变空的分页不算单元；不改动传进来的行', () => {
  const g = [{ name: 'A', rows: [{ w: 'x', p: '', z: '一' }] }, { name: 'B', rows: [{ w: 'X', p: '', z: '二' }] }];
  const s = importScan(g, true);
  assert.deepEqual(s.groups.map(x => x.name), ['A']);
  assert.equal(g[0].rows[0].z, '一');
});

test('importScan：没有分页名时 in 为空', () => {
  const s = importScan([{ name: null, rows: [{ w: 'a', p: '', z: '甲' }, { w: 'a', p: '', z: '甲' }] }], true);
  assert.deepEqual(s.dups, [{ w: 'a', p: '', z: '甲', n: 2, in: [] }]);
});

test('importScan：释义只差空格算同一条，不重复拼接', () => {
  const s = importScan([{ name: 'A', rows: [{ w: 'cogent', p: '', z: 'adj. 有说服力的' }] },
                        { name: 'B', rows: [{ w: 'cogent', p: '', z: 'adj.有说服力的' }] }], true);
  assert.equal(s.groups[0].rows[0].z, 'adj. 有说服力的');
});
