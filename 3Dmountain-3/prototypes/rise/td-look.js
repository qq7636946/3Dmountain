/* RISE-TD · LOOK (2026-11-20). Storyboard frames 2–3 of the canyon → view-from-above transition on index1-5-canyon-forest-rise.html.
   Built to .qa/index1-5/rise-td/CONTRACT.md v1: one full-screen pass on TD-LEAD's shared renderer, no canvas and no context of its own.

   What it draws, from the page's finished picture (`source`) alone:
   · MONO    the picture drained to a neutral grey relief (contrast and lift on dials); it drains first where the sweep has passed.
   · LATTICE in the canyon: a white survey grid with contour lines, washing over from screen-left. There is no depth in `source`, so the grid
             lies on a stand-in of the canyon (a river floor and two leaning walls, placed from the camera of this very frame) and is draped
             by the picture's own light and dark, so the lines bend over the rock's forms. Sky is left clear (by the picture's colour).
             From above: the page's own draped grid (studio-3d-lines.js) is already in `source`; here it is only lifted (`grid` × gridBright).
   · CLOUDS  white cloud and mist rolling in from screen-left: three reads of ONE baked 512² tileable cloud texture (made once in warm()),
             lit from the upper right. `cloud` = 1 is a whole, opaque white-grey frame (the swap happens under it).
   sweep = cloud = mono = 0 writes `source` out unchanged.

   export createLook({ THREE, renderer, width, height, dpr, lite, quality, base }) → { tune, rows, warm(), update(f), resize(), dispose(), state }
   Debug: window.__RISE_TD_LOOK__ (the same object).
   v2 (stamp 2): warm() does every first-use job ahead of time (see there); steel tone, translucent clouds, sky kept clear; f.push; more dials. */
