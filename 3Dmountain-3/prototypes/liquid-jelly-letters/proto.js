/* =====================================================================
   Prototype — liquid jelly letters and water drops, two separate groups.
   Stand-alone (not part of the site). It shows the material and the
   motion relationship the client asked for (brief of 2026-10-20):
     · the letters are soft, wet, translucent jelly: rounded (no cut edges),
       glossy, tinted body, readable outline; they lag, wobble and spring
       back when they speed up, slow down or turn
     · the drops are separate clear water: their own spin axes and speeds,
       their own spiral, refraction of whatever is behind them (letters too)
     · drops start first; then the letters spiral IN (client, 2026-10-20:
       "螺旋字進來，不是字出去"): each comes out of the haze along its own,
       offset spiral (F first), turning on its own and facing the viewer as
       it nears; it lands in a widely spaced row with a soft-body rebound,
       and the spacing closes into the word; drops pass in front of and
       behind the letters, then clear the focus; the word stays (which
       also keeps the wordmark the next chapter's fly-through needs)
     · letter material, two selectable looks (client, 2026-10-20, "字體
       幫我更改這種樣子" — "Liquid Glass Typography"): a LIQUID-GLASS body
       (clear, sharp real refraction, thin bevel, a flowing surface ripple,
       a bright thick-edge rim, sparse fixed bubble/caustic flecks — no
       ice, no milky jelly, no flat opaque white) alongside the original
       JELLY body, switchable live for comparison; no Blender/CGI pipeline
       is available here, so both are built the same way as the rest of
       this prototype — procedural geometry + a physical-material shader
     · production polish pass (client, 2026-10-20: "動作所有都不夠符合AWW
       FWA等級的特效 還有液態3D還不夠好" — not Awwwards/FWA-grade yet, and
       the liquid 3D itself needed to read better): a custom studio
       environment (defined softbox streaks, not a flat generic HDRI) for
       real reflection shape; a sweeping specular highlight + layered
       multi-octave ripple + stronger fresnel/dispersion on the liquid
       shader; a cinematic camera drift tied to scroll; soft background
       bokeh for depth; a post pipeline (bloom, chromatic aberration,
       vignette, grain, a light split-tone grade); and Disney-principle
       choreography on the letters — an organic (not metronomic) stagger,
       decelerating entrance easing, and a small analytic landing
       overshoot/settle (the Fluid-material ~5% budget, not a playful
       bounce) — see .claude/skills/motion-design
     · reference-image match (client, 2026-10-20, pasted a chrome/glass "O"
       with high-contrast banded studio reflections + resting droplets):
       the environment became a zebra-striped equirect (alternating
       bright/dark bands, like the reference's reflections) instead of a
       few soft panels; LIQUID_GLASS pushed more reflective/chrome (lower
       roughness, higher envMapIntensity/ior); the orbiting drops were
       NOT changed (they already follow index1-1's own ball-lens drop
       style, per the client's note to keep that); three of the shader's
       former magic numbers (ripple base amount, sweep strength, bubble
       strength) became live uniforms, and a 進階參數 slider panel now
       exposes all of this (plus the standard PBR fields) for the client
       to dial in directly, per "或是有參數可以開給我"
   Everything is a function of one scroll clock (forward and backward);
   only the soft-body wobble is integrated in time, so it also answers to
   scrubbing. One GSAP timeline holds the stages.
   ===================================================================== */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import * as GSAP from 'https://cdn.jsdelivr.net/npm/gsap@3.13.0/+esm';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
const gsap = GSAP.gsap || GSAP.default;

