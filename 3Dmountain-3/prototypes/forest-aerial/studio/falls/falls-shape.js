/* RISE FALLS · the shape contract (team FT writes, team FW only reads). docs/falls/BRIEF-20261123.md
   Plain ES module, no imports. World units = the atlas's plate (x east, z south, y up; the plate is 14 x 7.834 around the origin).

   The gorge seen from above is a HORSESHOE laid out in the CLIENT'S FRAME (the settled lens: azimuth 323.44 deg):
     RIGHT = the screen's right on the land, FAR = away from the lens on the land.
   Its widest line (the two ends of the curtain) lies across the frame through CW. Beyond that line the rim is half an ellipse
   (half-width A, depth B_FAR): the flat arc the water falls from, all of it facing the lens. On the lens's side of the line the rim is half
   a "squircle" (exponent 3, depth B_NEAR): two nearly parallel sides coming toward the lens and a rounded near end.
   A rim point from its PARAMETRIC angle t (0 = the right end of the widest line, 90 deg = the far middle, 180 = the left end, 270 = nearest the lens):
     P(t) = CW + w(t) * ( A*c(t)*RIGHT + B*s(t)*FAR ),   far half: c = cos t, s = sin t;   near half: c = sgn(cos t)|cos t|^(2/3), s = sgn(sin t)|sin t|^(2/3)
     w(t) = 1 + small low wobble (so it is not a drawn curve). Counter-clockwise seen from above.
   t is NOT equally spaced along the rim; `outline` is (equal steps of length).
   gorgeSd / GORGE_SD_GLSL are the same formula: a first-order distance, exact on the rim, off by < 0.02 within 0.3 of it and < 0.06 within 0.6;
   deep inside it only says "well inside" (it reads up to twice the true distance near the middle).

   VALUES MAY STILL MOVE (the names will not). Read everything from here; see docs/falls/NOTES.md for each change. */

const WATER_Y = 0.105;
/* redo-s1 (2026-11-23 evening, designer A "GORGE"): ONE continuous horseshoe, fitted to the client's picture docs/falls/ref/04-target-horseshoe-20261123.webp
   with the page's own lens (.qa/falls/redo-gorge/fit2.cjs: the far arc's lip line within ~4.5 px rms of the picture's, page px at 1880x930).
   The three separate falls, the headlands (rim lift) and the crags of ft-v9…v11 are gone; their exported names stay (they return nothing). */
const DROP = 0.95;
/* director 2026-11-24: the client's opening is the DEFAULT (「好，設成預設」): 開口大小 0.66, 峽谷深度 0.54. Every static export below (FALLS_SHAPE, gorgeSd,
   troughDrop, rimPoint, GORGE_SD_GLSL, TROUGH_GLSL …) is the shape AT this opening; the live GLSL reads uFallsSize / uFallsDrop as before. */
export const DEFAULT_OPENING = { scale: 0.66, width: 1, length: 1, depth: 0.54, headland: 1 };
const DEF_SX = DEFAULT_OPENING.scale * DEFAULT_OPENING.width, DEF_SY = DEFAULT_OPENING.scale * DEFAULT_OPENING.length, DEF_DROP = DEFAULT_OPENING.depth;
/* the band (plateau water) narrows with the opening: width x sqrt(sx*sy) (live GLSL: LIVE_BAND_REACH_GLSL) */
const bandK = (sx, sy) => Math.min(1.4, Math.max(0.5, Math.sqrt(sx * sy)));                       /* redo-s3: wider and lower falls (client: too sharp / too deep); was 1.15 (redo-s1/s2), 1.35 (ft-v5) */
const CWX = 1.404, CWZ = -0.703;         /* CW: the middle of the widest line (fitted) */
const RX = 0.7716, RZ = 0.6361;          /* RIGHT on the plate (unit; the client's frame turned 2.9 deg so the right end sits a little nearer, as in the picture) */
const FX = 0.6361, FZ = -0.7716;         /* FAR on the plate (unit) */
const A = 2.54, B_FAR = 1.574, B_NEAR = 2.45;   /* redo-s1: far arc fitted; near end where the picture's pool meets its near shore (page y ~561) */
const PCX = +(CWX + (B_FAR - B_NEAR) / 2 * FX).toFixed(3), PCZ = +(CWZ + (B_FAR - B_NEAR) / 2 * FZ).toFixed(3);   /* the pool's middle (the old lake's centre is 0.122, -0.056) */
const W = [[2, 0.012, 0.6], [3, 0.010, 2.1], [5, 0.008, 4.0]];   /* a small low wobble, so the rim is not a drawn curve */
/* redo-s2: the lip is broken by small rocky outcrops (the rim juts into the gorge, amp < 0) and notches (bays where the water gathers, amp > 0),
   [deg, width deg, amp] (amp = share of the rim's radius). Narrow and small: the arc stays one horseshoe. */
const CRAG = [
  [13, 4.6, -0.026], [27, 5.2, 0.022], [41, 4.0, -0.030], [55, 5.6, 0.018], [86, 4.6, -0.024], [99, 6.0, 0.024],
  [112, 4.2, -0.028], [126, 5.0, 0.020], [139, 4.4, -0.026], [152, 5.6, 0.020], [166, 4.2, -0.024]   /* redo-s3: softer, rounder (wider, lower) */
];
/* redo-s2: the lip's height along the arc, [deg, width deg, rise] (plate units above waterY): the middle-right stands a little higher than the
   two ends, small rises on the rocky outcrops. The land, the plateau water behind the lip and the rock rise together (it is folded into troughDrop
   / fallsTrough as a negative lowering, flat within 0.7 of the rim, gone by 2.0). */
const LIP_LIFT = [[64, 30, 0.050], [112, 9, 0.016], [41, 5, 0.014], [139, 5, 0.012], [13, 6, 0.010]];
/* redo-s2: rock LEDGES on the curtain's face: [deg0, deg1, depthTop, depthBottom, out]. depth = share of the wall's height from the lip's top down
   to its foot (poolY - 0.12), matching the rock's bed planes (falls-gorge.js); out = how far the ledge's front stands inside the rim line. */
const LEDGES = [];   /* director: no ledge tiers (they read as grey blobs in front of the curtain; the target has none) */   /* redo-s3: ledges stand out less */
const HEADLAND = [];
/* THE SHOULDERS: past each end of the curtain the rim swings out toward the lens, so the dry end cliffs face the lens (dark layered rock in the picture) */
const FLARE = 0.10, FLARE_R = 0.12, FL_UP = 12, FL_HOLD = 26, FL_OUT = 74;   /* redo-s3: the end cliffs face the lens less (shorter, less prominent) */
const N = 96;                            /* outline points, equal steps along the rim; outline[0] is the point nearest the lens */
const DEG = Math.PI / 180;
/* THE LIP: one continuous curtain along the whole far arc, corner to corner (0 = the right end, 180 = the left end) */
const LIP_FROM = 0, LIP_TO = 180, LIP_SOFT = 3;
const LIP_ARCS = [[LIP_FROM, LIP_TO]];
/* the lip's pieces per river, one continuous chain (neighbours share their end point): fuller where a river arrives */
const LIP_SEGS = [
  [0, 9, 'SE', 1.0],        /* the right river (PRE-IPO) reaches the right end along the top of the right cliff */
  [9, 58, null, 0.82],
  [58, 80, 'NE', 1.0],      /* the top river (public equities) meets the lip right of the far middle */
  [80, 171, null, 0.82],
  [171, 180, 'NW', 1.0]     /* the left river (AI quant) reaches the left end along the top of the left cliff */
];
/* THE BAND: the plateau water runs flat to the lip along the whole far arc, on the right down the dry side wall to where the right river meets the rim.
   redo-s2: on the left it ends at the curtain's end (the left river comes in LOW through its own notch, below). Its width: bandReachAt(t). */