const TUNE = {
  gridDensity: 1,        // 1 = a line every 2.6 m on the canyon stand-in
  gridBright: .62,       // strength of the white lines
  gridWidth: 1.15,       // line width, px
  drape: 5,              // how far the picture's light/dark bends the lines (m)
  contour: .7,           // contour lines on the walls (0 = grid only)
  contourStep: 3.2,      // metres between contour lines
  ghost: .2,             // faint chart contours floating over the swept part (sky included)
  sweepSoft: .16,        // softness of the sweep's front (fraction of the width)
  sweepGlow: 1.2,        // extra light on the lines at the front
  cloudAmount: 1,        // cloud cover below full (cloud = 1 is always whole)
  cloudSpeed: 1,         // drift
  cloudSoft: .3,         // softness of cloud edges
  cloudVeil: .3,         // thin mist ahead of the clouds
  cloudScale: 1,         // size of the cloud forms
  monoContrast: 1.0,     // contrast of the drained land
  monoLift: .03,         // lift of the drained land (the client's frame 3 is a light steel grey, not black)
  monoTint: 1,           // 0 = neutral grey, 1 = cool steel (bluish shadows, near-white lights)
  monoKeep: .08,         // how much of the valley's own colour stays in the drained land
  monoRelief: .45,       // local relief: ridges brighter, gullies darker
  chanWidth: 9,          // stand-in: half width of the river floor (m)
  chanSlope: .38,        // stand-in: how far the walls lean out
  chanTop: 46,           // stand-in: wall height where the grid thins out (m)
  riverY: 0,             // world height of the river (the camera's height above it places the floor)
  monoGamma: 1.22,       // > 1 = a darker, heavier steel (the client's close-up is mid-dark, not high-key)
  monoShoulder: .78,     // highlights above this are pressed down (no paper white)
  glowCut: 1,            // how far the river light / logo ring / bright lines are held down in the drained land
  glowCeil: .5,          // … and the grey they are held to
  cloudOpacity: .78,     // partial clouds are translucent (1 = solid); cloud = 1 is always whole
  cloudBank: .5,         // the large soft bank at the lower left
  ghostSky: .15,         // how much of the floating contours may cross the sky (0 = none)
  lineEdge: 1.4          // view from above: light on the retreating front while the lines withdraw
};
const ROWS = [
  { key: 'gridDensity', label: '格線密度', min: .4, max: 3, step: .05 },
  { key: 'gridBright', label: '格線亮度', min: 0, max: 1.5, step: .01 },
  { key: 'gridWidth', label: '格線粗細（px）', min: .6, max: 3, step: .05 },
  { key: 'drape', label: '格線貼地起伏', min: 0, max: 24, step: .5 },
  { key: 'contour', label: '等高線強度', min: 0, max: 1.5, step: .01 },
  { key: 'contourStep', label: '等高線間距（m）', min: 1, max: 10, step: .1 },
  { key: 'ghost', label: '浮動等高線', min: 0, max: 1, step: .01 },
  { key: 'sweepSoft', label: '掃入邊緣柔度', min: .03, max: .5, step: .01 },
  { key: 'sweepGlow', label: '掃入前緣亮度', min: 0, max: 3, step: .05 },
  { key: 'cloudAmount', label: '雲霧量', min: 0, max: 1.6, step: .01 },
  { key: 'cloudSpeed', label: '雲霧流動速度', min: 0, max: 4, step: .05 },
  { key: 'cloudSoft', label: '雲緣柔度', min: .05, max: .6, step: .01 },
  { key: 'cloudVeil', label: '薄霧', min: 0, max: 1, step: .01 },
  { key: 'cloudScale', label: '雲團大小', min: .4, max: 2.5, step: .05 },
  { key: 'monoContrast', label: '褪色後對比', min: .6, max: 2, step: .01 },
  { key: 'monoLift', label: '褪色後亮度', min: -.2, max: .3, step: .005 },
  { key: 'monoTint', label: '冷鋼灰色調', min: 0, max: 1.5, step: .01 },
  { key: 'monoKeep', label: '保留山谷原色', min: 0, max: .6, step: .01 },
  { key: 'monoGamma', label: '鋼灰深淺（>1 較深）', min: .6, max: 2, step: .01 },
  { key: 'monoShoulder', label: '亮部壓制起點', min: .4, max: 1, step: .01 },
  { key: 'glowCut', label: '河光・LOGO 亮線壓制', min: 0, max: 1, step: .01 },
  { key: 'glowCeil', label: '河光壓到的灰度', min: .2, max: .9, step: .01 },
  { key: 'cloudOpacity', label: '雲霧透明度（1＝實心）', min: .2, max: 1, step: .01 },
  { key: 'cloudBank', label: '左下大雲團', min: 0, max: 1.2, step: .01 },
  { key: 'ghostSky', label: '天空中的浮動等高線', min: 0, max: 1, step: .01 },
  { key: 'monoRelief', label: '地形明暗立體感', min: 0, max: 2.5, step: .01 },
  { key: 'lineEdge', label: '線條退場前緣亮度', min: 0, max: 4, step: .05 },
  { key: 'chanWidth', label: '峽谷河面半寬（m）', min: 3, max: 30, step: .5 },
  { key: 'chanSlope', label: '峽谷岩壁外傾', min: 0, max: 1.5, step: .01 },
  { key: 'chanTop', label: '格線上緣高度（m）', min: 8, max: 120, step: 1 }
];

const VERT = 'varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }';

/* the cloud texture, made once: R and G = two tileable cloud fields (value fbm rounded by cell noise), B = a broad field for edges and warps */
const BAKE = `
  precision highp float; varying vec2 vUv;
  float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  vec2 h22(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
  float vn(vec2 p, float per, float sd){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    float a = h21(mod(i, per) + sd), b = h21(mod(i + vec2(1., 0.), per) + sd), c = h21(mod(i + vec2(0., 1.), per) + sd), d = h21(mod(i + 1., per) + sd);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
  float wn(vec2 p, float per, float sd){ vec2 i = floor(p), f = fract(p); float m = 1.;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = h22(mod(i + g, per) + sd); m = min(m, length(g + o - f)); }
    return m; }
  float field(vec2 uv, float sd){
    float v = 0., a = .5, per = 4., w = 0., wa = .5;
    for (int i = 0; i < 6; i++) { v += a * vn(uv * per, per, sd + float(i) * 17.); a *= .5; per *= 2.; }
    per = 5.;
    for (int i = 0; i < 4; i++) { w += wa * (1. - wn(uv * per, per, sd + 91. + float(i) * 13.)); wa *= .5; per *= 2.; }
    v /= .984; w /= .9375;
    return clamp((v * .64 + w * .5 - .30) / .62, 0., 1.);
  }
  void main(){
    float b = 0., a = .5, per = 2.;
    for (int i = 0; i < 4; i++) { b += a * vn(vUv * per, per, 311. + float(i) * 7.); a *= .5; per *= 2.; }
    gl_FragColor = vec4(field(vUv, 3.), field(vUv + .37, 57.), clamp((b / .9375 - .2) / .6, 0., 1.), 1.);
  }`;

