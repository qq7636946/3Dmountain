/* light-shafts.js — fine straight shafts of light fanning out of whatever is lit (2026-11-01, client: 「這三處發光時候都加上類似這種光芒」, after threejs-video-wall by Francesco Michelini, MIT).
   That demo runs a 32-tap radial blur of the whole frame on WebGPU, every frame. Here: WebGL2, only while something is lit, and only of what emits.

   1. SOURCE   a low-resolution texture holding only what should emit. On the journey: a bright pass of the composer's buffer inside a soft window round the object (extract), since the flash
               stands well above everything else in HDR. Elsewhere: any draw of the burning parts alone can be handed straight to radiate() (the closing LOGO's own rtA).
   2. RADIATE  iterated steps along the line to the centre: three small draws of 8 taps, each stretching the last, reach as far as 512 taps. The steps are a constant length in screen
               heights (not a zoom), so a wide word gets the same length of shaft from its middle and its ends. The taps fall off along the ray, which is all the fade there is: the
               shaft is brightest at the source and reaches zero at LENGTH.
   3. OVER     adds the result over the frame. Thin streaks with dark gaps come from a smooth function of the angle round the centre, at full resolution, drifting slowly: no noise,
               no random numbers, nothing that can change from one frame to the next. Integer frequencies, so there is no seam at the back of the angle.

   The other way in (addOver) is for a scene drawn straight to the canvas, with a source of its own (the closing LOGO's rtA): the shafts are added onto the finished picture, in display values, and can be
   mirrored in water: above a line on the screen the fan itself, below it the same fan turned over about that line, dimmer and bent by a slow ripple, the way water shows what stands on it.

   Costs nothing at rest: the composer skips a disabled pass, and both passes stay disabled unless something is lit. Nothing but the driver's few multiplications runs per frame.
   Phones (small): three passes of 6 taps at 1/6 resolution, a third of the desktop's work (two passes left 36 steps along a shaft, which showed as beads across the fine lines of the word); CONFIG.lightShafts.phone = 0 turns it off there. Reduced motion: the driver never enables it.
   Dials: LIGHT_SHAFT_DEFAULTS, rows in the LOGO panel (logo-panel-build.cjs, EXTRA_ROWS). */
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const LIGHT_SHAFT_DEFAULTS = {
  on: 0,   // the client cancelled the shafts (2026-11-01: 「光芒取消好了 不太好看」); 1 brings them back, on the closing LOGO with emberShafts 4.5
  phone: 1, phoneStrength: .7, wordPhone: 3, wordPhoneLength: 1.5,   // phones: on or off, how strong; the word on top of that, in strength (its veins give less to a coarser source) and length (a tall window shortens its fan more than it should)
  color: '#6fbcff',
  tint: .75,            // 0 the emitter's own colour, 1 all in COLOR
  hero: 1.7, word: 2.6,   // strength per moment (× the flash's envelope)
  heroLength: .6, wordLength: .6,    // screen heights the shafts reach beyond the source
  heroCore: .08, wordCore: .07,        // how much of the shafts lies over the object itself (0 none, 1 all)
  dimOut: 1,            // the picture comes back no faster than this (seconds for the whole range): an object that vanishes in the middle of a pulse (the drop bursts) would otherwise jump its brightness in one frame
  heroEdge: .06, wordEdge: .1,       // how softly the shafts take up from the object's outline (screen heights): a word's tops are uneven, a hard line would show across them
  wordLines: 1.45,         // the word's lines against the drop's: its fan centre lies further from the source, so the same count looks coarser
  wordDrop: .25,        // the word's fan centre, below its middle (screen heights): a wide object fanned from its own middle gives one long horizontal glare
  below: .42,           // what falls downward, towards the title (1 as much as upward)
  heroDim: .32, wordDim: .35,   // the picture dips by this much while the shafts stand (an eye closing down against a light): the gaps between them go dark, and it lifts nothing
  pad: 1.12,            // the source window, × the object's size on screen
  shaftKnee: .35,         // brightness of the shafts held down softly: the flash's veins cover more or less of the object from moment to moment, and the shafts should not swing with that, nor wash over what they cross
  cut: 1.2, knee: 1.2, ceil: 7,   // bright pass, on the largest channel: starts at CUT, full at CUT + KNEE; CEIL caps it
  fall: .02,            // weight of the furthest tap (smaller = fades sooner)
  streaks: .96, count: 24, sharp: 3.2, speed: .1,   // the shafts: depth, how many round the circle (client 2026-11-01: 240 was too dense, ten times the spacing), how thin, how fast they drift
  view: 0               // 0 the picture, 1 the source alone, 2 the shafts alone
};

