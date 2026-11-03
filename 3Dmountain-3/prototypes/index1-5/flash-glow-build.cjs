/* Local to index1-5 (2026-11-01). As the visitor scrolls down from the hero the droplet briefly lights up, and so does the 3D word when it has formed: the blue-white burn of the closing
   LOGO (world-logo-ember.js), without the holes. A timed pulse: it plays once on the way down past a point of the journey, and arms again when the visitor has gone back up past it.
   The light goes above the scene's bloom threshold, and the bloom is opened for the length of the pulse. Dials: CONFIG.flashGlow (LOGO panel).
   Later the same night the client took both away, then asked for the drop's back in the softer manner of the closing LOGO's click glow (「第一塊光芒加回去 但要新改良的比較柔和版本的發光」): wide rounded veins and more light in the body (uFlashSoft), wordOn 0 keeps the word dark.
   2026-11-02 (「這個發光的狀態幫我套上第一幕水滴往下滾時候發光」): the drop takes the closing LOGO's water light (flashFlow, the same field as emberFlow in world-logo-ember.js) and follows the scroll instead of playing one timed pulse: lit while the visitor scrolls down, fading when they stop, lit again the next time (follow). water 0 and follow 0 bring back the pulse of 11-01; on 0 turns it all off.
   Same day (「第二幕 3D TEXT 也要發光」): the word too, from the moment its last letter lands and for as long as the visitor keeps scrolling down over it (wordOn 0 keeps it dark). */
