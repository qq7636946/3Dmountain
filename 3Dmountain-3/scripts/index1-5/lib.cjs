'use strict';
/* index1-5 QA toolkit · shared helpers (scripts/index1-5/lib.cjs)
   Everything the tools in this folder share: arguments, the one-browser-at-a-time lock, headless Chrome with the GPU
   flags that work on this machine, the page error log, waiting for the page, journey flights, CONFIG writes (runtime or
   before the scene is built), the world epilogue, contact sheets, output folders, build + syntax checks, backups.
   No npm dependencies: Playwright is the machine's own copy (PLAYWRIGHT). Results go to stdout, progress to stderr. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const QA_DIR = path.join(ROOT, '.qa', 'index1-5');
const PROTO = path.join(ROOT, 'prototypes', 'index1-5');
const BACKUPS = path.join(ROOT, '_archive', 'backups');
const PLAYWRIGHT = process.env.I15_PLAYWRIGHT || 'C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const CHROME = process.env.I15_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const GPU_ARGS = ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl'];
const BASE = (process.env.I15_BASE || 'http://127.0.0.1:5621/').replace(/\/*$/, '/');
const PAGE_FILE = 'index1-5.html';
const READY_TIMEOUT = 150000, FLY_TIMEOUT = 90000;
/* the generated main.js line right after the client preset: CONFIG is complete here and nothing is built yet */
const EARLY_ANCHOR = 'const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const slash = p => String(p).split(path.sep).join('/');
const rel = p => slash(path.relative(ROOT, p)) || '.';
const abs = p => slash(path.resolve(p));
const clip = (s, n = 300) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n) + '…' : s; };
const round = (v, d = 3) => typeof v === 'number' && Number.isFinite(v) ? +v.toFixed(d) : v;
const note = (...a) => console.error('·', ...a);
class UsageError extends Error { }

/* ------------------------------------------------------------------ arguments */
/* spec: { name: 'bool' | 'value' }. Unknown --options are a usage error (catches typos). --k=v and --k v both work. */
function parseArgs(argv, spec = {}) {
  const known = { help: 'bool', 'no-lock': 'bool', timeout: 'value', 'allow-new': 'bool', ...spec }, o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '/?') { o.help = true; continue; }
    if (!a.startsWith('--') || a === '--') { o._.push(a); continue; }
    let k = a.slice(2), v; const eq = k.indexOf('=');
    if (eq >= 0) { v = k.slice(eq + 1); k = k.slice(0, eq); }
    const kind = known[k];
    if (!kind) throw new UsageError(`不認得的參數 --${k}`);
    if (kind === 'bool') { o[k] = v === undefined ? true : !/^(0|false|no|off)$/i.test(v); continue; }
    if (v === undefined) { if (i + 1 >= argv.length) throw new UsageError(`--${k} 後面要接值`); v = argv[++i]; }
    o[k] = v;
  }
  return o;
}
function num(v, name, { min = -Infinity, max = Infinity, int = false } = {}) {
  const n = Number(v);
  if (v === undefined || v === true || String(v).trim() === '' || !Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n)))
    throw new UsageError(`--${name} 要是${int ? '整數' : '數字'}${min > -Infinity ? `（≥${min}` + (max < Infinity ? `，≤${max}）` : '）') : ''}，收到 ${v}`);
  return n;
}
const opt = (o, name, def, rules) => o[name] === undefined ? def : num(o[name], name, rules);
/* "0,2.96,8.9,max" → [0, 2.96, 8.9, 'max'] */
function parsePositions(s, name = 'at') {
  if (s === undefined || s === true || !String(s).trim()) throw new UsageError(`缺少 --${name}（例如 --${name} "0,2.96,8.9,max"）`);
  return String(s).split(',').map(t => t.trim()).filter(Boolean).map(t => {
    if (/^max$/i.test(t)) return 'max';
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) throw new UsageError(`--${name} 的位置要是 ≥0 的數字或 max，收到 ${t}`);
    return n;
  });
}
const posName = p => p === 'max' ? 'max' : String(p);
/* world points (ported from scratchpad/ocean/cap.cjs):
   g:<frac of the global section>  d:<frac of the wave dive>  h:<ocean stop, 0 = first chapter>  u:<raw stop units>
   f:<px before the footer top>  y:<raw world y px>  end (the footer)
   logo seal (2026-10-24): l:<0-1 along the whole block>  lw:<0-1 along the wave>  ls:<0-1 along the spin>  lh:<0-1 along the hold> */
function parsePoints(s) {
  if (s === undefined || s === true || !String(s).trim()) throw new UsageError('缺少 --points（例如 --points "g:0.9,d:0.5,h:1,end"）');
  return String(s).split(',').map(t => t.trim()).filter(Boolean).map(t => {
    if (!/^end$|^(?:[gdhufyl]|lw|ls|lh):-?\d+(\.\d+)?$/i.test(t)) throw new UsageError(`--points 看不懂 ${t}（用 g:/d:/h:/u:/f:/y:/l:/lw:/ls:/lh:<數字> 或 end）`);
    return t.toLowerCase();
  });
}

