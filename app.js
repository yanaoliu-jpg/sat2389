/* ===== SAT 2389 · 背单词 ===== */
(function () {
'use strict';

var WORDS = (window.SAT_WORDS || []).slice();
var UNITS = (window.SAT_UNITS || []).slice();
var RICH  = window.SAT_RICH  || {};
/* 雅思词自己的例句（第十九次优化），按词条编号 i 取。条目里带着 w，rich() 要编号和单词都对得上才用：
   第二十次优化以前自己导入的词编号是从 10000 往上排的，会撞上雅思的 10001–10639。现在新词从
   CUSTOM_ID_FLOOR 起排、老数据加载时也已经换过号，这道核对留着当保险。 */
var IELTS_RICH = window.IELTS_RICH || {};
WORDS.forEach(function (w) {   // 词根是词本身的，换了例句也还适用 —— 雅思词原来借 SAT 例句时显示的词根不能丢
  var o = IELTS_RICH[w.i], s = RICH[w.w];
  if (o && o.w === w.w && s && s.r && !o.r) o.r = s.r;
});

/* ---------- storage ---------- */
var LS = 'sat2389.v1';
var DEF_SET = { v: 4, accent: 'en-US', rate: 0.95, vol: 1, voice: '', auto: true,
                hideZh: false, hideEx: false, hint: true, sort: 'book', qn: 20,
                exlen: 'mid', zhSize: 'm', shuf: false, wsrc: 'yd',
                prov: 'anthropic', key: '', model: 'claude-opus-5',
                dskey: '', dsmodel: 'deepseek-chat' };
var store = { prog: {}, hist: {}, star: {}, sel: {}, gen: {}, col: {}, custom: [], set: {}, theme: '' };
try { var raw = localStorage.getItem(LS); if (raw) { var o = JSON.parse(raw); for (var k in o) store[k] = o[k]; } } catch (e) {}
for (var dk in DEF_SET) if (!(dk in store.set)) store.set[dk] = DEF_SET[dk];
if (store.set.v !== 4) {                 // v1 kept en-GB; v2 had no volume/sort; v3 had one AI provider
  store.set.v = 4;
  if (store.set.accent !== 'en-US' && store.set.accent !== 'en-GB') store.set.accent = 'en-US';
}
if (!(store.pv >= 2)) {                  // levels used to be {1 模糊, 2 认识}; 不认识 stored nothing
  var moved = {};
  for (var pk in store.prog) moved[pk] = store.prog[pk] === 2 ? 3 : 2;
  store.prog = moved; store.pv = 2;
}
if (store.pv !== 3) {                    // 第二十二次优化取消了「模糊」：标着模糊的词并进不认识，曾错过不补记
  for (var fk in store.prog) if (store.prog[fk] === 2) store.prog[fk] = 1;
  store.pv = 3;
}
if (!store.sel) store.sel = {};
if (!store.gen) store.gen = {};
if (!store.custom) store.custom = [];
if (!store.col) store.col = {};
var dropRel = !!store.rel;               // 第四次优化 5：不再记「反复」，顺手把旧字段清掉
if (dropRel) delete store.rel;
/* hist used to be set by ANY 模糊. It now means "真的错过": 不认识, or 掌握之后又掉下来。
   Old profiles can't tell the two apart, so rebuild once from the levels we can still see. */
if (!(store.hv >= 3)) {
  var reb = {};
  for (var hk in store.prog) if (store.prog[hk] === 1) reb[hk] = 1;
  store.hist = reb; store.hv = 3;
}
/* 第二十三次优化：第一次就标「不认识」不再算错过，只有认识之后又掉回不认识才算。
   旧记录分不清是哪一种，用户要的是黄圈别带着，所以一次性清空，往后按新规则重新记。 */
var histReset = store.hv !== 4;
if (histReset) { store.hist = {}; store.hv = 4; }
/* 自建词编号迁移（第二十次优化）：老版本自建词的编号从 10000 排起，后来内置的雅思词占了 10001–10639，
   撞号的两个词共用着同一份进度／星标／颜色。一次性把撞号的自建词换到 CUSTOM_ID_FLOOR 之上的新编号，
   那份共用的记录跟着自建词走、雅思词回到未学（为什么这样挑，见 pure.js 的 renumberCollidingCustom）。
   要放在 mountCustom() 之前：它把 store.custom 里的词原样拷进 WORDS。 */
var idMoved = 0;
if (store.iv !== 1) {
  try {
    var fx = renumberCollidingCustom(store, window.SAT_WORDS || []);
    if (fx.moved) {
      store.custom = fx.custom; store.prog = fx.prog; store.hist = fx.hist;
      store.sel = fx.sel; store.star = fx.star; store.col = fx.col;
      idMoved = fx.moved;
    }
    store.iv = 1;
  } catch (e) {}                         // 迁移出岔子也不能挡着应用起不来：保持原样，下次再试
}
var save = (function () {
  var t = null;
  return function () { clearTimeout(t); t = setTimeout(function () {
    try { localStorage.setItem(LS, JSON.stringify(store)); } catch (e) {}
  }, 200); };
})();
if (dropRel || idMoved || histReset) save();

/* ---------- imported units ---------- */
function mountCustom() {
  WORDS = (window.SAT_WORDS || []).slice();
  UNITS = (window.SAT_UNITS || []).slice();
  store.custom.forEach(function (c) {
    UNITS.push({ u: c.u, n: c.words.length, a: c.words[0] ? c.words[0].w : '',
                 b: c.words.length ? c.words[c.words.length - 1].w : '', t: c.t,
                 imported: 1, manual: c.manual ? 1 : 0 });
    c.words.forEach(function (w) { WORDS.push(w); });
  });
  HEADS = null; SIMC = {};          /* 词表变了，干扰项的相似度缓存也跟着作废 */
}
mountCustom();

/* ---------- theme ---------- */
function applyTheme() {
  if (store.theme) document.documentElement.setAttribute('data-theme', store.theme);
  else document.documentElement.removeAttribute('data-theme');
}
function applyZh() {
  document.documentElement.setAttribute('data-zh', store.set.zhSize || 'm');
}
function isDark() {
  if (store.theme) return store.theme === 'dark';
  return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}
applyTheme();
applyZh();
document.getElementById('themeBtn').onclick = function () {
  store.theme = isDark() ? 'light' : 'dark'; applyTheme(); save();
};

/* ---------- speech ----------
   macOS ships ~20 novelty en-US voices (Albert, Bubbles, Zarvox …) and they sort
   before Samantha alphabetically, so "first voice whose lang matches" picks a
   cartoon frog. Rank instead: drop the novelty set, prefer the neural/enhanced
   builds, then the known-good compact ones. */
var NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|kathy|organ|pipe organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox|bruce|agnes|vicki|victoria)\b/i;
var HIFI = /\b(natural|neural|enhanced|premium|online|siri)\b/i;   // Ava (Premium), Microsoft Aria Online (Natural) …
var PREFERRED = ['samantha', 'ava', 'allison', 'susan', 'alex', 'zoe', 'evan', 'nathan', 'noelle',
  'joelle', 'google us english', 'microsoft aria', 'microsoft jenny', 'microsoft guy',
  'daniel', 'serena', 'kate', 'oliver', 'stephanie', 'arthur', 'martha',
  'google uk english', 'microsoft libby', 'microsoft sonia', 'microsoft ryan'];
var voices = [];
function usable(v) { return /^en/i.test(v.lang) && !NOVELTY.test(v.name.trim()); }
function score(v, accent) {
  var lang = (v.lang || '').replace('_', '-'), n = v.name.toLowerCase(), s = 0;
  if (lang === accent) s -= 400;
  else if (lang.slice(0, 2) === accent.slice(0, 2)) s -= 100;
  else return null;
  if (HIFI.test(n)) s -= 150;                 // the neural builds are the ones that stop sounding synthetic
  for (var i = 0; i < PREFERRED.length; i++) { if (n.indexOf(PREFERRED[i]) === 0) { s -= 200 - i; break; } }
  if (v.default) s -= 20;
  return s;
}
function pickVoice(accent) {
  var best = null, bestScore = 1e9;
  voices.forEach(function (v) {
    var sc = score(v, accent);
    if (sc !== null && sc < bestScore) { bestScore = sc; best = v; }
  });
  return best;
}
function currentVoice() {
  var v = voices.filter(function (x) { return x.name === store.set.voice; })[0];
  return v || pickVoice(store.set.accent);
}
function loadVoices() {
  if (!window.speechSynthesis) return;
  voices = speechSynthesis.getVoices().filter(usable);
  var sel = document.getElementById('setVoice');
  if (!sel) return;
  var auto = pickVoice(store.set.accent);
  var listed = voices.filter(function (v) { return score(v, store.set.accent) !== null; })
    .sort(function (a, b) { return score(a, store.set.accent) - score(b, store.set.accent); });
  sel.innerHTML = '<option value="">自动选择' + (auto ? '（' + esc(auto.name) + '）' : '') + '</option>' +
    listed.map(function (v) {
      return '<option value="' + esc(v.name) + '">' + esc(v.name) + ' · ' + esc(v.lang) +
        (HIFI.test(v.name) ? ' ·高清' : '') + '</option>';
    }).join('');
  sel.value = store.set.voice || '';
  paintAccent();
}
if (window.speechSynthesis) { speechSynthesis.onvoiceschanged = loadVoices; }

/* Web Speech reads a whole sentence at one pitch and one speed, which is most of
   what makes it sound like a machine. Cut the sentence into breath groups at the
   punctuation, then walk the pitch down across them and stretch the last one —
   that is roughly what a speaker's declination + final lengthening do. */
function breathGroups(text) {
  var raw = String(text).replace(/\s+/g, ' ').trim(), out = [], buf = '';
  for (var i = 0; i < raw.length; i++) {
    buf += raw[i];
    /* \u7834\u6298\u53f7\u5e38\u5e38\u662f\u62ec\u53f7\uff0f\u5f15\u53f7\u91cc\u5d4c\u7740\u7684\u63d2\u5165\u8bed\uff0c\u62ff\u5b83\u5f53\u65ad\u70b9\u5bb9\u6613\u5207\u9519\u6c14\u53e3\uff08\u7b2c\u5341\u4e09\u6b21\u4f18\u5316\uff09\uff1b
       \u53ea\u5728\u771f\u6b63\u7684\u53e5\u8bfb\u7b26\u53f7\u540e\u9762\u65ad\uff0c\u66f4\u4fdd\u5b88\u4f46\u66f4\u4e0d\u5bb9\u6613\u65ad\u9519\u3002 */
    var brk = ',;:'.indexOf(raw[i]) >= 0, end = '.!?'.indexOf(raw[i]) >= 0;
    if ((brk || end) && (i + 1 >= raw.length || raw[i + 1] === ' ')) { out.push(buf.trim()); buf = ''; }
  }
  if (buf.trim()) out.push(buf.trim());
  /* a long clause still needs air: split it once near the middle at a function word */
  var split = [];
  out.forEach(function (g) {
    var ws = g.split(' ');
    if (ws.length <= 11) { split.push(g); return; }
    var best = -1, mid = ws.length / 2;
    for (var j = 3; j < ws.length - 3; j++) {
      if (/^(and|but|or|that|which|who|while|because|when|after|before|though|so|as|until|unless|whose|where)$/i.test(ws[j])
          && (best < 0 || Math.abs(j - mid) < Math.abs(best - mid))) best = j;
    }
    if (best < 0) best = Math.round(mid);
    split.push(ws.slice(0, best).join(' '));
    split.push(ws.slice(best).join(' '));
  });
  /* a one- or two-word group gets clipped by the engine \u2014 fold it back */
  var merged = [];
  split.forEach(function (g) {
    if (merged.length && g.split(' ').length < 3) merged[merged.length - 1] += ' ' + g;
    else merged.push(g);
  });
  return merged.length ? merged : [raw];
}
/* 单词真人发音（第二十二次优化）：系统 TTS 读单词再怎么挑声音也是合成的，
   有道词典的发音是录好的，国内直连。只管单词和短语 —— 整句它不给（返回 500），
   例句照旧走系统声音。没网、查不到这个词、或者 claude.ai 上被拦了，都退回系统声音。
   设置里「单词发音」可以改成一直用系统声音（store.set.wsrc：'yd' / 'sys'）。 */
var ydAudio = null;
function ydOk(text) {
  var t = String(text).trim();
  return store.set.wsrc !== 'sys' && navigator.onLine !== false &&
    t.length <= 40 && t.split(/\s+/).length <= 4 && !/[.!?,;:]$/.test(t) && /[a-z]/i.test(t);
}
function stopYd() { if (ydAudio) { try { ydAudio.pause(); } catch (e) {} ydAudio = null; } }
function speakYd(text, mine, vol, rate, fallback) {
  var a = new Audio('https://dict.youdao.com/dictvoice?type=' + (store.set.accent === 'en-GB' ? 1 : 2) +
    '&audio=' + encodeURIComponent(String(text).trim()));
  var done = false;
  function fail() {
    if (done) return; done = true; clearTimeout(t);
    if (ydAudio === a) ydAudio = null;
    if (mine === sayToken) fallback();
  }
  var t = setTimeout(fail, 2500);            // 网慢到这个份上，不如先用系统声音读出来
  a.volume = vol;
  a.playbackRate = Math.max(0.5, Math.min(1.5, rate));
  a.onplaying = function () { done = true; clearTimeout(t); };
  a.onerror = fail;
  ydAudio = a;
  var p = a.play();
  if (p && p.catch) p.catch(fail);
}
var sayToken = 0;
function speak(text, btn) {
  var mine = ++sayToken;
  stopYd();
  var vol0 = +store.set.vol;
  if (isNaN(vol0)) vol0 = 1;
  if (ydOk(text)) {
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    speakYd(text, mine, Math.max(0, Math.min(1, vol0)), +store.set.rate || 1, function () { speakSys(text, mine); });
    if (btn) { btn.classList.remove('on'); void btn.offsetWidth; btn.classList.add('on'); }
    return;
  }
  speakSys(text, mine);
  if (btn) { btn.classList.remove('on'); void btn.offsetWidth; btn.classList.add('on'); }
}
function speakSys(text, mine) {
  if (!window.speechSynthesis) return;
  try { speechSynthesis.cancel(); } catch (e) {}
  var v = currentVoice(), base = +store.set.rate || 1, vol = +store.set.vol;
  if (isNaN(vol)) vol = 1;
  vol = Math.max(0, Math.min(1, vol));
  var single = !/\s/.test(String(text).trim());
  var groups = single ? [String(text).trim()] : breathGroups(text);
  var span = Math.max(1, groups.length - 1);
  /* Queue every group in one go rather than chaining on timers: speechSynthesis plays
     the queue back to back, and background tabs clamp setTimeout to ~1s, which would
     tear a sentence apart. The pause between groups is the engine's own — each group
     keeps its trailing comma or period, which is what it listens to. */
  setTimeout(function () {              // Chrome drops a speak() issued inside cancel()
    if (mine !== sayToken) return;
    groups.forEach(function (g, i) {
      var last = i === groups.length - 1;
      var u = new SpeechSynthesisUtterance(g);
      u.volume = vol;
      if (single) { u.rate = base * 0.82; u.pitch = 1; }
      else if (groups.length === 1) { u.rate = base * 0.95; u.pitch = 1; }
      else {
        u.rate = base * (last ? 0.9 : 1);                       // final lengthening
        u.pitch = 1.06 - 0.14 * (i / span);                     // declination across the sentence
        if (last && /\?\s*$/.test(g)) u.pitch = 1.1;          // …unless it is a question
      }
      if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = store.set.accent; }
      try { speechSynthesis.speak(u); } catch (e) {}
    });
  }, 40);
}
function paintAccent() {
  var b = document.getElementById('accentBtn');
  if (!b) return;
  var us = store.set.accent === 'en-US', v = currentVoice();
  b.textContent = us ? '美音' : '英音';
  b.title = '当前发音：' + (us ? '美式' : '英式') + (v ? ' · ' + v.name : '') + '（点击切换）';
}
var SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/></svg>';

/* ---------- progress helpers ---------- */
function lvl(i) { return store.prog[i] || 0; }   // 0 未学 · 1 不认识 · 3 认识（2 原来是「模糊」，第二十二次优化取消）
/* 记账规则：认识之后又标回「不认识」（包括测验答错）才算错过一次；
   第一次就标不认识只是还没学会，改成认识时不带「曾错过」（第二十三次优化）。 */
function setLvl(i, v) {
  var prev = lvl(i);
  if (v) store.prog[i] = v; else delete store.prog[i];
  if (v === 1 && prev === 3) store.hist[i] = (store.hist[i] || 0) + 1;
  save();
}
function everShaky(i) { return !!store.hist[i]; }
function cls(i) {
  var l = lvl(i), c = l === 3 ? 'k' : l === 2 ? 'f' : l === 1 ? 'x' : '';
  return c + (l === 3 && everShaky(i) ? ' h' : '');
}
/* 乱序版单元（u 3001 起，第二十一次优化）不自带词条，ids 按顺序指向原书词条 ——
   进度、星标、颜色都按 i 存，所以跟原书单元共用，不会多出一份 */
function unitWords(u) {
  var ids = unitMeta(u).ids;
  if (!ids) return WORDS.filter(function (w) { return w.u === u; });
  var at = {};
  WORDS.forEach(function (w) { at[w.i] = w; });
  return ids.map(function (i) { return at[i]; }).filter(Boolean);
}
/* 首页眼下那一套的词：原版是全部词条，乱序版是乱序单元里的词（PDF 有几个词印了两遍，去重）。
   首页的已掌握 / 待复习 / 整理错词 / 测验错词都按它算 */
function homePool() {
  if (!store.set.shuf) return WORDS;
  var seen = {}, out = [];
  UNITS.forEach(function (x) {
    if (x.ids) unitWords(x.u).forEach(function (w) { if (!seen[w.i]) { seen[w.i] = 1; out.push(w); } });
  });
  return out;
}
function unitMeta(u) { return UNITS.filter(function (x) { return x.u === u; })[0] || { n: 0, a: '', b: '' }; }
function unitLabel(u) {                                  // unit 37 is the 错词本, not a book page
  var m = unitMeta(u);
  return m.t || ('UNIT ' + String(u).padStart(2, '0') + ' · 原书 P' + u);
}
function unitShort(u) {                                  // 搜索结果里的小标签，短一点
  var m = unitMeta(u);
  return m.t || ('UNIT ' + String(u).padStart(2, '0'));
}
/* 这个词是单元里的第几个：按单元自己的顺序（原书顺序／乱序单元写死的那份乱序），不随排序和颜色筛选变（第二十二次优化） */
function unitSeq(u) {
  var at = {};
  unitWords(u).forEach(function (w, k) { at[w.i] = k + 1; });
  return at;
}
/* 这个词在它所属单元里排第几（按当前排序） */
function posInUnit(u, i) {
  var ws = ordered(u), n = -1;
  ws.forEach(function (x, j) { if (x.i === i) n = j; });
  return n;
}
function shaky(w) { var l = lvl(w.i); return l === 1 || l === 2; }   // 需要再过一遍的
function tally(list) {
  var t = { known: 0, shaky: 0, fresh: 0, once: 0 };
  list.forEach(function (w) {
    var l = lvl(w.i);
    if (l === 3) { t.known++; if (everShaky(w.i)) t.once++; }
    else if (l) t.shaky++; else t.fresh++;
  });
  return t;
}
function rich(w) {
  var o = IELTS_RICH[w.i];
  return (o && o.w === w.w) ? o : (RICH[w.w] || null);
}
function gen(w) { return store.gen[w.w] || []; }

/* ---------- 颜色分组（第十次优化 3） ----------
   一个单元几百个词，一口气背不完。给词标个颜色，就能把一个单元切成几小批：
   标完之后浏览页上多一排颜色，点一下只看这一批，学习、测验、拼写都跟着只走这一批。
   颜色只是分组，跟「认识／不认识」两码事，互不影响。 */
var COLORS = [['c1', '红'], ['c2', '橙'], ['c3', '黄'], ['c4', '绿'], ['c5', '蓝'], ['c6', '紫']];
function colOf(i) { return store.col[i] || ''; }
function setCol(i, c) { if (c) store.col[i] = c; else delete store.col[i]; dropOrder(); }
function colName(c) { var n = ''; COLORS.forEach(function (x) { if (x[0] === c) n = x[1]; }); return n; }
function colTally(ws) {
  var t = {};
  ws.forEach(function (w) { var c = colOf(w.i); if (c) t[c] = (t[c] || 0) + 1; });
  return t;
}
/* 一排色点，词卡和「已选 N 个」横幅上都用它 */
function colDots(cls, cur, keys) {
  return '<span class="' + cls + '">' +
    COLORS.map(function (c, n) {
      return '<button class="cdot ' + c[0] + (cur === c[0] ? ' on' : '') + '" data-col="' + c[0] +
        '" type="button" title="标成' + c[1] + '色' + (keys ? '（按 ' + (n + 4) + '）' : '') +
        '" aria-label="标成' + c[1] + '色"></button>';
    }).join('') +
    '<button class="cdot cnone" data-col="" type="button" title="不标颜色' +
    (keys ? '（按 0）' : '') + '" aria-label="不标颜色">×</button>' +
    '</span>';
}
/* 筛选是「临时看一小批」，记在内存里，换单元自然就没了 */
var colFilter = '', colFilterU = null;
function curFilter(u) { return colFilterU === u ? colFilter : ''; }
function setFilter(u, c) { colFilterU = u; colFilter = c || ''; dropOrder(); }

