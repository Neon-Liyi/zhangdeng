/* 《掌灯》手势引擎 —— 复用《手势塔罗》的识别逻辑（21点特征 + 迟滞 + 指数平滑）
   输出：单/双手存在性、屏幕坐标、运动速度、手势模式，以及事件回调
   阈值与消抖策略沿用实测有效的参数，避免单帧抖动误触发 */
import { FilesetResolver, HandLandmarker } from './vendor/vision_bundle.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

/* ----------------------------------------------------------------------------
   手感（宽容度）：摄像头前面的真人比演示里的合成手"糙"得多——
   捏不拢、拳头攥不紧、手一晃就出画。三档放宽/收紧全部阈值，默认「宽松」。
   ---------------------------------------------------------------------------- */
export const FEEL = {
  loose: {
    name: '宽松', pinchClose: .44, pinchFull: .14, pinchIn: .44, pinchOut: .62,
    pinchHold: 3, pinchCool: .22, fistHold: 3, fistExt: 1, fistSpan: 1.35,
    openExt: 2, openHold: 5, lostAfter: .60, meetDist: .40, meetHold: 3, extGain: 1.05,
    straightOn: .80, straightOff: .72,                    // 骨架伸直度（|tip-mcp| / 骨长）：进/出双阈值（迟滞）
    pinchEdge: .05, meetApproach: .10,                 // 「看得见动作」才算：捏要有合拢过程、靠近要有接近过程
    turnHold: 2, turnCool: .55, waveD: .20, kickD: .12, raiseD: .11      // 位移阈值（占屏幕比例）
  },
  normal: {
    name: '标准', pinchClose: .36, pinchFull: .12, pinchIn: .36, pinchOut: .54,
    pinchHold: 5, pinchCool: .5, fistHold: 5, fistExt: 0, fistSpan: 1.15,
    openExt: 3, openHold: 8, lostAfter: .40, meetDist: .30, meetHold: 4, extGain: 1.12,
    straightOn: .82, straightOff: .76,
    pinchEdge: .07, meetApproach: .12,
    turnHold: 3, turnCool: .7, waveD: .30, kickD: .18, raiseD: .16
  },
  strict: {
    name: '严格', pinchClose: .30, pinchFull: .10, pinchIn: .30, pinchOut: .46,
    pinchHold: 6, pinchCool: .8, fistHold: 6, fistExt: 0, fistSpan: 1.05,
    openExt: 4, openHold: 11, lostAfter: .28, meetDist: .24, meetHold: 5, extGain: 1.18,
    straightOn: .85, straightOff: .79,
    pinchEdge: .09, meetApproach: .15,
    turnHold: 3, turnCool: .9, waveD: .36, kickD: .22, raiseD: .20
  }
};
/* 「越做不出来越宽松」：帮衬几次之后按同一套档位再往外放一点，
   让卡住的人也能把一出戏演完（代价是评价照记，躲不过去） */
let FEEL_BASE = 'loose', RELAX = 0;
function build(level, r) {
  const b = FEEL[level] || FEEL.loose;
  if (!r) return b;
  const f = 1 - r;
  return Object.assign({}, b, {
    name: b.name + '·自动放宽',
    /* 放宽只动「时间/位移」这类宽容度，**不动「形状」阈值**——
       形状一松就会满屏误判（放松的手本来就像半捏着），准确度不能拿来做补偿 */
    pinchClose: Math.min(b.pinchClose + .02, .42),
    pinchOut: b.pinchOut / f,
    pinchIn: Math.max(.12, b.pinchIn * f),
    pinchEdge: b.pinchEdge * f,
    meetApproach: b.meetApproach * f,
    fistSpan: b.fistSpan * (1 + r),
    fistExt: Math.min(2, b.fistExt + (r > .25 ? 1 : 0)),
    openExt: Math.max(1, b.openExt - 1),
    openHold: Math.max(2, Math.round(b.openHold * f)),
    pinchHold: Math.max(2, Math.round(b.pinchHold * f)),
    fistHold: Math.max(2, Math.round(b.fistHold * f)),
    meetHold: Math.max(2, Math.round(b.meetHold * f)),
    turnHold: Math.max(2, Math.round(b.turnHold * f)),
    lostAfter: b.lostAfter * (1 + r * .8),           // 手一晃出去不算丢
    meetDist: Math.min(b.meetDist + .04 * r / .45 * .45, .44),   // 放宽时略微放宽，但不放成"半屏内就算靠近"
    waveD: b.waveD * f, kickD: b.kickD * f, raiseD: b.raiseD * f
  });
}
let T = build('loose', 0);
export function setFeel(level) { FEEL_BASE = FEEL[level] ? level : 'loose'; T = build(FEEL_BASE, RELAX); return T.name; }
export const feelName = () => T.name;
/* r: 0 ~ .45（0.45 大约相当于"动手也算过"） */
export function setRelax(r) { RELAX = Math.max(0, Math.min(.45, +r || 0)); T = build(FEEL_BASE, RELAX); return RELAX; }
export const relaxLevel = () => RELAX;
export function tune() { return T; }               // 当前生效的阈值（自检页要显示"实际松到什么程度"）

