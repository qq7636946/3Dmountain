/* Flow2 day (2026-11-12): the page is one day. Scrolling carries the sky, the light and the water from dawn (the opening) through
   the morning (the wordmark), noon and the afternoon (the canyon) to the golden hour and sunset (FOUR PATHS) and into dusk (the
   WHY sea), on index1-5-flow2.html only.
   Client, with a screen recording of a template (one sky and sea whose colours turn from pale morning through gold and rose to
   violet night as the page is scrolled): 「幫我加入跟他一樣的效果 滾動時候加入細節 跟天空場景會變顏色像是一整天從早到晚的感覺」.

   The scene already has a time of day (prototypes/index1-5/js/scene-daylight.js: the sun's height and place, its strength, a
   restrained silver-blue palette) and can follow the scroll; this page held it at noon. Two things are added, through three small
   hooks in this page's main.js (each does nothing without this file):
   1. hour(): the hour for each place in the page (the scene's own mapping stops at mid-afternoon; this one runs the whole day).
      The stretch where the pre-rendered picture of the valley is handed over keeps the hour it was rendered at (10.2).
   2. grade(): called right after the scene has applied its own time of day, every frame. The colours it wrote are graded by the
      hour: peach at dawn, gold and rose at the golden hour and sunset, violet at dusk, indigo at night. A grade is a tint and how
      far to go toward it, so at noon nothing is changed and every chapter keeps the look it was approved with at its own hour.
      The sun's PLACE is held where the page had it (moving it re-bakes the terrain's shadows every frame).
      Graded: the canyon's and the aerial chapters' sky, haze, clouds and light colours (CONFIG.alpineLight), the opening's
      backdrop (CONFIG.field) and sea light (CONFIG.openingWorld), the canyon water's own colours (flow2-valley.js's), the aerial
      chapter's sky, mist and river colours. Never the sun's place or strength, never the logo, the copy or the camera.
   The valley's tone (flow2-valley.js pulls the canyon's sky toward the opening's palette) is kept: the grade is applied to what
   that file would have shown, and its targets are set to the graded colours so that the two do not fight (and never compound).
   No clock: the colours are a function of the scroll position only; stopping holds them, scrolling back returns them.
   Loaded after flow2-valley.js and flow2-look.js, before main.js. ?day=0 leaves it out (the page at noon, as before);
   ?dayStrength=0…1.5 (0 = only the scene's own restrained day). Live: window.__FLOW2_DAY__.tune, .state */
