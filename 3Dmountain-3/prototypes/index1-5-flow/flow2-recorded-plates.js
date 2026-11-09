const DATA = {
  wide: {
    width: 1280, height: 720, sky: [1368, 2448, 6140.0375, 7904],
    tags: [[223.8, 342.2], [390.2, 219.8, 134, 50, 190.9, 126.4], [769, 349.4], [947, 212.6, 86.5, 50, 86.5, 190.3]]
  },
  phone: {
    width: 390, height: 844, sky: [1603.596875, 2869.59375, 7258.12, 9293],
    tags: [[35.5, 268.2, 103.2, 46, 103.2, 106], [230.5, 268.2, 20, 46, -79.9, 143.4],
      [23, 399, 129, 0, 233.7, 3.7], [230.5, 399]]
  }
};
const FPS = { hero: 16, journey: 20, sea: 12, news: 16, globe: 12, sky: 16 };
const NAMES = ['AI 量化交易', '上市櫃投資', '未上市及 Pre-IPO', '衍生性商品'];
const base = new URL('./assets/flow2-recorded/', import.meta.url);
const url = name => new URL(name, base).href;
const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

export function mountRecordedPlates(phone, motion) {
  const page = document.documentElement;
  const element = document.createElement('div');
  element.id = 'flow2-recorded-frame';
  element.setAttribute('aria-hidden', 'true');
  document.getElementById('gl').after(element);

  const layer = document.createElement('div');
  layer.className = 'alp-labels';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  const tags = NAMES.map((name, index) => {
    const node = document.createElement('div');
    node.className = 'alp-pin';
    node.dataset.kind = 'tag'; node.dataset.layout = 'glass'; node.dataset.side = 'up';
    node.innerHTML = '<span class="alp-tag"><span class="alp-tag-index" aria-hidden="true">0' + (index + 1) +
      '</span><span class="alp-tag-text"><span class="alp-tag-zh">' + name + '</span></span></span>' +
      '<svg class="alp-glass-leader" aria-hidden="true"><path/><circle r="1.75"/></svg>';
    layer.append(node);
    return node;
  });
  document.body.append(layer);

  const recordings = new Map();
  const variant = () => phone.matches ? 'phone' : 'wide';
  const poster = (v, scene) => url(v + '-' + (scene === 'journey' ? 'hero' : scene) + '.jpg');
  const still = (v, step) => url(v + '-tributary-00' + step + '.jpg');
  let active, activeStill, step = -1, playback = false;
  let recordedSize = '';

  function syncPlayback() {
    if (!active) return;
    if (playback && !motion.matches && !document.hidden) active.video.play().catch(() => {});
    else active.video.pause();
  }
  function seek(recording) {
    const { video, target, fps } = recording;
    if (!Number.isFinite(target) || !Number.isFinite(video.duration) || video.seeking || recording !== active) return;
    // Land near the middle of the selected frame, including the final frame.
    const end = Math.max(0, video.duration - .5 / fps);
    const time = clamp((video.duration - 1 / fps) * target + .5 / fps, 0, end);
    if (Math.abs(video.currentTime - time) > .49 / fps) video.currentTime = time;
  }

  function load(scene, v, preload = 'auto') {
    const key = v + '-' + scene;
    if (recordings.has(key)) return recordings.get(key);
    const video = document.createElement('video');
    video.muted = true; video.defaultMuted = true;
    video.playsInline = true;
    video.preload = preload;
    video.hidden = true;
    video.poster = poster(v, scene);
    video.src = url(key + '.mp4');
    const recording = { video, fps: FPS[scene], target: NaN };
    video.addEventListener('loadedmetadata', () => seek(recording));
    video.addEventListener('seeked', () => seek(recording));
    element.append(video); recordings.set(key, recording);
    return recording;
  }

  function show(scene, progress = 0, loop = false) {
    const next = load(scene, variant());
    const changed = next !== active || playback !== loop;
    if (active !== next) {
      if (active) { active.video.pause(); active.video.hidden = true; }
      active = next; active.video.preload = 'auto'; active.video.hidden = false;
      element.style.backgroundImage = 'url("' + active.video.poster + '")';
    }
    active.video.loop = loop;
    active.target = loop && !motion.matches ? NaN : clamp(progress);
    if (step !== -1) { layer.hidden = true; step = -1; activeStill = ''; }
    playback = loop;
    if (page.dataset.flow2Shot !== scene) page.dataset.flow2Shot = scene;
    seek(active);
    if (changed) syncPlayback();
  }

  function placeTags(v) {
    const meta = DATA[v];
    const scale = Math.max(innerWidth / meta.width, innerHeight / meta.height);
    for (const [index, node] of tags.entries()) {
      const [left, top, sx, sy, ax, ay] = meta.tags[index];
      const x = clamp((innerWidth - meta.width * scale) * .5 + left * scale, 14, Math.max(14, innerWidth - node.offsetWidth - 14));
      const y = (innerHeight - meta.height * scale) * .5 + top * scale;
      node.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)';
      const svg = node.querySelector('svg');
      svg.style.opacity = Number.isFinite(ax) ? '1' : '0';
      if (!Number.isFinite(ax)) continue;
      const dx = ax * scale, dy = ay * scale, bend = sy + (dy - sy) * .55;
      svg.querySelector('path').setAttribute('d', 'M' + sx + ' ' + sy + ' C' + sx + ' ' + bend + ',' + dx + ' ' + bend + ',' + dx + ' ' + dy);
      svg.querySelector('circle').setAttribute('cx', dx);
      svg.querySelector('circle').setAttribute('cy', dy);
    }
  }

  function showTributary(value) {
    const v = variant(), key = v + '/' + innerWidth + '/' + innerHeight;
    const current = clamp(value, 0, 4);
    const src = still(v, current);
    if (active) { active.video.pause(); active.video.hidden = true; active = null; }
    if (activeStill !== src) { element.style.backgroundImage = 'url("' + src + '")'; activeStill = src; }
    page.dataset.flow2Shot = 'tributary';
    if (step === current && recordedSize === key) return;
    layer.hidden = false;
    tags.forEach((node, index) => {
      node.classList.toggle('is-visible', index < current);
      node.classList.toggle('is-step-current', index === current - 1);
      node.style.opacity = index < current ? '1' : '0';
    });
    if (recordedSize !== key || step === -1) placeTags(v);
    recordedSize = key; step = current;
  }

  function skyProgress(value, stops) {
    const meta = DATA[variant()].sky;
    const i = value <= stops[1] ? 0 : value <= stops[2] ? 1 : 2;
    const t = clamp((value - stops[i]) / Math.max(1, stops[i + 1] - stops[i]));
    return clamp((meta[i] + t * (meta[i + 1] - meta[i]) - meta[0]) / (meta[3] - meta[0]));
  }

  function onMotion() {
    if (active && playback) active.target = motion.matches ? 0 : NaN;
    if (active) seek(active);
    syncPlayback();
  }
  motion.addEventListener('change', onMotion);
  document.addEventListener('visibilitychange', syncPlayback);
  async function prepare() {
    const v = variant(), image = new Image();
    image.src = poster(v, 'hero');
    element.style.backgroundImage = 'url("' + image.src + '")';
    load('hero', v);
    await Promise.race([image.decode().catch(() => {}), new Promise(resolve => setTimeout(resolve, 2000))]);
  }
  const prefetched = new Set();
  function preloadTributaries() {
    const v = variant();
    if (prefetched.has(v)) return;
    prefetched.add(v);
    for (let index = 0; index <= 4; index++) { const image = new Image(); image.src = still(v, index); }
  }

  return {
    element, show, showTributary, skyProgress, prepare, preloadTributaries,
    dispose() {
      for (const { video } of recordings.values()) { video.pause(); video.removeAttribute('src'); video.load(); }
      element.remove(); layer.remove();
      motion.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', syncPlayback);
    }
  };
}
