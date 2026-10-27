const fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output='C:/Users/qq763/Downloads/Sweet-Potato-ThreeJS-20261022';
(async()=>{
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const page=await browser.newPage(),results=[];
    for(const type of ['photo-aligned','generated-skin']){
      const bytes=await fs.readFile(path.join(output,`sweet-potato-${type}.glb`));
      if(bytes.toString('utf8',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Invalid GLB header');
      const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
      await page.route(`**/roundtrip-${type}.glb`,r=>r.fulfill({body:bytes,contentType:'model/gltf-binary'}));
      await page.goto('http://127.0.0.1:5614/prototypes/sweet-potato-study-20261022/');
      await page.waitForFunction(()=>window.__POTATO_STUDY__?.ready);
      const loaded=await page.evaluate(async type=>{
        const {GLTFLoader}=await import('./vendor/loaders/GLTFLoader.js');
        const gltf=await new GLTFLoader().loadAsync(`./roundtrip-${type}.glb`);
        let meshes=0,triangles=0,finite=true,alphaLeaves=0;
        gltf.scene.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;finite=finite&&[...o.geometry.attributes.position.array].every(Number.isFinite);if(o.material.alphaTest>0)alphaLeaves++;});
        return {meshes,triangles,finite,alphaLeaves};
      },type);
      results.push({type,bytes:bytes.length,embeddedImages:json.images.length,externalImages:json.images.some(i=>i.uri),extensions:json.extensionsUsed,loaded});
    }
    await fs.writeFile(path.join(output,'preview/glb-roundtrip.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
