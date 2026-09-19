'use strict';
/* 从 app.js 拆出来的纯逻辑（第十五次优化 1）：解析词表行、拼表格、去重合并、
   词形变化、挖空定位、拼写差异对齐。这几个都不碰 document/window/localStorage，
   只认输入输出，所以能被 node --test 直接 require 进去测——整个 app.js 拿去
   require 的话，顶层那些 document.getElementById(...) 会立刻炸，因为 Node
   里没有 document。浏览器里还是老样子：<script> 在 app.js 前面引入这个文件，
   全局函数名不变，app.js 里原来怎么调用现在还怎么调用，没改一处调用点。 */

var CJK = /[一-鿿]/;
/* 只收非 ASCII 的音标符号 —— 早先这里混进了一个普通的 e，
   于是「after」这种词也会被当成音标。 */
var IPAC = /[ˈˌːɑɒæəɜɛɪʊʌθðʃʒŋɔ]/;
function cleanWord(s) {
  return String(s).replace(/^\s*\d+[.、)\]]?\s*/, '').replace(/\s+/g, ' ').trim();
}
var POSTAIL = /((?:\b(?:n|v|vt|vi|a|ad|adj|adv|prep|conj|pron|art|num|interj|abbr|phr)\.\s*)+)$/i;
var SEPTAIL = /[\s\-—–:：,，、|]+$/;
/* 一个词条最多几个英文单词 —— 「come to terms with」是 4 个，
   再多就多半是句子而不是词组了（第五次优化 5）。 */
function phraseOk(w) {
  return !!w && /^[A-Za-z]/.test(w) && w.length <= 60 && !CJK.test(w) && w.split(/\s+/).length <= 6;
}
/* 一行文本 → {w,p,z}，认不出就 null。认得这些写法：
   "1. abate /əˈbeɪt/ v.减弱" · "abate  əˈbeɪt  减弱" · "abate — 减弱" · "abate,减弱"
   词组也认（第五次优化 5）："prone to 容易…的" · "come to terms with — 接受" */
function parseLine(line) {
  var s = String(line).replace(/ /g, ' ').trim();
  if (!s || !CJK.test(s)) return null;
  s = s.replace(/^\s*\d+[.、)\]]?\s+/, '');
  /* 先把括号里的音标摘出来，剩下的就只有「英文 … 中文」两段 */
  var p = '', pm = s.match(/[\/\[]\s*([^\/\]]{1,60}?)\s*[\/\]]/);
  if (pm) { p = pm[1].trim(); s = (s.slice(0, pm.index) + ' ' + s.slice(pm.index + pm[0].length)).trim(); }
  /* 英文和中文的分界就是第一个汉字 —— 不能按空格切，否则词组会被砍成第一个单词 */
  var k = s.search(CJK);
  if (k <= 0) return null;
  var w = s.slice(0, k).replace(SEPTAIL, ''), z = s.slice(k).trim();
  var pos = w.match(POSTAIL);                  // 「abate v.」里的 v. 属于释义那边
  if (pos) { z = pos[1].trim() + z; w = w.slice(0, w.length - pos[1].length).replace(SEPTAIL, ''); }
  w = cleanWord(w).replace(SEPTAIL, '');
  if (!p) {                                    // 音标也可能不带括号地夹在中间
    var im = w.match(/^(.*\S)\s+(\S{2,40})$/);
    if (im && IPAC.test(im[2]) && phraseOk(im[1])) { w = im[1]; p = im[2]; }
  }
  if (!phraseOk(w) || !CJK.test(z)) return null;
  return { w: w, p: p.replace(/[\/\[\]]/g, '').trim(), z: z.replace(/^[-—–:：,，\s]+/, '') };
}
var HEAD = /^(word|words|vocab\w*|term|english|spelling|ipa|phonetic\w*|pronunciation|meaning|definition|translation|chinese|no\.?|num\w*|index|序号|编号|单词|词汇|英文|音标|发音|读音|释义|意思|中文|翻译|词性|例句|备注)$/i;
function headerish(row) {
  var hit = 0, seen = 0;
  row.forEach(function (v) {
    v = String(v == null ? '' : v).trim();
    if (!v) return;
    seen++; if (HEAD.test(v)) hit++;
  });
  return seen > 0 && hit >= Math.max(1, Math.ceil(seen / 2));
}
/* a table (array of rows) → rows, by picking the columns that look right */
/* 「I1」「A12」这种编号也是字母开头、也没有汉字，很容易被当成单词列。
   （第五次优化把列判定换成 phraseOk 之后就踩了这个坑：一张
   「序号 | 编号 | 英文词组 | 中文释义 | 分类 | 出现次数」的表，
   编号列和词组列打平，靠左的编号列赢了，导进去全是 I1 I2。） */
