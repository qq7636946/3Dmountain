/* Flow2 fine picture, the world (2026-11-11): the WHY sea and its pictures, the news cards, the globe, the principles, the closing
   mark and the footer drawn finer, on index1-5-flow2.html only. Client: 「主要是畫面的細緻度加強」.
   Loaded before main.js. ?fine=0 leaves it out (the picture as it was).

   What it does (docs/flow2/flow2-fine-world-20261111.md has the pictures):
   1. The sea (WHY FINNOVATION). Its small waves now light and shade the water itself (they only fed the glints, so the body of the
      water was a smooth blur), with slow patches of wind and a quiet variation of depth; the glints break into finer ones. The
      four pictures are read sharper and each has a clean hairline edge.
   2. The news cards. At rest every card stood in a torn, enlarged echo of itself and on a flickering grain: the echo now fades as
      the strip comes to rest (it still trails while the strip moves), the ground is still, the pictures are filtered properly and
      each has a fine keyline. The strip is drawn by the live site's module, which this page may not change, so this is done where
      the page hands its drawing commands to the browser, only on that one canvas (see CARDS below).
   3. The film grain laid over the whole page (alpine-ui's .alp-grain: 6 % of moving noise) is taken off the world and the news,
      with a short fade. It hid exactly the fine detail this round is about.
   4. Resolution: OFF as delivered (tune.scale 1). The world's canvas can be drawn with more pixels than a plain screen has (up to
      2 × 2 for each) on desktops with strong graphics. Tried at 2: glints and coasts come out thinner, but the gain over 1 to 3
      is small, the lake behind the closing mark costs four times the pixels, and the mark's glass starts to show the fine
      vertical lines of its own relief (dense screens show them already). So it is left as a dial: ?fineScale=2 to look.

   world-ocean.js calls sea() when it has made the sea's materials (before they are compiled); finnovation-world.js asks
   renderScale() for the world's pixel ratio (and gets the page's own while the dial is at 1). Without this file both run as before.
   QA: ?fineScale=2 holds a ratio, ?fineOff=sea,cards,grain,scale leaves parts out, window.__FLOW2_FINE_WORLD__.state. */