const SVG_URL = '../../images/text_logo3.svg';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const rng = seed => { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

/* ---------- stage ---------- */
const canvas = document.createElement('canvas'); document.body.prepend(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = (() => {   // the site's pale ice-blue plate
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#f1f5fa'); grad.addColorStop(.55, '#dde7f1'); grad.addColorStop(1, '#c8d7e6');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
scene.fog = new THREE.Fog('#dbe5ef', 10, 17);
// a zebra-striped studio environment — alternating bright/dark horizontal bands, like a softbox
// array — instead of a few soft panels: this is what actually produces the high-contrast banded
// reflections in the client's reference image (a chrome/glass "O"), where a flat or gently-graded
// HDRI only ever gives a dull, shapeless sheen
function zebraEnvTexture() {
  const w = 512, h = 256;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#e4ecf3'); sky.addColorStop(.5, '#aebdcd'); sky.addColorStop(1, '#8798ac');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  const bands = [   // [from, to, color] as a fraction of height — widths and gaps varied, like a studio light-box array
    [.28, .315, '#ffffff'], [.32, .328, '#36506e'], [.335, .375, '#f3f8fc'], [.38, .386, '#2c415d'],
    [.395, .455, '#ffffff'], [.46, .466, '#27405e'], [.475, .535, '#eef5fa'], [.54, .546, '#3c5775'],
    [.555, .615, '#ffffff'], [.62, .627, '#203754'], [.635, .685, '#e5eef6'], [.69, .696, '#4a6887']
  ];
  for (const [a, b, color] of bands) { g.fillStyle = color; g.fillRect(0, a * h, w, (b - a) * h); }
  const hot = g.createRadialGradient(w * .27, h * .4, 0, w * .27, h * .4, w * .18);
  hot.addColorStop(0, 'rgba(255,255,255,.95)'); hot.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hot; g.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(zebraEnvTexture()).texture;
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, .1, 80);
camera.position.set(0, .2, 11); camera.lookAt(0, .35, 0);
const key = new THREE.DirectionalLight('#ffffff', 1.4); key.position.set(-3, 5, 6); scene.add(key);
scene.add(new THREE.HemisphereLight('#f6f9fc', '#b6c6d5', .5));
const rim = new THREE.DirectionalLight('#bcd9ea', .8); rim.position.set(2.5, 1.2, -4); scene.add(rim);   // a cool contour light from behind — the silver-grey/pale-cyan edge the liquid-glass look wants
// one stage for both groups, scaled down on narrow screens so the word always fits
const stage = new THREE.Group(); scene.add(stage);
const dropScene = new THREE.Scene(), dropStage = new THREE.Group(); dropScene.add(dropStage);
const fitStage = () => { const k = Math.min(1, Math.sqrt(camera.aspect / 1.55)); for (const s of [stage, dropStage]) { s.scale.setScalar(k); s.position.y = (1 - k) * .9; } };
fitStage();

/* ---------- jelly: physical transmission + a soft-body vertex shader ---------- */
const JELLY = {
  // thickness is in the letter's own units (the wordmark's, ~32 per letter height): the full rounded depth
  color: '#ffffff', transmission: 1, thickness: 7, ior: 1.36, roughness: .04, metalness: 0,
  attenuationColor: new THREE.Color('#5aa6e8'), attenuationDistance: .24,   // a tinted body, see-through: thick parts deeper blue, thin rims clear
  clearcoat: 1, clearcoatRoughness: .03, specularIntensity: 1, envMapIntensity: 1.3,
  sheen: .35, sheenColor: new THREE.Color('#d7ecff'), sheenRoughness: .45, dispersion: .25
};
function jellyMaterial(over = {}) {
  const m = new THREE.MeshPhysicalMaterial({ ...JELLY, ...over });
  const u = { uWob: { value: new THREE.Vector4(0, 0, 9, 0) }, uLag: { value: new THREE.Vector3() }, uH: { value: 16 } };
  m.userData.u = u;
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = 'uniform vec4 uWob; uniform vec3 uLag; uniform float uH;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      // soft body: the far ends lag behind the push (inertia), then a decaying squash–stretch (the spring-back)
      float hn = clamp(transformed.y / uH, -1.2, 1.2);
      transformed += uLag * (hn * abs(hn) * .6 + hn * .4);
      float w = uWob.x * sin(uWob.w * uWob.z + uWob.y + transformed.x * .07);
      transformed.y *= 1.0 + w;
      transformed.xz *= 1.0 - w * .55;`);
  };
  m.customProgramCacheKey = () => 'jelly-soft-body';
  return m;
}

/* ---------- liquid glass: real water-body look (client, 2026-10-20) ----------
   clear, sharp refraction (not milky), a thin rounded bevel (not a cut edge),
   a flowing surface ripple instead of a static highlight, a bright thick-edge
   rim glint, and sparse fixed bubble/caustic flecks. No ice, no jelly squash. */
const LIQUID_GLASS = {
  // pushed more reflective/chrome-glass to match the client's reference image: lower roughness,
  // a higher ior (toward glass, not pure water), much more environment pickup
  color: '#eef7fb', transmission: 1, thickness: 6.5, ior: 1.42, roughness: .008, metalness: 0,
  attenuationColor: new THREE.Color('#bfe4f2'), attenuationDistance: .8,   // nearly clear, only a faint cool cast — not a milky body
  clearcoat: 1, clearcoatRoughness: .008, specularIntensity: 1.3, envMapIntensity: 2.2,
  sheen: 0, dispersion: .55
};
function liquidMaterial(over = {}) {
  const m = new THREE.MeshPhysicalMaterial({ ...LIQUID_GLASS, ...over });
  const u = {
    uWob: { value: new THREE.Vector4(0, 0, 9, 0) }, uLag: { value: new THREE.Vector3() }, uH: { value: 16 },
    uRipple: { value: new THREE.Vector2(0, 0) },                                  // time, this letter's own flow phase
    uRim: { value: new THREE.Vector4(1, 1, 1, .9) }, uBubbleSeed: { value: 0 },
    uRippleBase: { value: .14 }, uSweepStrength: { value: 2 }, uBubbleStrength: { value: .65 }   // tunable from the 進階參數 panel
  };
  m.userData.u = u;
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = 'uniform vec4 uWob; uniform vec3 uLag; uniform float uH; uniform vec2 uRipple; uniform float uRippleBase;\nvarying vec3 vMyPos;\n'
      + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      // the same inertial lean as the jelly (far ends trail the push) — far smaller and stiffer: real water doesn't squash like jelly
      float hn = clamp(transformed.y / uH, -1.2, 1.2);
      transformed += uLag * (hn * abs(hn) * .3 + hn * .18);
      vMyPos = position;`);
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      // a flowing fluid ripple on the surface — three layered octaves (not one sine) so it reads as
      // moving water, not a fixed corrugation; an impact (uWob.x) briefly makes it choppier
      float rippleAmp = uRippleBase + uWob.x * 2.6;
      vec3 flow = vec3(0.0);
      flow += 0.55 * vec3(sin(position.y * 1.1 + uRipple.x * 1.4 + uRipple.y), cos(position.x * 1.3 - uRipple.x * 1.1 + uRipple.y * 1.7), sin((position.x + position.y) * 0.8 + uRipple.x * 0.9));
      flow += 0.30 * vec3(sin(position.x * 2.3 - uRipple.x * 0.7 + uRipple.y * 2.1), sin(position.y * 2.0 + uRipple.x * 0.5), cos((position.x - position.y) * 1.7 + uRipple.x * 1.6));
      flow += 0.15 * vec3(cos(position.y * 4.1 + uRipple.x * 2.4), sin(position.x * 3.7 - uRipple.x * 2.0 + uRipple.y), cos((position.x + position.y * 1.3) * 3.1 + uRipple.x * 1.2));
      objectNormal += rippleAmp * flow;
      objectNormal = normalize(objectNormal);`);
    shader.fragmentShader = 'uniform vec4 uRim; uniform float uBubbleSeed; uniform vec2 uRipple; uniform float uSweepStrength; uniform float uBubbleStrength;\nvarying vec3 vMyPos;\n'
      + shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>
      {
        vec3 Nf = normalize(vNormal), Vf = normalize(vViewPosition);
        float ndv = clamp(dot(Nf, Vf), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 3.0);
        gl_FragColor.rgb += fres * uRim.rgb * uRim.a;                                 // the thick, bright edge a real water body shows in profile
        // a roaming specular sweep — the single biggest "liquid glass" tell: a bright band that
        // travels across the surface as the flow (uRipple.x) advances, not a fixed highlight
        vec3 Rf = reflect(-Vf, Nf);
        vec3 sweepDir = normalize(vec3(sin(uRipple.x * 0.6 + uRipple.y), 0.68, cos(uRipple.x * 0.6 + uRipple.y)));
        float sweep = pow(max(dot(Rf, sweepDir), 0.0), 50.0);
        gl_FragColor.rgb += sweep * uSweepStrength;
        float n = fract(sin(dot(floor(vMyPos.xy * 2.2), vec2(12.9898, 78.233)) + uBubbleSeed) * 43758.5453);
        gl_FragColor.rgb += smoothstep(0.982, 1.0, n) * uBubbleStrength;              // sparse bright flecks — trapped bubbles/caustic specks, fixed to the letter
      }`);
  };
  m.customProgramCacheKey = () => 'liquid-glass';
  return m;
}

