'use strict';
/* Both variants now share the requested five-section route. Flow retains its
   saved look, title treatments and projected valley labels. */
const fs=require('fs'),path=require('path');
module.exports=function(){
  const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
  let html=read(path.join(root,'index1-5.html'));
  if(!html.includes('data-site-sections="five"'))return false;
  const source=path.join(root,'prototypes/index1-5/js'),out=path.join(__dirname,'js');
  const version='flow-'+Date.now().toString(36);
  const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Flow five-section anchor: '+a.slice(0,90));return s.replace(a,()=>b);};
  const copied=['main.js','finnovation-world.js','world-ocean.js','world-logo.js','world-principles.js','world-dive-fx.js','site-sections.js','transition-details.js'];
  const local=new Set(copied);
  const rewire=s=>s.replace(/(from\s+|import\(\s*|sliderUrl:\s*)'\.\/([\w.-]+\.js)(\?[^']*)?'/g,(m,lead,file,q)=>local.has(file)?`${lead}'./${file}?v=${version}'`:`${lead}'../../index1-5/js/${file}${q||''}'`).replace(/new URL\('\.\.\/assets\//g,"new URL('../../index1-5/assets/");
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
  const water=require('./deep-water-build.cjs');main=water.patchGullControl(main);
  let world=water.patchWorld(read(path.join(source,'finnovation-world.js')));
  world=once(world,'export function mountWorld({ root,','export function mountWorld({ syncSceneTime = setSceneTime, root,');
  world=once(world,'    setSceneTime(hour);','    syncSceneTime(hour);');
  const modules={'main.js':main,'finnovation-world.js':world,'world-ocean.js':water.patchOcean(read(path.join(source,'world-ocean.js')))};
  for(const file of copied)if(!modules[file])modules[file]=read(file==='transition-details.js'?path.join(__dirname,file):path.join(source,file));
  let alpine=read(path.join(root,'prototypes/index1-5/alpine-ui.js'));
  alpine=once(alpine,"  makePin('peak', { id: 'confluence', name: 'CONFLUENCE', num: '恒灝創新', at: { x: main.x, y: 0, z: zc }, maxLead: 54, phone: true });",'');
  alpine=require('./strategy-labels-build.cjs').patchAlpine(alpine);
  const mainRef=/prototypes\/index1-5\/js\/main\.js\?v=[\w-]+/g;
  if((html.match(mainRef)||[]).length!==2)throw Error('Flow five sections: main references changed');
  html=html.replace(/<script\b[^>]*\bdata-(?:copy-layout-js|title-motion-js)\b[^>]*>[\s\S]*?<\/script>\s*/g,'').replace(/<link\b[^>]*\bdata-title-motion\b[^>]*>\s*/g,'');
  html=html.replace(mainRef,`prototypes/index1-5-flow/js/main.js?v=${version}`).replace('<title>','<title>［Flow］');
  html=html.replace(/prototypes\/index1-5\/alpine-ui\.js\?v=[\w-]+/,`prototypes/index1-5-flow/js/alpine-ui.js?v=${version}`);
  html=html.replace('</head>',['flow.css','visual-polish.css','transition-details.css','title-polish.css','title-motion.css','strategy-labels.css'].map(file=>`  <link rel="stylesheet" href="prototypes/index1-5-flow/${file}?v=${version}">`).join('\n')+`\n  <script defer src="prototypes/index1-5-flow/title-motion.js?v=${version}"></script>\n</head>`);
  html=require('../index1-5/five-sections-build.cjs').patchHTML(html);
  fs.mkdirSync(out,{recursive:true});
  for(const [file,text]of Object.entries(modules))fs.writeFileSync(path.join(out,file),file==='main.js'?rewire(text).replace(/[ \t]+$/gm,'').trimEnd()+'\n':rewire(text));
  fs.writeFileSync(path.join(out,'alpine-ui.js'),alpine);
  html=require('../index1-5/startup-preload.cjs').addStartupPreloads(html,root);
  fs.writeFileSync(path.join(root,'index1-5-flow.html'),html);
  console.log('Built '+version+': five public sections, original Flow preset.');
  return true;
};