/* ---------- ordering (第三次优化 10) ---------- */
var SORTS = [['book', '原书顺序'], ['weak', '先不认识'], ['once', '先曾错过'],
             ['fresh', '先未学'], ['az', '字母序'], ['rand', '随机']];
var WEIGHT = { 1: 0, 2: 1, 0: 2, 3: 3 };                 // 不认识 → 未学 → 认识（2 是取消了的模糊）
var ordCache = { u: null, m: null, f: null, list: null };
function ordered(u) {
  var m = store.set.sort || 'book', f = curFilter(u);
  if (ordCache.u === u && ordCache.m === m && ordCache.f === f) return ordCache.list;
  var ws = unitWords(u);
  /* 同一档里谁先谁后：原有单元照编号；乱序单元照它写死的乱序 —— 退回编号就又成了字母顺序 */
  var seq = {}, shuffled = !!unitMeta(u).ids;
  ws.forEach(function (w, k) { seq[w.i] = shuffled ? k : w.i; });
  if (f) ws = ws.filter(function (w) { return colOf(w.i) === f; });   // 只看这一个颜色
  if (m === 'weak') {
    ws = ws.slice().sort(function (a, b) {
      return (WEIGHT[lvl(a.i)] - WEIGHT[lvl(b.i)]) || (seq[a.i] - seq[b.i]);
    });
  } else if (m === 'once') {
    /* 「认识（曾错过）」排最前 —— 自以为会、却栽过跟头的那一批最值得再看一眼。
       现在标着不认识的词本来就在「先不认识」里，这里不重复强调。 */
    ws = ws.slice().sort(function (a, b) {
      var wa = lvl(a.i) === 3 && everShaky(a.i) ? 0 : 1;
      var wb = lvl(b.i) === 3 && everShaky(b.i) ? 0 : 1;
      return (wa - wb) || (seq[a.i] - seq[b.i]);
    });
  } else if (m === 'fresh') {
    ws = ws.slice().sort(function (a, b) { return (lvl(a.i) ? 1 : 0) - (lvl(b.i) ? 1 : 0) || seq[a.i] - seq[b.i]; });
  } else if (m === 'az') {
    ws = ws.slice().sort(function (a, b) { return a.w < b.w ? -1 : a.w > b.w ? 1 : 0; });
  } else if (m === 'rand') {
    ws = ws.slice();
    for (var i = ws.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = ws[i]; ws[i] = ws[j]; ws[j] = t; }
  }
  ordCache = { u: u, m: m, f: f, list: ws };
  return ws;
}
function dropOrder() { ordCache = { u: null, m: null, f: null, list: null }; }

/* ---------- 选中一批词（第四次优化 3） ----------
   选中是全站范围的：可以在几个单元、生词本、搜索结果里各挑几个，
   凑成一份自己的清单，再拿去测验或逐个过一遍。存在 store.sel 里，刷新不丢。 */
var picking = false;                       // 列表当前是不是选择模式
/* 编辑模式记的是「在哪个单元开着」，不是一个开关 ——
   这样换单元自然就关了，而排序、保存这些重画不会把它碰掉。（第八次优化 3） */
var editUnit = null;
function selWords() { return WORDS.filter(function (w) { return store.sel[w.i]; }); }
function selCount() { var n = 0; for (var k in store.sel) n++; return n; }
/* 一轮到底考几个，设置里改过就按设置来（0 = 全部） */
function qCount(n) { var q = +store.set.qn || 0; return q > 0 ? Math.min(q, n) : n; }
function selBarHtml() {
  var n = selCount();
  if (!n) return '';
  return '<div class="selbar"><span class="selbar-n">已选 <b>' + n + '</b> 个</span>' +
    '<button class="btn" id="selQuiz" type="button">测验这 ' + qCount(n) + ' 个</button>' +
    '<button class="btn btn-ghost" id="selSpell" type="button">拼写</button>' +
    '<button class="btn btn-ghost" id="selReview" type="button">逐个过一遍</button>' +
    colDots('selbar-cols', '') +
    '<button class="btn btn-ghost" id="selClear" type="button">清空</button></div>';
}
function wireSelBar(from) {
  var q = document.getElementById('selQuiz');
  if (q) q.onclick = function () { quiz = null; go({ name: 'quiz', scope: 'sel' }); };
  var sp = document.getElementById('selSpell');
  if (sp) sp.onclick = function () { spell = null; go({ name: 'spell', scope: 'sel' }); };
  var r = document.getElementById('selReview');
  if (r) r.onclick = function () { startReview(selWords(), '选中的词', from); };
  var c = document.getElementById('selClear');
  if (c) c.onclick = function () { store.sel = {}; save(); render(); };
  /* 勾一批词，点个颜色，一次都标上 */
  Array.prototype.forEach.call(view.querySelectorAll('.selbar-cols [data-col]'), function (b) {
    b.onclick = function () {
      selWords().forEach(function (w) { setCol(w.i, b.dataset.col); });
      save(); render();
    };
  });
}
/* 勾词：一个个点太慢（第五次优化 2）。三种勾法 ——
   点一行、按住往下拖一片、Shift 点另一行选中间整段。
   只改这几行的样子和底部那条横幅，不整页重画（免得列表跳回顶部）。 */
var dragVal = null, anchor = -1;
var railDrag = null, railAnchor = -1, railRO = null;
document.addEventListener('mouseup', function () { dragVal = null; railDrag = null; });
function wirePick(from) {
  var rows = Array.prototype.slice.call(view.querySelectorAll('.row'));
  function paint(r, on) {
    var i = +r.dataset.i;
    if (on) store.sel[i] = 1; else delete store.sel[i];
    r.classList.toggle('sel', on);
  }
  function refresh() {
    save();
    var slot = document.getElementById('selbarSlot');
    if (slot) { slot.innerHTML = selBarHtml(); wireSelBar(from); }
  }
  anchor = -1;
  rows.forEach(function (r, n) {
    r.addEventListener('mousedown', function (e) {
      if (!picking || e.button) return;
      var d = e.target.dataset || {};
      if (d.star || d.go || d.edit || d.del2) return;   // 行里的小按钮各管各的
      e.preventDefault();                       // 免得拖出一片选中的文字
      if (e.shiftKey && anchor >= 0) {
        var a = Math.min(anchor, n), b = Math.max(anchor, n);
        for (var k = a; k <= b; k++) paint(rows[k], true);
        dragVal = null; refresh(); return;
      }
      dragVal = !store.sel[+r.dataset.i];
      anchor = n;
      paint(r, dragVal);
      refresh();
    });
    r.addEventListener('mouseenter', function () {
      if (!picking || dragVal === null) return;
      paint(r, dragVal); refresh();
    });
  });
}
function pickBarHtml() {
  return '<button class="chip chip-pick' + (picking ? ' on' : '') + '" id="pickToggle" type="button">' +
    (picking ? '✓ 选择中' : '选择') + '</button>' +
    (picking ? '<button class="chip" id="pickAll" type="button">全选</button>' +
               '<button class="chip" id="pickNone" type="button">全不选</button>' +
               '<span class="pick-tip">按住往下拖可以连选，Shift 点一行选中间一段</span>' : '');
}
function wirePickBar(list, redraw) {
  var t = document.getElementById('pickToggle');
  if (t) t.onclick = function () { picking = !picking; if (picking) editUnit = null; redraw(); };
  var a = document.getElementById('pickAll');
  if (a) a.onclick = function () { list.forEach(function (w) { store.sel[w.i] = 1; }); save(); redraw(); };
  var n = document.getElementById('pickNone');
  if (n) n.onclick = function () { list.forEach(function (w) { delete store.sel[w.i]; }); save(); redraw(); };
}

/* ---------- 导出 / 复制（第十一次优化 3）----------
   一行一个词，Tab 分隔「单词 / 音标 / 释义」—— 正好能粘回「导入词表」的文本框，
   所以复习到一半想把这批词挪走、留个底、发给别人，都不用另存文件。 */
function exportLines(words) {
  return words.map(function (w) { return [w.w, w.p || '', w.z].join('\t'); }).join('\n');
}
function copyText(str, btn) {
  var label = btn ? btn.textContent : '';
  function done() { if (btn) { btn.textContent = '已复制'; setTimeout(function () { btn.textContent = label; }, 1400); } }
  function fallback() {
    var ta = document.createElement('textarea');
    ta.value = str; ta.style.position = 'fixed'; ta.style.top = '-9999px';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(str).then(done, fallback);
  } else fallback();
}

/* ---------- formatting ---------- */
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
function ipaHtml(p) { return esc(p).replace(/[ˈˌ]/g, function (m) { return '<span class="st">' + m + '</span>'; }); }
function zhHtml(z) {
  // the book leaves a few stray separators around part-of-speech markers
  z = String(z).replace(/\.[,，、;；]/g, '.').replace(/[,，、;；]\s*$/, '');
  var POS = '(?:vt|vi|aux|prep|conj|pron|interj|phr|adv|adj|abbr|art|num|n|v|a|ad)\\.';
  return esc(z)
    .replace(new RegExp('\\(' + POS + '\\)', 'g'), function (m) { return '<span class="pos">' + m.slice(1, -1) + '</span>'; })
    .replace(new RegExp('(^|[)\\]）】])(' + POS + ')', 'g'),
      function (m, a, b) { return a.indexOf('span') >= 0 ? m : a + '<span class="pos">' + b + '</span>'; });
}
function zhEx(t) {   // translations mark the matching Chinese with **…**
  return esc(t || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
}
function bold(sent, word) {
  return esc(sent).replace(new RegExp('\\b(' + wordPat(word) + ')', 'ig'), '<b>$1</b>');
}
function rootHtml(s) {   // ab-（离开）+ jur（发誓）→ 发誓离开 → 弃绝
  return esc(s)
    .replace(/→/g, '<i>→</i>')
    .replace(/（([^）]*)）/g, '<u>（$1）</u>');
}

/* ---------- routing ---------- */
var view = document.getElementById('view');
var route = { name: 'home' };
/* 目录、单元浏览、生词本这几页是「一长条要翻的东西」，退回来时接着上次那一屏；
   学习、测验这些是一屏一件事，还是从头开始。（第十次优化 4） */
var scrollMem = {};
function scrollKey(r) {
  if (!r) return null;
  if (r.name === 'home') return 'home';
  if (r.name === 'star') return 'star';
  if (r.name === 'unit' && (r.tab || 'browse') === 'browse') return 'u' + r.u;
  return null;
}
function scrollTo0(y) {
  try { window.scrollTo({ top: y, behavior: 'instant' in document.body.style ? 'instant' : 'auto' }); }
  catch (e) { window.scrollTo(0, y); }
}
function go(r) {
  var k = scrollKey(route);
  if (k) scrollMem[k] = window.scrollY || window.pageYOffset || 0;
  route = r; render();
  var nk = scrollKey(r), y = nk ? (scrollMem[nk] || 0) : 0;
  scrollTo0(y);
  /* 首屏字体、图片落位之后高度会再变一次，下一帧再对一次位 */
  if (y) requestAnimationFrame(function () {
    if (Math.abs((window.scrollY || window.pageYOffset || 0) - y) > 2) scrollTo0(y);
  });
}
document.getElementById('goHome').onclick = function () {
  document.getElementById('search').value = '';
  if (route.name === 'home') { scrollMem.home = 0; scrollTo0(0); return; }   // 已经在首页就是「回到顶上」
  go({ name: 'home' });
};

/* ================= HOME ================= */
function renderHome() {
  var pool = homePool(), all = tally(pool);
  var mine = { units: 0, words: 0 };
  UNITS.forEach(function (x) { if (x.imported) { mine.units++; mine.words += x.n; } });
  var toefl = { units: 0, words: 0 };            // u 1001-1048：新东方《绿宝书》托福词汇（第十二次优化 2）
  UNITS.forEach(function (x) { if (x.u >= 1001 && x.u <= 1048) { toefl.units++; toefl.words += x.n; } });
  /* 首页一次只摆一套单元（第二十一次优化）：原版是原书、错词本、托福、雅思和自己导入的那些；
     乱序版是带 ids 的单元。标题下面的开关切换，记在 store.set.shuf */
  var shuf = !!store.set.shuf;
  var shown = UNITS.filter(function (x) { return shuf ? !!x.ids : !x.ids; });
  var cards = shown.map(function (u) {
    var ws = unitWords(u.u);
    var kn = ws.filter(function (w) { return lvl(w.i) === 3; }).length;
    var bub = ws.map(function (w) { return '<i class="bubble ' + cls(w.i) + '"></i>'; }).join('');
    return '<button class="unit-card' + (u.t ? ' extra' : '') +
      (merging ? (u.imported ? (mergeSel[u.u] ? ' msel' : '') : ' mno') : '') +
      '" data-u="' + u.u + '" type="button">' +
      '<div class="unit-no">' + esc(unitLabel(u.u)) +
        (u.imported ? '<span class="tag-imp">' + (u.manual ? '自建' : '导入') + '</span>' : '') + '</div>' +
      '<div class="unit-span">' + esc(u.a) + '<i>—</i>' + esc(u.b) + '</div>' +
      '<div class="bubbles">' + bub + '</div>' +
      '<div class="unit-foot"><span>' + u.n + ' 词</span><span><b>' + kn + '</b> 已掌握</span></div>' +
      '</button>';
  }).join('');
  view.innerHTML =
    '<div class="home-head"><div>' +
      '<p class="eyebrow">' + (shuf ? '乱序版 · ' : '') + shown.length + ' 个单元 · ' + pool.length + ' 个词条</p>' +
      '<h1>我的词库。</h1>' +
      '<div class="tabs shelf" role="tablist" aria-label="首页摆哪一套单元">' +
        '<button role="tab" data-shelf="0" type="button" aria-selected="' + !shuf + '">原版</button>' +
        '<button role="tab" data-shelf="1" type="button" aria-selected="' + shuf + '">乱序版</button>' +
      '</div>' +
      (shuf
        ? '<p class="lede">照《2300 高密度便携版》分单元：那份 PDF 竖着的每一列是一个单元，从 a 到 z 都有；' +
            '单元里的词打乱过一次、顺序固定，想每次换个顺序就在单元里点「随机」。' +
            '学习进度跟原版共用 —— 在这里标了认识，原版里同一个词也算认识。</p>'
        : '<p class="lede">底子是《SAT词汇2300打印版》的 2389 个词条（原书每页 68 词就是一个单元），' +
            '外加一个「错词本」单元；另外收了新东方《绿宝书》托福词汇全本，' +
            toefl.units + ' 个 List、' + toefl.words + ' 个词条，一 List 一个单元' +
            (mine.units ? '；再往后是你自己攒的 ' + mine.units + ' 个单元、' + mine.words + ' 个词条 —— 导入的词表、手动加的词、背过和复习过的都收在这里'
                        : '。往后凡是你背过、复习过的词，导进来或手动加进来，都会排在后面') +
            '。每张词卡有音标、发音、例句，难词还附了词根。</p>') +
    '</div><div class="stat-row">' +
      '<div class="stat stat-known"><b>' + all.known + '</b><span>已掌握</span></div>' +
      '<button class="stat stat-shaky" id="allShaky" type="button"' + (all.shaky ? '' : ' disabled') +
        '><b>' + all.shaky + '</b><span>待复习</span></button>' +
      '<div class="stat"><b>' + pool.length + '</b><span>总词条</span></div>' +
    '</div></div>' +
    '<div class="sweeps">' +
      (all.shaky ? '<button class="btn" id="sweepAll" type="button">整理错词 · ' + all.shaky + ' 个重过一遍</button>' : '') +
      (all.shaky ? '<button class="btn btn-ghost" id="quizAll" type="button">测验错词 · ' + qCount(all.shaky) + ' 题</button>' : '') +
      (all.once ? '<button class="btn btn-ghost" id="sweepOnce" type="button">曾错过的词 · ' + all.once + ' 个</button>' : '') +
      (selCount() ? '<button class="btn btn-ghost" id="quizSel" type="button">测验选中的词 · ' + selCount() + ' 个</button>' : '') +
      (shuf ? '' :                                  // 导入、手动加、合并都落在原版那一套里
        '<button class="btn btn-ghost" id="openImp" type="button">导入词表</button>' +
        '<button class="btn btn-ghost" id="openAdd" type="button">手动添加</button>' +
        (store.custom.length >= 2
          ? '<button class="btn btn-ghost' + (merging ? ' on' : '') + '" id="mergeOn" type="button">' +
            (merging ? '✓ 挑要合并的单元' : '合并单元') + '</button>' : '')) +
    '</div>' +
    '<div class="unit-grid' + (merging ? ' merging' : '') + '">' + cards + '</div>' +
    '<div id="mergeSlot">' + mergeBarHtml() + '</div>';
  Array.prototype.forEach.call(view.querySelectorAll('.unit-card'), function (b) {
    b.onclick = function () {
      var uu = +b.dataset.u;
      if (merging) {
        if (!unitMeta(uu).imported) {
          mergeMsg = '原书那些单元是照着书页排的，动不得 —— 只有导入和手动加的单元能合并。';
          paintMerge(); return;
        }
        if (mergeSel[uu]) delete mergeSel[uu]; else mergeSel[uu] = 1;
        mergeMsg = '';
        b.classList.toggle('msel', !!mergeSel[uu]);
        paintMerge(); return;
      }
      dropOrder(); go({ name: 'unit', u: uu, tab: 'browse' });
    };
  });
  Array.prototype.forEach.call(view.querySelectorAll('[data-shelf]'), function (b) {
    b.onclick = function () {
      var want = b.dataset.shelf === '1';
      if (want === shuf) return;
      store.set.shuf = want; save();
      merging = false; mergeSel = {}; mergeTitle = ''; mergeMsg = '';   // 合并只管原版里的单元，换一套就收起来
      renderHome();
    };
  });
  var mo = document.getElementById('mergeOn');
  if (mo) mo.onclick = function () {
    merging = !merging;
    if (!merging) { mergeSel = {}; mergeTitle = ''; mergeMsg = ''; }
    renderHome();
  };
  wireMerge();
  function sweep() { startReview(pool.filter(shaky), shuf ? '乱序版错词' : '全部错词', { name: 'home' }); }
  var sb = document.getElementById('sweepAll'); if (sb) sb.onclick = sweep;
  var as = document.getElementById('allShaky'); if (as && all.shaky) as.onclick = sweep;
  var qa = document.getElementById('quizAll');
  if (qa) qa.onclick = function () { quiz = null; go({ name: 'quiz', scope: 'all' }); };
  var qs = document.getElementById('quizSel');
  if (qs) qs.onclick = function () { quiz = null; go({ name: 'quiz', scope: 'sel' }); };
  var ob = document.getElementById('sweepOnce');
  if (ob) ob.onclick = function () {
    startReview(pool.filter(function (w) { return lvl(w.i) === 3 && everShaky(w.i); }),
      '曾错过的词', { name: 'home' });
  };
  var oi = document.getElementById('openImp'); if (oi) oi.onclick = openImport;   // 乱序版里不摆这两个
  /* 得裹一层：openAdd(u, word) 第一个参数是单元号，直接当 onclick 会把
     MouseEvent 当成单元号传进去 —— addTarget 变成一个事件对象，
     点「添加」就只会说「这个单元不在了」。（第八次优化给 openAdd 加参数时漏掉的） */
  var oa = document.getElementById('openAdd'); if (oa) oa.onclick = function () { openAdd(); };
}

/* ================= UNIT ================= */
function unitHeader(u, tab) {
  var meta = unitMeta(u);
  var n = unitWords(u).filter(shaky).length;
  return '<button class="back" id="back" type="button">← 返回目录</button>' +
    '<div class="unit-head"><div>' +
      '<p class="eyebrow">' + esc(meta.t || ('UNIT ' + String(u).padStart(2, '0') + ' · 原书第 ' + u + ' 页')) +
        ' · ' + meta.n + ' 词</p>' +
      '<h1>' + esc(meta.a) + ' <span style="color:var(--ink-3);font-weight:400">—</span> ' + esc(meta.b) + '</h1>' +
    '</div>' +
    '<div class="head-tools">' +
      (meta.imported ? '<button class="btn btn-ghost" id="dropUnit" type="button">删掉这个单元</button>' : '') +
      (n ? '<button class="btn btn-ghost" id="sweepUnit" type="button">整理错词 · ' + n + '</button>' : '') +
      '<div class="tabs" role="tablist">' +
        ['browse:浏览', 'study:学习', 'quiz:测验', 'spell:拼写'].map(function (t) {
          var id = t.split(':')[0];
          return '<button role="tab" data-tab="' + id + '" aria-selected="' + (tab === id) + '">' + t.split(':')[1] + '</button>';
        }).join('') +
      '</div>' +
    '</div></div>';
}
function wireHeader(u) {
  var b = document.getElementById('back'); if (b) b.onclick = function () { dropOrder(); go({ name: 'home' }); };
  var sw = document.getElementById('sweepUnit');
  if (sw) sw.onclick = function () {
    startReview(unitWords(u).filter(shaky), unitShort(u) + ' 错词',
      { name: 'unit', u: u, tab: 'browse' });
  };
  var dr = document.getElementById('dropUnit');
  if (dr) dr.onclick = function () {
    if (!confirm('删掉这个导入的单元？里面的词和它们的进度都会一起没有。')) return;
    store.custom = store.custom.filter(function (c) { return c.u !== u; });
    unitWords(u).forEach(function (w) { delete store.prog[w.i]; delete store.hist[w.i];
      delete store.sel[w.i]; delete store.star[w.i]; delete store.col[w.i]; });
    save(); mountCustom(); dropOrder(); go({ name: 'home' });
  };
  Array.prototype.forEach.call(view.querySelectorAll('.tabs button'), function (t) {
    t.onclick = function () { go({ name: 'unit', u: u, tab: t.dataset.tab }); };
  });
}
/* 答题卡本来是照着原书一页 68 个词设计的。导入的词表动辄上千，
   1200 个点摞起来将近 2000px：侧栏比视口高好几倍，sticky 就失效了，
   窄屏上答题卡还排在卡片前面，得往下滚两千多像素才看得见要背的词。
   现在给点阵一个高度上限、内部滚动，并在渲染后把当前那个点滚进视野；
   标题旁边直接写「第 N / M」，不用再去点阵里找自己在哪。（第七次优化 2） */
var RAIL_BIG = 120;                  // 跟 rail-big 那条线对齐：超过这个数才值当虚拟滚动
var RAIL_OVERSCAN = 6;                // 视口外再多渲染几行，滚快了不露白
function railBtn(w, n, curIdx) {
  return '<button class="rail-b ' + cls(w.i) + (n === curIdx ? ' cur' : '') +
    (store.sel[w.i] ? ' sel' : '') + '" data-n="' + n + '" data-i="' + w.i +
    '" data-col="' + colOf(w.i) + '" type="button" title="' + esc(w.w) +
    '" aria-label="' + esc(w.w) + '"></button>';
}
function railHtml(ws, curIdx, pick) {
  var big = ws.length > RAIL_BIG, usedCol = {};
  ws.forEach(function (w) { var c = colOf(w.i); if (c) usedCol[c] = 1; });
  var colLegend = COLORS.filter(function (c) { return usedCol[c[0]]; }).map(function (c) {
    return '<div class="cl ' + c[0] + '"><i></i>' + c[1] + '</div>';
  }).join('');
  /* 大单元的点阵留空，交给 railMount() 去虚拟滚动（第十六次优化 1）；
     普通单元没几个词，照旧一次摆完，没必要多冒一份风险。 */
  return '<aside class="rail' + (big ? ' rail-big' : '') + (pick ? ' picking' : '') + '">' +
    '<p class="rail-title">答题卡' +
      (curIdx >= 0 ? '<span class="rail-at">' + (curIdx + 1) + ' / ' + ws.length + '</span>'
                   : '<span class="rail-at">' + ws.length + ' 词</span>') + '</p>' +
    '<div class="rail-grid">' +
    (big ? '' : ws.map(function (w, n) { return railBtn(w, n, curIdx); }).join('')) +
    '</div><div class="rail-legend"><div class="k"><i></i>认识</div>' +
    '<div class="k h"><i></i>认识（曾错过）</div>' +
    '<div class="x"><i></i>不认识</div><div><i></i>未学</div></div>' +
    (colLegend ? '<div class="rail-legend rail-cols">' + colLegend + '</div>' : '') +
    (pick ? '<p class="rail-picktip">选择模式：点／拖答题卡上的点，圈一段词</p>' : '') +
    '</aside>';
}
/* 学习页每换一个词整页重画，点阵也是新的。原来每次都把当前那个点滚到正中，
   词一多，每换一行点阵就跟着挪一下，看着晃（第二十二次优化）。现在记住上次滚到哪，
   同一批词接着那个位置；当前的点还在视野里就不动，出去了才往前翻，让它落在上面第二行。 */
var railKeep = { key: '', top: 0 };
function railKey(ws) { return ws.length + ':' + ws[0].i + ':' + ws[ws.length - 1].i; }
function railPlace(g, key, y, h, center) {   // y：当前那个点在点阵内容里的上沿；h：它的高（含行距）
  var top = railKeep.key === key ? railKeep.top : g.scrollTop;
  if (center) top = y - (g.clientHeight - h) / 2;
  else if (y < top || y + h > top + g.clientHeight) top = y - h;
  g.scrollTop = Math.max(0, top);
  railKeep = { key: key, top: g.scrollTop };
}
/* 点阵内部滚动之后，得把当前那个点自己送到眼前（非大单元：点都在，直接量它的位置） */
function scrollRail(ws, center) {
  var g = view.querySelector('.rail-grid'), c = g && g.querySelector('.rail-b.cur');
  if (!g || !c || !ws || !ws.length) return;
  if (g.scrollHeight <= g.clientHeight + 4) return;
  /* 用 rect 差值而不是 offsetTop —— offsetTop 是相对定位祖先算的，
     点阵本身没定位，再加上内边距，直接用会算歪。 */
  var key = railKey(ws);
  if (railKeep.key === key) g.scrollTop = railKeep.top;
  var gr = g.getBoundingClientRect(), cr = c.getBoundingClientRect();
  var gap = parseFloat(getComputedStyle(g).rowGap) || 0;
  railPlace(g, key, g.scrollTop + cr.top - gr.top, cr.height + gap, center);
  g.addEventListener('scroll', function () { railKeep = { key: key, top: g.scrollTop }; }, { passive: true });
}

/* ---------- 答题卡虚拟滚动（第十六次优化 1） ----------
   大单元（超过 RAIL_BIG 词）才走这条路：点阵只真的渲染视口内、外加上下各
   RAIL_OVERSCAN 行余量的按钮，其余的行拿两个占位块（前面一个、后面一个）
   把高度撑住 —— 滚动条该多长还是多长，只是撑着的那些行不占真实节点。
   滚动、断点变化（窄屏点阵会从 4 列变 17 列）时重新算一遍该画哪几行。
   行高算不出来——CSS 靠 aspect-ratio 从列宽推高度，得先真的画一个按钮才量得到。
   于是先按一个偏小的估计（宁可多渲染几行也不能算漏了）画一遍，量出真实高度
   跟估计对不上就用真实值再画一遍；这之后滚动只管重算该露哪几行，不用再量。 */
function railMount(ws, curIdx) {
  if (railRO) { railRO.disconnect(); railRO = null; }
  if (ws.length <= RAIL_BIG) return null;
  var grid = view.querySelector('.rail-grid');
  if (!grid) return null;
  var cols = railCols(), rowH = 14, measured = false, at = curIdx >= 0 ? curIdx : 0;
  var key = railKey(ws), center = false;
  function totalRows() { return Math.max(1, Math.ceil(ws.length / cols)); }
  function maxH() { return parseFloat(getComputedStyle(grid).maxHeight) || 400; }
  function scrollToRow() {
    if (curIdx < 0) return;
    railPlace(grid, key, Math.floor(at / cols) * rowH, rowH, center);
  }
  function paint() {
    var rows = totalRows(), h = Math.min(rows * rowH, maxH());
    grid.style.height = h + 'px';
    var vis = Math.max(1, Math.ceil(h / rowH));
    var first = Math.max(0, Math.floor(grid.scrollTop / rowH) - RAIL_OVERSCAN);
    var last = Math.min(rows - 1, first + vis + RAIL_OVERSCAN * 2);
    var startI = first * cols, endI = Math.min(ws.length, (last + 1) * cols);
    var before = first * rowH, after = (rows - 1 - last) * rowH;
    grid.innerHTML =
      (before > 0 ? '<div class="rail-sp" style="grid-column:1/-1;height:' + before + 'px"></div>' : '') +
      ws.slice(startI, endI).map(function (w, k) { return railBtn(w, startI + k, curIdx); }).join('') +
      (after > 0 ? '<div class="rail-sp" style="grid-column:1/-1;height:' + after + 'px"></div>' : '');
    if (!measured) {
      measured = true;
      var b = grid.querySelector('.rail-b');
      if (b) {
        var cs = getComputedStyle(grid), gap = parseFloat(cs.rowGap || cs.gap) || 0;
        var real = b.getBoundingClientRect().height + gap;
        if (real > 0 && Math.abs(real - rowH) > 1) { rowH = real; scrollToRow(); paint(); return; }
      }
    }
  }
  var raf = null;
  grid.addEventListener('scroll', function () {
    if (curIdx >= 0) railKeep = { key: key, top: grid.scrollTop };
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = null; paint(); });
  }, { passive: true });
  if (typeof ResizeObserver === 'function') {
    railRO = new ResizeObserver(function () {
      cols = railCols(); measured = false; rowH = 14; scrollToRow(); paint();
    });
    railRO.observe(grid);
  }
  /* 先画一遍把高度撑出来，scrollTop 才设得进去；再按落好的位置重画该露的那几行 */
  paint();
  if (curIdx >= 0) { scrollToRow(); paint(); }
  return {
    repaint: paint,
    jumpTo: function (n) {                  // 搜索跳过来找词：这时候还是放正中，一眼看到
      at = n; curIdx = n; center = true; scrollToRow(); paint(); center = false;
      var atEl = view.querySelector('.rail-at');
      if (atEl) atEl.textContent = (n + 1) + ' / ' + ws.length;
    }
  };
}
/* 大单元的点阵按钮会随滚动整批换掉，不能像小单元那样一个个点挂监听，
   靠事件委托在 .rail-grid 上接。学习页只是点一下跳到那个词。 */