/* ---------- the letters: the wordmark's own outlines, rounded like poured jelly ---------- */
const svg = new SVGLoader().parse(await (await fetch(SVG_URL)).text());
const flipShape = s => {
  const e = s.extractPoints(12), v = pts => pts.map(p => new THREE.Vector2(p.x, -p.y));
  const shape = new THREE.Shape(v(e.shape)); for (const h of e.holes) shape.holes.push(new THREE.Path(v(h))); return shape;
};
const ROUND = { depth: 1.5, bevelEnabled: true, bevelThickness: 3.2, bevelSize: 2.1, bevelOffset: -1.3, bevelSegments: 6, curveSegments: 10 };
function letterGeometry(paths) {
  const g = new THREE.ExtrudeGeometry(paths.flatMap(p => SVGLoader.createShapes(p).map(flipShape)), ROUND);
  g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z); g.computeVertexNormals();
  return { g, c };
}
const S = .0185;                                   // wordmark units → world (the word ~4.6 wide)
const WORD_AT = new THREE.Vector3(0, .62, .25);
const word = letterGeometry(svg.paths.slice(0, 11)).c;   // the whole word's centre
let letterMode = 'liquid';   // the current direction (client, 2026-10-20); 'jelly' kept selectable for comparison
const letters = svg.paths.slice(0, 11).map((path, i) => {
  const { g, c } = letterGeometry([path]);
  const jellyMat = jellyMaterial(), liquidMat = liquidMaterial();
  const mesh = new THREE.Mesh(g, letterMode === 'liquid' ? liquidMat : jellyMat); stage.add(mesh);
  mesh.scale.setScalar(S);
  const R = rng(31 + i * 7);
  const L = {
    i, mesh, mat: mesh.material, jellyMat, liquidMat, home: new THREE.Vector3((c.x - word.x) * S, (c.y - word.y) * S, 0), h: (g.boundingBox.max.y - g.boundingBox.min.y) / 2,
    // its spiral in: how wide, how far below and how deep in the haze it starts, how many turns; its own tumble
    phase: R() * Math.PI * 2, tilt: (R() - .5) * .5, spinY: (.7 + .5 * R()) * (i % 2 ? -1 : 1),
    ring: 2.5 + .5 * R(), below: 2.3 + .5 * R(), depth: 5.2 + 1.2 * R(), turns: .95 + .35 * R(),
    state: { arrive: 0 }, prev: new THREE.Vector3(), vel: new THREE.Vector3(), lag: new THREE.Vector3(), lagV: new THREE.Vector3(), wob: 0, prevQ: new THREE.Quaternion()
  };
  jellyMat.userData.u.uH.value = L.h; liquidMat.userData.u.uH.value = L.h;
  liquidMat.userData.u.uRipple.value.y = L.phase; liquidMat.userData.u.uBubbleSeed.value = i * 7.31;
  return L;
});
// the brand-blue arc of the F rides with the F
{
  const { g, c } = letterGeometry([svg.paths[11]]);
  const arcJelly = jellyMaterial({ attenuationColor: new THREE.Color('#2a6fe0'), attenuationDistance: .15 });
  const arcLiquid = liquidMaterial({ attenuationColor: new THREE.Color('#2a6fe0'), attenuationDistance: .3 });
  arcLiquid.userData.u.uRipple.value.y = 1.7; arcLiquid.userData.u.uBubbleSeed.value = 42;
  const arc = new THREE.Mesh(g, letterMode === 'liquid' ? arcLiquid : arcJelly);
  const F = letters[0], fc = letterGeometry([svg.paths[0]]).c;
  arc.position.set(c.x - fc.x, c.y - fc.y, 0); F.mesh.add(arc); F.arc = arc; F.arcJelly = arcJelly; F.arcLiquid = arcLiquid;
}
function setLetterMode(mode) {
  letterMode = mode;
  for (const L of letters) { L.mesh.material = mode === 'liquid' ? L.liquidMat : L.jellyMat; L.mat = L.mesh.material; }
  const F = letters[0];
  if (F.arc) F.arc.material = mode === 'liquid' ? F.arcLiquid : F.arcJelly;
}
const allLiquidMats = () => [...letters.map(L => L.liquidMat), letters[0].arcLiquid];   // every liquid-glass material instance, for the 進階參數 panel
// client, 2026-10-20: "或是有參數可以開給我" — every number behind the reference-image look, live-tunable
const MAT_PARAMS = [
  { label: '粗糙度', min: 0, max: .3, step: .002, get: m => m.roughness, set: (m, v) => { m.roughness = v; } },
  { label: '折射率 IOR', min: 1, max: 1.6, step: .005, get: m => m.ior, set: (m, v) => { m.ior = v; } },
  { label: '透光', min: 0, max: 1, step: .01, get: m => m.transmission, set: (m, v) => { m.transmission = v; } },
  { label: '環境反射強度', min: 0, max: 4, step: .02, get: m => m.envMapIntensity, set: (m, v) => { m.envMapIntensity = v; } },
  { label: '清漆層', min: 0, max: 1, step: .01, get: m => m.clearcoat, set: (m, v) => { m.clearcoat = v; } },
  { label: '清漆粗糙度', min: 0, max: .3, step: .002, get: m => m.clearcoatRoughness, set: (m, v) => { m.clearcoatRoughness = v; } },
  { label: '色散', min: 0, max: 1, step: .01, get: m => m.dispersion, set: (m, v) => { m.dispersion = v; } },
  { label: '厚度', min: 0, max: 15, step: .1, get: m => m.thickness, set: (m, v) => { m.thickness = v; } },
  { label: '吸收色距離', min: .05, max: 1.5, step: .01, get: m => m.attenuationDistance, set: (m, v) => { m.attenuationDistance = v; } },
  { label: '邊緣高光', min: 0, max: 1.5, step: .01, get: m => m.userData.u.uRim.value.w, set: (m, v) => { m.userData.u.uRim.value.w = v; } },
  { label: '掃光強度', min: 0, max: 4, step: .02, get: m => m.userData.u.uSweepStrength.value, set: (m, v) => { m.userData.u.uSweepStrength.value = v; } },
  { label: '水紋幅度', min: 0, max: .4, step: .005, get: m => m.userData.u.uRippleBase.value, set: (m, v) => { m.userData.u.uRippleBase.value = v; } },
  { label: '氣泡/焦散亮度', min: 0, max: 1.5, step: .01, get: m => m.userData.u.uBubbleStrength.value, set: (m, v) => { m.userData.u.uBubbleStrength.value = v; } },
];

