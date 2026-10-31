/* 发音表（第二十八次优化）：data/pron.js 是生成的，这里卡住地址规则和几类不能错的词。 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pronUrl, pronList, phraseClips, pronGuesses, audioSrcName } = require('../pure.js');

const ROOT = path.join(__dirname, '..');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data/pron.js'), 'utf8'), ctx);
const PRON = ctx.window.PRON;
const scan = fs.readFileSync(path.join(ROOT, 'src/oxscan.jsonl'), 'utf8').trim().split('\n').map(function (l) { return JSON.parse(l); });

test('表里每个录音地址都还原得回抓到的地址', function () {
  const known = new Set();
  scan.forEach(function (r) {
    r.e.forEach(function (e) {
      ['gb', 'us'].forEach(function (k) {
        if (!e[k]) return;
        if (e.camb) known.add('https://dictionary.cambridge.org/us/media/english/' + e[k]);
        else if (e.ld) known.add('https://www.ldoceonline.com/media/english/' + e[k]);
        else if (e.wk) known.add('https://yanaoliu-jpg.github.io/sat2389/data/audio/' + e[k]);
        else known.add('https://www.oxfordlearnersdictionaries.com/media/english/' + e[k]);
      });
    });
  });
  let n = 0;
  Object.keys(PRON.w).forEach(function (w) {
    PRON.w[w].forEach(function (r) {
      if (r[1]) { assert.ok(known.has(pronUrl(w, r[1], true)), w + ' 英音 ' + pronUrl(w, r[1], true)); n++; }
      if (r[3]) { assert.ok(known.has(pronUrl(w, r[3], false)), w + ' 美音 ' + pronUrl(w, r[3], false)); n++; }
    });
  });
  assert.ok(n > 10000);
});

test('放进仓库的录音文件都在', function () {
  Object.keys(PRON.w).forEach(function (w) {
    PRON.w[w].forEach(function (r) {
      [r[1], r[3]].forEach(function (c) {
        if (c && c.charAt(0) === '@') assert.ok(fs.existsSync(path.join(ROOT, 'data/audio', c.slice(1) + '.mp3')), c);
      });
    });
  });
});

test('用户报错的 amateurish：重音在第一个音节', function () {
  assert.strictEqual(pronList(PRON, 'amateurish', false)[0].ipa, 'ˈæmətərɪʃ');
  assert.match(pronList(PRON, 'amateurish', false)[0].url, /amateurish__us_1\.mp3$/);
});

test('多音词按词性分开', function () {
  const a = pronList(PRON, 'abstract', false);
  assert.strictEqual(a.length, 2);
  assert.strictEqual(a[0].pos, 'adj./n.');
  assert.strictEqual(a[1].ipa, 'æbˈstrækt');
});

test('英美读音不同的词不会张冠李戴', function () {
  assert.ok(pronList(PRON, 'aluminum', false)[0].ipa.indexOf('luː') > 0);        // 不是 aluminium
  assert.ok(pronList(PRON, 'schedule', true).length && pronList(PRON, 'schedule', false).length);
  assert.notStrictEqual(pronList(PRON, 'merger', true)[0].ipa, pronList(PRON, 'merger', false)[0].ipa);
});

test('表里没有的词返回空，constructor 这种键名不出错', function () {
  assert.deepStrictEqual(pronList(PRON, 'zzzznotaword', false), []);
  assert.deepStrictEqual(pronList({ d: [0, 0], w: {} }, 'constructor', false), []);
  assert.deepStrictEqual(pronList(undefined, 'abate', false), []);
});

test('短语拆成单词的录音，多音词和冠词留给有道', function () {
  const c = phraseClips(PRON, 'cultural exchange', false);
  assert.strictEqual(c.length, 2);
  assert.match(c[0].url, /cultural__us_1/);        // cultural 不在词表里，照地址规律算
  assert.ok(phraseClips(PRON, 'pristine hindsight', false).every(function (p) { return p.ipa; }));
  assert.strictEqual(phraseClips(PRON, 'land use', false), null);         // use 名词动词读音不同
  assert.strictEqual(phraseClips(PRON, 'make a case for', false), null);  // 含冠词
  assert.strictEqual(phraseClips(PRON, 'serendipity', false), null);      // 单词不走这里
  assert.strictEqual(phraseClips(PRON, 'one two three four five six seven', false), null);
});

const OX = 'https://www.oxfordlearnersdictionaries.com/media/english/';
test('牛津给 con / aux / nul 开头的文件名多加一个 x', function () {
  assert.strictEqual(pronUrl('concept', '1', false), OX + 'us_pron/x/xco/xconc/xconcept__us_1.mp3');
  assert.strictEqual(pronUrl('auxiliary', '1', true), OX + 'uk_pron/x/xau/xauxi/xauxiliary__gb_1.mp3');
  assert.strictEqual(pronUrl('nullify', '1', false), OX + 'us_pron/x/xnu/xnull/xnullify__us_1.mp3');
  assert.strictEqual(pronUrl('coffee', '1', false), OX + 'us_pron/c/cof/coffe/coffee__us_1.mp3');
});
test('设置里按实际地址说出是哪一家的录音', function () {
  assert.strictEqual(audioSrcName(pronUrl('coffee', '1', false)), '牛津真人录音');
  assert.strictEqual(audioSrcName(pronUrl('x', '~uk/x', false)), '剑桥真人录音');
  assert.strictEqual(audioSrcName(pronUrl('x', '^ameProns/x', false)), '朗文真人录音');
  assert.strictEqual(audioSrcName(pronUrl('x', '@x-us', false)), '维基词典真人录音');
  assert.strictEqual(audioSrcName('https://dict.youdao.com/dictvoice?type=2&audio=x'), '有道（部分词是机器合成）');
});
test('新词的地址按规律一个个试，先试最常见的', function () {
  const us = pronGuesses('kettle', false);
  assert.strictEqual(us[0], OX + 'us_pron/k/ket/kettl/kettle__us_1.mp3');
  assert.ok(us.includes(OX + 'us_pron/k/ket/kettl/kettle__us_1_rr.mp3'));
  assert.ok(us.includes(OX + 'us_pron/k/ket/kettl/kettle__us_2.mp3'));
  assert.strictEqual(new Set(us).size, us.length);
  assert.strictEqual(pronGuesses('far-fetched', true)[0], OX + 'uk_pron/f/far/far_f/far_fetched_1_gb_1.mp3');
});
