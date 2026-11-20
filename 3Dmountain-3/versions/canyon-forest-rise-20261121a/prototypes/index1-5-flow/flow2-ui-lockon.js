/* Flow2 lock-on labels (2026-11-11): for index1-5-flow2.html only, with the fourth interface (flow2-hud.js, html[data-flow2-hud="4"]).
   Client: 「山谷的標籤可以改成類似圖一這種風格嗎 好像軍事戰機鎖定掃描風」. The reference picture: thin square boxes on the targets, a small pair
   of numbers in each box's top-left corner, dashed lines joining the boxes.

   Two sets of labels are drawn that way, in this page's own type and colours (pale blue and white hairlines, no red, nothing that blinks):
   - the canyon's three river marks (01 INSIGHT / 02 STRATEGY / 03 VALUE), which the page's atlas script places every frame
   - FOUR PATHS' four strategy tags, which alpine-ui.js places (shared with flow and flow3: not edited, only read)
   Neither script is changed. Each still decides where its marks are and when they show; this file reads that from the marks themselves
   (their transform, their visibility) when they change, hides their old drawing (flow2-ui-lockon.css) and draws its own on the same point:
     the box       a square of hairline centred on the point, its corners drawn heavier, the point itself in the middle
     the readout   the point's place on the screen, across and down, in hundredths (16, 67), written in the box's top-left corner.
                   Real numbers: they follow the mark while the camera moves, at most seven times a second, and stand still when it does
     the label     above the box on its left edge; if something is in the way (the title, another box, a link, the screen's edge) the
                   other corners and the two sides are tried in turn, and the label keeps the place it has for as long as that place is free
     the links     one dashed line from each target to the next in order, from box edge to box edge
   Arrival, once per target: the box closes onto the point, the readout resolves out of changing digits (flow2-feel.js's decode), the
   label and the link come up. After that everything is still. With reduced motion nothing of that plays.

   Nothing runs per frame by itself: the work is done when a mark changes (a MutationObserver), and what must be measured (the title
   block, the two edges' furniture) is measured at most three times a second.
   FOUR PATHS, second pass (2026-11-11, 「4個項目設計 幫我再思考看看有沒有更好的設計」). What was wrong with the four: at some window
   sizes one of them had no box (a dark plate instead: the river point alpine-ui.js picks suits ITS card, and at 1868×960 it lay
   under the title's words); their names were the smallest type on the screen though they are the chapter's whole content; each
   label hung on whichever corner was free, some of them on bright water. Now the four are one family:
     - the river point is this file's own: each river's own curve is walked on the screen and the place taken that is in sight
       (not behind a ridge), clear of the title and the edges' furniture, and nearest to where that river's box sits best (survey())
     - every strategy is the same unit, a FLAG: the box on the river, and its name on a hairline pole that continues one side
       of the box, above it or below; the name is the larger type, its number in the accent, the English under it
     - a name never stands on water (the rivers are known on the screen, and are kept clear like the title is)
     - the dashed line runs through all four in order, and on arrival two hairlines sweep in to the point once (the lock)
   NOT ADOPTED: asked to see a better design, the client looked at this one and asked for the four to be put back as they were.
   The page draws the first pass; ?paths=2 shows this one.
   ?lockon=0 leaves both sets of labels as they were. Live: window.__FLOW2_LOCKON__ = { groups, refresh } */
