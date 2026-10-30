/* =====================================================================
   index1-5 · LOGO 收尾 Logo Seal (2026-10-24). Client: 「新區塊在橫移以下出現，轉場方式跟地球到橫移一樣，
   中間是 LOGO1 的 LOGO 平旋轉一圈，結尾如圖（6.webp）」.
   After the last strategy chapter of the ocean section a full-screen water wave (the same family as the globe → sea
   wave in world-ocean.js: feathered front, bright crest line, spray, refraction of both images, NO circle) carries the
   sea's last frame away and brings in a dusk lake with the LOGO 1 glass mark above it. The mark then turns once about
   its vertical axis with the scroll (eased, ending exactly on the front view) and the closing words arrive. Everything
   is a function of the world's scroll position y: scroll back and it plays back.
   Pieces (all lazy: nothing is built before the visitor is ~2 screens away, nothing is drawn outside the block):
     · the lake scene   world-logo-scene.js  (Interface B: createLakeScene → scene, camera, markAnchor, environment)
     · the glass mark   world-logo-mark.js   (Interface A: createLogoMark  → group, update({yaw,time,q}), …)
     · this file        clocks, DOM, the offscreen work and the wave composite.
   Compositing: while the wave crosses, the world's scene (the sea, as the ocean module draws it) goes to an offscreen
   target and the lake is drawn to the canvas and copied (so it is exactly what the lake draws on screen, whatever
   colour handling its materials use); a full-screen pass then mixes the two through the wave. Before the wave only the
   world draws; after it only the lake.
   Wired into the page's local copy of js/finnovation-world.js by prototypes/index1-5/world-logo-build.cjs.
   Dials: CONFIG.logoSeal (tuner 「LOGO 收尾 Logo Seal」, with the mark's and the lake's own rows). ?logoseal=0 removes it.
   ===================================================================== */
import * as THREE from 'three';

/* The defaults. Strict JSON: world-logo-build.cjs copies it into main.js's CONFIG.logoSeal. */
const DEFAULTS = /*LOGOSEAL-DEFAULTS*/{
  "transition": 0,
  "cutClock": 1,
  "cutAt": 0.3,
  "cutTime": 0.9,
  "glassSize": 0.34,
  "glassSplit": 0.6,
  "glassShift": 0.45,
  "glassZoom": 0.12,
  "glassBlur": 0.28,
  "glassChroma": 0.6,
  "glassFrost": 0,
  "glassDip": 0.3,
  "glassBloom": 1.2,
  "glassBloomAt": 0.42,
  "glassGlitch": 0,
  "glassGrain": 0,
  "glassSpread": 0.55,
  "glassSeam": 0.6,
  "glassPush": 0.1,
  "glassTint": "#6d91b4",
  "tiles": 8,
  "tileDepth": 1.1,
  "tilePersp": 1.3,
  "tileSpread": 0.65,
  "tileJitter": 0.35,
  "tileGlow": 1.1,
  "tileLine": 1.6,
  "tileGlowColor": "#91b0c8",
  "tileField": "#10243a",
  "tileFog": 0.75,
  "tileGrid": 0.25,
  "tileExtrude": 0.55,
  "wave": 1.7,
  "waveLead": 0.4,
  "waveAngle": -8,
  "waveLength": 0.2,
  "waveAmp": 0.05,
  "waveSoft": 0.045,
  "wobble": 0.07,
  "crest": 1.1,
  "spray": 1,
  "refract": 1.4,
  "refractNew": 0.8,
  "spinStart": 0.44,
  "spin": 2.6,
  "spinEnd": 0.92,
  "spinEase": 0.94,
  "spinBlur": 10,
  "restYaw": 0,
  "riseStart": 0.28,
  "riseEnd": 0.48,
  "riseEase": 0.9,
  "hold": 1.65,
  "followDaylight": 0,
  "prepare": 0.1,
  "textIn": 0.84,
  "textY": 0.735,
  "textSize": 1,
  "textShow": 1,
  "markScale": 0.89,
  "markY": 0,
  "timeScale": 1
}/*/LOGOSEAL-DEFAULTS*/;
export const LOGOSEAL_DEFAULTS = DEFAULTS;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const smoother = t => t * t * t * (t * (t * 6 - 15) + 10);
const TAU = Math.PI * 2;
const NOISE = 128;

/* ---------------------------------------------------------------- GLSL */
const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/* The wave: a travelling swell whose front crosses the whole frame (no circle). FRONT returns the signed distance
   behind the front (> 0: the wave has passed = the lake; < 0: still the sea), the wave's displacement along its
   direction (it bends both images like a lens), its face (lit side > 0, trough < 0) and its crest line. The front
   wobbles along its length and the swells behind it keep moving with time, so it is liquid even when the scroll
   rests; its position is the scroll's. Noise: one fetch of a small value-noise texture = four independent channels,
   smooth-interpolated (the coordinates are in lattice cells). */
