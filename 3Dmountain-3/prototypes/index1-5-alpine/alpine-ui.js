/* index1-5-alpine — everest-style interface layer (2026-10-23).
   Adds to the shared FINNOVATION interface (js/finnovation-interface.js) without changing what it does:
     · kicker: the last "·" phrase in gold, "01 / …" numbers in gold mono
     · chapter panels: an outline Roman numeral + the italic gold chapter name (aria-hidden: the rail already names the
       chapter); the opening frame gets an "or scroll" caption beside its button
     · a frosted stat bar with live, honest journey data: the 3D view's height (scene units) and heading, journey %,
       Taipei time (the firm's home city, as the page itself says), chapter n/6
     · a few labels in the scene, projected with the canyon camera: 頂峰 SUMMIT, 匯流 CONFLUENCE, and in the FOUR PATHS
       chapter the four strategy names on the four tributaries.
   Reads window.__MONTIS_STUDY__ (journey, canyon.camera, canyon.watershed) and the interface DOM; never writes to the
   scene. Styles: prototypes/index1-5-alpine/index1-5.css, ALPINE-UI block. Off in the readable/text mode and with
   ?alpui=0; ?uiserif=sitka|bodoni|didot picks the display face for A/B. */
const html = document.documentElement;
const params = new URLSearchParams(location.search);
if (params.get('alpui') === '0') html.removeAttribute('data-alpine-ui');
if (/^(sitka|bodoni|didot)$/.test(params.get('uiserif') || '')) html.dataset.alpSerif = params.get('uiserif');

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const PATHS = ['ai', 'public', 'private', 'derivatives'];
const STRATEGY_IDS = new Set(['strategies', ...PATHS]);
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const isText = () => html.dataset.renderMode === 'text';
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const hidden = n => { n.setAttribute('aria-hidden', 'true'); return n; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const range = document.createRange();

let root = null, cells = null, layer = null, pins = [], raf = 0, lastStats = 0, lastRects = 0, obstacles = [];
let summitRevision = -1, chapterId = '', names = [], emblem = null;
const CHAPTER_OF = { knowledge: 0, innovation: 1, convergence: 2, value: 3, perspective: 4, strategies: 5 };
const titleCase = s => s.charAt(0) + s.slice(1).toLowerCase();

/* ---------- copy: gold kicker phrase, italic chapter name, "or scroll" ---------- */
function enhanceCopy() {
  names = [...root.querySelectorAll('.fi-rail button')]
    .map(b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim());
  root.querySelectorAll('.fi-copy-panel').forEach((panel, i) => {
    if (panel.querySelector('.alp-mark, .alp-or')) return;
    const kicker = panel.querySelector('.fi-copy-kicker');
    if (kicker && !kicker.children.length) {
      const text = kicker.textContent.trim(), parts = text.split(' · '), num = text.match(/^(\d{2})\s*\/\s*(.+)$/);
      if (parts.length > 1) { kicker.textContent = parts.slice(0, -1).join(' · ') + ' · '; kicker.append(el('span', 'alp-gold', parts.at(-1))); }
      else if (num) { kicker.textContent = ''; kicker.append(el('span', 'alp-num', num[1]), ` / ${num[2]}`); }
    }
    if (i === 0) { panel.querySelector('.fi-copy-action')?.after(hidden(el('span', 'alp-or', 'or scroll'))); return; }
    const mark = hidden(el('p', 'alp-mark', titleCase(names[Math.min(i, 5)] || '')));
    mark.lang = 'en';
    panel.querySelector('h1, h2')?.after(mark);
  });
  // chapter emblem: outline Roman numeral + italic gold chapter name, shown for a few seconds on arrival
  emblem = hidden(el('div', 'alp-emblem'));
  emblem.append(el('span', 'alp-emblem-numeral'), el('span', 'alp-emblem-name'));
  emblem.lang = 'en';
  emblem.addEventListener('animationend', () => { emblem.classList.remove('is-on'); lastRects = 0; });
  root.append(emblem);
}
function playEmblem(id) {
  const chapter = CHAPTER_OF[id];
  // none for the opening frame, the logo chapter (its letters own the centre of the screen) or the strategy sub-panels
  if (!emblem || !chapter || chapter < 2) return;
  emblem.firstChild.textContent = ROMAN[chapter];
  emblem.lastChild.textContent = titleCase(names[chapter] || '');
  emblem.classList.remove('is-on'); void emblem.offsetWidth; emblem.classList.add('is-on');
}
/* The opening title runs on one line on wide screens; shrink it to the column if a wider local face would overflow. */
function fitHero() {
  const h1 = root.querySelector('#chapter-knowledge h1');
  if (!h1) return;
  h1.style.removeProperty('--alp-fit');
  if (getComputedStyle(h1).whiteSpace !== 'nowrap') return;
  range.selectNodeContents(h1);
  const text = range.getBoundingClientRect().width, room = h1.clientWidth;
  if (text > room && text > 0) h1.style.setProperty('--alp-fit', (room / text * .98).toFixed(3));
}

/* ---------- stat bar ---------- */
function buildStats() {
  const bar = el('aside', 'alp-stats'), dl = el('dl');
  bar.setAttribute('aria-label', '旅程資訊 Journey');
  const out = {};
  for (const [k, label, tone] of [['alt', 'VIEW HEIGHT', ''], ['hdg', 'HEADING', 'is-blue'], ['pct', 'JOURNEY %', ''], ['time', 'TAIPEI TIME', 'is-blue'], ['chap', 'CHAPTER', 'is-gold']]) {
    const cell = el('div', 'alp-stat' + (tone ? ' ' + tone : '')), dd = el('dd', null, '—');
    cell.dataset.k = k; cell.append(el('dt', null, label), dd); dl.append(cell);
    out[k] = { dd, value: '' };
  }
  bar.append(dl); root.append(bar);
  html.setAttribute('data-alpine-ui-live', '');
  return out;
}
const taipei = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function put(k, value, small) {
  const c = cells[k], key = value + '|' + (small || '');
  if (c.value === key) return;
  c.value = key; c.dd.replaceChildren(value, ...(small ? [el('small', null, small)] : []));
}
function updateStats(S, dir) {
  const cam = S.canyon.camera, y = cam.position.y;
  put('alt', y < 10 ? y.toFixed(1) : Math.round(y).toLocaleString('en-US'));
  cam.getWorldDirection(dir);
  const deg = (Math.atan2(dir.x, -dir.z) * 180 / Math.PI + 360) % 360;
  put('hdg', String(Math.round(deg) % 360).padStart(3, '0') + '°', COMPASS[Math.round(deg / 45) % 8]);
  const j = S.journey, p = j.max ? Math.min(1, Math.max(0, j.progress / j.max)) : 0;
  put('pct', String(Math.round(p * 100)));
  put('time', taipei.format(new Date()));
  const current = [...root.querySelectorAll('.fi-rail button')].findIndex(b => b.hasAttribute('aria-current'));
  put('chap', String(Math.max(0, current) + 1).padStart(2, '0') + '/06');
}

/* ---------- labels in the scene ---------- */
function makePin(kind, opts) {
  const node = el('div', 'alp-pin');
  node.dataset.kind = kind;
  if (kind === 'peak') {
    const text = el('span', 'alp-pin-text');
    text.append(el('span', 'alp-pin-name', opts.name), el('span', 'alp-pin-num', opts.num || ''));
    node.append(text, el('i', 'alp-pin-line'));
  } else {
    const tag = el('span', 'alp-tag');
    tag.append(el('b', null, opts.roman), opts.text);
    node.append(tag, el('i', 'alp-pin-line'));
  }
  if (opts.phone) node.dataset.phone = '';
  layer.append(node);
  const pin = { node, kind, on: false, x: NaN, y: NaN, lead: -1, side: 'up', w: 0, h: 0, ...opts };
  pins.push(pin);
  return pin;
}
/* Size of the text part alone (leader at zero length); the leader is added per placement. */
function measure() {
  for (const pin of pins) {
    const text = pin.node.firstChild;
    pin.w = text.offsetWidth; pin.h = text.offsetHeight + (pin.kind === 'peak' ? 6 : 0);
    pin.lead = -1;
  }
}
function buildLabels(W) {
  layer = hidden(el('div', 'alp-labels'));
  document.body.append(layer);
  const zc = W.descriptors.reduce((s, d) => s + d.joinZ, 0) / W.descriptors.length;
  const main = W.mainAt(zc);
  makePin('peak', { id: 'confluence', name: 'CONFLUENCE', num: '匯流', at: { x: main.x, y: 0, z: zc }, maxLead: 54, phone: true });
  makePin('peak', { id: 'summit', name: 'SUMMIT', num: '頂峰', at: { x: 0, y: 0, z: 0 }, maxLead: 46, phone: true });
  W.descriptors.forEach((d, k) => {
    const h2 = root.querySelector(`#chapter-${PATHS[k]} h2`);
    makePin('tag', { id: PATHS[k], roman: ROMAN[k], text: h2 ? h2.textContent.replace(/\s+/g, ' ').trim() : PATHS[k].toUpperCase(), curve: d.curve, t: .74, maxLead: 22 });
  });
  for (const pin of pins) pin.node.classList.toggle('is-current', pin.id === chapterId);
  layer.classList.toggle('has-current', PATHS.includes(chapterId));
  measure();
  document.fonts?.ready.then(measure);
}
/* The highest point of the near ridge beyond the confluence; recomputed when the terrain is rebaked. */
function placeSummit(W) {
  const rev = W.stats?.terrainRevision ?? 0;
  if (rev === summitRevision) return;
  summitRevision = rev;
  const out = [0, 0, 0, 0];
  let best = [-Infinity, 0, 0];
  for (let x = -2600; x <= 2600; x += 100) for (let z = -5200; z <= -3400; z += 100) { W.terrainAt(x, z, out); if (out[0] > best[0]) best = [out[0], x, z]; }
  const summit = pins.find(p => p.id === 'summit');
  summit.at = { x: best[1], y: best[0], z: best[2] };
  summit.node.querySelector('.alp-pin-num').textContent = `頂峰 · ▲ ${Math.round(best[0]).toLocaleString('en-US')}`;
  measure();
}
const overlaps = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
const pad = (r, p) => ({ l: r.left - p, r: r.right + p, t: r.top - p, b: r.bottom + p });
/* Everything a label must keep clear of: the actual text runs of the current copy (not its full-width box, so a label
   can sit beside a short line), the pill, the chapter emblem, the header groups, the rail, the footer and the stat bar. */
function refreshRects() {
  obstacles = [];
  const panel = root.querySelector('.fi-copy-panel.is-active');
  if (panel) {
    for (const n of panel.querySelectorAll('.fi-copy-kicker, h1 > span, h2 > span, .alp-mark, .fi-copy-zh')) {
      range.selectNodeContents(n); const r = range.getBoundingClientRect(); if (r.width) obstacles.push(pad(r, 12));
    }
    for (const n of panel.querySelectorAll('.fi-copy-action, .alp-or')) { const r = n.getBoundingClientRect(); if (r.width) obstacles.push(pad(r, 12)); }
  }
  for (const n of root.querySelectorAll('.fi-brand, .fi-header-right, .fi-rail, .fi-footer, .alp-stats, .alp-emblem.is-on')) {
    const r = n.getBoundingClientRect(); if (r.width) obstacles.push(pad(r, 10));
  }
}
/* A point on the ground is hidden when a ridge rises above the line of sight (marched over the baked height grid). */
const ground = [0, 0, 0, 0];
function occluded(W, c, x, y, z) {
  for (let i = 1; i < 24; i++) {
    const s = i / 24, px = c.x + (x - c.x) * s, py = c.y + (y - c.y) * s, pz = c.z + (z - c.z) * s;
    W.terrainAt(px, pz, ground);
    if (ground[0] > py + 6) return true;
  }
  return false;
}
function show(pin, on) {
  if (pin.on === on) return;
  pin.on = on; pin.node.style.opacity = on ? '1' : '0';
}
/* Label box for a placement. up: text above the point; right/left: a station tag beside the point. */
function boxAt(pin, x, y, lead, side) {
  if (side === 'right') return { l: x - 4, r: x + lead + pin.w + 4, t: y - pin.h / 2 - 4, b: y + pin.h / 2 + 4 };
  if (side === 'left') return { l: x - lead - pin.w - 4, r: x + 4, t: y - pin.h / 2 - 4, b: y + pin.h / 2 + 4 };
  return { l: x - pin.w / 2 - 4, r: x + pin.w / 2 + 4, t: y - lead - pin.h - 4, b: y + 4 };
}
const SHIFT = { up: 'translate(-50%, -100%)', right: 'translate(0, -50%)', left: 'translate(-100%, -50%)' };
function updateLabels(S, v, now) {
  const W = S.canyon.watershed, cam = S.canyon.camera, Wd = innerWidth, Ht = innerHeight;
  const aerial = smooth(260, 620, cam.position.y);
  const blocked = document.body.classList.contains('is-world') || document.body.classList.contains('is-portfolio');
  if (aerial < .5 || blocked || !W) { for (const pin of pins) show(pin, false); return; }
  placeSummit(W);
  if (now - lastRects > 250) { lastRects = now; refreshRects(); }
  const id = root.dataset.chapter || '', placed = [], eye = cam.position;
  const project = (x, y, z) => { v.set(x, y, z).project(cam); return v.z < 1 && v.z > -1 ? [(v.x + 1) * .5 * Wd, (1 - v.y) * .5 * Ht] : null; };
  const fits = box => box.l > 12 && box.r < Wd - 12 && box.t > 12 && box.b < Ht - 12 && obstacles.every(o => !overlaps(box, o)) && placed.every(o => !overlaps(box, o));
  for (const pin of pins) {
    if (pin.kind === 'tag' && !STRATEGY_IDS.has(id)) { show(pin, false); continue; }
    let pt = null, lead = pin.maxLead, side = 'up';
    if (pin.kind === 'peak') {
      const cand = project(pin.at.x, pin.at.y, pin.at.z);
      if (cand && !occluded(W, eye, pin.at.x, pin.at.y + 4, pin.at.z)) {
        const up = Math.round(Math.min(pin.maxLead, Math.max(16, cand[1] - 12 - pin.h - 6)));
        for (const [s, l] of [['up', up], ['up', 16], ['right', 26], ['left', 26]]) {
          if (fits(boxAt(pin, cand[0], cand[1], l, s))) { pt = cand; side = s; lead = l; break; }
        }
      }
    } else {
      // keep the last good spot if it still works; otherwise walk along the river (and try either side of it)
      // until the tag is in sight and clear of the copy, the other labels and the interface
      const sides = pin.side === 'up' ? ['up', 'right', 'left'] : [pin.side, 'up', pin.side === 'right' ? 'left' : 'right'];
      search: for (const t of [pin.t, .74, .7, .78, .66, .82, .62, .58, .86]) {
        const q = pin.curve.getPointAt(t), cand = project(q.x, 0, q.z);
        if (!cand || occluded(W, eye, q.x, 4, q.z)) continue;
        for (const s of sides) {
          const l = s === 'up' ? pin.maxLead : 18;
          if (fits(boxAt(pin, cand[0], cand[1], l, s))) { pt = cand; pin.t = t; side = s; lead = l; break search; }
        }
      }
    }
    if (!pt) { show(pin, false); continue; }
    placed.push(boxAt(pin, pt[0], pt[1], lead, side));
    if (side !== pin.side) { pin.side = side; pin.node.dataset.side = side; pin.x = NaN; }
    if (lead !== pin.lead) { pin.lead = lead; pin.node.style.setProperty('--lead', lead + 'px'); }
    const x = Math.round(pt[0] * 2) / 2, y = Math.round(pt[1] * 2) / 2;
    if (x !== pin.x || y !== pin.y) { pin.x = x; pin.y = y; pin.node.style.transform = `translate3d(${x}px, ${y}px, 0) ${SHIFT[side]}`; }
    show(pin, true);
  }
}

/* ---------- loop ---------- */
let dir = null, vec = null, fitted = false;
function frame(now) {
  raf = requestAnimationFrame(frame);
  const S = window.__MONTIS_STUDY__;
  if (!S?.canyon?.camera || !S.journey) return;
  if (!dir) { dir = S.canyon.camera.position.clone(); vec = dir.clone(); }
  // the opening title is sized by rules that apply once the page is ready, so fit it then
  if (!fitted && document.body.classList.contains('is-ready')) { fitted = true; fitHero(); }
  const id = root.dataset.chapter || '';
  if (id !== chapterId) {
    const first = chapterId === '';
    chapterId = id; lastRects = 0;
    for (const pin of pins) pin.node.classList.toggle('is-current', pin.id === id);
    layer?.classList.toggle('has-current', PATHS.includes(id));
    if (!first && document.body.classList.contains('is-ready')) playEmblem(id);
  }
  if (!layer && S.canyon.watershed?.descriptors?.length === 4) buildLabels(S.canyon.watershed);
  if (layer) updateLabels(S, vec, now);
  if (now - lastStats > 200) { lastStats = now; updateStats(S, dir); }
}
function stop() {
  cancelAnimationFrame(raf); raf = 0;
  layer?.remove(); layer = null; pins = [];
  root?.querySelector('.alp-stats')?.remove(); cells = null;
  emblem?.remove(); emblem = null;
  html.removeAttribute('data-alpine-ui-live');
}
function start() {
  if (!html.hasAttribute('data-alpine-ui') || isText()) return;
  root = document.querySelector('[data-journey-ui]');
  if (!root || !root.querySelector('.fi-copy-panel')) { setTimeout(start, 200); return; }
  enhanceCopy();
  cells = buildStats();
  fitHero();
  document.fonts?.ready.then(fitHero);
  addEventListener('resize', () => { lastRects = 0; fitHero(); if (layer) measure(); });
  addEventListener('finnovation:text-mode', stop);
  raf = requestAnimationFrame(frame);
}
start();
