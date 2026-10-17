/* 《掌灯》影人系统 —— 生 / 旦 / 净 / 丑
   全部用 Canvas 路径原创绘制（无外部素材），两段式四肢 + 行当化躯干
   影子遵循皮影物理：离灯越近 → 影子越大、边缘越虚
   绘制顺序：靠旗(身后) → 腿 → 躯干 → 头 → 手臂，避免饰件压到脸上 */

export const ROLES = {
  sheng: {
    key: 'sheng', name: '生', sub: '文生',
    robe: true, hat: 'jin', prop: 'fan',
    lean: -.02, legScale: 1, headScale: 1, wide: 1,
    line: '一纸功名，半生风雪。',
    note: '文生持扇，行不动裙——裙摆的"飘"是靠签子送出去的，演的是稳。'
  },
  dan: {
    key: 'dan', name: '旦', sub: '青衣',
    robe: true, hat: 'bun', prop: 'sleeve', slim: .90,
    lean: -.03, legScale: .94, headScale: .98, wide: .94,
    line: '水袖一抛，半台都是风。',
    note: '水袖是给影子加的风。袖越长，影越"飘"，需要三根签子同时送。'
  },
  jing: {
    key: 'jing', name: '净', sub: '花脸',
    robe: false, armor: true, hat: 'helm', plumes: true, flags: true,
    bulk: 1.16, lean: -.01, legScale: 1.02, headScale: 1.04, wide: 1.12,
    line: '一身靠旗，喝断当阳桥。',
    note: '靠旗与翎子都在动，影子才有"势"——这是皮影最难操纵的行当。'
  },
  chou: {
    key: 'chou', name: '丑', sub: '小丑',
    robe: false, hat: 'cap', hunched: true, bulk: 1.02, jitter: 1.5,
    lean: .02, legScale: .70, headScale: 1.12, wide: 1.12,
    line: '我这一踉跄，满台都笑了。',
    note: '丑角的"活"全在短打露出的腿上，走的是碎步，签子要抖着送。'
  }
};

const P = {
  headY: -.40, headR: .074, neckY: -.318, chestY: -.232, hipY: .0,
  shX: .080, shY: -.286, hipX: .046,
  upArm: .132, loArm: .130, thigh: .176, shin: .174,
  wUpper: .0185, wLower: .0140, wThigh: .0260, wShin: .0190
};

const lerp = (a, b, t) => a + (b - a) * t;
const D2R = Math.PI / 180;

function limb(ctx, x0, y0, x1, y1, w0, w1) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0, y0 + ny * w0);
  ctx.lineTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.lineTo(x0 - nx * w0, y0 - ny * w0);
  ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(x1, y1, w1, 0, 6.2832); ctx.fill();
}

/* 沿角度伸出（角度以"向下"为 0，正方向转向 +x） */
function reach(x, y, a, len) {
  return [x + Math.sin(a) * len, y + Math.cos(a) * len];
}

/* 逐段收细的折线（翎子／飘带） */
function ribbon(ctx, pts, w0, w1) {
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    limb(ctx, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1],
      lerp(w0, w1, i / (n - 1)), lerp(w0, w1, (i + 1) / (n - 1)));
  }
}

