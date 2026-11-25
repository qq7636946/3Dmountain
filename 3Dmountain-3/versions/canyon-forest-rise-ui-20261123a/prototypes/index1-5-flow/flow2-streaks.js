/* Flow2 · speed streaks (2026-11-14). index1-5-flow2.html.
   Client: 「往前滾幫我加入這種放射狀」 with two frames of mirages.nrly.fun: while the view moves forward, thin bright streaks fly
   outwards from the vanishing point — short dashes near the centre, long needles towards the edges, a trace of prism at their ends.

   What it does: only while the visitor scrolls FORWARD through the valley. The faster the scroll, the more and the longer the
   streaks; at rest there is nothing on the picture at all. Scrolling back shows none. Off under "reduce motion".
   It is this page's own drawing of that kind of effect (a field of points flying past the lens, drawn as tapered needles), not
   the reference's code.

   How: ~70 instanced quads drawn by one small extra pass right after the page's main render pass, into the same buffer (so the
   page's own finishing passes treat them like the rest of the picture). Everything is computed in the vertex shader from the
   distance travelled; no per-frame buffers. Hooks: window.__FLOW2_FINE_JOURNEY__.attach / .canyon, both chained; main.js is
   not edited. ?streaks=0 leaves it out; ?streaksAmt=0..2 strength; ?streaksTest=0..1 shows them at a fixed speed (for looking).
   Live: window.__FLOW2_STREAKS__.tune / .state. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('streaks') === '0') return;
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const T = {
    enabled: true,                  // master on/off switch in 「放射光線 參數（R）」
    amount: num('streaksAmt', 1),   // brightness of all of it
    count: 70,                      // how many points fly (about a third are on screen at once)
    speedOn: .05,                   // scroll speed (journey units per second) where they begin to show
    speedFull: .55,                 // … and where they are at full strength
    length: 1,                      // needle length for a given speed
    flow: 1.6,                      // how fast the field flies past for a given scroll
    width: 1.25,                    // needle width, CSS pixels at 930 px of height
    centre: [0, .1],                // where they come from (−1…1 across, −1…1 up)
    color: '#f4f8ff',
    prism: .32,                     // the trace of colour at the two ends (0 = plain white)
    low: .6,                        // strength over the lower half of the picture (the water under the titles)
    out: [9.5, 10.3],               // journey positions over which they leave (the lift-off)
    test: num('streaksTest', NaN)   // a fixed speed 0…1 for looking at them without scrolling
  };
  const S = { stage: 'waiting' };
  window.__FLOW2_STREAKS__ = { tune: T, state: S };
  /* the client's sliders (flow2-panel.js): every value below is read each frame */
  window.__FLOW2_PANEL__?.add({ id: 'streaks', title: '放射光線', key: 'r', tune: T, rows: [
    ['顯示放射光線', 'enabled', 'checkbox'],
    ['預覽（不用捲動）', 'test', 0, 1, .01, 'off0'],
    ['亮度', 'amount', 0, 2.5, .01], ['長度', 'length', 0, 3, .01], ['粗細', 'width', .4, 4, .05], ['飛過去的速度', 'flow', .2, 5, .05],
    ['— 什麼時候出現 —'],
    ['開始出現的速度', 'speedOn', 0, .5, .01], ['最強的速度', 'speedFull', .1, 2, .01],
    ['— 位置與顏色 —'],
    ['中心 左右', 'centre.0', -1, 1, .01], ['中心 上下', 'centre.1', -1, 1, .01], ['下半部強度', 'low', 0, 1, .01],
    ['顏色', 'color', 'color'], ['兩端色散', 'prism', 0, 1, .01]
  ] });

  let THREE = null, renderer = null, composer = null, canyon = null, lite = false, started = false;
  let pass = null, mainPass = null, scene = null, camera = null, material = null, lastP = null, lastT = 0, speed = 0, travel = 0;
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)'); } catch (error) { return { matches: false }; } })();
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const attachBefore = host.attach, canyonBefore = host.canyon;
  host.attach = function (handles = {}) {
    try { return attachBefore?.call(this, handles); } finally { THREE ||= handles.THREE; renderer ||= handles.renderer; composer = handles.composer || composer; start(); }
  };
  host.canyon = function (handles = {}) {
    try { return canyonBefore?.call(this, handles); } finally { THREE ||= handles.THREE; renderer ||= handles.renderer; canyon = handles.canyon || canyon; lite = !!handles.lite; start(); }
  };

  function start() {
    if (started || !composer || !canyon || !THREE) return;
    started = true;
    if (lite || (innerWidth < 760 && !document.documentElement.hasAttribute('data-flow2-phone-full'))) { S.stage = 'off: the lighter drawing'; return; }
    try { build(); S.stage = 'ready'; } catch (error) { S.stage = 'failed: ' + (error?.message || error); console.warn('flow2 streaks: left out', error); }
  }

  function build() {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
    geometry.setAttribute('corner', new THREE.Float32BufferAttribute([0, -1, 1, -1, 1, 1, 0, 1], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const count = Math.max(8, Math.min(400, Math.round(T.count))), seeds = new Float32Array(count * 4);
    let r = 20261114; const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < count; i++) {
      seeds[i * 4] = rand() * Math.PI * 2;                 // direction
      seeds[i * 4 + 1] = rand();                           // where along the depth it starts
      seeds[i * 4 + 2] = .07 + .5 * Math.pow(rand(), 1.15);  // how far from the axis it flies
      seeds[i * 4 + 3] = rand();                           // its own speed and brightness
    }
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geometry.instanceCount = count;
    material = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      uniforms: {
        uTravel: { value: 0 }, uStretch: { value: 0 }, uGain: { value: 0 }, uAspect: { value: 2 }, uWidth: { value: 2 }, uLow: { value: T.low },
        uCentre: { value: new THREE.Vector2(T.centre[0], T.centre[1]) }, uPx: { value: new THREE.Vector2(.001, .002) },
        uColor: { value: new THREE.Color(T.color) }, uPrism: { value: T.prism }
      },
      vertexShader: `
        attribute vec2 corner; attribute vec4 aSeed;
        uniform float uTravel, uStretch, uAspect, uWidth, uLow; uniform vec2 uCentre, uPx;
        varying float vAlong, vAcross, vFade;
        void main(){
          float z = fract(aSeed.y - uTravel * (.55 + .9 * aSeed.w));          // 1 = far ahead … 0 = at the lens
          float zHead = .045 + .955 * z, zTail = zHead + uStretch * (.6 + .8 * aSeed.w);
          vec2 dir = vec2(cos(aSeed.x), sin(aSeed.x));
          vec2 axis = vec2(dir.x / uAspect, dir.y);
          vec2 head = uCentre + axis * (aSeed.z / zHead), tail = uCentre + axis * (aSeed.z / zTail);
          vec2 p = mix(tail, head, corner.x) + vec2(-dir.y, dir.x) * corner.y * uWidth * uPx * (.55 + .9 * aSeed.w);
          vAlong = corner.x; vAcross = corner.y;
          float inFrame = 1. - smoothstep(1.02, 1.3, max(abs(tail.x), abs(tail.y)));
          vFade = smoothstep(.82, .5, z) * smoothstep(0., .1, z) * inFrame * (.35 + .65 * aSeed.w) * mix(uLow, 1., smoothstep(-.35, .2, head.y));
          gl_Position = vec4(p, 0., 1.);
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uGain, uPrism;
        varying float vAlong, vAcross, vFade;
        void main(){
          float across = 1. - abs(vAcross); across *= across;
          float along = smoothstep(0., .3, vAlong) * (1. - smoothstep(.9, 1., vAlong)) * mix(.3, 1., vAlong);   // a faint tail, a bright head
          vec3 col = uColor;
          col += uPrism * vec3(.34, -.04, -.3) * smoothstep(.72, 1., vAlong);       // a warm trace at the head
          col += uPrism * vec3(-.3, .02, .36) * (1. - smoothstep(0., .34, vAlong)); // a cool one at the tail
          gl_FragColor = vec4(max(col, 0.), across * along * vFade * uGain);
        }`
    });
    const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false;
    scene = new THREE.Scene(); scene.add(mesh); camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    mainPass = composer.passes.find(p => p && p.scene && p.camera && typeof p.render === 'function');
    if (!mainPass) throw new Error('no main render pass in the composer');
    pass = {
      enabled: true, needsSwap: false, clear: false, renderToScreen: false, setSize() { }, dispose() { },
      render(r, writeBuffer, readBuffer) { try { draw(r, readBuffer); } catch (error) { pass.enabled = false; S.stage = 'failed while drawing: ' + (error?.message || error); console.warn('flow2 streaks: switched off', error); } }
    };
    composer.insertPass(pass, composer.passes.indexOf(mainPass) + 1);
  }

  function draw(r, readBuffer) {
    const now = performance.now() / 1000, dt = Math.min(.1, Math.max(0, now - lastT)); lastT = now;
    const journey = window.__MONTIS_STUDY__?.journey; if (!journey) return;
    const p = +journey.progress || 0, v = lastP === null || dt <= 0 ? 0 : (p - lastP) / dt; lastP = p;
    if (!T.enabled || mainPass.scene !== canyon.scene || reduce.matches) { speed = 0; S.speed = 0; S.gain = 0; return; }
    const testing = Number.isFinite(T.test);
    const want = testing ? T.speedOn + (T.speedFull - T.speedOn) * Math.min(1, Math.max(0, T.test)) : Math.max(0, v);   // forward only
    speed += (want - speed) * (1 - Math.exp(-dt * (want > speed ? 9 : 4)));
    travel += speed * dt * T.flow;
    const gain = smooth(T.speedOn, T.speedFull, speed) * (1 - smooth(T.out[0], T.out[1], p)) * T.amount;
    S.speed = +speed.toFixed(3); S.gain = +gain.toFixed(3);
    if (gain < .004) return;
    const U = material.uniforms, h = readBuffer.height, w = readBuffer.width;
    U.uTravel.value = travel; U.uStretch.value = Math.min(.2, speed * .3 * T.length); U.uGain.value = gain * 1.6; U.uAspect.value = w / h;
    U.uWidth.value = T.width * h / 930; U.uPx.value.set(2 / w, 2 / h); U.uCentre.value.set(T.centre[0], T.centre[1]); U.uLow.value = T.low;
    U.uColor.value.set(T.color); U.uPrism.value = T.prism;
    const target = r.getRenderTarget(), autoClear = r.autoClear;
    r.autoClear = false; r.setRenderTarget(readBuffer); r.render(scene, camera);
    r.autoClear = autoClear; r.setRenderTarget(target);
  }
})();
