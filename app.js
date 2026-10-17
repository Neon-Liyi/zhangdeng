/* 《掌灯》—— 手势皮影戏 主程序
   舞台 / 导演 / 皮影志（非遗知识层 + 落盘）/ 锣鼓音效 / 演出录制
   三种输入：摄像头手势 · 键盘鼠标 · 自动演示 */
import { HandTracker, setFeel, FEEL, setRelax, relaxLevel, tune } from './hand.js?v=8';
import { Puppet, ROLES, HEADS, SKINS } from './puppet.js?v=5';
import { MOODS, drawScenery, drawTheatre, makePool } from './scenery.js?v=5';
import { createMusic } from './music.js?v=4';
import { PLAYS, ALL_PLAYS, createPlaybook, findPlay } from './plays.js?v=7';
import { LEVELS, RANK_CH, levelUnlocked, betterRank, createLevelRun } from './levels.js?v=1';
import { createBeat, PATTERNS } from './beat.js?v=5';
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

/* ============================== 皮影志（非遗知识层） ============================== */
const ZHI = [
  { id: 'z1', tag: '源流', title: '灯影还魂', how: '起灯可得',
    text: '皮影戏相传始于汉武帝思念李夫人，方士以灯取影，为其"还魂"。宋代《东京梦华录》已记"影戏"盛况，元明以后随商路传至中亚与欧洲。2011 年，中国皮影戏入选联合国教科文组织人类非物质文化遗产代表作名录。' },
  { id: 'z2', tag: '工序', title: '八道工', how: '换一次行当可得',
    text: '一张皮到一个人，要走八道：选皮、制皮、画稿、镂刻、敷彩、发汗熨平、缀结、装签。镂刻最考人——一个"万字不到头"的花样，要在牛皮上走三千多刀，刀口不能断。' },
  { id: 'z3', tag: '操纵', title: '七紧八慢九消停', how: '捏合挑签可得',
    text: '影人身后三根签：一根主签定身，两根手签管双臂。"七紧八慢九消停"是操作节奏的口诀——鼓点七下时手要快，八下要稳，九下要停住亮相。节奏错了，影子就散了。' },
  { id: 'z4', tag: '流派', title: '一方灯影一方腔', how: '连演 26 秒可得',
    text: '唐山皮影用驴皮，掐嗓唱乐亭调；陕西华县皮影配碗碗腔，线条最细腻；山东泰山皮影有"十不闲"绝技——一人手脚口同时操十样。同一门手艺，各唱各的腔。' },
  { id: 'z5', tag: '签子', title: '手上有三根签', how: '两只手对戏可得',
    text: '老艺人教徒弟，先不让唱，只让举签。举到影子站起来、手臂抬起来、关节不僵，才算入门——这门手艺的知识，从来不在纸上，只在手上。' },
  { id: 'z6', tag: '头茬', title: '一身多头', how: '换一次头茬可得',
    text: '皮影的身子和头是分开做的：身子叫"身段"，头叫"头茬"。同一副身段插上不同的头茬，就成了不同的人物——帝王戴王帽、武将戴盔头、后妃戴凤冠。戏箱里往往一副身段配好几个头。' },
  { id: 'z7', tag: '开戏', title: '打闹台', how: '开戏前把闹台打完可得',
    text: '开戏前先打闹台：锣鼓一起响，把街坊四邻招来，也让场上的人定住神。闹台打得越长，围的人越多——这是皮影班子的"广告"。打完闹台，才点灯开戏。' },
  { id: 'z8', tag: '皮料', title: '一方皮一方活', how: '换一种皮料可得',
    text: '唐山皮影用驴皮，薄而透；华县一带用牛皮，厚实耐磨；也有用羊皮的，透光最好但最考刻工——刻过了就破。皮料不同，影子的"虚实"就不同，行话叫"影性"。' }
];

/* ============================== 存档（皮影志 + 演出时长） ============================== */
const SAVE_KEY = 'zhangdeng.v1';
const store = {
  d: { zhi: [], play: 0, total: 0, plays: 0, done: {}, sel: '', music: 1, feel: 'loose', rate: {}, aud: .5, uiMode: 'guide', level: { done: {} }, hintKeys: 1 },
  load() {
    try { Object.assign(this.d, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) {}
    if (!Array.isArray(this.d.zhi)) this.d.zhi = [];
    if (!this.d.done || typeof this.d.done !== 'object') this.d.done = {};
    if (!this.d.level || typeof this.d.level !== 'object') this.d.level = { done: {} };
    if (!this.d.level.done || typeof this.d.level.done !== 'object') this.d.level.done = {};
  },
  flush() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.d)); } catch (e) {} }
};
store.load();

/* ============================== 音效（WebAudio 合成锣鼓 + 录制分流） ============================== */
const Audio_ = (() => {
  let ac = null, master = null, dest = null;
  function ctx() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 1;
      master.connect(ac.destination);
      try { dest = ac.createMediaStreamDestination(); master.connect(dest); } catch (e) { dest = null; }
    }
    return ac;
  }
  function noise(dur, freq, q, gain, type = 'bandpass') {
    const c = ctx(), n = Math.max(1, c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  }
  function tone(f0, f1, dur, gain, type = 'sine') {
    const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(c.currentTime + dur + .02);
  }
  return {
    resume() { try { return ctx().resume(); } catch (e) { return Promise.resolve(); } },
    gong() { try { noise(.9, 320, 1.2, .32); tone(196, 92, .85, .22, 'triangle'); tone(392, 180, .5, .07); Music.duck(.45, 1.5); } catch (e) {} },
    drum() { try { tone(120, 52, .22, .30, 'sine'); noise(.10, 180, .8, .10); } catch (e) {} },
    clap() { try { noise(.06, 2600, 2.4, .16); } catch (e) {} },
    chime() { try { tone(880, 1320, .55, .12, 'sine'); tone(1320, 1760, .45, .06); } catch (e) {} },
    /* 板：掌板 / 梆子 —— 点板判定用，短促干脆 */
    ban(heavy = false) {
      try { noise(heavy ? .09 : .05, heavy ? 1500 : 2600, 3.0, heavy ? .22 : .13); if (heavy) tone(320, 180, .10, .10, 'triangle'); } catch (e) {}
    },
    /* 小锣 / 碗碗：流派音色 */
    xiaoLuo() { try { tone(1180, 880, .30, .10, 'triangle'); noise(.10, 3400, 2.6, .09); } catch (e) {} },
    /* 失手（影子散了）：一声闷响 + 噪声 */
    oops() { try { tone(150, 70, .30, .18, 'sawtooth'); noise(.20, 500, .8, .10); } catch (e) {} },
    /* 开戏前的闹台锣鼓：比 gong 更长更闹 */
    nacao() { try { noise(1.1, 260, 1.0, .30); tone(180, 84, 1.0, .26, 'triangle'); tone(420, 200, .7, .10); Music.duck(.35, 2.0); } catch (e) {} },
    /* 叫好与掌声：几层错开的高频噪声铺成一片人声 */
    applause() {
      try {
        for (let i = 0; i < 6; i++) {
          const d = i * .055;
          const c = ctx(), n = Math.max(1, c.sampleRate * .34);
          const buf = c.createBuffer(1, n, c.sampleRate), dd = buf.getChannelData(0);
          for (let k = 0; k < n; k++) dd[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / n, 1.5);
          const s2 = c.createBufferSource(); s2.buffer = buf;
          const f = c.createBiquadFilter(); f.type = 'bandpass';
          f.frequency.value = 1700 + i * 420; f.Q.value = .8;
          const g = c.createGain(); g.gain.value = .085;
          s2.connect(f); f.connect(g); g.connect(master); s2.start(c.currentTime + d);
        }
        tone(520, 780, .5, .05, 'triangle');
        Music.duck(.5, 2.0);
      } catch (e) {}
    },
    /* 更鼓：收灯 / 换幕的沉稳一击 */
    geng() { try { tone(88, 46, .75, .26, 'sine'); noise(.26, 420, .7, .10); } catch (e) {} },
    state() { try { return ctx().state; } catch (e) { return 'none'; } },
    /* 给文场（背景音乐）用的总线：music.js 挂在同一条 master 上，录制时一并录进去 */
    bus() { return { ac: ctx(), master }; },
    /* 只有音频上下文真的在跑时才给音轨：
       上下文 suspended 时音轨永远不出数据，会把 MediaRecorder 整个拖死（录出 0 字节） */
    stream() {
      try {
        const c = ctx();
        if (c.state !== 'running') return null;
        return dest ? dest.stream : null;
      } catch (e) { return null; }
    }
  };
})();

/* ============================== 文场（背景音乐）==============================
   全离线合成（板胡 + 月琴 + 低音 + 板鼓），原创五声曲牌，不引用任何现成录音。
   挂在 Audio_ 的同一条 master 上 → 录屏时一并录进视频；谢幕叫好/锣鼓点时自动让路。 */
const Music = createMusic(() => Audio_.bus());
let musicOn = true, musicWant = null;
function setMusic(v) {
  musicOn = v == null ? !musicOn : !!v;
  store.d.music = musicOn ? 1 : 0; store.flush();
  const b = $('#btnMusic'); if (b) b.classList.toggle('on', musicOn);
  musicWant = null;                                   // 下一帧重新判断该起还是该停
  if (musicOn) { Audio_.resume(); toast('文场 · 开', '后台有板胡与月琴跟着锣鼓走，按 M 或点右上角「音乐」可关。', 7); }
  else { Music.stop(1.0); toast('文场 · 关', '只留锣鼓点子。', 5); }
}
function musicFollow() {
  const want = musicOn && (show.state === 'rise' || show.state === 'play' || show.state === 'curtain');
  if (want === musicWant) return;
  musicWant = want;
  if (want) { Music.school(schoolKey); Music.mood(moodKey); Music.perc(!beat.running); Music.start(); }
  else Music.stop(1.8);
}

/* ============================== 两种使用模式 ==============================
   「引导」：侧边一条步骤栏，写清"现在该做哪一步、用哪个手势、认到了没有"——给第一次玩的人、展览、教学用。
   「自由」：把步骤栏和场上提示全收起来，手势直接生效、不判对错——玩熟了随手演、或者演给别人看。 */
const LEX = [
  { k: 'open', t: '张掌', d: '手掌伸向灯 · 起灯' },
  { k: 'meet', t: '两手靠近', d: '两影凑到一块 · 搭腔 / 对招' },
  { k: 'wave', t: '横扫', d: '带起一阵风 · 换势 / 抛袖 / 磨刀' },
  { k: 'raise', t: '上挑', d: '把影人挑上去 · 腾起 / 水袖 / 折柳' },
  { k: 'kick', t: '下砸', d: '力气往下走 · 踢腿 / 踉跄' },
  { k: 'pinch', t: '捏合', d: '捏住那根签子 · 挑签 / 拾镯' },
  { k: 'fist', t: '攥拳', d: '攥住签子定住 · 亮相 / 敲锣鼓' },
  { k: 'turn', t: '翻手', d: '影人翻个面 · 换行当 / 翻身' }
];
let uiMode = 'guide';
/* 三种模式：引导 / 自由 / 新手。前两种 Tab 来回切；新手是"上课"——得自己开、上完自动回引导
   （Tab 不进新手，免得看戏的人手一滑掉进教学里出不来）。 */
function setUIMode(m, quiet) {
  uiMode = m === 'free' ? 'free' : (m === 'novice' ? 'novice' : 'guide');
  store.d.uiMode = uiMode; store.flush();
  document.body.classList.toggle('free', uiMode === 'free');
  document.body.classList.toggle('novice', uiMode === 'novice');
  const b = $('#btnMode');
  if (b) {
    b.innerHTML = uiMode === 'guide' ? '引导模式 <b>Tab</b>' : uiMode === 'free' ? '自由模式 <b>Tab</b>' : '新手模式 <b>Tab</b>';
    b.classList.toggle('on', uiMode === 'guide');
  }
  renderSteps();
  syncHints();                       // 引导/自由/新手切的这一下，右侧提示卡是否让位要重算
  if (!quiet) {
    if (uiMode === 'novice') return;                 // 新手模式的提示由 enterNovice 给
    toast(uiMode === 'guide' ? '引导模式' : '自由模式',
      uiMode === 'guide'
        ? '侧边写着当前这一步该怎么做：手掌图 + 一句话，做对了自动打勾。'
        : '提示全部收起，手势直接生效、不判对错——想怎么演就怎么演。按 Tab 切回来。', 8);
  }
}
const STEP_ARROW = { raise: 'up', flip: 'up2', kick: 'down', wave: 'side', meet: 'in', turn: 'turn', pinch: 'pinch', fist: 'fist', open: 'open' };
function drawStepHand(need) {
  const cv = $('#stepsHand'); if (!cv) return;
  const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, W, H);
  const kind = (need === 'turn') ? 'open' : (ghostKind(need) || 'open');
  const arrow = STEP_ARROW[need] || null;
  c.save(); c.scale(1.9, 1.9);
  drawMiniHand(c, 50, 46, 30, kind, 1);
  c.restore();
  if (!arrow) return;
  c.save();
  c.strokeStyle = 'rgba(255,226,160,.95)';
  c.fillStyle = 'rgba(255,226,160,.95)';
  c.lineWidth = 3; c.lineCap = 'round';
  const head = (x, y, ang) => {
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-7, -5); c.moveTo(0, 0); c.lineTo(-7, 5); c.stroke();
    c.restore();
  };
  const ax = W * .5, ay = H * .5;
  if (arrow === 'up') {
    c.beginPath(); c.moveTo(ax, ay + 74); c.lineTo(ax, ay + 40); c.stroke(); head(ax, ay + 38, -Math.PI / 2);
  } else if (arrow === 'up2') {
    for (const dx of [-16, 16]) { c.beginPath(); c.moveTo(ax + dx, ay + 74); c.lineTo(ax + dx, ay + 40); c.stroke(); head(ax + dx, ay + 38, -Math.PI / 2); }
  } else if (arrow === 'down') {
    c.beginPath(); c.moveTo(ax, ay + 34); c.lineTo(ax, ay + 68); c.stroke(); head(ax, ay + 70, Math.PI / 2);
  } else if (arrow === 'side') {
    c.beginPath(); c.moveTo(ax - 58, ay + 56); c.lineTo(ax + 58, ay + 56); c.stroke();
    head(ax + 60, ay + 56, 0); head(ax - 62, ay + 56, Math.PI);
  } else if (arrow === 'in') {
    c.beginPath(); c.moveTo(ax - 74, ay + 52); c.lineTo(ax - 46, ay + 52); c.stroke(); head(ax - 44, ay + 52, 0);
    c.beginPath(); c.moveTo(ax + 74, ay + 52); c.lineTo(ax + 46, ay + 52); c.stroke(); head(ax + 44, ay + 52, Math.PI);
  } else if (arrow === 'turn') {
    c.beginPath(); c.arc(ax, ay + 48, 58, Math.PI * .15, Math.PI * 1.5); c.stroke();
    head(ax + 58 * Math.cos(Math.PI * .15), ay + 48 + 58 * Math.sin(Math.PI * .15), Math.PI * .15 + Math.PI / 2);
  }
  c.restore();
}
const NEED_NAME = { open: '张掌', meet: '两手靠近', wave: '横扫', raise: '上挑', kick: '下砸', pinch: '捏合', fist: '攥拳', turn: '翻手', flip: '两手同抬', enter: '张掌', hold: '等着就行' };
function renderSteps() {
  const box = $('#steps'); if (!box) return;
  const list = $('#stepList'), cnt = $('#stepsCount'), nowEl = $('#stepNow'), needEl = $('#stepNeed');
  const live = !!(curPlay && PB.running);
  const cues = live ? curPlay.cues : null;
  const idx = live ? PB.idx : -1;
  const cur = live ? (cues[idx] || null) : null;
  const need0 = cur ? (Array.isArray(cur.need) ? cur.need : [cur.need]).find(n => NEED_NAME[n]) || null : null;
  /* 新手模式：步骤栏说的是"现在要学什么、怎么做"的大白话 + 「第 k/2 次」进度 */
  const novice = uiMode === 'novice';
  const rep = cur ? (cur.repeat || 1) : 1;
  const reps = cur ? (PB.reps || 0) : 0;
  if (cnt) cnt.textContent = live ? `${Math.min(idx + 1, cues.length)} / ${cues.length} 步${novice ? ' · 新手教学' : ''}` : '自由演 · 招式一览';
  if (nowEl) nowEl.textContent = cur
    ? (novice ? cur.n : cur.n + (cur.teach ? '（跟做）' : ''))
    : (novice ? '先学四手，再上台' : '想演什么就演什么');
  if (needEl) needEl.textContent = cur
    ? (novice
        ? (cur.hint || NEED_NAME[need0] || '') + (rep > 1 ? `　·　第 ${Math.min(reps + 1, rep)}/${rep} 次` : '')
        : (cur.hint || `${NEED_NAME[need0] || ''} · ${(cur.say || '').slice(0, 12)}`))
    : '手势直接生效，不判对错';
  drawStepHand(need0 || 'open');
  const key = live ? `${curPlay.id}:${idx}` : 'free';
  if (list && list.dataset.for !== key) {
    list.dataset.for = key;
    list.innerHTML = '';
    const items = live
      ? cues.map((c2, i) => ({ t: c2.n, done: i < idx, now: i === idx }))
      : LEX.map(l => ({ t: l.t, d: l.d }));
    for (const it of items) {
      const li = document.createElement('li');
      li.textContent = it.t;
      if (it.now) li.className = 'now';
      else if (it.done) li.className = 'done';
      if (it.d) li.title = it.d;
      list.appendChild(li);
    }
  }
  syncHints();          // 步骤栏高度变了（换幕/换模式），两旁的提示卡跟着重新落位
}
function stepLive() {   // 当前这一步"认到了"没有（给步骤栏亮灯）
  const box = $('#stepHandBox'), okEl = $('#stepOk');
  if (!box) return;
  const cur = (curPlay && PB.running) ? PB.cue : null;
  const need0 = cur ? (Array.isArray(cur.need) ? cur.need : [cur.need]).find(n => NEED_NAME[n]) : null;
  const t = need0 ? ((show.moves || {})[need0] || -99) : -99;
  const on = show.elapsed - t < 2.4;
  box.classList.toggle('on', on);
  if (okEl) okEl.hidden = !on;
}

/* ============================== 手感（宽容度）==============================
   摄像头前面的人和演示里的合成手不一样：捏不拢、攥不紧、手一晃就出画。
   三档直接改手势引擎的阈值（hand.js 的 FEEL），默认「宽松」——先让人做得动，再谈做得准。 */
const FEEL_ORDER = ['loose', 'normal', 'strict'];
function setFeelUI(k) {
  const key = FEEL_ORDER.includes(k) ? k
    : FEEL_ORDER[(FEEL_ORDER.indexOf(store.d.feel || 'loose') + 1) % FEEL_ORDER.length];
  store.d.feel = key; store.flush();
  const name = setFeel(key);
  refreshChips();
  toast(`手感 · ${name}`,
    key === 'loose' ? '捏不拢、攥不紧、手晃一下出画都不怕——最不容易"没反应"。'
      : key === 'normal' ? '标准松紧：误触更少，要多做半分才认。'
        : '要做得干净利落才算——练熟了再换。', 8);
}
setFeel(store.d.feel || 'loose');

/* ============================== 演出录制 ============================== */
const Rec = {
  mr: null, chunks: [], on: false,
  stamp() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  },
  async start() {
    if (this.on) return;
    if (!window.MediaRecorder || !cv.captureStream) {
      $('#hintMode').textContent = '这个浏览器不支持录制，建议用 Chrome / Edge';
      return;
    }
    try {
      await Audio_.resume();                       // 先把音频上下文唤醒，再决定要不要音轨
      const tracks = [...cv.captureStream(30).getVideoTracks()];
      const as = Audio_.stream();
      if (as) tracks.push(...as.getAudioTracks());
      const cands = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const mt = cands.find(t => MediaRecorder.isTypeSupported(t)) || '';
      this.mr = new MediaRecorder(new MediaStream(tracks),
        mt ? { mimeType: mt, videoBitsPerSecond: 6000000 } : undefined);
      this.hasAudio = !!as;
      this.chunks = [];
      this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
      this.mr.onstop = () => {
        const blob = new Blob(this.chunks, { type: 'video/webm' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `掌灯_演出_${this.stamp()}.webm`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 6000);
        $('#hintMode').textContent = '录制已保存到「下载」文件夹';
        setTimeout(() => { if (!$('#hintMode').textContent.includes('权限')) $('#hintMode').textContent = ''; }, 5000);
      };
      this.mr.start(1000);
      this.on = true;
      $('#btnRec').classList.add('on');
      $('#btnRec').innerHTML = '<i></i>停止录制';
    } catch (e) {
      $('#hintMode').textContent = '录制启动失败：' + e.message;
    }
  },
  stop() {
    if (!this.on || !this.mr) return;
    try { this.mr.stop(); } catch (e) {}
    this.on = false;
    $('#btnRec').classList.remove('on');
    $('#btnRec').innerHTML = '● 录制';
  },
  toggle() { this.on ? this.stop() : this.start(); }
};

