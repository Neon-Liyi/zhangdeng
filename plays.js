/* 《掌灯》戏折子 —— 折子戏（每一出 = 若干"幕"，每一幕都由一个手势推进）
   台本/台词/幕序全部原创撰写；字幕走 hooks.subtitle，锣鼓走 hooks.sfx。
   一幕 = { n:幕名, need:触发手势（可给多个，做一个就算过）, hint:提示, say:台词,
            sfx:锣鼓, act:影人反应, hold:自动过幕秒数, scene/mood:换景 } */

export const PLAYS = [
  {
    id: 'daohui', name: '刀会', tag: '武戏 · 一折', scene: 'city', mood: 'fire',
    prop: 'blade', cast: ['jing', 'sheng'], seal: '刀会',
    blurb: '城楼之下，花脸与文生各持兵器，一记对招定高低。',
    cues: [
      { n: '出将', need: 'enter', hint: '把手伸向灯 · 出将', say: '净：来将通名！', sfx: 'gong', act: 'enter' },
      { n: '搭腔', need: ['meet', 'wave', 'fist'], hint: '双手靠近 / 挥手 · 搭腔', say: '生：某家来也——', sfx: 'drum' },
      { n: '对招', need: ['meet', 'fist', 'pinch'], hint: '双手再靠近 / 握拳 · 对招', say: '看刀！', sfx: 'gong', act: 'clash' },
      { n: '踢腿', need: ['kick', 'meet', 'fist'], hint: '手往下砸 · 踢腿', say: '一脚踹出，台板都响。', sfx: 'drum', act: 'kick' },
      { n: '翻身', need: ['turn', 'flip', 'raise'], hint: '把手翻过来 · 翻身', say: '翻身一亮相——靠旗不带乱的。', sfx: 'gong', act: 'flip' },
      { n: '换势', need: ['wave', 'turn', 'fist'], hint: '挥手横扫 · 换势', say: '一记横扫，满台都是风。', sfx: 'drum', act: 'swing' },
      { n: '收势', need: ['pinch', 'meet', 'fist'], hint: '捏合 / 双手靠近 · 收势', say: '好一个对手，改日再会。', sfx: 'clap', act: 'bow' },
      { n: '谢幕', need: 'hold', hold: 2.6, hint: '', say: '谢幕 · 《刀会》', sfx: 'applause', act: 'bow' }
    ]
  },
  {
    id: 'shizhuo', name: '拾镯', tag: '做工 · 一折', scene: 'yard', mood: 'moon',
    prop: 'sleeve', cast: ['dan'], seal: '拾镯',
    blurb: '月下庭院，青衣一段水袖与一只玉镯的做工戏。',
    cues: [
      { n: '出将', need: 'enter', hint: '把手伸向灯 · 出将', say: '旦：月色正好，且到庭前走走。', sfx: 'gong', act: 'enter' },
      { n: '水袖', need: ['raise', 'wave', 'flip'], hint: '抬手上挑 / 挥手 · 抛水袖', say: '水袖一抛，半台都是风。', sfx: 'drum', act: 'swing' },
      { n: '拾镯', need: ['pinch', 'fist'], hint: '捏合 / 握拳 · 拾镯', say: '咦——地上何物？', sfx: 'chime', act: 'bow' },
      { n: '戴镯', need: ['pinch', 'fist', 'meet'], hint: '捏合 / 握拳 · 戴上', say: '戴上正好。', sfx: 'chime', act: 'bow' },
      { n: '谢幕', need: 'hold', hold: 2.4, hint: '', say: '谢幕 · 《拾镯》', sfx: 'applause', act: 'bow' }
    ]
  },
  {
    id: 'modao', name: '磨刀', tag: '滑稽 · 一折', scene: 'bridge', mood: 'dusk',
    prop: 'basket', cast: ['chou'], seal: '磨刀',
    blurb: '小桥头一声吆喝，丑角靠一记踉跄拿住满台的笑。',
    cues: [
      { n: '出将', need: 'enter', hint: '把手伸向灯 · 出将', say: '丑：磨剪子嘞——戗菜刀！', sfx: 'gong', act: 'enter' },
      { n: '磨刀', need: ['pinch', 'wave', 'fist'], hint: '捏合 / 挥手 · 磨刀', say: '霍霍霍……霍霍！', sfx: 'drum', act: 'swing' },
      { n: '踉跄', need: ['fist', 'kick', 'pinch'], hint: '握拳 / 手往下砸 · 摔个踉跄', say: '哎哟——', sfx: 'clap', act: 'fall' },
      { n: '挽尊', need: ['pinch', 'meet', 'fist'], hint: '捏合 / 双手靠近 · 作揖', say: '见笑见笑。', sfx: 'chime', act: 'bow' },
      { n: '谢幕', need: 'hold', hold: 2.4, hint: '', say: '谢幕 · 《磨刀》', sfx: 'applause', act: 'bow' }
    ]
  }
];

