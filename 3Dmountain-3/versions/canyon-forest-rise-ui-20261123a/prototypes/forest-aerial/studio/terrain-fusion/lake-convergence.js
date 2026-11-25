/* lake-convergence.js — THE CONVERGENCE (2026-11-24, client: 「湖泊中間加入 這樣的設計代表匯集，設計你可以照你覺得完美去調整」 + a picture: the four
   rivers' light meeting in a bright point at the lake's centre, round it soft tiers of light lying on the water).
   Our version, on the water where the four beams meet (atlas.lake.center):
     · a hot core, a soft inner glow and a wide faint halo;
     · three soft tiers of light lying flat on the water (they read as ellipses from the lens, as in the picture);
     · thin rings that travel INWARD, slowly, from the edge to the core: what flows in gathers (匯集), never a ripple going out;
     · a faint scatter of glints on the tiers.
   One additive disc (1 draw call, a few ALU per pixel, no texture), above the water and under the clouds, depth-tested so the near hills
   hide it. It comes in with the routes (setRoute 0 → 1 as the four beams arrive) and fades out as the lens dives into the lake.
   Dials: ?cv=0 off · ?cvR (radius, world units) · ?cvCore · ?cvRings · ?cvTiers · ?cvSpeed; live: window.__LAKE_CONVERGENCE__.u */
import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec2 vP; varying vec3 vWorld;
  void main() {
    vP = position.xy;                       /* -1 … 1 across the disc */
    vec4 w = modelMatrix * vec4(position, 1.);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const FRAG = /* glsl */`
  uniform float uTime;
  uniform vec4 uCV;    /* core · rings · tiers · speed */
  uniform vec4 uCV2;   /* on (routes in × arrival) · dive fade distance · glints · - */
  uniform vec3 uCore, uGlow, uTier;
  uniform vec3 uCenter;
  varying vec2 vP; varying vec3 vWorld;
  float h12(vec2 p) { vec3 q = fract(p.xyx * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  void main() {
    float r = length(vP);
    if (r > 1.) discard;
    float edge = 1. - smoothstep(.72, 1., r);
    /* the core and its glow */
    float core = exp(-r * r / .0016) * 1.6 + exp(-r * r / .012) * .55;
    float glow = exp(-r * 4.2) * .42 + exp(-r * 1.6) * .12;
    /* three soft tiers lying on the water (the picture's layered ellipses), a little breathing */
    float br = .96 + .04 * sin(uTime * .9);
    float tiers = (1. - smoothstep(.52 * br, .74 * br, r)) * .16 + (1. - smoothstep(.32 * br, .47 * br, r)) * .2 + (1. - smoothstep(.15 * br, .26 * br, r)) * .24
                + exp(-r * 2.2) * .18;   /* soft plateaus over one smooth swell: no hard rim */
    tiers *= mix(.3 + .7 * smoothstep(.0, .32, r), 1., min(1., uCV.x));   /* 「中間光點取消」: with no core the middle stays open, not a bright disc */
    /* rings travelling inward: what flows in gathers at the core */
    float ph = fract(r * 3.2 + uTime * uCV.w);
    float ring = smoothstep(.0, .14, ph) * (1. - smoothstep(.14, .42, ph));   /* broad, soft swells of light, not drawn lines */
    ring *= smoothstep(.08, .3, r) * edge * (.35 + .4 * (1. - r)) * .55;
    /* a faint scatter of glints on the tiers, twinkling */
    vec2 cell = floor(vP * 46.);
    float g = h12(cell); float tw = .5 + .5 * sin(uTime * (1.5 + g * 3.) + g * 40.);
    float glint = step(.965, g) * tw * (1. - smoothstep(.15, .66, r)) * .55 * uCV2.z;   /* 2026-11-25 client: 「湖心匯集裡面的亮點取消」 → 0 by default */
    vec3 col = uCore * core * uCV.x + uGlow * glow * uCV.x + uTier * tiers * uCV.z + uGlow * ring * uCV.y * 1.25 + uCore * glint * uCV.z;
    /* dive: fades as the lens comes down to the water */
    float dive = smoothstep(uCV2.y * .35, uCV2.y, distance(cameraPosition, uCenter));
    col *= uCV2.x * dive * edge;
    gl_FragColor = vec4(col, 1.);
  }`;

export function createLakeConvergence(atlas, studio, { query = new URLSearchParams(location.search), reducedMotion = false } = {}) {
  if (!atlas?.lake?.center) return null;
  const num = (k, d) => { const v = query.get(k); return v != null && v !== '' && Number.isFinite(+v) ? +v : d; };
  const C = atlas.lake.center;
  const R = num('cvR', 1.0);
  /* 「湖心匯集光」 in the view-from-above panel (key P; 2026-11-24 client: 「這個要給我開關」): on / off and its dials; ?cv=0 starts it off */
  const config = { glints: num('cvGlints', 0), beamStop: num('cvStop', .5), enabled: query.get('cv') !== '0', size: R, core: num('cvCore', 0),   /* 2026-11-24 client: 「中間光點取消」 (was 1) */ rings: num('cvRings', .9), tiers: num('cvTiers', 1.15), speed: num('cvSpeed', .16) };
  const u = {
    uTime: atlas.uniforms.uTime || { value: 0 },
    uCV: { value: new THREE.Vector4(num('cvCore', 1), num('cvRings', .9), num('cvTiers', 1.15), reducedMotion ? 0 : num('cvSpeed', .16)) },
    uCV2: { value: new THREE.Vector4(0, num('cvDive', 7), 0, 0) },
    uCore: { value: new THREE.Color('#f4fbff') }, uGlow: { value: new THREE.Color('#9fdcff') }, uTier: { value: new THREE.Color('#bfe6f7') },
    uCenter: { value: new THREE.Vector3(C.x, .105, C.z) }
  };
  const mat = new THREE.ShaderMaterial({
    name: 'lake-convergence', vertexShader: VERT, fragmentShader: FRAG, uniforms: u,
    transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, toneMapped: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 1, 1), mat);
  mesh.name = 'Lake convergence';
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(C.x, .1085, C.z);
  mesh.scale.setScalar(R);
  mesh.renderOrder = 50;   /* above the water, under the clouds (58) */
  mesh.frustumCulled = false;
  const group = new THREE.Group(); group.name = 'Lake convergence'; group.add(mesh);
  let route = 0, arrival = 0, on = true;
  const apply = () => {
    u.uCV.value.set(+config.core, +config.rings, +config.tiers, reducedMotion ? 0 : +config.speed);
    mesh.scale.setScalar(Math.max(.05, +config.size || R));
    u.uCV2.value.z = Math.max(0, +config.glints || 0);
    u.uCV2.value.x = on && config.enabled ? Math.min(1, route) * Math.min(1, arrival) : 0; mesh.visible = u.uCV2.value.x > .002;
  };
  const api = {
    group, mesh, u, config, apply,
    setRoute(v) { route = Math.max(0, Math.min(1, +v || 0)); apply(); },
    setArrival(v) { arrival = Math.max(0, Math.min(1, +v || 0)); apply(); },
    setOn(v) { config.enabled = !!v; apply(); },
    get state() { return { on: config.enabled, route, arrival, radius: +config.size }; },
    dispose() { group.removeFromParent(); mat.dispose(); mesh.geometry.dispose(); }
  };
  window.__LAKE_CONVERGENCE__ = api;
  return api;
}
