/* Flow2 · scope (lead, 2026-11-15). index1-5-canyon-forest.html only: the sea / globe epilogue (finnovation-world.js) is not part of this page —
   its import is mapped here (the page's import map), so the engine never builds the world while the visitor flies the canyon (it cost 30–80 ms
   frames there). An inert world: never ready, never open; every call does nothing. */
export function mountWorld() {
  return {
    open: false, seaLeg: false, covering: false, leg: '', scope: 'canyon-forest',
    ready: new Promise(() => { }),
    enter() { }, close() { }, take() { return false; }, scrollTo() { }, dispose() { }, targetOf() { return null; }, next() { }
  };
}
