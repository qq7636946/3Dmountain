/* Local to index1-5 (2026-10-31). The journey's clock steps on the frame's own vsync timestamp.
   THREE.Clock reads performance.now() wherever frame() happens to start, so dt carries the scheduling jitter of the callback: at a constant
   scroll or a slow drift the motion speeds up and slows down by a few percent from frame to frame (micro-judder). requestAnimationFrame hands
   every callback the same vsync-aligned time, so the steps are even. The world's own loop already works this way.
   clock.getDelta() stays as the fallback: the first frame, after a hidden tab, or manual frames. */
function once(source, anchor, replacement, label) {
  const n = source.split(anchor).length - 1;
  if (n !== 1) throw Error('silky-clock anchor (' + label + '): ' + n);
  return source.replace(anchor, () => replacement);
}
function patchMain(main) {
  if (main.includes('/* SILKY_CLOCK */')) return main;
  main = once(main, '      const clock = new THREE.Clock();', '      const clock = new THREE.Clock();\n      let rafStamp = 0, rafLast = 0;   /* SILKY_CLOCK */', 'clock');
  main = once(main, '        const realDelta = clock.getDelta();', `        const clockDelta = clock.getDelta();
        let realDelta = clockDelta;
        if (!manual && rafStamp > 0) {
          const stepped = rafLast > 0 ? (rafStamp - rafLast) / 1000 : 0;
          rafLast = rafStamp; rafStamp = 0;
          if (stepped > 0 && stepped < .25) realDelta = stepped;
        }`, 'delta');
  return once(main, '      const tick = () => { animationFrame = 0; frame(); };', '      const tick = stamp => { rafStamp = stamp; animationFrame = 0; frame(); };', 'tick');
}
module.exports = state => ({ ...state, main: patchMain(state.main) });
module.exports.patchMain = patchMain;
