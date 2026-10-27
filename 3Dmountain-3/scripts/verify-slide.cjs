const {chromium}=require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const output=path.resolve(__dirname,'../.qa/slide-reference');
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[],warnings=[],responses=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)responses.push([r.status(),r.url()]);});
  await page.goto(process.argv[2],{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.slideDemo?.getState().ready,{timeout:20000});
  for(const [name,p] of [['entry',.04],['spiral-front',.21],['orbit',.27],['spiral-head',.38],['exit',.52],['unfold',.72],['grid',1]]){
    await page.evaluate(v=>window.slideDemo.seek(v),p);
    await page.screenshot({path:path.join(output,'qa-'+name+'.jpg'),type:'jpeg',quality:82});
  }
  await page.evaluate(()=>window.slideDemo.seek(.3));
  await page.mouse.move(700,450);await page.mouse.wheel(0,500);
  await page.waitForTimeout(600);
  const wheel=await page.evaluate(()=>window.slideDemo.getState());
  await page.getByRole('button',{name:'GRID',exact:true}).click();
  await page.waitForTimeout(1500);
  const grid=await page.evaluate(()=>window.slideDemo.getState());
  await page.getByRole('button',{name:'SPIRAL',exact:true}).click();
  await page.waitForTimeout(1200);
  const orbit=await page.evaluate(()=>window.slideDemo.getState());
  const helix=await page.evaluate(()=>{
    const start=slideDemo.pathPoint(0),nextTurn=slideDemo.pathPoint(Math.PI*2);
    return {heightDifference:Math.abs(start[1]-nextTurn[1]),path:slideDemo.getPath()};
  });
  await page.mouse.move(700,450);await page.mouse.down();await page.mouse.move(1000,450,{steps:12});await page.mouse.up();
  await page.screenshot({path:path.join(output,'qa-drag.png')});
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>window.slideDemo.seek(.3));await page.screenshot({path:path.join(output,'qa-mobile.png')});
  await page.evaluate(()=>window.slideDemo.seek(1));await page.screenshot({path:path.join(output,'qa-mobile-grid.png')});
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.slideDemo?.getState().ready);
  const reduced=await page.evaluate(()=>window.slideDemo.getState());
  console.log(JSON.stringify({errors,warnings,responses,wheel,grid,orbit,reduced,helix},null,2));
  await browser.close();
  if(errors.length||responses.length||wheel.progress<=.3||!grid.grid||orbit.grid||reduced.playing||helix.heightDifference<3)process.exitCode=1;
})();