const PINCH_TAU_FAST = .06, PINCH_TAU_SLOW = .12;
const REACQ_GAP = .25;
/* 「真的合拢了」按最近的样本看，而不是跟一个会漂走的基线比：
   PINCH_WIN 帧里最张开的那一次 − 现在 = 这段真的合了多少；
   窗口里出现单帧跳变（> PINCH_JUMP = 换姿势 / 手被重新捕获）就把整段作废——那不是「手在合」。 */
const PINCH_WIN = 10, PINCH_JUMP = .5;
/* 翻手（换面）判定：真翻手必然从「侧棱朝镜头」穿过去（缠绕量 |w| 近零，W_ZERO 以内）；
   追踪器偶尔单帧正反跳变、直接跳过近零段 —— 那不是手在翻。W_CROSS_MS 是「刚穿零」的有效期；
   W_BIG 是逃生口：验收页的大合成手没有近零段，|w| 足够大仍然认（真手 |w| 约 .04~.09，合成手 .3+）。 */
const W_ZERO = .033, W_BIG = .18, W_CROSS_MS = 400;
/* 旧的「保持 N 帧」门槛换算成秒（H60 = 一帧@60fps）：掉帧到 1~3fps 时「4 帧」要 2.8 秒，
   保持时长永远攒不满（验收环境实测：捏合/攥拳在低帧率下怎么也发不出来）。
   按真实时间累计后，60fps 行为逐帧等价，慢机器不再吃亏。 */
const H60 = 1 / 60;

function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = (a.z || 0) - (b.z || 0);
  return Math.hypot(dx, dy, dz * .6);
}

/* 手指伸直度：|tip - mcp| / （骨长之和），三根骨头被透视同比例压缩 → 对旋转/远近/倾角免疫。
   伸直≈0.95~1.0、半握≈0.6~0.75、握紧≈0.3~0.5 */
const FINGER_JOINTS = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]];

