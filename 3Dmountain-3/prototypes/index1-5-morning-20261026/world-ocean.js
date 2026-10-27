/* =====================================================================
   index1-5 · 海洋章節 Ocean (2026-10-23). Client: 「地球完幫我做這樣的轉場跟區塊
   https://2025.oceanx.org/ ，船不需要，畫面3D就用原本的俯視圖，滾動跑橫向的，
   用一些雲海鳥來設計」.
   2026-10-24, client: 「這裡直接 WebGL 波浪轉場就好了，不要畫圓!!!」 and 「後面橫移的海洋，
   要跟著前面山谷的那些一樣的顏色」.
   After the planet: a full-screen water wave sweeps across the frame (scroll-driven),
   refracting the planet's image and carrying it away into OUR top-down sea behind
   it — bright crest line, spray, the planet and the sea blended through the wave.
   No circle anywhere. The sea is the valley's water (its colours are read live from
   CONFIG.watershedWater / CONFIG.alpineLight, warm sun glints, the valley's clouds);
   the FINNOVATION mark carved into the water (media/ocean-loop-*.mp4, regraded) is the
   hero object at the first stop, where the ship is in the reference. Then the
   RESPONSIBILITY chapters run as a horizontal section across that sea, one
   chapter per stop: procedural water with sun glints on the crests, drifting
   clouds with their shadows, gulls gliding and flapping. Water, glints, clouds
   and gulls are drawn in the world module's own canvas. The two chapter photos
   and the shared alpine-island atlas load near the global chapter (2026-10-24).
   Every state is a function of the scroll position (scroll back, it plays
   back); with reduced motion there is no dive and no travel, only fades.
   Wired into the page's local copy of js/finnovation-world.js by
   prototypes/index1-5-morning-20261026/world-ocean-build.cjs (the shared module is untouched).
   Dials: CONFIG.worldOcean (tuner 「海洋章節 Ocean」).
   ===================================================================== */
import * as THREE from 'three';
import { createOceanIslands } from './world-ocean-islands.js';
import { createOceanPhotos } from './world-ocean-photos.js?v=inertia-20261025';
import { oceanProgress, oceanPanelState } from './world-ocean-scroll.js';
import { getSceneDaylight } from './scene-daylight.js';

/* The defaults. Strict JSON: world-ocean-build.cjs copies it into main.js's CONFIG.worldOcean. */
const DEFAULTS = /*OCEAN-DEFAULTS*/{
  "dive": 2.2, "depth": 1.8, "waveAngle": 12, "waveLength": 0.17, "waveAmp": 0.045, "crest": 1, "refract": 1.6, "waveSoft": 0.04, "wobble": 0.06, "spray": 1, "push": 0.3,
  "valley": 1, "tone": 1, "deep": "#345067", "lit": "#6c8fad", "ink": "#20303e", "foam": "#eef2f6", "glintColor": "#ffead4",
  "glint": 1.6, "glintText": 0.85, "glintKnee": 1, "glintSize": 0.45, "rough": 1.1, "waveScale": 1, "waveSpeed": 1, "wind": 35,
  "heroSize": 0.546, "heroX": 0, "heroY": 0, "heroContrast": 1.25,
  "vignette": 0.6, "scrim": 0.8,
  "clouds": 0.55, "cloudOpacity": 0.9, "cloudSpeed": 1, "cloudShadow": 0.5, "cloudHeight": 0.3, "cloudScale": 1.3,
  "gulls": 7, "gullSpeed": 1, "gullSize": 1, "flap": 1,
  "travel": 0.8, "stop": 1.3, "ease": 6,
  "textX": 0.075, "textY": 0.86
}/*/OCEAN-DEFAULTS*/;
export const OCEAN_DEFAULTS = DEFAULTS;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/* Where the carved ring sits in each source (texture coords, v up) and its diameter as a share of the source's height. */
const SRC_VIDEO = [.476, .5, .86];
const SRC_STILL = [.485, .53, .58];

/* ---------------------------------------------------------------- GLSL */
const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/* A tileable gradient noise, four periods in the four channels (one fetch = four octaves). Baked once. */
const NOISE_BAKE = /* glsl */ `
varying vec2 vUv;
vec2 hash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453123); }
float corner(vec2 i, vec2 o, vec2 f, float period, float seed) { return dot(hash2(mod(i + o, period) + seed), f - o); }
float gnoise(vec2 x, float period, float seed) {
  vec2 p = x * period, i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = corner(i, vec2(0.0, 0.0), f, period, seed), b = corner(i, vec2(1.0, 0.0), f, period, seed);
  float c = corner(i, vec2(0.0, 1.0), f, period, seed), d = corner(i, vec2(1.0, 1.0), f, period, seed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void main() {
  gl_FragColor = vec4(gnoise(vUv, 4.0, 1.7), gnoise(vUv, 8.0, 9.2), gnoise(vUv, 16.0, 23.1), gnoise(vUv, 32.0, 41.9)) * 0.8 + 0.5;
}
`;

/* The sea's surface, re-baked every frame: a sum of periodic waves on the tile (integer wave numbers, so it tiles),
   each travelling at its own deep-water speed, so the crests form, slide and dissolve like real chop.
   RG = slope (x, y), B = height. */
const WAVE_COUNT = 40;
const WAVE_BAKE = /* glsl */ `
#define NW ${WAVE_COUNT}
uniform vec4 uK[NW];
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 6.28318530718;
  vec2 g = vec2(0.0); float h = 0.0;
  for (int i = 0; i < NW; i++) {
    vec4 k = uK[i];
    float kl = length(k.xy);
    float ph = dot(k.xy, p) - sqrt(kl) * uTime + k.w;
    g += k.z * cos(ph) * k.xy / kl;
    h += k.z * sin(ph) / kl;
  }
  gl_FragColor = vec4(g * 0.5 + 0.5, h * 6.0 + 0.5, 1.0);
}
`;

/* Clouds: soft puffs (two octave bands of the noise, gently warped, a little stretched along the wind) under a slow
   large-scale coverage. W is a point of the cloud layer (world units); LOD softens it (the shadows read it blurred). */
const CLOUD_GLSL = /* glsl */ `
uniform vec4 uCloud;      // amount, opacity, altitude, shadow
uniform vec4 uCloudMove;  // drift x, y (world), frequency (per world unit), softness
float fbm4(vec2 q, float lod) { return dot(texture2D(uNoise, q, lod), vec4(0.5, 0.28, 0.15, 0.07)); }
float cloudField(vec2 w, float lod) {
  vec2 q = (w + uCloudMove.xy) * uCloudMove.z;
  q = vec2(q.x * 0.8 + q.y * 0.12, q.y - q.x * 0.06);
  vec2 warp = vec2(fbm4(q * 0.5 + vec2(0.13, 0.71), lod + 1.0), fbm4(q * 0.5 + vec2(0.57, 0.29), lod + 1.0)) - 0.5;
  float f = fbm4(q + warp * 0.32, lod) * 0.78 + fbm4(q * 2.3 + warp * 0.7, lod + 0.4) * 0.22;
  float cov = texture2D(uNoise, q * 0.06 + vec2(0.31, 0.77), lod + 1.0).r;
  float thr = mix(0.6, 0.45, uCloud.x) - (cov - 0.5) * 0.3;
  return smoothstep(thr, thr + uCloudMove.w, f);
}
`;

/* View + the wave, shared by the water, the clouds and the gulls' mask. The transition is a water wave whose front
   crosses the whole frame (no circle): WAVEFRONT returns the signed distance behind the front (> 0 = the wave has
   passed: sea; < 0 = still the planet), the wave's displacement along its direction (it refracts both images), its
   face (lit side > 0, trough < 0) and its crest line. The front wobbles along its length and the swells behind it
   keep moving with time, so it is liquid even when the scroll rests; its position is the scroll's. */
