import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const source = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
const body = source.replace(/^import .*?;\r?$/gm, '');
new vm.Script(body);
const moduleUrl = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
async function remoteText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(url + ': ' + response.status);
  return response.text();
}
const threeSource = await remoteText(moduleUrl);
const dataUrl = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const threeDataUrl = dataUrl(threeSource);
const THREE = await import(threeDataUrl);
function extract(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, start + ' boundaries');
  return source.slice(a, b);
}
const context = vm.createContext({ THREE, Math, console, innerWidth: 1440 });
vm.runInContext(extract('const CONFIG =', 'const DEFAULT_CONFIG'), context);

vm.runInContext(extract('const TUNING =', '\n{\n  const tuner'), context);
const CONFIG = vm.runInContext('CONFIG', context);
const TUNING = vm.runInContext('TUNING', context);
const seen = new Set();
for (const [name, rows] of TUNING) for (const [label, group, key, min, max] of rows) {
  assert(CONFIG[group] && key in CONFIG[group], name + ': missing ' + key);
  const path = group + '.' + key;
  assert(!seen.has(path), 'duplicate control: ' + path);
  seen.add(path);
  if (min !== undefined) assert(CONFIG[group][key] >= min && CONFIG[group][key] <= max, path + ' outside range');
}
/* Optical continuity: partition a curved, closed shell and require its
   exterior area, enclosed volume and interpolated normal/UV fields to
   survive the cut. This catches the re-extrusion highlight regression. */
context.RK = CONFIG.rock;
vm.runInContext(extract('function polyArea(', "/* One seed's Voronoi cell"), context);
vm.runInContext(extract('function clipLogoShell(', 'function planarShards('), context);
const shell = new THREE.TorusGeometry(.9, .2, 10, 64).toNonIndexed();
const shellP = shell.attributes.position, shellN = shell.attributes.normal, shellUV = shell.attributes.uv;
for (let i = 0; i < shellP.count; i++) {
  const x=shellP.getX(i),y=shellP.getY(i),z=shellP.getZ(i);
  shellN.setXYZ(i, .17+x*.3, -.21+y*.2, .3+z*.4);
  shellUV.setXY(i, x*.4+z*.2, y*.3-z*.2);
}
function measures(g, exteriorOnly=false) {
  const p=g.attributes.position, a=p.array, cut=g.attributes.aCut;
  let area=0,vol6=0;
  for(let i=0;i<p.count;i+=3) {
    if(exteriorOnly && cut.getX(i)>.5) continue;
    const j=i*3;
    const ab=[a[j+3]-a[j],a[j+4]-a[j+1],a[j+5]-a[j+2]];
    const ac=[a[j+6]-a[j],a[j+7]-a[j+1],a[j+8]-a[j+2]];
    area+=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])/2;
    vol6+=a[j]*(a[j+4]*a[j+8]-a[j+5]*a[j+7])+a[j+1]*(a[j+5]*a[j+6]-a[j+3]*a[j+8])+a[j+2]*(a[j+3]*a[j+7]-a[j+4]*a[j+6]);
  }
  return {area,volume:vol6/6};
}
const before=measures(shell);
let surfaceArea=0,splitVolume=0,normalError=0,uvError=0,cutTriangles=0;
for(let x=0;x<4;x++)for(let y=0;y<4;y++){
  const x0=-1.4+x*.7,y0=-1.4+y*.7;
  const poly=[[x0,y0],[x0+.7,y0],[x0+.7,y0+.7],[x0,y0+.7]].map(p=>new THREE.Vector2(...p));
  const part=context.clipLogoShell(shell,poly);
  if(!part)continue;
  const full=measures(part), outer=measures(part,true);
  surfaceArea+=outer.area;splitVolume+=full.volume;
  const p=part.attributes.position,n=part.attributes.normal,uv=part.attributes.uv,c=part.attributes.aCut;
  for(let i=0;i<p.count;i++){
    if(c.getX(i)>.5){cutTriangles+=1/3;continue;}
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    normalError=Math.max(normalError,Math.abs(n.getX(i)-(.17+x*.3)),Math.abs(n.getY(i)-(-.21+y*.2)),Math.abs(n.getZ(i)-(.3+z*.4)));
    uvError=Math.max(uvError,Math.abs(uv.getX(i)-(x*.4+z*.2)),Math.abs(uv.getY(i)-(y*.3-z*.2)));
  }
  part.dispose();
}
const shellAreaError=Math.abs(surfaceArea-before.area)/before.area;
const shellVolumeError=Math.abs(splitVolume-before.volume)/before.volume;
assert(shellAreaError<1e-5,'shell area changed at split: '+shellAreaError);
assert(shellVolumeError<.005,'clipped solid is not closed: '+shellVolumeError);
assert(normalError<1e-6 && uvError<1e-6,'inherited lighting attributes changed');
console.log(JSON.stringify({shellAreaError,shellVolumeError,inheritedNormalError:normalError,inheritedUvError:uvError,cutTriangles:Math.round(cutTriangles)},null,2));


