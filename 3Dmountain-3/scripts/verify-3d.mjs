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

vm.runInContext(extract('function sequenceBounds()', 'function updateScroll('), context);
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
assert(!source.includes('shapeDrop('), 'removed sphere deformation call remains');
assert(!source.includes('new THREE.WireframeGeometry(g)'), 'triangle wireframe remains');
context.SCROLL = { introDone: true, max: CONFIG.scroll.max };
vm.runInContext(extract('const KEYS =', 'const SC = CONFIG.scroll;'), context);
for (const removed of ['MarchingCubes', 'const heroOrb', 'const dropMesh', 'const beads', 'SPLASH', 'CONFIG.drop', 'updateFluidSurface', 'disturbWater']) {
  assert(!source.includes(removed), 'inactive water pipeline remains: ' + removed);
}
assert(TUNING.every(([, rows]) => rows.every(([, group]) => group !== 'drop' && group !== 'hero')));
assert.equal(CONFIG.drop, undefined, 'obsolete drop settings remain');
const q = context.sequenceBounds();
function traverse(from, to) {
  let p = from, seconds = 0;
  for (let i = 0; i < 12000 && Math.abs(p-to) > 1e-7; i++) {
    const next = context.paceSequence(p, to, 1/120);
    assert(Number.isFinite(next) && (to>from ? next>=p && next<=to : next<=p && next>=to));
    p=next; seconds += 1/120;
  }
  assert(Math.abs(p-to) < 1e-7, 'sequence failed to reach target');
  return seconds;
}
const forward = traverse(CONFIG.rock.breakAt, q.end);
const reverse = traverse(q.end, CONFIG.rock.breakAt);
assert(Math.abs(forward-reverse) < .02, 'reverse pace does not match');
const duration = CONFIG.rock.breakSeconds + CONFIG.flash.seconds;
assert(forward >= duration - .02, 'fast scroll skipped sequence');
for (let p = 0; p <= CONFIG.scroll.max; p += .003) {
  assert(context.narrativePosition(p + .001) >= context.narrativePosition(p) - 1e-7, 'camera mapping reverses');
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
  g.dispose();part.geometry.dispose();
}
const markAreaError=Math.abs(markOuterArea-originalMark.area)/originalMark.area;
const markVolumeError=Math.abs(markVolume-originalMark.volume)/Math.abs(originalMark.volume);
console.log(JSON.stringify({actualLogo:{parts:parts.length,markTriangles,markAreaError,markVolumeError,buildMilliseconds:performance.now()-buildStarted}},null,2));
assert(markAreaError<1e-5,'actual logo silhouette changed');
assert(markVolumeError<.005,'actual logo cut walls are not closed');

/* Read the actual crack-lighting block. Its value must be continuous
   across whole -> shard handover at every phase of the idle shimmer. */
const seamStart=source.indexOf('    const k = BREAK.k, si = Math.max(.02, RK.seamIn);');
const seamEnd=source.indexOf('    /* The front crosses',seamStart);
assert(seamStart>=0&&seamEnd>seamStart,'crack lighting block');
context.BREAK={k:0};context.glassUniforms.uSeam={value:0};
let handoverLightJump=0;
for(let time=0;time<3;time+=.013){
  context.time=time;
  context.BREAK.k=CONFIG.rock.seamIn-1e-8;
  vm.runInContext('{'+source.slice(seamStart,seamEnd)+'}',context);
  const before=context.glassUniforms.uSeam.value;
  context.BREAK.k=CONFIG.rock.seamIn+1e-8;
  vm.runInContext('{'+source.slice(seamStart,seamEnd)+'}',context);
  handoverLightJump=Math.max(handoverLightJump,Math.abs(before-context.glassUniforms.uSeam.value));
}
assert(handoverLightJump<1e-6,'crack illumination jumps at handover');


