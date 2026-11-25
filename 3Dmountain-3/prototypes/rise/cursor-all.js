/* cursor-all.js — 2026-11-25, client: 「全站統一 游標webgl 液體這個特效」.
   The canyon's cursor (js/finnovation-cursor.js: a refractive wake + fine rings behind the pointer) on every picture of the -ui page:
     · main canvas (#gl): the canyon keeps its own pass where it was; while the view from above shows, that same pass is moved to just
       after the view's pass (flow2-forest-atlas.js), which used to cover it — and back again when the view lets go;
     · the opening under water (#xs-gl, drop-gorge/dg-scene.js) and the WHY sea (.fiw-canvas, finnovation-world.js) draw on their own
       contexts: each gets its own cursor. After that canvas has drawn its frame, the frame is copied to a texture and drawn back through
       the cursor pass (only while the wake lives; otherwise nothing but a cheap check). The copy is display-referred, so the pass decodes
       sRGB → linear, adds the wake's light, encodes again, and keeps the canvas's own alpha.
   Only on the -ui page (html[data-rise-ui]); ?cursorAll=0 = as before. Dials: the canyon's CONFIG.cursor (shared, read every frame).
   Live state: window.__CURSOR_ALL__ */
import * as THREE from 'three';
import { createFinnovationCursor } from '../../js/finnovation-cursor.js?v=index463-scroll-20261004-78fa788ddc';

const html = document.documentElement, Q = new URLSearchParams(location.search);
const S = window.__CURSOR_ALL__ = { on: false, gl: 'waiting', layers: {} };
const study = () => window.__MONTIS_STUDY__;
const blocked = () => !!study()?.journeyUI?.menuOpen;

if (html.hasAttribute('data-rise-ui') && Q.get('cursorAll') !== '0') {
  S.on = true;
  seatMain();
  overlay('opening', () => window.__RISE__?.scene?.()?.renderer);
  overlay('sea', () => window.__GL_RENDERERS__?.get('fiw'));
}

/* ---- main canvas: the cursor pass rides after the view from above while that view shows ---- */
function seatMain() {
  let composer = null, home = null;
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const before = host.attach;
  host.attach = function (h = {}) {
    try { return before?.call(this, h); }
    finally { if (h.composer && h.composer !== composer) { composer = h.composer; wrap(composer); } }
  };
  function wrap(c) {
    const render = c.render;
    c.render = function (...args) { try { seat(c); } catch (error) { S.glError = String(error?.message || error); } return render.apply(this, args); };
    S.gl = 'attached';
  }
  function seat(c) {
    const cur = study()?.sceneCursor?.pass, P = c.passes;
    if (!cur) return;
    const i = P.indexOf(cur); if (i < 0) return;
    if (!home) home = P[i - 1] || null;   /* the pass the canyon's cursor follows at first sight (the journey blend) */
    const view = P.find(p => p !== cur && p.uniforms?.tHeld && p.uniforms?.uWeight && p.uniforms?.uBrush && !p.uniforms?.uCell);
    const over = !!view && view.enabled !== false && +view.uniforms.uWeight.value > 0;
    /* after the lift cut when there is one: the view's own seat() puts the view right before that cut every canyon update, so a cursor
       placed between them would be moved back and forth each frame; after the cut it stays put (and also rides over the brush stroke) */
    const cut = over ? P.find(p => p !== cur && p.uniforms?.tHeld && p.uniforms?.uCell) : null;
    const after = over ? (cut && P.indexOf(cut) > P.indexOf(view) ? cut : view) : (home && P.includes(home) ? home : null);
    const want = after ? P.indexOf(after) + 1 : 2;
    if (P[want] === cur || (!after && i === 2)) { S.gl = over ? 'after view' : 'home'; return; }
    P.splice(i, 1);
    P.splice(after ? P.indexOf(after) + 1 : Math.min(2, P.length), 0, cur);
    S.gl = over ? 'after view' : 'home'; S.glMoves = (S.glMoves || 0) + 1;
  }
}

