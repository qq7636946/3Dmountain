/* Local to index1-5 (2026-11-01). Ships light-shafts.js and puts it on the journey's two flashes: two passes in the composer round the bloom (the source before it, so it is the flash itself and not its
   halo; the shafts after it, so they are not bloomed into a haze), switched on only for the length of a pulse. Centre and source window follow the object every frame, in screen space, read from where it stands in this frame's camera.
   Runs right after flash-glow-build.cjs: it needs flashPulse and flashEnvelope. Dials: CONFIG.lightShafts (LOGO panel). */
const fs = require('fs'), path = require('path');
const once = (source, anchor, replacement, label) => {
  if (source.split(anchor).length !== 2) throw Error('light-shafts anchor (' + label + '): ' + (source.split(anchor).length - 1));
  return source.replace(anchor, () => replacement);
};
function patchMain(main) {
  if (main.includes('/* LIGHT_SHAFTS */')) return main;
  main = once(main, "    import * as THREE from 'three';", "    import * as THREE from 'three';\n    import { createLightShafts, LIGHT_SHAFT_DEFAULTS } from './light-shafts.js';", 'import');
  main = once(main, '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* LIGHT_SHAFTS */
      CONFIG.lightShafts = { ...LIGHT_SHAFT_DEFAULTS };
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`, 'config');
  main = once(main, '      composer.insertPass(bridgeMosaic.pass, 2);', `      composer.insertPass(bridgeMosaic.pass, 2);
      const lightShafts = createLightShafts({ renderer, getConfig: () => CONFIG.lightShafts, small: mobileRenderBudget.mobile });
      composer.insertPass(lightShafts.sourcePass, composer.passes.indexOf(bloom));
      composer.insertPass(lightShafts.pass, composer.passes.indexOf(bloom) + 1);
      if (CONFIG.lightShafts.on > .5 && !reduceMotion && !(mobileRenderBudget.mobile && !(CONFIG.lightShafts.phone > .5))) lightShafts.warm();`, 'pass');
  main = once(main, '      function frame(manual, fixedDelta) {', `      /* where the shafts come from, this frame: nothing here runs past the first line unless a pulse is lit */
      const shaftAim = { center: new THREE.Vector2(), object: new THREE.Vector2(), win: new THREE.Vector2(), at: new THREE.Vector3(), box: new THREE.Box3(), min: new THREE.Vector2(), max: new THREE.Vector2(), dim: 0, last: 0 };
      function updateLightShafts() {
        const S = CONFIG.lightShafts, F = CONFIG.flashGlow;
        const heroUp = flashPulse.hero.t >= 0 && dropRoot.visible ? flashEnvelope(F, flashPulse.hero.t) : 0, wordUp = flashPulse.word.t >= 0 && logoRoot.visible ? flashEnvelope(F, flashPulse.word.t) : 0, hero = heroUp * S.hero, word = wordUp * S.word;
        const amount = S.on > .5 && !reduceMotion && (!mobileRenderBudget.mobile || S.phone > .5) ? Math.max(hero, word) : 0;
        /* the dip follows the pulse, but is never let go faster than dimOut: what it asks for now, or what is left of it. A few multiplications at rest */
        const now = performance.now() / 1000, A = shaftAim, dipAsked = amount > .002 ? (hero >= word ? heroUp * S.heroDim : wordUp * S.wordDim) : 0;
        A.dim = dipAsked >= A.dim ? dipAsked : Math.max(dipAsked, A.dim - Math.min(.1, now - A.last) / Math.max(.01, S.dimOut)); A.last = now;
        if (!(amount > .002) && !(A.dim > .002)) { lightShafts.aim({ amount: 0 }); return; }
        /* lengths are in screen heights of a landscape window; a tall narrow one would have them run far past its sides, so they shrink with it */
        const aspect = innerWidth / Math.max(1, innerHeight), unit = THREE.MathUtils.clamp(aspect / 1.1, .45, 1), gain = amount * (mobileRenderBudget.mobile ? S.phoneStrength * (word > hero ? S.wordPhone : 1) : 1);
        if (hero >= word) {
          /* the drop: its middle, and its radius on screen, in screen heights */
          dropRoot.getWorldPosition(A.at);
          const dist = Math.max(.1, A.at.distanceTo(camera.position)), radius = currentDropRadius() * Math.max(dropRoot.scale.x, dropRoot.scale.y, dropRoot.scale.z) / Math.max(.01, CONFIG.drop.scale);
          const rH = radius / (2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov * .5)));
          A.at.project(camera);
          A.center.set(A.at.x * .5 + .5, A.at.y * .5 + .5); A.win.set(rH / aspect, rH);
          lightShafts.aim({ amount: gain, center: A.center, win: A.win, length: S.heroLength * unit, core: S.heroCore, aspect, dim: A.dim, edge: S.heroEdge });
        } else {
          /* the word: the rectangle of the wordmark as this camera sees it */
          const g = logoMesh?.geometry;
          if (g) {
            if (!g.boundingBox) g.computeBoundingBox();
            const b = g.boundingBox; A.min.set(9, 9); A.max.set(-9, -9);
            for (let i = 0; i < 8; i++) {
              A.at.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(logoMesh.matrixWorld).project(camera);
              A.min.min(A.at); A.max.max(A.at);
            }
            A.center.set((A.min.x + A.max.x) * .25 + .5, (A.min.y + A.max.y) * .25 + .5); A.win.set((A.max.x - A.min.x) * .25, (A.max.y - A.min.y) * .25);
          } else { A.center.set(logoFlight.cx, logoFlight.cy); A.win.set(.25, .1); }
          A.object.copy(A.center); A.center.y -= S.wordDrop * unit;
          lightShafts.aim({ amount: gain, center: A.center, at: A.object, win: A.win, length: S.wordLength * unit * (mobileRenderBudget.mobile ? S.wordPhoneLength : 1), core: S.wordCore, aspect, dim: A.dim, edge: S.wordEdge, lines: S.wordLines });
        }
      }
      function frame(manual, fixedDelta) {`, 'driver');
  main = once(main, '        if ((portfolio?.covering || world?.covering) && !manual) { /* covered */ }', `        updateLightShafts();
        if ((portfolio?.covering || world?.covering) && !manual) { /* covered */ }`, 'driver call');
  main = once(main, 'canyonMotion, forwardMosaic, bridgeMosaic,', 'canyonMotion, forwardMosaic, bridgeMosaic, lightShafts, flashPulse,', 'study');
  return main;
}
module.exports = state => ({ ...state, main: patchMain(state.main), extra: { 'light-shafts.js': fs.readFileSync(path.join(__dirname, 'light-shafts.js'), 'utf8') } });
module.exports.patchMain = patchMain;