const VIEW_GLSL = /* glsl */ `
uniform sampler2D uNoise;
uniform vec2 uRes;
uniform vec4 uView;       // camera x, y (world), camera height h, time
uniform vec4 uWaveA;      // travel direction x, y (screen, y up), front position (screen heights from the centre), edge softness
uniform vec4 uWaveB;      // wavelength, displacement amplitude (screen heights), front wobble, on
float waveFront(vec2 p, out float disp, out float face, out float crest) {
  disp = 0.0; face = 0.0; crest = 0.0;
  if (uWaveB.w < 0.5) return 9.0;
  vec2 d = uWaveA.xy, tg = vec2(-d.y, d.x);
  float x = dot(p, d), y = dot(p, tg), tm = uView.w;
  float wob = (texture2D(uNoise, vec2(y * 0.21 + tm * 0.004, 0.37)).r - 0.5) * 2.4 * uWaveB.z
            + (texture2D(uNoise, vec2(y * 0.83 - tm * 0.011, 0.71)).g - 0.5) * 0.9 * uWaveB.z;
  float sd = uWaveA.z + wob - x;
  float L = max(uWaveB.x, 0.005), A = uWaveB.y, u = sd / L;
  // one smooth swell at the front (it bends what is seen through it like a lens), small ripples only behind it
  float bump = exp(-u * u);
  float slope = -2.0 * u * bump;
  float rip = sd > 0.0 ? exp(-sd / (L * 2.2)) * sin(6.2831853 * sd / (L * 0.55) - tm * 3.0) : 0.0;
  disp = A * (slope * 0.85 + 0.3 * rip);
  face = slope + 0.35 * rip;
  crest = exp(-pow((u + 0.05) / 0.075, 2.0)) + 0.3 * exp(-pow((u + 0.05) / 0.3, 2.0));
  return sd;
}
float waveMask(float sd) { return uWaveB.w < 0.5 ? 1.0 : smoothstep(-uWaveA.w, uWaveA.w, sd); }
`;

const READING_GLSL = /* glsl */ `
uniform vec2 uReading,uReadViewport;
float oceanBox(vec2 p,vec4 b,float f){
  return smoothstep(b.x-f,b.x+f,p.x)*(1.-smoothstep(b.z-f,b.z+f,p.x))
       *smoothstep(b.y-f,b.y+f,p.y)*(1.-smoothstep(b.w-f,b.w+f,p.y));
}
float oceanReading(vec2 uv){
  if(uReadViewport.x<961.)return oceanBox(uv,vec4(.025,.085,.98,.78),.065)*uReading.x;
  float left=oceanBox(uv,vec4(.045,.095,.49,.78),.065);
  float right=oceanBox(uv,vec4(.60,.10,.98,.78),.055)*uReading.y;
  return max(left,right)*uReading.x;
}
`;

const WATER_SURFACE_GLSL = /* glsl */ `
${CLOUD_GLSL}
uniform sampler2D uWave;
uniform vec4 uLook,uLook2,uGlintFx;
uniform vec2 uSeaWind;
uniform vec3 uSun,uDeep,uLit,uInk,uFoam,uGlintCol,uFarCol,uScrimCol;
uniform vec3 uAmbientTint;
uniform float uSunEnergy;
vec2 rot(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(c*v.x-s*v.y,s*v.x+c*v.y);}
${READING_GLSL}
float oceanCloudShadow(vec2 w,float h){
  return cloudField(w+uSun.xy/max(uSun.z,.18)*uCloud.z,1.8+clamp(log2(h)*.9,0.,3.))*uCloud.w*uSunEnergy
       *(1.-.85*smoothstep(2.2,4.8,h));
}
void readOceanSurface(vec2 w,float h,out vec3 N,out float d,out float shadow,out float swell){
  float L=uLook.x;
  vec4 a=texture2D(uWave,w/(L*.42));
  vec4 b=texture2D(uWave,rot(w,.61)/L+vec2(.31,.17));
  vec4 c=texture2D(uWave,rot(w,-.37)/(L*3.1)+vec2(.71,.43));
  vec2 sA=(a.rg-.5)*2.,sB=rot(b.rg-.5,-.61)*2.,sC=rot(c.rg-.5,.37)*2.;
  vec2 slope=(sA*.55+sB*.75+sC)*uLook.y;
  swell=(c.b-.5)+(b.b-.5)*.45;
  N=normalize(vec3(-slope,1.));
  d=dot(sC+sB*.4,normalize(uSun.xy))*uLook.y*1.6+swell*.9;
  shadow=oceanCloudShadow(w,h);
}
vec3 oceanBase(float d){
  return mix(mix(uInk,uDeep,smoothstep(-1.4,-.3,d)),uLit,smoothstep(0.,1.3,d)*.62);
}
vec3 oceanFrame(vec3 col,vec2 uv){
  float ra=uRes.x/uRes.y;
  float textZone=uLook2.y*smoothstep(.6,.05,uv.y)*mix(.55,1.,smoothstep(.75,.15,uv.x));
  col*=1.-uLook2.x*smoothstep(.42,1.05,length((uv-.5)*vec2(ra*.62,1.)));
  col=mix(col,uScrimCol,.5*clamp(textZone,0.,1.2));
  return mix(col,uScrimCol,oceanReading(uv)*.105*uLook2.y);
}
vec3 finishOceanSurface(vec3 col,vec3 N,float shadow,float glintScale,vec2 w,float h,vec2 uv){
  col*=1.-shadow*.55;
  vec3 H=normalize(uSun+vec3(0.,0.,1.));
  float ndh=max(dot(N,H),0.);
  float gust=texture2D(uNoise,w*.21+vec2(uView.w*.006,0.),1.).g;
  float textZone=uLook2.y*smoothstep(.6,.05,uv.y)*mix(.55,1.,smoothstep(.75,.15,uv.x));
  float glint=pow(ndh,uLook.w)*uLook.z*glintScale*(1.-shadow)*uSunEnergy
     *mix(.55,1.2,smoothstep(.3,.7,gust))*(1.-uGlintFx.x*clamp(textZone,0.,1.))
     *(1.-.94*oceanReading(uv))*(1.-.75*oceanBox(uv,vec4(.01,.90,.99,1.10),.04));
  float far=smoothstep(1.3,6.5,h);
  vec3 add=uGlintCol*glint*(1.-.85*far);
  col+=add/(1.+add*uGlintFx.y);
  col=mix(col,uFarCol,far*.6);
  return oceanFrame(col,uv);
}
`;
const OCEAN_FRAGMENT = (grade) => /* glsl */ `
${VIEW_GLSL}
uniform vec3 uCrestCol, uFoamCol;
uniform vec4 uMix;        // composite (the wave is crossing), crest brightness, spray, refraction of the planet
uniform sampler2D uVideo, uPhoto, uScene;

uniform vec4 uHero;       // centre x, y (world), ring diameter (world), contrast
uniform vec4 uHeroMix;    // video mix, on, still aspect, video aspect
uniform vec4 uSrcV, uSrcP;// ring centre u, v, ring diameter / source height, mean lod
varying vec2 vUv;
${grade}
${WATER_SURFACE_GLSL}
vec3 tone(float d) {
  vec3 c = mix(uInk, uDeep, smoothstep(-1.1, -0.15, d));
  c = mix(c, uLit, smoothstep(-0.1, 0.9, d) * 0.8);
  return mix(c, uFoam, smoothstep(0.75, 1.5, d));
}
float heroDetail(sampler2D tex, vec4 src, float aspect, vec2 hp, out float lum) {
  vec2 uv = src.xy + hp * src.z * vec2(1.0 / aspect, 1.0);
  vec3 c = texture2D(tex, uv).rgb;
  vec3 m = textureLod(tex, uv, src.w).rgb;
  lum = dot(c, vec3(0.3, 0.59, 0.11));
  return lum - dot(m, vec3(0.3, 0.59, 0.11));
}
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p0 = (frag - 0.5 * uRes) / uRes.y;
  float disp, face, crest;
  float sd = waveFront(p0, disp, face, crest);
  float m = waveMask(sd);
  bool composite = uMix.x > 0.5;
  float alpha = uLook2.z * (composite ? 1.0 : m);
  if (!composite && alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }
  // the sea, seen through the passing wave (its displacement bends it, gently: the glints must not smear)
  vec2 p = p0 - uWaveA.xy * disp * 0.35;
  float h = uView.z;
  vec2 w = uView.xy + p * h;                       // the point of the sea under this pixel
  vec3 N; float d,shadow,swell;
  readOceanSurface(w,h,N,d,shadow,swell);
  vec3 col=oceanBase(d);
  float glintScale = 1.0;
  // the hero: our mark in the sea, the film's own water graded into this one
  if (uHeroMix.y > 0.0) {
    vec2 hp = (w - uHero.xy) / uHero.z;
    float m = (1.0 - smoothstep(0.53, 0.62, length(hp * vec2(0.92, 1.0)))) * uHeroMix.y;
    if (m > 0.0) {
      float lv = 0.0, lp = 0.0, dv = 0.0, dp = 0.0;
      if (uHeroMix.x > 0.0) dv = heroDetail(uVideo, uSrcV, uHeroMix.w, hp, lv);
      if (uHeroMix.x < 1.0) dp = heroDetail(uPhoto, uSrcP, uHeroMix.z, hp, lp);
      float dh = mix(dp, dv, uHeroMix.x) * 7.0 * uHero.w;
      dh *= 1.0 - .72 * oceanReading(frag / uRes);
      // keep a breath of the procedural swell under it so the two waters read as one
      col = mix(col, tone(dh + d * 0.15), m);
      glintScale = mix(1.0, uLook2.w, m);
    }
  }
  col=finishOceanSurface(col,N,shadow,glintScale,w,h,frag/uRes);
  col = fiGrade(clamp(col, 0.0, 1.0));
  if (composite) {
    // the planet, refracted by the same wave, gives way to the sea behind the front
    vec2 suv = (frag + uWaveA.xy * disp * uMix.w * uRes.y) / uRes;
    suv = 1.0 - abs(1.0 - abs(suv));   // mirrored at the frame's edges (no smeared border rows)
    vec3 planet = texture2D(uScene, clamp(suv, vec2(0.001), vec2(0.999))).rgb;
    col = mix(planet, col, m);
    // light on the wave: the face ahead of the crest catches the sun, its back darkens a touch
    float L = uWaveB.x;
    col *= 1.0 - 0.16 * max(-face, 0.0);
    col += uCrestCol * (0.26 * max(face, 0.0) * max(face, 0.0)) * uMix.y;
    // the crest: a bright lip, stronger where the wave breaks along its length; a translucent wash behind; a little spray
    vec2 tg = vec2(-uWaveA.y, uWaveA.x);
    float along = dot(p0, tg);
    float brk = texture2D(uNoise, vec2(along * 0.7 + uView.w * 0.012, 0.53)).r * 0.7 + texture2D(uNoise, vec2(along * 1.9 - uView.w * 0.02, 0.19)).g * 0.3;
    // foam lace on the lip (broken, moving), its back in shade (the wave has volume)
    float lace = texture2D(uNoise, p0 * 4.6 + tg * uView.w * 0.03 + uWaveA.xy * uView.w * 0.01).a * 0.6 + texture2D(uNoise, p0 * 10.5 - tg * uView.w * 0.05).b * 0.4;
    float lip = crest * mix(0.45, 1.0, smoothstep(0.35, 0.65, brk)) * mix(0.55, 1.0, smoothstep(0.35, 0.65, lace));
    col *= 1.0 - 0.22 * smoothstep(0.0, 0.15, sd / L) * exp(-sd / (L * 0.55)) * step(0.0, sd);
    float soft = texture2D(uNoise, p0 * 1.8 + vec2(uView.w * 0.006, -uView.w * 0.02)).r * 0.65 + texture2D(uNoise, p0 * 4.2 - tg * uView.w * 0.01).g * 0.35;
    float wash = step(0.0, sd) * exp(-sd / (L * 0.9)) * smoothstep(0.42, 0.72, soft) * smoothstep(0.3, 0.6, brk);
    float sprayN = texture2D(uNoise, p0 * 7.0 + vec2(uView.w * 0.05, -uView.w * 0.09)).a * 0.6 + texture2D(uNoise, p0 * 17.0 - vec2(uView.w * 0.03, uView.w * 0.12)).b * 0.4;
    float spray = smoothstep(0.72, 0.86, sprayN) * exp(-pow((sd + L * 0.1) / (L * 0.3), 2.0)) * smoothstep(0.5, 0.75, brk) * uMix.z;
    col = mix(col, uFoamCol, clamp((lip * 0.85 + wash * 0.3) * uMix.y + spray * 0.8, 0.0, 1.0));
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  } else gl_FragColor = vec4(col * alpha, alpha);
}
`;