/* 由 21 个关键点解出手势特征（与塔罗同源；第十轮：形状量换成手部骨架几何量） */
export function analyzeHand(lm, t = T) {
  const hs = Math.max(.02, dist(lm[0], lm[9]));
  const wrist = lm[0];
  /* ① 伸直度：不看"离手腕多远"，只看"这根手指的骨头直不直" */
  const straight = FINGER_JOINTS.map(([mcp, pip, tip]) => {
    const a = dist(lm[mcp], lm[pip]), b = dist(lm[pip], lm[tip]);
    return dist(lm[mcp], lm[tip]) / Math.max(.012, a + b);
  });
  const ext = straight.map(v => v > t.straightOn);            // 瞬时伸直（兜底/自检用）
  const nExt = ext.filter(Boolean).length;
  const palm = {
    x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
    y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5
  };
  /* ② 掌平面局部坐标系：掌长轴 = 手腕→中指根，掌宽轴 = 食指根→小指根，法向 = 两者叉积。
     把拇指尖(4)/食指尖(8)/中指根(9) 投到这个平面上，捏合就在"掌平面里"量——
     手朝镜头倾过去时，用【掌宽】（几乎不被压扁）做归一化，d48/d412 不会被"掌长缩水"带偏 */
  const O = lm[0], P = lm[9];
  const Lvec = [P.x - O.x, P.y - O.y, (P.z || 0) - (O.z || 0)];
  const Ln = Math.max(1e-6, Math.hypot(Lvec[0], Lvec[1], Lvec[2]));
  const u = [Lvec[0] / Ln, Lvec[1] / Ln, Lvec[2] / Ln];
  let w0 = [lm[17].x - lm[5].x, lm[17].y - lm[5].y, (lm[17].z || 0) - (lm[5].z || 0)];
  const dUW = u[0] * w0[0] + u[1] * w0[1] + u[2] * w0[2];
  w0 = [w0[0] - dUW * u[0], w0[1] - dUW * u[1], w0[2] - dUW * u[2]];   // 去掉掌长分量 → 正交的掌宽轴
  const Wn = Math.max(1e-6, Math.hypot(w0[0], w0[1], w0[2]));
  const wx = [w0[0] / Wn, w0[1] / Wn, w0[2] / Wn];
  const nrm = [u[1] * wx[2] - u[2] * wx[1], u[2] * wx[0] - u[0] * wx[2], u[0] * wx[1] - u[1] * wx[0]];
  const proj = q => {
    const v = [q.x - O.x, q.y - O.y, (q.z || 0) - O.z];
    return { a: v[0] * u[0] + v[1] * u[1] + v[2] * u[2], b: v[0] * wx[0] + v[1] * wx[1] + v[2] * wx[2] };
  };
  const pd = (p, q) => Math.hypot(p.a - q.a, p.b - q.b);
  const p4 = proj(lm[4]), p5 = proj(lm[5]), p8 = proj(lm[8]), p9 = proj(lm[9]), p12 = proj(lm[12]);
  const palmW = Math.max(.02, pd(p5, proj(lm[17])));          // 掌宽（归一化尺度；倾斜时几乎不缩）
  const palmLen = pd(proj(lm[0]), p9);
  const d48 = dist(lm[4], lm[8]) / hs, d412 = dist(lm[4], lm[12]) / hs;   // 旧量照旧导出（别的模块可能在看）
  const tip8mcp5 = dist(lm[8], lm[5]) / hs, tip12mcp9 = dist(lm[12], lm[9]) / hs;
  /* 掌心朝向：手腕→食指根 与 手腕→小指根 的二维叉积（左右手、朝向都无关，
     只看"翻没翻面"）——手翻过来 = 影人翻个身/换个人，这是最自然的一个映射 */
  const palmWinding = (lm[5].x - lm[0].x) * (lm[17].y - lm[0].y) - (lm[5].y - lm[0].y) * (lm[17].x - lm[0].x);
  /* 捏：只要求指尖凑近，不再强求食指完全伸直（真人做捏的时候食指多是半弯的）。
     距离用【掌宽】归一化：掌长被透视压扁也带不偏它 */
  const d48p = pd(p4, p8) / palmW, d412p = pd(p4, p12) / palmW;
  const tip8mcp5p = pd(p8, p5) / palmW, tip12mcp9p = pd(p12, p9) / palmW;
  const pinchClose = t.pinchClose;
  const idxPinch = d48p < pinchClose && tip8mcp5p > .24;
  const midPinch = d412p < pinchClose && tip12mcp9p > .24;
  const pinchRaw = Math.min(idxPinch ? d48p : 9, midPinch ? d412p : 9);
  const strength = clamp(1 - (pinchRaw - t.pinchFull) / (pinchClose - t.pinchFull), 0, 1);
  const thumbPinky = dist(lm[4], lm[17]) / hs;
  const openPalm = nExt >= t.openExt + 1 || (nExt >= t.openExt && ext[0] && ext[1]);
  const fist = nExt <= t.fistExt && thumbPinky < t.fistSpan;
  return {
    hs, ext, nExt, straight, palm, pinchRaw, strength, d48, d412, thumbPinky, tip8mcp5, tip12mcp9, palmWinding,
    d48p, d412p, tip8mcp5p, tip12mcp9p, palmW, palmLen, pinchClose,
    sx: 1 - palm.x, sy: palm.y,                       // 镜像后的屏幕坐标
    tipSX: 1 - lm[8].x, tipSY: lm[8].y,
    span: dist(lm[0], lm[12]) / hs,                   // 手掌张开幅度（用于"亮相"）
    pointing: ext[0] && !ext[1] && !ext[2] && !ext[3],
    openPalm,
    fist,
    /* 给"手上的反馈"用：这一刻最像哪个手势 */
    label: pinchRaw < pinchClose ? '捏合' : openPalm ? '张掌' : fist ? '握拳'
      : ext[0] && !ext[1] ? '指认' : '握持'
  };
}

/* 单手的平滑状态（每个槽位一份） */
class HandSlot {
  constructor() {
    this.present = false; this.lastSeen = -1e9; this.lastApply = 0;
    this.x = .5; this.y = .5; this.tipX = .5; this.tipY = .5;
    this.vx = 0; this.vy = 0; this.px = null; this.py = null;
    this.mode = 'none'; this.prevMode = 'none';
    this.pinchSm = 1; this.pinchOn = false; this.pinchHold = 0; this.cool = 0;
    this.fistHold = 0; this.openHold = 0; this.openFired = false; this.reacq = 1; this.span = .5;
    this.heldAt = 0; this.fistHeldAt = 0;
    this.pinchWin = []; this.pinchPrev = null;   // 最近几帧的捏合距离（判「看得见合拢」）
    this.extFar = 4; this.fistEver = false;      // 「有没有出现真正的收指动作」的基线
    this.lmSm = null;                            // 21 点坐标的指数平滑：先给关键点降噪，再算骨长几何量
    this.straightSm = [.9, .9, .9, .9];          // 每根手指伸直度的指数平滑（tau≈0.08s，抗关键点抖动）
    this.extOnS = [false, false, false, false];  // 分数上的进/出双阈值闩锁
    this.nExtS = 4; this.openPalmS = true; this.fistS = false;
    this.extOnL = [false, false, false, false]; this.nExtL = 0;   // 拳头专用的固定宽松伸直度计数
    this.pinchEntry = false;                                       // 手带着捏进场那一下的待发标记
    this.straightOn = T.straightOn; this.straightOff = T.straightOff;   // 记住落位那一刻的阈值
    this.analyzed = null;
    this.charge = 0; this.label = ''; this.flash = 0;    // 手上的反馈：蓄力进度 / 现在像什么 / 触发闪光
    this.palmBase = 0; this.turnHold = 0; this.turnCool = 0;   // 翻手（换面）
    this.px2 = null; this.py2 = null;                    // 上一帧的"掌心点"，用于窗口位移判定
    this.trail = [];                                     // 最近若干帧的手位（算位移，不看瞬时速度）
    this.events = [];
  }
  push(name, data) { this.events.push({ name, data }); }
}

