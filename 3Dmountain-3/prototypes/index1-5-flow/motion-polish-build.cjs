'use strict';
/* Flow-only motion housekeeping. The existing motion curves and durations stay
   in their owners; these patches only release idle work and failed transitions. */
function once(source, anchor, replacement, label) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) throw new Error(`flow motion polish (${label}): ${count} anchors; expected 1`);
  return source.replace(anchor, () => replacement);
}

function patchFlow(source) {
  return once(source, '    } finally { busy = false; }', `    } finally {
      // A rejected route must release the same cover that a completed route releases.
      veilCard.classList.remove('is-shown');
      veil.classList.add('is-off'); veil.classList.remove('is-on');
      busy = false;
    }`, 'chapter cover cleanup');
}

function patchButtons(source) {
  source = once(source, '    raf = 0;\n    for (const [b, s] of live) {',
    '    raf = 0;\n    let moving = false;\n    for (const [b, s] of live) {', 'button idle flag');
  source = once(source, "      b.style.translate = s.x.toFixed(2) + 'px calc(' + s.y.toFixed(2) + 'px + var(--motion-y, 0px))';",
    "      moving = moving || !s.on || Math.abs(s.tx - s.x) > .01 || Math.abs(s.ty - s.y) > .01;\n      b.style.translate = s.x.toFixed(2) + 'px calc(' + s.y.toFixed(2) + 'px + var(--motion-y, 0px))';", 'button settling');
  return once(source, '    if (live.size) raf = requestAnimationFrame(step);',
    '    if (moving) raf = requestAnimationFrame(step);   // pointermove / letGo wake the loop again', 'button idle frame');
}

module.exports = { patchFlow, patchButtons };
