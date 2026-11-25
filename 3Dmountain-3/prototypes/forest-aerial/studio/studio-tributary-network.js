import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const V = p => new THREE.Vector2(...p);

// Sources → confluences, all in the existing terrain's world XZ coordinates.
// Every primary ends on a known main-river centreline. Smaller channels join
// a parent curve, so intersections share both position and bed elevation.
const PRIMARY = [
  [[-.90,-3.55],[-1.70,-3.00],[-1.50,-1.80],[-2.10,-1.39]],
  [[-3.80,-3.72],[-3.15,-3.38],[-3.90,-2.85],[-3.51,-2.30]],
  [[-5.75,-.65],[-5.80,-1.50],[-4.50,-1.90],[-4.26,-2.59]],
  [[.55,-3.60],[.90,-2.60],[2.30,-2.30],[2.36,-1.20]],
  [[3.70,-.25],[4.15,-.55],[3.50,-1.05],[2.91,-1.31]],
  [[6.70,-1.10],[6.30,-1.90],[5.80,-2.00],[5.25,-2.80]],
  [[.35,3.60],[.90,2.85],[1.90,3.10],[2.65,2.17]],
  [[3.35,.35],[4.00,.80],[3.20,1.60],[3.90,2.30]],
  [[6.20,.45],[6.70,1.30],[5.35,1.75],[5.67,2.78]],
  [[-.65,3.50],[-1.50,2.70],[-2.30,1.60],[-2.53,.50]],
  [[-3.80,3.50],[-4.80,2.90],[-3.65,1.60],[-4.41,.70]],
  [[-6.70,2.90],[-5.80,2.90],[-6.20,1.70],[-5.43,1.27]]
];
const SECONDARY = [
  { source: [-2.65,-3.60], parent: 0, t: .38 },
  { source: [-6.50,-2.00], parent: 2, t: .66 },
  { source: [2.20,-3.65], parent: 3, t: .59 },
  { source: [6.80,-2.30], parent: 5, t: .37 },
  { source: [2.25,3.80], parent: 6, t: .71 },
  { source: [5.10,.50], parent: 8, t: .56 },
  { source: [-2.45,3.70], parent: 9, t: .42 },
  { source: [-5.70,3.60], parent: 10, t: .63 }
];
// Downstream tangents of the existing four main rivers, at each confluence.
const MOUTH_DIRECTIONS = [[.71,.15],[.65,.31],[.75,.29],[-.64,.01],[-.55,.11],[-.43,.23],[-.12,-.57],[-.65,.03],[-.50,-.10],[.26,-.31],[.37,-.12],[.48,-.22]];
const CHANNEL_WIDTHS = [.068,.049,.091,.077,.052,.085,.093,.055,.072,.086,.062,.079];
const hash = x => { const n = Math.sin(x * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
function noise(x) { const i = Math.floor(x); return THREE.MathUtils.lerp(hash(i),hash(i+1),smooth(0,1,x-i)); }

function joiningDirection(downstream, incoming, maxAngle = .43) {
  const d = downstream.clone().normalize(), v = incoming.clone().normalize();
  const a = clamp(Math.atan2(d.x*v.y-d.y*v.x,d.dot(v)),-maxAngle,maxAngle);
  return new THREE.Vector2(d.x*Math.cos(a)-d.y*Math.sin(a),d.x*Math.sin(a)+d.y*Math.cos(a));
}

function naturalCurve(points, downstream, seed, sampleHeight, amplitude) {
  const p = points.map(V), end = p[3];
  const exit = joiningDirection(downstream,end.clone().sub(p[2]));
  const receivingTangent=downstream.clone().normalize();
  const guide = new THREE.CubicBezierCurve(...p), knots = [];
  const handle = Math.min(1.48,guide.getLength()*.65);
  const outlet = new THREE.Vector2();
  for(let i=0;i<=40;i++) {
    const t=i/40, q=guide.getPoint(t), tangent=guide.getTangent(t);
    const normal=new THREE.Vector2(-tangent.y,tangent.x);
    // Keep the authored middle bend. Only the last reach turns to follow the receiver.
    const envelope=smooth(0,.10,t)*(1-smooth(.70,.97,t));
    const relief=sampleHeight(q.clone().addScaledVector(normal,.20))-sampleHeight(q.clone().addScaledVector(normal,-.20));
    const wander=(noise(t*3.7+seed*9.1)-.5)*2 + .62*(noise(t*8.1+seed*3.3)-.5);
    q.addScaledVector(normal,envelope*(wander*amplitude-clamp(relief*1.35,-.13,.13)));
    outlet.copy(exit).lerp(receivingTangent,smooth(.81,.99,t)).normalize().multiplyScalar(-handle*(1-t)).add(end);
    q.lerp(outlet,smooth(.64,.99,t));
    knots.push(q);
  }
  for(let pass=0;pass<2;pass++) {
    const previous=knots.map(p=>p.clone());
    for(let i=1;i<knots.length-2;i++)knots[i].copy(previous[i]).multiplyScalar(.60).addScaledVector(previous[i-1],.20).addScaledVector(previous[i+1],.20);
  }
  knots[39].copy(end).addScaledVector(receivingTangent,-Math.max(.015,knots[38].distanceTo(end)*.48));
  return new THREE.SplineCurve(knots);
}

// Fixed reaches keep gravel bars and riffle crests attached to the bed as the water moves.
function makeReaches(curve, seed, primary) {
  const length=curve.getLength();
  const count=Math.min(primary ? 6 : 3,Math.max(2,Math.round(length/.49)));
  return Array.from({length:count},(_,i)=>{
    const u=.14+.69*(i+.18+.60*hash(seed*11+i))/(count);
    const t=curve.getUtoTmapping(u);
    return { t, span:(.23+.12*hash(seed*15+i))/count,
      side:hash(seed+i*7)>.5 ? 1 : -1,
      split:primary && (i+seed)%3===1 };
  });
}

function bedProfile(source, end, endSlope, reaches) {
  const drop=source-end, m0=-drop*1.12, m1=clamp(endSlope,-drop*1.4,0);
  return t => {
    let u=t;
    for (const reach of reaches) {
      const d=(t-reach.t)/reach.span;
      if (Math.abs(d)<1) u+=.58*reach.span*d*(1-d*d)**2;
    }
    return (2*u*u*u-3*u*u+1)*source+(u*u*u-2*u*u+u)*m0+(-2*u*u*u+3*u*u)*end+(u*u*u-u*u)*m1;
  };
}

function channelSection(stream,t) {
  const a=stream.curve.getTangent(clamp(t-.018)), b=stream.curve.getTangent(clamp(t+.018));
  const bend=clamp((a.x*b.y-a.y*b.x)*3.2,-1,1);
  const pool=noise(t*stream.length*1.35+stream.seed*7.8);
  const bar=noise(t*stream.length*3.2+stream.seed*2.7);
  let discharge=1;
  for(const join of stream.joins)discharge+=.09*smooth(join-.03,join+.11,t);
  let riffle=0, deposit=0, split=0;
  let barAxis=bend*.56;
  for (const reach of stream.reaches) {
    const d=(t-reach.t)/reach.span;
    riffle=Math.max(riffle,1-smooth(.12,.84,Math.abs(d)));
    const lens=1-smooth(.09,1.40,Math.abs(d-.63));
    if (lens<=deposit) continue;
    deposit=lens;
    const inside=Math.abs(bend)>.25 ? Math.sign(bend) : reach.side;
    barAxis=inside*(reach.split ? .13 : .54)+d*.10;
    split=reach.split ? lens : 0;
  }
  const growth=.27+.73*Math.pow(t,.64);
  const radius=stream.width*.81*growth*(.61+pool*.87)*(1+Math.abs(bend)*.25)*discharge*
               (1+.32*deposit-.11*riffle+.13*smooth(.83,1,t));
  return {radius,bend,pool,bar,barAxis,riffle,deposit,split,bankNoise:noise(t*5.3+stream.seed),bed:stream.bed(t)};
}

function readPixels(image, width, height) {
  if (image.data && image.width === width && image.height === height) return new Uint8ClampedArray(image.data);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

function dataTexture(pixels, width, height, original, name) {
  const tex = new THREE.DataTexture(new Uint8Array(pixels.buffer), width, height, THREE.RGBAFormat);
  for (const key of ['flipY', 'wrapS', 'wrapT', 'minFilter', 'magFilter', 'generateMipmaps', 'anisotropy', 'colorSpace']) tex[key] = original[key];
  tex.name = name; tex.needsUpdate = true;
  return tex;
}

/* optR (team R, 2026-11-21): the build below is one 0.5-0.7 s block of CPU work (pieces of up to 0.43 s while the visitor is under water, in the
   opening). It is now a generator: every statement is as it was, and it only gives the thread back (yield) between iterations when its caller
   asked for slices (due() true). createTributaryNetwork() runs it to the end in one go, exactly as before; createTributaryNetworkAsync() hands the
   thread back every few milliseconds, so the opening keeps drawing. The result is the same bytes: nothing reads the data until the last statement. */
function* buildTributaryNetwork(atlas, due) {
  const started = performance.now();
  const U = atlas.uniforms, originalWater = U.tWater.value, originalHeight = U.tCanopy.value;
  const { width, height } = originalHeight.image;
  const terrain = readPixels(originalHeight.image, width, height);
  const water = readPixels(originalWater.image, width, height);
  const originalLake = new Uint8Array(width * height);
  const influence = new Float32Array(width * height);
  const bedField = new Float32Array(width * height);
  const creekWet = new Uint8Array(width * height);
  const creekDepth = new Uint8Array(width * height);
  const B = U.uBounds.value, Y = U.uYRange.value;
  for (let i = 0; i < width * height; i++) { originalLake[i] = water[i * 4 + 2]; water[i * 4 + 3] = 0; }
  const pixel = p => [clamp((p.x - B.x) * B.z) * (width - 1), clamp((p.y - B.y) * B.w) * (height - 1)];
  const sample = (p, data = terrain, channel = 0) => {
    const [x, y] = pixel(p), x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
    const a = data[(y0 * width + x0) * 4 + channel], b = data[(y0 * width + x1) * 4 + channel];
    const c = data[(y1 * width + x0) * 4 + channel], d = data[(y1 * width + x1) * 4 + channel];
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a,b,x-x0), THREE.MathUtils.lerp(c,d,x-x0), y-y0) / 255;
  };
  const sourceBed = (p, end) => Math.max(end + .018, Math.min(end + .46, (Y.x + sample(p) * Y.y - .105) * .92));
  const streams = PRIMARY.map((points, i) => {
    const curve = naturalCurve(points,V(MOUTH_DIRECTIONS[i]),i+1,p=>sample(p),.20+(i%4)*.035);
    const source = sourceBed(curve.getPoint(0), 0);
    const reaches=makeReaches(curve,i+1,true);
    return { id: `T${String(i + 1).padStart(2, '0')}`, curve, parent: null, seed:i+1, length:curve.getLength(), width:CHANNEL_WIDTHS[i], joins:[], reaches, bed:bedProfile(source,0,0,reaches) };
  });
  for (const branch of SECONDARY) {
    const parent = streams[branch.parent], end = parent.curve.getPoint(branch.t), start = V(branch.source);
    const delta = end.clone().sub(start), mid = start.clone().lerp(end, .34).add(new THREE.Vector2(-delta.y, delta.x).multiplyScalar(.12));
    const seed=streams.length+1;
    const curve=naturalCurve([start.toArray(),mid.toArray(),start.clone().lerp(end,.70).toArray(),end.toArray()],parent.curve.getTangent(branch.t),seed,p=>sample(p),.09+(seed%3)*.025);
    const endBed = parent.bed(branch.t), source = sourceBed(start, endBed);
    const dt=.002, t0=branch.t-dt, t1=branch.t+dt;
    const parentRun=parent.curve.getPoint(t0).distanceTo(parent.curve.getPoint(t1));
    const parentGrade=(parent.bed(t1)-parent.bed(t0))/Math.max(.0001,parentRun);
    const slope=parentGrade*curve.getPoint(1-dt).distanceTo(end)/dt;
    parent.joins.push(branch.t);
    const reaches=makeReaches(curve,seed,false);
    const child={id:`T${String(seed).padStart(2,'0')}`,curve,parent:parent.id,joinT:branch.t,seed,length:curve.getLength(),width:.034+(seed%4)*.006,joins:[],reaches,bed:bedProfile(source,endBed,slope,reaches)};
    child.width*=Math.min(1,Math.max(.022,channelSection(parent,branch.t).radius*.64)/channelSection(child,1).radius);
    streams.push(child);
  }

  // Bake once into channels already sampled by the terrain. Water RGB retains
  // its mask/depth/lake meaning outside the new channels. Creek RG stores
  // coverage and optical depth, BA stores bed elevation and bank influence.
  // Height B stores current heading; height R/G and arrival A remain intact.
  const dxWorld = 1 / (B.z * (width - 1)), dzWorld = 1 / (B.w * (height - 1));
  const nearest = new Float32Array(width*height), along = new Float32Array(width*height), side = new Float32Array(width*height), headings = new Float32Array(width*height);
  for (const stream of streams) {
    nearest.fill(Infinity);
    const touched=[],steps=Math.max(64,Math.ceil(stream.length/.017));
    // Section data is sampled once along the curve, not evaluated for every
    // terrain pixel. Curvature controls inner bars versus outer cut banks.
    const sections=Array.from({length:steps+1},(_,i)=>channelSection(stream,i/steps));
    for (let j = 0; j < steps; j++) {
      const t0 = j / steps, t1 = (j + 1) / steps;
      const a = stream.curve.getPoint(t0), b = stream.curve.getPoint(t1), delta = b.clone().sub(a);
      const len2=Math.max(delta.lengthSq(),1e-8),length=Math.sqrt(len2);
      const maxBank=Math.max(sections[j].radius,sections[j+1].radius)*7.2+.22;
      const [ax, ay] = pixel(a), [bx, by] = pixel(b);
      const loX = Math.max(0, Math.floor(Math.min(ax,bx) - maxBank / dxWorld));
      const hiX = Math.min(width-1, Math.ceil(Math.max(ax,bx) + maxBank / dxWorld));
      const loY = Math.max(0, Math.floor(Math.min(ay,by) - maxBank / dzWorld));
      const hiY = Math.min(height-1, Math.ceil(Math.max(ay,by) + maxBank / dzWorld));
      const heading = Math.atan2(delta.y, delta.x);
      for (let py = loY; py <= hiY; py++) for (let px = loX; px <= hiX; px++) {
        const index = py * width + px;
        if (originalLake[index] > 150) continue;
        const x = B.x + px * dxWorld, z = B.y + py * dzWorld;
        const q = clamp(((x-a.x)*delta.x+(z-a.y)*delta.y)/len2);
        const dx=x-a.x-delta.x*q, dz=z-a.y-delta.y*q;
        const distanceSq=dx*dx+dz*dz;
        if (distanceSq >= maxBank*maxBank || distanceSq >= nearest[index]) continue;
        if (!Number.isFinite(nearest[index])) touched.push(index);
        nearest[index]=distanceSq; along[index]=THREE.MathUtils.lerp(t0,t1,q);
        side[index]=((x-a.x)*-delta.y+(z-a.y)*delta.x)/length;
        headings[index]=heading;
      }
      if (due && due()) yield;
    }
    let slicing = 0;
    for(const index of touched) {
      if (due && (++slicing & 127) === 0 && due()) yield;
      const k=index*4,t=along[index],f=t*steps,j=Math.min(steps-1,Math.floor(f)),mix=f-j;
      const s0=sections[j],s1=sections[j+1];
      const bend=THREE.MathUtils.lerp(s0.bend,s1.bend,mix),pool=THREE.MathUtils.lerp(s0.pool,s1.pool,mix);
      const bar=THREE.MathUtils.lerp(s0.bar,s1.bar,mix);
      const radius=THREE.MathUtils.lerp(s0.radius,s1.radius,mix);
      const riffle=THREE.MathUtils.lerp(s0.riffle,s1.riffle,mix);
      const deposit=THREE.MathUtils.lerp(s0.deposit,s1.deposit,mix);
      const split=THREE.MathUtils.lerp(s0.split,s1.split,mix);
      const axis=THREE.MathUtils.lerp(s0.barAxis,s1.barAxis,mix);
      const inside=Math.sign(side[index])*bend;
      const waterRadius=radius*(1-.21*inside);
      const centerBed=THREE.MathUtils.lerp(s0.bed,s1.bed,mix);
      const ground=Math.max(0,Y.x+terrain[k]/255*Y.y-.105);
      const shoulder=Math.min(.18,Math.max(0,ground-centerBed)*(.32+.17*inside));
      const bank=radius*(3.8+inside*1.63+.9*THREE.MathUtils.lerp(s0.bankNoise,s1.bankNoise,mix)+deposit*.50)+.034+shoulder;
      const dist=Math.sqrt(nearest[index]),taper=smooth(0,.12,t);
      const carve=(1-smooth(waterRadius*1.10,bank,dist))*taper;
      if(carve<.001)continue;
      const crossSection=side[index]/Math.max(radius,.001);
      const transverse=crossSection-axis;
      const pointBar=deposit*(1-smooth(.07,.62,Math.abs(transverse)));
      // Only a bar wider than several texels can emerge. In a narrow headwater
      // the same deposit stays submerged and both banks remain connected.
      const resolvable=smooth(2.8,5.4,radius/Math.max(dxWorld,dzWorld));
      const barCrown=split*resolvable*(1-smooth(.08,.45,Math.abs(transverse)));
      const wet=(1-smooth(waterRadius*.61,waterRadius*1.03,dist))*taper*(1-smooth(.50,.89,barCrown));
      const thread=Math.abs(crossSection+bend*.47+(bar-.5)*.33);
      const barSide=smooth(.12,.76,crossSection*bend+(bar-.5)*.74);
      const bedDepth=(.23+pool*pool*.71)*(1-smooth(.12,1.04,thread))*(1-barSide*.54);
      const depth=(.026+bedDepth*(1-.73*pointBar)*(1-.62*riffle))*smooth(.025,.61,wet);
      const bankShelf=smooth(.38,.92,Math.abs(crossSection))*(1-smooth(1.18,2.1,Math.abs(crossSection)));
      const bed=centerBed+(bankShelf*(.009+.028*barSide)+barCrown*.010)*smooth(0,.055,centerBed),old=influence[index];
      let combined=carve,combinedBed=bed;
      let heading=headings[index]+transverse*pointBar*(.60-deposit)*.45;
      if(old>.001) {
        const h0=ground*(1-old)+bedField[index]*old,h1=ground*(1-carve)+bed*carve;
        // Smooth union rounds the Y junction; a max-mask winner produced a
        // hard seam and abruptly swapped the flow direction at intersections.
        const blend=clamp(.5+.5*(h0-h1)/.018);
        const floor=THREE.MathUtils.lerp(h0,h1,blend)-.018*blend*(1-blend);
        combined=Math.max(old,carve);
        combinedBed=Math.max(0,(floor-ground*(1-combined))/combined);
        const prior=terrain[k+2]/255*Math.PI*2-Math.PI;
        const parentCurrent=creekWet[index]/255;
        const currentBlend=wet+parentCurrent>.002 ? wet/(wet+parentCurrent) : blend;
        heading=Math.atan2(Math.sin(prior)*(1-currentBlend)+Math.sin(heading)*currentBlend,
                           Math.cos(prior)*(1-currentBlend)+Math.cos(heading)*currentBlend);
      }
      influence[index]=combined;bedField[index]=combinedBed;
      water[k+2]=Math.round(clamp(combinedBed/Y.y)*255);
      water[k+3]=Math.round(combined*255);
      terrain[k+2]=Math.round((heading/(2*Math.PI)+.5)*255);
      creekWet[index]=Math.max(creekWet[index],Math.round(wet*255));
      creekDepth[index]=Math.max(creekDepth[index],Math.round(depth*255));
    }
  }
  for(let index=0;index<creekWet.length;index++) {
    if(!creekWet[index])continue;
    const k=index*4;
    const preserveMain=smooth(.20,.88,water[k]/255);
    water[k+1]=Math.round(THREE.MathUtils.lerp(creekDepth[index],water[k+1],preserveMain));
    water[k]=Math.max(water[k],creekWet[index]);
  }
  const packedWater = dataTexture(water,width,height,originalWater,'Highland tributaries / mask, depth, bed, valley');
  const packedHeight = dataTexture(terrain,width,height,originalHeight,'Terrain height / canopy / tributary heading');
  atlas.scene.traverse(object => {
    for (const mat of [].concat(object.material || [])) for (const uniform of Object.values(mat.uniforms || {})) {
      if (uniform.value === originalHeight) uniform.value = packedHeight;
    }
  });
  U.tCanopy.value = packedHeight;
  originalHeight.dispose();
  let enabled = true;
  U.tWater.value = packedWater;
  return {
    streams, width, height,
    texel: new THREE.Vector2(1/width,1/height),
    stats: { primary: PRIMARY.length, secondary: SECONDARY.length, total: streams.length, buildMs: Math.round(performance.now()-started) },
    setEnabled(on) { enabled = !!on; U.tWater.value = enabled ? packedWater : originalWater; },
    sampleHeight(x, z) {
      const p = new THREE.Vector2(x,z);
      let h = Math.max(.105, .105+(Y.x+sample(p)*Y.y-.105)*U.uRelief.value + sample(p,terrain,1)*.12*U.uCanopy.value);
      if (enabled) h = THREE.MathUtils.lerp(h, Math.min(h,.105+sample(p,water,2)*Y.y*U.uRelief.value),sample(p,water,3));
      return h;
    }
  };
}

export function createTributaryNetwork(atlas) {
  const build = buildTributaryNetwork(atlas, null);
  let step; while (!(step = build.next()).done);
  return step.value;
}
/* sliced: the thread goes back to the page (the opening's frames) every `budget` ms of work */
export async function createTributaryNetworkAsync(atlas, budget = 3) {
  let from = performance.now();
  const build = buildTributaryNetwork(atlas, () => performance.now() - from > budget);
  for (;;) {
    const step = build.next();
    if (step.done) return step.value;
    if (globalThis.scheduler?.yield) await globalThis.scheduler.yield(); else await new Promise(go => setTimeout(go, 0));
    from = performance.now();
  }
}
