// Rebuild the isolated study's local assets. Never modifies the source terrain or formal page.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '../..');
const delivery = 'C:/Users/qq763/Downloads/Finnovation-Highland-Study-20261022';
const assetDir = path.join(__dirname, 'assets');
async function download(url, file) {
  try { await fs.access(file); return; } catch {}
  const r = await fetch(url, {headers:{'User-Agent':'FinnovationMaterialStudy/1.0'}});
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  await fs.mkdir(path.dirname(file), {recursive:true});
  await fs.writeFile(file, Buffer.from(await r.arrayBuffer()));
}
async function main() {
  await fs.mkdir(assetDir, {recursive:true});
  const originals = path.join(delivery, 'source-assets');
  const manifest = {generated:new Date().toISOString(), textures:[], terrain:{}};
  for (const id of ['cliff_side', 'aerial_grass_rock']) {
    const files = await fetch(`https://api.polyhaven.com/files/${id}`).then(r=>r.json());
    for (const [key, suffix] of [['Diffuse','color'],['nor_gl','normal'],['Rough','roughness']]) {
      const record = files[key]['2k'].jpg;
      const original = path.join(originals, `${id}-${suffix}-2k.jpg`);
      await download(record.url, original);
      const buffer = await fs.readFile(original);
      if (record.md5 && crypto.createHash('md5').update(buffer).digest('hex') !== record.md5) throw new Error('Checksum mismatch '+original);
      for (const size of [2048, 1024]) {
        const dest = path.join(assetDir, `${id}-${suffix}-${size}.webp`);
        await sharp(buffer).resize(size,size).webp({quality:suffix==='normal'?96:91,effort:5}).toFile(dest);
      }
      manifest.textures.push({id,type:suffix,source:record.url,license:'CC0',md5:record.md5});
    }
    console.log('Prepared PBR set:', id);
  }
  // Extract the existing, licensed terrain's real erosion-shaped surface to a compact heightfield.
  const modelDir = path.join(root, '_archive/models/snowy_mountain_v2_-_terrain');
  const gltf = JSON.parse(await fs.readFile(path.join(modelDir,'scene.gltf'),'utf8'));
  const bin = await fs.readFile(path.join(modelDir,'scene.bin'));
  const N=513, heights = new Float32Array(N*N), hits = new Uint16Array(N*N);
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    const a=gltf.accessors[primitive.attributes.POSITION], v=gltf.bufferViews[a.bufferView];
    const start=(v.byteOffset||0)+(a.byteOffset||0), stride=v.byteStride||12;
    for (let i=0;i<a.count;i++) {
      const x=bin.readFloatLE(start+i*stride), y=bin.readFloatLE(start+i*stride+4), z=bin.readFloatLE(start+i*stride+8);
      const ix=Math.max(0,Math.min(512,Math.round((x+10)/20*512)));
      const iy=Math.max(0,Math.min(512,Math.round((y+10)/20*512)));
      heights[iy*N+ix]+=z; hits[iy*N+ix]++;
    }
  }
  let missing=0;
  for(let i=0;i<heights.length;i++) {if(hits[i]) heights[i]/=hits[i]; else missing++;}
  if(missing) throw new Error(`Source height grid has ${missing} holes`);
  await fs.writeFile(path.join(assetDir,'terrain-height-513.bin'),Buffer.from(heights.buffer));
  await fs.copyFile(path.join(modelDir,'license.txt'),path.join(assetDir,'terrain-license.txt'));
  for (const size of [2048,1024]) await sharp(path.join(modelDir,'textures/Material.001_normal.png')).resize(size,size).webp({quality:97,effort:5}).toFile(path.join(assetDir,`terrain-erosion-normal-${size}.webp`));
  manifest.terrain={source:'https://sketchfab.com/3d-models/snowy-mountain-v2-terrain-4c70cd82edd44951b7af6c144545df34',author:'artfromheath',license:'CC-BY-4.0',samples:N*N,missing};
  // Vendor the same Three.js revision used by this project; the delivered page needs no CDN.
  await download('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',path.join(__dirname,'vendor/three.module.js'));
  await download('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/objects/Water.js',path.join(__dirname,'vendor/Water.js'));
  const waterPath=path.join(__dirname,'vendor/Water.js');
  let waterSource=await fs.readFile(waterPath,'utf8');
  if(!waterSource.includes('this.getRenderTarget')) {
    waterSource=waterSource.replace('const renderTarget = new WebGLRenderTarget( textureWidth, textureHeight );','const renderTarget = new WebGLRenderTarget( textureWidth, textureHeight );\n\t\t// Local lifecycle extension for explicit teardown.\n\t\tthis.getRenderTarget = () => renderTarget;');
    await fs.writeFile(waterPath,waterSource);
  }
  await download('https://cdn.jsdelivr.net/npm/three@0.170.0/LICENSE',path.join(__dirname,'vendor/THREE-LICENSE.txt'));
  await download('https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/textures/waternormals.jpg',path.join(assetDir,'waternormals.jpg'));
  await fs.writeFile(path.join(assetDir,'manifest.json'),JSON.stringify(manifest,null,2));
  const protectedFiles=['index1-3-maritime.html','prototypes/maritime-landscape/js/main.js','prototypes/maritime-landscape/js/terrain-texture-detail.js','index1-3-everest.html'];
  const hashes={};
  for(const p of protectedFiles) hashes[p]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,p))).digest('hex');
  try { await fs.access(path.join(__dirname,'formal-before.json')); }
  catch { await fs.writeFile(path.join(__dirname,'formal-before.json'),JSON.stringify(hashes,null,2)); }
  console.log('Assets ready; source grid',N,'x',N,'delivery',delivery);
}
main().catch(e=>{console.error(e);process.exit(1)});