const BAND_FROM = 3, BAND_TO = 177, BAND_SOFT = 6;   /* director fix2: the band stays inside the curtain's range, gone just before its ends (no water on the end cliffs) */
const REACH_SIDE = 0.20, REACH_FAR = 0.30;   /* redo-s2: band width = REACH_SIDE + REACH_FAR * sin+(t): 0.50 at the far middle, 0.20 at the ends */
const BAND_ARCS = [[BAND_FROM, BAND_TO]];
/* THE TROUGH (the fourth river's ravine): smooth lowering along SW outlet ravine */
const TS = [-4.60, 0.80], TM = [-2.50, 0.42], TE = [-0.80, -0.02];   /* (ends of OUT_LINE, kept for the published 'trough.line') */
/* redo-s5: the fourth river's course (the atlas's SW river, then on past the old lake into the gorge at any opening size) */
const OUT_LINE = [[-5.0, 1.10], [-4.45, 0.73], [-3.80, 0.55], [-2.80, 0.53], [-2.47, 0.47], [-2.27, 0.21], [-1.75, 0.04], [-0.80, -0.02], [0.10, -0.06], [0.70, -0.16]];
const OUT_FULL = 0.45, OUT_RUN = 1.40;   /* redo-s5: full lowering within 0.45 of the rim, none beyond 1.85: follows the rim when the opening slider moves it */
const TROUGH_DROP = 0.36, TROUGH_FLAT = 0.30, TROUGH_FAR = 0.85, TROUGH_NEAR = 1.15;   /* redo-s4: the far bank gentler (no cut face) */
/* redo-s2: THE INLET: the left river (NW, AI quant) runs its last reach in a trough of its own and comes into the gorge LOW through a notch in the
   left wall (rapids down to the pool), as in the picture. Line from upstream to the rim, [x, z]. */
const NS = [-3.86, -2.39], NM = [-2.59, -1.535], NE = [0.40, -0.18];   /* (ends of IN_LINE, kept for the published 'inletTrough.line') */
/* redo-s5: the left river's course (the atlas's NW river from upstream, past its bend, on through the old lake into the gorge) */
const IN_LINE = [[-4.16, -2.53], [-3.53, -2.31], [-2.92, -2.05], [-2.66, -1.80], [-2.59, -1.535], [-1.95, -1.354], [-1.62, -1.313], [-1.04, -1.004], [-0.48, -0.641], [-0.24, -0.45], [0.40, -0.18]];
const IN_FULL = 0.20, IN_RUN = 0.95;
const IN_DROP = 0.34, IN_FLAT = 0.18, IN_FAR = 0.70, IN_NEAR = 1.00;   /* redo-s4: shallower, gentler banks (no cut faces) */
/* redo-s4: THE BRINK's profile: a rounded convex edge. Over the water the LAND itself (and the plateau water on it) rounds down over the last
   LIP_R before the rim line, a quarter round (level at LIP_R outside the rim, straight down at the rim line): it is part of troughDrop /
   fallsTrough, so rimTop is the foot of that round and every layer that follows the land bends with it. On the dry rim the rock makes a small
   mossy shoulder of radius DRY_R (falls-gorge.js). */
