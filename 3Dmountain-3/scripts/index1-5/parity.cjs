'use strict';
/* parity.cjs — "is the picture still the same?"  (perf effort 2026-10-25)
   capture: fixed, reproducible positions of index1-5 → lossless PNG frames + manifest (build id, config, state per frame).
   noise:   two captures of the SAME code → per frame / per 8×8 px cell / per 64×64 px tile floor (water, clouds, drops, grain move with time).
   compare: new capture vs base, per frame, against the base's own floor → PASS/FAIL, worst tile and where, diff contact sheets.
   No npm dependencies: PNG decode/encode is done here (node:zlib); the only browser use is Playwright (capture) and the sheets. */
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib'), crypto = require('node:crypto');
const L = require('./lib.cjs');

const USAGE = `parity.cjs — 畫面有沒有變？(is the picture still the same?)
用法：
  node scripts/index1-5/parity.cjs capture --name NAME [--profile desktop|phone] [--sections a,b,c] [--only id,id] [--twin-of BASE]
  node scripts/index1-5/parity.cjs noise   --base BASE --twin TWIN [--profile desktop|phone]
  node scripts/index1-5/parity.cjs compare --base BASE --new NAME [--profile desktop|phone] [--sections a,b,c] [--only id,id]
瀏覽器的部分一律走鎖：  node scripts/index1-5/with-lock.cjs "node scripts/index1-5/parity.cjs capture --name x"   (cmd 語法；工具本身沒走鎖時也會自己排隊)

capture   固定位置截圖（PNG 無損）存到 .qa/index1-5/parity-NAME-<profile>/ ＋ manifest.json（build ?v=、內容雜湊、CONFIG、每張的狀態、安定度）＋ config.json
  --name      名稱（必填）；已存在就拒絕（--force 才覆蓋同名檔案；基準 base 請小心）
  --profile   desktop（1440×900 DPR1，預設）｜phone（390×844 手機模擬 DPR2）
  --sections  open,flight,canyon,fourpaths,bridge,cards,world（預設全部；位置是絕對的，所以可以只拍一部分）
                open       p 0 / 0.6 / 1.5 / 2.4 / 3.2           flight  p 3.9 / 4.2 / 4.5（LOGO 前飛，跟著捲動）
                canyon     p 5.5 / 8 / 9.5                        fourpaths  p max
                bridge     portfolio.transition 0.2 / 0.5 / 0.8（直接給 portfolio.take()，等彈簧停）
                cards      卡牌 strip 0 / 0.5 / 1
                world      g0.3 g0.9 d0.2 d0.5 d0.8 h0.5 h1.5 h3 principles principles2 lw0.3 lw0.5 lw0.7 ls0.5 lh0.5 end
                           （世界段會先 logoSeal.cutClock=0，讓玻璃轉場跟著捲動而不是自己播）
  --only      只存這幾張（id 如 open-p0.6,world-d0.5；旅程位置照走但不存，世界段沒列的點直接略過）
  --query     額外網址參數（預設已帶 tune=0&logopanel=0）；--set "g.k=v" [--early] 改 CONFIG；--css "選擇器{…}" 注入 CSS（做「故意改壞」的對照用）
  --twin-of   拍完後，用 BASE 當第一份、這份當第二份，算雜訊底並存起來（base2 就這樣拍）
  --wait      每張到位後第一次截圖前等幾毫秒（預設 旅程 1800｜世界 1200）；--settle-mean/--settle-cap 調安定判斷（連續兩張的差不再縮小＝安定；水、雲、顆粒讓它停在固定的雜訊水準）
noise     算雜訊底：同一份程式碼拍兩次(BASE,TWIN)，每張算 全幅平均差、8×8 px 格的 p99／最大、64×64 px 區塊(8×8 格)的差，存 .qa/index1-5/parity-BASE-<profile>/noise.json
compare   NEW 對 BASE：每張畫面的每個 64 px 區塊，差 = min(對 BASE, 對 TWIN)（雜訊底的第二份，若還在）；
          區塊「超標」＝差 > max(K×該區塊雜訊底(含鄰格平滑), 絕對下限)；FAIL＝有 ≥ cluster 個相連的超標區塊，或任一區塊超過 hard×雜訊底。
          桌機 K=3 hard=6 下限=3.0 cluster=2；手機較鬆 K=4 hard=8 下限=5.0 cluster=3，同時印出按桌機標準會不會過（人看 diff 對照表判斷）。
  --k --hard --min --cluster   覆蓋門檻　--no-sheet 不產生對照表　--twin 指定雜訊底的第二份（預設照 noise.json）
  輸出：.qa/index1-5/parity-diff-NEW-vs-BASE-<profile>/compare.json、diff-<section>.jpg（每列：BASE｜NEW｜差×6，紅框＝超標區塊，黃框＝最糟區塊）、diff-fail.jpg
結束碼：0 通過｜1 FAIL／頁面有錯／拍的過程中 build 被改｜2 指令打錯｜3 超時
雜訊與限制：README 在 docs/perf/（parity 一節）；水、雲、掉落的水滴、影片、膠片顆粒是跟著時間動的，所以兩次拍永遠不會逐像素相同——這就是雜訊底的意義。`;

const SECTIONS = ['open', 'flight', 'canyon', 'fourpaths', 'bridge', 'cards', 'world'];
const JOURNEY = { open: [0, 0.6, 1.5, 2.4, 3.2], flight: [3.9, 4.2, 4.5], canyon: [5.5, 8, 9.5], fourpaths: ['max'] };
const BRIDGE_Q = [0.2, 0.5, 0.8];
const CARDS_S = [0, 0.5, 1];
const WORLD_POINTS = ['g:0.3', 'g:0.9', 'd:0.2', 'd:0.5', 'd:0.8', 'h:0.5', 'h:1.5', 'h:3', 'principles', 'principles2', 'lw:0.3', 'lw:0.5', 'lw:0.7', 'ls:0.5', 'lh:0.5', 'end'];
const CELL = 8, TILE = 64;                                                  // px: noise cell, decision tile (8×8 cells)
const THRESH = {
  desktop: { K: 3, hard: 6, min: 3.0, cluster: 2 },
  phone: { K: 4, hard: 8, min: 5.0, cluster: 3 },
};
const DEFAULT_QUERY = { tune: '0', logopanel: '0' };