/* ------------------------------------------------------------------ the one-browser lock (outside the Drive folder) */
const LOCK = path.join(os.tmpdir(), 'montis-index1-5-qa-browser.lock');
let lockHeld = false;
function pidAlive(pid) { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }
async function acquireLock(tool, o = {}) {
  if (lockHeld || o['no-lock'] || process.env.I15_NO_LOCK === '1') return;
  const maxWait = (Number(process.env.I15_LOCK_WAIT) || 900) * 1000, t0 = Date.now(); let told = false;
  for (; ;) {
    try { fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, tool, at: new Date().toISOString() }), { flag: 'wx' }); lockHeld = true; return; }
    catch (e) { if (e.code !== 'EEXIST') { note('無法建立鎖檔，略過排隊：' + e.message); return; } }
    let raw = '', info = null, st = null;
    try { st = fs.statSync(LOCK); raw = fs.readFileSync(LOCK, 'utf8'); info = JSON.parse(raw); } catch { }
    if (!info && st && Date.now() - st.mtimeMs < 5000) { await sleep(400); continue; }   // being written right now
    const stale = !info || !pidAlive(info.pid) || Date.now() - Date.parse(info.at) > 30 * 60e3;
    if (stale) { try { if (fs.readFileSync(LOCK, 'utf8') === raw) fs.unlinkSync(LOCK); } catch { } continue; }
    if (!told) { note(`排隊中：另一個 QA 瀏覽器在跑 ${info.tool}（pid ${info.pid}，${info.at} 開始）…`); told = true; }
    if (Date.now() - t0 > maxWait) throw new Error(`等了 ${maxWait / 1000}s 仍被 ${info.tool}（pid ${info.pid}）佔用；確定它沒在跑就加 --no-lock`);
    await sleep(1500);
  }
}
function releaseLock() {
  if (!lockHeld) return; lockHeld = false;
  try { const info = JSON.parse(fs.readFileSync(LOCK, 'utf8')); if (info.pid === process.pid) fs.unlinkSync(LOCK); } catch { }
}
process.on('exit', releaseLock);

/* ------------------------------------------------------------------ running a tool */
const browsers = new Set();
let finishing = false;
async function closeAll() { await Promise.all([...browsers].map(b => Promise.race([b.close().catch(() => { }), sleep(8000)]))); browsers.clear(); }
async function finish(code) {
  if (finishing) return; finishing = true;
  try { await closeAll(); } catch { }
  releaseLock(); process.exit(code);
}
let allowNewKeys = false;
const COMMON_HELP = `
共通選項：--no-lock 不排隊（預設一次只跑一個 QA 瀏覽器）｜--timeout 秒數 整體上限｜--allow-new 允許 --set 寫入 CONFIG 原本沒有的鍵
說明：scripts/index1-5/README.md`;
/* main(tool, { usage, spec, timeout(s) }, async o => exitCode). Exit codes: 0 ok · 1 failed · 2 usage · 3 timeout */
function main(tool, { usage, spec = {}, timeout = 600 }, fn) {
  const bad = e => { console.error('用法錯誤：' + e.message + '\n\n' + usage); return finish(2); };
  let o, limit;
  try { o = parseArgs(process.argv.slice(2), spec); limit = opt(o, 'timeout', timeout, { min: 10 }); }
  catch (e) { if (e instanceof UsageError) return bad(e); throw e; }
  if (o.help) { console.log(usage + COMMON_HELP); return finish(0); }
  allowNewKeys = !!o['allow-new'];
  const dog = setTimeout(() => { console.error(`[${tool}] TIMEOUT：超過 ${limit}s，強制結束（--timeout 秒數可調）`); finish(3); }, limit * 1000);
  dog.unref?.();
  process.on('SIGINT', () => finish(130));
  Promise.resolve().then(() => fn(o)).then(code => finish(typeof code === 'number' ? code : 0), e => {
    if (e instanceof UsageError) return bad(e);
    console.error(`[${tool}] FAIL`, (e && (e.stack || e.message)) || e); return finish(1);
  });
}
const withTimeout = (promise, ms, what) => Promise.race([promise, sleep(ms).then(() => { throw new Error(`${what}（等了 ${Math.round(ms / 1000)}s）`); })]);

