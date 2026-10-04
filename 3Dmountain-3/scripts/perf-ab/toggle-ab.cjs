// Visual cost of a single what-if switch, measured on the SAME frame at FULL resolution (no sim noise, no thumbnail blur):
// render the frame, flip one switch, render the identical state again, compare every pixel.
//   node scripts/perf-ab/toggle-ab.cjs http://127.0.0.1:5199/ [outDir]
// Switches: bloomOff | bloomHalf (bloom RTs at 1/2 size) | shadowOff | msaa2 | msaa0.  Also writes a ref|msaa2|msaa0 montage of the worst edge.
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path');
const BASE = process.argv[2] || 'http://127.0.0.1:5199/';
const OUT = process.argv[3] ? path.resolve(process.argv[3]) : null;
const PAGE = 'index4-6-3.html';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await context.addInitScript(() => { const raw = window.requestAnimationFrame.bind(window); window.__rawRaf = raw; window.__rafFrozen = false; window.requestAnimationFrame = cb => raw(t => { if (!window.__rafFrozen) cb(t); }); });
  const page = await context.newPage(); page.setDefaultTimeout(300000);
  await page.route(u => u.pathname.endsWith('/' + PAGE), async route => {
    const resp = await route.fetch(); let body = await resp.text();
    body = body.replace('let sceneTime = 0;', 'let sceneTime = 0; window.__setSceneTime = v => { sceneTime = v; };');
    body = body.replace('window.__MONTIS_STUDY__ = { canyonMotion,', 'window.__MONTIS_STUDY__ = { composer, renderTarget, bloom, canyonMotion,');
    await route.fulfill({ response: resp, body });
  });
  await page.goto(BASE + PAGE + '?tune=0', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.body.classList.contains('is-ready') && window.__MONTIS_STUDY__, null, { timeout: 300000, polling: 250 });
  await page.evaluate(() => { window.__rafFrozen = true; });
  const res = await page.evaluate(async () => {
    const S = window.__MONTIS_STUDY__, r = S.renderer, gl = r.getContext(), C = S.CONFIG;
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, N = W * H;
    const A = new Uint8Array(N * 4), B = new Uint8Array(N * 4);
    const shift = Math.max(0, S.logoChapterEnd() - C.disperse.handoff * 2.6) + S.forwardLength() - .572, ls = C.logo.at * 2.6;
    const where = { hero: 0, logo: ls + C.logo.length * .44, transition: S.logoChapterEnd() - .16, zoom: S.logoChapterEnd() + S.forwardLength() * .55,
                    canyon: 4.6 + shift, 'water-transition': 8.7 + shift, rivers: 10.98 + shift, finale: S.journey.max };
    const flag = () => { for (const root of [S.mainRenderPass.scene, S.canyon.scene]) root.traverse(o => { for (const m of (o.material ? [].concat(o.material) : [])) m.needsUpdate = true; }); };
    const protoSet = Object.getPrototypeOf(S.bloom).setSize;
    const V = {
      bloomOff:  { on: () => { S.bloom.enabled = false; }, off: () => { S.bloom.enabled = true; } },
      bloomHalf: { on: () => { S.bloom.setSize = (w, h) => protoSet.call(S.bloom, w / 2, h / 2); S.composer.setSize(innerWidth, innerHeight); }, off: () => { delete S.bloom.setSize; S.composer.setSize(innerWidth, innerHeight); } },
      shadowOff: { on: () => { r.shadowMap.enabled = false; flag(); }, off: () => { r.shadowMap.enabled = true; flag(); } },
      msaa2:     { on: () => { S.renderTarget.samples = 2; S.renderTarget.dispose(); }, off: () => { S.renderTarget.samples = 4; S.renderTarget.dispose(); } },
      msaa0:     { on: () => { S.renderTarget.samples = 0; S.renderTarget.dispose(); }, off: () => { S.renderTarget.samples = 4; S.renderTarget.dispose(); } }
    };
    const draw = () => { S.composer.render(0); S.composer.render(0); };           // twice: first one may compile / reallocate
    const grab = buf => gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const stats = () => { let sum = 0, se = 0, n8 = 0, n24 = 0; for (let i = 0; i < A.length; i += 4) { let m = 0; for (let c = 0; c < 3; c++) { const d = Math.abs(A[i + c] - B[i + c]); sum += d; se += d * d; if (d > m) m = d; } if (m > 8) n8++; if (m > 24) n24++; }
                          return { mad: +(sum / (N * 3)).toFixed(3), p8: +(n8 / N * 100).toFixed(3), p24: +(n24 / N * 100).toFixed(3), psnr: se === 0 ? 999 : +(10 * Math.log10(65025 / (se / (N * 3)))).toFixed(1) }; };
    const out = { size: [W, H], rows: {}, montage: {} };
    for (const [name, p] of Object.entries(where)) {
      S.journey.progress = S.journey.target = p; if (window.__setSceneTime) window.__setSceneTime(1000); S.step(150, 1 / 60); S.step(1, 1 / 60);
      out.rows[name] = {};
      for (const [vn, v] of Object.entries(V)) {
        draw(); grab(A); v.on(); draw(); grab(B); const st = stats();
        if (vn === 'msaa0' && (name === 'logo' || name === 'canyon' || name === 'zoom')) {   // worst edge block (64px) between 4x and no MSAA
          let best = -1, bx = 0, by = 0; const BS = 64;
          for (let y = 0; y + BS <= H; y += BS) for (let x = 0; x + BS <= W; x += BS) { let n = 0; for (let yy = y; yy < y + BS; yy += 2) { const o = (yy * W + x) * 4; for (let xx = 0; xx < BS; xx += 2) { const i = o + xx * 4; if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 30) n++; } } if (n > best) { best = n; bx = x; by = y; } }
          const cw = 160, ch = 100, x0 = Math.min(Math.max(bx + BS / 2 - cw / 2, 0), W - cw), yb = Math.min(Math.max(by + BS / 2 - ch / 2, 0), H - ch), yTop = H - (yb + ch), Z = 4;
          const m = document.createElement('canvas'); m.width = cw * Z * 3 + 8; m.height = ch * Z; const cx = m.getContext('2d'); cx.imageSmoothingEnabled = false; cx.fillStyle = '#f0f'; cx.fillRect(0, 0, m.width, m.height);
          v.off(); draw(); cx.drawImage(r.domElement, x0, yTop, cw, ch, 0, 0, cw * Z, ch * Z);                       // 4x (reference)
          V.msaa2.on(); draw(); cx.drawImage(r.domElement, x0, yTop, cw, ch, cw * Z + 4, 0, cw * Z, ch * Z); V.msaa2.off();   // 2x
          v.on(); draw(); cx.drawImage(r.domElement, x0, yTop, cw, ch, cw * Z * 2 + 8, 0, cw * Z, ch * Z);               // none
          out.montage[name] = m.toDataURL('image/png');
        }
        v.off(); draw();
        out.rows[name][vn] = st;
      }
    }
    return out;
  });
  console.log(`full-res compare @ ${res.size.join('x')}  (same frame, one switch flipped)   cell = meanAbsDiff / %px>24 / PSNR`);
  const vn = Object.keys(Object.values(res.rows)[0]);
  console.log('scenario'.padEnd(17) + vn.map(v => v.padStart(26)).join(''));
  for (const [s, row] of Object.entries(res.rows)) console.log(s.padEnd(17) + vn.map(v => `${row[v].mad} / ${row[v].p24}% / ${row[v].psnr >= 999 ? 'identical' : row[v].psnr + 'dB'}`.padStart(26)).join(''));
  if (OUT) { fs.mkdirSync(OUT, { recursive: true }); for (const [s, d] of Object.entries(res.montage)) { const f = path.join(OUT, `msaa-montage-${s}.png`); fs.writeFileSync(f, Buffer.from(d.split(',')[1], 'base64')); console.log('wrote', f); } }
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