/* ---- own canvases: copy the finished frame, draw it back through a cursor pass ---- */
function overlay(name, getRenderer) {
  const L = S.layers[name] = { renderer: false, frames: 0, drawn: 0, active: false };
  const config = {};
  let renderer = null, cursor = null, tex = null, queued = false, inside = false, last = 0, vw = innerWidth, vh = innerHeight;
  const size = new THREE.Vector2();
  const look = setInterval(() => { const r = getRenderer(); if (r && r !== renderer) attach(r); }, 500);
  addEventListener('resize', () => { if (cursor && (innerWidth !== vw || innerHeight !== vh)) { vw = innerWidth; vh = innerHeight; cursor.resize(vw, vh); } }, { passive: true });

  function attach(r) {
    if (renderer) return;   /* one per section: the module keeps its renderer for the page's life */
    clearInterval(look);
    renderer = r; L.renderer = true;
    Object.assign(config, study()?.CONFIG?.cursor || {});
    cursor = createFinnovationCursor({ renderer: r, config, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, isBlocked: blocked });
    patch(cursor.pass);
    cursor.pass.renderToScreen = true;
    const render = r.render;
    r.render = function (scene, camera) {
      const out = render.call(this, scene, camera);
      if (!inside && !queued && this.getRenderTarget() === null) { queued = true; queueMicrotask(finish); }
      return out;
    };
  }
  /* after the canvas's last draw of this frame (a microtask: the frame's own code has run, the picture is not shown yet) */
  function finish() {
    queued = false;
    const now = performance.now(), dt = last ? Math.min(.05, Math.max(0, (now - last) / 1000)) : 1 / 60; last = now;
    const shared = study()?.CONFIG?.cursor; if (shared) Object.assign(config, shared);
    inside = true; L.frames++;
    try {
      cursor.update(dt, now / 1000);
      L.active = cursor.active;
      if (!cursor.active) return;
      renderer.getDrawingBufferSize(size);
      const w = Math.max(1, size.x | 0), h = Math.max(1, size.y | 0);
      if (!tex || tex.image.width !== w || tex.image.height !== h) {
        tex?.dispose();
        tex = new THREE.FramebufferTexture(w, h);
        tex.minFilter = tex.magFilter = THREE.LinearFilter;
      }
      renderer.setRenderTarget(null);
      renderer.copyFramebufferToTexture(tex);
      cursor.pass.render(renderer, null, { texture: tex });
      L.drawn++;
    } catch (error) { L.error = String(error?.message || error); }
    finally { inside = false; }
  }
}

/* the pass reads a display-referred copy: decode, add the wake's light in linear, encode; keep the canvas's alpha (premultiplied) */
function patch(pass) {
  const m = pass.material;
  pass.uniforms.uDecode = m.uniforms.uDecode = { value: 1 };
  let f = m.fragmentShader.replace(/texture2D\(tDiffuse,/g, 'txD(');
  f = f.replace('void main(){', `uniform float uDecode;
      vec4 txD(vec2 uv){vec4 c=texture2D(tDiffuse,uv);if(uDecode>.5)c.rgb=mix(c.rgb/12.92,pow((c.rgb+.055)/1.055,vec3(2.4)),step(.04045,c.rgb));return c;}
      vec3 encS(vec3 c){c=max(c,0.);return uDecode>.5?mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c)):c;}
      void main(){`);
  f = f.replace('gl_FragColor=vec4(color,1.);', 'float aA=txD(clamp(vUv+offset,vec2(.001),vec2(.999))).a;gl_FragColor=vec4(min(encS(color),vec3(aA)),aA);');
  if (!/txD\(clamp\(vUv\+offset/.test(f)) throw new Error('cursor-all: pass shader changed');
  m.fragmentShader = f; m.needsUpdate = true;
}