(() => {
  const q = new URLSearchParams(location.search), html = document.documentElement;
  if (q.get('lockon') === '0' || html.dataset.flow2Hud !== '4') return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const two = v => String(Math.max(0, Math.min(99, Math.round(v)))).padStart(2, '0');
  const half = v => Math.round(v * 2) / 2;
  const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  /* does the segment cross the box (Liang-Barsky) */
  function crosses(g, b) {
    let t0 = 0, t1 = 1; const dx = g.x2 - g.x1, dy = g.y2 - g.y1;
    for (const [p, r] of [[-dx, g.x1 - b.l], [dx, b.r - g.x1], [-dy, g.y1 - b.t], [dy, b.b - g.y1]]) {
      if (p === 0) { if (r < 0) return false; continue; }
      const t = r / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
    return true;
  }
  html.dataset.flow2Lockon = 'on';
  /* The second pass was shown and not taken (「四個項目幫我改回去原本的」, the same afternoon): the page draws the four as the first pass
     did. The family is kept behind ?paths=2 for comparison only. */
  const FAMILY = q.get('paths') === '2';
  if (FAMILY) html.dataset.flow2Paths = 'family';

  /* ---- what the labels must keep clear of: the title block's words, and the furniture of the two edges ---- */
  let obstacles = [], measuredAt = -1e9, settle = 0;
  const range = document.createRange();
  function measure(now) {
    measuredAt = now; obstacles = [];
    const ui = document.querySelector('.finnovation-ui'); if (!ui) return;
    const add = (r, pad, copy) => { if (r.width > 0 && r.height > 0) obstacles.push({ l: r.left - pad, r: r.right + pad, t: r.top - pad, b: r.bottom + pad, copy: !!copy }); };
    const panel = ui.querySelector('.fi-copy-panel.is-active');
    if (panel) {
      /* the words themselves, not their full-width boxes: a target may stand beside a short title */
      for (const n of panel.querySelectorAll('.fi-copy-kicker, h1, h2, .fi-copy-zh')) {
        range.selectNodeContents(n); const r = range.getBoundingClientRect();
        let chip = 0;
        if (n.classList.contains('fi-copy-kicker') && r.width > 0) {
          /* the chip before the kicker's words is drawn by the stylesheet (::before): it is not in the words' box */
          const b = getComputedStyle(n, '::before');
          if (b.content && b.content !== 'none' && b.content !== 'normal') chip = ['width', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth', 'marginLeft', 'marginRight'].reduce((s, k) => s + (parseFloat(b[k]) || 0), 0) + (parseFloat(getComputedStyle(n).columnGap) || 0);
        }
        add({ left: r.left - chip, right: r.right, top: r.top, bottom: r.bottom, width: r.width + chip, height: r.height }, 10, true);
      }
      const action = panel.querySelector('.fi-copy-action'); if (action) add(action.getBoundingClientRect(), 10, true);
    }
    /* the right column piece by piece: its own box is as wide as its longest line, and mostly empty */
    for (const n of ui.querySelectorAll('.fi-brand, #flow2-menu-toggle, #flow2-header-sound, .fi-rail > [data-section], .f2u-cap, .f2u-where, .f2u-name, .f2u-track, .f2u-flow, .f2u-next')) add(n.getBoundingClientRect(), 8);
  }

  /* ---- a group of targets: its layer, its links ---- */
  const groups = [];
  function group(kind, host) {
    const layer = el('div', 'f2u-lock'); layer.dataset.kind = kind; layer.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'f2u-lk-links'); svg.setAttribute('focusable', 'false');
    layer.append(svg); host.append(layer);
    const family = FAMILY && kind === 'paths';
    const G = { kind, layer, svg, family, targets: [], links: [], half: 23, gap: family ? 0 : 7, w: innerWidth, h: innerHeight, sized: false, read: null, water: [], spots: null, surveyed: '' };
    if (family) layer.dataset.family = '';
    groups.push(G);
    return G;
  }
  function target(G, parts) {
    const node = el('div', 'f2u-lk'), box = el('span', 'f2u-lk-box'), xy = el('span', 'f2u-lk-xy'), label = el('span', 'f2u-lk-label');
    box.append(el('b', 'f2u-lk-frame'), xy, el('i'));
    if (G.family) node.append(el('span', 'f2u-lk-scan'));
    label.append(...parts); node.append(box, label); node.dataset.at = 'tl'; G.layer.append(node);
    const t = { node, xy, label, want: false, on: false, floating: false, locked: false, tx: 0, ty: 0, x: NaN, y: NaN, lw: 0, lh: 0, at: 'tl', text: '', wrote: -1e9, pending: 0, off: -1e9 };
    G.targets.push(t);
    if (G.targets.length > 1) { const line = document.createElementNS(NS, 'line'); G.svg.append(line); G.links.push({ line, on: false, key: '' }); }
    return t;
  }
  /* the box's size comes from the stylesheet (it changes with the window); the labels are measured where they stand */
  /* PERF (2026-11-21, rise page; ?perf=0 = as before): a group whose labels cannot all be measured (a label without words has no width) was
     measured again on every update = every frame of the canyon, each time forcing style + layout in mid-frame. Now such a group is measured
     again only when the set of wanted targets changes, or at most every 400 ms; resize and font load still measure at once (refresh). */
  const PERF_SIZE = document.documentElement.hasAttribute('data-rise-studio-pbr') && new URLSearchParams(location.search).get('perf') !== '0';
  function sizeDue(G) {
    if (!PERF_SIZE) return true;
    let key = ''; for (const t of G.targets) key += t.want ? '1' : '0';
    const now = performance.now();
    if (key === G.sizeKey && now - (G.sizeAt || -1e9) < 400) return false;
    G.sizeKey = key; G.sizeAt = now; return true;
  }
  function size(G) {
    const v = parseFloat(getComputedStyle(G.layer).getPropertyValue('--f2u-lk'));
    G.half = (Number.isFinite(v) && v > 0 ? v : 46) / 2; G.w = innerWidth; G.h = innerHeight;
    for (const t of G.targets) { t.lw = t.label.offsetWidth; t.lh = t.label.offsetHeight; }
    G.sized = G.targets.every(t => t.lw > 0);
  }
  function labelBox(G, t, at) {
    const s = G.half, g = G.gap, w = t.lw, h = t.lh, x = t.x, y = t.y;
    if (at === 'tl') return { l: x - s, r: x - s + w, t: y - s - g - h, b: y - s - g };
    if (at === 'tr') return { l: x + s - w, r: x + s, t: y - s - g - h, b: y - s - g };
    if (at === 'bl') return { l: x - s, r: x - s + w, t: y + s + g, b: y + s + g + h };
    if (at === 'br') return { l: x + s - w, r: x + s, t: y + s + g, b: y + s + g + h };
    /* a flag flying outward from a corner: beside the box's column, not over it */
    if (at === 'ul') return { l: x - s - w, r: x - s, t: y - s - h, b: y - s };
    if (at === 'ur') return { l: x + s, r: x + s + w, t: y - s - h, b: y - s };
    if (at === 'dl') return { l: x - s - w, r: x - s, t: y + s, b: y + s + h };
    if (at === 'dr') return { l: x + s, r: x + s + w, t: y + s, b: y + s + h };
    if (at === 'r') return { l: x + s + g + 4, r: x + s + g + 4 + w, t: y - h / 2, b: y + h / 2 };
    return { l: x - s - g - 4 - w, r: x - s - g - 4, t: y - h / 2, b: y + h / 2 };
  }
  const CORNERS = ['tl', 'tr', 'bl', 'br', 'r', 'l'];
  /* A flag's pole is one side of its box, continued upward or downward; the flag flies from it over the box's column (tl, tr,
     bl, br) or away from it (ul, ur, dl, dr). The order is the order of taste when two places are equally free of water: the two
     rivers on the left fly their names to the left first, the two on the right to the right (the names fan out as the rivers do),
     each from the side of its box that faces the confluence, so the two halves of the picture mirror one another */
  const FLAGS = [['tr', 'ul', 'tl', 'ur', 'br', 'dl', 'bl', 'dr'], ['tl', 'ur', 'tr', 'ul', 'bl', 'dr', 'br', 'dl']];
  const flagsOf = (G, t) => FLAGS[G.targets.indexOf(t) < G.targets.length / 2 ? 0 : 1];

  /* ---- FOUR PATHS: this file's own river points, and the water as it lies on the screen ---- */
  /* where each river's box sits best in the picture (of the window): the four at one height, so the line that joins them is a
     level line across the valley, two boxes on each side of the confluence */
  const SPOT = [[.24, .55], [.38, .56], [.62, .555], [.78, .56]];
  const probe = [0, 0, 0, 0];
  const world = () => { const C = window.__MONTIS_STUDY__?.canyon, W = C?.watershed, cam = C?.camera; return W?.descriptors?.length && typeof W.terrainAt === 'function' && cam?.projectionMatrix && cam.matrixWorldInverse ? { W, cam } : null; };
  function toScreen(cam, x, y, z, w, h) {
    const v = cam.matrixWorldInverse.elements, p = cam.projectionMatrix.elements;
    const ex = v[0] * x + v[4] * y + v[8] * z + v[12], ey = v[1] * x + v[5] * y + v[9] * z + v[13], ez = v[2] * x + v[6] * y + v[10] * z + v[14];
    const cw = p[3] * ex + p[7] * ey + p[11] * ez + p[15];
    if (!(cw > 1e-6)) return null;   // behind the lens
    return [((p[0] * ex + p[4] * ey + p[8] * ez + p[12]) / cw + 1) * .5 * w, (1 - (p[1] * ex + p[5] * ey + p[9] * ez + p[13]) / cw) * .5 * h];
  }
  /* is the ground between the lens and this point higher than the line of sight (the rule alpine-ui.js uses) */
  function behindRidge(W, eye, x, y, z) {
    for (let i = 1; i < 24; i++) { const k = i / 24; W.terrainAt(eye.x + (x - eye.x) * k, eye.z + (z - eye.z) * k, probe); if (probe[0] > eye.y + (y - eye.y) * k + 6) return true; }
    return false;
  }
  const wet = (G, p) => { let n = 0; for (const w of G.water) if (w[0] > p.l && w[0] < p.r && w[1] > p.t && w[1] < p.b) n++; return n; };
  /* How good a place is for a flag, less is better: the water under the name, counted; a name under its box only when the
     places over it are much wetter (the four read as a row when their names all stand above the line); then the order of taste */
  const weigh = (G, t, x, y, at, order) => { const b = labelBox(G, { x, y, lw: t.lw, lh: t.lh }, at); return wet(G, { l: b.l - 6, r: b.r + 6, t: b.t - 6, b: b.b + 6 }) + (at[0] === 'b' || at[0] === 'd' ? 2.6 : 0) + order * .05; };
  function survey(G) {
    const sc = world(); if (!sc) return false;
    const { W, cam } = sc, m = cam.matrixWorld.elements, w = G.w, h = G.h, s = G.half, phone = w <= 760;
    const key = [w, h, s, m[12].toFixed(1), m[13].toFixed(1), m[14].toFixed(1), m[8].toFixed(4), m[9].toFixed(4), m[10].toFixed(4), G.targets.map(t => t.lw + 'x' + t.lh).join(','),
      obstacles.map(o => [o.l, o.t, o.r, o.b].map(Math.round).join(':')).join(',')].join('|');
    if (key === G.surveyed) return true;
    G.surveyed = key;
    const eye = { x: m[12], y: m[13], z: m[14] };
    /* every river in sight, as dots along its course */
    const water = [];
    for (const path of (W.flowPaths?.length ? W.flowPaths : W.descriptors)) {
      if (!path?.curve?.getPointAt) continue;
      for (let k = 6; k <= 50; k++) {
        const c = path.curve.getPointAt(k / 50), pt = toScreen(cam, c.x, 0, c.z, w, h);
        if (pt && pt[0] > -30 && pt[0] < w + 30 && pt[1] > -30 && pt[1] < h + 30 && !behindRidge(W, eye, c.x, 4, c.z)) water.push(pt);
      }
    }
    G.water = water;
    const taken = [], spots = [];
    for (const i of [0, 3, 1, 2]) {   // the two outer rivers first, then the inner pair (as the page's own layout does)
      const d = W.descriptors[i], t = G.targets[i]; if (!d?.curve || !t) continue;
      const want = [SPOT[i][0] * w, SPOT[i][1] * h], list = [];
      for (let k = 20; k <= 49; k++) {
        const c = d.curve.getPointAt(k / 50), pt = toScreen(cam, c.x, 0, c.z, w, h); if (!pt) continue;
        const x = half(pt[0]), y = half(pt[1]), box = { l: x - s - 6, r: x + s + 6, t: y - s - 6, b: y + s + 6 };
        if (box.l < 12 || box.r > w - 12 || box.t < (phone ? 150 : 110) || box.b > h - 60) continue;
        if (obstacles.some(o => hit(box, o)) || taken.some(o => hit(box, o))) continue;
        list.push({ c, x, y, box, cost: (x - want[0]) ** 2 + (y - want[1]) ** 2 });
      }
      list.sort((a, b) => a.cost - b.cost);
      /* in sight, and with somewhere for its name to stand. Every wet dot under the name is counted as a step away from where the
         box sits best: a place a little further along the river is taken if the name reads better there */
      const stands = c => {
        let least = Infinity, rect = null;
        flagsOf(G, t).forEach((at, order) => {
          const b = labelBox(G, { x: c.x, y: c.y, lw: t.lw, lh: t.lh }, at), p = { l: b.l - 9, r: b.r + 9, t: b.t - 9, b: b.b + 9 };
          if (!(p.l > 8 && p.r < w - 8 && p.t > 8 && p.b < h - 8 && obstacles.every(o => !hit(p, o)) && taken.every(o => !hit(p, o)))) return;
          const n = weigh(G, t, c.x, c.y, at, order); if (n < least) { least = n; rect = p; }
        });
        return { least, rect };
      };
      let best = null, bestCost = Infinity;
      for (const c of list.slice(0, 16)) {
        if (c.cost >= bestCost) break;
        if (behindRidge(W, eye, c.c.x, 4, c.c.z)) continue;
        const { least, rect } = stands(c); if (!rect) continue;
        const cost = c.cost + least * 2600;   // one wet dot under the name ≈ fifty pixels further from the best spot
        if (cost < bestCost) { best = { ...c, rect }; bestCost = cost; }
      }
      spots[i] = best ? { x: best.x, y: best.y } : null;
      if (best) taken.push(best.box, best.rect);   // its box, and the room its name will take: the next river keeps clear of both
    }
    G.spots = spots;
    return true;
  }

  function readout(G, t, now, atOnce) {
    const text = two(t.x / G.w * 100) + ', ' + two(t.y / G.h * 100);
    if (text === t.text) return;
    if (!atOnce && now - t.wrote < 140) {
      if (!t.pending) t.pending = setTimeout(() => { t.pending = 0; if (t.on) readout(G, t, performance.now(), true); }, 150);
      return;
    }
    t.text = text; t.wrote = now; t.xy.textContent = text;
  }
  function show(G, t, on, now) {
    if (t.on === on) return;
    t.on = on;
    if (!on) { t.off = now; t.node.classList.remove('is-on', 'is-arriving'); return; }
    /* an arrival is played when the target is new on the screen, not when it was only away for a moment */
    const fresh = now - t.off > 700 && !reduced.matches && !document.hidden;
    t.x = t.tx; t.y = t.ty; t.node.style.transform = `translate3d(${t.x}px,${t.y}px,0)`;
    if (!t.floating) readout(G, t, now, true);
    t.node.classList.toggle('is-arriving', fresh);
    t.node.classList.add('is-on');
    if (fresh && !t.floating) window.__FLOW2_FEEL__?.decode?.(t.xy, 460, 300);
  }

  function place(G, now) {
    if (!G.sized && sizeDue(G)) size(G);
    const s = G.half;
    /* which targets stand */
    for (const t of G.targets) {
      let on = t.want;
      if (on && G.kind === 'canyon') {
        /* a river mark that the title or the edges' furniture stands on is not drawn */
        const b = { l: t.tx - s - 4, r: t.tx + s + 4, t: t.ty - s - 4, b: t.ty + s + 4 };
        if (b.l < 12 || b.r > G.w - 12 || obstacles.some(o => hit(b, o))) on = false;
      }
      if (on && G.kind === 'paths') {
        /* a strategy always shows. With no river point in sight, or one that the title's words stand on, its words stand alone
           where alpine-ui.js put its tag (a place that script has already kept clear) */
        let ground = t.ground;
        /* (first pass only: the page's own river point may lie under the title's words. The family's points never do.) */
        if (ground && !G.family) { const b = { l: t.gx - s, r: t.gx + s, t: t.gy - s, b: t.gy + s }; if (obstacles.some(o => o.copy && hit(b, o))) ground = false; }
        t.floating = !ground; t.tx = ground ? t.gx : t.px; t.ty = ground ? t.gy : t.py;
      }
      show(G, t, on, now);
      if (!on) continue;
      if (t.x !== t.tx || t.y !== t.ty) { t.x = t.tx; t.y = t.ty; t.node.style.transform = `translate3d(${t.x}px,${t.y}px,0)`; }
      if (t.node.classList.contains('is-floating') !== t.floating) t.node.classList.toggle('is-floating', t.floating);
      if (t.node.classList.contains('is-locked') !== t.locked) t.node.classList.toggle('is-locked', t.locked);
      if (!t.floating) readout(G, t, now, false);
    }
    /* the links, from box edge to box edge */
    const segments = [];
    G.links.forEach((link, i) => {
      const a = G.targets[i], b = G.targets[i + 1];
      let seg = null;
      if (a.on && b.on && !a.floating && !b.floating) {
        const dx = b.x - a.x, dy = b.y - a.y, m = Math.max(Math.abs(dx), Math.abs(dy)), reach = s + 5;
        if (m > reach * 2 + 12) { const k = reach / m; seg = { x1: a.x + dx * k, y1: a.y + dy * k, x2: b.x - dx * k, y2: b.y - dy * k }; }
      }
      if (seg) {
        const key = [seg.x1, seg.y1, seg.x2, seg.y2].map(v => v.toFixed(1)).join(' ');
        if (key !== link.key) { link.key = key; const p = key.split(' '); link.line.setAttribute('x1', p[0]); link.line.setAttribute('y1', p[1]); link.line.setAttribute('x2', p[2]); link.line.setAttribute('y2', p[3]); }
        segments.push(seg);
      }
      if (link.on !== !!seg) { link.on = !!seg; link.line.classList.toggle('is-on', link.on); }
    });
    /* the labels: each keeps its place while that place is free */
    const boxes = G.targets.filter(t => t.on && !t.floating).map(t => ({ l: t.x - s - 3, r: t.x + s + 3, t: t.y - s - 3, b: t.y + s + 3, of: t })), placed = [];
    for (const t of G.targets) {
      if (!t.on) continue;
      if (t.floating) { placed.push({ l: t.x - 4, r: t.x + t.lw + 4, t: t.y - 4, b: t.y + t.lh + 4 }); continue; }
      const free = (at, room) => {
        const b = labelBox(G, t, at), p = { l: b.l - room, r: b.r + room, t: b.t - room, b: b.b + room };
        return p.l > 8 && p.r < G.w - 8 && p.t > 8 && p.b < G.h - 8 && obstacles.every(o => !hit(p, o)) && placed.every(o => !hit(p, o))
          && boxes.every(o => o.of === t || !hit(p, o)) && segments.every(g => !crosses(g, p));
      };
      const flag = () => {
        let best = null, least = Infinity;
        flagsOf(G, t).forEach((c, order) => {
          if (!free(c, c === t.at ? 1 : 9)) return;
          const n = weigh(G, t, t.x, t.y, c, order) - (c === t.at ? 1.5 : 0);   // the place it has is kept unless another is clearly better
          if (n < least) { best = c; least = n; }
        });
        return best;
      };
      /* the first free place in order. The place it has is held with less room than a new place needs: it does not hop to and fro.
         A flag (FOUR PATHS) takes a corner off the water if there is one, any free corner if not, and is never left without its name */
      const at = G.family ? (flag() || (FLAGS[0].includes(t.at) ? t.at : flagsOf(G, t)[0])) : (CORNERS.find(c => free(c, c === t.at ? 1 : 9)) || 'none');
      if (at !== t.at) { t.at = at; t.node.dataset.at = at; }
      if (at !== 'none') { const b = labelBox(G, t, at); placed.push({ l: b.l - 4, r: b.r + 4, t: b.t - 4, b: b.b + 4 }); }
    }
  }
  function update(G) {
    const now = performance.now(), live = G.targets.some(t => t.want);
    if (live && now - measuredAt > 320) measure(now);
    place(G, now);
    /* a strategy moved along its river whose name then has nowhere to stand goes back to standing alone */
    if (G.kind === 'paths' && !G.family && G.targets.some(t => t.on && t.moved && !t.floating && t.at === 'none')) {
      for (const t of G.targets) if (t.on && t.moved && !t.floating && t.at === 'none') t.nameless = true;
      G.ground(); place(G, now);
    }
    /* once more when things have come to rest: the title may still have been on its way when this was measured */
    clearTimeout(settle);
    if (live) settle = setTimeout(() => { const t = performance.now(); measure(t); for (const g of groups) if (g.targets.some(x => x.want)) { g.ground?.(); place(g, t); } }, 460);
  }

  /* ---- the canyon's three marks (the page's atlas script moves them: only their attributes are read) ---- */
  function canyon() {
    const atlas = document.querySelector('#flow2-canyon-atlas'), course = atlas?.querySelector('.flow2-atlas-course');
    const marks = course ? [...course.querySelectorAll('.flow2-atlas-marker')] : [];
    if (!marks.length) return;
    const G = group('canyon', atlas);
    for (const m of marks) {
      const words = (m.querySelector('.flow2-atlas-caption')?.textContent || '').replace(/\s+/g, ' ').trim().split(' ');
      target(G, [el('b', '', words.shift() || ''), words.join(' ')]);
    }
    G.read = () => {
      const live = !atlas.hidden && course.hasAttribute('data-visible');
      marks.forEach((m, i) => {
        const t = G.targets[i];
        const k = live && m.getAttribute('visibility') === 'visible' ? /translate\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(m.getAttribute('transform') || '') : null;
        t.want = !!k; if (k) { t.tx = half(+k[1]); t.ty = half(+k[2]); }
      });
      update(G);
    };
    const watch = new MutationObserver(G.read);
    for (const m of marks) watch.observe(m, { attributes: true, attributeFilter: ['transform', 'visibility'] });
    watch.observe(course, { attributes: true, attributeFilter: ['data-visible'] });
    watch.observe(atlas, { attributes: true, attributeFilter: ['hidden'] });
    G.read();
  }

  /* ---- FOUR PATHS' four tags (alpine-ui.js places them: a tag's own corner, and its river point down a stem) ---- */
  function paths() {
    const layer = document.querySelector('.alp-labels'), pins = layer ? [...layer.querySelectorAll('.alp-pin[data-kind="tag"]')] : [];
    if (!pins.length) return false;
    const G = group('paths', layer);
    for (const pin of pins) {
      const text = sel => (pin.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
      const zh = el('span', 'f2u-lk-zh'); zh.append(el('b', '', text('.alp-tag-index')), text('.alp-tag-zh'));
      const en = el('span', 'f2u-lk-en', text('.alp-tag-en')); en.lang = 'en';
      target(G, en.textContent ? [zh, en] : [zh]);
    }
    let queued = 0;
    /* the family's own river points (the page's are kept only for a window in which the scene cannot be asked) */
    G.ground = () => {
      if (G.family) { if (survey(G)) G.targets.forEach((t, i) => { const spot = G.spots?.[i]; t.ground = !!spot; if (spot) { t.gx = spot.x; t.gy = spot.y; } }); return; }
      /* first pass: the page's own point; another on the same river when that one cannot be used */
      const s = G.half;
      for (const t of G.targets) { t.ground = !!t.pground; t.gx = t.pgx; t.gy = t.pgy; }
      G.targets.forEach((t, i) => {
        if (!t.want) return;
        const under = t.ground && obstacles.some(o => o.copy && hit({ l: t.gx - s, r: t.gx + s, t: t.gy - s, b: t.gy + s }, o));
        t.moved = false;
        if (t.ground && !under) return;
        /* not on a phone (its upright crop has room for one box: the other names stand alone, as the first pass drew them), and
           not where the name then found no free place beside the new box (a box without its name is worse than a name alone) */
        if (G.w <= 760 || t.nameless) { if (under) t.ground = false; return; }
        const spot = rescue(G, t, i, t.ground ? [t.gx, t.gy] : [SPOT[i][0] * G.w, SPOT[i][1] * G.h]);
        if (spot) { t.ground = true; t.gx = spot.x; t.gy = spot.y; t.moved = true; } else if (under) t.ground = false;
      });
    };
    G.read = () => {
      queued = 0;
      pins.forEach((pin, i) => {
        const t = G.targets[i], k = pin.classList.contains('is-visible') ? /translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(pin.style.transform || '') : null;
        t.want = !!k; if (!k) return;
        const dot = pin.querySelector('.alp-glass-leader circle'), cx = dot ? parseFloat(dot.getAttribute('cx')) : NaN, cy = dot ? parseFloat(dot.getAttribute('cy')) : NaN;
        /* the tag's own corner, and its river point (a tag whose point is out of sight has no ground to lock on) */
        t.px = half(+k[1]); t.py = half(+k[2]);
        t.pground = !!(dot && dot.style.display !== 'none' && Number.isFinite(cx) && Number.isFinite(cy));
        if (t.pground) { t.pgx = half(+k[1] + cx); t.pgy = half(+k[2] + cy); }
        t.locked = pin.classList.contains('is-step-current') || pin.classList.contains('is-current');
      });
      if (G.targets.some(t => t.want)) {
        if (!G.sized && sizeDue(G)) size(G);
        if (performance.now() - measuredAt > 320) measure(performance.now());
      }
      G.ground();
      update(G);
    };
    /* alpine-ui.js writes several attributes of several tags in one go: read once, after it has finished */
    const watch = new MutationObserver(() => { if (!queued) queued = requestAnimationFrame(G.read); });
    for (const pin of pins) watch.observe(pin, { attributes: true, attributeFilter: ['style', 'class', 'cx', 'cy'], childList: true, subtree: true });
    G.read();
    return true;
  }

  /* FIRST PASS: a strategy keeps the river point the page gives it. When that point cannot be used (it lies under the title's
     words, or the page found none in sight) the strategy used to lose its box and stand as a dark plate, alone among the four
     (seen at 1868×960: 「03怎麼跟其他不一樣」). It is given another point on the SAME river instead: in sight (not behind a ridge),
     clear of the title, the edges' furniture and the other boxes, with a free place for its label, and as near as can be to
     where the page had put it. Everything else about the four stays as the first pass drew it. */
  function rescue(G, t, i, near) {
    const sc = world(); if (!sc) return null;
    const { W, cam } = sc, d = W.descriptors[i]; if (!d?.curve) return null;
    const m = cam.matrixWorld.elements, eye = { x: m[12], y: m[13], z: m[14] }, s = G.half, w = G.w, h = G.h, phone = w <= 760;
    const others = G.targets.filter(o => o !== t && o.want && o.ground).map(o => ({ l: o.gx - s - 8, r: o.gx + s + 8, t: o.gy - s - 8, b: o.gy + s + 8 }));
    const key = [w, h, s, m[12].toFixed(1), m[13].toFixed(1), m[14].toFixed(1), m[8].toFixed(4), m[9].toFixed(4), m[10].toFixed(4), t.lw, t.lh, near.map(Math.round).join(':'),
      obstacles.map(o => [o.l, o.t, o.r, o.b].map(Math.round).join(':')).join(','), others.map(o => Math.round(o.l) + ':' + Math.round(o.t)).join(',')].join('|');
    if (key === t.rescueKey) return t.rescued;
    t.rescueKey = key; t.rescued = null;
    const list = [];
    for (let k = 20; k <= 49; k++) {
      const c = d.curve.getPointAt(k / 50), pt = toScreen(cam, c.x, 0, c.z, w, h); if (!pt) continue;
      const x = half(pt[0]), y = half(pt[1]), box = { l: x - s - 6, r: x + s + 6, t: y - s - 6, b: y + s + 6 };
      if (box.l < 12 || box.r > w - 12 || box.t < (phone ? 150 : 110) || box.b > h - 60) continue;
      if (obstacles.some(o => hit(box, o)) || others.some(o => hit(box, o))) continue;
      list.push({ c, x, y, cost: (x - near[0]) ** 2 + (y - near[1]) ** 2 });
    }
    list.sort((a, b) => a.cost - b.cost);
    for (const c of list.slice(0, 18)) {
      if (behindRidge(W, eye, c.c.x, 4, c.c.z)) continue;
      const room = CORNERS.some(at => { const b = labelBox(G, { x: c.x, y: c.y, lw: t.lw, lh: t.lh }, at), p = { l: b.l - 9, r: b.r + 9, t: b.t - 9, b: b.b + 9 }; return p.l > 8 && p.r < w - 8 && p.t > 8 && p.b < h - 8 && obstacles.every(o => !hit(p, o)) && others.every(o => !hit(p, o)); });
      if (room) { t.rescued = { x: c.x, y: c.y }; break; }
    }
    return t.rescued;
  }

  function start() {
    canyon();
    /* the tags are made when the valley's scene is ready */
    if (!paths()) { let tries = 0; const wait = setInterval(() => { if (paths() || ++tries > 600) clearInterval(wait); }, 400); }
  }
  const refresh = () => { measuredAt = -1e9; for (const G of groups) { G.sized = false; G.sizeAt = -1e9; G.surveyed = ''; for (const t of G.targets) { t.text = ''; t.rescueKey = ''; t.nameless = false; } G.read?.(); } };
  addEventListener('resize', refresh, { passive: true });
  document.fonts?.ready.then(refresh);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  window.__FLOW2_LOCKON__ = { groups, refresh, get obstacles() { return obstacles; } };
})();
