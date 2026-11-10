'use strict';
/* 从 app.js 拆出来的纯逻辑（第十五次优化 1）：解析词表行、拼表格、去重合并、
   词形变化、挖空定位、拼写差异对齐（第二十次优化又加了自建词的编号分配和老数据换号）。
   这几个都不碰 document/window/localStorage，
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
    /* 「adj. 平淡的」和「adj.平淡的」是同一条，比的时候不看空格 */
    var bare = function (x) { return x.replace(/\s+/g, ''); };
    var zs = had.z.split(/[；;]/).map(bare);
    if (zs.indexOf(bare(r.z)) < 0) { had.z = had.z + '；' + r.z; merged++; }
    if (!had.p && r.p) had.p = r.p;
  });
  return { rows: out, merged: merged };
}
/* 导入前数一数表格自己里面的重复（第四十二次优化）：groups 是各分页认出来的原始行 [{name, rows}]。
   once（默认）：重复的词整张表只留第一次出现的那条，后面的释义按 mergeRows 的规矩并过去，
   不管在不在同一个分页；关掉就一行一条原样导入。每行带 n = 这个词在整张表里出现了几行，
   dups 是出现不止一次的词（释义已并好，in 是出现过的分页名），给「重复的」那一栏看。 */
function importScan(groups, once) {
  var cnt = {}, where = {}, total = 0;
  groups.forEach(function (g) {
    g.rows.forEach(function (r) {
      var k = r.w.toLowerCase();
      cnt[k] = (cnt[k] || 0) + 1; total++;
      where[k] = where[k] || [];
      if (g.name != null && where[k].indexOf(g.name) < 0) where[k].push(g.name);
    });
  });
  var all = mergeRows(groups.reduce(function (a, g) {
    return a.concat(g.rows.map(function (r) { return { w: r.w, p: r.p, z: r.z }; }));
  }, [])).rows;
  var first = {};
  all.forEach(function (r) { first[r.w.toLowerCase()] = r; });
  var taken = {};
  var out = groups.map(function (g) {
    var rows = [], dropped = 0;
    g.rows.forEach(function (r) {
      var k = r.w.toLowerCase();
      if (!once) { rows.push({ w: r.w, p: r.p, z: r.z, n: cnt[k] }); return; }
      if (taken[k]) { dropped++; return; }
      taken[k] = 1;
      var m = first[k];
      rows.push({ w: m.w, p: m.p, z: m.z, n: cnt[k] });
    });
    return { name: g.name, rows: rows, dropped: dropped };
  }).filter(function (g) { return g.rows.length; });
  var dups = all.filter(function (r) { return cnt[r.w.toLowerCase()] > 1; }).map(function (r) {
    var k = r.w.toLowerCase();
    return { w: r.w, p: r.p, z: r.z, n: cnt[k], in: where[k] };
  });
  return { groups: out, total: total, uniq: all.length, dups: dups };
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
/* 不规则变化（第四十七次优化）：雅思词根联想那本书的例句里有 sought、hidden、crept、knelt、resat、swung 这些，
   规则变化和前缀都接不住，填空题就挖不出来。只收真用得上的常见动词，都是整词匹配（两头卡词界）。 */
var IRREG = {
  seek: 'sought', hide: 'hid|hidden', creep: 'crept', stick: 'stuck', kneel: 'knelt', sit: 'sat', resit: 'resat',
  swing: 'swung', sting: 'stung', cling: 'clung', fling: 'flung', spring: 'sprang|sprung', sink: 'sank|sunk',
  shrink: 'shrank|shrunk', stink: 'stank|stunk', weep: 'wept', sweep: 'swept', sleep: 'slept', leap: 'leapt',
  bend: 'bent', lend: 'lent', spend: 'spent', bind: 'bound', grind: 'ground', wind: 'wound', seize: 'seized',
  weave: 'wove|woven', tread: 'trod|trodden', forbid: 'forbade|forbidden', forsake: 'forsook|forsaken',
  forgive: 'forgave|forgiven', foresee: 'foresaw|foreseen', withdraw: 'withdrew|withdrawn',
  withhold: 'withheld', withstand: 'withstood', undertake: 'undertook|undertaken', overtake: 'overtook|overtaken',
  overcome: 'overcame', override: 'overrode|overridden', oversee: 'oversaw|overseen', undergo: 'underwent|undergone',
  arise: 'arose|arisen', strive: 'strove|striven', stride: 'strode|stridden', strike: 'struck|stricken',
  shake: 'shook|shaken', swear: 'swore|sworn', tear: 'tore|torn', bear: 'bore|borne|born', wear: 'wore|worn',
  freeze: 'froze|frozen', steal: 'stole|stolen', breed: 'bred', flee: 'fled', feed: 'fed', bleed: 'bled',
  dwell: 'dwelt', spill: 'spilt', spoil: 'spoilt', burn: 'burnt', dig: 'dug', hang: 'hung', shine: 'shone',
  shoot: 'shot', slide: 'slid', fight: 'fought', catch: 'caught', teach: 'taught', buy: 'bought', bring: 'brought',
  think: 'thought', lay: 'laid', lie: 'lay|lain', rise: 'rose|risen', ride: 'rode|ridden', drive: 'drove|driven',
  write: 'wrote|written', hold: 'held', choose: 'chose|chosen', speak: 'spoke|spoken', break: 'broke|broken',
  wake: 'woke|woken', fall: 'fell|fallen', grow: 'grew|grown', throw: 'threw|thrown', blow: 'blew|blown',
  draw: 'drew|drawn', fly: 'flew|flown', swim: 'swam|swum', sing: 'sang|sung', ring: 'rang|rung',
  drink: 'drank|drunk', begin: 'began|begun', forget: 'forgot|forgotten', hit: 'hit', cast: 'cast',
  mislead: 'misled', mistake: 'mistook|mistaken', misunderstand: 'misunderstood', understand: 'understood',
  uphold: 'upheld', upset: 'upset', beat: 'beaten', bite: 'bit|bitten', hew: 'hewn', sew: 'sewn', sow: 'sown',
  swell: 'swollen', mow: 'mown', prove: 'proven', saw: 'sawn'
};
function inflectRe(w) {
  var b = String(w).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var alts = [b];
  if (Object.prototype.hasOwnProperty.call(IRREG, b)) alts.push(IRREG[b]);
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

/* ===== 自建词的编号（第二十次优化）=====
   自己导入／手动加的词，编号都从 CUSTOM_ID_FLOOR 往上排。内置词表占的编号 ——
   SAT 1–2538、托福 5001–9249、雅思 10001–10639 —— 都远在它下面；以后再加内置词表，
   编号也别用到它（test/customid.test.js 会卡这一条）。
   原来的下限是 10000，雅思词一来就撞了号：进度、星标、颜色都是按编号存的，
   撞号的两个词于是共用了同一份记录。 */
var CUSTOM_ID_FLOOR = 100000;

/* 下一个能给自建词用的编号：不低于下限，也比 words 里现有的任何编号都大。
   导入和手动添加都从这里取，编号规则只在这一处改。 */
function nextCustomId(words) {
  var n = CUSTOM_ID_FLOOR;
  words.forEach(function (w) { if (w.i >= n) n = w.i + 1; });
  return n;
}

/* 一次性修老数据：2026-09-26 之前存下来的自建词，编号可能落在雅思词的 10001–10639 里，
   跟雅思词共用着同一份进度。把撞号的自建词换到下限之上的新编号，那份共用的记录整份
   跟着自建词走，雅思词那边回到「未学」—— 这个编号是自建词先占着的，雅思词是后来才到。
   两个词从 9-26 起一直往同一个键里写，那份记录早已拆不开，只能挑一边留。
   st 是 store 里的 { custom, prog, hist, sel, star, col }，builtinWords 是内置词表。
   不改传进来的东西，返回 { moved: 换了几个词, custom, prog, hist, sel, star, col }；
   对结果再跑一遍，moved 是 0、什么都不变。 */
function renumberCollidingCustom(st, builtinWords) {
  function copy(o) { var c = {}; for (var k in o) c[k] = o[k]; return c; }
  var taken = {}, all = builtinWords.slice();
  builtinWords.forEach(function (w) { taken[w.i] = 1; });
  st.custom.forEach(function (c) { all = all.concat(c.words); });
  var next = nextCustomId(all), moved = {}, n = 0;
  var out = {
    custom: st.custom.map(function (c) {
      var nc = copy(c);
      nc.words = c.words.map(function (w) {
        if (!taken[w.i]) return w;
        var nw = copy(w);
        nw.i = next++; n++;
        moved[w.i] = nw.i;
        return nw;
      });
      return nc;
    })
  };
  out.moved = n;
  ['prog', 'hist', 'sel', 'star', 'col'].forEach(function (t) {    // 全是按词条编号存的
    var tab = copy(st[t]);
    for (var old in moved) if (old in tab) { tab[moved[old]] = tab[old]; delete tab[old]; }
    out[t] = tab;
  });
  return out;
}

/* 拆单元（第四十四次优化）：一张导入的表前面是单词、后面是短语（词组、搭配），拆成两个单元背。
   带空格的就是短语。phraseStart 只认「前面全是单词、后面全是短语」这一种排法，返回第一个短语的下标，
   不是这种排法（没有短语、全是短语、中间夹着）返回 -1。 */
function isPhrase(w) { return /\s/.test(String(w).trim()); }
function phraseStart(words) {
  var k = -1, j;
  for (j = 0; j < words.length; j++) if (isPhrase(words[j].w)) { k = j; break; }
  if (k <= 0) return -1;
  for (j = k; j < words.length; j++) if (!isPhrase(words[j].w)) return -1;
  return k;
}
/* 把 custom 里单元 u 从第 at 个词（下标）起拆开：前一半留在原单元、改名 t1，
   后一半成新单元 newU、名字 t2，紧跟在原单元后面（首页按这个顺序摆）。
   词条编号 i 不变 —— 进度、星标、颜色、选中都按 i 存，所以全都跟着词走，不用搬。
   不改传进来的东西；找不到 u 或 at 不在 1..n-1 之间，原样返回一份拷贝。 */
function splitCustomUnit(custom, u, at, t1, t2, newU) {
  var out = [];
  custom.forEach(function (c) {
    if (c.u !== u || !(at > 0 && at < c.words.length)) { out.push(c); return; }
    var a = {}, b = {};
    for (var k in c) { a[k] = c[k]; b[k] = c[k]; }
    a.t = t1; a.words = c.words.slice(0, at);
    b.u = newU; b.t = t2;
    delete b.manual;
    b.words = c.words.slice(at).map(function (w) {
      var nw = {};
      for (var q in w) nw[q] = w[q];
      nw.u = newU;
      return nw;
    });
    out.push(a, b);
  });
  return out;
}

/* 牛津发音表（第二十八次优化，data/pron.js，src/build_pron.py 生成）：
   table = { d: [英音默认压几 dB, 美音默认压几 dB], w: { 词: [[词性, 英音录音, 英音音标, 美音录音, 美音音标, 英音压几 dB, 美音压几 dB], …] } }
   录音写成尾号（"1" = 词__gb_1）省地址里重复的词，写不成尾号的才写文件名，目录能从文件名推出来；
   ~ 开头是剑桥的录音、^ 开头是朗文的，后面是完整路径；@ 开头是放在 data/audio/ 里的维基词典录音。
   美音音标留空 = 跟英音一样；两个 dB 省略 = 用默认。
   返回这个口音下的读音列表：音标一样的条目并成一个，词性合写（abstract 的 a./n.）。 */
var OX_MEDIA = 'https://www.oxfordlearnersdictionaries.com/media/english/';
var CAM_MEDIA = 'https://dictionary.cambridge.org/us/media/english/';
var LD_MEDIA = 'https://www.ldoceonline.com/media/english/';
var OWN_MEDIA = 'https://yanaoliu-jpg.github.io/sat2389/data/audio/';
function pronUrl(word, clip, gb) {
  if (clip.charAt(0) === '~') return CAM_MEDIA + clip.slice(1) + '.mp3';   // 牛津没收的词用剑桥的录音
  if (clip.charAt(0) === '^') return LD_MEDIA + clip.slice(1) + '.mp3';    // 再没有就用朗文的
  if (clip.charAt(0) === '@') return OWN_MEDIA + clip.slice(1) + '.mp3';    // 维基词典的录音放在自己仓库里，写全地址，单文件版也能取到
  var dir = gb ? 'uk_pron' : 'us_pron';
  if (clip.indexOf('/') >= 0) return OX_MEDIA + dir + '/' + clip + '.mp3';
  var stem = /^\d/.test(clip)
    ? word.toLowerCase().replace(/[ -]/g, '_') + '__' + (gb ? 'gb' : 'us') + '_' + clip
    : clip;
  if (/^(con|aux|nul|prn)/.test(stem)) stem = 'x' + stem;   // 这几个开头是 Windows 的保留名，牛津的文件名前面多一个 x
  return OX_MEDIA + dir + '/' + stem.charAt(0) + '/' + stem.slice(0, 3) + '/' + stem.slice(0, 5) + '/' + stem + '.mp3';
}
/* 设置里「现在用的音频」按实际播放的地址说是哪一家（第三十六次优化） */
function audioSrcName(url) {
  var u = String(url);
  if (u.indexOf(OX_MEDIA) === 0) return '牛津真人录音';
  if (u.indexOf(CAM_MEDIA) === 0) return '剑桥真人录音';
  if (u.indexOf(LD_MEDIA) === 0) return '朗文真人录音';
  if (u.indexOf(OWN_MEDIA) === 0) return '维基词典真人录音';
  if (u.indexOf('dict.youdao.com') >= 0) return '有道（部分词是机器合成）';
  return '其他录音';
}
/* 新词没有现成地址，按牛津的命名规律一个个试（第三十次优化）：有些词要到 _2 或 _1_rr 才有这个口音的录音，
   带连字符的词文件名是 far_fetched_1_us_1，不是双下划线 */
function pronGuesses(word, gb) {
  var out = ['1', '1_rr', '2', '2_rr', '3', '4'].map(function (c) { return pronUrl(word, c, gb); });
  if (word.indexOf('-') >= 0)
    out.unshift(pronUrl(word, word.toLowerCase().replace(/-/g, '_') + '_1_' + (gb ? 'gb' : 'us') + '_1', gb));
  return out;
}
function pronList(table, word, gb) {
  if (!table || !Object.prototype.hasOwnProperty.call(table.w, word)) return [];
  var out = [], at = {}, side = gb ? 0 : 1;
  table.w[word].forEach(function (r) {
    var ipa = gb ? r[2] : (r[4] || r[2]), clip = gb ? r[1] : r[3], other = false;
    if (!clip) { clip = gb ? r[3] : r[1]; other = true; }     // 这个口音没录，先用另一个口音的真人录音
    if (!clip) return;
    if (at[ipa] !== undefined) {
      var hit = out[at[ipa]];
      if (r[0] && hit.pos.split('/').indexOf(r[0]) < 0) hit.pos += (hit.pos ? '/' : '') + r[0];
      return;
    }
    var cut = r[5 + side];
    if (cut === undefined || cut === null) cut = table.d[side];
    at[ipa] = out.length;
    out.push({ pos: r[0], ipa: ipa, url: pronUrl(word, clip, other ? !gb : gb), gain: Math.pow(10, -cut / 20) });
  });
  return out;
}

/* 短语（第二十八次优化）：词典没收的短语拆成单词，一个接一个放真人录音。返回每个词的录音，拼不了就返回 null：
   含多音词的（land use 的 use）分不清读哪个；含 a / an / the 的，单念是强读，放在句子里听着不对。
   这两种留给有道整句读。发音表里没有的词照牛津的地址规律算一个，取不到时 app.js 会退回有道。
   HETERO 是不在发音表里、看不出有两个读音的常见词。 */
var HETERO = /^(use|uses|close|live|lives|read|lead|wind|tear|bow|row|sow|object|present|record|produce|project|refuse|content|contest|desert|house|abuse|excuse|increase|decrease|permit|rebel|conduct|contrast|import|export|insult|progress|protest|subject|survey|suspect|minute|bass|dove|wound|does|invalid|perfect|entrance|attribute|contract|convict|digest|extract|frequent|impact|incline|torment|upset|separate|estimate|graduate|moderate|alternate|appropriate|associate|duplicate|transport|combat|compact|conflict|discount|escort|exploit|ferment|finance|perfume|recall|reject|research|segment|transfer)$/i;
function phraseClips(table, text, gb) {
  if (!table) return null;
  var ws = String(text).trim().split(/\s+/), out = [];
  if (ws.length < 2 || ws.length > 6) return null;
  for (var i = 0; i < ws.length; i++) {
    var w = ws[i];
    if (!/^[A-Za-z][A-Za-z'-]*$/.test(w) || /^(a|an|the)$/i.test(w)) return null;
    var l = pronList(table, w, gb);
    if (!l.length) l = pronList(table, w.toLowerCase(), gb);
    if (l.length > 1 || (!l.length && HETERO.test(w))) return null;
    out.push(l[0] || { pos: '', ipa: '', url: pronUrl(w, '1', gb), gain: Math.pow(10, -table.d[gb ? 0 : 1] / 20) });
  }
  return out;
}

/* 一批词的指纹（第三十二次优化）：只看有哪些词，不看顺序。
   测验、拼写做到一半退出去再回来时靠它发现题库变没变；浏览页换个排序不算变。 */
function poolSig(pool) {
  return pool.map(function (w) { return w.i; }).sort(function (a, b) { return a - b; }).join(',');
}

/* 这道题出成填空吗（第三十七次优化）：kind 'cloze' 只考填空，'mean' 只考释义，其它按混合，一半一半。
   没有挖得出空的例句就只能出释义题，「只考填空」也一样，不然这个词就考不到了。 */
function wantCloze(kind, hasCand, r) {
  if (!hasCand) return false;
  return kind === 'cloze' ? true : kind === 'mean' ? false : r < 0.5;
}

/* 答错的词隔 4 题再考一次（第三十八次优化）。混合时换成另一种题型，换个角度再想一遍；
   只考一种就不换，那是自己选的。 */
var AGAIN_GAP = 4;
function againCloze(kind, wasCloze, hasCand) {
  if (!hasCand) return false;
  return kind === 'cloze' ? true : kind === 'mean' ? false : !wasCloze;
}
function againAt(at, len) { return Math.min(at + 1 + AGAIN_GAP, len); }

/* 讲透里的近义词（第三十九次优化）：认识的排前面，新词挂在会的词上才记得住 */
function nearOrder(near, known) {
  return near.filter(function (x) { return known(x[0]); })
    .concat(near.filter(function (x) { return !known(x[0]); }));
}

/* 没有内置讲透的词，点按钮才问 DeepSeek（第三十九次优化）。
   SENSE_SHOTS 是当范例的手写词，app.js 和 src/try_sense.js 共用这份提示词。 */
var SENSE_SHOTS = ['mitigate', 'terse', 'sanguine'];
function sensePrompt(w, shots) {
  var examples = shots.filter(function (x) { return x[0] !== w.w; }).map(function (x) {
    return JSON.stringify({ word: x[0], g: x[1].g, a: x[1].a, n: x[1].n });
  });
  return '你在给准备 SAT 的中国学生讲一个英文单词。学生看了中文释义和例句，还是不明白这个词到底什么感觉，你要讲到他明白。\n\n' +
    '单词：' + w.w + '\n词典释义：' + w.z + '\n' + (w.e ? '例句：' + w.e + '\n' : '') +
    '\n词典释义可能列了很多义项，以' + (w.e ? '例句里用的义项' : '这个词现在最常用的义项') + '为准，别的义项不用提。\n' +
    (w.e ? '例句只用来判断是哪个义项。你讲的是这个词，不是这句话：不要复述例句的情节，不要用例句里的人和事，例句里形容这个词的话也不算它的意思。\n' : '') +
    '\n写三样：\n' +
    '- g：大白话，60 字以内。说清这个词描述什么情形、带什么感觉、在各种文章里常用来说什么。要写出它独有的地方，换成近义词就说不通。不要重复词典释义，不要写「指……」这种词典腔。\n' +
    '- a：学生已经会的简单英文说法，1 到 3 个常见词，词性和用法要和这个词一样，比如「使变糟」要写 make worse，不写 get worse。不能是这个词本身，也不能比它难。\n' +
    '- n：1 到 2 个最容易和它混淆的词，格式是 [词, 区别, 中文意思]。不能是这个词的变形。区别 40 字以内，要说清怎么选，不要只说「意思相近」。中文意思 8 字以内，是那个词最常用的意思。确实没有容易混淆的词就给空数组。\n' +
    '\n拿不准的用法和搭配不要写，不要编造。文字里不要用英文双引号，要引用就用「」。\n' +
    '\n范例：\n' + examples.join('\n') + '\n' +
    '\n只返回 JSON：{"g": "大白话", "a": "简单说法", "n": [["词", "区别", "中文意思"]]}';
}
/* 模型的返回不一定规整：缺大白话或简单说法算失败，近义词里的坏条目只去掉，不算失败 */
function cleanSense(o, word) {
  function str(x) { return typeof x === 'string' ? x.trim() : ''; }
  function stem(x) {
    return String(x).toLowerCase().replace(/(ing|ed|es|s|d)$/, '').replace(/e$/, '')
      .replace(/([^aeiou])\1$/, '$1').replace(/i$/, 'y');
  }
  if (!o) return null;
  var g = str(o.g), a = str(o.a), key = stem(word);
  if (!g || !a || stem(a) === key) return null;
  var n = (Array.isArray(o.n) ? o.n : []).map(function (x) {
    return Array.isArray(x) ? [str(x[0]), str(x[1]), str(x[2])] : ['', '', ''];
  }).filter(function (x) { return x[0] && x[1] && stem(x[0]) !== key; }).map(function (x) {
    return x[2] ? x : x.slice(0, 2);
  });
  return { g: g, a: a, n: n.slice(0, 3) };
}

/* DeepSeek 官方把 deepseek-chat、deepseek-reasoner 列为停用，存过这两个名字的设置换成新的 */
function dsModel(m) {
  return !m || /^deepseek-(chat|reasoner)$/.test(m) ? 'deepseek-flash' : m;
}
/* 新模型默认开思考模式，这里不需要，关掉才和原来的 deepseek-chat 一样快，1500 也够用 */
function dsBody(prompt, model, plain) {
  var body = {
    model: dsModel(model),
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500,
    thinking: { type: 'disabled' }
  };
  if (!plain) body.response_format = { type: 'json_object' };
  return body;
}

/* ---------- 批量删词（第五十次优化） ----------
   单元的单词列表里勾一批词，一次删掉。词分两种，处理不一样：
     · 自己导入／手动加的词（store.custom 里的）：真删 —— 从单元里拿掉，进度、曾错过、生词本、颜色、
       选中一起删；拼写在别处再没有同名词条时，自己生成的例句（gen）和讲透（sense）也删。
       单元删空了就连单元一起删，分组里也拿掉它。
     · 内置书的词（data/*.js 里的）：删不掉源数据，改成「藏起来」—— 编号记进 store.hide，
       从所有出现它的单元（原书单元、引用同一词条的乱序单元）、搜索、生词本、统计里一起消失；
       它的进度、曾错过、星标、颜色收进 store.hide[i] 里跟着它，活的记录表里不留野记录，
       随时能在单元页「恢复隐藏的词」放回来，记录原样回来。
   deleteWords 返回一份快照，undoDelete 拿它把刚才这一下整个撤回（含选中状态）。
   这几个函数会直接改传进来的 store（跟 app.js 里别的写法一致），快照里存的是拿走的原对象。 */
var WORD_RECS = [['prog', 'p'], ['hist', 'h'], ['star', 's'], ['col', 'c']];
function hasOwn(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
function anyKey(o) { for (var k in o) if (hasOwn(o, k)) return true; return false; }
/* 内置词表去掉藏起来的词；受影响的单元重算词数和首尾词（n/a/b），其余单元原样 */
function applyHidden(words, units, hide) {
  if (!anyKey(hide)) return { words: words.slice(), units: units.slice() };
  var keep = [], at = {}, byU = {}, touched = {};
  words.forEach(function (w) {
    if (hasOwn(hide, w.i)) { touched[w.u] = 1; return; }
    keep.push(w); at[w.i] = w; (byU[w.u] = byU[w.u] || []).push(w);
  });
  var out = units.map(function (x) {
    var ws;
    if (x.ids) {
      if (!x.ids.some(function (i) { return hasOwn(hide, i); })) return x;
      ws = x.ids.map(function (i) { return at[i]; }).filter(Boolean);
    } else {
      if (!touched[x.u]) return x;
      ws = byU[x.u] || [];
    }
    var y = {};
    for (var k in x) y[k] = x[k];
    y.n = ws.length; y.a = ws.length ? ws[0].w : ''; y.b = ws.length ? ws[ws.length - 1].w : '';
    return y;
  });
  return { words: keep, units: out };
}
/* 这个单元里藏起来的内置词，按单元自己的顺序 */
function hiddenIn(unit, words, hide) {
  if (!unit || !anyKey(hide)) return [];
  if (unit.ids) {
    var at = {};
    words.forEach(function (w) { at[w.i] = w; });
    return unit.ids.filter(function (i) { return hasOwn(hide, i); })
      .map(function (i) { return at[i]; }).filter(Boolean);
  }
  return words.filter(function (w) { return w.u === unit.u && hasOwn(hide, w.i); });
}
function takeRecs(store, i) {             // 把一个编号的四份记录拿出来（活的表里删掉）
  var r = {};
  WORD_RECS.forEach(function (t) {
    var m = store[t[0]];
    if (hasOwn(m, i)) { r[t[1]] = m[i]; delete m[i]; }
  });
  return r;
}
function putRecs(store, i, r) {           // 放回去；表里已经有的（撤回前又标过）不覆盖
  WORD_RECS.forEach(function (t) {
    if (!hasOwn(r, t[1])) return;
    if (!store[t[0]]) store[t[0]] = {};
    if (!hasOwn(store[t[0]], i)) store[t[0]][i] = r[t[1]];
  });
}
function liveSpellings(store, builtin) {
  var s = {};
  builtin.forEach(function (w) { if (!hasOwn(store.hide, w.i)) s[w.w] = 1; });
  (store.custom || []).forEach(function (c) { c.words.forEach(function (w) { s[w.w] = 1; }); });
  return s;
}
/* ids：要删的编号；builtin：完整的内置词表（window.SAT_WORDS）。返回快照，n 是真的删／藏了几个 */
function deleteWords(store, ids, builtin) {
  if (!store.hide) store.hide = {};
  ['prog', 'hist', 'star', 'col', 'sel', 'gen', 'sense'].forEach(function (k) { if (!store[k]) store[k] = {}; });
  var want = {};
  ids.forEach(function (i) { want[i] = 1; });
  var snap = { n: 0, hid: [], cut: [], units: [], groups: [], recs: {}, sel: [], gen: {}, sense: {} };
  var gone = [];                          // 拿走的词条，最后看它们的拼写还在不在
  var custom = store.custom || [], keepUnits = [];
  custom.forEach(function (c, k) {
    var cut = [];
    var rest = c.words.filter(function (w, j) {
      if (!want[w.i]) return true;
      cut.push({ k: j, w: w }); return false;
    });
    if (!cut.length) { keepUnits.push(c); return; }
    cut.forEach(function (x) {
      delete want[x.w.i]; gone.push(x.w);
      snap.recs[x.w.i] = takeRecs(store, x.w.i);
    });
    snap.cut.push({ u: c.u, words: cut });
    if (rest.length) { c.words = rest; keepUnits.push(c); return; }
    var shell = {};
    for (var f in c) if (f !== 'words') shell[f] = c[f];
    snap.units.push({ at: k, unit: shell });
    (store.groups || []).forEach(function (g) {
      var gk = g.us.indexOf(c.u);
      if (gk >= 0) { snap.groups.push({ id: g.id, u: c.u, k: gk }); g.us.splice(gk, 1); }
    });
  });
  store.custom = keepUnits;
  var hidW = {};
  builtin.forEach(function (w) {
    if (!want[w.i] || hasOwn(store.hide, w.i)) return;
    delete want[w.i];
    store.hide[w.i] = takeRecs(store, w.i);
    snap.hid.push(w.i); hidW[w.w] = hidW[w.w] || w.i; gone.push(w);
  });
  gone.forEach(function (w) {
    if (store.sel[w.i]) { snap.sel.push(w.i); delete store.sel[w.i]; }
  });
  var live = liveSpellings(store, builtin);
  gone.forEach(function (w) {
    if (live[w.w]) return;
    var h = hidW[w.w] ? store.hide[hidW[w.w]] : null;   // 藏起来的内置词还会回来：例句跟着它收着
    if (hasOwn(store.gen, w.w)) { (h ? (h.g = store.gen[w.w]) : (snap.gen[w.w] = store.gen[w.w])); delete store.gen[w.w]; }
    if (hasOwn(store.sense, w.w)) { (h ? (h.x = store.sense[w.w]) : (snap.sense[w.w] = store.sense[w.w])); delete store.sense[w.w]; }
  });
  snap.n = gone.length;
  return snap;
}
/* 把藏起来的内置词放回来，返回放回了几个 */
function restoreHidden(store, ids, builtin) {
  var n = 0, byI = {};
  builtin.forEach(function (w) { byI[w.i] = w; });
  ids.forEach(function (i) {
    if (!hasOwn(store.hide, i)) return;
    var r = store.hide[i] || {}, w = byI[i];
    delete store.hide[i];
    putRecs(store, i, r);
    if (w && hasOwn(r, 'g') && !hasOwn(store.gen, w.w)) store.gen[w.w] = r.g;
    if (w && hasOwn(r, 'x') && !hasOwn(store.sense, w.w)) store.sense[w.w] = r.x;
    n++;
  });
  return n;
}
/* 撤回刚才那一下 deleteWords */
/* 真题1000 换成 11-10 新版（第五十七次优化）：新版删了 26 个词、加了 25 个，新词基本占了被删词原来的编号，
   curate 从 52 号挪到 5 号。进度、星标等都按编号存，不处理的话被删词的记录会落到同一编号的新词头上。
   打开时一次性清掉这些编号的记录，curate 那份从 30052 挪到 30005。91 号新版重复放了 forestall，
   网站上 91 号仍是 anecdote，不在这里面。返回清掉了几条记录（挪过去的不算）。 */
var T1000_V2_DROP = [5, 52, 85, 98, 100, 149, 168, 190, 214, 229, 238, 242, 267, 268, 272,
  352, 359, 365, 370, 404, 408, 417, 435, 443, 625, 628].map(function (n) { return 30000 + n; });
var T1000_V2_MOVE = { 30052: 30005 };
function reslotIds(store, drop, move) {
  var n = 0;
  ['prog', 'hist', 'sel', 'star', 'col', 'hide'].forEach(function (t) {
    var tab = store[t];
    if (!tab) return;
    var keep = {}, from, to;
    for (from in move) if (hasOwn(tab, from)) keep[move[from]] = tab[from];
    drop.forEach(function (i) { if (hasOwn(tab, i)) { delete tab[i]; if (!hasOwn(move, i)) n++; } });
    for (from in move) delete tab[from];
    for (to in keep) tab[to] = keep[to];
  });
  return n;
}

function undoDelete(store, snap, builtin) {
  restoreHidden(store, snap.hid, builtin);
  snap.units.slice().sort(function (a, b) { return a.at - b.at; }).forEach(function (x) {
    if (store.custom.some(function (c) { return c.u === x.unit.u; })) return;
    var c = {};
    for (var f in x.unit) c[f] = x.unit[f];
    c.words = [];
    store.custom.splice(Math.min(x.at, store.custom.length), 0, c);
  });
  snap.cut.forEach(function (x) {
    var c = store.custom.filter(function (y) { return y.u === x.u; })[0];
    if (!c) return;
    x.words.slice().sort(function (a, b) { return a.k - b.k; }).forEach(function (y) {
      if (c.words.some(function (z) { return z.i === y.w.i; })) return;
      c.words.splice(Math.min(y.k, c.words.length), 0, y.w);
    });
  });
  for (var i in snap.recs) putRecs(store, +i, snap.recs[i]);
  snap.sel.forEach(function (i) { store.sel[i] = 1; });
  for (var g in snap.gen) if (!hasOwn(store.gen, g)) store.gen[g] = snap.gen[g];
  for (var s in snap.sense) if (!hasOwn(store.sense, s)) store.sense[s] = snap.sense[s];
  snap.groups.slice().sort(function (a, b) { return a.k - b.k; }).forEach(function (x) {
    var gr = (store.groups || []).filter(function (y) { return y.id === x.id; })[0];
    if (gr && gr.us.indexOf(x.u) < 0) gr.us.splice(Math.min(x.k, gr.us.length), 0, x.u);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseLine: parseLine, parseTable: parseTable, mergeRows: mergeRows, importScan: importScan,
    lcsMark: lcsMark, blankAt: blankAt,
    wordPat: wordPat, inflectRe: inflectRe, wordRe: wordRe,
    phraseOk: phraseOk, cleanWord: cleanWord, headerish: headerish, wordCell: wordCell,
    audioSrcName: audioSrcName,
    CUSTOM_ID_FLOOR: CUSTOM_ID_FLOOR, nextCustomId: nextCustomId,
    renumberCollidingCustom: renumberCollidingCustom,
    isPhrase: isPhrase, phraseStart: phraseStart, splitCustomUnit: splitCustomUnit,
    pronUrl: pronUrl, pronList: pronList, phraseClips: phraseClips, pronGuesses: pronGuesses,
    poolSig: poolSig, wantCloze: wantCloze, againCloze: againCloze, againAt: againAt, nearOrder: nearOrder,
    SENSE_SHOTS: SENSE_SHOTS, sensePrompt: sensePrompt, cleanSense: cleanSense,
    dsModel: dsModel, dsBody: dsBody,
    applyHidden: applyHidden, hiddenIn: hiddenIn, deleteWords: deleteWords,
    restoreHidden: restoreHidden, undoDelete: undoDelete,
    T1000_V2_DROP: T1000_V2_DROP, T1000_V2_MOVE: T1000_V2_MOVE, reslotIds: reslotIds
  };
}