/* ============================== 舞台 ============================== */
const cv = $('#stage'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = Math.min(2, window.devicePixelRatio || 1);
let screen = { x: 0, y: 0, w: 0, h: 0 };
let dust = [], UI = 1;

function layout() {
  VW = cv.clientWidth; VH = cv.clientHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  UI = clamp(Math.max(VW / 1440, VH / 860) * .92, .74, 1.35);
  // 竖屏（手机）用接近方形的幕布，横屏用 16:10
  const ASP = (VW / VH) < 1.15 ? 0.94 : 1.6;
  const m = Math.min(VW * .06, 90), top = Math.min(VH * .10, 80), bot = Math.min(VH * .18, 130);
  let w = VW - m * 2, h = w / ASP;
  if (h > VH - top - bot) { h = VH - top - bot; w = h * ASP; }
  screen = { x: (VW - w) / 2, y: top, w, h };
  dust = Array.from({ length: 64 }, () => ({
    x: rnd(0, 1), y: rnd(0, 1), r: rnd(.5, 1.9), sp: rnd(.004, .02), ph: rnd(0, 6.28)
  }));
  syncHints();                       // 幕布一变，两旁的键鼠提示跟着落位（或让位）
}
window.addEventListener('resize', () => { layout(); });
window.addEventListener('orientationchange', () => setTimeout(layout, 200));

const lamp = { v: 0, target: 0, flick: 0 };

/* 幕布灯光（灯 / 火 / 月 / 暮）：六档之间插值，换景不跳色 */
let moodKey = 'lamp';
const moodRGB = {
  top: [255, 241, 208], mid: [246, 214, 158], low: [196, 150, 92]
};
function setMood(k) { if (MOODS[k]) moodKey = k; Music.mood(moodKey); }
const eventLog = [];                       // 手势事件流水（验收/调试看得到"到底认没认"）
let fakeCam = null;                        // 合成摄像头（验收用；null = 用真摄像头）
/* 招式表：每个招式最近一次被认出来的时刻（面板上会亮灯，也是验收的抓手） */
const MOVE_LIST = ['pinch', 'fist', 'open', 'turn', 'wave', 'kick', 'raise', 'meet', 'flip', 'point'];
const MOVE_NAME = { pinch: '捏合', fist: '攥拳', open: '张掌', turn: '翻手', wave: '横扫', kick: '下砸', raise: '上挑', meet: '两手靠近', flip: '两手同抬', point: '指认' };
function mark(name) {
  if (!MOVE_LIST.includes(name)) return;
  show.moves = show.moves || {}; show.moves[name] = show.elapsed;
  show.mark = { n: name, t: show.elapsed };     // 认到就大字闪一下（最直白的一句"我收到了"）
  if (LV.running) LV.act(name);                 // 闯关：认到的手势直接算进这一关的进度
}
function moodStep(dt) {
  const m = MOODS[moodKey] || MOODS.lamp, k = 1 - Math.exp(-dt / .55);
  for (const key of ['top', 'mid', 'low']) {
    for (let i = 0; i < 3; i++) moodRGB[key][i] = lerp(moodRGB[key][i], m[key][i], k);
  }
}
const mRgb = (key, a) => `rgba(${moodRGB[key][0] | 0},${moodRGB[key][1] | 0},${moodRGB[key][2] | 0},${a})`;
const amb = makePool(46);

/* ---------- 幕布布纹：预生成一次（随幕布尺寸缓存），用 overlay 叠在灯光上 ---------- */
let clothTex = null, clothFor = '';
function makeCloth(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(96, Math.round(Math.min(w, 1600)));      // 1:1 生成，织纹才不被缩放糊掉
  c.height = Math.max(96, Math.round(h * (c.width / w)));
  const g = c.getContext('2d'), W = c.width, H = c.height;
  /* 纬线：一条条细横纹，疏密深浅都不匀（家织布本来就织不齐） */
  for (let i = 0; i < Math.round(H * 2.1); i++) {
    const y = Math.random() * H, x = Math.random() * W, len = 8 + Math.random() * W * .34;
    g.strokeStyle = `rgba(90,60,26,${.03 + Math.random() * .10})`;
    g.lineWidth = Math.random() < .82 ? 1 : 2;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y + (Math.random() - .5) * 1.2); g.stroke();
  }
  /* 经线：更淡的竖纹 */
  for (let i = 0; i < Math.round(W * .8); i++) {
    const x = Math.random() * W, y = Math.random() * H, len = 10 + Math.random() * H * .3;
    g.strokeStyle = `rgba(118,86,42,${.02 + Math.random() * .055})`;
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 1.2, y + len); g.stroke();
  }
  /* 棉籽与纸筋：深浅小斑点 */
  for (let i = 0; i < Math.round(W * H / 700); i++) {
    g.fillStyle = `rgba(${Math.random() < .55 ? '80,52,20' : '160,126,74'},${.05 + Math.random() * .14})`;
    g.beginPath(); g.arc(Math.random() * W, Math.random() * H, .5 + Math.random() * 1.7, 0, 6.2832); g.fill();
  }
  /* 浆糊的云絮：成团的不均匀透光 */
  for (let i = 0; i < 34; i++) {
    const x = Math.random() * W, y = Math.random() * H, r = W * (.05 + Math.random() * .13);
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,246,216,${.06 + Math.random() * .07})`);
    rg.addColorStop(1, 'rgba(255,246,216,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  return c;
}

function drawStage(t) {
  /* 每帧从零开始：reset() 顺手清掉可能被上游漏下的裁剪/变换/滤镜（老版本在 lamp.v 过渡区间漏过 endClip，
     幕布裁剪会一直粘着，导致檐幕、上下场门、左下 HUD、知识卡片下半截全被裁掉） */
  if (typeof ctx.reset === 'function') ctx.reset();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, VW, VH);
  ctx.fillStyle = '#080503';
  ctx.fillRect(0, 0, VW, VH);
  const L = lamp.v;
  if (L <= .001) return false;
  const cx = screen.x + screen.w / 2, cy = screen.y + screen.h * .46;

  ctx.save();
  const g0 = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(screen.w, screen.h) * .95);
  g0.addColorStop(0, mRgb('top', .30 * L));
  g0.addColorStop(.45, mRgb('low', .12 * L));
  g0.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g0;
  ctx.fillRect(0, 0, VW, VH);
  ctx.restore();

  const fw = Math.max(8, screen.w * .014);
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(screen.x - fw, screen.y - fw, screen.w + fw * 2, screen.h + fw * 2);
  ctx.strokeStyle = 'rgba(232,192,122,.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(screen.x - fw / 2, screen.y - fw / 2, screen.w + fw, screen.h + fw);

  ctx.save();
  ctx.beginPath();
  ctx.rect(screen.x, screen.y, screen.w, screen.h);
  ctx.clip();
  const gs = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(screen.w, screen.h) * .70);
  const fl = 1 + Math.sin(t * 7.3) * .022 * L + Math.sin(t * 3.1) * .014 * L;
  gs.addColorStop(0, mRgb('top', clamp(.96 * L * fl, 0, 1)));
  gs.addColorStop(.55, mRgb('mid', clamp(.88 * L * fl, 0, 1)));
  gs.addColorStop(1, mRgb('low', clamp(.80 * L * fl, 0, 1)));
  ctx.fillStyle = gs;
  ctx.fillRect(screen.x, screen.y, screen.w, screen.h);

  /* 灯芯热团：灯就吊在幕布后面略高处，正中比四周亮一档（影人正是从这团光里出来） */
  const kx = cx, ky = cy - screen.h * .07;
  const gk = ctx.createRadialGradient(kx, ky, 0, kx, ky, Math.max(screen.w, screen.h) * .36);
  gk.addColorStop(0, mRgb('top', clamp(.26 * L * fl, 0, 1)));
  gk.addColorStop(.6, mRgb('mid', clamp(.09 * L, 0, 1)));
  gk.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gk;
  ctx.fillRect(screen.x, screen.y, screen.w, screen.h);

  /* 布纹：亮子不是一张纯色纸，是绷在木框上的家织布——经纬、棉籽、浆糊的云絮 */
  const key = Math.round(screen.w) + 'x' + Math.round(screen.h);
  if (clothFor !== key) { clothTex = makeCloth(screen.w, screen.h); clothFor = key; }
  if (clothTex) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';          // 暗处压暗、亮处提亮 = 凹凸的织纹
    ctx.globalAlpha = clamp(.78 * L, 0, .92);
    ctx.drawImage(clothTex, screen.x, screen.y, screen.w, screen.h);
    ctx.restore();
  }

  /* 布幅拼接的竖缝：真的亮子是几幅布缝起来的，缝线比旁边暗一点、右边带一道浅痕 */
  for (const u of [.334, .667]) {
    const x = screen.x + screen.w * u;
    ctx.globalAlpha = .17 * L; ctx.strokeStyle = '#3a2408'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, screen.y); ctx.lineTo(x, screen.y + screen.h); ctx.stroke();
    ctx.globalAlpha = .07 * L; ctx.strokeStyle = '#ffe9b8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 2.2, screen.y); ctx.lineTo(x + 2.2, screen.y + screen.h); ctx.stroke();
  }

  /* 布的下垂：几道极淡的横向明暗，像布在上下木轴之间微微坠着 */
  for (let i = 0; i < 4; i++) {
    const y = screen.y + screen.h * (.19 + i * .205) + Math.sin(t * .34 + i * 1.7) * 1.6;
    const hh = screen.h * .11;
    const g2 = ctx.createLinearGradient(0, y - hh, 0, y + hh);
    g2.addColorStop(0, 'rgba(38,22,4,0)');
    g2.addColorStop(.5, `rgba(38,22,4,${.055 * L})`);
    g2.addColorStop(1, 'rgba(38,22,4,0)');
    ctx.fillStyle = g2; ctx.fillRect(screen.x, y - hh, screen.w, hh * 2);
  }

  /* 四周压暗 + 木框的阴影：布是绷上去的，边上一圈必然比中间暗 */
  const eg = [
    ['h', screen.x, screen.y, screen.w, screen.h * .16, 1],
    ['h', screen.x, screen.y + screen.h, screen.w, -screen.h * .16, -1],
    ['v', screen.x, screen.y, screen.w * .10, screen.h, 1],
    ['v', screen.x + screen.w, screen.y, -screen.w * .10, screen.h, -1]
  ];
  for (const [dir, x0, y0, w2, h2] of eg) {
    const x2 = x0 + w2, y2 = y0 + h2;
    const gg = ctx.createLinearGradient(x0, y0, x2, y2);
    gg.addColorStop(0, `rgba(26,14,2,${.30 * L})`);
    gg.addColorStop(1, 'rgba(26,14,2,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(dir === 'h' ? x0 : Math.min(x0, x2), dir === 'h' ? Math.min(y0, y2) : y0,
      dir === 'h' ? w2 : Math.abs(w2), dir === 'h' ? Math.abs(h2) : h2 === 0 ? 1 : h2);
  }

  /* 绷布的针脚：沿着布边一小段一小段的线迹 */
  ctx.globalAlpha = .20 * L; ctx.strokeStyle = '#4a2e10'; ctx.lineWidth = 1;
  for (let x = screen.x + 9; x < screen.x + screen.w - 6; x += 27) {
    ctx.beginPath(); ctx.moveTo(x, screen.y + 4.5); ctx.lineTo(x + 9, screen.y + 4.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, screen.y + screen.h - 4.5); ctx.lineTo(x + 9, screen.y + screen.h - 4.5); ctx.stroke();
  }
  for (let y = screen.y + 9; y < screen.y + screen.h - 6; y += 27) {
    ctx.beginPath(); ctx.moveTo(screen.x + 4.5, y); ctx.lineTo(screen.x + 4.5, y + 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(screen.x + screen.w - 4.5, y); ctx.lineTo(screen.x + screen.w - 4.5, y + 9); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const d of dust) {
    const yy = (d.y + t * d.sp) % 1;
    const a = (Math.sin(t * 1.4 + d.ph) * .5 + .5) * .30 * L;
    ctx.fillStyle = `rgba(255,236,190,${a})`;
    ctx.beginPath();
    ctx.arc(screen.x + d.x * screen.w, screen.y + yy * screen.h, d.r, 0, 6.2832);
    ctx.fill();
  }
  return true;          // 已保存并裁剪了幕布，调用方必须 endClip()
}
function endClip() { ctx.restore(); }

function stamp(x, y, size, text, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(-.045);
  ctx.strokeStyle = 'rgba(184,53,42,.92)';
  ctx.lineWidth = Math.max(2, size * .045);
  const r = size * .06;
  ctx.beginPath();
  ctx.moveTo(-size / 2 + r, -size / 2);
  ctx.arcTo(size / 2, -size / 2, size / 2, size / 2, r);
  ctx.arcTo(size / 2, size / 2, -size / 2, size / 2, r);
  ctx.arcTo(-size / 2, size / 2, -size / 2, -size / 2, r);
  ctx.arcTo(-size / 2, -size / 2, size / 2, -size / 2, r);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = 'rgba(184,53,42,.92)';
  ctx.font = `600 ${size * .52}px "STKaiti","KaiTi",serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, size * .02);
  ctx.restore();
}

/* ============================== 导演 ============================== */
const order = ['sheng', 'dan', 'jing', 'chou'];
const MAXP = 4;
const puppets = Array.from({ length: MAXP }, (_, i) => new Puppet(order[i % order.length]));
const show = {
  state: 'warmup', t0: 0, elapsed: 0, playTime: 0, restT: 0, curtainT: 0,
  roleIdx: 0, unlocked: new Set(store.d.zhi), cards: [], toast: null,
  subtitles: null, subT: 0, hint: '', view: false, cue: null, seal: null, beatHit: null
};
let active = [];

/* ============================== 戏折子（三出折子戏） ============================== */
let sceneKey = 'field';       // 当前布景
let curPlay = null;           // 当前选中剧目（null = 自由演）
const wave = { t: 0, cool: 0, hist: [] };
const chop = { cool: 0 };          // 下压踢腿 / 双手上抬翻身 的冷却
let upsAt = 0, flipAt = 0;         // 翻身：最近一次"两手同抬"的时刻 / 上次翻身的时刻（低帧率宽容用）

/* ---------- 新增玩法总闸：两签 / 头茬 / 皮料 / 流派 / 点板 / 闹台 / 打赏 ---------- */
let twoSign = false;              // true = 两只手共操一只影人（一只手定身、一只手提臂）
let headWanted = null;            // 指定头茬（null = 跟行当）
let skinKey = 'lv';               // 皮料：lv 驴皮 / niu 牛皮 / yang 羊皮
let schoolKey = 'tangshan';       // 流派（连带皮料与锣鼓音色）
let warmHits = 0, tipHits = 0;    // 闹台敲了几下 / 叫好拍了几下

const SCHOOLS = {
  tangshan: { key: 'tangshan', name: '唐山 · 乐亭调', skin: 'lv', pattern: 'classic',
    note: '驴皮，唱乐亭调；锣鼓点子最"闹"，闹台要打得长。' },
  huaxian: { key: 'huaxian', name: '华县 · 碗碗腔', skin: 'niu', pattern: 'wen',
    note: '牛皮，配碗碗腔；线最细，鼓点清亮，讲究"稳"字。' },
  taishan: { key: 'taishan', name: '泰山 · 十不闲', skin: 'yang', pattern: 'wu',
    note: '羊皮透亮，"十不闲"一人手脚口同时操十样，鼓点最急。' }
};

const beat = createBeat({
  onBeat: a => {
    Audio_.ban(a.heavy); if (a.heavy) Audio_.xiaoLuo();
    // 台上跟着板走：脚下点一下，重拍带翎子的甩一下
    active.forEach(p => {
      p.jump = Math.max(p.jump, a.heavy ? .30 : .16);
      if (a.heavy && p.role.plumes) p.flickPlume(.9);
    });
  },
  onHit: () => { Audio_.clap(); show.beatHit = { t: 0 }; if (LV.running) LV.beat(); },
  onMiss: () => { Audio_.oops(); },
  onPhrase: sc => { toast('一句板走完', `功底 ${sc.hits} 中 · 失手 ${sc.misses}`, 6); }
});

/* 换头茬：皮影的头是插拔件 */
const HEAD_ORDER = ['jin', 'bun', 'helm', 'cap', 'feng', 'wang'];
function cycleHead(step = 1) {
  const cur = headWanted || (active[0] && active[0].headInfo.key) || 'jin';
  let i = HEAD_ORDER.indexOf(cur);
  i = (i + step + HEAD_ORDER.length) % HEAD_ORDER.length;
  headWanted = HEAD_ORDER[i];
  active.forEach(p => p.setHead(headWanted));
  const H = HEADS[headWanted];
  Audio_.clap();
  unlock('z6');
  toast(`头茬 · ${H.name}`, `换头茬就换人：${H.name}（${H.who}）。一副身段配好几个头，是皮影的常规做法。`, 8);
}

/* 换皮料 */
const SKIN_ORDER = ['lv', 'niu', 'yang'];
function cycleSkin(step = 1) {
  let i = SKIN_ORDER.indexOf(skinKey);
  i = (i + step + SKIN_ORDER.length) % SKIN_ORDER.length;
  skinKey = SKIN_ORDER[i];
  active.forEach(p => p.setSkin(skinKey));
  const S = SKINS[skinKey];
  Audio_.ban(true);
  unlock('z8');
  toast(`皮料 · ${S.name}`, S.note, 9);
}

/* 换流派：连皮带鼓一起换 */
function setSchool(k) {
  if (!SCHOOLS[k]) return;
  schoolKey = k;
  const S = SCHOOLS[k];
  skinKey = S.skin;
  active.forEach(p => { p.setSkin(skinKey); });
  beat.setPattern(S.pattern);
  Music.school(k);
  Audio_.xiaoLuo();
  unlock('z8');
  toast(`流派 · ${S.name}`, `${S.note}　（皮料一并换成${SKINS[S.skin].name}，鼓点改成「${PATTERNS[S.pattern].name}」）`, 10);
}

/* 两签共操：一只手定身、一只手提臂 */
function toggleTwoSign(v) {
  twoSign = v == null ? !twoSign : !!v;
  if (twoSign) {
    unlock('z5');
    if (mode === 'manual' && MAN.extra < 1) { MAN.extra = Math.max(1, MAN.extra); HT.resettle(); }   // 键盘模式自动补一只手当手签
  }
  toast(twoSign ? '两只手 · 共操一只影人' : '两只手 · 各操一个影人',
    twoSign
      ? '左手当主签：定身、走台、上挑；右手当手签：单独提这只影人的右臂（键盘用 U 提臂 / O 放臂）——皮影的"三根签"就是这么分工的。'
      : '两只手各带一个影人，可以打对手戏。', 9);
}

/* 打闹台：开戏前招观众 */
function warmupHit(what) {
  if (show.state !== 'warmup') return;
  warmHits++;
  Audio_.drum();
  if (warmHits % 3 === 0) Audio_.xiaoLuo();
  if (warmHits >= 6) {
    Audio_.nacao();
    unlock('z7');
    subtitle('闹台打完 · 点灯开戏', 3);
    toast('观众到齐了', '打闹台是皮影班子的"广告"——锣鼓一响，街坊四邻就围过来了。', 8);
    show.state = 'wake'; show.hint = mode === 'manual' ? '按住空格 · 掌灯' : '把手掌伸向灯';
  }
}
function warmupProgress() { return Math.min(1, warmHits / 6); }

/* 叫好打赏：演完拍手，台上加一段绝活回礼 */
function tipHit() {
  if (show.state !== 'curtain') return;
  tipHits++;
  Audio_.clap();
  if (tipHits >= 3) {
    tipHits = 0;
    Audio_.applause();
    active.forEach(p => { p.act('plume'); p.bow = 1; });
    if (!store.d.tips) store.d.tips = 0;
    store.d.tips++; store.flush();
    toast('赏 · 一段绝活回礼', `叫好 ${store.d.tips} 次。老规矩：赏钱多，班子的花活就多。`, 8);
    show.curtainT = 0;
  }
}

/* ============================== 闯关 · 十二关 ==============================
   判定直接坐在"自由模式"的手势识别上：认得的手势 / 走影 / 对板 / 同台人数，做出来就算。
   台上不排台本（curPlay = null），目标与计时交给 levels.js 那个引擎攒；
   这里只管摆台、喂数、落印、记账。 */
let lvOn = false;
const LV = createLevelRun({
  help: t => {
    Audio_.ban(true);
    toast('帮衬一下', `「${t.n}」这一格先替你记上——卡久了关里会自动放宽（照实算一次帮衬）。`, 5);
  },
  done: (lv, info) => levelDone(lv, info)
});

function levelLockMsg(id) {
  const lv = LEVELS.find(v => v.id === id); if (!lv) return;
  Audio_.oops();
  toast('这关还没开', `先过了第 ${id - 1} 关（有成绩就算过），第 ${id} 关「${lv.name}」才开。`, 8);
}

