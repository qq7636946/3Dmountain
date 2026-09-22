const {chromium}=require(process.env.MONTIS_PLAYWRIGHT_PATH||'C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');

const input=process.argv[2];
if(!input)throw new Error('Pass the loopback preview URL or port.');
const base=new URL(/^\d+$/.test(input)?`http://127.0.0.1:${input}/index4-6.html`:input);
if(base.protocol!=='http:'||base.hostname!=='127.0.0.1'||base.username||base.password)throw new Error('Only an http://127.0.0.1 preview is allowed.');
if(base.pathname==='/')base.pathname='/index4-6.html';
if(base.pathname!=='/index4-6.html')throw new Error('This check targets index4-6.html only.');
const output=path.resolve(__dirname,'../.qa/text-motion');
const project=path.resolve(__dirname,'..');
const normalize=text=>String(text||'').replace(/\s+/g,' ').trim();
const testCases=[
  {name:'desktop',viewport:{width:1440,height:900}},
  {name:'mobile',viewport:{width:390,height:844},mobile:true},
  {name:'reduced-motion',viewport:{width:1440,height:900},reduced:true},
  {name:'low-end',viewport:{width:390,height:844},mobile:true,lowEnd:true}
];

async function snapshot(page){
  return page.evaluate(()=>{
    const study=window.__MONTIS_STUDY__,fx=study.textFx;
    const list=fx.inspect();
    const canvas=fx.renderer?.domElement;
    let overlay=null;
    if(canvas){const cs=getComputedStyle(canvas);overlay={connected:canvas.isConnected,display:cs.display,visibility:cs.visibility,opacity:Number(cs.opacity),width:canvas.width,height:canvas.height};}
    const hero=document.querySelector('.hero-title'),style=getComputedStyle(hero);
    return {state:{...fx.state},controls:{...fx.controls},progress:study.journey.progress,target:study.journey.target,velocity:study.journey.velocity,activeChapter:document.querySelector('.journey-story')?.dataset.active||'',list,overlay,hero:{text:hero.textContent.trim(),color:style.color,fill:style.webkitTextFillColor,opacity:Number(style.opacity),width:hero.getBoundingClientRect().width,height:hero.getBoundingClientRect().height},overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
}
function visibleEntries(info){return info.list.filter(entry=>entry.visible&&entry.opacity>.02);}
function assertAlignment(info){
  const visible=visibleEntries(info);assert(visible.length>0,'No visible title planes were reported.');
  for(const entry of visible){
    const rect=entry.rect,plane=entry.planeRect;
    for(const [label,value] of Object.entries({rect,plane})){
      assert(value,`Missing ${label} for ${entry.text}`);
      for(const key of ['x','y','width','height'])assert(Number.isFinite(value[key]),`Non-finite ${label}.${key} for ${entry.text}`);
      assert(value.width>0&&value.height>0,`Empty ${label} for ${entry.text}`);
    }
    // A plane may include a small transparent glyph/deformation margin.
    assert(plane.x<=rect.x+3&&plane.y<=rect.y+3,`Plane clips the start of ${entry.text}`);
    assert(plane.x+plane.width>=rect.x+rect.width-3&&plane.y+plane.height>=rect.y+rect.height-3,`Plane clips the end of ${entry.text}`);
    assert(Math.abs((plane.x+plane.width*.5)-(rect.x+rect.width*.5))<5,`Plane/DOM horizontal center drift: ${entry.text}`);
    assert(Math.abs((plane.y+plane.height*.5)-(rect.y+rect.height*.5))<5,`Plane/DOM vertical center drift: ${entry.text}`);
  }
  assert(!info.overflow,'The text creates horizontal page overflow.');
}
function assertDomFallback(info){
  assert.equal(info.state.mode,'dom','Fallback did not switch to DOM text.');
  assert(info.hero.opacity>.5&&info.hero.width>0&&info.hero.height>0,'Fallback hero is not visible.');
  for(const value of [info.hero.color,info.hero.fill])assert(value!=='transparent'&&!/rgba\([^)]*,\s*0(?:\.0+)?\)$/.test(value),'Fallback hero remains transparent/masked.');
  assert(!info.overlay||!info.overlay.connected||info.overlay.display==='none'||info.overlay.visibility==='hidden'||info.overlay.opacity<.001,'Fallback leaves the text overlay visible.');
}
async function setChapter(page,value){
  await page.evaluate(p=>{const s=window.__MONTIS_STUDY__;s.journey.progress=p;s.journey.target=p;s.journey.velocity=0;},value);
  await page.waitForTimeout(700);
}
async function expectedBinaries(){
  const expected={};
  for(const dir of ['drop_of_water','river_water_runtime']){
    for(const filename of await fs.readdir(path.join(project,dir))){
      if(!filename.endsWith('.bin'))continue;
      const data=await fs.readFile(path.join(project,dir,filename));
      expected[`/${dir}/${filename}`]={bytes:data.length,hash:crypto.createHash('sha256').update(data).digest('hex')};
    }
  }
  return expected;
}

(async()=>{
  await fs.mkdir(output,{recursive:true});
  const expected=await expectedBinaries(),reports=[];
  const browser=await chromium.launch({headless:true,executablePath:process.env.MONTIS_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    for(const test of testCases){
      const report={name:test.name,viewport:test.viewport,checks:[],errors:[],failedRequests:[],badResponses:[],verifiedTransferWarnings:[],snapshots:[]};
      reports.push(report);
      const context=await browser.newContext({viewport:test.viewport,deviceScaleFactor:1,isMobile:!!test.mobile,hasTouch:!!test.mobile,reducedMotion:test.reduced?'reduce':'no-preference'});
      const page=await context.newPage();
      page.on('pageerror',error=>report.errors.push({type:'pageerror',message:error.message}));
      page.on('console',message=>{if(message.type()==='error')report.errors.push({type:'console',message:message.text(),location:message.location()});});
      page.on('requestfailed',request=>report.failedRequests.push({url:request.url(),reason:request.failure()?.errorText||'Unknown failure'}));
      page.on('response',response=>{if(response.status()>=400)report.badResponses.push({url:response.url(),status:response.status()});});
      await page.addInitScript(({lowEnd,origin})=>{
        if(lowEnd){Object.defineProperty(navigator,'deviceMemory',{configurable:true,get:()=>2});Object.defineProperty(navigator,'hardwareConcurrency',{configurable:true,get:()=>2});}
        window.__textMotionTransfers={};
        const read=Response.prototype.arrayBuffer;
        Response.prototype.arrayBuffer=async function(...args){
          const buffer=await read.apply(this,args);
          if(this.url.startsWith(origin+'/')&&/\/[^/?]+\.bin(?:\?|$)/.test(this.url)){
            const url=new URL(this.url).pathname;
            window.__textMotionTransfers[url]=crypto.subtle.digest('SHA-256',buffer).then(hash=>({bytes:buffer.byteLength,hash:Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('')}));
          }
          return buffer;
        };
      },{lowEnd:!!test.lowEnd,origin:base.origin});
      const check=async(name,fn)=>{await fn();report.checks.push({name,passed:true});};
      try{
        await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:90000});
        await page.waitForFunction(()=>window.__MONTIS_STUDY__?.textFx,null,{timeout:120000});
        await page.evaluate(async()=>{const fx=window.__MONTIS_STUDY__.textFx;await(fx.readyPromise||fx.ready);});
        await page.waitForFunction(()=>document.querySelector('#loader')?.classList.contains('is-done')&&Number(getComputedStyle(document.querySelector('.hero-title')).opacity)>.8,null,{timeout:120000});
        await page.waitForFunction(()=>{const fx=window.__MONTIS_STUDY__.textFx;return fx.state.mode==='dom'||fx.state.activeCount>0;},null,{timeout:20000});
        await page.waitForTimeout(2000);
        const hero=await snapshot(page);report.snapshots.push({stage:'hero',...hero});
        await page.screenshot({path:path.join(output,`${test.name}-hero.png`)});
        if(test.reduced||test.lowEnd){
          await check('Readable unmasked DOM fallback with no overlay',async()=>assertDomFallback(hero));
          assert(hero.state.reason,'Fallback should explain its capability decision in diagnostics.');
          await setChapter(page,.5);
          const chapter=await snapshot(page);report.snapshots.push({stage:'fallback-chapter',...chapter});
          await check('Fallback chapter remains DOM text',async()=>{
            assert.equal(chapter.state.mode,'dom');
            assert.equal(chapter.activeChapter,'knowledge');
            const title=await page.locator('.story-card[data-chapter="knowledge"] .story-title').evaluate(el=>({text:el.textContent,color:getComputedStyle(el).color,fill:getComputedStyle(el).webkitTextFillColor}));
            assert(title.text.includes('ROOTED IN')&&title.text.includes('KNOWLEDGE'));
            assert(!/rgba\([^)]*,\s*0(?:\.0+)?\)$/.test(title.color)&&title.fill!=='transparent','Fallback chapter is masked.');
          });
          await page.screenshot({path:path.join(output,`${test.name}-chapter.png`)});
        }else{
          await check('WebGL title overlay is ready and aligned',async()=>{assert.equal(hero.state.mode,'webgl',hero.state.reason||'Unexpected DOM fallback');assertAlignment(hero);assert(visibleEntries(hero).some(e=>normalize(e.text).includes('OMNI')),'Hero title is absent from the overlay.');});
          await page.evaluate(()=>{window.__textMotionPeak={amplitude:0,velocity:0,samples:0};window.__textMotionTimer=setInterval(()=>{const s=window.__MONTIS_STUDY__,record=window.__textMotionPeak;record.amplitude=Math.max(record.amplitude,Math.abs(s.textFx.state.maxAmplitude||0));record.velocity=Math.max(record.velocity,Math.abs(s.journey.velocity));record.samples++;},20);});
          const before=hero.target;
          await page.mouse.move(test.viewport.width*.8,test.viewport.height*.6);
          await page.mouse.wheel(0,220);
          await page.waitForTimeout(180);
          await page.screenshot({path:path.join(output,`${test.name}-wheel.png`)});
          await page.waitForTimeout(850);
          const peak=await page.evaluate(()=>{clearInterval(window.__textMotionTimer);return window.__textMotionPeak;});
          report.wheel={before,peak,after:await page.evaluate(()=>window.__MONTIS_STUDY__.journey.target)};
          await check('Native wheel produces real text deformation',async()=>{assert(report.wheel.after>before);assert(peak.velocity>0);assert(peak.amplitude>1e-5,'Text amplitude remained zero while scrolling.');});
          await page.waitForTimeout(3000);
          const settled=await snapshot(page);report.snapshots.push({stage:'settled',...settled});
          await check('Text settles back to a still readable surface',async()=>{assert((settled.state.maxAmplitude||0)<Math.max(.003,peak.amplitude*.12),'Text does not settle after scrolling stops.');assert(Math.abs(settled.velocity)<.05,'Journey motion did not settle.');});
          for(const [p,chapter,words,forbidden] of [[.5,'knowledge',['ROOTED IN','KNOWLEDGE'],['OMNI INVESTMENT STRATEGIES','QUANT TRADING']],[10.9,'ai',['AI','QUANT TRADING'],['ROOTED IN','KNOWLEDGE','OMNI INVESTMENT STRATEGIES']]]){
            await setChapter(page,p);const info=await snapshot(page);report.snapshots.push({stage:chapter,...info});
            await check(`${chapter} title matches DOM without stale planes`,async()=>{
              assert.equal(info.activeChapter,chapter);assertAlignment(info);
              const shown=visibleEntries(info).map(e=>normalize(e.text)).join(' ');
              for(const word of words)assert(shown.includes(word),`Missing ${word} in ${shown}`);
              for(const word of forbidden)assert(!shown.includes(word),`Stale text plane: ${word}`);
              const dom=await page.locator(`.story-card[data-chapter="${chapter}"] .story-title`).innerText();
              for(const word of words)assert(normalize(dom).includes(word),'Overlay differs from current DOM chapter.');
            });
            await page.screenshot({path:path.join(output,`${test.name}-${chapter}.png`)});
          }
          const resized=test.mobile?{width:844,height:390}:{width:1180,height:760};
          await page.setViewportSize(resized);await page.waitForTimeout(900);
          const resize=await snapshot(page);report.snapshots.push({stage:'resize',...resize});
          await check('Resize preserves title alignment and active chapter',async()=>{assertAlignment(resize);assert.equal(resize.activeChapter,'ai');});
          await page.screenshot({path:path.join(output,`${test.name}-resize.png`)});
          if(!test.mobile){
            await setChapter(page,0);await page.waitForTimeout(500);
            await page.evaluate(()=>{const fx=window.__MONTIS_STUDY__.textFx;if(!fx.renderer?.forceContextLoss)throw Error('Missing text renderer context-loss diagnostic');fx.renderer.forceContextLoss();});
            await page.waitForFunction(()=>window.__MONTIS_STUDY__.textFx.state.mode==='dom',null,{timeout:15000});
            const lost=await snapshot(page);report.snapshots.push({stage:'context-loss',...lost});
            await check('Context loss restores readable DOM text',async()=>assertDomFallback(lost));
            await page.screenshot({path:path.join(output,'desktop-context-loss.png')});
          }
        }
      }catch(error){
        report.checks.push({name:'Case completion',passed:false,error:error.stack||String(error)});
        try{await page.screenshot({path:path.join(output,`${test.name}-failure.png`)});}catch{}
      }finally{
        try{
          const transfers=await page.evaluate(async()=>Object.fromEntries(await Promise.all(Object.entries(window.__textMotionTransfers||{}).map(async([name,proof])=>[name,await proof]))));
          report.transferProofs=transfers;
          report.unexpectedFailures=report.failedRequests.filter(failure=>{
            let file;try{const url=new URL(failure.url);if(url.origin!==base.origin)return true;file=url.pathname;}catch{return true;}
            const known=expected[file],proof=transfers[file];
            const verified=failure.reason==='net::ERR_ABORTED'&&known&&proof?.bytes===known.bytes&&proof?.hash===known.hash;
            if(verified)report.verifiedTransferWarnings.push({...failure,proof});
            return !verified;
          });
        }catch(error){report.transferProofError=String(error);report.unexpectedFailures=report.failedRequests;}
        report.passed=report.checks.every(check=>check.passed)&&report.errors.length===0&&report.badResponses.length===0&&report.unexpectedFailures.length===0;
        await context.close();
        await fs.writeFile(path.join(output,'report.json'),JSON.stringify({base:base.href,generatedAt:new Date().toISOString(),reports},null,2));
        console.log(JSON.stringify({name:report.name,passed:report.passed,checks:report.checks,errors:report.errors,missingAssets:report.badResponses,networkFailures:report.unexpectedFailures}));
      }
    }
  }finally{await browser.close();}
  if(reports.some(report=>!report.passed))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
