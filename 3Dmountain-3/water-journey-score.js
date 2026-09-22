/**
 * Scroll-owned camera score for the final five-river chapter.
 * progress is normalized from the page's 8..14.5 range. Nothing uses wall time.
 * Positions are world units; roll is radians and fov is degrees.
 * Apply position(centerX, height, centerZ), then lookAt(centerX, 0,
 * centerZ - lookAhead). Interpolate camera up from (0,1,0) to (0,0,-1)
 * with rise before lookAt, then rotateZ(roll).
 */
const clamp01 = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;
const ease = (start, end, value) => {
  const t = clamp01((value - start) / (end - start));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const entranceX = 0;

export function sampleRiverScore(progress, aspect, reducedMotion = false) {
  const p = clamp01(Number.isFinite(progress) ? progress : 0);
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const portrait = 1 - ease(.72, 1.35, ratio);
  const rise = ease(.012, .30, p);

  // Focus pauses over each channel before moving across the watershed.
  // Separate smooth transitions provide readable rests with zero endpoint speed.
  const focus = ease(.385, .445, p) + ease(.495, .555, p)
    + ease(.605, .665, p) + ease(.715, .775, p);
  const focusStrength = .9 * ease(.285, .35, p) * (1 - ease(.875, .96, p));
  const settle = ease(.86, .96, p);
  const survey = ease(.30, .86, p);
  const driftX = reducedMotion ? 0 : (focus - 2) * mix(12, 3, portrait) * focusStrength;
  const overheadX = mix(driftX, 0, settle);
  const groundCenterZ = mix(mix(135, 85, survey), 100, settle);

  // Hold an oblique aerial view, with the optical axis aimed near z=100.
  // Roll establishes a diagonal composition; it does not oscillate with time.
  const topFov = 46;
  const tangent = Math.tan(topFov * Math.PI / 360);
  const footprint = mix(1220, 1180, portrait);
  const tiltRatio = mix(.75, .22, portrait);
  const baseRoll = mix(.12, .02, portrait);
  const detailRoll = reducedMotion ? 0 : .004 * Math.sin(focus * Math.PI / 2)
    * focusStrength * (1 - settle);
  const overheadRoll = baseRoll + detailRoll;
  let topHeight = footprint / (2 * tangent * ratio);

  // Exact ray/ground intersections cap altitude before any viewport corner
  // reaches the expanded terrain (x +/-1050, z +/-2300). This also protects
  // unusually narrow phone windows, where a full-width view cannot fit.
  const c = 1 / Math.sqrt(1 + tiltRatio * tiltRatio);
  const sn = tiltRatio * c;
  const cr = Math.cos(overheadRoll), sr = Math.sin(overheadRoll);
  let extentX = 0, extentZ = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const vx = sx * tangent * ratio, vy = sy * tangent;
    const vertical = vx * sr + vy * cr;
    const dy = -c + sn * vertical;
    const dx = vx * cr - vy * sr;
    const dz = -sn - c * vertical;
    extentX = Math.max(extentX, Math.abs(-dx / dy));
    extentZ = Math.max(extentZ, Math.abs(tiltRatio - dz / dy));
  }
  topHeight = Math.min(topHeight,
    (1050 - 80 - Math.abs(overheadX)) / extentX,
    (2300 - 100 - Math.abs(groundCenterZ)) / extentZ);
  const overheadLookAhead = topHeight * tiltRatio;
  const height = mix(3, topHeight, rise);
  const centerX = mix(entranceX, overheadX, rise);
  const centerZ = mix(430, groundCenterZ + overheadLookAhead, rise);
  const lookAhead = mix(40, overheadLookAhead, rise);
  const fov = mix(69, topFov, rise);
  const roll = overheadRoll * rise;

  let chapter;
  if (p < .075) chapter = '循著河流 · 走出峽谷';
  else if (p < .30) chapter = '緩緩升空 · 五河展開';
  else if (p < .875) chapter = `五河巡禮 · 第${['一', '二', '三', '四', '五'][Math.round(focus)]}條河`;
  else chapter = '五河之境 · 俯瞰全貌';

  return { rise, centerX, centerZ, height, lookAhead, roll, fov,
    focus, focusStrength, chapter };
}
