/* Local to index1-5 (2026-11-01). As the visitor scrolls down from the hero the droplet briefly lights up, and so does the 3D word when it has formed: the blue-white burn of the closing
   LOGO (world-logo-ember.js), without the holes. A timed pulse: it plays once on the way down past a point of the journey, and arms again when the visitor has gone back up past it.
   The light goes above the scene's bloom threshold, and the bloom is opened for the length of the pulse. Dials: CONFIG.flashGlow (LOGO panel). */
const NOISE = `
uniform vec4 uFlash; uniform vec3 uFlashColor;   // edge line, noise scale, its clock, gain
float flashTri(float x) { return abs(fract(x) - .5); }
vec3 flashTri3(vec3 p) { return vec3(flashTri(p.z + flashTri(p.y)), flashTri(p.z + flashTri(p.x)), flashTri(p.y + flashTri(p.x))); }
float flashNoise(vec3 p, float t) {
  float z = 1.4, rz = 0.; vec3 bp = p;
  for (int i = 0; i < 4; i++) { vec3 dg = flashTri3(bp * 2.); p += dg + t; bp *= 1.8; z *= 1.5; p *= 1.2; rz += flashTri(p.z + flashTri(p.x + flashTri(p.y))) / z; bp += .14; }
  return rz;
}
vec3 flashLight(vec3 p) {
  float n = flashNoise(p * uFlash.y, uFlash.z);
  float edge = 1. - smoothstep(0., .1, abs(n - uFlash.x));
  return uFlashColor * (edge * uFlash.w + uFlash.w * .07);
}`;
const once = (source, anchor, replacement, label) => {
  if (source.split(anchor).length !== 2) throw Error('flash-glow anchor (' + label + '): ' + (source.split(anchor).length - 1));
  return source.replace(anchor, () => replacement);
};
function patchGlass(glass) {
  if (glass.includes('/* FLASH_GLOW */')) return glass;
  glass = once(glass, 'uLiquidTime:{value:0},uLiquidAmount:{value:1},', "/* FLASH_GLOW */uFlash:{value:new THREE.Vector4()},uFlashColor:{value:new THREE.Color('#6fbcff')},\n    uLiquidTime:{value:0},uLiquidAmount:{value:1},", 'glass uniforms');
  glass = once(glass, '      uniform sampler2D uBackdrop,uSpectrum,uNormalMap;', NOISE + '\n      uniform sampler2D uBackdrop,uSpectrum,uNormalMap;', 'glass pars');
  glass = once(glass, '        gl_FragColor=vec4(color,uOpacity);', '        if(uFlash.w>.001)color+=flashLight(vObj);\n        gl_FragColor=vec4(color,uOpacity);', 'glass end');
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
      CONFIG.flashGlow = { on: 0, color: '#6fbcff', heroAt: .08, wordAt: 2.95, wordDelay: 0, attack: .2, hold: .5, release: 1, line: .15, heroScale: 1.7, wordScale: 1, wordScalePhone: 1, heroGain: 5, wordGain: 5, speed: 1, bloom: .6, wordBloom: .6, bloomCut: 1.4 };
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'config');
  main = once(main, '      const dropletMaterial = new THREE.MeshPhysicalMaterial({', `      const FLASH_GLSL = ${JSON.stringify(NOISE)};
      const flashDrop = { uFlash: { value: new THREE.Vector4() }, uFlashColor: { value: new THREE.Color('#6fbcff') } };
      const dropletMaterial = new THREE.MeshPhysicalMaterial({`, 'drop uniforms');
  main = once(main, 'Object.assign(shader.uniforms, dropletUniforms, montisEnvUniforms, dropChromeUniforms);', 'Object.assign(shader.uniforms, dropletUniforms, montisEnvUniforms, dropChromeUniforms, flashDrop);', 'drop assign');
  main = once(main, "MONTIS_ENV_GLSL + MONTIS_CHROME_GLSL + DROPLET_PARS + '\\nvoid main() {'", "MONTIS_ENV_GLSL + MONTIS_CHROME_GLSL + DROPLET_PARS + FLASH_GLSL + '\\nvoid main() {'", 'drop pars');
  main = once(main, "'outgoingLight=dropletColour(outgoingLight,dropletNormalWorld);\\n", "'outgoingLight=dropletColour(outgoingLight,dropletNormalWorld);\\nif(uFlash.w>.001)outgoingLight+=flashLight(dropletNormalWorld);\\n", 'drop light');
  main = once(main, "dropletMaterial.customProgramCacheKey = () => 'codrops-droplet-sdf-v1';", "dropletMaterial.customProgramCacheKey = () => 'codrops-droplet-sdf-v1-flash';", 'drop key');
  main = once(main, '      function frame(manual, fixedDelta) {', `      /* the pulse: a clock that starts when the journey goes down past heroAt or wordAt (not when it arrives there from further on) */
      const flashPulse = { hero: { armed: true, t: -1 }, word: { armed: true, t: -1, wait: -1 }, flame: 0, last: 0, bloom: 0, cut: 0 };
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
        const hero = run('hero', F.heroAt, .5, .03);
        /* the word lights when its last letter has landed, not at a point of the scroll: the letters fly in seconds, however fast the page is scrolled (letters.state.landed). If the letters
           never came (their build failed) it goes back to the point of the scroll. It arms again when the visitor has gone back above wordAt and the word has come apart. */
        const W = flashPulse.word, formed = logoLetters.ready ? !!logoLetters.state.landed && logoRoot.visible : p > F.wordAt;
        if (formed && W.armed && F.on > .5 && !reduceMotion && logoFlight.t < .2) { W.armed = false; W.wait = F.wordDelay; }
        if (logoFlight.t >= .2 || p > logoChapterEnd() + .5) W.armed = false;   // past it: coming back from further on lights nothing
        if (p < F.wordAt && !formed) { W.armed = true; W.wait = -1; }
        if (W.wait >= 0) { W.wait -= dt; if (W.wait < 0) W.t = 0; }
        if (W.t >= 0) { W.t += dt; if (W.t > F.attack + F.hold + F.release) W.t = -1; }
        const word = flashEnvelope(F, W.t);
        flashDrop.uFlash.value.set(F.line, F.heroScale, flashPulse.flame * .2, hero * F.heroGain); flashDrop.uFlashColor.value.set(F.color);
        logoGlass.uniforms.uFlash.value.set(F.line, mobileRenderBudget.mobile ? F.wordScalePhone : F.wordScale, flashPulse.flame * .2, word * F.wordGain); logoGlass.uniforms.uFlashColor.value.set(F.color);
        const k = Math.max(hero, word);
        flashPulse.bloom = Math.max(hero * F.bloom, word * F.wordBloom); flashPulse.cut = k;
      }
      function frame(manual, fixedDelta) {`, 'driver');
  main = once(main, '        if ((portfolio?.covering || world?.covering) && !manual) { /* covered */ }', `        updateFlashGlow();
        if (flashPulse.cut > 0) { bloom.strength += flashPulse.bloom; bloom.threshold = THREE.MathUtils.lerp(bloom.threshold, CONFIG.flashGlow.bloomCut, flashPulse.cut); }
        if ((portfolio?.covering || world?.covering) && !manual) { /* covered */ }`, 'driver call');
  return main;
}
module.exports = state => ({ ...state, main: patchMain(state.main), glass: patchGlass(state.glass), letters: patchLetters(state.letters) });
module.exports.patchMain = patchMain;
