/* ============================================================================
   《掌灯》文场 —— 全离线合成的皮影伴奏
   ----------------------------------------------------------------------------
   三样乐器全部现场合成，不引用任何现成唱腔/乐曲录音（曲牌为原创五声调式）：
     · 板胡/二胡：锯齿波 + 低通 + 揉弦 + 入音滑音
     · 月琴/琵琶：噪声激励 + 带通 + 短促衰减（近似拨弦）
     · 大阮低音：正弦慢起，每两小节一个根音
     · 板鼓：极短的带通噪声，只在强拍轻轻点一下
   三个流派的曲牌各不同（唐山 · 乐亭调 / 华县 · 碗碗腔 / 泰山 · 十不闲），
   灯色（灯/火/月/暮）改速度与音区；谢幕叫好、锣鼓点、点板时自动让路（duck）。
   ============================================================================ */

const PENTA = [0, 2, 4, 7, 9];                 // 五声（宫调式：宫 商 角 徵 羽）
const deg2semi = d => {                         // 5~9 表示高八度
  const oct = Math.floor(d / 5), i = ((d % 5) + 5) % 5;
  return PENTA[i] + 12 * oct;
};

export const TUNES = {
  tangshan: {
    name: '唐山 · 乐亭调', root: 62, bpm: 92, perc: [1, 0, 1, 0], oct: 0,
    mel: [
      [5, 1], [4, 1], [2, 1], [4, 1], [5, 2], [4, 2],
      [2, 1], [4, 1], [5, 1], [7, 1], [5, 3], [null, 1],
      [4, 1], [2, 1], [4, 1], [5, 1], [7, 2], [5, 2],
      [4, 1], [2, 1], [0, 2], [2, 4]
    ],
    pluck: [[0, 1], [4, 1], [2, 1], [4, 1]]
  },
  huaxian: {
    name: '华县 · 碗碗腔', root: 58, bpm: 72, perc: [1, 0, 0, 0], oct: 1,
    mel: [
      [2, 2], [4, 2], [5, 3], [4, 1], [2, 2], [0, 2],
      [4, 4], [5, 2], [7, 2], [5, 2], [4, 2],
      [2, 2], [0, 2], [2, 4],
      [0, 2], [2, 2], [4, 2], [2, 2], [0, 4]
    ],
    pluck: [[0, 2], [4, 1], [5, 1]]
  },
  taishan: {
    name: '泰山 · 十不闲', root: 65, bpm: 112, perc: [1, 1, 0, 1], oct: 0,
    mel: [
      [0, .5], [2, .5], [4, 1], [5, .5], [4, .5], [2, 1], [4, 1], [5, 1], [7, 1],
      [5, .5], [4, .5], [2, 1], [0, 1], [2, 2], [4, 1], [2, 1], [0, 2],
      [4, .5], [5, .5], [7, 1], [5, 1], [4, .5], [2, .5], [4, 1], [2, 1],
      [0, 2], [4, 2], [5, 2], [0, 2]
    ],
    pluck: [[0, .5], [4, .5], [2, .5], [4, .5], [0, .5], [4, .5], [7, .5], [4, .5]]
  }
};

/* 灯色：速度倍率 / 音区 / 亮度（月=清冷稍慢，火=急促，暮=沉一倍） */
const MOOD_TUNE = {
  lamp: { spd: 1.00, oct: 0, cut: 4200, gain: 1.00 },
  fire: { spd: 1.12, oct: 0, cut: 5000, gain: 1.06 },
  moon: { spd: .88, oct: -1, cut: 3000, gain: .92 },
  dusk: { spd: .80, oct: -1, cut: 2400, gain: .88 }
};

