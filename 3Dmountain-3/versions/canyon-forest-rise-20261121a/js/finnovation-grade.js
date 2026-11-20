/* =====================================================================
   Colour grade shared by every layer of the page (index1-1): the main
   scene's last pass, the cards' cloud ground and the world epilogue all
   run their final colour through fiGrade(), so one setting moves the
   whole palette together. Display-referred (sRGB values as seen), like
   a CSS filter: HUE turns about the grey axis (the CSS hue-rotate matrix,
   which keeps luminance), SAT scales colour away from grey, TEMP leans
   cool (−) or warm (+), TINT leans magenta (−) or green (+).
   The identity (0, 1, 0, 0) costs one uniform compare.
   ===================================================================== */

/* hue in degrees; the others are unitless. */
export const GRADE_IDENTITY = Object.freeze({ hue: 0, sat: 1, temp: 0, tint: 0 });
export const GRADE_PRESETS = Object.freeze({
  原始: { hue: 0, sat: 1, temp: 0, tint: 0 },
  偏藍: { hue: -7, sat: 1.04, temp: -.12, tint: 0 },
  更藍: { hue: -12, sat: 1.08, temp: -.3, tint: .1 }
});

/* GLSL (ES 1.0 and three.js both): declare uGrade = vec4(hue radians, sat, temp, tint). */
export const GRADE_GLSL = /* glsl */ `
uniform vec4 uGrade;
vec3 fiGrade(vec3 c) {
  if (uGrade.x == 0.0 && uGrade.y == 1.0 && uGrade.z == 0.0 && uGrade.w == 0.0) return c;
  float cs = cos(uGrade.x), sn = sin(uGrade.x);
  c = mat3(0.213 + cs * 0.787 - sn * 0.213, 0.213 - cs * 0.213 + sn * 0.143, 0.213 - cs * 0.213 - sn * 0.787,
           0.715 - cs * 0.715 - sn * 0.715, 0.715 + cs * 0.285 + sn * 0.140, 0.715 - cs * 0.715 + sn * 0.715,
           0.072 - cs * 0.072 + sn * 0.928, 0.072 - cs * 0.072 - sn * 0.283, 0.072 + cs * 0.928 + sn * 0.072) * c;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = vec3(l) + (c - vec3(l)) * uGrade.y;
  return c * vec3(1.0 + 0.05 * uGrade.z - 0.02 * uGrade.w, 1.0 + 0.01 * uGrade.z + 0.035 * uGrade.w, 1.0 - 0.05 * uGrade.z - 0.02 * uGrade.w);
}
`;

/* The uniform value for a grade object: [hue radians, sat, temp, tint]. Writes into OUT when given. */
export function gradeVector(grade = GRADE_IDENTITY, out = [0, 1, 0, 0]) {
  out[0] = (+grade.hue || 0) * Math.PI / 180; out[1] = Number.isFinite(+grade.sat) ? +grade.sat : 1;
  out[2] = +grade.temp || 0; out[3] = +grade.tint || 0;
  return out;
}

/* The same grade on the CPU, for colours that live in CSS. RGB 0–1 in, 0–1 out. */
export function gradeRGB([r, g, b], grade = GRADE_IDENTITY) {
  const [h, s, t, n] = gradeVector(grade), cs = Math.cos(h), sn = Math.sin(h);
  let x = [
    (.213 + cs * .787 - sn * .213) * r + (.715 - cs * .715 - sn * .715) * g + (.072 - cs * .072 + sn * .928) * b,
    (.213 - cs * .213 + sn * .143) * r + (.715 + cs * .285 + sn * .140) * g + (.072 - cs * .072 - sn * .283) * b,
    (.213 - cs * .213 - sn * .787) * r + (.715 - cs * .715 + sn * .715) * g + (.072 + cs * .928 + sn * .072) * b
  ];
  const l = .2126 * x[0] + .7152 * x[1] + .0722 * x[2];
  x = x.map(v => l + (v - l) * s);
  return [x[0] * (1 + .05 * t - .02 * n), x[1] * (1 + .01 * t + .035 * n), x[2] * (1 - .05 * t - .02 * n)].map(v => Math.min(1, Math.max(0, v)));
}
