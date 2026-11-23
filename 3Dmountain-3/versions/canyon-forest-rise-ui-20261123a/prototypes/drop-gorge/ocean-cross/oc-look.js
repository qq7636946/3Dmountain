/* OCEAN round · the crossing's look (Team CROSS, 2026-11-18). Loaded by dg-dive.js ONLY with ?ocean=1 (dynamic import).
   Matched to the client's recording, 6.6 → 8.6 s (measured frame by frame, .qa/index1-5/ocean/cross/measure.py):
     · the water's edge is a soft dark band, 10–90 % width ≈ 0.045 screen heights, bright side ≈ 200 → dark side ≈ 22 (8-bit);
     · it is TILTED and rolls: left ≈ +0.10 over the centre, right ≈ −0.06 (−0.2·v + 0.15·v², v = u − 0.5), a slow swell on top;
     · PASS 2: the band FORMS at mid-height (as the video's does at 7.0 s: there the horizon turns into the soft band), holds a moment,
       then climbs steadily at 0.34 screen heights / s and leaves the top; the whole take-over ≈ 1.9 s;
     · under the edge: defocused water — navy right under the edge (≈ 9, 28, 42), teal body (≈ 6, 44, 64), soft lighter streaks
       (≈ 36, 92, 116), darker to the bottom (≈ 4, 28, 47);
     · warm round bokeh: the sun's blob sitting ON the edge at u ≈ 0.76, a column of smaller discs under it, one at u ≈ 0.35;
     · a few small sharp sparkles (drops on the lens) drifting slowly up;
     · above the edge the picture stays SHARP (OREF's SPEC.md: the video's sky is not blurred); only the strip under the soft edge is
       a little out of focus, with a warm lip of light on it. Numbers below follow .qa/index1-5/ocean/oref/SPEC.md §2 and §6.
   Two canvases meet at a LEVEL seam (the gorge's mode-1 line, amplitude 0, lip 0): the canyon's renderer draws above the seam, the
   gorge's below. The visible edge sits ABOVE the seam everywhere (seam = edge(centre) − m), and both sides draw the same water, bokeh
   and sparkles from the same functions, so the seam is not seen. The under-water world (CEIL's) comes through as the veil clears
   (bottom first) once the edge has left the top.
   Cost: one full-screen pass per canvas while the take-over plays (canyon side: 12 taps in the edge's strip only); nothing at the hold. */

export const OC_N = 16, OC_S = 3;

const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const TAN_ROLL = 0.1157;   /* tan 6.6° */

/* PASS 6 (client, of the AI clip's picture: 「很棒」; of video in the page: no — full 3D). The crossing is redrawn after that picture
   (.qa/index1-5/ocean/aivideo/v1_0048 … v1_0072): a CRISP water line with a thin bright lip, small glints and beads riding on it; under
   it the underside of the surface as a darker rippled slab about a quarter of the screen deep, then open, clear teal water with soft
   rays reaching down from the sun's place; ONE orange-gold disc hanging under the sun and a faint second one under that. Our gorge
   above stays sharp, with its own sun. Timing, the level seam, the hand-over and every switch rule are pass 4's. */