/* Exercise the actual supplied mark, including its narrow tip and bevels.
   This fixture parser intentionally supports only commands in logo.svg. */
function logoShapes(svg) {
  return [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(match => {
    const tokens=match[1].match(/[a-zA-Z]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g);
    const shape=new THREE.Shape();let i=0,cmd='',x=0,y=0,sx=0,sy=0,cx=0,cy=0,previous='';
    const number=()=>Number(tokens[i++]);
    while(i<tokens.length) {
      if(/^[a-z]$/i.test(tokens[i])) cmd=tokens[i++];
      const rel=cmd===cmd.toLowerCase(), op=cmd.toUpperCase(), ox=x,oy=y;
      if(op==='Z'){shape.closePath();x=sx;y=sy;previous='Z';cmd='';continue;}
      if(op==='M'||op==='L') {
        x=number()+(rel?ox:0);y=number()+(rel?oy:0);
        if(op==='M'){shape.moveTo(x,y);sx=x;sy=y;cmd=rel?'l':'L';}else shape.lineTo(x,y);
      }else if(op==='V'){y=number()+(rel?oy:0);shape.lineTo(x,y);}
      else if(op==='H'){x=number()+(rel?ox:0);shape.lineTo(x,y);}
      else if(op==='C'||op==='S'){
        let ax,ay;
        if(op==='C'){ax=number()+(rel?ox:0);ay=number()+(rel?oy:0);}
        else{ax=/[CS]/.test(previous)?2*x-cx:x;ay=/[CS]/.test(previous)?2*y-cy:y;}
        cx=number()+(rel?ox:0);cy=number()+(rel?oy:0);
        x=number()+(rel?ox:0);y=number()+(rel?oy:0);
        shape.bezierCurveTo(ax,ay,cx,cy,x,y);
      }else throw Error('Unsupported logo.svg command '+cmd);
      previous=op;
    }
    return shape;
  });
}
function evaluateFunction(name) {
  const a=source.indexOf('function '+name+'('), b=source.indexOf('\n}',a);
  assert(a>=0&&b>a,'missing '+name);vm.runInContext(source.slice(a,b+2),context);
}
const geometryUtils=await remoteText('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/utils/BufferGeometryUtils.js');
context.BufferGeometryUtils=await import(dataUrl(geometryUtils.replace(/from 'three'/g,"from '"+threeDataUrl+"'")));
context.MARK={};context.glassUniforms={uSeeds:{value:Array.from({length:128},()=>new THREE.Vector2())}};
for(const name of ['flipWinding','markBevelCeiling','buildLogoGeometry','shatterRandom','pointInPoly','clipHalfPlane','polyCentroid','voronoiCell','clipToCell','markTriangles','loopsFromPolys','planarShards'])evaluateFunction(name);
const shapes=logoShapes(fs.readFileSync(new URL('../logo.svg',import.meta.url),'utf8'));
assert.equal(shapes.length,2,'actual mark paths');
const mark=context.buildLogoGeometry(shapes), originalMark=measures(mark);
const buildStarted=performance.now(),parts=context.planarShards(mark);
let markOuterArea=0,markVolume=0,markTriangles=0;
for(const part of parts){
  const g=part.geometry.clone().translate(part.center.x,part.center.y,part.center.z);
  markOuterArea+=measures(g,true).area;markVolume+=measures(g).volume;markTriangles+=g.attributes.position.count/3;
  const cut=g.attributes.aCut,girth=g.attributes.aGirth;
  for(let i=0;i<cut.count;i++)if(cut.getX(i)<.5)assert.equal(girth.getX(i),1,'outer-shell brightness changed');
  g.dispose();
}
const markAreaError=Math.abs(markOuterArea-originalMark.area)/originalMark.area;
const markVolumeError=Math.abs(markVolume-originalMark.volume)/Math.abs(originalMark.volume);
console.log(JSON.stringify({actualLogo:{parts:parts.length,markTriangles,markAreaError,markVolumeError,buildMilliseconds:performance.now()-buildStarted}},null,2));
assert(markAreaError<1e-5,'actual logo silhouette changed');
assert(markVolumeError<.005,'actual logo cut walls are not closed');

/* The new metadata must describe only closed fracture walls, and must
   not alter any exterior normal, UV, position or inherited lighting. */
evaluateFunction('chipCutSites'); evaluateFunction('sampleChipCut'); evaluateFunction('addCutAttribute');
const wholeBefore = mark.attributes.position.array.slice();
context.addCutAttribute(mark, false);
assert.deepEqual(mark.attributes.position.array, wholeBefore);
assert(mark.attributes.aFracture.array.every(v=>v===0), 'intact Logo has cut detail');
let metadataVertices=0, cutSamples=0, planeError=0;
for (const part of parts) {
  const g=part.geometry, plane=g.attributes.aFracture, cut=g.attributes.aCut, rest=g.attributes.aLogo;
  assert.equal(plane.count,rest.count);
  for (let i=0;i<rest.count;i++) {
    const n=[plane.getX(i),plane.getY(i)], offset=plane.getZ(i);
    assert([...n,offset].every(Number.isFinite), 'invalid cap plane');
    if (cut.getX(i)<.5) { assert(n[0]===0&&n[1]===0&&offset===0, 'detail leaked onto shell'); continue; }
    assert(Math.abs(Math.hypot(...n)-1)<1e-6, 'cap normal is not a unit vector');
    planeError=Math.max(planeError,Math.abs(n[0]*rest.getX(i)+n[1]*rest.getY(i)-offset));
    metadataVertices++;
  }
  const random=context.shatterRandom(147), again=context.shatterRandom(147);
  for (let i=0;i<32;i++) {
    const site=context.sampleChipCut(g,random), repeated=context.sampleChipCut(g,again);
    if (!site) continue;
    assert.deepEqual(site.position.toArray(), repeated.position.toArray(), 'cut chips change on rebuild');
    assert.deepEqual(site.normal.toArray(), repeated.normal.toArray());
    for (let k=0;k<3;k++) assert(cut.getX(site.triangle+k)>.999, 'chip spawned off a cut');
    const absolute=site.position.clone().add(part.center), t=site.triangle;
    const distance=plane.getX(t)*absolute.x+plane.getY(t)*absolute.y-plane.getZ(t);
    assert(Math.abs(distance)<1e-5, 'chip source is not on its fracture plane');
    assert(site.position.toArray().every(Number.isFinite)&&Math.abs(site.normal.length()-1)<1e-6);
    cutSamples++;
  }
}
assert(planeError<1e-5, 'cap detail coordinates slipped');
assert(cutSamples>1000, 'too few real cut-site samples');

/* Exercise the real chip builder with actual split geometry and a
   planned parent direction, including deterministic rebuilds and limits. */
context.shards=parts.map(part=>({geometry:part.geometry,userData:{
  center:part.center.clone(),dir:new THREE.Vector3(part.center.x-CONFIG.rock.crackX,part.center.y-CONFIG.rock.crackY,.2).normalize()
}}));
context.CHIP={groups:[
  {share:.35,stretch:[.9,1.3],flat:[.9,1],states:[]},
  {share:.28,stretch:[.9,1.2],flat:[1,1],states:[]},
  {share:.17,stretch:[.9,1.2],flat:[1,1],states:[]},
  {share:.20,stretch:[.9,1.3],flat:[.8,1],states:[]}
]};
evaluateFunction('rebuildChips');context.rebuildChips();
const chipSnapshot=JSON.stringify(context.CHIP.groups.map(g=>g.states));
context.rebuildChips();assert.equal(JSON.stringify(context.CHIP.groups.map(g=>g.states)),chipSnapshot);
let builtChips=0;
for(const group of context.CHIP.groups)for(const chip of group.states){
  assert(chip.start.toArray().every(Number.isFinite)&&chip.dir.toArray().every(Number.isFinite));
  assert(Math.abs(chip.dir.length()-1)<1e-6);
  assert(chip.size<=2.1&&chip.stretch<=1.3,'oversized needle dimensions returned');
  builtChips++;
}
assert.equal(builtChips,400);

/* Build the actual ShaderMaterial to check all new uniforms and geometry
   attributes. This is a structural shader check, not GPU/visual QA. */
context.col=value=>new THREE.Color(value);
context.backdropRT={texture:new THREE.Texture()};
context.spectrumTex=new THREE.Texture(); context.stoneNormal=new THREE.Texture();
context.envCube={texture:new THREE.CubeTexture()};
const noiseDeclaration=source.match(/const NOISE_GLSL = [^\x60]*\x60[\s\S]*?\x60;/)[0];
vm.runInContext(noiseDeclaration,context);
vm.runInContext(extract('const glassUniforms =','/* The intro\'s lines:'),context);
const material=vm.runInContext('glassMat',context);
for (const match of material.fragmentShader.matchAll(/uniform\s+\w+\s+([^;]+);/g)) {
  for (const name of match[1].split(',').map(s=>s.trim().replace(/\[.*\]/,''))) {
    assert(name in material.uniforms, 'unbound shader uniform '+name);
  }
}
for (const key of ['conchNormal','conchScale','conchCoverage','conchPolish','cutLipPx','cutLip','cutSpecCap']) {
  assert(seen.has('rock.'+key),'missing detail control '+key);
}
assert(material.vertexShader.includes('vFracture = aFracture;'));
assert(material.fragmentShader.includes('float shellFace = vCrack * (1. - cutFace)'));
assert(material.fragmentShader.includes('mapN.xy *= uNormalScale * shellFace;'));
assert(material.fragmentShader.includes('arcMask = cutFace *'),'arc appears on intact exterior');
assert(material.fragmentShader.includes('float cutLip = cutFace *'),'lip appears on intact exterior');
assert(material.fragmentShader.includes('min(uSpecCap, uCutSpecCap)'),'cut highlights are uncapped');
assert(source.includes('for (const m of fore) { m.userData.wasVisible = m.visible; m.visible = false; }'),'foreground glass can sample its own target');
assert(!source.includes('new THREE.TetrahedronGeometry(1, 0)'),'long tetrahedron needles remain');

/* Preserve the current authored passage rather than obsolete pacing
   expectations from a prior version of the page. */
context.SCROLL={max:CONFIG.scroll.max};context.BREAK={plan:null};
evaluateFunction('diveNarrative');
vm.runInContext(extract('function sequenceBounds()','function updateScroll('),context);
let previousView=-1;
for (let i=0;i<=2000;i++) {
  const p=CONFIG.scroll.max*i/2000, a=context.flashState(p), b=context.flashState(p);
  assert.deepEqual(a,b,'state depends on sampling order');
  assert(Object.values(a).every(Number.isFinite),'invalid transition');
  const view=context.narrativePosition(p);
  assert(view>=previousView-1e-9,'camera mapping reversed'); previousView=view;
}
console.log(JSON.stringify({syntax:'passed',controls:seen.size,metadataVertices,planeError,
  realCutChipSamples:cutSamples,shaderBindings:'passed',shellContinuity:'passed',
  deterministicCutSampling:'passed',authoredPassage:'finite and monotonic'},null,2));
