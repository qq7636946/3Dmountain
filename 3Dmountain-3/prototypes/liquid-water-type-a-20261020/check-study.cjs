// Read-only browser checks. Outputs screenshots/report to the isolated QA directory.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname,'../..');
const out = path.join(root,'.qa/water-a-20261020');
fs.mkdirSync(out,{recursive:true});
const url = process.env.WATER_A_URL || 'http://127.0.0.1:5611/prototypes/liquid-water-type-a-20261020/';
const pause = async page => {
  const frame = await page.evaluate(()=>window.__WATER_A_STUDY__.stats().frameCount);
  await page.waitForFunction(frame=>window.__WATER_A_STUDY__.stats().frameCount>=frame+2,frame,{timeout:30000});
};
(async()=>{
  const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const results=[];
  try {
    for(const [name,width,height] of [['desktop',1440,900],['tablet',834,1112],['phone',390,844]]) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:2,reducedMotion:'reduce'});
      const page=await context.newPage();const errors=[];const warnings=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
      await page.goto(url,{waitUntil:'networkidle',timeout:90000});
      await page.waitForFunction(()=>window.__WATER_A_STUDY__?.ready || window.__WATER_A_STUDY__?.error,{},{timeout:90000});
      const loaded=await page.evaluate(()=>({ready:window.__WATER_A_STUDY__.ready,error:window.__WATER_A_STUDY__.error}));
      if(!loaded.ready)throw new Error(JSON.stringify(loaded));
      const shots=[];
      for(const view of ['front','quarter','side']) {
        await page.evaluate(view=>window.__WATER_A_STUDY__.setView(view),view);await pause(page);
        const filename=`${name}-${view}.png`;await page.screenshot({path:path.join(out,filename),scale:'css'});shots.push(filename);
      }
      await page.evaluate(()=>{const a=window.__WATER_A_STUDY__;a.setView('quarter');a.setBackground('dark');});await pause(page);
      await page.screenshot({path:path.join(out,`${name}-dark.png`),scale:'css'});
      await page.evaluate(()=>{const a=window.__WATER_A_STUDY__;a.setBackground('light');a.setView('front');a.setPattern(true);});await pause(page);
      await page.screenshot({path:path.join(out,`${name}-refraction.png`),scale:'css'});
      const before=await page.evaluate(()=>window.__WATER_A_STUDY__.stats());
      const finite=await page.evaluate(()=>{
        const a=window.__WATER_A_STUDY__,positions=[];
        a.model.traverse(o=>{if(o.isMesh)positions.push(...Array.from(o.geometry.attributes.position.array).filter(x=>!Number.isFinite(x)));});
        return positions.length===0 && a.camera.matrixWorld.elements.every(Number.isFinite);
      });
      const disposed=await page.evaluate(()=>window.__WATER_A_STUDY__.dispose());
      const canvasesAfterDispose=await page.locator('#stage canvas').count();
      await page.evaluate(()=>window.__WATER_A_STUDY__.remount());
      await page.waitForFunction(()=>window.__WATER_A_STUDY__.ready);
      await pause(page);
      const remount=await page.evaluate(()=>window.__WATER_A_STUDY__.stats());
      results.push({name,width,height,errors,warnings,loaded,finite,shots,before,disposed,canvasesAfterDispose,remount});
      console.log(name,JSON.stringify({errors,finite,vertices:before.modelVertices,triangles:before.triangles,drawCalls:before.drawCalls,disposed,canvasesAfterDispose}));
      await context.close();
    }
    const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
    const page=await context.newPage();
    await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__WATER_A_STUDY__?.ready);
    await page.evaluate(()=>window.__WATER_A_STUDY__.setRotation(true));
    const start=await page.evaluate(()=>window.__WATER_A_STUDY__.modelGroup.rotation.y);await page.waitForTimeout(1000);
    const end=await page.evaluate(()=>window.__WATER_A_STUDY__.modelGroup.rotation.y);
    await page.evaluate(()=>window.__WATER_A_STUDY__.setRotation(false));
    const stop=await page.evaluate(()=>window.__WATER_A_STUDY__.modelGroup.rotation.y);await page.waitForTimeout(400);
    const stopEnd=await page.evaluate(()=>window.__WATER_A_STUDY__.modelGroup.rotation.y);
    results.push({name:'turntable',start,end,rotates:end>start,pauseStable:stop===stopEnd});
    await context.close();
  } finally {
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({url,renderer:'Headless Chrome SwiftShader; no physical GPU benchmark',results},null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
