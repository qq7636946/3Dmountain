/* index1-5 optimisation team (2026-10-25/26), stream "cpu". Main-thread cost and DOM writes, first-half items only.
   Anchored string patches on the generated sources, run last by build.cjs. Every change writes the same values in the
   same frames: a guard only skips a write whose value is already there, or a recomputation that gives the same result.
   Helper contract: ({main,drops,letters,glass,html,extra,journey,watershed,ui}) => the same (+ extra:{file: source}). */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

// one occurrence or the helper fails (build.cjs then skips it and restores the snapshot: a SKIPPED line in the build output)
const once = (s, a, b) => {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`cpu anchor found ${n}x: ${a.slice(0, 80)}`);
  return s.replace(a, () => b);
};
const need = (src, name) => { if (typeof src !== 'string') throw new Error('cpu: module not in extra: ' + name); return src; };

module.exports = ({ main, drops, letters, glass, html, extra, journey, watershed, ui }) => {
  // ---------- main.js ----------
  // palette: a pure function of (hex, exposure), ~14 calls a frame. Memo keyed on the exposure; each call still writes the same numbers.
  main = once(main, 'function paletteLinear(hex, target = new THREE.Vector3()) {', `let paletteMemoExposure = NaN; const paletteMemo = new Map();
      function paletteLinear(hex, target = new THREE.Vector3()) {
        const e = Math.max(CONFIG.scene.exposure, 1e-3);
        if (e !== paletteMemoExposure) { paletteMemoExposure = e; paletteMemo.clear(); }
        let v = paletteMemo.get(hex);
        if (!v) { v = paletteLinearRaw(hex, new THREE.Vector3()); paletteMemo.set(hex, v); }
        return target.copy(v);
      }
      function paletteLinearRaw(hex, target = new THREE.Vector3()) {`);
  // flash layer (flash-layer-idle): hidden while its opacity is 0 (no CSS transition on it), and the per-frame flare writes only while it shows
  main = once(main, "writeStyle(transitionFlash, 'opacity', flashAlpha.toFixed(4));", `writeStyle(transitionFlash, 'opacity', flashAlpha.toFixed(4));
        writeStyle(transitionFlash, 'visibility', flashAlpha > 0 ? 'visible' : 'hidden');`);
  main = once(main, "writeStyle(transitionFlash, 'transform', ", "if (flashAlpha > 0) writeStyle(transitionFlash, 'transform', ");
  main = once(main, "writeVar(transitionFlash, '--flare-x', ", "if (flashAlpha > 0) writeVar(transitionFlash, '--flare-x', ");
  main = once(main, "writeVar(transitionFlash, '--flare-y', ", "if (flashAlpha > 0) writeVar(transitionFlash, '--flare-y', ");
  // class writes that rewrite the class attribute every frame even when nothing changes (dom-write-hygiene)
  main = once(main, "sectionTwo.classList.remove('is-active', 'is-live', 'is-in');",
    "if (sectionTwo.classList.contains('is-active') || sectionTwo.classList.contains('is-live') || sectionTwo.classList.contains('is-in')) sectionTwo.classList.remove('is-active', 'is-live', 'is-in');");
  main = once(main, "document.body.classList.remove('is-transitioning', 'is-section-two'); document.body.classList.toggle('is-journey-moving', p > .09);",
    "if (document.body.classList.contains('is-transitioning') || document.body.classList.contains('is-section-two')) document.body.classList.remove('is-transitioning', 'is-section-two'); if (document.body.classList.contains('is-journey-moving') !== (p > .09)) document.body.classList.toggle('is-journey-moving', p > .09);");
  main = once(main, "dropTouch.hovered = false; document.body.classList.remove('is-drop-hovered');",
    "dropTouch.hovered = false; if (document.body.classList.contains('is-drop-hovered')) document.body.classList.remove('is-drop-hovered');");

  // ---------- finnovation-world.js (the world's frame and its scroll listener) ----------
  let world = need(extra['finnovation-world.js'], 'finnovation-world.js');
  // scroll (finnovation-world.js ~718): the scroll event our own scrollTop write causes is answered without reading scrollTop
  // (a forced style/layout flush in the frame). Only for an unclamped position, where the old check returned early too.
  world = once(world, 'let y = 0, yt = 0, vy = 0, written = -1, maxY = 1;', 'let y = 0, yt = 0, vy = 0, written = -1, maxY = 1;\n  let ownScrollWrite = false;');
  world = once(world, 'raf = 0; if (!open || disposed || document.hidden) return;', 'raf = 0; if (!open || disposed || document.hidden) return;\n    ownScrollWrite = false;');
  world = once(world, '{ written = y; viewport.scrollTop = y; }', '{ written = y; ownScrollWrite = true; viewport.scrollTop = y; }');
  world = once(world, 'if (!open || Math.abs(viewport.scrollTop - written) < 1.5) return;',
    'if (ownScrollWrite) { ownScrollWrite = false; if (written >= 0 && written <= maxY) return; }\n    if (!open || Math.abs(viewport.scrollTop - written) < 1.5) return;');
  // chapter-state classes and the nav progress: write only what changed
  world = once(world, "root.classList.toggle('is-live', s.c > .4);", "if (root.classList.contains('is-live') !== (s.c > .4)) root.classList.toggle('is-live', s.c > .4);");
  world = once(world, "root.classList.toggle('is-chapters', s.c > .9 && W > 960 && s.footerTop > H * .62);",
    "{ const on = s.c > .9 && W > 960 && s.footerTop > H * .62; if (root.classList.contains('is-chapters') !== on) root.classList.toggle('is-chapters', on); }");
  world = once(world, "b.style.setProperty('--p', clamp((mid - a) / Math.max(1, z - a)).toFixed(3));",
    "{ const pv = clamp((mid - a) / Math.max(1, z - a)).toFixed(3); if (b.style.getPropertyValue('--p') !== pv) b.style.setProperty('--p', pv); }");
  // the daylight colours: each call used to parse the hex again (6+ a frame). Still a fresh colour object per call.
  world = once(world, 'const color = hex => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);',
    'const colorParsed = new Map();\n  const color = hex => { let c = colorParsed.get(hex); if (!c) { c = new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace); colorParsed.set(hex, c); } return new THREE.Color().copy(c); };');
  extra = { ...extra, 'finnovation-world.js': world };

  // ---------- section-motion.js (pose key: a WeakMap instead of a data attribute written on every moving frame) ----------
  let motion = need(extra['section-motion.js'], 'section-motion.js');
  motion = once(motion, 'function apply(el,enter,exit,i,reduced){', 'const paintedPose=new WeakMap();\nfunction apply(el,enter,exit,i,reduced){');
  motion = once(motion, 'if(el.dataset.motionPose===key)return p.alpha;', 'if(paintedPose.get(el)===key)return p.alpha;');
  motion = once(motion, "el.dataset.motionPose=key;el.classList.add('fi-motion-node');", "paintedPose.set(el,key);if(!el.classList.contains('fi-motion-node'))el.classList.add('fi-motion-node');");
  extra = { ...extra, 'section-motion.js': motion };

  // ---------- world-principles.js (paint: every world frame wrote the same values) ----------
  let principles = need(extra['world-principles.js'], 'world-principles.js');
  principles = once(principles, " const stopY=()=>top+H*.12;", " let statusOpacityText='';\n const stopY=()=>top+H*.12;");
  principles = once(principles, "body.style.setProperty('--show',p.show.toFixed(3));body.style.setProperty('--travel','0px');",
    "const showText=p.show.toFixed(3);if(body.style.getPropertyValue('--show')!==showText)body.style.setProperty('--show',showText);if(body.style.getPropertyValue('--travel')!=='0px')body.style.setProperty('--travel','0px');");
  principles = once(principles, "body.style.visibility=p.show>.001?'visible':'hidden';body.inert=p.show<.01;",
    "const visibleText=p.show>.001?'visible':'hidden';if(body.style.visibility!==visibleText)body.style.visibility=visibleText;if(body.inert!==(p.show<.01))body.inert=p.show<.01;");
  principles = once(principles, "section.style.setProperty('--progress',p.read.toFixed(3));",
    "{const readText=p.read.toFixed(3);if(section.style.getPropertyValue('--progress')!==readText)section.style.setProperty('--progress',readText);}");
  principles = once(principles, "root.classList.toggle('is-principles',p.show>.01);",
    "if(root.classList.contains('is-principles')!==(p.show>.01))root.classList.toggle('is-principles',p.show>.01);");
  principles = once(principles, "if(resp&&p.enter>.05&&p.y<top+height)resp.inert=true;", "if(resp&&p.enter>.05&&p.y<top+height&&!resp.inert)resp.inert=true;");
  principles = once(principles, "if(status)status.style.opacity=p.show.toFixed(3);",
    "if(status){const opacityText=p.show.toFixed(3);if(opacityText!==statusOpacityText){statusOpacityText=opacityText;status.style.opacity=opacityText;}}");
  extra = { ...extra, 'world-principles.js': principles };

  // ---------- water-canyon-watershed-463.js (per-frame terrain key and river spreads) ----------
  // the key is JSON of six numbers; rebuild it only when a number changed (same string either way)
  watershed = once(watershed, 'let disposed=false,pendingTerrain=null,pendingSince=0;',
    "let lastTerrainNext=null,lastTerrainKey='';\n  const sameTerrainNumbers=(a,b)=>{if(!b)return false;for(const k in a)if(a[k]!==b[k])return false;return true;};\n  let disposed=false,pendingTerrain=null,pendingSince=0;");
  watershed = once(watershed, 'const next=readTerrainSettings(),key=JSON.stringify(next),now=performance.now();',
    'const next=readTerrainSettings(),now=performance.now();\n    const key=sameTerrainNumbers(next,lastTerrainNext)?lastTerrainKey:(lastTerrainNext=next,lastTerrainKey=JSON.stringify(next));');
  watershed = once(watershed, 'for(const r of [...rivers,...extensions])r.update(time);return',
    'for(const r of rivers)r.update(time);for(const r of extensions)r.update(time);return');

  // ---------- alpine-ui.js: the bridge ink on the header only (build product: copied from alpine/ by alpine-team-build) ----------
  // The copy served as prototypes/index1-5/alpine-ui.js is patched here, so the parity base (PERF_OFF=cpu) stays the unpatched one.
  const alpineFile = path.join(__dirname, 'alpine-ui.js');
  let alpine = fs.readFileSync(alpineFile, 'utf8').replace(/\r\n/g, '\n');
  alpine = once(alpine, 'let bridgeInk = -1;', 'let bridgeInk = -1, inkHeader = null, inkSet = null;');
  alpine = once(alpine, "if (Math.abs(ink - bridgeInk) > .01) { bridgeInk = ink; html.style.setProperty('--alp-bridge-ink', ink.toFixed(3)); }",
    // --alp-bridge-ink is read by the header alone (its --alp-bi). On <html> an inherited variable restyles the whole document on
    // every bridge step; on the header it restyles the header's subtree. Same value, same frames.
    "if (!inkHeader?.isConnected) inkHeader = root.querySelector('.fi-header');\n  if (inkHeader && (Math.abs(ink - bridgeInk) > .01 || inkSet !== inkHeader)) { bridgeInk = ink; inkSet = inkHeader; inkHeader.style.setProperty('--alp-bridge-ink', ink.toFixed(3)); }");
  fs.writeFileSync(alpineFile, alpine);
  // cache-bust the served module by its content (build.cjs never rewrites this version)
  html = html.replace(/(prototypes\/index1-5\/alpine-ui\.js)\?v=[^"'\s>]*/, (m, p) => p + '?v=cpu-' + crypto.createHash('sha1').update(alpine).digest('hex').slice(0, 10));

  return {
    main, drops, letters, glass, html, journey, watershed, ui,
    extra: { ...extra },
  };
};