function railWireJump(grid, onJump) {
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('.rail-b');
    if (b) onJump(+b.dataset.n);
  });
}
/* 浏览页多一层：不在选择模式时点一下跳去学习；选择模式下点／拖／Shift 点
   在点阵上圈一段词——跟小单元那套手感一样，只是范围可能超出当前渲染的窗口，
   那部分词直接改 store.sel，不需要真的有 DOM 节点。 */
function railWirePick(grid, ws, u, refresh, ctl) {
  function setSel(i, on) {
    if (on) store.sel[i] = 1; else delete store.sel[i];
    var row = view.querySelector('.row[data-i="' + i + '"]');
    if (row) row.classList.toggle('sel', on);
  }
  var hoverN = -1;
  railAnchor = -1;
  grid.addEventListener('mousedown', function (e) {
    if (!picking || e.button) return;
    var b = e.target.closest('.rail-b');
    if (!b) return;
    e.preventDefault();
    var n = +b.dataset.n, i = +b.dataset.i;
    if (e.shiftKey && railAnchor >= 0) {
      var a = Math.min(railAnchor, n), z = Math.max(railAnchor, n);
      for (var k = a; k <= z; k++) setSel(ws[k].i, true);
      railDrag = null; ctl.repaint(); refresh(); return;
    }
    railDrag = !store.sel[i];
    railAnchor = n;
    setSel(i, railDrag);
    b.classList.toggle('sel', railDrag);
    refresh();
  });
  grid.addEventListener('mouseover', function (e) {
    if (!picking || railDrag === null) return;
    var b = e.target.closest('.rail-b');
    if (!b || +b.dataset.n === hoverN) return;
    hoverN = +b.dataset.n;
    setSel(+b.dataset.i, railDrag);
    b.classList.toggle('sel', railDrag);
    refresh();
  });
  grid.addEventListener('click', function (e) {
    if (picking) return;
    var b = e.target.closest('.rail-b');
    if (b) go({ name: 'unit', u: u, tab: 'study', n: +b.dataset.n });
  });
}

/* ---- browse ---- */
/* 单元里的颜色分组条（第十次优化 3） */
function colBarHtml(u, ws) {
  var all = unitWords(u), t = colTally(all), cur = curFilter(u), used = [];
  COLORS.forEach(function (c) { if (t[c[0]]) used.push(c); });
  if (!used.length) {
    return '<div class="colbar"><span>分组</span>' +
      '<span class="col-tip">点上面的「选择」勾一批词，底下横幅上点个颜色 —— ' +
      '一个单元就能切成几小批，一批一批地背。</span></div>';
  }
  return '<div class="colbar"><span>分组</span>' +
    '<button class="chip' + (cur ? '' : ' on') + '" data-cf="" type="button">全部 ' + all.length + '</button>' +
    used.map(function (c) {
      return '<button class="chip chip-col ' + c[0] + (cur === c[0] ? ' on' : '') +
        '" data-cf="' + c[0] + '" type="button"><i></i>' + c[1] + ' ' + t[c[0]] + '</button>';
    }).join('') +
    (cur ? '<span class="col-tip">只看' + colName(cur) + '色这 ' + ws.length +
           ' 个 —— 学习、测验、拼写都只走这一批。</span>' : '') +
    '</div>';
}
function renderBrowse(u) {
  /* 从搜索结果跳过来找某个词：先把颜色筛选撤掉，免得那个词正好被筛在外面 */
  if (route.focus != null && curFilter(u)) setFilter(u, '');
  var ws = ordered(u), editing2 = editUnit === u, seq = unitSeq(u);
  var rows = ws.map(function (w, n) {
    return '<div class="row ' + cls(w.i) + (store.sel[w.i] ? ' sel' : '') +
      '" data-n="' + n + '" data-i="' + w.i + '" data-col="' + colOf(w.i) + '">' +
      (picking ? '<span class="row-c"></span>' : '') +
      '<div class="row-no" title="单元里第 ' + seq[w.i] + ' 个 · 编号 ' + w.i + '"><span class="dot"></span>' + seq[w.i] + '</div>' +
      '<div class="row-w">' + esc(w.w) + '</div>' +
      '<div class="row-p">' + esc(w.p) + '</div>' +
      '<div class="row-z' + (store.set.hideZh ? ' hidden' : '') + '">' + esc(w.z) + '</div>' +
      (editing2
        ? '<span class="row-edit">' +
            '<button data-edit="' + w.i + '" type="button" title="改这一条">✎</button>' +
            '<button data-del2="' + w.i + '" type="button" title="删掉这个词">×</button></span>'
        : '<button class="row-s' + (store.star[w.i] ? ' on' : '') + '" data-star="' + w.i + '" type="button" title="加入生词本">★</button>') +
      '</div>';
  }).join('');
  view.innerHTML = unitHeader(u, 'browse') +
    '<div class="sortbar"><span>排序</span>' +
      SORTS.map(function (s) {
        var name = s[0] === 'book' && unitMeta(u).ids ? '固定乱序' : s[1];   // 乱序单元的「原书顺序」就是那份写死的乱序
        return '<button class="chip' + (store.set.sort === s[0] ? ' on' : '') + '" data-sort="' + s[0] + '" type="button">' + name + '</button>';
      }).join('') +
      '<span class="sortbar-gap"></span>' +
      (unitMeta(u).imported
        ? '<button class="chip chip-edit' + (editing2 ? ' on' : '') + '" id="editToggle" type="button">' +
            (editing2 ? '✓ 编辑中' : '编辑') + '</button>' +
          (editing2 ? '<button class="chip" id="addHere" type="button">＋ 添加</button>' : '')
        : '') +
      pickBarHtml() +
    '</div>' + colBarHtml(u, ws) +
    '<div class="unit-body"><div><div class="rows' + (picking ? ' picking' : '') + '">' + rows + '</div></div>' +
      railHtml(ws, -1, picking) + '</div>' +
    '<div id="selbarSlot">' + selBarHtml() + '</div>';
  wireHeader(u);
  var railCtl = railMount(ws, -1);
  var back = { name: 'unit', u: u, tab: 'browse' };
  Array.prototype.forEach.call(view.querySelectorAll('[data-sort]'), function (b) {
    b.onclick = function () { store.set.sort = b.dataset.sort; save(); dropOrder(); renderBrowse(u); };
  });
  Array.prototype.forEach.call(view.querySelectorAll('[data-cf]'), function (b) {
    b.onclick = function () { setFilter(u, b.dataset.cf); quiz = null; spell = null; renderBrowse(u); };
  });
  var et = document.getElementById('editToggle');
  if (et) et.onclick = function () { editUnit = editing2 ? null : u; picking = false; renderBrowse(u); };
  var ah = document.getElementById('addHere');
  if (ah) ah.onclick = function () { openAdd(u); };
  Array.prototype.forEach.call(view.querySelectorAll('[data-edit]'), function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      var i = +b.dataset.edit, hit = null;
      ws.forEach(function (x) { if (x.i === i) hit = x; });
      if (hit) openAdd(u, hit);
    };
  });
  Array.prototype.forEach.call(view.querySelectorAll('[data-del2]'), function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      var i = +b.dataset.del2, hit = null;
      ws.forEach(function (x) { if (x.i === i) hit = x; });
      if (hit && confirm('把「' + hit.w + '」从这个单元里删掉？')) dropWord(i);
    };
  });
  wirePickBar(ws, function () { renderBrowse(u); });
  wireSelBar(back);
  wirePick(back);
  Array.prototype.forEach.call(view.querySelectorAll('.row'), function (r) {
    r.onclick = function (e) {
      if (picking || e.target.dataset.star) return;   // 选择模式下由 mousedown 接管
      if (e.target.dataset.edit || e.target.dataset.del2) return;
      go({ name: 'unit', u: u, tab: 'study', n: +r.dataset.n });
    };
  });
  Array.prototype.forEach.call(view.querySelectorAll('[data-star]'), function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      var i = +b.dataset.star;
      if (store.star[i]) delete store.star[i]; else store.star[i] = 1;
      b.classList.toggle('on'); save(); starCount();
    };
  });
  /* 答题卡的点：不在选择模式时点一下跳去学习；在选择模式时，点／拖／Shift 点
     就在这排点上圈一段词，跟列表里那套一样，选完底部横幅就能直接测验／拼写／逐个过。
     大单元（railCtl 非空）走事件委托，按钮会随滚动整批换掉，不能一个个点挂监听。 */
  function railRefresh() {
    save();
    var slot = document.getElementById('selbarSlot');
    if (slot) { slot.innerHTML = selBarHtml(); wireSelBar(back); }
  }
  if (railCtl) {
    railWirePick(view.querySelector('.rail-grid'), ws, u, railRefresh, railCtl);
  } else {
    var railBs = Array.prototype.slice.call(view.querySelectorAll('.rail-b'));
    (function () {
      function railPaint(b, on) {
        var i = +b.dataset.i;
        if (on) store.sel[i] = 1; else delete store.sel[i];
        b.classList.toggle('sel', on);
        var row = view.querySelector('.row[data-i="' + i + '"]');
        if (row) row.classList.toggle('sel', on);
      }
      railAnchor = -1;
      railBs.forEach(function (b, n) {
        b.addEventListener('mousedown', function (e) {
          if (!picking || e.button) return;
          e.preventDefault();
          if (e.shiftKey && railAnchor >= 0) {
            var a = Math.min(railAnchor, n), z = Math.max(railAnchor, n);
            for (var k = a; k <= z; k++) railPaint(railBs[k], true);
            railDrag = null; railRefresh(); return;
          }
          railDrag = !store.sel[+b.dataset.i];
          railAnchor = n;
          railPaint(b, railDrag);
          railRefresh();
        });
        b.addEventListener('mouseenter', function () {
          if (!picking || railDrag === null) return;
          railPaint(b, railDrag); railRefresh();
        });
        b.onclick = function () {
          if (picking) return;
          go({ name: 'unit', u: u, tab: 'study', n: +b.dataset.n });
        };
      });
    })();
  }
  /* 从搜索结果跳过来的：把那一行送到眼前，闪一下告诉你在哪（第七次优化 1）。
     go() 渲染完会把页面拉回顶部，所以得排到它后面再滚。 */
  if (route.focus != null) {
    var fi = route.focus;
    route.focus = null;
    setTimeout(function () {
      var row = view.querySelector('.row[data-i="' + fi + '"]');
      if (!row) return;
      row.scrollIntoView({ block: 'center' });
      row.classList.add('found');
      var n = +row.dataset.n;
      if (railCtl) railCtl.jumpTo(n);
      else {
        var rb = view.querySelectorAll('.rail-b')[n];
        if (rb) { rb.classList.add('cur'); scrollRail(ws, true); }
        var at = view.querySelector('.rail-at');
        if (at) at.textContent = (n + 1) + ' / ' + ws.length;
      }
      setTimeout(function () { row.classList.remove('found'); }, 1800);
    }, 0);
  }
}

