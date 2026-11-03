/* 2026-11-03 (客戶：「絲滑捲動套到正式頁」): the world section follows like the journey, through motion-response.js's stepWorldFollow.
   Runs right after motion-polish-build.cjs, which ships motion-response.js and gives the world its one omega. The why: motion-response.js.
   Undo without a rebuild: ?silk=0. Remove: drop this file's name from build.cjs and rebuild (motion-response.js then still steps the journey). */
function once(s, a, b, label) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw Error(`silk scroll anchor (${label}): ${n} matches`);
  return s.replace(a, () => b);
}
function patchWorld(s) {
  if (s.includes('/* SILK_SCROLL */')) return s;
  s = once(s, "import * as THREE from 'three';", "import * as THREE from 'three';\nimport { stepWorldFollow } from './motion-response.js';   /* SILK_SCROLL */", 'world import');
  return once(s,
    '      const omega = ocean ? ocean.omega(y) : 11.5, x = y - yt, decay = Math.exp(-omega * dt), temp = (vy + omega * x) * dt;\n      y = yt + (x + temp) * decay; vy = (vy - omega * temp) * decay;',
    '      [y, vy] = stepWorldFollow(y, yt, vy, ocean ? ocean.omega(y) : 11.5, dt);   /* SILK_SCROLL: the exponential follow (motion-response.js); ?silk=0 = the spring */',
    'world follow');
}
module.exports = state => ({ ...state, extra: { ...state.extra, 'finnovation-world.js': patchWorld(state.extra['finnovation-world.js']) } });
module.exports.patchWorld = patchWorld;
