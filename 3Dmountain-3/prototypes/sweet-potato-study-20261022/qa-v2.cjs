const {chromium}=require('C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path');
const out='C:/Users/qq763/Downloads/Sweet-Potato-Revision2-20261022';
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
  try{
    const results=[];
    for(const mode of process.argv.includes('--full')?['desktop','mobile','reduced']:['desktop']){
      const page=await browser.newPage({viewport:mode==='mobile'?{width:390,height:844}:{width:1280,height:1100},deviceScaleFactor:1,reducedMotion:mode==='reduced'?'reduce':'no-preference',acceptDownloads:true});
      const errors=[],httpErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('response',r=>{if(r.status()>=400)httpErrors.push(r.url())});
      await page.goto('http://127.0.0.1:5614/prototypes/sweet-potato-study-20261022/',{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.__POTATO_STUDY__?.ready||window.__POTATO_STUDY__?.failure,{},{timeout:60000});
      if(await page.evaluate(()=>window.__POTATO_STUDY__.failure))throw new Error(await page.evaluate(()=>window.__POTATO_STUDY__.failure));
      for(const angle of mode==='desktop'?[0,45,90,135,180,225,270,315]:[0,90,180]){
        await page.evaluate(angle=>{const a=window.__POTATO_STUDY__,r=angle*Math.PI/180;a.resetView();a.camera.position.set(Math.sin(r)*15,a.controls.target.y,Math.cos(r)*15);a.controls.update();},angle);
        await page.waitForTimeout(120);await page.screenshot({path:path.join(out,'preview',`${mode}-${angle}.png`)});
      }
      await page.locator('#front').click();await page.locator('#compare').click();await page.waitForTimeout(200);await page.screenshot({path:path.join(out,'preview',`${mode}-comparison.png`)});await page.locator('#compare').click();
      await page.locator('#side').click();const sideWorks=await page.evaluate(()=>Math.abs(window.__POTATO_STUDY__.camera.position.x-15)<.01);
      await page.locator('#rotate').click();const before=await page.evaluate(()=>window.__POTATO_STUDY__.camera.position.toArray());await page.waitForTimeout(450);const after=await page.evaluate(()=>window.__POTATO_STUDY__.camera.position.toArray());await page.locator('#rotate').click();
      const stats=await page.evaluate(()=>window.__POTATO_STUDY__.stats());
      const geometry=await page.evaluate(()=>{
        const a=window.__POTATO_STUDY__,g=a.body.geometry,p=g.attributes.position,n=g.attributes.normal,{rows,radialSegments:r}=g.userData;
        let maxPositionGap=0,maxNormalGap=0;
        for(let j=0;j<=rows;j++)for(let k=0;k<3;k++){
          const left=(j*(r+1))*3+k,right=(j*(r+1)+r)*3+k;
          maxPositionGap=Math.max(maxPositionGap,Math.abs(p.array[left]-p.array[right]));maxNormalGap=Math.max(maxNormalGap,Math.abs(n.array[left]-n.array[right]));
        }
        const leaves=a.model.children.filter(m=>m.geometry?.userData.closedLeaf),zs=leaves.map(m=>m.position.z);
        return {bodyMaterials:Array.isArray(a.body.material)?a.body.material.length:1,maxPositionGap,maxNormalGap,closedLeaves:leaves.length,leafDepthSpan:Math.max(...zs)-Math.min(...zs),minimumLeafThickness:Math.min(...leaves.map(l=>l.geometry.userData.thickness))};
      });
      let roundtrip;
      if(mode==='desktop'){
        const waiting=page.waitForEvent('download');await page.locator('#export').click();const download=await waiting;
        const file=path.join(out,'sweet-potato-continuous-v2.glb');await download.saveAs(file);const bytes=await fs.readFile(file);
        await page.route('**/roundtrip.glb',r=>r.fulfill({body:bytes,contentType:'model/gltf-binary'}));
        roundtrip=await page.evaluate(async()=>{
          const {GLTFLoader}=await import('./vendor/loaders/GLTFLoader.js'),gltf=await new GLTFLoader().loadAsync('./roundtrip.glb');
          let triangles=0,meshes=0;gltf.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});
          return {meshes,triangles};
        });roundtrip.bytes=bytes.length;
      }
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      results.push({mode,stats,geometry,sideWorks,rotates:JSON.stringify(before)!==JSON.stringify(after),overflow,roundtrip,errors,httpErrors});
      console.log(JSON.stringify(results.at(-1)));await page.close();
    }
    await fs.writeFile(path.join(out,'preview/qa-v2.json'),JSON.stringify(results,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