export function createMusic(getBus) {
  let ac = null, master = null, bus = null;     // bus = 伴奏自己的总线（便于整体 duck）
  let on = false, timer = null, nextT = 0, step = 0, bar = 0;
  let schoolKey = 'tangshan', moodKey = 'lamp', percOn = true;
  let duckGain = 1, duckUntil = 0, voices = 0;

  const tune = () => TUNES[schoolKey] || TUNES.tangshan;
  const mood = () => MOOD_TUNE[moodKey] || MOOD_TUNE.lamp;
  const freq = deg => 440 * Math.pow(2, (tune().root + tune().oct * 12 + mood().oct * 12 + deg2semi(deg) - 69) / 12);

  function ctx() {
    if (!ac) { const b = getBus(); ac = b.ac; master = b.master; }
    if (!bus) { bus = ac.createGain(); bus.gain.value = .0001; }
    try { ac.resume(); } catch (e) {}             // 首帧可能在 suspended，醒来后自己会接上
    return ac;
  }

  /* ---------- 板胡：揉弦 + 入音滑音 ---------- */
  function bowed(f, t, dur, gain) {
    const c = ac, o1 = c.createOscillator(), o2 = c.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'sawtooth';
    o1.frequency.setValueAtTime(f * .94, t);
    o1.frequency.exponentialRampToValueAtTime(f, t + .07);      // 入音
    o2.frequency.setValueAtTime(f * 1.004, t);                  // 微失谐，厚一点
    const vib = c.createOscillator(), vg = c.createGain();
    vib.frequency.value = 5.4; vg.gain.value = f * .007;
    vib.connect(vg); vg.connect(o1.frequency);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(mood().cut, f * 5.5); lp.Q.value = .8;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gain, t + .055);
    env.gain.setValueAtTime(gain * .92, t + dur * .62);
    env.gain.exponentialRampToValueAtTime(.0001, t + dur + .12);
    o1.connect(lp); o2.connect(lp); lp.connect(env); env.connect(bus);
    o1.start(t); o2.start(t); vib.start(t);
    o1.stop(t + dur + .16); o2.stop(t + dur + .16); vib.stop(t + dur + .16);
    voices++;
    setTimeout(() => { voices--; }, (dur + .3) * 1000);
  }

  /* ---------- 月琴/琵琶：拨弦 ---------- */
  function pluck(f, t, gain) {
    const c = ac, n = Math.max(1, Math.floor(c.sampleRate * .16));
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 7);
    const s = c.createBufferSource(); s.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2.1; bp.Q.value = 7;
    const g = c.createGain(); g.gain.value = gain;
    const tri = c.createOscillator(); tri.type = 'triangle'; tri.frequency.value = f;
    const tg = c.createGain();
    tg.gain.setValueAtTime(gain * .45, t); tg.gain.exponentialRampToValueAtTime(.0001, t + .24);
    s.connect(bp); bp.connect(g); g.connect(bus);
    tri.connect(tg); tg.connect(bus);
    s.start(t); tri.start(t); tri.stop(t + .28);
  }

  /* ---------- 板鼓：强拍轻点 ---------- */
  function tap(t, gain) {
    const c = ac, n = Math.max(1, Math.floor(c.sampleRate * .05));
    const buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 2.4;
    const g = c.createGain(); g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(bus); s.start(t);
  }

  function drone(t, beats) {
    const c = ac, dur = beats * 60 / (tune().bpm * mood().spd);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.value = freq(bar % 4 === 0 ? 0 : 4) / 2;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.075, t + dur * .3);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + .05);
  }

  /* ---------- 调度：八分音符一拍一格，提前 0.35s 排好 ---------- */
  let melIdx = 0, melLeft = 0, pluckIdx = 0, beat = 0;

  function scheduleStep(t) {
    const T = tune(), M = mood();
    const half = 60 / (T.bpm * M.spd) / 2;         // 八分音符时长
    if (melLeft <= 0) {                            // 取下一个旋律音
      let guard = 0;
      do {
        const m = T.mel[melIdx % T.mel.length];
        melIdx++; guard++;
        melLeft = Math.max(.5, m[1] * 2);          // 拍 → 八分音符数
        if (m[0] !== null) { bowed(freq(m[0]), t, Math.max(.18, m[1] * 60 / (T.bpm * M.spd) * .92), .10 * M.gain); break; }
      } while (guard < 8);
    }
    melLeft--;
    if (beat % 2 === 0) {                          // 伴奏每拍一拨
      const p = T.pluck[pluckIdx % T.pluck.length]; pluckIdx++;
      pluck(freq(p[0]) * 2, t, .035 * M.gain);
    }
    if (percOn && beat % 4 === 0) { const k = (bar + 1) % 4; if (T.perc[k]) tap(t, .05); }
    beat++;
    if (beat % 8 === 0) {                          // 每小节（4/4 两小节）一个低音
      drone(t, 8); bar++;
    }
    return half;
  }

  function tick() {
    if (!on || !ac) return;
    if (ac.state === 'suspended') return;          // 等手势解锁
    if (nextT < ac.currentTime - .5) nextT = ac.currentTime + .06;   // 被节流后重新对齐
    let guard = 0;
    while (nextT < ac.currentTime + .35 && guard++ < 64) nextT += scheduleStep(nextT);
  }

  function rampHold() { return ac.currentTime < duckUntil ? duckGain : 1; }

  return {
    get enabled() { return on; },
    buses() { return { bus, master }; },
    voices() { return voices; },
    state() { return ac ? ac.state : 'none'; },
    /* 给验收/调试看的一眼状态 */
    info() {
      const T = tune(), M = mood();
      return {
        school: T.name, bpm: Math.round(T.bpm * M.spd), root: T.root, oct: T.oct + M.oct,
        mel: T.mel.length, pluck: T.pluck.length, perc: percOn, mood: moodKey,
        on, vol: this._vol, gain: bus ? bus.gain.value : 0, beats: beat
      };
    },
    duckInfo() { return { amount: duckGain, left: ac ? Math.max(0, duckUntil - ac.currentTime) : 0 }; },
    school(k) { if (TUNES[k]) { schoolKey = k; } },
    mood(k) { moodKey = MOOD_TUNE[k] ? k : 'lamp'; },
    perc(v) { percOn = !!v; },
    /* 锣鼓/叫好/点板时让路：1.6 秒内压低，再淡回 */
    duck(amount = .45, sec = 1.6) {
      if (!on || !ac) return;
      duckGain = amount; duckUntil = ac.currentTime + sec;
      const t = ac.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(Math.max(.0001, this._vol * amount), t);
      bus.gain.linearRampToValueAtTime(this._vol, duckUntil);
    },
    _vol: .19,
    set volume(v) {
      this._vol = Math.max(0, Math.min(.6, v));
      if (bus) bus.gain.setTargetAtTime(on ? this._vol * rampHold() : .0001, ac.currentTime, .12);
    },
    get volume() { return this._vol; },
    start() {
      ctx();
      bus.connect(master);
      on = true;
      const t = ac.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(Math.max(.0001, bus.gain.value), t);
      bus.gain.linearRampToValueAtTime(this._vol, t + 2.2);       // 慢慢淡入，别吓人
      nextT = t + .1; step = 0; beat = 0; bar = 0; melIdx = 0; melLeft = 0;
      if (timer) clearInterval(timer);
      timer = setInterval(tick, 120);
    },
    stop(fade = 1.6) {
      on = false;
      if (timer) { clearInterval(timer); timer = null; }
      if (bus && ac) {
        const t = ac.currentTime;
        bus.gain.cancelScheduledValues(t);
        bus.gain.setValueAtTime(Math.max(.0001, bus.gain.value), t);
        bus.gain.linearRampToValueAtTime(.0001, t + fade);
      }
    },
    toggle() { on ? this.stop() : this.start(); return on; }
  };
}