(() => {
  const Q = new URLSearchParams(location.search);
  if (Q.get('day') === '0') return;
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  const T = {
    strength: num('dayStrength', 1),
    holdSun: Q.get('daySun') !== 'move',   // the sun stays where the page had it; only its colour and strength follow the hour (see grade())
    aerial: 1,                             // FOUR PATHS' own sky, mist and river colours follow the hour too
    step: num('dayStep', .15),             // the scene is given the hour to the nearest this (hours); 0 = exactly (restyles the whole page every frame of a scroll, see hour())
    /* the page as a day */
    open: [6.7, 7.5],            // the opening screen: first light → early morning
    logo: 9,                     // reaching the wordmark
    hold: 10.2,                  // the wordmark's end and the valley's first stretch (the hour its handed-over picture was rendered at)
    /* the valley by its own clock (2.35 = the hand-over is done; 6.8 = the lens starts to climb; 7.8 = from the air; 10.18 = the end) */
    /* 2026-11-14 (client: 「把山谷抬升的時候的光影顏色都改成跟一開始的顏色色調一樣」): the valley, its lift-off and the view from the
       air keep the hour of the first screen. ?dayValley=1 = the day running through the valley as before (noon in the canyon,
       golden hour at the lift-off, sunset from the air). */
    valley: Q.get('dayValley') === '1' ? [[2.35, 10.2], [5, 13], [6.8, 15.2], [7.8, 16.6], [10.18, 17.6]] : [[2.35, 10.2], [10.18, 10.2]],
    cards: Q.get('dayValley') === '1' ? 17.8 : 10.2,                 // while the cards are up
    sea: [17.7, 19.2],           // the WHY sea, from its first screen to its last
    /* each hour's grade: role → [tint, how far]. A role not named is left alone at that hour. gain = overall light. */
    stops: [
      { hour: 6.5, gain: 1, top: ['#6f8fc4', .08], mid: ['#c9c6dc', .08], horizon: ['#f6dccb', .3], fog: ['#ecdedd', .18], sun: ['#ffd8b4', .45], cloudLit: ['#ffeadb', .25], cloudShade: ['#9aa3c4', .1], shadow: ['#9aa6cf', .08], sea: ['#7e90bd', .08] },
      { hour: 8.5, gain: 1.02, horizon: ['#fbeede', .14], fog: ['#f1ebe6', .08], sun: ['#fff0dc', .15] },
      { hour: 10.2, gain: 1 },
      { hour: 13, gain: 1 },
      { hour: 15.2, gain: 1, horizon: ['#f7e3c4', .2], fog: ['#efe2cf', .12], sun: ['#ffe2b6', .3], cloudLit: ['#fff0d8', .2] },
      { hour: 16.6, gain: 1, top: ['#6d78b8', .3], mid: ['#c79aa6', .34], horizon: ['#ffc78e', .62], fog: ['#f3bf9f', .46], sun: ['#ffb26e', .58], cloudLit: ['#ffd3a6', .6], cloudShade: ['#9084ac', .4], shadow: ['#8482b8', .32], sea: ['#66709f', .22] },
      { hour: 17.6, gain: .98, top: ['#4f5aa6', .4], mid: ['#b384ac', .45], horizon: ['#ff9f86', .62], fog: ['#d6a0b4', .5], sun: ['#ff9a72', .7], cloudLit: ['#f6b4b0', .6], cloudShade: ['#70699f', .4], shadow: ['#6c6eb0', .3], sea: ['#505c98', .34] },
      { hour: 18.5, gain: .84, top: ['#343d8a', .58], mid: ['#8468b4', .55], horizon: ['#e594ac', .5], fog: ['#9d8cc4', .55], sun: ['#f2a0b4', .6], cloudLit: ['#c9a6d2', .55], cloudShade: ['#55559a', .55], shadow: ['#5a5fae', .5], sea: ['#3d4a8c', .45] },
      { hour: 19.5, gain: .72, top: ['#111a48', .72], mid: ['#2c3877', .64], horizon: ['#646bb0', .52], fog: ['#3b4788', .58], sun: ['#aab6ee', .5], cloudLit: ['#8c98d2', .5], cloudShade: ['#2c356a', .6], shadow: ['#38458a', .55], sea: ['#1c2858', .58] }
    ]
  };
  const ROLES = ['top', 'mid', 'horizon', 'fog', 'sun', 'cloudLit', 'cloudShade', 'shadow', 'sea'];
  /* The scene's own sun strength by the hour (scene-daylight.js's figures: [hour, intensity]). The scene is given the hour in steps, so
     its sun would brighten and dim in steps; the strength is worked out here for the exact hour with the scene's own formula. If that
     module's figures change, these follow a little out of step with it (the colours do not depend on them). */
  const SUN = [[5.5, 1.3], [7, 3.4], [11.5, 5.1], [15, 4.5], [16.4, 3.2], [17.7, 1.65], [18.5, .05], [20, 0]];
  function sunAt(h, P) {
    let i = 0; while (i < SUN.length - 2 && h > SUN[i + 1][0]) i++;
    const a = SUN[i], b = SUN[i + 1], elevation = clamp(Math.sin((h - 6) / 12 * Math.PI) * 48 * (Number.isFinite(+P.elevation) ? +P.elevation : 1), -24, 82), daylight = smooth(-5, 5, elevation);
    return { intensity: lerp(a[1], b[1], smooth(a[0], b[0], h)) * (Number.isFinite(+P.sun) ? +P.sun : 1) * daylight, daylight };
  }
  const state = { hour: 0, on: false, why: 'not called yet' };

  /* ---- colours ---- */
  const rgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); return m ? [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)) : null; };
  const hex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  const mixHex = (a, b, t) => { const p = rgb(a), q = rgb(b); return p && q ? hex(p.map((v, i) => v + (q[i] - v) * t)) : a; };
  const fromColor = c => '#' + c.getHexString();
  /* the grade in force at an hour: for each role a tint and an amount, and the gain */
  let cacheHour = NaN, cacheStrength = NaN, G = null;
  function gradeAt(h) {
    if (h === cacheHour && T.strength === cacheStrength && G) return G;
    const S = T.stops; let i = 0; while (i < S.length - 2 && h > S[i + 1].hour) i++;
    const a = S[i], b = S[i + 1], t = smooth(a.hour, b.hour, h), out = { gain: 1 + (lerp(a.gain, b.gain, t) - 1) * Math.min(1, T.strength) };
    for (const role of ROLES) {
      const x = a[role], y = b[role];
      if (!x && !y) { out[role] = null; continue; }
      const tx = rgb((x || y)[0]), ty = rgb((y || x)[0]), amount = lerp(x ? x[1] : 0, y ? y[1] : 0, t) * T.strength;
      out[role] = amount > .001 ? [tx.map((v, k) => v + (ty[k] - v) * t), Math.min(1, amount)] : null;
    }
    cacheHour = h; cacheStrength = T.strength; G = out; return out;
  }
  /* one colour through the grade (hex in, hex out); share = how much of the role's amount this colour takes */
  function tone(colour, role, share = 1, gain = true) {
    const c = rgb(colour); if (!c) return colour;
    const g = G[role];
    const out = g ? c.map((v, i) => v + (g[0][i] - v) * g[1] * share) : c;
    return hex(gain ? out.map(v => v * G.gain) : out);
  }
  /* a colour in linear light (the valley water's): the same grade */
  function toneLinear(c, role, share = 1) {
    const g = G[role]; if (!g) return c.map(v => v * G.gain);
    return c.map((v, i) => { const tint = Math.pow(g[0][i] / 255, 2.2); return (v + (tint - v) * g[1] * share) * G.gain; });
  }

  /* ---- 1. the hour for a place in the page ---- */
  /* The scene gets the hour in small steps: each time its hour changes, its own module writes six custom properties on <html>, and
     that makes the browser restyle the whole document (measured: about 4.5 ms more on every frame of a scroll when the hour is
     followed exactly). The grade below keeps the exact hour, so what is seen moves smoothly. */
  let exact = NaN, given = NaN;
  function hour(at) {
    exact = place(at);
    given = T.step > 0 ? Math.round(exact / T.step) * T.step : exact;
    return given;
  }
  function place({ progress, clock, logoStart, logoEnd, portfolio, world }) {
    if (world?.seaLeg && Number.isFinite(world.y)) {
      const a = world.seaMin, b = world.seaMax;
      return lerp(T.sea[0], T.sea[1], Number.isFinite(a) && Number.isFinite(b) && b > a ? smooth(a, b, world.y) : 0);
    }
    if (portfolio?.open) return T.cards;
    if (progress < .52) return lerp(T.open[0], T.open[1], smooth(0, .52, progress));
    if (progress < logoStart) return lerp(T.open[1], T.logo, smooth(.52, logoStart, progress));
    if (progress < logoEnd) return lerp(T.logo, T.hold, smooth(logoStart, logoEnd, progress));
    const V = T.valley;
    if (clock <= V[0][0]) return T.hold;
    for (let i = 0; i < V.length - 1; i++) if (clock <= V[i + 1][0]) return lerp(V[i][1], V[i + 1][1], (clock - V[i][0]) / (V[i + 1][0] - V[i][0]));
    return V[V.length - 1][1];
  }

  /* ---- 2. the grade ---- */
  /* things the scene does not move by the hour: the page's value is the base (whatever else writes one becomes the new base) */
  const base = new Map(), wrote = new Map();
  function held(object, key, id, fn) {
    if (!object || typeof object[key] !== 'string') return;
    if (object[key] !== wrote.get(id)) base.set(id, object[key]);
    const out = fn(base.get(id));
    if (object[key] !== out) object[key] = out;
    wrote.set(id, out);
  }
  let skyTargets = null, autoSet = false;
  function grade({ light, CONFIG, hour: h }) {
    if (!light || !CONFIG) return;
    if (!autoSet) { autoSet = true; if (CONFIG.sceneDaylight) CONFIG.sceneDaylight.auto = 1; }   /* the scene's hour follows the scroll (through hour(), above) */
    if (!light.enabled) { state.on = false; state.why = 'the scene has its daylight at rest here'; return; }
    /* the exact hour of this place when the scene was given this place's stepped hour; otherwise the hour it was given
       (the valley's hand-over picture is rendered at its own fixed hour) */
    const hr = Number.isFinite(exact) && Math.abs(h - given) < 1e-6 ? clamp(exact, 5.5, 20) : Number.isFinite(light.hour) ? light.hour : h;
    state.hour = hr; state.on = true; state.why = 'on';
    gradeAt(hr);
    const L = CONFIG.alpineLight, F = CONFIG.field, W = CONFIG.openingWorld, V = window.__FLOW2_VALLEY__;
    const S = window.__MONTIS_STUDY__, progress = S?.journey?.progress ?? 0;
    /* what the scene itself has just set for this hour */
    const E = { top: fromColor(light.skyTop), mid: fromColor(light.skyMid), horizon: fromColor(light.horizon), fog: fromColor(light.fog), sun: fromColor(light.sunColor), cloudLit: fromColor(light.cloudLit), cloudShade: fromColor(light.cloudShade), shadow: fromColor(light.shadow), sea: fromColor(light.sea) };

    /* the canyon and the aerial chapters */
    if (L) {
      /* flow2-valley.js: in the canyon (w) it pulls five sky colours toward the opening's by its tone, and three light colours
         toward its own. The grade is applied to what it would have shown; its targets become the graded colours. */
      const w = V ? 1 - smooth(9.7, 10.7, progress) : 0, vt = V ? clamp(V.tone) : 0;
      if (V && !skyTargets) skyTargets = { ...V.SKY_COLOURS };
      const blendHex = (a, b, t) => mixHex(a, b, t);
      const lightTarget = k => V?.REAL?.colours?.[k] && V?.HERO?.colours?.[k] ? mixHex(V.REAL.colours[k], V.HERO.colours[k], vt) : null;
      const sky = [['skyZenith', 'top', E.top], ['skyMid', 'mid', E.mid], ['skyHorizon', 'horizon', E.horizon], ['fogColor', 'fog', E.fog], ['valleyHazeColor', 'fog', E.fog]];
      for (const [key, role, engine] of sky) {
        const shown = skyTargets?.[key] ? blendHex(engine, skyTargets[key], w * vt) : engine;
        const out = tone(shown, role);
        L[key] = out; if (V?.SKY_COLOURS && key in V.SKY_COLOURS) V.SKY_COLOURS[key] = out;
      }
      const ground = hex(rgb(E.shadow).map(v => v * .3));
      const lights = [['sunColor', 'sun', E.sun], ['shadowColor', 'shadow', E.shadow], ['groundColor', 'shadow', ground]];
      for (const [key, role, engine] of lights) {
        const target = lightTarget(key), shown = target ? blendHex(engine, target, w) : engine;
        const out = tone(shown, role, 1, key !== 'sunColor');
        L[key] = out; if (V?.LIGHT_COLOURS && key in V.LIGHT_COLOURS) V.LIGHT_COLOURS[key] = out;
      }
      /* The sun's place. The scene's own time of day carries the sun across the sky with the hour, and the terrain bakes its shadow map
         again whenever the sun moves: following the scroll, that was every frame of the climb and of the aerial chapter (measured:
         23 to 33 frames over 33 ms in that stretch against 2). The day here is told by colour and strength; the sun stays where the
         page had it (the scene's noon place with the page's own azimuth and height dials), so nothing is baked again. */
      if (T.holdSun && CONFIG.sceneDaylight) {
        const P = CONFIG.sceneDaylight, az = +P.azimuth || 0, el = clamp(48 * (Number.isFinite(+P.elevation) ? +P.elevation : 1), -24, 82);
        L.sunAzimuth = az; L.sunAzimuthAerial = az; L.sunElevation = el; L.sunElevationAerial = el; L.rimAzimuth = az; L.rimElevation = Math.max(-6, el - 4);
        if (W) { W.sunAzimuth = az; W.sunElevation = el; }
      }
      /* the sun's strength for the exact hour (not the stepped one the scene was given) */
      if (CONFIG.sceneDaylight && T.step > 0) {
        const sun = sunAt(hr, CONFIG.sceneDaylight), P = CONFIG.sceneDaylight;
        L.sunIntensity = sun.intensity;
        if (W) W.sunStrength = (.5 * (Number.isFinite(+P.sun) ? +P.sun : 1) + sun.intensity * .17) * sun.daylight;
      }
      L.rimColor = tone(E.sun, 'sun', 1, false);
      L.cloudLit = tone(E.cloudLit, 'cloudLit'); L.cloudShade = tone(E.cloudShade, 'cloudShade');
      /* the canyon's water: its own two colours (deep, shallow) take the hour as the sky does */
      if (V?.tune && V.REAL?.water && V.HERO?.water) {
        for (const k of ['deep', 'shallow']) {
          const a = V.REAL.water[k], b = V.HERO.water[k];
          if (Array.isArray(a) && Array.isArray(b)) V.tune[k] = toneLinear(a.map((x, i) => x + (b[i] - x) * vt), 'sea', k === 'deep' ? 1 : .7);
        }
      }
    }
    /* the opening: its backdrop (sky above, water below) and the light on its sea */
    if (F) {
      held(F, 'zenith', 'f:zenith', c => tone(c, 'top'));
      held(F, 'top', 'f:top', c => tone(c, 'top', .8));
      held(F, 'upper', 'f:upper', c => tone(c, 'mid'));
      held(F, 'horizon', 'f:horizon', c => tone(c, 'horizon'));
      held(F, 'lower', 'f:lower', c => tone(c, 'sea', .8));
      held(F, 'floor', 'f:floor', c => tone(c, 'sea'));
    }
    if (W) {
      W.seaTint = tone(E.sea, 'sea'); W.hemiSky = tone(E.shadow, 'shadow'); W.hemiGround = tone(hex(rgb(E.sea).map(v => v * .55)), 'sea');
      W.sunColor = tone(E.sun, 'sun', 1, false); W.glintColor = W.sunColor; W.glintTint = W.sunColor; W.moteColor = tone(E.cloudLit, 'cloudLit');
    }
    /* FOUR PATHS from the air: its sky, mist, rock light and river colours (the scene does not move these by the hour) */
    if (T.aerial) {
    held(CONFIG.watershedStyle, 'skyColor', 'ws:sky', c => tone(c, 'mid'));
    held(CONFIG.watershedStyle, 'mistColor', 'ws:mist', c => tone(c, 'fog'));
    held(CONFIG.watershedStyle, 'rockColor', 'ws:rock', c => tone(c, 'cloudLit', .55));
    held(CONFIG.watershedWater, 'base', 'ww:base', c => tone(c, 'sea', .8));
    held(CONFIG.watershedWater, 'highlight', 'ww:high', c => tone(c, 'cloudLit', .7));
    }
  }

  /* the scene's hour follows the scroll from the start (flow2-look.js's values for the sun stay as they are) */
  Object.assign((window.__FLOW2_PRESET__ ||= {}).sceneDaylight ||= {}, { enabled: 1, auto: 1 });
  window.__FLOW2_DAY__ = { hour, grade, tune: T, state };
})();
