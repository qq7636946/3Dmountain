/** Lazy, self-contained worker. A failed/unsupported worker uses the identical geometry algorithm. */
export function createLogoGeometryBuilder(THREE, {
  workerUrl = new URL('./water-logo-geometry-worker.bundle.js?v=index463-scroll-20261004-78fa788ddc', import.meta.url),
  workerFactory = url => new Worker(url),
  timeoutMs = 30000,
  onFallback = null,
  preload = false
} = {}) {
  let worker = null, unavailable = false, disposed = false, nextId = 0;
  let helperPromise = null, fallbackPromise = null, activeEntry = null, queuedEntry = null;
  const pending = new Map();
  const abortError = (message = 'Logo geometry builder disposed.') => Object.assign(new Error(message), { name: 'AbortError' });
  const helpers = () => helperPromise ||= import('./water-logo-geometry.js?v=index463-scroll-20261004-78fa788ddc');
  const disposeResult = result => { result?.geometry.dispose(); result?.edgeGeometry.dispose(); };
  function settle(entry, error, result) {
    if (pending.get(entry.id) !== entry) { disposeResult(result); return; }
    pending.delete(entry.id); clearTimeout(entry.timer);
    if (activeEntry === entry) activeEntry = null;
    if (queuedEntry === entry) queuedEntry = null;
    if (error) entry.reject(error); else entry.resolve(result);
    pump();
  }
  async function fallback(entry, reason) {
    if (disposed || pending.get(entry.id) !== entry || entry.state === 'fallback') return;
    entry.state = 'fallback'; clearTimeout(entry.timer);
    try {
      try { onFallback?.(reason); } catch { /* Diagnostics must not block the fallback. */ }
      const [helper, utils] = await (fallbackPromise ||= Promise.all([helpers(), import('three/addons/utils/BufferGeometryUtils.js')]));
      if (disposed || pending.get(entry.id) !== entry) return;
      settle(entry, null, helper.buildLogoGeometry(THREE, utils, entry.input));
    } catch (error) { settle(entry, error); }
  }
  function disableWorker(reason) {
    unavailable = true; worker?.terminate(); worker = null;
    if (activeEntry?.state === 'worker') fallback(activeEntry, reason);
  }
  function ensureWorker() {
    if (worker) return worker;
    worker = workerFactory(workerUrl);
    worker.onmessage = async ({ data }) => {
      const entry = pending.get(data?.id);
      if (!entry || entry.state !== 'worker') return;
      clearTimeout(entry.timer);
      if (!data.ok) {
        const error = Object.assign(new Error(data.error?.message || 'Logo worker build failed.'), { name: data.error?.name || 'Error' });
        fallback(entry, error); return;
      }
      entry.state = 'unpack';
      try {
        const helper = await helpers();
        if (disposed || pending.get(entry.id) !== entry) return;
        settle(entry, null, helper.unpackLogoGeometry(THREE, data.result));
      } catch (error) { settle(entry, error); }
    };
    worker.onerror = event => { event.preventDefault?.(); disableWorker(new Error(event.message || 'Logo worker could not start.')); };
    worker.onmessageerror = () => disableWorker(new Error('Logo worker response could not be decoded.'));
    return worker;
  }
  function pump() {
    if (disposed || activeEntry || !queuedEntry) return;
    const entry = activeEntry = queuedEntry;
    queuedEntry = null; entry.state = 'worker';
    if (unavailable) { fallback(entry, new Error('Logo worker unavailable.')); return; }
    try {
      const active = ensureWorker();
      entry.timer = setTimeout(() => disableWorker(new Error('Logo worker build timed out.')), timeoutMs);
      active.postMessage({ id: entry.id, input: entry.input });
    } catch (error) { disableWorker(error); }
  }
  function build({ shapes, blueShapes = [], wordmark = false, config }) {
    if (disposed) return Promise.reject(abortError());
    let input;
    try {
      input = { shapes: shapes.map(shape => shape.toJSON()), blueShapes: blueShapes.map(shape => shape.toJSON()), wordmark: Boolean(wordmark),
        config: Object.fromEntries(['depth', 'curveSegments', 'bevel', 'bevelSize', 'bevelSegments'].map(key => [key, config[key]])) };
    } catch (error) { return Promise.reject(error); }
    return new Promise((resolve, reject) => {
      // Let the current build finish, but keep only the newest slider/variant request behind it.
      if (queuedEntry) settle(queuedEntry, abortError('Logo geometry request superseded.'));
      const entry = { id: ++nextId, input, resolve, reject, timer: null, state: 'queued' };
      pending.set(entry.id, entry); queuedEntry = entry; pump();
    });
  }
  function dispose() {
    if (disposed) return;
    disposed = true; worker?.terminate(); worker = null;
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(abortError()); }
    pending.clear(); activeEntry = queuedEntry = null;
  }
  if (preload) {
    // Start critical code together; keep the original promise for build/fallback errors.
    try { ensureWorker(); } catch (error) { disableWorker(error); }
    void helpers().catch(() => {});
  }
  return { build, dispose };
}