(() => {
  const query = new URLSearchParams(location.search);
  if (query.get('fine') === '0') return;
  const html = document.documentElement;
  const off = new Set((query.get('fineOff') || '').split(',').filter(Boolean));
  const held = parseFloat(query.get('fineScale'));
  const coarse = matchMedia('(pointer: coarse)').matches;

  const T = {
    /* 4. resolution (off: 1). At 1.5 or 2 the rules below decide who gets it */
    scale: 1,            // the most device pixels per CSS pixel the world is drawn with (the browser reduces it cleanly up to 2)
    budget: 5.8e6,       // and the most pixels in all: a larger window gets a smaller ratio (1836 × 762 → 2, 1920 × 1080 → 1.5)
    dense: 1.5,          // a screen with this ratio or more is fine already
    strong: /\b(RTX|GTX\s?(9[5-9]0|10[5-8]0|16[5-6]0)|Radeon\s+(RX|Pro)\b|Radeon\(TM\)\s+RX|Arc\(TM\)\s+[AB]\d|Apple\s+M\d|Quadro\s+(RTX|P[2-6]\d{3}|T\d{3,4}))/i,   // graphics known to carry it; anything else keeps the page's own rule
    /* 1. the sea */
    ripple: 1.4,         // how much the small waves light and shade the water
    depthTone: .13,      // slow variation of the water's depth colour (share of its brightness)
    glintDetail: .3,     // the same small waves break the long glint streaks into finer ones
    photoBias: -.55,     // the four pictures are read this many levels sharper
    photoEdge: .5,       // the pictures' hairline (was .22, barely there)
    photoEdgeColor: [.87, .93, .98],
    /* 2. the news cards */
    cardRest: .06,       // the echo behind a card is gone below this share of the strip's full speed
    cardBias: -.7,       // the cards' pictures, read sharper from a proper set of reduced copies
    cardLine: .5,        // the keyline on a card's edge
    cardLineColor: [.13, .22, .33]
  };
  const state = { gpu: null, strong: false, scale: null, sea: null, photos: 0, cards: null, grain: false };

  /* ---------------------------------------------------------------- 4. resolution (a dial, off as delivered) */
  let gpuRead = false;
  function readGpu() {
    if (gpuRead) return; gpuRead = true;
    try {
      /* a throwaway context, asked for the way the page asks for its own (no software rendering), released at once */
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const gl = canvas.getContext('webgl', { powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true, antialias: false, depth: false, stencil: false });
      if (!gl) return;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      state.gpu = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
      state.strong = T.strong.test(state.gpu);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    } catch { /* unknown graphics: the page's own rule */ }
  }
  const plainDesktop = () => !coarse && (window.devicePixelRatio || 1) < T.dense && Math.min(screen.width, screen.height) >= 700;
  /* asked by finnovation-world.js when it sets the world up and when the window changes size; returns the ratio to draw at */
  function renderScale({ base, lowGpu, mobilePerformance, small }) {
    let scale = base;
    if (!off.has('scale') && !lowGpu && !mobilePerformance && !small && plainDesktop() && base < T.dense) {
      if (held >= 1 && held <= 2.5) scale = Math.max(base, held);
      else if (T.scale > 1) {
        readGpu();
        /* a machine the journey's own governor already had to step down gets no extra pixels */
        const slow = (window.__MONTIS_GOVERNOR__?.journey?.scale ?? 1) < 1;
        if (state.strong && !slow) {
          const fit = Math.floor(Math.min(T.scale, Math.sqrt(T.budget / Math.max(1, innerWidth * innerHeight))) * 4) / 4;
          if (fit >= base + .25) scale = fit;
        }
      }
    }
    state.scale = scale;
    return scale;
  }
  /* read the graphics' name while the entry screen is still up, not when the world is being set up */
  if (T.scale > 1 && !off.has('scale') && plainDesktop() && !(held >= 1)) (window.requestIdleCallback || (fn => setTimeout(fn, 300)))(readGpu, { timeout: 2500 });

  /* ---------------------------------------------------------------- 1. the sea, the islands, the four pictures */
  const SEA = {
    parsAnchor: 'void readOceanSurface(',
    pars: 'uniform vec4 uFineSea;\nfloat f2Tilt=0.,f2Tone=0.;\n',
    readAnchor: 'd=dot(sC+sB*.4,normalize(uSun.xy))*uLook.y*1.6+swell*.9;',
    /* two more readings of the wave field, each turned and scaled its own way: three trains of small waves crossing, so they
       weave like chop instead of running in one direction, and line up neither into a tile nor with the screen's pixels (the
       engine's finest reading lies square to them and shows its grid when it is used for shading); f2Tilt = how far the
       small waves lean towards the sun here, stronger in slow patches of wind, quieter under the words, fading with height;
       f2Tone = a still, wide variation of depth */
    read: `
  {
    vec4 f2e=texture2D(uWave,rot(w,1.93)/(L*.71)+vec2(.13,.59)),f2f=texture2D(uWave,rot(w,-.85)/(L*.5)+vec2(.47,.21));
    vec2 f2sE=rot(f2e.rg-.5,-1.93)*2.,f2sF=rot(f2f.rg-.5,.85)*2.,f2s=normalize(uSun.xy);
    float f2g=texture2D(uNoise,rot(w,.9)*.33+vec2(.37,.11)+vec2(uView.w*.0025,0.)).g;
    f2Tilt=(dot(f2sE,f2s)+dot(f2sF,f2s)*.9+dot(sB,f2s)*.6)*uLook.y*mix(.3,1.35,smoothstep(.36,.64,f2g))*(1.-.8*smoothstep(1.3,3.2,h))*(1.-.45*oceanReading(gl_FragCoord.xy/uRes));
    f2Tone=texture2D(uNoise,rot(w,-1.2)*.21+vec2(.61,.27)).r-.5;
    N=normalize(vec3(-(slope+(f2sE+f2sF*.6)*uLook.y*uFineSea.w),1.));
  }
`,
    baseAnchor: 'return mix(mix(uInk,uDeep,smoothstep(-1.4,-.3,d)),uLit,smoothstep(0.,1.3,d)*.62);',
    /* the side of a small wave towards the light a little lighter, the far side a little deeper (weighted so the sea's average tone stays where it was) */
    base: `vec3 f2c=mix(mix(uInk,uDeep,smoothstep(-1.4,-.3,d)),uLit,smoothstep(0.,1.3,d)*.62);
  f2c*=1.+f2Tone*uFineSea.y;
  float f2t=f2Tilt*uFineSea.x;
  return f2c+(uLit-uDeep)*max(f2t,0.)*.8+(uInk-uDeep)*max(-f2t,0.)*1.6;`
  };
  const PHOTO = [
    ['vec3 col=texture2D(uPhoto,uv).rgb;', 'vec3 col=texture2D(uPhoto,uv,uFinePhoto.x).rgb;'],
    ['col=mix(col,vec3(.80,.86,.90),border*.22);', 'col=mix(col,uFinePhotoEdge,border*uFinePhoto.y);']
  ];
  const once = (text, anchor) => text.split(anchor).length === 2;
  function patchWater(material) {
    const f = material.fragmentShader;
    if (!once(f, SEA.parsAnchor) || !once(f, SEA.readAnchor) || !once(f, SEA.baseAnchor)) return false;
    material.fragmentShader = f.replace(SEA.parsAnchor, SEA.pars + SEA.parsAnchor).replace(SEA.readAnchor, SEA.readAnchor + SEA.read).replace(SEA.baseAnchor, SEA.base);
    material.needsUpdate = true;
    return true;
  }
  /* called by world-ocean.js once, when the sea's materials exist and before any of them is compiled */
  function sea({ THREE, scene, water, islands, mobilePerformance, small }) {
    if (off.has('sea') || !water?.isShaderMaterial) return;
    /* phones and small machines: the sea stays exactly as it was (its shaders get no extra reading); only the pictures' sharper
       reading and hairline below, which cost nothing */
    const lean = mobilePerformance || small;
    const uFineSea = { value: new THREE.Vector4(T.ripple, T.depthTone, 0, T.glintDetail) };   // small-wave light, depth tone, (free), glint detail
    if (!lean && islands?.isShaderMaterial) {
      /* the open water and the water round the islands are one sea: both or neither */
      const before = [water.fragmentShader, islands.fragmentShader];
      if (patchWater(water) && patchWater(islands)) { water.uniforms.uFineSea = islands.uniforms.uFineSea = uFineSea; state.sea = 'waves'; }
      else { [water.fragmentShader, islands.fragmentShader] = before; console.warn('flow2 fine: the sea shader has changed; its small waves are not drawn'); }
    }
    /* the four pictures (world-ocean-photos.js): one material each */
    const uFinePhoto = { value: new THREE.Vector2(T.photoBias, T.photoEdge) }, uFinePhotoEdge = { value: new THREE.Vector3(...T.photoEdgeColor) };
    for (const mesh of scene?.children || []) {
      const m = mesh.material;
      if (!m?.isShaderMaterial || !m.uniforms?.uPhoto || !m.uniforms.uBend || !PHOTO.every(([a]) => once(m.fragmentShader, a))) continue;
      let f = m.fragmentShader; for (const [a, b] of PHOTO) f = f.replace(a, b);
      m.fragmentShader = 'uniform vec2 uFinePhoto;\nuniform vec3 uFinePhotoEdge;\n' + f;
      m.uniforms.uFinePhoto = uFinePhoto; m.uniforms.uFinePhotoEdge = uFinePhotoEdge; m.needsUpdate = true; state.photos++;
    }
  }

  /* ---------------------------------------------------------------- 2. the news cards (CARDS)
     The strip is the live site's OGL slider (prototypes/index1-5/js/portfolio-slider-firstpass.js), shared and read-only here, and
     the page passes nothing of its look through. So the three changes are made on the strip's own WebGL context, as the slider
     hands its shaders and pictures to the browser: three exact lines of its shaders are replaced (a shader that does not contain
     the line is passed on untouched, so a changed slider simply looks as it did), and its photographs get reduced copies.
     Only the canvas inside .fi-portfolio is touched; nothing global is patched. */
  const CARD_SHADERS = [
    /* the trail buffer: at rest it held an enlarged copy of every card at 60 %; now it empties as the strip comes to rest. While the
       cards are still flying in from the sea (uKeep under 1: the bridge, which is not this file's to change) it is as it was */
    ['float alphaMult = mix(0.6, 0.95, uScaleFactor);', `float alphaMult = mix(0.6, 0.95, uScaleFactor) * mix(1.0, smoothstep(0.0, ${T.cardRest.toFixed(3)}, uScaleFactor), uKeep);`],
    /* the ground: no grain that changes every frame (the grain darkened it by 0–3.5 %: its average is kept, so the tone is the same) */
    ['vec3 ground = fiGrade(uBase) - random(uvRandom) * 0.035;', 'vec3 ground = fiGrade(uBase) - 0.0175;'],
    /* the sharp cards over their trails: a keyline on the outermost pixel of each card, once the mist of the bridge has closed */
    ['vec3 strip = (f.rgb * f.a + b.rgb * b.a * (1.0 - f.a)) / max(sa, 1e-4);', `vec3 strip = (f.rgb * f.a + b.rgb * b.a * (1.0 - f.a)) / max(sa, 1e-4);
  vec2 f2px = vUv / gl_FragCoord.xy;
  float f2n = min(min(texture2D(tImage, vUv + vec2(f2px.x, 0.0)).a, texture2D(tImage, vUv - vec2(f2px.x, 0.0)).a), min(texture2D(tImage, vUv + vec2(0.0, f2px.y)).a, texture2D(tImage, vUv - vec2(0.0, f2px.y)).a));
  strip = mix(strip, vec3(${T.cardLineColor.map(v => v.toFixed(3)).join(', ')}), f.a * (1.0 - f2n) * ${T.cardLine.toFixed(3)} * smoothstep(0.9, 1.0, uMist));`],
    /* a card's picture, read from its reduced copies */
    ['vec4 c = texture2D(tImage, vec2(vUv.x, .5 + (vUv.y - .5) * uPhotoCropY));', `vec4 c = texture2D(tImage, vec2(vUv.x, .5 + (vUv.y - .5) * uPhotoCropY), ${T.cardBias.toFixed(2)});`]
  ];
  function refineCards(gl) {
    const done = state.cards ||= { shaders: 0, pictures: 0 };
    const shaderSource = gl.shaderSource, texImage2D = gl.texImage2D;
    gl.shaderSource = function (shader, source) {
      let text = source;
      try { for (const [a, b] of CARD_SHADERS) if (typeof text === 'string' && once(text, a)) { text = text.replace(a, b); done.shaders++; } } catch { text = source; }
      return shaderSource.call(this, shader, text);
    };
    const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const pot = n => (n & (n - 1)) === 0;
    gl.texImage2D = function (...args) {
      const result = texImage2D.apply(this, args);
      try {
        const image = args[5];
        /* a photograph (the slider's stand-in and its noise field are canvases): reduced copies, read through all of them */
        if (args.length === 6 && args[0] === this.TEXTURE_2D && args[1] === 0 && image instanceof HTMLImageElement && image.naturalWidth >= 256 && (webgl2 || (pot(image.naturalWidth) && pot(image.naturalHeight)))) {
          this.generateMipmap(this.TEXTURE_2D);
          this.texParameteri(this.TEXTURE_2D, this.TEXTURE_MIN_FILTER, this.LINEAR_MIPMAP_LINEAR);
          done.pictures++;
        }
      } catch { /* the picture as the slider uploaded it */ }
      return result;
    };
  }
  function watchCards() {
    /* phones and tablets show the plain news page: there is no strip */
    if (off.has('cards') || html.hasAttribute('data-flow2-plain-news')) return;
    const hooked = new WeakSet(), refined = new WeakSet();
    const hook = canvas => {
      if (hooked.has(canvas)) return; hooked.add(canvas);
      const getContext = canvas.getContext;
      canvas.getContext = function (type, ...rest) {
        const gl = getContext.call(this, type, ...rest);
        try { if (gl && /^webgl/.test(String(type)) && !refined.has(gl)) { refined.add(gl); refineCards(gl); } } catch (error) { console.warn('flow2 fine: the news cards keep their own look', error); }
        return gl;
      };
    };
    const find = () => { for (const canvas of document.querySelectorAll('body > .fi-portfolio > canvas')) hook(canvas); };
    find();
    /* the strip's layer is put straight into <body> when its module mounts, long before it asks for its context. Only <body>'s own
       children are watched (a handful of changes in the page's life), so a strip mounted again later is caught too */
    new MutationObserver(find).observe(document.body, { childList: true });
  }
  watchCards();

  /* ---------------------------------------------------------------- 3. the film grain off the world and the news */
  if (!off.has('grain')) {
    const style = document.createElement('style');
    style.dataset.flow2FineWorld = '';
    style.textContent = `
html[data-flow2-fine-world] .alp-grain { transition: opacity .8s linear; }
@media (prefers-reduced-motion: reduce) { html[data-flow2-fine-world] .alp-grain { transition: none; } }
html[data-flow2-fine-world] body:is(.is-world, .is-portfolio) .alp-grain { opacity: 0; }
`;
    document.head.append(style);
    state.grain = true;
  }
  html.setAttribute('data-flow2-fine-world', '');

  window.__FLOW2_FINE_WORLD__ = { renderScale, sea, tune: T, get state() { return { ...state }; } };
})();
