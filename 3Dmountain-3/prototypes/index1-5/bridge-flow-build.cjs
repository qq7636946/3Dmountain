/* Local to index1-5 (2026-11-03, client: 「山要切換到卡牌時候會卡住」). The FOUR PATHS → cards bridge (portfolio-epilogue-polish.js).
   Measured with a steady wheel: the picture stood still for 1–1.5 s while the wheel kept turning, the camera easing to a stop at the
   journey's end and then the bridge setting off from rest. Two causes, two changes; the bridge's length (mist.steps), its look and its
   reversal are as they were.
   1. The bridge followed its wheel target with a critically damped spring from rest: in its first 0.4 s it moved less than a tenth.
      Now it follows the way the journey does since silk-scroll (exponential, λ = omega × 7.2 / 11.5, the same settling time):
      it moves from the first frame.
   2. The notch that carried the journey over its end was clamped there and the bridge waited for the next notch. Now that notch starts
      the bridge with what is left of it, and the journey still takes its own part.
   3. (main.js) The globe's preparation waits while the bridge runs, but its gate asked for the bridge to have moved (transition > 0): on the
      frame the bridge opened it was still 0, and the preparation took that frame (190–275 ms of idle work on a phone at CPU ×4, exactly at
      the hand-over). Now an open bridge holds it from its first frame; it still runs in the bridge's last tenth and whenever the wheel rests.
   Runs right after motion-polish-build.cjs, which makes the local copy. Undo: drop this name from build.cjs. */
const once = (s, a, b, label) => { const n = s.split(a).length - 1; if (n !== 1) throw Error('bridge-flow anchor (' + label + '): ' + n); return s.replace(a, () => b); };
function patchPortfolio(s) {
  if (s.includes('/* BRIDGE_FLOW */')) return s;
  s = once(s, '      const offset = amount - target, j = (velocity + omega * offset) * dt, decay = Math.exp(-omega * dt);\n      amount = Math.max(0, Math.min(1, target + (offset + j) * decay)); velocity = (velocity - omega * j) * decay;',
    `      /* BRIDGE_FLOW: the bridge moves from its first frame (exponential follow, as the journey does); the cards' own open/close keeps its spring */
      if (bridge) { const before = amount; amount = Math.max(0, Math.min(1, amount + (target - amount) * (1 - Math.exp(-omega * 7.2 / 11.5 * dt)))); velocity = dt > 0 ? (amount - before) / dt : 0; }
      else {
      const offset = amount - target, j = (velocity + omega * offset) * dt, decay = Math.exp(-omega * dt);
      amount = Math.max(0, Math.min(1, target + (offset + j) * decay)); velocity = (velocity - omega * j) * decay;
      }`, 'follow');
  s = once(s, '      const s = state(), atEnd = s.progress > s.max - .45 && s.target > s.max - .001;\n      if (!atEnd || delta <= 0) return false;',
    `      const s = state(), atEnd = s.progress > s.max - .45 && s.target > s.max - .001;
      /* BRIDGE_FLOW: the notch that carries the journey over its end starts the bridge with what is left of it (the journey takes its own part: false) */
      if (!atEnd && delta > 0 && prepared && s.progress > s.max - .45 && s.target + delta > s.max + .001) { beginBridge(); bt = Math.min(1, (s.target + delta - s.max) / span()); run(); return false; }
      if (!atEnd || delta <= 0) return false;`, 'crossing');
  return s;
}
function patchMain(s) {
  if (s.includes('/* BRIDGE_FLOW_MAIN */')) return s;
  return once(s, "busy: () => !!portfolio?.open && portfolio.transition > 0 && portfolio.transition < .9 && performance.now() - (journey.lastInput || 0) < 1400 });",
    "busy: () => /* BRIDGE_FLOW_MAIN */ !!portfolio?.open && portfolio.transition < .9 && performance.now() - (journey.lastInput || 0) < 1400 });", 'world busy');
}
module.exports = state => ({ ...state, main: patchMain(state.main), extra: { ...state.extra, 'portfolio-epilogue-polish.js': patchPortfolio(state.extra['portfolio-epilogue-polish.js']) } });
module.exports.patchPortfolio = patchPortfolio; module.exports.patchMain = patchMain;