const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
const profileOf = o => { const p = String(o.profile ?? 'desktop').toLowerCase(); if (p !== 'desktop' && p !== 'phone') throw new L.UsageError('--profile 只能是 desktop 或 phone'); return p; };
const safe = (s, what) => { if (!s || s === true) throw new L.UsageError(`缺少 ${what}`); return L.safeName(s); };
const dirOf = (name, profile) => path.join(L.QA_DIR, `parity-${L.safeName(name)}-${profile}`);
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const csv = s => String(s).split(',').map(x => x.trim()).filter(Boolean);

/* ------------------------------------------------------------------ PNG (8-bit RGB / RGBA, non-interlaced) */
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let pos = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0; const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || interlace || (ctype !== 2 && ctype !== 6)) throw new Error(`不支援的 PNG（depth ${depth} type ${ctype} interlace ${interlace}）`);
  const bpp = ctype === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), rec = Buffer.allocUnsafe(h * stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)], s = y * (stride + 1) + 1, d = y * stride, p = d - stride;
    if (ft === 0) { raw.copy(rec, d, s, s + stride); }
    else if (ft === 1) { for (let i = 0; i < stride; i++) rec[d + i] = (raw[s + i] + (i >= bpp ? rec[d + i - bpp] : 0)) & 255; }
    else if (ft === 2) { for (let i = 0; i < stride; i++) rec[d + i] = (raw[s + i] + (y ? rec[p + i] : 0)) & 255; }
    else if (ft === 3) { for (let i = 0; i < stride; i++) rec[d + i] = (raw[s + i] + (((i >= bpp ? rec[d + i - bpp] : 0) + (y ? rec[p + i] : 0)) >> 1)) & 255; }
    else if (ft === 4) {
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? rec[d + i - bpp] : 0, b = y ? rec[p + i] : 0, c = y && i >= bpp ? rec[p + i - bpp] : 0;
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        rec[d + i] = (raw[s + i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    } else throw new Error('PNG 濾鏡 ' + ft);
  }
  if (bpp === 3) return { w, h, rgb: rec };
  const rgb = Buffer.allocUnsafe(w * h * 3);
  for (let i = 0, j = 0; i < rec.length; i += 4, j += 3) { rgb[j] = rec[i]; rgb[j + 1] = rec[i + 1]; rgb[j + 2] = rec[i + 2]; }
  return { w, h, rgb };
}
const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function encodePng(w, h, rgb) {
  const raw = Buffer.allocUnsafe(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (type, data) => { const b = Buffer.alloc(12 + data.length); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'latin1'); data.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length); return b; };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 3 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ------------------------------------------------------------------ image maths */
/* mean |a−b| over R,G,B (0–255) per 8×8 px cell and per 64×64 px tile (edge cells weighted by their real pixel count) */
function diffGrid(a, b, w, h) {
  const cw = Math.ceil(w / CELL), ch = Math.ceil(h / CELL), tw = Math.ceil(w / TILE), th = Math.ceil(h / TILE);
  const cellSum = new Float64Array(cw * ch);
  let total = 0;
  for (let y = 0; y < h; y++) {
    const row = y * w * 3, cy = (y >> 3) * cw;
    for (let x = 0; x < w; x++) {
      const i = row + x * 3;
      let d = a[i] - b[i], e = a[i + 1] - b[i + 1], f = a[i + 2] - b[i + 2];
      if (d < 0) d = -d; if (e < 0) e = -e; if (f < 0) f = -f;
      const v = d + e + f; cellSum[cy + (x >> 3)] += v; total += v;
    }
  }
  const cells = new Float32Array(cw * ch), tileSum = new Float64Array(tw * th), tileCnt = new Float64Array(tw * th);
  for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
    const n = Math.min(CELL, w - cx * CELL) * Math.min(CELL, h - cy * CELL), s = cellSum[cy * cw + cx];
    cells[cy * cw + cx] = s / 3 / n;
    const t = (cy >> 3) * tw + (cx >> 3); tileSum[t] += s; tileCnt[t] += n;
  }
  const tiles = new Float32Array(tw * th); for (let i = 0; i < tiles.length; i++) tiles[i] = tileSum[i] / 3 / tileCnt[i];
  return { w, h, cw, ch, tw, th, cells, tiles, mean: total / 3 / (w * h) };
}
const pct = (arr, q) => { const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };
function worstCell(g) { let m = -1, at = 0; for (let i = 0; i < g.cells.length; i++) if (g.cells[i] > m) { m = g.cells[i]; at = i; } return { v: m, cx: at % g.cw, cy: Math.floor(at / g.cw) }; }
/* mean absolute gradient of the green channel — a blur / lost-texture-detail detector (same-size images) */
function sharpness(rgb, w, h) {
  let s = 0; const w3 = w * 3;
  for (let y = 0; y < h - 1; y++) for (let x = 0, i = y * w3 + 1; x < w - 1; x++, i += 3) { const g = rgb[i]; s += Math.abs(rgb[i + 3] - g) + Math.abs(rgb[i + w3] - g); }
  return s / ((w - 1) * (h - 1));
}
/* quick settle test between two consecutive screenshots: every second pixel, mean + the worst 64 px tile */
function quickDelta(a, b, w, h) {
  const tw = Math.ceil(w / TILE), th = Math.ceil(h / TILE), sum = new Float64Array(tw * th), cnt = new Float64Array(tw * th); let total = 0, n = 0;
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const i = (y * w + x) * 3; let d = a[i] - b[i], e = a[i + 1] - b[i + 1], f = a[i + 2] - b[i + 2];
    if (d < 0) d = -d; if (e < 0) e = -e; if (f < 0) f = -f;
    const v = d + e + f, t = (y >> 6) * tw + (x >> 6); sum[t] += v; cnt[t]++; total += v; n++;
  }
  let tile = 0; for (let i = 0; i < sum.length; i++) tile = Math.max(tile, sum[i] / 3 / cnt[i]);
  return { mean: total / 3 / n, tile };
}
/* box-downsample by integer factor f; if b is given, the result is the amplified |a−b| (grey) instead */
function thumb(a, w, h, f, b = null, gain = 6) {
  const w2 = Math.floor(w / f), h2 = Math.floor(h / f), out = Buffer.alloc(w2 * h2 * 3), inv = 1 / (f * f);
  for (let y2 = 0; y2 < h2; y2++) for (let x2 = 0; x2 < w2; x2++) {
    let r = 0, g = 0, bl = 0, d = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
      const i = ((y2 * f + dy) * w + x2 * f + dx) * 3;
      if (b) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); else { r += a[i]; g += a[i + 1]; bl += a[i + 2]; }
    }
    const o = (y2 * w2 + x2) * 3;
    if (b) { const v = Math.min(255, d * inv / 3 * gain); out[o] = out[o + 1] = out[o + 2] = v; } else { out[o] = r * inv; out[o + 1] = g * inv; out[o + 2] = bl * inv; }
  }
  return { w: w2, h: h2, data: out };
}
function rect(t, x0, y0, x1, y1, [r, g, b], thick = 1) {
  const put = (x, y) => { if (x < 0 || y < 0 || x >= t.w || y >= t.h) return; const o = (y * t.w + x) * 3; t.data[o] = r; t.data[o + 1] = g; t.data[o + 2] = b; };
  for (let k = 0; k < thick; k++) for (let x = x0; x <= x1; x++) { put(x, y0 + k); put(x, y1 - k); }
  for (let k = 0; k < thick; k++) for (let y = y0; y <= y1; y++) { put(x0 + k, y); put(x1 - k, y); }
}

