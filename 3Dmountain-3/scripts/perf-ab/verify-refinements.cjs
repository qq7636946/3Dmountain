// Journey input, loading and mobile layout regression checks. Run with a local base URL.
const {chromium}=require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const base=process.argv[2]||'http://127.0.0.1:5211/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11','--enable-gpu']});
 try {
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let release;const gate=new Promise(r=>release=r);
 await page.route(u=>u.pathname.endsWith('/js/main.js'),async r=>{await gate;await r.continue()});
 await page.goto(base+'index.html?tune=0',{waitUntil:'commit'});
 await page.locator('#loader').waitFor({state:'visible'});
 await page.waitForFunction(()=>document.body.classList.contains('is-booting'));
 assert.equal(await page.locator('.finnovation-ui').evaluate(e=>getComputedStyle(e).opacity),'0','interface must stay transparent during loading');
 assert.equal(await page.locator('.fi-brand').isVisible(),false,'brand must stay hidden during loading');
 release();
 await page.waitForFunction(()=>document.body.classList.contains('is-ready'),null,{timeout:45000});
 await page.evaluate(()=>window.__MONTIS_STUDY__.ready);await page.waitForTimeout(1300);
 const target=()=>page.evaluate(()=>window.__MONTIS_STUDY__.journey.target);
 for(const selector of ['.fi-menu-toggle','.fi-footer-next','.fi-rail button:first-child']){
   const before=await target();await page.locator(selector).hover();await page.mouse.wheel(0,140);
   await page.waitForFunction(t=>window.__MONTIS_STUDY__.journey.target>t,before);
 }
 await page.locator('.fi-menu-toggle').focus();const old=await target();await page.keyboard.press('PageDown');assert.ok(await target()>old,'PageDown works on focused navigation');
 const old2=await target();await page.keyboard.press('Space');await page.waitForFunction(()=>document.querySelector('.fi-menu').open);assert.equal(await target(),old2,'Space opens menu without advancing journey');
 await page.locator('.fi-menu-links button').first().hover();await page.mouse.wheel(0,180);await page.waitForTimeout(100);assert.equal(await target(),old2,'modal keeps journey stationary');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.fi-menu').open);
 assert.equal(await page.locator('.fi-menu-toggle').getAttribute('aria-expanded'),'false');
 assert.ok(await page.locator('.fi-menu-toggle').evaluate(e=>e===document.activeElement),'Escape restores focus');
 await page.locator('.fi-copy-panel.is-active button').focus();await page.keyboard.press('PageDown');await page.waitForTimeout(800);
 assert.ok(await page.evaluate(()=>!document.activeElement.closest('[inert]')),'focus never remains in hidden copy');
 assert.equal(await page.locator('.fi-menu-links [aria-current="step"]').count(),1);
 assert.equal(await page.locator('.fi-rail [aria-current="step"]').count(),1);
 assert.deepEqual(errors,[]);await context.close();console.log('PASS loading-only, wheel over UI, keyboard navigation, modal isolation, focus and current chapter');
 for(const [name,width,height] of [['phone',390,844],['landscape',844,390]]){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});const p=await ctx.newPage();
  await p.goto(base+'index.html?tune=0');await p.waitForFunction(()=>document.body.classList.contains('is-ready'));await p.waitForTimeout(1300);
  const rects=await p.locator('.fi-rail button').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));assert.ok(rects.every(r=>r.height>=44),'touch chapter targets >=44px');
  const headerBottom=await p.locator('.fi-header button,.fi-brand').evaluateAll(es=>Math.max(...es.map(e=>e.getBoundingClientRect().bottom)));assert.ok(rects[0].y>=headerBottom,'rail clears header controls');
  await p.locator('.fi-menu-toggle').click();
  const layout=await p.locator('.fi-menu').evaluate(e=>({client:e.clientHeight,scroll:e.scrollHeight}));
  if(name==='landscape')assert.ok(layout.scroll<=layout.client+1,'all six chapters fit landscape menu');
  assert.equal(await p.locator('.fi-menu-links button').count(),6);
  await ctx.close();console.log('PASS '+name+' touch targets and menu layout');
 }
 const ctx=await browser.newContext({reducedMotion:'reduce'}),p=await ctx.newPage();
 await p.goto(base+'index.html');await p.waitForFunction(()=>document.body.classList.contains('is-ready'));await p.locator('.letters-panel').waitFor();
 const before=await p.evaluate(()=>window.__MONTIS_STUDY__.journey.target);await p.locator('.letters-panel .lp-body').hover();await p.mouse.wheel(0,200);await p.waitForTimeout(150);
 assert.equal(await p.evaluate(()=>window.__MONTIS_STUDY__.journey.target),before,'parameter panel consumes its own scroll');await ctx.close();console.log('PASS plain local URL, reduced motion and parameter panel scrolling');
 const fc=await browser.newContext(),fp=await fc.newPage();await fp.route(u=>u.pathname.endsWith('/water-journey-scene-463.js'),r=>r.abort());await fp.goto(base+'index.html?tune=0');await fp.waitForFunction(()=>document.documentElement.dataset.renderMode==='text');assert.ok(await fp.locator('h1').isVisible());await fc.close();console.log('PASS readable fallback after module failure');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});