/* ---------- the drops: clear water, a separate group, refracting what is behind them ---------- */
const DROP_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV;
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const DROP_FRAG = /* glsl */ `
uniform sampler2D uScene; uniform vec2 uRes; uniform float uLens;
varying vec3 vN; varying vec3 vV;
void main() {
  vec3 N = normalize(vN), V = normalize(vV);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 Nv = normalize((viewMatrix * vec4(N, 0.0)).xyz);
  // a ball lens: what is behind comes through shifted and minified towards the rim, with a little dispersion
  vec2 uv = gl_FragCoord.xy / uRes, off = -Nv.xy * uLens * (.3 + .7 * (1.0 - ndv));
  vec3 refr = vec3(texture2D(uScene, uv + off * 1.03).r, texture2D(uScene, uv + off).g, texture2D(uScene, uv + off * .97).b);
  float fres = .03 + .97 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(vec3(.76, .82, .89), vec3(1.0), smoothstep(-.2, .8, R.y));
  vec3 col = mix(refr * vec3(.975, .99, 1.0), sky, fres);
  vec3 L = normalize(vec3(-.45, .65, .6)), H = normalize(L + V);
  col += pow(max(dot(N, H), 0.0), 240.0) * 1.5;                                        // the sharp sun spark
  col += smoothstep(.975, .992, dot(R, normalize(vec3(-.55, .55, .63)))) * .45;           // the soft window
  col += pow(1.0 - ndv, 2.0) * smoothstep(0.0, .7, -N.y) * .12;                          // light gathered at the foot
  gl_FragColor = vec4(col, 1.0);
}`;
const ball = new THREE.SphereGeometry(1, 48, 32);
const drops = Array.from({ length: 17 }, (_, k) => {
  const R = rng(500 + k * 13), size = .14 + .32 * Math.pow(R(), 1.2);
  const mat = new THREE.ShaderMaterial({ vertexShader: DROP_VERT, fragmentShader: DROP_FRAG, uniforms: { uScene: { value: null }, uRes: { value: new THREE.Vector2() }, uLens: { value: .02 + .07 * size } } });
  const mesh = new THREE.Mesh(ball, mat); dropStage.add(mesh);
  return {
    mesh, size, lane: k % 3 === 1 ? -2.3 : 1.45, th0: (k / 17) * Math.PI * 2 * 1.35 + R() * .4, y0: -.75 + 1.25 * (k / 17) + (R() - .5) * .35, ring: 1.9 + .7 * R(),
    climb: 4.6 + 1.4 * (1 - size / .46), turns: .55 + .45 * (1 - size / .46), delay: .06 * R(),
    spinAxis: new THREE.Vector3(R() - .5, R() - .5, R() - .5).normalize(), spin: (1.2 + 2.5 * (1 - size / .46)) * (R() < .5 ? -1 : 1), squash: .9 + .06 * R(), wobble: R() * 6
  };
});
const DROP_AXIS = new THREE.Vector2(.35, -.9), LETTER_AXIS = new THREE.Vector2(-.25, -.35);   // two axes, offset: the spirals interleave