const NOISE = `
uniform vec4 uFlash; uniform vec3 uFlashColor;   // edge line, noise scale, its clock, gain
uniform vec4 uFlashSoft;   // line width, rounded creases, fine layers, light in the body (.1, 0, 1, .07 is the first, crisp version)
uniform vec2 uFlashWater;   // x 0 the folded lines, 1 flowing water; y how far the swells bend each other
uniform float uFlashRim;    // light on the edges, as the closing LOGO's bevels
/* no folds: long swells drifting one way, each bending the next. The same field as the closing LOGO's (emberFlow in world-logo-ember.js), same range as flashNoise */
float flashFlow(vec3 p, float t) {
  vec2 q = p.xy + p.z * vec2(.35, -.25);
  float s = t * 3.;
  q += .55 * uFlashWater.y * vec2(sin(q.y * 1.25 + s * .9), cos(q.x * 1.1 - s * .7));
  q += .24 * uFlashWater.y * vec2(sin(q.y * 2.7 - s * 1.1 + 1.7), cos(q.x * 2.4 + s * .95 + .6));
  return .285 + .285 * (.68 * sin(q.x * 1.9 + q.y * 1.1 - s) + .32 * sin(q.y * 3.1 - q.x * 1.4 + s * .7 + 2.1));
}
float flashTri(float x) { float t = abs(fract(x) - .5) * 2.; return mix(t, t * t * (3. - 2. * t), uFlashSoft.y) * .5; }
vec3 flashTri3(vec3 p) { return vec3(flashTri(p.z + flashTri(p.y)), flashTri(p.z + flashTri(p.x)), flashTri(p.y + flashTri(p.x))); }
float flashNoise(vec3 p, float t) {
  float z = 1.4, rz = 0.; vec3 bp = p;
  for (int i = 0; i < 4; i++) { vec3 dg = flashTri3(bp * 2.); p += dg + t; bp *= 1.8; z *= 1.5; p *= 1.2; float layer = flashTri(p.z + flashTri(p.x + flashTri(p.y))); rz += (i < 2 ? layer : mix(.25, layer, uFlashSoft.z)) / z; bp += .14; }
  return rz;
}
vec3 flashLight(vec3 p) {
  float n = uFlashWater.x > .999 ? flashFlow(p * uFlash.y, uFlash.z) : mix(flashNoise(p * uFlash.y, uFlash.z), flashFlow(p * uFlash.y, uFlash.z), uFlashWater.x);
  float edge = (1. - smoothstep(0., uFlashSoft.x, abs(n - uFlash.x))) * mix(min(1., .1 / uFlashSoft.x), 1., uFlashWater.x);   // old lines: a wider line spreads the same light, it does not add any
  /* water: the closing LOGO reads as light because it stands in the dark; the drop stands in a bright room, where an even blue wash only flattens the glass into ice. So the light gathers in
     pockets that travel along the bands (a second, slower field), white at their hearts, and the glass between them stays clear. */
  if (uFlashWater.x > .001) {
    edge *= mix(1., smoothstep(.1, .47, flashFlow(p.zxy * uFlash.y * .62 + 3.1, uFlash.z * .8)), uFlashWater.x);
    return mix(uFlashColor, vec3(1.), edge * edge * .85 * uFlashWater.x) * (edge + uFlashSoft.w) * uFlash.w;
  }
  return uFlashColor * (edge + uFlashSoft.w) * uFlash.w;
}`;
const once = (source, anchor, replacement, label) => {
  if (source.split(anchor).length !== 2) throw Error('flash-glow anchor (' + label + '): ' + (source.split(anchor).length - 1));
  return source.replace(anchor, () => replacement);
};
function patchGlass(glass) {
  if (glass.includes('/* FLASH_GLOW */')) return glass;
  glass = once(glass, 'uLiquidTime:{value:0},uLiquidAmount:{value:1},', "/* FLASH_GLOW */uFlash:{value:new THREE.Vector4()},uFlashColor:{value:new THREE.Color('#6fbcff')},uFlashSoft:{value:new THREE.Vector4(.1,0,1,.07)},uFlashWater:{value:new THREE.Vector2(1,1)},uFlashRim:{value:0},\n    uLiquidTime:{value:0},uLiquidAmount:{value:1},", 'glass uniforms');
  glass = once(glass, '      uniform sampler2D uBackdrop,uSpectrum,uNormalMap;', NOISE + '\n      uniform sampler2D uBackdrop,uSpectrum,uNormalMap;', 'glass pars');
  glass = once(glass, '        gl_FragColor=vec4(color,uOpacity);', '        if(uFlash.w>.001){color+=flashLight(vObj);float flashR=1.-clamp(NdV,0.,1.);color+=mix(uFlashColor,vec3(1.),.45)*flashR*flashR*flashR*uFlashRim*uFlash.w;}\n        gl_FragColor=vec4(color,uOpacity);', 'glass end');
  return glass;
}
/* the letters report the moment the last of them has landed (home waits for the word's setting, which is on the scroll) */
function patchLetters(letters) {
  if (letters.includes('/* FLASH_GLOW */')) return letters;
  letters = once(letters, '    let home = 0;\n    const last = Math.max(1, letters.length - 1);', '    let home = 0, landed = 0;   /* FLASH_GLOW */\n    const last = Math.max(1, letters.length - 1);', 'letters count');
  letters = once(letters, 'state.assembled = false; state.glass = false; state.pulse = 0;', 'state.assembled = false; state.glass = false; state.pulse = 0; state.landed = false;', 'letters reset');
  letters = once(letters, '      if (snap >= 1 && set >= 1) home++;', '      if (snap >= 1 && set >= 1) home++;\n      if (snap >= 1) landed++;', 'letters landed');
  letters = once(letters, '    state.assembled = home === letters.length && config.fused <= .001;', '    state.assembled = home === letters.length && config.fused <= .001;\n    state.landed = letters.length > 0 && landed === letters.length;', 'letters state');
  return letters;
}
function patchMain(main) {
  if (main.includes('/* FLASH_GLOW */')) return main;
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* FLASH_GLOW */
      /* the pulse of 11-01 (off since then): on 0, water 0, follow 0, line .105, soft .28, body .16, heroScale 1.7, heroGain 3.6. Before the QA pass and the denser waves of 11-02 (「發光波型再密一點」): rim .8, followMin .03, heroScale 1.3, wordScale 1, wordScalePhone 1, heroGain 3, bloom .55, bloomCut 1.4 */
      CONFIG.flashGlow = { on: 1, water: 1, bend: 1, rim: .6, follow: 1, followMin: .15, wordOn: 1, wordRim: .3, wordBloomCut: 2.4, color: '#6fbcff', heroAt: .08, wordAt: 2.95, wordDelay: 0, attack: .45, hold: .5, release: 1.5, line: .26, soft: .22, smooth: 1, detail: .25, body: .02, heroScale: 2.6, wordScale: 2, wordScalePhone: 1.5, heroGain: 2, wordGain: 3, speed: 1, bloom: .3, wordBloom: .2, bloomCut: 1.7 };   // the first, crisp flash: attack .2, release 1, line .15, soft .1, smooth 0, detail 1, body .07, heroGain 5, bloom .6
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'config');
  main = once(main, '      const dropletMaterial = new THREE.MeshPhysicalMaterial({', `      const FLASH_GLSL = ${JSON.stringify(NOISE)};
      const flashDrop = { uFlash: { value: new THREE.Vector4() }, uFlashColor: { value: new THREE.Color('#6fbcff') }, uFlashSoft: { value: new THREE.Vector4(.1, 0, 1, .07) }, uFlashWater: { value: new THREE.Vector2(1, 1) }, uFlashRim: { value: 0 } };
      const dropletMaterial = new THREE.MeshPhysicalMaterial({`, 'drop uniforms');
  main = once(main, 'Object.assign(shader.uniforms, dropletUniforms, montisEnvUniforms, dropChromeUniforms);', 'Object.assign(shader.uniforms, dropletUniforms, montisEnvUniforms, dropChromeUniforms, flashDrop);', 'drop assign');
  main = once(main, "MONTIS_ENV_GLSL + MONTIS_CHROME_GLSL + DROPLET_PARS + '\\nvoid main() {'", "MONTIS_ENV_GLSL + MONTIS_CHROME_GLSL + DROPLET_PARS + FLASH_GLSL + '\\nvoid main() {'", 'drop pars');
  main = once(main, "'outgoingLight=dropletColour(outgoingLight,dropletNormalWorld);\\n", "'outgoingLight=dropletColour(outgoingLight,dropletNormalWorld);\\nif(uFlash.w>.001){outgoingLight+=flashLight(dropletNormalWorld);float flashR=1.-clamp(dot(dropletNormalWorld,normalize(cameraPosition-rmWorldPosition)),0.,1.);outgoingLight+=mix(uFlashColor,vec3(1.),.45)*flashR*flashR*flashR*flashR*uFlashRim*uFlash.w;}\\n", 'drop light');
  main = once(main, "dropletMaterial.customProgramCacheKey = () => 'codrops-droplet-sdf-v1';", "dropletMaterial.customProgramCacheKey = () => 'codrops-droplet-sdf-v1-flash';", 'drop key');
  main = once(main, '      function frame(manual, fixedDelta) {', `      /* the pulse: a clock that starts when the journey goes down past heroAt or wordAt (not when it arrives there from further on) */
      const flashPulse = { hero: { armed: true, t: -1 }, word: { armed: true, t: -1, wait: -1 }, flame: 0, last: 0, lastP: 0, bloom: 0, cut: 0, cutAt: 1.4, wordNow: 0 };
      function flashEnvelope(F, t) { if (t < 0) return 0; const up = THREE.MathUtils.smoothstep(t, 0, Math.max(.01, F.attack)), down = 1 - THREE.MathUtils.smoothstep(t, F.attack + F.hold, F.attack + F.hold + Math.max(.01, F.release)); return up * down; }
      function updateFlashGlow() {
        const F = CONFIG.flashGlow, now = performance.now() / 1000, dt = Math.min(.1, Math.max(0, now - flashPulse.last)), p = journey.progress;
        flashPulse.last = now; flashPulse.flame += dt * F.speed; flashPulse.bloom = 0; flashPulse.cut = 0;
        const run = (key, at, window, rearm) => {
          const s = flashPulse[key];
          if (F.on > .5 && !reduceMotion && s.armed && p > at && p < at + window) { s.armed = false; s.t = 0; }
          if (p < at - rearm) s.armed = true;
          if (s.t >= 0) { s.t += dt; if (s.t > F.attack + F.hold + F.release) s.t = -1; }
          return flashEnvelope(F, s.t);
        };
        /* follow: while the journey moves down over the drop the clock is held at full light; when it stops the clock runs on through hold and release. Coming back during the
           release jumps to the point of the rise with the same brightness (smoothstep is symmetric), so it never pops. */
        const movedDown = (p - flashPulse.lastP) / Math.max(dt, 1e-3); flashPulse.lastP = p;
        const holdLit = s => { const A = Math.max(.01, F.attack); s.armed = false; if (s.t < 0) s.t = 0; else if (s.t > A + F.hold) s.t = A * Math.max(0, 1 - (s.t - A - F.hold) / Math.max(.01, F.release)); else if (s.t > A) s.t = A; };
        const following = F.follow > .5 && F.on > .5 && !reduceMotion && movedDown > F.followMin;
        if (following && dropRoot.visible && p > F.heroAt) holdLit(flashPulse.hero);
        const hero = run('hero', F.heroAt, .5, .03) * (dropRoot.visible ? 1 : 0);
        /* the word lights when its last letter has landed, not at a point of the scroll: the letters fly in seconds, however fast the page is scrolled (letters.state.landed). If the letters
           never came (their build failed) it goes back to the point of the scroll. It arms again when the visitor has gone back above wordAt and the word has come apart. */
        const W = flashPulse.word, formed = logoLetters.ready ? !!logoLetters.state.landed && logoRoot.visible : p > F.wordAt;
        if (formed && W.armed && F.on > .5 && F.wordOn > .5 && !reduceMotion && logoFlight.t < .2) { W.armed = false; W.wait = F.wordDelay; }
        if (logoFlight.t >= .2 || p > logoChapterEnd() + .5) W.armed = false;   // past it: coming back from further on lights nothing
        if (p < F.wordAt && !formed) { W.armed = true; W.wait = -1; }
        if (W.wait >= 0) { W.wait -= dt; if (W.wait < 0) W.t = 0; }
        if (following && F.wordOn > .5 && formed && W.wait < 0 && logoRoot.visible && logoFlight.t < .2) holdLit(W);
        if (W.t >= 0) { W.t += dt; if (W.t > F.attack + F.hold + F.release) W.t = -1; }
        const word = flashEnvelope(F, W.t) * (logoRoot.visible ? 1 : 0);
        flashDrop.uFlash.value.set(F.line, F.heroScale, flashPulse.flame * .2, hero * F.heroGain); flashDrop.uFlashColor.value.set(F.color); flashDrop.uFlashSoft.value.set(F.soft, F.smooth, F.detail, F.body); logoGlass.uniforms.uFlashSoft.value.copy(flashDrop.uFlashSoft.value); flashDrop.uFlashWater.value.set(F.water, F.bend); flashDrop.uFlashRim.value = F.rim; logoGlass.uniforms.uFlashRim.value = F.wordRim; logoGlass.uniforms.uFlashWater.value.copy(flashDrop.uFlashWater.value);
        logoGlass.uniforms.uFlash.value.set(F.line, mobileRenderBudget.mobile ? F.wordScalePhone : F.wordScale, flashPulse.flame * .2, word * F.wordGain); logoGlass.uniforms.uFlashColor.value.set(F.color);
        const k = Math.max(hero, word);
        flashPulse.bloom = Math.max(hero * F.bloom, word * F.wordBloom); flashPulse.cut = k; flashPulse.cutAt = word > hero ? F.wordBloomCut : F.bloomCut; flashPulse.wordNow = word;
      }
      function frame(manual, fixedDelta) {`, 'driver');
  main = once(main, '        if ((portfolio?.covering || world?.covering) && !manual) { /* covered */ }', `        updateFlashGlow();
        /* the letters' own lock bloom (logoPulse, tied to the scroll around p 3.5): while the word is lit its light takes that place, stacked they blur the letters away */
        if (flashPulse.wordNow > 0) bloom.strength = Math.max(CONFIG.scene.bloom, bloom.strength - logoPulse * flashPulse.wordNow);
        if (flashPulse.cut > 0) { bloom.strength += flashPulse.bloom; bloom.threshold = THREE.MathUtils.lerp(bloom.threshold, flashPulse.cutAt, flashPulse.cut); }
        if ((portfolio?.covering || world?.covering) && !manual) { /* covered */ }`, 'driver call');
  return main;
}
module.exports = state => ({ ...state, main: patchMain(state.main), glass: patchGlass(state.glass), letters: patchLetters(state.letters) });
module.exports.patchMain = patchMain;