/* ---- word card ---- */
function railCols() {                       // how many bubbles make up one 答题卡 row
  var g = view.querySelector('.rail-grid');
  if (!g) return 4;
  var n = getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length;
  return n || 4;
}
function sayKey(k) {                       // P 单词 · S 例句 · D 生成的例句
  var b = view.querySelector('.speak[data-key="' + k + '"]');
  if (b) { b.click(); return true; }
  return false;
}

var RATE_BAR =
  '<div class="rate">' +
    '<button class="r0" data-lvl="1" type="button">不认识<small>1</small></button>' +
    '<button class="r2" data-lvl="3" type="button">认识<small>3</small></button>' +
  '</div>';

function exHtml(e, t, word, key, extra) {
  /* 中文翻译可以先蒙起来（设置里开），点一下才显形 —— 先自己读英文，再对答案 */
  var veil = store.set.hideEx ? ' veil' : '';
  return '<div class="ex' + (extra || '') + '">' +
    '<button class="speak" data-say="' + esc(e) + '" data-key="' + key +
      '" type="button" aria-label="朗读例句（快捷键 ' + key + '）">' + SPK + '<kbd>' + key + '</kbd></button>' +
    '<div class="ex-body"><p class="ex-en">' + bold(e, word) + '</p>' +
    (t ? '<p class="ex-zh' + veil + '"' + (veil ? ' title="点一下看翻译"' : '') + '>' + zhEx(t) + '</p>' : '') +
    '</div></div>';
}
function cardHtml(w, revealed, u) {
  var r = rich(w), gs = gen(w), body = '';
  if (u == null) u = w.u;
  var seq = unitSeq(u)[w.i], tot = unitMeta(u).n;
  if (!revealed) {
    /* 提示：先给例句，中文压着不给（第三次优化 8）。自己生成／加的例句也一起给（第二十二次优化） */
    if (store.set.hint && ((r && r.e) || gs.length)) {
      body += '<div class="blk hintblk"><p class="blk-l">例句提示</p>' +
        (r && r.e ? exHtml(r.e, '', w.w, 'S') : '') +
        gs.map(function (g, n) { return exHtml(g.e, '', w.w, n === 0 ? 'D' : '·', ' ex-gen'); }).join('') +
        '</div>';
    }
    body += '<div class="cover"><button type="button" id="reveal">显示释义 <span style="color:var(--ink-3)">空格</span></button></div>';
  } else {
    body = '<div class="w-zh">' + zhHtml(r && r.z ? r.z : w.z) +
      (r && r.z ? '<div class="fix">原书作：' + esc(w.z) + '　<span>此处按通行释义订正</span></div>' : '') + '</div>';
    if (r && r.r) {
      body += '<div class="blk"><p class="blk-l">词根</p><p class="root">' + rootHtml(r.r) + '</p></div>';
    }
    body += '<div class="blk"><p class="blk-l">例句</p>' +
      (r && r.e ? exHtml(r.e, r.t, w.w, 'S') : '<p class="pending">这个词的例句还没写好。</p>') + '</div>';
    body += '<div class="blk"><p class="blk-l">我的例句' +
        (gs.length ? ' · ' + gs.length : '') + '</p>' +
      gs.map(function (g, n) {
        return exHtml(g.e, g.t, w.w, n === 0 ? 'D' : '·', ' ex-gen') .replace('</div></div>',
          '</div><button class="ex-del" data-del="' + n + '" type="button" title="删掉这句">×</button></div>');
      }).join('') +
      '<button class="btn btn-ghost btn-gen" id="ownEx" type="button">＋ 自己加一句</button>' +
      '<button class="btn btn-ghost btn-gen" id="genEx" type="button" data-word="' + esc(w.w) + '">' +
        (gs.length ? '再生成一句' : '生成一句例句') + '</button>' +
      '<span class="gen-note" id="genNote"></span></div>';
  }
  var tags = lvl(w.i) === 3 && everShaky(w.i) ? '<span class="once">曾错过</span>' : '';
  var col = colOf(w.i);
  return '<div class="wcard ' + cls(w.i) + '" data-col="' + col + '">' +
    '<div class="stamp" id="stamp">已掌握</div>' +
    '<div class="w-no">NO. ' + w.i + ' · ' + esc(w.d ? '错词本 ' + w.d : (unitMeta(u).t || 'UNIT ' + String(u).padStart(2, '0'))) +
      (seq ? '<span class="w-seq">第 ' + seq + (tot ? ' / ' + tot : '') + ' 个</span>' : '') +
      tags + '</div>' +
    '<div class="w-head"><h2 class="w-word' + (/\s/.test(w.w) ? ' phrase' : '') + '">' + esc(w.w) + '</h2>' +
      '<span class="w-ipa">/' + ipaHtml(w.p) + '/</span>' +
      '<button class="speak" data-say="' + esc(w.w) + '" data-key="P" type="button" aria-label="朗读单词（快捷键 P）">' +
        SPK + '<kbd>P</kbd></button>' +
      '<button class="row-s' + (store.star[w.i] ? ' on' : '') + '" data-star="' + w.i + '" type="button" title="加入生词本" style="font-size:1.2rem">★</button>' +
      '<button class="col-b' + (col ? ' on ' + col : '') +
        '" id="colBtn" type="button" title="' + (col ? '标着' + colName(col) + '色' : '标个颜色分组') +
        '" aria-label="标个颜色分组">' + (col ? '' : '○') + '</button>' +
    '</div>' +
    /* 色盘摆在卡片里、卡头下面 —— 卡片是 overflow:hidden 的，浮在上面的小面板会被裁掉 */
    '<span class="col-pop" id="colPop" hidden>' + colDots('col-row', col, 1) + '</span>' +
    body + '</div>';
}
function wireCard(w, redraw) {
  Array.prototype.forEach.call(view.querySelectorAll('.ex-zh.veil'), function (p) {
    p.onclick = function () { p.classList.toggle('show'); };
  });
  Array.prototype.forEach.call(view.querySelectorAll('[data-say]'), function (b) {
    b.onclick = function () { speak(b.dataset.say, b); };
  });
  Array.prototype.forEach.call(view.querySelectorAll('[data-star]'), function (b) {
    b.onclick = function () {
      var i = +b.dataset.star;
      if (store.star[i]) delete store.star[i]; else store.star[i] = 1;
      b.classList.toggle('on'); save(); starCount();
    };
  });
  Array.prototype.forEach.call(view.querySelectorAll('[data-del]'), function (b) {
    b.onclick = function () {
      store.gen[w.w].splice(+b.dataset.del, 1);
      if (!store.gen[w.w].length) delete store.gen[w.w];
      save(); redraw();
    };
  });
  var cb = document.getElementById('colBtn'), cp = document.getElementById('colPop');
  if (cb && cp) cb.onclick = function () { cp.hidden = !cp.hidden; };
  Array.prototype.forEach.call(view.querySelectorAll('.col-pop [data-col]'), function (b) {
    b.onclick = function () { setCol(w.i, b.dataset.col); save(); redraw(); };
  });
  var g = document.getElementById('genEx');
  if (g) g.onclick = function () { generateExample(w, redraw); };
  var ow = document.getElementById('ownEx');
  if (ow) ow.onclick = function () { openEx(w, redraw); };
}
function renderStudy(u, n) {
  var ws = ordered(u);
  if (!ws.length && curFilter(u)) { setFilter(u, ''); ws = ordered(u); }   // 这一批被挑空了
  if (!ws.length) return;
  n = Math.max(0, Math.min(n || 0, ws.length - 1));
  var w = ws[n];
  var revealed = route.rev === true;
  view.innerHTML = unitHeader(u, 'study') +
    '<div class="unit-body"><div class="card-stage">' + cardHtml(w, revealed, u) +
      RATE_BAR +
      '<div class="study-nav"><button id="prev" type="button">← 上一个</button>' +
        '<span>' + (n + 1) + ' / ' + ws.length + '<small>↑↓ 换行 · 4–9 标色</small></span>' +
        '<button id="next" type="button">下一个 →</button></div>' +
    '</div>' + railHtml(ws, n) + '</div>';
  wireHeader(u);
  var railCtl = railMount(ws, n);

  function goN(k) { route.rev = false; go({ name: 'unit', u: u, tab: 'study', n: Math.max(0, Math.min(k, ws.length - 1)) }); }
  document.getElementById('prev').onclick = function () { goN(n - 1); };
  document.getElementById('next').onclick = function () { goN(n + 1); };
  var rv = document.getElementById('reveal');
  if (rv) rv.onclick = function () { route.rev = true; renderStudy(u, n); };
  wireCard(w, function () { renderStudy(u, n); });
  Array.prototype.forEach.call(view.querySelectorAll('.rate button'), function (b) {
    b.onclick = function () {
      var v = +b.dataset.lvl;
      setLvl(w.i, v);
      if (v === 3) {
        var s = document.getElementById('stamp');
        if (s) { s.classList.add('show'); }
        setTimeout(function () { goN(n + 1); }, 340);
      } else goN(n + 1);
    };
  });
  if (railCtl) {
    railWireJump(view.querySelector('.rail-grid'), goN);
  } else {
    Array.prototype.forEach.call(view.querySelectorAll('.rail-b'), function (b) {
      b.onclick = function () { goN(+b.dataset.n); };
    });
    scrollRail(ws);
  }
  if (revealed && store.set.auto && route.spoke !== w.i) { route.spoke = w.i; speak(w.w); }
}

/* ---- 整理错词：一轮过完为止，标「认识」才出列 ----
   第五次优化 8 把这个界面重做了一遍：原来只有一句「还剩 N 个」和一条细进度条，
   看不出自己清掉了多少、哪些又栽了。现在头上是三个数（已清 / 待过 / 又错了），
   下面一排点子按原始顺序摆开，一眼能看到整轮的地形。 */
function startReview(words, title, from) {
  var deck = shuffle(words.slice());
  go({ name: 'review', deck: deck, order: deck.slice(), total: deck.length,
       cleared: {}, asked: {}, title: title, from: from || { name: 'home' } });
}
function reviewDots() {
  var order = route.order || [], cur = route.deck[0];
  if (!order.length || order.length > 120) return '';   // 太多了就不画，光看进度条
  var live = {};
  route.deck.forEach(function (w) { live[w.i] = 1; });
  return '<div class="rv-dots">' + order.map(function (w) {
    var gone = route.cleared[w.i] || !live[w.i];
    var k = route.cleared[w.i] ? 'ok'
          : (cur && w.i === cur.i) ? 'cur'
          : route.asked[w.i] ? 'again'
          : live[w.i] ? '' : 'ok';
    return '<button class="rv-d ' + k + '" data-i="' + w.i + '"' + (gone ? ' disabled' : '') +
      ' type="button" title="' + esc(w.w) + '" aria-label="跳到 ' + esc(w.w) + '"></button>';
  }).join('') + '</div>';
}
/* 点进度条上某个点，就把复习队列转到那个词（已清掉的点不能点）。（第十一次优化 2） */
function jumpReview(i) {
  var d = route.deck, idx = -1;
  d.forEach(function (w, n) { if (w.i === i) idx = n; });
  if (idx <= 0) return;
  route.deck = d.slice(idx).concat(d.slice(0, idx));
  route.rev = false; route.spoke = null;
  renderReview();
}
function renderReview() {
  var deck = route.deck, done = route.total - deck.length;
  var again = 0;
  for (var k in route.asked) if (!route.cleared[k]) again++;
  var pct = route.total ? Math.round(done / route.total * 100) : 0;

  if (!deck.length) {
    view.innerHTML =
      '<button class="back" id="back" type="button">← 退出复习</button>' +
      '<div class="unit-head"><div><p class="eyebrow">整理错词 · ' + esc(route.title) + '</p>' +
      '<h1>全部过完了</h1></div></div>' +
      '<div class="quiz-wrap"><div class="score"><b>' + route.total + '</b>' +
      '<p class="lede" style="margin:14px auto 22px;text-align:center">这一轮的 ' + route.total +
      ' 个词都标成「认识」了。过几天再来 <b style="font-family:var(--display);font-size:1rem;color:var(--seal)">整理错词</b>，看看还剩几个。</p>' +
      '<div class="score-acts"><button class="btn" id="reviewDone" type="button">回到' +
      (route.from.name === 'home' ? '目录' : '单元') + '</button></div></div></div>';
    document.getElementById('back').onclick =
      document.getElementById('reviewDone').onclick = function () { go(route.from); };
    return;
  }

  var w = deck[0], revealed = route.rev === true;
  var head = '<button class="back" id="back" type="button">← 退出复习</button>' +
    '<div class="rv-head"><div>' +
      '<p class="eyebrow">整理错词 · ' + esc(route.title) +
        '<button class="rv-export" id="rvExport" type="button">导出这批词</button></p>' +
      '<h1>还剩 ' + deck.length + ' 个</h1>' +
    '</div><div class="rv-stats">' +
      '<div class="rv-s ok"><b>' + done + '</b><span>已清</span></div>' +
      '<div class="rv-s"><b>' + deck.length + '</b><span>待过</span></div>' +
      (again ? '<div class="rv-s warn"><b>' + again + '</b><span>又错了</span></div>' : '') +
    '</div></div>' +
    '<div class="rv-bar"><i style="width:' + pct + '%"></i><span>' + pct + '%</span></div>' +
    reviewDots();

  view.innerHTML = head +
    '<div id="rvExportBox" class="rv-export-box" hidden></div>' +
    '<div class="review-body"><div class="card-stage">' + cardHtml(w, revealed) + RATE_BAR +
      '<p class="review-note">标「认识」就划掉，标「不认识」排到队尾待会儿再问' +
        '<span class="q-keys"><kbd>空格</kbd> 翻卡 · <kbd>1</kbd><kbd>3</kbd> 评级 · ' +
        '<kbd>4</kbd>–<kbd>9</kbd> 标色 · <kbd>←</kbd><kbd>→</kbd> 先看别的</span></p>' +
    '</div></div>';
  document.getElementById('back').onclick = function () { go(route.from); };

  Array.prototype.forEach.call(view.querySelectorAll('.rv-d[data-i]'), function (b) {
    b.onclick = function () { if (!b.disabled) jumpReview(+b.dataset.i); };
  });
  var rex = document.getElementById('rvExport'), rbox = document.getElementById('rvExportBox');
  if (rex) rex.onclick = function () {
    if (!rbox.hidden) { rbox.hidden = true; return; }
    var txt = exportLines(route.order);
    rbox.innerHTML = '<textarea readonly rows="7" spellcheck="false"></textarea>' +
      '<div class="rv-export-act"><button class="chip" id="rvCopy" type="button">复制</button>' +
      '<span class="rv-export-hint">这一轮 ' + route.order.length +
      ' 个词 · Tab 分隔，可直接粘回「导入词表」的文本框</span></div>';
    var ta = rbox.querySelector('textarea');
    ta.value = txt; rbox.hidden = false; ta.focus(); ta.select();
    document.getElementById('rvCopy').onclick = function () { copyText(txt, this); };
  };

  var rv = document.getElementById('reveal');
  if (rv) rv.onclick = function () { route.rev = true; renderReview(); };
  wireCard(w, renderReview);
  Array.prototype.forEach.call(view.querySelectorAll('.rate button'), function (b) {
    b.onclick = function () { rateReview(+b.dataset.lvl); };
  });
  if (revealed && store.set.auto && route.spoke !== w.i) { route.spoke = w.i; speak(w.w); }
}
function cycleReview(dir) {                 // look at another word without grading this one
  var d = route.deck;
  if (d.length < 2) return;
  if (dir > 0) d.push(d.shift()); else d.unshift(d.pop());
  route.rev = false; route.spoke = null;
  renderReview();
}
function rateReview(v) {
  var w = route.deck[0];
  setLvl(w.i, v);
  route.rev = false; route.spoke = null;
  if (v === 3) {
    var st = document.getElementById('stamp');
    if (st) st.classList.add('show');
    route.cleared[w.i] = 1;
    route.deck.shift();
    setTimeout(renderReview, 340);
  } else {
    route.asked[w.i] = (route.asked[w.i] || 0) + 1;
    route.deck.push(route.deck.shift());
    renderReview();
  }
}

/* ---- quiz：题源有三种 ----
   · 单元测验、全站「测验错词」：只考标过「不认识」的词（第三次优化 4）
   · 「测验选中的词」：考自己在列表里勾出来的那一批（第四次优化 3） */
var quiz = null;
function quizPool(u, sel) {
  if (sel) return selWords();
  /* 单元里正筛着某个颜色，就只考这一批 —— ordered() 已经把筛选算进去了 */
  return (u == null ? homePool() : ordered(u)).filter(shaky);
}

/* ---- 干扰项按相似度挑（第五次优化 6） ----
   随机抽三个词当选项，往往一眼就能排除（问 abstruse，选项里出现「瘟疫」）。
   现在按「同词性 + 释义用字重合 + 拼写开头相同」打分，从最像的一批里再随机取，
   既不至于风马牛不相及，也不会每次都是同样三个。 */
function posOf(z) {
  var m = String(z).match(/\b(vt|vi|adj|adv|prep|conj|pron|interj|abbr|art|num|phr|n|v|a|ad)\./i);
  return m ? m[1].toLowerCase() : '';
}
var SIMC = {};
function simInfo(w) {
  var c = SIMC[w.i];
  if (!c) {
    var ch = {}, t = String(w.z).replace(/[^一-鿿]/g, '');
    for (var i = 0; i < t.length; i++) ch[t.charAt(i)] = 1;
    c = SIMC[w.i] = { pos: posOf(w.z), ch: ch, n: t.length, lw: w.w.toLowerCase() };
  }
  return c;
}
function similarity(a, b) {
  var A = simInfo(a), B = simInfo(b), s = 0;
  /* 词组的中文释义用字很少重合（介词短语翻出来的字面往往各写各的），下面「释义用字重合」
     那一档基本打不出分；词性相同这一档就得扛起来，不然单词只是巧合沾上一两个字
     也能挤进候选（第十三次优化）。 */
  if (A.pos && A.pos === B.pos) s += (A.pos === 'phr' ? 8 : 3);
  var hit = 0, n = 0;
  for (var k in A.ch) { n++; if (B.ch[k]) hit++; }
  if (n) s += 6 * hit / n;                       // 释义用字重合，最能造出「像是那个意思」的干扰项
  var i = 0, m = Math.min(A.lw.length, B.lw.length);
  while (i < m && A.lw.charAt(i) === B.lw.charAt(i)) i++;
  s += Math.min(i, 5) * 0.6;                     // 拼写开头相同：abstruse / abstract
  if (a.u === b.u) s += 0.4;                     // 原书同一页出现过
  return s;
}
function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function distractors(w, n) {
  var cand = [];
  WORDS.forEach(function (x) {
    if (x.i === w.i || !x.z || x.w === w.w || x.z === w.z) return;
    cand.push({ x: x, s: similarity(w, x) });
  });
  cand.sort(function (p, q) { return q.s - p.s; });
  var top = shuffle(cand.slice(0, Math.max(n * 8, 24)));
  var out = [], seen = {};
  for (var i = 0; i < top.length && out.length < n; i++) {
    var z = top[i].x.z;
    if (seen[z]) continue;                       // 两个选项写着同一句释义就没法选了
    seen[z] = 1; out.push(top[i].x);
  }
  return out;
}

function blankOut(sent, word) {
  var m = blankAt(sent, word);
  if (!m) return esc(sent);
  return esc(sent.slice(0, m.index)) + '<span class="blank">____</span>' +
    esc(sent.slice(m.index + m[0].length));
}
/* 能拿来出填空题的句子：内置例句，加上 AI 生成的和自己写的（第十次优化 2）。
   只收「真挖得出空」的句子 —— 挖不出空的填空题等于白问。 */
function clozeCands(w) {
  var out = [], r = rich(w);
  if (r && r.e && blankAt(r.e, w.w)) out.push({ e: r.e, t: r.t || '', from: 'book' });
  gen(w).forEach(function (g) {
    if (g.e && blankAt(g.e, w.w)) out.push({ e: g.e, t: g.t || '', from: g.mine ? 'mine' : 'ai' });
  });
  return out;
}
/* 每轮题数（第六次优化 1）。
   默认还是 20：一轮两三分钟，正好是retrieval练习该有的长度，再长准确率就掉了。
   真正卡人的从来不是这个上限，而是「剩下的词考没考到」看不见 ——
   所以除了让题数可调，结算页还给出「继续考剩下的 N 个」，
   接着考的是这一趟还没抽到的词，不会把刚做完的又抽一遍。 */
