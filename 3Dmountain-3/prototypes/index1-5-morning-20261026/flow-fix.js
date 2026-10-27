/* index1-5 · flow-fix runtime (prototypes/index1-5-morning-20261026/flow-fix-build.cjs) — ONE small module the patched pieces share.
   FLOW.on is false with ?flowfix=0: every behaviour this helper adds then falls back to the code that was there before it, so
   "does it come from flow-fix?" is answered by loading the page both ways. Nothing here draws or changes how anything looks. */
const search = typeof location === 'undefined' ? '' : location.search;
export const FLOW = {
  on: !/[?&]flowfix=(0|false|off|no)(&|$)/i.test(search),
  /* patches the build could not place (their anchor moved in a file another session edits) — listed so it is visible at run time */
  skipped: /*FLOW_SKIPPED*/[]/*/FLOW_SKIPPED*/,
  log: []
};
if (typeof globalThis !== 'undefined') globalThis.__FLOWFIX__ = FLOW;

/* a performance mark + a line in FLOW.log (read by scripts/index1-5/flow-trace.cjs) */
export function mark(name, info) {
  try { performance.mark('ff:' + name); } catch { /* old browsers */ }
  if (FLOW.log.length < 400) FLOW.log.push([name, Math.round(performance.now()), info ?? null]);
}

/* a free moment: requestIdleCallback with a time-out (a visitor who never pauses still gets it), else a timer */
export const idleSlot = (timeout = 250) => new Promise(resolve => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout }); else setTimeout(resolve, 32);
});

/* the start of the next task (after the current frame's work), not another frame later */
export const nextTask = () => new Promise(resolve => {
  if (typeof MessageChannel === 'function') { const c = new MessageChannel(); c.port1.onmessage = () => { c.port1.close(); resolve(); }; c.port2.postMessage(0); }
  else setTimeout(resolve, 0);
});

/* runs a generator in slices: each slice runs steps until BUDGET ms are used, then waits for a free moment.
   Resolves with the generator's return value; rejects with its error. STOP() true → drops it (returns undefined). */
export function runSliced(gen, { budget = 6, timeout = 250, stop = () => false, name = '' } = {}) {
  return new Promise((resolve, reject) => {
    const slice = () => {
      if (stop()) { resolve(undefined); return; }
      const t0 = performance.now();
      try {
        let r;
        do { r = gen.next(); } while (!r.done && performance.now() - t0 < budget);
        if (r.done) { if (name) mark(name + ' done'); resolve(r.value); return; }
      } catch (error) { reject(error); return; }
      idleSlot(timeout).then(slice);
    };
    idleSlot(timeout).then(slice);
  });
}
