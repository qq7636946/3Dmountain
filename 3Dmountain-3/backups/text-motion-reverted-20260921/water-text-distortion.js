import * as THREE from 'three';

const TARGETS = '.hero-title, .hero-sub, .story-line > span, .story-zh';
const clamp = THREE.MathUtils.clamp;
const vertexShader = /* glsl */`
  uniform vec2 uSize, uDirection;
  uniform float uTime, uAmplitude, uFrequency, uSpeed, uFlow;
  varying vec2 vUv, vScreen;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.xy *= uSize;
    float axis = dot(uv - .5, uDirection);
    float phase = axis * uFrequency * 6.283185 - uTime * uSpeed;
    float wave = sin(phase) * .76 + sin(phase * 1.73 + uv.y * 2.7) * .24;
    // Real geometry bending; the glyph texture itself remains sharp.
    p.y += wave * uAmplitude * uFlow;
    p.x += sin(phase + 1.15) * uAmplitude * .18;
    p.z += sin(phase - .7) * uAmplitude * .6;
    vec4 world = modelMatrix * vec4(p, 1.);
    vScreen = world.xy;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const fragmentShader = /* glsl */`
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform vec4 uClip;
  varying vec2 vUv, vScreen;
  void main() {
    if (vScreen.x < uClip.x || vScreen.y < uClip.y ||
        vScreen.x > uClip.z || vScreen.y > uClip.w) discard;
    vec4 ink = texture2D(uMap, vUv);
    if (ink.a < .002) discard;
    gl_FragColor = vec4(ink.rgb, ink.a * uOpacity);
    #include <colorspace_fragment>
  }
