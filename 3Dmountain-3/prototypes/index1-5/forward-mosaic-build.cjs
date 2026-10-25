/* Local to index1-5 (2026-10-25). Joins a frosted-glass mosaic to the LOGO's forward flight (block 2's 3D word → the valley river):
   forward-mosaic.js runs as its own pass just before the shared motion blur (js/water-forward-transition.js, not touched), on the same
   clock. Live config CONFIG.forwardMosaic; rows in the tuner's 「LOGO 向前轉場」 group. */
const fs = require('fs'), path = require('path');
function patchMain(main) {
  if (main.includes('/* FORWARD_MOSAIC */')) return main;
  const p = (a, b) => { if (main.split(a).length !== 2) throw Error('forward-mosaic anchor ' + a.slice(0, 90)); main = main.replace(a, () => b); };
  p("    import * as THREE from 'three';", "    import * as THREE from 'three';\n    import { createForwardMosaic, FORWARD_MOSAIC_DEFAULTS, FORWARD_MOSAIC_ROWS, BRIDGE_MOSAIC_DEFAULTS, BRIDGE_MOSAIC_ROWS } from './forward-mosaic.js';");
  p('      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* FORWARD_MOSAIC */
      CONFIG.forwardMosaic = { ...FORWARD_MOSAIC_DEFAULTS };
      CONFIG.bridgeMosaic = { ...BRIDGE_MOSAIC_DEFAULTS };
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
  // before the blur (index 2 after the journey blend): the blur then smears the panes' edges
  p('      composer.insertPass(forwardTransition.pass, 2);', `      composer.insertPass(forwardTransition.pass, 2);
      const forwardMosaic = createForwardMosaic({ config: CONFIG.forwardMosaic, renderer });
      composer.insertPass(forwardMosaic.pass, 2);
      const bridgeMosaic = createForwardMosaic({ config: CONFIG.bridgeMosaic, renderer });
      composer.insertPass(bridgeMosaic.pass, 2);`);
  p('          reducedMotion: reduceMotion, enabled: CONFIG.logo.dolly > .5 || journey.mix > 0\n        });', `          reducedMotion: reduceMotion, enabled: CONFIG.logo.dolly > .5 || journey.mix > 0
        });
        forwardMosaic.update({
          progress: logoFlight.t, velocity: journey.velocity, focus: forwardTransition.pass.uniforms.uFocus.value,
          dt: flightDelta, reducedMotion: reduceMotion, enabled: CONFIG.logo.dolly > .5
        });`);
  p("            ['推進視角', 'forwardTransition', 'fov', 0, 24, 1]\n          ]],", "            ['推進視角', 'forwardTransition', 'fov', 0, 24, 1],\n            ...FORWARD_MOSAIC_ROWS\n          ]],");
  p('get world() { return world; }, canyonMotion,', 'get world() { return world; }, canyonMotion, forwardMosaic, bridgeMosaic,');
  // FOUR PATHS → cards (2026-10-25): the bridge's own progress and rate (no shared blur there: the panes carry their own)
  p('      const bridgeGround = new THREE.Color(), bridgeForward = new THREE.Vector3();',
    '      const bridgeGround = new THREE.Color(), bridgeForward = new THREE.Vector3(), bridgeFocus = new THREE.Vector2(.5, .46);');
  p('        if (worldEpilogue && portfolio?.bridge && !reduceMotion) applyBridgeView(portfolio.transition);', `        if (worldEpilogue && portfolio?.bridge && !reduceMotion) applyBridgeView(portfolio.transition);
        bridgeMosaic.update({
          progress: worldEpilogue && portfolio?.bridge ? portfolio.transition || 0 : 0, velocity: null, speedScale: .6, shape: [.03, .3, .55, .4],
          focus: bridgeFocus, dt: flightDelta, reducedMotion: reduceMotion
        });`);
  p("            ['山谷退場', 'mist', 'veil', .1, 1, .01], ['光流加速', 'watershedFlow', 'surge', 0, 3, .05]\n          ]],",
    "            ['山谷退場', 'mist', 'veil', .1, 1, .01], ['光流加速', 'watershedFlow', 'surge', 0, 3, .05],\n            ...BRIDGE_MOSAIC_ROWS\n          ]],");
  return main;
}
module.exports = ({ main, drops, letters, glass, html }) => ({ main: patchMain(main), drops, letters, glass, html, extra: { 'forward-mosaic.js': fs.readFileSync(path.join(__dirname, 'forward-mosaic.js'), 'utf8') } });
module.exports.patchMain = patchMain;