var CODEY = /^[A-Za-z]{1,3}[-_ ]?\d+[A-Za-z]?$/;
function wordCell(v) { return phraseOk(v) && !CODEY.test(v) && /[A-Za-z]{2}/.test(v); }
function parseTable(rows) {
  var wide = rows.filter(function (r) { return r && r.length; });
  if (!wide.length) return [];
  var cols = Math.max.apply(null, wide.map(function (r) { return r.length; }));
  var scoreW = [], scoreZ = [], scoreP = [], lenW = [], seenZ = [], nz = [];
  for (var c = 0; c < cols; c++) { scoreW[c] = 0; scoreZ[c] = 0; scoreP[c] = 0; lenW[c] = 0; seenZ[c] = {}; nz[c] = 0; }
  wide.forEach(function (r) {
    for (var c = 0; c < cols; c++) {
      var v = String(r[c] == null ? '' : r[c]).trim();
      if (!v) continue;
      if (CJK.test(v)) {
        scoreZ[c]++;
        if (!seenZ[c][v]) { seenZ[c][v] = 1; nz[c]++; }       // 「分类」列翻来覆去就那几个值
      } else if (wordCell(v)) { scoreW[c]++; lenW[c] += v.length; }
      if (IPAC.test(v) || /^[\/\[].*[\/\]]$/.test(v)) scoreP[c]++;
    }
  });
  /* 数量打平时看第二个指标：单词列比编号列长，释义列比分类列杂 */
  function best(arr, tie, skip) {
    var bi = -1, bv = 0, bt = -1;
    for (var c = 0; c < cols; c++) {
      if (skip.indexOf(c) >= 0) continue;
      var t = tie ? tie[c] : 0;
      if (arr[c] > bv || (arr[c] === bv && bv > 0 && t > bt)) { bv = arr[c]; bt = t; bi = c; }
    }
    return bv >= Math.max(2, wide.length * 0.3) ? bi : -1;
  }
  var cw = best(scoreW, lenW, []), cz = best(scoreZ, nz, [cw]), cp = best(scoreP, null, [cw, cz]);
  if (cw < 0 || cz < 0) {                        // not a real table — fall back to line parsing
    return wide.map(function (r) { return parseLine(r.join(' ')); }).filter(Boolean);
  }
  var out = [];
  wide.forEach(function (r, ri) {
    if (ri === 0 && headerish(r)) return;          // "word | ipa | 释义" is a caption, not a word
    var w = cleanWord(r[cw] == null ? '' : r[cw]);
    var z = String(r[cz] == null ? '' : r[cz]).trim();
    var p = cp >= 0 ? String(r[cp] == null ? '' : r[cp]).replace(/[\/\[\]]/g, '').trim() : '';
    if (!wordCell(w) || !CJK.test(z)) return;
    out.push({ w: w, p: p, z: z });
  });
  return out;
}
/* 同一个词条在原表里出现两次、但释义不一样，是常事 ——
   「at the expense of」既是「以…为代价」也是「牺牲…」。
   以前按单词去重，第二条直接丢掉，结果少了一个意思；
   现在释义不同就并成一条（用「；」隔开），完全一样才算重复。（第八次优化 2） */
function mergeRows(rows) {
  var at = {}, out = [], merged = 0;
  rows.forEach(function (r) {
    var k = r.w.toLowerCase(), had = at[k];
    if (!had) { at[k] = r; out.push(r); return; }
    var zs = had.z.split(/[；;]/).map(function (x) { return x.trim(); });
    if (zs.indexOf(r.z.trim()) < 0) { had.z = had.z + '；' + r.z; merged++; }
    if (!had.p && r.p) had.p = r.p;
  });
  return { rows: out, merged: merged };
}

