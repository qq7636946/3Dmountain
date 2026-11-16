/* Flow2 · quality tiers (2026-11-14). index1-5-flow2.html (and its trial copies).
   Client: 「整體要幫我注意一下預留有電腦降階 降畫質的功能喔」 — weaker computers must get a lighter picture.

   What the page already did before this file (kept as it is):
   · phones and narrow / touch screens get the engine's lighter drawing; the valley rounds 3–5 are off there;
   · a computer that only offers a low-power WebGL context gets a smaller drawing budget (data-flow2-low-gpu);
   · the engine's governor lowers the drawing resolution while frames run late (quality-governor.js, down to 60 %);
   · the river takes its mirror away when frames keep running late (flow2-valley.js).
   What was missing: a desktop or laptop with a modest GPU still drew every extra of the valley rounds (photo rock, deep water,
   grass, plants, light, waves…) and only lost resolution. This file gives the page three tiers that every module can read:

     high    everything as designed (a discrete GPU of the last years; this studio's RTX 4070)
     medium  every feature, at about half its cost (counts, distances, extra targets, shadow size); drawing scale ≤ 1.25
     low     the valley rounds' extras mostly off (decided when the page starts), the screen's own resolution

   How the tier is chosen, first match wins:
     1 ?quality=high|medium|low                          fixed for this visit, no automatic change
     2 the client's choice in the 「畫質」 panel (key Q)   fixed until 「重設」, no automatic change
     3 this tab already stepped down earlier             (sessionStorage) that level
     4 the GPU's name, cores and memory                  a modest GPU starts at medium, a weak or software one at low
   Then, unless fixed: when the frames keep running late for about six seconds AFTER the engine's own resolution governor has
   had its chance, the page steps down one tier (never up by itself; at most once every ten seconds). Under automation
   (captures) it never steps by itself unless ?qualityAuto=1, so pictures stay comparable.

   For module authors — window.__FLOW2_QUALITY__:
     .start        'high' | 'medium' | 'low'   the tier the page STARTED at: decide shader-heavy features from it when you install
     .level/.rank  the tier now ('low' 0, 'medium' 1, 'high' 2): it can drop while the page runs
     .pick(h, m, l) the value for the tier now
     .on(fn)       fn({ level, rank, prev, why }) after every change; returns an unsubscribe function. A change while the page
                   runs must not recompile shaders on the spot (that is a hitch): scale counts, distances, targets, passes.
     .set(level, why), .state (what was detected and decided, with a history)
   The lead's own part, here: the third and fourth valley rounds do not install at a low start (a one-line check in their
   files), and the fine drawing scale (flow2-fine-journey.js, 1.5× on a capable desktop) is capped at 1.25 at medium and off
   at low. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const html = document.documentElement;
  const LEVELS = ['low', 'medium', 'high'];
  const KEY_PANEL = 'flow2-tune:quality', KEY_STEP = 'flow2-quality-step';
  const S = { gpu: '', caveat: false, cores: navigator.hardwareConcurrency || 0, memory: navigator.deviceMemory || 0, detected: '', why: '', fixed: '', history: [], monitor: 'not started' };
  const listeners = new Set();
  const clampRank = r => Math.max(0, Math.min(2, Math.round(+r)));
  const rankOf = level => Math.max(0, LEVELS.indexOf(level));

  /* ---------- 1 · what this computer is ---------- */
  function readGpu() {
    let canvas = document.createElement('canvas'), gl = null;
    try {
      gl = canvas.getContext('webgl2', { powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true });
      if (!gl) { S.caveat = true; gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); }
      if (!gl) return '';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String((ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
    } catch (error) { return ''; }
    finally { try { gl && gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch (error) { } canvas = null; }
  }
  function detect() {
    const g = (S.gpu = readGpu()).toLowerCase();
    const say = (rank, why) => { S.why = why; return rank; };
    if (/swiftshader|llvmpipe|softpipe|basic render|microsoft basic/.test(g)) return say(0, 'software drawing (' + S.gpu + ')');
    if (S.caveat) return say(0, 'no high-performance WebGL on this computer');
    if (/mali|adreno|powervr|videocore|apple a\d/.test(g)) return say(0, 'a phone or tablet GPU (' + S.gpu + ')');
    /* 2026-11-16 evening (client: 「偵測到內顯才自動減少 3D 物件」, after ~3 fps on this laptop's Intel chip at the top tier): every integrated
       GPU starts low = fewer 3D objects, same pictures. Before, Iris Xe and AMD's integrated Radeon started medium, and a Core Ultra's
       "Intel(R) Arc(TM) Graphics" (integrated, no model number) slipped through as capable. A discrete Arc (A380…A770, B570/B580) is not caught. */
    if (/\bintel\b/.test(g) && !/\barc(\(tm\))? [ab]\d{3}\b/.test(g)) return say(0, 'an Intel integrated GPU (' + S.gpu + ')');
    if (/radeon\(tm\) graphics|radeon graphics|\bvega\b|radeon \d{3}m\b|radeon r[5-7]\b/.test(g)) return say(0, 'an AMD integrated GPU (' + S.gpu + ')');
    if ((S.cores && S.cores <= 2) || (S.memory && S.memory <= 2)) return say(0, 'few cores or little memory');
    if (/\bmx ?\d{3}\b|gtx 9\d0|gtx 10[0-5]0|gtx 16[0-5]0|\bgt \d{3,4}\b|rx [45]\d0\b|\barc(\(tm\))? a3\d0\b/.test(g)) return say(1, 'a modest GPU (' + S.gpu + ')');
    if (/apple m\d(?! (pro|max|ultra))/.test(g)) return say(1, 'an Apple base-model GPU (' + S.gpu + ')');
    if ((S.cores && S.cores <= 4) || (S.memory && S.memory <= 4)) return say(1, 'four cores or less, or 4 GB of memory or less');
    return say(2, S.gpu ? 'a capable GPU (' + S.gpu + ')' : 'GPU not named: starting high, stepping down if frames run late');
  }

  /* ---------- 2 · the tier this visit starts at ---------- */
  const detected = detect(); S.detected = LEVELS[detected];
  let base = detected;                                          // the tier without the client's own choice (the panel's default)
  let stepped = null; try { stepped = sessionStorage.getItem(KEY_STEP); } catch (error) { }
  if (stepped && detected === 2 && Q.get('qualityAuto') !== '1') { try { sessionStorage.removeItem(KEY_STEP); } catch (error) { } stepped = null; }   // a capable computer: an earlier step in this tab no longer counts
  if (stepped && LEVELS.includes(stepped) && rankOf(stepped) < base) { base = rankOf(stepped); S.why += '; this tab stepped down to ' + stepped + ' earlier'; }
  let rank = base, fixed = '';
  const urlLevel = (Q.get('quality') || '').toLowerCase();
  let kept = null; try { kept = JSON.parse(localStorage.getItem(KEY_PANEL) || 'null'); } catch (error) { }
  /* QUALITY_HOLD (2026-11-16, client: 「畫質先都幫我調回去 畫質降級先等未來再做」「等後面要調教時候再調整」): until the stepping is tuned, every
     computer draws the top tier and nothing steps down — no GPU guess, no earlier choice, no panel row, no step while running; the engine's
     resolution governor is held too (see the scale hook below) and the river keeps its mirror (flow2-valley.js reads .hold).
     ?qualityTiers=1 brings the tiers back as they were; ?quality=low|medium|high still forces a tier for a test.
     2026-11-16 evening, lifted (client, after Chrome on this laptop was found drawing on the Intel chip at ~3 fps: 「那你改回去…這之前的」
     「照你說的改吧」 = a computer found to have an integrated GPU starts lighter, fewer 3D objects, same pictures; a discrete GPU unchanged):
     the tiers are on again by default; ?qualityTiers=0 holds the top tier as on 11-16. */
  const HOLD = Q.get('qualityTiers') === '0';
  if (HOLD) { try { localStorage.removeItem(KEY_PANEL); sessionStorage.removeItem(KEY_STEP); } catch (error) { } kept = null; rank = base = 2; fixed = 'held at the top tier until the stepping is tuned (?qualityTiers=1 = tiers)';
    /* FLOW2_PHONE_FULL: a phone on such a page is held at medium = the same pictures with fewer objects (counts halved, 4K aerial bake) */
    if (document.documentElement.hasAttribute('data-flow2-phone-full') && (innerWidth <= 760 || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width || innerWidth, screen.height || innerHeight) <= 900))) { rank = base = 1; fixed = 'a phone: same pictures, fewer objects (medium)'; } }
  /* FLOW2_LITE: the integrated-GPU page (index1-5-canyon-forest-lite.html, data-flow2-lite) starts and stays at low; ?quality= still wins for a test */
  if (html.hasAttribute('data-flow2-lite')) { rank = base = 0; fixed = 'the lite page (data-flow2-lite)'; }
  if (LEVELS.includes(urlLevel)) { rank = rankOf(urlLevel); fixed = 'the address (?quality=' + urlLevel + ')'; }
  else if (kept && Number.isFinite(+kept.level)) { rank = clampRank(kept.level); fixed = 'the client’s choice in the panel'; }
  S.fixed = fixed;
  /* 2026-11-14 evening (client: 「山道這邊怎畫質又不一樣 請統一」): a computer detected as capable keeps one quality all the way; only one
     already detected as modest may step down by itself. ?qualityAuto=1 lets any computer step (for tests). */
  const autoAllowed = () => !fixed && Q.get('qualityAuto') !== '0' && (Q.get('qualityAuto') === '1' || (detected < 2 && !navigator.webdriver));
  const T = { level: base };                                     // the panel's row (0 low, 1 medium, 2 high)

  const api = window.__FLOW2_QUALITY__ = {
    start: LEVELS[rank],
    get level() { return LEVELS[rank]; },
    get rank() { return rank; },
    get auto() { return autoAllowed(); },
    pick(high, medium, low) { return rank === 2 ? high : rank === 1 ? medium : low; },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(level, why = 'asked') {
      const next = typeof level === 'number' ? clampRank(level) : rankOf(String(level).toLowerCase());
      if (next === rank) return;
      const prev = LEVELS[rank]; rank = next; T.level = next; html.dataset.flow2Quality = LEVELS[rank];
      S.history.push({ at: Math.round(performance.now()), from: prev, to: LEVELS[rank], why });
      for (const fn of listeners) { try { fn({ level: LEVELS[rank], rank, prev, why }); } catch (error) { console.warn('flow2 quality: a listener failed', error); } }
      try { dispatchEvent(new Event('resize')); } catch (error) { }   // the engine works out its drawing scale again (see the cap below)
    },
    tune: T, state: S, hold: HOLD
  };
  html.dataset.flow2Quality = LEVELS[rank];
  S.history.push({ at: Math.round(performance.now()), from: null, to: LEVELS[rank], why: fixed ? 'fixed by ' + fixed : S.why });

  /* ---------- 3 · the lead's own part: the fine drawing scale ---------- */
  /* flow2-fine-journey.js loads just before this file and sets the whole window.__FLOW2_FINE_JOURNEY__ object (it does not merge),
     so this file must come after it; main.js asks its renderScale() on every resize. */
  const host = window.__FLOW2_FINE_JOURNEY__;
  if (host && typeof host.renderScale === 'function') {
    const scale = host.renderScale;
    host.renderScale = function (args) { const g = args && args.governor; if (HOLD && g && !g.__flow2Held && typeof g.sample === 'function') { g.sample = () => false; g.__flow2Held = true; S.governor = 'held'; }   /* QUALITY_HOLD */
      const s = +scale.call(this, args) || 0; S.fineScale = s; return rank === 2 ? s : rank === 1 ? (s ? Math.min(s, 1.25) : 0) : 0; };
    S.capWired = true;
    /* QUALITY_HOLD: main.js hands the engine's resolution governor over in attach(); while the picture is held it never steps */
    const attach = host.attach;
    if (typeof attach === 'function') host.attach = function (handles) { const g = handles && handles.journeyGovernor; if (HOLD && g && typeof g.sample === 'function') { g.sample = () => false; S.governor = 'held'; } return attach.call(this, handles); };
  } else S.capWired = false;

  /* ---------- 4 · stepping down by itself ---------- */
  let monitoring = false;
  function startMonitorSoon() { if (document.readyState === 'loading') addEventListener('DOMContentLoaded', startMonitor, { once: true }); else startMonitor(); }
  function startMonitor() {
    if (monitoring) return; monitoring = true;
    if (!autoAllowed()) { S.monitor = fixed ? 'off: the tier is fixed by ' + fixed : 'off under automation (?qualityAuto=1 turns it on)'; return; }
    S.monitor = 'waiting for the page to be live';
    const gaps = []; let last = 0, windowStart = 0, slowRun = 0, beat = 0, liveSince = 0, lastStep = -1e9;
    const live = () => document.body?.classList.contains('is-ready') && html.dataset.flow2Still !== 'on' && html.dataset.renderMode !== 'text';
    const tick = now => {
      if (rank === 0) { S.monitor = 'at the lowest tier'; return; }
      requestAnimationFrame(tick);
      if (document.visibilityState === 'hidden' || !live()) { last = 0; gaps.length = 0; windowStart = 0; slowRun = 0; liveSince = 0; return; }
      if (!liveSince) liveSince = now;
      if (last) gaps.push(now - last);
      last = now;
      if (now - liveSince < 8000) { S.monitor = 'settling'; return; }   // the page's own warm-up (programs, uploads) is not the computer's pace
      if (!windowStart) windowStart = now;
      if (now - windowStart < 2000) return;
      const n = gaps.length, sorted = gaps.slice().sort((a, b) => a - b); gaps.length = 0; windowStart = now;
      if (n < 24) { slowRun = 0; return; }                         // throttled by the browser (a window behind others): not a verdict
      if (!beat) beat = Math.min(17.5, Math.max(6.5, sorted[Math.floor(n * .1)]));
      const median = sorted[n >> 1], slow = median > Math.max(20, beat * 1.5);
      slowRun = slow ? slowRun + 1 : 0;
      S.monitor = 'watching: median ' + median.toFixed(1) + ' ms, beat ' + beat.toFixed(1) + ' ms, slow windows ' + slowRun;
      if (slowRun >= 3 && now - lastStep > 10000 && autoAllowed()) {
        slowRun = 0; lastStep = now;
        const to = LEVELS[rank - 1];
        try { sessionStorage.setItem(KEY_STEP, to); } catch (error) { }
        api.set(to, 'frames ran late (median ' + median.toFixed(1) + ' ms for six seconds)');
      }
    };
    requestAnimationFrame(tick);
  }

  /* ---------- 5 · the client's row in the panel (flow2-panel.js loads after this file) ---------- */
  const register = () => {
    const panel = window.__FLOW2_PANEL__; if (!panel || register.done) return; register.done = true;
    if (HOLD) return;   /* QUALITY_HOLD: no 畫質 row while the picture is held */
    T.level = base;                                              // the panel's default = the tier without the client's choice
    panel.add({ id: 'quality', title: '畫質', key: 'q', tune: T, rows: [
      ['— 這台電腦的畫質 —'],
      ['畫質（0 低／1 中／2 高）', 'level', 0, 2, 1]
    ], onChange: (key, value) => {
      if (key !== 'level') return;
      fixed = value === base ? '' : 'the client’s choice in the panel'; S.fixed = fixed;
      api.set(clampRank(value), 'the panel');
    } });
    if (T.level !== rank) T.level = rank;                        // (equal unless something else wrote the stored value)
  };
  if (window.__FLOW2_PANEL__) register(); else addEventListener('DOMContentLoaded', register, { once: true });
  startMonitorSoon();   // last: everything it uses is declared above
})();
