'use strict';
/* Five public sections, with Flow's original ocean panels kept as Why Us
   and the separate WebGL card strip kept as Latest News. */
const fs=require('fs'),path=require('path');
module.exports=function(){
  const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
  let html=read(path.join(root,'index1-5.html'));
  if(!html.includes('data-site-sections="five"'))return false;
  const source=path.join(root,'prototypes/index1-5/js'),out=path.join(__dirname,'js');
  const version='flow-'+Date.now().toString(36);
  const sea=require('./sea-sections-build.cjs');
  const motion=require('./copy-motion-build.cjs');
  const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Flow five-section anchor: '+a.slice(0,90));return s.replace(a,()=>b);};
  const copied=['main.js','finnovation-interface.js','finnovation-world.js','world-ocean.js','world-logo.js','world-principles.js','world-dive-fx.js','site-sections.js','transition-details.js'];
  const local=new Set(copied);
  const rewire=s=>s.replace(/(from\s+|import\(\s*|sliderUrl:\s*)'\.\/([\w.-]+\.js)(\?[^']*)?'/g,(m,lead,file,q)=>local.has(file)?`${lead}'./${file}?v=${version}'`:`${lead}'../../index1-5/js/${file}${q||''}'`).replace(/new URL\('\.\.\/assets\//g,"new URL('../../index1-5/assets/").replace(/from '\.\.\/copy-motion\.js(?:\?[^']*)?'/g,`from '../copy-motion.js?v=${version}'`);
  let main=read(path.join(source,'main.js'));
  const preset=JSON.parse(read(path.join(__dirname,'look-preset.json')));
  main=once(main,'getSceneDaylight, setSceneTime, suppressSceneDaylight','getSceneDaylight, setSceneTime as setTimedSceneLight, suppressSceneDaylight');
  main=once(main,'      configureSceneDaylight(CONFIG);','      /* Flow daylight defaults follow the client preset. */');
  const code=Object.entries(preset).map(([key,value])=>'      Object.assign(CONFIG['+JSON.stringify(key)+'] ||= {}, '+JSON.stringify(value)+');').join('\n');
  main=once(main,'      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',`      var flowFieldOverride = { ...CONFIG.field };
      function setSceneTime(hour) {
        if (flowFieldOverride) Object.assign(flowFieldOverride, CONFIG.field);
        const light = setTimedSceneLight(hour);
        if (flowFieldOverride) Object.assign(CONFIG.field, flowFieldOverride);
        return light;
      }
${code}
      Object.assign(FRAME_TIERS.wide, { fov: CONFIG.camera.fov, ty: CONFIG.camera.ty, dropY: CONFIG.drop.y });
      if (frameTier() !== 'wide') applyFrameTier(true);
      configureSceneDaylight(CONFIG);
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
  if(preset.logoModel){const model=main.match(/^      DEFAULT_CONFIG\.logoModel = .*;$/m)?.[0];if(model)main=once(main,model,'      DEFAULT_CONFIG.logoModel = JSON.parse(JSON.stringify(CONFIG.logoModel));');}
  main=once(main,'world = module.mountWorld({ root:','world = module.mountWorld({ syncSceneTime: setSceneTime, root:');
  main="import { paintJourneyTransition } from './transition-details.js';\n"+main;
  main=once(main,'        const time = sceneTime;\n','        const time = sceneTime;\n        paintJourneyTransition({ reduced: reduceMotion, worldOpen: !!world?.open, drop: dropTransition.progress, flight: logoFlight.t, mix: journey.mix });\n');
  main=sea.restoreMain(main);
  main=require('./gate-performance-build.cjs').patchMain(main);
  const water=require('./deep-water-build.cjs');main=water.patchGullControl(main);
  let world=require('./closing-logo-build.cjs').patchWorld(motion.patchWorld(sea.restoreWorld(water.patchWorld(read(path.join(source,'finnovation-world.js')))),version));
  world=once(world,'part: smooth(.5, .97, c),','part: smooth(.30, .97, c),');
  world=once(world,'reveal: smooth(.5, 1, c),','reveal: smooth(.30, 1, c),');
  const modules={'main.js':main,'finnovation-interface.js':motion.patchInterface(read(path.join(source,'finnovation-interface.js')),version),'finnovation-world.js':world,
    'world-ocean.js':require('./ocean-spacing-build.cjs').patchOcean(sea.restoreOcean(water.patchOcean(read(path.join(source,'world-ocean.js'))))),
    'world-dive-fx.js':sea.restoreDive(read(path.join(source,'world-dive-fx.js'))),
    'site-sections.js':read(path.join(__dirname,'site-sections.js'))};
  // Softer frost and a narrow inner meniscus on the existing mosaic pass.
  // No extra render target or texture sample; zero envelope is still clear.
  modules['world-dive-fx.js']=once(modules['world-dive-fx.js'],'  col *= 1.0 + (mr.z - 0.5) * 0.6 * mwp;','  col *= 1.0 + (mr.z - 0.5) * 0.28 * mwp;');
  modules['world-dive-fx.js']=once(modules['world-dive-fx.js'],'  col *= 1.0 - 0.3 * uE.x * mwp * medge;','  col *= 1.0 - 0.16 * uE.x * mwp * medge;');
  modules['world-dive-fx.js']=once(modules['world-dive-fx.js'],'  // a thin-film rainbow riding the front',`  float innerRim = exp(-pow((min(me.x,me.y)*uRes.y-2.4)/1.8,2.0));
  float softGlint = .55 + .45*sin((mlp.x+mlp.y)*11.0+uA.x*3.14159);
  col += vec3(.88,.96,1.0)*innerRim*mwp*uE.x*softGlint*.065;
  // a thin-film rainbow riding the front`);
  for(const file of copied)if(!modules[file])modules[file]=read(file==='transition-details.js'?path.join(__dirname,file):path.join(source,file));
  let alpine=read(path.join(root,'prototypes/index1-5/alpine-ui.js'));
  alpine=once(alpine,"  makePin('peak', { id: 'confluence', name: 'CONFLUENCE', num: '恒灝創新', at: { x: main.x, y: 0, z: zc }, maxLead: 54, phone: true });",'');
  alpine=require('./strategy-labels-build.cjs').patchAlpine(alpine);
  const mainRef=/prototypes\/index1-5\/js\/main\.js\?v=[\w-]+/g;
  if((html.match(mainRef)||[]).length!==2)throw Error('Flow five sections: main references changed');
  html=html.replace(mainRef,`prototypes/index1-5-flow/js/main.js?v=${version}`).replace('<title>','<title>［Flow］');
  html=html.replace(/prototypes\/index1-5\/alpine-ui\.js\?v=[\w-]+/,`prototypes/index1-5-flow/js/alpine-ui.js?v=${version}`);
  html=html.replace('</head>',['flow.css','visual-polish.css','transition-details.css','title-polish.css','strategy-labels.css','editorial-type.css'].map(file=>`  <link rel="stylesheet" href="prototypes/index1-5-flow/${file}?v=${version}">`).join('\n')+'\n</head>');
  html=require('../index1-5/five-sections-build.cjs').patchHTML(html);
  html=sea.restoreHTML(html);
  html=require('./closing-logo-build.cjs').patchHTML(html);
  html=require('./editorial-type-build.cjs').patchHTML(html);
  html=motion.patchHTML(html,version);
  html=require('./gate-performance-build.cjs').patchHTML(html);
  fs.mkdirSync(out,{recursive:true});
  for(const [file,text]of Object.entries(modules))fs.writeFileSync(path.join(out,file),file==='main.js'?rewire(text).replace(/[ \t]+$/gm,'').trimEnd()+'\n':rewire(text));
  fs.writeFileSync(path.join(out,'alpine-ui.js'),alpine);
  html=require('../index1-5/startup-preload.cjs').addStartupPreloads(html,root);
  fs.writeFileSync(path.join(root,'index1-5-flow.html'),html);
  console.log('Built '+version+': five public sections, original Flow preset.');
  return true;
};