function startLevel(id) {
  const lv = LEVELS.find(v => v.id === id);
  if (!lv) return null;
  if (!levelUnlocked(id, store.d.level && store.d.level.done)) { levelLockMsg(id); return null; }
  if (!started) camOn();
  /* 闯关不排台本：判定和自由演一样直接，手出画也不算输 */
  curPlay = null; PB.stop();
  show.cue = null; show.seal = null; show.rate = null; show.bigNote = null;
  setRelax(0); show.helped = 0; show.mark = null; show.playTime = 0;
  sceneKey = lv.id % 2 ? 'field' : 'yard'; setMood('lamp');
  $('#plays').classList.remove('show');
  $('#levels').classList.remove('show');
  $('#lvNext').classList.remove('show');
  document.body.classList.add('lv');
  /* 这一关要的阵仗先替你摆开：两签 / 点板 / 四个人影 */
  toggleTwoSign(!!lv.twoSign);
  if (lv.beat) { if (!beat.running) beatToggle(true); else refreshChips(); }
  else if (beat.running) beatToggle(false);
  if (lv.cast >= 4 && mode === 'manual') { MAN.extra = Math.max(MAN.extra, 3); HT.resettle(); }
  active = [puppets[0]];
  puppets[0].appear = 0; puppets[0].setRole(order[0]); puppets[0].setSkin(skinKey);
  if (headWanted) puppets[0].setHead(headWanted);
  puppets[0].x = .5; puppets[0].y = .78;
  show.state = 'play';
  lamp.v = 1; lamp.target = 1;
  LV.start(id); lvOn = true;
  refreshLvPanel();
  toast(`第 ${id} 关 · ${lv.name}`, `${lv.note}　（时限 ${lv.time} 秒 · 目标：${LV.progress}）`, 9);
  return lv;
}

function stopLevel() {
  LV.stop(); lvOn = false;
  document.body.classList.remove('lv');
  $('#lvNext').classList.remove('show');
  show.seal = null; show.rate = null; show.hint = '';
  show.state = 'wake';
  active = [];
  if (beat.running) beatToggle(false);
}

function levelDone(lv, info) {
  lvOn = false;
  if (!store.d.level || typeof store.d.level !== 'object') store.d.level = { done: {} };
  if (!store.d.level.done) store.d.level.done = {};
  const key = String(lv.id);
  const prev = store.d.level.done[key];
  store.d.level.done[key] = prev ? betterRank(prev, info.rank) : info.rank;   // 可重打：只留最好的一次
  store.flush();
  if (lv.zhi) unlock(lv.zhi);                                                // 打通特定关卡 → 点亮对应皮影志
  const ch = RANK_CH[info.rank];
  show.seal = { t: 0, text: lv.name, rate: ch };
  show.rate = { ch, helped: info.helped, at: 0 };
  Audio_.applause();
  document.body.classList.remove('lv');
  refreshLvPanel();
  const next = LEVELS.find(v => v.id === lv.id + 1);
  const nb = $('#lvNextBtn');
  if (nb) nb.textContent = next ? `下一关 · ${next.name}` : '十二关都过了 · 收灯';
  $('#lvNext').classList.add('show');
  const allClear = LEVELS.every(v => store.d.level.done[String(v.id)]);
  toast(`第 ${lv.id} 关 · ${lv.name}　评「${ch}」`,
    info.timeout ? '时限到了——戏还是走完了，先记「下」。想拿「上」，重打一遍：一次帮衬都不用。'
      : info.helped === 0 ? (allClear ? '一次帮衬都没用——十二关，满台彩。' : '一次帮衬都没用——干净，开下一关。')
        : `用了 ${info.helped} 次帮衬。重打一遍可以冲「上」。`, 14);
}

function refreshLvPanel() {
  const ul = $('#levels ul'); if (!ul) return;
  const doneMap = (store.d.level && store.d.level.done) || {};
  ul.innerHTML = '';
  for (const lv of LEVELS) {
    const got = doneMap[String(lv.id)];
    const open = levelUnlocked(lv.id, doneMap);
    const li = document.createElement('li');
    li.dataset.level = String(lv.id);
    if (!open) li.classList.add('locked');
    li.innerHTML = '<b></b><i class="no"></i><s></s><em></em>';
    li.querySelector('b').textContent = `第 ${lv.id} 关 · ${lv.name}`;
    li.querySelector('i.no').textContent = `时限 ${lv.time} 秒`;
    li.querySelector('s').textContent = open ? (got ? `评 ${RANK_CH[got]}` : '') : '未开';
    li.querySelector('em').textContent = lv.note + (lv.zhi ? '　（通过这一关，皮影志 +1）' : '');
    li.onclick = () => { if (open) startLevel(lv.id); else levelLockMsg(lv.id); };
    ul.appendChild(li);
  }
}

/* 关内那行"第几关 · 目标 · 进度 · 计时"——画在幕布上沿，和折子戏的进度条同一处 */
function drawLevelBanner(t) {
  const lv = LV.level; if (!lv) return;
  const bx = VW < 760;
  const F = k => `${k * UI}px system-ui,"Microsoft YaHei"`;
  const FS = k => `${k * UI}px "STKaiti","KaiTi",serif`;
  const cx = screen.x + screen.w / 2, y0 = screen.y + 20 * UI;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = FS(bx ? 15 : 18);
  const label = `第 ${lv.id} 关 · ${lv.name}`;
  const lw = ctx.measureText(label).width;
  ctx.fillStyle = 'rgba(40,20,6,.48)';
  ctx.fillRect(cx - lw / 2 - 18, y0 - 15 * UI, lw + 36, 30 * UI);
  ctx.fillStyle = 'rgba(255,236,196,.94)';
  ctx.fillText(label, cx, y0);
  ctx.font = F(bx ? 13 : 15);
  const prog = LV.progress;
  const pw = ctx.measureText(prog).width;
  ctx.fillStyle = 'rgba(40,20,6,.44)';
  ctx.fillRect(cx - pw / 2 - 14, y0 + 20 * UI, pw + 28, 25 * UI);
  ctx.fillStyle = LV.allDone ? 'rgba(150,240,180,.95)' : 'rgba(255,226,170,.92)';
  ctx.fillText(prog, cx, y0 + 32.5 * UI);
  const left = Math.ceil(LV.left);
  ctx.textAlign = 'right';
  ctx.font = FS(bx ? 15 : 18);
  ctx.fillStyle = left <= 10 ? `rgba(233,120,96,${.66 + .34 * (Math.sin(t * 6) * .5 + .5)})` : 'rgba(255,236,196,.92)';
  ctx.fillText(`${left}s`, screen.x + screen.w - 22 * UI, y0);
  ctx.font = F(12);
  ctx.fillStyle = 'rgba(255,232,190,.60)';
  ctx.fillText(`帮衬 ${LV.helped}`, screen.x + screen.w - 22 * UI, y0 + 22 * UI);
  ctx.restore();
}

const PB = createPlaybook({
  subtitle: (txt, dur) => subtitle(txt, dur || 4.4),
  sfx: k => { const f = Audio_[k] || Audio_.drum; try { f.call(Audio_); } catch (e) {} },
  /* 大戏换景：哪一幕声明了 scene/mood，就当场换景换灯 */
  scene: (s, m) => { if (s) sceneKey = s; if (m) setMood(m); },
  /* 帮一把：这一幕等太久，放宽到"随便一个手势都算"，并记一次帮衬 */
  helped: cue => {
    show.helped = (show.helped || 0) + 1;
    show.helpFlash = 1;
    const r = setRelax(Math.min(.45, .12 * show.helped));   // 越做不出来越松：捏不拢、动得小也认
    refreshChips();
    Audio_.ban(true);
    toast('帮衬一下', `「${cue.n}」这一下算你的——等久了就放宽：接下来随便一个手势都能过。` +
      (r > 0 ? `手感已自动放宽（第 ${show.helped} 次），接着做就行。` : ''), 5.5);
  },
  progress: (play, i, cue) => {
    show.cue = { name: play.name, n: cue.n, i, of: play.cues.length, hint: cue.hint };
    renderSteps();                                                    // 侧边步骤栏跟着台本走
    /* 教戏：走到第 i 幕就意味着已经跟做出 i 个动作（最后一幕"谢幕"正好等于动作数） */
    if (play.learn) show.learnIdx = Math.max(show.learnIdx || 0, i);
    /* 台下人气：自己出手就涨，靠帮衬就掉 */
    if (show.helpedAt !== (PB.helped || 0)) { show.helpedAt = PB.helped || 0; show.aud = Math.max(0, (show.aud || .5) - .12); }
    else show.aud = Math.min(1, (show.aud == null ? .5 : show.aud) + .10);
    refreshPlay();
  },
  /* 新手教学：每一手第一次认到，幕布上给一行大字说明（这手势在皮影里叫什么、影人做什么） */
  rep: (cue, reps) => {
    if (reps === 1 && cue.big) show.bigNote = { text: cue.big, t: 0 };
    renderSteps();                     // 步骤栏里的「第 k/2 次」要跟着涨
  },
  /* 做满 repeat 次 = 学会一手：亮一条对应的皮影志 + 一条 toast */
  learned: cue => {
    if (!cue.zhi) return;
    unlock(cue.zhi);
    toast(`学会一手 · ${MOVE_NAME[cue.teach] || cue.n}`, cue.big || '', 7);
  },
  act: name => {
    const ps = (active.length ? active.slice() : [puppets[0]]);
    ps.forEach(p => p.act(name));
  },
  done: p => finishPlay(p)
});

function refreshPlay() {
  const el = $('#btnPlay'); if (!el) return;
  const done = Object.keys(store.d.done || {});
  el.innerHTML = curPlay
    ? `戏折子 <b>${curPlay.name} ${Math.min(PB.idx + 1, curPlay.cues.length)}/${curPlay.cues.length}</b>`
    : `戏折子 <b>${done.length}/${ALL_PLAYS.length}</b>`;
  const st = $('#veil .pick'); if (st) {
    st.querySelectorAll('[data-play]').forEach(b => b.classList.toggle('on', b.dataset.play === (curPlay ? curPlay.id : '')));
  }
  document.querySelectorAll('#plays [data-play]').forEach(b => {
    const p = findPlay(b.dataset.play);
    b.classList.toggle('on', !!curPlay && curPlay.id === b.dataset.play);
    const m = b.querySelector('.done');
    if (m) m.textContent = p && store.d.done[p.id] ? '已演' : '';
  });
}

function pickPlay(id) {
  if (id) {
    const want = findPlay(id);
    if (want && want.unlock === 'three-top' && !store.d.grand) {     // 大戏：三出都上评才开箱
      toast('这出还没开箱', '《灯影还魂》是全本大戏——三出折子戏各唱到「上」评，班子才肯开箱。', 11);
      Audio_.oops();
      return;
    }
  }
  curPlay = findPlay(id) || null;
  store.d.sel = curPlay ? curPlay.id : '';
  store.flush();
  PB.stop();
  show.cue = null;
  show.seal = null;
  setRelax(0); show.helped = 0; show.mark = null;                 // 换一出戏 → 手感回到初始松紧
  renderSteps();
  if (!curPlay) {
    setMood('lamp'); sceneKey = 'field';
    toast('自由演', '不点戏：四个行当随你调遣，怎么走都是戏。', 6);
  } else {
    setMood(curPlay.mood || 'lamp');
    sceneKey = curPlay.scene || 'field';
    toast(`《${curPlay.name}》`, curPlay.blurb, 7);
  }
  applyCast();
  refreshPlay();
}

const RATE_CH = { 3: '上', 2: '中', 1: '下' };
function finishPlay(p, info) {
  store.d.done[p.id] = (store.d.done[p.id] || 0) + 1;
  store.d.total += 8; store.flush();
  const helped = (info && info.helped) || PB.helped || 0;
  const rate = helped === 0 ? 3 : helped <= 2 ? 2 : 1;
  show.seal = { t: 0, text: p.seal, rate: RATE_CH[rate] };
  show.rate = { ch: RATE_CH[rate], helped, at: 0 };
  Audio_.applause();
  if (show.aud > .62) setTimeout(() => Audio_.applause(), 420);      // 台下人气高 → 满堂彩
  if (p.learn) {                                  // 拜师：这一场学会几个
    const got = show.learnIdx || 0;
    store.d.learned = Math.max(store.d.learned || 0, got);
    store.d.mastered = got >= 5;
    store.flush();
    toast(got >= 5 ? `拜师 · 学会 ${got}/6　出师了` : `拜师 · 学会 ${got}/6`,
      got >= 5 ? '六下里你跟着做出了大半——师父那根签子，现在在你手上了。'
               : '再看两遍：捏、握、搭腔、挥手、踢腿、翻身——一个一个来。', 12);
  } else {
    store.d.rate = store.d.rate || {};
    store.d.rate[p.id] = Math.max(store.d.rate[p.id] || 0, rate);
    store.flush();
    /* 三出折子戏都拿到"上" → 开箱唱全本大戏 */
    const tops = PLAYS.filter(q => (store.d.rate[q.id] || 0) >= 3).length;
    if (tops >= PLAYS.length && !store.d.grand) {
      store.d.grand = 1; store.flush();
      Audio_.nacao();
      toast('开箱 · 《灯影还魂》',
        '三出戏都唱到了「上」——班子把压箱底的全本给你了：十二幕、生旦净丑轮着上台。右上「戏折子」里多了一出。', 18);
    } else {
      const n = Object.keys(store.d.done).length;
      toast(`《${p.name}》 演完 · 评「${RATE_CH[rate]}」`,
        helped === 0 ? '从头到尾都是你自己出的手——干净。'
          : `用了 ${helped} 次帮衬，戏是完整的。再演一遍可以冲「上」。`,
        12);
    }
    const need = PLAYS.length - tops;
    if (tops > 0 && tops < PLAYS.length && !store.d.grand) subtitle(`再拿 ${need} 个「上」· 开箱唱大戏`, 5);
  }
  if (p.novice) {                                  /* 新手教学：上完课自动回引导模式，顺手指一出下一出 */
    setUIMode('guide', true);
    toast('新手 · 出师', '四手都学会了——下一出试试《刀会》：这几手在戏里全用得上。右上「戏折子」点它；想再练，回「新手」重上一遍。', 15);
  }
  refreshPlay();
  renderSteps();
  /* 谢幕之后不马上重开：先给观众一个叫好的机会（拍手 = 打赏，台上加段绝活回礼） */
  active.forEach(q => { q.act('plume'); q.bow = 1; });
  tipHits = 0;
  show.state = 'curtain'; show.curtainT = 0;
  subtitle('谢幕 · 拍手叫好（Y 再演一遍）', 4);
}

/* 再演一遍：谢幕后或演到一半都能重来（评「上」的第二次机会） */
function restartPlay() {
  if (!curPlay) { toast('还没点戏', '右上「戏折子」先点一出，再按 Y 重演。', 6); return; }
  PB.start(curPlay.id);
  show.aud = .5; show.helpedAt = 0; show.helped = 0;
  show.learnIdx = 0; show.learnMiss = 0; show.rate = null;
  show.seal = null; show.playTime = 0; show.state = 'play';
  active = active.filter(q => q.appear > .3);
  if (!active.length) { active = [puppets[0]]; puppets[0].appear = 0; }
  applyCast();
  setRelax(0); show.helped = 0; show.mark = null;                 // 重演一遍 → 手感也重来
  renderSteps();
  Audio_.gong();
  toast('再演一遍', `《${curPlay.name}》从头来过——这一次试试全靠自己出手。`, 7);
}

/* 折子戏的"派角"：戏一开演，台上的影人换成这出戏的行当与行头
   （不然自由演默认是生，刀会里该上台的净就永远是生） */
function applyCast() {
  if (!curPlay || !active.length) return;
  active.forEach((p, i) => {
    p.setRole(curPlay.cast[Math.min(i, curPlay.cast.length - 1)]);
    p.setProp(curPlay.prop);
  });
}

/* 新手模式：把《开箱》摆上台，从"张掌起灯"教起——先教会，再放人上台。
   Tab 不进这里；上完自动回引导模式。 */
function enterNovice() {
  const p = findPlay('ruxue'); if (!p) return;
  if (!started) camOn();
  curPlay = p; store.d.sel = p.id; store.flush();
  PB.stop();
  show.cue = null; show.seal = null; show.rate = null; show.bigNote = null;
  setRelax(0); show.helped = 0; show.mark = null; show.playTime = 0;
  sceneKey = p.scene || 'field'; setMood(p.mood || 'lamp');
  applyCast();
  setUIMode('novice', true);
  /* 从"张掌起灯"这一下开始：灯暗着、台上没人，等这一掌 */
  warmHits = 0;
  active = [];
  show.state = 'wake'; show.hint = '';
  lamp.v = .06; lamp.target = .07;
  toast('新手 · 先学四手', '张掌起灯，然后一手一手跟着做：捏合、攥拳、翻手、横扫——每一手做满两次才算学会，' +
    '学会了亮一条皮影志。「帮一把」只等 2 秒，等不住就算一次帮衬（照实记）。', 16);
  refreshPlay();
  renderSteps();
}

function refreshZhi() {
  $('#btnZhi').innerHTML = `皮影志 <b>${show.unlocked.size}/${ZHI.length}</b>`;
}
refreshZhi();

function unlock(id) {
  if (show.unlocked.has(id)) return;
  show.unlocked.add(id);
  const z = ZHI.find(v => v.id === id);
  /* 自由模式不弹知识卡片（提示全收起），但该记的照记，回头翻皮影志还在 */
  if (uiMode === 'guide') { show.cards.push({ z, t: 0 }); Audio_.chime(); }
  store.d.zhi = [...show.unlocked];
  store.flush();
  refreshZhi();
  if (show.unlocked.size === ZHI.length) toast('皮影志 · 已集全', '你已经把这门手艺的骨架摸过一遍了。');
}

function toast(title, text, dur = 9) { show.toast = { title, text, t: 0, dur }; }
function subtitle(text, dur = 4.2) { show.subtitles = text; show.subT = dur; }

