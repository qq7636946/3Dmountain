/* index1-5 · 海洋章節 Ocean (2026-10-23). Client: 「地球完幫我做這樣的轉場跟區塊 https://2025.oceanx.org/ ，船不需要，
   畫面3D就用原本的俯視圖，滾動跑橫向的，用一些雲海鳥來設計」.
   After the planet a full-screen water wave (2026-10-24: 「直接 WebGL 波浪轉場…不要畫圓」) sweeps across the frame and
   carries the planet's image into our top-down sea (the FINNOVATION mark carved in the water = the hero, where the
   reference has its ship), in the valley's colours (「跟著前面山谷的那些一樣的顏色」, read live from the valley's
   CONFIG); the RESPONSIBILITY chapters then run freely sideways across that sea with clouds, their shadows, gulls and
   sun glints. Live code: world-ocean.js (+ world-ocean.css).
   What this helper does (build.cjs runs it after opening-world, before user-preset):
   · extra['finnovation-world.js'] = a LOCAL COPY of the shared js/finnovation-world.js (the shared file, used by
     index1-1 and others, is not touched), its asset URLs re-pointed from prototypes/index1-5/js/, with hooks that
     call world-ocean.js; main.js's import('./finnovation-world.js?v=…') then resolves to it (build.cjs's LOCAL set).
   · extra['world-ocean.js'] = the module.
   · main: CONFIG.worldOcean (defaults from world-ocean.js), the mount option ocean: () => CONFIG.worldOcean, the
     tuner group 「海洋章節 Ocean」 (before 卡牌轉場 Cards; its sliders are live, no applyConfig()).
   · html: <link data-world-ocean> to world-ocean.css (content-hashed; idempotent — the page is also the build's input).
   Every anchor must occur exactly once (once() throws otherwise), so a change in the shared module stops the build
   instead of silently dropping a hook. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
function once(src, anchor, repl, label = '') {
  const n = src.split(anchor).length - 1;
  if (n !== 1) throw new Error('index1-5 world-ocean anchor' + (label ? ' (' + label + ')' : '') + ': ' + n + ' × ' + anchor.slice(0, 100));
  return src.replace(anchor, () => repl);
}

/* Shared scroll sun, applied to either a freshly built world or the current scoped runtime copy.
   No dependency on the Logo Seal hook: the world's measured footer already includes that block when present. */
