/* 《掌灯》闯关 —— 十二关，由易到难；关名与释义都取皮影行话。
   判定直接坐在「自由模式」的手势识别上：做出来就算，不靠步骤栏提示。
   每关有时限；0 帮衬评「上」，1 次评「中」，两次以上或超时评「下」（超时也算过，不卡人）。
   这一层不碰 DOM、不放声音：进度 / 帮衬 / 评级都在这里算，画面与存档由 app.js 接。 */

export const RANK_CH = { up: '上', mid: '中', down: '下' };
export const RANK_V = { down: 0, mid: 1, up: 2 };

/* 每关一句原创释义（只讲一句行话，不编史实）；
   zhi = 打通这关点亮哪条皮影志；twoSign / beat / cast = 这关要在台上先摆出什么阵仗。
   任务类型：act 认到某个手势 / pan 连续走影（秒）/ beat 压上鼓点 / arm 提臂 / cast 同台人数 */
export const LEVELS = [
  { id: 1, name: '一签定身', time: 45, zhi: 'z1',
    note: '一根主签插在影人背后——先学会把它「定」在台上。',
    tasks: [{ k: 'act', key: 'open', n: '张掌起灯', need: 1 }] },
  { id: 2, name: '走影三丈', time: 44,
    note: '签子不离手，影人在幕上走三丈远，行话叫「走影」。',
    tasks: [{ k: 'pan', n: '走影', need: 3 }] },
  { id: 3, name: '挑签', time: 43, zhi: 'z2',
    note: '两根指头把签子挑起来，影人便抬手、拾物。',
    tasks: [{ k: 'act', key: 'pinch', n: '捏合', need: 2 }] },
  { id: 4, name: '攥住那根签', time: 42,
    note: '攥紧签子，影人定住亮相，戏才稳得住。',
    tasks: [{ k: 'act', key: 'fist', n: '攥拳', need: 2 }] },
  { id: 5, name: '翻个面', time: 41, zhi: 'z6',
    note: '手一翻，影人就翻个面——一个人变另一个人。',
    tasks: [{ k: 'act', key: 'turn', n: '翻手', need: 2 }] },
  { id: 6, name: '一记横扫', time: 40,
    note: '横扫叫「换势」：影人拖着一阵风换到台口。',
    tasks: [{ k: 'act', key: 'wave', n: '横扫', need: 2 }] },
  { id: 7, name: '脚底下见功夫', time: 39,
    note: '下砸是影人的踢腿、踉跄——力气得真往下走。',
    tasks: [{ k: 'act', key: 'kick', n: '下砸', need: 2 }] },
  { id: 8, name: '腾起', time: 38,
    note: '上挑，影人离地腾起；签要提得干净利落。',
    tasks: [{ k: 'act', key: 'raise', n: '上挑', need: 2 }] },
  { id: 9, name: '两影搭腔', time: 37, zhi: 'z5',
    note: '两只影人凑到一块，戏才有来有回。',
    tasks: [{ k: 'act', key: 'meet', n: '两手靠近', need: 1 }] },
  { id: 10, name: '三根签', time: 36, twoSign: true,
    note: '一手主签定身、一手手签提臂——皮影幕后真正的「三根签」。',
    tasks: [{ k: 'pan', n: '两签走影', need: 2, two: true }, { k: 'arm', n: '提臂', need: 1 }] },
  { id: 11, name: '跟着板走', time: 35, beat: true, zhi: 'z3',
    note: '七紧八慢九消停：出手要压在鼓点上。',
    tasks: [{ k: 'beat', n: '对板', need: 3 }] },
  { id: 12, name: '满台彩', time: 34, cast: 4, zhi: 'z7',
    note: '四个人影同台：对戏、亮相，满台都是戏。',
    tasks: [{ k: 'cast', n: '四人同台', need: 1 }, { k: 'act', key: 'meet', n: '对戏', need: 1 }, { k: 'act', key: 'fist', n: '亮相', need: 1 }] }
];