`;

/** DOM remains the semantic/layout source. GPU glyphs are an optional enhancement. */
export function createTextDistortion(options = {}) {
  const controls = { enabled: 1, amplitude: .24, frequency: 2.15, speed: 1.8, direction: 18, settle: .65, scrollGain: .8, ...options };
  const state = { mode: 'loading', reason: '', maxAmplitude: 0, activeCount: 0, textureBuilds: 0, renderCount: 0 };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const sources = [...document.querySelectorAll(TARGETS)];
  const items = [];
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, innerWidth, innerHeight, 0, -1000, 1000);
  const geometry = new THREE.PlaneGeometry(1, 1, 48, 32);
  const canvas = document.createElement('canvas');
  canvas.id = 'webgl-text';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.setAttribute('role', 'presentation');
  canvas.tabIndex = -1;
  canvas.style.cssText = 'position:fixed;inset:0;z-index:5;width:100%;height:100%;pointer-events:none;display:none;';
  const style = document.createElement('style');
  style.textContent = `
    .webgl-text-source { color:transparent!important; -webkit-text-fill-color:transparent!important; text-shadow:none!important; }
    .webgl-text-source::selection { color:white!important; -webkit-text-fill-color:white!important; background:#34628a99; }
    @media(prefers-reduced-motion:reduce) {
      #webgl-text { display:none!important; }
      .webgl-text-source { color:var(--webgl-text-color)!important; -webkit-text-fill-color:var(--webgl-text-color)!important; text-shadow:var(--webgl-text-shadow)!important; }
    }
    @media print { #webgl-text { display:none!important; } .webgl-text-source { color:var(--webgl-text-color)!important; -webkit-text-fill-color:var(--webgl-text-color)!important; text-shadow:none!important; } }
  `;
  document.head.append(style);
  // Appended after the story scrim, but below loader / cue / tuning controls.
  document.body.append(canvas);
  let renderer = null, disposed = false, dirty = true, contextLost = false, booting = null;
  let pulseAmount = 0, flow = 1, width = 0, height = 0, pixelRatio = 0;
  let lastRenderSignature = '';
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const lowEnd = () => {
    const memory = navigator.deviceMemory, cores = navigator.hardwareConcurrency;
    return navigator.connection?.saveData || (memory && memory <= 2) || (cores && cores <= 2) ||
      (memory && memory <= 4 && cores && cores <= 4 && matchMedia('(pointer:coarse)').matches);
  };
  function unavailable() {
    if (disposed) return 'disposed';
    if (reduced.matches) return 'reduced-motion';
    if (lowEnd()) return 'low-end-device';
    if (new URLSearchParams(location.search).get('textFx') === 'off' || controls.enabled < .5) return 'disabled';
    if (contextLost) return 'context-lost';
    return '';
  }
  function showDOM(reason) {
    for (const source of sources) source.classList.remove('webgl-text-source');
    canvas.style.display = 'none';
    lastRenderSignature = '';
    state.mode = 'dom'; state.reason = reason; state.maxAmplitude = 0; state.activeCount = 0;
    for (const item of items) { item.amount = 0; item.lastOpacity = 0; item.mesh.visible = false; }
  }
  const observer = new ResizeObserver(() => { dirty = true; });
  sources.forEach(source => observer.observe(source));
  function resize() { dirty = true; }
  const fontsChanged = () => { dirty = true; };
  document.fonts?.addEventListener('loadingdone', fontsChanged);
  reduced.addEventListener('change', () => { if (reduced.matches) showDOM('reduced-motion'); else initialise(); });
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); contextLost = true; showDOM('context-lost'); });
  canvas.addEventListener('webglcontextrestored', () => { contextLost = false; dirty = true; initialise(); });

  // Read actual browser line breaks, alignment, text-indent and letter spacing.
  // No duplicate DOM, approximate line-wrapping, or per-frame texture uploads.
  function captureLines(element, bounds) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const range = document.createRange(), lines = [];
    let node;
    while ((node = walker.nextNode())) {
      let cursor = 0;
      const segments = segmenter ? segmenter.segment(node.textContent) : Array.from(node.textContent, segment => ({ segment }));
      for (const part of segments) {
        const index = part.index ?? cursor, text = part.segment; cursor = index + text.length;
        range.setStart(node, index); range.setEnd(node, cursor);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height || text === '\n') continue;
        const y = rect.top - bounds.top;
        let line = lines.find(candidate => Math.abs(candidate.y - y) < 1);
        if (!line) { line = { text: '', x: rect.left - bounds.left, y, height: rect.height }; lines.push(line); }
        line.text += text;
      }
    }
    return lines;
  }
  function paint(item) {
    const element = item.element;
    element.classList.remove('webgl-text-source');
    const css = getComputedStyle(element), rect = element.getBoundingClientRect();
    const fontSize = parseFloat(css.fontSize);
    if (!rect.width || !rect.height) { item.ready = false; return; }
    element.style.setProperty('--webgl-text-color', css.color);
    element.style.setProperty('--webgl-text-shadow', css.textShadow);
    const padding = Math.ceil(fontSize * .65 + 8);
    const w = rect.width + padding * 2, h = rect.height + padding * 2;
    const scale = Math.min(pixelRatio, renderer.capabilities.maxTextureSize / w, renderer.capabilities.maxTextureSize / h);
    const bitmap = document.createElement('canvas');
    bitmap.width = Math.ceil(w * scale); bitmap.height = Math.ceil(h * scale);
    const ctx = bitmap.getContext('2d');
    if (!ctx) throw Error('Canvas text unavailable');
    ctx.scale(scale, scale);
    ctx.font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = css.color;
    const spacing = parseFloat(css.letterSpacing) || 0;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
    const shadows = [...css.textShadow.matchAll(/(rgba?\([^)]+\)|#[\da-f]+)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/gi)];
    const lines = captureLines(element, rect);
    for (const line of lines) {
      const metrics = ctx.measureText(line.text);
      const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
      const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
      const baseline = padding + line.y + (line.height - ascent - descent) / 2 + ascent;
      const drawLine = shift => {
        if ('letterSpacing' in ctx || !spacing) ctx.fillText(line.text, padding + line.x + shift, baseline);
        else {
          let x = padding + line.x + shift;
          for (const glyph of Array.from(line.text)) { ctx.fillText(glyph, x, baseline); x += ctx.measureText(glyph).width + spacing; }
        }
      };
      // Cast each CSS shadow back from off-canvas, then paint the glyph ONCE.
      // Repainting the glyph for every shadow thickens antialiased letter edges.
      for (const shadow of [...shadows].reverse()) {
        ctx.shadowColor = shadow[1]; ctx.shadowOffsetX = (+shadow[2] + 10000) * scale;
        ctx.shadowOffsetY = +shadow[3] * scale; ctx.shadowBlur = +shadow[4] * scale;
        drawLine(-10000);
      }
      ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = ctx.shadowOffsetY = ctx.shadowBlur = 0;
      drawLine(0);
    }
    const texture = new THREE.CanvasTexture(bitmap);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false; texture.minFilter = THREE.LinearFilter;
    item.texture?.dispose(); item.texture = texture;
    item.mesh.material.uniforms.uMap.value = texture;
    item.mesh.material.uniforms.uSize.value.set(w, h);
    Object.assign(item, { fontSize, padding, width: rect.width, height: rect.height, ready: true, lines: lines.length });
    state.textureBuilds++;
  }
  async function initialise() {
    const reason = unavailable();
    if (reason) { showDOM(reason); return false; }
    if (booting) return booting;
    state.mode = 'loading';
    booting = (async () => {
      try {
        await document.fonts?.ready;
        if (unavailable()) { showDOM(unavailable()); return false; }
        if (!renderer) {
          renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
          renderer.outputColorSpace = THREE.SRGBColorSpace;
          renderer.setClearColor(0, 0);
          renderer.debug.onShaderError = () => { showDOM('shader-error'); contextLost = true; };
          for (const element of sources) {
            const material = new THREE.ShaderMaterial({
              vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
              uniforms: { uMap: { value: null }, uSize: { value: new THREE.Vector2() }, uDirection: { value: new THREE.Vector2(1, 0) },
                uTime: { value: 0 }, uAmplitude: { value: 0 }, uFrequency: { value: 2 }, uSpeed: { value: 1 }, uFlow: { value: 1 },
                uOpacity: { value: 0 }, uClip: { value: new THREE.Vector4() } }
            });
            const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; mesh.visible = false; scene.add(mesh);
            items.push({ element, mesh, card: element.closest('.story-card'), mask: element.closest('.story-line'), ready: false, amount: 0, lastOpacity: 0, opacity: 0, amplitude: 0 });
          }
        }
        dirty = true; state.mode = 'webgl'; state.reason = '';
        return true;
      } catch (error) { showDOM('initialization-failed'); console.warn('Text enhancement unavailable; keeping HTML text.', error); return false; }
      finally { booting = null; }
    })();
    return booting;
  }
  function configure(values = {}) {
    const limits = { enabled: [0, 1], amplitude: [0, .6], frequency: [.3, 8], speed: [0, 6], direction: [-90, 90], settle: [.15, 2], scrollGain: [.1, 3] };
    for (const key of Object.keys(limits)) if (Number.isFinite(values[key])) controls[key] = clamp(values[key], ...limits[key]);
    const reason = unavailable();
    if (reason) showDOM(reason);
    else if (state.mode === 'dom' && !contextLost) initialise();
  }
  function update({ dt = 1 / 60, time = 0, velocity = 0 } = {}) {
    if (state.mode !== 'webgl' || !renderer || disposed) return;
    const reason = unavailable(); if (reason) { showDOM(reason); return; }
    if (document.hidden) return;
    dt = clamp(dt, .001, .1);
    try {
      const nextRatio = Math.min(devicePixelRatio || 1, 2);
      if (width !== innerWidth || height !== innerHeight || pixelRatio !== nextRatio) {
        width = innerWidth; height = innerHeight; pixelRatio = nextRatio;
        renderer.setPixelRatio(pixelRatio); renderer.setSize(width, height, false);
        camera.right = width; camera.top = height; camera.updateProjectionMatrix(); dirty = true;
      }
      if (dirty) { items.forEach(paint); dirty = false; }
      const cssCache = new Map();
      const cssFor = node => { if (!cssCache.has(node)) cssCache.set(node, getComputedStyle(node)); return cssCache.get(node); };
      const opacityOf = element => {
        let alpha = 1;
        for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
          const css = cssFor(node);
          if (css.visibility === 'hidden' || css.display === 'none') return 0;
          alpha *= Number(css.opacity);
          if (alpha < .001) return 0;
        }
        return alpha;
      };
      const force = clamp(Math.abs(velocity) * controls.scrollGain, 0, 1);
      if (Math.abs(velocity) > .02) flow += (Math.sign(velocity) - flow) * (1 - Math.exp(-dt * 7));
      pulseAmount *= Math.exp(-dt * 7);
      const angle = controls.direction * Math.PI / 180;
      state.maxAmplitude = 0; state.activeCount = 0;
      const signatureParts = [width, height, pixelRatio, state.textureBuilds];
      for (const item of items) {
        if (!item.ready) continue;
        const { element, mesh, card, mask } = item;
        const opacity = card && !card.classList.contains('is-active') ? 0 : opacityOf(element);
        const entryForce = clamp(Math.abs(opacity - item.lastOpacity) / dt * .19, 0, .8);
        item.lastOpacity = opacity; item.opacity = opacity;
        mesh.visible = opacity > .001;
        if (!mesh.visible) { item.amount = 0; item.amplitude = 0; continue; }
        const rect = element.getBoundingClientRect();
        if (Math.abs(rect.width - item.width) > .5 || Math.abs(rect.height - item.height) > .5) { paint(item); }
        const desired = Math.max(force, entryForce, pulseAmount);
        const tau = desired > item.amount ? .07 : controls.settle / 3;
        item.amount += (desired - item.amount) * (1 - Math.exp(-dt / tau));
        if (desired < .0001 && item.amount < .0008) item.amount = 0;
        item.amplitude = item.fontSize * controls.amplitude * item.amount;
        mesh.position.set(rect.left + rect.width / 2, height - rect.top - rect.height / 2, 0);
        const u = mesh.material.uniforms;
        u.uTime.value = time; u.uAmplitude.value = item.amplitude; u.uOpacity.value = opacity;
        u.uFrequency.value = controls.frequency; u.uSpeed.value = controls.speed; u.uFlow.value = flow;
        u.uDirection.value.set(Math.cos(angle), Math.sin(angle));
        u.uClip.value.set(-100, -100, width + 100, height + 100);
        if (mask) {
          const bounds = mask.getBoundingClientRect(), css = cssFor(card);
          const entry = parseFloat(css.getPropertyValue('--entry')) || 0, exit = parseFloat(css.getPropertyValue('--exit')) || 0;
          const reveal = clamp((entry - .8) * 5, 0, 1) * (1 - clamp(exit * 5, 0, 1));
          const pad = item.padding * reveal;
          u.uClip.value.set(bounds.left - pad, height - bounds.bottom - pad, bounds.right + pad, height - bounds.top + pad);
        }
        item.rect = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
        signatureParts.push(element.textContent, ...[rect.left, rect.top, opacity, ...u.uClip.value.toArray()].map(value => value.toFixed(3)));
        state.maxAmplitude = Math.max(state.maxAmplitude, item.amplitude); state.activeCount++;
      }
      if (state.maxAmplitude > .0001) signatureParts.push(time, controls.frequency, controls.speed, controls.direction);
      const signature = signatureParts.join('|');
      if (signature !== lastRenderSignature) { renderer.render(scene, camera); state.renderCount++; lastRenderSignature = signature; }
      // Never suppress native glyphs until the first successful render.
      if (state.mode === 'webgl') {
        canvas.style.display = state.activeCount ? 'block' : 'none';
        for (const item of items) if (item.ready) item.element.classList.add('webgl-text-source');
      }
    } catch (error) { showDOM('render-failed'); console.warn('Text renderer recovered to HTML.', error); }
  }
  function inspect() {
    return items.map(item => ({ text: item.element.textContent, rect: item.rect, planeRect: item.rect && {
      x: item.mesh.position.x - item.width / 2, y: height - item.mesh.position.y - item.height / 2, width: item.width, height: item.height
    }, opacity: item.opacity, amplitude: item.amplitude, visible: item.mesh.visible, lines: item.lines }));
  }
  function dispose() {
    disposed = true; showDOM('disposed'); observer.disconnect();
    document.fonts?.removeEventListener('loadingdone', fontsChanged);
    for (const item of items) { item.texture?.dispose(); item.mesh.material.dispose(); }
    geometry.dispose(); renderer?.dispose(); canvas.remove(); style.remove();
  }
  const ready = initialise();
  return { ready, state, controls, update, resize, configure, inspect, dispose, pulse: (strength = 1) => { pulseAmount = clamp(strength, 0, 1); }, get renderer() { return renderer; } };
}