const FRAG = `
  precision highp float; varying vec2 vUv;
  uniform sampler2D tSrc, tNoise;
  uniform vec4 uRes;                    /* w, h, 1/w, 1/h in pixels */
  uniform float uTime, uSweep, uCloud, uMono, uGrid, uAerial, uCamH;
  uniform mat4 uInvProj; uniform vec3 uLx, uLy, uLz;
  uniform vec4 uG;                      /* line spacing (m), brightness, width (px), drape (m) */
  uniform vec4 uC;                      /* contour strength, contour step (m), ghost contours, sweep softness */
  uniform vec4 uK;                      /* cloud amount, cloud softness, veil, mono contrast */
  uniform vec4 uCh;                     /* floor half width, wall lean, wall top, mono lift */
  uniform vec4 uT;                      /* cool steel tint, colour kept, relief, lens push */
  uniform vec4 uX;                      /* glow ceiling, glow cut, highlight shoulder, gamma */
  uniform vec4 uQ;                      /* cloud opacity, lower-left bank, ghost in sky, - */
  uniform vec4 uM;                      /* front glow, cloud scale, cloud drift (already × speed), - */
  float lumOf(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
  float aaLine(float x, float wpx){ float fw = fwidth(x), d = abs(fract(x - .5) - .5);
    return (1. - smoothstep(fw * wpx * .5, fw * (wpx * .5 + 1.), d)) * (1. - smoothstep(.16, .5, fw)); }
  void main(){
    vec2 sUv = (vUv - vec2(.5, .46)) / (1. + uT.w) + vec2(.5, .46);                    /* TD-LEAD's lens push under the clouds (0 = none) */
    vec3 src = texture2D(tSrc, sUv).rgb;
    float lum = lumOf(src), aspect = uRes.x / uRes.y;
    vec2 p = vec2(vUv.x * aspect, vUv.y);
    vec3 nz = texture2D(tNoise, p * .19 + vec2(.13, .37)).rgb;

    /* ---- the sweep, from screen-left: cov 0 → 1 behind a soft, uneven front ---- */
    float sField = max(vUv.x * .86 + (nz.b - .5) * .30 + (1. - vUv.y) * .06 + .07, .02);
    float sPos = uSweep * 1.34;
    float cov = smoothstep(0., uC.w, sPos - sField);
    float rim = exp(-pow((sPos - sField - uC.w * .45) / (uC.w * .8), 2.)) * step(.001, uSweep) * (1. - smoothstep(.88, 1., uSweep));
    cov = max(cov, uAerial);

    /* ---- the drained land (UPDATE 2: not black and white — the valley drained to a cool steel grey, strong lit relief) ---- */
    vec2 px = uRes.zw * 9.;
    float l1 = lumOf(texture2D(tSrc, sUv + px).rgb), l2 = lumOf(texture2D(tSrc, sUv - px).rgb);
    float l3 = lumOf(texture2D(tSrc, sUv + px * vec2(1., -1.)).rgb), l4 = lumOf(texture2D(tSrc, sUv + px * vec2(-1., 1.)).rgb);
    float lb = (lum * 2. + l1 + l2 + l3 + l4) / 6.;
    float rng = max(max(l1, l2), max(l3, l4)) - min(min(l1, l2), min(l3, l4));
    float g = (lum - .5) * uK.w + .5 + uCh.w + (lum - lb) * uT.z * 2.2;                 /* relief: ridges brighter, gullies darker than their surroundings */
    g = clamp(g, 0., 1.);
    /* v2: the river light and the logo ring (saturated blue light in the picture) and the page's own grid lines must not turn into white strokes */
    float glow = smoothstep(.10, .34, src.b - src.r) * smoothstep(.34, .72, lum);
    g = mix(g, min(g, uX.x + (g - uX.x) * .25), glow * uX.y);
    g = min(g, uX.z + (g - uX.z) * .35 + step(g, uX.z) * (g - uX.z) * .65);            /* soft shoulder: nothing blows out to paper white */
    g = pow(g, uX.w);
    vec3 steel = mix(vec3(.060, .078, .105), vec3(.86, .90, .955), g);                 /* cool shadows, silver lights */
    steel = mix(vec3(g), steel, uT.x);
    steel = mix(steel, steel * (src / max(lum, .04)), uT.y * (1. - g * .6));           /* a breath of the valley's own colour stays in it */
    float mLoc = clamp(uMono * (.55 + .9 * cov), 0., 1.);
    vec3 col = mix(src, clamp(steel, 0., 1.), mLoc);

    /* ---- the lattice in the canyon ---- */
    if (uAerial < .5 && cov > .002) {
      vec4 v4 = uInvProj * vec4(vUv * 2. - 1., 1., 1.); vec3 dc = normalize(v4.xyz / v4.w);
      vec3 d = vec3(dot(uLx, dc), dot(uLy, dc), dot(uLz, dc));                          /* x right, y up, z along the canyon */
      float h = uCamH, w0 = uCh.x, k = uCh.y;
      float tf = d.y < -1e-4 ? -h / d.y : 1e5;
      float s = d.x >= 0. ? 1. : -1., den = d.x - s * k * d.y;
      float tw = s * den > 1e-4 ? s * (w0 + k * h) / den : 1e5;
      float t = min(tf, tw); vec3 hp = d * t; float hy = hp.y + h, wall = step(tw, tf);
      /* the drape: broad forms fixed to the stand-in's surface (they travel with the land, not with the screen) + a little of the picture's light */
      float u0 = mix(abs(hp.x), w0 + hy * sqrt(1. + k * k), wall), s0 = hp.z + s * 37.;
      vec3 bump = texture2D(tNoise, vec2(u0, s0) * .011).rgb;
      float rel = ((bump.b - .5) * 1.4 + (bump.r - .5) * .35 + (lb - .3) * .04) * uG.w * mix(.3, 1., wall);
      float u = u0 + rel * .8;
      float vv = hp.z + (bump.g - .5) * uG.w * mix(.2, .7, wall);
      float grid = max(aaLine(u / uG.x, uG.z), aaLine(vv / uG.x, uG.z));
      float ct = wall * aaLine((hy + rel * 1.1) / uC.y, uG.z * 1.1);
      float top = 1. - smoothstep(uCh.z * .6, uCh.z, hy + (nz.g - .5) * uCh.z * .6);
      float sky = max(smoothstep(.30, .42, lb) * smoothstep(.05, .12, src.b - src.r), smoothstep(.40, .54, lb) * (1. - smoothstep(.10, .24, rng)));
      sky = max(sky, smoothstep(.36, .46, min(min(l1, l2), min(l3, l4))));
      sky = max(sky, smoothstep(.10, .17, src.b - src.r) * smoothstep(.25, .33, lb)) * smoothstep(-.03, .03, d.y);   /* above the horizon only: the river keeps its lines */              /* v2: bright all round = sky, whatever its colour */
      float m = top * (1. - sky) * (1. - smoothstep(140., 460., t)) * mix(.55, 1., wall) * step(t, 9e4);
      float lit = mix(.5, 1.2, smoothstep(.04, .55, lb));
      float gf = texture2D(tNoise, p * .105 + vec2(.41, .12)).b * 11. + vUv.y * 1.6;
      float ghost = aaLine(gf, 1.1) * uC.z * .5 * (1. - sky * (1. - uQ.z)) * smoothstep(.98, .80, vUv.y);
      float L = ((grid * .8 + ct * uC.x) * m * lit + ghost) * cov * (1. + rim * uM.x) * uG.y;
      col += vec3(.93, .965, 1.) * L * (1. - col * .35);
    }

    /* ---- clouds and mist, from screen-left ---- */
    if (uCloud > .0005) {
      float full = smoothstep(.55, .99, uCloud);
      float bank = (1. - smoothstep(.0, .62, length((vUv - vec2(.10, .22)) * vec2(1.25, 1.5)))) * uQ.y * smoothstep(.0, .22, uCloud);   /* a large soft bank, lower left */
      float c = pow(uCloud, 1.1) * 1.25 * uK.x - vUv.x * .9 - (vUv.y - .35) * .42 + (nz.b - .5) * .22 + bank;
      vec2 q = p / uM.y, drift = vec2(-uM.z, uM.z * .18);
      vec2 warp = (texture2D(tNoise, q * .23 + drift * .4).gb - .5) * .10;
      vec2 q1 = q * .34 + warp + drift * 1. + vec2(-uCloud * .30, .07), q2 = q * .83 + warp * 1.6 + drift * 1.7 + vec2(-uCloud * .46, .31);
      float d1 = texture2D(tNoise, q1).r, d2 = texture2D(tNoise, q2).g, d3 = texture2D(tNoise, q * 2.1 + warp * 2. + drift * 2.6).r;
      float dn = d1 * .72 + d2 * .22 + d3 * .06;
      float th = 1. - c * 1.12;
      float a = smoothstep(th, th + uK.y * 2., dn); a *= a;                    /* v2: long soft edges */
      a = max(a, smoothstep(.1, 1.3, c) * uK.z * (.45 + .55 * d1));          /* the thin mist ahead */
      a *= uQ.x;                                                             /* v2: translucent — the land and its grid show through */
      a = clamp(a + (1. - a) * pow(full, 2.2), 0., 1.);                      /* thickens evenly from cloud .5; whole only at ≈ 1 */
      vec2 sun = vec2(.035, .028);
      float sh = texture2D(tNoise, q1 + sun).r * .72 + texture2D(tNoise, q2 + sun * 1.6).g * .22 + d3 * .06;
      float light = clamp(.62 + (dn - sh) * 2.6 + (dn - .5) * .3, 0., 1.);
      vec3 cc = mix(vec3(.70, .73, .775), vec3(.945, .95, .955), light);
      cc = mix(cc, vec3(lumOf(cc)) * vec3(.985, .995, 1.01), clamp(uMono, 0., 1.) * .8);
      col = mix(col, cc, a);
    }
    gl_FragColor = vec4(col, 1.);
  }`;

