
/* ================================================================ phase 2 · chapter text on a clock, dissolve over the cuts
   (appended to flow-feel.js by flow-feel-build.cjs; shares its scope: classic, cfg, clamp, FEEL)
   Numbers measured on Hubtown (docs/smooth-flow/hubtown-study.md §2): the old chapter's text leaves in ≈ 300 ms, the new one starts
   640 ms after the cut: heading letters fade in random order over 1.38 s, the body rises 30 px → 0 over ≈ 0.95 s with ≈ 115 ms between
   lines, the button follows; everything is time-driven (keeps playing when the wheel stops). The cut itself is covered by a 875 ms
   dissolve (distort + dark dip + vignette) on a clock too. Both are off with ?smooth=classic. */
const EASE = 'cubic-bezier(.2,.05,.1,.95)', DISSOLVE_EASE = [.2, .25, .55, .8];
const TEXT_CSS = `
.fi-copy > .fi-copy-panel{opacity:1!important;transform:none!important;transition:visibility 0s linear calc(var(--feel-out,300)*1ms)!important}
.fi-copy > .fi-copy-panel.is-active{transition:visibility 0s linear 0s!important}
.fi-copy > .fi-copy-panel > *{opacity:0;transform:translateY(30px);transition:opacity calc(var(--feel-out,300)*1ms) cubic-bezier(.4,0,1,1),transform 0s linear calc(var(--feel-out,300)*1ms)}
.fi-copy > .fi-copy-panel.is-active > *{opacity:1;transform:none;transition:opacity calc(var(--feel-ms,1380)*.69*1ms) ${EASE} calc(var(--feel-delay,640)*1ms + var(--feel-i,0)*var(--feel-stagger,115)*1ms),transform calc(var(--feel-ms,1380)*.69*1ms) ${EASE} calc(var(--feel-delay,640)*1ms + var(--feel-i,0)*var(--feel-stagger,115)*1ms)}
.fi-copy > .fi-copy-panel > :nth-child(1){--feel-i:0}
.fi-copy > .fi-copy-panel > :nth-child(3){--feel-i:2}
.fi-copy > .fi-copy-panel > :nth-child(4){--feel-i:6}
.fi-copy > .fi-copy-panel > h1,.fi-copy > .fi-copy-panel > h2{opacity:1!important;transform:none!important;transition:none!important}
.fi-copy .feel-w{display:inline-block;white-space:nowrap}
.fi-copy .feel-ch{display:inline-block;opacity:0;transition:opacity calc(var(--feel-out,300)*1ms) cubic-bezier(.4,0,1,1)}
.fi-copy > .fi-copy-panel.is-active .feel-ch{opacity:1;transition:opacity calc(var(--feel-ms,1380)*.5*1ms) ${EASE} calc(var(--feel-delay,640)*1ms + var(--d,0)*var(--feel-ms,1380)*.5*1ms)}
@media (prefers-reduced-motion:reduce){.fi-copy > .fi-copy-panel > *,.fi-copy .feel-ch{transition-duration:.01ms!important;transition-delay:0s!important;transform:none!important}}
`;
let textOn = false, varsKey = '';
function applyVars() {
  const c = cfg(), r = document.documentElement.style;
  const key = [c.textMs, c.textDelay, c.textStagger, c.outMs].join('|');
  if (key === varsKey) return; varsKey = key;
  r.setProperty('--feel-ms', String(clamp(+c.textMs || 1380, 200, 4000))); r.setProperty('--feel-delay', String(clamp(+c.textDelay, 0, 3000) || 0));
  r.setProperty('--feel-stagger', String(clamp(+c.textStagger, 0, 800) || 0)); r.setProperty('--feel-out', String(clamp(+c.outMs || 300, 30, 2000)));
}
/* wrap the heading letters (random order delays); the heading keeps one aria-label */
export function splitHeadings(root = document) {
  let n = 0;
  for (const h of root.querySelectorAll('.fi-copy > .fi-copy-panel > h1:not([data-feel]), .fi-copy > .fi-copy-panel > h2:not([data-feel])')) {
    h.dataset.feel = '1'; h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    const chars = [];
    for (const line of [...h.children]) {
      const text = line.textContent; line.textContent = '';
      text.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { line.append(document.createTextNode(' ')); return; }
        const w = document.createElement('span'); w.className = 'feel-w'; w.setAttribute('aria-hidden', 'true');
        for (const ch of part) { const s = document.createElement('span'); s.className = 'feel-ch'; s.textContent = ch; chars.push(s); w.append(s); }
        line.append(w);
      });
    }
    const order = chars.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    chars.forEach((s, i) => s.style.setProperty('--d', (order[i] / Math.max(1, chars.length - 1)).toFixed(3)));
    n++;
  }
  return n;
}
export function installText() {
  if (classic || textOn || typeof document === 'undefined') return; textOn = true;
  const style = document.createElement('style'); style.id = 'feel-text'; style.textContent = TEXT_CSS; document.head.append(style);
  applyVars(); setInterval(applyVars, 400);
  const tryOnce = () => splitHeadings();
  if (!tryOnce()) { const mo = new MutationObserver(() => { if (tryOnce()) mo.disconnect(); }); mo.observe(document.documentElement, { childList: true, subtree: true }); }
}