const LIP_R = 0.10, DRY_R = 0.04;
const lipW1 = t => 1 - sstep(90 * DEG - LIP_SOFT * DEG, 90 * DEG + LIP_SOFT * DEG, Math.abs(((((t - 90 * DEG + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI));
const brinkBend = s => { if (s <= 0) return 1; if (s >= LIP_R) return 0; const q = 1 - s / LIP_R; return 1 - Math.sqrt(Math.max(0, 1 - q * q)); };
/* THE NEAR SHORE: a low rocky bank (the pool shows to page y ~561 as in the picture) rising gently to the plateau toward the lens */
const DIP = 0.44, DIP_IN = 0.0, DIP_OUT = 2.05, DIP_SOFT = 26, DIP_GAP = 2;
const HUM = 0.050, HUM_OUT = 1.5;   /* redo-s2: hummocks on the near bank (plate units up / down), gone 1.5 outside the rim */

const sstep = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const shoulder = x => sstep(0, FL_UP * DEG, x) * (1 - sstep(FL_HOLD * DEG, FL_OUT * DEG, x));
const flare = t => t < 0 ? FLARE_R * shoulder(-t) + FLARE * shoulder(Math.PI + t) : 0;   /* t in -pi..pi; only on the lens's side of the widest line */
const angDist = (t, c) => Math.abs(((((t - c + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);
const cragBump = t => {
  let s = 0;
  for (const [deg, wd, amp] of CRAG) { const d = angDist(t, deg * DEG) / (wd * DEG); s += amp * Math.exp(-d * d); }
  return s;
};
/* redo-s1: the near shore (lens side) is broken into small bays and points, as in the picture; the far arc (the lip) stays a clean curve */
const NEAR_W = [[7, 0.042, 1.3], [13, 0.026, 0.4]];
const nearWob = t => t < 0 ? Math.sin(t) ** 2 * (NEAR_W[0][1] * Math.sin(NEAR_W[0][0] * t + NEAR_W[0][2]) + NEAR_W[1][1] * Math.sin(NEAR_W[1][0] * t + NEAR_W[1][2])) : 0;
const wob = t => (1 + W[0][1] * Math.sin(W[0][0] * t + W[0][2]) + W[1][1] * Math.sin(W[1][0] * t + W[1][2]) + W[2][1] * Math.sin(W[2][0] * t + W[2][2]) + nearWob(t) + cragBump(t)) * (1 + flare(t));

/* [signed distance, the point's parametric rim angle in radians (-pi..pi)] */
function gorgeField0(x, z) {
  const dx = x - CWX, dz = z - CWZ;
  const u = dx * RX + dz * RZ + 1e-5, v = dx * FX + dz * FZ + 1e-5;
  const far = v > 0, b = far ? B_FAR : B_NEAR;
  let sx = Math.abs(u) / A, sy = Math.abs(v) / b;
  let t = far ? Math.atan2(sy, sx) : Math.atan2(sy * Math.sqrt(sy), sx * Math.sqrt(sx));
  if (u < 0) t = Math.PI - t; if (v < 0) t = -t;
  const w = wob(t); sx /= w; sy /= w;
  let F, G;
  if (far) { F = Math.hypot(sx, sy); G = Math.hypot(sx / (A * w), sy / (b * w)) / Math.max(F, 1e-5); }
  else { F = Math.cbrt(sx * sx * sx + sy * sy * sy); G = Math.hypot(sx * sx / (A * w), sy * sy / (b * w)) / Math.max(F * F, 1e-5); }
  return [(F - 1) / G, t];
}
/* signed distance to the rim in plate units, negative inside */
function gorgeSd0(x, z) { return gorgeField0(x, z)[0]; }

const f = v => { const s = (+v).toFixed(5); return s.includes('.') ? s : s + '.0'; };
const CRAG_GLSL = CRAG.map(([deg, wd, amp]) => {
  const c = f(deg * DEG), invW = f(1 / (wd * DEG)), a = f(amp);
  return `{float dc=(abs(mod(t-${c}+3.14159265,6.2831853)-3.14159265))*${invW};w+=${a}*exp(-dc*dc);}`;
}).join('');
const fieldBody = (sx = '1.0', sy = '1.0') => `
  vec2 d=p-vec2(${f(CWX)},${f(CWZ)});
  vec2 q=vec2(dot(d,vec2(${f(RX)},${f(RZ)})),dot(d,vec2(${f(FX)},${f(FZ)})))+1e-5;
  bool far=q.y>0.0;
  vec2 e=vec2(${f(A)}*${sx},(far?${f(B_FAR)}:${f(B_NEAR)})*${sy});
  vec2 s=abs(q)/e;
  float t=far?atan(s.y,s.x):atan(s.y*sqrt(s.y),s.x*sqrt(s.x));
  if(q.x<0.0)t=3.14159265-t;
  if(q.y<0.0)t=-t;
  float w=1.0+${f(W[0][1])}*sin(${f(W[0][0])}*t+${f(W[0][2])})+${f(W[1][1])}*sin(${f(W[1][0])}*t+${f(W[1][2])})+${f(W[2][1])}*sin(${f(W[2][0])}*t+${f(W[2][2])});
  ${CRAG_GLSL}
  if(!far){float sn=sin(t);w+=sn*sn*(${f(NEAR_W[0][1])}*sin(${f(NEAR_W[0][0])}*t+${f(NEAR_W[0][2])})+${f(NEAR_W[1][1])}*sin(${f(NEAR_W[1][0])}*t+${f(NEAR_W[1][2])}));}
  if(!far){vec2 r=vec2(-t,3.14159265+t);vec2 sh=smoothstep(0.0,${f(FL_UP * DEG)},r)*(1.0-smoothstep(${f(FL_HOLD * DEG)},${f(FL_OUT * DEG)},r));w*=1.0+${f(FLARE_R)}*sh.x+${f(FLARE)}*sh.y;}
  s/=w; e*=w;
  float F,G;
  if(far){F=length(s);G=length(s/e)/max(F,1e-5);}
  else{F=pow(s.x*s.x*s.x+s.y*s.y*s.y,0.33333333);G=length(s*s/e)/max(F*F,1e-5);}`;
const FIELD_BODY = fieldBody();
/* the same, for a shader: no loops */
const DEF_FIELD_BODY = fieldBody(f(DEF_SX), f(DEF_SY));   /* director: the static programs are cut at the default opening */
export const GORGE_SD_GLSL = `float fallsGorgeSd(vec2 p){${DEF_FIELD_BODY}
  return (F-1.0)/G;
}`;
/* extra: vec2(signed distance, parametric rim angle in radians) */
export const GORGE_FIELD_GLSL = `vec2 fallsGorgeField(vec2 p){${DEF_FIELD_BODY}
  return vec2((F-1.0)/G,t);
}`;
/* live uniform-driven variant for studio-terrain-pbr-layer.js (reads uniform vec2 uFallsSize) */
export const LIVE_GORGE_FIELD_GLSL = `vec2 fallsGorgeField(vec2 p){${fieldBody('uFallsSize.x', 'uFallsSize.y')}
  return vec2((F-1.0)/G,t);
}`;

/* how much of a lip a rim angle is: 1 along the one continuous curtain (the far arc), 0 on the dry end cliffs and the near rim */
export function lipWeight(t) {
  let m = 0;
  for (const [a0, a1] of LIP_ARCS) {
    const mid = (a0 + a1) / 2 * DEG, half = (a1 - a0) / 2 * DEG;
    const d = angDist(t, mid);
    m = Math.max(m, 1 - sstep(half - LIP_SOFT * DEG, half + LIP_SOFT * DEG, d));
  }
  return m;
}
export const LIP_GLSL = `float fallsLip(float t){
  float m=0.0;
  ${LIP_ARCS.map(([a0, a1]) => {
    const mid = f((a0 + a1) / 2 * DEG), lo = f(((a1 - a0) / 2 - LIP_SOFT) * DEG), hi = f(((a1 - a0) / 2 + LIP_SOFT) * DEG);
    return `{float d=abs(mod(t-${mid}+3.14159265,6.2831853)-3.14159265);m=max(m,1.0-smoothstep(${lo},${hi},d));}`;
  }).join('\n  ')}
  return m;
}`;

/* the plateau water band (redo-s1: one continuous band along the far arc and down the two side walls to the side rivers) */
const BAND_MID = (BAND_FROM + BAND_TO) / 2 * DEG, BAND_HALF = (BAND_TO - BAND_FROM) / 2 * DEG;
export function bandWeight(t) {
  let m = 0;
  for (const [a0, a1] of BAND_ARCS) {
    const mid = (a0 + a1) / 2 * DEG, half = (a1 - a0) / 2 * DEG;
    m = Math.max(m, 1 - sstep(half - BAND_SOFT * DEG, half + BAND_SOFT * DEG, angDist(t, mid)));
  }
  return m;
}
export const BAND_GLSL = `float fallsBand(float t){
  float m=0.0;
  ${BAND_ARCS.map(([a0, a1]) => {
    const mid = f((a0 + a1) / 2 * DEG), lo = f(((a1 - a0) / 2 - BAND_SOFT) * DEG), hi = f(((a1 - a0) / 2 + BAND_SOFT) * DEG);
    return `{float d=abs(mod(t-${mid}+3.14159265,6.2831853)-3.14159265);m=max(m,1.0-smoothstep(${lo},${hi},d));}`;
  }).join('\n  ')}
  return m;
}`;

/* rim lift (ft-v9…v11 headlands): redo-s1 has none, it returns 0 everywhere; kept so every caller still works */
export function rimLiftAt(t, sd = 0) {
  const dry = 1 - lipWeight(t);
  if (dry < 1e-4) return 0;
  const r = Math.max(0, sd);
  let h = 0;
  for (const [deg, wd, amp, rad] of HEADLAND) {
    const d = angDist(t, deg * DEG) / (wd * DEG);
    h += amp * Math.exp(-d * d) * (1 - sstep(0, rad, r));
  }
  return h * dry;
}
export const RIM_LIFT_GLSL = !HEADLAND.length ? `float fallsRimLift(vec2 g){return 0.0;}` : `float fallsRimLift(vec2 g){
  float dry=1.0-fallsLip(g.y);
  float r=max(0.0,g.x), h=0.0;
  ${HEADLAND.map(([deg, wd, amp, rad]) => {
    const c = f(deg * DEG), invW = f(1 / (wd * DEG)), a = f(amp), ro = f(rad);
    return `{float d=abs(mod(g.y-${c}+3.14159265,6.2831853)-3.14159265)*${invW};h+=${a}*exp(-d*d)*(1.0-smoothstep(0.0,${ro},r));}`;
  }).join('\n  ')}
  return h*dry;
}`;
export const LIVE_RIM_LIFT_GLSL = RIM_LIFT_GLSL.replace('return h*dry;', 'return h*dry*uFallsHeadland;');

/* THE TROUGH + THE NEAR SHORE: how far the land (and the river on it) is lowered at a point. ft-v4: the dip starts past the BAND's ends.
   redo-s2: two river troughs (the fourth river's ravine, the left river's inlet), hummocks on the near bank, and the lip's rise (LIP_LIFT) as a
   NEGATIVE lowering, so every program that already follows fallsTrough (land, its water, 3D lines, light lines, flow marks, rocks) rises with it. */
const DIP_A = BAND_HALF + DIP_GAP * DEG, DIP_B = BAND_HALF + (DIP_GAP + DIP_SOFT) * DEG;
export function dipWeight(t) {   /* 0 along the curtain and the band, 1 along the dry near rim (radians) */
  const d = Math.abs(((((t - BAND_MID + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);
  return sstep(DIP_A, DIP_B, d);
}
/* a river's trough along a two-segment line s -> m -> e: deepest (drop) at e, gentle (wide) on the lens's side so the lens sees into it */
const troughOf = (x, z, sd, P, drop, flat, far, near, full, run) => {
  /* redo-s5: a polyline that follows the river (from upstream to past the old lake, so it reaches the rim at any opening size); the lowering is by
     distance to the rim (sd), so the trough always ends AT the rim, wherever the opening sliders put it */
  let bx = 0, bz = 0, best = 1e9;
  for (let i = 0; i + 1 < P.length; i++) {
    const ax = x - P[i][0], az = z - P[i][1], ex = P[i + 1][0] - P[i][0], ez = P[i + 1][1] - P[i][1];
    const h = Math.min(1, Math.max(0, (ax * ex + az * ez) / (ex * ex + ez * ez))), dx = ax - ex * h, dz = az - ez * h, dd = dx * dx + dz * dz;
    if (dd < best) { best = dd; bx = dx; bz = dz; }
  }
  const wide = bx * FX + bz * FZ > 0 ? far : near;
  return drop * (1 - sstep(full, full + run, sd)) * (1 - sstep(flat, flat + wide, Math.sqrt(best)));
};
/* the two rivers' troughs only (no shore, no lift): where a river's descent begins */
export const riverDropSd = (x, z, sd) => Math.max(troughOf(x, z, sd, OUT_LINE, TROUGH_DROP, TROUGH_FLAT, TROUGH_FAR, TROUGH_NEAR, OUT_FULL, OUT_RUN), troughOf(x, z, sd, IN_LINE, IN_DROP, IN_FLAT, IN_FAR, IN_NEAR, IN_FULL, IN_RUN));
const riverDrop0 = (x, z) => riverDropSd(x, z, gorgeSd0(x, z));
const hummock = (x, z) => 0.6 * Math.sin(7.3 * x + 1.1) * Math.sin(6.1 * z - 0.4) + 0.4 * Math.sin(12.9 * x + 3.1 * z - 2.3) * Math.sin(11.3 * z - 2.0 * x + 0.9);
/* the lip's rise at a rim angle (radians), plate units above waterY */
export function lipLiftAt(t) {
  let h = 0;
  for (const [deg, wd, amp] of LIP_LIFT) { const d = angDist(t, deg * DEG) / (wd * DEG); h += amp * Math.exp(-d * d); }
  return h;
}
/* redo-s5: with a shallow pool (the depth slider) the near shore's dip and the rivers' troughs are scaled down, so the pool always lies well below
   the near bank and the rivers reach the pool from above: dip <= (drop - 0.30) * 0.75, troughs x min(1, (drop - 0.10) * 0.6 / 0.36) */
const dipFor = drop => Math.min(DIP, Math.max(0, drop - 0.30) * 0.75);
const troughKFor = drop => Math.min(1, Math.max(0, (drop - 0.10) * 0.6) / TROUGH_DROP);
function troughDropG(g, x, z, drop = DROP) {
  const river = riverDropSd(x, z, g[0]) * troughKFor(drop), dw = dipWeight(g[1]), out = Math.max(0, g[0]);
  const shore = dipFor(drop) * dw * (1 - sstep(DIP_IN, DIP_OUT, g[0])) + HUM * dw * (1 - sstep(0, HUM_OUT, out)) * hummock(x, z);
  return Math.max(river, shore) - lipLiftAt(g[1]) * (1 - sstep(0.7, 2.0, out)) + LIP_R * lipW1(g[1]) * brinkBend(g[0]);
}
function troughDrop0(x, z) { return troughDropG(gorgeField0(x, z), x, z); }
const troughGlsl = (name, P, drop, flat, far, near, full, run) => {
  /* redo-s5: the polyline unrolled (no loop): the offset to the nearest segment, then the same profile as troughOf */
  let s = `float ${name}(vec2 p,float sd){
  vec2 d=fallsSegV(p,vec2(${f(P[0][0])},${f(P[0][1])}),vec2(${f(P[1][0])},${f(P[1][1])})),e;`;
  for (let i = 1; i + 1 < P.length; i++) s += `
  e=fallsSegV(p,vec2(${f(P[i][0])},${f(P[i][1])}),vec2(${f(P[i + 1][0])},${f(P[i + 1][1])})); if(dot(e,e)<dot(d,d)) d=e;`;
  return s + `
  float wide=dot(d,vec2(${f(FX)},${f(FZ)}))>0.0?${f(far)}:${f(near)};
  return ${f(drop)}*(1.0-smoothstep(${f(full)},${f(full + run)},sd))*(1.0-smoothstep(${f(flat)},${f(flat)}+wide,length(d)));
}`;
};
const LIFT_GLSL = LIP_LIFT.map(([deg, wd, amp]) => `{float dl=abs(mod(g.y-${f(deg * DEG)}+3.14159265,6.2831853)-3.14159265)*${f(1 / (wd * DEG))};lift+=${f(amp)}*exp(-dl*dl);}`).join('');
/* self-contained (its own copy of the field), so it can be pasted into a program alone */
const TROUGH_GLSL_T = `vec2 fallsTrField(vec2 p){${FIELD_BODY}
  return vec2((F-1.0)/G,t);
}
vec2 fallsSegV(vec2 p,vec2 a,vec2 b){vec2 pa=p-a,ba=b-a;return pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);}
${troughGlsl('fallsTrOut', OUT_LINE, TROUGH_DROP, TROUGH_FLAT, TROUGH_FAR, TROUGH_NEAR, OUT_FULL, OUT_RUN)}
${troughGlsl('fallsTrIn', IN_LINE, IN_DROP, IN_FLAT, IN_FAR, IN_NEAR, IN_FULL, IN_RUN)}
float fallsTrough(vec2 p){
  vec2 g=fallsTrField(p);
  float dD=FALLS_DROP_EXPR;
  float river=max(fallsTrOut(p,g.x),fallsTrIn(p,g.x))*min(1.0,max(0.0,(dD-0.10)*0.6)/${f(TROUGH_DROP)});
  float dd=abs(mod(g.y-${f(BAND_MID)}+3.14159265,6.2831853)-3.14159265);
  float dw=smoothstep(${f(DIP_A)},${f(DIP_B)},dd), ro=max(g.x,0.0);
  float hum=0.6*sin(7.3*p.x+1.1)*sin(6.1*p.y-0.4)+0.4*sin(12.9*p.x+3.1*p.y-2.3)*sin(11.3*p.y-2.0*p.x+0.9);
  float shore=min(${f(DIP)},max(0.0,dD-0.30)*0.75)*dw*(1.0-smoothstep(${f(DIP_IN)},${f(DIP_OUT)},g.x))+${f(HUM)}*dw*(1.0-smoothstep(0.0,${f(HUM_OUT)},ro))*hum;
  float lift=0.0; ${LIFT_GLSL}
  float lw=1.0-smoothstep(${f((90 - LIP_SOFT) * DEG)},${f((90 + LIP_SOFT) * DEG)},abs(mod(g.y-${f(90 * DEG)}+3.14159265,6.2831853)-3.14159265));
  float bq=1.0-clamp(g.x/${f(LIP_R)},0.0,1.0), bend=g.x<=0.0?1.0:1.0-sqrt(max(0.0,1.0-bq*bq));
  return max(river,shore)-lift*(1.0-smoothstep(0.7,2.0,ro))+${f(LIP_R)}*lw*bend;
}`;
export const TROUGH_GLSL = TROUGH_GLSL_T.replace(FIELD_BODY, DEF_FIELD_BODY).replace('FALLS_DROP_EXPR', f(DEF_DROP));
/* redo-s5: the live version follows the opening sliders: uFallsSize (scale x width, scale x length) and uFallsDrop (the depth; declared here; a
   program that does not bind it reads 0 and falls back to the default drop) */
export const LIVE_TROUGH_GLSL = 'uniform float uFallsDrop;' + String.fromCharCode(10) + TROUGH_GLSL_T.replace(FIELD_BODY, fieldBody('uFallsSize.x', 'uFallsSize.y')).replace('FALLS_DROP_EXPR', '(uFallsDrop>0.01?uFallsDrop:' + f(DEF_DROP) + ')');
/* redo-s2: the band's width at a rim angle (radians), plate units outward from the rim (the land's water mask uses it, with a mild noise) */
/* redo-s6: the band is shallow river water on a rocky plateau, not a ring: its width wanders along the arc (three low sines of the rim angle) and
   swells where the rivers arrive (the top river ~70 deg, the right river past the right end, the left end) */
const BAND_WOB = [[5, 0.26, 0.7], [11, 0.16, 2.1], [23, 0.09, 4.0]];
const BAND_RIVER = [[70, 10, 0.17], [-8, 9, 0.11], [182, 7, 0.07]];
export function bandReachAt(t) {
  let k = 1, add = 0;
  for (const [n, a, ph] of BAND_WOB) k += a * Math.sin(n * t + ph);
  for (const [deg, wd, a] of BAND_RIVER) { const d = angDist(t, deg * DEG) / (wd * DEG); add += a * Math.exp(-d * d); }
  return bandWeight(t) * Math.max(0.06, (REACH_SIDE + REACH_FAR * Math.max(0, Math.sin(t))) * k + add);
}
export const BAND_REACH_GLSL = `float fallsBandReach(float t){
  float k=1.0${BAND_WOB.map(([n, a, ph]) => `+${f(a)}*sin(${f(n)}*t+${f(ph)})`).join('')}, add=0.0;
  ${BAND_RIVER.map(([deg, wd, a]) => `{float d=abs(mod(t-(${f(deg * DEG)})+3.14159265,6.2831853)-3.14159265)*${f(1 / (wd * DEG))};add+=${f(a)}*exp(-d*d);}`).join('')}
  return fallsBand(t)*max(0.06,(${f(REACH_SIDE)}+${f(REACH_FAR)}*max(0.0,sin(t)))*k+add);
}`;   /* needs BAND_GLSL first */
/* director: the band narrows with the opening (needs uniform vec2 uFallsSize); the JS side: buildFallsShape's bandReach / fn.bandReachAt */
export const LIVE_BAND_REACH_GLSL = BAND_REACH_GLSL.replace('float fallsBandReach(float t){', 'float fallsBandReach0(float t){') + `
float fallsBandReach(float t){ return fallsBandReach0(t)*clamp(sqrt(max(uFallsSize.x*uFallsSize.y,0.0)),0.5,1.4); }`;
/* redo-s6: low dark rocks and mossy islets in the band (near the brink, and where the rivers come in): [rim angle deg, across the band 0 (rim) .. 1
   (its outer edge), size, kind 0 rock / 1 islet]. Their plate positions are worked out per shape (they follow the opening sliders): bandRocks[]. */
const BAND_ROCKS = [[12, .38, .045, 0], [24, .62, .035, 0], [33, .30, .050, 0], [47, .58, .040, 0], [61, .34, .055, 0], [66, .70, .125, 1], [74, .46, .050, 0],
  [79, .28, .040, 0], [92, .52, .035, 0], [105, .32, .045, 0], [118, .62, .125, 1], [131, .36, .040, 0], [146, .56, .050, 0], [158, .30, .040, 0],
  [170, .50, .045, 0], [176, .66, .110, 1], [-6, .50, .050, 0], [-13, .40, .040, 0]];
const bandRockList = (rPt, reachF) => BAND_ROCKS.map(([deg, fr, size, kind]) => {
  const p = rPt(deg), q = rPt(deg, 1.02); let nx = q[0] - p[0], nz = q[1] - p[1]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
  const reach = reachF(deg * DEG), d = Math.max(0.07 + size * 0.5, fr * reach);
  return { x: +(p[0] + nx * d).toFixed(4), z: +(p[1] + nz * d).toFixed(4), r: size, kind, deg };
});

/* a rim point from its parametric angle in degrees (see the head); scale > 1 = outside the rim, < 1 = inside */
function rimPoint0(deg, scale = 1) {
  const t = deg * DEG, c0 = Math.cos(t), s0 = Math.sin(t), far = s0 > 0, w = wob(Math.atan2(s0, c0)) * scale;
  const c = far ? c0 : Math.sign(c0) * Math.pow(Math.abs(c0), 2 / 3), s = far ? s0 : Math.sign(s0) * Math.pow(Math.abs(s0), 2 / 3);
  const u = A * c * w, v = (far ? B_FAR : B_NEAR) * s * w;
  return [CWX + u * RX + v * FX, CWZ + u * RZ + v * FZ];
}
/* the height of the rim's top edge at an angle: water level at waterfall notches, lifted onto elevated mossy headlands, lowered into SW trough & gentle near shore */
function rimY0(deg) { const [x, z] = rimPoint0(deg); return WATER_Y - troughDrop0(x, z) + rimLiftAt(deg * DEG, 0); }

/* the outline: equal steps along the rim, from the point nearest the lens (t = -90 deg), counter-clockwise seen from above */
const DENSE = 7200, dense = [], run = [0];
for (let i = 0; i <= DENSE; i++) { const deg = -90 + i * 360 / DENSE; dense.push(rimPoint0(deg)); if (i) run.push(run[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1])); }
const PERIMETER = run[DENSE];
const outline = [], outlineDeg = [];
for (let k = 0, j = 0; k < N; k++) { const want = k * PERIMETER / N; while (run[j + 1] < want) j++; const e = (want - run[j]) / Math.max(1e-9, run[j + 1] - run[j]); outline.push([dense[j][0] + (dense[j + 1][0] - dense[j][0]) * e, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * e]); outlineDeg.push(-90 + (j + e) * 360 / DENSE); }
/* the outline index of a parametric angle (fractional), and the parametric angle of an outline index */
const rimIndex0 = deg => { const d = ((((deg + 90) % 360) + 360) % 360); const j = Math.min(DENSE - 1, Math.floor(d / 360 * DENSE)), e = d / 360 * DENSE - j; return ((run[j] + (run[j + 1] - run[j]) * e) / PERIMETER * N) % N; };
const rimAngle0 = i => { const k = ((i % N) + N) % N, i0 = Math.floor(k), e = k - i0, a = outlineDeg[i0], b = i0 + 1 < N ? outlineDeg[i0 + 1] : 270; return a + (b - a) * e; };

/* THE LIPS (redo-s1): one continuous curtain along the far arc, from the right end round to the left end, in pieces per river (LIP_SEGS).
   from / to are outline indices, inclusive (the curtain of a lip runs along outline[from..to]); neighbours share their end point.
   river = the atlas's river name (atlas.rivers[k].name): NW = left of the frame (AI), NE = top (public equities), SE = right (pre-IPO).
   Seen from the lens: the arc between t = 0 and 180 deg (the two ends of the widest line) faces the lens; the short pieces beyond the ends
   (down the sides to the rivers) are seen edge-on. */
const lip = (a0, a1, river, flow) => ({ from: Math.round(rimIndex0(a0)), to: Math.round(rimIndex0(a1)), river, flow });
const lips = LIP_SEGS.map(([a0, a1, river, flow]) => lip(a0, a1, river, flow));

/* THE OUTLET: the fourth river (SW, lower-left of the frame: derivatives) comes down a rocky ravine and meets the pool.
   path = its water line from upstream (on the plateau, y = waterY), down the trough (the land's own river, lowered, as far as the rim:
   y = waterY - troughDrop), then the cascade inside the rim down to the pool (y = poolY) and a little way into the pool; [x, z, y].
   width = the water's width along the path (plate units). */
const SW_LINE = [[-4.95, 1.05], [-4.41, 0.70], [-4.04, 0.58], [-3.48, 0.53], [-2.98, 0.52], [-2.53, 0.50], [-2.27, 0.19], [-1.42, 0.06], [-0.80, -0.02], [-0.2, -0.05], [0.4, -0.12], [0.9, -0.22], [1.3, -0.30]];   /* redo-s5: on into the gorge (any opening) */
const CASCADE = 0.55;   /* how far inside the rim the water reaches the pool's level */
/* redo-s2: the left river's water line (upstream -> the notch -> the pool), from the atlas's NW river */
const NW_LINE = [[-4.16, -2.53], [-3.53, -2.31], [-2.92, -2.05], [-2.66, -1.80], [-2.589, -1.535], [-2.276, -1.446], [-1.952, -1.354], [-1.62, -1.313], [-1.322, -1.193], [-1.044, -1.004], [-0.757, -0.83], [-0.479, -0.641], [-0.244, -0.45], [0.15, -0.28], [0.55, -0.15], [0.9, -0.08]];   /* redo-s5: the atlas's NW river, on into the gorge (any opening) */
const crs = (a, b, c, d, t) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
/* a river's water line down its trough and its cascade into the pool; sdF / dropF / rivF = the field, the full lowering and the troughs only */
function riverPath(LINE, sdF, dropF, rivF, drop, cascade = CASCADE) {
  const P = LINE, pts = [];
  for (let i = 1; i < P.length - 2; i++) for (let s = 0; s < 6; s++) { const t = s / 6; pts.push([crs(P[i - 1][0], P[i][0], P[i + 1][0], P[i + 2][0], t), crs(P[i - 1][1], P[i][1], P[i + 1][1], P[i + 2][1], t)]); }
  pts.push(P[P.length - 2].slice());
  let start = 0, cross = pts.length - 1;
  for (let i = 0; i < pts.length; i++) if (rivF(pts[i][0], pts[i][1]) < 1e-4) start = i; else break;
  for (let i = pts.length - 1; i > 0; i--) if (sdF(pts[i][0], pts[i][1]) < 0) cross = i; else break;
  const rimDrop = dropF(pts[cross][0], pts[cross][1]);
  return { cross, start, points: pts.map(([x, z]) => {
    const sd = sdF(x, z);
    let y = WATER_Y - dropF(x, z);
    if (sd < 0) { const k = sstep(0, 1, Math.min(1, -sd / cascade)); y = WATER_Y - rimDrop - (drop - rimDrop) * k; }
    return [+x.toFixed(4), +z.toFixed(4), +y.toFixed(4)];
  }) };
}
const OUT = riverPath(SW_LINE, gorgeSd0, troughDrop0, riverDrop0, DROP);
const outAngle = (() => { const [x, z] = OUT.points[OUT.cross]; return ((gorgeField0(x, z)[1] / DEG) + 360) % 360; })();
const INL = riverPath(NW_LINE, gorgeSd0, troughDrop0, riverDrop0, DROP, 0.42);
const inAngle = (() => { const [x, z] = INL.points[INL.cross]; return ((gorgeField0(x, z)[1] / DEG) + 360) % 360; })();
/* redo-s2: the ledges as published (outline index ranges, heights at their middle) */
const FOOT_Y = WATER_Y - DROP - 0.12;
const ledgeList = (rimYF, rIdx, FOOT_Y = WATER_Y - DROP - 0.12) => LEDGES.map(([d0, d1, dt, db, out]) => { const top = rimYF((d0 + d1) / 2); return { deg0: d0, deg1: d1, from: Math.round(rIdx(d0)), to: Math.round(rIdx(d1)), depthTop: dt, depthBottom: db, yTop: +(top - (top - FOOT_Y) * dt).toFixed(4), yBottom: +(top - (top - FOOT_Y) * db).toFixed(4), out, soft: 2.5 }; });
/* how much of a ledge a rim angle (degrees) is, and which: { w 0..1, i } */
export function ledgeAt(deg) {
  let best = { w: 0, i: -1 };
  LEDGES.forEach(([d0, d1], i) => { const mid = (d0 + d1) / 2 * DEG, half = (d1 - d0) / 2 * DEG, d = angDist(deg * DEG, mid), w = 1 - sstep(half - 2.5 * DEG, half + 2.5 * DEG, d); if (w > best.w) best = { w, i }; });
  return best;
}

const FALLS_BASE = {
  version: 'dir2 2026-11-24 (default opening 0.66 / 0.54)',
  waterY: WATER_Y,                 /* plateau water level (today's) */
  poolY: +(WATER_Y - DROP).toFixed(4),          /* pool surface */
  floorY: +(WATER_Y - DROP - .38).toFixed(4),   /* gorge floor at its deepest */
  centre: [PCX, PCZ],              /* the pool's middle, plate XZ */
  outline: outline.map(([x, z]) => [+x.toFixed(4), +z.toFixed(4)]),   /* the rim, closed, counter-clockwise seen from above, 96 points, equal steps */
  lips,
  outlet: {
    from: Math.round(rimIndex0(outAngle) - 1.6), to: Math.round(rimIndex0(outAngle) + 1.6),
    path: OUT.points, width: .42, river: 'SW',
    cross: OUT.cross,              /* path index of the first point inside the rim (the cascade begins here) */
    start: OUT.start,              /* last path index still at the plateau's level (the trough begins after it) */
    angle: +outAngle.toFixed(2)    /* parametric rim angle of the crossing, degrees */
  },
  /* redo-s2: the left river (NW) comes in LOW through a notch in the left wall: same fields as outlet (path [x, z, y] from upstream down its trough,
     through the notch at cross, down to the pool). Its water flows INTO the pool (rapids). */
  inlet: {
    from: Math.round(rimIndex0(inAngle) - 1.4), to: Math.round(rimIndex0(inAngle) + 1.4),
    path: INL.points, width: .30, river: 'NW', cross: INL.cross, start: INL.start, angle: +inAngle.toFixed(2)
  },
  /* redo-s2: rock ledges on the curtain's face (the water breaks there): outline ranges, top / bottom heights at the middle, front 'out' inside the rim line */
  ledges: [],
  /* redo-s2: per outline index: the lip's height (y of the rim's top: waterY + lip rise - lowering) and the band's width outward from the rim */
  rimTop: [],
  bandReach: [],
  /* extras (not in the brief's contract; stable too) */
  frame: { right: [RX, RZ], far: [FX, FZ], origin: [CWX, CWZ], a: A, bFar: B_FAR, bNear: B_NEAR, perimeter: +PERIMETER.toFixed(4) },
  lipArc: { from: LIP_FROM, to: LIP_TO, soft: LIP_SOFT },
  bandArc: { from: BAND_FROM, to: BAND_TO, soft: BAND_SOFT },   /* ft-v4: the plateau water band (longer than the curtain: down the sides to the rivers) */
  shoulders: { flare: FLARE, flareRight: FLARE_R, up: FL_UP, hold: FL_HOLD, out: FL_OUT },
  trough: { drop: TROUGH_DROP, line: [TS, TM, TE], flat: TROUGH_FLAT, far: TROUGH_FAR, near: TROUGH_NEAR, full: OUT_FULL, run: OUT_RUN },
  dip: { drop: DIP, in: DIP_IN, out: DIP_OUT, soft: DIP_SOFT, gap: DIP_GAP },   /* the near shore's dip (part of troughDrop) */
  defaults: { ...DEFAULT_OPENING },   /* director: the client's opening */
  /* the module's functions, for code that is handed this object only */
  fn: { gorgeSd: gorgeSd0, gorgeField: gorgeField0, lipWeight, bandWeight, dipWeight, troughDrop: troughDrop0, rimLiftAt, rimPoint: rimPoint0, rimY: rimY0, rimIndex: rimIndex0, rimAngle: rimAngle0, lipLiftAt, bandReachAt, ledgeAt, riverDrop: riverDrop0 }
};
FALLS_BASE.ledges = ledgeList(rimY0, rimIndex0);
FALLS_BASE.rimTop = FALLS_BASE.outline.map((_, i) => +rimY0(rimAngle0(i)).toFixed(4));
FALLS_BASE.bandReach = FALLS_BASE.outline.map((_, i) => +bandReachAt(rimAngle0(i) * DEG).toFixed(4));
/* redo-s6: rocks and islets in the band: { x, z, r (size, plate units), kind 0 rock / 1 islet, deg } — WATER can flow and foam round them */
FALLS_BASE.bandRocks = bandRockList(rimPoint0, bandReachAt);
FALLS_BASE.bandEdge = { noise: [0.80, 1.20], note: 'the land water reaches bandReach[i] x (0.8..1.2 spatial noise), with a soft mossy bank' };
FALLS_BASE.lipLift = { table: LIP_LIFT, note: 'rise of the lip above waterY per rim angle: lipLiftAt(t radians); rimTop[i] already includes it' };
FALLS_BASE.inletTrough = { drop: IN_DROP, line: [NS, NM, NE], flat: IN_FLAT, far: IN_FAR, near: IN_NEAR, full: IN_FULL, run: IN_RUN };
/* redo-s4: the brink's profile (plate units). In the frame of a rim point: d = distance inside the rim line, y below the rim's top (rimTop):
   the rock surface runs d = r sin(a), y = -r (1 - cos(a)), a = 0..90 deg (r = radius over the water, dryRadius on the dry rim); at a = 90 deg it stands
   overhang = r inside the rim line, y = -r; below that the face leans back to the plain wall by 30 % of the wall's height. */
FALLS_BASE.lipProfile = { radius: LIP_R, dryRadius: DRY_R, overhang: 0, kind: 'land rounds down: quarter round over the last radius before the rim line; rimTop = its foot' };
/* the brink's height relative to the plateau water at a distance s OUTSIDE the rim line (s >= 0), over the water: 0 at s >= radius, -radius at s = 0 */
export const lipProfilePoint = s => -LIP_R * brinkBend(s);

/* live parameterized shape builder (ft-v11): builds a watertight FALLS_SHAPE for any live opening scale / width / length / depth / headland */
export function buildFallsShape({ scale = 1, width = 1, length = 1, depth = DROP, headland = 1 } = {}) {
  const sx = Math.min(2.2, Math.max(0.35, (+scale || 1) * (+width || 1)));
  const sy = Math.min(2.2, Math.max(0.35, (+scale || 1) * (+length || 1)));
  const drop = Math.min(3.2, Math.max(0.30, Number.isFinite(+depth) ? +depth : DROP));
  const hl = Math.min(2.5, Math.max(0, Number.isFinite(+headland) ? +headland : 1));
  const aS = A * sx, bfS = B_FAR * sy, bnS = B_NEAR * sy;
  const pcx = +(CWX + (bfS - bnS) / 2 * FX).toFixed(3), pcz = +(CWZ + (bfS - bnS) / 2 * FZ).toFixed(3);
  const gField = (x, z) => {
    const dx = x - CWX, dz = z - CWZ;
    const u = dx * RX + dz * RZ + 1e-5, v = dx * FX + dz * FZ + 1e-5;
    const far = v > 0, b = far ? bfS : bnS;
    let ax = Math.abs(u) / aS, ay = Math.abs(v) / b;
    let t = far ? Math.atan2(ay, ax) : Math.atan2(ay * Math.sqrt(ay), ax * Math.sqrt(ax));
    if (u < 0) t = Math.PI - t; if (v < 0) t = -t;
    const w = wob(t); ax /= w; ay /= w;
    let F, G;
    if (far) { F = Math.hypot(ax, ay); G = Math.hypot(ax / (aS * w), ay / (b * w)) / Math.max(F, 1e-5); }
    else { F = Math.cbrt(ax * ax * ax + ay * ay * ay); G = Math.hypot(ax * ax / (aS * w), ay * ay / (b * w)) / Math.max(F * F, 1e-5); }
    return [(F - 1) / G, t];
  };
  const gSd = (x, z) => gField(x, z)[0];
  const rPt = (deg, sc = 1) => {
    const t = deg * DEG, c0 = Math.cos(t), s0 = Math.sin(t), far = s0 > 0, w = wob(Math.atan2(s0, c0)) * sc;
    const c = far ? c0 : Math.sign(c0) * Math.pow(Math.abs(c0), 2 / 3), s = far ? s0 : Math.sign(s0) * Math.pow(Math.abs(s0), 2 / 3);
    const u = aS * c * w, v = (far ? bfS : bnS) * s * w;
    return [CWX + u * RX + v * FX, CWZ + u * RZ + v * FZ];
  };
  const tDrop = (x, z) => troughDropG(gField(x, z), x, z, drop);
  const rLift = (t, sd = 0) => rimLiftAt(t, sd) * hl;
  const bk = bandK(sx, sy), bReach = t => bandReachAt(t) * bk;   /* director: the band narrows with the opening */
  const rY = deg => { const [x, z] = rPt(deg); return WATER_Y - tDrop(x, z) + rLift(deg * DEG, 0); };
  const D = 1800, dn = [], rn = [0];
  for (let i = 0; i <= D; i++) { const deg = -90 + i * 360 / D; dn.push(rPt(deg)); if (i) rn.push(rn[i - 1] + Math.hypot(dn[i][0] - dn[i - 1][0], dn[i][1] - dn[i - 1][1])); }
  const perim = rn[D], outL = [], outDeg = [];
  for (let k = 0, j = 0; k < N; k++) { const want = k * perim / N; while (rn[j + 1] < want) j++; const e = (want - rn[j]) / Math.max(1e-9, rn[j + 1] - rn[j]); outL.push([+(dn[j][0] + (dn[j + 1][0] - dn[j][0]) * e).toFixed(4), +(dn[j][1] + (dn[j + 1][1] - dn[j][1]) * e).toFixed(4)]); outDeg.push(-90 + (j + e) * 360 / D); }
  const rIdx = deg => { const d = ((((deg + 90) % 360) + 360) % 360); const j = Math.min(D - 1, Math.floor(d / 360 * D)), e = d / 360 * D - j; return ((rn[j] + (rn[j + 1] - rn[j]) * e) / perim * N) % N; };
  const rAng = i => { const k = ((i % N) + N) % N, i0 = Math.floor(k), e = k - i0, a = outDeg[i0], b = i0 + 1 < N ? outDeg[i0 + 1] : 270; return a + (b - a) * e; };
  const lps = LIP_SEGS.map(([a0, a1, river, flow]) => ({ from: Math.round(rIdx(a0)), to: Math.round(rIdx(a1)), river, flow }));
  /* outlet / inlet paths synced with current opening & depth */
  const rDrop = (x, z) => riverDropSd(x, z, gSd(x, z));
  const oP = riverPath(SW_LINE, gSd, tDrop, rDrop, drop), outPts = oP.points, cross = oP.cross, start = oP.start;
  const iP = riverPath(NW_LINE, gSd, tDrop, rDrop, drop, 0.42), iAng = ((gField(iP.points[iP.cross][0], iP.points[iP.cross][1])[1] / DEG) + 360) % 360;
  const oAng = ((gField(outPts[cross][0], outPts[cross][1])[1] / DEG) + 360) % 360;
  return {
    ...FALLS_BASE,
    poolY: +(WATER_Y - drop).toFixed(4),
    floorY: +(WATER_Y - drop - .38).toFixed(4),
    centre: [pcx, pcz],
    outline: outL,
    lips: lps,
    outlet: { from: Math.round(rIdx(oAng) - 1.6), to: Math.round(rIdx(oAng) + 1.6), path: outPts, width: .42, river: 'SW', cross, start, angle: +oAng.toFixed(2) },
    inlet: { from: Math.round(rIdx(iAng) - 1.4), to: Math.round(rIdx(iAng) + 1.4), path: iP.points, width: .30, river: 'NW', cross: iP.cross, start: iP.start, angle: +iAng.toFixed(2) },
    ledges: ledgeList(rY, rIdx, WATER_Y - drop - 0.12),
    rimTop: outL.map((_, i) => +rY(rAng(i)).toFixed(4)),
    bandReach: outL.map((_, i) => +bReach(rAng(i) * DEG).toFixed(4)),
    bandRocks: bandRockList(rPt, bReach),
    frame: { right: [RX, RZ], far: [FX, FZ], origin: [CWX, CWZ], a: aS, bFar: bfS, bNear: bnS, perimeter: +perim.toFixed(4) },
    params: { scale: +scale || 1, width: +width || 1, length: +length || 1, depth: drop, headland: hl, sx, sy },
    fn: { gorgeSd: gSd, gorgeField: gField, lipWeight, bandWeight, dipWeight, troughDrop: tDrop, rimLiftAt: rLift, rimPoint: rPt, rimY: rY, rimIndex: rIdx, rimAngle: rAng, lipLiftAt, bandReachAt: bReach, ledgeAt, riverDrop: rDrop }
  };
}

/* director 2026-11-24: THE published shape = the default opening (0.66 / 0.54); the same names as before */
export const FALLS_SHAPE = buildFallsShape(DEFAULT_OPENING);
FALLS_SHAPE.base = FALLS_BASE;   /* the scale-1 shape the sliders' numbers are relative to */
export const gorgeField = FALLS_SHAPE.fn.gorgeField, gorgeSd = FALLS_SHAPE.fn.gorgeSd, troughDrop = FALLS_SHAPE.fn.troughDrop, rimPoint = FALLS_SHAPE.fn.rimPoint,
  rimY = FALLS_SHAPE.fn.rimY, rimIndex = FALLS_SHAPE.fn.rimIndex, rimAngle = FALLS_SHAPE.fn.rimAngle, riverDrop = FALLS_SHAPE.fn.riverDrop;
