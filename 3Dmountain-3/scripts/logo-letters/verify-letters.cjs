// Functional checks for the LOGO chapter's letter delivery (字母誕生) — real GPU, frozen rAF, deterministic stepping.
//
//   node scripts/logo-letters/overlay-server.cjs . 5611                    # serve the project
//   node scripts/logo-letters/verify-letters.cjs --base http://127.0.0.1:5611/
//
//   --only default,variants,reduced,phone,photoParity,index2      run some of the groups
//   --ref  http://127.0.0.1:5612/                                 a build to compare pixels against (needed by
//                                                                 photoParity and index2; they are skipped without it).
//          The build from before the letters:  node scripts/logo-letters/overlay-server.cjs . 5612 _archive/backups/letters-20261010
//
// default      the delivery itself, switching to photographs and back at runtime, a wordmark rebuild, console, network
// variants     ?logo=1 / ?logo=2 (no letters there), and switching to LOGO 3 at runtime
// reduced      prefers-reduced-motion
// phone        the lite path (smaller glyph fields, fewer march steps)
// photoParity  LETTERS 0 on this build against --ref, pixel for pixel (entrance, chapter, forward transition)
// index2       index2.html (it imports the same drops module) against --ref, pixel for pixel
// Each takes a minute or two; run them one or two at a time.
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const argv = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n !== undefined && !n.startsWith('--')) { argv[a.slice(2)] = n; i++; } else argv[a.slice(2)] = true; } }
const BASE = argv.base || 'http://127.0.0.1:5611/';
const ONLY = argv.only ? String(argv.only).split(',') : null;
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); };

async function open(browser, url, { profile = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, reducedMotion = 'no-preference' } = {}) {
  const context = await browser.newContext({ ...profile, reducedMotion });
  await context.addInitScript(() => { const raw = window.requestAnimationFrame.bind(window); window.__rawRaf = raw; window.__rafFrozen = false; window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); }); });
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  const log = { errors: [], warnings: [], requests: [], failed: [] };
  page.on('console', m => { const t = m.type(); if (t === 'error') log.errors.push(m.text().slice(0, 300)); else if (t === 'warning') log.warnings.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => log.errors.push('pageerror: ' + String(e.stack || e).slice(0, 500)));
  page.on('request', r => log.requests.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) log.failed.push(r.status() + ' ' + r.url()); });
  await page.route(u => u.pathname.endsWith('/js/main.js') || u.pathname.endsWith('/index2.html'), async route => {
    const resp = await route.fetch(); const body = await resp.text();
    await route.fulfill({ response: resp, body: body.replace('let sceneTime = 0;', 'let sceneTime = 0; window.__setSceneTime = v => { sceneTime = v; };') });
  });
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body && document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 180000, polling: 250 });
  await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; window.__rafFrozen = true; });
  await page.waitForTimeout(300);
  return { context, page, log };
}
const at = (page, t, settle = 40) => page.evaluate(({ t, settle }) => {
  const s = window.__MONTIS_STUDY__, C = s.CONFIG;
  s.journey.progress = s.journey.target = C.logo.at * 2.6 + t * C.logo.length; s.journey.velocity = 0; s.step(settle, 1 / 60);
  const B = s.brandMark, D = B.drops, L = B.letters;
  return {
    delivering: D.state.delivering ?? null, fuse: D.state.fuse ?? null,
    dropsShown: D.meshes.filter(m => m.visible).length, dropsGroup: D.group.visible,
    // the letters' own drops, and the plain water that travels with them (the crowd; none on a page without letters)
    letterDrops: D.meshes.filter(m => m.visible && m.userData.plain === undefined).length,
    plainDrops: D.meshes.filter(m => m.visible && m.userData.plain !== undefined).length,
    glyphOn: D.meshes.filter(m => m.visible && m.material.uniforms.uGlyphOn && m.material.uniforms.uGlyphOn.value > .5).length,
    lettersShown: L ? (L.group.visible ? L.letters.filter(l => l.mesh.visible).length : 0) : null, lettersReady: L ? L.ready : null,
    assembled: L ? L.state.assembled : null, meshVisible: B.mesh ? B.mesh.visible : null, rootVisible: B.root.visible,
    ice: L ? L.letters.map(l => +l.uniforms.uIce.value.toFixed(2)) : null,
    programs: s.renderer.info.programs.length, textures: s.renderer.info.memory.textures, geometries: s.renderer.info.memory.geometries
  };
}, { t, settle });
// drive frames by hand (the page's own loop is frozen) until COND holds; async work in the page gets time between frames
async function pump(page, cond, ms = 30000) {
  await page.evaluate(() => { window.__rafFrozen = false; });
  const t0 = Date.now(); let ok = false;
  while (Date.now() - t0 < ms) {
    ok = await page.evaluate(cond => { window.__MONTIS_STUDY__.step(1, 1 / 60); return (0, eval)('(' + cond + ')')(); }, String(cond));
    if (ok) break;
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => { window.__rafFrozen = true; });
  return ok;
}
// pixels of the canvas at a pinned scene clock, as a hash + the raw small thumbnail for a difference measure
const pixels = (page, t) => page.evaluate(({ t }) => {
  const s = window.__MONTIS_STUDY__, C = s.CONFIG;
  s.journey.progress = s.journey.target = C.logo.at * 2.6 + t * C.logo.length; s.journey.velocity = 0; s.step(150, 1 / 60);
  if (window.__setSceneTime) window.__setSceneTime(1000);
  s.step(1, 1 / 60);
  // exact 2x2 box averages down to a small picture, so per-pixel grain and sub-pixel shimmer average away
  let src = s.renderer.domElement;
  while (src.width / 2 >= 240) { const t = document.createElement('canvas'); t.width = Math.floor(src.width / 2); t.height = Math.floor(src.height / 2); const q = t.getContext('2d'); q.imageSmoothingEnabled = true; q.imageSmoothingQuality = 'high'; q.drawImage(src, 0, 0, t.width, t.height); src = t; }
  const x = document.createElement('canvas'); x.width = src.width; x.height = src.height;
  const g = x.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, x.width, x.height).data;
  let h = 2166136261 >>> 0; for (let i = 0; i < d.length; i += 1) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; }
  return { hash: h, w: x.width, h: x.height, pinned: !!window.__setSceneTime, data: Array.from(d) };
}, { t });

