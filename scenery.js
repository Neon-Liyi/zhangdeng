/* 《掌灯》布景 / 戏台 / 氛围 —— 全部 Canvas 路径原创绘制（无外部图片素材）
   所有景片都画在幕布裁剪区内，和影人同属"影子"，只是更淡、更远。
   层次：远山 → 主景片 → 近景（桌案/芦苇）→ 氛围粒子
   灯光 mood 会改幕布底色与粒子种类（火/月/暮）。 */

export const MOODS = {
  lamp: { name: '灯', top: [255, 241, 208], mid: [246, 214, 158], low: [196, 150, 92], p: 'dust' },
  fire: { name: '火', top: [255, 226, 176], mid: [238, 168, 108], low: [150, 84, 58], p: 'spark' },
  moon: { name: '月', top: [222, 234, 250], mid: [176, 200, 226], low: [104, 128, 166], p: 'mist' },
  dusk: { name: '暮', top: [255, 214, 170], mid: [226, 152, 128], low: [112, 76, 96], p: 'leaf' }
};

const lerp = (a, b, t) => a + (b - a) * t;
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/* 影子色：近黑，带一点暖 */
const INK = [22, 13, 6];
const shade = (a) => rgba(INK, a);

/* ---------- 通用零件 ---------- */
function blob(ctx, pts, a) {                       // 闭合贝塞尔块
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  ctx.closePath();
  ctx.fillStyle = shade(a);
  ctx.fill();
}

function band(ctx, x, y, w, h, a, sd = 0) {        // 带一点起伏的横条（城墙/水面/台面）
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    ctx.lineTo(x + w * t, y + Math.sin(t * 6.2 + sd) * h * .16);
  }
  ctx.lineTo(x + w, y + h);
  for (let i = 8; i >= 0; i--) {
    const t = i / 8;
    ctx.lineTo(x + w * t, y + h + Math.sin(t * 5.1 + sd) * h * .10);
  }
  ctx.closePath();
  ctx.fillStyle = shade(a);
  ctx.fill();
}

function trunk(ctx, x, y, h, w, a, sd = 0) {       // 树干（带弯曲）
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * .5 + Math.sin(sd) * w * .8, y - h * .55, x - w * .72, y - h);
  ctx.lineTo(x + w * .72, y - h);
  ctx.quadraticCurveTo(x + w * .5 + Math.sin(sd) * w * .8, y - h * .55, x + w, y);
  ctx.closePath();
  ctx.fillStyle = shade(a);
  ctx.fill();
}

function pine(ctx, x, y, h, w, a, sd) {            // 松：三层塔状
  trunk(ctx, x, y, h * .42, w * .10, a, sd);
  for (let i = 0; i < 3; i++) {
    const t = i / 2, yy = y - h * (.36 + .30 * t), ww = w * (1 - .22 * t);
    ctx.beginPath();
    ctx.moveTo(x, yy - h * .34);
    ctx.quadraticCurveTo(x + ww * .55, yy - h * .06, x + ww, yy + h * .04);
    ctx.quadraticCurveTo(x + ww * .30, yy + h * .02, x, yy + h * .07);
    ctx.quadraticCurveTo(x - ww * .30, yy + h * .02, x - ww, yy + h * .04);
    ctx.quadraticCurveTo(x - ww * .55, yy - h * .06, x, yy - h * .34);
    ctx.closePath();
    ctx.fillStyle = shade(a);
    ctx.fill();
  }
}