/* ------------------------------------------------------------------ build fingerprint (what the page is made of right now) */
function fingerprint() {
  const h = crypto.createHash('sha1'); let files = 0, bytes = 0;
  const add = f => { try { const b = fs.readFileSync(f); h.update(L.rel(f)); h.update(b); files++; bytes += b.length; } catch { } };
  const list = (dir, re) => { try { return fs.readdirSync(dir).filter(f => re.test(f)).sort().map(f => path.join(dir, f)); } catch { return []; } };
  add(path.join(L.ROOT, L.PAGE_FILE));
  for (const f of list(path.join(L.PROTO, 'js'), /\.(m?js)$/)) add(f);
  for (const f of list(L.PROTO, /\.css$|^alpine-ui\.js$/)) add(f);
  for (const f of list(path.join(L.ROOT, 'js'), /\.(m?js)$/)) add(f);
  for (const f of list(path.join(L.ROOT, 'css'), /\.css$/)) add(f);
  const a = crypto.createHash('sha1');                             // asset names + sizes (not contents, not mtimes: Drive touches them)
  for (const sub of ['images', 'media', 'models', 'prototypes/index1-5/assets']) {
    const walk = (d, rel) => { let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { } for (const e of ents.sort((x, y) => x.name < y.name ? -1 : 1)) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, rel + e.name + '/'); else { try { a.update(rel + e.name + ':' + fs.statSync(p).size + ';'); } catch { } } } };
    walk(path.join(L.ROOT, sub), sub + '/');
  }
  return { sha1: h.digest('hex').slice(0, 16), files, bytes, assets: a.digest('hex').slice(0, 16) };
}
function versionsOfPage() {
  const html = fs.readFileSync(path.join(L.ROOT, L.PAGE_FILE), 'utf8'), v = {};
  for (const m of html.matchAll(/([\w.\-/]+?\.(?:js|css))\?v=([\w.\-]+)/g)) v[m[1].split('/').pop()] = m[2];
  return v;
}

/* ------------------------------------------------------------------ capture */
function parseSections(s) {
  if (s === undefined) return SECTIONS.slice();
  const list = csv(s); const bad = list.filter(x => !SECTIONS.includes(x));
  if (bad.length || !list.length) throw new L.UsageError(`--sections 看不懂 ${bad.join(',') || s}（可用 ${SECTIONS.join(',')}）`);
  return SECTIONS.filter(x => list.includes(x));
}
const fmtP = p => p === 'max' ? 'max' : String(p);