/* ---------- soft background bokeh: foreground/background depth separation ---------- */
const bokehTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,.95)'); grad.addColorStop(.45, 'rgba(255,255,255,.28)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const bokeh = Array.from({ length: 9 }, (_, k) => {
  const R = rng(900 + k * 31);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: bokehTex, color: k % 2 ? '#bcd9ea' : '#ffffff', transparent: true, opacity: .07 + .09 * R(), blending: THREE.AdditiveBlending, depthWrite: false }));
  const sc = 1.3 + 2.6 * R(); spr.scale.set(sc, sc, 1);
  spr.position.set((R() - .5) * 9, -.6 + 2.3 * R(), -7 - 4 * R());
  scene.add(spr);
  return { spr, driftX: (R() - .5) * .025, phase: R() * Math.PI * 2 };
});
function placeBokeh(time, dt) { for (const b of bokeh) { b.spr.position.x += b.driftX * dt; b.spr.position.y += Math.sin(time * .15 + b.phase) * .0014; } }

/* ---------- the storyboard: one GSAP timeline on the scroll clock ---------- */
const T = { lift: 0, close: 0, leave: 0 };
const tl = gsap.timeline({ paused: true });
tl.to(T, { lift: 1, duration: .95, ease: 'none' }, 0)                      // the drops are moving the whole time
  .to(T, { close: 1, duration: .32, ease: 'power2.out' }, .56)             // the row's wide spacing closes into the word
  .to(T, { leave: 1, duration: .2, ease: 'power1.in' }, .82);              // the drops clear the focus; the word stays
// F leads, but the rest aren't metronomic (+2.8% per letter, exactly) — a small seeded jitter per
// letter gives an organic, hand-timed cascade instead of a robotic one; 'power3.out' is a strong,
// cinematic deceleration (Disney's slow-in/slow-out) rather than the even-handed sine.inOut
letters.forEach((L, i) => { const j = rng(777 + i * 5)() ; tl.to(L.state, { arrive: 1, duration: .4 + j * .07, ease: 'power3.out' }, .055 + i * .026 + (j - .5) * .018); });
tl.set({}, {}, 1);