const GLSL = /* glsl */`
uniform sampler2D tN; uniform vec2 uRes; uniform vec4 uLine, uOc, uOcK, uOcS;   /* uOc: roll (1 = 6.6°), edge(centre) − seam, roll phase, time · uOcK: on, clear, bokeh, sparkle · uOcS: sun u, edge half-range, lip, slivers */
uniform vec4 uBk[${OC_N}], uBkC[${OC_N}]; uniform vec3 uSp[${OC_S}];
float ocEdgeAt(float u){
  float v = u - 0.5, ph = uOc.z;
  return uLine.x + uOc.y + uOc.x * (-${TAN_ROLL} * (uRes.x / uRes.y) * v + 0.15 * v * v) + 0.022 * (sin(u * 3.1 + ph * 0.6 + 0.8) * 0.5 + sin(u * 6.3 - ph) * 0.3 + sin(u * 12.0 + ph * 1.3) * 0.2);
}
float ocH(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
/* the water under the line (display values) */
vec3 ocWater(vec2 uv, float asp, float dE){
  float t = uOc.w, d = max(dE, 0.0), sx = (uv.x - uOcS.x) * asp;
  float sun = exp(-sx * sx / 0.30);
  /* open water: clear teal, lighter under the sun, deeper to the bottom of the frame */
  vec3 c = mix(vec3(0.032, 0.225, 0.298), vec3(0.074, 0.340, 0.408), smoothstep(0.0, 0.8, uv.y));
  c += vec3(0.055, 0.125, 0.125) * sun * exp(-d / 0.7);
  /* soft rays reaching down from where the sun meets the line */
  float ang = sx / (d + 0.22);
  float rn = texture2D(tN, vec2(ang * 0.55 + t * 0.004, 0.31)).r * 0.6 + texture2D(tN, vec2(ang * 1.7 - t * 0.006, 0.67)).r * 0.4;
  c += vec3(0.075, 0.130, 0.125) * smoothstep(0.50, 0.70, rn) * exp(-sx * sx / 0.5) * smoothstep(0.16, 0.30, d) * exp(-d / 0.55);
  /* the underside of the surface: a rippled slab under the line, seen at a grazing angle (far at the line, near at its lower rim) */
  float rimN = texture2D(tN, vec2(uv.x * asp * 0.21 + t * 0.008, 0.13)).r;
  float rimM = texture2D(tN, vec2(uv.x * asp * 0.62 - t * 0.012, 0.57)).r;
  float sl = 0.215 + 0.13 * (rimN - 0.5) + 0.05 * (rimM - 0.5) - 0.03 * sun, v = d / sl;
  if (v < 1.35) {
    float pers = 1.0 / (0.16 + v);
    vec2 p = vec2((uv.x - 0.5) * asp * pers * 0.30, pers * 0.62);
    float n1 = texture2D(tN, p * vec2(0.50, 1.0) + vec2(t * 0.010, t * 0.022)).r;
    float n2 = texture2D(tN, p * vec2(1.40, 2.6) + vec2(-t * 0.016, t * 0.040)).r;
    float w = n1 * 0.62 + n2 * 0.38;
    vec3 slab = mix(vec3(0.018, 0.190, 0.262), vec3(0.120, 0.375, 0.435), sun * 0.85);
    slab *= 0.62 + 0.80 * smoothstep(0.30, 0.72, w);
    slab += vec3(0.10, 0.17, 0.17) * smoothstep(0.66, 0.80, w) * (0.25 + 0.75 * sun);        /* the light caught in the ripples */
    slab *= 1.0 - 0.42 * smoothstep(0.55, 1.0, v);                                              /* darker to its lower rim */
    c = mix(c, slab, 1.0 - smoothstep(0.84, 1.16, v));
  }
  /* the line itself: a thin dark edge of water */
  c = mix(c, vec3(0.020, 0.105, 0.140), 0.85 * exp(-d / 0.0065));
  return c;
}
/* what rides on the line and hangs under the sun (premultiplied). uBkC.a: 0 = soft disc, 1 = bead (a drop / bubble on the line), 2 = glint */
vec4 ocBokeh(vec2 uv, float asp){
  vec4 acc = vec4(0.0);
  for (int i = 0; i < ${OC_N}; i++) {
    vec4 B = uBk[i]; if (B.w < 0.004) continue;
    float bu = uOcS.x + B.x;
    vec2 q = (uv - vec2(bu, ocEdgeAt(bu) - B.y)) * vec2(asp, 1.0) / B.z;
    float l = length(q); if (l >= 1.0) continue;
    float kind = uBkC[i].a, a; vec3 col = uBkC[i].rgb;
    if (kind < 0.5) {   /* the lens's disc: an even, crisp-edged circle, a little brighter at its rim */
      a = smoothstep(1.0, 0.95, l) * B.w * (0.72 + 0.20 * q.y + 0.34 * smoothstep(0.84, 0.98, l));   /* light, not paint: thinner toward its lower side, a bright thin rim */
      col = mix(col, vec3(1.0, 0.80, 0.52), 0.5 * smoothstep(0.84, 0.98, l));
    } else if (kind < 1.5) {   /* a bead of water: dark rim, the sky inside, one sharp highlight */
      a = smoothstep(1.0, 0.86, l) * B.w;
      col = mix(vec3(0.42, 0.58, 0.66), vec3(0.03, 0.13, 0.17), smoothstep(0.45, 0.98, l));
      col = mix(col, vec3(0.80, 0.90, 0.95), smoothstep(0.55, 0.0, length(q - vec2(0.0, -0.45))) * 0.55);
      col = mix(col, vec3(1.0, 0.98, 0.93), smoothstep(0.34, 0.14, length(q - vec2(-0.30, 0.36))));
    } else {   /* a glint of the far surface on the line */
      a = smoothstep(1.0, 0.35, l) * B.w;
      col = mix(col, vec3(1.0), smoothstep(0.7, 0.0, l));
    }
    a = min(1.0, a * uOcK.z);
    acc = vec4(col * a, a) + acc * (1.0 - a);
  }
  return acc;
}
/* sharp points (drops on the lens) and a few slivers of light in the rippled slab; both alive */
vec3 ocSpark(vec2 uv, float asp, float dE){
  float s = 0.0;
  for (int i = 0; i < ${OC_S}; i++) {
    vec3 P = uSp[i]; if (P.z < 0.004) continue;
    vec2 q = (uv - P.xy) * vec2(asp, 1.0); float l = length(q), r = 0.0038;
    s += P.z * (smoothstep(r, r * 0.45, l) + 0.25 * exp(-l / (r * 1.6)));
  }
  vec3 col = vec3(1.0) * s;
  if (uOcS.w > 0.004) {
    float d = max(dE, 0.0), t = uOc.w, x = (uv.x - 0.5) * asp, sl = 0.0;
    float bySun = exp(-pow((uv.x - uOcS.x) * asp / 0.36, 2.0));
    float dens = smoothstep(0.012, 0.04, d) * exp(-d / 0.10) * (0.10 + 0.9 * bySun);
    for (int L = 0; L < 2; L++) {
      float fl = float(L), rows = 170.0 + 80.0 * fl, row = d * rows, px = rows / uRes.y;
      vec2 g = vec2(x * (6.0 + 4.0 * fl) + ocH(vec2(floor(row), fl + 2.0)) * 9.0, row);
      vec2 id = floor(g), f = fract(g);
      if (ocH(id + fl * 19.0) < dens * 0.30) {
        float h2 = ocH(id + 7.7), h3 = ocH(id + 5.3), h4 = ocH(id + 3.1);
        float len = 0.05 + 0.40 * h2 * h2, ax = abs(f.x - (0.5 + (h3 - 0.5) * (0.9 - 1.9 * len))) / len;
        if (ax < 1.0) {
          float th = (0.45 + 0.9 * h4) * px * (1.0 - ax * ax);
          float ph = fract(t * (0.35 + 1.1 * h3) + h4 * 9.0);
          float life = t > 0.0 ? smoothstep(0.0, 0.1, ph) * smoothstep(0.6, 0.22, ph) : 0.6;
          sl += smoothstep(th + px * 0.5, th - px * 0.25, abs(f.y - 0.5)) * life * (0.45 + 0.9 * h2);
        }
      }
    }
    col += mix(vec3(0.80, 0.90, 0.92), vec3(1.0, 0.95, 0.86), bySun) * sl * uOcS.w;
  }
  return col * uOcK.w;
}`;