async function capture(o) {
  const name = safe(o.name, '--name'), profile = profileOf(o), sections = parseSections(o.sections);
  const only = o.only ? new Set(csv(o.only)) : null;
  const sets = o.set !== undefined ? L.parseSets(o.set) : [];
  if (o.early && !sets.length) throw new L.UsageError('--early 要搭配 --set');
  const css = o.css !== undefined && o.css !== true ? String(o.css) : null;
  const dir = dirOf(name, profile);
  if (fs.existsSync(path.join(dir, 'manifest.json')) && !o.force) throw new L.UsageError(`${L.rel(dir)} 已經有一份 capture；換個名字，或確定要覆蓋就加 --force`);
  const twinOf = o['twin-of'] ? safe(o['twin-of'], '--twin-of') : null;
  if (twinOf && !fs.existsSync(path.join(dirOf(twinOf, profile), 'manifest.json'))) throw new L.UsageError(`--twin-of ${twinOf}：找不到 ${L.rel(dirOf(twinOf, profile))}`);
  const settle = { mean: L.opt(o, 'settle-mean', 0.5, { min: 0 }), cap: L.opt(o, 'settle-cap', 6, { min: 0, max: 30, int: true }) };
  const waitJ = L.opt(o, 'wait', 1800, { min: 0 }), waitW = o.wait !== undefined ? waitJ : 1200;

  const t0 = Date.now(), fp0 = fingerprint(), versions = versionsOfPage();
  const o2 = Object.assign({}, o, { phone: profile === 'phone', query: o.query });
  const s = await L.openSession('parity', o2, { defaults: DEFAULT_QUERY, autoplay: true, early: o.early ? sets : null });
  const { page, log, vp } = s;
  const net = new Set();                                   // in-flight non-media requests, to wait for lazy textures
  const track = r => !/^(media|websocket|eventsource)$/.test(r.resourceType());
  page.on('request', r => { if (track(r)) net.add(r); });
  page.on('requestfinished', r => net.delete(r)); page.on('requestfailed', r => net.delete(r));
  const waitIdle = async (quiet = 700, timeout = 20000) => {
    const t = Date.now(); let since = Date.now();
    while (Date.now() - t < timeout) { if (net.size) since = Date.now(); else if (Date.now() - since >= quiet) return true; await L.sleep(100); }
    return false;
  };
  if (css) await page.addStyleTag({ content: css });
  const manifest = {
    tool: 'parity', version: 1, name, profile, viewport: vp, complete: false, created: new Date().toISOString(), args: process.argv.slice(2),
    url: s.url, query: o.query || null, sets: null, css, sections, only: only ? [...only] : null, twinOf,
    build: { id: versions['main.js'] || null, versions, content: fp0, stable: null }, settle, ms: s.ms, frames: [], errors: [], notes: [],
  };
  if (s.early) manifest.sets = { mode: 'early', ...s.early };
  else if (sets.length) manifest.sets = { mode: 'runtime', ...await L.applySets(page, sets) };
  const cfg = await page.evaluate(() => { try { return JSON.parse(JSON.stringify(window.__MONTIS_STUDY__.CONFIG)); } catch (e) { return { error: String(e) }; } });
  manifest.configHash = crypto.createHash('sha1').update(JSON.stringify(cfg)).digest('hex').slice(0, 12);
  L.writeJson(path.join(dir, 'config.json'), cfg);
  L.note(`parity capture ${name} (${profile}) sections ${sections.join(',')} · build ${manifest.build.id} · content ${fp0.sha1}`);

  const stateOf = async () => ({ ...await L.readState(page) });
  /* screenshot → decode; take frames 350 ms apart until two consecutive ones agree: the difference between consecutive shots stops
     shrinking (a fade / spring is still running while it shrinks; water, clouds and grain keep it at a steady level), or it is ≈0, or the cap */
  async function settledShot(wait) {
    await waitIdle(); await page.waitForTimeout(wait);
    let prev = await page.screenshot({ type: 'png' }), prevPx = decodePng(prev), dprev = null; const hist = [];
    for (let i = 1; i <= settle.cap; i++) {
      await page.waitForTimeout(350);
      const cur = await page.screenshot({ type: 'png' }), px = decodePng(cur), d = quickDelta(prevPx.rgb, px.rgb, px.w, px.h);
      hist.push([r2(d.mean), r1(d.tile)]);
      const steady = dprev !== null && d.mean <= dprev * 1.35 && d.mean >= dprev / 1.6;
      if (d.mean <= settle.mean || steady) return { buf: cur, settled: true, attempts: i + 1, hist };
      dprev = d.mean; prev = cur; prevPx = px;
    }
    return { buf: prev, settled: settle.cap === 0, attempts: settle.cap + 1, hist };
  }
  async function frame(section, id, wait, extra = {}) {
    if (only && !only.has(id)) { await page.waitForTimeout(Math.min(wait, 500)); return null; }
    const shot = await settledShot(wait), file = path.join(dir, id + '.png');
    L.writeFile(file, shot.buf);
    const st = await stateOf(), px = { w: shot.buf.readUInt32BE(16), h: shot.buf.readUInt32BE(20) };
    const rec = { id, section, file: path.basename(file), w: px.w, h: px.h, settled: shot.settled, attempts: shot.attempts, settleHist: shot.hist, state: st, ...extra };
    manifest.frames.push(rec);
    L.note(`${id.padEnd(22)} ${px.w}×${px.h} settled ${shot.settled ? 'yes' : 'NO '} after ${shot.attempts} shots  last Δ ${JSON.stringify(shot.hist[shot.hist.length - 1] || null)}`);
    return rec;
  }
  const stillJourney = () => page.waitForFunction(() => { const j = window.__MONTIS_STUDY__.journey; return Math.abs(j.progress - j.target) < 8e-4 && Math.abs(j.velocity || 0) < 1e-3; }, null, { timeout: 8000, polling: 100 }).catch(() => { });
  const writeManifest = () => L.writeJson(path.join(dir, 'manifest.json'), manifest);

  try {
    await page.waitForTimeout(1200);
    await page.waitForFunction(() => { const e = window.__MONTIS_STUDY__.entry; return !e || e.done || !e.running; }, null, { timeout: 15000, polling: 200 }).catch(() => manifest.notes.push('entry did not finish within 15 s'));
    /* journey */
    for (const sec of ['open', 'flight', 'canyon', 'fourpaths']) {
      if (!sections.includes(sec)) continue;
      for (const p of JOURNEY[sec]) {
        const f = await L.fly(page, p); await stillJourney();
        const rec = await frame(sec, `${sec}-p${fmtP(p)}`, p === 0 ? Math.max(waitJ, 3000) : waitJ, { at: fmtP(p), reached: f.ok });
        if (!f.ok) manifest.errors.push(`位置 ${p} 沒有到（停在 ${f.progress}）`);
        if (rec && !f.ok) rec.reached = false;
      }
    }
    /* bridge + cards: portfolio.take() with exactly the distance the wheel would send (steps × one notch), then wait for the spring to snap */
    let bt = 0;
    const needBridge = sections.includes('bridge') || sections.includes('cards');
    if (needBridge) {
      const f = await L.fly(page, 'max'); if (!f.ok) manifest.errors.push('bridge：旅程沒有到終點'); await stillJourney(); await page.waitForTimeout(1200);
      await page.waitForFunction(() => { const P = window.__MONTIS_STUDY__.portfolio; return !!(P && P.ready); }, null, { timeout: 90000, polling: 200 });
    }
    const setBridge = async q => {
      const span = await page.evaluate(() => { const m = window.__MONTIS_STUDY__.CONFIG.mist || {}, unit = 100 / Math.max(720, innerHeight * .85), steps = +m.steps; return Number.isFinite(steps) && steps >= 2 ? steps * unit : (+m.length > .2 ? +m.length : 1.3); });
      await page.evaluate(d => { window.__MONTIS_STUDY__.portfolio.take(d); }, (q - bt) * span); bt = q;
      const snapped = await page.waitForFunction(q => Math.abs(window.__MONTIS_STUDY__.portfolio.transition - q) < 1e-6, q, { timeout: 6000, polling: 40 }).then(() => true, () => false);
      if (!snapped) manifest.notes.push(`bridge q=${q}: the spring did not snap within 6 s (transition ${r3(await page.evaluate(() => window.__MONTIS_STUDY__.portfolio.transition))})`);
      await page.waitForTimeout(500);
    };
    if (sections.includes('bridge')) {
      for (const q of BRIDGE_Q) { await setBridge(q); await frame('bridge', `bridge-q${q}`, waitJ, { q }); }
    }
    if (sections.includes('cards')) {
      await setBridge(1);
      for (const t of CARDS_S) {
        await page.evaluate(t => { const P = window.__MONTIS_STUDY__.portfolio; let n = 0; while (P.strip < t - 1e-9 && n++ < 4000) P.take(0.01); }, t);
        await frame('cards', `cards-s${t}`, waitJ + 400, { strip: t });
      }
    }
    /* world */
    if (sections.includes('world')) {
      const cut = L.parseSets('logoSeal.cutClock=0'); manifest.worldSets = await L.applySets(page, cut);
      const w = await L.enterWorld(page, vp);
      const st = w.state; manifest.world = { notches: w.notches, maxY: st.maxY, at: st.at, ocean: st.ocean && st.ocean.at, logo: st.logo && st.logo.at };
      const H = vp.height;
      for (const tok of WORLD_POINTS) {
        const id = 'world-' + tok.replace(':', '');
        if (only && !only.has(id)) continue;
        const fresh = await page.evaluate(() => { const s = window.__MONTIS_STUDY__.world.state; return { principles: s.principles ? { top: s.principles.top, secondTop: s.principles.secondTop } : null }; });
        let y;
        if (tok === 'principles') y = (fresh.principles ? fresh.principles.top : st.at.principles) + H * .12;
        else if (tok === 'principles2') y = (fresh.principles && fresh.principles.secondTop ? fresh.principles.secondTop : st.at.principles + H * 1.6) + H * .12;
        else y = L.worldY(st, tok);
        if (/^l/.test(tok)) { const cur = await L.logoNow(page); if (!cur || !cur.ready) manifest.logoPrepare = await L.prepareLogo(page, st); }
        await L.jumpWorld(page, y);
        if (/^principles/.test(tok)) await page.waitForFunction(k => { const p = window.__MONTIS_STUDY__.world.state.principles; return !p || (k === 'principles2' ? p.secondReady || p.secondFailed : p.ready || p.failed); }, tok, { timeout: 30000, polling: 200 }).catch(() => manifest.notes.push(`${tok}: principles not ready within 30 s`));
        const extra = { y: Math.round(y), ocean: await L.oceanNow(page).catch(() => null) };
        if (/^l/.test(tok)) extra.logo = await L.logoNow(page);
        await frame('world', id, waitW, extra);
      }
    }
  } finally {
    manifest.build.contentEnd = fingerprint();
    manifest.build.stable = manifest.build.contentEnd.sha1 === fp0.sha1 && manifest.build.contentEnd.assets === fp0.assets;
    const lj = L.logJson(log); manifest.pageErrors = lj.errors; manifest.ignored = lj.ignored; manifest.warnings = lj.warnings; manifest.http = lj.http; manifest.errors.push(...log.errors);
    manifest.ms = { ...manifest.ms, total: Date.now() - t0 };
    manifest.complete = manifest.frames.length > 0;
    writeManifest();
  }
  if (!manifest.build.stable) console.log('!! 拍的過程中 build 內容被改了（content ' + fp0.sha1 + ' → ' + manifest.build.contentEnd.sha1 + '）——這份 capture 不能當基準，請在鎖裡重拍');
  const unsettled = manifest.frames.filter(f => !f.settled).map(f => f.id);
  console.log(`capture ${name} (${profile}): ${manifest.frames.length} frames in ${Math.round((Date.now() - t0) / 1000)} s · build ${manifest.build.id} · content ${fp0.sha1} · config ${manifest.configHash}`);
  if (unsettled.length) console.log('not settled (kept the last shot; its noise is bigger):', unsettled.join(', '));
  console.log('manifest', L.abs(path.join(dir, 'manifest.json')));
  L.printLog(log);
  if (twinOf) { await L.sleep(0); computeNoise(twinOf, name, profile, true); }
  return manifest.errors.length || !manifest.build.stable ? 1 : 0;
}

