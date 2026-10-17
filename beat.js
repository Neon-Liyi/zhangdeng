/* 《掌灯》点板引擎 —— "七紧八慢九消停"
   老艺人靠鼓点带节奏：七下要快、八下要稳、九下要停住亮相。
   这里把口诀做成可玩的判定：
   · 一句板 = 七紧（快）+ 八慢（稳）+ 九消停（慢、末拍要停住）
   · 观众/玩家在拍点附近出手（捏/握/挥/挑）→ 算"对板"，影人使个漂亮身段
   · 出手偏了 → 影子会抖、会散（节奏错了影子就散了）
   纯逻辑，声音与画面通过 hooks 回调用方。 */

export const PATTERNS = {
  /* 七紧八慢九消停：三段不同的拍距 */
  classic: { name: '七紧八慢九消停', sections: [[7, .30], [8, .46], [9, .62]] },
  /* 武场：更急，收得更狠 */
  wu: { name: '武场 · 急急风', sections: [[9, .22], [6, .38]] },
  /* 文场：慢，讲究"稳" */
  wen: { name: '文场 · 慢板', sections: [[5, .62], [7, .78]] }
};

export function createBeat(hooks = {}) {
  const H = { onBeat: () => {}, onHit: () => {}, onMiss: () => {}, onPhrase: () => {}, onWobble: () => {}, ...hooks };
  let pat = PATTERNS.classic, running = false, idx = 0, timer = 0, hold = 0;
  let phrase = 0, hits = 0, misses = 0, wobble = 0;
  /* 展开成拍点表：{t 相对句首, heavy 是否重拍} */
  let grid = [], total = 0;
  function build() {
    grid = []; let t = 0;
    for (const [n, dur] of pat.sections) {
      for (let i = 0; i < n; i++) { grid.push({ t, heavy: i === n - 1, sec: t }); t += dur; }
    }
    total = t;
    H.onPhrase && H.onPhrase({ pattern: pat, beats: grid.length, duration: total, phrase, hits, misses });
  }
  build();

  const api = {
    get running() { return running; },
    get pattern() { return pat; },
    get beats() { return grid.length; },
    get index() { return idx; },
    get phrase() { return phrase; },
    get hits() { return hits; },
    get misses() { return misses; },
    get wobble() { return wobble; },
    /* 判定容差：拍距的 28%，最小 .10 秒 */
    tolerance() { return Math.max(.10, (grid[Math.min(idx, grid.length - 1)] ? .30 : .30) * .28); },
    setPattern(k) { if (PATTERNS[k]) { pat = PATTERNS[k]; build(); } },
    start(k) {
      if (k) api.setPattern(k);
      running = true; idx = 0; timer = 0; hits = 0; misses = 0;
    },
    stop() { running = false; },
    reset() { phrase = 0; hits = 0; misses = 0; wobble = 0; idx = 0; timer = 0; },
    /* 每帧推进；到拍点就响板 */
    tick(dt) {
      if (wobble > 0) wobble = Math.max(0, wobble - dt * .9);
      if (!running) return;
      timer += dt;
      const beat = grid[idx];
      if (!beat) return;
      if (timer >= beat.t) {
        H.onBeat({ i: idx, of: grid.length, heavy: beat.heavy, phrase });
        idx++;
        if (idx >= grid.length) {                 // 一句板走完
          phrase++;
          /* 末拍"消停"：要求停住——这一拍出手反而算抢板 */
          const score = { phrase: phrase - 1 + 1, hits, misses };
          H.onPhrase(score);
          idx = 0; timer = 0;
        }
      }
    },
    /* 出手判定：在拍点容差内 → 对板；否则记一次"抢/漏" */
    hit(name) {
      if (!running) return null;
      let best = null, bd = 1e9;
      for (let i = Math.max(0, idx - 1); i < Math.min(grid.length, idx + 2); i++) {
        const d = Math.abs(timer - grid[i].t);
        if (d < bd) { bd = d; best = i; }
      }
      if (best == null) return null;
      const near = Math.abs(timer - (grid[best] ? grid[best].t : 0));
      const tol = Math.max(.10, .13);
      if (near <= tol) { hits++; H.onHit({ name, i: best, of: grid.length, d: near }); return true; }
      misses++; wobble = Math.min(1, wobble + .55);
      H.onMiss({ name, d: near, wobble });
      H.onWobble({ wobble });
      return false;
    },
    /* 强行抖一下（用在"该停没停"） */
    shake(amount = .4) { wobble = Math.min(1, wobble + amount); H.onWobble({ wobble }); }
  };
  return api;
}