function buildQuiz(key, pool, swept) {
  var done = swept || {};
  var left = pool.filter(function (w) { return !done[w.i]; });
  if (!left.length) { done = {}; left = pool.slice(); }     // 一圈考完了就重新开始
  var n = +store.set.qn || 0;                               // 0 = 全部
  var ws = shuffle(left.slice());
  if (n > 0) ws = ws.slice(0, Math.min(n, ws.length));
  ws.forEach(function (w) { done[w.i] = 1; });
  var qs = ws.map(function (w) {
    /* 有例句的词有一半机会出成填空题，两种题型混着考；
       句子从「内置 + 生成 + 自己写的」里随机挑一句 —— 自己让 AI 生成的例句
       在词卡上看过一遍，再挖空考一次，正好是第二次见面。 */
    var cand = clozeCands(w);
    var cloze = !!cand.length && Math.random() < 0.5;
    var src = cloze ? cand[Math.floor(Math.random() * cand.length)] : null;
    return { w: w, cloze: cloze, src: src, sent: src ? blankOut(src.e, w.w) : '',
             opts: shuffle([w].concat(distractors(w, 3))) };
  });
  return { key: key, qs: qs, at: 0, right: 0, answered: false, waiting: false, wrong: [], swept: done };
}
function renderQuiz(u, sel) {
  var all = u == null;
  var shuf = all && !sel && !!store.set.shuf;       // 从乱序版首页点进来的，只考乱序版里的错词
  var key = sel ? 'sel' : all ? (shuf ? 'all-shuf' : 'all') : 'u' + u;
  var pool = quizPool(all ? null : u, sel);
  var head = all
    ? '<button class="back" id="back" type="button">← 返回目录</button>' +
      '<div class="unit-head"><div><p class="eyebrow">' +
        (sel ? '只考自己勾出来的那一批' : '只考' + (shuf ? '乱序版' : '') + '「整理错词」里的词') + '</p><h1>' +
        (sel ? '选中测验' : shuf ? '乱序版错词测验' : '错词测验') + '</h1></div></div>'
    : unitHeader(u, 'quiz');
  function wire() {
    if (all) document.getElementById('back').onclick = function () { go({ name: 'home' }); };
    else wireHeader(u);
  }
  var back = all ? { name: 'home' } : { name: 'unit', u: u, tab: 'quiz' };

  if (!pool.length) {
    view.innerHTML = head + '<div class="quiz-wrap"><div class="empty">' + (sel
      ? '<b>还没选词</b>到浏览页或生词本，点一下「选择」，勾出想考的词再回来。'
      : '<b>还没有错词</b>测验只从标过「不认识」的词里出题。' +
        '先去学习模式过一遍，把不会的标出来，这里就有题了。') + '</div></div>';
    wire();
    return;
  }
  if (!quiz || quiz.key !== key) quiz = buildQuiz(key, pool);
  if (quiz.at >= quiz.qs.length) {
    var missed = quiz.wrong.slice();
    var rest = pool.filter(function (w) { return !quiz.swept[w.i]; }).length;
    view.innerHTML = head + '<div class="quiz-wrap"><div class="score"><b>' + quiz.right + '/' + quiz.qs.length + '</b>' +
      '<p class="lede" style="margin:14px auto 22px;text-align:center">' +
      (missed.length ? '错了 ' + missed.length + ' 个：' + missed.map(function (w) { return esc(w.w); }).join('、')
                     : (sel ? '这批词你已经拿得很稳了。' : '这批错词你已经拿得很稳了。')) +
      (rest ? '<br><span class="score-rest">题库里还有 ' + rest + ' 个这一趟没抽到。</span>' : '') + '</p>' +
      '<div class="score-acts">' +
        (missed.length ? '<button class="btn" id="sweepQuiz" type="button">整理错题 · 重过这 ' + missed.length + ' 个</button>' : '') +
        (rest ? '<button class="btn' + (missed.length ? ' btn-ghost' : '') + '" id="more" type="button">继续考剩下的 ' + rest + ' 个</button>' : '') +
        '<button class="btn btn-ghost" id="again" type="button">再测一次</button>' +
      '</div></div></div>';
    wire();
    document.getElementById('again').onclick = function () { quiz = null; renderQuiz(u, sel); };
    var mo = document.getElementById('more');
    if (mo) mo.onclick = function () { quiz = buildQuiz(key, pool, quiz.swept); renderQuiz(u, sel); };
    var sq = document.getElementById('sweepQuiz');
    if (sq) sq.onclick = function () {
      startReview(missed, (sel ? '选中的词' : all ? '错词' : 'UNIT ' + String(u).padStart(2, '0')) + '测验错题', back);
    };
    return;
  }
  var q = quiz.qs[quiz.at];
  var stem = q.cloze
    ? '<p class="q-kind">填空 · 哪个词填进去合适</p><p class="q-cloze">' + q.sent + '</p>'
    : '<p class="q-kind">释义 · 这个词是什么意思</p><h2 class="q-stem">' + esc(q.w.w) + '</h2>' +
      '<p class="q-sub">/' + esc(q.w.p) + '　<button class="speak" data-say="' + esc(q.w.w) +
      '" type="button" aria-label="朗读" style="width:28px;height:28px;flex:0 0 28px;vertical-align:middle">' + SPK + '</button></p>';
  view.innerHTML = head + '<div class="quiz-wrap">' +
    '<div class="quiz-prog"><i style="width:' + (quiz.at / quiz.qs.length * 100) + '%"></i></div>' +
    stem +
    '<div class="opts">' + q.opts.map(function (o, n) {
      return '<button class="opt" data-i="' + o.i + '" data-n="' + (n + 1) + '" type="button">' +
        '<span class="k">' + (n + 1) + '</span><span>' + esc(q.cloze ? o.w : o.z) + '</span></button>';
    }).join('') +
      '<button class="opt opt-idk" id="idk" type="button">' +
        '<span class="k">0</span><span>不会 · 直接看答案</span></button>' +
    '</div>' +
    '<div id="quizAfter"></div>' +
    '<p class="quiz-foot">第 ' + (quiz.at + 1) + ' / ' + quiz.qs.length + ' 题 · 已答对 ' + quiz.right +
      '　<span class="q-keys">按 <kbd>1</kbd>–<kbd>4</kbd> 选，<kbd>0</kbd> 不会</span></p></div>';
  wire();
  Array.prototype.forEach.call(view.querySelectorAll('[data-say]'), function (b) { b.onclick = function () { speak(b.dataset.say, b); }; });

  function next() { quiz.at++; quiz.answered = false; quiz.waiting = false; renderQuiz(u, sel); }
  quiz.next = next;
  /* how: 'right' | 'wrong' | 'idk' */
  function settle(b, how) {
      if (quiz.answered) return;
      quiz.answered = true;
      var ok = how === 'right';
      Array.prototype.forEach.call(view.querySelectorAll('.opt'), function (x) {
        x.disabled = true;
        if (+x.dataset.i === q.w.i) { x.classList.add('right'); x.insertAdjacentHTML('beforeend', '<span class="mark">✓</span>'); }
      });
      if (ok) { quiz.right++; if (lvl(q.w.i) < 3) setLvl(q.w.i, 3); }
      else {
        if (how === 'wrong') { b.classList.add('wrong'); b.insertAdjacentHTML('beforeend', '<span class="mark">✕</span>'); }
        setLvl(q.w.i, 1); quiz.wrong.push(q.w);
      }
      /* 释义题答对就翻篇；答错要停下来看（第五次优化 3）。
         填空题即使选对了也停 —— 从句子里猜出该填哪个词，跟知道这个词什么意思
         是两件事，很可能只是记住了这句话（第六次优化 2）。 */
      if (ok && !q.cloze) { setTimeout(next, 480); return; }
      quiz.waiting = true;
      var r = rich(q.w);
      /* 刚才读的是哪句就回放哪句（把空填上），没有的话给内置例句 */
      var ex = q.src || (r && r.e ? { e: r.e, t: r.t, from: 'book' } : null);
      document.getElementById('quizAfter').innerHTML =
        '<div class="q-explain' + (ok ? ' good' : '') + '">' +
          '<p class="qx-tag' + (ok ? ' ok' : '') + '">' +
            (how === 'idk' ? '不会 · 那就看一眼' : ok ? '选对了 · 顺手把意思过一眼' : '这个词记一下') + '</p>' +
          '<div class="qx-head"><b>' + esc(q.w.w) + '</b>' +
            (q.w.p ? '<span class="qx-ipa">/' + esc(q.w.p) + '/</span>' : '') +
            '<button class="speak" data-say="' + esc(q.w.w) + '" type="button" aria-label="朗读">' + SPK + '</button>' +
          '</div>' +
          '<p class="qx-zh">' + zhHtml(r && r.z ? r.z : q.w.z) + '</p>' +
          (r && r.r ? '<p class="root qx-root">' + rootHtml(r.r) + '</p>' : '') +
          (ex ? '<p class="qx-ex">' + bold(ex.e, q.w.w) +
                  (ex.from === 'book' ? '' : '<span class="qx-from">' +
                    (ex.from === 'mine' ? '我写的例句' : 'AI 例句') + '</span>') + '</p>' +
                      /* 这里不管「藏起翻译」的设置 —— 已经答错了，正是要看的时候 */
                      (ex.t ? '<p class="qx-ext">' + zhEx(ex.t) + '</p>' : '') : '') +
          '<button class="btn" id="qNext" type="button">继续 <span class="q-keys">回车</span></button>' +
        '</div>';
      Array.prototype.forEach.call(view.querySelectorAll('#quizAfter [data-say]'), function (x) {
        x.onclick = function () { speak(x.dataset.say, x); };
      });
      document.getElementById('qNext').onclick = next;
      document.getElementById('qNext').focus();
  }
  quiz.settle = settle;
  Array.prototype.forEach.call(view.querySelectorAll('.opt[data-i]'), function (b) {
    b.onclick = function () { settle(b, +b.dataset.i === q.w.i ? 'right' : 'wrong'); };
  });
  /* 蒙一个也是 25% 的概率，蒙对了反而以为自己会了。
     给一个「不会」，按下去直接看答案，记一次错过。（第八次优化 5） */
  document.getElementById('idk').onclick = function () { settle(null, 'idk'); };
}
/* 测验里的键盘操作（第五次优化 4） */
function quizKey(e) {
  if (!quiz) return false;
  if (quiz.waiting) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); quiz.next(); return true; }
    return false;
  }
  if (quiz.answered) return false;
  if ('1234'.indexOf(e.key) >= 0) {
    var b = view.querySelector('.opt[data-n="' + e.key + '"]');
    if (b) { e.preventDefault(); b.click(); return true; }
  }
  if (e.key === '0') {
    var idk = document.getElementById('idk');
    if (idk) { e.preventDefault(); idk.click(); return true; }
  }
  return false;
}

/* ================= 拼写检测（第十次优化 5） =================
   看着中文和音标，把词拼出来。认得出 ≠ 写得出 —— 选择题里 abstruse 一眼能认，
   自己写就未必知道中间是 -stru- 还是 -stro-。
   拼错不动「认识／不认识」：那套记的是认不认得，两件事分开记，
   才不会把一个只是手生的词判成不会。写错的可以当场再来一轮，或者收进生词本。 */
var spell = null;
function buildSpell(key, pool, swept) {
  var done = swept || {};
  var left = pool.filter(function (w) { return !done[w.i]; });
  if (!left.length) { done = {}; left = pool.slice(); }      // 一圈写完了就重新开始
  var n = +store.set.qn || 0, ws = shuffle(left);
  if (n > 0) ws = ws.slice(0, Math.min(n, ws.length));
  ws.forEach(function (w) { done[w.i] = 1; });
  return { key: key, ws: ws, at: 0, right: 0, hinted: 0, wrong: [], answered: false, hint: 0, swept: done };
}
function normSp(t) {
  /* 先并空格再 trim，最后才削句末标点 —— 顺序反了的话，
     打成「at the expense of. 」（句号后面还带个空格）会被判成拼错。 */
  return String(t).toLowerCase().replace(/[\s\u00a0]+/g, ' ').trim().replace(/[.。!！?？]+$/, '').trim();
}
function markHtml(arr) {
  return arr.map(function (c) {
    return '<span class="' + (c[1] ? 'sp-ok' : 'sp-no') + '">' +
      (c[0] === ' ' ? '&nbsp;' : esc(c[0])) + '</span>';
  }).join('');
}
/* 词形：几个字母、哪儿断词一直摆在那儿，提示按一次多露一个字母 */
function spShape(word, hint) {
  var out = '';
  for (var i = 0; i < word.length; i++) {
    var ch = word.charAt(i);
    if (/\s/.test(ch)) { out += '<i class="sp-gap"></i>'; continue; }
    if (!/[A-Za-z]/.test(ch)) { out += '<i class="sp-c got">' + esc(ch) + '</i>'; continue; }
    out += '<i class="sp-c' + (i < hint ? ' got' : '') + '">' + (i < hint ? esc(ch) : '') + '</i>';
  }
  return out;
}
function renderSpell(u, sel) {
  var key = sel ? 'sel' : 'u' + u + (curFilter(u) ? ':' + curFilter(u) : '');
  var pool = sel ? selWords() : ordered(u);
  var head = sel
    ? '<button class="back" id="back" type="button">← 返回目录</button>' +
      '<div class="unit-head"><div><p class="eyebrow">只写自己勾出来的那一批</p>' +
      '<h1>拼写检测</h1></div></div>'
    : unitHeader(u, 'spell');
  function wire() {
    if (sel) document.getElementById('back').onclick = function () { go({ name: 'home' }); };
    else wireHeader(u);
  }
  var back = sel ? { name: 'home' } : { name: 'unit', u: u, tab: 'spell' };

  if (!pool.length) {
    view.innerHTML = head + '<div class="quiz-wrap"><div class="empty">' + (sel
      ? '<b>还没选词</b>到浏览页或生词本，点一下「选择」，勾出想写的词再回来。'
      : '<b>这里没有词</b>换个单元试试。') + '</div></div>';
    wire();
    return;
  }
  if (!spell || spell.key !== key) spell = buildSpell(key, pool);

  if (spell.at >= spell.ws.length) {
    var miss = spell.wrong.slice();
    var rest = pool.filter(function (w) { return !spell.swept[w.i]; }).length;
    view.innerHTML = head + '<div class="quiz-wrap"><div class="score">' +
      '<b>' + spell.right + '/' + spell.ws.length + '</b>' +
      '<p class="lede" style="margin:14px auto 22px;text-align:center">' +
        (miss.length ? '写错了 ' + miss.length + ' 个 —— 都在下面，对着看一眼差在哪。'
                     : '这一批你写得很稳。') +
        (spell.hinted ? '<br><span class="score-rest">其中 ' + spell.hinted + ' 个看了提示。</span>' : '') +
        (rest ? '<br><span class="score-rest">这个单元还有 ' + rest + ' 个这一趟没抽到。</span>' : '') +
      '</p>' +
      (miss.length ? '<div class="sp-list">' + miss.map(function (m) {
        var d = lcsMark(m.typed || '', m.w.w);
        return '<div class="sp-item"><b>' + esc(m.w.w) + '</b>' +
          '<span class="sp-you">' + (m.idk ? '<i class="sp-skip">没写</i>' : markHtml(d.a)) + '</span>' +
          '<span class="sp-z">' + esc(m.w.z) + '</span></div>';
      }).join('') + '</div>' : '') +
      '<div class="score-acts">' +
        (miss.length ? '<button class="btn" id="spRetry" type="button">只写错的这 ' + miss.length + ' 个</button>' : '') +
        (rest ? '<button class="btn' + (miss.length ? ' btn-ghost' : '') + '" id="spMore" type="button">继续写剩下的 ' + rest + ' 个</button>' : '') +
        (miss.length ? '<button class="btn btn-ghost" id="spStar" type="button">写错的加进生词本</button>' : '') +
        '<button class="btn btn-ghost" id="spAgain" type="button">再来一轮</button>' +
      '</div></div></div>';
    wire();
    document.getElementById('spAgain').onclick = function () { spell = null; renderSpell(u, sel); };
    var mo = document.getElementById('spMore');
    if (mo) mo.onclick = function () { spell = buildSpell(key, pool, spell.swept); renderSpell(u, sel); };
    var rt = document.getElementById('spRetry');
    if (rt) rt.onclick = function () {
      spell = buildSpell(key, miss.map(function (m) { return m.w; }));
      renderSpell(u, sel);
    };
    var stb = document.getElementById('spStar');
    if (stb) stb.onclick = function () {
      miss.forEach(function (m) { store.star[m.w.i] = 1; });
      save(); starCount(); stb.textContent = '已经加进生词本了'; stb.disabled = true;
    };
    return;
  }

  var w = spell.ws[spell.at], r = rich(w);
  view.innerHTML = head + '<div class="quiz-wrap">' +
    '<div class="quiz-prog"><i style="width:' + (spell.at / spell.ws.length * 100) + '%"></i></div>' +
    '<p class="q-kind">拼写 · 照着意思把这个词写出来</p>' +
    '<p class="sp-zh">' + zhHtml(r && r.z ? r.z : w.z) + '</p>' +
    '<p class="sp-sub">' + (w.p ? '<span class="sp-ipa">/' + esc(w.p) + '/</span>' : '') +
      '<button class="speak" data-say="' + esc(w.w) + '" type="button" aria-label="听一下这个词">' + SPK + '</button>' +
    '</p>' +
    '<p class="sp-shape">' + spShape(w.w, spell.hint) + '</p>' +
    '<div class="sp-box"><input id="spIn" type="text" autocomplete="off" autocapitalize="off" ' +
      'autocorrect="off" spellcheck="false" placeholder="在这儿拼"></div>' +
    '<div class="sp-acts">' +
      '<button class="btn" id="spGo" type="button">对答案 <span class="q-keys">回车</span></button>' +
      '<button class="chip" id="spHint" type="button">提示 · 露一个字母</button>' +
      '<button class="chip" id="spIdk" type="button">不会 · 直接看</button>' +
    '</div>' +
    '<div id="spAfter"></div>' +
    '<p class="quiz-foot">第 ' + (spell.at + 1) + ' / ' + spell.ws.length + ' 个 · 已写对 ' + spell.right + '</p></div>';
  wire();
  Array.prototype.forEach.call(view.querySelectorAll('[data-say]'), function (b) {
    b.onclick = function () { speak(b.dataset.say, b); };
  });

  var inp = document.getElementById('spIn');
  function next() { spell.at++; spell.answered = false; spell.hint = 0; renderSpell(u, sel); }
  function check(how) {
    if (spell.answered) return;
    var typed = inp.value || '';
    if (how !== 'idk' && !normSp(typed)) { inp.focus(); return; }
    spell.answered = true;
    var ok = how !== 'idk' && normSp(typed) === normSp(w.w);
    inp.disabled = true;
    inp.classList.add(ok ? 'good' : 'bad');
    Array.prototype.forEach.call(view.querySelectorAll('.sp-acts button'), function (b) { b.disabled = true; });
    if (ok) { spell.right++; if (spell.hint) spell.hinted++; }
    else spell.wrong.push({ w: w, typed: typed.trim(), idk: how === 'idk' });
    if (store.set.auto) speak(w.w);
    if (ok) {
      document.getElementById('spAfter').innerHTML =
        '<p class="sp-line good">✓ 对了' + (spell.hint ? ' · 看了提示' : '') + '</p>';
      setTimeout(next, 560);
      return;
    }
    var d = lcsMark(typed.trim(), w.w);
    var ex = (r && r.e) ? { e: r.e, t: r.t } : (gen(w)[0] || null);
    document.getElementById('spAfter').innerHTML =
      '<div class="q-explain">' +
        '<p class="qx-tag">' + (how === 'idk' ? '不会 · 看一眼怎么写' : '拼错了 · 差在标出来的这几个字母') + '</p>' +
        (how === 'idk' ? '' : '<p class="sp-diff"><span class="sp-l">你写的</span>' + markHtml(d.a) + '</p>') +
        '<p class="sp-diff"><span class="sp-l">正确</span>' + markHtml(d.b) + '</p>' +
        '<div class="qx-head"><b>' + esc(w.w) + '</b>' +
          (w.p ? '<span class="qx-ipa">/' + esc(w.p) + '/</span>' : '') +
          '<button class="speak" data-say="' + esc(w.w) + '" type="button" aria-label="朗读">' + SPK + '</button>' +
        '</div>' +
        '<p class="qx-zh">' + zhHtml(r && r.z ? r.z : w.z) + '</p>' +
        (ex && ex.e ? '<p class="qx-ex">' + bold(ex.e, w.w) + '</p>' : '') +
        '<button class="btn" id="spNext" type="button">继续 <span class="q-keys">回车</span></button>' +
      '</div>';
    Array.prototype.forEach.call(view.querySelectorAll('#spAfter [data-say]'), function (b) {
      b.onclick = function () { speak(b.dataset.say, b); };
    });
    var nb = document.getElementById('spNext');
    nb.onclick = next;
    nb.focus();
  }
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); check('go'); }
  });
  document.getElementById('spGo').onclick = function () { check('go'); };
  document.getElementById('spIdk').onclick = function () { check('idk'); };
  document.getElementById('spHint').onclick = function () {
    if (spell.answered) return;
    spell.hint = Math.min(spell.hint + 1, w.w.length);
    var sh = view.querySelector('.sp-shape');
    if (sh) sh.innerHTML = spShape(w.w, spell.hint);
    inp.focus();
  };
  inp.focus();
}