/* ------------------------------------------------------------------ noise floor */
function loadFrame(dir, rec) { const px = decodePng(fs.readFileSync(path.join(dir, rec.file))); return px; }
function computeNoise(base, twin, profile, quiet = false) {
  const bDir = dirOf(base, profile), tDir = dirOf(twin, profile);
  const mb = readJson(path.join(bDir, 'manifest.json')), mt = readJson(path.join(tDir, 'manifest.json'));
  const ids = mb.frames.map(f => f.id).filter(id => mt.frames.some(f => f.id === id));
  if (!ids.length) throw new Error(`${base} 和 ${twin} 沒有共同的畫面`);
  const out = { tool: 'parity-noise', base, twin, profile, created: new Date().toISOString(), baseBuild: mb.build.id, twinBuild: mt.build.id, baseContent: mb.build.content.sha1, twinContent: mt.build.content.sha1, sameCode: mb.build.content.sha1 === mt.build.content.sha1, cell: CELL, tile: TILE, frames: {} };
  if (!out.sameCode) console.log(`!! ${base} 和 ${twin} 的 build 內容不同（${out.baseContent} / ${out.twinContent}）——這不是「同一份程式碼拍兩次」，雜訊底會偏大`);
  for (const id of ids) {
    const rb = mb.frames.find(f => f.id === id), rt = mt.frames.find(f => f.id === id);
    const A = loadFrame(bDir, rb), B = loadFrame(tDir, rt);
    if (A.w !== B.w || A.h !== B.h) { console.log(`skip ${id}: size ${A.w}×${A.h} vs ${B.w}×${B.h}`); continue; }
    const g = diffGrid(A.rgb, B.rgb, A.w, A.h), wc = worstCell(g), sa = sharpness(A.rgb, A.w, A.h), sb = sharpness(B.rgb, B.w, B.h);
    out.frames[id] = {
      w: A.w, h: A.h, mean: r3(g.mean), p99: r2(pct(g.cells, .99)), cellMax: r1(wc.v), cellMaxAt: [wc.cx * CELL, wc.cy * CELL],
      tileMax: r2(Math.max(...g.tiles)), tileP95: r2(pct(g.tiles, .95)), sharpBase: r3(sa), sharpTwin: r3(sb), sharpFloor: r3(Math.abs(sb / sa - 1)),
      settled: [rb.settled, rt.settled], tiles: { tw: g.tw, th: g.th, F: Array.from(g.tiles, r2) },
    };
  }
  const file = path.join(bDir, 'noise.json'); L.writeJson(file, out);
  const f = Object.entries(out.frames);
  if (!quiet || true) {
    console.log(`noise floor ${base} vs ${twin} (${profile}): ${f.length} frames${out.sameCode ? '' : ' (DIFFERENT CODE)'}`);
    console.log('frame'.padEnd(22) + 'mean'.padStart(7) + 'p99cell'.padStart(9) + 'maxcell'.padStart(9) + 'tileP95'.padStart(9) + 'tileMax'.padStart(9) + 'sharpΔ'.padStart(8) + '  settled');
    for (const [id, v] of f) console.log(id.padEnd(22) + String(v.mean).padStart(7) + String(v.p99).padStart(9) + String(v.cellMax).padStart(9) + String(v.tileP95).padStart(9) + String(v.tileMax).padStart(9) + String(v.sharpFloor).padStart(8) + '  ' + v.settled.map(x => x ? 'y' : 'N').join('/'));
    const means = f.map(([, v]) => v.mean).sort((a, b) => a - b);
    console.log(`summary: mean-of-means ${r3(means.reduce((a, b) => a + b, 0) / means.length)} · median ${means[means.length >> 1]} · max ${means[means.length - 1]} (${f.find(([, v]) => v.mean === means[means.length - 1])[0]}) · tileMax overall ${Math.max(...f.map(([, v]) => v.tileMax))}`);
    console.log('noise.json', L.abs(file));
  }
  return out;
}