/* the gorge's side: under the level seam. Premultiplied over what the gorge drew. */
const FRAG_GORGE = /* glsl */`precision highp float;
${GLSL}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
  float dS = uLine.x - uv.y;
  if (dS <= -0.004) discard;
  float dE = ocEdgeAt(uv.x) - uv.y;
  float keep = 1.0 - uOcK.y;
  float aV = 1.0 - smoothstep(0.0, 1.0, clamp(uOcK.y * 1.8 - (1.0 - clamp(1.0 - uv.y, 0.0, 1.0)) * 0.8, 0.0, 1.0));   /* clears from the bottom up */
  vec3 col = ocWater(uv, asp, dE) * aV; float al = aV;
  vec4 bk = ocBokeh(uv, asp);
  col = col * (1.0 - bk.a) + bk.rgb; al = al * (1.0 - bk.a) + bk.a;
  col += ocSpark(uv, asp, dE) * keep;
  gl_FragColor = vec4(col, min(al, 1.0));
}`;

/* the canyon's side: above the seam. Our own picture stays SHARP above the edge (as the video's sky does); only the strip under the soft
   edge is a little out of focus and pulled toward the water, with a warm lip of light on it; then the water under the edge. */
const FRAG_CANYON = /* glsl */`precision highp float;
uniform sampler2D tScene; uniform vec4 uCal;   /* x: the page's tone map (1 = neutral, 0 = none), y: 1 / exposure; z = soft radius at the edge (screen heights), w = pull */
${GLSL}
/* display value → what the canyon's buffer must hold: sRGB decode, then the inverse of the page's tone map (Khronos neutral: its
   highlight compression without the desaturation, its toe offset), then its exposure. uCal.x < 0.5 = no tone map on this page. */
vec3 toBuf(vec3 c){
  c = clamp(c, 0.0, 1.0);
  c = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  if (uCal.x > 0.5) {
    float np = max(c.r, max(c.g, c.b));
    if (np > 0.76) { float d = 0.24, pk = d * d / max(1.0 - np, 0.02) - d + 0.76; c *= pk / np; }
    float om = min(c.r, min(c.g, c.b));
    float x = om < 0.04 ? sqrt(om / 6.25) : om + 0.04;
    c += x - om;
  }
  return c * uCal.y;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y;
  float dS = uLine.x - uv.y;
  if (dS > 0.004) discard;
  float dE = ocEdgeAt(uv.x) - uv.y, K = uOcK.x, hr = uOcS.y;
  float near = exp(-max(-dE, 0.0) / (hr * 1.4));
  vec4 bk = ocBokeh(uv, asp);
  if (near * K < 0.012 && bk.a < 0.003) discard;   /* the picture above stays as it is */
  vec3 c = vec3(0.0);
  if (dE >= hr && K < 0.999) c = textureLod(tScene, uv, 0.0).rgb;   /* while the band forms: our river under it, fading */
  if (dE < hr) {
    float rad = K * uCal.z * near, rot = ocH(gl_FragCoord.xy * 0.37) * 6.2832;
    vec2 s0 = uv + vec2(0.0, -uCal.w * near * K), st = vec2(rad / asp, rad * 1.5);
    for (int i = 0; i < 12; i++) {
      float fi = float(i), r = sqrt((fi + 0.5) / 12.0), a = fi * 2.39996 + rot;
      c += textureLod(tScene, clamp(s0 + vec2(cos(a), sin(a)) * r * st, vec2(0.001), vec2(0.999)), 0.0).rgb;
    }
    c *= 1.0 / 12.0;
    /* the light on the upper edge: warm, strongest by the sun (it is what the dark band reads against) */
    float bySun = exp(-pow((uv.x - uOcS.x) * asp / 0.55, 2.0));
    float lip = exp(-pow((dE + hr * 1.3) / (hr * 0.9), 2.0)) * uOcS.z * K * (0.55 + 0.45 * bySun);
    c = mix(c, max(c, toBuf(mix(vec3(0.74, 0.84, 0.90), vec3(0.96, 0.93, 0.86), bySun))), lip);   /* the thin bright lip of the line */
  }
  float aE = smoothstep(-hr, hr, dE) * K;
  c = mix(c, toBuf(ocWater(uv, asp, dE)), aE);
  if (bk.a > 0.003) c = c * (1.0 - bk.a) + toBuf(min(bk.rgb / bk.a, vec3(1.0))) * bk.a;
  c += toBuf(min(ocSpark(uv, asp, dE) * aE, vec3(1.0)));
  gl_FragColor = vec4(c, 1.0);
}`;

