const {chromium}=require('C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path');
const out='C:/Users/qq763/Downloads/Sweet-Potato-ThreeJS-20261022';
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
  const results=[];
  for(const mode of process.argv.includes('--full')?['desktop','mobile','reduced']:['desktop']){
    const page=await browser.newPage({viewport:mode==='mobile'?{width:390,height:844}:{width:1440,height:1200},deviceScaleFactor:1,reducedMotion:mode==='reduced'?'reduce':'no-preference',acceptDownloads:true});
    const errors=[],httpErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)httpErrors.push(r.url())});
    await page.goto('http://127.0.0.1:5614/prototypes/sweet-potato-study-20261022/',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__POTATO_STUDY__?.ready||window.__POTATO_STUDY__?.failure,{},{timeout:60000});await page.waitForTimeout(500);
    await page.screenshot({path:path.join(out,'preview',`${mode}-front.png`)});
    await page.locator('#compare').click();await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'preview',`${mode}-comparison.png`)});
    await page.locator('#compare').click();await page.locator('#back').click();await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'preview',`${mode}-back.png`)});
    await page.locator('#front').click();await page.locator('#skin').click();await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'preview',`${mode}-generated-skin.png`)});await page.locator('#skin').click();
    await page.locator('#rotate').click();const before=await page.evaluate(()=>window.__POTATO_STUDY__.camera.position.toArray());await page.waitForTimeout(550);const after=await page.evaluate(()=>window.__POTATO_STUDY__.camera.position.toArray());await page.locator('#rotate').click();
    let downloadSize=0;
    if(mode==='desktop'){
      const waiting=page.waitForEvent('download');await page.locator('#export').click();const download=await waiting;
      await download.saveAs(path.join(out,'sweet-potato-photo-aligned.glb'));downloadSize=(await fs.stat(path.join(out,'sweet-potato-photo-aligned.glb'))).size;
      await page.locator('#skin').click();const waiting2=page.waitForEvent('download');await page.locator('#export').click();const generated=await waiting2;await generated.saveAs(path.join(out,'sweet-potato-generated-skin.glb'));await page.locator('#skin').click();
    }
    const stats=await page.evaluate(()=>window.__POTATO_STUDY__.stats());const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    results.push({mode,stats,rotates:JSON.stringify(before)!==JSON.stringify(after),overflow,downloadSize,errors,httpErrors});console.log(JSON.stringify(results.at(-1)));await page.close();
  }
  await browser.close();await fs.writeFile(path.join(out,'preview/qa-results.json'),JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