/* The sea's clouds, over the gulls (behind the wave's front only). */
const SKY_FRAGMENT = (grade) => /* glsl */ `
${VIEW_GLSL}
uniform vec3 uSun, uCloudLight, uCloudShade;
uniform float uSkyOn;
varying vec2 vUv;
${grade}
${CLOUD_GLSL}
void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p0 = (frag - 0.5 * uRes) / uRes.y;
  float disp, face, crest;
  float cloudReach = waveMask(waveFront(p0, disp, face, crest));
  vec3 C = vec3(0.0); float A = 0.0;
  if (uSkyOn > 0.0 && cloudReach > 0.0 && uCloud.y > 0.0) {
    vec2 p = p0 - uWaveA.xy * disp * 0.5;
    float hA = max(uView.z - uCloud.z, 0.06);
    vec2 wc = uView.xy + p * hA;
    // far below, the sea's clouds are small and soft (read blurred); the planet's own clouds carry that part
    float lod = clamp(log2(hA) * 0.9, 0.0, 3.0);
    float dens = cloudField(wc, lod) * (1.0 - 0.85 * smoothstep(2.2, 4.8, uView.z));
    if (dens > 0.001) {
      float lit = cloudField(wc + normalize(uSun.xy) * 0.03 * hA, lod + 0.9);
      vec3 cc = mix(uCloudShade, uCloudLight, clamp(0.58 + (dens - lit) * 2.6, 0.0, 1.0));
      float ca = dens * uCloud.y * cloudReach * uSkyOn;
      C = fiGrade(cc) * ca; A = ca;
    }
  }
  gl_FragColor = vec4(C, A);
}
`;

/* Gulls, seen from above: a body, M-shaped wings (arm to the wrist, hand swept back to the tip) with black tips,
   grey mantle; the shadow instances draw the same shape soft and dark on the water. */
const GULL_VERTEX = /* glsl */ `
attribute vec4 aA;   // x, y (screen heights from the centre, y up), wingspan (screen heights), alpha
attribute vec4 aB;   // cos, sin of the heading, wing spread (0.4–1), shadow (0/1)
attribute float aLight;
uniform vec2 uRes;
varying vec2 vL;
varying vec4 vB;
void main() {
  vec2 c = position.xy * 1.15;
  vL = c;
  vec2 fwd = aB.xy, right = vec2(aB.y, -aB.x);
  vec2 sp = aA.xy + (c.x * right + c.y * fwd) * aA.z;
  gl_Position = vec4(sp.x * 2.0 * uRes.y / uRes.x, sp.y * 2.0, 0.0, 1.0);
  vB = vec4(aB.z, aB.w, aLight, aA.w);
}
`;
const GULL_FRAGMENT = /* glsl */ `
uniform vec2 uRes;
uniform vec4 uWaveA, uWaveB;
uniform vec3 uShadowCol, uBirdLight;
varying vec2 vL;
varying vec4 vB;
${READING_GLSL}
float seg(vec2 p, vec2 a, vec2 b, float ra, float rb, out float t) {
  vec2 pa = p - a, ba = b - a; t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t) - mix(ra, rb, t);
}
void main() {
  vec2 p = vL, q = vec2(abs(p.x), p.y);
  float s = vB.x, t1, t2, tb, tt;
  vec2 S = vec2(0.02, 0.03), Wr = vec2(0.2 * mix(0.72, 1.0, s), 0.1 + 0.03 * (1.0 - s)), T = vec2(0.5 * s, -0.1 - 0.06 * (1.0 - s));
  float arm = seg(q, S, Wr, 0.07, 0.05, t1);
  float hand = seg(q, Wr, T, 0.05, 0.007, t2);
  float body = seg(p, vec2(0.0, -0.1), vec2(0.0, 0.05), 0.036, 0.042, tb);
  float head = length(p - vec2(0.0, 0.1)) - 0.028;
  float tail = seg(p, vec2(0.0, -0.09), vec2(0.0, -0.17), 0.026, 0.038, tt);
  float wing = min(arm, hand), bod = min(min(body, head), tail);
  float d = min(wing, bod);
  bool shadow = vB.y > 0.5;
  float aa = fwidth(d) * (shadow ? 2.5 : 0.9);
  float a = 1.0 - smoothstep(-aa, aa, d);
  if (a <= 0.0) discard;
  vec3 col = vec3(0.97, 0.975, 0.98);
  if (wing < bod - 0.004) col = mix(vec3(0.8, 0.84, 0.88), vec3(0.07, 0.08, 0.1), step(hand, arm) * smoothstep(0.55, 0.7, t2));
  col *= vB.z * uBirdLight;
  if (shadow) { col = uShadowCol; a *= 0.34; }
  if (uWaveB.w > 0.5) a *= smoothstep(-uWaveA.w, uWaveA.w, uWaveA.z - dot((gl_FragCoord.xy - 0.5 * uRes) / uRes.y, uWaveA.xy));
  a *= vB.w*(1.-.94*oceanReading(gl_FragCoord.xy/uRes));
  gl_FragColor = vec4(col * a, a);
}
`;

