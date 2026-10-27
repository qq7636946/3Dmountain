const path = require('node:path');
const fs = require('node:fs/promises');
const {chromium} = require(path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const label=process.argv[2]||'after', mobile=process.argv.includes('--mobile'), tablet=process.argv.includes('--tablet');
const mode=mobile?'mobile':tablet?'tablet':'desktop';
const out=path.resolve('.qa/maritime-textures');
(async()=>{
 await fs.mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist']});
 try {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:tablet?{width:1024,height:768}:{width:1440,height:900},deviceScaleFactor:1,isMobile:mobile||tablet,hasTouch:mobile||tablet});
  const errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)failed.push(r.status()+' '+r.url());});
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(t=>{if(!window.__qaFreeze)cb(t)});});
  if(process.argv.includes('--missing'))await page.route('**/images/maritime/terrain/*.webp',r=>r.abort());
  await page.goto('http://127.0.0.1:5613/index1-3-maritime.html?view=canyon&tune=0&letters=0'+(process.argv.includes('--original')?'&terrainTextures=0':'')+(process.argv.includes('--blue')?'&look=textured-blue':''),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__MONTIS_STUDY__&&document.body.classList.contains('is-ready'),null,{timeout:60000});
  await page.evaluate(async()=>{await window.__MONTIS_STUDY__.ready;await window.__MONTIS_STUDY__.canyon.textureDetail?.ready;window.__qaShift=window.__MONTIS_STUDY__.journey.progress-4.6;window.__qaFreeze=true;});
  await page.waitForTimeout(1000);
  const states=[];
  for(const [name,p] of (process.argv.includes('--hero')?[['hero',0]]:[['canyon',4.6],['ridges',7.6],['overview',11.8],['finale',13.8],['return',4.6]])) {
   const state=await page.evaluate(({p,name})=>{
    const s=window.__MONTIS_STUDY__;s.skipEntry();
    const shift=window.__qaShift;
    s.journey.progress=s.journey.target=name==='hero'?0:p+shift;s.journey.velocity=0;s.step(3,1/60);
    const c=s.canyon, meshes=[];c.scene.traverse(o=>{if(o.isMesh&&o.geometry)meshes.push({name:o.name,vertices:o.geometry.attributes.position?.count,triangles:(o.geometry.index?.count||o.geometry.attributes.position?.count)/3,finite:o.geometry.attributes.position?.array.every(Number.isFinite)&&(!o.geometry.attributes.normal||o.geometry.attributes.normal.array.every(Number.isFinite))});});
    const gl=s.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {p:s.journey.progress,shift,stats:c.stats,texture:c.textureDetail?.status,camera:c.camera.position.toArray(),finite:meshes.every(m=>Number.isFinite(m.vertices)&&m.finite),meshes,draw:s.renderer.info.render,gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable'};
   },{p,name});
   states.push({name,...state});
   await page.screenshot({path:path.join(out,`${label}-${mode}-${name}.png`)});
  }
  let interaction=null;
  if(process.argv.includes('--motion')){
   const read=()=>page.evaluate(()=>{const s=window.__MONTIS_STUDY__;return {progress:s.journey.progress,target:s.journey.target,memory:{...s.renderer.info.memory}};});
   const start=await read();
   await page.mouse.move(720,400);await page.mouse.wheel(0,650);await page.waitForTimeout(80);
   await page.evaluate(()=>window.__MONTIS_STUDY__.step(90,1/60));const forward=await read();
   await page.mouse.wheel(0,-650);await page.waitForTimeout(80);
   await page.evaluate(()=>window.__MONTIS_STUDY__.step(90,1/60));const reverse=await read();
   interaction={start,forward,reverse,forwardMoved:forward.progress>start.progress,reverseMoved:reverse.progress<forward.progress};
  }
  const report={label,mobile,tablet,errors,failed,states,interaction};
  await fs.writeFile(path.join(out,`${label}-${mode}.json`),JSON.stringify(report,null,2));
  console.log(JSON.stringify({label,mobile,errors,failed,stats:states[0].stats,texture:states[0].texture,gpu:states[0].gpu,interaction}));
  const unexpectedErrors=process.argv.includes('--missing')?errors.filter(e=>!e.includes('net::ERR_FAILED')):errors;
  if(unexpectedErrors.length||failed.length||states.some(s=>!s.finite)||(interaction&&(!interaction.forwardMoved||!interaction.reverseMoved)))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
