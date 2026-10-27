const {chromium}=require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const assert=require('node:assert/strict');const fs=require('fs');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11','--enable-gpu']});try{
 const c=await b.newContext({viewport:{width:1440,height:900}}),p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 let release;const gate=new Promise(r=>release=r);await p.route('https://images.pexels.com/**',async r=>{await gate;await r.continue()});
 await p.goto('http://127.0.0.1:5211/index.html?tune=0&view=finale');await p.waitForFunction(()=>window.__MONTIS_STUDY__?.portfolio);await p.mouse.move(720,400);
 await p.mouse.wheel(0,160);await p.waitForTimeout(250);
 assert.ok(await p.evaluate(()=>window.__MONTIS_STUDY__.portfolio.pending));
 assert.equal(await p.locator('.fi-portfolio').evaluate(e=>getComputedStyle(e).opacity),'0');assert.ok(await p.locator('.fi-copy-panel.is-active').evaluate(e=>getComputedStyle(e).opacity==='1'));
 await p.mouse.wheel(0,-100);assert.equal(await p.evaluate(()=>window.__MONTIS_STUDY__.portfolio.pending),false);release();
 await p.waitForFunction(()=>window.__MONTIS_STUDY__.portfolio.ready,null,{timeout:20000});assert.equal(await p.evaluate(()=>window.__MONTIS_STUDY__.portfolio.open),false);console.log('PASS slow images keep the scene visible; reverse cancels pending entry');
 await p.keyboard.press('End');await p.waitForFunction(()=>{const s=window.__MONTIS_STUDY__;return s.journey.progress>s.journey.max-.01});
 await p.mouse.wheel(0,120);await p.waitForFunction(()=>window.__MONTIS_STUDY__.portfolio.open);
 await p.evaluate(()=>{window.samples=[];const begin=performance.now();const loop=()=>{const pf=window.__MONTIS_STUDY__.portfolio;window.samples.push({ms:performance.now()-begin,p:pf.transition,covering:pf.covering});if(performance.now()-begin<2000)requestAnimationFrame(loop)};loop()});
 const shots=[];for(const [ms,name] of [[100,'seam-100'],[160,'seam-260'],[240,'seam-500'],[650,'seam-settled']]){await p.waitForTimeout(ms);await p.screenshot({path:'.qa/portfolio-seam-20261011/'+name+'.png'});shots.push(name)}
 await p.waitForFunction(()=>window.__MONTIS_STUDY__.portfolio.covering);const samples=await p.evaluate(()=>window.samples);assert.ok(samples.every((v,i)=>!i||v.p>=samples[i-1].p));assert.ok(samples.every(v=>!v.covering||v.p===1));fs.writeFileSync('.qa/portfolio-seam-20261011/envelope.json',JSON.stringify(samples));console.log('PASS one monotonic transition envelope, covering only after full opacity');
 await p.keyboard.press('Escape');await p.waitForFunction(()=>window.__MONTIS_STUDY__.portfolio.transition===0);await p.mouse.wheel(0,120);await p.waitForFunction(()=>window.__MONTIS_STUDY__.portfolio.transition>.1);
 await p.keyboard.press('Escape');const before=await p.evaluate(()=>window.__MONTIS_STUDY__.portfolio.transition);await p.mouse.wheel(0,120);await p.waitForFunction(()=>window.__MONTIS_STUDY__.portfolio.open);const after=await p.evaluate(()=>window.__MONTIS_STUDY__.portfolio.transition);assert.ok(Math.abs(after-before)<.2,'reversal should not jump');await p.waitForFunction(()=>window.__MONTIS_STUDY__.portfolio.covering);console.log('PASS mid-transition reversal continues from current position');
 await p.keyboard.press('Home');await p.waitForTimeout(500);const overlap=await p.evaluate(()=>[...document.querySelectorAll('.fi-copy-panel:not(.is-active):not(.fi-portfolio-copy)')].filter(e=>getComputedStyle(e).visibility!=='hidden'&&+getComputedStyle(e).opacity>.05).length);assert.equal(overlap,0);assert.deepEqual(errors,[]);console.log('PASS navigation does not resurrect previous chapter copy; clean browser errors');
 await c.close();
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