function patchDaylightWorld(src) {
  if (src.includes('/* WORLD_SCENE_DAYLIGHT */')) return src;
  const p = (a, b, label) => { src = once(src, a, b, 'daylight ' + label); };
  p("import { GRADE_GLSL, gradeVector }", "import { getSceneDaylight, setSceneTime } from './scene-daylight.js';\nimport { GRADE_GLSL, gradeVector }", 'import');
  p('uniform float uTime, uDim, uReady, uRoiReady, uCloudAmount, uScrim;',
    'uniform float uTime, uDim, uReady, uRoiReady, uCloudAmount, uScrim, uSunEnergy;', 'earth uniform');
  p('float lit = smoothstep(-0.45, 0.75, dot(N, uSun)) * 0.72 + 0.34;',
    'float lit = smoothstep(-0.45, 0.75, dot(N, uSun)) * 0.72 * uSunEnergy + mix(0.24, 0.34, uSunEnergy);', 'earth light');
  p('col = mix(col, uRim, pow(1.0 - facing, 2.6) * 0.72);',
    'col = mix(col, uRim, pow(1.0 - facing, 2.6) * mix(0.24, 0.62, uSunEnergy));', 'earth rim');
  p('uTime: { value: 0 }, uDim: { value: 0 }, uReady: { value: 0 },',
    'uTime: { value: 0 }, uSunEnergy: { value: 1 }, uDim: { value: 0 }, uReady: { value: 0 },', 'earth init');
  p('  let frames = 0, shown = true;\n', `  /* WORLD_SCENE_DAYLIGHT */
  let worldDaylightOn = false;
  const worldSunDisplay = new THREE.Color(), worldHorizonDisplay = new THREE.Color();
  const toDisplay = (out, input) => out.copy(input).convertLinearToSRGB();
  function frameWorldDaylight() {
    const light = getSceneDaylight();
    const bu = background.material.uniforms, du = deck.material.uniforms, eu = globe.material.uniforms, hu = halo.material.uniforms;
    if (!light.enabled) {
      if (worldDaylightOn) {
        for (const [key, value] of [['uSkyTop', LOOK.skyTop], ['uSkyBottom', LOOK.skyBottom], ['uDeepTop', LOOK.deepTop], ['uDeepBottom', LOOK.deepBottom]]) bu[key].value.copy(color(value));
        for (const [key, value] of [['uOcean', LOOK.ocean], ['uOceanHi', LOOK.oceanHi], ['uLand', LOOK.land], ['uLandHi', LOOK.landHi], ['uIce', LOOK.ice], ['uCloud', LOOK.cloud], ['uRim', LOOK.rim]]) eu[key].value.copy(color(value));
        du.uLight.value.copy(color(LOOK.deck)); du.uShade.value.copy(color(LOOK.deckShade));
        hu.uHalo.value.copy(color(LOOK.halo)); eu.uSun.value.set(-.55, .62, .56).normalize(); eu.uSunEnergy.value = 1;
      }
      worldDaylightOn = false; return;
    }
    worldDaylightOn = true;
    // One continuous, reversible scene clock: cards end 16:24, orbit 16:51, water entry 18:00, final lake/foot 19:30.
    // Use measured section positions, so changing chapter / Logo Seal lengths never makes the sun jump.
    const a = Math.max(1, at.global), b = Math.max(a + 1, at.resp), z = Math.max(b + 1, at.footer);
    let hour;
    if (y <= a) hour = mix(16.4, 16.85, smooth(0, a, y));
    else if (y <= b) hour = mix(16.85, 18, smooth(a, b, y));
    else hour = mix(18, 19.5, smooth(b, z, y));
    setSceneTime(hour);
    const D = getSceneDaylight(), day = clamp(D.daylight), night = clamp(D.night);
    toDisplay(worldSunDisplay, D.sunColor); toDisplay(worldHorizonDisplay, D.horizon);
    toDisplay(bu.uSkyTop.value, D.skyTop).multiplyScalar(.68);
    toDisplay(bu.uSkyBottom.value, D.skyMid).lerp(worldHorizonDisplay, .24).multiplyScalar(.65);
    toDisplay(bu.uDeepTop.value, D.skyTop).multiplyScalar(.4);
    toDisplay(bu.uDeepBottom.value, D.skyMid).multiplyScalar(.22);
    du.uLight.value.copy(worldHorizonDisplay).lerp(worldSunDisplay, .12 * day).multiplyScalar(mix(.72, 1, day));
    toDisplay(du.uShade.value, D.skyMid).lerp(worldHorizonDisplay, .2).multiplyScalar(.72);
    eu.uSun.value.copy(D.sunDirection); eu.uSunEnergy.value = Math.min(1.5, Math.max(0, D.intensity / 4.5));
    eu.uOcean.value.copy(color(LOOK.ocean)).multiplyScalar(mix(.72, 1, day));
    eu.uOceanHi.value.copy(color(LOOK.oceanHi)).lerp(worldHorizonDisplay, .1).multiplyScalar(mix(.7, 1, day));
    eu.uLand.value.copy(color(LOOK.land)).lerp(worldSunDisplay, .08 * day).multiplyScalar(mix(.7, 1, day));
    eu.uLandHi.value.copy(color(LOOK.landHi)).lerp(worldSunDisplay, .12 * day).multiplyScalar(mix(.7, 1, day));
    eu.uIce.value.copy(color(LOOK.ice)).lerp(worldHorizonDisplay, .24 + .2 * night);
    eu.uCloud.value.copy(du.uLight.value).lerp(color(LOOK.cloud), .12);
    eu.uRim.value.copy(worldHorizonDisplay).lerp(worldSunDisplay, .24 * day).multiplyScalar(.78);
    hu.uHalo.value.copy(eu.uRim.value).multiplyScalar(.65);
  }

  let frames = 0, shown = true;
`, 'frame helper');
  p('    const bu = background.material.uniforms, du = deck.material.uniforms;\n    gradeVector',
    '    frameWorldDaylight();\n    const bu = background.material.uniforms, du = deck.material.uniforms;\n    gradeVector', 'frame call');
  return src;
}