/* ---------------------------------------------------------------- DOM */
/* The chapters move into a horizontal track (the elements are moved, not copied: ids, tabs and copy are the page's).
   Kickers and the gold line are decorative repeats (aria-hidden); the "next" pills are in-page navigation. */
function prepareDom(root) {
  const resp=root.querySelector('[data-world-part="responsibility"]'),global=root.querySelector('[data-world-part="global"]');
  if(!resp||!global||resp.classList.contains('fiwo'))return null;
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
  const dive=make('div','fiwo-dive');dive.dataset.worldPart='dive';dive.setAttribute('aria-hidden','true');global.after(dive);
  resp.classList.add('fiwo');
  const pin=make('div','fiwo-pin'),track=make('div','fiwo-track');pin.append(track);
  const articles=[...resp.querySelectorAll(':scope > [data-strategy]')];
  if(articles.length!==4)throw Error('Expected four ocean strategy chapters.');
  resp.querySelector(':scope > .fiwo-source-intro')?.remove();
  articles.forEach((article,k)=>{article.classList.add('fiwo-panel');article.dataset.stop=String(k);track.append(article);});
  const N=articles.length,progress=make('nav','fiwo-progress');progress.setAttribute('aria-label','四大投資策略');
  const label=make('span','fiwo-progress-label','INVESTMENT STRATEGIES');label.setAttribute('aria-hidden','true');
  const list=make('ol'),line=make('span','fiwo-progress-line');line.append(make('i'));line.setAttribute('aria-hidden','true');
  articles.forEach((article,k)=>{const li=make('li'),b=make('button','',String(k+1).padStart(2,'0'));b.type='button';b.dataset.oceanGo=String(k);b.setAttribute('aria-label',article.querySelector('.fiwo-sub').textContent);li.append(b);list.append(li);});
  progress.append(label,line,list);pin.append(progress);resp.append(pin);
  return {resp,dive,pin,track,progress,ticks:[...list.querySelectorAll('button')],panels:articles,N};
}

