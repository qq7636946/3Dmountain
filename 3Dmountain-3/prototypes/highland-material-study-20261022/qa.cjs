const { chromium }=require('C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path');
const output='C:/Users/qq763/Downloads/Finnovation-Highland-Study-20261022/preview';
const base='http://127.0.0.1:5613/prototypes/highland-material-study-20261022/';
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
  const results=[];
  const modes=process.argv.includes('--full')?['desktop','tablet','mobile','reduced','missing']:['desktop'];
  for(const mode of modes){
    const page=await browser.newPage({viewport:mode==='mobile'?{width:390,height:844}:mode==='tablet'?{width:834,height:1112}:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:mode==='reduced'?'reduce':'no-preference'});
    const errors=[],httpErrors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    page.on('response',r=>{if(r.status()>=400)httpErrors.push(r.url())});
    if(mode==='missing')await page.route('**/cliff_side-normal-*.webp',r=>r.abort());
    await page.goto(base,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__HIGHLAND_STUDY__?.ready||window.__HIGHLAND_STUDY__?.failure,{},{timeout:60000});
    await page.waitForTimeout(1200);
    await page.evaluate(()=>window.__HIGHLAND_STUDY__.pause?.());
    await page.screenshot({path:path.join(output,`${mode}-close.png`)});
    const close=await page.evaluate(()=>window.__HIGHLAND_STUDY__.stats?.()||window.__HIGHLAND_STUDY__);
    const motion=await page.evaluate(async()=>{
      const a=window.__HIGHLAND_STUDY__,w=a.scene.children.find(o=>o.isWater);
      const before=w.material.uniforms.time.value;a.resume();await new Promise(r=>setTimeout(r,220));
      const after=w.material.uniforms.time.value;a.pause();await new Promise(r=>setTimeout(r,150));
      return {advances:after>before,stops:w.material.uniforms.time.value===after};
    });
    await page.locator('[data-view="aerial"]').click();
    await page.waitForTimeout(3500);
    await page.screenshot({path:path.join(output,`${mode}-aerial.png`)});
    const aerial=await page.evaluate(()=>window.__HIGHLAND_STUDY__.stats?.());
    await page.locator('#light').click();await page.waitForTimeout(300);
    if(mode==='desktop')await page.screenshot({path:path.join(output,`${mode}-overcast.png`)});
    await page.locator('#info').click();
    const controls={infoVisible:await page.locator('#details').isVisible(),lightingPressed:await page.locator('#light').getAttribute('aria-pressed'),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)};
    await page.keyboard.press('Escape');
    await page.locator('[data-view="close"]').click();await page.waitForTimeout(3000);
    const returned=await page.evaluate(()=>window.__HIGHLAND_STUDY__.stats?.());
    const gpu=await page.evaluate(()=>{const gl=window.__HIGHLAND_STUDY__.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'not exposed';});
    results.push({mode,close,aerial,returned,controls,motion,gpu,errors,httpErrors});
    console.log(JSON.stringify(results.at(-1)));
    await page.close();
  }
  await browser.close();await fs.writeFile(path.join(output,'qa-results.json'),JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