/* 师父带徒弟：一出"教戏"——每一幕都先示范，观众跟着做，限时八秒。
   六个动作按"手做什么 ↔ 影人做什么"一一对应，好记也好做。 */
export const TEACH = {
  id: 'xuexi', name: '拜师', tag: '学戏 · 一折', scene: 'field', mood: 'lamp',
  prop: 'fan', cast: ['sheng'], seal: '出师', learn: true, win: 9,
  blurb: '老艺人教徒弟，先不让唱，只让举签——六个动作，一个一个跟着做，每一下都对应影人身上的一处。',
  cues: [
    { n: '挑签', need: ['pinch'], hint: '两指捏合（像捏住一根签子）', say: '师父：先学捏。两根指头一捏，就像捏住了那根签子——影人会拱手、会拾东西。', teach: 'pinch' },
    { n: '换面', need: ['turn'], hint: '把手翻过来（掌心翻个面）', say: '师父：手翻过来，影人就翻个面。一个人变另一个人，靠的就是这一下。', teach: 'turn' },
    { n: '搭腔', need: ['meet', 'wave'], hint: '两只手靠近（像两个影人凑到一块）', say: '师父：两只手要靠得上。两影一搭腔，戏才有来有回。', teach: 'meet' },
    { n: '换势', need: ['wave', 'fist'], hint: '横着扫一下（带起一阵风）', say: '师父：手一横扫，满台的风都是你的——换势、抛袖都是它。', teach: 'wave', act: 'plume' },
    { n: '踢腿', need: ['kick', 'fist'], hint: '手往下砸（力气往下走）', say: '师父：手往下砸，就是踢腿。武戏的力气都从这儿来。', teach: 'kick' },
    { n: '腾空', need: ['raise', 'flip'], hint: '手往上挑（把影人挑上去）', say: '师父：手往上挑，影人就腾起来——水袖、跃起，都是往上走。', teach: 'raise' },
    { n: '谢幕', need: 'hold', hold: 2.6, hint: '', say: '出师 · 这六下你都会了', sfx: 'applause' }
  ]
};

/* 大戏：三出折子戏都拿到"上"评才开箱（一出串起四行当、三处景、十二幕） */
export const GRAND = {
  id: 'daxi', name: '灯影还魂', tag: '大戏 · 全本', scene: 'field', mood: 'lamp',
  prop: 'fan', cast: ['sheng', 'dan', 'jing', 'chou'], seal: '还魂',
  unlock: 'three-top', grand: true,
  blurb: '三出折子戏都唱到"上"，班子才肯开箱唱全本：生旦净丑轮番上台，灯影里把一出大戏走完。',
  cues: [
    { n: '开箱', need: 'enter', hint: '把手伸向灯 · 开箱', say: '班主：灯影还魂——今夜唱全本。', sfx: 'nacao', act: 'enter', scene: 'field', mood: 'lamp' },
    { n: '生 · 赶考', need: ['wave', 'pinch'], hint: '挥手 / 捏合 · 生角上路', say: '生：一肩书箱，两袖清风。', sfx: 'drum', act: 'swing' },
    { n: '生 · 折柳', need: ['raise', 'flip'], hint: '手往上挑 · 折柳别友', say: '柳条一折，前程未卜。', sfx: 'chime', act: 'bow', scene: 'bridge', mood: 'dusk' },
    { n: '旦 · 倚楼', need: ['pinch', 'fist'], hint: '捏合 / 握拳 · 倚楼望', say: '旦：月照西楼，人影不见。', sfx: 'geng', act: 'bow', scene: 'yard', mood: 'moon' },
    { n: '旦 · 抛袖', need: ['wave', 'raise'], hint: '挥手 / 手往上挑 · 抛袖', say: '一袖抛出去，半台夜色都动了。', sfx: 'drum', act: 'swing', scene: 'yard', mood: 'moon' },
    { n: '净 · 登场', need: ['turn', 'fist', 'kick'], hint: '把手翻过来 · 净角登场', say: '净：呔！何人夜半过城？', sfx: 'gong', act: 'clash', scene: 'city', mood: 'fire' },
    { n: '净 · 对刀', need: ['meet', 'fist'], hint: '双手靠近 · 对刀', say: '刀来刀往，火星子溅在幕布上。', sfx: 'gong', act: 'clash' },
    { n: '净 · 踢腿', need: ['kick', 'flip'], hint: '手往下砸 · 踢腿', say: '一脚扫开去路。', sfx: 'drum', act: 'kick' },
    { n: '丑 · 打岔', need: ['pinch', 'fist'], hint: '捏合 / 握拳 · 丑角打岔', say: '丑：慢来慢来——先吃碗面再打？', sfx: 'clap', act: 'fall' },
    { n: '丑 · 收场', need: ['meet', 'pinch'], hint: '双手靠近 · 作揖收场', say: '丑：灯要灭了，戏要散了。', sfx: 'chime', act: 'bow', scene: 'field', mood: 'lamp' },
    { n: '合台', need: ['turn', 'flip', 'raise'], hint: '把手翻过来 / 往上挑 · 四影合台', say: '生旦净丑，一台人。', sfx: 'gong', act: 'flip' },
    { n: '谢幕', need: 'hold', hold: 3.2, hint: '', say: '谢幕 · 《灯影还魂》', sfx: 'applause', act: 'bow' }
  ]
};