/* ---------- camera: a slow cinematic drift, idle + tied to the chapter's own progress ---------- */
function placeCamera(time, p) {
  camera.position.x = Math.sin(time * .17) * .12 + Math.sin(time * .053) * .05;
  camera.position.y = .2 + Math.cos(time * .13) * .06 - p * .12;
  camera.position.z = 11 - p * 1.4 + Math.sin(time * .09) * .05;
  camera.lookAt(0, .35 + p * .04, 0);
}

/* ---------- placing it all ---------- */
const UP = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _a = new THREE.Vector3(), _inv = new THREE.Quaternion();
let jellyOn = true;
function placeDrops(time) {
  for (const d of drops) {
    const u = clamp((T.lift - d.delay) / (1 - d.delay));
    const th = d.th0 + d.turns * Math.PI * 2 * u, r = d.ring * (1 + .12 * Math.sin(u * Math.PI * 2 + d.wobble));
    d.mesh.position.set(DROP_AXIS.x + Math.cos(th) * r, d.y0 + d.climb * u * (.8 + .2 * u) + 1.5 * T.leave * T.leave, d.lane + Math.sin(th) * .4);
    // their own spin, felt through a slightly flattened, softly breathing body
    d.mesh.quaternion.setFromAxisAngle(d.spinAxis, d.spin * (u * 4 + time * .25));
    const b = 1 + .025 * Math.sin(time * 2.1 + d.wobble);
    d.mesh.scale.set(d.size * b, d.size * d.squash / b, d.size * b);
  }
}
function placeLetters(time, dt) {
  for (const L of letters) {
    const s = L.state.arrive;
    const far = 1 - smooth(.15, 1, s);                          // 1 while it is still travelling in, 0 once landed
    // a small, refined landing overshoot/settle — the Fluid-material ~5% budget (not a playful bounce):
    // it bumps past its slot and eases back, right as it lands
    const popT = smooth(.74, .97, s), pop = Math.sin(popT * Math.PI) * (1 - popT * .2);
    // its slot in the word: spacing starts wide (room to spiral into) and closes as T.close runs
    const spacing = mix(1 + .55 * Math.min(1, camera.aspect / 1.4), 1, T.close);   /* narrow screens open the spacing less */
    const row = _p.copy(L.home).setX(L.home.x * spacing).add(WORD_AT);
    row.y += .05 * Math.sin(time * 1.3 + L.phase) * (1 - far);    // once landed, the same gentle float as the rest
    // where it comes from: its own offset spiral, unwinding down into the row as it nears (F leads)
    const dx = row.x - LETTER_AXIS.x, dz = (row.z - LETTER_AXIS.y) * 2, r0 = Math.hypot(dx, dz), a0 = Math.atan2(dz, dx);
    const th = a0 - L.turns * Math.PI * 2 * far, r = mix(r0, L.ring, far);
    const dip = far * far * (3 - 2 * far);                       // eases out of the dip below as it lands
    const spiral = _a.set(LETTER_AXIS.x + Math.cos(th) * r, row.y - L.below * dip, LETTER_AXIS.y + Math.sin(th) * r * .5 - L.depth * far);
    const pos = row.lerp(spiral, far);
    pos.y += pop * .035;
    L.mesh.position.copy(pos);
    // its own 3D tumble while it travels, resolving to face the viewer once landed (then a gentle jelly wobble)
    const tumble = far;
    _e.set(L.tilt * .9 * tumble + .05 * Math.sin(time * 1.3 + L.phase) * (1 - tumble),
      L.spinY * tumble * Math.PI * 2 * 2.4,
      L.tilt * Math.sin(time * .7 + L.phase) * .3 * tumble);
    L.mesh.quaternion.setFromEuler(_e);
    L.mesh.scale.setScalar(S * mix(.55, 1, 1 - far) * (1 + pop * .045));   // smaller while still far off, full size once landed, a touch past it right on landing
    // soft body: acceleration → lag that overshoots and settles (an under-damped spring) — the jelly rebound on landing
    if (dt > 0) {
      const v = _a.copy(pos).sub(L.prev).divideScalar(dt);
      const acc = v.clone().sub(L.vel).divideScalar(dt); L.vel.copy(v); L.prev.copy(pos);
      const turn = 2 * Math.acos(clamp(Math.abs(L.prevQ.dot(L.mesh.quaternion)), 0, 1)) / dt; L.prevQ.copy(L.mesh.quaternion);
      const target = acc.multiplyScalar(-.0035).clampLength(0, .09);
      const k = 140, c = 7;   // stiffness and damping: ~1.9 Hz, rings twice before it settles
      L.lagV.addScaledVector(L.lag.clone().sub(target), -k * dt).multiplyScalar(Math.exp(-c * dt));
      L.lag.addScaledVector(L.lagV, dt);
      L.wob = Math.min(.09, L.wob * Math.exp(-2.6 * dt) + (acc.length() * .00045 + turn * .004) * dt * 60);
    }
    const u = L.mat.userData.u;
    _inv.copy(L.mesh.quaternion).invert();
    u.uLag.value.copy(L.lag).applyQuaternion(_inv).divideScalar(L.mesh.scale.x).multiplyScalar(jellyOn ? 1 : 0);
    u.uWob.value.set(jellyOn ? L.wob : 0, L.phase, 9, time);
    if (u.uRipple) u.uRipple.value.x = time;
    if (L.arc) { const au = L.arc.material.userData.u; au.uLag.value.copy(u.uLag.value); au.uWob.value.copy(u.uWob.value); au.uH.value = L.h; if (au.uRipple) au.uRipple.value.x = time; }
  }
}

