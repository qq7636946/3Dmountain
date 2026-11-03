/* The page's side of the terrain workers (terrain-worker.js). Started as soon as the page's settings are final (main.js, right after the
   saved landscape is applied), they compute the terrain grid's rows while this thread builds the drop, the sea, the letters and the rest;
   when the scene builder reaches the grid it takes their rows (water-canyon-watershed-463.js, TERRAIN_WORKER) instead of computing them.
   Safety: the builder only takes rows whose settings key matches the one it is building with, from every worker, of the right size;
   anything else (no module workers, an error, a timeout, settings changed in between, ?terrainworker=0) and it computes them itself, as
   before. Either way the terrain is the same, bit for bit; the workers only change which thread does the work and when.
   State for QA: window.__TERRAIN_BAKE__ (state, used, why, ms). */
export function startTerrainWorkers({ options, alpine, key }) {
  let settle;
  const TB = globalThis.__TERRAIN_BAKE__ = { mode: 'import', state: 'pending', parts: [], key, used: null, why: '', ms: {}, promise: new Promise(r => { settle = r; }) };
  const done = state => { if (TB.state !== 'pending') return; TB.state = state; settle(); };
  if (new URLSearchParams(location.search).get('terrainworker') === '0' || typeof Worker !== 'function') { TB.why = 'off'; done('off'); return TB; }
  // one core is left for the page; each worker also runs the builder's set-up (~.5 s), so past ~6 the shares stop paying (11-03 timings)
  const cores = navigator.hardwareConcurrency || 2, k = Math.max(1, Math.min(options.lite ? 3 : 6, cores - 1));
  const workers = [], t0 = performance.now();
  TB.mark = name => { TB.ms['page ' + name] = Math.round(performance.now() - t0); };   // when the page's builder reached the grid (QA)
  const fail = why => { if (TB.state !== 'pending') return; TB.why = why; for (const w of workers) w.terminate(); done('failed'); };
  TB.check = current => { if (current !== key) fail('the terrain settings changed after the workers started'); };
  let data;
  try { data = JSON.parse(JSON.stringify({ options, alpine })); } catch (e) { fail('settings not plain data: ' + e.message); return TB; }
  const url = new URL('./terrain-worker.js' + new URL(import.meta.url).search, import.meta.url);
  for (let j = 0; j < k; j++) {
    let w;
    try { w = new Worker(url, { type: 'module' }); } catch (e) { fail('no module worker: ' + e.message); return TB; }
    workers.push(w);
    w.onmessage = ({ data: m }) => {
      w.terminate();
      if (!m?.ok) { fail(m?.error || 'worker failed'); return; }
      TB.parts.push(m.part); TB.ms[j] = { at: Math.round(performance.now() - t0), ...m.part.timing };
      if (TB.parts.length === k) { TB.parts.sort((a, b) => a.r0 - b.r0); done('ready'); }
    };
    w.onerror = e => { e.preventDefault?.(); fail('worker error: ' + (e.message || 'it did not load')); };
    w.postMessage({ ...data, split: [j, k], view: { innerWidth, innerHeight, devicePixelRatio } });
  }
  setTimeout(() => fail('timeout'), 180000);
  return TB;
}
