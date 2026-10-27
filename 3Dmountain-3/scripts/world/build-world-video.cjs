// Builds the background video of the world epilogue's last part from media/logo.mp4:
//   node scripts/world/build-world-video.cjs
// Needs Playwright (set PLAYWRIGHT_CORE to its folder if it is not resolvable) and a local Chrome (CHROME).
// Encoding runs in the browser (WebCodecs H.264 + mp4-muxer), so no ffmpeg is needed.
// Outputs (media/):
//   ocean-loop-720.mp4   1280x720, ~2.4 Mbit/s   (the source is ~29 Mbit/s: 18 MB for 5 s)
//   ocean-loop-480.mp4    854x480, ~1.1 Mbit/s   (small screens)
// Both are seamless loops: the last LOOP seconds are cross-faded into the first, so <video loop> never jumps.
const path = require('node:path'), fs = require('node:fs');
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core';
let chromium; try { ({ chromium } = require(PW)); } catch { ({ chromium } = require('playwright')); }
const root = path.resolve(__dirname, '..', '..');
const SRC = path.join(root, 'media', 'logo.mp4');
const ORIGIN = 'https://world-video.local/';
const LOOP = 1.1;   // seconds of cross-fade at the seam
const OUTPUTS = [
  { name: 'ocean-loop-720.mp4', w: 1280, h: 720, codec: 'avc1.4d401f', bitrate: 2400000 },
  { name: 'ocean-loop-480.mp4', w: 854, h: 480, codec: 'avc1.4d401e', bitrate: 1100000 }
];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    // Same origin for the source video, so its frames can be read back.
    await page.route(ORIGIN + '**', route => route.request().url().endsWith('src.mp4')
      ? route.fulfill({ path: SRC, contentType: 'video/mp4' })
      : route.fulfill({ body: '<!doctype html><title>video</title>', contentType: 'text/html' }));
    await page.goto(ORIGIN);
    const result = await page.evaluate(async ({ outputs, loop }) => {
      const { Muxer, ArrayBufferTarget } = await import('https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm');
      // A blob URL is seekable; the routed file is not (no Range support), and every seek would return the same frame.
      const blob = await (await fetch('src.mp4')).blob();
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = URL.createObjectURL(blob);
      await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('cannot decode the source')); });
      // Frame rate from presented frames while it plays.
      const times = [];
      await new Promise(res => {
        const step = (now, meta) => { times.push(meta.mediaTime); if (times.length < 40) v.requestVideoFrameCallback(step); else { v.pause(); res(); } };
        v.requestVideoFrameCallback(step); v.play();
      });
      const deltas = times.slice(1).map((t, i) => t - times[i]).filter(d => d > 0).sort((a, b) => a - b);
      const sourceFps = Math.round(1 / deltas[Math.floor(deltas.length / 2)]);
      const fps = Math.min(30, sourceFps);
      const L = Math.floor(v.duration * fps), N = Math.round(loop * fps), M = L - N;
      const seek = t => new Promise(res => { v.onseeked = () => res(); v.currentTime = t; });
      const frameAt = async i => { await seek((i + .5) / fps); return createImageBitmap(v); };
      const head = [], tail = [];
      for (let i = 0; i < N; i++) head.push(await frameAt(i));
      for (let i = 0; i < N; i++) tail.push(await frameAt(L - N + i));
      const smooth = x => x * x * (3 - 2 * x);
      const jobs = outputs.map(o => {
        const canvas = new OffscreenCanvas(o.w, o.h), g = canvas.getContext('2d');
        g.imageSmoothingQuality = 'high';
        const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: o.w, height: o.h, frameRate: fps }, fastStart: 'in-memory' });
        let failure = null;
        const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; } });
        encoder.configure({ codec: o.codec, width: o.w, height: o.h, bitrate: o.bitrate, bitrateMode: 'variable', framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } });
        return { o, canvas, g, muxer, encoder, get failure() { return failure; } };
      });
      for (let i = 0; i < M; i++) {
        const frame = i < N ? null : await frameAt(i);
        for (const j of jobs) {
          if (i < N) {
            // The seam: the clip's own tail fades into its head, so frame M-1 runs straight on into frame 0.
            j.g.globalAlpha = 1; j.g.drawImage(tail[i], 0, 0, j.o.w, j.o.h);
            j.g.globalAlpha = smooth(i / N); j.g.drawImage(head[i], 0, 0, j.o.w, j.o.h); j.g.globalAlpha = 1;
          } else j.g.drawImage(frame, 0, 0, j.o.w, j.o.h);
          const vf = new VideoFrame(j.canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
          j.encoder.encode(vf, { keyFrame: i % fps === 0 }); vf.close();
          while (j.encoder.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
        }
        frame?.close();
      }
      const out = {};
      for (const j of jobs) {
        await j.encoder.flush(); if (j.failure) throw j.failure;
        j.muxer.finalize();
        const bytes = new Uint8Array(j.muxer.target.buffer); let s = '';
        for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
        out[j.o.name] = btoa(s);
      }
      return { out, info: { sourceFps, fps, frames: M, seconds: +(M / fps).toFixed(2), source: [v.videoWidth, v.videoHeight, +v.duration.toFixed(2)] } };
    }, { outputs: OUTPUTS, loop: LOOP });
    for (const [name, b64] of Object.entries(result.out)) {
      const buf = Buffer.from(b64, 'base64'); fs.writeFileSync(path.join(root, 'media', name), buf);
      console.log(name.padEnd(20), (buf.length / 1024).toFixed(0).padStart(6), 'KB');
    }
    console.log(JSON.stringify(result.info));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