const tests = {
  async default(browser) {
    const { context, page, log } = await open(browser, BASE + 'index.html?tune=0');
    const slidesBefore = log.requests.filter(u => u.includes('/images/slides/')).length;
    const a = await at(page, -.5), b = await at(page, .02), c = await at(page, .3), d = await at(page, .55);
    // the word sets in its own time once the last letter is home: scroll (not jump) past the last gate, and look while it is setting
    const e = await page.evaluate(() => {
      const s = window.__MONTIS_STUDY__, C = s.CONFIG, P = t => C.logo.at * 2.6 + t * C.logo.length;
      s.journey.progress = s.journey.target = P(.6); s.journey.velocity = 0; s.step(30, 1 / 60);
      for (let i = 1; i <= 12; i++) { s.journey.progress = s.journey.target = P(.6 + .15 * i / 12); s.journey.velocity = 0; s.step(1, 1 / 60); }
      const B = s.brandMark, D = B.drops, L = B.letters;
      let seen = null;
      for (let i = 0; i < 260 && !seen; i++) { s.step(1, 1 / 60); if (D.state.fuse > .25 && D.state.fuse < .75) seen = { frames: i, fuse: D.state.fuse, lettersShown: L.letters.filter(l => l.mesh.visible).length, letterDrops: D.meshes.filter(m => m.visible && m.userData.plain === undefined).length, plainDrops: D.meshes.filter(m => m.visible && m.userData.plain !== undefined).length, assembled: L.state.assembled, ice: L.letters.map(l => +l.uniforms.uIce.value.toFixed(2)) }; }
      return seen || { fuse: D.state.fuse, never: true };
    });
    // (scrolled to, not jumped to: the swirl and the setting word are given the seconds they take)
    const f = await at(page, 1, 240), g = await at(page, 1.2);
    check('default: letters built before the chapter opens', b.lettersReady === true && b.delivering === true, { ready: b.lettersReady, delivering: b.delivering });
    check('default: before the entrance nothing of the mark is up', a.rootVisible === false && a.lettersShown === 0, a);
    // (not all eleven: a letter's drop gathers out of the air as it comes round, most of a turn before its gate)
    check('default: t=.02 the letters that have gathered are in their drops, in a crowd of plain water, no glass yet', b.letterDrops >= 7 && b.letterDrops <= 11 && b.glyphOn === b.letterDrops && b.plainDrops >= 12 && b.lettersShown === 0 && b.meshVisible === false, b);
    check('default: t=.3 word partly written, whole mark hidden', c.lettersShown >= 2 && c.lettersShown <= 5 && [11, 12].includes(c.letterDrops + c.lettersShown) && c.plainDrops >= 10 && c.meshVisible === false && c.assembled === false, c);
    check('default: t=.55 more letters, fewer of their drops, the water still turning', d.lettersShown > c.lettersShown && d.letterDrops < c.letterDrops && d.plainDrops >= 8, { letters: d.lettersShown, letterDrops: d.letterDrops, plain: d.plainDrops });
    check('default: scrolled past the last gate, all letters come home and the word sets in its own time, water still in the air', e.lettersShown === 11 && e.letterDrops === 0 && e.plainDrops > 0 && e.assembled === false && e.fuse > 0 && e.fuse < 1, { frames: e.frames, fuse: e.fuse, plain: e.plainDrops, ice: e.ice });
    check('default: t=1 assembled, the one wordmark is back, the swirl has left', f.assembled === true && f.meshVisible === true && f.dropsShown === 0 && Math.max(...f.ice) < .001, { assembled: f.assembled, mesh: f.meshVisible, drops: f.dropsShown, ice: f.ice });
    check('default: t=1.2 (forward transition) still the wordmark', g.meshVisible === true && g.assembled === true, { mesh: g.meshVisible, assembled: g.assembled });
    const slidesAfter = log.requests.filter(u => u.includes('/images/slides/')).length;
    check('default: no photographs were downloaded', slidesBefore === 0 && slidesAfter === 0, { before: slidesBefore, after: slidesAfter });
    // runtime switch back to photographs, and forth again
    await page.evaluate(() => { window.__MONTIS_STUDY__.CONFIG.logoDrops.letters = 0; });
    const p = await at(page, .3, 80);
    await page.waitForTimeout(1500);
    const p2 = await at(page, .3, 20);
    const slidesPhoto = log.requests.filter(u => u.includes('/images/slides/')).length;
    check('letters 0 at runtime: photo drops on the old helix, whole mark shown', p.delivering === false && p.glyphOn === 0 && p.dropsShown === 8 && p.meshVisible === true && p.lettersShown === 0, p);
    check('letters 0 at runtime: the photographs are fetched on demand', slidesPhoto === 8, { slides: slidesPhoto });
    await page.evaluate(() => { window.__MONTIS_STUDY__.CONFIG.logoDrops.letters = 1; });
    const q = await at(page, .3, 60);
    check('letters 1 again: back to the delivery', q.delivering === true && q.glyphOn === q.letterDrops && q.plainDrops === c.plainDrops && q.meshVisible === false && q.lettersShown === c.lettersShown, q);
    // a rebuild of the wordmark (depth slider) must rebuild the letters
    const before = await page.evaluate(() => window.__MONTIS_STUDY__.brandMark.letters.source === window.__MONTIS_STUDY__.brandMark.mesh);
    await page.evaluate(() => { window.__MONTIS_STUDY__.CONFIG.logo.depth = 2.1; });
    const rebuilt = await pump(page, () => { const B = window.__MONTIS_STUDY__.brandMark; return B.letters.ready && B.letters.source === B.mesh && Math.abs(B.letters.glyphs[0].depth - B.mesh.geometry.boundingBox.max.z) < 1e-6 && B.mesh.geometry.boundingBox.max.z < .095; });
    check('wordmark rebuilt (depth 2.4 -> 2.1): letters rebuilt from the new mesh', before && rebuilt);
    const r = await at(page, .5, 40);
    check('after rebuild: delivery still runs', r.delivering === true && r.lettersShown >= 4 && r.meshVisible === false, r);
    check('default: console clean', log.errors.length === 0 && log.warnings.length === 0, { errors: log.errors.slice(0, 4), warnings: log.warnings.slice(0, 4) });
    check('default: no failed requests', log.failed.length === 0, log.failed.slice(0, 4));
    await shut(context);
  },
  // the swirl: it turns with the scroll from the first frame of the chapter to the last, nothing in it touches anything
  // else in it, only the letters' drops break, and scrolled back it is exactly where it was
  async swirl(browser) {
    const { context, page, log } = await open(browser, BASE + 'index.html?tune=0');
    const probe = (t, settle = 3) => page.evaluate(({ t, settle }) => {
      const s = window.__MONTIS_STUDY__, C = s.CONFIG, D = s.brandMark.drops;
      s.journey.progress = s.journey.target = C.logo.at * 2.6 + t * C.logo.length; s.journey.velocity = 0; s.step(settle, 1 / 60);
      const live = D.group.visible ? D.meshes.filter(m => m.visible && m.material.uniforms.uOpacity.value > .05) : [];
      let gap = 1e9;
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        if (live[i].material.uniforms.uBurst.value > .02 || live[j].material.uniforms.uBurst.value > .02) continue;
        gap = Math.min(gap, live[i].position.distanceTo(live[j].position) - live[i].scale.x - live[j].scale.x);
      }
      return { t, gap: +gap.toFixed(3), plain: live.filter(m => m.userData.plain !== undefined).map(m => ({ id: m.userData.plain, angle: Math.atan2(m.position.x, m.position.z), y: m.position.y, ring: Math.hypot(m.position.x, m.position.z), size: m.scale.x })),
        letterDrops: live.filter(m => m.userData.plain === undefined).map(m => m.userData.slot), shown: live.length,
        breaking: live.filter(m => m.material.uniforms.uBurst.value > .02).map(m => m.userData.plain === undefined ? 'letter' : 'plain'),
        pose: live.map(m => [m.userData.slot, +m.position.x.toFixed(4), +m.position.y.toFixed(4), +m.position.z.toFixed(4), +m.scale.x.toFixed(4)]) };
    }, { t, settle });
    const times = []; for (let t = 0; t <= 1.0001; t += .01) times.push(+t.toFixed(2));
    const run = []; for (const t of times) run.push(await probe(t));
    const worst = run.reduce((m, r) => r.gap < m.gap ? r : m, { gap: 1e9 });
    check('swirl: no two drops ever touch (t 0 to 1)', worst.gap > 0, { gap: worst.gap, t: worst.t });
    check('swirl: only letters break', run.every(r => r.breaking.every(k => k === 'letter')) && run.some(r => r.breaking.length > 0), { breaks: run.filter(r => r.breaking.length).length });
    // every plain drop keeps going the same way round, a steady step for a steady scroll, for as long as it is there
    const cfg = await page.evaluate(() => { const C = window.__MONTIS_STUDY__.CONFIG.logoDrops; return { turns: C.swirlTurns, leave: C.swirlLeaveStart, start: C.deliverStart, end: C.deliverEnd, lift: C.gateLift }; });
    let steps = 0, back = 0, turned = 0; const first = new Map(), final = new Map(), round = new Map();
    for (let i = 1; i < run.length; i++) {
      if (run[i].t > cfg.leave + .02) break;   // after this the swirl is leaving, and climbs faster than it turns
      const before = new Map(run[i - 1].plain.map(p => [p.id, p]));
      for (const p of run[i].plain) {
        const q = before.get(p.id); if (!q) continue;
        let turn = q.angle - p.angle; while (turn > Math.PI) turn -= Math.PI * 2; while (turn < -Math.PI) turn += Math.PI * 2;
        steps++; turned += turn; if (turn < -.002) back++;
        if (!first.has(p.id)) first.set(p.id, q.y); final.set(p.id, p.y); round.set(p.id, (round.get(p.id) || 0) + turn);
      }
    }
    // (it follows the scroll with weight, so it starts each run gently; what it never does is turn back, and over the run it keeps the scroll's pace)
    const pace = turned / steps / (Math.PI * 2 * .01 * cfg.turns);
    check('swirl: the water turns one way, all chapter long, at the pace of the scroll', steps > 500 && back === 0 && Math.abs(pace - 1) < .2, { steps, back, meanTurnVsScroll: +pace.toFixed(3), turns: cfg.turns });
    // (round the back it runs nearly level, so the climb is asked of the drops that were followed a third of a turn or more)
    const followed = [...first].filter(([id]) => round.get(id) > 2), climbs = followed.map(([id, y]) => final.get(id) - y), all = [...first].map(([id, y]) => final.get(id) - y);
    check('swirl: and every drop of it climbs as it turns', climbs.length >= 12 && climbs.every(c => c > .05) && all.every(c => c > -.03), { followed: climbs.length, least: +Math.min(...climbs).toFixed(3), leastOfAll: +Math.min(...all).toFixed(3) });
    // one loop and no more: past the front a drop goes up and out, never round behind the word a second time
    // (round the back before its gate a drop rides low, under the word; past the gate it is high above it — nothing may ride between)
    const farSide = run.flatMap(r => r.t <= cfg.leave ? r.plain.filter(p => Math.abs(p.angle) > 1.9).map(p => p.y) : []), behind = farSide.filter(y => y > .2 && y < cfg.lift + .3);
    check('swirl: past the front it climbs out, and does not come round behind the word again', farSide.length > 100 && behind.length === 0 && farSide.some(y => y >= cfg.lift + .3), { samples: farSide.length, behindTheWord: behind.length, highest: +Math.max(...farSide).toFixed(2) });
    // the string holds: from the first letter to the leave there is always a line of water round the word
    const held = run.filter(r => r.t >= 0 && r.t <= cfg.leave).map(r => r.shown), large = run.filter(r => r.t >= cfg.end && r.t <= cfg.leave).map(r => r.plain.filter(p => p.size > .12).length);
    check('swirl: the string holds its form to the end — never fewer than a loop of drops, large ones among them after the word', Math.min(...held) >= 16 && Math.min(...large) >= 5, { fewest: Math.min(...held), most: Math.max(...held), fewestLargeAfterTheWord: Math.min(...large) });
    // every letter's drop has gathered well before its own gate
    const step = (cfg.end - cfg.start) / 13, late = [];
    for (let k = 0; k < 11; k++) { const due = cfg.start + (k + Math.floor(k / 3)) * step - .1, r = run.find(x => x.t >= due); if (r && r.t >= 0 && !r.letterDrops.includes(k)) late.push(k); }
    check('swirl: every letter is in its drop well before its gate', late.length === 0, { late });
    const last = run.filter(r => r.plain.length > 0).pop();
    check('swirl: water in the air until the chapter is almost over', last && last.t >= .93, { lastSeen: last && last.t });
    // scrolled away and back: the same picture
    const once = await probe(.37, 30); await probe(.93, 30); await probe(-.3, 30); const again = await probe(.37, 30);
    // (to within the idle bob and sway, which run on the clock and not on the scroll)
    let off = 0; if (once.pose.length === again.pose.length) once.pose.forEach((p, i) => p.forEach((v, k) => { off = Math.max(off, Math.abs(v - again.pose[i][k])); })); else off = Infinity;
    check('swirl: scrolled away and back, every drop is where it was', off < .08, { drops: once.pose.length, again: again.pose.length, off: +off.toFixed(4) });
    check('swirl: console clean', log.errors.length === 0 && log.warnings.length === 0, { errors: log.errors.slice(0, 4), warnings: log.warnings.slice(0, 4) });
    await shut(context);
  },
  // the timing: a letter's break and flight are set off by the swirl and then take their own time — the same time
  // however fast the page is scrolled — and scrolled back they run backward; a jump lands on the finished state
  async timing(browser) {
    const { context, page, log } = await open(browser, BASE + 'index.html?tune=0');
    const run = (k, framesToCross) => page.evaluate(({ k, framesToCross }) => {
      const s = window.__MONTIS_STUDY__, C = s.CONFIG, D = s.brandMark.drops, L = s.brandMark.letters, P = t => C.logo.at * 2.6 + t * C.logo.length;
      const place = k + Math.floor(k / 3), gate = C.logoDrops.deliverStart + place * (C.logoDrops.deliverEnd - C.logoDrops.deliverStart) / (L.letters.length - 1 + Math.floor((L.letters.length - 1) / 3));
      s.journey.progress = s.journey.target = P(gate - .2); s.journey.velocity = 0; s.step(2, 1 / 60);       // a jump: everything before is settled
      s.journey.progress = s.journey.target = P(gate - .09); s.step(150, 1 / 60);                             // the swirl comes to rest short of the gate
      const before = { stage: D.state.delivery[k].stage, drop: D.meshes[k].visible, letter: L.letters[k].mesh.visible };
      let breakFrames = 0, flightFrames = 0, started = -1, landed = -1;
      for (let i = 0; i < 400 && landed < 0; i++) {
        const u = Math.min(1, (i + 1) / framesToCross);
        s.journey.progress = s.journey.target = P(gate - .09 + .14 * u); s.step(1, 1 / 60);
        const d = D.state.delivery[k], burst = D.meshes[k].visible ? D.meshes[k].material.uniforms.uBurst.value : 1;
        if (d.stage && started < 0) started = i;
        if (started >= 0 && burst > 0 && burst < 1) breakFrames++;
        if (d.snap > 0 && d.snap < 1) flightFrames++;
        if (d.snap >= 1) landed = i;
      }
      const home = { snap: D.state.delivery[k].snap, drop: D.meshes[k].visible, letter: L.letters[k].mesh.visible };
      // and back again: scroll back past the gate
      for (let i = 0; i < 12; i++) { s.journey.progress = s.journey.target = P(gate + .05 - .14 * (i + 1) / 12); s.step(1, 1 / 60); }
      s.step(200, 1 / 60);
      const back = { stage: D.state.delivery[k].stage, snap: D.state.delivery[k].snap, drop: D.meshes[k].visible, letter: L.letters[k].mesh.visible, glyph: D.meshes[k].material.uniforms.uGlyphOn.value };
      return { before, breakFrames, flightFrames, home, back, breakTime: C.logoDrops.breakTime, flyTime: C.logoDrops.flyTime };
    }, { k, framesToCross });
    const fast = await run(4, 6), slow = await run(4, 150);
    const wantBreak = fast.breakTime * 60, wantFlight = fast.flyTime * 60;
    check('timing: before its gate a letter is in its drop', fast.before.stage === 0 && fast.before.drop && !fast.before.letter, fast.before);
    check('timing: scrolled fast, the break and the flight take their own time', Math.abs(fast.breakFrames - wantBreak) <= 3 && Math.abs(fast.flightFrames - wantFlight) <= 3, { breakFrames: fast.breakFrames, flightFrames: fast.flightFrames, want: [wantBreak, wantFlight] });
    check('timing: scrolled slowly, the very same time', Math.abs(slow.breakFrames - wantBreak) <= 3 && Math.abs(slow.flightFrames - wantFlight) <= 3, { breakFrames: slow.breakFrames, flightFrames: slow.flightFrames });
    check('timing: then the letter is home and its drop is gone', fast.home.snap >= 1 && !fast.home.drop && fast.home.letter, fast.home);
    check('timing: scrolled back, the letter is back in its drop', fast.back.stage === 0 && fast.back.snap === 0 && fast.back.drop && !fast.back.letter && fast.back.glyph === 1, fast.back);
    // the swirl follows with weight: a single notch of the wheel is spread over most of a second, not a third of one
    const glide = await page.evaluate(() => {
      const s = window.__MONTIS_STUDY__, C = s.CONFIG, D = s.brandMark.drops, P = t => C.logo.at * 2.6 + t * C.logo.length;
      s.journey.progress = s.journey.target = P(.4); s.journey.velocity = 0; s.step(150, 1 / 60);
      const mesh = D.meshes.find(m => m.visible && m.userData.plain !== undefined), a0 = Math.atan2(mesh.position.x, mesh.position.z);
      s.journey.target = P(.4 + .0726);                                   // one notch; the page's own spring carries the journey there
      const turned = [];
      for (let i = 0; i < 120; i++) { s.step(1, 1 / 60); let d = a0 - Math.atan2(mesh.position.x, mesh.position.z); while (d < -Math.PI) d += Math.PI * 2; turned.push(d); }
      const total = turned[turned.length - 1], at = f => turned.findIndex(v => v >= total * f) / 60;
      return { total: +total.toFixed(3), half: +at(.5).toFixed(2), most: +at(.9).toFixed(2), ease: C.logoDrops.swirlEase };
    });
    check('timing: one wheel notch is one unhurried turn of the swirl', glide.total > .3 && glide.half > .18 && glide.most > .45 && glide.most < 1.4, glide);
    // a jump is taken at once: no letters in the air, no drops mid-break
    const jump = await page.evaluate(() => {
      const s = window.__MONTIS_STUDY__, C = s.CONFIG, D = s.brandMark.drops, L = s.brandMark.letters, P = t => C.logo.at * 2.6 + t * C.logo.length;
      s.journey.progress = s.journey.target = P(-.3); s.journey.velocity = 0; s.step(3, 1 / 60);
      s.journey.progress = s.journey.target = P(.62); s.step(2, 1 / 60);
      return { flying: D.state.delivery.slice(0, L.letters.length).filter(d => d.snap > 0 && d.snap < 1).length, breaking: D.meshes.filter(m => m.visible && m.material.uniforms.uBurst.value > 0).length, home: D.state.delivery.slice(0, L.letters.length).filter(d => d.snap >= 1).length };
    });
    const due = await page.evaluate(() => { const C = window.__MONTIS_STUDY__.CONFIG.logoDrops, step = (C.deliverEnd - C.deliverStart) / 13; let n = 0; for (let k = 0; k < 11; k++) if (.62 > C.deliverStart + (k + Math.floor(k / 3)) * step - .028) n++; return n; });
    check('timing: a jump into the chapter lands on the finished state', jump.flying === 0 && jump.breaking === 0 && jump.home === due && due >= 8 && due <= 10, { ...jump, due });
    // the word's setting is a beat: the ring opens round it and closes again, and the word takes a breath
    const beat = await page.evaluate(() => {
      const s = window.__MONTIS_STUDY__, C = s.CONFIG, D = s.brandMark.drops, L = s.brandMark.letters, P = t => C.logo.at * 2.6 + t * C.logo.length;
      const end = C.logoDrops.deliverEnd;
      s.journey.progress = s.journey.target = P(end - .1); s.journey.velocity = 0; s.step(30, 1 / 60);
      for (let i = 1; i <= 12; i++) { s.journey.progress = s.journey.target = P(end - .1 + .13 * i / 12); s.journey.velocity = 0; s.step(1, 1 / 60); }
      const ring = () => { const m = D.meshes.filter(x => x.visible && x.userData.plain !== undefined).map(x => ({ id: x.userData.plain, r: Math.hypot(x.position.x, x.position.z) })); return new Map(m.map(x => [x.id, x.r])); };
      const wide = () => { const e = L.letters[0].mesh.matrix.elements, f = L.letters[10].mesh.matrix.elements; return Math.hypot(e[0], e[1], e[2]) ; };
      let before = null, rest = null, most = 0, swell = 0, base = 0, frames = 0;
      for (let i = 0; i < 400; i++) {
        s.step(1, 1 / 60); frames++;
        const fuse = D.state.fuse;
        if (fuse <= 0) { before = ring(); base = wide(); continue; }
        if (!before) break;
        const now = ring(); let sum = 0, n = 0; for (const [id, r] of now) if (before.has(id) && before.get(id) > .9) { sum += r / before.get(id); n++; }
        if (n) most = Math.max(most, sum / n);
        if (fuse < 1) swell = Math.max(swell, wide() / base);
        if (fuse >= 1) { rest = n ? sum / n : null; break; }
      }
      return { frames, most: +most.toFixed(4), rest: rest === null ? null : +rest.toFixed(4), swell: +swell.toFixed(4), kick: C.logoDrops.fuseKick, breath: C.logoLetters.fuseSwell };
    });
    check('timing: as the word sets the ring opens and closes again, and the word takes a breath', beat.most > 1 + beat.kick * .5 && beat.rest !== null && Math.abs(beat.rest - 1) < .02 && beat.swell > 1 + beat.breath * .6, beat);
    check('timing: console clean', log.errors.length === 0 && log.warnings.length === 0, { errors: log.errors.slice(0, 4), warnings: log.warnings.slice(0, 4) });
    await shut(context);
  },
  async variants(browser) {
    for (const v of [1, 2]) {
      const { context, page, log } = await open(browser, BASE + 'index.html?tune=0&logo=' + v);
      const a = await at(page, .3, 80);
      await page.waitForTimeout(1500);
      const b = await at(page, .3, 20);
      const slides = log.requests.filter(u => u.includes('/images/slides/')).length;
      check(`logo=${v}: no letters, photo drops, mark shown`, b.delivering === false && b.lettersReady === false && b.glyphOn === 0 && b.dropsShown === 8 && b.meshVisible === true, b);
      check(`logo=${v}: photographs fetched`, slides === 8, { slides });
      // switch to LOGO 3 at runtime: letters appear
      await page.evaluate(() => { window.__MONTIS_STUDY__.CONFIG.logo.variant = 3; });
      const ok = await pump(page, () => { const B = window.__MONTIS_STUDY__.brandMark; return B.activeVariant === 3 && B.letters.ready && B.letters.source === B.mesh; });
      const c = await at(page, .3, 60);
      check(`logo=${v} -> LOGO 3 at runtime: delivery takes over`, ok && c.delivering === true && c.glyphOn === c.letterDrops && c.plainDrops >= 10 && c.meshVisible === false, c);
      check(`logo=${v}: console clean`, log.errors.length === 0 && log.warnings.length === 0, { errors: log.errors.slice(0, 4), warnings: log.warnings.slice(0, 4) });
      await shut(context);
    }
  },
  async reduced(browser) {
    const { context, page, log } = await open(browser, BASE + 'index.html?tune=0', { reducedMotion: 'reduce' });
    const a = await at(page, .3), b = await at(page, 1);
    check('reduced motion: delivery is still scrubbed by the scroll', a.delivering === true && a.lettersShown >= 2 && a.meshVisible === false, a);
    check('reduced motion: assembled at the end', b.assembled === true && b.meshVisible === true, { assembled: b.assembled, mesh: b.meshVisible });
    check('reduced motion: console clean', log.errors.length === 0 && log.warnings.length === 0, { errors: log.errors.slice(0, 4), warnings: log.warnings.slice(0, 4) });
    await shut(context);
  },
  async phone(browser) {
    const { context, page, log } = await open(browser, BASE + 'index.html?tune=0', { profile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36' } });
    const a = await at(page, .3), b = await at(page, 1);
    const size = await page.evaluate(() => window.__MONTIS_STUDY__.brandMark.letters.glyphSize);
    check('phone: delivery runs, lite glyphs', a.delivering === true && a.lettersShown >= 2 && size === 160, { size, a });
    check('phone: assembled at the end', b.assembled === true && b.meshVisible === true);
    check('phone: console clean', log.errors.length === 0 && log.warnings.length === 0, { errors: log.errors.slice(0, 4), warnings: log.warnings.slice(0, 4) });
    await shut(context);
  },
  // LETTERS 0 on the new page must be the old page: same drops, same photographs, same mark
  async photoParity(browser) {
    const refBase = argv.ref;
    if (!refBase) { console.log('SKIP photoParity: needs --ref <url of the build to compare against>'); return; }
    const out = {};
    const diff = (a, b) => { let sum = 0, max = 0, over = 0; for (let i = 0; i < a.data.length; i++) { if (i % 4 === 3) continue; const e = Math.abs(a.data[i] - b.data[i]); sum += e; if (e > max) max = e; if (e > 6) over++; } return { mean: +(sum / (a.data.length * .75)).toFixed(4), max, over }; };
    for (const [label, base, off] of [['new', BASE, true], ['ref', refBase, false], ['ref2', refBase, false]]) {
      const { context, page, log } = await open(browser, base + 'index.html?tune=0');
      if (off) await page.evaluate(() => { window.__MONTIS_STUDY__.CONFIG.logoDrops.letters = 0; });
      await at(page, .3, 5);
      await page.evaluate(() => window.__MONTIS_STUDY__.brandMark.drops.ready);
      await at(page, .3, 60);
      out[label] = { px: [await pixels(page, -.2), await pixels(page, .2), await pixels(page, .44), await pixels(page, .9), await pixels(page, 1.2)], log };
      await shut(context);
    }
    const names = ['t=-.2 (entrance)', 't=.2', 't=.44', 't=.9', 't=1.2 (forward transition)'];
    names.forEach((name, i) => {
      const control = diff(out.ref.px[i], out.ref2.px[i]), change = diff(out.new.px[i], out.ref.px[i]);
      check('letters 0 vs the untouched page, ' + name, change.mean <= control.mean * 1.5 + .02 && change.over <= control.over * 1.5 + 8, { control, change });
    });
    check('letters 0: console clean', out.new.log.errors.length === 0 && out.new.log.warnings.length === 0, out.new.log.errors.slice(0, 3));
  },
  // index2.html is an older page that imports the same drops module: its picture must not move by a single bit
  async index2(browser) {
    const refBase = argv.ref;
    if (!refBase) { console.log('SKIP index2: needs --ref <url of the build to compare against>'); return; }
    const out = {};
    // 'ref2' is the untouched files a second time: the control that says whether two runs of the same code agree at all
    for (const [label, base] of [['new', BASE], ['ref', refBase], ['ref2', refBase]]) {
      const { context, page, log } = await open(browser, base + 'index2.html?tune=0');
      // the photographs develop when they arrive: have them all in before any pixel is compared
      await at(page, .3, 5);
      await page.evaluate(() => window.__MONTIS_STUDY__.brandMark.drops.ready);
      await at(page, .3, 60);
      out[label] = { px: [await pixels(page, .44), await pixels(page, .9)], state: await at(page, .3), log, letters: await page.evaluate(() => 'letters' in window.__MONTIS_STUDY__.brandMark) };
      await shut(context);
    }
    const diff = (a, b) => { let sum = 0, max = 0, over = 0; for (let i = 0; i < a.data.length; i++) { if (i % 4 === 3) continue; const e = Math.abs(a.data[i] - b.data[i]); sum += e; if (e > max) max = e; if (e > 6) over++; } return { mean: +(sum / (a.data.length * .75)).toFixed(4), max, over }; };
    const control = [0, 1].map(i => diff(out.ref.px[i], out.ref2.px[i])), change = [0, 1].map(i => diff(out.new.px[i], out.ref.px[i]));
    for (const p of [out.new, out.ref, out.ref2]) for (const q of p.px) delete q.data;
    console.log('     control (untouched vs untouched):', JSON.stringify(control), ' change (staged vs untouched):', JSON.stringify(change));
    check('index2: staged vs untouched differs no more than untouched vs itself (t=.44)', change[0].mean <= control[0].mean * 1.5 + .02 && change[0].over <= control[0].over * 1.5 + 8, { control: control[0], change: change[0] });
    check('index2: staged vs untouched differs no more than untouched vs itself (t=.9)', change[1].mean <= control[1].mean * 1.5 + .02 && change[1].over <= control[1].over * 1.5 + 8, { control: control[1], change: change[1] });
    check('index2: no letters module there, photo drops as before', out.new.letters === false && out.new.state.dropsShown === 8 && out.new.state.delivering === false, out.new.state);
    check('index2: console as before', JSON.stringify(out.new.log.errors) === JSON.stringify(out.ref.log.errors) && out.new.log.warnings.length === out.ref.log.warnings.length, { new: out.new.log.errors.slice(0, 3), ref: out.ref.log.errors.slice(0, 3) });
    const reqNew = out.new.log.requests.filter(u => u.includes('water-logo-letters')).length;
    check('index2: does not request the letters module', reqNew === 0, { reqNew });
  }
};

// (a headless GPU browser sometimes never answers a close: the results are in by then, so it is not waited on for ever)
const shut = thing => Promise.race([thing.close().catch(() => { }), new Promise(r => setTimeout(r, 8000))]);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  for (const [name, fn] of Object.entries(tests)) {
    if (ONLY && !ONLY.includes(name)) continue;
    try { await fn(browser); } catch (e) { check(name + ': ran to completion', false, String(e.stack || e).slice(0, 500)); }
  }
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  await shut(browser);
  process.exit(failed.length ? 1 : 0);
})();
