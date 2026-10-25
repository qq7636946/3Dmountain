/* Local to index1-5. The fine luminous flecks share one live config in chapters 1/2 and the closing lake. */
const fs=require('fs'),path=require('path');
function patchMain(main){
  if(main.includes('/* LIGHT_SPECK_CONFIG */'))return main;
  const p=(a,b)=>{if(main.split(a).length!==2)throw Error('light-specks anchor '+a);main=main.replace(a,()=>b);};
  p("    import * as THREE from 'three';","    import * as THREE from 'three';\n    import { LIGHT_SPECK_DEFAULTS, LIGHT_SPECK_ROWS } from './light-specks.js';");
  p('uniforms: montisEnvUniforms, config: CONFIG, renderer,', 'uniforms: montisEnvUniforms, config: CONFIG, renderer, surface: { uniforms: openingSeaMaterial.uniforms, glsl: SEA_GLSL, material: openingSeaMaterial },');
  p('      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',`      /* LIGHT_SPECK_CONFIG */
      CONFIG.lightSpecks = { ...LIGHT_SPECK_DEFAULTS };
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
  p("          ['全站太陽／場景時間 Scene Time', DAYLIGHT_ROWS],","          ['水面亮光點 Light Specks', LIGHT_SPECK_ROWS],\n          ['全站太陽／場景時間 Scene Time', DAYLIGHT_ROWS],");
  p("const isLogo = groupKey === 'sceneDaylight' ||","const isLogo = groupKey === 'lightSpecks' || groupKey === 'sceneDaylight' ||");
  p('        syncWorkshop = () => syncTunerValues();',`        const lightSpeckGroup = tunerBody.querySelector('[data-title="水面亮光點 Light Specks"]');
        if (lightSpeckGroup) tunerBody.prepend(lightSpeckGroup);
        syncWorkshop = () => syncTunerValues();`);
  return main;
}
module.exports=({main,drops,letters,glass,html})=>({main:patchMain(main),drops,letters,glass,html,extra:{'light-specks.js':fs.readFileSync(path.join(__dirname,'light-specks.js'),'utf8')}});
module.exports.patchMain=patchMain;
