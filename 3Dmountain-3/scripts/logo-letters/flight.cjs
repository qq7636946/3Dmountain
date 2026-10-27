// Is a letter's journey smooth from inside its drop to its place in the word? At a steady scroll, frame by frame
// (deterministic stepping), follows one letter — the drop that carries it, then its own glass — on the screen, and
// reports its speed profile: where the speed jumps from one frame to the next (a jolt), and the path.
//   node flight.cjs [--base http://127.0.0.1:5611/] [--letter 3] [--rate 0.12]   (rate: chapter per second being scrolled)
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const argv = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { const n = process.argv[i + 1]; if (n !== undefined && !/^--[a-z]/.test(n)) { argv[a.slice(2)] = n; i++; } else argv[a.slice(2)] = true; } }
const BASE = argv.base || 'http://127.0.0.1:5611/', K = Number(argv.letter ?? 3), RATE = Number(argv.rate || .12);
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => { const raw = window.requestAnimationFrame.bind(window); window.__rafFrozen = false; window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); }); });
  const page = await context.newPage(); page.setDefaultTimeout(240000);
  const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  await page.goto(BASE + 'index.html?tune=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body && document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 180000, polling: 250 });
  await page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; window.__rafFrozen = true; });
  if (argv.exp) await page.evaluate(argv.exp);
  const out = await page.evaluate(({ K, RATE }) => {
    const s = window.__MONTIS_STUDY__, C = s.CONFIG, B = s.brandMark, D = B.drops, L = B.letters, cam = s.camera;
    const P = t => C.logo.at * 2.6 + t * C.logo.length;
    // from well before this letter's gate to well after it has landed
    const gate = C.logoDrops.deliverStart + (K + Math.floor(K / 3)) * (C.logoDrops.deliverEnd - C.logoDrops.deliverStart) / (10 + 3);
    const from = gate - .16, to = gate + .22, frames = Math.round((to - from) / RATE * 60);
    s.journey.progress = s.journey.target = P(from); s.journey.velocity = 0; s.step(90, 1 / 60);
    const rows = [], v = new (cam.position.constructor)();
    for (let i = 0; i <= frames; i++) {
      s.journey.progress = s.journey.target = P(from + (to - from) * i / frames); s.step(1, 1 / 60);
      const drop = D.meshes[K], letter = L.letters[K], d = D.state.delivery[K];
      let who = null;
      // while its glass is out it is the letter that the eye follows; before that, the drop that holds it
      if (L.group.visible && letter.mesh.visible && d.snap > 0) { v.copy(letter.center).applyMatrix4(letter.mesh.matrixWorld); who = 'letter'; }
      else if (drop.visible) { drop.getWorldPosition(v); who = 'drop'; }
      else if (L.group.visible && letter.mesh.visible) { v.copy(letter.center).applyMatrix4(letter.mesh.matrixWorld); who = 'letter'; }
      if (!who) { rows.push(null); continue; }
      v.project(cam);
      rows.push({ who, x: v.x * 720, y: -v.y * 450, snap: d.snap, burst: drop.visible ? drop.material.uniforms.uBurst.value : 1 });
    }
    return { gate, frames, rows };
  }, { K, RATE });
  const rows = out.rows, speed = [], jolt = [];
  for (let i = 1; i < rows.length; i++) speed.push(rows[i] && rows[i - 1] ? Math.hypot(rows[i].x - rows[i - 1].x, rows[i].y - rows[i - 1].y) * 60 : null);
  for (let i = 1; i < speed.length; i++) if (speed[i] !== null && speed[i - 1] !== null) jolt.push({ i, d: Math.abs(speed[i] - speed[i - 1]), at: rows[i + 1].who, snap: +rows[i + 1].snap.toFixed(3) });
  jolt.sort((a, b) => b.d - a.d);
  const valid = speed.filter(v => v !== null), peak = Math.max(...valid);
  const handover = rows.findIndex((r, i) => r && rows[i - 1] && r.who === 'letter' && rows[i - 1].who === 'drop');
  const gap = handover > 0 ? Math.hypot(rows[handover].x - rows[handover - 1].x, rows[handover].y - rows[handover - 1].y) : null;
  console.log(JSON.stringify({ letter: K, ratePerSec: RATE, frames: out.frames, peakSpeedPxPerSec: Math.round(peak), speedAtHandover: handover > 1 ? Math.round(speed[handover - 1]) : null, stepAtHandoverPx: gap !== null ? +gap.toFixed(2) : null,
    worstJolts: jolt.slice(0, 5).map(j => ({ frame: j.i, changePxPerSecPerFrame: Math.round(j.d), who: j.at, snap: j.snap })), missingFrames: rows.filter(r => !r).length, errors }));
  await browser.close();
})().catch(e => { console.error('FAIL', e.stack || e.message); process.exit(1); });