/* ------------------------------------------------------------------ compare */
const regionOf = (x, y, w, h) => `${y < h / 3 ? 'top' : y < 2 * h / 3 ? 'middle' : 'bottom'}-${x < w / 3 ? 'left' : x < 2 * w / 3 ? 'centre' : 'right'}`;
/* per tile: limit = max(K × smoothed floor, min); flagged = d > limit; fail = a connected cluster ≥ cluster, or any tile > hard × floor (and > 2 min) */
function judge(d, F, tw, th, thr) {
  const n = tw * th, Feff = new Float32Array(n), limit = new Float32Array(n), flag = new Uint8Array(n), hardFlag = new Uint8Array(n);
  for (let ty = 0; ty < th; ty++) for (let tx = 0; tx < tw; tx++) {
    let s = 0, c = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = tx + dx, y = ty + dy; if (x >= 0 && y >= 0 && x < tw && y < th) { s += F[y * tw + x]; c++; } }
    const i = ty * tw + tx; Feff[i] = Math.max(F[i], 0.7 * s / c); limit[i] = Math.max(thr.K * Feff[i], thr.min);
    flag[i] = d[i] > limit[i] ? 1 : 0; hardFlag[i] = d[i] > Math.max(thr.hard * Feff[i], 2 * thr.min) ? 1 : 0;
  }
  const seen = new Uint8Array(n), clusters = [];
  for (let i = 0; i < n; i++) {
    if (!flag[i] || seen[i]) continue;
    const q = [i], members = []; seen[i] = 1;
    while (q.length) {
      const k = q.pop(); members.push(k); const x = k % tw, y = Math.floor(k / tw);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= tw || ny >= th) continue; const j = ny * tw + nx; if (flag[j] && !seen[j]) { seen[j] = 1; q.push(j); } }
    }
    clusters.push(members);
  }
  const failTiles = new Set(); let failing = 0;
  for (const c of clusters) if (c.length >= thr.cluster || c.some(k => hardFlag[k])) { failing++; c.forEach(k => failTiles.add(k)); }
  let worst = 0, wr = -1; for (let i = 0; i < n; i++) { const r = d[i] / limit[i]; if (r > wr) { wr = r; worst = i; } }
  const spots = clusters.filter(c => !(c.length >= thr.cluster || c.some(k => hardFlag[k]))).length;
  return { fail: failing > 0, clusters: clusters.length, failingClusters: failing, spots, flagged: flag.reduce((a, b) => a + b, 0), failTiles, flag, worst: { tile: worst, tx: worst % tw, ty: Math.floor(worst / tw), d: r2(d[worst]), floor: r2(Feff[worst]), limit: r2(limit[worst]), ratio: r2(wr) } };
}