/* ---- UPDATE 1 (client: 「轉到定位後 3Dline就退掉」): the survey lines of the view from above withdraw, amount 1 → 0 ----
   Those lines are the page's own draped grid (the mesh 'Studio 3D Line Grid' of studio-3d-lines.js, drawn with depth in the page's picture), so the
   withdrawal is done ON that material, at run time, on this page only: one added uniform uTdLine. The lines let go of the crests and the far
   land first and run down the slopes into the valleys, a bright edge at the retreating front, and last leave the rivers and the lake.
   amount 1 = exactly as the page draws them; 0 = nothing drawn. If the material cannot be extended, its uAlpha is scaled instead (a plain fade). */
const LINE_NAME = 'Studio 3D Line Grid';
const lineState = { mesh: null, mode: 'none', amount: 1, alpha0: null, ready: false };
function findLines(patch) {
  if (lineState.mesh && lineState.mesh.parent && (lineState.mode !== 'none' || !patch)) return lineState.mesh;
  let A = null; try { A = window.__FLOW2_FOREST_ATLAS__ && window.__FLOW2_FOREST_ATLAS__.scene; } catch (error) { return null; }
  const m = A && A.scene && A.scene.getObjectByName ? A.scene.getObjectByName(LINE_NAME) : null;
  if (!m || !m.material || !m.material.uniforms) return null;
  lineState.mesh = m;
  const mt = m.material, lake = A.lake && A.lake.center;
  if (mt.uniforms.uTdLine) { lineState.mode = 'retract'; return m; }
  if (!patch) return m;   /* v2: the material is extended only ahead of time (prepareLines), never in a drawn frame: a new program there cost one ≈5 s frame */
  if (!mt.uniforms.uTdLine) {
    const mark = 'if (baseA < 0.004) discard;';
    if (typeof mt.fragmentShader === 'string' && mt.fragmentShader.includes(mark) && mt.fragmentShader.includes('varying float vLit, vWet, vMinor, vH, vOutFade;')) {
      mt.uniforms.uTdLine = { value: 1 }; mt.uniforms.uTdLake = { value: [lake ? lake.x : .12, lake ? lake.z : -.06] }; mt.uniforms.uTdEdge = { value: 1.4 };
      mt.fragmentShader = mt.fragmentShader
        .replace('varying float vLit, vWet, vMinor, vH, vOutFade;', 'varying float vLit, vWet, vMinor, vH, vOutFade;\n  uniform float uTdLine, uTdEdge; uniform vec2 uTdLake;')
        .replace(mark, `{ /* RISE-TD LOOK: the withdrawal */
      float tdE = clamp(vH / .5, 0., 1.) * .6 + clamp(length(vW.xz - uTdLake) / 10., 0., 1.) * .4;
      tdE = clamp(tdE + (fract(sin(dot(floor(vW.xz * 7.), vec2(127.1, 311.7))) * 43758.5453) - .5) * .05, 0., 1.);
      float tdT = uTdLine * 1.3 - .3;
      float tdK = 1. - smoothstep(tdT, tdT + .3, tdE);
      float tdB = exp(-pow((tdE - tdT - .12) / .09, 2.)) * step(uTdLine, .999) * step(.001, uTdLine);
      baseA *= tdK * (1. + tdB * uTdEdge);
    }
    ` + mark);
      mt.needsUpdate = true; lineState.mode = 'retract';
    } else { lineState.mode = 'fade'; }
  } else lineState.mode = 'retract';
  return m;
}
/* amount 0…1 of the survey lines in the view from above. Safe to call every frame; does nothing off this page's view from above. */
export function setLines(amount) {
  const a = Math.min(1, Math.max(0, Number.isFinite(+amount) ? +amount : 1));
  lineState.amount = a;
  const m = findLines(false); if (!m) return false;
  const u = m.material.uniforms;
  if (lineState.mode === 'retract') u.uTdLine.value = a;
  else if (lineState.mode === 'none') return false;   /* not extended yet: the page's own opacity (TD-LEAD drives it) is all there is */
  else if (u.uAlpha) {   /* plain fade: the page's own opacity dial × amount (re-read whenever the page set it again) */
    if (lineState.alpha0 == null || Math.abs(u.uAlpha.value - lineState.alpha0 * lineState.applied) > 1e-4) lineState.alpha0 = u.uAlpha.value;
    lineState.applied = a; u.uAlpha.value = lineState.alpha0 * a;
  }
  m.visible = a > .001;
  return true;
}