/* ---------- debug: the two spirals ---------- */
const guides = new THREE.Group(); guides.visible = false; stage.add(guides);
const line = (pts, color, opacity = .7) => guides.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity })));
line([new THREE.Vector3(DROP_AXIS.x, -1.2, DROP_AXIS.y), new THREE.Vector3(DROP_AXIS.x, 4.5, DROP_AXIS.y)], '#6aa7d8');
line([new THREE.Vector3(LETTER_AXIS.x, -1.2, LETTER_AXIS.y), new THREE.Vector3(LETTER_AXIS.x, 4.5, LETTER_AXIS.y)], '#2e6fd8');
for (const d of drops.filter((_, k) => k % 3 === 0 || k % 3 === 1)) { const pts = []; for (let u = 0; u <= 1.001; u += .02) { const th = d.th0 + d.turns * Math.PI * 2 * u; pts.push(new THREE.Vector3(DROP_AXIS.x + Math.cos(th) * d.ring, d.y0 + d.climb * u * (.8 + .2 * u), d.lane + Math.sin(th) * .4)); } line(pts, '#8fb9dc', .45); }
for (const L of letters.filter((_, k) => k % 2 === 0)) { const pts = []; const dx = L.home.x * 1.55 + WORD_AT.x - LETTER_AXIS.x, dz = (WORD_AT.z - LETTER_AXIS.y) * 2, r0 = Math.hypot(dx, dz), a0 = Math.atan2(dz, dx); for (let s = 0; s <= 1.001; s += .02) { const far = 1 - s, th = a0 - L.turns * Math.PI * 2 * far, r = mix(r0, L.ring, far), dip = far * far * (3 - 2 * far); pts.push(new THREE.Vector3(LETTER_AXIS.x + Math.cos(th) * r, WORD_AT.y - L.below * dip, LETTER_AXIS.y + Math.sin(th) * r * .5 - L.depth * far)); } line(pts, '#2e6fd8', .6); }