export class HandTracker {
  constructor(opts = {}) {
    this.numHands = opts.numHands || 2;
    this.gameOf = opts.onFrame || null;
    this.snap = !!opts.snapOnReacquire;      // 首次捕获是否直接落位（影人场景用 true）
    this.snapNext = false;                   // 由 resettle() 置位：下一帧所有手重新落位
    this.meetHold = 0;
    this.onEvent = opts.onEvent || (() => {});
    this.slots = Array.from({ length: this.numHands }, () => new HandSlot());
    this.landmarker = null;
    this.video = null;
    this.ready = false;
    this.twoHandDist = 1;
    this.twoHandMeet = false;
    this.onStatus = opts.onStatus || (() => {});
  }

  async init() {
    const fileset = await FilesetResolver.forVisionTasks('./vendor/wasm');
    try {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: './models/hand_landmarker.task', delegate: 'GPU' },
        runningMode: 'VIDEO', numHands: this.numHands,
        minHandDetectionConfidence: .5, minHandPresenceConfidence: .5, minTrackingConfidence: .5
      });
    } catch (e) {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: './models/hand_landmarker.task' },
        runningMode: 'VIDEO', numHands: this.numHands
      });
    }
    this.ready = true;
    return this;
  }

  async camera() {
    const st = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' }, audio: false
    });
    const v = document.createElement('video');
    v.srcObject = st; v.playsInline = true; v.muted = true;
    await v.play();
    this.video = v;
    return v;
  }

  /* 用一帧关键点组更新状态机（摄像头与演示模式共用） */
  feed(handsLM, now) {
    const seen = [];
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      const lm = handsLM[i];
      if (!lm) {
        if (s.present && now - s.lastSeen > T.lostAfter * 1000) {
          s.present = false; s.push('lost');
          /* 手走开时把所有手势"闩锁"清干净：否则走开那一刻正捏着的话，
             pinchOn 会永远停在 true —— 这只手从此再也捏不出来（"这个手势触发不了"的元凶） */
          s.pinchOn = false; s.pinchHold = 0; s.fistHold = 0; s.openHold = 0; s.openFired = false;
          s.turnHold = 0; s.palmBase = 0; s.wzAt = 0; s.trail.length = 0;
        s.pinchWin.length = 0; s.pinchPrev = null;
        }
        // 滑出：速度衰减
        s.vx *= .9; s.vy *= .9;
        continue;
      }
      const A = analyzeHand(lm, T);
      this.applyTo(s, A, now, lm);
      seen.push({ slot: i, A, s });
    }
    // 手与手之间的关系：任意两只手靠得足够近 → 对戏（四只手也适用）
    const live = this.slots.filter(s => s.present);
    this.pairDist = 1;
    let best = null;
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        /* 用"原始（未平滑）"掌心点算距离：平滑后的位置滞后，两手快速靠近会认不出来 */
        const Ai = live[i].analyzed, Aj = live[j].analyzed;
        const d = Math.hypot((Ai ? Ai.sx : live[i].x) - (Aj ? Aj.sx : live[j].x),
          (Ai ? Ai.sy : live[i].y) - (Aj ? Aj.sy : live[j].y));
        if (d < this.pairDist) { this.pairDist = d; best = { d, a: live[i], b: live[j] }; }
      }
    }
    const dNow = best ? best.d : 1;
    /* 靠近要有「接近的过程」：两只手本来就摆在半屏内、或者手快速擦过，都不该算"对戏"
       —— 这是实测里最容易误判的一处（原来的阈值宽到 .52，两只手随便一放就触发） */
    this.meetTrail = this.meetTrail || [];
    /* 手数变了（0→2、2→1）说明是"重新落位"，旧的距离记录不能算数，
       否则两个案子之间的一次跳变会被当成"两手在靠近" */
    if (this._lastLive !== live.length) { this.meetTrail = []; this._lastLive = live.length; }
    this.meetTrail.push({ t: now, d: dNow });
    /* 至少留住 18 个样本：掉帧时 0.9 秒只有五六个样本，「从远到近」的整个靠近过程会被裁掉，
       dFar 量不到真正的「远」，approach 就永远够不到阈值（「两手靠近认不出来」的元凶） */
    while (this.meetTrail.length > 90 || (this.meetTrail.length > 18 && now - this.meetTrail[0].t > 1500)) this.meetTrail.shift();
    const dFar = Math.max(...this.meetTrail.map(k => k.d));
    const approach = dFar - dNow;
    const meet = !!best && dNow < T.meetDist;
    // 贴近要持续一小会儿才算"对戏"（按真实时间，不看帧数）：手快速擦过、影人平移中途靠近都不该触发
    const mdt = this._meetAt ? clamp((now - this._meetAt) / 1000, 0, .5) : H60;
    this._meetAt = now;
    this.meetHold = meet ? this.meetHold + mdt : 0;
    if (this.meetHold >= T.meetHold * H60 && !this.twoHandMeet && approach > T.meetApproach) this.onEvent('meet', { d: dNow });
    this.twoHandMeet = this.meetHold >= T.meetHold * H60 && approach > T.meetApproach;
    this.twoHandDist = dNow;
    this.meetApproach = approach;
    this.drainEvents();
    this.snapNext = false;
    return { seen, any: live.length > 0, both: live.length > 1, live: live.length };
  }

  /* 场景里手的数量/布局变了（例如手动模式加人）→ 下一帧全部重新落位，
     否则平滑插值会让手"滑过"其他手，凭空触发对戏 */
  resettle() { this.snapNext = true; this.meetTrail = []; }

  applyTo(s, A, now, lm) {
    const gap = s.lastApply ? (now - s.lastApply) / 1000 : 1e9;
    const dt = clamp(gap, 0, .1);
    s.lastApply = now;
    const reacquired = !s.present || gap > REACQ_GAP || this.snapNext;
    const nx = clamp(A.sx, -.1, 1.1), ny = clamp(A.sy, -.1, 1.1);
    if (reacquired) {
      s.pinchSm = Math.min(A.pinchRaw, 1);
      s.pinchWin.length = 0; s.pinchPrev = null;
      s.extFar = A.nExt; s.fistEver = false;
      s.lmSm = lm.map(q => ({ x: q.x, y: q.y, z: q.z || 0 }));
      s.straightSm = A.straight.slice();
      s.extOnS = A.ext.slice(); s.nExtS = A.nExt;
      s.extOnL = A.ext.slice(); s.nExtL = A.nExt;
      s.openPalmS = A.openPalm; s.fistS = A.fist;
      s.straightOn = T.straightOn; s.straightOff = T.straightOff;
      s.pinchHold = 0; s.pinchOn = false; s.fistHold = 0; s.openHold = 0; s.openFired = false; s.turnHold = 0; s.wzAt = 0;
      /* 手「带着捏」进的画面：静态像捏不算，但"进场那一下本来就是捏着的"要认一次——
         否则手恰好捏着进场，这个手势就永远等不到"合拢过程"。验收「宽松半捏」项就是这个情形。
         只认进场这一下；在场内从张开跳到捏合，走"看得见合拢"那条路（反例「静态半捏」不许认）。 */
      s.pinchEntry = A.pinchRaw < T.pinchIn && A.nExt >= 2 && !A.fist;
      s.px = null; s.py = null;
      if (this.snap) {
        // 直接落位：新出现的手若从默认点 0.5 滑过去，会"路过"已就位的手，
        // 中途距离小于阈值 → 凭空触发"对戏"（影人场景需要落位；牌阵场景保留缓入）
        s.x = nx; s.y = ny;
        s.tipX = clamp(A.tipSX, -.1, 1.1); s.tipY = A.tipSY;
        s.reacq = 1;
      }
    } else {
      // 无捏合时 pinchRaw 是 9，直接拿它平滑会让 pinchSm 漂到 9，
      // 松手越久越难再捏上（实测要 13 帧才降到阈值以下）→ 统一按 1.0 处理
      const target = Math.min(A.pinchRaw, 1);
      const tau = target < s.pinchSm ? PINCH_TAU_FAST : PINCH_TAU_SLOW;
      s.pinchSm += (target - s.pinchSm) * (1 - Math.exp(-dt / tau));
    }
    s.reacq = reacquired ? 0 : Math.min(1, s.reacq + dt / .35);
    const alpha = lerp(.10, .34, s.reacq);
    const ox = s.x, oy = s.y;
    s.x = lerp(s.x, nx, alpha);
    s.y = lerp(s.y, ny, alpha);
    s.tipX = lerp(s.tipX, clamp(A.tipSX, -.1, 1.1), alpha);
    s.tipY = lerp(s.tipY, A.tipSY, alpha);
    if (!reacquired && dt > 0) {
      s.vx = lerp(s.vx, (s.x - ox) / dt, .35);
      s.vy = lerp(s.vy, (s.y - oy) / dt, .35);
    }
    s.span = lerp(s.span, A.span, .2);
    /* ---- ③ 手指分数的时间平滑 + 进/出双阈值迟滞：抖动 sigma=0.008 时 nExt 不再 3<->4 跳 ----
       先对 21 个关键点做轻量指数平滑再算骨长几何量：伸直度是【骨长比值】，
       分子在拳头里只有几毫米，逐帧重掷的抖动会被放大——先给关键点降噪，比只在分数上平滑更有效。
       第十轮修：tau 从 .10 收到 .04 —— 上面还有一道伸直度平滑，两道串联起来对"0.22 秒的快速点拳"
       太慢（打闹台的攥拳六下就是被这两道磨掉的）。降噪的活儿交给伸直度平滑（不对称）+ 双阈值迟滞。 */
    if (!s.lmSm || s.lmSm.length !== lm.length) s.lmSm = lm.map(q => ({ x: q.x, y: q.y, z: q.z || 0 }));
    else {
      const lk = 1 - Math.exp(-dt / .04);
      for (let i = 0; i < lm.length && i < 21; i++) {
        s.lmSm[i].x += (lm[i].x - s.lmSm[i].x) * lk;
        s.lmSm[i].y += (lm[i].y - s.lmSm[i].y) * lk;
        s.lmSm[i].z += ((lm[i].z || 0) - s.lmSm[i].z) * lk;
      }
    }
    const As = analyzeHand(s.lmSm, T);            // 用降噪后的关键点重算形状量（事件用这个）
    /* 第十轮修：伸直度的平滑改成**不对称**——往「收指／握紧」方向跟得快（tau .03），
       往「张开」方向慢一些（tau .10）。理由：真人的拳头是"啪"一下攥上的，
       而对称平滑（两侧都 .08，叠加关键点平滑就更慢）会让 0.2 秒的快速点拳在半途就结束、
       平滑值还没落下去 → 事件发不出来（打闹台的"攥拳六下"就是这么丢的）。
       和 extFar 的老规矩一致：收得立刻，放得缓慢。 */
    for (let i = 0; i < 4; i++) {
      const tau = As.straight[i] < s.straightSm[i] ? .03 : .10;
      s.straightSm[i] += (As.straight[i] - s.straightSm[i]) * (1 - Math.exp(-dt / tau));
    }
    const sm = s.straightSm;
    for (let i = 0; i < 4; i++) s.extOnS[i] = s.extOnS[i] ? sm[i] >= s.straightOff : sm[i] >= s.straightOn;
    s.nExtS = s.extOnS.filter(Boolean).length;
    /* 拳头的"伸着几根指头"另外用**固定宽松伸直度**（.80/.72）数，不跟手感档位收紧：
       严格档把伸直度也收紧了，半握那只手唯一伸直的那根会被算成"弯的"→ nExtS 0 →
       严格档反而把"半握"认成拳头（验收「严格：同一只半握的手不算握拳」就是这么红的）。
       档位该管的是"容忍几根伸着的指头"（fistExt），不该改"什么算伸直"。 */
    for (let i = 0; i < 4; i++) s.extOnL[i] = s.extOnL[i] ? sm[i] >= .72 : sm[i] >= .80;
    s.nExtL = s.extOnL.filter(Boolean).length;
    s.openPalmS = s.nExtS >= T.openExt + 1 || (s.nExtS >= T.openExt && s.extOnS[0] && s.extOnS[1]);
    s.fistS = s.nExtL <= T.fistExt && As.thumbPinky < T.fistSpan;
    A.straightSm = sm.slice(); A.extS = s.extOnS.slice(); A.nExtS = s.nExtS;
    A.openPalmS = s.openPalmS; A.fistS = s.fistS;
    if (A.fistS) A.label = '握拳';
    else if (A.openPalmS) A.label = '张掌';
    else if (A.pointing) A.label = '指认';
    else if (A.label === '张掌' || A.label === '握拳') A.label = '握持';
    s.present = true; s.lastSeen = now; s.analyzed = A;

    /* ---- 「看得见动作」才算数：形状类手势必须有过程，不能只看某一刻的样子 ----
       放松的手本来就半合着，只比"静态像不像"必然满屏误判（用户的原话是"识别太不准确"）。
       pinchWin：最近几帧的「拇指—指尖距离」。没在捏时 pinchRaw 是哨兵 9，必须先夹到 1——
       否则这个窗口会一直漂到 9，「合了多少」恒等于 8 以上，静止的松手也会被当成捏合。
       closing = 窗口里最张开的那一次 − 现在 → 只有相对它明显合拢，才算一次真捏；
       窗口里出现单帧跳变（换姿势 / 手被重新捕获）就把整段作废——那不是「手在合」。
       extFar：缓慢跟着"最多的伸直指头数"走的基线——只有相对它明显收指，才算一次真攥拳。 */
    const pr = Math.min(A.pinchRaw, 1);                             // 哨兵 9 → 1
    /* 跳变不清零：真人「啪」一下合拢就是一帧跳到位（真手数据里每次张→捏都跳 >0.5）。
       把跳变前的值留作窗口基线，合拢量才算得出来；整段作废的话 closing 恒为 0，
       反复捏 12 轮只触发 1 次（真手回放实测）。 */
    if (s.pinchPrev != null && Math.abs(pr - s.pinchPrev) > PINCH_JUMP) { s.pinchWin.length = 0; s.pinchWin.push(s.pinchPrev); s.pinchSm = pr; }
    s.pinchPrev = pr;
    s.pinchWin.push(pr);
    while (s.pinchWin.length > PINCH_WIN) s.pinchWin.shift();
    const closing = Math.max(...s.pinchWin) - pr;                   // >0 = 正在合拢
    s.extFar = Math.max(A.nExtS, s.extFar - dt * 3.2);              // 基线慢慢降，升是立刻的
    const fingersClosed = s.extFar - A.nExtS;                       // 相对基线收了几根

    // ---- 手势事件：捏合（挑签）----
    /* 攥拳时绝不认捏合：真拳的拇指/食指天然贴在一起（真手 204 帧里 182 帧两者同时成立），
       不掐断的话一次攥拳会喷出十几次「捏合」（幽灵挑签，回放实测 13 次），标签/模式也跟着乱。 */
    if (A.fistS) s.pinchOn = false;
    const pinching = !A.fistS && (s.pinchOn ? A.pinchRaw < T.pinchOut : (s.pinchSm < T.pinchIn && A.pinchRaw < T.pinchOut));
    if (pinching && !s.pinchOn) s.pinchHold += dt; else s.pinchHold = 0;   // 按时间累计（旧帧数在低帧率下攒不满）
    if (s.cool > 0) s.cool = Math.max(0, s.cool - clamp(gap, 0, .5));      // 冷却按真实时间（帧数计冷却在掉帧时会锁死）
    if (s.pinchEntry) {                                                    // 带着捏进场 → 认这一次（只认进场那一下）
      s.pinchEntry = false;
      if (s.cool <= 0) {                                                   // 追踪器抖动引起的一丢一收不重复记账
        s.pinchOn = true; s.cool = T.pinchCool; s.heldAt = now;
        s.push('pinch'); s.flash = 1;
      }
    }
    if (pinching && s.pinchHold >= (T.pinchHold + 1) * H60 && !s.pinchOn && s.cool <= 0 && closing > T.pinchEdge) {
      s.pinchOn = true; s.cool = T.pinchCool;
      s.push('pinch'); s.flash = 1; s.heldAt = now;
    }
    if (s.pinchOn && A.pinchRaw > T.pinchOut) s.pinchOn = false;
    /* 一直捏着不放也要继续算：否则"幕到了、手正捏着"这种情况永远等不到新事件
       （真人的手不会每次刚好在幕切换的瞬间重新捏一下） */
    if (s.pinchOn && now - (s.heldAt || 0) > 900 && s.cool <= 0) { s.cool = T.pinchCool; s.push('pinch'); s.flash = 1; s.heldAt = now; }

    // ---- 手势事件：握拳（敲鼓 / 定住）----
    if (A.fistS) {
      s.fistHold += dt;                          // 时间累计：掉帧到 1~3fps 时"4 帧"= 2.8 秒的坑补上了
      /* 起手那一下必须"看得见收指"（fingersClosed≥1）；之后攥着不放可以每 0.75 秒补报一次
         —— 闹台能"攥着不放"敲完六下，而"本来就放松的手"永远不会凭空敲鼓 */
      /* 第十轮修：原来写死 `fistHold === T.fistHold + 1`（只在"第 4 帧"那一帧检查）。
         换上骨架伸直度后，平滑值要 4~6 帧才从"张开"落到"握紧"，第 4 帧时 fingersClosed 往往还没到 1，
         于是达标时帧号已经过了 4 —— 这一拳永远发不出事件（形状全对、事件为空）。
         改成闩锁：条件一满足就发（一次握拳只发一次），松手即复位。 */
      const edge = !s.fistEver && s.fistHold >= (T.fistHold + 1) * H60 && fingersClosed >= 1;
      const held = s.fistEver && s.fistHold > (T.fistHold + 1) * H60 && now - (s.fistHeldAt || 0) > 750;
      if (edge || held) { s.push('fist'); s.flash = 1; s.fistHeldAt = now; s.fistEver = true; }
    } else { s.fistHold = 0; s.fistHeldAt = 0; s.fistEver = false; }

    // ---- 手势事件：张掌（起灯）----
    /* 也要"看得见张开的过程"：放松的手本来就半张着，静态比阈值必然误判
       （实测静态手 8 个用例里 7 个都会误触发"张掌"） */
    if (A.openPalmS && (A.nExtS - s.extFar) >= 1.5) {
      s.openHold += dt;                        // 时间累计（同上）
      if (!s.openFired && s.openHold >= (T.openHold + 1) * H60) { s.openFired = true; s.push('open'); s.flash = 1; }
    } else { s.openHold = 0; s.openFired = false; }

    /* ---- 翻手（换面 = 换行当 / 翻身）：看掌心朝向翻没翻，左右手都适用 ---- */
    if (s.turnCool > 0) s.turnCool = Math.max(0, s.turnCool - clamp(gap, 0, .5));
    /* 死区 .0025 → .006：横扫时的小晃动不该改旗（真手回放里横扫被误报 2 次翻手） */
    const wRaw = A.palmWinding;
    if (Math.abs(wRaw) <= W_ZERO) s.wzAt = now;          // 记下「侧棱朝镜头」（缠绕量近零）的时刻
    const sd = Math.abs(wRaw) > .006 ? Math.sign(wRaw) : 0;
    if (sd) {
      if (!s.palmBase) s.palmBase = sd;
      else if (sd !== s.palmBase) {
        /* 真翻手一定从侧棱位穿过去（|w| 近零）；追踪器初段的正反跳变直接跳过近零段
           （真手回放里 6 段录制被误报成翻手，真翻手 27 次翻转则全部有穿零）。
           没穿零的翻转只悄悄改基准，不算翻手；大合成手（验收页）|w| 超阈值仍有逃生口。 */
        if (now - (s.wzAt || -1e9) < W_CROSS_MS || Math.abs(wRaw) > W_BIG) {
          s.turnHold += dt;
          if (s.turnHold >= T.turnHold * H60 && s.turnCool <= 0) {
            s.palmBase = sd; s.turnHold = 0; s.turnCool = 1.0;   // 一秒的冷却（兼作"翻手"提示的时长）
            s.push('turn'); s.flash = 1;
          }
        } else { s.palmBase = sd; s.turnHold = 0; }
      } else s.turnHold = 0;
    }

    /* ---- 手位轨迹：挥手/踢腿/上挑/两手靠近 都按"窗口位移"判（不看瞬时速度） ----
       窗口按时间裁，但**至少保留 8 个样本**：掉帧到 5fps 时 0.55 秒里只有两三帧，
       位移算不出来 → "手势怎么都触发不了"。 */
    const tt = now / 1000;
    /* 瞬移阈值随帧间隔一起放大：60fps 下 0.22 屏/帧已是不可能的一步，但掉帧到 10fps 时，
       猛地一挑/一砸真的就是一帧走 0.28 屏；掉到 1~3fps（验收环境就是）时整个动作直接
       落在两帧之间（单步 0.5+）—— 固定阈值把发力的那一步当瞬移清掉，
       挑/砸就永远攒不出位移（真手回放：上挑、下砸的整帧位移全被清，挑一次都没触发）。
       按真实帧间隔缩放后，30fps 以上（gap ≤ 0.1s）行为与原来完全一致。 */
    const tLast = s.trail[s.trail.length - 1];
    if (tLast && Math.hypot(nx - tLast.rx, ny - tLast.ry) > Math.max(.22, 3 * Math.min(gap, .9))) s.trail.length = 0;
    s.trail.push({ t: tt, x: s.x, y: s.y, rx: nx, ry: ny });
    while (s.trail.length > 96 || (s.trail.length > 10 && tt - s.trail[0].t > .78)) s.trail.shift();

    /* ---- 手上的反馈：这一刻像什么、离触发还差多少 ---- */
    s.label = s.turnCool > .55 ? '翻手' : A.label;
    s.charge = Math.max(
      pinching ? Math.min(1, s.pinchHold / ((T.pinchHold + 1) * H60)) : 0,
      A.fistS ? Math.min(1, s.fistHold / ((T.fistHold + 1) * H60)) : 0,
      A.openPalmS ? Math.min(1, s.openHold / ((T.openHold + 1) * H60)) : 0
    );
    s.flash = Math.max(0, s.flash - dt / .45);

    const mode = pinching ? 'pinch' : A.openPalmS ? 'open' : A.fistS ? 'fist'
      : A.pointing ? 'point' : 'hold';
    if (mode !== s.mode) {
      s.prevMode = s.mode; s.mode = mode;
      s.push('mode', { mode, prev: s.prevMode });
    }
  }

  drainEvents() {
    for (const s of this.slots) {
      for (const e of s.events) this.onEvent(e.name, e.data || {});
      s.events.length = 0;
    }
  }

  detect() {
    if (!this.landmarker || !this.video) return null;
    if (this.video.currentTime === (this._ct || -1)) return null;
    this._ct = this.video.currentTime;
    try {
      const res = this.landmarker.detectForVideo(this.video, performance.now());
      return (res && res.landmarks) || [];
    } catch (e) { return null; }
  }
}