export function createLook({ THREE, renderer, width = 1, height = 1, dpr = 1, lite = false, quality = 'high' } = {}) {
  const tune = { ...TUNE };
  const state = { stage: 'new', frames: 0, noise: 0, lite: !!lite, quality };
  const NS = lite || quality === 'low' ? 256 : 512;
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), scene = new THREE.Scene();
  const noiseRT = new THREE.WebGLRenderTarget(NS, NS, { depthBuffer: false, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping });
  noiseRT.texture.colorSpace = THREE.NoColorSpace;
  const bakeMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: BAKE, depthTest: false, depthWrite: false, toneMapped: false });
  const U = {
    tSrc: { value: null }, tNoise: { value: noiseRT.texture }, uRes: { value: new THREE.Vector4(1, 1, 1, 1) },
    uTime: { value: 0 }, uSweep: { value: 0 }, uCloud: { value: 0 }, uMono: { value: 0 }, uGrid: { value: 1 }, uAerial: { value: 0 }, uCamH: { value: 2.8 },
    uInvProj: { value: new THREE.Matrix4() }, uLx: { value: new THREE.Vector3(1, 0, 0) }, uLy: { value: new THREE.Vector3(0, 1, 0) }, uLz: { value: new THREE.Vector3(0, 0, -1) },
    uG: { value: new THREE.Vector4() }, uC: { value: new THREE.Vector4() }, uK: { value: new THREE.Vector4() }, uCh: { value: new THREE.Vector4() }, uM: { value: new THREE.Vector4() }, uT: { value: new THREE.Vector4() }, uX: { value: new THREE.Vector4() }, uQ: { value: new THREE.Vector4() }
  };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(tri, mat); mesh.frustumCulled = false; scene.add(mesh);
  let baked = false, w = width, h = height, pr = dpr, drift = 0;
  const clamp01 = v => Math.min(1, Math.max(0, +v || 0)), num = (v, d) => Number.isFinite(+v) ? +v : d;
  const fwd = new THREE.Vector3(), lr = new THREE.Vector3(), X = new THREE.Vector3(), Y = new THREE.Vector3(), Z = new THREE.Vector3();

  function bake() {
    if (baked) return;
    const prev = renderer.getRenderTarget();
    mesh.material = bakeMat; renderer.setRenderTarget(noiseRT); renderer.render(scene, cam);
    mesh.material = mat; renderer.setRenderTarget(prev);
    baked = true; state.noise = NS;
  }
  /* v2 · no first-use work in a drawn frame. A program's key holds the output colour space of the target it is drawn to, so each program is
     compiled for BOTH kinds of target (the screen and a render target), without blocking (compileAsync), and only then drawn once into 4 px. */
  const tiny = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false });
  const compileFor = (target, material, sc, cm) => {
    const prev = renderer.getRenderTarget(), keep = mesh.material; let p = null;
    try { if (material) mesh.material = material; renderer.setRenderTarget(target); p = renderer.compileAsync ? renderer.compileAsync(sc || scene, cm || cam) : null; }
    catch (error) { state.warmNote = String(error && error.message || error); }
    finally { mesh.material = keep; renderer.setRenderTarget(prev); }
    return Promise.resolve(p).catch(() => { });
  };
  let linesBusy = false, linesTimer = 0, lastDraw = 0;
  async function prepareLines() {
    if (linesBusy || lineState.ready) return lineState.ready;
    let A = null; try { A = window.__FLOW2_FOREST_ATLAS__ && window.__FLOW2_FOREST_ATLAS__.scene; } catch (error) { }
    if (!A || !A.scene || !A.camera || !A.scene.getObjectByName(LINE_NAME)) return false;
    linesBusy = true;
    const t0 = performance.now();
    try {
      const m = findLines(true); if (!m || lineState.mode !== 'retract') { lineState.ready = true; return true; }
      /* the view from above is drawn by the page into a render target with no tone mapping: compile the extended material for exactly that */
      const withState = fn => { const prev = renderer.getRenderTarget(), tone = renderer.toneMapping, sh = renderer.shadowMap.autoUpdate, ac = renderer.autoClear; let out;
        try { renderer.toneMapping = THREE.NoToneMapping; renderer.shadowMap.autoUpdate = false; renderer.setRenderTarget(tiny); out = fn(); }
        finally { renderer.toneMapping = tone; renderer.shadowMap.autoUpdate = sh; renderer.autoClear = ac; renderer.setRenderTarget(prev); } return out; };
      /* only the line material: a stand-in object in a scene of its own (same geometry and material = same program), never the whole view */
      const tmp = new THREE.Scene(), proxy = new THREE.LineSegments(m.geometry, m.material); proxy.frustumCulled = false; tmp.add(proxy);
      await Promise.resolve(withState(() => renderer.compileAsync ? renderer.compileAsync(tmp, A.camera) : null)).catch(() => { });
      withState(() => { const keep = m.material.uniforms.uTdLine.value; m.material.uniforms.uTdLine.value = .5;
        try { renderer.render(tmp, A.camera); } catch (error) { state.warmNote = 'lines draw: ' + (error && error.message || error); } finally { m.material.uniforms.uTdLine.value = keep; tmp.remove(proxy); } });
      lineState.ready = true; state.linesWarmMs = Math.round(performance.now() - t0);
    } catch (error) { state.warmNote = 'lines: ' + (error && error.message || error); }
    finally { linesBusy = false; lineState.ready = true; if (linesTimer) { clearInterval(linesTimer); linesTimer = 0; } }   /* once only, whatever happened */
    state.linesMode = lineState.mode;
    return true;
  }
  function watchLines() {   /* the view from above may not exist yet when warm() runs: keep looking, and do the work between transitions only */
    if (lineState.ready || linesTimer) return;
    let tries = 0;
    linesTimer = setInterval(() => { if (lineState.ready || ++tries > 400) { clearInterval(linesTimer); linesTimer = 0; return; } if (performance.now() - lastDraw > 600) prepareLines().catch(() => { }); }, 500);
  }
  async function warm() {
    const t0 = performance.now();
    await compileFor(noiseRT, bakeMat);
    bake();
    await Promise.all([compileFor(null, mat), compileFor(tiny, mat)]);
    /* one 4 px draw per target kind, canyon and aerial branch both (uniform branches, one program) */
    { const prev = renderer.getRenderTarget(), ac = renderer.autoClear; try { renderer.autoClear = false; U.tSrc.value = noiseRT.texture; U.uSweep.value = U.uCloud.value = U.uMono.value = .5; renderer.setRenderTarget(tiny); renderer.render(scene, cam); } catch (error) { } finally { renderer.autoClear = ac; renderer.setRenderTarget(prev); U.tSrc.value = null; } }
    try { if (!(await prepareLines())) watchLines(); } catch (error) { watchLines(); }
    state.stage = 'ready'; state.warmMs = Math.round(performance.now() - t0);
  }
  function setCamera(camera) {
    if (!camera) return;
    U.uInvProj.value.copy(camera.projectionMatrixInverse);
    const e = camera.matrixWorld.elements;
    X.set(e[0], e[1], e[2]).normalize(); Y.set(e[4], e[5], e[6]).normalize(); Z.set(e[8], e[9], e[10]).normalize();
    fwd.set(-Z.x, 0, -Z.z); if (fwd.lengthSq() < 1e-6) fwd.set(Y.x, 0, Y.z); fwd.normalize();
    lr.set(-fwd.z, 0, fwd.x);
    U.uLx.value.set(lr.dot(X), lr.dot(Y), lr.dot(Z)); U.uLy.value.set(X.y, Y.y, Z.y); U.uLz.value.set(fwd.dot(X), fwd.dot(Y), fwd.dot(Z));
    U.uCamH.value = Math.max(.6, e[13] - num(tune.riverY, 0));
  }
  function update(f) {
    if (!f || !f.source) return;
    if (!baked) bake();
    lastDraw = performance.now();
    const r = f.renderer || renderer, T = tune;
    const W = Math.max(1, Math.round(num(f.width, w) * num(f.dpr, pr))), H = Math.max(1, Math.round(num(f.height, h) * num(f.dpr, pr)));
    U.tSrc.value = f.source; U.uRes.value.set(W, H, 1 / W, 1 / H);
    const aerial = f.scene === 'aerial';
    U.uAerial.value = aerial ? 1 : 0;
    U.uSweep.value = clamp01(f.sweep); U.uCloud.value = clamp01(f.cloud); U.uMono.value = clamp01(f.mono); U.uGrid.value = f.grid == null ? 1 : clamp01(f.grid);
    if (!aerial) setCamera(f.camera);
    /* UPDATE 1: the lines' amount. f.lines if TD-LEAD hands it, else f.grid; in the canyon the page's lines are put back whole (nobody sees them). */
    { const la = f.lines != null ? clamp01(f.lines) : (f.grid == null ? 1 : clamp01(f.grid)); setLines(aerial ? la : 1); state.lines = lineState.amount; state.linesMode = lineState.mode;
      if (lineState.mesh && lineState.mesh.material.uniforms.uTdEdge) lineState.mesh.material.uniforms.uTdEdge.value = num(T.lineEdge, 1.4); }
    const time = f.reduced ? 0 : num(f.time, 0);
    drift = time * .012 * num(T.cloudSpeed, 1);
    U.uTime.value = time;
    U.uG.value.set(2.6 / Math.max(.2, num(T.gridDensity, 1)), num(T.gridBright, .6), Math.max(.5, num(T.gridWidth, 1.15)) * Math.max(1, num(f.dpr, pr)) * .8, num(T.drape, 9));
    U.uC.value.set(num(T.contour, .7), Math.max(.4, num(T.contourStep, 3.2)), num(T.ghost, .2), Math.max(.02, num(T.sweepSoft, .16)));
    U.uK.value.set(num(T.cloudAmount, 1), Math.max(.03, num(T.cloudSoft, .3)), num(T.cloudVeil, .3), num(T.monoContrast, 1));
    U.uCh.value.set(Math.max(1, num(T.chanWidth, 9)), num(T.chanSlope, .38), Math.max(4, num(T.chanTop, 46)), num(T.monoLift, .03));
    U.uT.value.set(num(T.monoTint, 1), num(T.monoKeep, .08), num(T.monoRelief, .45), Math.max(0, num(f.push, 0)));
    U.uX.value.set(num(T.glowCeil, .5), num(T.glowCut, 1), num(T.monoShoulder, .78), Math.max(.3, num(T.monoGamma, 1.22)));
    U.uQ.value.set(Math.min(1, Math.max(0, num(T.cloudOpacity, .78))), num(T.cloudBank, .5), num(T.ghostSky, .15), 0);
    U.uM.value.set(num(T.sweepGlow, 1.2), Math.max(.2, num(T.cloudScale, 1)), drift, 0);
    r.setRenderTarget(f.target || null);
    r.render(scene, cam);
    state.frames++; state.scene = f.scene; state.last = { sweep: U.uSweep.value, cloud: U.uCloud.value, mono: U.uMono.value, grid: U.uGrid.value };
  }
  function resize(nw, nh, nd) { w = nw; h = nh; pr = nd || pr; }
  function dispose() { if (linesTimer) clearInterval(linesTimer); tiny.dispose(); tri.dispose(); mat.dispose(); bakeMat.dispose(); noiseRT.dispose(); if (window.__RISE_TD_LOOK__ === api) delete window.__RISE_TD_LOOK__; }
  const api = { tune, rows: ROWS, state, warm, update, resize, dispose, setLines };
  try { window.__RISE_TD_LOOK__ = api; } catch (error) { /* no window */ }
  return api;
}
export default createLook;