async function compare(o) {
  const base = safe(o.base, '--base'), nw = safe(o.new, '--new'), profile = profileOf(o);
  const bDir = dirOf(base, profile), nDir = dirOf(nw, profile);
  for (const d of [bDir, nDir]) if (!fs.existsSync(path.join(d, 'manifest.json'))) throw new L.UsageError(`找不到 ${L.rel(d)}/manifest.json（先 capture）`);
  const mb = readJson(path.join(bDir, 'manifest.json')), mn = readJson(path.join(nDir, 'manifest.json'));
  let noise;
  const nf = path.join(bDir, 'noise.json');
  if (fs.existsSync(nf)) noise = readJson(nf);
  else if (o.twin && o.twin !== true) { console.log('noise.json 不存在，用 --twin 現算'); noise = computeNoise(base, safe(o.twin, '--twin'), profile, true); }
  else throw new L.UsageError(`${L.rel(nf)} 不存在：先 noise --base ${base} --twin <第二份>，或 capture --name <第二份> --twin-of ${base}`);
  const twinName = o.twin && o.twin !== true ? safe(o.twin, '--twin') : noise.twin, tDir = twinName ? dirOf(twinName, profile) : null;
  const mt = tDir && fs.existsSync(path.join(tDir, 'manifest.json')) ? readJson(path.join(tDir, 'manifest.json')) : null;
  const thr = { ...THRESH[profile] };
  if (o.k !== undefined) thr.K = L.num(o.k, 'k', { min: .1 }); if (o.hard !== undefined) thr.hard = L.num(o.hard, 'hard', { min: .1 });
  if (o.min !== undefined) thr.min = L.num(o.min, 'min', { min: 0 }); if (o.cluster !== undefined) thr.cluster = L.num(o.cluster, 'cluster', { min: 1, int: true });
  const strict = THRESH.desktop;
  const secFilter = o.sections !== undefined ? new Set(parseSections(o.sections)) : null, onlySet = o.only ? new Set(csv(o.only)) : null;
  const ids = mn.frames.map(f => f.id).filter(id => mb.frames.some(f => f.id === id) && noise.frames[id] && (!secFilter || secFilter.has(mn.frames.find(f => f.id === id).section)) && (!onlySet || onlySet.has(id)));
  const missingBase = mn.frames.map(f => f.id).filter(id => !mb.frames.some(f => f.id === id)), missingNoise = mn.frames.map(f => f.id).filter(id => mb.frames.some(f => f.id === id) && !noise.frames[id]);
  if (!ids.length) throw new L.UsageError('沒有可以比的畫面（NEW 和 BASE 沒有共同的 id，或雜訊底沒有這些畫面）');

  console.log(`parity compare  base=${base} (${mb.build.id}, content ${mb.build.content.sha1}${mb.build.stable === false ? ' UNSTABLE' : ''})  new=${nw} (${mn.build.id}, content ${mn.build.content.sha1}${mn.build.stable === false ? ' UNSTABLE' : ''})  profile=${profile}`);
  console.log(`noise floor: ${noise.base} vs ${noise.twin}${noise.sameCode ? '' : ' (DIFFERENT CODE!)'}${mt ? '; difference = min(vs base, vs ' + twinName + ')' : '; twin images not found: difference vs base only'}`);
  console.log(`thresholds: tile ${TILE}px · limit = max(${thr.K}×floor(smoothed), ${thr.min}) · FAIL = ${thr.cluster}+ touching tiles over limit, or any tile > ${thr.hard}×floor${profile === 'phone' ? ' · (phone: looser; strict desktop numbers are shown too)' : ''}`);
  if (mb.query !== mn.query || JSON.stringify(mb.sets) !== JSON.stringify(mn.sets) || mb.css !== mn.css) console.log(`!! 設定不同：base query=${mb.query} sets=${JSON.stringify(mb.sets && mb.sets.sets && mb.sets.sets.map(x => x.key + '=' + x.after))} css=${mb.css} ｜ new query=${mn.query} sets=${JSON.stringify(mn.sets && mn.sets.sets && mn.sets.sets.map(x => x.key + '=' + x.after))} css=${mn.css}`);
  if (mn.build.stable === false) console.log('!! NEW 拍的過程中 build 被改過，結果不可靠');
  /* CONFIG defaults: a perf change must not move a default */
  try {
    const ca = readJson(path.join(bDir, 'config.json')), cb = readJson(path.join(nDir, 'config.json')), diffs = [];
    const walk = (a, b, p) => { if (diffs.length > 60) return; if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p ? p + '.' + k : k); } else if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${p}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`.slice(0, 160)); };
    walk(ca, cb, '');
    console.log(diffs.length ? `CONFIG differs in ${diffs.length >= 60 ? '60+' : diffs.length} keys (a perf change should not move a default${profile === 'phone' ? '; phone-only changes may' : ''}):\n  ` + diffs.slice(0, 25).join('\n  ') : 'CONFIG: identical to base');
  } catch (e) { console.log('CONFIG: not compared (' + e.message + ')'); }

  const results = [];
  const head = 'frame'.padEnd(22) + 'mean'.padStart(7) + 'floor'.padStart(7) + ' ×'.padStart(6) + 'p99c'.padStart(7) + 'fl99'.padStart(7) + '  worst tile (x,y px · region)'.padEnd(40) + 'd/limit'.padStart(14) + 'sharp'.padStart(8) + '  verdict';
  console.log('\n' + head);
  for (const id of ids) {
    const rb = mb.frames.find(f => f.id === id), rn = mn.frames.find(f => f.id === id), nz = noise.frames[id];
    const A = loadFrame(bDir, rb), N = loadFrame(nDir, rn);
    if (A.w !== N.w || A.h !== N.h) { results.push({ id, section: rn.section, fail: true, sizeMismatch: true }); console.log(id.padEnd(22) + `SIZE MISMATCH ${A.w}×${A.h} vs ${N.w}×${N.h}  FAIL`); continue; }
    const g1 = diffGrid(N.rgb, A.rgb, N.w, N.h); let d = g1.tiles, meanTwin = null, g2 = null;
    const rt = mt && mt.frames.find(f => f.id === id);
    if (rt) { try { const T = loadFrame(tDir, rt); if (T.w === N.w && T.h === N.h) { g2 = diffGrid(N.rgb, T.rgb, N.w, N.h); meanTwin = g2.mean; d = Float32Array.from(g1.tiles, (v, i) => Math.min(v, g2.tiles[i])); } } catch { } }
    const F = Float32Array.from(nz.tiles.F), j = judge(d, F, g1.tw, g1.th, thr), js = judge(d, F, g1.tw, g1.th, strict);
    const wc = worstCell(g1), p99 = pct(g1.cells, .99), sn = sharpness(N.rgb, N.w, N.h), sa = sharpness(A.rgb, A.w, A.h), sharpRatio = sn / sa;
    const sharpWarn = Math.abs(sharpRatio - 1) > Math.max(0.04, 3 * nz.sharpFloor);
    const meanUsed = meanTwin === null ? g1.mean : Math.min(g1.mean, meanTwin);
    const tx = j.worst.tx * TILE, ty = j.worst.ty * TILE, unsettled = !rn.settled || !rb.settled;
    const r = {
      id, section: rn.section, fail: j.fail, strictFail: js.fail, mean: r3(g1.mean), meanVsTwin: meanTwin === null ? null : r3(meanTwin), floorMean: nz.mean, meanRatio: r2(meanUsed / Math.max(nz.mean, 0.05)),
      p99cell: r2(p99), floorP99: nz.p99, worstCell: { v: r1(wc.v), at: [wc.cx * CELL, wc.cy * CELL] }, worstTile: { ...j.worst, x: tx, y: ty, region: regionOf(tx + 32, ty + 32, N.w, N.h) },
      flaggedTiles: j.flagged, clusters: j.clusters, failingClusters: j.failingClusters, spots: j.spots, strictFlagged: js.flagged, sharpRatio: r3(sharpRatio), sharpWarn, unsettled, _j: j, _w: N.w, _h: N.h,
    };
    results.push(r);
    const verdict = (j.fail ? 'FAIL' : 'ok') + (j.fail ? ` (${j.failingClusters} area${j.failingClusters > 1 ? 's' : ''})` : '') + (!j.fail && j.spots ? ` (+${j.spots} spot${j.spots > 1 ? 's' : ''})` : '') + (profile === 'phone' && !j.fail && js.fail ? ' [strict: over]' : '') + (sharpWarn ? ' SHARP' + (sharpRatio < 1 ? '↓' : '↑') + Math.round(Math.abs(sharpRatio - 1) * 100) + '%' : '') + (unsettled ? ' ~unsettled' : '');
    console.log(id.padEnd(22) + String(r.mean).padStart(7) + String(r.floorMean).padStart(7) + (r.meanRatio + 'x').padStart(6) + String(r.p99cell).padStart(7) + String(r.floorP99).padStart(7) + `  (${tx},${ty} ${r.worstTile.region})`.padEnd(40) + `${j.worst.d}/${j.worst.limit}`.padStart(14) + String(r.sharpRatio).padStart(8) + '  ' + verdict);
  }
  const failed = results.filter(r => r.fail), warnSharp = results.filter(r => !r.fail && r.sharpWarn), strictOver = results.filter(r => !r.fail && r.strictFail), spotty = results.filter(r => !r.fail && r.spots);
  if (missingBase.length) console.log('NEW has frames BASE lacks (not compared):', missingBase.join(', '));
  if (missingNoise.length) console.log('no noise floor for (not compared):', missingNoise.join(', '));
  const notComparedBase = mb.frames.map(f => f.id).filter(id => !mn.frames.some(f => f.id === id)); if (notComparedBase.length && !secFilter && !onlySet) console.log('BASE frames not in NEW (not compared):', notComparedBase.join(', '));

  /* sheets */
  const outDir = path.join(L.QA_DIR, `parity-diff-${L.safeName(nw)}-vs-${L.safeName(base)}-${profile}`);
  let sheets = [];
  if (!o['no-sheet']) { try { sheets = await makeSheets(o, outDir, results, bDir, nDir, mb, mn, { base, nw, profile, thr }); } catch (e) { console.log('對照表沒做成：' + L.clip(e.message, 200)); } }
  const clean = results.map(r => { const { _j, _w, _h, ...rest } = r; return rest; });
  L.writeJson(path.join(outDir, 'compare.json'), { tool: 'parity-compare', base, new: nw, profile, thresholds: thr, noise: { base: noise.base, twin: noise.twin }, baseBuild: mb.build, newBuild: mn.build, created: new Date().toISOString(), pass: !failed.length, frames: clean, sheets });
  console.log('');
  if (warnSharp.length) console.log(`sharpness changed (WARN, not a FAIL): ${warnSharp.map(r => r.id + ' ' + r.sharpRatio).join(', ')}`);
  if (spotty.length) console.log(`isolated over-limit tiles (WARN, single tiles): ${spotty.map(r => r.id + '×' + r.spots).join(', ')}`);
  if (profile === 'phone' && strictOver.length) console.log(`phone: ${strictOver.length} frame(s) pass the loose phone limits but would fail the desktop limits: ${strictOver.map(r => r.id).join(', ')} — look at the diff sheet`);
  if (failed.length) {
    console.log(`FAIL  ${failed.length}/${results.length} frames changed beyond the noise floor:`);
    for (const r of failed) console.log(`  ${r.id}: worst tile at (${r.worstTile.x},${r.worstTile.y}) ${r.worstTile.region} d ${r.worstTile.d} vs limit ${r.worstTile.limit} (floor ${r.worstTile.floor}); ${r.failingClusters} area(s), ${r.flaggedTiles} tiles over`);
  } else console.log(`PASS  ${results.length} frames within the noise floor (${profile}${profile === 'phone' ? ', loose phone limits' : ''})`);
  console.log('compare.json', L.abs(path.join(outDir, 'compare.json')));
  for (const s of sheets) console.log('sheet', s);
  return failed.length ? 1 : 0;
}

async function makeSheets(o, outDir, results, bDir, nDir, mb, mn, { base, nw, profile, thr }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-thumbs-'));
  try {
    const f = profile === 'phone' ? 3 : 3, cellW = profile === 'phone' ? Math.floor(780 / f) : 480, bySec = new Map(), failCells = [];
    for (const r of results) {
      if (r.sizeMismatch) continue;
      const A = loadFrame(bDir, mb.frames.find(x => x.id === r.id)), N = loadFrame(nDir, mn.frames.find(x => x.id === r.id));
      const tb = thumb(A.rgb, A.w, A.h, f), tn = thumb(N.rgb, N.w, N.h, f), td = thumb(N.rgb, N.w, N.h, f, A.rgb, 6), j = r._j, tw = Math.ceil(A.w / TILE);
      for (let i = 0; i < j.flag.length; i++) if (j.flag[i]) { const x = (i % tw) * TILE / f, y = Math.floor(i / tw) * TILE / f, ex = Math.min(td.w - 1, x + TILE / f - 1), ey = Math.min(td.h - 1, y + TILE / f - 1); rect(td, Math.round(x), Math.round(y), Math.round(ex), Math.round(ey), j.failTiles.has(i) ? [255, 40, 40] : [255, 150, 60], j.failTiles.has(i) ? 2 : 1); }
      const wx = r.worstTile.x / f, wy = r.worstTile.y / f; rect(td, Math.round(wx), Math.round(wy), Math.min(td.w - 1, Math.round(wx + TILE / f - 1)), Math.min(td.h - 1, Math.round(wy + TILE / f - 1)), [255, 230, 0], 1);
      const files = ['b', 'n', 'd'].map((k, i) => { const t = [tb, tn, td][i], file = path.join(tmp, `${r.id}-${k}.png`); fs.writeFileSync(file, encodePng(t.w, t.h, t.data)); return file; });
      const lab = [`BASE ${r.id}`, `NEW ${r.id}${r.fail ? '  FAIL' : ''}`, `diff x6 · mean ${r.mean} (floor ${r.floorMean}) · worst ${r.worstTile.d}/${r.worstTile.limit} ${r.worstTile.region}`];
      const cells = files.map((file, i) => ({ label: lab[i], file }));
      if (!bySec.has(r.section)) bySec.set(r.section, []); bySec.get(r.section).push(...cells);
      if (r.fail) failCells.push(...cells);
    }
    await L.acquireLock('parity-compare', o);
    const browser = await L.launchBrowser({ gpu: false }), context = await browser.newContext(), out = [];
    try {
      const title = s => `parity ${nw} vs ${base} · ${profile} · ${s} · red = over limit, yellow = worst tile · ${new Date().toLocaleString('zh-TW', { hour12: false })}`;
      for (const [sec, cells] of bySec) out.push(L.abs(await L.contactSheet(context, cells, path.join(outDir, `diff-${sec}.jpg`), { cols: 3, cell: cellW, title: title(sec) })));
      if (failCells.length) out.push(L.abs(await L.contactSheet(context, failCells, path.join(outDir, 'diff-fail.jpg'), { cols: 3, cell: cellW, title: title('FAILED frames') })));
    } finally { await browser.close().catch(() => { }); L.releaseLock(); }
    return out;
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { } }
}

/* ------------------------------------------------------------------ main */
L.main('parity', {
  usage: USAGE, timeout: 1500,
  spec: {
    name: 'value', profile: 'value', sections: 'value', only: 'value', query: 'value', set: 'value', early: 'bool', css: 'value', 'twin-of': 'value', force: 'bool', wait: 'value',
    'settle-mean': 'value', 'settle-cap': 'value', base: 'value', twin: 'value', new: 'value', k: 'value', hard: 'value', min: 'value', cluster: 'value', 'no-sheet': 'bool',
  },
}, async o => {
  const cmd = o._[0];
  if (cmd === 'capture') return capture(o);
  if (cmd === 'noise') { computeNoise(safe(o.base, '--base'), safe(o.twin, '--twin'), profileOf(o)); return 0; }
  if (cmd === 'compare') return compare(o);
  throw new L.UsageError(cmd ? `不認得的指令 ${cmd}（capture / noise / compare）` : '缺少指令（capture / noise / compare）');
});