function bamboo(ctx, x, y, h, a, sd) {             // 竹：三五竿 + 叶
  for (let k = 0; k < 3; k++) {
    const dx = (k - 1) * h * .07, hh = h * (1 - Math.abs(k - 1) * .16);
    const bend = Math.sin(sd + k) * h * .05;
    ctx.beginPath();
    ctx.moveTo(x + dx - h * .012, y);
    ctx.quadraticCurveTo(x + dx + bend * .5 - h * .012, y - hh * .55, x + dx + bend - h * .007, y - hh);
    ctx.lineTo(x + dx + bend + h * .007, y - hh);
    ctx.quadraticCurveTo(x + dx + bend * .5 + h * .012, y - hh * .55, x + dx + h * .012, y);
    ctx.closePath();
    ctx.fillStyle = shade(a);
    ctx.fill();
    for (let i = 1; i <= 4; i++) {                 // 竹节
      const yy = y - hh * (i / 5);
      ctx.fillRect(x + dx + bend * (i / 5) - h * .020, yy, h * .040, h * .007);
    }
    for (let i = 0; i < 5; i++) {                  // 叶
      const ang = -0.5 - i * .42 + Math.sin(sd + i) * .12;
      const L = h * (.16 + (i % 3) * .05);
      const bx = x + dx + bend * .9, by = y - hh * (.62 + i * .07);
      ctx.save();
      ctx.translate(bx, by); ctx.rotate(ang);
      ctx.beginPath();
      ctx.ellipse(L * .5, 0, L * .5, h * .014, 0, 0, 6.2832);
      ctx.fillStyle = shade(a); ctx.fill();
      ctx.restore();
    }
  }
}

function willow(ctx, x, y, h, a, sd) {             // 柳：垂条带叶
  trunk(ctx, x, y, h * .55, h * .035, a, sd);
  for (let i = 0; i < 9; i++) {
    const sx = x + (i - 4) * h * .072, sway = Math.sin(sd * 1.1 + i * .7) * h * .03;
    const tipX = sx + sway * 3, tipY = y - h * .02 + (i % 3) * h * .015;
    ctx.beginPath();
    ctx.moveTo(sx, y - h * .52);
    ctx.quadraticCurveTo(sx + sway * 2 - h * .02, y - h * .28, tipX, tipY);
    ctx.lineWidth = h * .0075; ctx.strokeStyle = shade(a); ctx.stroke();
    for (let k = 1; k <= 4; k++) {                                   // 叶：沿垂条点小叶
      const t = k / 5;
      const lx = lerp(sx, tipX, t) - h * .01, ly = lerp(y - h * .52, tipY, t);
      ctx.save();
      ctx.translate(lx, ly); ctx.rotate(-.9 + Math.sin(sd + i + k) * .5);
      ctx.beginPath();
      ctx.ellipse(h * .012, 0, h * .014, h * .0055, 0, 0, 6.2832);
      ctx.fillStyle = shade(a * .92); ctx.fill();
      ctx.restore();
    }
  }
}

function reeds(ctx, x, y, h, a, sd, n = 7) {       // 芦苇：叶+穗
  for (let i = 0; i < n; i++) {
    const sx = x + (i - n / 2) * h * .045, hh = h * (.62 + (i % 3) * .16);
    const bend = Math.sin(sd * .9 + i) * h * .035;
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.quadraticCurveTo(sx + bend * .5, y - hh * .55, sx + bend, y - hh);
    ctx.lineWidth = h * .006; ctx.strokeStyle = shade(a * .85); ctx.stroke();
    ctx.save();                                                     // 穗
    ctx.translate(sx + bend, y - hh); ctx.rotate(bend * .02);
    ctx.beginPath();
    ctx.ellipse(0, -h * .018, h * .008, h * .022, 0, 0, 6.2832);
    ctx.fillStyle = shade(a * .95); ctx.fill();
    ctx.restore();
    for (let k = 0; k < 2; k++) {                                   // 叶
      const ly = y - hh * (.45 + k * .28);
      ctx.beginPath();
      ctx.moveTo(sx + bend * .45, ly);
      ctx.quadraticCurveTo(sx + bend * .6 + h * .035, ly - h * .02, sx + bend * .6 + h * .062, ly - h * .05);
      ctx.quadraticCurveTo(sx + bend * .55 + h * .022, ly - h * .028, sx + bend * .45, ly);
      ctx.closePath(); ctx.fillStyle = shade(a * .80); ctx.fill();
    }
  }
}

