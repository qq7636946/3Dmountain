// The existing outer watershed in world XZ. The tessellator and the toe
// stones follow the same warped stream centrelines as stWatershedEx.
const STREAMS = [
  [-6.26,-3.57,-.76,-.65,12.4,.155,.095,.78,.44,.4],
  [5.58,-3.64,.50,-.86,12.2,.160,.100,.85,.42,1.9],
  [-6.86,1.47,-.88,.47,12,.155,.095,.74,.46,3.1],
  [6.72,3.68,.62,.78,12,.165,.105,.82,.40,5.2],
  [-8.20,-5.15,-.22,-.97,8.8,.13,.048,.62,.68,1.1],
  [-9.65,-6.30,-.98,-.18,8.2,.12,.048,.56,.74,2.6],
  [6.85,-5.65,-.18,-.98,8.4,.14,.048,.66,.64,4],
  [7.65,-7.15,.88,-.47,8.8,.13,.048,.58,.70,.7],
  [6.45,-4.95,.94,-.34,9.2,.12,.048,.65,.66,5.5],
  [-9.85,3.05,-.96,-.26,7.8,.12,.048,.54,.76,1.8],
  [-9.15,2.85,-.34,.94,9.2,.14,.048,.64,.66,3.4],
  [7.55,5.85,-.26,.96,8.8,.14,.050,.64,.64,2.2],
  [8.25,7.25,.86,.51,9.2,.13,.048,.60,.70,4.7]
].map(([x,z,dx,dz,...rest]) => { const l=Math.hypot(dx,dz); return [x,z,dx/l,dz/l,...rest]; });
const clamp = v => Math.max(0,Math.min(1,v));
const smooth = (a,b,v) => { const t=clamp((v-a)/(b-a)); return t*t*(3-2*t); };
const hash = (x,y) => { const a=Math.sin(x*127.1+y*311.7)*43758.5453; return a-Math.floor(a); };
function noise(x,y) {
  const ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
  const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const a=hash(ix,iy)*(1-u)+hash(ix+1,iy)*u;
  const b=hash(ix,iy+1)*(1-u)+hash(ix+1,iy+1)*u;
  return a*(1-v)+b*v;
}
function fbm(x,y) {
  let v=0,a=.5;
  for(let i=0;i<3;i++) {
    v+=a*noise(x,y);
    const nx=(.8*x+.6*y)*2.05+9.3;
    y=(-.6*x+.8*y)*2.05+5.7; x=nx; a*=.5;
  }
  return v;
}
function riverWarp(x,z,outD) {
  const ramp=smooth(0,1.65,outD);
  return [
    ((fbm(x*.26+2.4,z*.26-3.8)-.5)*2.15+(noise(x*1.45+1.3,z*1.45+8.2)-.5)*.34)*ramp,
    ((fbm(x*.26-6.1,z*.26+4.9)-.5)*2.15+(noise(x*1.45-4.7,z*1.45+2.1)-.5)*.34)*ramp
  ];
}

function nearBank(x,z,outD,margin) {
  const warp=riverWarp(x,z,outD), px=x+warp[0], pz=z+warp[1];
  for(const [ox,oz,dx,dz,len,w0,w1,amp,freq,ph] of STREAMS) {
    const rx=px-ox,rz=pz-oz,t=rx*dx+rz*dz,s=-rx*dz+rz*dx;
    const reach=Math.max(w0,w1)*1.44*2.8+margin;
    if(t < -reach || t > len+reach || Math.abs(s)>amp*1.36+reach) continue;
    const tc=Math.max(0,Math.min(len,t));
    const meander=(Math.sin(tc*freq+ph)+.36*Math.sin(tc*freq*2.13+ph*1.7))*amp*smooth(0,1.35,tc);
    const distance=Math.hypot(s-meander,Math.max(0,-t,t-len));
    const w=(w0+(w1-w0)*smooth(0,1,tc/len))*1.44;
    if(distance < w*2.8+margin) return true;
  }
  return false;
}

export function refineHeadwaterBanks(fine,xs,zs,coreW,coreD) {
  const cx=xs.length-1,cz=zs.length-1;
  let cells=0;
  for(let z=0;z<cz;z++) for(let x=0;x<cx;x++) {
    const wx=(xs[x]+xs[x+1])*.5,wz=(zs[z]+zs[z+1])*.5;
    if(Math.abs(wx)<coreW*.5-.30 && Math.abs(wz)<coreD*.5-.30) continue;
    const outD=Math.hypot(Math.max(0,Math.abs(wx)-coreW*.5),Math.max(0,Math.abs(wz)-coreD*.5));
    if(outD>7.8) continue;
    const margin=Math.hypot(xs[x+1]-xs[x],zs[z+1]-zs[z])*.65+.10;
    if(nearBank(wx,wz,outD,margin)) { if(!fine[z*cx+x]) cells++; fine[z*cx+x]=1; }
  }
  return cells;
}

// Broken slabs collect at the foot of scattered cut banks. Each deposit
// rests on the river datum; rising terrain naturally buries its inland edge.
export function headwaterStones(bounds) {
  const stones = [];
  const halfWidth = 0.5 / bounds.z, halfDepth = 0.5 / bounds.w;
  const outside = (x,z) => Math.hypot(Math.max(0,Math.abs(x)-halfWidth), Math.max(0,Math.abs(z)-halfDepth));
  let seed = 7631;
  function random() {
    seed = (Math.imul(1664525,seed)+1013904223) >>> 0;
    return seed / 4294967296;
  }
  for (const [ox,oz,dx,dz,length,w0,w1,amp,freq,phase] of STREAMS) {
    for (let t=0.48+random(); t<length-0.45; t+=0.72+random()*1.55) {
      const wave = t*freq+phase, harmonic = t*freq*2.13+phase*1.7;
      const meander = (Math.sin(wave)+0.36*Math.sin(harmonic))*amp*smooth(0,1.35,t);
      const side = Math.sin(wave)+0.65*Math.sin(harmonic) >= 0 ? 1 : -1;
      const width = w0+(w1-w0)*smooth(0,1,t/length);
      const lateral = meander+side*width*(0.92+0.28*random());
      const riverX = ox+dx*t-dz*lateral, riverZ = oz+dz*t+dx*lateral;
      let x=riverX, z=riverZ;
      // Invert the displacement at this reach. Under-relax the iteration
      // on tight bends where the small-scale warp turns back on itself.
      for (let step=0; step<7; step++) {
        const warp = riverWarp(x,z,outside(x,z));
        x += 0.65*(riverX-x-warp[0]);
        z += 0.65*(riverZ-z-warp[1]);
      }
      const outD = outside(x,z);
      if (outD<0.50 || outD>7.7) continue;
      const tangent = Math.atan2(dz,dx)+Math.atan(amp*freq*(Math.cos(wave)+0.77*Math.cos(harmonic)));
      const tx = Math.cos(tangent), tz = Math.sin(tangent);
      const count = 3+Math.floor(random()*5);
      for (let i=0; i<count; i++) {
        const along = (random()+random()-1)*width*1.85;
        const across = (random()-0.5)*width*0.58;
        const radius = width*(i===0 ? 0.40+0.28*random() : 0.12+0.24*random());
        stones.push({
          anchor:[x+tx*along-tz*across, 0, z+tz*along+tx*across, 0],
          shape:[radius, radius*(0.42+0.34*random()), radius*(0.49+0.38*random()), tangent+(random()-0.5)*1.20],
          grain:[random(), random(), random(), 0.22+0.15*random()]
        });
      }
    }
  }
  return stones;
}
