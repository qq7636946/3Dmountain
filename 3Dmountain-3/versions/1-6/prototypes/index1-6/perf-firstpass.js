/* index1-6 · firstpass (2026-10-26). The scheduling the first-pass preparation shares. Nothing here draws, and nothing here changes
   what a frame draws: it only decides WHEN a preparation runs. Shipped by perf-firstpass-build.cjs as the local module perf-firstpass.js.
   idleSlot()       resolves at the next free moment of the main thread (never later than `timeout` ms: a visitor who never pauses still gets it).
   runSliced(gen)   runs a generator in slices of about `budget` ms, one slice per free moment, and resolves with its return value.
                    A generator yields between its expensive statements; running it to the end in one go is the original code.
   decodedFirst(t)  decodes a texture's image off the main thread (img.decode()), so the GPU upload that follows is not a decode.
   uploadSoon(r, t) uploads one texture in a free moment, after it has been decoded, and only while `live()` is still true. If the frame
                    needs it before that, three uploads it there, exactly as before. */
export function idleSlot(timeout = 200) {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout });
    else setTimeout(resolve, 16);
  });
}

export function runSliced(gen, budget = 6, timeout = 200) {
  return new Promise((resolve, reject) => {
    const slice = () => {
      const t0 = performance.now();
      try {
        let r;
        do { r = gen.next(); } while (!r.done && performance.now() - t0 < budget);
        if (r.done) resolve(r.value);
        else idleSlot(timeout).then(slice);
      } catch (error) { reject(error); }
    };
    idleSlot(timeout).then(slice);
  });
}

export function decodedFirst(texture) {
  const image = texture && texture.image;
  if (!image || typeof image.decode !== 'function') return Promise.resolve(texture);
  return image.decode().then(() => texture, () => texture);
}

export function uploadSoon(renderer, texture, live = () => true) {
  return decodedFirst(texture).then(() => idleSlot()).then(() => {
    if (!renderer || !renderer.initTexture || !live()) return;
    try { renderer.initTexture(texture); } catch { /* the frame uploads it as before */ }
  });
}