/* what rides on the line and hangs under the sun: x off the sun (screen widths), depth under the edge, radius (screen heights), strength · colour, kind
   (0 soft disc, 1 bead, 2 glint). The AI clip: one orange-gold disc ≈ 0.074 H in radius hanging ≈ 0.11 H under the line, a faint second one under it. */
const BOKEH = [
  [0.004, 0.300, 0.078, 0.12, 0.62, 0.72, 0.64, 0], [0.002, 0.118, 0.074, 0.66, 0.93, 0.62, 0.32, 0],
  [-0.205, 0.012, 0.0125, 0.95, 0, 0, 0, 1], [-0.176, 0.006, 0.0085, 0.9, 0, 0, 0, 1], [0.104, 0.008, 0.0105, 0.95, 0, 0, 0, 1], [0.150, 0.016, 0.0155, 0.95, 0, 0, 0, 1], [0.172, 0.004, 0.007, 0.9, 0, 0, 0, 1], [0.126, 0.046, 0.0055, 0.8, 0, 0, 0, 1],
  [-0.142, -0.006, 0.0050, 0.7, 1.0, 0.93, 0.82, 2], [-0.121, -0.003, 0.0095, 0.9, 1.0, 0.92, 0.80, 2], [-0.074, -0.008, 0.0060, 0.8, 1.0, 0.94, 0.84, 2], [-0.058, -0.004, 0.0115, 0.95, 1.0, 0.93, 0.82, 2],
  [-0.019, -0.007, 0.0075, 0.85, 1.0, 0.95, 0.86, 2], [0.013, -0.004, 0.0130, 1.0, 1.0, 0.95, 0.86, 2], [0.036, -0.009, 0.0055, 0.8, 1.0, 0.93, 0.82, 2], [0.071, -0.004, 0.0085, 0.85, 1.0, 0.92, 0.80, 2]
];
/* sharp points: x off the sun, y when the band forms (they drift up 0.17 H / s), brightness */
const SPARK = [[-0.12, 0.20, 0.8], [-0.21, 0.17, 0.6], [0.12, 0.10, 0.5]];