/* ---------------------------------------------------------------- module */
export function createWorldOcean({ root, reducedMotion = false, config = () => null, small = false, mobilePerformance = false, go = () => {}, remeasure = () => {} }) {
  const dom = prepareDom(root);
  if (!dom) return null;
  const { resp, dive, track, panels, ticks, N } = dom;
  const fixedBackground = document.documentElement.matches('[data-look="index1-5"]:not([data-opening-refinement])');
  const photoFx = createOceanPhotos({ root, panels, reducedMotion, small });
  root.classList.add('fiwo-on');
  if (reducedMotion) root.classList.add('fiwo-still');

  const cfg = () => config() || DEFAULTS;
  const num = (key, lo = -Infinity, hi = Infinity) => { const v = +cfg()[key]; return clamp(Number.isFinite(v) ? v : DEFAULTS[key], lo, hi); };
  const str = key => { const v = cfg()[key]; return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : DEFAULTS[key]; };

  // ---------- layout & clocks ----------
  let W = innerWidth, H = innerHeight;
  const at = { global: 0, globalH: 1, dive: 0, diveH: 1, resp: 0, stop: 1, tail: 0 };
  let layoutKey = '';
  function layout(w, h) {
    W = w; H = h;
    const diveH = Math.round(num('dive', .8, 6) * H), stop = Math.round(num('stop', .5, 4) * H), tail = Math.round(H * .3);
    dive.style.height = diveH + 'px';
    resp.style.height = (H + (N - 1) * stop + tail) + 'px';
    root.style.setProperty('--fiwo-w', W + 'px'); root.style.setProperty('--fiwo-h', H + 'px');
    layoutKey = num('dive', .8, 6) + '|' + num('stop', .5, 4);
  }
  function measure(worldAt, top) {
    at.global = worldAt.global; at.globalH = worldAt.globalH;
    at.dive = top(dive); at.diveH = Math.max(1, dive.offsetHeight);
    at.resp = top(resp); at.stop = Math.round(num('stop', .5, 4) * H); at.tail = Math.round(H * .3);
    worldAt.block = at.dive;           // the film starts loading two screens before the dive
    worldAt.dive = at.dive; worldAt.diveH = at.diveH;
  }
  /* Free travel: the strip of sea follows the scroll 1:1 (no stops, no holds); a chapter is just a place along it. */
  const stopY = k => at.resp + clamp(k, 0, N - 1) * at.stop + (k <= 0 ? 2 : 0);
  /* The scroll's spring (the world module's, critically damped): from the dive on, the 「慣性」 dial. */
  const omega = y => mix(9.5, num('ease', 2, 14), smooth(at.dive - H, at.dive, y));

  let cur = null;
  function sample(y) {
    const t = (y - at.dive) / at.diveH;
    const depth = num('depth', 1.5, 14);
    const o = { t, h: 0, cam: 1, zoom: 1, reframe: 0, w: 0, push: 0, covered: false, alpha: 1, show: 0, deep: 0, panel0: 0, birds: 0, active: false, u: 0 };
    if (reducedMotion) {
      o.alpha = smooth(.15, .65, t); o.show = o.alpha; o.covered = o.alpha >= .999; o.panel0 = smooth(.55, .9, t); o.birds = 0;
      o.deep = smooth(.0, .5, t);
    } else {
      // the wave: its front crosses the frame over the transition's scroll (constant speed, the scroll's own easing);
      // the camera settles down onto the sea behind it; the planet comes a little closer as it is carried off
      o.w = clamp((t - .05) / .85);
      const z = smooth(.05, 1, t);
      o.cam = mix(depth, 1, z); o.zoom = depth / o.cam;
      o.push = smooth(-.25, .9, t);
      o.reframe = smooth(-.15, .2, t);             // (the market labels fade as the wave comes)
      o.show = o.w > 0 ? 1 : 0;
      o.covered = o.w >= 1;
      o.panel0 = smooth(.82, 1, t);
      o.birds = smooth(.75, 1, t);
    }
    // the sideways travel eases in over the end of the dive (the camera swoops down and on, no corner), then is 1:1
    const u = (y - at.resp) / Math.max(1, at.stop);
    o.u = u; o.h = oceanProgress(u,N,reducedMotion);
    o.active = y > at.resp - H * .25 && y < at.resp + (N - 1) * at.stop + at.tail + H * .25;
    // The previous planet/background remains visible until every ocean shader is ready.
    if(!baked)o.covered=false;
    cur = o;
    return o;
  }

  // ---------- the planet's part ----------
  let globe = { x: 0, y: 0, r: 0 };
  /* The planet keeps the statement's framing (no reframing, no circle) and only comes a little closer as the wave
     carries it off. */
  function earth({ R, cx, cy, lon, lat, W, H }) {
    const o = cur; if (!o || o.push <= 0) return null;
    const z = 1 + num('push', 0, 1.5) * easeInOut(o.push);
    return { R: R * z, cx: W / 2 + (cx - W / 2) * z, cy: H / 2 + (cy - H / 2) * z, lon, lat, dim: 0, scrim: .34 * (1 - o.push) };
  }
  function setGlobe(cx, cy, R) { globe.x = cx; globe.y = cy; globe.r = R; }

  // ---------- GL ----------
  let renderer = null, scene = null, camera = null, sceneRT = null, built = false, baked = false;
  let oceanMesh = null, skyMesh = null, gullMesh = null, bakeScene = null, bakeCam = null, bakeMesh = null;
  let waveRT = null, noiseRT = null, waveMat = null, noiseMat = null, oceanMat = null, skyMat = null, gullMat = null;
  let gullGeo = null, aA = null, aB = null, aL = null, islands = null;
  const MAXG = 16;
  const blank = new THREE.DataTexture(new Uint8Array([24, 40, 64, 255]), 1, 1); blank.needsUpdate = true;
  const colours = new Map();
  const colour = hex => { let c = colours.get(hex); if (!c) { c = new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace); colours.set(hex, c); } return c; };

  /* The wave field: 40 components round the wind, wavelengths a half to a fiftieth of the tile, slope-normalised. */
  let waveWind = NaN;
  const waveK = Array.from({ length: WAVE_COUNT }, () => new THREE.Vector4());
  function setWaves(windDeg) {
    if (windDeg === waveWind) return; waveWind = windDeg;
    const wind = windDeg * Math.PI / 180, seen = new Set();
    let sum = 0;
    for (let i = 0, n = 0; i < WAVE_COUNT && n < 4000; n++) {
      const a = rnd(n * 3 + 1), b = rnd(n * 3 + 2), c = rnd(n * 3 + 3);
      const kl = 2.5 * Math.pow(52 / 2.5, a);
      // a narrow main sea round the wind, a little cross-sea
      const spread = c < .86 ? (b - .5) * 1.25 : (b - .5) * 3.4;
      const th = wind + spread;
      const kx = Math.round(Math.cos(th) * kl), ky = Math.round(Math.sin(th) * kl);
      const key = kx + ',' + ky;
      if ((!kx && !ky) || seen.has(key) || seen.has(-kx + ',' + -ky)) continue;
      seen.add(key);
      const amp = Math.pow(Math.hypot(kx, ky), -.3) * (c < .86 ? 1 : .55);
      waveK[i].set(kx, ky, amp, rnd(n * 7 + 5) * Math.PI * 2); sum += amp * amp / 2; i++;
    }
    const norm = .25 / Math.sqrt(sum);          // RMS slope .25 in the texture's encoding
    for (const k of waveK) k.z *= norm;
  }

  function build({ renderer: r, scene: s, camera: c, gradeGlsl, uGrade }) {
    if (built || !r || !s || !c) return;
    renderer = r; scene = s; camera = c; built = true;
    // the planet as it is drawn, for the wave to refract (rendered only while the wave crosses)
    sceneRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    const quad = new THREE.PlaneGeometry(2, 2);
    // Keep all 40 wave components; the phone's lower-resolution periodic field
    // removes bake work while preserving the wind, height and animation clock.
    const size = mobilePerformance ? 192 : small ? 256 : 512;   /* WORLD_MOBILE_WAVE_TARGET */
    const rtOptions = { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false };
    waveRT = new THREE.WebGLRenderTarget(size, size, rtOptions);
    noiseRT = new THREE.WebGLRenderTarget(256, 256, rtOptions);
    waveRT.texture.anisotropy = noiseRT.texture.anisotropy = Math.min(mobilePerformance ? 2 : 8, r.capabilities.getMaxAnisotropy() || 1);
    setWaves(num('wind', -180, 180));
    waveMat = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: WAVE_BAKE, uniforms: { uK: { value: waveK }, uTime: { value: 0 } }, depthTest: false, depthWrite: false });
    noiseMat = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: NOISE_BAKE, depthTest: false, depthWrite: false });
    bakeScene = new THREE.Scene(); bakeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    bakeMesh = new THREE.Mesh(quad, noiseMat); bakeMesh.frustumCulled = false; bakeScene.add(bakeMesh);

    const view = {
      uRes: { value: new THREE.Vector2(1, 1) }, uView: { value: new THREE.Vector4(0, 0, 1, 0) },
      uWaveA: { value: new THREE.Vector4(0, 1, -9, .04) }, uWaveB: { value: new THREE.Vector4(.17, .035, .06, 0) }
    };
    const cloud = {
      uNoise: { value: noiseRT.texture }, uCloud: { value: new THREE.Vector4(.5, .85, .35, .5) }, uCloudMove: { value: new THREE.Vector4(0, 0, 1, .2) }
    };
    const sun = { value: new THREE.Vector3(.42, .38, .82).normalize() };
    oceanMat = new THREE.ShaderMaterial({
      vertexShader: VERTEX, fragmentShader: OCEAN_FRAGMENT(gradeGlsl), transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
      uniforms: {
        ...view, ...cloud, uGrade, uSun: sun,
        uSunEnergy: { value: 1 }, uAmbientTint: { value: new THREE.Color(.42, .49, .59) },
        uWave: { value: waveRT.texture }, uVideo: { value: blank }, uPhoto: { value: blank },
        uReading: { value: new THREE.Vector2(0, 0) }, uReadViewport: { value: new THREE.Vector2(W, H) }, uSeaWind: { value: new THREE.Vector2(.82, .57) },
        uLook: { value: new THREE.Vector4(.62, 1, 1.4, 600) }, uLook2: { value: new THREE.Vector4(.6, .55, 1, .45) }, uGlintFx: { value: new THREE.Vector4(.6, 0, 0, 0) },
        uDeep: { value: new THREE.Color() }, uLit: { value: new THREE.Color() }, uInk: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() }, uGlintCol: { value: new THREE.Color() },
        uFarCol: { value: new THREE.Color() }, uCrestCol: { value: new THREE.Color() }, uScrimCol: { value: new THREE.Color() }, uFoamCol: { value: new THREE.Color() },
        uMix: { value: new THREE.Vector4() }, uScene: { value: blank },
        uHero: { value: new THREE.Vector4(0, 0, .42, 1) }, uHeroMix: { value: new THREE.Vector4(0, 0, 1280 / 763, 16 / 9) },
        uSrcV: { value: new THREE.Vector4(SRC_VIDEO[0], SRC_VIDEO[1], SRC_VIDEO[2], 7) }, uSrcP: { value: new THREE.Vector4(SRC_STILL[0], SRC_STILL[1], SRC_STILL[2], 7) }
      }
    });
    oceanMesh = new THREE.Mesh(quad, oceanMat); oceanMesh.frustumCulled = false; oceanMesh.renderOrder = 4; oceanMesh.visible = false;
    skyMat = new THREE.ShaderMaterial({
      vertexShader: VERTEX, fragmentShader: SKY_FRAGMENT(gradeGlsl), transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
      uniforms: {
        ...view, ...cloud, uGrade, uSun: sun,
        uCloudLight: { value: new THREE.Color() }, uCloudShade: { value: new THREE.Color() }, uSkyOn: { value: 1 }
      }
    });
    skyMesh = new THREE.Mesh(quad, skyMat); skyMesh.frustumCulled = false; skyMesh.renderOrder = 6; skyMesh.visible = false;
    // gulls: one quad per instance, the first MAXG are the shadows
    gullGeo = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(1, 1);
    gullGeo.index = plane.index; gullGeo.setAttribute('position', plane.getAttribute('position'));
    aA = new THREE.InstancedBufferAttribute(new Float32Array(MAXG * 2 * 4), 4).setUsage(THREE.DynamicDrawUsage);
    aB = new THREE.InstancedBufferAttribute(new Float32Array(MAXG * 2 * 4), 4).setUsage(THREE.DynamicDrawUsage);
    aL = new THREE.InstancedBufferAttribute(new Float32Array(MAXG * 2), 1).setUsage(THREE.DynamicDrawUsage);
    gullGeo.setAttribute('aA', aA); gullGeo.setAttribute('aB', aB); gullGeo.setAttribute('aLight', aL);
    gullGeo.instanceCount = 0;
    gullMat = new THREE.ShaderMaterial({
      vertexShader: GULL_VERTEX, fragmentShader: GULL_FRAGMENT, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
      uniforms: { uReading: oceanMat.uniforms.uReading, uReadViewport: oceanMat.uniforms.uReadViewport, uRes: view.uRes, uWaveA: view.uWaveA, uWaveB: view.uWaveB, uShadowCol: { value: colour('#0a1626') }, uBirdLight: { value: new THREE.Color(1, 1, 1) } }
    });
    gullMesh = new THREE.Mesh(gullGeo, gullMat); gullMesh.frustumCulled = false; gullMesh.renderOrder = 5; gullMesh.visible = false;
    islands = createOceanIslands({ waterUniforms: oceanMat.uniforms, gradeGlsl, viewGlsl: VIEW_GLSL, waterGlsl: WATER_SURFACE_GLSL, small, reducedMotion, fixedBackground, renderer });
    scene.add(oceanMesh, islands.mesh, gullMesh, skyMesh);
    photoFx.build({ scene, renderer });
  }
  /* Prepare offscreen programs asynchronously before the sea can become visible.
     The linear-target variant matters too: the wave first captures the planet in sceneRT. */
  let bakeTask=null,bakePending=false,oceanDisposed=false,releaseAfterBake=false;
  const bakeTiming={};
  async function compileFor(targetScene,targetCamera,target) {
    const previous=renderer.getRenderTarget();let pending;
    try {
      renderer.setRenderTarget(target);
      pending=renderer.compileAsync?renderer.compileAsync(targetScene,targetCamera):Promise.resolve(renderer.compile(targetScene,targetCamera));
    } finally {renderer.setRenderTarget(previous);}
    await pending;
  }
  function drawBake(material,target) {
    const previous=renderer.getRenderTarget();
    try {bakeMesh.material=material;renderer.setRenderTarget(target);renderer.render(bakeScene,bakeCam);}
    finally {renderer.setRenderTarget(previous);}
  }
  function bake() {
    if(!built||baked||oceanDisposed)return bakeTask;
    if(bakeTask)return bakeTask;
    const started=performance.now();bakePending=true;
    bakeTask=(async()=>{
      for(const [name,material,target]of [['noise',noiseMat,noiseRT],['wave',waveMat,waveRT]]){
        if(oceanDisposed)return;
        const t=performance.now();bakeMesh.material=material;
        await compileFor(bakeScene,bakeCam,target);
        if(oceanDisposed)return;
        drawBake(material,target);bakeTiming[name]=Math.round(performance.now()-t);
      }
      for(const [name,target]of [['canvas',null],['capture',sceneRT]]){
        if(oceanDisposed)return;
        const t=performance.now();await compileFor(scene,camera,target);bakeTiming[name]=Math.round(performance.now()-t);
      }
      if(oceanDisposed)return;
      const previous=renderer.getRenderTarget();
      try {
        renderer.getDrawingBufferSize(size);sceneRT.setSize(Math.max(2,size.x),Math.max(2,size.y));
        renderer.setRenderTarget(sceneRT);renderer.clear();
      } finally {renderer.setRenderTarget(previous);}
      baked=true;
    })().catch(error=>{if(!oceanDisposed){console.warn('Ocean prewarm unavailable; keeping the planet visible.',error);}})
      .finally(()=>{bakePending=false;bakeTiming.total=Math.round(performance.now()-started);if(releaseAfterBake)disposeGL();});
    return bakeTask;
  }
  function disposeGL() {
    if(islands){scene?.remove(islands.mesh);islands.dispose();islands=null;}
    for(const m of [oceanMesh,skyMesh,gullMesh])if(m)scene?.remove(m);
    for(const x of [waveRT,noiseRT,sceneRT,waveMat,noiseMat,oceanMat,skyMat,gullMat,gullGeo,blank])x?.dispose();
  }

  let video = null, photo = null, videoMix = 0, videoSize = [16, 9], photoSize = [1280, 763];
  function setVideo(texture) { video = texture; const v = texture?.image; if (v?.videoWidth) videoSize = [v.videoWidth, v.videoHeight]; }
  function setVideoMix(v) { videoMix = v; }
  function setPhoto(texture) { photo = texture; const i = texture?.image; if (i?.width) photoSize = [i.width, i.height]; }

  // ---------- gulls ----------
  const birds = Array.from({ length: MAXG }, (_, i) => {
    const r = k => rnd(i * 13 + k);
    const trio = i < 3;
    const heading = trio ? Math.PI * (1.12 + (i - 1) * .015) : (r(1) < .62 ? Math.PI * (.9 + r(2) * .3) : Math.PI * (-.12 + r(2) * .3));
    return {
      x: trio ? .35 + i * .055 : (r(3) - .5) * 3, y: trio ? .1 - i * .05 + (i === 1 ? .04 : 0) : (r(4) - .5) * 1.4,
      heading, speed: trio ? .052 : .036 + r(5) * .03, alt: trio ? .21 + i * .008 : .1 + r(6) * .17,
      weave: .02 + r(7) * .04, weaveRate: .25 + r(8) * .3, weavePhase: r(9) * 6.28,
      flapHz: 2.6 + r(10) * .9, cycle: 3.5 + r(11) * 3.5, flapFor: 1.1 + r(12) * 1.4, offset: r(13) * 20, size: .9 + r(14) * .25
    };
  });
  function updateGulls(o, cam, time, sunV) {
    const count = Math.round(num('gulls', 0, MAXG) * (small ? .6 : 1));
    const alpha = o.birds * (reducedMotion ? 0 : 1);
    if (!gullGeo || count <= 0 || alpha <= .001) { if (gullGeo) gullGeo.instanceCount = 0; return false; }
    const speed = num('gullSpeed', 0, 4), size = .042 * num('gullSize', .2, 4), flapAmt = num('flap', 0, 2);
    const hx = .5 * W / H + .12, hy = .62;
    const A = aA.array, B = aB.array, Lt = aL.array;
    const sx = sunV.x / Math.max(sunV.z, .18), sy = sunV.y / Math.max(sunV.z, .18);
    for (let i = 0; i < count; i++) {
      const b = birds[i], t = time * speed;
      const perp = b.heading + Math.PI / 2;
      const wv = Math.sin(t * b.weaveRate + b.weavePhase) * b.weave;
      let px = b.x + Math.cos(b.heading) * b.speed * t + Math.cos(perp) * wv;
      let py = b.y + Math.sin(b.heading) * b.speed * t + Math.sin(perp) * wv;
      const dh = Math.atan2(Math.cos(t * b.weaveRate + b.weavePhase) * b.weave * b.weaveRate, b.speed);
      const head = b.heading + dh;
      const k = 1 / Math.max(.05, o.cam - b.alt);
      // screen position (screen heights from the centre), wrapped round the frame
      let x = (px - cam.x) * k, y = (py - cam.y) * k;
      x = ((x + hx) % (2 * hx) + 2 * hx) % (2 * hx) - hx; y = ((y + hy) % (2 * hy) + 2 * hy) % (2 * hy) - hy;
      // wings: bouts of flapping, then a glide with the wings a little raised
      const c = ((time + b.offset) % b.cycle);
      const flapping = c < b.flapFor && flapAmt > 0;
      const phase = (time + b.offset) * b.flapHz * Math.PI * 2;
      const lift = flapping ? Math.sin(phase) * .95 * Math.min(1, flapAmt) : .18;
      const spread = mix(1, .45 + .55 * Math.abs(Math.cos(lift)), Math.min(1, flapAmt));
      const light = 1 + .09 * Math.sin(lift) ;
      const wing = size * b.size * k / (1 / (1 - b.alt));   // at the chapters' height a gull keeps its size
      // the bird, then its shadow on the water (cast away from the sun)
      const wx = cam.x + x / k, wy = cam.y + y / k;
      const gx = (wx - sx * b.alt - cam.x) / o.cam, gy = (wy - sy * b.alt - cam.y) / o.cam;
      const j = MAXG + i, s = i;
      A[j * 4] = x; A[j * 4 + 1] = y; A[j * 4 + 2] = wing; A[j * 4 + 3] = alpha;
      B[j * 4] = Math.cos(head); B[j * 4 + 1] = Math.sin(head); B[j * 4 + 2] = spread; B[j * 4 + 3] = 0; Lt[j] = light;
      A[s * 4] = gx; A[s * 4 + 1] = gy; A[s * 4 + 2] = wing * (o.cam - b.alt) / o.cam; A[s * 4 + 3] = alpha * oceanMat.uniforms.uSunEnergy.value;
      B[s * 4] = Math.cos(head); B[s * 4 + 1] = Math.sin(head); B[s * 4 + 2] = spread; B[s * 4 + 3] = 1; Lt[s] = 1;
    }
    // shadows first (instances 0..count-1), birds after (MAXG..MAXG+count-1): pack the birds right after the shadows
    if (count < MAXG) {
      A.copyWithin(count * 4, MAXG * 4, (MAXG + count) * 4); B.copyWithin(count * 4, MAXG * 4, (MAXG + count) * 4); Lt.copyWithin(count, MAXG, MAXG + count);
    }
    gullGeo.instanceCount = count * 2;
    aA.needsUpdate = aB.needsUpdate = aL.needsUpdate = true;
    return true;
  }

  // ---------- the palette: the valley's (read live, so tuning the valley retunes the sea) ----------
  const pal = { deep: new THREE.Color(), lit: new THREE.Color(), ink: new THREE.Color(), foam: new THREE.Color(), glint: new THREE.Color(),
    far: new THREE.Color(), crest: new THREE.Color(), scrim: new THREE.Color(), cloudLit: new THREE.Color(), cloudShade: new THREE.Color() };
  const hexOr = (v, d) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d;
  const eveningBlue = new THREE.Color(), eveningFog = new THREE.Color(), eveningSun = new THREE.Color();
  const liveSun = new THREE.Color(), liveFog = new THREE.Color(), liveWater = new THREE.Color(), liveHighlight = new THREE.Color();
  function palette() {
    const C = window.__MONTIS_STUDY__?.CONFIG, ww = C?.watershedWater || {}, al = C?.alpineLight || {};
    // A scene clock creates thousands of intermediate colours; keep live colours in place instead of caching every hex.
    const sun = liveSun.setStyle(hexOr(al.sunColor, '#ffdcb8'), THREE.LinearSRGBColorSpace), fog = liveFog.setStyle(hexOr(al.fogColor, '#c4d3e4'), THREE.LinearSRGBColorSpace), white = colour('#ffffff');
    pal.cloudLit.setStyle(hexOr(al.cloudLit, '#fff6ec'), THREE.LinearSRGBColorSpace); pal.cloudShade.setStyle(hexOr(al.cloudShade, '#7487a6'), THREE.LinearSRGBColorSpace);
    if (num('valley', 0, 1) > .5) {
      // the canyon's water (watershedWater.base / .highlight) as it reads lit in the valley: mid-tone slate blue
      const t = num('tone', .3, 2), base = liveWater.setStyle(hexOr(ww.base, '#699fce'), THREE.LinearSRGBColorSpace), hi = liveHighlight.setStyle(hexOr(ww.highlight, '#b4bec5'), THREE.LinearSRGBColorSpace);
      pal.deep.copy(base).multiplyScalar(.5 * t);
      pal.lit.copy(base).lerp(hi, .3).multiplyScalar(.82 * t);
      pal.ink.copy(base).multiplyScalar(.3 * t);
      pal.foam.copy(white).lerp(fog, .25);
      pal.glint.copy(sun).lerp(white, .35);
    } else {
      pal.deep.copy(colour(str('deep'))); pal.lit.copy(colour(str('lit'))); pal.ink.copy(colour(str('ink')));
      pal.foam.copy(colour(str('foam'))); pal.glint.copy(colour(str('glintColor')));
    }
    pal.far.copy(pal.deep).lerp(fog, .4);
    pal.crest.copy(sun).lerp(white, .5);
    const light = getSceneDaylight();
    if (light.enabled) {
      // These full-screen shaders use display RGB. The shared scene palette is linear, as are Three's real lights.
      const day = clamp(light.daylight), night = clamp(light.night);
      eveningBlue.copy(light.skyMid).convertLinearToSRGB();
      eveningFog.copy(light.fog).convertLinearToSRGB();
      eveningSun.copy(light.sunColor).convertLinearToSRGB();
      pal.deep.lerp(eveningBlue, .28 * night).multiplyScalar(mix(.52, 1, day));
      pal.lit.lerp(eveningFog, .16 * night).multiplyScalar(mix(.58, 1, day));
      pal.ink.lerp(eveningBlue, .12 * night).multiplyScalar(mix(.56, 1, day));
      pal.foam.lerp(eveningFog, .45 * night).multiplyScalar(mix(.48, 1, day));
      pal.glint.copy(eveningSun).lerp(white, .2 * day);
      pal.far.copy(pal.deep).lerp(eveningFog, .34);
      pal.crest.copy(pal.foam).lerp(eveningSun, .18 * day);
      // The sea, island ridges and bird shadows all lose direct sunlight together after sunset.
      oceanMat.uniforms.uSunEnergy.value = Math.min(1.5, Math.max(0, light.intensity / 4.5));
      oceanMat.uniforms.uAmbientTint.value.copy(pal.cloudShade).multiplyScalar(.6).addScalar(.12);
      gullMat.uniforms.uBirdLight.value.copy(pal.cloudLit).lerp(white, .45 * day);
    } else {
      oceanMat.uniforms.uSunEnergy.value = 1;
      oceanMat.uniforms.uAmbientTint.value.setRGB(.42, .49, .59);
      gullMat.uniforms.uBirdLight.value.setRGB(1, 1, 1);
    }
    pal.scrim.copy(pal.ink).multiplyScalar(.6);
  }

  // ---------- per frame ----------
  let last = 0, waveClock = 0, cloudClock = 0, startTime = -1;
  const sunV = new THREE.Vector3(.42, .38, .82).normalize();
  const cam = { x: 0, y: 0 };
  const size = new THREE.Vector2();
  function render(s, time) {
    const o = s.o;
    if (!built || !o) return;
    // Fetch the small island atlas during the global chapter, before the wave reaches the sea.
    if (o.t > -.65) islands?.load();
    if(!baked){
      bake();oceanMesh.visible=skyMesh.visible=gullMesh.visible=false;
      if(islands)islands.mesh.visible=false;photoFx.update(o,time,W,H,false);return;
    }
    if (startTime < 0) startTime = time;
    const dt = last ? clamp(time - last, 0, .1) : 0; last = time;
    const visible = o.show > .001 && s.footerTop > 1;
    oceanMesh.visible = skyMesh.visible = visible;
    photoFx.update(o, time, W, H, visible);
    if (!visible) { gullMesh.visible = false; if (islands) islands.mesh.visible = false; return; }
    const light = getSceneDaylight();
    if (light.enabled) {
      // Alpine world: Y up / forward -Z. The top-down sea: XY ground / Z up.
      // Preserve the shared azimuth; below the horizon only the blue ambient remains.
      const d = light.sunDirection;
      sunV.set(d.x, -d.z, Math.max(.18, d.y)).normalize();
    } else sunV.set(.42, .38, .82).normalize();
    renderer.getDrawingBufferSize(size);
    const dpr = size.y / Math.max(1, H);
    // index1-5 keeps one sea/island view while the chapter panels travel over it.
    cam.x = reducedMotion || fixedBackground ? 0 : o.h * num('travel', 0, 3) * W / H; cam.y = 0;
    if (!reducedMotion) { waveClock += dt * num('waveSpeed', 0, 4); cloudClock += dt * num('cloudSpeed', 0, 6); }
    if (visible) {
      setWaves(num('wind', -180, 180));
      waveMat.uniforms.uTime.value = waveClock * 1.15;
      bakeMesh.material = waveMat; renderer.setRenderTarget(waveRT); renderer.render(bakeScene, bakeCam); renderer.setRenderTarget(null);
    }
    const u = oceanMat.uniforms, k = skyMat.uniforms;
    const readOpacity=1;
    u.uReading.value.set(o.panel0*readOpacity,1);u.uReadViewport.value.set(W,H);
    const seaWind=num('wind',-180,180)*Math.PI/180;u.uSeaWind.value.set(Math.cos(seaWind),Math.sin(seaWind));
    u.uRes.value.copy(size);
    u.uView.value.set(cam.x, cam.y, o.cam, reducedMotion ? 0 : time - startTime);
    // the wave: its front crosses the frame along its direction (0° = rising from the bottom); off screen at 0 and 1
    const waveOn = !reducedMotion && o.w > 0 && o.w < 1;
    const ang = num('waveAngle', -90, 90) * Math.PI / 180, dx = Math.sin(ang), dy = Math.cos(ang);
    const Lw = num('waveLength', .03, .6), soft = num('waveSoft', .002, .3), wob = num('wobble', 0, .3);
    const extent = .5 * (Math.abs(dx) * W / H + Math.abs(dy));
    const F = mix(-extent - Lw * 1.5 - wob - soft, extent + Lw * 3.5 + wob + soft, o.w);
    u.uWaveA.value.set(dx, dy, F, soft);
    u.uWaveB.value.set(Lw, num('waveAmp', 0, .2), wob, waveOn ? 1 : 0);
    u.uMix.value.set(waveOn ? 1 : 0, num('crest', 0, 4), num('spray', 0, 3), num('refract', 0, 3));
    if (waveOn) {
      // the planet as it is being drawn this frame (my layers left out), for the wave to refract
      if (sceneRT.width !== size.x || sceneRT.height !== size.y) sceneRT.setSize(size.x, size.y);
      oceanMesh.visible = skyMesh.visible = gullMesh.visible = false;
      if (islands) islands.mesh.visible = false;
      renderer.setRenderTarget(sceneRT); renderer.render(scene, camera); renderer.setRenderTarget(null);
      oceanMesh.visible = skyMesh.visible = true;
      u.uScene.value = sceneRT.texture;
    }
    palette();
    islands?.update({ visible, ink: pal.ink, foam: pal.foam, haze: pal.far, aspect: W/H, alpha: reducedMotion ? o.alpha : 1 });
    const shine = mix(1600, 160, num('glintSize', 0, 1)) / Math.max(1, Math.sqrt(o.cam));
    u.uLook.value.set(.3 * num('waveScale', .2, 4), .6 * num('rough', 0, 3), num('glint', 0, 6), shine);
    u.uLook2.value.set(num('vignette', 0, 1.5), num('scrim', 0, 1.5) * (o.active ? 1 : smooth(.6, 1, o.t)), reducedMotion ? o.alpha : 1, .45);
    u.uGlintFx.value.set(num('glintText', 0, 1), num('glintKnee', 0, 3), 0, 0);
    u.uDeep.value.copy(pal.deep); u.uLit.value.copy(pal.lit); u.uInk.value.copy(pal.ink);
    u.uFoam.value.copy(pal.foam); u.uGlintCol.value.copy(pal.glint);
    u.uFarCol.value.copy(pal.far); u.uCrestCol.value.copy(pal.crest); u.uScrimCol.value.copy(pal.scrim);
    u.uFoamCol.value.copy(pal.foam).lerp(pal.crest, .18);
    // The watermark belongs to the sea, so it shares the fixed background view.
    // Keep the mark vertically centred; portrait only adjusts its diameter to stay within the screen.
    const narrow = clamp(W / H / 1.2, .45, 1);
    const heroD = num('heroSize', .1, 1.2) * mix(.82, 1, narrow);
    u.uHero.value.set(num('heroX', -1, 1) * narrow * narrow, num('heroY', -.6, .6), heroD, num('heroContrast', 0, 3));
    const vReady = video && video.image && video.image.readyState >= 2;
    u.uVideo.value = vReady ? video : blank; u.uPhoto.value = photo || blank;
    u.uHeroMix.value.set(vReady ? clamp(videoMix) : 0, (vReady || photo) ? 1 : 0, photoSize[0] / photoSize[1], videoSize[0] / videoSize[1]);
    // clouds: drifting with the wind, a layer above the sea (parallax), their shadows below
    const cloudAlt = num('cloudHeight', 0, .9);
    const windR = num('wind', -180, 180) * Math.PI / 180;
    u.uCloud.value.set(num('clouds', 0, 1), num('cloudOpacity', 0, 1), cloudAlt, num('cloudShadow', 0, 1.5));
    u.uCloudMove.value.set(Math.cos(windR) * cloudClock * .012, Math.sin(windR) * cloudClock * .012, 1.15 / num('cloudScale', .2, 5), .22);
    u.uSun.value.copy(sunV);
    // the cloud layer shares the view, the wave and the clouds (same uniform objects); its own: the valley's cloud colours
    k.uCloudLight.value.copy(pal.cloudLit); k.uCloudShade.value.copy(pal.cloudShade);
    k.uSkyOn.value = visible ? 1 : 0;
    gullMesh.visible = visible && updateGulls(o, cam, time - startTime, sunV);
  }

  // ---------- the HTML ----------
  let photosLoaded = false;
  const photos = [...root.querySelectorAll('[data-ocean-photo]')];
  function loadPhotos() {
    if (photosLoaded) return; photosLoaded = true;
    for (const image of photos) {
      const name = image.dataset.oceanPhoto, base = new URL('../assets/ocean/' + name, import.meta.url).href;
      image.srcset = base + '-480.webp 480w, ' + base + '-800.webp 800w';
      image.src = base + '-800.webp';
      image.addEventListener('load', () => image.closest('figure').classList.add('is-loaded'), { once: true });
      if (image.complete && image.naturalWidth) image.closest('figure').classList.add('is-loaded');
    }
  }
  let painted = { q: NaN, tx: '', ty: '', k: '' };
  const panelState = panels.map(() => ({ p: -1, op: -1, x: NaN, vis: null }));
  function paint(s) {
    const o = s.o; if (!o) return;
    root.classList.toggle('is-ocean', o.active);
    if (o.t > -.65) loadPhotos();
    // text block position (dials)
    const tx = num('textX', 0, .6).toFixed(3), ty = num('textY', .3, 1).toFixed(3);
    if (tx !== painted.tx) { painted.tx = tx; root.style.setProperty('--fiwo-x', tx); }
    if (ty !== painted.ty) { painted.ty = ty; root.style.setProperty('--fiwo-y', ty); }
    const h=o.h;
    panels.forEach((panel,k)=>{
      const next=oceanPanelState({index:k,progress:h,width:W,reducedMotion,count:N}),st=panelState[k];
      if(next.visible!==st.vis){st.vis=next.visible;panel.style.visibility=next.visible?'visible':'hidden';panel.inert=!next.visible;}
      if(st.op!==1){st.op=1;panel.style.opacity='1';panel.style.setProperty('--p','1');panel.style.setProperty('--op2','1');}
      if(next.x!==st.x){st.x=next.x;panel.style.transform='translate3d('+next.x+'px,0,0)';}
    });
    const q = clamp(h / (N - 1));
    if (Math.abs(q - painted.q) > .0005) {
      painted.q = q; dom.progress.style.setProperty('--q', q.toFixed(4));
      const current = String(Math.round(h));
      if (current !== painted.k) { painted.k = current; ticks.forEach((b, i) => { if (i === +current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); }); }
    }
    if (layoutKey && layoutKey !== num('dive', .8, 6) + '|' + num('stop', .5, 4)) { layoutKey = ''; remeasure(); }
  }

  // ---------- input ----------
  /* a sideways swipe across the section moves it as far as the finger went */
  const swipe = () => at.stop / Math.max(1,W);

  root.addEventListener('click', event => {
    const b = event.target.closest('[data-ocean-go]');
    if (!b || !root.contains(b)) return;
    event.preventDefault(); go(stopY(+b.dataset.oceanGo || 0));
  });
  // keyboard focus on a chapter that is off to the side: bring that chapter in
  root.addEventListener('focusin', event => {
    const panel = event.target.closest?.('.fiwo-panel');
    if (panel && track.contains(panel)) go(stopY(+panel.dataset.stop || 0));
  });

  return {
    layout, measure, sample, earth, setGlobe, build, bake, setVideo, setVideoMix, setPhoto, render, paint, omega, stopY,
    get swipe() { return swipe(); }, get active() { return !!cur?.active; }, get N() { return N; },
    close() { photoFx.close(); painted = { q: NaN, tx: '', ty: '', k: '' }; panelState.forEach(st => { st.p = -1; st.op = -1; st.op2 = -1; st.x = NaN; st.vis = null; }); root.classList.remove('is-ocean'); },
    get state() { return { at: { ...at }, stops: Array.from({ length: N }, (_, k) => stopY(k)), o: cur && { ...cur }, globe: { ...globe }, gulls: gullGeo?.instanceCount ?? 0, photoInertia: photoFx.state, prewarm: { ready:baked, running:bakePending&&!oceanDisposed, timings:{...bakeTiming} }, islands: islands?.state, photos: photos.map(i => ({ ready: !!i.naturalWidth, src: i.currentSrc })) }; },
    dispose() {
      if(oceanDisposed)return;oceanDisposed=true;photoFx.dispose();
      // Detach now, but retain pending compile materials until Three's ready poll settles.
      for(const m of [oceanMesh,skyMesh,gullMesh,islands?.mesh])if(m)scene?.remove(m);
      if(bakePending)releaseAfterBake=true;else disposeGL();
    }
  };
}
