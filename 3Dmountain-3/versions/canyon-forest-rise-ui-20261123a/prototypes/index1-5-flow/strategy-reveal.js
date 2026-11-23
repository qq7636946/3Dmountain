/* One tributary at a time. A new gesture advances immediately; sustained
   wheel/key input advances at a reading pace instead of locking forever.
   Decaying momentum and a single touch swipe still reveal just one step. */
export function createStrategyReveal({ journey, blocked = () => false, enabled = () => true,
  clock = () => performance.now(), events = window, initialCount = 0 }) {
  const TOTAL = 4, QUIET = 180, STEP = 280, THRESHOLD = 24;
  const SUSTAIN = 700, KEY_REPEAT = 450, SUSTAIN_DISTANCE = 160;
  let count = Math.max(0, Math.min(TOTAL, Math.floor(initialCount) || 0)), phase = 'idle', gesture = 0, used = -1, lastAt = -Infinity;
  let lastKind = '', lastDirection = 0, distance = 0, steppedAt = -Infinity, quietUntil = 0;
  let touchSerial = 0, touchActive = 0, touchGesture = -1, outside = false, disposed = false;
  let heldAt = 0, peak = 0, lastPixels = 0, strongDistance = 0;
  const near = () => journey.progress >= journey.max - .45;
  const ready = () => journey.progress >= journey.max - .045 && journey.target >= journey.max - .045;
  function reset() {
    count = 0; phase = 'idle'; used = gesture; steppedAt = -Infinity;
    quietUntil = 0; distance = 0; outside = false; peak = lastPixels = strongDistance = 0;
  }
  function hold(now) {
    journey.progress = journey.target = journey.max; journey.velocity = 0;
    phase = 'holding'; used = gesture; quietUntil = now + QUIET;
    heldAt = now; strongDistance = 0;
  }
  function frame() {
    if (disposed || !enabled()) return;
    if (blocked()) { outside = true; return; }
    if (journey.target < journey.max - .06) {
      if (phase !== 'idle') reset(); return;
    }
    if (!near()) { if (phase !== 'idle' || count) reset(); return; }
    if (phase === 'leaving') return;
    if (ready() && (phase === 'idle' || phase === 'arriving' || outside)) {
      hold(clock()); outside = false;
    }
    if (phase === 'arriving' || phase === 'holding') journey.target = journey.max;
  }
  function inputGesture(kind, direction, delta, now) {
    const pixels = Math.abs(delta) * Math.max(720, (globalThis.innerHeight || 900) * .85);
    const freshTouch = kind === 'touch' && touchActive && touchGesture !== touchActive;
    const changed = kind !== lastKind || direction !== lastDirection;
    // A new trackpad stroke can start before the old inertia has fully ended.
    const renewed = kind === 'wheel' && lastKind === kind && lastPixels < peak * .5 && pixels > Math.max(4, lastPixels * 1.5);
    const fresh = kind === 'click' || freshTouch || changed || renewed ||
      (!(kind === 'touch' && touchActive) && now - lastAt > QUIET);
    if (fresh) { gesture++; distance = 0; peak = strongDistance = 0; }
    if (kind === 'touch' && touchActive) touchGesture = touchActive;
    lastAt = now; lastKind = kind; lastDirection = direction;
    distance += pixels;
    peak = Math.max(peak, pixels);
    strongDistance = pixels >= Math.max(1, peak * .75) ? strongDistance + pixels : 0;
    lastPixels = pixels;
    return gesture;
  }
  function take(delta, source) {
    if (disposed || !enabled() || !Number.isFinite(delta) || !delta) return false;
    const direction = Math.sign(delta), kind = source || 'key', now = clock();
    if (blocked()) { inputGesture(kind, direction, delta, now); return false; }
    if (!near()) return false;
    // A reverse bridge can return an unused delta on its animation frame.
    // It belongs to the gesture that brought the visitor back, not a new step.
    if (source === 'carry' && ready()) {
      // A carried remainder is not a physical wheel sample. Keeping the last
      // real magnitude avoids mistaking the next inertia event for a new push.
      lastAt = now; lastDirection = direction;
      if (!lastKind) lastKind = touchActive ? 'touch' : 'wheel';
      hold(now); outside = false; return true;
    }
    if (phase === 'leaving' && direction < 0) return false;
    if (phase === 'released' && direction > 0) return false;
    // A real reverse before reaching the overview stays ordinary journey input.
    if (!ready() && direction < 0) { if (phase === 'arriving') reset(); return false; }
    const token = inputGesture(kind, direction, delta, now);
    if (!ready()) {
      phase = 'arriving'; journey.target = journey.max; used = token; return true;
    }
    if (phase === 'idle' || phase === 'arriving' || outside) {
      hold(now); outside = false;
      if (kind !== 'click') return true;
    }
    const click = kind === 'click';
    const sinceStep = now - Math.max(heldAt, steppedAt);
    const sustained = kind === 'key' ? sinceStep >= KEY_REPEAT :
      kind === 'wheel' && sinceStep >= SUSTAIN && strongDistance >= SUSTAIN_DISTANCE;
    if (!click && (now < quietUntil || now - steppedAt < STEP || (token === used && !sustained) || distance < THRESHOLD)) return true;
    if (click && now - steppedAt < STEP) return true;
    used = token; steppedAt = heldAt = now; distance = strongDistance = 0;
    if (direction > 0 && count === TOTAL) { phase = 'released'; return false; }
    if (direction < 0 && count === 0) { phase = 'leaving'; return false; }
    count += direction; phase = 'holding'; journey.target = journey.max; journey.velocity = 0;
    return true;
  }
  const touchStart = event => { if (event.pointerType === 'touch' && event.isPrimary !== false) touchActive = ++touchSerial; };
  const touchEnd = event => { if (event.pointerType === 'touch') touchActive = 0; };
  const navigate = () => reset();
  const click = event => {
    if (!event.target?.closest?.('.finnovation-ui [data-next], .finnovation-ui .fi-footer-next')) return;
    if (take(.15, 'click')) { event.preventDefault(); event.stopImmediatePropagation(); }
  };
  function dispose() {
    disposed = true;
    events.removeEventListener('pointerdown', touchStart, true);
    events.removeEventListener('pointerup', touchEnd, true);
    events.removeEventListener('pointercancel', touchEnd, true);
    events.removeEventListener('finnovation:navigate', navigate);
    events.removeEventListener('click', click, true);
    events.removeEventListener('finnovation:text-mode', dispose);
  }
  events.addEventListener('pointerdown', touchStart, { passive: true, capture: true });
  events.addEventListener('pointerup', touchEnd, { passive: true, capture: true });
  events.addEventListener('pointercancel', touchEnd, { passive: true, capture: true });
  events.addEventListener('finnovation:navigate', navigate);
  events.addEventListener('click', click, true);
  events.addEventListener('finnovation:text-mode', dispose, { once: true });
  return { frame, take, reset, dispose, visible: index => index >= 0 && index < count,
    get state() { return { count, total: TOTAL, phase, gesture, used, distance, quietUntil }; } };
}
