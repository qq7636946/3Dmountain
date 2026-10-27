'use strict';
/* resp-audit.probe.cjs — responsive + visual audit of index1-5 (QA only, read-only on the site).
   Run through probe.cjs so the page is loaded and the lock is held:
     RESP_POINTS="0,0.52,0.8" RESP_DIR=.qa/index1-5/resp-390 node scripts/index1-5/probe.cjs --script docs/qa/evidence/responsive/tools/resp-audit.probe.cjs --phone --out resp-390
     RESP_MODE=world RESP_POINTS="g:0.5,d:0.5,h:0,end" ... probe.cjs --world --script ...
   Per point: a jpg screenshot + a DOM audit (horizontal overflow, text cut by the viewport edge or an overflow:hidden ancestor,
   text-on-text overlap, small tap targets, broken images, contrast against the rendered pixels, big-title line breaks).
   Output: <RESP_DIR>/pt-<point>.jpg, audit.json. Returns a compact summary. */
const fs = require('node:fs'), path = require('node:path');

const JOURNEY = '0,0.52,0.8,1.12,1.6,2.3,2.96,3.6,4.4,4.7,4.8,5.56,6.9,8.9,10.2,11.13,12.3,13.07';
const WORLD = 'g:0.2,g:0.5,g:0.9,d:0.3,d:0.6,h:0,h:1,h:2,h:3,h:4,lw:0.25,lw:0.6,ls:0.5,lh:0.5,lh:1,end';