/* ---- dissolve: a one-shot clock; main.js owns the ShaderPass and calls FEEL.frame(now) each frame ---- */
const bez = (x1, y1, x2, y2) => t => { let lo = 0, hi = 1; for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2, x = 3 * (1 - m) * (1 - m) * m * x1 + 3 * (1 - m) * m * m * x2 + m * m * m; if (x < t) lo = m; else hi = m; } const m = (lo + hi) / 2; return 3 * (1 - m) * (1 - m) * m * y1 + 3 * (1 - m) * m * m * y2 + m * m * m; };
const dissolveCurve = bez(...DISSOLVE_EASE);
let pass = null, t0 = -1, lastCut = -1e9, strengthNow = 1;
FEEL.attachPass = p => { pass = p; p.enabled = false; return FEEL; };
/* ask for a dissolve (chapter change, bridge open / close, world open / close). Debounced; nothing while booting. */
FEEL.cut = (why = '', scale = 1) => {
  if (classic || !pass) return false;
  const c = cfg(), ms = +c.dissolveMs, now = performance.now();
  if (!(ms > 0) || !(+c.dissolve > 0) || now - lastCut < 700) return false;
  if (typeof document !== 'undefined' && !document.body.classList.contains('is-ready')) return false;
  lastCut = now; t0 = now; strengthNow = (+c.dissolve) * scale; FEEL.lastCut = { why, at: Math.round(now) };
  return true;
};
FEEL.frame = (now = performance.now()) => {
  if (!pass) return;
  if (t0 < 0) { if (pass.enabled) pass.enabled = false; return; }
  const ms = Math.max(50, +cfg().dissolveMs || 875), u = (now - t0) / ms;
  if (u >= 1) { t0 = -1; pass.enabled = false; return; }
  pass.enabled = true;
  pass.uniforms.uP.value = dissolveCurve(Math.max(0, u)); pass.uniforms.uK.value = strengthNow; pass.uniforms.uAspect.value = innerWidth / Math.max(1, innerHeight);
};
FEEL.dissolveShader = {
  uniforms: { tDiffuse: { value: null }, uP: { value: 0 }, uK: { value: 1 }, uAspect: { value: 1.6 } },
  vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  /* the measured curves: uMaxDistort 1.43 → 0.13 (ease-out), bend −0.05 → −0.98, vignette radius .20 → .40, a dark dip around 250–400 ms
     (p ≈ .3–.45 of the clock), bloom radius up; strength uK scales all of it (0.5 = half) */
  fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uP, uK, uAspect;
    void main(){
      vec2 c = vUv - .5; float r = length(c * vec2(uAspect, 1.));
      float env = sin(3.14159265 * clamp(uP, 0., 1.));
      float dist = (1. - uP) * (1. - uP);
      vec2 off = c * (0.05 * dist * uK * (1. + 2.5 * r * r));
      vec3 col = vec3(texture2D(tDiffuse, vUv - off * 1.30).r, texture2D(tDiffuse, vUv - off).g, texture2D(tDiffuse, vUv - off * .70).b);
      float dip = pow(env, 1.7) * .55 * uK;
      float vig = smoothstep(.20 + .35 * uP, 1.05, r) * env * .45 * uK;
      col = mix(col, col * vec3(.82, .9, 1.0) * .35, clamp(dip + vig, 0., .9));
      col += vec3(.04, .07, .12) * env * uK * (1. - r);
      gl_FragColor = vec4(col, 1.);
    }`
};
/* watch the places that tell us a cut happened */
export function installCuts() {
  if (classic || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  new MutationObserver(() => FEEL.cut('chapter')).observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-chapter'] });
  let portfolio = document.body.classList.contains('is-portfolio');
  new MutationObserver(() => { const on = document.body.classList.contains('is-portfolio'); if (on !== portfolio) { portfolio = on; FEEL.cut(on ? 'cards in' : 'cards out', .8); } }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const hook = () => { const w = document.getElementById('fiWorld'); if (!w) return false; let open = w.classList.contains('is-open'); new MutationObserver(() => { const o = w.classList.contains('is-open'); if (o !== open) { open = o; FEEL.cut(o ? 'world in' : 'world out', .8); } }).observe(w, { attributes: true, attributeFilter: ['class'] }); return true; };
  if (!hook()) { const mo = new MutationObserver(() => { if (hook()) mo.disconnect(); }); mo.observe(document.documentElement, { childList: true, subtree: true }); }
}
if (!classic && typeof document !== 'undefined') installText();