/* ---------- post pipeline: scene+drops composited, then bloom, then a finishing grade pass ---------- */
const drawSize = new THREE.Vector2();
renderer.info.autoReset = false;
// the scene is rendered into its own dedicated target first (so the drops can sample it undistorted,
// without a read/write feedback loop against the composer's own buffer), then blitted into the
// composer's writeBuffer and the drops drawn on top of that blit
const sceneRT = new THREE.WebGLRenderTarget(innerWidth, innerHeight);
const blitQuad = new FullScreenQuad(new THREE.MeshBasicMaterial({ map: sceneRT.texture, toneMapped: false, depthTest: false }));
class SceneDropsPass extends Pass {
  render(renderer, writeBuffer) {
    renderer.getDrawingBufferSize(drawSize);
    if (sceneRT.width !== drawSize.x || sceneRT.height !== drawSize.y) sceneRT.setSize(drawSize.x, drawSize.y);
    renderer.setRenderTarget(sceneRT);
    renderer.autoClear = true; renderer.render(scene, camera);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    renderer.autoClear = true; blitQuad.render(renderer);
    for (const d of drops) { d.mesh.material.uniforms.uScene.value = sceneRT.texture; d.mesh.material.uniforms.uRes.value.copy(drawSize); }
    renderer.autoClear = false; renderer.render(dropScene, camera);
    renderer.autoClear = true;
  }
}
const FINISH_SHADER = {   // one extra pass: chromatic aberration + a light split-tone grade + vignette + film grain
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 ctr = vUv - 0.5;
      float r2 = dot(ctr, ctr);
      vec2 off = ctr * r2 * 0.012;                                               // CA, growing toward the edges
      vec3 col = vec3(texture2D(tDiffuse, vUv - off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + off).b);
      float l = dot(col, vec3(.299, .587, .114));
      col = mix(col, col * vec3(.96, .99, 1.05), smoothstep(.6, 0.0, l) * .5);     // cool shadows
      col = mix(col, col * vec3(1.02, 1.0, .97), smoothstep(.4, 1.0, l) * .3);     // warm highlights — a light split-tone grade
      col *= 1.0 - smoothstep(.35, .95, length(ctr)) * .35;                       // vignette
      col += (hash(vUv * uRes + uTime) - 0.5) * .035;                            // film grain
      gl_FragColor = vec4(col, 1.0);
    }`
};
const composer = new EffectComposer(renderer);   // no explicit renderTarget: passing one makes the composer ignore the renderer's pixel ratio
composer.addPass(new SceneDropsPass());
// threshold has to clear the pale background's own brightness (close to 1.0), or the whole scene
// blooms instead of just the glints
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .32, .55, .97);
composer.addPass(bloom);
const finish = new ShaderPass(FINISH_SHADER); finish.renderToScreen = true;
composer.addPass(finish);
function render() {
  renderer.info.reset();
  finish.uniforms.uTime.value = performance.now() * .001;
  finish.uniforms.uRes.value.set(innerWidth, innerHeight);
  composer.render();
}

/* ---------- scroll with inertia, play, UI ---------- */
const ui = document.querySelector('.ui'), scrub = ui.querySelector('[data-scrub]'), pOut = ui.querySelector('[data-p]');
const stageItems = [...ui.querySelectorAll('[data-stages] li')], STAGES = [0, .06, .4, .56, .82];
let target = 0, p = 0, v = 0, playing = false, speed = 1, last = performance.now();
addEventListener('wheel', e => { if (e.target.closest('.ui')) return; e.preventDefault(); target = clamp(target + e.deltaY * .0005); playing = false; }, { passive: false });
scrub.addEventListener('input', () => { target = p = +scrub.value; v = 0; playing = false; });
ui.querySelector('[data-play]').addEventListener('click', () => { if (target >= 1) target = p = 0; playing = !playing; });
ui.querySelector('[data-rewind]').addEventListener('click', () => { target = p = 0; v = 0; playing = false; });
ui.querySelector('[data-speed]').addEventListener('input', e => { speed = +e.target.value; ui.querySelector('[data-speed-out]').textContent = speed.toFixed(2); });
ui.querySelector('[data-jelly]').addEventListener('click', e => { jellyOn = !jellyOn; e.target.setAttribute('aria-pressed', String(jellyOn)); });
ui.querySelector('[data-paths]').addEventListener('click', e => { guides.visible = !guides.visible; e.target.setAttribute('aria-pressed', String(guides.visible)); });
const matButtons = [...ui.querySelectorAll('[data-mat]')];
matButtons.forEach(btn => btn.addEventListener('click', () => { setLetterMode(btn.dataset.mat); matButtons.forEach(b => b.setAttribute('aria-pressed', String(b === btn))); }));
ui.querySelector('[data-params-toggle]').addEventListener('click', e => {
  const container = ui.querySelector('[data-mat-params]');
  const open = container.hidden; container.hidden = !open;
  e.target.setAttribute('aria-pressed', String(open));
});
(function buildMatParamsPanel() {
  const container = ui.querySelector('[data-mat-params]');
  if (!container) return;
  const first = allLiquidMats()[0];
  for (const p of MAT_PARAMS) {
    const row = document.createElement('div'); row.className = 'row param-row';
    const label = document.createElement('label'); label.textContent = p.label;
    const input = document.createElement('input'); input.type = 'range'; input.min = p.min; input.max = p.max; input.step = p.step; input.value = p.get(first);
    const out = document.createElement('output'); out.textContent = (+input.value).toFixed(3);
    input.addEventListener('input', () => { const v = +input.value; out.textContent = v.toFixed(3); for (const m of allLiquidMats()) p.set(m, v); });
    row.append(label, input, out); container.appendChild(row);
  }
})();
addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); playing = !playing; } });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); fitStage(); composer.setSize(innerWidth, innerHeight); bloom.setSize(innerWidth, innerHeight); });

function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (playing) { target = clamp(target + dt * speed / 10); if (target >= 1) playing = false; }
  const omega = 7, x = p - target, decay = Math.exp(-omega * dt), tmp = (v + omega * x) * dt;   // the page's scroll inertia
  p = target + (x + tmp) * decay; v = (v - omega * tmp) * decay;
  tl.time(clamp(p));
  const t = now / 1000;
  placeCamera(t, p); placeDrops(t); placeLetters(t, dt); placeBokeh(t, dt);
  render();
  scrub.value = String(p); pOut.textContent = p.toFixed(3);
  let k = 0; STAGES.forEach((s, j) => { if (p >= s) k = j; }); stageItems.forEach((li, j) => li.classList.toggle('on', j === k));
  requestAnimationFrame(frame);
}
for (const L of letters) { L.prev.copy(L.home).add(WORD_AT); L.mesh.position.copy(L.prev); }
requestAnimationFrame(frame);

/* for scripted review: window.__PROTO__.set(p) */
window.__PROTO__ = { set(value) { target = p = clamp(value); v = 0; playing = false; }, get p() { return p; }, letters, drops, renderer, toggleJelly(on) { jellyOn = on; }, setLetterMode, get letterMode() { return letterMode; }, composer, sceneRT, bloom, finish };
