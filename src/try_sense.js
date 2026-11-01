'use strict';
/* 试 DeepSeek 写的讲透好不好（第三十九次优化）：让它写一遍 data/sense.js 里的词，
   和手写的并排存到上一级目录的 讲透对比.md。只生成对比，不改 data/sense.js。
   Key 从环境变量 DEEPSEEK_API_KEY 读，用法见 README 的「讲透」。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { SENSE_SHOTS, sensePrompt, cleanSense, dsBody } = require('../pure.js');

const KEY = process.env.DEEPSEEK_API_KEY;
if (!KEY) { console.error('没有 DEEPSEEK_API_KEY。'); process.exit(1); }

const OUT = path.join(__dirname, '..', '..', '讲透对比.md');
const AT_ONCE = 4;

const win = {};
const ctx = vm.createContext({ window: win });
['words.js', 'rich.js', 'sense.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'), ctx);
});
const SENSE = win.SAT_SENSE;
const shots = SENSE_SHOTS.map(function (name) { return [name, SENSE[name]]; });

let tokens = 0, retried = 0;
async function ask(prompt, again) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + KEY },
    body: JSON.stringify(dsBody(prompt))
  });
  const j = await res.json();
  if (!res.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + res.status);
  tokens += (j.usage && j.usage.total_tokens) || 0;
  const text = j.choices[0].message.content;
  try {
    return JSON.parse(text);
  } catch (err) {
    if (again) throw new Error(err.message + '\n\n返回的原文：' + text);
    retried++;
    return ask(prompt, true);
  }
}

function block(who, s) {
  return '**' + who + '** ≈ ' + s.a + '\n\n' + s.g + '\n\n' +
    s.n.map(function (x) { return '- ' + x[0] + '：' + x[1]; }).join('\n') + '\n';
}

async function one(word) {
  const w = win.SAT_WORDS.filter(function (x) { return x.w === word; })[0];
  const r = win.SAT_RICH[word] || {};
  let got;
  try {
    const s = cleanSense(await ask(sensePrompt({ w: word, z: r.z || w.z, e: r.e }, shots)), word);
    got = s ? block('DeepSeek', s) : '**DeepSeek** 返回的内容不完整\n';
  } catch (err) {
    got = '**DeepSeek** 失败：' + err.message + '\n';
  }
  console.log(word);
  return '## ' + word + '\n\n释义：' + (r.z || w.z) + '\n\n' + block('手写', SENSE[word]) + '\n' + got;
}

(async function () {
  const words = Object.keys(SENSE), done = [];
  let next = 0;
  async function worker() {
    while (next < words.length) { const n = next++; done[n] = await one(words[n]); }
  }
  await Promise.all(Array.from({ length: AT_ONCE }, worker));
  fs.writeFileSync(OUT, '# 讲透对比：手写和 DeepSeek\n\n共用了 ' + tokens + ' tokens，' + retried + ' 个词返回坏的 JSON 重问了一次。\n\n' + done.join('\n'));
  console.log('写好了：' + OUT + '（' + tokens + ' tokens，重问 ' + retried + ' 次）');
})();