const FULL_VERTEX = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const num = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };

export function createLightShafts({ renderer, getConfig = () => LIGHT_SHAFT_DEFAULTS, small = false }) {
  const DIV = small ? 6 : 4, PASSES = 3, TAPS = small ? 6 : 8;
  const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false, stencilBuffer: false };
  const rtSource = new THREE.WebGLRenderTarget(4, 4, opts); let rtA = new THREE.WebGLRenderTarget(4, 4, opts), rtB = new THREE.WebGLRenderTarget(4, 4, opts);
  const quad = new FullScreenQuad(null);
  const common = { vertexShader: FULL_VERTEX, depthTest: false, depthWrite: false, toneMapped: false };

  const extractMat = new THREE.ShaderMaterial({
    ...common, blending: THREE.NoBlending,
    uniforms: { tMap: { value: null }, uPx: { value: new THREE.Vector2() }, uCenter: { value: new THREE.Vector2(.5, .5) }, uWin: { value: new THREE.Vector2(.2, .2) }, uCut: { value: new THREE.Vector3(1, 1, 8) } },
    fragmentShader: /* glsl */ `precision highp float; uniform sampler2D tMap; uniform vec2 uPx, uCenter, uWin; uniform vec3 uCut; varying vec2 vUv;
      void main() {
        vec2 q = (vUv - uCenter) / uWin; q *= q;
        float win = 1. - smoothstep(1., 1.5, sqrt(sqrt(q.x * q.x + q.y * q.y)));   // a soft rounded box
        if (win <= 0.) { gl_FragColor = vec4(0., 0., 0., 1.); return; }
        /* a 4x4 box of the full frame: a thin bright vein keeps its weight wherever it falls on this smaller grid, so it does not shimmer as it moves */
        vec3 c = min(texture2D(tMap, vUv + uPx * vec2(-1., -1.)).rgb, uCut.z) + min(texture2D(tMap, vUv + uPx * vec2(1., -1.)).rgb, uCut.z)
               + min(texture2D(tMap, vUv + uPx * vec2(-1., 1.)).rgb, uCut.z) + min(texture2D(tMap, vUv + uPx * vec2(1., 1.)).rgb, uCut.z);
        c *= .25;
        gl_FragColor = vec4(c * win * smoothstep(uCut.x, uCut.x + uCut.y, max(c.r, max(c.g, c.b))), 1.);
      }`
  });

  const radialMat = new THREE.ShaderMaterial({
    ...common, blending: THREE.NoBlending, defines: { TAPS },
    uniforms: { tMap: { value: null }, uCenter: { value: new THREE.Vector2(.5, .5) }, uAspect: { value: 1 }, uStride: { value: .01 }, uFall: { value: 1 }, uNorm: { value: 1 } },
    fragmentShader: /* glsl */ `precision highp float; uniform sampler2D tMap; uniform vec2 uCenter; uniform float uAspect, uStride, uFall, uNorm; varying vec2 vUv;
      void main() {
        vec2 d = vUv - uCenter; d.x *= uAspect;
        float len = length(d);
        vec2 dir = d / max(len, 1e-4); dir.x /= uAspect;
        vec3 sum = vec3(0.); float w = 1.;
        for (int i = 0; i < TAPS; i++) { sum += textureLod(tMap, vUv - dir * min(uStride * float(i), len), 0.).rgb * w; w *= uFall; }
        gl_FragColor = vec4(sum * uNorm, 1.);
      }`
  });

  const STREAKS = /* glsl */ `uniform vec2 uCenter, uAt, uWin, uEdge; uniform float uAspect, uGain, uCore, uTint, uBelow; uniform vec3 uColor, uStreak; uniform vec4 uFreq;
    vec3 shaftsAt(vec2 uv, vec3 s) {
      vec2 d = uv - uCenter; d.x *= uAspect;
      float a = atan(d.y, d.x), len = length(d), t = uStreak.z;
      /* two sines, each bent by a slower one, so the lines are of unequal width and spacing, and all of it smooth */
      float n = .58 * sin(a * uFreq.x + 2.1 * sin(a * uFreq.y + t * .61) + t) + .42 * sin(a * uFreq.z - 1.7 * sin(a * uFreq.w - t * .37) - t * .73);
      float m = pow(clamp(.5 + .5 * n, 0., 1.), uStreak.y) * (1. + uStreak.y * .55);
      /* the lines close up towards the centre: once the finest of them is narrower than the pixels it would make a moire (a mark turned edge-on has its source right there), so that part stays smooth. fwidth(len): a pixel, in these units */
      m = mix(1., m, uStreak.x * (1. - smoothstep(.5, .9, uFreq.z * fwidth(len) / (6.283 * max(len, 1e-3)))));
      float l = max(s.r, max(s.g, s.b));
      vec3 c = mix(s, uColor * l, uTint);
      /* the object's outline: a circle for the drop, a pill for the word (a box whose corners are round by its shorter half). Distance from it, in screen heights */
      vec2 half_ = uWin * vec2(uAspect, 1.); float rc = min(half_.x, half_.y);
      float core = mix(uCore, 1., smoothstep(uEdge.x, uEdge.y, length(max(abs(uv - uAt) * vec2(uAspect, 1.) - half_ + rc, 0.)) - rc));
      /* what falls towards the page's title below the object can be held back, so the title keeps its contrast */
      float low = mix(uBelow, 1., smoothstep(-.85, .05, d.y / max(len, 1e-3)));
      return c * m * core * low * uGain;
    }`;
  const overUniforms = () => ({
    tMap: { value: null }, tBase: { value: null }, uCenter: { value: new THREE.Vector2(.5, .5) }, uAt: { value: new THREE.Vector2(.5, .5) }, uBelow: { value: 1 }, uWin: { value: new THREE.Vector2(.2, .2) }, uEdge: { value: new THREE.Vector2(-.05, .02) }, uAspect: { value: 1 }, uGain: { value: 0 }, uCore: { value: 1 }, uTint: { value: 0 },
    uColor: { value: new THREE.Color() }, uStreak: { value: new THREE.Vector3() }, uFreq: { value: new THREE.Vector4(1, 1, 1, 1) }, uView: { value: 0 }
  });
  /* over a frame in a buffer (the composer), or added onto whatever is bound (the lake's canvas) */
  const overMat = new THREE.ShaderMaterial({
    ...common, blending: THREE.NoBlending, uniforms: { ...overUniforms(), uDim: { value: 0 }, uKnee: { value: 0 } },
    fragmentShader: /* glsl */ `precision highp float; uniform sampler2D tMap, tBase; uniform float uView, uDim, uKnee; varying vec2 vUv; ${STREAKS}
      void main() {
        vec3 b = texture2D(tBase, vUv).rgb * (1. - uDim), s = texture2D(tMap, vUv).rgb;
        s /= 1. + uKnee * max(s.r, max(s.g, s.b));
        gl_FragColor = vec4(uView > 1.5 ? shaftsAt(vUv, s) : uView > .5 ? s : b + shaftsAt(vUv, s), 1.);
      }`
  });
  const addMat = new THREE.ShaderMaterial({
    ...common, transparent: true, blending: THREE.AdditiveBlending, uniforms: { ...overUniforms(), tSource: { value: null }, uHold: { value: new THREE.Vector4(1, 2, 1, 0) }, uMirror: { value: new THREE.Vector4(-1, 0, .01, .3) }, uRipple: { value: new THREE.Vector4(0, 0, 0, .1) }, uGap: { value: 1 } },
    fragmentShader: /* glsl */ `precision highp float; uniform sampler2D tMap, tSource; uniform vec4 uHold, uMirror, uRipple; uniform float uGap; varying vec2 vUv; ${STREAKS}
      /* the shafts at UV; uHold.w a soft knee, so that where two lit parts lie along one ray the shaft does not stand far above the rest. Where nothing reaches, nothing below is worked out */
      vec3 shaft(vec2 uv) { vec3 s = texture2D(tMap, uv).rgb; float l = max(s.r, max(s.g, s.b)); return l < .0004 ? vec3(0.) : shaftsAt(uv, s / (1. + uHold.w * l)); }
      /* uHold.xyz: the source's alpha, its coverage, blurred with it: where that starts and ends to count as the object itself, and what remains of the shafts there. Not its brightness: a vein passing the rim would move that edge and the roots of the shafts would twinkle */
      float bare() { return mix(1., uHold.z, smoothstep(uHold.x, uHold.y, texture2D(tSource, vUv).a)); }
      void main() {
        /* uMirror: the water's line (screen y, -1 = no water), how strongly it mirrors, how soft the line is, how far the mirror carries. uRipple: sideways, up-and-down, how strongly the fan falls on the water, how far it carries */
        float under = uMirror.x - vUv.y, wet = smoothstep(-uMirror.z, uMirror.z, under);
        vec3 c = wet < 1. ? shaft(vUv) * (1. - wet) : vec3(0.);
        if (wet > 0.) {
          float k = max(under, 0.), ph = log(k + .02), t = uStreak.z;   // waves crowd together towards the horizon: their phase runs on the log of the distance from it, and they vanish at the line itself
          vec2 w = smoothstep(.02, .14, k) * (.3 + k * 2.2) * vec2(uRipple.x * (sin(ph * 5. + vUv.x * 5. + t * 9.) + .5 * sin(ph * 9. - vUv.x * 9. - t * 13.)), uRipple.y * (sin(ph * 7. - vUv.x * 8. - t * 7.) + .5 * sin(ph * 4. + vUv.x * 17. + t * 11.)));
          if (uRipple.z > 0.) c += shaft(vUv + w * .7) * uRipple.z * exp(-k / max(uRipple.w, .01)) * wet;   // the fan itself, falling on the water
          /* what the water mirrors of the sky's part, off to the sides: straight under the object that is only the dark inside of the mirrored ring, with hard sides, and the fan falling on the water is what shows there */
          if (uMirror.y > 0.) c += shaft(vec2(vUv.x, uMirror.x + under) + w) * uMirror.y * exp(-k / max(uMirror.w, .01)) * wet * smoothstep(uGap, uGap * 1.9, abs(vUv.x - uAt.x) / max(max(uWin.x, uWin.y / uAspect * .8), .001));
        }
        gl_FragColor = vec4(c * bare(), 1.);
      }`
  });

  /* A source that is alive (the burning edges crawl) makes a shaft brighten and dim as a vein passes along it. This low-resolution image of the shafts follows with a short lag, so they swell and ease instead of twinkling; the thin lines are worked out later at full resolution and are not touched. */
  const settleMat = new THREE.ShaderMaterial({
    ...common, blending: THREE.NoBlending, uniforms: { tNew: { value: null }, tOld: { value: null }, uMix: { value: 1 } },
    fragmentShader: /* glsl */ `precision highp float; uniform sampler2D tNew, tOld; uniform float uMix; varying vec2 vUv; void main() { gl_FragColor = vec4(mix(texture2D(tOld, vUv).rgb, texture2D(tNew, vUv).rgb, uMix), 1.); }`
  });
  let settleA = null, settleB = null, settledAt = -1;
  function settled(texture, w, h, seconds) {
    if (!settleA) { settleA = new THREE.WebGLRenderTarget(w, h, opts); settleB = new THREE.WebGLRenderTarget(w, h, opts); settledAt = -1; }
    else if (settleA.width !== w || settleA.height !== h) { settleA.setSize(w, h); settleB.setSize(w, h); settledAt = -1; }
    const now = performance.now() / 1000, gap = settledAt < 0 ? 9 : now - settledAt, U = settleMat.uniforms; settledAt = now;
    U.tNew.value = texture; U.tOld.value = settleB.texture; U.uMix.value = gap > .25 ? 1 : 1 - Math.exp(-gap / Math.max(.001, seconds));   // after a pause it starts afresh
    quad.material = settleMat; renderer.setRenderTarget(settleA); quad.render(renderer);
    const t = settleA; settleA = settleB; settleB = t;
    return settleB.texture;
  }

  function size(w, h) { for (const r of [rtSource, rtA, rtB]) if (r.width !== w || r.height !== h) r.setSize(w, h); }

  /* the bright parts inside the window → the source target */
  function extract(texture, w, h, { center, win, pad = 1.12, cut = 1.2, knee = 1.2, ceil = 7 }) {
    const lowW = Math.max(2, Math.round(w / DIV)), lowH = Math.max(2, Math.round(h / DIV)), U = extractMat.uniforms;
    size(lowW, lowH);
    U.tMap.value = texture; U.uPx.value.set(DIV * .25 / w, DIV * .25 / h);
    U.uCenter.value.set(center.x, center.y); U.uWin.value.set(win.x * pad, win.y * pad); U.uCut.value.set(cut, knee, ceil);
    quad.material = extractMat; renderer.setRenderTarget(rtSource); quad.render(renderer);
    return rtSource.texture;
  }

  /* any source texture → the shafts. LENGTH in screen heights; FALL the weight of the furthest tap. */
  function radiate(texture, { center, aspect, length = .5, fall = .03 }) {
    const U = radialMat.uniforms, total = Math.pow(TAPS, PASSES), end = clamp(fall, .001, 1);
    U.uCenter.value.set(center.x, center.y); U.uAspect.value = aspect;
    quad.material = radialMat;
    let src = texture, gap = 1;
    for (let i = 0; i < PASSES; i++) {
      const fallEach = Math.pow(end, gap / total);
      let sum = 0; for (let k = 0, w = 1; k < TAPS; k++, w *= fallEach) sum += w;
      U.tMap.value = src; U.uStride.value = length * gap / total; U.uFall.value = fallEach; U.uNorm.value = 1 / sum;
      renderer.setRenderTarget(rtA); quad.render(renderer);
      src = rtA.texture; const t = rtA; rtA = rtB; rtB = t;
      gap *= TAPS;
    }
    return src;
  }

  function setOver(U, S, shafts, { center, at = center, win, aspect, gain, core, below = num(S.below, 1), color = S.color, display = false, edge = .06, lines = 1 }) {
    U.tMap.value = shafts; U.uCenter.value.set(center.x, center.y); U.uAt.value.set(at.x, at.y); U.uBelow.value = below; U.uWin.value.set(win.x, win.y); U.uAspect.value = aspect; U.uGain.value = gain; U.uCore.value = core; U.uEdge.value.set(-edge * .75, edge * .25); U.uTint.value = clamp(num(S.tint, .75));
    U.uColor.value.set(typeof color === 'string' ? color : '#6fbcff');
    if (display) U.uColor.value.convertLinearToSRGB();   // no OutputPass after it: straight onto the canvas
    const count = Math.max(4, num(S.count, 240)) * lines * (small ? .6 : 1);   // a phone's narrow canvas has room for fewer lines round the same object
    U.uFreq.value.set(Math.round(count), Math.round(count * .37), Math.round(count * 1.73), Math.round(count * .19));
    U.uStreak.value.set(clamp(num(S.streaks, .9)), Math.max(.2, num(S.sharp, 2.4)), time * num(S.speed, .1));
  }

  /* the slow clock of the streaks: it runs on while the pass runs, and need not be anything but smooth */
  let time = 0, last = -1;
  function tick() { const now = performance.now() / 1000; time += clamp(last < 0 ? 0 : now - last, 0, .1); last = now; }

  const job = { center: new THREE.Vector2(.5, .5), at: new THREE.Vector2(.5, .5), win: new THREE.Vector2(.2, .2), aspect: 1, gain: 0, length: .5, core: 1, dim: 0, edge: .06, lines: 1 };
  /* Two passes in the composer, the bloom between them: the source is read before the bloom, so it is the flash itself and not its halo; the shafts go on after it, so they stay fine lines
     and are not bloomed into a haze. */
  let shafts = null;
  class LightShaftSourcePass extends Pass {
    constructor() { super(); this.needsSwap = false; this.enabled = false; }
    render(r, writeBuffer, readBuffer) {
      const S = getConfig();
      tick();
      const source = extract(readBuffer.texture, readBuffer.width, readBuffer.height, { center: job.at, win: job.win, pad: num(S.pad, 1.12), cut: num(S.cut, 1.2), knee: num(S.knee, 1.2), ceil: num(S.ceil, 7) });
      shafts = Math.round(num(S.view, 0)) === 1 ? source : radiate(source, { center: job.center, aspect: job.aspect, length: job.length, fall: num(S.fall, .03) });
    }
  }
  class LightShaftPass extends Pass {
    constructor() { super(); this.needsSwap = true; this.enabled = false; }
    render(r, writeBuffer, readBuffer) {
      const S = getConfig(), U = overMat.uniforms;
      setOver(U, S, shafts, job);
      U.tBase.value = readBuffer.texture; U.uView.value = Math.round(num(S.view, 0)); U.uDim.value = job.dim; U.uKnee.value = Math.max(0, num(S.shaftKnee, 0));
      quad.material = overMat; r.setRenderTarget(this.renderToScreen ? null : writeBuffer); quad.render(r);
    }
  }
  const sourcePass = new LightShaftSourcePass(), pass = new LightShaftPass();

  /* the composer's way in: called every frame by the driver; amount 0 leaves the pass off */
  function aim({ amount = 0, center, at = center, win, length = .5, core = 1, aspect = 1, dim = 0, edge = .06, lines = 1 }) {
    if (!(amount > .002) && !(dim > .002)) { if (pass.enabled) { pass.enabled = sourcePass.enabled = false; last = -1; } return false; }
    job.center.copy(center); job.at.copy(at); job.win.copy(win); job.length = length; job.core = core; job.aspect = aspect; job.gain = amount; job.dim = clamp(dim); job.edge = edge; job.lines = lines;
    pass.enabled = sourcePass.enabled = true;
    return true;
  }

  /* the other way in, for a scene with no composer: radiate SOURCE and add it onto TARGET (null = the canvas). The caller sizes nothing: pass the size of its own source. HOLD: { from, to, keep, knee }, how much of the shafts lies over the object, told by the alpha of the source. MIRROR: { line, gain, soft, reach, gap, sideways, updown, over, overReach } */
  function addOver({ source, width, height, center, at = center, win, aspect, gain, length = .5, core = 1, fall, color, below = 1, display = true, hold = null, mirror = null, settle = 0, target = null }) {
    const S = getConfig(), U = addMat.uniforms, view = Math.round(num(S.view, 0)); tick();
    for (const r of [rtA, rtB]) if (r.width !== width || r.height !== height) r.setSize(width, height);
    let shafts = view === 1 ? source : radiate(source, { center, aspect, length, fall: fall ?? num(S.fall, .03) });
    if (settle > 0 && view !== 1) shafts = settled(shafts, width, height, settle);
    const auto = renderer.autoClear; renderer.autoClear = false;
    setOver(U, S, shafts, { center, at, win, aspect, gain, core, below, color, display });
    U.tSource.value = source; U.uHold.value.set(hold && view !== 1 ? hold.from : 1e3, hold && view !== 1 ? hold.to : 2e3, hold ? hold.keep : 1, hold ? hold.knee : 0);
    U.uMirror.value.set(mirror ? mirror.line : -1, mirror ? mirror.gain : 0, mirror ? Math.max(.0005, mirror.soft) : .01, mirror ? mirror.reach : 1);
    U.uGap.value = mirror ? Math.max(.001, mirror.gap) : 1;
    U.uRipple.value.set(mirror ? mirror.sideways : 0, mirror ? mirror.updown : 0, mirror ? mirror.over : 0, mirror ? mirror.overReach : .1);
    renderer.setRenderTarget(target);
    if (view) { renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false); }   // the panel's view: the shafts or the source alone
    quad.material = addMat; quad.render(renderer);
    renderer.autoClear = auto;
  }

  /* compile the programs and allocate the targets ahead of the first flash: a hitch at the moment of the flash would be the worst place for one */
  function warm() {
    const T = rtSource.texture, prev = renderer.getRenderTarget(), drawn = renderer.getDrawingBufferSize(new THREE.Vector2());
    size(Math.max(2, Math.round(drawn.x / DIV)), Math.max(2, Math.round(drawn.y / DIV)));   // the first flash then allocates nothing, unless the window has been resized
    for (const m of [extractMat, radialMat, overMat, addMat]) { quad.material = m; renderer.setRenderTarget(rtA); for (const k of ['tMap', 'tBase']) if (m.uniforms[k]) m.uniforms[k].value = T; quad.render(renderer); }
    for (const m of [extractMat, radialMat, overMat, addMat]) { m.uniforms.tMap.value = null; if (m.uniforms.tBase) m.uniforms.tBase.value = null; }
    renderer.setRenderTarget(prev);
  }

  function dispose() { for (const r of [rtSource, rtA, rtB, settleA, settleB]) r?.dispose(); for (const m of [extractMat, radialMat, overMat, addMat, settleMat]) m.dispose(); quad.dispose(); }
  return { pass, sourcePass, aim, extract, radiate, addOver, warm, dispose, get running() { return pass.enabled; }, get dim() { return job.dim * (pass.enabled ? 1 : 0); } };
}
