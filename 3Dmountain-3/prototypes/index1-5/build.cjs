/* index1-5 only. Run: node prototypes/index1-5/build.cjs */
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(__dirname,'js');
const version='i15-'+Date.now().toString(36);
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const src=n=>read(path.join(ROOT,'js',n));
const LOCAL=new Set(['main.js','water-journey-scene-463.js','water-canyon-watershed-463.js','water-logo-drops.js','water-logo-letters.js','water-logo-reference-glass.js','index1-5-terrain.js','highland-material.js','follow-light-lines.js','alpine-cloud-banks.js','finnovation-interface.js']);
const rewire=s=>s.replace(/(from\s+|import\(\s*)'\.\/([^'?]+)(\?[^']*)?'/g,(m,p,file,q)=>LOCAL.has(file)?`${p}'./${file}?v=${version}'`:`${p}'../../../js/${file}${q||''}'`);
function once(s,a,b){if(s.split(a).length!==2)throw Error('index1-5 build anchor '+a);return s.replace(a,b);}
let main=src('main.js'),journey=src('water-journey-scene-463.js'),watershed=src('water-canyon-watershed-463.js'),html=read(path.join(ROOT,'index1-5.html'));
({main,html}=require('./style-build.cjs')({main,html}));
({main,journey,watershed}=require('./alpine-shape-build.cjs')({main,journey,watershed}));
({journey,watershed}=require('./material-build.cjs')({journey,watershed}));
({main,journey}=require('./lightflow-build.cjs')({main,journey}));
({journey}=require('./clouds-build.cjs')({journey}));
({main,journey}=require('./alpine-light-build.cjs')({main,journey}));
let ui;({main,ui}=require('./cards-bridge-build.cjs')({main}));
let extra;({main,journey,watershed,html,extra}=require('./alpine-team-build.cjs')({main,journey,watershed,html}));for(const f of Object.keys(extra))LOCAL.add(f);
main=main.replaceAll('finnovation-look-v2','finnovation-index1-5-look-v2');
let drops=read(path.join(__dirname,'../highland-1-4-ascent/js/water-logo-drops.js'));
drops=once(drops,'  function loadAssets() {','  function loadAssets() {\n    if (config.noPhotos) return Promise.resolve([]);');
drops=once(drops,'if (!delivering) loadAssets();','if (!delivering && !C.noPhotos) loadAssets();');
drops=once(drops,'u.uDevelop.value = water ? 0 :','u.uDevelop.value = water || C.noPhotos ? 0 :');
let letters=read(path.join(__dirname,'../highland-1-4-ascent/js/water-logo-letters.js')),glass=read(path.join(__dirname,'../highland-1-4-ascent/js/water-logo-reference-glass.js'));
// optional opening helpers (2026-10-23): drops look + brightness of chapters 1-2, the liquid letters' water entrance.
// each: ({main,drops,letters,glass,html,extra}) => the same (+ optional extra:{file:source} local modules). extra = the local modules so far
// (2026-10-24: world-logo-build.cjs, right after world-ocean-build, patches extra['finnovation-world.js'] in place and ships world-logo*.js)
// bead-life (2026-10-24): the dispersal's beads wear the hero's moving sheen/iris and breath; needs opening-drops' tuner group first.
for(const n of ['opening-drops-build.cjs','bead-life-build.cjs','opening-warm-build.cjs','letters-entrance-build.cjs','logo-look-build.cjs','opening-world-build.cjs','world-ocean-build.cjs','world-logo-build.cjs','world-principles-build.cjs','section-motion-build.cjs','valley-polish-build.cjs','valley-scene-build.cjs','user-preset-build.cjs','daylight-build.cjs','light-specks-build.cjs','world-daylight-off-build.cjs','logo-panel-build.cjs','forward-mosaic-build.cjs','world-dive-fx-build.cjs','opening-refinement-build.cjs','motion-polish-build.cjs','opening-sea-depth-build.cjs','wordmark-position-build.cjs','water-rise-build.cjs','direct-logo-zoom-build.cjs','droplet-coherence-build.cjs','opening-lunge-blur-build.cjs','mobile-runtime-build.cjs','mobile-touch-build.cjs','mobile-performance-build.cjs','world-mobile-performance-build.cjs','mobile-detail-build.cjs','unified-grain-build.cjs','water-tone-build.cjs']){if(!fs.existsSync(path.join(__dirname,n)))continue;const r=require('./'+n)({main,drops,letters,glass,html,extra,journey});({main,drops,letters,glass,html}=r);if(r.journey)journey=r.journey;if(r.extra)for(const [k,v]of Object.entries(r.extra)){extra[k]=v;LOCAL.add(k);}}
// 2026-10-26: boot, firstpass and cover are OFF by default (their bisect showed timing-dependent frame differences we could not certify);
// PERF_ON=boot,firstpass,cover switches them on. cpu and phone (inert) run as usual.
const PERF_DEFAULT_OFF=['perf-boot','perf-firstpass','perf-cover'];
const perfOn=n=>!PERF_DEFAULT_OFF.some(k=>n.includes(k))||(process.env.PERF_ON||'').split(',').some(k=>k&&n.includes(k));
// 2026-10-25 optimisation team: one helper file per work stream, run last. PERF_ONLY=<stream> builds with just that stream (e.g. boot), PERF_OFF=a,b leaves streams out;
// a helper that throws is skipped with a warning (the snapshot is restored), so one unfinished file cannot break another's build.
for(const n of ['perf-boot-build.cjs','perf-firstpass-build.cjs','perf-cover-build.cjs','perf-phone-build.cjs','perf-cpu-build.cjs']){
 if(!fs.existsSync(path.join(__dirname,n)))continue;
 if(!perfOn(n))continue;
 if(process.env.PERF_ONLY&&!n.includes(process.env.PERF_ONLY))continue;
 if(process.env.PERF_OFF&&process.env.PERF_OFF.split(',').some(k=>k&&n.includes(k)))continue;
 const snap={main,drops,letters,glass,html,journey,watershed,ui,extra:{...extra}};
 try{
  const r=require('./'+n)({main,drops,letters,glass,html,extra,journey,watershed,ui});
  ({main,drops,letters,glass,html}=r);if(r.journey)journey=r.journey;if(r.watershed)watershed=r.watershed;if(r.ui)ui=r.ui;
  if(r.extra)for(const [k,v]of Object.entries(r.extra)){extra[k]=v;LOCAL.add(k);}
  console.log('perf helper applied: '+n);
 }catch(e){
  ({main,drops,letters,glass,html,journey,watershed,ui}=snap);extra=snap.extra;
  console.log('PERF HELPER SKIPPED: '+n+' — '+(e&&e.message||e));
 }
}
({html,ui}=require('./header-brand-build.cjs')({html,ui}));
html=require('./page-copy.cjs').patchHTML(html);
({html}=require('./editorial-polish-build.cjs')({html}));
extra['finnovation-world.js']=require('./site-styles-build.cjs').patchWorld(extra['finnovation-world.js']);
ui=require('./section-motion-build.cjs').patchUI(ui);
const modules={
 'main.js':main,'water-journey-scene-463.js':journey,'water-canyon-watershed-463.js':watershed,
 'water-logo-drops.js':drops,'finnovation-interface.js':ui,...extra,
 'water-logo-letters.js':letters,
 'water-logo-reference-glass.js':glass,
};
for(const [name,source]of Object.entries(modules))fs.writeFileSync(path.join(OUT,name),'/* index1-5 generated by prototypes/index1-5/build.cjs */\n'+rewire(source));
for(const name of ['index1-5-terrain.js','highland-material.js','follow-light-lines.js','alpine-cloud-banks.js']){
 const file=path.join(OUT,name);fs.writeFileSync(file,rewire(read(file)));
}
html=html.replace(/(<script type="module" id="journeyModule" src=")[^"]+/,`$1prototypes/index1-5/js/main.js?v=${version}`);
html=html.replace(/(<link rel="modulepreload" href=")(?:js\/main\.js|prototypes\/index1-5\/js\/main\.js)(?:\?[^"]*)?/,`$1prototypes/index1-5/js/main.js?v=${version}`);
html=html.replace(/prototypes\/index1-5\/index1-5.css(?:\?[^"']*)?/,`prototypes/index1-5/index1-5.css?v=${version}`);
html=html.split('alpine-ui.js?v=VERSION').join('alpine-ui.js?v='+version).replace(/alpine-ui.js?v=i15-[0-9a-z]+/g,'alpine-ui.js?v='+version);
fs.writeFileSync(path.join(ROOT,'index1-5.html'),html);
console.log('Built '+version+': index1-5 only; alpine ridges, rock and cloud banks; river corridor retained.');