/* 第 N 关要先有第 N-1 关的成绩；第一关永远开着 */
export function levelUnlocked(id, done) {
  if (id <= 1) return true;
  return !!((done || {})[String(id - 1)]);
}
export function betterRank(a, b) { return (RANK_V[b] || 0) > (RANK_V[a] || 0) ? b : a; }

/* 关内引擎：每帧收 dt，手势名、走影、对板、同台人数，攒进度；到点结算评级 */
export function createLevelRun(hooks = {}) {
  const H = { start: () => {}, help: () => {}, done: () => {}, ...hooks };
  let lv = null, left = 0, helped = 0, stuck = 0, done = false, rank = null, tasks = [];
  const api = {
    get level() { return lv; },
    get id() { return lv ? lv.id : 0; },
    get name() { return lv ? lv.name : ''; },
    get note() { return lv ? lv.note : ''; },
    get time() { return lv ? lv.time : 0; },
    get left() { return Math.max(0, left); },
    get helped() { return helped; },
    get running() { return !!lv && !done; },
    get finished() { return !!lv && done; },
    get rank() { return rank; },
    get tasks() {
      return tasks.map(t => ({ k: t.k, key: t.key, two: !!t.two, n: t.n, need: t.need, done: Math.min(t.need, (t.k === 'pan' || t.k === 'arm') ? Math.floor(t.done) : t.done) }));
    },
    get progress() { return api.tasks.map(t => t.n + ' ' + t.done + '/' + t.need).join(' · '); },
    get allDone() { return tasks.length > 0 && tasks.every(t => t.done >= t.need); },
    start(id) {
      lv = LEVELS.find(v => v.id === id) || null;
      if (!lv) return null;
      left = lv.time; helped = 0; stuck = 0; done = false; rank = null;
      tasks = lv.tasks.map(t => ({ k: t.k, key: t.key, n: t.n, need: t.need, two: !!t.two, done: 0 }));
      H.start(lv);
      return lv;
    },
    stop() { lv = null; tasks = []; done = false; rank = null; helped = 0; stuck = 0; left = 0; },
    act(name) {
      if (!api.running) return;
      for (const t of tasks) if (t.k === 'act' && t.key === name && t.done < t.need) { t.done++; stuck = 0; }
      step();
    },
    pan(dt, two) {
      if (!api.running) return;
      for (const t of tasks) if (t.k === 'pan' && (!t.two || two) && t.done < t.need) { t.done = Math.min(t.need, t.done + dt); stuck = 0; }
      step();
    },
    arm() {
      if (!api.running) return;
      for (const t of tasks) if (t.k === 'arm' && t.done < t.need) { t.done++; stuck = 0; }
      step();
    },
    beat() {
      if (!api.running) return;
      for (const t of tasks) if (t.k === 'beat' && t.done < t.need) { t.done++; stuck = 0; }
      step();
    },
    cast(n) {
      if (!api.running) return;
      for (const t of tasks) if (t.k === 'cast' && n >= (lv.cast || 4) && t.done < t.need) { t.done++; stuck = 0; }
      step();
    },
    tick(dt) {
      if (!api.running) return;
      left -= dt; stuck += dt;
      /* 帮一把：卡够久就替你把头一个没做完的目标记上一格——照实记一次帮衬 */
      if (stuck > (lv.assistAfter || 6)) {
        const t = tasks.find(x => x.done < x.need);
        if (t) { helped++; t.done = Math.min(t.need, (t.k === 'pan' || t.k === 'arm') ? Math.floor(t.done) + 1 : t.done + 1); stuck = 0; H.help(t); }
      }
      if (left <= 0) { api.finish(true); return; }
      step();
    },
    finish(timeout) {
      if (!lv || done) return;
      done = true;
      const bad = !!timeout || helped >= 2;
      rank = bad ? 'down' : helped === 1 ? 'mid' : 'up';
      H.done(lv, { rank: rank, helped: helped, timeout: !!timeout });
    }
  };
  function step() { if (api.running && api.allDone) api.finish(false); }
  return api;
}