function director(dt, t) {
  show.elapsed += dt;
  if (show.toast) { show.toast.t += dt; if (show.toast.t > show.toast.dur) show.toast = null; }
  if (show.subtitles) { show.subT -= dt; if (show.subT <= 0) show.subtitles = null; }
  if (show.seal) { show.seal.t += dt; }
  lamp.flick += dt;
  moodStep(dt);
  /* 手滑出画面：摄像头模式下宁可让戏等着，也不收灯、不判错（台本冻住，计时不走） */
  PB.paused = mode === 'camera' && show.state === 'play' && !!curPlay && !HT.slots.some(s => s.present);
  PB.tick(wallDt);        // 台本按真实时间推进：慢机器上 dt 会被夹到 .05，会让"自动过幕"跟着变慢
  beat.tick(wallDt);
  /* ---------- 闯关：把这一帧的走影 / 提臂 / 同台人数喂给关卡引擎，再推进计时与帮衬 ---------- */
  if (LV.running) {
    let panning = false;
    for (const s2 of HT.slots) if (s2.present && Math.abs(s2.vx || 0) > .14) { panning = true; break; }
    if (panning) LV.pan(wallDt, twoSign);        // 手横着走 = 走影（"走影三丈"认的就是这个）
    if (show.armMoved) { LV.arm(); show.armMoved = false; }
    LV.cast(active.length);
    LV.tick(wallDt);
  }
  if (show.beatHit) show.beatHit.t += dt;

  if (freeze) {
    if (show.state !== 'curtain') show.state = 'play';   // 冻结只用于截图/验收，别把"谢幕打赏"冲掉
    show.hint = '';
    lamp.v = lerp(lamp.v, 1, 1 - Math.exp(-dt / .25));
    if (!active.length) active = [puppets[0]];
    return;
  }

  const present = HT.slots.some(s => s.present);

  /* 不在演出中（闹台之前 / 自检页 / 台下练手）也要认得出横扫/下砸/上挑——
     必须放在各状态分支**之前**：那些分支末尾都带 return，写在后面等于永远不跑
     （这正是"自检页里上挑/下砸/横扫永远亮不起来"的原因） */
  if (mode !== 'demo' && show.state !== 'play') checkMoves();

  /* ---------- 打闹台：开戏前先招观众 ---------- */
  if (show.state === 'warmup') {
    lamp.target = .10 + .20 * warmupProgress();
    if (show.hintMode !== mode) { show.hintMode = mode; show.hint = ''; }   // 换入场方式后提示要跟着换
    if (!show.hint) show.hint = mode === 'manual' ? '连按 空格 / Q · 打闹台' : '握拳六下 · 打闹台';
    if (mode === 'demo') {                       // 演示模式自己把闹台打完
      show.warmT = (show.warmT || 0) + dt;
      if (show.warmT > .7) { show.warmT = 0; warmupHit('demo'); }
    }
    for (const s of HT.slots) if (s.present) {
      if (s.mode === 'fist' && !s._warmed) { s._warmed = true; warmupHit('fist'); }
      if (s.mode !== 'fist') s._warmed = false;
    }
    lamp.v = lerp(lamp.v, lamp.target, 1 - Math.exp(-dt / .5));
    return;
  }

  /* ---------- 谢幕之后：叫好打赏 ---------- */
  if (show.state === 'curtain') {
    show.curtainT = (show.curtainT || 0) + dt;
    lamp.target = .94;
    if (mode === 'demo' && show.curtainT > 2.2) tipHit();      // 演示模式自己叫好
    if (show.curtainT > 9) {                                   // 等不到叫好也得收灯
      show.state = 'wake'; show.hint = mode === 'manual' ? '按住空格 · 掌灯' : '把手掌伸向灯';
      active = []; show.cue = null; show.seal = null; tipHits = 0;
    }
    lamp.v = lerp(lamp.v, lamp.target, 1 - Math.exp(-dt / .4));
    return;
  }

  if (show.state === 'wake') {
    lamp.target = present ? .18 : .07;
    if (show.hintMode !== mode) { show.hintMode = mode; show.hint = ''; }
    if (!show.hint) show.hint = mode === 'manual' ? '按住空格 · 掌灯' : '把手掌伸向灯';
    if (HT.slots.some(s => s.mode === 'open' && s.present)) {
      show.state = 'rise'; show.t0 = t; show.hint = '';
      Audio_.gong();
      active = [puppets[0]];
      puppets[0].appear = 0;
      puppets[0].setRole(order[show.roleIdx]);
      subtitle(ROLES[order[show.roleIdx]].line, 5);
      setTimeout(() => unlock('z1'), 1400);
    }
  } else if (show.state === 'rise') {
    const k = (t - show.t0) / 1.35;
    lamp.target = clamp(k, 0, 1);
    if (k >= 1) {
      show.state = 'play'; show.playTime = 0;
      applyCast();
      if (curPlay && !PB.running) PB.start(curPlay.id);
    }
  } else if (show.state === 'play') {
    lamp.target = 1;
    show.playTime += dt;
    if (show.playTime > 26) unlock('z4');
    // 挥手（横向快挥）→ 换势：不看瞬时速度，看"0.45 秒内单向位移"——与帧率无关，
    // 慢机器上也不会漏判（速度判定在掉帧时会碎掉）
    /* ---------- 身上功夫：全部按"窗口内位移"判，不看瞬时速度 ----------
       原来挥手/踢腿/上挑都是拿"速度"判（vx/vy），掉帧时速度被平滑抹平 → 明明做了却没反应。
       现在统一看"最近 0.6 秒里手走了多远"，与帧率无关；阈值由手感档位给。 */
    checkMoves();

    // 演示模式的保险丝：某一幕实在等不到（掉帧严重/认不出来），最多挂 9 秒就自己过，
    // 保证"看演示"永远是一出走得完的戏；摄像头/键鼠模式没有这条，必须观众出手。
    if (mode === 'demo' && PB.running && PB.elapsed > (PB.cue.demoMax || 9)) PB.next();
    /* ---------- 教戏（拜师）：限时跟做，过了时限师父再示范一遍 ---------- */
    if (curPlay && curPlay.learn && PB.running && PB.cue && PB.cue.teach) {
      if (PB.elapsed > (curPlay.win || 8)) {
        show.learnMiss = (show.learnMiss || 0) + 1;
        Audio_.oops(); beat.shake(.30);
        toast('这一下没过', '看清楚再出手——师父再示范一遍。', 4.5);
        PB.again();
      }
    }
    if (!present) {
      if (mode === 'camera' && curPlay) {
        /* 手一滑出画面上戏就断，是最劝退的一处：改成"戏等着你" */
        show.hint = '把手伸回画面 · 戏等着你';
        lamp.target = .42;
      } else if (LV.running) {
        /* 闯关同理：手出画不算输，这一关等着你（想弃关按"收灯"） */
        show.hint = '把手伸回画面 · 这一关等着你';
        lamp.target = .5;
      } else { show.state = 'rest'; show.restT = 0; }
    } else if (show.hint && show.hint.indexOf('把手伸回画面') === 0) show.hint = '';
  } else if (show.state === 'rest') {
    show.restT += dt;
    lamp.target = Math.max(.07, 1 - show.restT / 1.6);
    active.forEach(p => p.appear = Math.max(0, p.appear - dt * 1.2));
    if (show.restT > 2.6) {
      if (show.playTime > 2) { store.d.total += show.playTime; store.d.plays++; store.flush(); }
      show.state = 'wake'; show.hint = mode === 'manual' ? '按住空格 · 掌灯' : '把手掌伸向灯';
      active = [];
      if (curPlay) PB.stop();
      show.cue = null; show.seal = null;
    }
  }
  /* 不在演出中（闹台之前 / 自检页 / 台下练手）的几手识别，见上面分支前的那一句 */
  lamp.v = lerp(lamp.v, lamp.target, 1 - Math.exp(-dt / (show.state === 'rise' ? .22 : .45)));
}

/* ============================== 输入 → 影人 ============================== */
const HT = new HandTracker({ numHands: MAXP, snapOnReacquire: true, onEvent: onHandEvent });
window.HT = HT;

function roleFor(index) {
  const used = new Set(active.filter((p, i) => p !== puppets[index]).map(p => p.roleKey));
  for (const k of order) if (!used.has(k)) return k;
  return order[index % order.length];
}

/* 翻手 = 影人翻个面：换行当（自由演）/ 翻身（有戏时）。手势与键盘都走这里 */
function doTurn(scripted) {
  Audio_.ban(true);
  active.forEach(p => { p.act('flip'); p.spin = 1; });
  if (!active.length) { active = [puppets[0]]; puppets[0].appear = 1; }
  if (!curPlay) {
    show.roleIdx = (show.roleIdx + 1) % order.length;
    const k = order[show.roleIdx];
    puppets[0].setRole(k);
    subtitle(`${ROLES[k].name} · 翻个面就换个人`, 4.5);
    toast(`换面 · ${ROLES[k].name}`, `${ROLES[k].note}　　手翻过来，影人就翻个面——一个人变另一个人，靠的就是这一下。`, 9);
  } else if (!scripted) subtitle('翻手 · 换面', 1.8);
  unlock('z2');
}

function onHandEvent(name, data) {
  eventLog.push({ name, t: show.elapsed }); if (eventLog.length > 200) eventLog.shift();
  mark(name);
  if (show.state === 'curtain') {          // 谢幕之后：拍手叫好 = 打赏
    if (name === 'fist' || name === 'pinch' || name === 'meet') tipHit();
    return;
  }
  if (show.state !== 'play') return;
  // 戏在演：手势先交给台本（台词/锣鼓由台本给，避免两套反馈打架）
  const scripted = PB.action(name);
  if (scripted === 'help') {                    // 帮一把：幕等太久，随便一个手势也算
    show.helpFlash = 1;
    if (active.length) active.forEach(p => { p.bow = 1; setTimeout(() => p.bow = 0, 700); });
  }
  // 点板开着：这一手合不合板（合上算"漂亮"，偏了影子会抖）
  if (beat.running && (name === 'pinch' || name === 'fist' || name === 'meet')) {
    const ok = beat.hit(name);
    if (ok) subtitle('漂亮！　合上板了', 1.8);
    else toast('偏了 · 跟上板', '出手要压在板上：七紧八慢九消停——急了、慢了，影子都会散。', 5);
  }
  if (scripted && curPlay && curPlay.learn) show.learnDone = (show.learnDone || 0) + 1;   // 跟对了，记一分
  if (name === 'wave' && active.length) active.forEach(p => p.flickPlume(1.2));   // 挥手顺手甩翎子
  if (name === 'pinch') {
    Audio_.clap();
    active.forEach(p => { p.bow = 1; setTimeout(() => p.bow = 0, 900); });
    unlock('z3');
    if (!scripted) subtitle('挑签 · 亮相', 1.8);
  }
  if (name === 'turn') doTurn(scripted);
  if (name === 'fist') {                // 攥拳 = 攥住那根签子：定住亮相 / 敲锣鼓
    Audio_.drum();
    active.forEach(p => { p.bow = 1; setTimeout(() => p.bow = 0, 700); });
    if (!scripted) subtitle('攥签 · 定住', 1.6);
    unlock('z2');
  }
  if (name === 'meet') {
    Audio_.gong();
    const names = active.slice(0, 2).map(p => ROLES[p.roleKey].name).join(' 与 ');
    if (!scripted) subtitle(`${names || '双影'} 对戏`, 3.6);
    unlock('z5');
  }
}

function drivePuppets(dt, t) {
  if (freeze) return;
  // 上场 / 退场：每只手带一个影人（"两签共操"时只有 slot 0 上人，slot 1 是手签）
  for (let i = 0; i < HT.slots.length; i++) {
    const s = HT.slots[i], p = puppets[i];
    if (!p) continue;
    if (twoSign && i > 0) continue;
    const on = active.includes(p);
    if (s.present && show.state === 'play' && !on) {
      // 折子戏：上场的影人按台本的行当与行头来（生旦净丑按剧本，不按顺序）
      const castK = curPlay ? curPlay.cast[Math.min(active.length, curPlay.cast.length - 1)] : (i === 0 ? order[show.roleIdx] : roleFor(i));
      p.setRole(castK);
      if (curPlay) p.setProp(curPlay.prop);
      p.setSkin(skinKey);
      if (headWanted) p.setHead(headWanted);
      p.appear = 0;
      p.x = clamp(s.x, .06, .94);
      active.push(p);
      PB.action('enter');
    } else if (!s.present && on && show.state === 'play') {
      p.appear = Math.max(0, p.appear - dt * 1.6);
      if (p.appear <= .02) active = active.filter(q => q !== p);
    }
  }
  // 驱动
  for (let i = 0; i < HT.slots.length; i++) {
    const s = HT.slots[i], p = puppets[i];
    if (!p || !active.includes(p)) continue;
    if (twoSign && i > 0) continue;                       // 手签不走这个循环
    const depth = clamp(1 - s.y * 1.35, 0, 1);
    p.update(dt, {
      x: clamp(s.x, .06, .94), y: clamp(.80 - depth * .10, .66, .84),
      vx: s.vx, vy: s.vy, depth, crouch: s.vy > .55,
      bow: show.state === 'curtain' ? 1 : (s.mode === 'pinch')
    });
    if (s.present && s.vy < -.75 && p.jump < .05) p.jumpStart();   // 上挑（位移判定在导演里统一做）
  }
  /* ---------- 手签：第二只手单独提这只影人的右臂 ---------- */
  if (twoSign) {
    const lead = active[0];
    const hs = HT.slots[1];
    if (lead) {
      if (hs && hs.present) {
        const ang = clamp(1.45 - (hs.y - .30) * 3.4, -.95, 1.50);   // 手抬高 → 臂抬高
        lead.setArm(1, ang);
        const dAng = Math.abs(ang - (lead._armPrev == null ? ang : lead._armPrev));
        lead._armPrev = ang;
        if (dAng > .06) show.armMoved = true;        // 手签在提臂（"三根签"这一关认这个）
        if (dAng > .10 && lead.role.plumes) lead.flickPlume(Math.min(1.4, dAng * 2.2));   // 甩袖带得翎子也动
      } else {
        lead.setArm(1, null);
        lead._armPrev = null;
      }
    }
  } else if (active[0]) {
    active[0].setArm(1, null);
  }
}