const AUDIT = (opts) => {
  const vw = innerWidth, vh = innerHeight, phone = opts.phone;
  const res = { vw, vh, docW: document.documentElement.scrollWidth, bodyW: document.body.scrollWidth, docH: document.documentElement.scrollHeight, items: [], taps: [], broken: [], issues: [] };
  const skipSel = '#tuner,.tuner,[class*="tuner"],[id*="tuner"],[class*="logo-panel"],[id*="logo-panel"],[class*="lp-panel"],script,style,noscript,svg,[data-dev-panel]';
  const effOp = (el) => { let o = 1; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= parseFloat(cs.opacity); if (o < .01) return 0; } return o; };
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const byEl = new Map();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement; if (!el || el.closest(skipSel)) continue;
    (byEl.get(el) || byEl.set(el, []).get(el)).push(n);
  }
  for (const [el, nodes] of byEl) {
    const op = effOp(el); if (op < .12) continue;
    const cs = getComputedStyle(el);
    let l = 1e9, t = 1e9, r = -1e9, b = -1e9, rectsN = 0;
    for (const n of nodes) { const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) { if (q.width < 1 || q.height < 1) continue; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); rectsN++; } }
    if (!rectsN) continue;
    if (r < 0 || l > vw || b < 0 || t > vh) continue;                     // not on screen
    const fill = cs.webkitTextFillColor || cs.color;
    const item = { s: sel(el), txt: nodes.map(n => n.nodeValue.trim()).join(' ').replace(/\s+/g, ' ').slice(0, 48), l: Math.round(l), t: Math.round(t), r: Math.round(r), b: Math.round(b), op: +op.toFixed(2), fs: parseFloat(cs.fontSize), fw: cs.fontWeight, fam: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(), ls: cs.letterSpacing, col: fill, el };
    res.items.push(item);
  }
  // 1. cut by the viewport edge (partly visible text; ignore fully inside)
  for (const it of res.items) {
    const w = it.r - it.l, h = it.b - it.t, edge = 2;
    const outL = Math.max(0, -it.l), outR = Math.max(0, it.r - vw), outB = Math.max(0, it.b - vh), outT = Math.max(0, -it.t);
    if ((outL > edge || outR > edge) && (outL + outR) / w < .98) res.issues.push({ k: 'edge-x', s: it.s, txt: it.txt, l: it.l, r: it.r, vw, out: Math.round(outL + outR) });
    // overflow hidden ancestors cutting the text
    for (let a = it.el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a); if (!/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) continue;
      const ar = a.getBoundingClientRect(); if (ar.width < 2 || ar.height < 2) continue;
      const cutL = Math.max(0, ar.left - it.l), cutR = Math.max(0, it.r - ar.right), cutT = Math.max(0, ar.top - it.t), cutB = Math.max(0, it.b - ar.bottom);
      const w2 = it.r - it.l, h2 = it.b - it.t;
      if ((cutL + cutR > 3 && (cutL + cutR) / w2 < .9) || (cutT + cutB > 3 && (cutT + cutB) / h2 < .9)) { res.issues.push({ k: 'clipped', s: it.s, txt: it.txt, by: sel(a), cut: [Math.round(cutL), Math.round(cutR), Math.round(cutT), Math.round(cutB)] }); break; }
    }
  }
  // 2. overlap between text blocks
  const its = res.items;
  for (let i = 0; i < its.length; i++) for (let j = i + 1; j < its.length; j++) {
    const a = its[i], c = its[j];
    if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
    const ox = Math.min(a.r, c.r) - Math.max(a.l, c.l), oy = Math.min(a.b, c.b) - Math.max(a.t, c.t);
    if (ox <= 2 || oy <= 2) continue;
    const area = ox * oy, small = Math.min((a.r - a.l) * (a.b - a.t), (c.r - c.l) * (c.b - c.t));
    if (area / small > .12) res.issues.push({ k: 'overlap', a: a.s + ' "' + a.txt + '"', b: c.s + ' "' + c.txt + '"', ratio: +(area / small).toFixed(2), ra: [a.l, a.t, a.r, a.b], rb: [c.l, c.t, c.r, c.b] });
  }
  // 3. big titles: lines
  for (const it of res.items) {
    if (it.fs < 24) continue;
    const el = it.el, lines = new Map();
    const wk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = wk.nextNode(); n; n = wk.nextNode()) {
      const rg = document.createRange();
      for (let k = 0; k < n.nodeValue.length; k++) { const ch = n.nodeValue[k]; if (/\s/.test(ch)) continue; rg.setStart(n, k); rg.setEnd(n, k + 1); const q = rg.getClientRects()[0]; if (!q || q.width < .5) continue; const key = Math.round(q.top / (it.fs * .5)); lines.set(key, (lines.get(key) || '') + ch); }
    }
    const arr = [...lines.entries()].sort((x, y) => x[0] - y[0]).map(e => e[1]);
    it.lines = arr;
    if (arr.length > 1 && arr.some(s => s.length <= 2)) res.issues.push({ k: 'orphan', s: it.s, lines: arr });
  }
  // 4. tap targets
  for (const el of document.querySelectorAll('a[href],button,[role=button],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')) {
    if (el.closest(skipSel)) continue;
    const cs = getComputedStyle(el); if (cs.pointerEvents === 'none') continue;
    const op = effOp(el); if (op < .3) continue;
    const q = el.getBoundingClientRect(); if (q.width < 2 || q.height < 2) continue;
    if (q.right < 0 || q.left > vw || q.bottom < 0 || q.top > vh) continue;
    // hit area may be bigger via ::before/after or padding: keep the box
    res.taps.push({ s: sel(el), txt: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 24).replace(/\s+/g, ' '), w: Math.round(q.width), h: Math.round(q.height), x: Math.round(q.left), y: Math.round(q.top), op: +op.toFixed(2) });
  }
  // 5. images / video
  for (const im of document.images) { const q = im.getBoundingClientRect(); if (q.width < 2) continue; if (im.complete && im.naturalWidth === 0 && (im.currentSrc || im.src)) res.broken.push({ s: sel(im), src: (im.currentSrc || im.src).slice(-80) }); }
  for (const v of document.querySelectorAll('video')) { if (v.error) res.broken.push({ s: sel(v), err: v.error.code }); }
  // 6. fixed UI map (rects)
  res.fixedUi = [];
  for (const el of document.querySelectorAll('.finnovation-ui *, .fi-world *, .fiw-chapters *')) {
    if (el.closest(skipSel)) continue;
    if (!/^(BUTTON|A)$/.test(el.tagName)) continue;
  }
  res.items = res.items.map(({ el, ...rest }) => rest);
  return res;
};

