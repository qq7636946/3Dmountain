// index4-6-3 專用分支（LOGO 山道）：從 water-canyon-watershed.js 複製而來，只有 index4-6-3.html 載入；
// 其他頁面仍用原檔，一個位元組都不受影響。
import { createConfluenceEffects } from './water-confluence-fx-463.js?v=logo-463-1';
export { WATERSHED_FLOW_DEFAULTS } from './water-confluence-fx-463.js?v=logo-463-1';

export const WATERSHED_TERRAIN_DEFAULTS = Object.freeze({height:1,ridge:1,relief:1});

/** One continuous alpine watershed; every tributary drains into the same trunk. */
export function createCanyonWatershed(THREE, {curve,widthAt,createRiver,rockMaterial,rockDark,rockPale,boulderGeometry,flowConfig=null,terrainConfig=null,lite=typeof innerWidth==='number'&&innerWidth<760,shoreDetail=false,mainOverlap=null,relief=null,logoTerrain=null}) {
  // shoreDetail (opt-in): sharper aretes, finer drainage, baked crease tone and a per-vertex
  // shore attribute on every river. Omitted, every line below behaves exactly as before.
  const detail=!!shoreDetail;
  // relief (opt-in, needs shoreDetail): {config,material}. Ridge/valley hierarchy from a warped
  // ridged multifractal, downslope erosion gullies, calmer valley floors and talus aprons, plus a
  // per-vertex (convexity, gully, slope) attribute for the terrain's own material. Omitted: unchanged.
  const R=detail&&relief?relief:null;
  const buildStart=typeof performance==='object'?performance.now():0;
  const reliefNumber=(key,min,max,fallback=1)=>{const value=Number(R?.config?.[key]??fallback);return Math.max(min,Math.min(max,Number.isFinite(value)?value:fallback));};
  const group=new THREE.Group(); group.name='Alpine watershed · five sources, one current';
  const rivers=[],ownedGeometries=[],ownedMaterials=[];
  const refined=flowConfig!==null;
  const terrainSettings={...WATERSHED_TERRAIN_DEFAULTS};
  const terrainNumber=(key,min,max)=>{const value=Number(terrainConfig?.[key]??WATERSHED_TERRAIN_DEFAULTS[key]);return Math.max(min,Math.min(max,Number.isFinite(value)?value:WATERSHED_TERRAIN_DEFAULTS[key]));};
  const readTerrainSettings=()=>R
    ?{height:terrainNumber('height',.5,1.8),ridge:terrainNumber('ridge',0,2),relief:terrainNumber('relief',0,2),reliefRidge:reliefNumber('ridge',0,2),reliefErosion:reliefNumber('erosion',0,2)}
    :{height:terrainNumber('height',.5,1.8),ridge:terrainNumber('ridge',0,2),relief:terrainNumber('relief',0,2)};
  Object.assign(terrainSettings,readTerrainSettings());
  const lerp=THREE.MathUtils.lerp, clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=(a,b,x)=>{const u=clamp((x-a)/(b-a));return u*u*(3-2*u);};
  const fract=x=>x-Math.floor(x),hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7+81.73)*43758.5453);
  function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,ux=fx*fx*(3-2*fx),uy=fy*fy*(3-2*fy);return lerp(lerp(hash(ix,iy),hash(ix+1,iy),ux),lerp(hash(ix,iy+1),hash(ix+1,iy+1),ux),uy);}
  const fbm=(x,y)=>noise(x,y)*.57+noise(x*2.07+13,y*2.07)*.28+noise(x*4.13,y*4.13+19)*.15;
  const v=(x,z)=>new THREE.Vector3(x,0,z);
  // ---- logoTerrain (opt-in: index4-6-3 only, needs relief) -----------------------------------
  // The five rivers end in the brand mark. The spiral band is a ring ridge whose crest height is
  // the stroke's own weight, the hole is a still lake (the eye), the fin a separate hogback. The
  // logo term lives in the MACRO mass, so the page's ridges, erosion, strata, creases and frost
  // grow on it. Omitted, every expression below evaluates exactly as before.
  const LG=refined&&!!R&&!!logoTerrain?.enabled;
  const logoNumber=(key,min,max,fallback)=>{const value=Number(logoTerrain?.[key]??fallback);return Math.max(min,Math.min(max,Number.isFinite(value)?value:fallback));};
  const LOGO_FIN_D='M674.5,292.42v23.5s-48.67,5.25-58,55.42c0,0-10.5-64.33,58-78.92Z';
  const LOGO_BAND_D='M674.5,331.88v29.29s-40.5,14.5-38.5,47.5,40.33,35.5,59.67,28.33,46.89-33.89,28.33-76.33c0,0-13.19-27.14-48.17-28.79v-15.21s44.44,3.5,58.28,42.67c13.83,39.17-7.44,82.49-55.94,85.99s-71.51-55.16-45.01-88.66c0,0,14-19.08,41.33-24.79Z';
  const LGP=LG?{cx:logoNumber('cx',-2000,2000,150),cz:logoNumber('cz',-6500,-4000,-5110),S:logoNumber('scale',8,40,19),
    bandHeight:logoNumber('bandHeight',0,1500,620),finHeight:logoNumber('finHeight',0,2000,820)*(lite?logoNumber('finLite',.5,2,1.15):1),
    flankOut:logoNumber('flankOut',1,30,20),serrate:logoNumber('serrate',0,.5,.10),pinnacles:Math.round(logoNumber('pinnacles',0,32,10)),
    moat:logoNumber('moat',5,120,58),plain:logoNumber('plain',0,300,40),slot:logoNumber('slot',.1,1,.40),lakeInset:logoNumber('lakeInset',0,400,270),
    lineOverLake:logoNumber('lineOverLake',0,1,.06),warp:logoNumber('warp',0,150,40),wallSlope:logoNumber('wallSlope',.4,3,.88),
    gully:logoNumber('gully',0,4,1),saddle:logoNumber('saddle',0,1,1),startLow:logoNumber('startLow',.2,1,.5),
    saddleSharp:logoNumber('saddleSharp',.6,1.6,1.1),ringTone:logoNumber('ringTone',0,1,.72)}:null;
  // Signed distance fields of logo.svg (svg units, negative inside): band, fin and the band's hole.
  // Rasterised once (Path2D), hole = sealed-slit flood fill, two-pass Felzenszwalb EDT.
  function buildLogoField(){
    const started=performance.now(),N=lite?512:800,U0=530,V0=226,SPAN=280,k=N/SPAN,NN=N*N;
    const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(N,N):Object.assign(document.createElement('canvas'),{width:N,height:N});
    const g=canvas.getContext('2d',{willReadFrequently:true});
    const raster=draw=>{g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,N,N);g.setTransform(k,0,0,k,-U0*k,-V0*k);g.fillStyle='#000';draw();
      const d=g.getImageData(0,0,N,N).data,m=new Uint8Array(NN);for(let i=0;i<NN;i++)m[i]=d[i*4+3]>127?1:0;return m;};
    const band=raster(()=>g.fill(new Path2D(LOGO_BAND_D))),fin=raster(()=>g.fill(new Path2D(LOGO_FIN_D)));
    // The band's two ends only touch at a hairline on the axis: seal it, or the hole leaks outside.
    const sealed=raster(()=>{g.fill(new Path2D(LOGO_BAND_D));g.fillRect(673,312,5,26);});
    const outside=new Uint8Array(NN),stack=new Int32Array(NN);let top=0;
    const push=i=>{if(!outside[i]&&!sealed[i]){outside[i]=1;stack[top++]=i;}};
    for(let i=0;i<N;i++){push(i);push(NN-N+i);push(i*N);push(i*N+N-1);}
    while(top){const i=stack[--top],x=i%N;if(x>0)push(i-1);if(x<N-1)push(i+1);if(i>=N)push(i-N);if(i<NN-N)push(i+N);}
    const hole=new Uint8Array(NN);let holeArea=0,hu0=N,hu1=0,hv0=N,hv1=0;
    for(let i=0;i<NN;i++)if(!outside[i]&&!sealed[i]){hole[i]=1;holeArea++;const x=i%N,y=(i/N)|0;hu0=Math.min(hu0,x);hu1=Math.max(hu1,x);hv0=Math.min(hv0,y);hv1=Math.max(hv1,y);}
    const INF=1e20,f=new Float64Array(N),d=new Float64Array(N),vv=new Int32Array(N),zz=new Float64Array(N+1);
    function edt1(){
      let j=0;vv[0]=0;zz[0]=-Infinity;zz[1]=Infinity;
      for(let q=1;q<N;q++){
        let s=((f[q]+q*q)-(f[vv[j]]+vv[j]*vv[j]))/(2*q-2*vv[j]);
        while(s<=zz[j]){j--;s=((f[q]+q*q)-(f[vv[j]]+vv[j]*vv[j]))/(2*q-2*vv[j]);}
        j++;vv[j]=q;zz[j]=s;zz[j+1]=Infinity;
      }
      j=0;for(let q=0;q<N;q++){while(zz[j+1]<q)j++;const r=vv[j];d[q]=(q-r)*(q-r)+f[r];}
    }
    // Euclidean distance (pixels) from every pixel to the nearest pixel where mask===target.
    // Uniform lines (all target / no target) skip the 1-D transform: most of the box is empty.
    function edt(mask,target){
      const a=new Float32Array(NN);for(let i=0;i<NN;i++)a[i]=mask[i]===target?0:INF;
      for(let x=0;x<N;x++){let hit=0;for(let y=0;y<N;y++){const e=a[y*N+x];f[y]=e;if(e===0)hit++;}
        if(hit===0||hit===N)continue;edt1();for(let y=0;y<N;y++)a[y*N+x]=d[y];}
      for(let y=0;y<N;y++){const o=y*N;let finite=0,zero=0;for(let x=0;x<N;x++){const e=a[o+x];f[x]=e;if(e<INF)finite++;if(e===0)zero++;}
        if(zero===N)continue;if(finite===0){a.fill(INF,o,o+N);continue;}edt1();for(let x=0;x<N;x++)a[o+x]=Math.sqrt(d[x]);}
      return a;
    }
    // Half-pixel correction keeps the zero crossing on the pixel edge instead of a 2px step.
    const signed=m=>{const out=edt(m,1),inn=edt(m,0),r=new Float32Array(NN);for(let i=0;i<NN;i++)r[i]=(Math.max(0,out[i]-.5)-Math.max(0,inn[i]-.5))/k;return r;};
    // O: the ring's outer silhouette (band + lake), so the outer apron always climbs from the
    // band's OUTER edge (the band's own field cannot tell its inner edge from its outer one).
    // Outside the silhouette that distance is the band's own; only the inside needs one more pass.
    const B=signed(band),F=signed(fin),H=signed(hole),toOut=edt(outside,1),O=new Float32Array(NN);
    for(let i=0;i<NN;i++)O[i]=outside[i]?B[i]:-Math.max(0,toOut[i]-.5)/k;
    let bandDepth=0,finDepth=0;for(let i=0;i<NN;i++){bandDepth=Math.max(bandDepth,-B[i]);finDepth=Math.max(finDepth,-F[i]);}
    const res={b:99,f:99,h:99,o:99,u:0,v:0};
    const {cx,cz,S}=LGP;
    return {
      N,fieldMs:performance.now()-started,holeArea:holeArea/(k*k),bandDepth,finDepth,
      holeBox:{u0:U0+hu0/k,u1:U0+(hu1+1)/k,v0:V0+hv0/k,v1:V0+(hv1+1)/k},
      toX:u=>cx+(u-683)*S,toZ:v=>cz+(v-386)*S,
      // Bilinear lookup at world (x,z). Beyond the raster box the edge value continues plus the
      // distance outside, so no term can meet a cliff at the box edge. Returns a shared scratch.
      at(x,z){
        const u=683+(x-cx)/S,w=386+(z-cz)/S;res.u=u;res.v=w;
        let px=(u-U0)*k-.5,py=(w-V0)*k-.5;
        const ox=px<0?-px:px>N-1?px-(N-1):0,oy=py<0?-py:py>N-1?py-(N-1):0;
        const extra=ox||oy?Math.hypot(ox,oy)/k:0;
        if(extra>60){res.b=res.f=res.h=res.o=99+extra;return res;}
        px=Math.min(N-1.0001,Math.max(0,px));py=Math.min(N-1.0001,Math.max(0,py));
        const x0=px|0,y0=py|0,fx=px-x0,fy=py-y0,i=y0*N+x0;
        const w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
        res.b=B[i]*w00+B[i+1]*w10+B[i+N]*w01+B[i+N+1]*w11+extra;
        res.f=F[i]*w00+F[i+1]*w10+F[i+N]*w01+F[i+N+1]*w11+extra;
        res.h=H[i]*w00+H[i+1]*w10+H[i+N]*w01+H[i+N+1]*w11+extra;
        res.o=O[i]*w00+O[i+1]*w10+O[i+N]*w01+O[i+N+1]*w11+extra;
        return res;
      }
    };
  }
  const logoField=LG?buildLogoField():null;
  // A gentle domain warp (~2-3 svg units) so shores and crests wander like real ground instead of
  // a perfect offset of the vector outline. Every logo term reads the same warped field.
  // Low frequency on purpose: the warp's stretch also steepens every wall that reads this field.
  // Far from the raster box nothing reads the field, so the warp's two fbm calls are skipped there.
  const logoReject=LG?60+2*LGP.warp/LGP.S+1:0;
  const logoAt=(x,z)=>{
    const u=683+(x-LGP.cx)/LGP.S,w=386+(z-LGP.cz)/LGP.S,ou=Math.max(530-u,u-810,0),ow=Math.max(226-w,w-506,0);
    if(Math.hypot(ou,ow)>logoReject)return logoField.at(x,z);
    return logoField.at(x+(fbm(x*.0014+3.1,z*.0014-5.3)-.5)*2*LGP.warp,z+(fbm(x*.0014-7.7,z*.0014+2.9)-.5)*2*LGP.warp);
  };
  // Ring + fin as mountain mass (added to the macro mass). Each is a concave tent whose crest is
  // the stroke's own weight (a knife-edge where the stroke is thin, a summit shoulder at the thick
  // 10 o'clock end), capped by a wall-slope limit measured from its foot, so no face is ever a
  // vertical stamp: the lake-side foot is pulled `lakeInset` into the hole (a beach and talus
  // bowl), the outer foot is `flankOut` beyond the stroke. A saddle cuts the fin free of the band,
  // the thin start sits lower than the thick end (the spiral's overlap reads as a step), and a
  // misty moat sinks (never deletes) the old massifs around the mark so its planform reads.
  const logoSmin=(a,b,k)=>{const h=Math.max(0,k-Math.abs(a-b))/k;return Math.min(a,b)-h*h*k*.25;};
  function logoMass(x,z,mass){
    const L=logoAt(x,z),b=L.b,f=L.f,h=L.h,o=L.o,lu=L.u,lv=L.v,S=LGP.S;
    const dM=Math.max(0,Math.min(b,f,h));
    if(dM>=LGP.moat&&Math.min(b,f)>=LGP.flankOut+2)return mass;
    const moatMask=(1-smooth(.35*LGP.moat,LGP.moat,dM))*(1-smooth(452,468,lv));
    mass=lerp(mass,LGP.plain,moatMask);
    // Peaks and saddles along the stroke (low frequency) plus a serrated crest (>= 6 samples).
    const crestVar=.74+.46*fbm(x*.0011+13,z*.0011-7)
      -LGP.serrate*(1-Math.abs(2*noise(x*.0065,z*.0065)-1))-.6*LGP.serrate*(1-Math.abs(2*noise(x*.0031+5,z*.0031-3)-1));
    const flankB=LGP.flankOut,flankF=LGP.flankOut+2;
    const k=LGP.wallSlope;
    // Band: the outer apron and the lake-side bowl each rise from their own foot as a concave
    // t^1.3 ramp (a talus foot, steepest just under the crest, the two ramps meeting in a crest
    // line). Each run stretches with the local crest height so its steepest face stays at the wall
    // slope: tall where the stroke is thick (room to climb), a low knife-edge where it is thin.
    const ramp=(d,run)=>Math.pow(clamp(d/Math.max(1,run)),1.3);
    // The bowl's foot sits one beach (~130) above the waterline: the beach itself is the river-bank
    // blend in makeHeightSample, so the two ramps never stack into one steeper step.
    const sB=-b,dOut=Math.max(0,flankB-o)*S,dLake=Math.max(0,h*S+LGP.lakeInset-130);
    const startTaper=1-(1-LGP.startLow)*smooth(672,676,lu)*(1-smooth(680,736,lu))*(1-smooth(336,356,lv));
    // dOut+dLake is the section's foot-to-foot width (constant across it), so the tallest crest
    // that fits under the wall slope is known at every point: the band height is only a ceiling.
    const fit=k*(dOut+dLake)*.5/1.3;
    const crestB=Math.min(LGP.bandHeight*(.52+.48*smooth(2,14,sB)),fit)*crestVar*startTaper,runB=1.3*crestB/k;
    const ringB=crestB*logoSmin(ramp(dOut,runB),ramp(dLake,runB),.1);
    // Fin: a hogback, highest at its thick root, tapering to its tip; a little steeper than the band.
    const sF=-f,dFin=Math.max(0,sF+flankF)*S,kF=k*1.2;
    const crestF=Math.min(LGP.finHeight*(.45+.55*smooth(1,10,sF)),kF*(.8*logoField.finDepth+flankF)*S/1.3)*(.9+.2*crestVar);
    const ringF=crestF*ramp(dFin,1.3*crestF/kF);
    let ring=Math.max(ringB,ringF);
    // The fin-band gap: a V saddle down to the plain on the gap's midline (b = f). Its height climbs
    // away from the midline (|b-f|/2) and past the gap's ends (b+f beyond 13) at no more than the
    // fin's own wall slope (|grad b|, |grad f| <= 1/S), and it is combined as a true minimum with a
    // constant weight: the V eats back into the fin and the shoulder at that slope, so there is no
    // edge gate and no step anywhere across or along the gap.
    if(LGP.saddle>0){const V=LGP.plain+k*LGP.saddleSharp*.5*S*Math.max(Math.abs(b-f),b+f-13);
      if(V<ring+30)ring=lerp(ring,logoSmin(ring,V,30),LGP.saddle);}
    return smoothMax(mass,ring,40);
  }
  // Build-time tone: the logo is dark ink on pale paper, so the stroke itself carries it. The rock
  // darkens by the svg INSIDE depth of the band and the fin (not by height), toward the page's darkest
  // massif rock: the apron, beach, saddle and moat stay pale. Following the stroke interior also
  // restores the logo's thick-left / thin-right weight that the symmetric apron hides.
  const logoInk=LG?new THREE.Color(rockDark??'#526676').multiplyScalar(.5):null;
  // Returns the raw stroke weight: it also goes to aRelief.z, where the terrain shader's live ink
  // pass (CONFIG.logoTerrain.ringContrast) darkens the stroke after the valley haze.
  function logoTint(x,z,color){
    if(x<-1900||x>2200||z<-7400||z>-3500)return 0;
    const L=logoAt(x,z),w=Math.max(smooth(0,6,-L.b),smooth(0,6,-L.f));
    if(w>0)color.lerp(logoInk,w*LGP.ringTone);
    return w;
  }
  // 1 on open water, 0 from the beach up (world distance from the shore, negative in the lake).
  const logoShore=h=>h*LGP.S+LGP.lakeInset,logoLakeMask=h=>smooth(20,-40,logoShore(h));
  function path(points){const c=new THREE.CatmullRomCurve3(points.map(p=>v(...p)),false,'centripetal');c.arcLengthDivisions=1800;c.updateArcLengths();return c;}
  const logoDx=LG?LGP.cx+(674.5-683)*LGP.S+11.5:0;
  const downstream=path(LG
    ?[[-42,-1880],[-58,-2135],[25,-2380],[100,-2670],[-80,-2950],[-170,-3290],[-70,-3650],[90,-4130],[30+logoDx,-4600],[120+logoDx,-5100],[170+logoDx,-5600],[110+logoDx,-5950],[5+logoDx,-6200],[16+logoDx,-6620],[-4+logoDx,-6980],[-140,-7320],[-640,-7640],[-1400,-7980],[-2090,-8370],[-2590,-9650]]
    :refined
    ?[[-42,-1880],[-58,-2135],[25,-2380],[100,-2670],[-80,-2950],[-170,-3290],[-70,-3650],[90,-4130],[-80,-4690],[30,-5400],[-160,-6100],[-540,-6600],[-1120,-6890],[-1660,-7420],[-2090,-8370],[-2590,-9650]]
    :[[-42,-1880],[-70,-2110],[25,-2380],[100,-2670],[-80,-2950],[-170,-3290],[-70,-3650],[90,-4130],[-80,-4690],[30,-5400],[-160,-6300],[-260,-7800]]);
  const upstream=path([[-300,5500],[-80,3600],[-165,1700],[-235,1130],[-150,640],[-30,270],[0,0]]);
  // The first downstream row must share the original river's full width.
  // A 57 -> 124 unit jump at the old boundary left a visible triangular notch.
  const trunkWidth=z=>refined
    ?(LG?lerp(1,LGP.slot,smooth(LGP.cz+1250,LGP.cz+1120,z)*(1-smooth(LGP.cz-1870,LGP.cz-2090,z))):1)*(lerp(widthAt(1),90,smooth(-1880,-2700,z))+60*smooth(-2700,-3900,z))
    :(z>=-1880?57:lerp(124,90,smooth(-1880,-2700,z))+60*smooth(-2700,-3900,z));
  const mainRows=[];
  for(let i=0;i<=900;i++){const t=i/900,p=curve.getPointAt(t),n=curve.getTangentAt(t);mainRows.push({x:p.x,z:p.z,t,width:widthAt(t),nx:-n.z,nz:n.x});}
  function lookup(rows,z){if(z>=rows[0].z)return rows[0];if(z<=rows.at(-1).z)return rows.at(-1);let a=0,b=rows.length-1;while(b-a>1){const m=(a+b)>>1;if(rows[m].z>z)a=m;else b=m;}const u=(z-rows[a].z)/(rows[b].z-rows[a].z),o={};for(const k of Object.keys(rows[a]))o[k]=lerp(rows[a][k],rows[b][k],u);return o;}
  const downstreamRows=Array.from({length:901},(_,i)=>{const p=downstream.getPointAt(i/900);return{x:p.x,z:p.z,width:trunkWidth(p.z),nx:-downstream.getTangentAt(i/900).z};});
  let logoMonotonic=true;
  if(LG)for(let i=1;i<downstreamRows.length;i++)if(!(downstreamRows[i].z<downstreamRows[i-1].z))logoMonotonic=false;
  if(LG&&!logoMonotonic)console.warn('logoTerrain: downstream rows are not strictly decreasing in z');
  const upstreamRows=Array.from({length:241},(_,i)=>{const p=upstream.getPointAt(i/240);return{x:p.x,z:p.z,width:57,nx:-upstream.getTangentAt(i/240).z};});
  function mainAt(z){return z>0?lookup(upstreamRows,z):z< -1880?lookup(downstreamRows,z):lookup(mainRows,z);}
  const joinZ=[-3290,-2380,-2670,-3650];
  const tributaryPoints=[
    [[-2270,1700],[-2140,800],[-1820,180],[-1980,-500],[-1670,-1040],[-1790,-1580],[-1410,-2060],[-1090,-2550],[-690,-2760],[-440,-3060]],
    [[-990,1700],[-1080,830],[-760,220],[-900,-380],[-700,-870],[-870,-1290],[-540,-1640],[-470,-1980],[-170,-2200]],
    [[1040,1700],[910,850],[1110,300],[820,-240],[990,-730],[770,-1160],[930,-1550],[580,-1910],[470,-2300],[240,-2510]],
    [[2370,1700],[2200,870],[1860,200],[2110,-420],[1770,-1000],[1990,-1510],[1550,-2060],[1190,-2330],[1090,-2870],[660,-3140],[370,-3480]]
  ];
  const descriptors=[];
  for(let k=0;k<4;k++){
    const end=mainAt(joinZ[k]),points=[[tributaryPoints[k][0][0]-160,5500],[tributaryPoints[k][0][0]+130,3500],...tributaryPoints[k],[end.x,joinZ[k]]],c=path(points);
    const width=t=>37+8*Math.sin(t*8+k)**2+12*smooth(.45,1,t);
    const river=createRiver(THREE,c,width,{lengthSegments:lite?560:960,widthSegments:lite?8:12,bankOverlap:refined?1.34:1.12});
    river.mesh.name=`Alpine tributary ${k+1} → main river`;group.add(river.mesh);rivers.push(river);
    const rows=Array.from({length:801},(_,i)=>{const p=c.getPointAt(i/800);return{x:p.x,z:p.z,width:width(i/800),nx:-c.getTangentAt(i/800).z};});
    descriptors.push({curve:c,widthAt:width,rows,joinZ:joinZ[k],main:false});
  }
  const extensions=[
    createRiver(THREE,upstream,()=>57,{lengthSegments:lite?400:750,widthSegments:lite?8:12,bankOverlap:refined?1.26:1.08}),
    createRiver(THREE,downstream,t=>trunkWidth(downstream.getPointAt(t).z),{lengthSegments:refined?(lite?880:1440):(lite?680:1120),widthSegments:lite?12:16,bankOverlap:refined?1.22:1.08})
  ];
  // Weld both extension boundaries to the exact authored main-river edge.
  // Adjacent Catmull-Rom splines need not have the same endpoint tangent.
  if(refined){
    for(const [extension,t,atStart] of [[extensions[0],0,false],[extensions[1],1,true]]){
      const geometry=extension.mesh.geometry,p=geometry.attributes.position,cells=geometry.attributes.aCell;
      const columns=extension.mesh.userData.journeyRiver.widthSegments+1,rows=p.count/columns;
      const point=curve.getPointAt(t),tangent=curve.getTangentAt(t),halfWidth=widthAt(t)*(detail&&mainOverlap?mainOverlap:1.08);
      const row=atStart?0:rows-1,horizontal=Math.hypot(tangent.x,tangent.z)||1;
      for(let j=0;j<columns;j++){
        const offset=(j/(columns-1)*2-1)*halfWidth,index=row*columns+j;
        p.setXYZ(index,point.x-tangent.z/horizontal*offset,0,point.z+tangent.x/horizontal*offset);
      }
      const sharedCell=Math.max(curve.getLength()/(lite?420:720),halfWidth*2/(lite?20:32));
      for(let r=0;r<12;r++)for(let j=0;j<columns;j++){
        const index=(atStart?r:rows-1-r)*columns+j;
        cells.setX(index,lerp(sharedCell,cells.getX(index),smooth(0,11,r)));
      }
      p.needsUpdate=true;cells.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
    }
  }
  extensions.forEach((r,i)=>{r.mesh.name=i?'The joined river beyond the confluence':'Original river upstream';group.add(r.mesh);});
  const peaks=[[-2650,500,710,590],[-1390,-230,830,460],[470,-250,720,350],[1530,-320,860,470],[-2580,-1530,1130,750],[-1180,-1310,960,380],[470,-1220,1040,370],[1450,-1740,1130,400],[-1060,-2740,1150,650],[720,-2910,1290,520],[2280,-3250,1350,780],[-2440,-3820,1550,850],[-710,-4250,1460,740],[970,-4600,1720,750],[2720,-5600,1450,1080],[-1790,-5790,1840,1100],[460,-6370,1660,1000],[-5200,-9000,2500,1750],[-2700,-9000,2650,1550],[-520,-9800,2900,1700],[1940,-9400,2700,1650],[4560,-9900,2850,1800],[6500,-8500,2400,1900]];
  const massifs=peaks.map(([x,z,height,radius],i)=>{
    const angle=-.58+(hash(i+7,18)-.5)*.75;
    const heightScale=z>-4600?.53:z>-7000?.60:.76;
    return{x,z,height:height*heightScale,radius:radius*1.14,c:Math.cos(angle),s:Math.sin(angle),length:1.65+hash(i,24)*.75,width:.88+hash(i,31)*.34,bend:hash(i,41)*6.28,skew:(hash(i,63)-.5)*.34};
  });
  // Elongated, offset shoulders carry the skyline. A bounded smooth maximum
  // joins neighbouring mountain bodies without either cone cusps or needles.
  const smoothMax=(a,b,k)=>{const h=Math.max(0,k-Math.abs(a-b))/k;return Math.max(a,b)+h*h*k*.25;};
  function massifSample(x,z){
    const wx=x+(noise(x*.0009,z*.0008)-.5)*170,wz=z+(noise(x*.0009+71,z*.0008)-.5)*145;
    let mass=48;
    for(const p of massifs){
      const dx=(wx-p.x)/p.radius,dz=(wz-p.z)/p.radius;
      if(Math.abs(dx)>4.3||Math.abs(dz)>4.3)continue;
      const along=dx*p.c+dz*p.s,across=-dx*p.s+dz*p.c;
      const spine=across+p.skew*along+.12*Math.sin(along*2.6+p.bend);
      const distance=Math.hypot(along/p.length,spine/p.width);
      const crown=p.height*.79*Math.exp(-Math.pow(distance,1.72)*1.12);
      const shoulderDistance=Math.hypot((along-.46)/1.28,(spine+.28)/.91);
      const shoulder=p.height*.40*Math.exp(-Math.pow(shoulderDistance,1.7)*1.38);
      mass=smoothMax(mass,Math.max(crown,shoulder),44);
    }
    if(LG)mass=logoMass(x,z,mass);
    const ridge=1-Math.abs(noise(wx*.0021,wz*.0016)*2-1);
    const shoulder=1-Math.abs(noise(wx*.0048+18,wz*.0036-7)*2-1);
    // Long drainage creases erode the same landform instead of placing spikes
    // on it. Their shortest scale stays above the terrain's sample spacing.
    const drainage=noise(wx*.0068+noise(wx*.0016,wz*.0015)*2.6,wz*.0022-14);
    const gullies=Math.pow(1-Math.abs(drainage*2-1),5.5);
    const strata=Math.sin(mass*.026+wx*.0046+wz*.0022+(noise(wx*.003,wz*.003)-.5)*2.1);
    if(detail){
      // Macro detail: knife-edge aretes ride the existing ridges; a finer drainage
      // net and faint scree benches break the long smooth flanks. All three stay in
      // the ridge/relief channels, so the live terrain sliders keep scaling them.
      const arete=Math.pow(1-Math.abs(noise(wx*.0062+5,wz*.0051-3)*2-1),3.2);
      const fine=noise(wx*.0105+noise(wx*.0031+8,wz*.0029)*1.6,wz*.0046+3);
      const rills=Math.pow(1-Math.abs(fine*2-1),7);
      const bench=Math.sin(mass*.06+wx*.0021-wz*.0013)*smooth(260,900,mass);
      return [mass*.86,mass*ridge*.13+shoulder*57+Math.pow(ridge,4)*mass*.08+arete*mass*.075*smooth(180,700,mass),
        strata*(6+shoulder*5)-gullies*(18+mass*.075)-rills*(7+mass*.035)+bench*6];
    }
    return [mass*.86,mass*ridge*.13+shoulder*57,strata*(6+shoulder*5)-gullies*(18+mass*.075)];
  }
  // ---- relief mode --------------------------------------------------------------
  // Ridged multifractal (Musgrave): each octave is weighted by the one above it, so detail
  // gathers on the crests and the valleys stay calm. Octaves rotate ~37 deg to hide the lattice;
  // the shortest wavelength stays above ~3.5 terrain samples.
  const reliefOctaves=lite?3:4;
  // Terrain sample spacing at (x,z), mirroring the xs/zs lattice below: an octave fades out
  // before its wavelength drops under ~4 samples, so the coarse far grid never grows needles.
  const gridSpacingAt=(x,z)=>Math.abs(x)>=3200||z>1800||z< -7000?135:(refined&&Math.abs(x)<330&&z<80&&z>-1970?(lite?18:12):(lite?36:24));
  function ridgedField(x,z,spacing=24){
    let sum=0,amp=1,weight=1,f=1/820,px=x,pz=z;
    for(let o=0;o<reliefOctaves;o++){
      const fade=smooth(2.8*spacing,4.5*spacing,1/f);if(fade<=0)break;
      let r=1-Math.abs(noise(px*f+o*17.3,pz*f-o*9.1)*2-1);r*=r;r*=weight;weight=clamp(r*1.75);
      sum+=(r*fade+.3*(1-fade))*amp;amp*=.5;const nx=px*.8-pz*.6;pz=px*.6+pz*.8;px=nx;f*=2.08;
    }
    return sum;
  }
  // Massif envelope with a tent-shaped cross-section: a crisp main ridgeline along the spine,
  // long calm flanks, instead of the rounded dome.
  function reliefMass(wx,wz,spacing=24,x=wx,z=wz){
    // On the coarse far lattice a knife crest aliases into needles: round it there.
    const tent=1.1+.55*smooth(40,135,spacing);
    let mass=48;
    for(const p of massifs){
      const dx=(wx-p.x)/p.radius,dz=(wz-p.z)/p.radius;
      if(Math.abs(dx)>4.3||Math.abs(dz)>4.3)continue;
      const along=dx*p.c+dz*p.s,across=-dx*p.s+dz*p.c;
      const spine=across+p.skew*along+.12*Math.sin(along*2.6+p.bend);
      const a=Math.pow(Math.abs(along/p.length),2.6),c=Math.abs(spine/p.width);
      const crown=p.height*.80*Math.exp(-a*1.0-Math.pow(c,tent)*1.35);
      const shoulderDistance=Math.hypot((along-.46)/1.28,(spine+.28)/.91);
      const shoulder=p.height*.38*Math.exp(-Math.pow(shoulderDistance,1.45)*1.5);
      mass=smoothMax(mass,Math.max(crown,shoulder),44);
    }
    // The logo uses the UNWARPED position: the +-85 warp would break its axis/slot alignment.
    return LG?logoMass(x,z,mass):mass;
  }
  // Macro height used only to orient the erosion (gradient by central differences).
  const ridgeShare=(rid,mass)=>(rid-.42)*mass*.42*smooth(90,520,mass);
  function reliefMacro(x,z,spacing=gridSpacingAt(x,z)){
    const wx=x+(noise(x*.0009,z*.0008)-.5)*170,wz=z+(noise(x*.0009+71,z*.0008)-.5)*145;
    const qx=wx+(noise(wx*.0013+3.7,wz*.0013)-.5)*300,qz=wz+(noise(wx*.0013,wz*.0013+8.1)-.5)*300;
    const mass=reliefMass(wx,wz,spacing,x,z),rid=ridgedField(qx,qz,spacing);
    return {mass,rid,h:mass*.86+ridgeShare(rid,mass)};
  }
  // Gabor-style erosion (after Clay John / IQ): stripes whose phase runs ACROSS the fall line,
  // so every groove runs downhill; later octaves follow the slope the earlier ones carved.
  const erosionOctaves=lite?[150]:[160,78];
  function erosionField(x,z,gx,gz,spacing=24,octaves=erosionOctaves){
    let total=0,amp=1,wsum=0;
    for(const L of octaves){
      // Same rule as the ridges: no groove narrower than ~4 terrain samples.
      const fade=smooth(3*spacing,4.6*spacing,L);if(fade<=0)break;
      const len=Math.hypot(gx,gz)||1e-6,dx=-gz/len,dz=gx/len;
      const cx=Math.floor(x/L),cz=Math.floor(z/L);let acc=0,w=0,ddx=0,ddz=0;
      for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
        const ox=(cx+i+.2+hash(cx+i,cz+j)*.6)*L,oz=(cz+j+.2+hash(cz+j+7,cx+i)*.6)*L;
        const px=(x-ox)/L,pz=(z-oz)/L,wt=Math.exp(-(px*px+pz*pz)*2.2),ph=(px*dx+pz*dz)*Math.PI*2;
        acc+=Math.cos(ph)*wt;ddx-=Math.sin(ph)*dx*wt;ddz-=Math.sin(ph)*dz*wt;w+=wt;
      }
      total+=acc/w*amp*fade;wsum+=amp;
      // Bend the next octave along the slope this one carved.
      gx+=ddx/w*amp*.9*len;gz+=ddz/w*amp*.9*len;amp*=.5;
    }
    return wsum>0?total/wsum:0;
  }
  function reliefSample(x,z,pre=null){
    let m,hx,hz;
    if(pre){m=pre.m;hx=pre.hx;hz=pre.hz;}
    else{const e=24,sp=gridSpacingAt(x,z);m=reliefMacro(x,z,sp);hx=(reliefMacro(x+e,z,sp).h-reliefMacro(x-e,z,sp).h)/(2*e);hz=(reliefMacro(x,z+e,sp).h-reliefMacro(x,z-e,sp).h)/(2*e);}
    const slope=Math.hypot(hx,hz);
    const ero=erosionField(x,z,hx,hz,gridSpacingAt(x,z));
    // Grooves only where water actually runs fast: steep, and above the valley floor.
    const gullyDepth=(10+m.mass*.05)*smooth(.10,.55,slope)*smooth(70,260,m.mass);
    // Mid-scale structure the old version carried, kept but calmer.
    const wx=x+(noise(x*.0009,z*.0008)-.5)*170,wz=z+(noise(x*.0009+71,z*.0008)-.5)*145;
    const shoulder=1-Math.abs(noise(wx*.0048+18,wz*.0036-7)*2-1);
    const strata=Math.sin(m.mass*.026+wx*.0046+wz*.0022+(noise(wx*.003,wz*.003)-.5)*2.1);
    return {base:m.mass*.86,ridgeCh:shoulder*34,reliefCh:strata*(4+shoulder*3),
      rid:ridgeShare(m.rid,m.mass),ero:(ero-.2)*gullyDepth,groove:clamp(.5-ero*.5)*smooth(.10,.55,slope)*smooth(70,260,m.mass),gx:hx,gz:hz,slope,eroRaw:ero,macroMass:m.mass};
  }
  // Match the original canyon's outer banks while keeping its navigable floor clear.
  function originalBank(x,z,row){const side=x<row.x?-1:1,d=Math.max(0,Math.abs(x-row.x)-row.nx*row.width),t=row.t,u=Math.pow(clamp(d/250),1/1.47);
    const canyon=smooth(.025,.17,t)*(1-smooth(.65,.91,t)),buttress=noise(t*24+13,side*19+65),ravine=Math.pow(noise(t*47+38,side*11+14),1.5),broad=fbm(x*.017+side*5,z*.014);
    const shoulder=18+canyon*(32+buttress*42),ridges=Math.pow(Math.abs(Math.sin(t*42+side*2.7+broad*3.3)),.52),cliffHeight=shoulder*(.34+buttress*.50+ravine*.52+broad*.14),cliffStart=4+24*noise(t*39,side*7+30),cliff=smooth(cliffStart,cliffStart+11+broad*20,d);
    const highland=smooth(58+buttress*35,235,d)*(Math.pow(ridges,1.8)*(26+broad*117)+broad*48)*(.40+canyon*.60),teeth=(noise(t*118+7,u*18+side*18)-.5)*(5+cliff*10)*smooth(2,16,d),shelf=Math.sin(d*.08+broad*4)*(2+ravine*5)*smooth(14,55,d);
    return{distance:d,height:-.9+(Math.min(d,8)*.16+cliffHeight*cliff+highland+teeth+shelf)*(1-smooth(.89,1,t)*.58)};
  }
  function channelsAt(z){const channels=[mainAt(z)];for(const d of descriptors)if(z>=d.joinZ-12&&z<=5500)channels.push(lookup(d.rows,z));return channels;}
  // Distance to the actual centreline segments, including their width gradient.
  // A same-Z approximation moves banks across the ribbon on diagonal bends.
  const channelTables=[mainRows,upstreamRows,downstreamRows,...descriptors.map(d=>d.rows)];
  function channelDistance(x,z,rows,exact=220){
    if(z>rows[0].z+160||z<rows.at(-1).z-160)return Infinity;
    let lo=0,hi=rows.length-1;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid].z>z)lo=mid;else hi=mid;}
    const near=rows[lo],approx=Math.abs(x-near.x)*Math.max(.2,near.nx??1)-near.width;
    if(approx>exact)return approx;
    let result=Infinity;const win=exact>220?64:28;
    for(let i=Math.max(0,lo-win);i<Math.min(rows.length-1,lo+win+1);i++){
      const a=rows[i],b=rows[i+1],dx=b.x-a.x,dz=b.z-a.z;
      const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1));
      result=Math.min(result,Math.hypot(x-a.x-dx*t,z-a.z-dz*t)-lerp(a.width,b.width,t));
    }
    return result;
  }
  function riverDistance(x,z){let d=Infinity;for(const rows of channelTables)d=Math.min(d,channelDistance(x,z,rows));return d;}
  // LOGO: the same-Z shortcut above (beyond 220) jumps by |approx - exact| wherever the channel runs
  // diagonally; the ring's gorge walls are a steep function of this distance, so that jump stood as a
  // 40-50 unit step around the inlet, the seam and the downstream bend. Around the mark the exact
  // segment distance is used out to 520, where every bank/talus/blend term has saturated; the switch
  // fades in by z (upstream of -3450 the distance is exactly the page's own).
  function logoRiverDistance(x,z){
    const w=smooth(-3450,-3650,z);if(w<=0)return riverDistance(x,z);
    let d=Infinity;for(const rows of channelTables)d=Math.min(d,channelDistance(x,z,rows,520));
    return w>=1?d:lerp(riverDistance(x,z),d,w);
  }
  function makeHeightSample(x,z,channels=channelsAt(z),pre=null){
    let distance=Infinity,tributaryDistance=Infinity;for(let k=0;k<channels.length;k++){const c=channels[k],d=Math.abs(x-c.x)*Math.max(.25,c.nx??1)-c.width-4;distance=Math.min(distance,d);if(k>0)tributaryDistance=Math.min(tributaryDistance,d);}
    if(refined)distance=LG?logoRiverDistance(x,z):riverDistance(x,z);
    const dRiver=distance;let lakeD=Infinity,logoB=99,logoF=99,logoH=99;
    if(LG){const L=logoAt(x,z);logoB=L.b;logoF=L.f;logoH=L.h;lakeD=logoShore(logoH);distance=Math.min(dRiver,lakeD);}
    const rs=R?reliefSample(x,z,pre):null;
    const shape=R?[rs.base,rs.ridgeCh,rs.reliefCh]:massifSample(x,z),mass=Math.max(24,shape[0]+shape[1]+shape[2]+(R?rs.rid+rs.ero:0)),detail=fbm(x*.013,z*.012),bankWarp=noise(x*.004+11,z*.005);
    // Relief: a concave talus apron (steepening toward the wall foot), almost no lumps on the floor.
    const talus=R?Math.pow(smooth(20,150,distance),1.6)*(1-smooth(150,260,distance))*(20+detail*6)
      :smooth(24,80,distance)*(1-smooth(118,225,distance))*(13+detail*18);
    const brokenShoulder=R?smooth(60,190,distance)*smooth(70,450,mass)*(detail-.43)*8:smooth(45,170,distance)*smooth(70,450,mass)*(detail-.43)*22;
    // Relief: a wider, gentler bank so the water line is well sampled (no saw-tooth shoreline).
    const bank=R?-10+smooth(-14,34,distance)*(15+detail*3):refined?-10+smooth(-9,16,distance)*(15+detail*5):-7+smooth(-8,28,distance)*(12+detail*12);
    let massBlend=refined?smooth(16,390+bankWarp*65,distance):smooth(8,365+bankWarp*65,distance);
    // Inside the ring the trunk cuts a narrow gorge instead of erasing the ridge, and the inner
    // wall stands at the water like a river bank.
    // Both gorge walls are held under the same wall-slope cap as the ring (height ~ slope x distance).
    const ringZone=LG?1-smooth(LGP.flankOut*.6,LGP.flankOut+4,Math.max(0,Math.min(logoB,logoF))):0;
    if(ringZone>0)massBlend=lerp(massBlend,Math.min(clamp(LGP.wallSlope*Math.max(0,dRiver-4)/Math.max(60,mass)),smooth(0,170,lakeD)),ringZone);
    // The ring's own gullies: a finer Gabor octave down its fall line, so both faces are eroded.
    if(ringZone>0&&rs){
      // Groove direction on the ring, taken modulo sign from the stroke's own distance field (a 2x2
      // structure tensor of its gradient over +-30 units): the Gabor phase is very sensitive to the
      // direction far from a cell centre, and the macro gradient swings round at every crest, kink
      // and serration of the ring, which folded the grooves into 25-unit spikes on 10-unit steps.
      const L0=logoField.at(x,z),useF=L0.f<L0.b,q=(xx,zz)=>{const r=logoField.at(xx,zz);return useF?r.f:r.b;};
      let sxx=0,sxy=0,szz=0;
      for(const [ox,oz] of [[30,0],[-30,0],[0,30],[0,-30]]){const px=x+ox,pz=z+oz,ax=q(px+8,pz)-q(px-8,pz),az=q(px,pz+8)-q(px,pz-8);sxx+=ax*ax;sxy+=ax*az;szz+=az*az;}
      const th=.5*Math.atan2(2*sxy,sxx-szz),glen=Math.hypot(rs.gx,rs.gz)||1e-3,dgx=sxx+szz>1e-6?Math.cos(th)*glen:rs.gx,dgz=sxx+szz>1e-6?Math.sin(th)*glen:rs.gz;
      const sp=gridSpacingAt(x,z),eroRing=erosionField(x,z,dgx,dgz,sp),g=erosionField(x,z,dgx,dgz,sp,[Math.max(128,4.6*sp)]),steep=(.35+.65*smooth(.05,.6,rs.slope))*ringZone*LGP.gully;
      // On faces already near the wall slope the grooves are eased back, so a groove wall never adds
      // 20-25 degrees on top of a 41-49 degree face (that stood as 70+ degree flutes in the gap).
      // Where the stroke's fall line itself turns quickly (fin tip, stroke ends: low tensor coherence)
      // no single groove direction exists, so the grooves fade there too.
      const coh=sxx+szz>1e-6?Math.hypot(sxx-szz,2*sxy)/(sxx+szz):0;
      const ease=(1-.6*smooth(.6,1.1,rs.slope))*lerp(.35,1,smooth(.55,.92,coh));
      // On the ring the page's groove offset (-.2) is dropped and its slope gate widened: that gate
      // snaps to zero on a crest line and would stand a 10-unit fin along every crest; a floor keeps
      // the grooves running over the crest instead (a notched, serrated skyline).
      rs.ero=lerp(rs.ero,eroRing*(10+rs.macroMass*.05)*(.35+.65*smooth(.02,.5,rs.slope))*smooth(40,200,rs.macroMass)*ease,ringZone)+g*(8+mass*.045)*steep*ease;rs.groove=Math.max(rs.groove,clamp(.5-g*.5)*steep);}
    let support=0,supportMix=0;
    if(z<=0&&z>=-1880){const r=lookup(mainRows,z),original=originalBank(x,z,r),endFade=smooth(0,90,-z)*(1-smooth(1770,1880,-z));
      // A buried interior lets the original detailed cliffs remain authoritative.
      const bankY=R?.bankHeight?R.bankHeight(r.t,x<r.x?-1:1,original.distance,x,z):original.height;
      support=lerp(-9,bankY-3,smooth(195,245,original.distance));
      supportMix=(1-smooth(245,390,original.distance))*endFade*smooth(0,95,tributaryDistance);
    }
    // The refined trunk turns behind a massif before its final buried reach.
    // The closing ridge is curved in world space, never a straight Z dam.
    const ridgeStart=refined?-8650-Math.sin(x*.0017)*165:-7000;
    const ridgeEnd=refined?-9500-Math.sin(x*.0017)*165:-8100;
    const out=[...shape,bank,massBlend,talus,brokenShoulder,support,supportMix,smooth(ridgeStart,ridgeEnd,z)];
    if(R)out.push(rs.rid,rs.ero,LG?rs.groove*(1-logoLakeMask(logoH)):rs.groove);
    return out;
  }
  function heightFromSample(samples,offset=0){
    const reliefTerms=R?samples[offset+10]*terrainSettings.reliefRidge+samples[offset+11]*terrainSettings.reliefErosion:0;
    const mass=Math.max(24,(samples[offset]+samples[offset+1]*terrainSettings.ridge+samples[offset+2]*terrainSettings.relief+reliefTerms)*terrainSettings.height);
    const hillside=samples[offset+3]+samples[offset+4]*mass+samples[offset+5]+samples[offset+6]*terrainSettings.relief;
    // The riverbed and close canyon support never scale with the mountains.
    return lerp(lerp(hillside,samples[offset+7],samples[offset+8]),mass,samples[offset+9]);
  }
  function sampleHeight(x,z,channels=channelsAt(z)){return heightFromSample(makeHeightSample(x,z,channels));}
  const xs=[],zs=[];
  const spacing=lite?36:24;
  for(let x=-9000;x< -3200;x+=140)xs.push(x);for(let x=-3200;x<3200;x+=refined&&Math.abs(x)<330?(lite?18:12):spacing)xs.push(x);xs.push(3200);for(let x=3340;x<=9000;x+=140)xs.push(x);
  for(let z=4800;z>1800;z-=120)zs.push(z);for(let z=1800;z>-7000;z-=refined&&z<80&&z>-1970?(lite?18:12):spacing)zs.push(z);zs.push(-7000);for(let z=-7120;z>=-12000;z-=120)zs.push(z);
  const positions=new Float32Array(xs.length*zs.length*3),colors=new Float32Array(positions.length),indices=[];
  // Store noise/carving once. Slider updates only evaluate this short expression
  // and refresh the same geometry buffers, rather than rebuilding the scene.
  const stride=R?13:10;
  const heightSamples=terrainConfig||R?new Float64Array(xs.length*zs.length*stride):null;
  const dark=rockDark??new THREE.Color('#526676'),pale=rockPale??new THREE.Color('#a0acb4'),summit=new THREE.Color('#b7c4cd'),color=new THREE.Color();
  let maxHeight=0;
  let macroGrid=null;
  const logoInkW=LG?new Float32Array(xs.length*zs.length):null;
  if(R){
    macroGrid=new Array(xs.length*zs.length);
    for(let i=0;i<zs.length;i++)for(let j=0;j<xs.length;j++)macroGrid[i*xs.length+j]=reliefMacro(xs[j],zs[i]);
  }
  const preAt=(i,j)=>{
    if(!macroGrid)return null;
    const W=xs.length,jw=Math.max(0,j-1),je=Math.min(W-1,j+1),iN=Math.max(0,i-1),iS=Math.min(zs.length-1,i+1);
    return {m:macroGrid[i*W+j],hx:(macroGrid[i*W+je].h-macroGrid[i*W+jw].h)/(xs[je]-xs[jw]),hz:(macroGrid[iS*W+j].h-macroGrid[iN*W+j].h)/(zs[iS]-zs[iN])};
  };
  for(let i=0;i<zs.length;i++){const z=zs[i],channels=channelsAt(z);for(let j=0;j<xs.length;j++){const x=xs[j],sample=makeHeightSample(x,z,channels,preAt(i,j)),y=heightFromSample(sample),n=fbm(x*.009+51,z*.009),o=(i*xs.length+j)*3;positions.set([x,y,z],o);if(heightSamples)heightSamples.set(sample,(i*xs.length+j)*stride);maxHeight=Math.max(maxHeight,y);
    color.copy(dark).multiplyScalar(.73).lerp(pale,.16+n*.39+smooth(190,1200,y)*.10);color.lerp(summit,smooth(1000,2300,y)*(.07+n*.12));
    const wet=1-smooth(.3,18,y);color.multiplyScalar(1-wet*.27);if(LG)logoInkW[i*xs.length+j]=logoTint(x,z,color);colors.set([color.r,color.g,color.b],o);
    if(i<zs.length-1&&j<xs.length-1){const a=i*xs.length+j,b=a+xs.length;if((i+j)%2)indices.push(a,a+1,b+1,a,b+1,b);else indices.push(a,a+1,b,b,a+1,b+1);}
  }}
  const baseColors=detail?colors.slice():null;
  // Relief: per-vertex (convexity, erosion groove, 0) for the terrain's own material.
  const reliefAttr=R?new Float32Array(positions.length):null;
  function bakeCreases(){
    // Grid curvature → tone: drainage creases darken, crests lift. Recomputed after slider edits.
    if(!detail)return;
    const W=xs.length;
    for(let i=0;i<zs.length;i++)for(let j=0;j<W;j++){
      const k=i*W+j,y=positions[k*3+1];
      const jw=Math.max(0,j-1),je=Math.min(W-1,j+1),iN=Math.max(0,i-1),iS=Math.min(zs.length-1,i+1);
      const hx=Math.max(1,(xs[je]-xs[jw])*.5),hz=Math.max(1,(zs[iN]-zs[iS])*.5);
      const cx=((positions[(i*W+jw)*3+1]+positions[(i*W+je)*3+1])*.5-y)/hx;
      const cz=((positions[(iN*W+j)*3+1]+positions[(iS*W+j)*3+1])*.5-y)/hz;
      const shade=1-Math.max(-.14,Math.min(.30,(cx+cz)*.55));
      if(reliefAttr){reliefAttr[k*3]=Math.max(-1,Math.min(1,-(cx+cz)*1.6));reliefAttr[k*3+1]=heightSamples[k*stride+12];}
      colors[k*3]=baseColors[k*3]*shade;colors[k*3+1]=baseColors[k*3+1]*shade;colors[k*3+2]=baseColors[k*3+2]*shade;
    }
  }
  bakeCreases();
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();ownedGeometries.push(geo);
  if(reliefAttr)geo.setAttribute('aRelief',new THREE.BufferAttribute(reliefAttr,3));
  // LOGO: aRelief.z (unused by the terrain until now, 0) carries the stroke's ink weight.
  if(LG&&reliefAttr)for(let k=0;k<logoInkW.length;k++)reliefAttr[k*3+2]=logoInkW[k];
  const terrain=new THREE.Mesh(geo,R?.material??rockMaterial);terrain.name='Interlocking alpine massifs and carved confluences';terrain.castShadow=true;terrain.receiveShadow=true;group.add(terrain);

  const flowPaths=[{curve,widthAt},...descriptors,{curve:upstream,widthAt:()=>57},{curve:downstream,widthAt:t=>trunkWidth(downstream.getPointAt(t).z)}];
  if(refined){
    const upstreamLength=upstream.getLength(),mainLength=curve.getLength(),downstreamLength=downstream.getLength();
    Object.assign(flowPaths[0],{flowOffset:upstreamLength,flowStartFade:0,flowEndFade:0});
    Object.assign(flowPaths[5],{flowOffset:0,flowStartFade:100,flowEndFade:0});
    Object.assign(flowPaths[6],{flowOffset:upstreamLength+mainLength,flowStartFade:0,flowEndFade:280});
    for(let k=0;k<4;k++){
      let lo=0,hi=1;for(let i=0;i<30;i++){const mid=(lo+hi)*.5;if(downstream.getPointAt(mid).z>joinZ[k])lo=mid;else hi=mid;}
      Object.assign(flowPaths[k+1],{flowOffset:upstreamLength+mainLength+downstreamLength*(lo+hi)*.5-descriptors[k].curve.getLength(),flowStartFade:100,flowEndFade:58});
    }
  }
  // Broken slabs sit on the actual sampled bank. They do not enter the
  // original first-person reach, whose authored boulders remain untouched.
  let slabGeometry=boulderGeometry;
  if(!slabGeometry){
    slabGeometry=new THREE.IcosahedronGeometry(1,1);
    const p=slabGeometry.attributes.position,c=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),rough=.82+noise(x*5+19,z*5+y*2)*.25;
      p.setXYZ(i,x*rough,y*rough,z*rough);color.copy(dark).lerp(pale,.19+noise(x*3+5,z*4)*.34);c.set([color.r,color.g,color.b],i*3);
    }
    slabGeometry.setAttribute('color',new THREE.BufferAttribute(c,3));slabGeometry.computeVertexNormals();ownedGeometries.push(slabGeometry);
  }
  const bankPaths=flowPaths.slice(1),slabCount=lite?144:288;
  const slabs=new THREE.InstancedMesh(slabGeometry,rockMaterial,slabCount),dummy=new THREE.Object3D(),slabSamples=[];
  for(let i=0;i<slabCount;i++){
    const d=bankPaths[i%bankPaths.length],t=.08+hash(i,82)*.84,p=d.curve.getPointAt(t),tangent=d.curve.getTangentAt(t),side=i%2?1:-1;
    const large=i%7===0,size=(large?17:4)+Math.pow(hash(i,46),1.7)*(large?23:13);
    const offset=d.widthAt(t)+size*.92+6+hash(i,37)*(large?91:17),norm=Math.hypot(tangent.x,tangent.z)||1;
    const x=p.x-tangent.z/norm*offset*side,z=p.z+tangent.x/norm*offset*side,sample=makeHeightSample(x,z),y=heightFromSample(sample);
    dummy.position.set(x,y-size*.22,z);dummy.rotation.set((hash(i,17)-.5)*.42,Math.atan2(tangent.x,tangent.z)+(hash(i,26)-.5)*1.1,(hash(i,51)-.5)*.32);
    dummy.scale.set(size*(1.12+hash(i,36)*.55),size*(.35+hash(i,40)*.40),size*(.76+hash(i,44)*.7));
    if(LG&&logoShore(logoAt(x,z).h)<40)dummy.scale.set(0,0,0);dummy.updateMatrix();slabs.setMatrixAt(i,dummy.matrix);if(terrainConfig)slabSamples.push({sample,burial:size*.22,matrix:dummy.matrix.clone()});
  }
  slabs.instanceMatrix.needsUpdate=true;slabs.name='Eroded bank slabs and craggy shoulders';slabs.castShadow=true;slabs.receiveShadow=true;group.add(slabs);
  if(detail){
    // Water side of every bank: (bed height, inward distance to the bank, wall height),
    // read from the same terrain grid the banks were built from.
    const gridHeight=(x,z)=>{
      let a=0,b=xs.length-1;if(x<=xs[0])b=1;else if(x>=xs[b])a=b-1;else while(b-a>1){const m=(a+b)>>1;if(xs[m]>x)b=m;else a=m;}
      let c=0,d=zs.length-1;if(z>=zs[0])d=1;else if(z<=zs[d])c=d-1;else while(d-c>1){const m=(c+d)>>1;if(zs[m]<z)d=m;else c=m;}
      const u=clamp((x-xs[a])/(xs[b]-xs[a])),w=clamp((z-zs[c])/(zs[d]-zs[c])),W=xs.length,h=(i,j)=>positions[(i*W+j)*3+1];
      return lerp(lerp(h(c,a),h(c,b),u),lerp(h(d,a),h(d,b),u),w);
    };
    const bake=(river,width,overlap)=>{
      const g=river.mesh.geometry,p=g.attributes.position,uv=g.attributes.uv,info=river.mesh.userData.journeyRiver,columns=info.widthSegments+1,rows=p.count/columns;
      const data=new Float32Array(p.count*3);
      for(let r=0;r<rows;r++){
        const a=r*columns,b=a+columns-1,dx=p.getX(b)-p.getX(a),dz=p.getZ(b)-p.getZ(a),len=Math.hypot(dx,dz)||1,wv=width(uv.getY(a));
        for(let c=0;c<columns;c++){
          const i=a+c,lane=uv.getX(i)*2-1,side=lane<0?-1:1,x=p.getX(i),z=p.getZ(i);
          data[i*3]=Math.min(gridHeight(x,z),2.5);
          data[i*3+1]=wv*(1-Math.abs(lane)*overlap);
          data[i*3+2]=Math.max(0,gridHeight(x+dx/len*side*(wv+70),z+dz/len*side*(wv+70)));
        }
      }
      g.setAttribute('aShore',new THREE.BufferAttribute(data,3));
    };
    rivers.forEach((r,k)=>bake(r,descriptors[k].widthAt,refined?1.34:1.12));
    bake(extensions[0],()=>57,refined?1.26:1.08);
    bake(extensions[1],t=>trunkWidth(downstream.getPointAt(t).z),refined?1.22:1.08);
  }
  let logo=null;
  if(LG){
    const started=performance.now(),{toX,toZ}=logoField,axisX=toX(674.5);
    const smoother=n=>{const t=clamp(n);return t*t*t*(t*(t*6-15)+10);};
    // The eye: a grid clipped to the hole, tucked under the inner wall. Opaque, fogged, flat
    // vertex tone on the page palette (darker than the haze; paler toward the far shore; a thin
    // frost line at the shore). Parked below the floor until the aerial reveal.
    const hb=logoField.holeBox,step=lite?30:20,pad=2*step;
    const x0=toX(hb.u0)-pad,x1=toX(hb.u1)+pad,z0=toZ(hb.v0)-pad,z1=toZ(hb.v1)+pad;
    const cols=Math.ceil((x1-x0)/step)+1,rowsN=Math.ceil((z1-z0)/step)+1;
    const holeD=new Float32Array(cols*rowsN),inside=new Uint8Array(cols*rowsN);
    for(let r=0;r<rowsN;r++)for(let c=0;c<cols;c++){const i=r*cols+c;holeD[i]=logoShore(logoAt(x0+c*step,z0+r*step).h);inside[i]=holeD[i]<12?1:0;}
    const remap=new Int32Array(cols*rowsN).fill(-1),lakePos=[],lakeCol=[],lakeIdx=[];
    const toneBase=new THREE.Color(logoTerrain.lakeTone??'#6f8497'),sky=new THREE.Color('#aebfcc'),frost=new THREE.Color('#dfe8ef'),tone=new THREE.Color();
    const zNear=toZ(hb.v1),zFar=toZ(hb.v0);
    const vert=i=>{if(remap[i]<0){const c=i%cols,r=(i/cols)|0,x=x0+c*step,z=z0+r*step;remap[i]=lakePos.length/3;lakePos.push(x,0,z);
      tone.copy(toneBase).lerp(sky,.35*smooth(zNear,zFar,z)).lerp(frost,.30*(1-smooth(0,60,-holeD[i])));
      // Stored relative to the base tone, so CONFIG.lakeTone stays live through material.color.
      lakeCol.push(tone.r/Math.max(1e-4,toneBase.r),tone.g/Math.max(1e-4,toneBase.g),tone.b/Math.max(1e-4,toneBase.b));}return remap[i];};
    for(let r=0;r<rowsN-1;r++)for(let c=0;c<cols-1;c++){const a=r*cols+c,b=a+cols;
      if(inside[a]||inside[a+1]||inside[b]||inside[b+1])lakeIdx.push(vert(a),vert(b),vert(a+1),vert(a+1),vert(b),vert(b+1));}
    const lakeGeometry=new THREE.BufferGeometry();lakeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(lakePos,3));lakeGeometry.setAttribute('color',new THREE.Float32BufferAttribute(lakeCol,3));
    lakeGeometry.setIndex(lakeIdx);lakeGeometry.computeBoundingBox();lakeGeometry.computeBoundingSphere();ownedGeometries.push(lakeGeometry);
    const lakeMaterial=new THREE.MeshBasicMaterial({color:toneBase,vertexColors:true,fog:true});ownedMaterials.push(lakeMaterial);
    const lake=new THREE.Mesh(lakeGeometry,lakeMaterial);lake.name='Logo lake · the eye of the mark';lake.position.y=-60;group.add(lake);
    // Gendarmes: a few dark rock needles on the thick shoulder and the fin root. Same material as
    // the bank slabs, so no new shader program.
    const pinCount=lite?Math.round(LGP.pinnacles/2):LGP.pinnacles,pinSamples=[];let pins=null;
    if(pinCount>0){
      const cone=new THREE.ConeGeometry(1,1,5);cone.translate(0,.5,0);
      const pc=new Float32Array(cone.attributes.position.count*3);color.copy(dark).multiplyScalar(.62);
      for(let i=0;i<pc.length;i+=3){pc[i]=color.r;pc[i+1]=color.g;pc[i+2]=color.b;}
      cone.setAttribute('color',new THREE.BufferAttribute(pc,3));ownedGeometries.push(cone);
      pins=new THREE.InstancedMesh(cone,rockMaterial,pinCount);
      const chosen=[];
      for(let n=0;n<6000&&chosen.length<pinCount;n++){
        const u=600+hash(n,91)*150,w=285+hash(n,93)*170,x=toX(u),z=toZ(w),L=logoAt(x,z),sb=-L.b,sf=-L.f;
        const shoulder=sb>0&&smooth(2,15,sb)>.55,finRoot=sf>2&&w<306&&u>640;
        if(!(shoulder||finRoot)||Math.abs(x-axisX)<130)continue;
        if(chosen.some(p=>Math.hypot(p.x-x,p.z-z)<150))continue;
        chosen.push({x,z,n});
      }
      chosen.forEach(({x,z,n},i)=>{
        const sample=makeHeightSample(x,z),height=30+hash(n,95)*30,radius=9+hash(n,97)*5;
        dummy.position.set(x,heightFromSample(sample)-4,z);dummy.rotation.set((hash(n,98)-.5)*.16,hash(n,99)*6.28,(hash(n,101)-.5)*.16);
        dummy.scale.set(radius,height,radius);dummy.updateMatrix();pins.setMatrixAt(i,dummy.matrix);pinSamples.push({sample,matrix:dummy.matrix.clone()});
      });
      pins.count=chosen.length;pins.instanceMatrix.needsUpdate=true;pins.name='Logo ridge gendarmes';pins.castShadow=true;pins.receiveShadow=true;group.add(pins);
    }
    // Optional pearl markers (4 strategies + overview), off by default.
    let markers=null;const markerSamples=[];
    if(logoTerrain.markers){
      const pts=[[640,325],[641,398],[690,441],[731,400],[705,336]].map(([u,w])=>{const x=toX(u),z=toZ(w),sample=makeHeightSample(x,z);markerSamples.push(sample);return [x,heightFromSample(sample)+14,z];}).flat();
      const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));ownedGeometries.push(mg);
      const mm=new THREE.PointsMaterial({color:'#eef4f8',size:6,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,fog:true});ownedMaterials.push(mm);
      markers=new THREE.Points(mg,mm);markers.name='Logo pearl markers';group.add(markers);
    }
    // The trunk's light dims across the eye and re-brightens in the seam slot.
    // The trunk's light sinks into the still eye (ramping over ~200 units at each shore), comes
    // back in the 12 o'clock seam, and fades out once it has cleared the mark, so no stray bar of
    // light hangs behind the fin's peak.
    let zIn=-Infinity,zOut=Infinity;
    for(let i=0;i<=600;i++){const p=downstream.getPointAt(i/600);if(logoShore(logoAt(p.x,p.z).h)<0){zIn=Math.max(zIn,p.z);zOut=Math.min(zOut,p.z);}}
    // The light stays low until the trunk reaches the 12 o'clock seam (not merely the far shore).
    zOut=Math.min(zOut,toZ(338));
    const passage=z=>zIn>zOut?smooth(zIn+110,zIn-110,z)*(1-smooth(zOut+110,zOut-110,z)):0;
    flowPaths[6].flowDimAt=(x,z)=>lerp(1,LGP.lineOverLake,passage(z))*(1-smooth(LGP.cz-1900,LGP.cz-2200,z));
    let lastTone='';
    logo={config:logoTerrain,field:logoField,lake,pinnacles:pins,markers,axisX,heightSample:makeHeightSample,
      update(reveal=0,confluence=0){
        lake.position.y=lerp(-60,logoNumber('lakeLevel',.6,3,1.6),smoother((reveal-.30)/.06));
        const toneKey=String(logoTerrain.lakeTone??'#6f8497');if(toneKey!==lastTone){lastTone=toneKey;lakeMaterial.color.set(toneKey);}
        if(markers)markers.material.opacity=logoNumber('markerGlow',0,.35,.30)*smoother((confluence-.5)/.5);
      },
      sync(){
        if(pins){pinSamples.forEach((p,i)=>{p.matrix.elements[13]=heightFromSample(p.sample)-4;pins.setMatrixAt(i,p.matrix);});pins.instanceMatrix.needsUpdate=true;pins.computeBoundingSphere?.();}
        if(markers){const a=markers.geometry.attributes.position;markerSamples.forEach((s,i)=>a.setY(i,heightFromSample(s)+14));a.needsUpdate=true;markers.geometry.computeBoundingSphere();}
      },
      stats:{fieldMs:Math.round(logoField.fieldMs),lakeTris:lakeIdx.length/3,lakeVertices:lakePos.length/3,pinnacles:pins?pins.count:0,markers:!!markers,
        buildMs:0,raster:logoField.N,holeArea:Math.round(logoField.holeArea),bandDepth:+logoField.bandDepth.toFixed(2),finDepth:+logoField.finDepth.toFixed(2),monotonic:logoMonotonic,axisX}
    };
    logo.stats.buildMs=Math.round(logoField.fieldMs+performance.now()-started);
  }
  const joins=joinZ.map(z=>v(mainAt(z).x,z));
  const effects=createConfluenceEffects(THREE,{paths:flowPaths,sampleHeight,lite,joins,flowConfig});group.add(effects.group);
  let drawCalls=0;group.traverse(o=>{if(o.isMesh||o.isPoints)drawCalls++;});
  const riverVertices=[...rivers,...extensions].reduce((sum,r)=>sum+r.mesh.geometry.attributes.position.count,0);
  const bounds=new THREE.Box3().setFromObject(terrain),stats={tributaryCount:4,riverCount:5,terrainVertices:positions.length/3,terrainTriangles:indices.length/3,riverVertices,ownedSurfaceVertices:positions.length/3+riverVertices+(effects.stats.ribbonVertices||0),bankSlabs:slabCount,maxHeight,confluenceCount:4,lite,sharedWaterMaterial:[...rivers,...extensions].every(r=>r.mesh.material===rivers[0].mesh.material),drawCalls,effects:effects.stats};
  const terrainBounds={min:bounds.min,max:bounds.max,center:bounds.getCenter(new THREE.Vector3()),size:bounds.getSize(new THREE.Vector3())};
  if(R)stats.reliefBuildMs=Math.round(performance.now()-buildStart);
  if(logo)stats.logoTerrain=logo.stats;
  Object.assign(stats,{terrainSettings,terrainRevision:0,terrainUpdatePending:false,liveTerrainControls:!!terrainConfig});
  let disposed=false,pendingTerrain=null,pendingSince=0;
  let appliedTerrainKey=JSON.stringify(terrainSettings),pendingTerrainKey=appliedTerrainKey;
  function syncTerrain(force=false){
    if(disposed||!terrainConfig)return false;
    const next=readTerrainSettings(),key=JSON.stringify(next),now=performance.now();
    if(key===appliedTerrainKey){pendingTerrain=null;pendingTerrainKey=key;stats.terrainUpdatePending=false;return false;}
    if(key!==pendingTerrainKey){pendingTerrain=next;pendingTerrainKey=key;pendingSince=now;stats.terrainUpdatePending=true;}
    // Coalesce pointer drags. One settled edit updates normals and shadows once.
    if(!force&&now-pendingSince<80)return false;
    const started=performance.now();Object.assign(terrainSettings,pendingTerrain||next);
    maxHeight=0;
    for(let i=0;i<positions.length/3;i++){const y=heightFromSample(heightSamples,i*stride);positions[i*3+1]=y;maxHeight=Math.max(maxHeight,y);}
    geo.attributes.position.needsUpdate=true;if(detail){bakeCreases();geo.attributes.color.needsUpdate=true;if(reliefAttr)geo.attributes.aRelief.needsUpdate=true;}geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
    for(let i=0;i<slabSamples.length;i++){const slab=slabSamples[i];slab.matrix.elements[13]=heightFromSample(slab.sample)-slab.burial;slabs.setMatrixAt(i,slab.matrix);}
    slabs.instanceMatrix.needsUpdate=true;slabs.computeBoundingBox?.();slabs.computeBoundingSphere?.();
    if(logo)logo.sync();
    bounds.copy(geo.boundingBox);terrainBounds.center.copy(bounds.getCenter(dummy.position));bounds.getSize(terrainBounds.size);
    stats.maxHeight=maxHeight;stats.terrainRevision++;stats.lastTerrainUpdateMs=performance.now()-started;stats.terrainUpdatePending=false;
    appliedTerrainKey=key;pendingTerrain=null;return true;
  }
  return {group,rivers,stats,bounds:terrainBounds,descriptors,downstream,sampleHeight,mainAt,effects,flowPaths,riverDistance,syncTerrain,...(logo?{logo}:{}),
    update(time,reveal=0,confluence=0,reduced=false){if(disposed)return false;const changed=syncTerrain();if(logo)logo.update(reveal,confluence);effects.update(time,reveal,confluence,reduced);for(const r of [...rivers,...extensions])r.update(time);return changed;},
    dispose(){if(disposed)return;disposed=true;effects.dispose();for(const r of [...rivers,...extensions])r.dispose?.();for(const g of ownedGeometries)g.dispose();for(const m of ownedMaterials)m.dispose();group.clear();}
  };
}