/* ============================== 渲染 ============================== */
function render(t) {
  const clipped = drawStage(t);          // 返回 true = 幕布已 save+clip
  if (clipped) {
    if (lamp.v > .02) {
      drawScenery(ctx, screen, t, sceneKey, moodKey, amb);   // 景片 + 氛围（仍在幕布裁剪区里）
      const list = active.slice().sort((a, b) => b.depth - a.depth);
      const wob = beat.wobble;
      if (wob > .015) {                                      // 板没跟上：影子会抖、会散
        ctx.save();
        ctx.translate(Math.sin(t * 47) * wob * 3.4, Math.cos(t * 39) * wob * 2.2);
        for (const p of list) p.draw(ctx, screen);
        ctx.globalAlpha = wob * .38;                         // 一层错位的"虚影"，看着就像散了
        for (const p of list) {
          ctx.save(); ctx.translate(Math.sin(t * 63) * wob * 7, Math.cos(t * 51) * wob * 3);
          p.draw(ctx, screen); ctx.restore();
        }
        ctx.restore();
      } else {
        for (const p of list) p.draw(ctx, screen);
      }
    }
    /* ---- 手上的反馈：让玩家看见"系统看到我了"（只在摄像头模式） ---- */
    if (lamp.v > .02) drawHandFeedback(t);
    endClip();                                                // 与 drawStage 一一配对，任何亮度下都不漏
    if (lamp.v > .02) {
      ctx.save();
      ctx.strokeStyle = 'rgba(40,22,8,.75)';
      ctx.lineWidth = 14;
      ctx.strokeRect(screen.x + 7, screen.y + 7, screen.w - 14, screen.h - 14);
      ctx.restore();
      drawTheatre(ctx, screen, t, lamp.v);                    // 檐幕 · 上下场门 · 台面
    }
  }
  // 演完落幕：一枚朱红戏印
  if (show.seal) {
    const s = Math.min(1, show.seal.t / .8);
    const size = Math.min(screen.w, screen.h) * .20;
    stamp(screen.x + screen.w * .74, screen.y + screen.h * .70, size * (0.6 + 0.4 * s), show.seal.text,
      clamp(show.seal.t * 1.8, 0, 1) * .88);
    /* 印旁边落一个"评"：上 / 中 / 下（帮衬次数决定） */
    if (show.seal.rate) {
      ctx.save();
      ctx.globalAlpha = clamp(show.seal.t * 1.6 - .6, 0, 1) * .92;
      const rx = screen.x + screen.w * .74, ry = screen.y + screen.h * .70 + size * .96;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(184,53,42,.92)'; ctx.lineWidth = Math.max(1.6, size * .028);
      const bw = size * .52, bh = size * .40;
      ctx.strokeRect(rx - bw / 2, ry - bh / 2, bw, bh);
      ctx.fillStyle = 'rgba(184,53,42,.95)';
      ctx.font = `${size * .26}px "STKaiti","KaiTi",serif`;
      ctx.fillText(show.seal.rate, rx, ry);
      ctx.restore();
    }
  }
  drawHUD(t);
  if (LV.running) drawLevelBanner(t);            // 闯关：第几关 · 目标 · 进度 · 计时
  if (show.bigNote) drawBigNote(t);              // 新手教学：每手第一次认到的大字说明
  if (window.__dbgRect) {
    ctx.save(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff0000'; ctx.fillRect(100, 300, 50, 50);
    ctx.fillStyle = '#00ff00'; ctx.fillRect(screen.x - 45, 200, 30, 50);
    ctx.fillStyle = '#00aaff'; ctx.fillRect(screen.x + 40, 200, 30, 50);
    ctx.restore();
  }
  if (show.view) drawZhiView();
}

/* ---------- 师父的手：把"该做什么动作"画出来（限时不出手就自动示范） ---------- */
function drawMiniHand(ctx, cx, cy, R, kind, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(255,240,204,.95)';
  ctx.lineWidth = Math.max(1.6, R * .15);
  ctx.lineCap = 'round';
  ctx.setLineDash([R * .32, R * .24]);
  ctx.beginPath(); ctx.ellipse(cx, cy + R * .55, R * .60, R * .68, 0, 0, 6.2832); ctx.stroke();   // 掌心
  const openLen = kind === 'fist' ? .50 : 1.0;                                                    // 四指
  for (let i = 0; i < 4; i++) {
    const fx = cx - R * .40 + i * R * .28;
    const len = R * (0.92 + .20 * (1 - Math.abs(i - 1.5) / 1.5)) * openLen;
    ctx.beginPath();
    ctx.moveTo(fx, cy + R * .30);
    ctx.quadraticCurveTo(fx + (i - 1.5) * R * .05, cy + R * .30 - len * .6, fx + (i - 1.5) * R * .09, cy + R * .30 - len);
    ctx.stroke();
  }
  const thumbOut = kind === 'fist' ? .45 : 1.0;                                                   // 拇指
  ctx.beginPath();
  ctx.moveTo(cx - R * .50, cy + R * .70);
  ctx.quadraticCurveTo(cx - R * (1.05 * thumbOut), cy + R * .40, cx - R * (.92 * thumbOut), cy + R * (.02 + (1 - thumbOut) * .62));
  ctx.stroke();
  if (kind === 'pinch') {                                   // 捏合：拇指食指对上，点两个小圈
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(cx + R * .28, cy - R * .22, R * .17, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx - R * .50, cy - R * .16, R * .14, 0, 6.2832); ctx.stroke();
  }
  ctx.restore();
}
function ghostKind(need) {
  switch (need) {
    case 'pinch': return 'pinch';
    case 'fist': return 'fist';
    case 'meet': case 'flip': case 'raise': case 'wave': case 'kick': return 'open';
    default: return null;
  }
}
function drawGhost(t, need, label) {
  const kind = ghostKind(need); if (!kind) return;
  const two = (need === 'meet' || need === 'flip' || need === 'raise');
  const a = .20 + .16 * (Math.sin(t * 2.6) * .5 + .5);
  const R = Math.min(VW, VH) * .048;
  const cx = screen.x + screen.w / 2, cy = screen.y + screen.h * .60;
  ctx.save();
  if (two) {
    drawMiniHand(ctx, cx - R * 1.5, cy, R, kind, a);
    drawMiniHand(ctx, cx + R * 1.5, cy, R, kind, a);
  } else {
    drawMiniHand(ctx, cx, cy, R, kind, a);
  }
  /* 动作方向提示 */
  ctx.globalAlpha = a + .12;
  ctx.strokeStyle = 'rgba(255,238,200,.95)';
  ctx.lineWidth = Math.max(2, R * .18);
  ctx.setLineDash([]);
  ctx.lineCap = 'round';
  const ax = cx + R * 2.9, ay = cy;
  const arrow = (x0, y0, x1, y1) => {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const ang = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - Math.cos(ang - .5) * R * .5, y1 - Math.sin(ang - .5) * R * .5);
    ctx.lineTo(x1 - Math.cos(ang + .5) * R * .5, y1 - Math.sin(ang + .5) * R * .5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,238,200,.95)';
    ctx.fill();
  };
  if (need === 'wave') arrow(ax - R * .8, ay, ax + R * .8, ay);
  else if (need === 'kick') arrow(ax, ay - R * .8, ax, ay + R * .9);
  else if (need === 'flip' || need === 'raise') arrow(ax, ay + R * .8, ax, ay - R * .95);
  else if (need === 'meet') arrow(cx - R * .85, cy, cx - R * .15, cy);
  if (label) {
    ctx.globalAlpha = a + .16;
    ctx.font = `${Math.round(R * .62)}px "STKaiti","KaiTi",serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,240,204,.9)';
    ctx.fillText(label, cx, cy + R * 1.9);
  }
  ctx.restore();
}

/* 新手教学：每一手第一次认到，幕布上给一行大字说明（这手势在皮影里叫什么、影人做什么） */
function drawBigNote(t) {
  const n = show.bigNote; if (!n) return;
  n.t += 1 / 60;
  const life = 3.4;
  if (n.t > life) { show.bigNote = null; return; }
  const k = n.t / life, a = k < .08 ? k / .08 : (k > .78 ? Math.max(0, (1 - k) / .22) : 1);
  const parts = String(n.text).split('：');
  const cx = screen.x + screen.w / 2, cy = screen.y + screen.h * .26;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = a * .96;
  ctx.shadowColor = 'rgba(255,214,150,.7)'; ctx.shadowBlur = 18 * UI;
  ctx.font = `${Math.round((VW < 760 ? 20 : 26) * UI)}px "STKaiti","KaiTi",serif`;
  ctx.fillStyle = 'rgba(255,240,206,.97)';
  ctx.fillText(parts[0] + (parts.length > 1 ? '：' : ''), cx, cy);
  if (parts.length > 1) {
    ctx.font = `${Math.round((VW < 760 ? 15 : 19) * UI)}px "STKaiti","KaiTi",serif`;
    ctx.fillStyle = 'rgba(255,232,190,.90)';
    ctx.fillText(parts.slice(1).join('：'), cx, cy + 34 * UI);
  }
  ctx.restore();
}

/* 手上的反馈：影人头顶一圈"蓄力环"——越接近触发，环越满、越亮；触发的一瞬炸开一圈，
   旁边写着系统这会儿把你认成什么手势。摄像头前面的人最需要的就是这个：
   原来什么都看不见，做十下手势没反应，只能怀疑"是不是坏了"。 */
function drawHandFeedback(t) {
  if (mode !== 'camera' || show.state !== 'play') return;
  const F = k => `${k * UI}px system-ui,"Microsoft YaHei"`;
  for (let i = 0; i < HT.slots.length; i++) {
    const s = HT.slots[i]; if (!s.present) continue;
    const p = puppets[i]; if (!p || !active.includes(p) || p.appear < .25) continue;
    const px = screen.x + clamp(p.x, .04, .96) * screen.w;
    const py = screen.y + (p.y - .30) * screen.h;
    const ch = clamp(s.charge || 0, 0, 1);
    ctx.save();
    /* 底圈：淡淡的整圈 = 看到你了 */
    ctx.globalAlpha = .14 + .10 * (Math.sin(t * 3) * .5 + .5);
    ctx.strokeStyle = 'rgba(255,232,180,.95)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(px, py, 40 * UI, 0, 6.2832); ctx.stroke();
    /* 蓄力环：越满越亮 */
    if (ch > .02) {
      ctx.globalAlpha = .40 + .55 * ch;
      ctx.strokeStyle = ch >= 1 ? 'rgba(255,214,120,.98)' : 'rgba(255,242,204,.92)';
      ctx.lineWidth = 2.5 + 3.5 * ch;
      ctx.beginPath();
      ctx.arc(px, py, (40 - 8 * ch) * UI, -Math.PI / 2, -Math.PI / 2 + 6.2832 * ch);
      ctx.stroke();
    }
    /* 触发的闪光 */
    if (s.flash > 0) {
      ctx.globalAlpha = s.flash * .5;
      ctx.strokeStyle = 'rgba(255,228,150,1)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(px, py, (44 + 36 * (1 - s.flash)) * UI, 0, 6.2832); ctx.stroke();
    }
    /* 这会儿认成了什么 */
    const lbl = s.label || '';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = F(UI < .9 ? 12 : 13.5);
    const lw = ctx.measureText(lbl).width;
    ctx.globalAlpha = .5 + .4 * ch;
    ctx.fillStyle = 'rgba(28,14,4,.50)';
    ctx.fillRect(px - lw / 2 - 8, py - 62 * UI - 9, lw + 16, 19);
    ctx.fillStyle = ch >= 1 ? 'rgba(255,238,184,.99)' : 'rgba(255,240,208,.90)';
    ctx.fillText(lbl, px, py - 62 * UI);
    ctx.restore();
  }
}

function drawHUD(t) {
  const pad = 20 * UI;
  const narrow = VW < 760;
  const F = k => `${k * UI}px system-ui,"Microsoft YaHei"`;
  const FS = k => `${k * UI}px "STKaiti","KaiTi",serif`;

  ctx.save();
  ctx.fillStyle = `rgba(232,192,122,${.55 + .35 * lamp.v})`;
  ctx.font = `600 ${26 * UI}px "STKaiti","KaiTi",serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('掌灯', pad, pad - 4 * UI);
  ctx.fillStyle = 'rgba(232,192,122,.34)';
  ctx.font = F(12);
  ctx.fillText('手 势 皮 影 戏', pad + 66 * UI, pad + 8 * UI);
  ctx.fillStyle = 'rgba(255,232,190,.30)';
  ctx.font = F(11.5);
  ctx.fillText(`演出 ${Math.floor(show.playTime)}s · 累计 ${Math.floor(store.d.total)}s · 第 ${store.d.plays + 1} 场`, pad, pad + 30 * UI);
  ctx.restore();

  if (active.length) {
    const r = ROLES[active[0].roleKey];
    ctx.save();
    const lh = (narrow ? 15 : 18) * UI;              // 窄屏加大行距，避免行当/操作提示叠在一起
    ctx.font = F(narrow ? 12.5 : 15);
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    const tips = mode === 'manual'
      ? ['空格 起灯 · ←→ 走影 · ↑↓ 远近', 'E 挑签 · Q 换角 · R 挥手甩翎子 · T 加人 · G 对戏 · F 两签 · B 点板',
         'H 换头茬 · P 换皮料 · N 换流派 · K 踢腿 · J 翻身 · L 劈叉 · Esc 收灯']
      : ['张掌 起灯 · 移手 走影 · 捏合 挑签 · 握拳 换角', '挥手 甩翎子/换势 · 手砸下去 踢腿 · 双手上抬 翻身 · 双手靠近 对戏'];
    const blocks = narrow ? 2 : 1;
    const lines = narrow ? tips.slice(0, 2) : tips;
    const baseY = VH - pad - lines.length * lh - 6 * UI;
    ctx.fillStyle = 'rgba(255,232,190,.52)';
    ctx.fillText(`行当 · ${r.name}（${r.sub}）${active.length > 1 ? ` · 同台 ${active.length} 人` : ''}`, pad, baseY);
    ctx.fillStyle = 'rgba(255,232,190,.78)';
    ctx.font = F(narrow ? 11.5 : 12.5);
    lines.forEach((s, i) => ctx.fillText(s, pad, VH - pad - (lines.length - 1 - i) * lh));
    ctx.restore();
  }

  if ((show.state === 'wake' || show.state === 'warmup' || show.state === 'curtain') && show.hint) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = FS(20);
    const a = .35 + .30 * (Math.sin(t * 1.7) * .5 + .5);
    ctx.fillStyle = `rgba(255,226,170,${a})`;
    ctx.fillText(show.hint, VW / 2, VH * .82);
    ctx.restore();
  }

  /* ---- 打闹台：招观众的进度 ---- */
  if (show.state === 'warmup') {
    const cx2 = VW / 2, y = VH * .87, w = Math.min(VW * .34, 320);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = FS(15);
    ctx.fillStyle = 'rgba(255,226,170,.62)';
    ctx.fillText(`打闹台 · 观众 ${Math.min(warmHits, 6)}/6`, cx2, y - 16 * UI);
    ctx.fillStyle = 'rgba(232,192,122,.20)';
    ctx.fillRect(cx2 - w / 2, y, w, 4 * UI);
    ctx.fillStyle = 'rgba(232,192,122,.85)';
    ctx.fillRect(cx2 - w / 2, y, w * warmupProgress(), 4 * UI);
    ctx.restore();
  }

  /* ---- 点板：板眼格 + 功底 ---- */
  if (beat.running) {
    const n = beat.beats, cur = beat.index;
    const cx2 = VW / 2, y = VH - 26 * UI;
    const w = Math.min(VW * .40, 380), step = w / n;
    ctx.save();
    ctx.fillStyle = 'rgba(16,8,2,.55)';
    ctx.fillRect(cx2 - w / 2 - 12, y - 14 * UI, w + 24, 26 * UI);
    for (let i = 0; i < n; i++) {
      const on = i < cur, now2 = i === cur;
      ctx.fillStyle = now2 ? 'rgba(255,240,200,.96)' : on ? 'rgba(232,192,122,.55)' : 'rgba(232,192,122,.18)';
      ctx.fillRect(cx2 - w / 2 + i * step, y - (now2 ? 7 : 4) * UI, Math.max(1.2, step * .55), (now2 ? 14 : 8) * UI);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.font = FS(13);
    ctx.fillStyle = 'rgba(255,226,170,.70)';
    ctx.fillText(`${beat.pattern.name} · 第 ${beat.phrase + 1} 句 · 功底 ${beat.hits} 中 / 失手 ${beat.misses}`, cx2, y - 18 * UI);
    if (show.beatHit && show.beatHit.t < .5) {
      ctx.font = FS(30); ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255,246,214,${Math.max(0, 1 - show.beatHit.t / .5)})`;
      ctx.fillText('对 板', cx2, y - 54 * UI);
    }
    ctx.restore();
  }

  /* ---- 头茬 / 皮料 / 流派 现状 ---- */
  {
    const cur = active[0];
    const hk = headWanted || (cur ? cur.headInfo.key : null);
    const txt = `头茬 ${hk ? HEADS[hk].name : '随行当'} · 皮料 ${SKINS[skinKey].name} · 流派 ${SCHOOLS[schoolKey].name} · ${twoSign ? '两签共操' : '两影对戏'}`;
    ctx.save();
    ctx.font = F(12);
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,232,190,.42)';
    ctx.fillText(txt, VW - 20 * UI, 20 * UI);
    ctx.restore();
  }

  if (show.subtitles) {
    ctx.save();
    const x = screen.x + screen.w / 2, y = screen.y + screen.h - 36 * UI;
    ctx.font = FS(narrow ? 17 : 19);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(show.subtitles).width;
    ctx.fillStyle = 'rgba(16,8,2,.72)';
    ctx.fillRect(x - w / 2 - 20, y - 18 * UI, w + 40, 36 * UI);
    ctx.strokeStyle = 'rgba(232,192,122,.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - w / 2 - 20.5, y - 18 * UI + .5, w + 41, 35 * UI);
    ctx.fillStyle = 'rgba(255,246,222,.98)';
    ctx.fillText(show.subtitles, x, y);
    ctx.restore();
  }

  /* ---- 折子戏：台本进度 + 该你出手了 ---- */
  if (curPlay && show.cue) {
    const cx2 = screen.x + screen.w / 2, y0 = screen.y + 20 * UI;
    const learn = !!curPlay.learn;
    const wait = PB.elapsed || 0;
    const needList = (PB.cue && PB.cue.need) ? (Array.isArray(PB.cue.need) ? PB.cue.need : [PB.cue.need]) : [];
    const need0 = needList[0];
    const novice = uiMode === 'novice';
    const showGhost = need0 && (novice ? true : (learn ? wait > .7 : wait > 3.4));
    if (showGhost && show.state === 'play' && (uiMode === 'guide' || novice)) {
      /* 新手：虚线手掌示范常驻，不用等——先让手跟着走 */
      drawGhost(t, need0, novice ? '跟着做'
        : (learn ? `跟着做 · 还剩 ${Math.max(1, Math.ceil((curPlay.win || 8) - wait))} 秒` : '这样'));
    }
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = FS(narrow ? 14 : 17);
    const label = `《${curPlay.name}》第 ${show.cue.i + 1}/${show.cue.of} 幕 · ${show.cue.n}`;
    const lw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(40,20,6,.46)';
    ctx.fillRect(cx2 - lw / 2 - 18, y0 - 15 * UI, lw + 36, 30 * UI);
    ctx.fillStyle = 'rgba(255,236,196,.92)';
    ctx.fillText(label, cx2, y0);
    const n = show.cue.of, tw = Math.min(screen.w * .40, 300 * UI), sx = cx2 - tw / 2;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i <= show.cue.i ? 'rgba(232,192,122,.90)' : 'rgba(232,192,122,.22)';
      ctx.fillRect(sx + i * (tw / n), y0 + 19 * UI, (tw / n) * .70, 3 * UI);
    }
    if (show.cue.hint && uiMode === 'guide') {
      const a = .42 + .34 * (Math.sin(t * 2.4) * .5 + .5);
      ctx.font = FS(narrow ? 13 : 16);
      ctx.fillStyle = `rgba(255,226,170,${a})`;
      ctx.fillText(`▸ ${show.cue.hint}`, cx2, y0 + 38 * UI);
    }
    /* 认到了：幕布中下方大字闪一下（0.95 秒淡出）——"我做的这一下，它到底收没收到" */
    if (show.mark && show.elapsed - show.mark.t < .95) {
      const k = Math.max(0, (show.elapsed - show.mark.t) / .95);
      const a = k < .16 ? k / .16 : 1 - (k - .16) / .84;
      const nm = MOVE_NAME[show.mark.n] || show.mark.n;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a) * .96;
      ctx.textAlign = 'center';
      ctx.font = FS(Math.round(30 * (narrow ? .78 : 1)));
      ctx.shadowColor = 'rgba(255,214,150,.85)'; ctx.shadowBlur = 22 * UI;
      ctx.fillStyle = 'rgba(255,240,206,.97)';
      ctx.fillText(`${nm} ✓`, cx2, y0 + 104 * UI + (1 - Math.min(1, k / .16)) * 8 * UI);
      ctx.restore();
    }
    /* 台下人气：自己出手就涨、靠帮衬就掉（谢幕时人气高会多一阵满堂彩） */
    const aud = show.aud == null ? .5 : show.aud;
    ctx.fillStyle = 'rgba(255,232,190,.16)';
    ctx.fillRect(sx, y0 + 27 * UI, tw, 3.4 * UI);
    ctx.fillStyle = aud > .7 ? 'rgba(255,206,120,.92)' : 'rgba(226,180,120,.66)';
    ctx.fillRect(sx, y0 + 27 * UI, tw * aud, 3.4 * UI);
    ctx.textAlign = 'left';
    ctx.font = F(11);
    ctx.fillStyle = 'rgba(255,232,190,.60)';
    ctx.fillText(`台下 ${Math.round(aud * 100)}%`, sx + tw + 8 * UI, y0 + 27 * UI + 1.7 * UI);
    ctx.textAlign = 'center';
    /* 帮一把：这一幕等太久了，提示"随便来一下也算" */
    if (PB.assist && show.state === 'play' && show.cue.hint && !learn) {
      ctx.font = F(12.5);
      ctx.fillStyle = 'rgba(255,214,150,.78)';
      ctx.fillText('等久了 · 随便来一下也算（记一次帮衬）', cx2, y0 + 60 * UI);
    }
    if (learn) {
      ctx.font = F(12.5);
      ctx.fillStyle = 'rgba(255,232,190,.55)';
      ctx.fillText(`师父带做：学会 ${show.learnIdx || 0}/6 · 超时 ${show.learnMiss || 0} 次`, cx2, y0 + 58 * UI);
    }
    ctx.restore();
  }

  for (let i = 0; i < show.cards.length; i++) {
    const c = show.cards[i];
    c.t += .016;
    const inA = Math.min(1, c.t / .5);
    const life = Math.min(1, Math.max(0, (14 - c.t) / 1.2));
    const a = inA * life;
    if (a <= .01) continue;
    const w = narrow ? Math.min(VW * .82, 350) : Math.min(400, VW * .32);
    const h = 182 * (narrow ? .95 : 1);
    const x = VW - pad - w + (1 - inA) * (w + 30);
    const y = VH - pad - h - 34 * UI - i * 14;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,12,5,.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(232,192,122,.42)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    ctx.fillStyle = 'rgba(184,53,42,.95)';
    ctx.font = F(11);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`皮影志 · ${c.z.tag}`, x + 20, y + 15);
    ctx.fillStyle = 'rgba(255,238,200,.97)';
    ctx.font = FS(21);
    ctx.fillText(c.z.title, x + 20, y + 36);
    ctx.fillStyle = 'rgba(232,192,122,.30)';
    ctx.fillRect(x + 20, y + 68, w - 40, 1);
    ctx.fillStyle = 'rgba(255,232,190,.72)';
    ctx.font = F(12.5);
    wrap(ctx, c.z.text, x + 20, y + 82, w - 42, 20, (h - 96) / 20);
    ctx.restore();
  }

  if (show.state === 'rest' && show.restT > .6) {
    const a = clamp((show.restT - .6) / .8, 0, 1) * clamp((2.6 - show.restT) / .6, 0, 1);
    stamp(screen.x + screen.w - 92, screen.y + screen.h - 92, 74, '灯', a);
  }
}

/* 皮影志 · 查阅（落盘后可随时翻看） */
function drawZhiView() {
  const w = Math.min(VW * .86, 620), x = (VW - w) / 2;
  const rowH = 96 * (VW < 760 ? .92 : 1);
  const h = Math.min(VH * .86, 90 + rowH * ZHI.length);
  const y = (VH - h) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(4,3,2,.86)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = 'rgba(20,12,5,.96)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(232,192,122,.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
  const F = k => `${k * UI}px system-ui,"Microsoft YaHei"`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,236,196,.95)';
  ctx.font = `600 ${22 * UI}px "STKaiti","KaiTi",serif`;
  ctx.fillText('皮影志', x + 26, y + 22);
  ctx.fillStyle = 'rgba(232,192,122,.55)';
  ctx.font = F(12);
  ctx.fillText(`${show.unlocked.size} / ${ZHI.length} · 累计演出 ${Math.floor(store.d.total)} 秒 · ${store.d.plays} 场　（按 Z 或点右上角关闭）`,
    x + 26, y + 54);
  let yy = y + 88;
  for (const z of ZHI) {
    const got = show.unlocked.has(z.id);
    ctx.globalAlpha = got ? 1 : .42;
    ctx.fillStyle = got ? 'rgba(184,53,42,.95)' : 'rgba(120,110,100,.9)';
    ctx.font = F(11);
    ctx.fillText(got ? `皮影志 · ${z.tag}` : `未解锁 · ${z.how}`, x + 26, yy);
    ctx.fillStyle = got ? 'rgba(255,236,196,.95)' : 'rgba(200,190,175,.8)';
    ctx.font = `600 ${18 * UI}px "STKaiti","KaiTi",serif`;
    ctx.fillText(got ? z.title : '？？？', x + 26, yy + 18);
    ctx.fillStyle = got ? 'rgba(255,232,190,.62)' : 'rgba(160,150,140,.55)';
    ctx.font = F(12);
    wrap(ctx, got ? z.text : '做出对应的动作，才会知道这一条。', x + 26, yy + 44, w - 52, 17, 2.4);
    ctx.globalAlpha = 1;
    yy += rowH;
  }
  ctx.restore();
}

function wrap(c, text, x, y, maxW, lh, maxLines = 3.2) {
  let line = '', yy = y;
  for (const ch of text) {
    if (c.measureText(line + ch).width > maxW) {
      c.fillText(line, x, yy); line = ch; yy += lh;
      if ((yy - y) / lh > maxLines) { c.fillText(line + '…', x, yy); return; }
    } else line += ch;
  }
  c.fillText(line, x, yy);
}

/* ============================== 合成手（演示 + 键盘鼠标共用） ============================== */
const HAND_OPEN = [
  [0, 0],
  [-.18, -.16], [-.30, -.30], [-.38, -.44], [-.42, -.56],
  [-.16, -.50], [-.18, -.64], [-.19, -.74], [-.20, -.83],
  [-.02, -.52], [-.02, -.68], [-.02, -.79], [-.02, -.89],
  [.12, -.50], [.14, -.64], [.15, -.74], [.16, -.83],
  [.25, -.45], [.28, -.56], [.30, -.64], [.32, -.71]
];
const HAND_FIST = [
  /* 第十轮修：原来的"握拳"只是把手指截短、仍朝外伸（旧指标靠"指尖离手腕更近"还能勉强判对，
     换成骨架伸直度后立刻露馅：伸直度≈1.0 = 一只张开的手）。真实的拳是**指尖折回掌心**，
     所以这里让 mcp→pip→tip 折回来，伸直度落在 0.40~0.43 —— 与真手掌的几何一致。 */
  [0, 0],
  [-.18, -.16], [-.26, -.28], [-.30, -.38], [-.26, -.46],
  [-.16, -.50], [-.17, -.40], [-.14, -.365], [-.115, -.445],
  [-.02, -.52], [-.03, -.42], [-.005, -.385], [.015, -.465],
  [.12, -.50], [.11, -.40], [.135, -.365], [.155, -.44],
  [.25, -.45], [.24, -.36], [.255, -.325], [.27, -.395]
];

function synthHand(cx, cy, sc, curl, pinch, rot = 0) {
  const pts = HAND_OPEN.map((p, i) => [
    lerp(p[0], HAND_FIST[i][0], curl), lerp(p[1], HAND_FIST[i][1], curl)
  ]);
  if (pinch > 0) {
    const t8 = pts[8];
    pts[4] = [lerp(pts[4][0], t8[0] + .02, pinch), lerp(pts[4][1], t8[1] + .03, pinch)];
    pts[3] = [lerp(pts[3][0], pts[4][0] + .04, pinch), lerp(pts[3][1], pts[4][1] + .09, pinch)];
    pts[2] = [lerp(pts[2][0], pts[3][0] + .07, pinch), lerp(pts[2][1], pts[3][1] + .07, pinch)];
  }
  const co = Math.cos(rot), si = Math.sin(rot);
  return pts.map(([x, y]) => {
    const rx = x * co - y * si, ry = x * si + y * co;
    return { x: cx + rx * sc, y: cy + ry * sc, z: 0 };
  });
}

/* ============================== 手动模式（键盘 / 鼠标 / 触摸） ============================== */
const MAN = {
  x: .5, y: .58, tilt: -.1, keys: new Set(), away: true, extra: 0, meet: false, pointer: false,
  arm: .55,                                  // 两签模式下手签的高度（u 提臂 / o 放臂）
  /* 鼠标按住 = 出手势：左键捏合、右键攥拳（中键对戏直接走 MAN.meet）。
     摄像头模式没有这些，键鼠模式才是"一个人也演得动"的那条路。 */
  mouse: { pinch: false, fist: false }
};

function manualHands(dt) {
  if (MAN.away) return [];
  const spd = dt * .95;
  const k = MAN.keys;
  if (k.has('ArrowLeft') || k.has('a') || k.has('A')) MAN.x -= spd;
  if (k.has('ArrowRight') || k.has('d') || k.has('D')) MAN.x += spd;
  if (k.has('ArrowUp') || k.has('w') || k.has('W')) MAN.y -= spd * .8;
  if (k.has('ArrowDown') || k.has('s') || k.has('S')) MAN.y += spd * .8;
  MAN.x = clamp(MAN.x, .04, .96); MAN.y = clamp(MAN.y, .22, .92);
  const pinch = (k.has('e') || k.has('E') || MAN.mouse.pinch) ? 1 : 0;
  const curl = (!pinch && (k.has('q') || k.has('Q') || MAN.mouse.fist)) ? 1 : 0;
  // 手动模式下 x 存的是"影人朝向"（右为正），合成手要转到图像坐标（镜像）
  const cx0 = 1 - MAN.x;
  const xs = [cx0];
  for (let i = 1; i <= MAN.extra; i++) {
    const dir = i % 2 ? 1 : -1;
    const gap = MAN.meet ? .05 : .36 + .10 * Math.floor((i - 1) / 2);  // 间距要 > 对戏阈值(.30)
    xs.push(cx0 - dir * gap);
  }
  /* 两签模式：第二只手当"手签"，由 u/o 单独控制它抬多高 */
  if (twoSign && MAN.extra >= 1) MAN.arm = clamp(MAN.arm, .12, .95);
  // 整组平移出界而不是逐只 clamp —— 逐只裁剪会把边上的手挤到一起，凭空触发"对戏"
  let lo = Math.min(...xs), hi = Math.max(...xs), sh = 0;
  if (lo < .03) sh = .03 - lo;
  if (hi + sh > .97) sh = .97 - hi;
  const out = [{ lm: synthHand(clamp(xs[0] + sh, .02, .98), MAN.y, .30, curl, pinch, MAN.tilt) }];
  for (let i = 1; i < xs.length; i++) {
    const yy = (twoSign && i === 1) ? MAN.arm : clamp(MAN.y + (i % 2 ? -.02 : .02), .2, .94);
    out.push({ lm: synthHand(clamp(xs[i] + sh, .02, .98), yy, .30, 0, 0, -.1) });
  }
  return out;
}

function bindManualInput() {
  const onKey = (e, down) => {
    /* 菜单开着的时候，任意键先只干一件事：关菜单（Z 例外，它仍是皮影志的开关）。
       这样"按任意键关闭"和"点空白关闭"和 ✕/合上 是同一条出口。 */
    if (down && menuOpen()) {
      if (e.key === 'z' || e.key === 'Z') {
        const wasView = !!show.view;
        closeMenus();
        if (!wasView) show.view = true;
        syncHints(); return;
      }
      closeMenus(); e.preventDefault(); return;
    }
    if (e.key === 'Home') { if (down) { e.preventDefault(); goHome(); } return; }   // 回首页（任何页面都能退）
    if (!started) return;                  // 开场幕（首页）上只认按钮，键盘不碰底下的戏
    if (e.key === 'z' || e.key === 'Z') { if (down) { show.view = !show.view; syncHints(); } return; }
    if (e.key === 'm' || e.key === 'M') { if (down) setMusic(); return; }   // 文场开/关（任何模式都能按）
    if (e.key === 'Tab') { if (down) { e.preventDefault(); setUIMode(uiMode === 'guide' ? 'free' : 'guide'); } return; }   // 引导 / 自由
    if (e.key === 'y' || e.key === 'Y') { if (down) restartPlay(); return; } // 再演一遍（任何模式都能按）
    if (e.key === 'v' || e.key === 'V') { if (down) setFeelUI(); return; }   // 手感三档循环
    if (e.key === '?' || e.key === '/') { if (down) { e.preventDefault(); toggleKeys(); } return; }   // 键鼠一览
    if (e.key === 'Escape' && $('#keys').classList.contains('show')) { if (down) toggleKeys(false); return; }
    if (show.view) { if (down) { show.view = false; syncHints(); } return; }   // 查看皮影志时，任意按键先关掉
    /* 摄像头模式也吃键：R/I/K/X/J 直接把这一手做出来，E/Q/G 直接替你做一次捏合/攥拳/对戏；
       T/U/O（手签、加人）只在键鼠模式有意义，按了也不闹事。 */
    const cam = mode === 'camera';
    if (mode !== 'manual' && !cam) return;
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (down) {
        /* 开戏前打闹台、谢幕后叫好打赏：空格也认（这条必须在"按住起灯"之前判） */
        if (show.state === 'warmup') warmupHit('key');
        else if (show.state === 'curtain') tipHit();
        MAN.away = false;
      } else { MAN.away = true; }
      return;
    }
    if (e.key === 'Escape') {
      if (down) { MAN.away = true; MAN.extra = 0; MAN.meet = false; MAN.mouse.pinch = MAN.mouse.fist = false; }
      return;
    }
    if (down && (e.key === 't' || e.key === 'T')) { MAN.extra = (MAN.extra + 1) % (MAXP); HT.resettle(); return; }
    if (e.key === 'g' || e.key === 'G') {
      if (cam) { if (down) onHandEvent('meet'); return; }   // 摄像头模式：G 直接对一次戏
      MAN.meet = down; return;   // 两手靠近：不 resettle，让手滑过去——引擎要看见"靠近的过程"才算对戏
    }
    if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
      if (down && show.state === 'play') {
        const k = order[(+e.key - 1) % order.length];
        show.roleIdx = +e.key - 1;
        puppets[0].setRole(k);
        Audio_.drum();
        subtitle(ROLES[k].line, 4.5);
      }
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
    if (down && (e.key === 'r' || e.key === 'R')) {         // 挥手换势 / 甩翎子
      PB.action('wave');
      mark('wave');
      if (active.length) active.forEach(p => p.flickPlume(1.2));
      return;
    }
    /* ---------- 新增玩法按键 ---------- */
    if (down && (e.key === 'f' || e.key === 'F')) { toggleTwoSign(); return; }
    if (down && (e.key === 'h' || e.key === 'H')) { cycleHead(); return; }
    if (down && (e.key === 'p' || e.key === 'P')) { cycleSkin(); return; }
    if (down && (e.key === 'n' || e.key === 'N')) {          // 换流派
      const ks = Object.keys(SCHOOLS); setSchool(ks[(ks.indexOf(schoolKey) + 1) % ks.length]); return;
    }
    if (down && (e.key === 'b' || e.key === 'B')) { beatToggle(); return; }   // 点板开关
    if (down && (e.key === 'x' || e.key === 'X')) { PB.action('turn'); mark('turn'); doTurn(false); return; }   // 翻手 · 换面
    if (down && (e.key === 'u' || e.key === 'U')) { MAN.arm = clamp(MAN.arm - .06, .12, .95); return; }   // 手签：提臂
    if (down && (e.key === 'o' || e.key === 'O')) { MAN.arm = clamp(MAN.arm + .06, .12, .95); return; }   // 手签：放臂
    if (down && (e.key === 'i' || e.key === 'I')) {         // 上挑（水袖 / 折柳）—— 原来只有手势能做，键盘没有这一手
      if (active.length) active.forEach(q => q.jumpStart());
      PB.action('raise'); mark('raise'); Audio_.chime(); return;
    }
    if (down && (e.key === 'k' || e.key === 'K')) { if (active.length) active.forEach(q => q.act('kick')); PB.action('kick'); mark('kick'); Audio_.drum(); return; }   // 踢腿
    if (down && (e.key === 'j' || e.key === 'J')) { if (active.length) active.forEach(q => { q.act('flip'); q.spin = 1; }); PB.action('flip'); mark('flip'); Audio_.gong(); return; }  // 翻身
    if (down && (e.key === 'l' || e.key === 'L')) { if (active.length) active.forEach(q => q.act('split')); Audio_.clap(); return; }   // 劈叉
    if (down && (e.key === ' ' || e.key === 'q' || e.key === 'Q')) {   // 闹台 / 打赏 也吃这两个键
      if (show.state === 'warmup') { warmupHit('key'); return; }
      if (show.state === 'curtain') { tipHit(); return; }
    }
    if (cam && down) {                                     // 摄像头模式：键盘替手做手势（同一漏斗：日志/招式灯/台本/点板都认）
      if (e.key === 'e' || e.key === 'E') { onHandEvent('pinch'); return; }
      if (e.key === 'q' || e.key === 'Q') { onHandEvent('fist'); return; }
    }
    if (down) MAN.keys.add(e.key); else MAN.keys.delete(e.key);
  };
  window.addEventListener('keydown', e => onKey(e, true));
  window.addEventListener('keyup', e => onKey(e, false));

  const move = (mx, my) => {
    MAN.pointer = true;
    MAN.x = clamp(mx / VW, .02, .98);
    MAN.y = clamp(my / VH, .18, .95);
    MAN.away = false;
  };
  /* 鼠标按住 = 出手势：左键捏合（挑签）、右键攥拳（定住）、中键对戏（两手靠近）。
     光会走影不会出手势，键鼠模式就只能看戏 —— 这三个键才算把整出戏交到鼠标手里。 */
  const press = (e, down) => {
    if (mode !== 'manual') return;
    if (e.button === 0) MAN.mouse.pinch = down;
    else if (e.button === 2) MAN.mouse.fist = down;
    else if (e.button === 1) MAN.meet = down;                 // 中键对戏：同样让两手滑过去，别瞬移
  };
  cv.addEventListener('mousemove', e => { if (mode === 'manual') move(e.clientX, e.clientY); });
  cv.addEventListener('mousedown', e => { if (mode === 'manual') { move(e.clientX, e.clientY); press(e, true); } });
  window.addEventListener('mouseup', e => press(e, false));
  cv.addEventListener('contextmenu', e => { if (mode === 'manual') e.preventDefault(); });   // 右键要拿来做攥拳，别弹菜单
  cv.addEventListener('auxclick', e => { if (mode === 'manual') e.preventDefault(); });      // 中键别触发自动滚动
  /* 滚轮：两签模式里提 / 放右手（等同 U / O） */
  cv.addEventListener('wheel', e => {
    if (mode !== 'manual') return;
    e.preventDefault();
    MAN.arm = clamp(MAN.arm + (e.deltaY > 0 ? .06 : -.06), .12, .95);
  }, { passive: false });
  /* 窗口失焦（切标签、弹窗）时松开所有按住的手势，免得回来还捏着 */
  window.addEventListener('blur', () => { MAN.mouse.pinch = MAN.mouse.fist = false; });

  /* 触屏：一指走影；按住不动 0.24 秒 = 捏合（拖动超过十几像素就不算按住） */
  let tHold = 0, tSX = 0, tSY = 0;
  cv.addEventListener('touchstart', e => {
    if (mode !== 'manual') return;
    e.preventDefault();
    const t = e.touches[0]; move(t.clientX, t.clientY);
    tSX = t.clientX; tSY = t.clientY;
    clearTimeout(tHold);
    tHold = setTimeout(() => { MAN.mouse.pinch = true; }, 240);
  }, { passive: false });
  cv.addEventListener('touchmove', e => {
    if (mode !== 'manual') return;
    e.preventDefault();
    const t = e.touches[0];
    if (Math.hypot(t.clientX - tSX, t.clientY - tSY) > 14) clearTimeout(tHold);
    move(t.clientX, t.clientY);
  }, { passive: false });
  cv.addEventListener('touchend', e => {
    if (mode !== 'manual') return;
    clearTimeout(tHold); MAN.mouse.pinch = false;
    setTimeout(() => { MAN.away = true; }, 260);
  });
}

/* ============================== 演示模式 ============================== */
const DEMO = [
  { d: 2.4, f: () => ({ hands: [synthHand(.44, .60, .30, 0, 0, .12)] }) },
  { d: 2.2, f: () => ({ hands: [synthHand(.40, .60, .30, 0, 0, .12), synthHand(.62, .60, .30, 0, 0, -.12)] }) },
  { d: 1.8, f: () => ({ hands: [synthHand(.46, .58, .30, 0, 0, .10), synthHand(.56, .58, .30, 0, 0, -.10)] }) },
  { d: 1.6, f: t => ({ hands: [synthHand(.22 + ((t * 3) % 1) * .62, .60, .30, 0, 0, .10)] }) },
  { d: 2.6, f: () => ({ hands: [synthHand(.52, .62, .30, 0, 0, .15)] }) },
  { d: 2.2, f: t => ({ hands: [synthHand(.35 + Math.sin(t * 1.5) * .16, .60, .30, 0, 0, .2)] }) },
  { d: 1.8, f: t => ({ hands: [synthHand(.70 + Math.sin(t * 1.9) * .10, .58, .32, 0, 0, -.2)] }) },
  { d: 1.6, f: () => ({ hands: [synthHand(.52, .38, .34, 0, 0, 0)] }) },
  { d: 5.2, f: () => ({ hands: [synthHand(.50, .62, .30, 0, 1.0, .1)] }) },
  { d: 2.2, f: () => ({ hands: [synthHand(.42, .60, .30, 1.0, 0, .1)] }) },
  { d: 2.4, f: () => ({ hands: [synthHand(.33, .60, .29, 0, 0, .18), synthHand(.70, .60, .29, 0, 0, -.18)] }) },
  { d: 2.0, f: () => ({ hands: [synthHand(.44, .58, .30, 0, 0, .1), synthHand(.58, .58, .30, 0, 0, -.1)] }) },
  { d: 2.4, f: t => ({
      hands: [synthHand(.30, .60, .29, 0, 0, .18), synthHand(.44, .60, .29, 0, 0, .06),
              synthHand(.60, .60, .29, 0, 0, -.06), synthHand(.74 + Math.sin(t * 2) * .03, .60, .29, 0, 0, -.18)]
    }) },
  { d: 2.2, f: () => ({ hands: [synthHand(.55, .62, .30, 0, 0, .12)] }) },
  { d: 2.0, f: () => ({ hands: [] }) }
];
let demoI = 0, demoT = 0;

/* 演示模式：有台本时，按"当前这一幕要什么手势"自己演出来——
   这样「无摄像头 · 看演示」是一出从头到尾走得完的戏，而不是随手比划。 */
function demoHands(dt, t) {
  if (curPlay && PB.running && PB.cue) {
    const c = PB.cue;
    const list = Array.isArray(c.need) ? c.need : [c.need];
    // 演示优先挑"静态手型"能完成的那一个：掉帧时速度/位移类手势会被平滑掉，
    // 而 张/捏/握/双手靠近 这类静态判定在任何帧率下都稳。
    const STATIC = ['meet', 'pinch', 'fist', 'hold', 'enter'];
    const need = list.find(n => STATIC.includes(n)) || list[0];
    const k = PB.elapsed;
    const armed = k > .9;                            // 每幕先"起势"0.9 秒再出手，动作有节拍
    if (need === 'meet') {                            // 双手靠近：先分开（把对戏的锁重置），再合上
      const gap = armed ? .07 : .45;
      return [synthHand(.50 - gap / 2, .58, .30, 0, 0, .10), synthHand(.50 + gap / 2, .58, .30, 0, 0, -.10)];
    }
    if (need === 'hold') return [synthHand(.50, .62, .30, 0, 0, .08)];   // 谢幕：静立
    if (armed && need === 'pinch') return [synthHand(.50, .62, .30, 0, 1.0, .10)];
    if (armed && need === 'fist') return [synthHand(.50, .62, .30, 1.0, 0, .10)];
    if (armed && need === 'wave') {                   // 横向快挥：平滑正弦，任何帧率都能被"位移判定"认出
      return [synthHand(.50 + Math.sin(k * 9.4) * .30, .60, .30, 0, 0, .10)];
    }
    if (armed && need === 'raise') {                  // 上挑：短时间内抬起来，触发腾跃
      const rp = Math.min(1, (k % 1.4) / .34);
      return [synthHand(.50, .64 - rp * .32, .30, 0, 0, .05)];
    }
    return [synthHand(.50 + Math.sin(k * 1.1) * .06, .60, .30, 0, 0, .12)];
  }
  demoT += dt;
  const seg = DEMO[demoI % DEMO.length];
  if (demoT > seg.d) { demoT = 0; demoI++; }
  return seg.f(t).hands;
}

/* ============================== 主循环 ============================== */
let last = 0, started = false, mode = 'camera', freeze = false;
let wallDt = .016;                     // 真实帧间隔（不夹紧），给台本计时用

/* ---------- 身上功夫：横扫 / 下砸 / 上挑 / 两手同上抬（翻身）----------
   全部按"窗口内位移"判：看最近 0.55 秒手走了多远、往哪个方向，不看瞬时速度
   （速度判定在掉帧时会被平滑抹平 → "明明做了却没反应"）。
   做成函数是因为它不只服务于"演出中"：自检页与台下练手时，这几手也得认得出。 */
function checkMoves() {
  window.__cmN = (window.__cmN || 0) + 1;
const FT = tune();   // ← 用"当前生效"的阈值：手感档位 + 自动放宽都在里面
const nowMs = performance.now();
/* 冷却按真实时间走：用被夹紧的 dt 会让掉帧时冷却长得离谱（一次挥手能锁住好几秒，
   这就是"有些手势怎么都触发不了"的一大来源） */
wave.cool = Math.max(0, wave.cool - wallDt);
chop.cool = Math.max(0, chop.cool - wallDt);
let ups = 0;
for (const s of HT.slots) {
  /* 门槛只要 2 个样本：掉帧到 10fps 时，猛地一挑/一砸整个挤在相邻两帧之间，等攒够 4 帧，
     发力的那一步已经从窗口边上滑走 ——「明明甩了却不认」的元凶之一。 */
  if (!s.present || !s.trail || s.trail.length < 2) continue;
  const n = s.trail.length;
  /* ---- 「一步到位」的发力（低帧率专用通道）----
     60fps 下每步只有 0.01~0.03 屏，这条永远不触发；掉帧到 <20fps 后，真人的猛挑/猛砸
     整个发力段就压缩在一两步里（12fps 时 0.3 秒的挥砸只落得下三四帧）。
     按样本数取"最近 42%"永远把它裁在窗口边上（真手数据：上挑 0.28 屏那一步、
     下砸 0.28 屏那一步全被裁掉，一次都触发不了）。
     取**最近一到两步**的净位移：猛地一下做完整段发力、方向又纯粹（横竖比 1.15）的算数；
     一步就够大用一步，两步加起来够大也行（慢拖动是匀速的，两步净位移也攒不到阈值）。
     注：所有触发都不再把轨迹清空、只留当前这一个样本当基准 —— 整段清掉的话，
     低帧率下"下一段动作"没有参照，会直接从窗口边界上滑走（两手同抬实测翻不了身）。 */
  {
    const q1 = s.trail[n - 1], q0 = n >= 3 ? s.trail[n - 3] : s.trail[n - 2];
    const sdt = q1.t - q0.t;
    if (sdt > .05 && sdt < .95) {
      const bx = q1.rx - q0.rx, by = q1.ry - q0.ry;
      if (chop.cool <= 0 && by > FT.kickD * 1.6 && by > Math.abs(bx) * 1.15) {
        window.__cmDbg = { step: 'kick', bx: +bx.toFixed(3), by: +by.toFixed(3) };
        chop.cool = 1.1; s.trail.length = Math.min(s.trail.length, 1);
        active.forEach(p => p.act('kick')); mark('kick'); PB.action('kick');
        continue;
      }
      if (-by > FT.raiseD && -by > Math.abs(bx) * 2) {
        ups++;                                     // 上挑的条件先数着：两只手都挑 = 翻身
        if (chop.cool <= 0) {
          window.__cmDbg = { step: 'raise', bx: +bx.toFixed(3), by: +by.toFixed(3) };
          chop.cool = 1.0; s.trail.length = Math.min(s.trail.length, 1);
          active.forEach(p => { p.jumpStart(); }); mark('raise'); PB.action('raise');
        }
        continue;
      }
    }
  }
  if (n < 4) continue;
  /* ---- 「猛地来一下」 vs 「慢慢挪」：看发力段在整窗位移里占多大比例 ----
     平移影人是**匀速**的（整窗都动，占比≈0.4）；故意的手势是**短促发力**（最近 0.32 秒里
     就把大部分位移走完，占比≥0.75）。所以不必"先停住再甩"——边走边甩也认，
     而单纯走影永远不会达标。以前只看整窗位移 → 左右挪影人每次都被当成"横扫换势"。 */
  const tEnd = s.trail[n - 1].t;
  /* 「发力段」按**样本数**取最近 42% 的窗口（≈0.33 秒），不写死秒数：
     掉帧到 12fps 时 0.32 秒只有三四帧，短促的甩手会从窗口里漏掉（"认不出来"的老毛病）。 */
  const bi = Math.max(3, Math.round(n * .42));
  const burst = s.trail.slice(n - bi);
  if (burst.length < 3) continue;
  const spanOf = arr => ({
    x: Math.max(...arr.map(h => h.rx)) - Math.min(...arr.map(h => h.rx)),
    y: Math.max(...arr.map(h => h.ry)) - Math.min(...arr.map(h => h.ry))
  });
  const B = spanOf(burst), A = spanOf(s.trail);
  const dx = B.x, dy = B.y;
  const sX = A.x > .004 ? dx / A.x : 0, sY = A.y > .004 ? dy / A.y : 0;
  /* 横扫单独看「最近 6 个样本」：42% 的窗口在掉帧时只剩三四个样本，猛地一甩的位移被摊薄到
     阈值以下（「明明甩了却不认」就是这么来的）。6 是实测出来的分界：横甩 6 样本走 0.26 屏，
     而「来回走影」「随便乱动」的 6 样本位移都 ≤0.19，阈值 0.20 正落在中间。 */
  const biW = Math.min(6, n);
  const BW = spanOf(s.trail.slice(n - biW));
  const sXW = A.x > .004 ? BW.x / A.x : 0;
  window.__cmDbg = { dx: +dx.toFixed(3), dy: +dy.toFixed(3), ay: +A.y.toFixed(3), sY: +sY.toFixed(2), rid: +(burst[burst.length - 1].ry - burst[0].ry).toFixed(3), rd: FT.raiseD, kd: FT.kickD, cc: +chop.cool.toFixed(2), bx: +B.x.toFixed(3), wx: +BW.x.toFixed(3), ws: +sXW.toFixed(2), n };
  const dyDir = burst[burst.length - 1].ry - burst[0].ry;   // 正 = 往下
  /* 横扫 / 挥手（换势、抛袖、磨刀）：发力段里横着走得多，且这一下占了大头 */
  if (wave.cool <= 0 && BW.x > FT.waveD && BW.x > BW.y * 1.15 && sXW > .50) {
    wave.cool = 1.2; s.trail.length = Math.min(s.trail.length, 1); mark('wave'); PB.action('wave');
    continue;
  }
  /* 下砸（踢腿、踉跄）：发力段里竖着往下走得多 */
  /* sY 从 .50 提到 .60：低帧率下窗口保底 10 个样本会拉到 1.4 秒长，把好几秒前的
     一次挥动也算进"整窗位移"，**慢慢把手拖下去**（真手回放：拖手 sY .49~.52）就会
     擦线误发下砸，把真正的上挑用共享冷却锁死。真砸的 sY 是 .92，余量充足。 */
  if (chop.cool <= 0 && dy > FT.kickD && dy > dx * 1.15 && dyDir > FT.kickD * .55 && sY > .60) {
    chop.cool = 1.1; s.trail.length = Math.min(s.trail.length, 1);
    active.forEach(p => p.act('kick')); mark('kick'); PB.action('kick');
    continue;
  }
  /* 上挑（腾跃、水袖、折柳）：发力段里竖着往上走得多。
     方向纯度 2.0（原来 1.15）：合成的"跳到起始位"那种斜向位移（dx .26 / dy .33）
     不该伪装成上挑 —— 真人的挑都是竖着走的（实测 dx 只有 0.02~0.05）。 */
  if (dy > FT.raiseD && dy > dx * 2 && dyDir < -FT.raiseD * .55 && sY > .60) {
    ups++;
    if (chop.cool <= 0) {
      chop.cool = 1.0; s.trail.length = Math.min(s.trail.length, 1);
      active.forEach(p => { p.jumpStart(); });
      mark('raise'); PB.action('raise');
    }
    continue;
  }
}
/* 两只手一起往上抬 = 翻身（一个人做不出来就用手势"上挑"顶上去）。
   低帧率时"同一拍"放宽成 0.9 秒内的两次（一帧就是几百毫秒，同拍永远凑不齐），
   而且不能再看共享冷却——同帧里第一只手刚触发的冷却会把判定挡在门外
   （验收环境 1.4fps 实测：两手同抬以前永远翻不了身）。翻转给 2.5 秒冷却防连发。 */
if (ups >= 2) upsAt = nowMs;
if (upsAt && nowMs - upsAt < 900 && nowMs - flipAt > 2500) {
  upsAt = 0; flipAt = nowMs;
  active.forEach(p => { p.act('flip'); p.spin = 1; });
  mark('flip'); PB.action('flip');
}
  return ups;
}

async function frame(nowMs) {
  const t = nowMs / 1000;
  wallDt = last ? Math.min(.5, t - last) : .016;
  const dt = Math.min(.05, last ? t - last : .016);
  last = t;

  if (started) {
    if (freeze) {
      HT.feed([], nowMs);
    } else if (mode === 'camera') {
      /* fakeCam：验收用的"合成摄像头"（每帧喂手，和真摄像头同一条通路） */
      const res = fakeCam ? fakeCam(nowMs / 1000) : HT.detect();
      HT.feed(res || [], nowMs);
    } else if (mode === 'manual') {
      HT.feed(manualHands(dt).map(h => h.lm), nowMs);
    } else {
      const demoNow = nowMs / 1000;
      HT.feed(demoHands(dt, demoNow), nowMs);
    }
    director(dt, t);
    musicFollow();                          // 文场跟着戏走：起灯渐入、收灯渐出
    drivePuppets(dt, t);
    render(t);
  }
  requestAnimationFrame(frame);
}

/* ================= 手势自检：把"认不出来"拆成看得见的三件事 =================
   ① 摄像头有没有画面  ② 光线够不够  ③ 手有没有被认出来（七个手势各认不认）
   摄像头画面不上传、也不显示；这里唯一的取用是"整幅的平均亮度"一个数（0–255），取完即弃。
   目的：用户说"手势太难用"时，先分清是"没看见手"还是"手势做得不对"——这两件事的解法完全不同。 */
const CK_GEST = [
  ['pinch', '捏合', '拇指指尖去够食指指尖，轻轻一碰（不用真捏住）'],
  ['fist', '攥拳', '四指收回握拳（留一根没弯也算）'],
  ['open', '张掌', '五指张开对着镜头'],
  ['turn', '翻手', '手心朝上，慢慢翻成手背朝上'],
  ['raise', '上挑', '手掌往上抬、往上甩一下'],
  ['kick', '下砸', '手掌从上往下劈一下'],
  ['wave', '横扫', '手掌左右横扫一下'],
  ['meet', '两手靠近', '两只手都举进画面、互相靠近一点']
];
const ckCv = document.createElement('canvas'); ckCv.width = 48; ckCv.height = 27;
const ckCx = ckCv.getContext('2d', { willReadFrequently: true });
let ckOn = false, ckSeenInto = {}, ckEverHand = false, camT0 = 0, ckAutoDone = false;
let ckLastHandT = 0, ckAnyGest = false, ckAutoOpened = 0, ckTickN = 0;
const ck$ = id => document.getElementById(id);
const ckText = (id, t) => { const e = ck$(id); if (e) e.textContent = t; };
const ckDot = (id, cls) => { const e = ck$(id); if (e) e.className = 'dot' + (cls ? ' ' + cls : ''); };

/* 只返回一个数：画面平均亮度（不存帧、不留图、不上传） */
function ckBright() {
  const v = HT.video;
  if (!v || !v.videoWidth) return null;
  try {
    ckCx.drawImage(v, 0, 0, ckCv.width, ckCv.height);
    const d = ckCx.getImageData(0, 0, ckCv.width, ckCv.height).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s += d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
    return s / (d.length / 4);
  } catch (e) { return null; }
}
function ckShow(v, fresh) {
  ckOn = !!v;
  const box = $('#check');
  if (box) box.classList.toggle('show', ckOn);
  if (ckOn && fresh !== false) { ckSeenInto = {}; ckRender(); }
}
function ckHandInfo() {
  const live = (HT.slots || []).filter(s => s.present && s.analyzed);
  if (!live.length) return { n: 0 };
  ckEverHand = true; ckLastHandT = performance.now();      // 看到手就记住（自检页开着时也要更新）
  const hs = Math.max(...live.map(s => s.analyzed.hs || 0));
  return { n: live.length, hs, label: live[0].analyzed.label };
}
function ckRender() {
  const v = HT.video;
  /* ① 摄像头 */
  if (mode === 'manual') { ckText('ckCam', '没开也不用开——现在走的是键盘 / 鼠标'); ckDot('ckCamDot', ''); }
  else if (v && v.videoWidth) { ckText('ckCam', `在跑（${v.videoWidth}×${v.videoHeight}）`); ckDot('ckCamDot', 'on'); }
  else if (v) { ckText('ckCam', '有设备，但一直没有画面——多半被别的程序占着（会议 / 微信 / 相机），关掉它再刷新'); ckDot('ckCamDot', 'bad'); }
  else { ckText('ckCam', '还没开——点下面「就这么开始」，浏览器问权限时选「允许」'); ckDot('ckCamDot', 'bad'); }
  /* ② 光线（MediaPipe 在暗处认手会明显变差） */
  const br = ckBright();
  if (br == null) { ckText('ckLight', '—（要先有画面才算得出来）'); ckDot('ckLightDot', ''); }
  else if (br < 55) { ckText('ckLight', `偏暗（${br | 0} / 255）——开一盏灯、面向窗户，别背对光`); ckDot('ckLightDot', 'bad'); }
  else if (br < 88) { ckText('ckLight', `略暗（${br | 0} / 255）——能认，但开盏灯会更灵`); ckDot('ckLightDot', 'warn'); }
  else if (br > 225) { ckText('ckLight', `太亮 / 有点逆光（${br | 0} / 255）——把背后的窗子避开试试`); ckDot('ckLightDot', 'warn'); }
  else { ckText('ckLight', `够亮（${br | 0} / 255）`); ckDot('ckLightDot', 'on'); }
  /* ③ 看到的手 */
  const h = ckHandInfo();
  if (h.n === 0) { ckText('ckHands', '0 只——把手举到画面中间，离摄像头约一臂远'); ckDot('ckHandDot', v && v.videoWidth ? 'bad' : ''); }
  else if (h.hs < .055) { ckText('ckHands', `${h.n} 只 · 但看着很小 → 太远了，往镜头挪近一点`); ckDot('ckHandDot', 'warn'); }
  else if (h.hs > .34) { ckText('ckHands', `${h.n} 只 · 太近了 → 往后退一点，整只手要留在画面里`); ckDot('ckHandDot', 'warn'); }
  else { ckText('ckHands', `${h.n} 只 · 大小合适 · 眼下像「${h.label || '—'}」`); ckDot('ckHandDot', 'on'); }
  /* 七个手势：做出来就变绿（认到过就一直在） */
  const mv = show.moves || {};
  const ul = $('#ckGest');
  if (ul) {
    if (!ul.childElementCount) {
      for (const [k, nm, how] of CK_GEST) {
        const li = document.createElement('li');
        li.dataset.g = k;
        li.innerHTML = `<i class="dot"></i><span class="nm">${nm}</span><span class="how">${how}</span>`;
        ul.appendChild(li);
      }
    }
    for (const [k] of CK_GEST) {
      const li = ul.querySelector(`li[data-g="${k}"]`);
      if (!li) continue;
      if (mv[k] != null) ckSeenInto[k] = 1;
      const n = li.firstElementChild;
      n.className = 'dot' + (ckSeenInto[k] ? ' on' : (mv[k] != null ? ' on' : ''));
    }
  }
  const got = CK_GEST.filter(([k]) => ckSeenInto[k] || mv[k] != null);
  const miss = CK_GEST.filter(([k]) => !(ckSeenInto[k] || mv[k] != null));
  /* 结论：一条一条按"最要紧的那个先"给 */
  let tip;
  if (mode === 'manual') tip = '你选的是键盘 / 鼠标操作，手势这块用不着。想试手势就点「就这么开始」。';
  else if (!v) tip = '先点「就这么开始」开摄像头；浏览器弹权限选「允许」，页面右上角会亮起摄像头的小红点。';
  else if (!v.videoWidth) tip = '摄像头有设备却没有画面：先关掉其他占用摄像头的程序（腾讯会议 / 微信 / 相机 / 其他浏览器标签），再刷新这一页。';
  else if (br != null && br < 55) tip = '最大的问题在光：先把灯打开（或面向窗户、别背光），MediaPipe 在暗处会"看不见"你的手——这比手势本身的影响大得多。';
  else if (!ckEverHand) tip = '摄像头在跑，但还没认出任何一只手：把手举到画面正中间、离镜头约 50cm（一臂），五指分开对着镜头停 1 秒。如果「③ 看到的手」一直是 0，就再退远一点或换亮一点的地方。';
  else if (!got.length) tip = '手看到了 ✓ 但一个招式都还没认出来——先做第一行「捏合」：拇指指尖去够食指指尖，轻轻一碰就松开，做两三次试试。';
  else if (got.length < CK_GEST.length) tip = `已经认到 ${got.length} / ${CK_GEST.length} 个手势。照上面没亮的几行做：${miss.slice(0, 3).map(([, nm]) => nm).join('、')}${miss.length > 3 ? '…' : ''}。做出来那一行就会变绿——这就是"系统认没认你"。`;
  else tip = `七个手势都认到了 ✓ 放心演。真上戏时如果还是卡，按一下「再放宽一档」，判定会立刻更松（代价只是评价照记）。`;
  const rl = relaxLevel();
  if (rl > 0) tip += ` ｜ 当前手感已放宽 ${Math.round(rl * 100)}%。`;
  ckText('ckTip', tip);
}
function ckTick() {
  ckTickN++;
  const mv0 = show.moves || {};
  if (CK_GEST.some(([k]) => mv0[k] != null)) ckAnyGest = true;
  if (!ckOn) {
    /* 摄像头开了却用不顺，自动把自检页弹出来——"手势太难用"无非两种：
       ① 9 秒了还没看见你的手（多半是光/距离/被占用）② 15 秒了连一个手势都没认到（多半是做法的误会） */
    if (mode === 'camera' && HT.video) {
      const nowMs = performance.now();
      if (!camT0) camT0 = nowMs;
      if (ckHandInfo().n) { ckLastHandT = nowMs; ckEverHand = true; }
      const noHand = nowMs - Math.max(camT0, ckLastHandT) > 9000;
      const noGest = nowMs - camT0 > 15000 && !ckAnyGest;
      if (!ckAutoDone && (noHand || noGest)) {
        ckAutoDone = true; ckAutoOpened++;
        ckShow(true);
        toast('帮你查一下', noHand ? '开了 9 秒还没看见你的手——把手举到画面中间试试；也可以直接用键鼠操作。'
          : '开了 15 秒还没认到任何手势——跟着自检页一行一行做一次，就知道卡在哪了。', 8);
      }
    } else camT0 = 0;
    return;
  }
  ckRender();
}
if (typeof window !== 'undefined') { window.__ckTick = ckTick; }

/* ============================== 启动 ============================== */
layout();
requestAnimationFrame(frame);

function enter(m) {
  Audio_.resume();
  $('#veil').classList.add('gone');
  $('#plays').classList.remove('show');
  started = true; mode = m;
  document.body.classList.toggle('cam', m === 'camera');   // 摄像头模式：提示卡里的"走影/捏合"改说手势话
  if (m === 'manual') { MAN.away = true; $('#hintMode').textContent = ''; }   // 键鼠提示改到影布两旁（可关），底部这一行留给临时通知
  syncHints();
}
async function camOn() {
  enter('camera');
  $('#hintMode').textContent = '正在启动摄像头…';
  try {
    if (!HT.landmarker) await HT.init();      // 回首页会关掉相机；再进来时优先复用已加载的模型
    try {
      await HT.camera();
    } catch (e1) {
      await new Promise(r => setTimeout(r, 450));   // 刚放掉的设备可能要一拍才回得来：再试一次
      await HT.camera();
    }
    $('#hintMode').textContent = '';
    camT0 = 0; ckAutoDone = false;
    return true;
  } catch (e) {
    mode = 'demo';
    $('#hintMode').textContent = '未取得摄像头 · 已切到演示模式（也可刷新后选「键盘 · 鼠标操作」）';
    return false;
  }
}

/* ---- 回首页：从演出 / 闯关 / 新手 / 任何面板都能退回开场幕，而不是把整个程序关掉 ----
   停的只是"这一轮"：台本、关卡、点板、录制、相机、手都收起来；存档、设置、皮影志一律不动。
   Home 键、右上角「⌂ 首页」、每个面板底下的「回首页」都走这一条。 */
function goHome() {
  closeMenus();
  ckShow(false);
  show.view = false;
  if (lvOn) stopLevel();
  try { if (PB.running) PB.stop(); } catch (e) {}
  try { if (beat.running) beatToggle(false); } catch (e) {}
  try { if (Rec.on) Rec.stop(); } catch (e) {}
  /* 相机要真停：不然浏览器摄像头灯一直亮着，再进也可能抢不到设备 */
  if (HT.video) {
    const v = HT.video;
    try { if (v.srcObject) v.srcObject.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { v.srcObject = null; v.pause(); } catch (e) {}   // 只 stop 不置空：元素还攥着设备，再开就拿不到（回首页→启灯会失败）
    HT.video = null;
  }
  HT.feed([], performance.now());
  MAN.away = true; MAN.extra = 0; MAN.meet = false;
  MAN.mouse.pinch = MAN.mouse.fist = false; MAN.keys.clear();
  active = []; puppets.forEach(p => { p.appear = 0; });
  curPlay = null;
  show.cue = null; show.seal = null; show.rate = null; show.bigNote = null;
  show.toast = null; show.hint = ''; show.helped = 0;
  show.state = 'wake'; warmHits = 0; tipHits = 0;
  started = false;                       // 输入与渲染都停，画布停在最后一帧，开场幕自己亮
  $('#hintMode').textContent = '';
  $('#veil').classList.remove('gone');
  renderSteps(); refreshPlay(); refreshZhi();
  try { musicFollow(); } catch (e) {}    // state 已不是 play → 文场淡出
  syncHints();
}
$('#btnHome').onclick = e => { goHome(); e.currentTarget.blur(); };
$('#playsHome').onclick = e => { goHome(); e.currentTarget.blur(); };
$('#levelsHome').onclick = e => { goHome(); e.currentTarget.blur(); };
$('#ckHome').onclick = e => { goHome(); e.currentTarget.blur(); };
$('#keysHome').onclick = e => { goHome(); e.currentTarget.blur(); };
$('#btnStart').onclick = () => camOn();
$('#btnCheck').onclick = async () => { ckShow(true); await camOn(); };
$('#ckGo').onclick = async () => { ckShow(false); if (!HT.video) await camOn(); };
$('#ckManual').onclick = () => { ckShow(false); enter('manual'); };
$('#ckClose').onclick = () => ckShow(false);
/* 键鼠一览：? 键 / 右上角「键鼠」按钮开关。只盖一层说明，不打断底下的演出；
   按钮点完就 blur —— 否则焦点留在按钮上，之后按空格起灯会顺手把面板再点开一次。 */
function toggleKeys(force) {
  const el = $('#keys'); if (!el) return;
  const on = force == null ? !el.classList.contains('show') : !!force;
  el.classList.toggle('show', on);
  syncHints();
}
/* ---- 影布两旁的键鼠提示：跟着幕布边站，可关、选择会记住 ----
   点卡上的 ✕ 或「键鼠一览」里的开关都能收起来；边距太窄（窄屏/步骤栏占位）就自动让位，
   宁可不显示也不压到幕布和影人。pointer-events:none（只有 ✕ 可点）——提示不吃鼠标，走影不受影响。 */
/* 函数声明而不是 const 箭头：启动时 layout() 会先跑一轮 syncHints，得能提前调用（提升） */
function hintKeysOn() { return store.d.hintKeys !== 0; }
function syncHints() {
  const L = $('#hintL'), R = $('#hintR');
  if (!L || !R) return;
  const on = hintKeysOn() && mode !== 'demo' && !show.view;   // 键鼠 / 摄像头两种玩法都显示（演示模式除外）
  const mgL = screen.x, mgR = VW - screen.x - screen.w;
  const wL = Math.min(176, mgL - 14), wR = Math.min(176, mgR - 14);
  const topY = Math.max(74, Math.round(screen.y) + 6);
  /* 右侧站着「当前步骤」栏时，右卡不消失、落到步骤栏底下继续站（底下放不下就挤到栏上边）。
     之前这里直接让位，默认的引导模式里右半边就永远看不见——用户问过"为什么另一半没显示"。 */
  const steps = $('#steps');
  /* 只看模式与布局（free/lv 时步骤栏是 visibility+opacity 淡出，offsetWidth 仍非 0，不能用它判）
     —— 过渡动画期间 getComputedStyle(visibility) 还是 hidden，会把刚切回引导模式的那一次算错。 */
  const stepsShown = steps && !document.body.classList.contains('free') && !document.body.classList.contains('lv');
  let rightTop = topY, rightOk = wR >= 104;
  if (stepsShown) {
    const sr = steps.getBoundingClientRect(), rh = R.offsetHeight || 214;
    if (sr.height > 4) {
      rightTop = Math.round(sr.bottom) + 8;
      if (rightTop + rh > VH - 10) {                 // 步骤栏底下放不下 → 挪到它上面
        rightTop = Math.round(sr.top) - 8 - rh;
        if (rightTop < 64) rightOk = false;          // 上下都挤 → 这一侧先收
      }
    }
  }
  const onL = on && wL >= 104;
  const onR = on && rightOk;
  L.classList.toggle('on', !!onL); R.classList.toggle('on', !!onR);
  if (onL) { L.style.width = Math.round(wL) + 'px'; L.style.left = '8px'; L.style.top = topY + 'px'; }
  if (onR) { R.style.width = Math.round(wR) + 'px'; R.style.right = '8px'; R.style.top = rightTop + 'px'; }
  const b = $('#keysHintToggle');
  if (b) b.textContent = '影布两旁提示：' + (hintKeysOn() ? '显示中（点此隐藏）' : '已隐藏（点此显示）');
}
function setHintKeys(on) {
  store.d.hintKeys = on ? 1 : 0; store.flush();
  syncHints();
}
document.querySelectorAll('[data-kh-off]').forEach(el => { el.onclick = () => setHintKeys(false); });
$('#keysHintToggle').onclick = e => { setHintKeys(!hintKeysOn()); e.currentTarget.blur(); };
syncHints();

/* ---- 菜单的统一关法：右上角 ✕ / 底部「合上」/ 点空白处 / 按任意键 ----
   上面那排按钮打开的面板（戏折子 / 闯关 / 自检 / 键鼠）都算菜单；皮影志是画在幕上的视图，也算。
   点在面板内部、或顶上那排按钮上不关（按钮自己管自己的开合）。 */
const MENU_IDS = ['plays', 'levels', 'check', 'keys'];
function menuOpen(except) {
  if (show.view && except !== 'view') return true;
  for (const id of MENU_IDS) {
    if (id === except) continue;
    const el = $('#' + id);
    if (el && el.classList.contains('show')) return true;
  }
  return false;
}
function closeMenus(except) {
  for (const id of MENU_IDS) {
    if (id === except) continue;
    const el = $('#' + id);
    if (!el || !el.classList.contains('show')) continue;
    if (id === 'check') ckShow(false);
    else if (id === 'keys') toggleKeys(false);
    else el.classList.remove('show');
  }
  if (show.view && except !== 'view') show.view = false;
  syncHints();
}
document.querySelectorAll('[data-x-close]').forEach(b => {
  b.onclick = e => { closeMenus(); e.currentTarget.blur(); };
});
/* 点空白处关菜单（捕获阶段先判：面板里、顶上那排、开场幕上的点击都放行） */
window.addEventListener('pointerdown', e => {
  if (!menuOpen()) return;
  const t = e.target;
  if (t && t.closest && t.closest('#plays,#levels,#check,#keys,#hud,#veil')) return;
  closeMenus();
}, true);
$('#btnKeys').onclick = e => { toggleKeys(); e.currentTarget.blur(); };
$('#keysClose').onclick = e => { toggleKeys(false); e.currentTarget.blur(); };
$('#btnCheck2').onclick = () => { const on = $('#check').classList.contains('show'); ckShow(!on); };
$('#ckLoosen').onclick = () => {
  const r = setRelax(Math.min(.45, relaxLevel() + .15));
  ckRender(); refreshChips();
  toast('已放宽', `判定又松了一档（当前放宽 ${Math.round(r * 100)}%）：捏不合、动得小也认。`, 6);
};
$('#btnManual').onclick = () => enter('manual');
$('#btnMode').onclick = () => setUIMode(uiMode === 'guide' ? 'free' : 'guide');
$('#btnMusic').onclick = () => setMusic();
musicOn = store.d.music !== 0;                        // 记住上次的选择
if ($('#btnMusic')) $('#btnMusic').classList.toggle('on', musicOn);
$('#btnDemo').onclick = () => { if (!curPlay) pickPlay('daohui'); enter('demo'); };

/* ---------- 戏折子：开场选戏 + 演出中换戏 ---------- */
function buildPlays() {
  const ul = $('#plays ul');
  if (!ul) return;
  const items = [{ id: '', name: '自由演', tag: '不点戏', blurb: '四个行当随你调遣，怎么走都是戏。' }]
    .concat(ALL_PLAYS.map(p => ({ id: p.id, name: p.name, tag: p.tag, blurb: p.blurb })));
  ul.innerHTML = '';
  for (const it of items) {
    const li = document.createElement('li');
    li.dataset.play = it.id;
    li.innerHTML = `<b></b><span></span><i class="done"></i><em></em>`;
    li.querySelector('b').textContent = it.name;
    li.querySelector('span').textContent = it.tag;
    li.querySelector('em').textContent = it.blurb;
    const p = findPlay(it.id);
    const rated = p && store.d.rate && store.d.rate[p.id];
    if (p && p.unlock === 'three-top' && !store.d.grand) {
      li.classList.add('locked');
      li.querySelector('.done').textContent = '未开箱';
      li.querySelector('em').textContent = '三出折子戏各唱到「上」评，班子才肯开箱唱全本。';
    } else if (rated) {
      li.querySelector('.done').textContent = `评 ${RATE_CH[rated]}`;
    }
    li.onclick = () => pickPlay(it.id);
    ul.appendChild(li);
  }
}
buildPlays();

/* ---------- 戏折子面板：头茬 / 皮料 / 流派 / 玩法 ---------- */
function beatToggle(on) {
  const want = on == null ? !beat.running : !!on;
  if (want) {
    beat.reset(); beat.start(SCHOOLS[schoolKey].pattern);
    toast(`点板 · ${PATTERNS[SCHOOLS[schoolKey].pattern].name}`,
      '鼓点起来时出手，压上板算"漂亮"；偏了影子会抖、会散。打完一句板结一次功底。', 8);
    unlock('z3');
  } else {
    beat.stop();
    toast('收板', `这一场的功底：${beat.hits} 中 · 失手 ${beat.misses}`, 6);
  }
  Music.perc(!beat.running);          // 点板时文场的板鼓让位，别跟判定互抢
  refreshChips();
}
function refreshChips() {
  /* 招式表的灯：认到过就亮 2.4 秒（面板开着时每 250ms 刷一次就够） */
  const mv = $('#moves');
  if (mv) {
    const now = show.elapsed, m = show.moves || {};
    mv.querySelectorAll('i').forEach(el => {
      const t = m[el.dataset.move] || -99;
      el.classList.toggle('on', now - t < 2.4);
    });
  }
  const bTwo = $('#btnTwo'), bBeat = $('#btnBeat');
  if (bTwo) bTwo.classList.toggle('on', twoSign);
  if (bBeat) bBeat.classList.toggle('on', beat.running);
  const cTwo = $('#chipTwo'), cBeat = $('#chipBeat');
  if (cTwo) cTwo.classList.toggle('on', twoSign);
  if (cBeat) cBeat.classList.toggle('on', beat.running);
  document.querySelectorAll('#chipsHead button').forEach(b => b.classList.toggle('on', (b.dataset.head || '') === (headWanted || '')));
  document.querySelectorAll('#chipsSkin button').forEach(b => b.classList.toggle('on', b.dataset.skin === skinKey));
  document.querySelectorAll('#chipsSchool button').forEach(b => b.classList.toggle('on', b.dataset.school === schoolKey));
  /* 手感档位：文字得跟着"自动放宽"走——buildChips 只在启动时建一次，
     那时候还没放宽，所以标记必须在这里补（否则"手感放宽了"这件事在界面上看不出来） */
  const fe = $('#chipsFeel');
  if (fe) for (const b of fe.querySelectorAll('button')) {
    const k = b.dataset.feel || '';
    b.classList.toggle('on', (store.d.feel || 'loose') === k);
    const want = (FEEL[k] ? FEEL[k].name : k) + (relaxLevel() > 0 && (store.d.feel || 'loose') === k ? ' ·已自动放宽' : '');
    if (b.textContent !== want) b.textContent = want;
  }
}
function buildChips() {
  const mk = (parent, label, on, fn, data) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (on) b.classList.add('on');
    if (data) Object.assign(b.dataset, data);
    b.onclick = () => { fn(); refreshChips(); };
    parent.appendChild(b);
    return b;
  };
  const head = $('#chipsHead'); if (head) {
    head.innerHTML = '';
    mk(head, '随行当', !headWanted, () => { headWanted = null; active.forEach(p => p.setHead(null)); }, { head: '' });
    for (const k of HEAD_ORDER) {
      const H = HEADS[k];
      mk(head, `${H.name}·${H.who}`, headWanted === k, () => {
        headWanted = k; active.forEach(p => p.setHead(k)); unlock('z6'); Audio_.clap();
        toast(`头茬 · ${H.name}`, `换头茬就换人：${H.name}（${H.who}）。一副身段配好几个头，是皮影的常规做法。`, 8);
      }, { head: k });
    }
  }
  const skin = $('#chipsSkin'); if (skin) {
    skin.innerHTML = '';
    for (const k of SKIN_ORDER) {
      const S = SKINS[k];
      mk(skin, S.name, skinKey === k, () => {
        skinKey = k; active.forEach(p => p.setSkin(k)); unlock('z8'); Audio_.ban(true);
        toast(`皮料 · ${S.name}`, S.note, 9);
      }, { skin: k });
    }
  }
  const sc = $('#chipsSchool'); if (sc) {
    sc.innerHTML = '';
    for (const k of Object.keys(SCHOOLS)) {
      mk(sc, SCHOOLS[k].name, schoolKey === k, () => setSchool(k), { school: k });
    }
  }
  const cTwo = $('#chipTwo'), cBeat = $('#chipBeat');
  if (cTwo) cTwo.onclick = () => { toggleTwoSign(); refreshChips(); };
  if (cBeat) cBeat.onclick = () => beatToggle();
  /* 手感：宽松 / 标准 / 严格（改的是手势引擎的阈值） */
  const fe = $('#chipsFeel'); if (fe) {
    fe.innerHTML = '';
    for (const k of FEEL_ORDER) mk(fe, FEEL[k].name + (relaxLevel() > 0 && (store.d.feel || 'loose') === k ? ' ·已自动放宽' : ''),
      (store.d.feel || 'loose') === k, () => setFeelUI(k), { feel: k });
  }
  const cAgain = $('#chipAgain'); if (cAgain) cAgain.onclick = () => restartPlay();
  /* 招式表：哪个招式现在能被认出来（灯亮 = 刚刚认到过） */
  const mv = $('#moves'); if (mv) {
    mv.innerHTML = '';
    for (const k of MOVE_LIST) {
      const b = document.createElement('i');
      b.dataset.move = k;
      b.textContent = MOVE_NAME[k] || k;
      mv.appendChild(b);
    }
  }
  refreshChips();
}
buildChips();
setUIMode(store.d.uiMode || 'guide', true);                      // 记住上次选的模式
setInterval(() => {
  stepLive();                                                    // 步骤栏的"认到了"灯
  ckTick();                                                      // 手势自检（每 250ms 也只在开着时算）
  const el = $('#plays'); if (el && el.classList.contains('show')) refreshChips();
}, 250);
const _bTwo = $('#btnTwo'), _bBeat = $('#btnBeat');
if (_bTwo) _bTwo.onclick = () => { toggleTwoSign(); refreshChips(); };
if (_bBeat) _bBeat.onclick = () => beatToggle();
refreshZhi();
$('#btnPlay').onclick = () => { $('#plays').classList.toggle('show'); refreshPlay(); };
$('#playsClose').onclick = () => $('#plays').classList.remove('show');
$('#btnNovice').onclick = () => enterNovice();
$('#veilNovice').onclick = () => enterNovice();
$('#btnLv').onclick = () => {
  const on = $('#levels').classList.contains('show');
  if (!on) refreshLvPanel();
  $('#levels').classList.toggle('show', !on);
};
$('#levelsClose').onclick = () => $('#levels').classList.remove('show');
$('#lvNextBtn').onclick = () => { const nid = LV.id + 1; if (LEVELS.some(v => v.id === nid)) startLevel(nid); };
$('#lvCloseBtn').onclick = () => stopLevel();
refreshLvPanel();
document.querySelectorAll('#veil .pick [data-play]').forEach(b => {
  b.onclick = () => pickPlay(b.dataset.play || '');
});
if (store.d.sel) {                                  // 上次点的那出戏记着
  const p = findPlay(store.d.sel);
  if (p) { curPlay = p; sceneKey = p.scene || 'field'; setMood(p.mood || 'lamp'); }
}
refreshPlay();
$('#btnZhi').onclick = () => { show.view = !show.view; };
$('#btnRec').onclick = () => Rec.toggle();
$('#btnFull').onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
};
bindManualInput();

const url = new URL(location.href);
if (url.searchParams.get('demo') === '1') { if (!curPlay) pickPlay('daohui'); started = true; mode = 'demo'; $('#veil').classList.add('gone'); }
if (url.searchParams.get('manual') === '1') { enter('manual'); }
if (url.searchParams.get('auto') === '1') { setTimeout(() => $('#btnDemo').click(), 60); }
if (url.searchParams.get('play')) { pickPlay(url.searchParams.get('play')); }

window.__ZD = {
  show, HT, puppets, ZHI, synthHand, store, Rec, MAN, PB, PLAYS,
  get active() { return active; },
  get mode() { return mode; },
  get play() { return curPlay; },
  get scene() { return sceneKey; },
  get mood() { return moodKey; },
  get cue() { return show.cue; },
  get wave() { return wave; },
  get beat() { return beat; },
  get two() { return twoSign; },
  get headKey() { return headWanted; },
  get skin() { return skinKey; },
  get school() { return schoolKey; },
  get warm() { return { state: show.state, hits: warmHits, tips: store.d.tips || 0 }; },
  get chips() { return { two: !!$('#btnTwo') && $('#btnTwo').classList.contains('on'), beat: !!$('#btnBeat') && $('#btnBeat').classList.contains('on') }; },
  beatToggle: on => beatToggle(on),
  beatHit: n => beat.hit(n),
  twoSig: v => { toggleTwoSign(v); refreshChips(); },
  head2: k => { headWanted = k; active.forEach(p => p.setHead(k)); if (k) unlock('z6'); refreshChips(); },
  skin2: k => { skinKey = k; active.forEach(p => p.setSkin(k)); if (k) unlock('z8'); refreshChips(); },
  school2: k => { setSchool(k); refreshChips(); },
  get music() { return { on: musicOn, playing: Music.enabled, state: Music.state(), voices: Music.voices(), vol: Music.volume, school: schoolKey, mood: moodKey }; },
  musicInfo: () => Music.info(),
  music2: v => setMusic(v),
  vol2: v => { Music.volume = v; },
  duck2: (a, s) => Music.duck(a, s),
  duckInfo: () => Music.duckInfo(),
  clothInfo: () => ({ ok: !!clothTex, w: clothTex ? clothTex.width : 0, h: clothTex ? clothTex.height : 0, for: clothFor }),
  audioBus: () => ({ hasMaster: !!Audio_.bus().master, tracks: (Audio_.stream() ? Audio_.stream().getAudioTracks().map(t => t.readyState) : []) }),
  warmup: () => { warmHits = 5; warmupHit('test'); },
  get hand() {
    return HT.slots.map(s => ({ present: s.present, label: s.label, charge: +(s.charge || 0).toFixed(2), x: +s.x.toFixed(3), y: +s.y.toFixed(3), mode: s.mode }));
  },
  get feel() { return { key: store.d.feel, name: FEEL[store.d.feel] ? FEEL[store.d.feel].name : '' }; },
  feel2: k => setFeelUI(k),
  again2: () => restartPlay(),
  get aud() { return show.aud == null ? .5 : show.aud; },
  get rate() { return show.rate || null; },
  get assist() { return { on: PB.assist, helped: PB.helped || 0, paused: PB.paused }; },
  feedHands: lms => HT.feed(lms, performance.now()),
  /* 合成摄像头：验收/演示用（fn(t秒) 返回这一帧的手），与真摄像头走同一条 feed 通路 */
  fake: fn => { fakeCam = fn || null; },
  get moves() { return Object.assign({}, show.moves || {}); },
  clearMoves: () => { show.moves = {}; },
  mark2: n => mark(n),
  get ui() { return uiMode; },
  ui2: (m, quiet) => setUIMode(m, quiet),
  camOn: () => camOn(),
  started: () => started,
  cm: () => checkMoves(),
  cools: () => ({ wave: +wave.cool.toFixed(2), chop: +chop.cool.toFixed(2) }),
  check: (v, fresh) => ckShow(v, fresh),
  bright: () => ckBright(),
  relaxGet: () => relaxLevel(),
  tune: () => { const t = tune(); return { name: t.name, pinchClose: +t.pinchClose.toFixed(3), waveD: +t.waveD.toFixed(3), kickD: +t.kickD.toFixed(3), lostAfter: +t.lostAfter.toFixed(3), meetDist: +t.meetDist.toFixed(3) }; },
  relaxSet: r => { const v = setRelax(r); ckRender(); refreshChips(); return v; },
  get ck() {
    const rows = [...document.querySelectorAll('#ckGest li')].map(li => ({
      g: li.dataset.g, on: li.firstElementChild.className.includes('on')
    }));
    const t = id => (document.getElementById(id) || {}).textContent || '';
    return {
      open: document.getElementById('check').classList.contains('show'),
      cam: t('ckCam'), light: t('ckLight'), hands: t('ckHands'), tip: t('ckTip'),
      bright: ckBright(), relax: relaxLevel(), rows,
      got: rows.filter(r => r.on).length,
      ticks: ckTickN, autoOpened: ckAutoOpened, everHand: ckEverHand, anyGest: ckAnyGest
    };
  },
  get lv() {
    return {
      on: lvOn, id: LV.id, name: LV.name, note: LV.note, time: LV.time,
      left: +LV.left.toFixed(1), helped: LV.helped, rank: LV.rank,
      running: LV.running, finished: LV.finished, progress: LV.progress, tasks: LV.tasks
    };
  },
  levels: LEVELS,
  lvRun: () => LV,
  startLevel: id => startLevel(id),
  stopLevel: () => stopLevel(),
  levelPanel: v => {
    if (v == null) $('#levels').classList.toggle('show');
    else $('#levels').classList.toggle('show', !!v);
    if ($('#levels').classList.contains('show')) refreshLvPanel();
    return $('#levels').classList.contains('show');
  },
  get levelDone() { return Object.assign({}, (store.d.level && store.d.level.done) || {}); },
  get levelRows() {
    return [...document.querySelectorAll('#levels li')].map(li => ({
      t: (li.querySelector('b') || {}).textContent || '',
      note: (li.querySelector('em') || {}).textContent || '',
      locked: li.classList.contains('locked'),
      done: (li.querySelector('s') || {}).textContent || ''
    }));
  },
  novice: () => enterNovice(),
  get noviceInfo() {
    const c = (curPlay && curPlay.novice && PB.running) ? PB.cue : null;
    return {
      mode: uiMode, play: curPlay ? curPlay.id : '', seg: c ? c.n : '',
      reps: PB.reps, repeat: c ? (c.repeat || 1) : 1, helped: PB.helped || 0,
      big: show.bigNote ? show.bigNote.text : ''
    };
  },
  get cards() { return (show.cards || []).length; },
  clearCards: () => { show.cards = []; },
  unlock2: id => unlock(id),
  wipe: () => { try { localStorage.removeItem('zhangdeng.v1'); } catch (e) {} location.reload(); },
  get steps() {
    const box = $('#steps'), list = $('#stepList');
    return {
      mode: uiMode,
      free: document.body.classList.contains('free'),
      visible: (() => {
        if (!box) return false;
        const cs = getComputedStyle(box), r = box.getBoundingClientRect();
        return cs.visibility !== 'hidden' && Number(cs.opacity) > .05 && r.width > 8;   // 固定定位元素的 offsetParent 恒为 null，别用它判可见
      })(),
      count: ($('#stepsCount') || {}).textContent || '',
      now: ($('#stepNow') || {}).textContent || '',
      need: ($('#stepNeed') || {}).textContent || '',
      done: [...document.querySelectorAll('#stepList li.done')].length,
      rows: [...document.querySelectorAll('#stepList li')].map(li => ({ t: li.textContent, now: li.classList.contains('now'), done: li.classList.contains('done') })),
      ok: !!(($('#stepOk') || {}).hidden === false),
      hand: (() => { const cv = $('#stepsHand'); if (!cv) return 0; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n; })()
    };
  },
  trailInfo: () => HT.slots.map(s => {
    if (!s.present || !s.trail || s.trail.length < 2) return { present: s.present, n: s.trail ? s.trail.length : 0 };
    let mnx = 1, mxx = 0, mny = 1, mxy = 0;
    for (const h of s.trail) { mnx = Math.min(mnx, h.rx); mxx = Math.max(mxx, h.rx); mny = Math.min(mny, h.ry); mxy = Math.max(mxy, h.ry); }
    return {
      n: s.trail.length, dx: +(mxx - mnx).toFixed(3), dy: +(mxy - mny).toFixed(3),
      dir: +(s.trail[s.trail.length - 1].ry - s.trail[0].ry).toFixed(3),
      ry0: +s.trail[0].ry.toFixed(3), ry1: +s.trail[s.trail.length - 1].ry.toFixed(3),
      ry: +s.y.toFixed(3), win: +(s.trail[s.trail.length - 1].t - s.trail[0].t).toFixed(2)
    };
  }),
  get cools() { return { wave: +wave.cool.toFixed(2), chop: +chop.cool.toFixed(2), wallDt: +wallDt.toFixed(3), feel: store.d.feel }; },
  synth: (cx, cy, sc, curl, pinch, rot) => synthHand(cx, cy, sc, curl, pinch, rot),
  get log() { return eventLog.slice(-60); },
  clearLog: () => { eventLog.length = 0; },
  tip: () => tipHit(),
  swing: n => { active.forEach(p => p.flickPlume(1.5)); PB.action(n || 'wave'); },
  demoPose: () => demoHands(0, 0),
  get screen() { return screen; },
  get lamp() { return lamp.v; },
  drawTheatreNow: () => drawTheatre(ctx, screen, show.elapsed, 1),
  pick: id => pickPlay(id),
  action: n => PB.action(n),
  nextCue: () => PB.next(),
  setScene: (sc, mo) => { sceneKey = sc; if (mo) setMood(mo); },
  setRole: k => { puppets[0].setRole(k); puppets[0].appear = 1; },
  freeze: v => { freeze = !!v; },
  pose: (x, y, depth) => { puppets[0].x = x; puppets[0].y = y; puppets[0].depth = depth; },
  setMode: m => { enter(m); },
  key: (k, down) => { if (mode !== 'manual') enter('manual'); MAN.keys[down ? 'add' : 'delete'](k); },
  clear: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
};