/* 开箱 · 新手戏：先教会，再放人上台。
   别的折子是「演出」，这一折是「教学」——三段：起灯（张掌一次，灯亮影人登场）
   → 学四手（捏合 / 攥拳 / 翻手 / 横扫，每一手做满两次才算学会）→ 亮个相（连起来演，落印）。
   幕上带 repeat 的，引擎会记「做够几次」；第一次认到给大字说明，做满才亮对应皮影志。 */
export const RUXUE = {
  id: 'ruxue', name: '开箱', tag: '新手 · 一折', scene: 'field', mood: 'lamp',
  prop: 'fan', cast: ['sheng'], seal: '开箱', novice: true,
  blurb: '新手先学四手：张掌起灯、捏合、攥拳、翻手、横扫——每一手做满两次才算学会，学完亮一条皮影志。',
  cues: [
    { n: '起灯', need: ['open', 'enter'], teach: 'open', repeat: 1,
      hint: '手掌伸向灯 · 五指张开', say: '（旁白）手伸向灯，影人才出场——皮影的戏，都是从这一掌起的。',
      sfx: 'gong', act: 'enter', big: '张掌 · 起灯：手掌一开，灯就亮了，影人登场。' },
    { n: '学四手 · 捏合', need: 'pinch', teach: 'pinch', repeat: 2, assistAfter: 2,
      hint: '拇指与食指轻轻一碰（像捏住一根签子）', say: '师父：两根指头一捏，影人就挑签、拾物。',
      sfx: 'chime', act: 'bow', big: '捏合 · 挑签：两指一捏，像捏住那根签子。', zhi: 'z3' },
    { n: '学四手 · 攥拳', need: 'fist', teach: 'fist', repeat: 2, assistAfter: 2,
      hint: '四指收回攥成拳（攥紧那根签子）', say: '师父：攥住签子，影人定住亮相，戏才稳。',
      sfx: 'drum', act: 'bow', big: '攥拳 · 定身：攥住签子，影人定在台上。', zhi: 'z5' },
    { n: '学四手 · 翻手', need: 'turn', teach: 'turn', repeat: 2, assistAfter: 2,
      hint: '手心翻个面（掌翻成背）', say: '师父：手翻过来，影人就翻个面——一个人变另一个人。',
      sfx: 'chime', act: 'flip', big: '翻手 · 换面：手一翻，影人换个人。', zhi: 'z6' },
    { n: '学四手 · 横扫', need: 'wave', teach: 'wave', repeat: 2, assistAfter: 2,
      hint: '带手横着挥一下（像甩开一阵风）', say: '师父：一记横扫，满台都是风——行话叫「换势」。',
      sfx: 'drum', act: 'swing', big: '横扫 · 换势：一挥手，影人换到台口。', zhi: 'z7' },
    { n: '亮个相 · 走影', need: ['wave', 'kick'], hint: '横扫 / 下砸 · 让影人走两步', say: '连起来：先让影人走两步。', sfx: 'drum', act: 'swing' },
    { n: '亮个相 · 挑签', need: 'pinch', hint: '捏合 · 挑一挑签子', say: '再挑一挑那根签子。', sfx: 'chime', act: 'bow' },
    { n: '亮个相 · 亮相', need: ['fist', 'meet'], hint: '攥拳 / 两手靠近 · 定住亮相', say: '最后定住——亮相！', sfx: 'gong', act: 'clash' },
    { n: '谢幕', need: 'hold', hold: 3.0, hint: '', say: '开箱 · 这四手，你记住了。', sfx: 'applause', act: 'bow' }
  ]
};