const COMPOSITE = /* glsl */ `
uniform sampler2D tOld, tNew, uNoise;
uniform vec2 uRes;
uniform vec4 uWaveA;   // travel direction x, y (screen, y up), front position (screen heights from the centre), edge softness
uniform vec4 uWaveB;   // wavelength, displacement amplitude (screen heights), front wobble, on (0: plain cross-fade)
uniform vec4 uMix;     // crest brightness, spray, refraction of the old image, refraction of the new image
uniform vec4 uTime;    // time, cross-fade (reduced motion), 0, 0
uniform vec3 uFoam, uCrest, uDip;
uniform vec4 uTileA;   // blocks: cell size (screen heights), deepest push (projected), stagger share, randomness
uniform vec4 uTileB;   // blocks: progress, sweep span (screen heights), edge glow, edge width (px)
uniform vec4 uTileC;   // blocks: on (1: the blocks, 0: the wave), depth fog, grid lines while it runs, the picture drawn down the side walls
uniform vec3 uGlow, uField;
uniform vec4 uGlassA;  // frosted glass: pane size (screen heights), split chance, slide (panes), magnify
uniform vec4 uGlassB;  // frosted glass: motion blur (share of the distance to the centre), colour split, frost, dark dip
uniform vec4 uGlassC;  // frosted glass: progress (eased), stagger, seams, zoom-through
uniform vec4 uGlassD;  // frosted glass: streaks of light (bloom), their threshold, igloo break-up, grain
uniform vec3 uTint;
varying vec2 vUv;
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }   // turns a noise lattice off the screen's axes
vec4 nz(vec2 p) { vec2 i = floor(p), f = p - i; f = f * f * (3.0 - 2.0 * f); return texture2D(uNoise, (i + f + 0.5) / ${NOISE}.0); }
float front(vec2 p, out float disp, out float face, out float crest) {
  vec2 d = uWaveA.xy, tg = vec2(-d.y, d.x);
  float x = dot(p, d), y = dot(p, tg), tm = uTime.x;
  float wob = (nz(vec2(y * 1.1 + tm * 0.03, 3.7)).r - 0.5) * 2.4 * uWaveB.z + (nz(vec2(y * 3.9 - tm * 0.07, 7.1)).g - 0.5) * 0.9 * uWaveB.z;
  float sd = uWaveA.z + wob - x;
  float L = max(uWaveB.x, 0.005), A = uWaveB.y, u = sd / L;
  // one smooth swell at the front, small ripples only behind it
  float bump = exp(-u * u);
  float slope = -2.0 * u * bump;
  float rip = sd > 0.0 ? exp(-sd / (L * 2.2)) * sin(6.2831853 * sd / (L * 0.55) - tm * 3.0) : 0.0;
  disp = A * (slope * 0.85 + 0.3 * rip);
  face = slope + 0.35 * rip;
  crest = exp(-pow((u + 0.05) / 0.075, 2.0)) + 0.3 * exp(-pow((u + 0.05) / 0.3, 2.0));
  return sd;
}
vec2 fold(vec2 uv) { uv = 1.0 - abs(1.0 - abs(uv)); return clamp(uv, vec2(0.001), vec2(0.999)); }   // mirrored at the frame's edges
/* The blocks (hubtown.co.in): the frame is a grid of square columns seen from straight above, the eye at the screen's centre. Each column
   sinks and comes back up (its own clock, staggered along the wave's direction with some randomness); it carries the sea down and brings the
   lake up, turning at its deepest, where the depth fog hides the swap. A ray from the eye moves away from the centre as it goes down, so the
   pixel walks at most three cells outward: it hits a column's top, or the side wall of a neighbour standing higher. Edges glow blue. */
float hash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float cellT(vec2 c) {
  float o = clamp(dot(c * uTileA.x, uWaveA.xy) / max(uTileB.y, 1e-3) + 0.5, 0.0, 1.0);
  o = mix(o, hash(c), uTileA.w);
  return clamp((uTileB.x - o * uTileA.z) / max(1.0 - uTileA.z, 1e-3), 0.0, 1.0);
}
float zOf(float t) { float s = sin(3.14159265 * t); return uTileA.y * s * s; }
vec3 pic(vec2 b, float t) { vec2 uv = fold(b * uRes.y / uRes + 0.5); return mix(texture2D(tOld, uv).rgb, texture2D(tNew, uv).rgb, smoothstep(0.42, 0.58, t)); }
float glowAt(float px) { float w = max(uTileB.w, 0.3); return exp(-max(px, 0.0) / w) + 0.22 * exp(-max(px, 0.0) / (w * 7.0)); }
vec3 tiles(vec2 p) {
  float cs = uTileA.x, zm = max(uTileA.y, 1e-4), run = sin(3.14159265 * clamp(uTileB.x, 0.0, 1.0));
  vec2 sg = vec2(p.x < 0.0 ? -1.0 : 1.0, p.y < 0.0 ? -1.0 : 1.0), ap = max(abs(p), vec2(1e-5));
  vec2 c = floor(p / cs + 0.5);
  float t = cellT(c), zc = zOf(t);
  for (int k = 0; k < 3; k++) {
    vec2 ze = abs((c + 0.5 * sg) * cs) / ap - 1.0;             // the depth at which the ray leaves this cell, per axis
    float zx = min(ze.x, ze.y);
    if (zc <= zx) {
      // this column's top: its picture, fogged as it sinks; its rim glows while it or the neighbour across that rim moves
      vec2 b = p * (1.0 + zc), d = b - c * cs, e = 0.5 * cs - abs(d);
      vec2 nb = c + (e.x < e.y ? vec2(d.x < 0.0 ? -1.0 : 1.0, 0.0) : vec2(0.0, d.y < 0.0 ? -1.0 : 1.0));
      float px = min(e.x, e.y) / (1.0 + zc) * uRes.y;
      float act = max(max(zc, zOf(cellT(nb))) / zm, uTileC.z * run);
      vec3 col = mix(pic(b, t), uField, uTileC.y * zc / zm);
      return col + uGlow * uTileB.z * min(act, 1.0) * glowAt(px);
    }
    bool sx = ze.x < ze.y;
    vec2 cn = c + (sx ? vec2(sg.x, 0.0) : vec2(0.0, sg.y));
    float tn = cellT(cn), zn = zOf(tn);
    if (zn <= zx) {
      // the next column stands higher than the ray here: its side wall, facing the centre. Its rim's picture runs down it (the extrusion),
      // fading into the deep; lit from above; glowing at its top edge, its foot and its corners
      float ax = sx ? ap.x : ap.y, k1 = ax / (1.0 + zx) * uRes.y;
      vec2 b = p * (1.0 + zx);
      float across = sx ? b.y - cn.y * cs : b.x - cn.x * cs;
      float side = (0.5 * cs - abs(across)) / (1.0 + zx) * uRes.y;
      vec2 rim = sx ? vec2((cn.x - 0.5 * sg.x) * cs, b.y) : vec2(b.x, (cn.y - 0.5 * sg.y) * cs);
      float dz = (zx - zn) / zm;
      float lit = sx ? 0.62 : (sg.y < 0.0 ? 0.85 : 0.42);
      vec3 col = mix(uField, pic(rim, tn) * lit, uTileC.w * exp(-dz * 2.2));
      col = mix(col, uField * 0.6, clamp(dz * 0.5, 0.0, 0.6)) + uGlow * 0.18 * lit * exp(-dz * 3.0);
      float g = max(glowAt((zx - zn) * k1), max(glowAt((zc - zx) * k1) * 0.7, glowAt(side) * 0.8));
      return col + uGlow * uTileB.z * g;
    }
    c = cn; t = tn; zc = zn;
  }
  return uField;
}
/* The frosted glass (hubtown.co.in's cuts, transition 2): the frame breaks into panes of frosted glass — big squares, some cut in two, some
   again — each sliding off its place and magnifying what is behind it, its edge a soft bevel; everything is pulled into a radial motion
   blur toward the centre that splits into colours along its streaks, the picture tints blue and darkens in the middle of the cut, and the
   panes change from the sea to the lake one by one. Nothing moves at 0 and at 1 (the exact pictures). */
vec3 h3(vec2 c) { return fract(sin(vec3(dot(c, vec2(127.1, 311.7)), dot(c, vec2(269.5, 183.3)), dot(c, vec2(419.2, 371.9)))) * 43758.5453); }
void pane(vec2 p, out vec2 bc, out vec2 hs) {
  float S = uGlassA.x;
  bc = floor(p / S + 0.5) * S; hs = vec2(0.5 * S);
  vec3 r = h3(bc * 3.17 + 0.5);
  if (r.x < uGlassA.y) {
    if (r.y < 0.5) { hs.x *= 0.5; bc.x += (p.x < bc.x ? -1.0 : 1.0) * hs.x; } else { hs.y *= 0.5; bc.y += (p.y < bc.y ? -1.0 : 1.0) * hs.y; }
    vec3 r2 = h3(bc * 5.31 + 1.7);
    if (r2.x < uGlassA.y * 0.55) {
      if (r2.y < 0.5) { hs.x *= 0.5; bc.x += (p.x < bc.x ? -1.0 : 1.0) * hs.x; } else { hs.y *= 0.5; bc.y += (p.y < bc.y ? -1.0 : 1.0) * hs.y; }
    }
  }
}
// igloo.inc's break-up: rows of segments; a few of them stretch their first pixel along the row, shift sideways, or coarsen
vec2 iglooGlitch(vec2 frag, float g, float seed, float k) {
  float rowH = floor(mix(6.0, 30.0, pow(hash(vec2(floor(frag.y / (24.0 * k)), seed)), 1.5)) * k) + 1.0;
  float row = floor(frag.y / rowH), hr = hash(vec2(row, seed * 1.7));
  float segW = mix(18.0, 160.0, hr * hr) * k, sx = floor((frag.x + hr * 997.0) / segW);
  vec2 src = frag;
  if (hash(vec2(sx, row) + seed * 3.1) < g * 0.6) {
    float mode = hash(vec2(sx * 1.3, row * 0.7) + seed);
    if (mode < 0.4) src.x = sx * segW - hr * 997.0 + 1.0;
    else if (mode < 0.6) src.x += (hash(vec2(sx, row + 9.0) + seed) - 0.5) * 120.0 * k;
    else { float q = 8.0 * k + 22.0 * k * hash(vec2(row, sx) + 4.0); src = (floor(src / q) + 0.5) * q; }
  }
  return src;
}
vec2 suv(vec2 q) { return fold(q * uRes.y / uRes + 0.5); }
vec3 glass(vec2 p, vec2 frag) {
  float P = uGlassC.x, run = sin(3.14159265 * P);
  // igloo's break-up (flickering ten times a second): the pixel this one reads from
  p = (iglooGlitch(frag, uGlassD.z * run, floor(uTime.x * 10.0), uRes.y / 900.0) - 0.5 * uRes) / uRes.y;
  float L = uGlassB.x * run, fr = uGlassB.z * 0.01 * run;
  float zo = 1.0 - uGlassC.w * P, zn = 1.0 + uGlassC.w * (1.0 - P);                    // the sea grows away, the lake arrives from a little further
  vec3 acc = vec3(0.0), ws = vec3(0.0);
  float dz = texture2D(uNoise, frag / ${NOISE}.0).b;                                 // the taps start at a random place per pixel: grain, not ghost copies
  for (int j = 0; j < 9; j++) {
    float f = (float(j) + dz) / 9.0;
    // each tap of the streak (toward the centre, frosted) reads the pane at its own place, so the panes' edges smear with the picture
    vec2 jit = (texture2D(uNoise, (frag + vec2(float(j) * 37.0, float(j) * 17.0)) / ${NOISE}.0).rg - 0.5) * fr;
    vec2 pj = (p + jit) * (1.0 - L * f);
    vec2 bc, hs; pane(pj, bc, hs);
    vec3 r = h3(bc * 7.31 + 3.1);
    float d0 = r.x * uGlassC.y, sp = smoothstep(d0, d0 + 1.0 - uGlassC.y, P);     // this pane's own change, sea → lake
    float w = clamp(0.35 * run + 0.85 * sin(3.14159265 * sp), 0.0, 1.0);           // how much it is moving now
    vec2 lp = pj - bc, e = hs - abs(lp);
    vec2 n = e.x < e.y ? vec2(lp.x < 0.0 ? -1.0 : 1.0, 0.0) : vec2(0.0, lp.y < 0.0 ? -1.0 : 1.0);
    float edge = exp(-min(e.x, e.y) * uRes.y / (2.0 + 7.0 * w));
    vec2 rd = bc / max(length(bc), 1e-3);
    // slid (a little more for the blue end of the streak than the red: colour fringes at the panes' edges), magnified, bent at its bevel
    vec2 shift = (rd * (0.5 + 0.5 * r.y) + (r.zy - 0.5) * 0.9) * uGlassA.z * uGlassA.x * w * (1.0 + (f - 0.5) * uGlassB.y * 0.6);
    vec2 q = bc + lp * (1.0 - uGlassA.w * w * (0.4 + r.z)) + shift + n * edge * w * 0.012;
    vec3 c = sp < 1.0 ? texture2D(tOld, suv(q * zo)).rgb : vec3(0.0);
    if (sp > 0.0) c = mix(c, texture2D(tNew, suv(q * zn)).rgb, sp);
    c *= 1.0 + (r.z - 0.5) * 0.65 * w;                                               // each pane its own frost
    c += max(c - uGlassD.y, 0.0) * uGlassD.x * 3.0 * run;                            // the lights smear into streaks
    vec3 sw = mix(vec3(1.0), vec3(1.0 - f, 1.0 - abs(2.0 * f - 1.0), f) * 1.5 + 0.1, uGlassB.y);
    acc += c * sw; ws += sw;
  }
  vec3 col = acc / ws;
  // the pane under the pixel: a sheen from above, a dark seam and a lit bevel at its edges
  vec2 bc, hs; pane(p, bc, hs);
  vec3 r = h3(bc * 7.31 + 3.1);
  float d0 = r.x * uGlassC.y, sp = smoothstep(d0, d0 + 1.0 - uGlassC.y, P);
  float w = clamp(0.35 * run + 0.85 * sin(3.14159265 * sp), 0.0, 1.0);
  vec2 lp = p - bc, e = hs - abs(lp);
  vec2 n = e.x < e.y ? vec2(lp.x < 0.0 ? -1.0 : 1.0, 0.0) : vec2(0.0, lp.y < 0.0 ? -1.0 : 1.0);
  float edge = exp(-min(e.x, e.y) * uRes.y / (2.0 + 7.0 * w)) * (1.0 - 0.6 * L / max(uGlassB.x, 1e-3));   // softer while the blur is long
  col += uTint * 0.06 * w * (0.5 + 0.5 * lp.y / hs.y);
  col *= 1.0 - 0.3 * uGlassC.z * w * edge;
  col += uTint * 0.22 * uGlassC.z * w * edge * (n.y > 0.0 || n.x < 0.0 ? 1.0 : 0.35);
  // the whole frame: toward the brand's blue, darker in the middle of the cut, the corners first
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, lum * uTint / max(dot(uTint, vec3(0.299, 0.587, 0.114)), 1e-3), 0.35 * run);
  col *= 1.0 - uGlassB.w * run * run;
  col *= 1.0 - 0.4 * run * smoothstep(0.35, 1.1, length(p));
  col += (hash(frag + fract(uTime.x * 7.3) * 113.0) - 0.5) * uGlassD.w * run * 0.09;   // film grain
  return col;
}
void main() {
  vec2 frag = gl_FragCoord.xy;
  if (uWaveB.w < 0.5) {
    // reduced motion: no wave. The sea fades to the water's colour, then the lake comes out of it (never both at once: the sea's last frame keeps
    // its own ring-shaped mark in the water, which must not show through the glass mark)
    float f = uTime.y; vec3 a = texture2D(tOld, vUv).rgb, b = texture2D(tNew, vUv).rgb;
    gl_FragColor = vec4(f < 0.5 ? mix(a, uDip, smoothstep(0.0, 0.5, f)) : mix(uDip, b, smoothstep(0.5, 1.0, f)), 1.0); return;
  }
  vec2 p0 = (frag - 0.5 * uRes) / uRes.y;
  if (uTileC.x > 1.5) { gl_FragColor = vec4(clamp(glass(p0, frag), 0.0, 1.0), 1.0); return; }
  if (uTileC.x > 0.5) { gl_FragColor = vec4(clamp(tiles(p0), 0.0, 1.0), 1.0); return; }
  float disp, face, crest;
  float sd = front(p0, disp, face, crest);
  float m = smoothstep(-uWaveA.w, uWaveA.w, sd);
  float tm = uTime.x, L = uWaveB.x;
  vec2 dir = uWaveA.xy, tg = vec2(-dir.y, dir.x);
  vec3 oldC = texture2D(tOld, fold((frag + dir * disp * uMix.z * uRes.y) / uRes)).rgb;
  vec3 newC = texture2D(tNew, fold((frag + dir * disp * uMix.w * uRes.y) / uRes)).rgb;
  vec3 col = mix(oldC, newC, m);
  // light on the wave: the face ahead of the crest catches the sun, its back darkens a touch
  col *= 1.0 - 0.16 * max(-face, 0.0);
  col += uCrest * (0.26 * max(face, 0.0) * max(face, 0.0)) * uMix.x;
  // the crest: a bright lip, stronger where the wave breaks along its length; a translucent wash behind; a little spray
  float along = dot(p0, tg);
  float brk = nz(vec2(along * 2.8 + tm * 0.05, 2.1)).r * 0.7 + nz(vec2(along * 15.0 - tm * 0.08, 5.3)).g * 0.3;
  float lace = nz(rot(p0, 0.9) * 120.0 + tg * tm * 2.0 + dir * tm * 0.8).a * 0.6 + nz(rot(p0, -0.7) * 150.0 - tg * tm * 3.0).b * 0.4;
  float lip = crest * mix(0.45, 1.0, smoothstep(0.3, 0.7, brk)) * mix(0.55, 1.0, smoothstep(0.3, 0.7, lace));
  col *= 1.0 - 0.22 * smoothstep(0.0, 0.15, sd / L) * exp(-sd / (L * 0.55)) * step(0.0, sd);
  float soft = nz(p0 * 8.0 + vec2(tm * 0.05, -tm * 0.15)).r * 0.65 + nz(p0 * 20.0 - tg * tm * 0.2).g * 0.35;
  float wash = step(0.0, sd) * exp(-sd / (L * 0.9)) * smoothstep(0.35, 0.7, soft) * smoothstep(0.3, 0.65, brk);
  float sprayN = nz(rot(p0, 0.4) * 190.0 + vec2(tm * 1.6, -tm * 2.9)).a * 0.6 + nz(rot(p0, -1.1) * 240.0 - vec2(tm * 1.0, tm * 3.8)).b * 0.4;
  float spray = smoothstep(0.7, 0.84, sprayN) * exp(-pow((sd + L * 0.1) / (L * 0.3), 2.0)) * smoothstep(0.45, 0.7, brk) * uMix.y;
  col = mix(col, uFoam, clamp((lip * 0.85 + wash * 0.3) * uMix.x + spray * 0.8, 0.0, 1.0));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

/* ---------------------------------------------------------------- module */
export function createWorldLogo({ root, reducedMotion = false, small = false, mobilePerformance = false, config = () => null, go = () => { }, remeasure = () => { } }) {
  const section = root.querySelector('[data-world-part="logo"]');
  if (!section) return null;
  const flag = (new URLSearchParams(location.search).get('logoseal') || '').toLowerCase();
  if (flag === '0' || flag === 'off' || flag === 'false' || flag === 'no') { section.remove(); return null; }
  const resp = root.querySelector('[data-world-part="responsibility"]');
  const text = section.querySelector('.fisl-text');
  root.classList.add('fisl-on');
  if (reducedMotion) root.classList.add('fisl-still');
  /* The last strategy's pill said CONTACT (it jumped to the footer); with the block there it leads to the block (the label is data-pill on the
     section, the click is data-world-go="logo" in the world module). Restored on dispose; with ?logoseal=0 nothing here runs. */
  const pill = resp?.querySelector('.fiwo-pill[data-world-go="contact"]'), pillLabel = pill?.querySelector('span'), pillWas = pill && { go: pill.dataset.worldGo, text: pillLabel?.textContent };
  if (pill && pillLabel && section.dataset.pill) { pill.dataset.worldGo = 'logo'; pillLabel.textContent = section.dataset.pill; }

  const cfg = () => config() || {};
  const dials = () => cfg().logoSeal || DEFAULTS;
  /* CONTINUOUS_LOGO_WAVE: this edition has no screen-space glass tiles, including saved workshop presets. */
  const num = (key, lo = -Infinity, hi = Infinity) => { const v = key === 'transition' ? 0 : +dials()[key]; return clamp(Number.isFinite(v) ? v : DEFAULTS[key], lo, hi); };
  const colours = new Map();
  const colour = hex => { let c = colours.get(hex); if (!c) { c = new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace); colours.set(hex, c); } return c; };

  // ---------- layout & clocks ----------
  let W = innerWidth, H = innerHeight;
  const at = { logo: 0, height: 0, resp: 0 };
  let plan = null, layoutKey = '', failed = false;
  /* Everything relative to the section's top, in screens. The wave starts WAVELEAD before the ocean's last frame has
     left the screen; the spin starts SPINSTART of the way through the wave; the hold follows the later of the two. */
  function computePlan() {
    const wave = reducedMotion ? Math.min(num('wave', .3, 6), 1) : num('wave', .3, 6);
    const lead = reducedMotion ? 0 : num('waveLead', 0, 1.5), spin = reducedMotion ? 0 : num('spin', 0, 6);
    const w0 = -lead, w1 = w0 + wave, s0 = w0 + wave * num('spinStart', 0, 1), s1 = s0 + spin, sd = s0 + spin * num('spinEnd', .2, 1);
    const end = Math.max(w1, s1) + num('hold', 0, 4);
    return { w0, w1, s0, s1, sd, end };
  }
  const keyNow = () => ['wave', 'waveLead', 'spin', 'spinStart', 'spinEnd', 'hold'].map(k => num(k)).join('|');
  function layout(w, h) {
    W = w; H = h;
    plan = computePlan();
    at.height = failed ? 0 : Math.round((Math.max(plan.end, .2) + 1) * H);
    section.style.height = at.height + 'px';
    root.style.setProperty('--fisl-h', H + 'px'); root.style.setProperty('--fisl-w', W + 'px');
    layoutKey = keyNow();
  }
  function measure(worldAt, top) { at.logo = top(section); at.resp = worldAt.resp || 0; worldAt.logo = at.logo; worldAt.logoH = at.height; }
  const abs = () => {
    const b = at.logo, p = plan || computePlan();
    return { logo: b, height: at.height, w0: b + p.w0 * H, w1: b + p.w1 * H, s0: b + p.s0 * H, s1: b + p.s1 * H, spinDone: b + p.sd * H, end: b + p.end * H };
  };
  /* The spin: ease in-out between linear (0) and smootherstep (1); exactly 0 and 1 at the ends */
  const spinCurve = t => t <= 0 ? 0 : t >= 1 ? 1 : mix(t, smoother(t), num('spinEase', 0, 1));

  let last = null;
  function sample(y) {
    const a = abs(), H1 = Math.max(1, H);
    const qWave = clamp((y - a.w0) / Math.max(1, a.w1 - a.w0));
    const tSpin = reducedMotion ? 0 : clamp((y - a.s0) / Math.max(1, a.spinDone - a.s0));
    const e = spinCurve(tSpin);
    const tText = reducedMotion ? qWave : tSpin;
    // the mark rises out of the water while it turns: from RISESTART to RISEEND of the spin (a share of it), slowing as it arrives; always up with reduced motion
    const tr = clamp((tSpin - num('riseStart', 0, 1)) / Math.max(.001, num('riseEnd', 0, 1) - num('riseStart', 0, 1)));
    const rise = reducedMotion ? 1 : tr >= 1 ? 1 : mix(tr, 1 - Math.pow(1 - tr, 3), num('riseEase', 0, 1));
    const l = {
      y, b: a.logo, w0: a.w0, qWave, qSpin: tSpin, rise, yaw: reducedMotion ? 0 : (e >= 1 ? TAU : TAU * e) + num('restYaw', -45, 45) * Math.PI / 180 * e,
      q: clamp((y - a.w0) / Math.max(1, Math.max(a.w1, a.s1) - a.w0)),      // 0 as the wave begins … 1 where the hold begins (the closing composition)
      // the words arrive as the spin ends and go again quickly as the footer comes up (they would slide over the mark with the released pin)
      textP: smooth(num('textIn', 0, 1), Math.min(1, num('textIn', 0, 1) + .3), tText) * (1 - smooth(a.end, a.end + H1 * .38, y)),
      engaged: qWave > 0,                                   // the wave has begun: the lake takes over the drawing
      active: y > a.logo - H1 * .9 && y < a.end + H1 * 1.05, // the page's chrome (chapter rail, the ocean's focus) knows about us
      // build the lake (in free moments) once the visitor is in the ocean section, and keep it while the world is open: see release
      near: y > (at.resp > 0 ? at.resp : a.logo - H1 * 4.7) + H1 * num('prepare', 0, 6)
    };
    last = l;
    return l;
  }
  /* The ocean's last frame must not keep the shape of the text it carried: its reading scrim goes as the text leaves. */
  function shape(o, y) { if (o) o.panel0 *= 1 - smooth(at.logo - H, at.logo - H * .35, y); }
  const stopY = () => { const a = abs(); return Math.min(a.end, Math.max(a.s1, a.w1) + H * .3); };

  // ---------- the offscreen work ----------
  /* The cut's own clock (hubtown.co.in): the scroll only says when — past CUTAT of the transition's length the change plays on its own in
     CUTTIME seconds, and finishes even if the scroll rests; back over that line, it plays backwards. cutClock 0, the water wave (transition
     0) and reduced motion: it follows the scroll. */
  const cut = { p: 0, t: -1 };
  function cutProgress(l) {
    const now = performance.now() / 1000, dt = cut.t < 0 ? 0 : clamp(now - cut.t, 0, .1); cut.t = now;
    if (reducedMotion || num('cutClock', 0, 1) < .5 || Math.round(num('transition', 0, 2)) === 0) return cut.p = l.qWave;
    const go = l.qWave > 0 && l.qWave >= num('cutAt', 0, 1), step = dt / num('cutTime', .1, 4);
    return cut.p = go ? Math.min(1, cut.p + step) : Math.max(0, cut.p - step);
  }
  let lastRenderer = null, state = 'idle', R = null, warmStage = 0, lastY = NaN, movedAt = -1, startTime = -1, lost = false, tail = null;
  const hexOf = c => '#' + c.getHexString(THREE.LinearSRGBColorSpace);
  const hexOr = (v, d) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d;
  /* the valley's colours (read live, like the ocean's, so tuning the valley retunes the lake and the foam) */
  const pal = { deep: new THREE.Color(), lit: new THREE.Color(), ink: new THREE.Color(), foam: new THREE.Color(), glint: new THREE.Color(), sun: new THREE.Color(), crest: new THREE.Color() };
  function readPalette() {
    const C = window.__MONTIS_STUDY__?.CONFIG, ww = C?.watershedWater || {}, al = C?.alpineLight || {};
    const base = colour(hexOr(ww.base, '#699fce')), hi = colour(hexOr(ww.highlight, '#b4bec5')), sun = colour(hexOr(al.sunColor, '#ffdcb8')), fog = colour(hexOr(al.fogColor, '#c4d3e4')), white = colour('#ffffff');
    pal.deep.copy(base).multiplyScalar(.5); pal.lit.copy(base).lerp(hi, .3).multiplyScalar(.82); pal.ink.copy(base).multiplyScalar(.3);
    pal.foam.copy(white).lerp(fog, .25); pal.glint.copy(sun).lerp(white, .35); pal.sun.copy(sun); pal.crest.copy(sun).lerp(white, .5);
    return pal;
  }
  /* The lake's palette. The valley's water (deep / lit / ink) always; the sun's and the foam's colours come from the site's scene clock, which
     is in the blue hour by here, so they are handed over only when the lake follows that clock (followDaylight): by default it keeps its own
     dusk (ref-6). */
  const paletteHex = () => { readPalette(); const o = {}, keys = num('followDaylight', 0, 1) > .5 ? Object.keys(pal) : ['deep', 'lit', 'ink']; for (const k of keys) o[k] = hexOf(pal[k]); return o; };
  const assetBase = new URL('../assets/', import.meta.url).href;
  const svgUrl = new URL('../../../images/logo.svg', import.meta.url).href;

  function noiseTexture() {
    const data = new Uint8Array(NOISE * NOISE * 4);
    let seed = 20261024; const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < data.length; i++) data[i] = Math.floor(rand() * 256);
    const t = new THREE.DataTexture(data, NOISE, NOISE, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  }
  function textures(scene) {
    const found = new Set();
    const add = v => { if (v?.isTexture && v.image) found.add(v); };
    add(scene.background); add(scene.environment);
    scene.traverse(o => {
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k of ['map', 'normalMap', 'roughnessMap', 'envMap', 'emissiveMap', 'alphaMap']) add(m[k]);
        if (m.uniforms) for (const u of Object.values(m.uniforms)) add(u?.value);
      }
    });
    return [...found].slice(0, 16);
  }
  /* a build whose owner has let go (release / close) stops at its next step and frees what it had made by then */
  const dead = R0 => { if (R0.dead || R !== R0) { disposeResources(R0); return true; } return false; };
  /* one preparation step per free moment (at once, if the visitor is already in the wave) */
  function step(R0, name, fn, heavy = false) {
    return new Promise((resolve, reject) => {
      let waited = 0;
      const run = () => {
        if (dead(R0)) { resolve(undefined); return; }
        const t0 = performance.now();
        try { const out = fn(); R0.log.push([name, Math.round(t0), Math.round(performance.now() - t0)]); Promise.resolve(out).then(v => { R0.log.push([name + ' (whole step)', Math.round(t0), Math.round(performance.now() - t0)]); R0.timings[name] = (R0.timings[name] || 0) + Math.round(performance.now() - t0); (R0.progs ||= {})[name] = lastRenderer?.info.programs?.length; resolve(v); }, reject); } catch (e) { reject(e); }
      };
      // A heavy step (its first slice is tens of ms) waits for a pause of the scroll — at most a couple of seconds, a visitor who never pauses
      // gets it in a frame between two wheel steps — and the light ones just take the next free moment. Once the wave has begun, at once.
      const when = () => {
        if (dead(R0)) { resolve(undefined); return; }
        if (last?.engaged) { setTimeout(run, 0); return; }
        if (heavy && movedAt > 0 && performance.now() / 1000 - movedAt < .25 && waited < 720) { waited += 80; setTimeout(when, 80); return; }
        if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 240 }); else setTimeout(run, 50);
      };
      when();
    });
  }
  async function build(R0, renderer) {
    const [markMod, sceneMod, svgMod] = await Promise.all([import('./world-logo-mark.js?v=i15-tone-7da2c5eaf233'), import('./world-logo-scene.js?v=i15-tone-7da2c5eaf233'), import('three/addons/loaders/SVGLoader.js')]);
    if (dead(R0)) return;
    R0.daylight = await import('./scene-daylight.js?v=i15-tone-7da2c5eaf233').then(m => m.getSceneDaylight).catch(() => null);   // the site's one sun (the lake reads it every frame)
    renderer.getDrawingBufferSize(_size);
    R0.lake = await step(R0, 'lake', () => sceneMod.createLakeScene({ THREE, renderer, width: Math.round(_size.x), height: Math.round(_size.y), palette: paletteHex(), assetBase, small, mobilePerformance, reducedMotion }), true);
    if (dead(R0)) return;
    await step(R0,'lake preparation',()=>{
      R0.lake.setLook?.({...(cfg().logoLake||{})});
      const pending=Promise.resolve(R0.lake.prepare?.()).finally(()=>{R0.compiling=null;});R0.compiling=pending;return pending;
    });
    if(dead(R0))return;
    R0.timings.lakePreparation=R0.lake.preparation;
    R0.mark = await step(R0, 'mark', () => markMod.createLogoMark({ THREE, SVGLoader: svgMod.SVGLoader, svgUrl, renderer, look: { ...(cfg().logoMark || {}) }, environment:R0.lake.environment }), true);
    if (dead(R0)) return;
    await step(R0, 'link', () => {
      R0.px = [Math.round(_size.x), Math.round(_size.y)];
      R0.holder = new THREE.Group(); R0.holder.add(R0.mark.group); R0.lake.markAnchor.add(R0.holder);
      R0.lake.setLook?.({ ...(cfg().logoLake || {}) });
      // the lake re-bakes its environment (after the range loads, after sky / sun / water changes): the glass takes each new one
      R0.lake.onEnvironment = tex => { R0.env = tex || null; R0.mark?.setEnvironment?.(R0.env); };
      R0.mark.setEnvironment?.(R0.lake.environment || null); R0.env = R0.lake.environment || null;
      // Prime the exact glass variant before compile: the lake adds clipping
      // planes in update(), after the mark has been linked into its scene.
      R0.lake.setMarkAspect?.(R0.mark.aspect);
      R0.mark.update({yaw:0,time:0,q:1,rise:1});
      R0.lake.update({q:1,time:0,rise:1});
      Object.assign(R0.looks.mark,cfg().logoMark || {});
      Object.assign(R0.looks.lake,cfg().logoLake || {});
    });
    // the distant range's picture (lake.ready is a flag, whenReady() a promise)
    if (R0.lake.whenReady) await Promise.race([R0.lake.whenReady(), new Promise(r => setTimeout(r, 8000))]).catch(() => { });
    if (dead(R0)) return;
    // (three polls a pending compileAsync on a timer and throws if its materials were disposed meanwhile: so they are not, see disposeResources)
    await step(R0, 'compile', () => {
      const p = precompile(R0, renderer).catch(() => { }).then(() => { R0.compiling = null; });
      R0.compiling = p; return p;
    }, true);
    for (const t of textures(R0.lake.scene)) { if (dead(R0)) return; await step(R0, 'texture', () => renderer.initTexture(t)); }
    await step(R0, 'targets', () => {
      R0.noise = noiseTexture();
      R0.comp = makeComposite(R0);
      ensureTargets(R0, renderer);
      // Await parallel driver compilation instead of paying for this large
      // composite program on the first visible transition frame.
      if(renderer.compileAsync){
        const pending=renderer.compileAsync(R0.comp.scene,R0.comp.camera).catch(()=>{}).finally(()=>{R0.compiling=null;});
        R0.compiling=pending;return pending;
      }
      try { renderer.compile(R0.comp.scene, R0.comp.camera); } catch { /* compiled on first use */ }
    });
    if (dead(R0)) return;
    R0.ready = true; R0.readyAt = performance.now() / 1000; state = 'ready';
  }
  /* Every program variant the wave will draw, compiled in the background. three compiles one variant per material (as drawn on the canvas), but
     the glass is also drawn with its back faces into the transmission target, and the sky, the water and the glass go into render targets (the
     lake's mirror and the transmission one): a render target is another variant (its output is linear). The first draw of a program that is not
     compiled yet makes the browser wait for it (getProgramInfoLog: 200–600 ms in one frame), so each variant is compiled here, one at a time, while
     the page keeps running. */
  async function precompile(R0, renderer) {
    const scene = R0.lake.scene, camera = R0.lake.camera, before = new Set(renderer.info.programs);
    try { await precompileVariants(R0, renderer, scene, camera); }
    finally { (R0.newPrograms ||= {}).precompile = renderer.info.programs.filter(p => !before.has(p)).map(p => p.name + ' ' + String(p.cacheKey)); R0.glassFound = R0.glassFound ?? null; }
  }
  async function precompileVariants(R0, renderer, scene, camera) {
    if (R0.lake.warm) await R0.lake.warm(); else if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    if (!renderer.compileAsync || R0.dead) return;
    const glass = [];
    scene.traverse(o => { const m = o.material; if (o.isMesh && m && !Array.isArray(m) && m.transmission > 0 && m.side === THREE.DoubleSide) glass.push(m); });
    R0.glassFound = glass.map(m => m.name + ' side ' + m.side + ' tr ' + m.transmission);
    const rt = new THREE.WebGLRenderTarget(8, 8, { type: THREE.HalfFloatType });
    try {
      for (const [side] of [[null], [THREE.BackSide]]) {
        if (R0.dead || (side !== null && !glass.length)) continue;
        for (const m of glass) if (side !== null) { m.side = side; m.needsUpdate = true; }
        renderer.setRenderTarget(rt);
        const done = renderer.compileAsync(scene, camera);
        renderer.setRenderTarget(null);
        await done.catch(() => { });
      }
    } finally { for (const m of glass) { m.side = THREE.DoubleSide; m.needsUpdate = true; } renderer.setRenderTarget(null); rt.dispose(); }
    await precompileClippedMark(R0,renderer,scene,camera);
  }
  /* Three r170 compile() never calls clipping.setState(). Merely assigning the
     planes compiles the 0-plane shader; the first actual glass render then blocks
     for all three 1-plane variants. A tiny proxy draw primes that public render
     path, then compileAsync prepares only the mark with the real scene's lights. */
  async function precompileClippedMark(R0,renderer,scene,camera) {
    const materials=new Set();
    R0.mark.group.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:o.material?[o.material]:[]))if(m.clippingPlanes?.length)materials.add(m);});
    if(!materials.size||R0.dead)return;
    const originals=[...materials].map(m=>[m,m.side]),sample=originals[0][0];
    const rt=new THREE.WebGLRenderTarget(8,8,{type:THREE.HalfFloatType});
    const proxyScene=new THREE.Scene(),proxyCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    const proxyMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:false,clippingPlanes:sample.clippingPlanes,clipIntersection:sample.clipIntersection});
    const proxy=new THREE.Mesh(new THREE.PlaneGeometry(2,2),proxyMaterial);proxy.frustumCulled=false;proxy.position.z=-.5;proxyScene.add(proxy);
    try {
      for(const variant of ['canvas','linear','back']) {
        if(R0.dead)break;
        if(variant==='back'&&!originals.some(([m,side])=>m.transmission>0&&side===THREE.DoubleSide))continue;
        const previous=renderer.getRenderTarget();
        let pending;
        try {
          for(const [m,side]of originals){m.side=variant==='back'&&m.transmission>0&&side===THREE.DoubleSide?THREE.BackSide:side;m.needsUpdate=true;}
          renderer.setRenderTarget(rt);renderer.render(proxyScene,proxyCamera);
          renderer.setRenderTarget(variant==='canvas'?null:rt);
          pending=renderer.compileAsync(R0.mark.group,camera,scene);
        } finally {renderer.setRenderTarget(previous);}
        await pending;
      }
    } finally {
      for(const [m,side]of originals){m.side=side;m.needsUpdate=true;}
      proxy.geometry.dispose();proxyMaterial.dispose();rt.dispose();
    }
  }
  function makeComposite(R0) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX, fragmentShader: COMPOSITE, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
      uniforms: {
        tOld: { value: null }, tNew: { value: null }, uNoise: { value: R0.noise }, uRes: { value: new THREE.Vector2(1, 1) },
        uWaveA: { value: new THREE.Vector4(0, 1, -9, .04) }, uWaveB: { value: new THREE.Vector4(.2, .05, .07, 1) }, uMix: { value: new THREE.Vector4(1, 1, 1.4, .8) }, uTime: { value: new THREE.Vector4() },
        uFoam: { value: new THREE.Color() }, uCrest: { value: new THREE.Color() }, uDip: { value: new THREE.Color() },
        uTileA: { value: new THREE.Vector4(.2, .15, .65, .35) }, uTileB: { value: new THREE.Vector4(0, 2, 1, 1.6) }, uTileC: { value: new THREE.Vector4(1, .75, .25, .55) },
        uGlow: { value: new THREE.Color() }, uField: { value: new THREE.Color() },
        uGlassA: { value: new THREE.Vector4(.34, .6, .35, .12) }, uGlassB: { value: new THREE.Vector4(.28, .6, .8, .45) }, uGlassC: { value: new THREE.Vector4(0, .55, .6, .1) }, uGlassD: { value: new THREE.Vector4(1.2, .42, 0, 0) },
        uTint: { value: new THREE.Color() }
      }
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false;
    const scene = new THREE.Scene(); scene.add(mesh);
    return { scene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat, mesh };
  }
  const _size = new THREE.Vector2();
  /* the two frames of the wave, copied off the canvas at its own pixel size: the sea as the world draws it, and the lake */
  function ensureTargets(R0, renderer) {
    renderer.getDrawingBufferSize(_size);
    const w = Math.max(2, Math.round(_size.x)), h = Math.max(2, Math.round(_size.y));
    for (const name of ['texOld', 'texNew']) {
      if (R0[name] && R0[name].image.width === w && R0[name].image.height === h) continue;
      R0[name]?.dispose();
      R0[name] = new THREE.FramebufferTexture(w, h); R0[name].minFilter = R0[name].magFilter = THREE.LinearFilter;
    }
  }
  function disposeResources(R0) {
    if (!R0) return;
    R0.dead = true;
    if (R0.compiling) { if (!R0.laterDispose) { R0.laterDispose = true; R0.compiling.then(() => { R0.laterDispose = false; disposeResources(R0); }); } return; }
    // each piece is let go once (a build that was still running makes its pieces after this has run: they are freed on its next look)
    for (const [name, fn] of [['mark', () => R0.mark?.dispose?.()], ['lake', () => R0.lake?.dispose?.()], ['texOld', () => R0.texOld?.dispose()], ['texNew', () => R0.texNew?.dispose()],
      ['noise', () => R0.noise?.dispose()], ['comp', () => { R0.comp?.mat.dispose(); R0.comp?.mesh.geometry.dispose(); }]]) {
      try { fn(); } catch (e) { console.warn('Logo seal: dispose ' + name + ' failed', e); }
      R0[name] = null;
    }
    R0.holder = null;
  }
  /* Let go of everything: when the world closes (and when the page is torn down). Not when the visitor merely scrolls away and back: three.js keeps
     the render target of a transmissive material (the glass: ~50 MB at 1440×900, one per scene) for the life of the renderer, so each build would
     leave one behind; one build per visit costs nothing like that. */
  function release() { if (!R) return; const old = R; R = null; state = 'idle'; warmStage = 0; disposeResources(old); }
  function fail(error) {
    if (failed) return;
    failed = true; console.warn('Logo seal unavailable, the page continues without it.', error);
    release(); section.hidden = true; root.classList.remove('is-logoseal'); if (resp) resp.inert = false;
    setTimeout(() => { layout(W, H); remeasure(); }, 0);
  }
  function begin(renderer, ctx) {
    if (R || failed || lost) return;
    state = 'loading';
    const R0 = R = { ctx, log: [], dead: false, ready: false, warmCost: 0, readyAt: 0, timings: {}, px: [0, 0], lake: null, mark: null, holder: null, env: null, noise: null, comp: null, texOld: null, texNew: null, looks: { mark: {}, lake: {} } };
    build(R0, renderer).catch(error => { if (!dead(R0)) fail(error); });
  }
  const sync = (src, memo) => { let changed = false; for (const k in src) if (src[k] !== memo[k]) { memo[k] = src[k]; changed = true; } return changed; };

  /* the world calls this just before it draws its own frame. true: the frame is drawn (the world must not draw it). */
  function render(s, time, ctx) {
    const l = s.l;
    if (!l || failed || lost) return false;
    const renderer = lastRenderer = ctx.renderer;
    if (Math.abs(l.y - lastY) > .5) { lastY = l.y; movedAt = time; }
    if (l.near && !R) begin(renderer, ctx);
    if (!R || !R.ready) return false;
    l.pc = cutProgress(l);
    if (!l.engaged && !(l.pc > 0)) {
      // Not in the wave yet. Everything the wave will draw is drawn once, inside a frame the world is about to cover (nothing of it
      // is presented), a piece per frame — the sky, then the mark, then the whole wave — so that the graphics driver's first-use
      // work (it compiles each shader permutation at its first draw) is not left for the wave. In a pause of the scroll, or when it is close.
      // (a stage that took long needs a pause, one that was quick does not)
      if (warmStage < 3 && l.near && (R.warmCost < 40 || time - movedAt > .3 || time - (R.readyAt || 0) > 2.4 || l.y > l.w0 - H * .5)) warm(R, l, time, ctx, renderer);
      return false;
    }
    try {
      const t0 = performance.now(), drawn = draw(R, l, time, ctx, renderer);
      if (!R.firstDraw) R.timings.firstDraw = R.firstDraw = Math.round(performance.now() - t0);
      return drawn;
    } catch (e) { fail(e); return false; }
  }
  function warm(R0, l, time, ctx, renderer) {
    const t0 = performance.now(), stage = warmStage++, before = new Set(renderer.info.programs);
    try {
      frame(R0, { ...l, qWave: 0, yaw: 0, q: 1, rise: 1 }, time, renderer);
      if (stage === 0) { R0.holder.visible = false; drawLake(R0, renderer); R0.holder.visible = true; }
      else if (stage === 1) drawLake(R0, renderer);
      else wave(R0, { ...l, qWave: 0 }, time, ctx, renderer);
      R0.timings['warm' + stage] = Math.round(R0.warmCost = performance.now() - t0); R0.log.push(['warm' + stage, Math.round(t0), Math.round(R0.warmCost)]);
      (R0.newPrograms ||= {})['warm' + stage] = renderer.info.programs.filter(p => !before.has(p)).map(p => p.name + ' ' + String(p.cacheKey));
    } catch (e) { fail(e); }
  }
  /* the lake and the mark at this frame's clocks */
  function frame(R0, l, time, renderer) {
    if (startTime < 0) startTime = time;
    const t = reducedMotion ? 0 : (time - startTime) * num('timeScale', 0, 3);
    // the lake wants the size it is drawn at, in pixels (the canvas' drawing buffer, which the world's adaptive resolution can change)
    renderer.getDrawingBufferSize(_size);
    if (R0.px[0] !== Math.round(_size.x) || R0.px[1] !== Math.round(_size.y)) { R0.px = [Math.round(_size.x), Math.round(_size.y)]; R0.lake.setSize?.(R0.px[0], R0.px[1]); }
    if (sync(cfg().logoLake || {}, R0.looks.lake)) R0.lake.setLook?.({ ...(cfg().logoLake || {}) });
    if (sync(cfg().logoMark || {}, R0.looks.mark)) R0.mark.setLook?.({ ...(cfg().logoMark || {}) });
    R0.lake.setMarkAspect?.(R0.mark.aspect);
    const env = R0.lake.environment || null;
    if (env !== R0.env) { R0.env = env; R0.mark.setEnvironment?.(env); }
    R0.holder.scale.setScalar(num('markScale', .2, 3)); R0.holder.position.y = num('markY', -2, 2);
    // order: the mark's pose first (the lake's mirror pass draws it), then the lake
    R0.mark.update({ yaw: l.yaw, time: t, q: l.q, rise: l.rise });
    // The lake reads the site's one sun (scene-daylight.js) in update(): by here that clock is in the blue hour, but the closing picture is the
    // dusk of ref-6. Unless it is asked to follow, the sun is switched off for the length of the call (the lake then uses its own look) and put back.
    const D = R0.daylight?.(), keep = D?.enabled;
    if (D && keep && num('followDaylight', 0, 1) < .5) D.enabled = false;
    try { R0.lake.update({ q: l.q, time: t, rise: l.rise }); } finally { if (D) D.enabled = keep; }
  }
  function drawLake(R0, renderer) { renderer.setRenderTarget(null); renderer.render(R0.lake.scene, R0.lake.camera); }
  function draw(R0, l, time, ctx, renderer) {
    frame(R0, l, time, renderer);
    if ((Math.round(num('transition', 0, 2)) > 0 ? l.pc ?? l.qWave : l.qWave) >= 1) {
      drawLake(R0, renderer);
      // Present the continuous lake frame throughout the closing logo turn.
      return true;
    }
    wave(R0, l, time, ctx, renderer);
    return true;
  }
  /* the wave is crossing: the world draws the sea on the canvas and it is copied off; the lake is drawn on the canvas and copied off; a
     full-screen pass then mixes the two through the wave (the canvas is overwritten, nothing of the first two is presented) */
  function wave(R0, l, time, ctx, renderer) {
    ctx.world();
    ensureTargets(R0, renderer);
    ctx.draw();
    renderer.copyFramebufferToTexture(R0.texOld);
    drawLake(R0, renderer);
    renderer.copyFramebufferToTexture(R0.texNew);
    renderer.getDrawingBufferSize(_size);
    const u = R0.comp.mat.uniforms, ang = num('waveAngle', -90, 90) * Math.PI / 180, dx = Math.sin(ang), dy = Math.cos(ang);
    const Lw = num('waveLength', .03, .6), soft = num('waveSoft', .002, .3), wob = num('wobble', 0, .3);
    const extent = .5 * (Math.abs(dx) * _size.x / _size.y + Math.abs(dy));
    u.tOld.value = R0.texOld; u.tNew.value = R0.texNew; u.uRes.value.copy(_size);
    u.uWaveA.value.set(dx, dy, mix(-extent - Lw * 1.5 - wob - soft, extent + Lw * 3.5 + wob + soft, l.qWave), soft);
    u.uWaveB.value.set(Lw, num('waveAmp', 0, .2), wob, reducedMotion ? 0 : 1);
    u.uMix.value.set(num('crest', 0, 4), num('spray', 0, 3), num('refract', 0, 3), num('refractNew', 0, 3));
    u.uTime.value.set(reducedMotion ? 0 : time - startTime, smooth(0, 1, l.qWave), 0, 0);
    readPalette(); u.uFoam.value.copy(pal.foam).lerp(pal.crest, .18); u.uCrest.value.copy(pal.crest); u.uDip.value.copy(pal.deep);
    // the blocks (transition 1, the default; 0 = the wave above): square cells counted along the screen's longer side
    const cs = Math.max(_size.x, _size.y) / _size.y / num('tiles', 2, 30), D = dials();
    u.uTileA.value.set(cs, num('tileDepth', 0, 4) * cs / num('tilePersp', .3, 6), num('tileSpread', 0, .95), num('tileJitter', 0, 1));
    // their progress: the cut's own clock (see cutProgress), eased like hubtown's (nearly linear, soft at both ends)
    const P = clamp(l.pc ?? l.qWave), Pe = mix(P, P * P * (3 - 2 * P), .6);
    u.uTileB.value.set(Pe, 2 * extent, num('tileGlow', 0, 4), num('tileLine', .2, 8) * renderer.getPixelRatio());
    u.uTileC.value.set(Math.round(num('transition', 0, 2)), num('tileFog', 0, 1), num('tileGrid', 0, 1), num('tileExtrude', 0, 1));
    u.uGlassA.value.set(num('glassSize', .05, 2), num('glassSplit', 0, 1), num('glassShift', 0, 2), num('glassZoom', 0, .6));
    u.uGlassB.value.set(num('glassBlur', 0, .8), num('glassChroma', 0, 2), num('glassFrost', 0, 3), num('glassDip', 0, 1));
    u.uGlassC.value.set(Pe, num('glassSpread', 0, .95), num('glassSeam', 0, 2), num('glassPush', 0, .4));
    u.uGlassD.value.set(num('glassBloom', 0, 4), num('glassBloomAt', 0, 1), num('glassGlitch', 0, 2), num('glassGrain', 0, 2));
    u.uTint.value.copy(colour(hexOr(D.glassTint, DEFAULTS.glassTint)));
    u.uGlow.value.copy(colour(hexOr(D.tileGlowColor, DEFAULTS.tileGlowColor))); u.uField.value.copy(colour(hexOr(D.tileField, DEFAULTS.tileField)));
    renderer.render(R0.comp.scene, R0.comp.camera);
  }

  // ---------- the HTML ----------
  const painted = { active: null, gone: null, p: -1, y: '', k: '' };
  function paint(s) {
    const l = s.l; if (!l) return;
    if (l.active !== painted.active) { painted.active = l.active; root.classList.toggle('is-logoseal', l.active); }
    // the ocean's chapters are off the top of the screen from here on: nothing in them may take the keyboard focus (and scroll us back)
    const gone = l.y > l.b - H * .6;
    if (gone !== painted.gone) { painted.gone = gone; if (resp) resp.inert = gone; }
    const y = num('textY', .3, .95).toFixed(3), k = num('textSize', .4, 2).toFixed(3);
    if (y !== painted.y) { painted.y = y; root.style.setProperty('--fisl-y', y); }
    if (k !== painted.k) { painted.k = k; root.style.setProperty('--fisl-k', k); }
    const p = l.textP * num('textShow', 0, 1);
    if (Math.abs(p - painted.p) > .002 || (p === 0) !== (painted.p === 0)) {
      painted.p = p; text.style.setProperty('--p', p.toFixed(3)); text.style.visibility = p > .001 ? 'visible' : 'hidden';
    }
    if (layoutKey && layoutKey !== keyNow()) { layoutKey = ''; remeasure(); }
  }

  // ---------- GL loss, lifecycle ----------
  const onLost = () => { lost = true; };
  const onRestored = () => { lost = false; warmStage = 0; };
  let canvas = root.querySelector('.fiw-canvas');
  canvas?.addEventListener('webglcontextlost', onLost); canvas?.addEventListener('webglcontextrestored', onRestored);

  return {
    layout, measure, sample, shape, stopY, render, paint,
    get active() { return !!last?.active; },
    close() { release(); cut.p = 0; cut.t = -1; painted.active = painted.gone = null; painted.p = -1; painted.y = painted.k = ''; root.classList.remove('is-logoseal'); if (resp) resp.inert = false; text.style.visibility = 'hidden'; },
    get state() {
      return {
        gl: lastRenderer && { programs: lastRenderer.info.programs?.length, textures: lastRenderer.info.memory.textures, geometries: lastRenderer.info.memory.geometries },
        at: abs(), plan: plan && { ...plan }, sample: last && { ...last }, phase: state, ready: !!R?.ready, failed, lost, timings: R ? { ...R.timings, progs: R.progs } : null, newPrograms: R?.newPrograms || null, glassFound: R?.glassFound || null, log: R ? R.log.slice() : null,
        model: R?.mark?.model || null, spinFx: null, interaction: R?.lake?.interaction || null,
        built: R ? { lake: !!R.lake, mark: !!R.mark, texOld: R.texOld ? [R.texOld.image.width, R.texOld.image.height] : null, texNew: R.texNew ? [R.texNew.image.width, R.texNew.image.height] : null } : null
      };
    },
    dispose() { if (pill && pillWas) { pill.dataset.worldGo = pillWas.go; if (pillLabel) pillLabel.textContent = pillWas.text; } release(); canvas?.removeEventListener('webglcontextlost', onLost); canvas?.removeEventListener('webglcontextrestored', onRestored); canvas = null; colours.clear(); }
  };
}
