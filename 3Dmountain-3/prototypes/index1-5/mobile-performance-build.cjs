/* Main scene budget for the active page; no desktop or alternate-page downgrade. */
const fs = require('node:fs'), path = require('node:path');
const once = (source, anchor, replacement, label) => {
  if (source.split(anchor).length !== 2) throw Error('Mobile performance anchor: ' + label);
  return source.replace(anchor, () => replacement);
};
function patchMain(source) {
  if (source.includes('/* MOBILE_RENDER_BUDGET */')) return source;
  source = source.replace(/\r\n/g, '\n');
  const p = (anchor, replacement, label) => { source = once(source, anchor, replacement, label); };
  p("    import * as THREE from 'three';", "    import * as THREE from 'three';\n    import { selectMobileRenderBudget } from './mobile-render-budget.js';", 'budget import');
  p("      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;", `      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      /* MOBILE_RENDER_BUDGET */
      const mobileRenderBudget = selectMobileRenderBudget({
        active: document.documentElement.matches('[data-look="index1-5"]:not([data-opening-refinement])'),
        width: innerWidth, screenWidth: screen.width || innerWidth, screenHeight: screen.height || innerHeight,
        coarse: matchMedia('(pointer: coarse)').matches
      });`, 'budget selection');
  const dprAnchor = 'Math.min(devicePixelRatio, 1.65)';
  if (source.split(dprAnchor).length !== 3) throw Error('Mobile performance: initial and resize DPR anchors');
  source = source.replaceAll(dprAnchor, 'Math.min(devicePixelRatio, mobileRenderBudget.dpr)');
  p('renderer.shadowMap.enabled = true;', 'renderer.shadowMap.enabled = !mobileRenderBudget.mobile;', 'shadow allocation');
  p('textureWidth: 1024,', 'textureWidth: mobileRenderBudget.reflectionSize,', 'reflection width');
  p('textureHeight: 1024,', 'textureHeight: mobileRenderBudget.reflectionSize,', 'reflection height');
  p('        samples: 4\n', '        samples: mobileRenderBudget.sceneSamples\n', 'scene MSAA');
  p('      composer.addPass(bloom);', '      bloom.enabled = !mobileRenderBudget.mobile;\n      composer.addPass(bloom);', 'bloom execution');
  p('      const grainPass = new ShaderPass({', '      const grainPass = new ShaderPass({\n        defines: { MOBILE_RENDER: mobileRenderBudget.mobile ? 1 : 0 },', 'grain variant');
  p('      vec2 p=floor(gl_FragCoord.xy/max(uSize,.35));', '      #if MOBILE_RENDER == 0\n      vec2 p=floor(gl_FragCoord.xy/max(uSize,.35));', 'grain start');
  p('      c.rgb+=g*uAmount*mix(1.,.28,smoothstep(.55,1.,luma));', '      c.rgb+=g*uAmount*mix(1.,.28,smoothstep(.55,1.,luma));\n      #endif', 'grain end');
  p('createReferenceLogoGlass(THREE, { renderer, config: CONFIG.logoGlass })', 'createReferenceLogoGlass(THREE, { renderer, config: CONFIG.logoGlass, mobile: mobileRenderBudget.mobile })', 'glass budget');
  p('        const realDelta = clock.getDelta();', `        const realDelta = clock.getDelta();
        // The world has its own loop. Do not update the hidden valley, droplets,
        // particles or optical captures behind its opaque full-screen canvas.
        if (mobileRenderBudget.mobile && !manual && world?.covering && portfolio?.open) {
          animationFrame = requestAnimationFrame(tick); return;
        }`, 'covered scene suspension');
  p('window.__MONTIS_STUDY__ = {', 'window.__MONTIS_STUDY__ = { mobileRenderBudget,', 'diagnostic');
  return source;
}
function patchGlass(source) {
  if (source.includes('/* MOBILE_OPTICAL_BUDGET */')) return source;
  source = source.replace(/\r\n/g, '\n');
  const p = (anchor, replacement, label) => { source = once(source, anchor, replacement, label); };
  p('export function createReferenceLogoGlass(THREE, {renderer, config}) {', 'export function createReferenceLogoGlass(THREE, {renderer, config, mobile = false}) {\n  /* MOBILE_OPTICAL_BUDGET */', 'glass option');
  p('defines:{SAMPLES:Math.round(config.samples)},', 'defines:{SAMPLES:mobile?4:Math.round(config.samples)},', 'initial optical samples');
  p('const samples=THREE.MathUtils.clamp(Math.round(config.samples),4,12);', 'const samples=mobile?4:THREE.MathUtils.clamp(Math.round(config.samples),4,12);', 'persistent optical cap');
  p('const scale=Math.min(1.15,dpr)*Math.min(1,1440/width);', 'const scale=Math.min(mobile ? .75 : 1.15,dpr)*Math.min(1,1440/width);', 'optical capture size');
  return source;
}
module.exports = state => ({ ...state, main: patchMain(state.main), glass: patchGlass(state.glass), extra: {
  ...state.extra, 'mobile-render-budget.js': fs.readFileSync(path.join(__dirname, 'mobile-render-budget.js'), 'utf8')
} });
module.exports.patchMain = patchMain;
module.exports.patchGlass = patchGlass;
