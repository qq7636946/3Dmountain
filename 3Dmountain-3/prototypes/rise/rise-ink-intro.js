/* RISE INK INTRO (2026-11-25, client: 「https://andersonmancini.dev/ 轉場暈開 改這種」 on index1-5-canyon-forest-rise-ui-enter-round.html).
   Active ONLY with html[data-rise-ink-spread] (?inkSpread=0 off).
   When #loader receives .gate-gone, replaces the plain opacity fade with an Anderson Mancini style radial billowing
   fractal-smoke / watercolor ink-bleed aperture opening outward from the centre dial, edged by a wide glowing feathered
   cobalt-blue halo. Half-res temporary WebGL canvas (~0.3 ms/frame), frees its GL context and removes itself on finish. */
(() => {
  'use strict';
  const html = document.documentElement;
  if (!html.hasAttribute('data-rise-ink-spread')) return;
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
  if (reduce) return;

  const VERT = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;
  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform vec2 uRes;
    uniform float uProg, uTime;

    float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float n2(vec2 p){
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3. - 2. * f);
      return mix(mix(h2(i), h2(i + vec2(1., 0.)), f.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), f.x), f.y);
    }
    float fbm(vec2 p){
      float v = 0., a = .52;
      mat2 m = mat2(.8, .6, -.6, .8);
      for (int i = 0; i < 4; i++) { v += a * n2(p); p = m * p * 2.03 + vec2(1.7, 9.2); a *= .48; }
      return v;
    }

    void main(){
      float mm = min(uRes.x, uRes.y);
      vec2 k2 = mm / uRes;
      vec2 p = (vUv - .5) / k2;
      float d = length(p);
      float diag = .5 * length(uRes / mm);

      // Exact deep steel-blue backdrop matching #riseLoad
      float g1 = length((vUv - vec2(.5, .42)) / vec2(.6, .48));
      vec3 bg = g1 < .46
        ? mix(vec3(.094, .212, .310), vec3(.063, .165, .259), g1 / .46)
        : mix(vec3(.063, .165, .259), vec3(.039, .110, .184), clamp((g1 - .46) / .54, 0., 1.));
      float topGlow = exp(-dot((vUv - vec2(.5, 1.)) / vec2(.45, .40), (vUv - vec2(.5, 1.)) / vec2(.45, .40)));
      bg += vec3(.47, .67, .82) * topGlow * .12;

      // 2-stage domain-warped billowing smoke / watercolor ink-bleed field (andersonmancini.dev style!)
      float sc = 2.15;
      vec2 q1 = vec2(fbm(p * sc + vec2(uTime * .12, -uTime * .09)),
                     fbm(p * sc + vec2(5.2 - uTime * .10, 1.3 + uTime * .11)));
      vec2 q2 = vec2(fbm(p * sc * 1.40 + 1.75 * q1 + vec2(1.7, 9.2)),
                     fbm(p * sc * 1.40 + 1.75 * q1 + vec2(8.3, 2.8)));
      float cloud = fbm(p * sc * 1.12 + 1.95 * q2);
      float wisp  = n2(p * sc * 3.4 + 2.5 * q2);
      float inkN  = cloud * .82 + wisp * .18;

      // Expanding radial aperture with broad organic billowing cloud lobes
      float e = uProg * uProg * (3. - 2. * uProg);
      float r = mix(0., diag * 1.54, pow(e, 1.25));
      float amp = .36 * smoothstep(0., .16, uProg);
      float fW  = max(.075, .26 * (0.45 + 0.65 * min(r, .95)));
      float edge = r + (inkN - .48) * (2.0 * amp * max(r, .18));
      float sDist = d - edge;

      // Cover alpha: 1 outside (opaque cover), 0 inside (revealed live 3D scene)
      float coverA = smoothstep(-fW * .60, fW * .95, sDist);
      coverA *= 1. - smoothstep(.86, 1., uProg);

      // Velvety atmospheric cobalt-cerulean smoky mist halo matching andersonmancini.dev (soft watercolor, never neon!)
      float gate = smoothstep(0.01, .14, uProg) * (1. - smoothstep(.78, 1., uProg));
      float haloWide = exp(-pow((sDist - fW * .16) / (fW * 1.28), 2.)) * (.58 + .52 * cloud);
      float haloCore = exp(-pow((sDist + fW * .04) / (fW * .50), 2.)) * (.50 + .55 * wisp);
      vec3 cobalt   = vec3(.075, .31, .52);
      vec3 mistyBlu = vec3(.17,  .49, .73);

      // Delicate thin dial echo ring gently expanding & dissolving right at launch
      float dialR = mix(.185, .24, smoothstep(0., .45, uProg));
      float ring = smoothstep(.0036, .0008, abs(d - dialR)) * (1. - smoothstep(.08, .48, uProg)) * .56;

      float haloAlpha = clamp((haloWide * .52 + haloCore * .28) * gate, 0., .74);
      float outAlpha = clamp(max(coverA, haloAlpha) + ring, 0., 1.);
      vec3 haloCol = mix(cobalt, mistyBlu, clamp(haloCore * .82, 0., 1.));
      vec3 col = mix(bg, mix(bg, haloCol, .78), clamp(haloWide * gate * .88, 0., .85));
      col = mix(haloCol * (.96 + .16 * haloCore), col, clamp(coverA / max(outAlpha, 1e-4), 0., 1.));
      col += vec3(.74, .88, .98) * ring;

      if (outAlpha < .002) discard;
      gl_FragColor = vec4(col, outAlpha);
    }
  `;

  let active = null;
  function stop() {
    if (!active) return;
    cancelAnimationFrame(active.raf);
    try { active.gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch (e) {}
    active.cv.remove();
    active = null;
  }

  function start(holdProg) {
    stop();
    const cv = document.createElement('canvas');
    cv.id = 'riseInkIntro';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;pointer-events:none;';
    document.body.append(cv);

    const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false });
    if (!gl) { cv.remove(); return false; }

    const compile = (type, src) => {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { console.warn('[rise-ink-intro]', gl.getShaderInfoLog(sh)); return null; }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { cv.remove(); return false; }
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cv.remove(); return false; }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uProg = gl.getUniformLocation(prog, 'uProg');
    const uTime = gl.getUniformLocation(prog, 'uTime');

    const resize = () => {
      const s = Math.min(1, (devicePixelRatio || 1) * .55);
      cv.width = Math.max(256, Math.round(innerWidth * s));
      cv.height = Math.max(160, Math.round(innerHeight * s));
      gl.viewport(0, 0, cv.width, cv.height);
    };
    resize();

    const t0 = performance.now(), dur = 1350;
    const draw = p => {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uRes, cv.width, cv.height);
      gl.uniform1f(uProg, Math.max(0, Math.min(1, p)));
      gl.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const st = active = { cv, gl, raf: 0, draw };
    if (typeof holdProg === 'number') { draw(holdProg); return true; }

    const tick = now => {
      if (active !== st) return;
      const p = Math.min(1, (now - t0) / dur);
      draw(p);
      if (p >= 1) { stop(); return; }
      st.raf = requestAnimationFrame(tick);
    };
    draw(0);
    st.raf = requestAnimationFrame(tick);
    return true;
  }

  // Watch #loader: the exact moment .gate-gone is added (loading finished), swap seamlessly to the billowing ink-bleed opening!
  const loader = document.getElementById('loader');
  if (loader && !loader.classList.contains('gate-gone')) {
    const mo = new MutationObserver(() => {
      if (!loader.classList.contains('gate-gone')) return;
      mo.disconnect();
      if (start()) {
        loader.style.transition = 'none';
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden';
      }
    });
    mo.observe(loader, { attributes: true, attributeFilter: ['class'] });
  }

  window.__RISE_INK_INTRO__ = {
    replay: () => start(),
    hold: p => start(p),
    stop
  };
})();