/* 地平线 + 台面：让影人踩在一条地上，不悬空 */
function ground(ctx, s, a, hz = .845) {
  const { x, y, w, h } = s, gy = y + h * hz;
  ctx.beginPath();                                                  // 近处台面（略深）
  ctx.moveTo(x, gy);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    ctx.lineTo(x + w * t, gy + Math.sin(t * 5 + .8) * h * .0035);
  }
  ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = shade(a * .30); ctx.fill();
  ctx.beginPath();                                                  // 地平线
  ctx.moveTo(x, gy);
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    ctx.lineTo(x + w * t, gy + Math.sin(t * 5 + .8) * h * .0035);
  }
  ctx.lineWidth = Math.max(1, h * .0035); ctx.strokeStyle = shade(a * .62); ctx.stroke();
}

/* ---------- 主景片 ---------- */
const SCENES = {
  /* 城楼：武戏 */
  city(ctx, s, t, a) {
    const { x, y, w, h } = s;
    // 远山（两层 + 山脊）+ 云
    blob(ctx, [[x, y + h * .64], [x + w * .14, y + h * .44], [x + w * .30, y + h * .62],
      [x + w * .48, y + h * .38], [x + w * .66, y + h * .60], [x + w, y + h * .50],
      [x + w, y + h], [x, y + h]], a * .26);
    blob(ctx, [[x, y + h * .70], [x + w * .22, y + h * .56], [x + w * .44, y + h * .68],
      [x + w * .68, y + h * .54], [x + w, y + h * .66], [x + w, y + h], [x, y + h]], a * .20);
    ctx.beginPath();
    for (const [sx0, sy0, sx1, sy1] of [[.14, .44, .22, .58], [.48, .38, .56, .55], [.68, .54, .76, .66]]) {
      ctx.moveTo(x + w * sx0, y + h * sy0);
      ctx.quadraticCurveTo(x + w * (sx0 + .04), y + h * (sy0 + .06), x + w * sx1, y + h * sy1);
    }
    ctx.lineWidth = h * .003; ctx.strokeStyle = shade(a * .28); ctx.stroke();
    // 云
    for (let i = 0; i < 3; i++) {
      const cx = x + w * (.18 + i * .30) + Math.sin(t * .07 + i) * w * .015;
      const cy = y + h * (.16 + (i % 2) * .07);
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * .12, h * .028, 0, 0, 6.2832);
      ctx.ellipse(cx + w * .06, cy - h * .015, w * .07, h * .022, 0, 0, 6.2832);
      ctx.fillStyle = shade(a * .26); ctx.fill();
    }
    // 城墙 + 垛口 + 城门
    const wy = y + h * .58, ww = w * .86, wx = x + w * .07;
    band(ctx, wx, wy, ww, h * .30, a * .62, t * .1);
    for (let i = 0; i < 9; i++) {
      const bx = wx + ww * (i + .18) / 9;
      ctx.fillRect(bx, wy - h * .042, ww / 9 * .52, h * .046);
    }
    ctx.beginPath();                                  // 城门洞（透光）
    ctx.moveTo(x + w * .50 - w * .075, y + h * .88);
    ctx.lineTo(x + w * .50 - w * .075, y + h * .70);
    ctx.quadraticCurveTo(x + w * .50, y + h * .60, x + w * .50 + w * .075, y + h * .70);
    ctx.lineTo(x + w * .50 + w * .075, y + h * .88);
    ctx.closePath();
    ctx.fillStyle = rgba(MOODS.lamp.top, A2(a) * .55); ctx.fill();
    // 城楼 + 飞檐（两端翘起，旗子插在檐角而不是垛口上）
    ctx.fillRect(x + w * .345, wy - h * .098, w * .31, h * .060);
    ctx.beginPath();
    ctx.moveTo(x + w * .282, wy - h * .092);
    ctx.quadraticCurveTo(x + w * .50, wy - h * .216, x + w * .718, wy - h * .092);
    ctx.lineTo(x + w * .694, wy - h * .074);
    ctx.quadraticCurveTo(x + w * .50, wy - h * .188, x + w * .306, wy - h * .074);
    ctx.closePath(); ctx.fillStyle = shade(a * .74); ctx.fill();
    ctx.beginPath();                                        // 宝顶
    ctx.ellipse(x + w * .50, wy - h * .192, w * .010, h * .012, 0, 0, 6.2832);
    ctx.fill();
    for (const [fx, dir] of [[x + w * .318, -1], [x + w * .682, 1]]) {
      const fy = wy - h * .088;                             // 檐角
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - h * .225);
      ctx.lineWidth = h * .008; ctx.strokeStyle = shade(a); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(fx, fy - h * .222);
      ctx.quadraticCurveTo(fx + dir * w * .045, fy - h * .200 + Math.sin(t * 1.2) * h * .006,
        fx + dir * w * .078, fy - h * .186 + Math.sin(t * 1.2 + 1) * h * .012);
      ctx.lineTo(fx + dir * w * .074, fy - h * .144);
      ctx.quadraticCurveTo(fx + dir * w * .040, fy - h * .166, fx, fy - h * .152);
      ctx.closePath(); ctx.fillStyle = shade(a * .85); ctx.fill();
    }
    for (const lx of [x + w * .42, x + w * .58]) {           // 城楼下的两盏灯笼（暖光，带灯芯微颤）
      const ly = wy - h * .150, sw = Math.sin(t * 1.5 + lx) * h * .006;
      const fl = .86 + Math.sin(t * 7.9 + lx * .01) * .07 + Math.sin(t * 13.7 + lx * .02) * .05;
      ctx.beginPath();                                        // 挂绳
      ctx.moveTo(lx, wy - h * .116); ctx.lineTo(lx + sw, ly - h * .028);
      ctx.lineWidth = h * .004; ctx.strokeStyle = shade(a * .8); ctx.stroke();
      const g = ctx.createRadialGradient(lx + sw, ly, 0, lx + sw, ly, h * .082);
      g.addColorStop(0, `rgba(255,158,88,${.44 * fl})`);
      g.addColorStop(.5, `rgba(255,132,66,${.16 * fl})`);
      g.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(lx + sw, ly, h * .082, 0, 6.2832); ctx.fill();
      ctx.beginPath();                                        // 灯身
      ctx.ellipse(lx + sw, ly, h * .024, h * .030, 0, 0, 6.2832);
      ctx.fillStyle = `rgba(196,74,48,${Math.min(1, .86 * fl)})`; ctx.fill();
      ctx.beginPath();
      ctx.ellipse(lx + sw, ly, h * .016, h * .020, 0, 0, 6.2832);
      ctx.fillStyle = `rgba(255,222,150,${Math.min(1, .58 * fl)})`; ctx.fill();
      ctx.fillRect(lx + sw - h * .012, ly - h * .033, h * .024, h * .005);
      ctx.fillRect(lx + sw - h * .010, ly + h * .028, h * .020, h * .005);
    }
    ground(ctx, s, a, .885);
  },
  /* 庭院：旦角做工戏 */
  yard(ctx, s, t, a) {
    const { x, y, w, h } = s;
    band(ctx, x, y + h * .70, w, h * .22, a * .40, 1.4);              // 院墙
    ctx.beginPath();                                                   // 月洞门（透光）
    ctx.arc(x + w * .30, y + h * .70, h * .19, Math.PI, 0);
    ctx.rect(x + w * .30 - h * .19, y + h * .70, h * .38, h * .18);
    ctx.fillStyle = rgba(MOODS.lamp.top, A2(a) * .40); ctx.fill();
    ctx.beginPath();                                                   // 门框
    ctx.arc(x + w * .30, y + h * .70, h * .215, Math.PI, 0);
    ctx.lineWidth = h * .022; ctx.strokeStyle = shade(a * .72); ctx.stroke();
    // 墙头瓦
    for (let i = 0; i <= 14; i++) {
      ctx.fillRect(x + w * i / 14 - w * .008, y + h * .705 - h * .012, w * .016, h * .016);
    }
    bamboo(ctx, x + w * .72, y + h * .90, h * .60, a * .62, t * .3);
    bamboo(ctx, x + w * .80, y + h * .90, h * .48, a * .50, t * .3 + 1.2);
    willow(ctx, x + w * .12, y + h * .90, h * .52, a * .45, t * .25);
    // 石桌石凳
    const tx = x + w * .48, ty = y + h * .88;
    ctx.beginPath(); ctx.ellipse(tx, ty - h * .155, w * .105, h * .020, 0, 0, 6.2832);
    ctx.fillStyle = shade(a * .78); ctx.fill();
    ctx.fillRect(tx - w * .022, ty - h * .155, w * .044, h * .155);
    ctx.beginPath(); ctx.ellipse(tx, ty, w * .062, h * .014, 0, 0, 6.2832); ctx.fill();
    for (const dx of [-w * .155, w * .155]) {
      ctx.beginPath(); ctx.ellipse(tx + dx, ty, w * .042, h * .012, 0, 0, 6.2832); ctx.fill();
      ctx.fillRect(tx + dx - w * .012, ty - h * .052, w * .024, h * .052);
    }
    ground(ctx, s, a, .905);
  },
  /* 小桥：丑角滑稽戏 */
  bridge(ctx, s, t, a) {
    const { x, y, w, h } = s;
    // 远山两层 + 山脊纹理
    blob(ctx, [[x, y + h * .60], [x + w * .16, y + h * .40], [x + w * .34, y + h * .58],
      [x + w * .52, y + h * .34], [x + w * .70, y + h * .56], [x + w, y + h * .46],
      [x + w, y + h], [x, y + h]], a * .26);
    ctx.beginPath();
    for (const [sx0, sy0, sx1, sy1] of [[.16, .40, .24, .55], [.52, .34, .60, .52]]) {
      ctx.moveTo(x + w * sx0, y + h * sy0);
      ctx.quadraticCurveTo(x + w * (sx0 + .04), y + h * (sy0 + .06), x + w * sx1, y + h * sy1);
    }
    ctx.lineWidth = h * .003; ctx.strokeStyle = shade(a * .30); ctx.stroke();
    willow(ctx, x + w * .12, y + h * .90, h * .62, a * .60, t * .22);
    willow(ctx, x + w * .88, y + h * .90, h * .56, a * .54, t * .22 + 1.6);
    reeds(ctx, x + w * .30, y + h * .90, h * .30, a * .50, t * .3, 6);
    reeds(ctx, x + w * .72, y + h * .90, h * .26, a * .46, t * .3 + 2, 5);
    // 水面 + 倒影
    const wy = y + h * .80;
    ctx.beginPath();
    ctx.rect(x, wy, w, h * .20);
    ctx.fillStyle = `rgba(${MOODS.lamp.top[0]},${MOODS.lamp.top[1]},${MOODS.lamp.top[2]},${A2(a) * .16})`;
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const yy = wy + h * (.022 + i * .028);
      ctx.moveTo(x, yy);
      for (let k = 0; k <= 16; k++) {
        const t2 = k / 16;
        ctx.lineTo(x + w * t2, yy + Math.sin(t2 * 11 + t * (.9 + i * .22) + i) * h * .007);
      }
    }
    ctx.lineWidth = h * .0055; ctx.strokeStyle = shade(a * .55); ctx.stroke();
    // 拱桥（桥面 + 桥洞 + 栏板）
    const bl = x + w * .28, br = x + w * .72, bs = y + h * .90;
    ctx.beginPath();
    ctx.moveTo(bl, bs);
    ctx.bezierCurveTo(x + w * .34, y + h * .50, x + w * .66, y + h * .50, br, bs);
    ctx.lineTo(br + w * .012, bs + h * .006);
    ctx.bezierCurveTo(x + w * .665, y + h * .525, x + w * .345, y + h * .525, bl - w * .012, bs + h * .006);
    ctx.closePath(); ctx.fillStyle = shade(a * .82); ctx.fill();
    ctx.beginPath();                                                // 桥洞（透光）
    ctx.moveTo(x + w * .40, bs + h * .006);
    ctx.bezierCurveTo(x + w * .43, y + h * .70, x + w * .57, y + h * .70, x + w * .60, bs + h * .006);
    ctx.closePath();
    ctx.fillStyle = `rgba(${MOODS.lamp.top[0]},${MOODS.lamp.top[1]},${MOODS.lamp.top[2]},${A2(a) * .34})`;
    ctx.fill();
    for (let i = 0; i <= 8; i++) {                                   // 桥栏
      const p = i / 8, bx = lerp(bl, br, p);
      const by = lerp(bs, bs, p) - Math.sin(p * Math.PI) * h * .40;
      ctx.fillRect(bx - w * .0035, by - h * .050, w * .007, h * .052);
    }
    ctx.beginPath();                                                 // 扶手
    ctx.moveTo(bl, bs - h * .40);
    ctx.quadraticCurveTo(x + w * .50, bs - h * .565, br, bs - h * .40);
    ctx.lineWidth = h * .010; ctx.strokeStyle = shade(a * .78); ctx.stroke();
    ground(ctx, s, a, .905);
  },
  /* 山野：自由演 */
  field(ctx, s, t, a) {
    const { x, y, w, h } = s;
    blob(ctx, [[x, y + h * .62], [x + w * .14, y + h * .34], [x + w * .30, y + h * .60],
      [x + w * .46, y + h * .28], [x + w * .64, y + h * .56], [x + w * .82, y + h * .38],
      [x + w, y + h * .60], [x + w, y + h], [x, y + h]], a * .34);
    pine(ctx, x + w * .14, y + h * .90, h * .66, w * .085, a * .62, t * .2);
    pine(ctx, x + w * .26, y + h * .90, h * .48, w * .062, a * .48, t * .2 + 1);
    pine(ctx, x + w * .88, y + h * .90, h * .58, w * .075, a * .55, t * .2 + 2);
    for (let i = 0; i < 10; i++) {                                       // 草
      const gx = x + w * (.06 + i * .096);
      ctx.beginPath();
      ctx.moveTo(gx, y + h * .95);
      ctx.quadraticCurveTo(gx + h * .012, y + h * .90, gx + Math.sin(t * .8 + i) * h * .02, y + h * .86);
      ctx.lineWidth = h * .006; ctx.strokeStyle = shade(a * .45); ctx.stroke();
    }
    ground(ctx, s, a, .93);
  }
};
const A2 = a => Math.min(1, a / .62);

