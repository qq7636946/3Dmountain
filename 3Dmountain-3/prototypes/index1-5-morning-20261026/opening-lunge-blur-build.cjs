/* Page-only opening shutter blur. Add it to the existing final pass before first warmup. */
const fs=require('fs'),path=require('path');
module.exports=({main,drops,letters,glass,html,extra={}})=>{
 if(main.includes('/* OPENING_LUNGE_BLUR */'))return {main,drops,letters,glass,html,extra};
 const p=(a,b)=>{if(main.split(a).length!==2)throw Error('Opening lunge build anchor: '+a.slice(0,100));main=main.replace(a,()=>b);};
 p("    import * as THREE from 'three';","    import * as THREE from 'three';\n    import { createOpeningLungeBlur, LUNGE_BLUR_DEFAULTS, LUNGE_BLUR_ROWS } from './opening-lunge-blur.js';");
 p('      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));','      CONFIG.openingLungeBlur = { ...LUNGE_BLUR_DEFAULTS };\n      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));');
 p('      composer.addPass(grainPass);',`      composer.addPass(grainPass);
      /* OPENING_LUNGE_BLUR */
      const openingLungeBlur = createOpeningLungeBlur({ pass: grainPass, camera,
        getConfig: () => CONFIG.openingLungeBlur, small: Math.min(innerWidth,innerHeight)<700, reducedMotion: reduceMotion });`);
 p("          ['水面亮光點 Light Specks', LIGHT_SPECK_ROWS],","          ['水珠動態模糊 Drops Blur', LUNGE_BLUR_ROWS],\n          ['水面亮光點 Light Specks', LIGHT_SPECK_ROWS],");
 p("const isLogo = groupKey === 'lightSpecks' ||","const isLogo = groupKey === 'openingLungeBlur' || groupKey === 'lightSpecks' ||");
 p('        renderFrame++;',`        openingLungeBlur.update({ dt: scrollDt, progress: journey.progress, velocity: journey.velocity,
          stage: dropTransition.progress, mesh: disperseMesh, hero: dropRoot, secondary: logoDrops,
          heroRadius: currentDropRadius(), heroScale: CONFIG.drop.scale, width: innerWidth, height: innerHeight });
        renderFrame++;`);
 p('window.__MONTIS_STUDY__ = {','window.__MONTIS_STUDY__ = { openingLungeBlur,');
 return {main,drops,letters,glass,html,extra:{...extra,'opening-lunge-blur.js':fs.readFileSync(path.join(__dirname,'opening-lunge-blur.js'),'utf8')}};
};