const ROWS = [
  ['波浪轉場長度（螢幕高，越小越快）', 'worldOcean', 'dive', .8, 6, .05], ['波浪方向（度，0＝由下往上，正＝偏右）', 'worldOcean', 'waveAngle', -90, 90, 1],
  ['波長', 'worldOcean', 'waveLength', .03, .6, .005], ['波高（位移）', 'worldOcean', 'waveAmp', 0, .2, .001],
  ['浪峰亮度', 'worldOcean', 'crest', 0, 4, .05], ['折射強度（地球被波浪扭曲）', 'worldOcean', 'refract', 0, 3, .05],
  ['浪前緣柔和', 'worldOcean', 'waveSoft', .002, .3, .002], ['浪前緣起伏', 'worldOcean', 'wobble', 0, .3, .005],
  ['浪花飛沫', 'worldOcean', 'spray', 0, 3, .05], ['地球推近', 'worldOcean', 'push', 0, 1.5, .01],
  ['鏡頭落下（波浪中的高度）', 'worldOcean', 'depth', 1, 6, .05],
  ['海色跟隨山谷（1 開／0 用下面的色）', 'worldOcean', 'valley', 0, 1, 1], ['山谷海色明暗', 'worldOcean', 'tone', .3, 2, .01],
  ['海 深色（不跟山谷時）', 'worldOcean', 'deep'], ['海 亮面（不跟山谷時）', 'worldOcean', 'lit'], ['海 最暗（不跟山谷時）', 'worldOcean', 'ink'], ['浪花／水痕（不跟山谷時）', 'worldOcean', 'foam'],
  ['反光 顏色（不跟山谷時）', 'worldOcean', 'glintColor'], ['反光 強度', 'worldOcean', 'glint', 0, 6, .05], ['反光 文字區抑制（舊值 .6）', 'worldOcean', 'glintText', 0, 1, .01], ['反光 高光柔化（舊值 0）', 'worldOcean', 'glintKnee', 0, 3, .05], ['反光 大小', 'worldOcean', 'glintSize', 0, 1, .01],
  ['浪 粗糙度（反光多寡）', 'worldOcean', 'rough', 0, 3, .02], ['浪 尺度', 'worldOcean', 'waveScale', .2, 4, .02], ['浪 速度', 'worldOcean', 'waveSpeed', 0, 4, .05],
  ['風向（度）', 'worldOcean', 'wind', -180, 180, 1],
  ['LOGO 水印 大小', 'worldOcean', 'heroSize', .1, 1.2, .01], ['LOGO 水印 水平位置', 'worldOcean', 'heroX', -1, 1, .01],
  ['LOGO 水印 垂直位置', 'worldOcean', 'heroY', -.6, .6, .01], ['LOGO 水印 對比', 'worldOcean', 'heroContrast', 0, 3, .05],
  ['四角壓暗', 'worldOcean', 'vignette', 0, 1.5, .02], ['文字底部壓暗', 'worldOcean', 'scrim', 0, 1.5, .02],
  ['雲 數量', 'worldOcean', 'clouds', 0, 1, .01], ['雲 不透明', 'worldOcean', 'cloudOpacity', 0, 1, .01], ['雲 速度', 'worldOcean', 'cloudSpeed', 0, 6, .05],
  ['雲影 深淺', 'worldOcean', 'cloudShadow', 0, 1.5, .02], ['雲 高度（視差）', 'worldOcean', 'cloudHeight', 0, .9, .01], ['雲 尺度', 'worldOcean', 'cloudScale', .2, 5, .05],
  ['海鷗 數量', 'worldOcean', 'gulls', 0, 16, 1], ['海鷗 速度', 'worldOcean', 'gullSpeed', 0, 4, .05], ['海鷗 大小', 'worldOcean', 'gullSize', .2, 4, .05],
  ['海鷗 拍翅', 'worldOcean', 'flap', 0, 2, .05],
  ['橫移靈敏度：每章滾動長度（螢幕高，越小越快）', 'worldOcean', 'stop', .5, 4, .05], ['慣性（越小越滑、越大越跟手）', 'worldOcean', 'ease', 2, 14, .1],
  ['海面每章橫移（螢幕寬）', 'worldOcean', 'travel', 0, 3, .05],
  ['文字區 水平位置', 'worldOcean', 'textX', 0, .6, .005], ['文字區 底邊位置', 'worldOcean', 'textY', .3, 1, .005]
];

