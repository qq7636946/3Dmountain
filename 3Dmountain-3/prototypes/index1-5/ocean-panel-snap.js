/* Mobile reading alignment, after input ends. The globe/dive/tail stay free. */
export function nearestOceanStop(position, stops, direction = 0) {
  if (!Number.isFinite(position) || stops.length < 2 || stops.some(stop => !Number.isFinite(stop))) return null;
  if (position < stops[0] || position > stops[stops.length - 1]) return null;
  let nearest = stops[0], distance = Math.abs(position - nearest);
  for (let i = 1; i < stops.length; i++) {
    const next = Math.abs(position - stops[i]);
    if (next < distance || (next === distance && direction > 0)) { nearest = stops[i]; distance = next; }
  }
  return nearest;
}

export function createOceanPanelSnap({ enabled, getPosition, getStops, moveTo, delay = 180, timers = globalThis }) {
  let timer = null, pending = false, touching = false, direction = 0;
  const clearTimer = () => { if (timer !== null) timers.clearTimeout(timer); timer = null; };
  function cancel() { clearTimer(); pending = touching = false; }
  function settle() {
    timer = null;
    if (!pending || !enabled()) { pending = false; return; }
    pending = false;
    const position = getPosition(), stop = nearestOceanStop(position, getStops(), direction);
    if (stop !== null && Math.abs(stop - position) > .5) moveTo(stop);
  }
  function input(delta, source) {
    clearTimer();
    direction = Math.sign(delta) || direction;
    pending = enabled() && nearestOceanStop(getPosition(), getStops(), direction) !== null;
    touching = source === 'touch';
    if (pending && !touching) timer = timers.setTimeout(settle, delay);
  }
  function finish() {
    if (!pending || !touching) return;
    touching = false; clearTimer(); timer = timers.setTimeout(settle, delay);
  }
  return { input, finish, cancel };
}
