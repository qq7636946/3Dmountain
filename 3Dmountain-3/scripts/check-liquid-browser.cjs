const { chromium } = require('C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = process.argv[2];
if (!base?.startsWith('http://127.0.0.1:')) throw Error('Pass the local preview URL');
const output = path.resolve(__dirname, '../.qa/liquid');
const expectedSceneHash='c09e07023cb07e1dc644678229f7b92488d77adfe7c34c45ef637c8d491f5200';
(async () => {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const reports = [];
  try {
    for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1, isMobile: name === 'mobile', hasTouch: name === 'mobile' });
      await page.addInitScript(()=>{
        const read=Response.prototype.arrayBuffer;
        Response.prototype.arrayBuffer=async function(...args){
          const buffer=await read.apply(this,args);
          if(buffer.byteLength===3374304)window.__sceneTransferProof=crypto.subtle.digest('SHA-256',buffer).then(hash=>({bytes:buffer.byteLength,hash:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('')}));
          return buffer;
        };
      });
      const errors = [], failed = [], network=[];
      for(const event of ['request','response','requestfinished','requestfailed'])page.on(event,r=>{
        if(r.url().includes('scene.bin'))network.push({event,url:r.url(),time:Date.now(),status:r.status?.(),failure:r.failure?.()});
      });
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push({ text:m.text(), location:m.location() }); });
      page.on('requestfailed', r => failed.push({url:r.url(), reason:r.failure()?.errorText}));
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.montis?.water, null, { timeout: 60000 });
      const asset = await page.evaluate(async () => {
        const w=window.montis.water,ready=await w.ready;window.montis.enter(false);
        const transfer=performance.getEntriesByType('resource').find(r=>r.name.endsWith('/drop_of_water/scene.bin'));
        return {ready,error:w.state.error,vertices:w.body.geometry.attributes.position.count,bytes:transfer?.decodedBodySize,responseEnd:transfer?.responseEnd,proof:await window.__sceneTransferProof};
      });
      assert.equal(asset.proof?.hash,expectedSceneHash,'Downloaded scene.bin differs from the local source');
      console.log(name+' asset: '+JSON.stringify(asset));
      await page.waitForTimeout(4400);
      const poses = [];
      for (const [stage, p] of [['idle', 1], ['fall', 1.51], ['contact', 1.79], ['dive', 2.12], ['deep', 2.55], ['return', 1]]) {
        await page.evaluate(p => window.montis.previewAt(p), p);
        await page.waitForTimeout(stage === 'return' ? 1200 : 500);
        const pose = await page.evaluate(() => {
          const w = window.montis.water;
          return { phase: w.state.phase, visible: w.root.visible, root: w.root.position.toArray(), body:w.body.getWorldPosition(w.body.position.clone()).toArray(), scale:w.body.parent.scale.toArray(), camera:window.montis.camera.position.toArray(), quaternion:window.montis.camera.quaternion.toArray(), progress:window.montis.VIEW.p, bodyReady:w.state.bodyReady, impactCount:w.state.impactCount };
        });
        assert(pose.root.every(Number.isFinite), 'Invalid liquid root transform');
        for(const key of ['body','scale','camera','quaternion'])assert(pose[key].every(Number.isFinite),'Invalid '+key+' transform');
        if(stage==='idle'||stage==='return')assert(pose.visible,'Water not visible after '+stage);
        poses.push({ stage, p, ...pose });
        await page.screenshot({ path: path.join(output, `${name}-${stage}.png`) });
      }
      const pointer=await page.evaluate(() => {
        const w=window.montis.water,p=w.body.getWorldPosition(w.body.position.clone()).project(window.montis.camera);
        return {x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight};
      });
      await page.mouse.move(pointer.x,pointer.y);
      await page.waitForTimeout(120);
      assert(await page.evaluate(()=>window.montis.water.state.hovered),'Water did not respond to pointer hover');
      await page.mouse.down();
      assert(await page.evaluate(()=>window.montis.water.state.grabbed),'Water drag did not start');
      const dragStart=await page.evaluate(()=>window.montis.scroll.target);
      await page.mouse.move(pointer.x+Math.min(110,viewport.width*.15),pointer.y+80,{steps:8});
      await page.mouse.wheel(0,180);
      await page.waitForTimeout(180);
      assert.equal(await page.evaluate(()=>window.montis.scroll.target),dragStart,'Scrolling moved the camera during a water drag');
      await page.screenshot({path:path.join(output,`${name}-drag.png`)});
      await page.mouse.up();
      assert.equal(await page.evaluate(()=>window.montis.water.state.grabbed),false,'Water did not release');
      const drag={hover:true,grab:true,scrollLocked:true,release:true};
      if(name==='mobile'){
        await page.touchscreen.tap(pointer.x,pointer.y);
        assert.equal(await page.evaluate(()=>window.montis.water.state.grabbed),false,'Touch tap left the water stuck');
        drag.touchTap=true;
      }
      await page.waitForTimeout(500);
      if(name==='mobile'){
        const cdp=await page.context().newCDPSession(page);
        const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1,radiusX:5,radiusY:5,force:1}]});
        const start=await page.evaluate(()=>window.montis.scroll.target);
        await touch('touchStart',viewport.width-25,viewport.height*.75);
        for(let i=1;i<=12;i++){await touch('touchMove',viewport.width-25,viewport.height*.75-i*18);await page.waitForTimeout(25);}
        await touch('touchEnd');
        await page.waitForTimeout(160);
        assert(await page.evaluate(()=>window.montis.scroll.target)>start,'Native touch swipe failed to advance the scene');
        drag.touchScroll=true;
        await page.evaluate(()=>window.montis.previewAt(1));await page.waitForTimeout(750);
        const hit=await page.evaluate(()=>{const w=window.montis.water,p=w.body.getWorldPosition(w.body.position.clone()).project(window.montis.camera);return{x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight};});
        await touch('touchStart',hit.x,hit.y);await page.waitForTimeout(80);
        assert(await page.evaluate(()=>window.montis.water.state.grabbed),'Native touch drag did not grab water');
        const locked=await page.evaluate(()=>window.montis.scroll.target);
        for(let i=1;i<=10;i++){await touch('touchMove',hit.x+3*i,hit.y+8*i);await page.waitForTimeout(25);}
        assert.equal(await page.evaluate(()=>window.montis.scroll.target),locked,'Native touch water drag also scrolled the scene');
        await touch('touchEnd');await page.waitForTimeout(80);
        assert.equal(await page.evaluate(()=>window.montis.water.state.grabbed),false,'Native touch drag failed to release');
        drag.touchDrag=true;await cdp.detach();
      }
      const optics=await page.evaluate(()=>{const w=window.montis.water;return{bodyTransmission:w.body.material.transmission,clusterTransmission:w.cluster.material.transmission,ior:w.body.material.ior,bodySide:w.body.material.side,assetStatus:w.state.assetStatus};});
      let loop=null;
      if(name==='desktop'){
        const cycle=await page.evaluate(()=>{const w=window.montis.water;w.configure({loopSpeed:3});return w.state.cycle;});
        await page.waitForFunction(()=>window.montis.water.state.gather<.12,null,{timeout:30000});
        await page.screenshot({path:path.join(output,'desktop-separated.png')});
        await page.waitForFunction(cycle=>window.montis.water.state.cycle>cycle,cycle,{timeout:30000});
        loop=await page.evaluate(()=>{const w=window.montis.water;w.configure({loopSpeed:1});return{cycle:w.state.cycle,balls:w.state.ballCount,triangles:w.state.triangles};});
      }
      const before = await page.evaluate(() => window.montis.scroll.target);
      await page.mouse.move(viewport.width * .8, viewport.height * .7);
      await page.mouse.wheel(0, 250);
      await page.waitForTimeout(350);
      const after = await page.evaluate(() => window.montis.scroll.target);
      assert(after > before, 'Wheel did not advance the liquid timeline');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Horizontal overflow');
      assert(await page.evaluate(()=>document.querySelector('#tuner').hidden),'Debug panel should be hidden in the public view');
      if(name==='mobile')assert(await page.evaluate(()=>document.querySelector('#liquidHint').getBoundingClientRect().bottom<document.querySelector('.hero__title').getBoundingClientRect().top),'Mobile water hint overlaps the hero title');
      // Chromium can report ERR_ABORTED after a consumed streamed Response.
      // Exempt only this exact source asset when its delivered bytes hash-match.
      const verifiedTransferWarnings=failed.filter(r=>r.url.endsWith('/drop_of_water/scene.bin')&&r.reason==='net::ERR_ABORTED'&&asset.ready&&asset.proof?.hash===expectedSceneHash);
      const unexpectedFailures=failed.filter(r=>!verifiedTransferWarnings.includes(r));
      reports.push({ name, asset, optics, loop, poses, drag, errors, unexpectedFailures, verifiedTransferWarnings, network, wheel: { before, after } });
      await page.close();
    }
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(reports, null, 2));
    console.log(JSON.stringify(reports, null, 2));
    if (reports.some(r => r.errors.length||r.unexpectedFailures.length||!r.asset.ready)) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