/* ================= AI 例句（第三次优化 6 · 第四次优化 2） =================
   三条路：
   · 在 claude.ai 上打开的 Artifact 版，页面可以直接问 Claude（sample 能力），
     不需要 Key，由观看者的账号计费；
   · 自己的 Anthropic API Key，浏览器直连 api.anthropic.com；
   · 自己的 DeepSeek API Key，浏览器直连 api.deepseek.com（第四次优化 2）。
   设置里选了哪家就走哪家；选 Anthropic 且没填 Key 时才回落到 sample。 */
var sampler = null;                       // claude.use('sample') 的结果，晚于首次渲染才到
if (window.claude && typeof window.claude.use === 'function') {
  try {
    window.claude.use('sample').then(function (s) {
      if (!s) return;
      sampler = s;
      var h = document.getElementById('aiHint');
      if (h) h.textContent = '这个版本能直接问 Claude，不用填 Key，由观看者的账号计费。' +
        '填了 Key 就改走你自己的 api.anthropic.com。';
      if (view.querySelector('#genEx')) render();
    }, function () {});
  } catch (e) {}
}
function aiKey() { return ((store.set.prov === 'deepseek' ? store.set.dskey : store.set.key) || '').trim(); }
function aiRoute() {
  if (store.set.prov === 'deepseek') return aiKey() ? 'deepseek' : '';
  if (aiKey()) return 'anthropic';
  return sampler ? 'sample' : '';
}
function aiReady() { return !!aiRoute(); }
/* 模型有时会把 JSON 裹在 ```json 里，剥掉再解析 */
function parseAiJson(txt) {
  var t = String(txt || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  return JSON.parse(t);
}

/* 生成例句的长度（第八次优化 4）。内置例句是 14–26 词，
   这里默认对齐到「中」，想要更短或更长可以在设置里改。 */
var EXLEN = { short: [10, 15], mid: [16, 24], long: [25, 35] };
function exRange() { return EXLEN[store.set.exlen] || EXLEN.mid; }
function exRangeText() { var r = exRange(); return r[0] + '-' + r[1]; }
var AI_SCHEMA = {
  type: 'object',
  properties: {
    e: { type: 'string', description: 'One English sentence where the target word carries the main meaning.' },
    t: { type: 'string', description: 'Chinese translation; wrap the fragment that renders the target word in ** **.' }
  },
  required: ['e', 't'],
  additionalProperties: false
};
function aiPrompt(w) {
  var r = rich(w), had = gen(w).map(function (g) { return g.e; });
  return 'You are writing a study example for a Chinese student preparing for the SAT.\n\n' +
    'Target word: ' + w.w + '\nIPA: ' + w.p + '\nChinese definition: ' + ((r && r.z) || w.z) + '\n' +
    (r && r.e ? 'An existing example (write a DIFFERENT one, new topic): ' + r.e + '\n' : '') +
    (had.length ? 'Already generated (avoid repeating): ' + had.join(' / ') + '\n' : '') +
    '\nWrite ONE new English sentence of ' + exRangeText() + ' words. Requirements:\n' +
    '- The target word must carry the sentence\'s main meaning: put it in the main clause, and make the rest of the sentence explain or depend on it. Do not use it as a throwaway modifier.\n' +
    '- Use the sense given in the Chinese definition.\n' +
    '- Natural, concrete, SAT-register English. No dictionary phrasing, no "which means".\n' +
    '- Then translate to natural Chinese, and wrap the words that render the target word in ** **. Mark exactly one fragment.\n' +
    '\nReturn only JSON: {"e": "<the English sentence>", "t": "<the Chinese translation>"}';
}
function askViaSample(prompt) {
  return sampler.json(prompt);
}
function askViaAnthropic(prompt, schema) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': (store.set.key || '').trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: store.set.model || 'claude-opus-5',
      max_tokens: 4000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: schema || AI_SCHEMA } },
      messages: [{ role: 'user', content: prompt }]
    })
  }).then(function (res) {
    return res.json().then(function (j) { return { ok: res.ok, j: j }; });
  }).then(function (out) {
    if (!out.ok) throw new Error((out.j && out.j.error && out.j.error.message) || 'HTTP 错误');
    if (out.j.stop_reason === 'refusal') throw new Error('模型拒答了，换个词再试。');
    return parseAiJson((out.j.content || []).filter(function (b) { return b.type === 'text'; })
      .map(function (b) { return b.text; }).join(''));
  });
}
/* DeepSeek 是 OpenAI 兼容的 /chat/completions，而且服务端本身就发 CORS 头，
   所以浏览器可以直连，不用中间服务器。json_object 模式要求提示词里出现 json 字样，
   aiPrompt 结尾那句「Return only JSON」正好满足。 */
function askViaDeepSeek(prompt, plain) {
  var body = {
    model: store.set.dsmodel || 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1500
  };
  if (!plain) body.response_format = { type: 'json_object' };
  return fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer ' + aiKey()
    },
    body: JSON.stringify(body)
  }).then(function (res) {
    return res.json().then(function (j) { return { ok: res.ok, j: j }; });
  }).then(function (out) {
    if (!out.ok) {
      var msg = (out.j && out.j.error && out.j.error.message) || 'HTTP 错误';
      /* 万一某个模型不吃 json_object，就退回普通模式再来一次 ——
         提示词本来就要求「Return only JSON」，parseAiJson 也能剥掉 ``` 围栏。 */
      if (!plain && /response_format|json/i.test(msg)) return askViaDeepSeek(prompt, true);
      throw new Error(msg);
    }
    var c = out.j.choices && out.j.choices[0];
    if (!c || !c.message) throw new Error('返回里没有内容。');
    return parseAiJson(c.message.content);
  });
}
function askAI(route, prompt, schema) {
  return route === 'sample' ? askViaSample(prompt)
       : route === 'deepseek' ? askViaDeepSeek(prompt)
       : askViaAnthropic(prompt, schema);
}
function aiErr(err, route) {
  var m = String((err && (err.message || err.code)) || err);
  if (/not_granted/.test(m)) return '这次没拿到生成权限。';
  if (/rate_limited/.test(m)) return '请求太频繁了，等一会儿再试。';
  if (/cancelled/.test(m)) return '生成被取消了。';
  if (/Failed to fetch|NetworkError|load failed/i.test(m)) {
    return '连不上 ' + (route === 'deepseek' ? 'api.deepseek.com' : 'api.anthropic.com') + '（检查网络或 Key 权限）。';
  }
  if (/Unexpected token|JSON/i.test(m)) return '返回的不是干净的 JSON，再试一次。';
  return m;
}
function generateExample(w, redraw) {
  var note = document.getElementById('genNote'), btn = document.getElementById('genEx');
  function say(msg, bad) { if (note) { note.textContent = msg; note.className = 'gen-note' + (bad ? ' bad' : ''); } }
  var route = aiRoute();
  if (!route) {
    var ds = store.set.prov === 'deepseek';
    say('先到设置里填 ' + (ds ? 'DeepSeek' : 'Anthropic') + ' API Key。', 1);
    openSettings(ds ? 'dsField' : 'aiField');
    return;
  }
  if (btn) btn.disabled = true;
  say(route === 'sample' ? '正在问 Claude…' : route === 'deepseek' ? '正在问 DeepSeek…' : '正在生成…');
  var ask = askAI(route, aiPrompt(w));
  ask.then(function (obj) {
    if (!obj || !obj.e) throw new Error('返回里没有例句。');
    if (!store.gen[w.w]) store.gen[w.w] = [];
    store.gen[w.w].push({ e: String(obj.e).trim(), t: String(obj.t || '').trim() });
    save(); redraw();
  }).catch(function (err) {
    if (btn) btn.disabled = false;
    say('生成失败：' + aiErr(err, route), 1);
  });
}

/* ================= 自己加例句（第九次优化 1）=================
   两条路：直接写一句；或者把读到的一整段话粘进来，
   本地挑出含这个词的句子（不用联网、不用 Key），再按需要让模型翻一下。
   顺带把这段话里出现的、你词库里有的词都认出来 —— 读一篇东西，
   一次就能看清自己已经学过哪些、这个词长在什么样的句子里。 */