function patchWorld(src) {
  const p = (a, b, label) => { src = once(src, a, b, label); };
  src = '/* index1-5 LOCAL COPY of js/finnovation-world.js (prototypes/index1-5/world-ocean-build.cjs): asset URLs re-pointed,\n' +
    '   hooks into world-ocean.js (the oceanx-style dive and the horizontal RESPONSIBILITY section). The shared file is untouched. */\n' + src;
  p("import { GRADE_GLSL, gradeVector }", "import { createWorldOcean } from './world-ocean.js';\nimport { GRADE_GLSL, gradeVector }", 'import');
  // asset URLs: this copy lives in prototypes/index1-5/js/
  p("new URL('../images/world/' + name, import.meta.url)", "new URL('../../../images/world/' + name, import.meta.url)", 'images url');
  p("new URL('../media/' + name, import.meta.url)", "new URL('../../../media/' + name, import.meta.url)", 'media url');
  p("new URL('../css/world.css", "new URL('../../../css/world.css", 'css url');
  const stray = src.match(/new URL\(\s*['"`](?!\.\.\/\.\.\/\.\.\/)[^'"`]*['"`]/g);
  if (stray) throw new Error('index1-5 world-ocean: unhandled URL in finnovation-world.js: ' + stray.join(', '));
  // mount option + the module (it rearranges the DOM before anything below measures it)
  p("video: look = () => null, busy = null })", "video: look = () => null, busy = null, ocean: oceanConfig = () => null })", 'signature');
  p("  const ui = document.querySelector('.finnovation-ui');\n", `  const ui = document.querySelector('.finnovation-ui');
  /* index1-5 ocean (world-ocean.js): the planet is followed by a dive through a HUD lens into the sea, and the
     responsibility chapters become a horizontal section over it. Null when the markup is not there (then all below
     runs as the shared module). */
  const ocean = createWorldOcean({
    root, reducedMotion, config: oceanConfig, small: Math.min(screen.width, screen.height) < 700 || (navigator.deviceMemory && navigator.deviceMemory < 4),
    go: value => { yt = clamp(value, 0, maxY); run(); }, remeasure: () => { measure(); refreshTriggers(); run(); }
  });
  /* GSAP's scroll reveals stay off the horizontal section (it reveals its chapters itself, by stop) */
  const outside = list => [...list].filter(el => !el.closest('.fiwo'));
`, 'create');
  p("root.querySelector('.fiw-resp > .fiw-grid')", "root.querySelector('.fiw-resp > .fiw-grid, .fiw-resp .fiwo-intro')", 'chunks');
  // GL
  p("function build() { buildRenderer(); buildBackground(); buildEarth(); buildHalo(); buildDeck(); }",
    "function build() { buildRenderer(); buildBackground(); buildEarth(); buildHalo(); buildDeck(); buildOcean(); }", 'build');
  p("  // ---------- textures ----------\n", `  function buildOcean() { if (!ocean || disposed || !renderer || !scene) return; ocean.build({ renderer, scene, camera, gradeGlsl: GRADE_GLSL, uGrade }); }

  // ---------- textures ----------
`, 'buildOcean');
  p("later('gl halo', buildHalo);", "later('gl halo', buildHalo); later('gl ocean', buildOcean);", 'queue');
  p("}).then(() => Promise.all(pictures)).then(([earth, asia, cloud, ocean])", "}).then(() => ocean?.bake()).then(() => Promise.all(pictures)).then(([earth, asia, cloud, ocean])", 'prewarm after deck');
  p("if (photo) { background.material.uniforms.uPhoto.value = photo; background.material.uniforms.uPhotoSize.value.set(photo.image.width, photo.image.height); }",
    "if (photo) { background.material.uniforms.uPhoto.value = photo; background.material.uniforms.uPhotoSize.value.set(photo.image.width, photo.image.height); ocean?.setPhoto(photo); }", 'photo');
  // Keep this page from requesting the cancelled ocean-logo video.
  p("  function frameVideo(s, speed) {", "  function frameVideo(s, speed) {\n    // The ocean-logo film and its still fallback are disabled for index1-5.\n    if (ocean && +(oceanConfig()?.heroEnabled ?? 1) < .5) {\n      if (videoWanted) { video?.pause(); videoWanted = false; }\n      videoMix = 0;\n      if (background) background.material.uniforms.uVideoMix.value = 0;\n      ocean.setVideoMix(0);\n      return;\n    }", 'ocean video disabled');
  // the film: mipmapped (the grade reads its local mean), handed to the ocean
  p("videoTexture.generateMipmaps = false; videoTexture.minFilter = THREE.LinearFilter;",
    "videoTexture.generateMipmaps = !!ocean; videoTexture.minFilter = ocean ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;", 'video mips');
  p("background.material.uniforms.uVideoSize.value.set(video.videoWidth, video.videoHeight);",
    "background.material.uniforms.uVideoSize.value.set(video.videoWidth, video.videoHeight);\n        ocean?.setVideo(videoTexture);", 'video');
  p("if (background) background.material.uniforms.uVideoMix.value = videoMix;", "if (background) background.material.uniforms.uVideoMix.value = videoMix;\n    ocean?.setVideoMix(videoMix);", 'video mix');
  // measuring: the ocean sizes its spacer and its section first, then reads where they are
  p("  function measure() {\n    W = innerWidth; H = innerHeight;\n", "  function measure() {\n    W = innerWidth; H = innerHeight;\n    ocean?.layout(W, H);\n", 'layout');
  p("at.footer = top(f); at.footerH = f?.offsetHeight || 0;", "at.footer = top(f); at.footerH = f?.offsetHeight || 0;\n    ocean?.measure(at, top);", 'measure');
  // the clocks
  p("    const recede = smooth(.62, 1.02, (yy - at.global) / Math.max(1, at.globalH));",
    "    const o = ocean ? ocean.sample(yy) : null;\n    const recede = o ? 0 : smooth(.62, 1.02, (yy - at.global) / Math.max(1, at.globalH));", 'sample');
  p("photo: smooth(at.block - H * 1.15, at.block - H * .3, yy),", "photo: o ? o.show : smooth(at.block - H * 1.15, at.block - H * .3, yy),", 'photo clock');
  p("footerTop: at.footer - yy", "o, footerTop: at.footer - yy", 'sample o');
  // the planet: it centres under the lens and grows as the camera comes down (instead of receding)
  p("const live = s.reveal > .001 && s.recede < .999;", "const live = s.reveal > .001 && s.recede < .999 && !s.o?.covered;", 'live');
  p("    earth.visible = live;\n    if (!live) return;", "    earth.visible = live;\n    if (!live) { ocean?.setGlobe(0, 0, 0); return; }", 'not live');
  p("    const lon = THREE.MathUtils.degToRad(mix(148, 138, r) - 34 * gl), lat = THREE.MathUtils.degToRad(mix(-12, 2, r) - 5 * gl);",
    `    let lonD = mix(148, 138, r) - 34 * gl, latD = mix(-12, 2, r) - 5 * gl;
    // index1-5 ocean: the planet centres, seen straight down, and the camera dives into the lens
    const dive = ocean?.earth({ R, cx, cy, lon: lonD, lat: latD, W, H, portrait });
    if (dive) ({ R, cx, cy, lon: lonD, lat: latD } = dive);
    const lon = THREE.MathUtils.degToRad(lonD), lat = THREE.MathUtils.degToRad(latD);`, 'lon lat');
  p("    camera.setViewOffset(W, H, _offset.x, _offset.y, W, H);\n    camera.updateMatrixWorld();", "    camera.setViewOffset(W, H, _offset.x, _offset.y, W, H);\n    camera.updateMatrixWorld();\n    ocean?.setGlobe(cx, cy, R);", 'globe');
  p("u.uScrim.value = .34 * (1 - rec);", "u.uScrim.value = .34 * (1 - rec);\n    if (dive) { u.uDim.value = dive.dim; u.uScrim.value = dive.scrim; }", 'dim');
  p("const show = earth.visible ? smooth(.72, 1, s.reveal) * (1 - smooth(.25, .7, s.recede)) : 0;",
    "const show = earth.visible ? smooth(.72, 1, s.reveal) * (1 - smooth(.25, .7, s.recede)) * (1 - smooth(0, .3, s.o?.reframe ?? 0)) : 0;", 'pins');
  // drawing
  p("bu.uDeep.value = smooth(.15, .9, s.recede);", "bu.uDeep.value = Math.max(smooth(.15, .9, s.recede), s.o ? s.o.deep : 0);", 'deep');
  p("bu.uPhotoMix.value = s.photo;", "bu.uPhotoMix.value = ocean ? 0 : s.photo;", 'photo mix');
  p("    if (!visible) return;\n    renderer.render(scene, camera);", "    if (!visible) return;\n    ocean?.render(s, time);\n    renderer.render(scene, camera);", 'render');
  // the frame: from the dive on, the spring takes the 慣性 dial (free travel, no snapping); the HTML follows the clock
  p("const omega = 9.5, x = y - yt,", "const omega = ocean ? ocean.omega(y) : 9.5, x = y - yt,", 'spring');
  p("    paintPage(s);\n", "    paintPage(s);\n    ocean?.paint(s);\n", 'paint');
  // touch: on the horizontal section a sideways swipe moves it too
  p("touch = { id: event.pointerId, y: event.clientY }; samples = [];", "touch = { id: event.pointerId, y: event.clientY, x: event.clientX }; samples = [];", 'touch x');
  p("    const dy = touch.y - event.clientY; touch.y = event.clientY;",
    "    let dy = touch.y - event.clientY; touch.y = event.clientY;\n    const dx = touch.x - event.clientX; touch.x = event.clientX;\n    if (ocean?.active && Math.abs(dx) > Math.abs(dy)) dy = dx * ocean.swipe;", 'swipe');
  p("name === 'responsibility' ? at.resp + H * .3", "name === 'responsibility' ? (ocean ? ocean.stopY(0) : at.resp + H * .3)", 'nav');
  // keyboard: focus landing on the pinned progress dots / buttons must not scroll the section (each Tab walked the sea .23–.38 chapter on)
  p("if (!open || !viewport.contains(event.target)) return;", "if (!open || !viewport.contains(event.target) || event.target.closest?.('.fiwo-pin')) return;", 'focusin pins');
  // the header's EXPLORE inside the epilogue: the next stop (declaration → stops 0…N−1 → footer); false at the end
  p("    scrollTo(value) { if (!open) return; yt = clamp(value === Infinity ? maxY : value, 0, maxY); run(); },",
    "    scrollTo(value) { if (!open) return; yt = clamp(value === Infinity ? maxY : value, 0, maxY); run(); },\n" +
    "    next() { if (!open) return false; const stops = [at.global + H * .2, ...(ocean ? Array.from({ length: ocean.N }, (_, k) => ocean.stopY(k)) : [at.resp + H * .3]), maxY].sort((a, b) => a - b); const t = stops.find(v => v > Math.max(y, yt) + 40); if (t === undefined) return false; yt = clamp(t, 0, maxY); run(); return true; },", 'next');
  // GSAP reveals: not inside the horizontal section
  p("root.querySelectorAll('[data-reveal]').forEach(el => gsap.from(el,", "outside(root.querySelectorAll('[data-reveal]')).forEach(el => gsap.from(el,", 'gsap reveal');
  p("root.querySelectorAll('[data-fill]').forEach(el => {", "outside(root.querySelectorAll('[data-fill]')).forEach(el => {", 'gsap fill');
  p("root.querySelectorAll('.fiw-line').forEach(el =>", "outside(root.querySelectorAll('.fiw-line')).forEach(el =>", 'gsap line');
  p("root.querySelectorAll('.fiw-index span').forEach(el =>", "outside(root.querySelectorAll('.fiw-index span')).forEach(el =>", 'gsap index');
  // lifecycle + diagnostics
  p("    if (video) { video.pause(); videoWanted = false; }\n    epilogue()?.setExit(0);", "    if (video) { video.pause(); videoWanted = false; }\n    epilogue()?.setExit(0);\n    ocean?.close();", 'close');
  p("get state() { return { y, yt, maxY, at: { ...at }, dpr, sample: sample(y),", "get state() { return { y, yt, maxY, at: { ...at }, dpr, ocean: ocean?.state, sample: sample(y),", 'state');
  p("      scene?.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });", "      ocean?.dispose();\n      scene?.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });", 'dispose');
  return patchDaylightWorld(src);
}

module.exports = ({ main, drops, letters, glass, html }) => {
  const ocean = read(path.join(__dirname, 'world-ocean.js'));
  const m = ocean.match(/\/\*OCEAN-DEFAULTS\*\/([\s\S]*?)\/\*\/OCEAN-DEFAULTS\*\//);
  if (!m) throw new Error('index1-5 world-ocean: defaults block not found in world-ocean.js');
  const defaults = JSON.parse(m[1]);
  for (const [, group, key] of ROWS) if (group !== 'worldOcean' || !(key in defaults)) throw new Error('index1-5 world-ocean: dial without a default: ' + key);

  /* ---- main.js ---- */
  main = once(main, 'mist: () => CONFIG.mist, video: () => CONFIG.video,', 'mist: () => CONFIG.mist, video: () => CONFIG.video, ocean: () => CONFIG.worldOcean,', 'mount option');
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* 海洋章節 Ocean（world-ocean-build.cjs）：地球之後的透鏡俯衝與橫向「責任」章節。 */
      CONFIG.worldOcean = ${JSON.stringify(defaults)};
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'defaults');
  main = once(main, "          ['卡牌轉場 Cards', [", `          /* 海洋章節 Ocean：地球 → 透鏡俯衝 → 橫向章節（雲、雲影、海鷗、海面反光；LOGO 水印＝原本俯視圖的影片） */
          ['海洋章節 Ocean', ${JSON.stringify(ROWS)}],
          ['卡牌轉場 Cards', [`, 'tuner');
  main = once(main, "'relief', 'logoTerrain'].includes(groupKey);", "'relief', 'logoTerrain', 'worldOcean'].includes(groupKey);", 'live dials');
  /* The header's gold EXPLORE ([data-next]) did nothing once the cards or the world were open (the journey's "next stop" is past
     its end there). Cards → the world's declaration; in the world → the next stop; at the footer → back to the start. */
  main = once(main, '      const sceneCursor = createFinnovationCursor({', `      document.addEventListener('click', event => {
        if (!event.target.closest?.('.finnovation-ui [data-next]')) return;
        const toGlobal = w => { if (!w.open) w.enter(0); w.scrollTo(w.state.at.global + innerHeight * .2); };
        if (world?.open) {
          event.preventDefault(); event.stopPropagation();
          if (!world.next()) document.querySelector('.finnovation-ui .fi-menu-links [data-chapter="0"]')?.click();
        } else if (portfolio?.open) {
          event.preventDefault(); event.stopPropagation();
          if (world) toGlobal(world); else loadWorld().then(w => { if (w && portfolio?.open) toGlobal(w); });
        }
      }, true);
      const sceneCursor = createFinnovationCursor({`, 'explore');

  html = require('./world-ocean-strategies-build.cjs')(html);
  /* ---- html: the stylesheet (content-hashed), idempotent ---- */
  const css = read(path.join(__dirname, 'world-ocean.css'));
  const hash = crypto.createHash('md5').update(css).digest('hex').slice(0, 10);
  html = html.replace(/\n[ \t]*<link rel="stylesheet" href="prototypes\/index1-5\/world-ocean\.css[^"]*" data-world-ocean>/g, '');
  const anchor = html.match(/\n[ \t]*<link rel="stylesheet" href="prototypes\/index1-5\/index1-5\.css[^"]*">/g);
  if (!anchor || anchor.length !== 1) throw new Error('index1-5 world-ocean: html anchor (index1-5.css link) × ' + (anchor ? anchor.length : 0));
  html = html.replace(anchor[0], () => anchor[0] + `\n  <link rel="stylesheet" href="prototypes/index1-5/world-ocean.css?v=${hash}" data-world-ocean>`);

  /* ---- the local modules ---- */
  const world = patchWorld(read(path.join(ROOT, 'js', 'finnovation-world.js')));
  const extra = { 'finnovation-world.js': world, 'world-ocean.js': ocean, 'world-ocean-photos.js': read(path.join(__dirname, 'world-ocean-photos.js')), 'world-ocean-inertia.js': read(path.join(__dirname, 'world-ocean-inertia.js')), 'world-ocean-islands.js': read(path.join(__dirname, 'world-ocean-islands.js')), 'world-ocean-scroll.js': read(path.join(__dirname, 'world-ocean-scroll.js')) };
  return { main, drops, letters, glass, html, extra };
};
/* for test harnesses: the local copy of the world module on its own */
module.exports.patchWorld = () => patchWorld(read(path.join(ROOT, 'js', 'finnovation-world.js')));
module.exports.patchDaylightWorld = patchDaylightWorld;