/* Deterministic light/camera checks, without browser automation. */
let maxLightStep = 0, maxCoverStep = 0, previousFlash = null, cameraCrossings = 0, previousY = null;
const storedStates = [];
for (let i = 0; i <= 1600; i++) {
  const p = q.breakEnd + (q.end - q.breakEnd) * i / 1600;
  const state = context.flashState(p), view = context.narrativePosition(p), pose = context.sample(view);
  for (const v of Object.values(state)) assert(Number.isFinite(v) && v >= 0 && v <= 1, 'invalid flash value');
  if (state.shardAlpha > .001 && state.shardAlpha < .999) assert.equal(state.cover, 1, 'shards exit without cover');
  if (pose.deep > 0 && pose.deep < 1) assert(state.cover > .99, 'waterline lighting swap is exposed');
  if (previousFlash) {
    maxLightStep = Math.max(maxLightStep, Math.abs(state.light - previousFlash.light));
    maxCoverStep = Math.max(maxCoverStep, Math.abs(state.cover - previousFlash.cover));
    assert(state.shardAlpha <= previousFlash.shardAlpha + 1e-10, 'shards reappear during dive');
  }
  if (previousY !== null) {
    assert(pose.cam[1] <= previousY + 1e-9, 'camera rises during dive');
    if (previousY >= 0 && pose.cam[1] < 0) cameraCrossings++;
  }
  storedStates.push(JSON.stringify({state, view}));
  previousFlash = state; previousY = pose.cam[1];
}
for (let i = 1600; i >= 0; i--) {
  const p = q.breakEnd + (q.end - q.breakEnd) * i / 1600;
  assert.equal(JSON.stringify({state:context.flashState(p),view:context.narrativePosition(p)}), storedStates[i], 'reverse differs');
}
assert.equal(cameraCrossings, 1, 'camera does not cross water exactly once');
assert(maxLightStep < .006 && maxCoverStep < .006, 'light pulse has a discontinuity');
for (const p of [0, CONFIG.rock.breakAt, q.breakEnd, q.end, CONFIG.scroll.max]) {
  assert.equal(context.flashState(p).light, 0, 'light leaks outside transition');
}
assert.equal(context.flashState(q.breakEnd).shardAlpha, 1, 'solid fragments disappear before the flash');
assert.equal(context.flashState(q.end).shardAlpha, 0, 'fragments remain underwater');
for (const p of [q.breakEnd, q.end]) {
  const epsilon = 1e-6;
  const center = context.narrativePosition(p);
  assert(Math.abs(context.narrativePosition(p-epsilon)-center) < 1e-6);
  assert(Math.abs(context.narrativePosition(p+epsilon)-center) < 1e-6);
  const left = (center-context.narrativePosition(p-epsilon))/epsilon;
  const right = (context.narrativePosition(p+epsilon)-center)/epsilon;
  assert(Math.abs(left-right) < .001, 'camera velocity jumps at a transition join');
}
assert(source.indexOf('composer.addPass(flashPass)') > source.indexOf('composer.addPass(new OutputPass())'), 'grading erases full light cover');
assert(source.includes('color += uBurstColor * uEmissive'), 'emission slider does not reach the Logo shader');
assert(source.includes('REDUCED_MOTION.matches ? 0 : FLASH.light'), 'reduced motion lacks a non-flashing path');
assert(source.includes('REDUCED_MOTION.matches ? CONFIG.sky.under : CONFIG.flash.color'), 'reduced motion still flashes white');
assert(source.includes('m.scale.setScalar(Math.max(.001, 1 - RK.shrink * e * e))'), 'fragments still melt');
assert(source.includes('cleanPassage ? 0 :'), 'glitch can streak during light transition');
assert(source.includes('new THREE.Mesh(g, glassMat)') && source.includes('new THREE.Mesh(sh.geometry, glassMat)'), 'whole and shards do not share material');
console.log(JSON.stringify({
  syntax:'passed', controls:seen.size, removedIntroWater:'passed',
  handoverLightJump, forwardSeconds:forward, reverseSeconds:reverse,
  transitionSamples:1601, cameraCrossings, maxLightStep, maxCoverStep,
  reverse:'exact', cameraJoinVelocity:'continuous', waterline:'fully covered'
}, null, 2));