var exFor = null, exRedraw = null, exMode = 'write', exHits = [];
var ABBR = /\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|e\.g|i\.e|approx|Fig|No)\.$/i;
function splitSentences(txt) {
  var t = String(txt).replace(/\s+/g, ' ').trim(), out = [], buf = '';
  for (var i = 0; i < t.length; i++) {
    buf += t.charAt(i);
    if ('.!?'.indexOf(t.charAt(i)) >= 0 && (i + 1 >= t.length || t.charAt(i + 1) === ' ')) {
      if (ABBR.test(buf) || /\d\.$/.test(buf)) continue;   // Mr. / U.S. / 1.5 不算句号
      out.push(buf.trim()); buf = '';
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
/* 这段话里出现了词库里的哪些词 */
function wordsInPassage(txt) {
  var t = ' ' + String(txt).replace(/\s+/g, ' ') + ' ', seen = {}, hit = [];
  WORDS.forEach(function (w) {
    if (w.w.length < 4 || seen[w.w.toLowerCase()]) return;
    if (wordRe(w.w).test(t)) { seen[w.w.toLowerCase()] = 1; hit.push(w); }
  });
  return hit;
}
function openEx(w, redraw) {
  exFor = w; exRedraw = redraw; exMode = 'write'; exHits = [];
  document.getElementById('exTitle').textContent = '给「' + w.w + '」加一句例句';
  document.getElementById('exEn').value = '';
  document.getElementById('exZh').value = '';
  document.getElementById('exPara').value = '';
  document.getElementById('exFound').innerHTML = '';
  paintExMode();
  exSay('');
  document.getElementById('exModal').hidden = false;
  document.getElementById('exEn').focus();
}
function exSay(msg, bad) {
  var n = document.getElementById('exNote');
  n.textContent = msg || '';
  n.className = 'add-note' + (bad ? ' bad' : '');
}
function paintExMode() {
  document.getElementById('exWrite').hidden = exMode !== 'write';
  document.getElementById('exGrab').hidden = exMode !== 'grab';
  document.getElementById('exTr').hidden = !aiReady();
  Array.prototype.forEach.call(document.querySelectorAll('[data-exmode]'), function (b) {
    b.classList.toggle('on', b.dataset.exmode === exMode);
  });
}
function exScan() {
  var txt = document.getElementById('exPara').value || '';
  if (!txt.trim()) { exSay('先把那段话粘进来。', 1); return; }
  var re = wordRe(exFor.w);
  var sents = splitSentences(txt).filter(function (x) { return re.test(x); });
  exHits = wordsInPassage(txt).filter(function (x) { return x.w !== exFor.w; });
  var box = document.getElementById('exFound');
  box.innerHTML =
    (sents.length
      ? '<p class="add-l">含「' + esc(exFor.w) + '」的句子 · ' + sents.length + ' 句（点一句选中）</p>' +
        sents.map(function (x, n) {
          return '<button class="ex-pick" data-pick="' + n + '" type="button">' + bold(x, exFor.w) + '</button>';
        }).join('')
      : '<p class="add-l">这段话里没找到含「' + esc(exFor.w) + '」的句子。</p>') +
    (exHits.length
      ? '<p class="add-l">这段话里还认出你词库里的 ' + exHits.length + ' 个词</p><div class="ex-hits">' +
        exHits.slice(0, 40).map(function (x) {
          return '<button class="add-chip ex-hit" data-jump="' + x.i + '" title="' + esc(x.z) + '">' +
            esc(x.w) + '</button>';
        }).join('') +
        (exHits.length > 40 ? '<span class="add-l">…还有 ' + (exHits.length - 40) + ' 个</span>' : '') +
        '</div>'
      : '');
  Array.prototype.forEach.call(box.querySelectorAll('[data-pick]'), function (b) {
    b.onclick = function () {
      var x = sents[+b.dataset.pick];
      document.getElementById('exEn').value = x;
      document.getElementById('exZh').value = '';
      exMode = 'write'; paintExMode();
      exSay('挑好了，可以直接「加上」，也可以先「翻译这句」。');
    };
  });
  Array.prototype.forEach.call(box.querySelectorAll('[data-jump]'), function (b) {
    b.onclick = function () {
      var i = +b.dataset.jump, hit = null;
      WORDS.forEach(function (x) { if (x.i === i) hit = x; });
      if (!hit) return;
      document.getElementById('exModal').hidden = true;
      go({ name: 'unit', u: hit.u, tab: 'study', n: Math.max(0, posInUnit(hit.u, hit.i)), rev: true });
    };
  });
  exSay(sents.length ? '挑出 ' + sents.length + ' 句。' : '换一段话试试。', !sents.length);
}
function trPrompt(w, sent) {
  var r = rich(w);
  return 'Translate the following English sentence into natural, idiomatic Chinese for a Chinese student.\n\n' +
    'Sentence: ' + sent + '\n' +
    'The word being studied is "' + w.w + '" (' + ((r && r.z) || w.z) + ').\n\n' +
    'Requirements:\n' +
    '- Natural Chinese, not word-by-word.\n' +
    '- Wrap the words that render "' + w.w + '" in ** **. Mark exactly one fragment.\n' +
    '\nReturn only JSON: {"t": "<the Chinese translation>"}';
}
var TR_SCHEMA = {
  type: 'object',
  properties: { t: { type: 'string', description: 'Chinese translation; wrap the fragment rendering the target word in ** **.' } },
  required: ['t'],
  additionalProperties: false
};
function exTranslate() {
  var en = (document.getElementById('exEn').value || '').trim();
  if (!en) { exSay('先写一句英文，或者从上面挑一句。', 1); return; }
  var route = aiRoute();
  if (!route) { exSay('要翻译得先到设置里填 API Key。', 1); return; }
  var btn = document.getElementById('exTr');
  btn.disabled = true;
  exSay(route === 'deepseek' ? '正在问 DeepSeek…' : '正在翻译…');
  askAI(route, trPrompt(exFor, en), TR_SCHEMA).then(function (o) {
    btn.disabled = false;
    if (!o || !o.t) throw new Error('返回里没有翻译。');
    document.getElementById('exZh').value = String(o.t).trim();
    exSay('翻好了，看一眼再「加上」。');
  }).catch(function (err) {
    btn.disabled = false;
    exSay('翻译失败：' + aiErr(err, route), 1);
  });
}
function exAdd() {
  var en = (document.getElementById('exEn').value || '').replace(/\s+/g, ' ').trim();
  var zh = (document.getElementById('exZh').value || '').replace(/\s+/g, ' ').trim();
  if (!en) { exSay('英文例句还是空的。', 1); document.getElementById('exEn').focus(); return; }
  if (!/[A-Za-z]/.test(en)) { exSay('这一栏放英文例句。', 1); return; }
  if (!wordRe(exFor.w).test(en)) {
    exSay('这句话里好像没有「' + exFor.w + '」—— 确认一下是不是加错了词条。', 1);
  }
  var list = store.gen[exFor.w] || (store.gen[exFor.w] = []);
  if (list.some(function (g) { return g.e === en; })) { exSay('这句已经加过了。', 1); return; }
  list.push({ e: en, t: zh, mine: 1 });
  save();
  document.getElementById('exEn').value = '';
  document.getElementById('exZh').value = '';
  exSay('加上了。可以接着加下一句，或者关掉面板。');
  if (exRedraw) exRedraw(); else render();
}

/* ================= 导入词表（第三次优化 11） ================= */
var CDN = {
  xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  pdf:  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfw: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  cmaps: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/'
};
function loadScript(src) {
  return new Promise(function (ok, no) {
    var s = document.createElement('script');
    s.src = src; s.onload = ok;
    s.onerror = function () { no(new Error('加载解析库失败，需要联网：' + src)); };
    document.head.appendChild(s);
  });
}
/* SheetJS decodes a byte array as latin-1, which turns a UTF-8 CSV into mojibake.
   Delimited text is simple enough to read here, and it keeps CSV working offline. */
function parseDelim(txt) {
  var tab = txt.indexOf('\t') >= 0 && txt.indexOf(',') < 0, d = tab ? '\t' : ',';
  var rows = [], row = [], cell = '', q = false;
  for (var i = 0; i < txt.length; i++) {
    var c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(function (r) { return r.join('').trim(); });
}
/* ---- 例句解析（第八次优化 7）----
   例句是挂到已有词条上的，所以「哪个是词」不用猜：拿行首去和词库对一下就知道。 */
var HEADS = null;
function headMap() {
  if (HEADS) return HEADS;
  HEADS = {};
  WORDS.forEach(function (w) { var k = w.w.toLowerCase(); if (!(k in HEADS)) HEADS[k] = w; });
  return HEADS;
}
function splitEnZh(s) {
  var k = String(s).search(CJK);
  if (k < 0) return [String(s).trim(), ''];
  return [String(s).slice(0, k).replace(SEPTAIL, '').trim(), String(s).slice(k).trim()];
}
function exOk(e) { return !!e && /[A-Za-z]/.test(e) && e.split(/\s+/).length >= 4; }
function hasWord(sent, w) {
  try { return new RegExp('\\b' + wordPat(w), 'i').test(sent); } catch (e) { return false; }
}
/* ================= .numbers（第九次优化 2）=================
   苹果 Numbers 存的是自家的 IWA：一个 zip，里面每个 .iwa 是
   「4 字节块头 + snappy 原始流」，解出来是 protobuf。
   完整还原表格要啃 Apple 没公开的内部结构，但我们只要文字 ——
   字符串表（DataList）里就有，而且大体按行顺序排。
   于是：解 zip → 解 snappy → 扫出所有「变长长度 + 合法 UTF-8」的片段
   → 按「英文词 → 音标 → 中文」的节奏配对。
   配得准不准在预览里一眼能看出来，不对就改用导出 CSV 或者直接粘贴。 */
function unzipStored(buf) {
  var dv = new DataView(buf), u8 = new Uint8Array(buf), eo = -1;
  for (var i = u8.length - 22; i >= 0 && i > u8.length - 66000; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  }
  if (eo < 0) throw new Error('这个文件不是有效的 Numbers 文稿。');
  var n = dv.getUint16(eo + 10, true), p = dv.getUint32(eo + 16, true), out = [];
  for (var k = 0; k < n; k++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) break;
    var method = dv.getUint16(p + 10, true);
    var csize = dv.getUint32(p + 20, true);
    var nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    var lho = dv.getUint32(p + 42, true);
    var name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    var lnl = dv.getUint16(lho + 26, true), lel = dv.getUint16(lho + 28, true);
    var start = lho + 30 + lnl + lel;
    out.push({ name: name, method: method, data: u8.subarray(start, start + csize) });
    p += 46 + nl + el + cl;
  }
  return out;
}
/* snappy 原始流，只需要解压 */
function snappyRaw(b) {
  var i = 0;
  while (i < b.length) { var c0 = b[i]; i++; if (!(c0 & 0x80)) break; }
  var out = [], len = 0;
  while (i < b.length) {
    var tag = b[i]; i++;
    if ((tag & 3) === 0) {
      var l = tag >> 2;
      if (l < 60) l += 1;
      else {
        var nb = l - 59, v = 0;
        for (var q = 0; q < nb; q++) v |= b[i + q] << (8 * q);
        l = v + 1; i += nb;
      }
      for (var m = 0; m < l; m++) { out.push(b[i + m]); len++; }
      i += l;
    } else {
      var ln, off;
      if ((tag & 3) === 1) { ln = ((tag >> 2) & 7) + 4; off = ((tag >> 5) << 8) | b[i]; i += 1; }
      else if ((tag & 3) === 2) { ln = (tag >> 2) + 1; off = b[i] | (b[i + 1] << 8); i += 2; }
      else { ln = (tag >> 2) + 1; off = b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24); i += 4; }
      for (var r = 0; r < ln; r++) { if (off > 0 && off <= len) { out.push(out[len - off]); len++; } }
    }
  }
  return new Uint8Array(out);
}
function iwaBytes(u8) {
  var parts = [], i = 0, total = 0;
  while (i + 4 <= u8.length) {
    var n = u8[i + 1] | (u8[i + 2] << 8) | (u8[i + 3] << 16);
    var d = snappyRaw(u8.subarray(i + 4, i + 4 + n));
    parts.push(d); total += d.length;
    i += 4 + n;
  }
  var all = new Uint8Array(total), at = 0;
  parts.forEach(function (x) { all.set(x, at); at += x.length; });
  return all;
}
var CTRLCH = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
function iwaStrings(u8) {
  var dec, out = [], i = 0, n = u8.length;
  try { dec = new TextDecoder('utf-8', { fatal: true }); } catch (e) { return out; }
  while (i < n) {
    var ln = 0, shift = 0, j = i, ok = false;
    while (j < n && shift <= 21) {
      var c = u8[j]; j++; ln |= (c & 0x7f) << shift; shift += 7;
      if (!(c & 0x80)) { ok = true; break; }
    }
    if (ok && ln >= 2 && ln <= 4000 && j + ln <= n) {
      try {
        var t = dec.decode(u8.subarray(j, j + ln));
        if (t.trim() && !CTRLCH.test(t)) { out.push(t); i = j + ln; continue; }
      } catch (e2) {}
    }
    i++;
  }
  return out;
}
/* 字符串流 → [单词, 音标, 释义] */
function numbersRows(strs) {
  var rows = [], cur = null;
  strs.forEach(function (raw) {
    var t = String(raw).replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (wordCell(t) && !/[.!?]$/.test(t) && !(cur && !cur[2])) {
      if (cur && cur[2]) rows.push(cur);
      cur = [t, '', ''];
      return;
    }
    if (!cur || cur[2]) return;
    if (!CJK.test(t) && IPAC.test(t) && t.length < 40 && !cur[1]) {
      cur[1] = t.replace(/[\/\[\]]/g, '').trim();
      return;
    }
    if (CJK.test(t)) { cur[2] = t; rows.push(cur); cur = null; }
  });
  if (cur && cur[2]) rows.push(cur);
  return rows;
}
function unstore(entry) {
  if (entry.method === 0) return Promise.resolve(entry.data);
  if (typeof DecompressionStream !== 'function') return Promise.resolve(null);
  try {
    var st = new Blob([entry.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(st).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  } catch (e) { return Promise.resolve(null); }
}
function parseNumbers(buf) {
  var files = unzipStored(buf).filter(function (f) { return /^Index\/Tables\/DataList/.test(f.name); });
  if (!files.length) throw new Error('这个 Numbers 文稿里没找到表格数据。');
  return Promise.all(files.map(unstore)).then(function (bufs) {
    var strs = [];
    bufs.forEach(function (b) { if (b) strs = strs.concat(iwaStrings(iwaBytes(b))); });
    var rows = numbersRows(strs);
    if (!rows.length) {
      throw new Error('从这个 Numbers 文稿里没认出词条。在 Numbers 里「文件 → 导出为 → CSV」再导入，' +
        '或者干脆在表格里全选、拷贝，粘到下面的文本框里 —— 这两条路都更稳。');
    }
    return { rows: rows };
  });
}

function readFile(file, how) {
  return new Promise(function (ok, no) {
    var fr = new FileReader();
    fr.onerror = function () { no(new Error('读不了这个文件')); };
    fr.onload = function () { ok(fr.result); };
    if (how === 'buf') fr.readAsArrayBuffer(file); else fr.readAsText(file, 'utf-8');
  });
}
/* 取原料：文件 → {rows:[[...]]} 或 {lines:[...]}。
   拿到之后再按「词表」还是「例句」去解析（第八次优化 7）。 */
function rawFile(file) {
  var name = (file.name || '').toLowerCase();
  if (/\.(csv|tsv)$/.test(name)) {
    return readFile(file, 'text').then(function (txt) { return { rows: parseDelim(txt) }; });
  }
  if (/\.(xlsx|xlsm|xls)$/.test(name)) {
    return (window.XLSX ? Promise.resolve() : loadScript(CDN.xlsx))
      .then(function () { return readFile(file, 'buf'); })
      .then(function (buf) {
        var wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
        /* 好几张表多半是好几个单元（一张表一个 List、一个 Unit），
           拆开分别认，别把整本表混成一个单元（第十二次优化 1）。
           只有一张表的时候还是老样子，不引入变化。 */
        if (wb.SheetNames.length > 1) {
          var sheets = wb.SheetNames.map(function (sn) {
            return { name: sn, rows: XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false, defval: '' }) };
          });
          return { sheets: sheets };
        }
        var rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: '' });
        return { rows: rows };
      });
  }
  if (/\.numbers$/.test(name)) {
    return readFile(file, 'buf').then(parseNumbers);
  }
  if (/\.pdf$/.test(name)) {
    return (window.pdfjsLib ? Promise.resolve() : loadScript(CDN.pdf))
      .then(function () {
        pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfw;
        return readFile(file, 'buf');
      })
      .then(function (buf) {
        return pdfjsLib.getDocument({ data: new Uint8Array(buf),
          cMapUrl: CDN.cmaps, cMapPacked: true }).promise;
      })
      .then(function (doc) {
        var jobs = [];
        for (var p = 1; p <= doc.numPages; p++) jobs.push(doc.getPage(p).then(function (pg) { return pg.getTextContent(); }));
        return Promise.all(jobs);
      })
      .then(function (pages) {
        var lines = [];
        pages.forEach(function (tc) {
          var by = {};
          tc.items.forEach(function (it) {
            var y = Math.round(it.transform[5]);
            (by[y] = by[y] || []).push([it.transform[4], it.str]);
          });
          Object.keys(by).sort(function (a, b) { return b - a; }).forEach(function (y) {
            lines.push(by[y].sort(function (a, b) { return a[0] - b[0]; })
              .map(function (x) { return x[1]; }).join(' ').replace(/\s+/g, ' ').trim());
          });
        });
        if (!lines.join('').trim()) {
          throw new Error('这个 PDF 里没有可提取的文字层 —— 多半是扫描件，或者用了不带 Unicode 映射的字体。' +
            '先用别的工具转成 Excel／HTML 再导入会更靠谱。');
        }
        return { lines: lines };
      });
  }
  if (/\.(html?|htm)$/.test(name)) {
    return readFile(file, 'text').then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, 'text/html');
      var tables = doc.querySelectorAll('table'), rows = [];
      Array.prototype.forEach.call(tables, function (t) {
        Array.prototype.forEach.call(t.querySelectorAll('tr'), function (tr) {
          rows.push(Array.prototype.map.call(tr.querySelectorAll('th,td'),
            function (td) { return td.textContent.replace(/\s+/g, ' ').trim(); }));
        });
      });
      if (rows.length) return { rows: rows };
      /* 没有表格的 HTML（卡片式的词表就是这样）：先把块级标签换成换行，
         再按行读，否则 textContent 会把一整张卡片糊成一行。 */
      /* 开标签和闭标签都换成换行 —— 只换闭标签的话，
         「</div><div>」之间的内容会被粘成一行，卡片式的词表就散不开。 */
      var flat = (doc.body || doc.documentElement).innerHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(p|div|li|tr|td|th|h[1-6]|section|article|dd|dt)[^>]*>/gi, '\n');
      var text = new DOMParser().parseFromString(flat, 'text/html').body.textContent || '';
      return { lines: text.split(/\n+/) };
    });
  }
  return readFile(file, 'text').then(function (txt) { return { lines: txt.split(/\r?\n/) }; });
}
/* 原料 → 词表行 */
function rawToWords(raw) {
  if (raw.rows) return parseTable(raw.rows);
  return raw.lines.map(parseLine).filter(Boolean);
}
var impGroups = [], impName = '';
function openImport() {
  var m = document.getElementById('impModal');
  impGroups = []; impName = '';
  document.getElementById('impName').value = '';
  document.getElementById('impText').value = '';
  paintImport('把文件拖到这里，或点上面的按钮选一个。');
  m.hidden = false;
}
function paintImport(msg, bad) {
  var st = document.getElementById('impStat');
  st.textContent = msg; st.className = 'imp-stat' + (bad ? ' bad' : '');
  var pv = document.getElementById('impPrev');
  var total = impGroups.reduce(function (n, g) { return n + g.rows.length; }, 0);
  document.getElementById('impGo').disabled = !total;
  document.getElementById('impFields').hidden = !total;
  var nh = document.getElementById('impNameHint');
  if (nh) nh.textContent = impGroups.length > 1
    ? '表格有 ' + impGroups.length + ' 个分页，会拆成 ' + impGroups.length + ' 个单元；这个名字打头，后面各自带上表格名。'
    : '';
  if (!total) { pv.innerHTML = ''; return; }
  var manyGroups = impGroups.length > 8;
  var cap = impGroups.length > 1 ? (manyGroups ? 4 : 10) : 200;
  var shown = manyGroups ? impGroups.slice(0, 8) : impGroups;
  pv.innerHTML = shown.map(function (g) {
    var head = g.name ? '<p class="imp-group-h">' + esc(g.name) + ' · ' + g.rows.length + ' 词</p>' : '';
    return head + '<table><thead><tr><th>单词</th><th>音标</th><th>释义</th></tr></thead><tbody>' +
      g.rows.slice(0, cap).map(function (r) {
        return '<tr><td>' + esc(r.w) + '</td><td>' + esc(r.p) + '</td><td>' + esc(r.z) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      (g.rows.length > cap ? '<p class="imp-more">还有 ' + (g.rows.length - cap) + ' 行没显示。</p>' : '');
  }).join('') + (manyGroups ? '<p class="imp-more">还有 ' + (impGroups.length - 8) + ' 个单元、' +
    (total - shown.reduce(function (n, g) { return n + g.rows.length; }, 0)) + ' 个词条没显示预览，导入时都会带上。</p>' : '');
}
function absorb(raw) {
  var groups;
  if (raw.sheets) {
    /* 每张表分别认、分别去重 —— 同一个词在不同表里各出现一次是常事
       （书本身就常常在后面的 List 里复习前面学过的词），不跨表合并。 */
    groups = raw.sheets.map(function (s) {
      var m = mergeRows(parseTable(s.rows));
      return { name: s.name, rows: m.rows, merged: m.merged };
    }).filter(function (g) { return g.rows.length; });
  } else {
    var m = mergeRows(rawToWords(raw));
    groups = [{ name: null, rows: m.rows, merged: m.merged }];
  }
  impGroups = groups;
  var total = 0, merged = 0;
  groups.forEach(function (g) { total += g.rows.length; merged += g.merged; });
  if (!total) { paintImport('没认出「英文 + 中文释义」的行。表格请让单词和释义各占一列。', 1); return; }
  if (impName) document.getElementById('impName').value = impName;
  var msg = groups.length > 1
    ? '表格有 ' + groups.length + ' 个分页，按分页拆成了 ' + groups.length + ' 个单元，共认出 ' + total + ' 个词条'
    : '认出 ' + total + ' 个词条';
  paintImport(msg + (merged ? '（其中 ' + merged + ' 条在原表里出现过不止一次，释义已经并到一起，没丢）' : '') + '。核对一下再导入。');
}
function takeFile(file) {
  if (!file) return;
  impName = (file.name || '').replace(/\.[^.]+$/, '');
  paintImport('正在解析 ' + file.name + ' …');
  rawFile(file).then(function (raw) { absorb(raw); })
    .catch(function (e) { impGroups = []; paintImport(String(e.message || e), 1); });
}
/* 直接粘一段进来就分拣（第八次优化 8） */
function takeText() {
  var txt = document.getElementById('impText').value || '';
  if (!txt.trim()) { paintImport('文本框还是空的。', 1); return; }
  impName = impName || '粘贴的词表';
  /* 带 Tab 的多半是从表格里拷出来的，按分隔符拆成表；否则按行读 */
  absorb(/\t/.test(txt) ? { rows: parseDelim(txt) } : { lines: txt.split(/\r?\n/) });
}
function doImport() {
  var total = impGroups.reduce(function (n, g) { return n + g.rows.length; }, 0);
  if (!total) return;
  var name = (document.getElementById('impName').value || impName || '导入').trim();
  var u = 101;
  store.custom.forEach(function (c) { if (c.u >= u) u = c.u + 1; });
  var nextI = nextCustomId(WORDS);
  var firstU = -1;
  impGroups.forEach(function (g) {
    if (!g.rows.length) return;
    var uu = u++;
    var words = g.rows.map(function (r) {
      var w = { i: nextI, u: uu, w: r.w, p: r.p || '', z: r.z };
      nextI++;
      return w;
    });
    store.custom.push({ u: uu, t: '导入 · ' + name + (g.name ? ' · ' + g.name : ''), words: words });
    if (firstU < 0) firstU = uu;
  });
  save(); mountCustom(); dropOrder();
  document.getElementById('impModal').hidden = true;
  go({ name: 'unit', u: firstU, tab: 'browse' });
}

/* ================= 手动添加（第五次优化 7） =================
   所有手打的词都进同一个单元「我加的词」（u = 100，导入的单元从 101 起排），
   随加随存，面板不关，可以一条接一条地敲。 */
var MANUAL_U = 100;
function manualUnit(make) {
  var c = null;
  store.custom.forEach(function (x) { if (x.u === MANUAL_U) c = x; });
  if (!c && make) { c = { u: MANUAL_U, t: '我加的词', manual: 1, words: [] }; store.custom.push(c); }
  return c;
}
function customUnit(u) {
  var c = null;
  store.custom.forEach(function (x) { if (x.u === u) c = x; });
  return c;
}
/* ---------- 合并单元（第十次优化 1） ----------
   分几次导进来的词表，其实是同一份东西；单元多了目录就翻不动。
   合并只动自己导入／手动加的单元 —— 原书那 37 页是固定的坐标，动了就对不上书了。
   同一个词在两份表里都有，就并成一条：释义用「；」接起来（和导入时同一套规矩），
   两条的进度取更需要复习的那个，生词本、颜色、例句都留着。 */
var merging = false, mergeSel = {}, mergeTitle = '', mergeMsg = '';
function mergeList() {
  var out = [];
  store.custom.forEach(function (c) { if (mergeSel[c.u]) out.push(c.u); });
  return out.sort(function (a, b) { return a - b; });
}
function mergeAutoName() {
  var us = mergeList(), t = [];
  us.forEach(function (u) { t.push(String(unitMeta(u).t || '').replace(/^导入 · /, '')); });
  if (!t.length) return '';
  return t.length === 1 ? t[0] : t[0] + ' 等 ' + t.length + ' 份';
}
function mergeDup(us) {
  var seen = {}, dup = 0;
  store.custom.forEach(function (c) {
    if (us.indexOf(c.u) < 0) return;
    c.words.forEach(function (w) {
      var k = w.w.toLowerCase();
      if (seen[k]) dup++; else seen[k] = 1;
    });
  });
  return dup;
}
/* a 这条要没了，把它身上的记录并到 b —— 进度取「更需要再看一眼」的那个状态 */
var URGE = { 1: 3, 2: 2, 3: 1, 0: 0 };
function foldProgress(a, b) {
  if (URGE[lvl(a)] > URGE[lvl(b)]) store.prog[b] = store.prog[a];
  if (store.hist[a]) store.hist[b] = (store.hist[b] || 0) + store.hist[a];
  if (store.star[a]) store.star[b] = 1;
  if (store.sel[a]) store.sel[b] = 1;
  if (store.col[a] && !store.col[b]) store.col[b] = store.col[a];
  delete store.prog[a]; delete store.hist[a]; delete store.star[a];
  delete store.sel[a]; delete store.col[a];
}
function mergeUnits(picked, name) {
  var keep = picked[0], seen = {}, out = [], dup = 0;
  picked.forEach(function (c) {
    c.words.forEach(function (w) {
      var k = w.w.toLowerCase(), had = seen[k];
      if (!had) { seen[k] = w; out.push(w); return; }
      var zs = String(had.z).split(/[；;]/).map(function (x) { return x.trim(); });
      if (zs.indexOf(String(w.z).trim()) < 0) had.z = had.z + '；' + w.z;
      if (!had.p && w.p) had.p = w.p;
      foldProgress(w.i, had.i);
      dup++;
    });
  });
  out.forEach(function (w) { w.u = keep.u; });
  keep.words = out;
  keep.t = name;
  store.custom = store.custom.filter(function (c) { return c === keep || picked.indexOf(c) < 0; });
  save(); mountCustom(); dropOrder();
  return { u: keep.u, n: out.length, dup: dup };
}
function doMerge() {
  var us = mergeList();
  if (us.length < 2) return;
  var name = (mergeTitle || mergeAutoName() || '合并的词表').trim();
  var picked = store.custom.filter(function (c) { return us.indexOf(c.u) >= 0; })
    .sort(function (a, b) { return a.u - b.u; });
  var tot = 0;
  picked.forEach(function (c) { tot += c.words.length; });
  var dup = mergeDup(us);
  if (!confirm('把这 ' + picked.length + ' 个单元合成「' + name + '」？\n\n' +
      '合并后 ' + (tot - dup) + ' 个词' +
      (dup ? '（原来一共 ' + tot + ' 个，其中 ' + dup + ' 条是同一个词，释义并到一起）' : '') + '。\n' +
      '原来的单元不再单独存在，词、学习进度、生词本、颜色都不会丢。')) return;
  var r = mergeUnits(picked, name);
  merging = false; mergeSel = {}; mergeTitle = ''; mergeMsg = '';
  go({ name: 'unit', u: r.u, tab: 'browse' });
}
function mergeBarHtml() {
  if (!merging) return '';
  var us = mergeList(), n = 0, dup = mergeDup(us);
  us.forEach(function (u) { n += unitWords(u).length; });
  return '<div class="selbar mergebar">' +
    '<span class="selbar-n">' + (us.length
      ? '选了 <b>' + us.length + '</b> 个单元 · ' + n + ' 词' + (dup ? '（' + dup + ' 条重复）' : '')
      : '点两个以上自己的单元，合成一个') + '</span>' +
    (us.length >= 2
      ? '<input id="mergeName" type="text" placeholder="合并后的单元名" value="' + esc(mergeTitle || mergeAutoName()) + '">'
      : '') +
    '<button class="btn" id="mergeGo" type="button"' + (us.length >= 2 ? '' : ' disabled') + '>合并</button>' +
    '<button class="btn btn-ghost" id="mergeOff" type="button">取消</button>' +
    (mergeMsg ? '<span class="merge-msg">' + esc(mergeMsg) + '</span>' : '') +
    '</div>';
}
function wireMerge() {
  var off = document.getElementById('mergeOff');
  if (off) off.onclick = function () {
    merging = false; mergeSel = {}; mergeTitle = ''; mergeMsg = ''; renderHome();
  };
  var nm = document.getElementById('mergeName');
  if (nm) nm.oninput = function () { mergeTitle = nm.value; };
  var g = document.getElementById('mergeGo');
  if (g) g.onclick = doMerge;
}
function paintMerge() {
  var slot = document.getElementById('mergeSlot');
  if (!slot) return;
  slot.innerHTML = mergeBarHtml();
  wireMerge();
}

/* 面板可以加到「我加的词」，也可以加到某个导入的单元里；
   editing 有值时是在改某一条，不是新增。（第八次优化 3） */
var addTarget = MANUAL_U, editing = null;
function openAdd(u, word) {
  addTarget = u == null ? MANUAL_U : u;
  editing = word || null;
  var c = addTarget === MANUAL_U ? manualUnit(false) : customUnit(addTarget);
  document.getElementById('addW').value = editing ? editing.w : '';
  document.getElementById('addP').value = editing ? (editing.p || '') : '';
  document.getElementById('addZ').value = editing ? editing.z : '';
  document.getElementById('addTitle').textContent = editing ? '改这一条' : '手动添加';
  document.getElementById('addGo').textContent = editing ? '保存' : '添加';
  document.getElementById('addWhere').textContent = editing
    ? '改完点保存。学习进度不受影响。'
    : '加进「' + ((c && c.t) || '我加的词') + '」这个单元，和内置单元一样可以浏览、学习、测验、搜索。词组也行。';
  paintAdd('');
  document.getElementById('addModal').hidden = false;
  document.getElementById('addW').focus();
}
function paintAdd(msg, bad) {
  var note = document.getElementById('addNote');
  note.textContent = msg || '';
  note.className = 'add-note' + (bad ? ' bad' : '');
  var c = addTarget === MANUAL_U ? manualUnit(false) : customUnit(addTarget);
  var ws = (c && !editing) ? c.words.slice().reverse() : [];
  document.getElementById('addList').innerHTML = !ws.length ? '' :
    '<p class="add-l">已经加了 ' + ws.length + ' 个' + (ws.length > 12 ? '（列最近 12 个）' : '') + '</p>' +
    ws.slice(0, 12).map(function (w) {
      return '<span class="add-chip">' + esc(w.w) +
        '<button data-drop="' + w.i + '" type="button" title="删掉">×</button></span>';
    }).join('');
  Array.prototype.forEach.call(document.querySelectorAll('[data-drop]'), function (b) {
    b.onclick = function () { dropWord(+b.dataset.drop); paintAdd('删掉了。'); };
  });
}
/* 从自建／导入的单元里删掉一个词，连同它的进度、生词本、选中状态 */
function dropWord(i) {
  var c = null, w = null;
  store.custom.forEach(function (x) {
    x.words.forEach(function (y) { if (y.i === i) { c = x; w = y; } });
  });
  if (!c) return false;
  c.words = c.words.filter(function (y) { return y.i !== i; });
  delete store.prog[i]; delete store.hist[i]; delete store.sel[i]; delete store.star[i];
  delete store.col[i];
  /* 例句是按拼写存的：只有当别处再没有同名词条时才连例句一起删 */
  if (w && store.gen[w.w]) {
    var alsoElsewhere = WORDS.some(function (x) { return x.i !== i && x.w === w.w; });
    if (!alsoElsewhere) delete store.gen[w.w];
  }
  if (!c.words.length) store.custom = store.custom.filter(function (x) { return x.u !== c.u; });
  save(); mountCustom(); dropOrder(); render();
  return true;
}
function addWord() {
  var wv = (document.getElementById('addW').value || '').replace(/\s+/g, ' ').trim();
  var pv = (document.getElementById('addP').value || '').replace(/[\/\[\]]/g, '').trim();
  var zv = (document.getElementById('addZ').value || '').trim();
  if (!wv) { paintAdd('单词还没填。', 1); document.getElementById('addW').focus(); return; }
  if (!phraseOk(wv)) { paintAdd('这一栏只放英文单词或词组（最多 6 个词）。', 1); return; }
  if (!zv) { paintAdd('中文释义还没填。', 1); document.getElementById('addZ').focus(); return; }
  if (editing) {                                  // 改一条现成的
    var old = editing.w;
    editing.w = wv; editing.p = pv; editing.z = zv;
    if (old !== wv && store.gen[old]) { store.gen[wv] = store.gen[old]; delete store.gen[old]; }
    save(); mountCustom(); dropOrder(); render();
    document.getElementById('addModal').hidden = true;
    return;
  }
  var dup = null;
  WORDS.forEach(function (x) { if (!dup && x.w.toLowerCase() === wv.toLowerCase()) dup = x; });
  if (dup && dup.u === addTarget) { paintAdd('这个单元里已经有「' + wv + '」了。', 1); return; }
  var c = addTarget === MANUAL_U ? manualUnit(true) : customUnit(addTarget);
  if (!c) { paintAdd('这个单元不在了。', 1); return; }
  c.words.push({ i: nextCustomId(WORDS), u: c.u, w: wv, p: pv, z: zv });
  save(); mountCustom(); dropOrder();
  document.getElementById('addW').value = '';
  document.getElementById('addP').value = '';
  document.getElementById('addZ').value = '';
  document.getElementById('addW').focus();
  paintAdd('加好了：' + wv + (dup ? '　（别处也有这个词，两条都留着）' : ''));
  render();
}

/* ================= SEARCH & STARS ================= */
function renderList(title, sub, list, exMap) {
  var rows = list.map(function (w) {
    var ex = exMap && exMap[w.i];
    return '<div class="row ' + cls(w.i) + (store.sel[w.i] ? ' sel' : '') +
      '" data-i="' + w.i + '" data-u="' + w.u + '" data-col="' + colOf(w.i) + '">' +
      (picking ? '<span class="row-c"></span>' : '') +
      '<div class="row-no"><span class="dot"></span>' + w.i + '</div>' +
      '<div class="row-w">' + esc(w.w) +
        '<button class="row-u" data-go="' + w.i + '" data-gu="' + w.u + '" type="button" ' +
          'title="到「' + esc(unitShort(w.u)) + '」里看它排在哪">' + esc(unitShort(w.u)) + '</button></div>' +
      '<div class="row-p">' + esc(w.p) + '</div>' +
      '<div class="row-z">' + esc(w.z) + (ex ? '<span class="row-ex">例句：' + esc(ex) + '</span>' : '') + '</div>' +
      '<button class="row-s' + (store.star[w.i] ? ' on' : '') + '" data-star="' + w.i + '" type="button">★</button>' +
      '</div>';
  }).join('');
  view.innerHTML = '<button class="back" id="back" type="button">← 返回目录</button>' +
    '<p class="eyebrow">' + esc(sub) + '</p><h1>' + esc(title) + '</h1>' +
    (list.length ? '<div class="sortbar">' + pickBarHtml() + '</div>' +
        '<div class="rows' + (picking ? ' picking' : '') + '" style="margin-top:14px">' + rows + '</div>' +
        '<div id="selbarSlot">' + selBarHtml() + '</div>'
      : '<div class="empty"><b>还是空的</b>在浏览或词卡上点 ★ 就会收进来。</div>');
  document.getElementById('back').onclick = function () { document.getElementById('search').value = ''; go({ name: 'home' }); };
  var back = { name: route.name, q: route.q };
  wirePickBar(list, render);
  wireSelBar(back);
  wirePick(back);
  Array.prototype.forEach.call(view.querySelectorAll('.row'), function (r) {
    r.onclick = function (e) {
      if (picking || e.target.dataset.star || e.target.dataset.go) return;   // 选择模式下由 mousedown 接管
      var u = +r.dataset.u, i = +r.dataset.i;
      if (curFilter(u)) setFilter(u, '');            // 那个单元正筛着颜色的话，先撤掉再定位
      go({ name: 'unit', u: u, tab: 'study', n: Math.max(0, posInUnit(u, i)), rev: true });
    };
  });
  /* 点单元标签 → 到那个单元的浏览列表，滚到这个词那一行并高亮一下 */
  Array.prototype.forEach.call(view.querySelectorAll('[data-go]'), function (b) {
    b.onclick = function (e) {
      e.stopPropagation();
      go({ name: 'unit', u: +b.dataset.gu, tab: 'browse', focus: +b.dataset.go });
    };
  });
  Array.prototype.forEach.call(view.querySelectorAll('[data-star]'), function (b) {
    b.onclick = function (e) {
      e.stopPropagation(); var i = +b.dataset.star;
      if (store.star[i]) delete store.star[i]; else store.star[i] = 1;
      b.classList.toggle('on'); save(); starCount();
    };
  });
}
function starCount() {
  document.getElementById('starCount').textContent = Object.keys(store.star).length;
}

/* ---------- 搜索（第八次优化 1 · 第十四次优化 1） ----------
   以前是「哪儿含这几个字母都算」，还按原书顺序排：输入 a 先给你 abasement 之外
   一堆中间带 a 的词，想找 a 开头的反而要翻半天。现在按匹配方式打分再排：
   完全一样 → 单词开头 → 词组里某个词的开头 / 释义开头 → 夹在中间 → 释义里出现
   → 例句（内置 + 自己写的 + AI 生成的）里出现。
   同分的短词优先，再按原书顺序。 */
var SEARCH_CAP = 400;
function reEsc(t) { return String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/* 截一段带上下文的摘录，让「为什么搜出这个词」看得见 —— 不截的话，
   命中原因全在例句里，词条本身的单词和释义可能压根不含搜索词。 */
function searchSnip(t, i, len) {
  var a = Math.max(0, i - 18), b = Math.min(t.length, i + len + 18);
  return (a > 0 ? '…' : '') + t.slice(a, b) + (b < t.length ? '…' : '');
}
/* 词条本身没搜中的话，再翻它的例句 —— 内置例句 + 自己写的 + AI 生成的都翻。
   词太短（1 个字符）翻例句噪音太大，不翻。 */
function exampleHit(w, q, ql) {
  var r = rich(w), cands = [];
  /* t 里 **加粗** 标着对应译文的那一小段，星号本身不该算进匹配或摘录里 —— 不摘掉的话，
     搜索词一旦跨在星号两边（比如「卑的」卡在「**自卑**的」中间）就连不成子串，白白漏掉。 */
  if (r) { if (r.e) cands.push([r.e, 1]); if (r.t) cands.push([r.t.replace(/\*\*/g, ''), 0]); }
  gen(w).forEach(function (g) { if (g.e) cands.push([g.e, 1]); if (g.t) cands.push([g.t.replace(/\*\*/g, ''), 0]); });
  for (var k = 0; k < cands.length; k++) {
    var t = cands[k][0], en = cands[k][1];
    var idx = en ? t.toLowerCase().indexOf(ql) : t.indexOf(q);
    if (idx >= 0) return searchSnip(t, idx, en ? ql.length : q.length);
  }
  return null;
}
var searchExcerpt = {};
function searchHits(raw) {
  var q = String(raw == null ? '' : raw).trim();
  if (!q) return [];
  var ql = q.toLowerCase(), wordStart = new RegExp('\\b' + reEsc(ql), 'i'), out = [];
  searchExcerpt = {};
  WORDS.forEach(function (w) {
    var lw = w.w.toLowerCase(), s = -1;
    if (lw === ql) s = 0;
    else if (lw.indexOf(ql) === 0) s = 1;
    else if (wordStart.test(lw)) s = 2;                 // come to TERMS with
    else if (lw.indexOf(ql) > 0) s = 4;
    var z = w.z || '', zi = z.indexOf(q);
    if (zi === 0) { if (s < 0 || s > 3) s = 3; }
    else if (zi > 0) { if (s < 0 || s > 5) s = 5; }
    if (s < 0 && q.length >= 2) {
      var snip = exampleHit(w, q, ql);
      if (snip != null) { s = 6; searchExcerpt[w.i] = snip; }
    }
    if (s >= 0) out.push({ w: w, s: s });
  });
  /* 同一档里按字母序 —— 输入 a 就该像翻字典一样从 abase 往下走，
     而不是先蹦出几个碰巧短的词 */
  out.sort(function (a, b) {
    if (a.s !== b.s) return a.s - b.s;
    var x = a.w.w.toLowerCase(), y = b.w.w.toLowerCase();
    return x < y ? -1 : x > y ? 1 : (a.w.i - b.w.i);
  });
  return out.map(function (o) { return o.w; });
}

/* ================= render ================= */
function render() {
  /* 大单元的答题卡挂着一个 ResizeObserver（第十六次优化 1）；离开那一页时
     它观察的节点跟着 view.innerHTML 一起没了，但观察者本身不会自动断——
     每次重渲染先断一次，不管这次去哪一页，保证同时只有一个在盯着。 */
  if (railRO) { railRO.disconnect(); railRO = null; }
  if (route.name === 'home') renderHome();
  else if (route.name === 'review') renderReview();
  else if (route.name === 'quiz') renderQuiz(null, route.scope === 'sel');
  else if (route.name === 'spell') renderSpell(null, true);
  else if (route.name === 'unit') {
    if (route.tab === 'study') renderStudy(route.u, route.n || 0);
    else if (route.tab === 'quiz') renderQuiz(route.u, false);
    else if (route.tab === 'spell') renderSpell(route.u, false);
    else renderBrowse(route.u);
  } else if (route.name === 'search') {
    var all = searchHits(route.q);
    var hit = all.slice(0, SEARCH_CAP);
    renderList('“' + route.q + '” 的结果',
      all.length + ' 个词条' + (all.length > hit.length ? ' · 只列前 ' + hit.length + ' 个' : ''), hit, searchExcerpt);
  } else if (route.name === 'star') {
    renderList('生词本', Object.keys(store.star).length + ' 个词条', WORDS.filter(function (w) { return store.star[w.i]; }));
  }
  starCount();
}

/* ================= chrome wiring ================= */
var si = document.getElementById('search'), st = null;
si.addEventListener('input', function () {
  clearTimeout(st);
  st = setTimeout(function () {
    var q = si.value.trim();
    if (!q) { if (route.name === 'search') go({ name: 'home' }); return; }
    go({ name: 'search', q: q });
  }, 180);
});
document.getElementById('openStar').onclick = function () { go({ name: 'star' }); };
var modal = document.getElementById('setModal');
function openSettings(focus) {
  modal.hidden = false;
  if (focus) { var f = document.getElementById(focus); if (f) { f.focus(); f.scrollIntoView({ block: 'center' }); } }
}
document.getElementById('openSet').onclick = function () { openSettings(); };
document.getElementById('closeSet').onclick = function () { modal.hidden = true; };
modal.addEventListener('click', function (e) { if (e.target === modal) modal.hidden = true; });
var sa = document.getElementById('setAccent'), sr = document.getElementById('setRate'),
    sv = document.getElementById('setVoice'), su = document.getElementById('setAuto'),
    sh = document.getElementById('setHideZh'), sl = document.getElementById('setVol'),
    sn = document.getElementById('setHint'), sx = document.getElementById('setHideEx'),
    sk = document.getElementById('aiField'),
    sm = document.getElementById('setModel'), sd = document.getElementById('dsField'),
    sdm = document.getElementById('setDsModel'), sqn = document.getElementById('setQn'),
    sxl = document.getElementById('setExLen'), szs = document.getElementById('setZhSize'),
    sws = document.getElementById('setWsrc');
sa.value = store.set.accent; sr.value = store.set.rate; su.checked = !!store.set.auto;
sh.checked = !!store.set.hideZh; sl.value = store.set.vol; sn.checked = !!store.set.hint;
sx.checked = !!store.set.hideEx; sqn.value = String(store.set.qn);
sxl.value = store.set.exlen || 'mid';
szs.value = store.set.zhSize || 'm';
sws.value = store.set.wsrc || 'yd';
sk.value = store.set.key || ''; sm.value = store.set.model || 'claude-opus-5';
sd.value = store.set.dskey || ''; sdm.value = store.set.dsmodel || 'deepseek-chat';
/* 两家服务商各存各的 Key，来回切不会把对方的抹掉（第四次优化 2） */
function paintProv() {
  var ds = store.set.prov === 'deepseek';
  document.getElementById('provAnthropic').hidden = ds;
  document.getElementById('provDeepseek').hidden = !ds;
  Array.prototype.forEach.call(document.querySelectorAll('[data-prov]'), function (b) {
    b.classList.toggle('on', (b.dataset.prov === 'deepseek') === ds);
  });
}
Array.prototype.forEach.call(document.querySelectorAll('[data-prov]'), function (b) {
  b.onclick = function () { store.set.prov = b.dataset.prov; save(); paintProv(); render(); };
});
paintProv();
document.getElementById('rateVal').textContent = (+store.set.rate).toFixed(2);
document.getElementById('volVal').textContent = Math.round(store.set.vol * 100) + '%';
var DEMO = 'The storm finally abated, and the crew began repairing the torn sails before dawn.';
function setAccent(a) {
  store.set.accent = a; store.set.voice = ''; sa.value = a; sv.value = ''; save();
  loadVoices(); speak(DEMO);
}
sa.onchange = function () { setAccent(sa.value); };
document.getElementById('accentBtn').onclick = function () {
  setAccent(store.set.accent === 'en-US' ? 'en-GB' : 'en-US');
};
sr.oninput = function () { store.set.rate = +sr.value; document.getElementById('rateVal').textContent = (+sr.value).toFixed(2); save(); };
sl.oninput = function () { store.set.vol = +sl.value; document.getElementById('volVal').textContent = Math.round(sl.value * 100) + '%'; save(); };
sl.onchange = function () { speak(DEMO); };
sv.onchange = function () { store.set.voice = sv.value; save(); paintAccent(); speak(DEMO); };
su.onchange = function () { store.set.auto = su.checked; save(); };
sws.onchange = function () { store.set.wsrc = sws.value; save(); speak('serendipity'); };
sn.onchange = function () { store.set.hint = sn.checked; save(); render(); };
sh.onchange = function () { store.set.hideZh = sh.checked; save(); render(); };
sx.onchange = function () { store.set.hideEx = sx.checked; save(); render(); };
sqn.onchange = function () { store.set.qn = +sqn.value; save(); quiz = null; };
sxl.onchange = function () { store.set.exlen = sxl.value; save(); };
szs.onchange = function () { store.set.zhSize = szs.value; save(); applyZh(); };
var esk = document.getElementById('expShaky'), est = document.getElementById('expStar');
if (esk) esk.onclick = function () {
  var ws = WORDS.filter(shaky);
  if (!ws.length) { this.textContent = '现在没有待复习的词'; return; }
  copyText(exportLines(ws), this);
};
if (est) est.onclick = function () {
  var ws = WORDS.filter(function (w) { return store.star[w.i]; });
  if (!ws.length) { this.textContent = '生词本是空的'; return; }
  copyText(exportLines(ws), this);
};
sk.onchange = function () { store.set.key = sk.value.trim(); save(); render(); };
sm.onchange = function () { store.set.model = sm.value; save(); };
sd.onchange = function () { store.set.dskey = sd.value.trim(); save(); render(); };
sdm.onchange = function () { store.set.dsmodel = sdm.value; save(); };
document.getElementById('tryVoice').onclick = function () { speak(DEMO); };
document.getElementById('resetProg').onclick = function () {
  if (confirm('清空所有单元的学习进度和生词本？此操作不能撤销。')) {
    store.prog = {}; store.hist = {}; store.sel = {}; store.star = {}; save(); modal.hidden = true; dropOrder(); render();
  }
};
document.getElementById('openImp2').onclick = function () { modal.hidden = true; openImport(); };
document.getElementById('openAdd2').onclick = function () { modal.hidden = true; openAdd(); };
var addM = document.getElementById('addModal');
document.getElementById('closeAdd').onclick = function () { addM.hidden = true; };
addM.addEventListener('click', function (e) { if (e.target === addM) addM.hidden = true; });
document.getElementById('addGo').onclick = addWord;
['addW', 'addP', 'addZ'].forEach(function (id) {
  document.getElementById(id).addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addWord(); }
  });
});