export const ALL_PLAYS = PLAYS.concat([TEACH, RUXUE, GRAND]);
export const PLAY_IDS = ALL_PLAYS.map(p => p.id);
export const findPlay = id => ALL_PLAYS.find(p => p.id === id) || null;

/* 戏折子引擎：不碰 DOM、不放声音，全部通过 hooks 交回调用方 */
export function createPlaybook(hooks = {}) {
  let cur = null, idx = 0, t = 0;
  let paused = false, assist = false, helped = 0, cueT = 0, reps = 0;
  const H = {
    subtitle: () => {}, sfx: () => {}, progress: () => {}, act: () => {}, done: () => {}, scene: () => {}, ...hooks
  };
  const api = {
    get play() { return cur; },
    get idx() { return idx; },
    get cue() { return cur ? cur.cues[idx] || null : null; },
    get running() { return !!cur; },
    get elapsed() { return t; },
    /* 要重复的幕：已经认到几次 / 一共要几次（新手学四手用） */
    get reps() { return reps; },
    get repeat() { return cur ? ((cur.cues[idx] || {}).repeat || 1) : 1; },
    /* 手感帮衬：等久了就放宽成"任意手势都算"，并记一次帮衬 */
    get assist() { return assist; },
    get helped() { return helped; },
    /* 手不在画面里 → 台本冻住（不判、不落灯） */
    get paused() { return paused; },
    set paused(v) { paused = !!v; },
    start(id) {
      cur = findPlay(id); idx = 0; t = 0; cueT = 0;
      paused = false; assist = false; helped = 0;
      if (cur) api.fire();
      return cur;
    },
    stop() { cur = null; idx = 0; t = 0; paused = false; assist = false; },
    fire() {
      const c = api.cue; if (!c) return;
      if (c.sfx) H.sfx(c.sfx);
      if (c.say) H.subtitle(c.say, 4.4);
      if (c.act) H.act(c.act);
      if (c.scene || c.mood) H.scene(c.scene, c.mood);
      cueT = 0; assist = false; reps = 0;
      H.progress(cur, idx, c);
    },
    /* 每帧：自动过幕（出将/谢幕）+ 帮一把的宽限计时 */
    tick(dt) {
      if (!cur || paused) return;
      t += dt;
      const c = api.cue; if (!c) return;
      cueT += dt;
      if (c.need !== 'hold') assist = cueT > (c.assistAfter || 3);
      if (c.need === 'hold' || c.need === 'enter') {
        if (t >= Math.max(.8, c.hold || 2.4)) api.next();
      }
    },
    /* 手势/按键推进 */
    action(name) {
      if (!cur || paused) return false;
      const c = api.cue; if (!c) return false;
      const need = Array.isArray(c.need) ? c.need : [c.need];
      if (t < .18) return false;
      const hit = need.includes(name);
      /* 帮一把：这一幕等太久了，随便一个真手势也算过（记一次帮衬） */
      const help = !hit && assist && ACTIONS.includes(name);
      if (!hit && !help) return false;
      if (help) { helped++; H.helped && H.helped(c); }
      /* 要重复的幕（新手学四手）：做满 repeat 次才算学会；没做满就停在原地，
         只回执一次「认到了」（H.rep），做满时再报 H.learned */
      const want = c.repeat || 1;
      reps++;
      H.rep && H.rep(c, reps, want);
      if (reps >= want) { reps = 0; H.learned && H.learned(c); api.next(); }
      else { cueT = 0; assist = false; }
      return help ? 'help' : true;
    },
    next() {
      if (!cur) return;
      const p = cur;
      idx++; t = 0; reps = 0;
      if (idx >= p.cues.length) { cur = null; idx = 0; H.done(p, { helped }); }
      else api.fire();
    },
    /* 再示范一遍同一幕（教戏超时用） */
    again() { if (cur) { t = 0; cueT = 0; assist = false; reps = 0; api.fire(); } }
  };
  return api;
}

/* 引擎认得出的动作名（帮一把时用它过滤"真手势"，别把路过当出手） */
export const ACTIONS = ['pinch', 'fist', 'meet', 'wave', 'kick', 'flip', 'raise', 'open', 'turn'];