/* ---------- 氛围粒子 ---------- */
function ambience(ctx, s, t, mood, pool) {
  const kind = MOODS[mood].p;
  const { x, y, w, h } = s;
  for (const p of pool) {
    let px, py, al = p.a;
    if (kind === 'spark') {
      const yy = (p.y - t * p.sp * .30) % 1; px = p.x + Math.sin(t * .6 + p.ph) * .012;
      py = yy < 0 ? yy + 1 : yy;
      al *= .85;
    } else if (kind === 'leaf') {
      px = (p.x + t * p.sp * .10) % 1; py = p.y + Math.sin(t * .9 + p.ph) * .02;
      const yy = py % 1;
      py = yy;
    } else {
      px = p.x + Math.sin(t * .18 + p.ph) * .03; py = p.y + Math.cos(t * .13 + p.ph) * .02;
    }
    const X = x + ((px % 1) + 1) % 1 * w, Y = y + ((py % 1) + 1) % 1 * h;
    ctx.fillStyle = rgba(INK, al * .55);
    if (kind === 'spark') {
      ctx.fillStyle = `rgba(255,214,150,${al * .55})`;
      ctx.beginPath(); ctx.arc(X, Y, p.r * .8, 0, 6.2832); ctx.fill();
    } else if (kind === 'leaf') {
      ctx.save(); ctx.translate(X, Y); ctx.rotate(t * .8 + p.ph);
      ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.5, p.r * .5, 0, 0, 6.2832); ctx.fill(); ctx.restore();
    } else {
      ctx.beginPath(); ctx.arc(X, Y, p.r * 1.1, 0, 6.2832); ctx.fill();
    }
  }
}