/* import modal wiring */
var imp = document.getElementById('impModal');
document.getElementById('closeImp').onclick = function () { imp.hidden = true; };
imp.addEventListener('click', function (e) { if (e.target === imp) imp.hidden = true; });
document.getElementById('impFile').onchange = function (e) { takeFile(e.target.files[0]); };
document.getElementById('impPick').onclick = function () { document.getElementById('impFile').click(); };
document.getElementById('impGo').onclick = doImport;
document.getElementById('impParse').onclick = takeText;

/* 自己加例句面板 */
var exM = document.getElementById('exModal');
document.getElementById('closeEx').onclick = function () { exM.hidden = true; };
exM.addEventListener('click', function (e) { if (e.target === exM) exM.hidden = true; });
document.getElementById('exScan').onclick = exScan;
document.getElementById('exTr').onclick = exTranslate;
document.getElementById('exGo').onclick = exAdd;
Array.prototype.forEach.call(document.querySelectorAll('[data-exmode]'), function (b) {
  b.onclick = function () { exMode = b.dataset.exmode; paintExMode(); exSay(''); };
});
var drop = document.getElementById('impDrop');
['dragenter', 'dragover'].forEach(function (n) {
  drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('over'); });
});
['dragleave', 'drop'].forEach(function (n) {
  drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('over'); });
});
drop.addEventListener('drop', function (e) {
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) takeFile(e.dataTransfer.files[0]);
});

document.addEventListener('keydown', function (e) {
  var tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    if (e.key === 'Escape') { e.target.blur(); }
    return;
  }
  if (e.key === '/') { e.preventDefault(); si.focus(); return; }
  if (e.key === 'Escape') { modal.hidden = true; imp.hidden = true; addM.hidden = true; exM.hidden = true; return; }
  if (route.name === 'quiz' || (route.name === 'unit' && route.tab === 'quiz')) { quizKey(e); return; }
  if (route.name === 'review' && route.deck && route.deck.length) {
    if (e.key === ' ') { e.preventDefault(); route.rev = !route.rev; renderReview(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); cycleReview(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); cycleReview(-1); }
    else if ('psdPSD'.indexOf(e.key) >= 0) { sayKey(e.key.toUpperCase()); }
    else if (e.key === '1' || e.key === '3') { rateReview(+e.key); }   // 2 原来是「模糊」，空着免得误按
    else if ('456789'.indexOf(e.key) >= 0) { setCol(route.deck[0].i, 'c' + (+e.key - 3)); save(); renderReview(); }
    else if (e.key === '0' || e.key === '`') { setCol(route.deck[0].i, ''); save(); renderReview(); }
    return;
  }
  if (route.name !== 'unit' || route.tab !== 'study') return;
  var ws = ordered(route.u), n = route.n || 0;
  if (e.key === ' ') { e.preventDefault(); route.rev = !route.rev; renderStudy(route.u, n); }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    var step = (e.key === 'ArrowDown' || e.key === 'ArrowUp') ? railCols() : 1;
    var dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    route.rev = false;
    go({ name: 'unit', u: route.u, tab: 'study', n: Math.max(0, Math.min(n + dir * step, ws.length - 1)) });
  }
  else if ('psdPSD'.indexOf(e.key) >= 0) { sayKey(e.key.toUpperCase()); }
  else if (e.key === '1' || e.key === '3') {
    setLvl(ws[n].i, +e.key); route.rev = false;
    go({ name: 'unit', u: route.u, tab: 'study', n: Math.min(n + 1, ws.length - 1) });
  }
  else if ('456789'.indexOf(e.key) >= 0) { setCol(ws[n].i, 'c' + (+e.key - 3)); save(); renderStudy(route.u, n); }
  else if (e.key === '0' || e.key === '`') { setCol(ws[n].i, ''); save(); renderStudy(route.u, n); }
});

/* 排序条要吸顶（第十一次优化 5：编辑／选择不能只在滚到顶端才够得着），
   顶栏在窄屏上会折行变高，写死一个数迟早对不上 —— 实测一下，用 CSS 变量托住。 */
var topbarEl = document.querySelector('.topbar');
function measureTopbar() {
  if (topbarEl) document.documentElement.style.setProperty('--topbar-h', topbarEl.offsetHeight + 'px');
}
measureTopbar();
window.addEventListener('resize', measureTopbar);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureTopbar);

loadVoices();
render();
})();