export function createOcean({ num }) {
  /* seconds after the notch (the take-over is linear in time). PASS 2 — the curve of the edge at the screen's centre, from the bottom:
       t < t0                      nothing
       t0 → t0 + form              the band FORMS at `mid` (fades in; the video: the horizon turns into the soft band at 7.01 s)
       … + hold                    it holds (video 7.04 → 7.14 s)
       then                        mid + slope · (t − start), the video's 0.34 H / s, no ease-out, until it leaves the top (1.0)
       last `out` seconds          the rest of the tilted, soft edge clears the top (already above the frame's centre) */
  const OT = {
    t0: 0.15, form: 0.12, hold: 0.08,
    mid: 0.5, slope: 0.34, out: 0.10, top: 1.10,
    tilt: num('ocTilt', 0.3), bokeh: num('ocBokeh', 1), spark: num('ocSpark', 1), lip: num('ocLip', 0.85), dashes: num('ocDash', 1),
    soft: 0.004, pull: 0.006,  // the strip under the soft edge: its own defocus radius and pull (screen heights)
    seamDeep: 0.27,           // the level seam between the two canvases stays this far under the edge (clear of the sun's glow) until the edge nears the top
    sunU: null,               // null = where OUR sky's sun meets the line (lead, pass 3: one sun in the frame); a number fixes it
    skySun: num('ocSkySun', 1), // what is left of the sky's own sun disc once the band is there (0 = it fades: one sun, the blob)
    toHot: num('ocToHot', 0), // seconds at the end over which the blob slides to CEIL's hotspot x (0 = stays under our sun)
    drift: 0.17,
    veil: 0.7,                // my water over CEIL's world clears in this many seconds AFTER the take-over (the video's 0.7 s dim and soft); never while the seam is in the frame
    ceil: [0.35, 0.7, 2.5],   // CEIL's ceiling (s.ceil): held at [0] through the crossing and [1] s after it, then eased to 1 over [2] s (SPEC §1)
    cal: [1, 1]               // set by dg-dive.js from the canyon's renderer: [tone map on, 1 / exposure]
  };
  const rise0 = () => OT.t0 + OT.form + OT.hold;
  OT.dur = num('diveTime', +(rise0() + (1 - OT.mid) / OT.slope + OT.out).toFixed(3));
  const edge = t => { const a = rise0(), tTop = a + (1 - OT.mid) / OT.slope; return t <= a ? OT.mid : t <= tTop ? OT.mid + OT.slope * (t - a) : 1 + (OT.top - 1) * clamp01((t - tTop) / Math.max(1e-3, OT.dur - tTop)); };
  /* the roll: up to 6.6° (left higher) 0.4 s after the band forms, level again by 1.3 s */
  const tiltAt = tv => OT.tilt * (smooth(0, 0.4, tv) - smooth(0.55, 1.3, tv));
  /* the edge's softness (half-range of its smoothstep; 10–90 % ≈ 0.61 × the range): 9 % H at first, 4.6 % mid-frame, 2.4 % at the top */
  const softAt = e => 0.0042;   /* PASS 6: a crisp line (≈ 3 px at 762): the AI clip's, not the first reference's defocused band */
  const api = { tune: OT, BOKEH, SPARK, sunU: 0.77, edge };
  api.timeline = () => { const d = OT.dur, r = (a, b) => [a / d, b / d];
    return { dur: d, hang: r(0, 0.08), fall: r(0.05, 0.45), crown: r(0.3, 0.6), sink: r(0.1, 0.6), sweep: r(OT.t0, d),
      settle: r(0.9, d), bubbles: r(OT.t0, d), streakOut: r(d - 0.3, d), currentsOut: r(0.03, 0.25), streak: 0, bubble: 0, drops: 0, wave: 0 }; };
  /* post = seconds since the take-over ended going down (0 while it plays) */
  api.state = (tl, time, alive, post, asp) => {
    const t = tl * OT.dur, ts = t - OT.t0, tv = ts - OT.form, e = edge(t), tg = tiltAt(tv), hr = softAt(e);
    const need = (TAN_ROLL * asp * 0.5 + 0.0375) * Math.abs(tg) + 0.03 + hr + 0.012;
    const m = Math.max(need, OT.seamDeep) + (need - Math.max(need, OT.seamDeep)) * smooth(0.88, 1.04, e);
    const formed = ts >= OT.form, seam = formed ? e - m : -0.6;   /* while it forms the canyon's side draws all of it (it fades in over our river) */
    const on = smooth(0, OT.form, ts), gone = smooth(1.02, 1.09, e);
    const clear = smooth(0, OT.veil, post);
    return { t, ts, e, seam, post, formed, c: formed ? clamp01(ts / (OT.dur - OT.t0)) + 1e-4 : 0,
      line: [seam, 0, 0, 0], oc: [tg, e - seam, tv * 1.1 + (alive ? time * 0.45 : 0), alive ? time % 1000 : 0],
      k: [on, clear, OT.bokeh * on * (1 - gone), OT.spark * smooth(0.1, 0.5, tv)],
      s: [(() => { const u = OT.sunU == null ? api.sunU : OT.sunU; return OT.toHot > 0 && api.hotU != null ? u + (api.hotU - u) * smooth(OT.dur - OT.toHot, OT.dur, t) : u; })(), hr, OT.lip, OT.dashes * smooth(0.1, 0.9, tv)] };
  };
  /* CEIL's ceiling brightness (s.ceil) for a time after the take-over */
  api.ceilAt = post => OT.ceil[0] + (1 - OT.ceil[0]) * smooth(OT.ceil[1], OT.ceil[1] + OT.ceil[2], post);
  api.uniforms = (T3, nTex) => ({ tN: { value: nTex }, uRes: { value: new T3.Vector2(1, 1) }, uLine: { value: new T3.Vector4(-1, 0, 0, 0) }, uOc: { value: new T3.Vector4(1, 0.12, 0, 0) }, uOcK: { value: new T3.Vector4(0, 0, 0, 0) }, uOcS: { value: new T3.Vector4(0.77, 0.04, 0.5, 0) },
    uBk: { value: BOKEH.map(b => new T3.Vector4(b[0], b[1], b[2], b[3])) }, uBkC: { value: BOKEH.map(b => new T3.Vector4(b[4], b[5], b[6], b[7])) }, uSp: { value: SPARK.map(() => new T3.Vector3(0, 0, 0)) } });
  api.set = (U, s) => {
    U.uLine.value.fromArray(s.line); U.uOc.value.fromArray(s.oc); U.uOcK.value.fromArray(s.k); U.uOcS.value.fromArray(s.s);
    const tm = s.oc[3], sh = s.oc[3] ? 1 : 0;
    BOKEH.forEach((b, i) => { U.uBk.value[i].w = b[3] * (1 - 0.1 * sh * (0.5 + 0.5 * Math.sin(tm * (1.3 + i * 0.37) + i * 1.9))); U.uBk.value[i].y = b[1] + 0.004 * sh * Math.sin(tm * 0.9 + i * 2.3); });
    SPARK.forEach((p, i) => U.uSp.value[i].set(s.s[0] + p[0], p[1] + OT.drift * Math.max(0, s.ts + s.post), p[2] * (0.7 + 0.3 * Math.sin(tm * (2.2 + i * 0.6) + i * 2.1))));
    if (U.uCal) U.uCal.value.set(OT.cal[0], OT.cal[1], OT.soft, OT.pull);
  };
  api.gorgeMat = (T3, nTex) => new T3.ShaderMaterial({ uniforms: api.uniforms(T3, nTex), depthTest: false, depthWrite: false, transparent: true,
    blending: T3.CustomBlending, blendSrc: T3.OneFactor, blendDst: T3.OneMinusSrcAlphaFactor, blendSrcAlpha: T3.OneFactor, blendDstAlpha: T3.OneMinusSrcAlphaFactor,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAG_GORGE });
  api.canyonMat = (T3, nTex, KEEP) => new T3.ShaderMaterial({ uniforms: { ...api.uniforms(T3, nTex), tScene: { value: null }, uCal: { value: new T3.Vector4(1, 1, 0.012, 0.02) } }, ...KEEP,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: FRAG_CANYON });
  return api;
}