export function makePool(n = 46) {
  return Array.from({ length: n }, () => ({
    x: Math.random(), y: Math.random(), r: .7 + Math.random() * 2.0,
    sp: .006 + Math.random() * .028, ph: Math.random() * 6.28, a: .18 + Math.random() * .34
  }));
}

/* 幕布内的全部景片（在影人之前调用，仍在幕布裁剪区里） */
export function drawScenery(ctx, s, t, sceneKey, moodKey, pool) {
  const fn = SCENES[sceneKey] || SCENES.field;
  ctx.save();
  ctx.beginPath(); ctx.rect(s.x, s.y, s.w, s.h); ctx.clip();
  fn(ctx, s, t, .62);
  ambience(ctx, s, t, moodKey, pool);
  ctx.restore();
}

/* 幕布之外的戏台：檐幕、上下场门、台面、压边（在影人之后调用） */
export function drawTheatre(ctx, s, t, lampV, names = ['出将', '入相']) {
  const { x, y, w, h } = s;
  const u = Math.min(w, h);
  ctx.save();
  ctx.globalAlpha = .30 + .70 * lampV;
  // 檐幕（横批 + 垂穗）
  const vy = y - u * .085;
  ctx.fillStyle = '#1c1108';
  ctx.beginPath();
  ctx.moveTo(x - u * .06, vy);
  ctx.lineTo(x + w + u * .06, vy);
  ctx.lineTo(x + w + u * .06, y + u * .012);
  for (let i = 0; i <= 26; i++) {
    const p = i / 26;
    ctx.quadraticCurveTo(x + w * p + u * .012, y + u * (.030 + (i % 2) * .012), x + w * (p + .038), y + u * .012);
  }
  ctx.lineTo(x - u * .06, y + u * .012);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(232,192,122,.20)'; ctx.lineWidth = 1;
  ctx.stroke();
  // 上下场门（出将 / 入相）
  for (let i = 0; i < 2; i++) {
    const left = i === 0, mx = left ? x - u * .055 : x + w + u * .055;
    const mw = u * .052, mh = h * .40;
    ctx.fillStyle = 'rgba(46,28,14,.96)';
    ctx.fillRect(mx - mw, vy + u * .030, mw * 2, mh);
    ctx.strokeStyle = 'rgba(232,192,122,.40)'; ctx.lineWidth = 1.2;
    ctx.strokeRect(mx - mw, vy + u * .030, mw * 2, mh);
    ctx.strokeStyle = 'rgba(232,192,122,.16)';
    ctx.strokeRect(mx - mw + u * .010, vy + u * .042, mw * 2 - u * .020, mh - u * .024);
    ctx.save();
    ctx.translate(mx, vy + u * .030 + mh * .30);
    ctx.fillStyle = 'rgba(232,192,122,.72)';
    ctx.font = `${Math.max(11, u * .028)}px "STKaiti","KaiTi",serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let k = 0; k < 2; k++) ctx.fillText(names[i][k], 0, k * u * .040);
    ctx.restore();
  }
  // 台面
  ctx.fillStyle = 'rgba(14,8,4,.95)';
  ctx.fillRect(x - u * .09, y + h, w + u * .18, Math.max(4, u * .016));
  ctx.restore();
}