/* Match the headword and its usual inflections: a long word is safe to match by
   prefix, a short one is not ("bully" as a prefix would also catch "bullet"). */
function wordPat(word) {
  var w = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (w.length > 6) return w.slice(0, w.length - 3) + "[a-z']*";
  if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + '(?:y|ies|ied|ier|iest|ying)';
  if (/e$/.test(w)) return w.slice(0, -1) + '(?:e|es|ed|ing)';
  if (w.length >= 5) return w + "[a-z']*";
  return w + '(?:s|es|ed|ing|ly)?';
}
/* 在别人写的一整段话里找词，不能用 bold() 那套宽松前缀匹配 ——
   wordPat('commend') 会切成 comm[a-z]*，把「committee」也算上；
   concise 撞 conceded、distort 撞 district、imposing 撞 imposed。
   这里改成「词本身 + 常规屈折变化」，而且**词尾也要卡边界**。 */
var PAT_CACHE = {};
function inflectRe(w) {
  var b = String(w).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var alts = [b];
  if (/[^aeiou]y$/.test(b)) alts.push(b.slice(0, -1) + 'i(?:es|ed|er|est|ly|ness)');
  if (/e$/.test(b)) alts.push(b.slice(0, -1) + '(?:es|ed|ing|er|est|ion|ions)');
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(b)) alts.push(b + b.charAt(b.length - 1) + '(?:ed|ing|er|est)');
  alts.push(b + "(?:s|es|ed|ing|d|r|st|ly|ness|'s)?");
  return new RegExp('\\b(?:' + alts.join('|') + ')\\b', 'i');
}
function wordRe(w) {
  var r = PAT_CACHE[w];
  if (!r) { try { r = PAT_CACHE[w] = inflectRe(w); } catch (e) { r = PAT_CACHE[w] = /$^/; } }
  return r;
}
/* 例句填空题：把例句里的生词挖掉（第五次优化 6）。
   先用严格的变形式（两头都卡词界）找 —— wordPat('commend') 是 comm[a-z']* 那种前缀写法，
   直接拿它挖空会把句子里的 committee 挖掉，题就废了。
   严格式找不着再退回前缀式，接住 abate → abatement 这类派生词。 */
function blankAt(sent, word) {
  var m = String(sent).match(wordRe(word));
  if (m) return m;
  return String(sent).match(new RegExp('\\b(' + wordPat(word) + ')', 'i'));
}

/* 逐字符对齐（最长公共子序列），差在哪个字母上一眼能看见 ——
   按位置死比的话，少打一个字母后面全算错，看着像整个词都写错了。 */
function lcsMark(a, b) {
  var n = a.length, m = b.length, d = [], i, j;
  for (i = 0; i <= n; i++) { d.push([]); for (j = 0; j <= m; j++) d[i].push(0); }
  for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) {
    d[i][j] = a.charAt(i).toLowerCase() === b.charAt(j).toLowerCase()
      ? d[i + 1][j + 1] + 1 : Math.max(d[i + 1][j], d[i][j + 1]);
  }
  var A = [], B = [];
  i = 0; j = 0;
  while (i < n && j < m) {
    if (a.charAt(i).toLowerCase() === b.charAt(j).toLowerCase()) {
      A.push([a.charAt(i), 1]); B.push([b.charAt(j), 1]); i++; j++;
    } else if (d[i + 1][j] >= d[i][j + 1]) { A.push([a.charAt(i), 0]); i++; }
    else { B.push([b.charAt(j), 0]); j++; }
  }
  while (i < n) { A.push([a.charAt(i), 0]); i++; }
  while (j < m) { B.push([b.charAt(j), 0]); j++; }
  return { a: A, b: B };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseLine: parseLine, parseTable: parseTable, mergeRows: mergeRows,
    lcsMark: lcsMark, blankAt: blankAt,
    wordPat: wordPat, inflectRe: inflectRe, wordRe: wordRe,
    phraseOk: phraseOk, cleanWord: cleanWord, headerish: headerish, wordCell: wordCell
  };
}