/* ---------- 头茬：皮影的"头"是插拔件，换头 = 换角色性格 ---------- */
export const HEADS = {
  jin: {
    key: 'jin', name: '方巾', who: '生',
    draw(ctx, hx, hy, r) {
      ctx.beginPath();
      ctx.moveTo(hx - r * 1.12, hy - r * .40);
      ctx.lineTo(hx + r * 1.12, hy - r * .40);
      ctx.lineTo(hx + r * .88, hy - r * 1.30);
      ctx.lineTo(hx - r * .88, hy - r * 1.30);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - r * 1.14, hy - r * 1.26);
      ctx.quadraticCurveTo(hx, hy - r * 1.96, hx + r * 1.14, hy - r * 1.26);
      ctx.quadraticCurveTo(hx, hy - r * 1.52, hx - r * 1.14, hy - r * 1.26);
      ctx.closePath(); ctx.fill();
    }
  },
  bun: {
    key: 'bun', name: '发髻', who: '旦',
    draw(ctx, hx, hy, r) {
      ctx.beginPath(); ctx.ellipse(hx, hy - r * .16, r * 1.10, r * 1.04, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy - r * 1.22, r * .54, 0, 6.2832); ctx.fill();
      ctx.save(); ctx.translate(hx, hy - r * 1.26); ctx.rotate(-.18);
      limb(ctx, -r * 1.34, 0, r * 1.16, 0, .0050, .0040); ctx.restore();
    }
  },
  helm: {
    key: 'helm', name: '盔头 · 翎子', who: '净',
    draw(ctx, hx, hy, r, o) {
      ctx.beginPath();
      ctx.moveTo(hx - r * 1.14, hy - r * .38);
      ctx.quadraticCurveTo(hx, hy - r * 1.96, hx + r * 1.14, hy - r * .38);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy - r * 1.90, r * .20, 0, 6.2832); ctx.fill();
      if (!o.plumes) return;
      const whip = o.plume || 0;                       // 甩翎子：绕根部的摆角
      for (const side of [-1, 1]) {
        const pts = [], N = 9;
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          const ang = side * (.32 + .58 * t) + whip * (0.25 + 1.15 * t);
          const L = r * (.55 + 1.90 * t);
          pts.push([hx + Math.sin(ang) * L, hy - r * 1.60 - Math.cos(ang) * L * .92]);
        }
        ribbon(ctx, pts, r * .062, r * .010);
        for (let i = 2; i <= N - 2; i++) {
          const p = pts[i], q = pts[i - 1];
          const dx = p[0] - q[0], dy = p[1] - q[1];
          const L2 = Math.hypot(dx, dy) || 1;
          const nx = -dy / L2, ny = dx / L2;
          const bl = r * (.30 - .15 * (i / N));
          for (const sgn of [-1, 1]) {
            limb(ctx, p[0], p[1], p[0] + nx * bl * sgn + dx * .6,
              p[1] + ny * bl * sgn + dy * .6, r * .024, r * .005);
          }
        }
      }
    }
  },
  cap: {
    key: 'cap', name: '小圆帽', who: '丑',
    draw(ctx, hx, hy, r) {
      ctx.beginPath(); ctx.ellipse(hx, hy - r * .56, r * 1.04, r * .60, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(hx, hy - r * 1.20, r * .25, 0, 6.2832); ctx.fill();
    }
  },
  feng: {
    key: 'feng', name: '凤冠', who: '旦 · 大礼',
    draw(ctx, hx, hy, r) {
      ctx.beginPath(); ctx.ellipse(hx, hy - r * .22, r * 1.14, r * 1.00, 0, Math.PI, 0); ctx.fill();
      /* 冠体：做成"高冠"——顶在头上拉高到 2.9r，窄而挺，才读得出一顶冠 */
      ctx.beginPath();
      ctx.moveTo(hx - r * 1.50, hy - r * .90);
      ctx.quadraticCurveTo(hx - r * 1.36, hy - r * 2.30, hx - r * .56, hy - r * 2.86);
      ctx.quadraticCurveTo(hx, hy - r * 3.05, hx + r * .56, hy - r * 2.86);
      ctx.quadraticCurveTo(hx + r * 1.36, hy - r * 2.30, hx + r * 1.50, hy - r * .90);
      ctx.lineTo(hx + r * 1.10, hy - r * .72);
      ctx.quadraticCurveTo(hx, hy - r * 1.40, hx - r * 1.10, hy - r * .72);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();                                   // 凤头（冠顶那只鸟）
      ctx.moveTo(hx - r * .40, hy - r * 2.74);
      ctx.quadraticCurveTo(hx + r * .10, hy - r * 3.42, hx + r * .56, hy - r * 2.66);
      ctx.quadraticCurveTo(hx, hy - r * 2.98, hx - r * .40, hy - r * 2.74);
      ctx.closePath(); ctx.fill();
      for (const side of [-1, 1]) {                       // 两侧翘羽
        ctx.beginPath();
        ctx.moveTo(hx + side * r * .34, hy - r * 2.70);
        ctx.quadraticCurveTo(hx + side * r * 1.44, hy - r * 3.05, hx + side * r * 1.72, hy - r * 2.30);
        ctx.quadraticCurveTo(hx + side * 1.10 * r, hy - r * 2.52, hx + side * r * .34, hy - r * 2.70);
        ctx.closePath(); ctx.fill();
      }
      /* 垂珠五串：够粗才看得见（细过 r*0.05 在这个影子里就是一根毛） */
      for (let i = -2; i <= 2; i++) {
        const bx = hx + i * r * .46, sway = i * r * .05;
        limb(ctx, bx, hy - r * 1.74, bx + sway, hy + r * .74, r * .052, r * .030);
        ctx.beginPath(); ctx.arc(bx + sway, hy + r * .82, r * .105, 0, 6.2832); ctx.fill();
        ctx.beginPath(); ctx.arc(bx + sway * .6, hy + r * .18, r * .085, 0, 6.2832); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(hx, hy - r * 2.90, r * .26, 0, 6.2832); ctx.fill();   // 冠顶宝珠
    }
  },
  wang: {
    key: 'wang', name: '王帽', who: '帝王 · 番王',
    draw(ctx, hx, hy, r) {
      ctx.beginPath(); ctx.ellipse(hx, hy - r * .22, r * 1.10, r * 1.00, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath();                                  // 帽体 + 帽沿
      ctx.moveTo(hx - r * 1.22, hy - r * 1.00);
      ctx.lineTo(hx + r * 1.22, hy - r * 1.00);
      ctx.lineTo(hx + r * 1.06, hy - r * 1.70);
      ctx.lineTo(hx - r * 1.06, hy - r * 1.70);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(hx - r * 1.30, hy - r * 1.06, r * 2.60, r * .14);
      for (const side of [-1, 1]) {                      // 双翅
        ctx.beginPath();
        ctx.moveTo(hx + side * r * 1.24, hy - r * 1.42);
        ctx.quadraticCurveTo(hx + side * r * 2.30, hy - r * 1.60, hx + side * r * 2.46, hy - r * 1.10);
        ctx.quadraticCurveTo(hx + side * r * 1.90, hy - r * 1.26, hx + side * r * 1.24, hy - r * 1.20);
        ctx.closePath(); ctx.fill();
      }
      ctx.beginPath(); ctx.arc(hx, hy - r * 1.78, r * .16, 0, 6.2832); ctx.fill();
    }
  }
};

/* ---------- 皮料：驴皮最经典、牛皮厚实、羊皮透亮 ---------- */
export const SKINS = {
  lv: { key: 'lv', name: '驴皮', note: '唐山皮影用驴皮：薄而透，刻口细，影色最"活"。', alpha: 1.00, blur: 1.00, lit: 1.00 },
  niu: { key: 'niu', name: '牛皮', note: '牛皮厚实结实，影色偏沉，适合武戏里分量重的靠旗、大刀。', alpha: 1.00, blur: 1.06, lit: .86 },
  yang: { key: 'yang', name: '羊皮', note: '羊皮薄透，影子边缘更虚、透光更多，最考验刻工——刻过头就破了。', alpha: .96, blur: 1.14, lit: 1.16 }
};

export class Puppet {
  constructor(roleKey) {
    this.roleKey = roleKey;
    this.role = ROLES[roleKey];
    this.phase = 0; this.idle = 0;
    this.x = .5; this.y = .80; this.depth = 0;
    this.vx = 0; this.vy = 0;
    this.bow = 0; this.jump = 0; this.crouch = 0;
    this.spin = 0; this.appear = 0;
    this.prop = null;                 // 行头/道具（可用 setProp 覆盖行当默认值）
    this.actName = ''; this.actT = 0; // 一出戏里被台词点到的反应动作
    this.face = 1;                    // 面向（1 = 面朝右）
    this.headKey = null;              // 头茬（null = 跟行当）
    this.skin = 'lv';                 // 皮料：驴皮 / 牛皮 / 羊皮
    this.beard = false;               // 髯口
    this.plume = { v: 0, x: 0, vel: 0 };   // 翎子的甩动（弹簧）
    this.armSig = { '-1': null, '1': null };  // 手签：单独控某只手臂的目标角
  }

  setRole(k) { this.roleKey = k; this.role = ROLES[k]; this.spin = 1; this.prop = null; this.headKey = null; }
  setProp(k) { this.prop = k || null; }
  setHead(k) { this.headKey = HEADS[k] ? k : null; }
  setSkin(k) { if (SKINS[k]) this.skin = k; }
  setBeard(v) { this.beard = !!v; }
  /* 甩翎子：一次脉冲，之后由弹簧自己回摆 */
  flickPlume(power = 1) { this.plume.vel += .16 * power; }
  /* 手签：把某条手臂单独摆到某个角度（null = 交还给走路摆动） */
  setArm(side, ang) { this.armSig[side > 0 ? '1' : '-1'] = (ang == null ? null : ang); }
  get arms() { return this.armSig; }
  get headInfo() { return HEADS[this.headKey || this.role.hat] || HEADS.jin; }
  get skinInfo() { return SKINS[this.skin] || SKINS.lv; }
  act(name) {
    this.actName = name || '';
    this.actT = name === 'fall' ? 1.3 : 1.0;
    if (name === 'clash' || name === 'swing') this.jump = Math.max(this.jump, .55);
    if (name === 'kick' || name === 'flip') this.jump = Math.max(this.jump, .80);
    if (name === 'plume') this.flickPlume(1.6);
    if (name === 'bow') this.bow = 1;
  }
  get actK() { return Math.min(1, Math.max(0, this.actT)); }

  update(dt, input) {
    const speed = Math.abs(input.vx || 0);
    this.vx = lerp(this.vx, input.vx || 0, .12);
    this.vy = lerp(this.vy, input.vy || 0, .12);
    this.phase += dt * (2.4 + Math.min(speed, 3) * 2.0);
    this.idle += dt;
    this.x = lerp(this.x, input.x, .22);
    this.y = lerp(this.y, input.y, .20);
    this.depth = lerp(this.depth, input.depth ?? 0, .08);
    this.bow = lerp(this.bow, input.bow ? 1 : 0, .18);
    this.jump = Math.max(0, this.jump - dt * 2.2);
    this.crouch = lerp(this.crouch, input.crouch ? 1 : 0, .25);
    this.appear = Math.min(1, this.appear + dt * 1.4);
    if (this.spin > 0) this.spin = Math.max(0, this.spin - dt * 3.0);
    if (this.actT > 0) this.actT = Math.max(0, this.actT - dt * 1.05);
    // 翎子：弹簧 + 阻尼，甩一下会来回摆几趟才停（"翎子功"就是这么回事）
    const pl = this.plume;
    pl.v += pl.vel * dt;
    pl.vel += (-pl.v * 30 - pl.vel * 4.6) * dt;
    if (Math.abs(pl.v) < .002 && Math.abs(pl.vel) < .004) { pl.v = 0; pl.vel = 0; }
    this.face = 1;
  }

  jumpStart() { this.jump = 1; }

  visual(screen) {
    const sk = this.skinInfo;
    return {
      s: this.role.slim || 1,
      scale: screen.h * (.37 + .20 * this.depth) * (this.role.bulk || 1),
      blur: (.4 + this.depth * 3.2) * sk.blur,
      alpha: (.30 + .62 * this.appear) * sk.alpha
    };
  }

  draw(ctx, screen) {
    const { scale, blur, alpha, s } = this.visual(screen);
    const role = this.role;
    const cx = screen.x + this.x * screen.w;
    const baseY = screen.y + this.y * screen.h;
    const walkAmp = Math.min(.50, .16 + Math.abs(this.vx) * .12);
    const ph = this.phase, ph2 = ph + Math.PI;
    const legs = role.legScale || 1;
    const hsc = role.headScale || 1;
    const wm = role.wide || 1;
    const act = this.actName, ak = this.actK;
    const fallK = act === 'fall' ? Math.sin(ak * Math.PI) * .075 : 0;
    const swingK = act === 'swing' ? Math.sin(ak * Math.PI) : 0;
    const clashK = act === 'clash' ? Math.sin(ak * Math.PI) : 0;
    const crouch = this.crouch * .045 + fallK;

    ctx.save();
    ctx.translate(cx, baseY - this.jump * .085 * scale);
    ctx.scale(scale, scale);
    // 短腿行当补足腿长差 → 所有行当踩在同一条台面线上（否则丑会浮空）
    ctx.translate(0, (P.thigh + P.shin) * (1 - legs));
    if (this.spin > 0) ctx.scale(Math.max(.02, Math.abs(Math.cos(this.spin * Math.PI))), 1);
    ctx.rotate((role.lean || 0) + clashK * .14 - swingK * .07);
    ctx.filter = blur > .6 ? `blur(${blur.toFixed(2)}px)` : 'none';
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#140c06';
    ctx.strokeStyle = '#140c06';

    const bob = -Math.abs(Math.sin(ph)) * .010;
    const breathe = Math.sin(this.idle * 1.6) * .004;
    const hipY = P.hipY + bob + crouch + breathe;

    // ---- 身后靠旗（先画，才像背在背后）----
    if (role.flags) this.backFlags(ctx, s, wm, bob);

    // ---- 腿 ----
    if (!role.robe) {
      const thighL = P.thigh * legs, shinL = P.shin * legs;
      const jit = role.jitter ? Math.sin(ph * 1.7) * .02 * role.jitter : 0;
      const akk = this.actK, actN = this.actName;
      const kickK = actN === 'kick' ? Math.sin(akk * Math.PI) : 0;     // 踢腿：前腿踢平
      const splitK = actN === 'split' ? Math.sin(Math.min(1, akk * 1.4) * Math.PI * .5) : 0;  // 劈叉：两腿摊平
      for (const [side, a0] of [[-1, ph], [1, ph2]]) {
        const kx = side * P.hipX * s, ky = hipY;
        const th = walkAmp * Math.sin(a0);
        const cr = 1 - crouch * 2.6;
        if (splitK > .02) {                          // 劈叉：两腿几乎贴在台面上
          const k2 = reach(kx, ky, side * (1.30 + .55 * splitK), thighL * .96);
          const f2 = reach(k2[0], k2[1], side * (1.55 + .35 * splitK), shinL * .92);
          limb(ctx, kx, ky, k2[0], k2[1], P.wThigh, P.wShin * 1.05);
          limb(ctx, k2[0], k2[1], f2[0], f2[1], P.wShin, P.wLower * .95);
          ctx.beginPath();
          ctx.ellipse(f2[0] + side * .013, f2[1] + .007, .029, .0115, 0, 0, 6.2832);
          ctx.fill();
          continue;
        }
        const thKick = (kickK > .02 && side === 1) ? (.55 + 1.05 * kickK) : th;   // 右腿踢出去
        const knee = reach(kx, ky, this.jump > .1 ? thKick * .3 : thKick, thighL * cr);
        const bend = Math.max(0, Math.sin(a0 - .5)) * .5 + (this.jump > .1 ? .85 : 0);
        const foot = reach(knee[0], knee[1], thKick - bend + jit * side, shinL * cr);
        limb(ctx, kx, ky, knee[0], knee[1], P.wThigh, P.wShin * 1.05);
        limb(ctx, knee[0], knee[1], foot[0], foot[1], P.wShin, P.wLower * .95);
        ctx.beginPath();
        ctx.ellipse(foot[0] + side * .013, foot[1] + .007, .029, .0115, 0, 0, 6.2832);
        ctx.fill();
      }
    }

    // ---- 躯干 / 头 / 手臂（作揖时一起俯身）----
    ctx.save();
    ctx.translate(0, P.hipY);
    ctx.rotate(this.bow * 13 * D2R + (role.hunched ? .06 : 0));
    ctx.translate(0, -P.hipY);
    this.torso(ctx, s, bob, crouch, breathe, hipY, wm);
    this.head(ctx, 0, P.headY + bob + crouch + breathe - this.bow * .014, P.headR * hsc, s);
    this.arms(ctx, s, bob, breathe, ph, walkAmp, wm, swingK);
    ctx.restore();

    // ---- 镂空纹样（透光的装饰）----
    ctx.save();
    const g = ctx.createLinearGradient(0, P.headY, 0, P.hipY + .10);
    const lit = this.skinInfo.lit;
    g.addColorStop(0, `rgba(255,240,205,${Math.min(1, .70 * lit)})`);
    g.addColorStop(1, `rgba(255,214,150,${Math.min(1, .34 * lit)})`);
    ctx.fillStyle = g;
    this.cutouts(ctx, s, bob, crouch, breathe, wm);
    ctx.restore();

    ctx.restore();
  }

  /* 靠旗：四面窄旗从肩后斜挑出去（画在躯干之前 → 视觉上在背后） */
  backFlags(ctx, s, wm, bob) {
    const oy = P.shY + .034 + bob;
    for (const [side, ang] of [[-1, .34], [-1, .62], [1, .34], [1, .62]]) {
      const bx = side * P.shX * s * wm * .82;
      const L = .30;
      const tx = bx + side * Math.sin(ang) * L;
      const ty = oy - Math.cos(ang) * L;
      ctx.beginPath();
      ctx.moveTo(bx, oy);
      ctx.quadraticCurveTo(bx + side * Math.sin(ang) * .22,
        oy - Math.cos(ang) * .22 - .018, tx, ty);
      ctx.lineTo(tx - side * .030, ty + .014);
      ctx.quadraticCurveTo(bx + side * .034, oy - .062, bx + side * .020, oy + .012);
      ctx.closePath(); ctx.fill();
    }
  }

  torso(ctx, s, bob, crouch, breathe, hipY, wm) {
    const chestY = P.chestY + bob + breathe;
    const shW = P.shX * s;
    const top = chestY - .050, bot = hipY;
    const wide = (this.role.armor ? .090 : .070) * s * (wm || 1);
    ctx.beginPath();
    ctx.moveTo(-shW - .017, top);
    ctx.quadraticCurveTo(-wide - .017, chestY + .05, -wide, bot + .010);
    ctx.lineTo(wide, bot + .010);
    ctx.quadraticCurveTo(wide + .017, chestY + .05, shW + .017, top);
    ctx.quadraticCurveTo(0, top - .028, -shW - .017, top);
    ctx.closePath(); ctx.fill();

    if (this.role.robe) {
      const sway = Math.sin(this.phase) * .018;
      ctx.beginPath();
      ctx.moveTo(-wide * 1.02, bot);
      ctx.quadraticCurveTo(-wide * 1.72 + sway, bot + .10, -wide * 1.86 + sway, bot + .172);
      ctx.lineTo(wide * 1.86 + sway, bot + .172);
      ctx.quadraticCurveTo(wide * 1.72 + sway, bot + .10, wide * 1.02, bot);
      ctx.closePath(); ctx.fill();
      for (const bx of [-.028, .032]) {
        ctx.beginPath();
        ctx.ellipse(bx + sway * .6, bot + .178, .029, .011, 0, 0, 6.2832); ctx.fill();
      }
    }
    if (this.role.armor) {
      for (let i = 0; i < 3; i++) {
        const yy = chestY + .006 + i * .028;
        ctx.beginPath();
        ctx.moveTo(-wide * .90, yy);
        ctx.quadraticCurveTo(0, yy + .026, wide * .90, yy);
        ctx.quadraticCurveTo(0, yy + .004, -wide * .90, yy);
        ctx.closePath(); ctx.fill();
      }
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * (shW * (wm || 1) + .008), top + .012, .027, .019, side * .28, 0, 6.2832);
        ctx.fill();
      }
    }
  }

  arms(ctx, s, bob, breathe, ph, walkAmp, wm, swingK = 0) {
    const role = this.role;
    const prop = this.prop || role.prop;
    const sy = P.shY + bob + breathe;
    for (const [side, a0] of [[-1, ph + Math.PI], [1, ph]]) {
      const sx = P.shX * s * side * (wm > 1 ? 1.06 : 1);
      const sweep = swingK * side * 1.35;            // 换势：双臂横扫
      const sig = this.armSig[side > 0 ? '1' : '-1'];   // 手签：这一只手臂被单独指定了角度
      const swingA = sig == null
        ? walkAmp * Math.sin(a0) * .85 + side * .10 + sweep * .55
        : sig + side * .10 + sweep * .35;
      const sw = reach(sx, sy, swingA, P.upArm);
      if (prop === 'sleeve') {
        const elbow = reach(sw[0], sw[1], -.22 + Math.sin(a0) * .45 + sweep * .5, P.loArm * .85);
        limb(ctx, sx, sy, sw[0], sw[1], P.wUpper, P.wLower * 1.12);
        const tail = reach(elbow[0], elbow[1], .16 + Math.sin(ph * .9 + side) * .55 + sweep * .7, P.loArm * 1.35);
        limb(ctx, elbow[0], elbow[1], tail[0], tail[1], P.wLower * .95, P.wLower * .30);
      } else if (prop === 'fan' && side === 1) {
        const elbow = reach(sw[0], sw[1], -.40 + Math.sin(a0) * .30 + sweep * .5, P.loArm * .95);
        limb(ctx, sx, sy, sw[0], sw[1], P.wUpper, P.wLower * 1.05);
        limb(ctx, sw[0], sw[1], elbow[0], elbow[1], P.wLower, P.wLower * .82);
        ctx.save();
        ctx.translate(elbow[0], elbow[1]);
        ctx.rotate(-.70 + Math.sin(ph) * .10 + sweep * .5);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, .105, -1.30, -.02);
        ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, .015, 0, 6.2832); ctx.fill();
        ctx.restore();
      } else if (prop === 'blade' && side === 1) {
        // 武戏 · 大刀（握在右手，随换势横挥）
        const elbow = reach(sw[0], sw[1], -.34 + Math.sin(a0) * .26 + sweep * .55, P.loArm * .92);
        limb(ctx, sx, sy, sw[0], sw[1], P.wUpper, P.wLower * 1.05);
        limb(ctx, sw[0], sw[1], elbow[0], elbow[1], P.wLower, P.wLower * .86);
        ctx.save();
        ctx.translate(elbow[0], elbow[1]);
        ctx.rotate(-1.05 + sweep * .9 + Math.sin(ph * 1.2) * .05);
        ctx.fillRect(-.010, -.010, .230, .020);                       // 刀杆
        ctx.beginPath();                                              // 刀头（弯月）
        ctx.moveTo(.215, -.022);
        ctx.quadraticCurveTo(.320, -.050, .352, .004);
        ctx.quadraticCurveTo(.318, .056, .215, .024);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();                                              // 刀镡
        ctx.ellipse(.196, 0, .012, .026, 0, 0, 6.2832); ctx.fill();
        ribbon(ctx, [[-.012, .006], [-.060, .030], [-.088, .004], [-.062, -.024]], .006, .002); // 刀缨
        ctx.restore();
      } else if (prop === 'basket' && side === -1) {
        // 滑稽戏 · 竹篮（左手拎着）
        const elbow = reach(sw[0], sw[1], -.18 + Math.sin(a0) * .28 + sweep * .5, P.loArm * .95);
        limb(ctx, sx, sy, sw[0], sw[1], P.wUpper, P.wLower * 1.05);
        limb(ctx, sw[0], sw[1], elbow[0], elbow[1], P.wLower, P.wLower * .82);
        ctx.save();
        ctx.translate(elbow[0], elbow[1]);
        ctx.rotate(-.10 + Math.sin(ph) * .08 + sweep * .35);
        ribbon(ctx, [[0, 0], [0, .050]], .004, .004);                 // 提梁
        ctx.beginPath();
        ctx.moveTo(-.052, .050); ctx.lineTo(.052, .050);
        ctx.lineTo(.038, .128); ctx.lineTo(-.038, .128);
        ctx.closePath(); ctx.fill();                                  // 篮身
        for (let i = 1; i <= 2; i++) ctx.fillRect(-.046, .050 + i * .026, .092, .0035);
        ctx.restore();
      } else if (prop === 'umbrella' && side === 1) {
        const elbow = reach(sw[0], sw[1], -.30 + Math.sin(a0) * .28 + sweep * .5, P.loArm * .92);
        limb(ctx, sx, sy, sw[0], sw[1], P.wUpper, P.wLower * 1.05);
        limb(ctx, sw[0], sw[1], elbow[0], elbow[1], P.wLower, P.wLower * .86);
        ctx.save();
        ctx.translate(elbow[0], elbow[1]);
        ctx.rotate(-.9 + sweep * .7);
        ctx.fillRect(-.007, -.235, .014, .245);
        ctx.beginPath();
        ctx.moveTo(-.150, -.230);
        ctx.quadraticCurveTo(0, -.330, .150, -.230);
        ctx.quadraticCurveTo(0, -.190, -.150, -.230);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        const elbow = reach(sw[0], sw[1], -.16 + Math.sin(a0) * .30 + sweep * .4, P.loArm * .95);
        limb(ctx, sx, sy, sw[0], sw[1], P.wUpper, P.wLower * 1.05);
        limb(ctx, sw[0], sw[1], elbow[0], elbow[1], P.wLower, P.wLower * .82);
      }
    }
  }

  head(ctx, hx, hy, r, s) {
    limb(ctx, hx, hy + r * .45, hx, P.neckY + .014, .0128, .0146);
    ctx.beginPath(); ctx.arc(hx, hy, r, 0, 6.2832); ctx.fill();
    const H = this.headInfo;
    H.draw(ctx, hx, hy, r, { plumes: this.role.plumes, plume: this.plume.v });
    if (this.beard) {                       // 髯口：从下巴垂下来的一绺，跟着甩翎子一起摆
      const sw = this.plume.v * .5;
      ribbon(ctx, [[hx - r * .30, hy + r * .80], [hx - r * .34 + sw, hy + r * 1.5],
        [hx - r * .18 + sw * 1.5, hy + r * 2.1], [hx + r * .18 + sw * 1.5, hy + r * 2.2],
        [hx + r * .34 + sw, hy + r * 1.4], [hx + r * .30, hy + r * .80]], r * .30, r * .22);
    }
  }

  cutouts(ctx, s, bob, crouch, breathe, wm) {
    const chestY = P.chestY + bob + breathe;
    const wide = (this.role.armor ? .090 : .070) * s * (wm || 1);
    const top = chestY - .048, bot = P.hipY + crouch;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-wide * 1.06, top, wide * 2.12, (bot - top) + .07);
    ctx.clip();
    ctx.beginPath(); ctx.arc(0, top + .012, .015, 0, 6.2832); ctx.fill();
    ctx.fillRect(-.0015, top + .028, .0030, (bot - top) - .018);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(.013, top + .044 + i * .026, .0036, 0, 6.2832); ctx.fill();
    }
    // 胸前云头（让镂空"透光"读得出来）
    for (const [cx0, cy0, sc] of [[-.014, bot - .052, 1.0], [.014, bot - .052, .82]]) {
      ctx.beginPath();
      ctx.arc(cx0, cy0, .0125 * sc, Math.PI * .15, Math.PI * .85);
      ctx.arc(cx0 + .0135 * sc, cy0 - .009 * sc, .0090 * sc, Math.PI * .95, Math.PI * .30);
      ctx.arc(cx0 + .0135 * sc, cy0 + .009 * sc, .0090 * sc, Math.PI * .70, Math.PI * .05, true);
      ctx.closePath(); ctx.fill();
    }
    // 回纹边（袖口位置各一道）
    for (const sx of [-1, 1]) {
      ctx.fillRect(sx * (wide * .52) - .0022, top + .040, .0044, (bot - top) - .050);
    }
    if (this.role.robe) {
      const sway = Math.sin(this.phase) * .018;
      for (let i = -2; i <= 2; i++) {
        const bx = i * .029 + sway;
        ctx.beginPath();
        ctx.arc(bx, bot + .115, .0098, Math.PI * 1.05, Math.PI * 1.95);
        ctx.lineTo(bx + .011, bot + .115);
        ctx.closePath(); ctx.fill();
      }
    }
    if (this.role.armor) {
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(-wide * .84, chestY + .022 + i * .028, wide * 1.68, .0024);
      }
      ctx.beginPath();
      ctx.arc(0, chestY + .006, .018, Math.PI * .15, Math.PI * .85, true);
      ctx.lineTo(0, chestY + .006);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}