/* ------------------------------------------------------------------ browser + page */
/* --phone, or --w under 700, = phone emulation (390×844, isMobile, touch, 2× pixels) */
function viewport(o = {}) {
  const phone = !!o.phone || (o.w !== undefined && num(o.w, 'w', { min: 100, int: true }) < 700);
  return {
    width: o.w !== undefined ? num(o.w, 'w', { min: 100, max: 4000, int: true }) : phone ? 390 : 1440,
    height: o.h !== undefined ? num(o.h, 'h', { min: 100, max: 4000, int: true }) : phone ? 844 : 900,
    phone, dpr: phone ? 2 : 1,
  };
}
const vpName = vp => `${vp.width}×${vp.height}${vp.phone ? ' phone@2x' : ''}`;
async function launchBrowser({ autoplay = false, gpu = true } = {}) {
  const { chromium } = require(PLAYWRIGHT);
  const args = gpu ? [...GPU_ARGS] : [];
  if (autoplay) args.push('--autoplay-policy=no-user-gesture-required');
  const b = await chromium.launch({ headless: true, executablePath: CHROME, args });
  browsers.add(b); return b;
}
const BENIGN = [{ why: 'favicon 404（瀏覽器自己要 /favicon.ico；頁面的圖示是 images/logo.svg）', test: (text, url) => /favicon\.ico/i.test(url + ' ' + text) }];
function watchErrors(page) {
  const log = { errors: [], ignored: [], warnings: [], http: [] };
  page.on('pageerror', e => log.errors.push('pageerror: ' + clip(e && e.message)));
  page.on('console', m => {
    const type = m.type(); if (type !== 'error' && type !== 'warning') return;
    const text = m.text(), url = ((m.location && m.location()) || {}).url || '';
    if (type === 'warning') { if (log.warnings.length < 200) log.warnings.push(clip(text, 200)); return; }
    const line = 'console.error: ' + clip(text) + (url && /Failed to load resource/i.test(text) ? ' @ ' + url : '');
    const benign = BENIGN.find(b => b.test(text, url));
    if (benign) log.ignored.push(line + ' — ' + benign.why); else log.errors.push(line);
  });
  page.on('response', r => { const s = r.status(); if (s >= 400) log.http.push(s + ' ' + r.url()); });
  page.on('requestfailed', r => { const f = r.failure(); log.http.push('failed ' + ((f && f.errorText) || '') + ' ' + r.url()); });
  return log;
}
async function newPage(browser, vp, { reduced = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, isMobile: vp.phone, hasTouch: vp.phone,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage(); page.setDefaultTimeout(READY_TIMEOUT);
  return { context, page, log: watchErrors(page) };
}
/* defaults (e.g. {tune:'0'}) merged with --query ("&a=1&b=2", "?a=1" or "a=1"); --query wins */
function pageUrl(defaults = {}, extra = '') {
  const q = new URLSearchParams(defaults);
  if (extra && extra !== true) for (const [k, v] of new URLSearchParams(String(extra).replace(/^[?&]+/, ''))) q.set(k, v);
  const s = q.toString();
  return BASE + PAGE_FILE + (s ? '?' + s : '');
}
/* goto + wait: study object + body.is-ready, then await __MONTIS_STUDY__.ready. ms from navigation start. */
async function loadPage(page, url, { timeout = READY_TIMEOUT } = {}) {
  const t0 = Date.now();
  try { await page.goto(url, { waitUntil: 'commit', timeout: 60000 }); }
  catch (e) { throw new Error(`打不開 ${url}：${clip(e.message, 160)}（伺服器有開嗎？node scripts/logo-letters/overlay-server.cjs "<root>" 5621）`); }
  try { await page.waitForFunction(() => window.__MONTIS_STUDY__ && window.__MONTIS_STUDY__.journey && document.body.classList.contains('is-ready'), null, { timeout, polling: 250 }); }
  catch { throw new Error(`頁面 ${Math.round(timeout / 1000)}s 內沒有 ready（__MONTIS_STUDY__.journey + body.is-ready）`); }
  const ready = Date.now() - t0;
  await withTimeout(page.evaluate(async () => { await window.__MONTIS_STUDY__.ready; return true; }), timeout, '__MONTIS_STUDY__.ready 沒有完成');
  return { ready, journey: Date.now() - t0 };
}
/* lock + browser + page (+ --early CONFIG) + load. Returns the session the tools use. */
async function openSession(tool, o, { defaults = { tune: '0' }, autoplay = false, early = null, browser = null } = {}) {
  await acquireLock(tool, o);
  const vp = viewport(o);
  browser = browser || await launchBrowser({ autoplay });
  const s = await newPage(browser, vp, { reduced: !!o.reduced });
  s.earlyRoute = early && early.length ? await installEarlySets(s.page, early) : null;
  s.url = pageUrl(defaults, o.query);
  note(`${tool}: ${s.url} @ ${vpName(vp)}${o.reduced ? ' reduced-motion' : ''}`);
  s.ms = await loadPage(s.page, s.url);
  note(`ready ${s.ms.ready} ms, journey ${s.ms.journey} ms`);
  if (s.earlyRoute) s.early = await readEarly(s.page, s.earlyRoute);
  return Object.assign(s, { browser, vp });
}

/* ------------------------------------------------------------------ journey */
/* journey.target = P (P may be 'max'), then wait until |progress − min(P,max)| < .01 */
async function fly(page, P, { timeout = FLY_TIMEOUT } = {}) {
  const t0 = Date.now();
  await page.evaluate(P => { const j = window.__MONTIS_STUDY__.journey; j.target = P === 'max' ? j.max : Math.min(P, j.max); }, P);
  let ok = true;
  await page.waitForFunction(P => { const j = window.__MONTIS_STUDY__.journey; return Math.abs(j.progress - (P === 'max' ? j.max : Math.min(P, j.max))) < .01; }, P, { timeout, polling: 100 }).catch(() => { ok = false; });
  const s = await page.evaluate(() => { const j = window.__MONTIS_STUDY__.journey; return { progress: j.progress, target: j.target, max: j.max }; });
  return { ok, at: P, progress: round(s.progress), target: round(s.target), max: round(s.max), ms: Date.now() - t0 };
}
const readState = page => page.evaluate(() => {
  const s = window.__MONTIS_STUDY__, j = s.journey, P = s.portfolio, W = s.world, r = v => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
  let world = null;
  try { if (W) { const st = W.open ? W.state : null; world = { open: !!W.open, y: st ? Math.round(st.y) : 0, maxY: st ? Math.round(st.maxY) : 0 }; } } catch { }
  return { progress: r(j.progress), target: r(j.target), max: r(j.max), cards: P ? { open: !!P.open, transition: r(P.transition ?? 0) } : null, world };
});

/* ------------------------------------------------------------------ CONFIG writes */
/* "group.key=1.2,group.key=#a0b0c0" → [{ key, parts, raw, value }]; numbers, #hex, true/false, else plain string */
function parseSets(str, name = 'set') {
  if (str === undefined || str === true || !String(str).trim()) throw new UsageError(`--${name} 是空的（例如 --${name} "alpineLight.sunAz=150"）`);
  return String(str).split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const eq = s.indexOf('=');
    if (eq < 1) throw new UsageError(`--${name} 格式要是 group.key=value，收到 ${s}`);
    return makeSet(s.slice(0, eq).trim(), s.slice(eq + 1).trim(), name);
  });
}
function makeSet(key, raw, name = 'set') {
  const parts = key.split('.');
  if (parts.length < 2 || parts.some(p => !p)) throw new UsageError(`--${name} 的鍵要是 group.key（可再往下 group.sub.key），收到 ${key}`);
  let value;
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) value = raw;
  else if (/^(true|false)$/i.test(raw)) value = /^true$/i.test(raw);
  else if (raw !== '' && Number.isFinite(Number(raw))) value = Number(raw);
  else value = raw.replace(/^(['"])(.*)\1$/, '$2');
  return { key, parts, raw, value };
}
/* writes into the live CONFIG, then window.index4.applyConfig(). Unknown group → UsageError; unknown key / other type → warning */
async function applySets(page, sets) {
  const res = await page.evaluate(sets => {
    const C = window.__MONTIS_STUDY__.CONFIG, out = [];
    for (const s of sets) {
      let o = C, bad = null;
      for (const k of s.parts.slice(0, -1)) { if (o && typeof o === 'object' && k in o && o[k] && typeof o[k] === 'object') o = o[k]; else { bad = k; break; } }
      if (bad) { out.push({ key: s.key, error: 'CONFIG 沒有這個群組：' + bad }); continue; }
      const last = s.parts[s.parts.length - 1], had = last in o, before = o[last];
      o[last] = s.value;
      out.push({ key: s.key, before, after: o[last], had, sameType: !had || typeof before === typeof s.value });
    }
    let applied = false;
    try { if (window.index4 && window.index4.applyConfig) { window.index4.applyConfig(); applied = true; } } catch (e) { out.push({ key: '(applyConfig)', error: String(e && e.message || e) }); }
    return { out, applied };
  }, sets);
  return checkSetReport(res.out, res.applied);
}
function checkSetReport(out, applied = true) {
  const errors = out.filter(r => r.error), warnings = [];
  for (const r of out) {
    if (r.error) continue;
    if (!r.had) {
      if (!allowNewKeys) errors.push({ key: r.key, error: 'CONFIG 原本沒有這個鍵（拼錯了嗎？node scripts/index1-5/config.cjs --get 群組名 可列出；確定要新增就加 --allow-new）' });
      else warnings.push(`${r.key} 原本不存在於 CONFIG（--allow-new 已寫入，但可能沒有程式讀它）`);
    } else if (!r.sameType) warnings.push(`${r.key} 型別不同：原本 ${JSON.stringify(r.before)}，寫入 ${JSON.stringify(r.after)}`);
  }
  if (errors.length) throw new UsageError(errors.map(e => `${e.key}：${e.error}`).join('；'));
  for (const w of warnings) note('WARN ' + w);
  return { sets: out, applied, warnings };
}
/* --early: rewrite the generated main.js as it is served so the values land in CONFIG before the scene is built
   (needed for 「重整生效」 dials). Inserted after DEFAULT_CONFIG, so the tuner's reset still means the page defaults. */
async function installEarlySets(page, sets) {
  const state = { patched: 0, error: null };
  const plain = sets.map(({ key, parts, value }) => ({ key, parts, value }));
  await page.route(/\/prototypes\/index1-5\/js\/main\.js(\?|$)/, async route => {
    try {
      const resp = await route.fetch(); let body = await resp.text();
      if (body.split(EARLY_ANCHOR).length !== 2) { state.error = 'main.js 裡找不到唯一的 DEFAULT_CONFIG 錨點，--early 無法套用'; return route.fulfill({ response: resp, body }); }
      const code = `\n      /* QA --early (scripts/index1-5) */ ;((C, sets) => { const rep = window.__I15_EARLY__ = []; for (const s of sets) { let o = C, bad = null; for (const k of s.parts.slice(0, -1)) { if (o && typeof o === 'object' && k in o && o[k] && typeof o[k] === 'object') o = o[k]; else { bad = k; break; } } if (bad) { rep.push({ key: s.key, error: 'CONFIG 沒有這個群組：' + bad }); continue; } const last = s.parts[s.parts.length - 1], had = last in o, before = o[last]; o[last] = s.value; rep.push({ key: s.key, before, after: o[last], had, sameType: !had || typeof before === typeof s.value }); } })(CONFIG, ${JSON.stringify(plain)});\n`;
      body = body.replace(EARLY_ANCHOR, () => EARLY_ANCHOR + code);
      state.patched++;
      const headers = { ...resp.headers() }; delete headers['content-length']; headers['content-type'] = 'text/javascript; charset=utf-8';
      return route.fulfill({ status: resp.status(), headers, body });
    } catch (e) { state.error = 'main.js 改寫失敗：' + e.message; return route.continue().catch(() => { }); }
  });
  return state;
}
async function readEarly(page, routeState) {
  if (routeState.error) throw new Error(routeState.error);
  if (!routeState.patched) throw new Error('--early：main.js 沒有經過改寫（網址不同？）');
  const out = await page.evaluate(() => window.__I15_EARLY__ || null);
  if (!out) throw new Error('--early：注入的程式沒有執行');
  return checkSetReport(out, true);
}
async function runJs(page, file) {
  const src = fs.readFileSync(file, 'utf8');
  const value = await page.evaluate(src);
  await page.evaluate(() => { window.index4 && window.index4.applyConfig && window.index4.applyConfig(); });
  return value === undefined ? null : clip(JSON.stringify(value), 300);
}
function readJsFile(o) {
  if (!o.js) return null;
  const f = path.resolve(process.cwd(), String(o.js));
  if (!fs.existsSync(f)) throw new UsageError(`--js 找不到檔案 ${f}`);
  return f;
}

/* ------------------------------------------------------------------ world epilogue (cards → globe → wave dive → ocean → footer) */
/* ported from scratchpad/ocean/cap.cjs: end of journey, wheel until world.open, await ready + motion, jump(0) */
async function enterWorld(page, vp, { maxNotches = 60 } = {}) {
  const f = await fly(page, 'max');
  if (!f.ok) throw new Error(`旅程沒有到終點（progress ${f.progress} / max ${f.max}）`);
  await page.waitForTimeout(1200);
  await page.mouse.move(vp.width / 2, vp.height / 2);
  let notches = 0;
  for (; notches < maxNotches; notches++) {
    await page.mouse.wheel(0, 120); await page.waitForTimeout(140);
    if (await page.evaluate(() => !!(window.__MONTIS_STUDY__.world && window.__MONTIS_STUDY__.world.open))) { notches++; break; }
  }
  await page.waitForFunction(() => !!window.__MONTIS_STUDY__.world, null, { polling: 200, timeout: 60000 }).catch(() => { throw new Error('world 模組沒有出現（__MONTIS_STUDY__.world）'); });
  await withTimeout(page.evaluate(async () => { const w = window.__MONTIS_STUDY__.world; await w.ready; await w.motion; return true; }), 90000, 'world.ready / world.motion 沒有完成');
  await page.evaluate(() => window.__MONTIS_STUDY__.world.jump(0));
  await page.waitForTimeout(800);
  const state = await worldState(page);
  return { notches, state };
}
const worldState = page => page.evaluate(() => {
  const s = window.__MONTIS_STUDY__.world.state;
  return { y: s.y, maxY: s.maxY, at: s.at, ocean: s.ocean ? { at: s.ocean.at, stops: s.ocean.stops } : null, logo: s.logo ? { at: s.logo.at } : null };
});
function worldY(st, token) {
  if (token === 'end') return st.maxY;
  const [k, v] = token.split(':'), x = Number(v), at = st.at, oa = st.ocean && st.ocean.at;
  if ('dhu'.includes(k) && !oa) throw new Error(`${token}：海洋段沒有載入（world.state.ocean 是空的）`);
  if (k === 'g') return at.global + at.globalH * x;
  if (k === 'd') return oa.dive + oa.diveH * x;
  if (k === 'h') return oa.resp + x * oa.stop + (x === 0 ? 2 : 0);
  if (k === 'u') return oa.resp + x * oa.stop;
  if (k === 'f') return at.footer - x;
  if (k === 'l' || k === 'lw' || k === 'ls' || k === 'lh') {
    const la = st.logo && st.logo.at;
    if (!la) throw new Error(`${token}：LOGO 收尾段沒有載入（?logoseal=0？world.state.logo 是空的）`);
    const hold0 = Math.max(la.s1, la.w1);
    return k === 'l' ? la.w0 + (la.end - la.w0) * x : k === 'lw' ? la.w0 + (la.w1 - la.w0) * x : k === 'ls' ? la.s0 + (la.spinDone - la.s0) * x : hold0 + (la.end - hold0) * x;
  }
  return x;   // y:
}
async function jumpWorld(page, y) { await page.evaluate(v => window.__MONTIS_STUDY__.world.jump(v), y); }
const oceanNow = page => page.evaluate(() => {
  const s = window.__MONTIS_STUDY__.world.state, o = s.ocean && s.ocean.o;
  return { y: Math.round(s.y), ocean: o ? { t: +(+o.t).toFixed(3), w: +(+(o.w || 0)).toFixed(3), h: +(+o.h).toFixed(3), cam: +(+o.cam).toFixed(2), covered: !!o.covered } : null };
});

/* the logo seal's own state (world.state.logo): clocks at the current y, whether the lake is built */
const logoNow = page => page.evaluate(() => {
  const g = window.__MONTIS_STUDY__.world.state.logo; if (!g) return null;
  const l = g.sample || {}, r = v => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
  return { ready: g.ready, phase: g.phase, failed: g.failed, qWave: r(l.qWave), qSpin: r(l.qSpin), yaw: r(l.yaw), rise: r(l.rise), q: r(l.q), textP: r(l.textP) };
});
/* the lake is built lazily when the visitor is near: jump to just before the block and wait until it is ready (QA only) */
async function prepareLogo(page, st, { timeout = 90000 } = {}) {
  const la = st.logo && st.logo.at; if (!la) return null;
  await jumpWorld(page, la.logo - 1.9 * (await page.evaluate(() => innerHeight)));
  await page.waitForFunction(() => { const g = window.__MONTIS_STUDY__.world.state.logo; return !g || g.ready || g.failed; }, null, { timeout, polling: 200 });
  await page.waitForTimeout(400);
  return logoNow(page);
}

/* ------------------------------------------------------------------ files, sheets */
function stamp(d = new Date(), seconds = true) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${seconds ? p(d.getSeconds()) : ''}`;
}
const safeName = s => String(s).trim().replace(/[\\/:*?"<>|\s]+/g, '_').replace(/^\.+/, '').slice(0, 80) || 'run';
const fileTag = s => String(s).replace(/[\\/:*?"<>|\s]+/g, '_');
/* the folder is only created by the first file written into it (a usage error leaves nothing behind) */
const outDir = (tool, name) => path.join(QA_DIR, name && name !== true ? safeName(name) : `${tool}-${stamp()}`);
const writeFile = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); return file; };
const writeJson = (file, obj) => writeFile(file, JSON.stringify(obj, null, 2));
function mimeOf(buf, file = '') {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buf.slice(0, 3).toString('latin1') === 'GIF') return 'image/gif';
  const ext = path.extname(file).toLowerCase();
  return { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' }[ext] || 'application/octet-stream';
}
async function capture(page, file, quality = 84) { return writeFile(file, await page.screenshot({ type: 'jpeg', quality })); }
/* draws in a blank page of TARGET (a BrowserContext or Browser): cells [{label, file}] → out (.jpg/.png). Contain-fit,
   so mixed sizes keep their shape; cell width auto = 640 landscape / 360 portrait; kept under the canvas size limit. */
async function contactSheet(target, cells, out, { cols = 4, cell = 0, title = '' } = {}) {
  if (!cells.length) throw new Error('對照表沒有圖');
  const page = await target.newPage();
  try {
    const data = cells.map(c => { const buf = fs.readFileSync(c.file); return { label: String(c.label ?? path.basename(c.file)), src: `data:${mimeOf(buf, c.file)};base64,${buf.toString('base64')}` }; });
    const type = /\.png$/i.test(out) ? 'image/png' : 'image/jpeg';
    const url = await page.evaluate(async ({ data, cols, cell, title, type }) => {
      const ims = await Promise.all(data.map(d => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = d.src; })));
      const first = ims.find(Boolean); if (!first) throw new Error('沒有任何一張圖解得開');
      const aspect = first.naturalHeight / first.naturalWidth, n = data.length, C = Math.max(1, Math.min(cols, n)), R = Math.ceil(n / C);
      const head = title ? 34 : 0, gap = 2;
      let cw = cell || (aspect > 1.2 ? 360 : 640);
      while (cw > 120 && (C * (cw + gap) > 16000 || head + R * (Math.round(cw * aspect) + gap) > 16000)) cw = Math.floor(cw * .85);
      const ch = Math.round(cw * aspect), c = document.createElement('canvas');
      c.width = C * cw + (C - 1) * gap; c.height = head + R * ch + (R - 1) * gap;
      const x = c.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, c.width, c.height);
      const font = px => `600 ${px}px "Segoe UI", "Microsoft JhengHei", system-ui, sans-serif`;
      if (title) { x.font = font(16); x.fillStyle = '#e8e8e8'; x.fillText(title, 12, 23, c.width - 24); }
      ims.forEach((im, i) => {
        const cx = (i % C) * (cw + gap), cy = head + Math.floor(i / C) * (ch + gap);
        if (im) { const s = Math.min(cw / im.naturalWidth, ch / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s; x.drawImage(im, cx + (cw - dw) / 2, cy + (ch - dh) / 2, dw, dh); }
        else { x.fillStyle = '#4a1010'; x.fillRect(cx, cy, cw, ch); }
        const label = data[i].label + (im ? '' : '（讀不到這張圖）');
        x.font = font(15); const w = Math.min(x.measureText(label).width, cw - 26);
        x.fillStyle = 'rgba(0,0,0,.72)'; x.fillRect(cx + 6, cy + 6, w + 14, 24); x.fillStyle = '#fff'; x.fillText(label, cx + 13, cy + 23, cw - 26);
      });
      return c.toDataURL(type, .86);
    }, { data, cols, cell, title, type });
    return writeFile(out, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
  } finally { await page.close().catch(() => { }); }
}
/* per image: median L* (0–100, the team's brightness measure) and, when REF is given, the mean absolute RGB difference
   (0–255) from image REF — so "looks the same" can be told from "is the same". Computed on a 192 px wide downsample. */
async function imageStats(target, files, ref = -1) {
  const page = await target.newPage();
  try {
    const data = files.map(f => { const buf = fs.readFileSync(f); return `data:${mimeOf(buf, f)};base64,${buf.toString('base64')}`; });
    return await page.evaluate(async ({ data, ref }) => {
      const px = await Promise.all(data.map(src => new Promise(res => {
        const i = new Image(); i.onerror = () => res(null);
        i.onload = () => { const w = 192, h = Math.max(1, Math.round(w * i.naturalHeight / i.naturalWidth)), c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(i, 0, 0, w, h); res(x.getImageData(0, 0, w, h).data); };
        i.src = src;
      })));
      const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
      const lstar = d => { const a = []; for (let k = 0; k < d.length; k += 4) { const Y = .2126 * lin(d[k]) + .7152 * lin(d[k + 1]) + .0722 * lin(d[k + 2]); a.push(Y > .008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y); } a.sort((p, q) => p - q); return Math.round(a[a.length >> 1] * 10) / 10; };
      return px.map(d => {
        if (!d) return { lstar: null, diff: null };
        let diff = null; const r = ref >= 0 ? px[ref] : null;
        if (r && r.length === d.length) { let s = 0; for (let k = 0; k < d.length; k += 4) s += Math.abs(d[k] - r[k]) + Math.abs(d[k + 1] - r[k + 1]) + Math.abs(d[k + 2] - r[k + 2]); diff = Math.round(s / (d.length / 4 * 3) * 10) / 10; }
        return { lstar: lstar(d), diff };
      });
    }, { data, ref });
  } finally { await page.close().catch(() => { }); }
}
function tally(list) { const m = new Map(); for (const s of list) m.set(s, (m.get(s) || 0) + 1); return [...m].map(([s, n]) => n > 1 ? `${s} ×${n}` : s); }
function printLog(log) {
  console.log('errors', JSON.stringify(tally(log.errors)));
  if (log.ignored.length) console.log('ignored', JSON.stringify(tally(log.ignored)));
}
const logJson = log => ({ errors: tally(log.errors), ignored: tally(log.ignored), warnings: tally(log.warnings).slice(0, 30), http: tally(log.http).slice(0, 30) });

/* ------------------------------------------------------------------ build, syntax, backups */
function runBuild() {
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, [path.join(PROTO, 'build.cjs')], { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
  const err = ((r.stderr || '').trim() || (r.error && r.error.message) || '');
  return { ok: r.status === 0, code: r.status, ms: Date.now() - t0, out: clip((r.stdout || '').trim(), 400), err: clip(err, 900) };
}
/* `node --check file` passes broken ES modules; the stdin form with --input-type=module does not */
function syntaxCheck(files) {
  const fails = [];
  for (const f of files) {
    const r = cp.spawnSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(f), encoding: 'utf8', timeout: 60000 });
    if (r.status === 0) continue;
    const msg = String(r.stderr || (r.error && r.error.message) || 'exit ' + r.status), lines = msg.split(/\r?\n/);
    const m = /\[stdin\]:(\d+)/.exec(msg), err = (lines.find(l => /^\s*\w*Error\b/.test(l)) || lines.find(l => l.trim()) || '').trim();
    fails.push(`${rel(f)}${m ? ':' + m[1] : ''} ${clip(err, 200)}`);
  }
  return fails;
}
function walk(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out); else if (e.isFile()) out.push({ rel: slash(path.relative(base, p)), size: fs.statSync(p).size });
  }
  return out;
}
/* plain recursive copy (fs.cpSync fails on the Google Drive virtual drive: ESRCH from Node's native copier).
   overwrite=false refuses to replace an existing file. Keeps modification times. Returns the number of files. */
function copyTree(src, dst, { overwrite = false } = {}) {
  let n = 0;
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) n += copyTree(a, b, { overwrite });
    else if (e.isFile()) {
      fs.copyFileSync(a, b, overwrite ? 0 : fs.constants.COPYFILE_EXCL);
      try { const st = fs.statSync(a); fs.utimesSync(b, st.atime, st.mtime); } catch { }
      n++;
    }
  }
  return n;
}
/* copies prototypes/index1-5/ (everything) + index1-5.html into _archive/backups/index1-5-<id>-<yyyymmdd-hhmm>[-n]/. Never deletes. */
function makeBackup(id, { note: why = '' } = {}) {
  if (!/^[\w.\-\u3400-\u9fff]+$/.test(id)) throw new UsageError(`卡號只能用英數字、- _ . 或中文，收到 ${id}`);
  fs.mkdirSync(BACKUPS, { recursive: true });
  const base = path.join(BACKUPS, `index1-5-${id}-${stamp(new Date(), false)}`);
  let dest = base; for (let n = 2; fs.existsSync(dest); n++) dest = `${base}-${n}`;
  fs.mkdirSync(dest);
  try {
    copyTree(PROTO, path.join(dest, 'prototypes', 'index1-5'), { overwrite: false });
    fs.copyFileSync(path.join(ROOT, PAGE_FILE), path.join(dest, PAGE_FILE), fs.constants.COPYFILE_EXCL);
  } catch (e) {
    try { writeJson(path.join(dest, 'BACKUP.json'), { card: id, created: new Date().toISOString(), verified: false, error: 'INCOMPLETE — copy failed: ' + e.message }); } catch { }
    throw new Error(`備份沒有完成（${rel(dest)} 是不完整的，已在 BACKUP.json 標記）：${e.message}`);
  }
  const src = walk(PROTO), got = walk(path.join(dest, 'prototypes', 'index1-5'));
  const bytes = list => list.reduce((a, f) => a + f.size, 0);
  const ok = src.length === got.length && bytes(src) === bytes(got) && fs.statSync(path.join(dest, PAGE_FILE)).size === fs.statSync(path.join(ROOT, PAGE_FILE)).size;
  const manifest = { card: id, created: new Date().toISOString(), local: new Date().toLocaleString('zh-TW', { hour12: false }), note: why, from: slash(ROOT), files: got.length + 1, bytes: bytes(got) + fs.statSync(path.join(dest, PAGE_FILE)).size, verified: ok, restore: `node scripts/index1-5/restore.cjs "${rel(dest)}" --yes` };
  writeJson(path.join(dest, 'BACKUP.json'), manifest);
  return { dest, ok, manifest };
}

module.exports = {
  ROOT, QA_DIR, PROTO, BACKUPS, BASE, PAGE_FILE, PLAYWRIGHT, CHROME, GPU_ARGS, LOCK, EARLY_ANCHOR,
  sleep, slash, rel, abs, clip, round, note, UsageError,
  parseArgs, num, opt, parsePositions, posName, parsePoints,
  acquireLock, releaseLock, main, finish, withTimeout,
  viewport, vpName, launchBrowser, newPage, watchErrors, pageUrl, loadPage, openSession,
  fly, readState, parseSets, makeSet, applySets, installEarlySets, readEarly, runJs, readJsFile,
  enterWorld, worldState, worldY, jumpWorld, oceanNow, logoNow, prepareLogo,
  stamp, safeName, fileTag, outDir, writeFile, writeJson, mimeOf, capture, contactSheet, imageStats, tally, printLog, logJson,
  runBuild, syntaxCheck, walk, copyTree, makeBackup,
};