module.exports = async ({ page, L, vp, world }) => {
  const mode = process.env.RESP_MODE || 'journey';
  const pts = (process.env.RESP_POINTS || (mode === 'world' ? WORLD : JOURNEY)).split(',').map(s => s.trim()).filter(Boolean);
  const dir = path.resolve(process.env.RESP_DIR || '.qa/index1-5/resp-audit');
  const waitMs = Number(process.env.RESP_WAIT) || 1800;
  fs.mkdirSync(dir, { recursive: true });
  const phone = vp.phone;
  // static facts once
  const facts = await page.evaluate(() => {
    const f = { fonts: [...document.fonts].map(x => x.family.replace(/["']/g, '') + ' ' + x.weight + ' ' + x.status).slice(0, 40), safeArea: 0, vh100: 0, dvh: 0, meta: document.querySelector('meta[name=viewport]')?.content };
    for (const ss of document.styleSheets) { let rules; try { rules = ss.cssRules; } catch { continue; } for (const r of rules) { const t = r.cssText || ''; if (/safe-area-inset/.test(t)) f.safeArea++; if (/100vh/.test(t)) f.vh100++; if (/100d?svh|100dvh|100lvh/.test(t)) f.dvh++; } }
    f.mq = { coarse: matchMedia('(pointer:coarse)').matches, hover: matchMedia('(hover:hover)').matches, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches, dpr: devicePixelRatio, ua: navigator.userAgent.slice(0,60) };
    f.fontCheck = { montserrat: document.fonts.check('16px Montserrat'), noto: document.fonts.check('16px "Noto Sans TC"') };
    return f;
  });
  const out = { mode, vp, facts, points: [] };
  const helper = await page.context().newPage();
  const sample = async (buf, rects) => helper.evaluate(async ({ b64, rects, dpr }) => {
    const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/jpeg;base64,' + b64; });
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return rects.map(r => {
      const l = Math.max(0, Math.floor(r.l * dpr)), t = Math.max(0, Math.floor(r.t * dpr)), w = Math.min(c.width - l, Math.ceil((r.r - r.l) * dpr)), h = Math.min(c.height - t, Math.ceil((r.b - r.t) * dpr));
      if (w < 2 || h < 2) return null;
      const d = x.getImageData(l, t, w, h).data, px = [];
      const step = Math.max(1, Math.floor(Math.sqrt(w * h / 600)));
      for (let yy = 0; yy < h; yy += step) for (let xx = 0; xx < w; xx += step) { const k = (yy * w + xx) * 4; px.push([d[k], d[k + 1], d[k + 2], .2126 * lin(d[k]) + .7152 * lin(d[k + 1]) + .0722 * lin(d[k + 2])]); }
      px.sort((p, q) => p[3] - q[3]);
      const pick = f => px[Math.min(px.length - 1, Math.floor(px.length * f))];
      return { lo: pick(.25), mid: pick(.5), hi: pick(.75) };
    });
  }, { b64: buf.toString('base64'), rects, dpr: vp.dpr });
  const lum = c => { const f = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const parseCol = s => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { c: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }; };

  let worldSt = world;
  for (const pt of pts) {
    let reached = null;
    if (mode === 'world') {
      if (/^l/.test(pt)) { const cur = await L.logoNow(page); if (!cur || !cur.ready) await L.prepareLogo(page, worldSt); }
      await L.jumpWorld(page, L.worldY(worldSt, pt));
      reached = { ok: true, y: Math.round(await page.evaluate(() => window.__MONTIS_STUDY__.world.state.y)) };
    } else {
      const p = pt === 'max' ? 'max' : Number(pt);
      reached = await L.fly(page, p);
    }
    await page.waitForTimeout(waitMs);
    const file = path.join(dir, 'pt-' + pt.replace(/[:.]/g, '_') + '.jpg');
    const buf = await page.screenshot({ type: 'jpeg', quality: 82 });
    fs.writeFileSync(file, buf);
    const a = await page.evaluate(AUDIT, { phone });
    // contrast against the rendered pixels
    const rects = a.items.map(it => ({ l: it.l, t: it.t, r: it.r, b: it.b }));
    const sm = rects.length ? await sample(buf, rects) : [];
    a.items.forEach((it, i) => {
      const s = sm[i], col = parseCol(it.col); if (!s || !col) return;
      const alpha = col.a * it.op; if (alpha < .2) return;             // outlined / ghost decor
      const textLum = lum(col.c);
      const bg = textLum > .45 ? s.lo : s.hi, bgL = bg[3];            // light text → sample the darker quartile (conservative)
      const mix = col.c.map((v, k) => v * alpha + bg[k] * (1 - alpha)), L2 = lum(mix);
      const cr = (Math.max(L2, bgL) + .05) / (Math.min(L2, bgL) + .05);
      it.cr = +cr.toFixed(2); it.bgL = +bgL.toFixed(2);
      const big = it.fs >= 24 || (it.fs >= 18.66 && Number(it.fw) >= 700);
      if (cr < (big ? 3 : 4.5)) a.issues.push({ k: 'contrast', s: it.s, txt: it.txt, cr: it.cr, fs: it.fs, col: it.col, op: it.op, rect: [it.l, it.t, it.r, it.b] });
    });
    const small = a.taps.filter(t => t.h < 44 || t.w < 44);
    const rec = { pt, reached, file: path.relative(process.cwd(), file).replace(/\\/g, '/'), hscroll: a.docW > a.vw + 1 || a.bodyW > a.vw + 1, docW: a.docW, bodyW: a.bodyW, vw: a.vw, issues: a.issues, smallTaps: small, taps: a.taps, broken: a.broken, bigTitles: a.items.filter(i => i.lines && i.lines.length).map(i => ({ s: i.s, fs: i.fs, fam: i.fam, ls: i.ls, lines: i.lines })), fams: [...new Set(a.items.map(i => i.fam))] };
    out.points.push(rec);
    process.stderr.write(`· ${pt}: issues ${a.issues.length} small-taps ${small.length} broken ${a.broken.length}${rec.hscroll ? ' HSCROLL' : ''}\n`);
  }
  await helper.close().catch(() => { });
  fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify(out, null, 1));
  // contact sheet + L*
  try {
    const files = out.points.map(p => path.resolve(p.file));
    const stats = await L.imageStats(page.context(), files);
    out.points.forEach((p, i) => { p.lstar = stats[i].lstar; });
    const cells = out.points.map((p, i) => ({ label: `${p.pt} · L* ${p.lstar}`, file: files[i] }));
    await L.contactSheet(page.context(), cells, path.join(dir, 'sheet.jpg'), { cols: phone ? 6 : 4, title: `resp ${L.vpName(vp)} ${mode}` });
    fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify(out, null, 1));
  } catch (e) { process.stderr.write('sheet failed ' + e.message + '\n'); }
  const sum = out.points.map(p => ({ pt: p.pt, ok: p.reached && p.reached.ok !== false, issues: p.issues.length, smallTaps: p.smallTaps.length, hscroll: p.hscroll, broken: p.broken.length, L: p.lstar }));
  return { ok: true, dir: path.relative(process.cwd(), dir).replace(/\\/g, '/'), facts: { mq: facts.mq, safeArea: facts.safeArea, vh100: facts.vh100, dvh: facts.dvh, fontCheck: facts.fontCheck }, sum };
};
