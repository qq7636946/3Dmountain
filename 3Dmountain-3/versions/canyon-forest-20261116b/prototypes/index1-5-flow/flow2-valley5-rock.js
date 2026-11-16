/* Flow2 valley, fifth round (2026-11-14 evening): ROCK AND FORMS (director A). index1-5-flow2.html only. ?v5rock=0 leaves it out.
   Client: 「整體山谷的精緻度再加5倍」. The fourth round made the stone's TEXTURE crisp on unchanged shapes; this one works on FORM
   and DEPTH: what a film set of a gorge has and a smooth textured sheet does not.

   1. ROCK THAT STANDS ON THE GROUND (?v5rocks=0). Real geometry where the silhouette shows: exact convex blocks (every face a
      flat break with a crisp edge, no rounded lumps), placed as a geologist would put them:
      - fallen blocks at the foot of the walls, more and bigger under the highest walls and below the gullies, a few rolled out
        over the shelf and into the shallows (fist-to-house sizes, few small ones: the client did not want gravel at the water);
      - stepped bed slabs on the rims of the low shelves (the soft rounded shelf edge becomes a broken stair of beds) and on the
        ledges of the walls;
      - talus fans at the wall foot under the gullies (never at the waterline);
      - crags along the crest lines (the skyline of every wall down the river breaks into teeth and notches).
      All in the canyon's own instanced-rock program (the shore blocks' program, with the fourth round's photographed stone):
      no new shader program, 4 draw calls, only a window along the river is drawn. Nothing in the flight corridor.
   2. DEPTH IN THE BIG FACES (?v5walls=0). One link in the walls' program, no texture read: the beds step in and out (the hard
      top of each bed overhangs a cut-back soft band: the underside turns down, the top is a ledge that catches the sky, the
      band holds shade and, on a sunlit face, the lip's own shadow), in two sizes (beds ~4.6 m near, packages ~14 m for the
      middle distance); upright joints split the face into pillars that each take the light a little differently.
   3. VALUE. The stone's albedo keeps a floor: rock in open shade shows its beds instead of going blue-black (bare stone only;
      the turf, the moss and the wet lap line keep theirs). The light itself is director C's.
   Every part fades out before it is finer than a pixel; nothing moves; all of it is gone before the lens climbs out (p 9.7+).

   How: chained onto window.__FLOW2_FINE_JOURNEY__.canyon (as the earlier rounds); the walls' link anchors on base-shader lines
   only (uniform prefix uV5R, cache key '|flow2-valley5-rock-1', no sampler); the banks' vertices are NOT moved, so
   height(x, z, base) returns base and anything planted stays on the ground. Rocks are built in slices (<= 4 ms) from the banks'
   own grid and the walls' own displacement (alpBankDisp, ported here, read from the erosion tile the page already loads).
   Live: window.__FLOW2_VALLEY5_ROCK__ = { tune, defaults, state, height, glsl }. Panel: 「山谷岩石」 (key V). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('v5rock') === '0') return;
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  /* director B (2026-11-16, client: 「這種很醜的需要改掉」 on a canyon close-up): the bed slabs read as cardboard — thin wide plates, long straight
     edges stacked in clean sheets, pale tops. Now: thicker beds in fewer, narrower steps, broken outlines, each bed turned on its own, the
     slabs toned like the rest of the stone; the plates leaned on the wall's ledges become chunky jointed blocks. Fewer triangles than before
     on the ledges, about the same at the water. ?rocks=old = the slabs as they were. */
  const OLD = Q.get('rocks') === 'old';
  const SLAB_TINT = OLD ? [1.3, .2] : [1.1, .28];
  const T = {
    amount: num('v5rockAmt', 1),      // all of it (0 = the page as the fourth round left it)
    walls: {
      on: Q.get('v5walls') !== '0',
      beds: 1,                        // how far each bed's hard top stands out (× 0.2-1.5 m)
      bedH: 6.5,                      // mean bed thickness (m); the packages for the middle distance are 3.1× that
      shadow: 1,                      // the lip's shadow on a sunlit face
      ao: .34,                        // shade held in the cut-back band
      far: .8,                        // the bed packages (middle distance)
      pillars: 1,                     // upright joints: the face split into pillars
      spacing: 7.5,                   // mean joint spacing (m)
      floor: .035                     // the stone's albedo floor (linear; 0 = off), stronger on faces turned from the sun
    },
    shore: {
      on: Q.get('v5shore') !== '0',
      relief: 1,                      // the shelves' jointed slabs and the wall foot's thin beds (walls' program)
      cell: 1.7,                      // slab size on the shelves (m)
      bedH: 1,                        // bed thickness at the wall's foot (m)
      cracks: 1,                      // the net of joints on every shore stone (instanced rock)
      crackCell: 1.1,                 // chunk size on the stones (m)
      lap: 1                          // the wet band on the stones (× ~0.36 m above the river)
    },
    rocks: {
      on: Q.get('v5rocks') !== '0',
      blocks: 1, slabs: 1, scree: 1, crags: 1,   // amounts (0-2; 1 = the default density)
      size: 1,                        // all rock sizes
      tone: 1                         // all rock brightness
    }
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  const state = { walls: 'not built yet', rocks: 'not built yet', patches: {}, programs: 0, counts: {}, drawn: {}, times: {}, notes: [] };
  const API = window.__FLOW2_VALLEY5_ROCK__ = {
    tune: T, defaults: clone(T), state,
    /* the banks' vertices are not moved by this module: what stands on the ground stays on it */
    height: (x, z, base) => base,
    glsl: '',
    vertex: 'none (no displacement added to the bank vertices)',
    /* resolves when the added rock is placed (or left out); then footprints() = Float32Array [x, z, radius, top y, ...] of every
       rock drawn at the present dials, for planting around them */
    whenReady: () => ready,
    footprints: () => {
      const out = []; if (!R0) return new Float32Array(0);
      const size = Math.max(.3, Math.min(2, +T.rocks.size || 1));
      for (const m of Object.keys(MESHES)) for (const r of R0.meshes[m].list) if (r.rank < amountOf(r.kind) * .5) out.push(r.p[0], r.p[2], r.r * size, r.p[1] + r.top * size);
      return new Float32Array(out);
    }
  };
  let markReady; const ready = new Promise(r => { markReady = r; });
  const amountOf = kind => T.rocks.on ? Math.max(0, Math.min(2, +T.rocks[kind] || 0)) * Math.max(0, Math.min(1.5, +T.amount || 0)) * tier().density[kind] : 0;
  const t0 = performance.now(), stamp = k => { state.times[k] = Math.round(performance.now() - t0); };
  /* quality tiers (flow2-quality.js): shader parts are decided from the tier the page STARTED at (low: the walls' relief and the
     stones' cracks are not even inserted); counts, distances and the cheaper paths follow the tier NOW (no recompiling) */
  const QL = window.__FLOW2_QUALITY__, RANKS = { low: 0, medium: 1, high: 2 };
  const startRank = QL && QL.start in RANKS ? RANKS[QL.start] : 2;
  let rankNow = QL && Number.isFinite(+QL.rank) ? Math.min(startRank, +QL.rank) : startRank;
  const TIER = [   // low, medium, high
    { density: { blocks: .45, slabs: .6, scree: 0, crags: 0 }, win: .5, far: 0, joints: 0, proj: 1, cracks: 0 },
    { density: { blocks: .7, slabs: .8, scree: .55, crags: .6 }, win: .7, far: 0, joints: 0, proj: 1, cracks: .6 },
    { density: { blocks: 1, slabs: 1, scree: 1, crags: 1 }, win: 1, far: 1, joints: 1, proj: 3, cracks: 1 }
  ];
  const tier = () => TIER[Math.max(0, Math.min(2, rankNow))];
  state.tier = { start: ['low', 'medium', 'high'][startRank], now: ['low', 'medium', 'high'][rankNow] };

  /* ================= the walls' link ================= */
  const count = (s, a) => s.split(a).length - 1;
  const A_MAIN = 'void main() {';
  const A_SCREE = '      float screeM=0.;';
  const A_NORMALS = '      // normals: rock / scree / plants / snow';
  const A_ALBEDO = '      alpAlbedo=col;alpSnow=snowM;alpGrass=grassM;';
  const DECL = `uniform vec4 uV5R,uV5R2,uV5R3,uV5RS,uV5RP;
float v5dS(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return 6.*t*(1.-t)/(b-a);}
/* joints as cells: (F2-F1 = twice the distance to the nearest joint, in cells; the cell's two hashes) */
vec3 v5Vor(vec2 p){
  vec2 ip=floor(p),fp=fract(p);float d1=8.,d2=8.;vec2 c1=vec2(0.),c2=vec2(0.);
  for(int i=-1;i<=1;i++)for(int j=-1;j<=1;j++){
    vec2 o=vec2(float(i),float(j)),r=o+aH2(ip+o)*.8+.1-fp;float d=dot(r,r);
    if(d<d1){d2=d1;c2=c1;d1=d;c1=ip+o;}else if(d<d2){d2=d;c2=ip+o;}
  }
  /* only about half of the cell edges are open joints (the pair's own hash): a few long fractures, not a mosaic */
  float open=step(.48,aH(c1+c2+vec2(.37,.61)));
  return vec3(open>.5?sqrt(d2)-sqrt(d1):9.,aH(c1+vec2(3.7,1.1)),aH(c1+vec2(8.3,5.9)));
}
/* flow2 valley5 rock: one set of beds along the dip coordinate. Each bed: a soft band at its foot, cut back; the hard top above
   it stands out by D (it overhangs the band: the underside turns down) and ends in a ledge whose top turns up. The transitions are
   never thinner than ~2 px. Returns (slope: metres out per metre up, recess shade, under-the-lip mask, fade); ex = (metres below
   the lip, metres set back from the hard face, the bed's own tone hash, o: 0 cut back .. 1 hard face). */
vec4 v5Bed(float dip,vec2 xz,float Hb,float foot,float seed,float depth,out vec4 ex){
  float b=dip/Hb;b+=(aNoise(vec2(b*.37,7.7+seed))-.5)*.9;
  float c=floor(b),f=b-c;
  float r1=aH(vec2(c,3.1+seed)),r2=aH(vec2(c,8.7+seed)),r3=aH(vec2(c,1.9+seed)),r4=aH(vec2(c,4.4+seed));
  float px=foot/Hb;
  /* most beds barely step; a few hard ones stand far out, and even they pinch out along the wall (runs of 25-70 m) */
  float strong=smoothstep(.6,.78,r1);
  float run=smoothstep(.32,.6,aNoise(xz/(26.+44.*r4)+vec2(c*7.31,c*1.73+seed)));
  float D=mix(.06,mix(.8,2.4,r4),strong*run)*depth;
  float a=mix(.25,.55,r2);
  float w1=max(.1,1.8*px),w2=max(.12,2.2*px);
  float s1=smoothstep(a,a+w1,f),s2=smoothstep(1.-w2,1.,f);
  float o=s1*(1.-s2);
  float dO=(v5dS(a,a+w1,f)*(1.-s2)-s1*v5dS(1.-w2,1.,f))*D/Hb;
  float rec=(1.-o)*smoothstep(.3,1.6,D)*(.55+.45*(1.-smoothstep(0.,a,f)));
  ex=vec4(max(a+w1*.5-f,0.)*Hb,D*(1.-o),r3,o);
  return vec4(dO,rec,step(f,a+w1),1.-smoothstep(.045,.12,px));
}
`;
  const G_FORM = `
      /* flow2 valley5 rock (flow2-valley5-rock.js): FORM in the big faces. Beds that step in and out (the hard top of each bed
         overhangs a cut-back soft band: underside turned down, ledge top turned up, shade in the band and the lip's shadow on a
         sunlit face), in two sizes (beds near, packages of beds for the middle distance); upright joints split the face into
         pillars. Analytic: no texture reads; every part fades out before it is finer than a pixel. */
      {
        #if NUM_DIR_LIGHTS > 0
        vec3 v5S=sunW;
        #else
        vec3 v5S=normalize(vec3(-.45,.55,-.7));
        #endif
        float v5K=uV5R.x*(1.-smoothstep(.5,.85,N0.y));
        if(v5K>.001&&foot<6.){
          vec3 v5Up=vec3(0.,1.,0.)-N0*N0.y;float v5ul=length(v5Up);v5Up/=max(v5ul,1e-4);
          vec3 v5Hz=vec3(N0.x,0.,N0.z);v5Hz/=max(length(v5Hz),1e-4);
          float v5Dip=P.y+dot(P.xz,vec2(.085,-.06))+(aNoise(P.xz*.016+vec2(2.7,9.1))-.5)*16.+(aNoise(P.xz*.06+vec2(6.3,1.2))-.5)*3.;
          float v5sf=dot(v5S,v5Hz),v5tan=max(v5S.y,0.)/max(v5sf,.05),v5lit=smoothstep(.02,.22,v5sf);
          vec4 v5e1,v5e2;
          vec4 v5b1=v5Bed(v5Dip,P.xz,uV5R2.x,foot,0.,uV5R.y,v5e1);
          vec4 v5b2=v5Bed(v5Dip+3.7,P.xz,uV5R2.x*3.1,foot,5.,uV5R.y*1.8,v5e2);
          float v5n=v5b1.w,v5m=v5b2.w*uV5R2.z;
          Nr=normalize(Nr-v5Up*clamp(v5b1.x*v5n+v5b2.x*v5m,-1.6,1.6)*v5K*v5ul);
          float v5sh1=smoothstep(-.12-foot,.12+foot,v5e1.y*v5tan-v5e1.x)*v5b1.z*v5lit;
          float v5sh2=smoothstep(-.2-foot,.2+foot,v5e2.y*v5tan-v5e2.x)*v5b2.z*v5lit;
          float v5ao=(1.-uV5R3.z*v5b1.y*v5n)*(1.-uV5R3.z*v5b2.y*v5m);
          float v5sh=1.-uV5R.w*.6*max(v5sh1*v5n,v5sh2*v5m);
          float v5tone=mix(1.,mix(.94,1.06,v5e1.z)*mix(.97,1.03,v5e1.w),v5n*.8)*mix(1.,mix(.95,1.05,v5e2.z),v5m*.6);
          rock*=mix(1.,v5ao*v5sh*v5tone,min(v5K,1.25));
          /* upright joints: pillars, each turned a little about the vertical, a dark crack between; bound to packages of beds
             (they stop at a ledge and start again, offset) */
          float v5P=uV5R.z*v5K;
          if(v5P>.001){
            float v5sp=max(uV5R3.x,1.),v5pk=floor(v5Dip/(uV5R2.x*3.1));
            float v5wx=W.x/max(W.x+W.z,1e-4);
            vec3 v5acc=vec3(0.);float v5g=0.;
            for(int k=0;k<2;k++){
              float fk=float(k),wk=k==0?v5wx:1.-v5wx;
              if(wk<.02)continue;
              float uu=(k==0?P.z:P.x)/v5sp;
              uu+=(aNoise(vec2(uu*.35+fk*5.,v5Dip*.025))-.5)*1.2+aH(vec2(v5pk,fk+5.3))*.9;
              float jc=floor(uu),jf=uu-jc,jpx=foot/v5sp;
              float pf=1.-smoothstep(.05,.13,jpx);
              float jw=max(.02,1.2*jpx);
              float gr=1.-smoothstep(jw*.5,jw*1.5,min(jf,1.-jf));
              float tl=aH(vec2(jc,v5pk+fk*3.1))-.5;
              vec3 tg=k==0?vec3(0.,0.,1.):vec3(1.,0.,0.);
              v5acc+=tg*tl*wk*pf;v5g+=gr*wk*pf;
            }
            Nr=normalize(Nr+(v5acc-Nr*dot(v5acc,Nr))*.45*v5P);
            rock*=1.-.1*v5g*min(v5P,1.25);
          }
        }
      }
`;
  const G_SHORE = `
      /* flow2 valley5 rock: the SHORE (shelves and the wall's foot, 0-8.5 m above the river, near the lens). The treads break
         into jointed slabs (crisp cracks, each slab tilted and toned on its own); the risers and the wall's foot into thin beds
         that step in and out (a dark line under each lip) cut by upright joints. Fades out by ~45 m. */
      {
        float v5Z=uV5RS.x*(1.-smoothstep(7.,9.,P.y))*smoothstep(-.4,.5,P.y)*(1.-smoothstep(.06,.12,foot));
        if(v5Z>.001){
          float v5up=smoothstep(.5,.75,N0.y);
          /* treads: two families of nearly straight joints ~80 degrees apart (spacing ~cell and 1.4 cell), each joint broken into
             lengths; crisp dark cracks, the blocks between them tilted and toned a little on their own */
          if(v5up>.01){
            float cs=uV5RS.z,sb=cs*1.4,aa=foot*1.3+.004;
            vec2 q=mat2(.8,.6,-.6,.8)*P.xz;
            float ua=q.x/cs+(aNoise(q*.13)-.5)*.7,ub=q.y/sb+(aNoise(q*.13+vec2(3.1,5.3))-.5)*.7;
            float ca=floor(ua),cb=floor(ub);
            float da=min(fract(ua),1.-fract(ua))*cs,db=min(fract(ub),1.-fract(ub))*sb;
            float pa=step(.3,aH(vec2(floor(ua+.5),cb+.5))),pb=step(.3,aH(vec2(floor(ub+.5)+7.7,ca+.5)));
            float cw=.02+.015*aH(vec2(ca,cb));
            float ck=max((1.-smoothstep(cw,cw+aa,da))*pa,(1.-smoothstep(cw,cw+aa,db))*pb)*(1.-smoothstep(.12,.3,foot/cs));
            float h1=aH(vec2(ca,cb)+3.3),h2=aH(vec2(ca,cb)+8.1);
            vec3 tl=vec3(h1-.5,0.,h2-.5)*.22;
            float kk=v5up*v5Z*uV5RS.y;
            Nr=normalize(Nr+(tl-Nr*dot(tl,Nr))*kk);
            rock*=mix(1.,mix(.92,1.08,h2)*(1.-.55*ck)*(1.-.14*(1.-smoothstep(cw,cw+.1,min(da/max(pa,.001),db/max(pb,.001))))),kk);
          }
          /* risers and the wall's foot */
          if(v5up<.99){
            float dip=P.y+dot(P.xz,vec2(.085,-.06))+(aNoise(P.xz*.06+vec2(6.3,1.2))-.5)*1.6;
            vec4 ex;vec4 bd=v5Bed(dip,P.xz,uV5RS.w,foot,11.,.55,ex);
            vec3 up=vec3(0.,1.,0.)-N0*N0.y;float ul=length(up);up/=max(ul,1e-4);
            float k=(1.-v5up)*v5Z*uV5RS.y*bd.w;
            Nr=normalize(Nr-up*clamp(bd.x,-1.6,1.6)*k*ul);
            float ck=0.,hv=.5;
            if(uV5R3.y>.5){
              float wx=W.x/max(W.x+W.z,1e-4);
              vec3 va=v5Vor(vec2(P.z,P.y*.55)/1.5+vec2(3.1,9.4)),vb=v5Vor(vec2(P.x,P.y*.55)/1.5+vec2(7.7,2.2));
              float aa=foot*1.3+.004;
              ck=mix(1.-smoothstep(.02,.02+aa,vb.x*.75),1.-smoothstep(.02,.02+aa,va.x*.75),wx)*(1.-smoothstep(.07,.16,foot/1.5));
              hv=mix(vb.y,va.y,wx);
            }
            rock*=mix(1.,(1.-.4*bd.y)*(1.-.5*ck)*mix(.9,1.1,hv),k);
          }
        }
      }
`;
  const G_VALUE = `      /* flow2 valley5 rock: value. Stone in open shade is lit by the whole sky: the dark end of the bare stone's albedo is lifted
         toward a floor (the turf, the moss and the wet lap line keep their own) */
      if(uV5R2.y>.001){
        float v5lt=.5;
        #if NUM_DIR_LIGHTS > 0
        v5lt=smoothstep(-.1,.35,dot(normalize(vec3(N0.x,0.,N0.z)+1e-5),normalize(vec3(sunW.x,0.,sunW.z)+1e-5)))*(1.-smoothstep(.6,.95,N0.y))+.5*smoothstep(.6,.95,N0.y);
        #endif
        float v5l=aLuma(col),v5fl=uV5R2.y*(1.-.55*alpWet)*(1.-.6*v5lt);
        float v5w=(1.-grassM)*(1.-mossM)*(1.-snowM)*(1.-forestM);
        float v5nl=v5l<v5fl?.6*v5fl+.4*v5l:v5l;
        col*=mix(1.,v5nl/max(v5l,1e-4),v5w);
      }
`;
  const G_PROP_CRACKS = `
        float v5cs=uV5RP.z,v5fk=uV5RP.y*uV5RP.x*(1.-smoothstep(.1,.22,foot/v5cs));
        if(v5fk>.001){
          vec3 a,b,c,Wc=W;
          if(uV5R3.w>1.5){a=v5Vor(vec2(P.z*.45,P.y)/v5cs+vec2(1.3,7.1));b=v5Vor(P.xz/v5cs+vec2(5.2,2.9));c=v5Vor(vec2(P.x*.45,P.y)/v5cs+vec2(8.8,4.4));}
          else{   /* (lighter tier: the face's own projection only) */
            vec2 q=W.x>W.y&&W.x>W.z?vec2(P.z*.45,P.y)+vec2(1.3,7.1)*v5cs:W.y>W.z?P.xz+vec2(5.2,2.9)*v5cs:vec2(P.x*.45,P.y)+vec2(8.8,4.4)*v5cs;
            a=b=c=v5Vor(q/v5cs);Wc=vec3(W.x>W.y&&W.x>W.z?1.:0.,W.x>W.y&&W.x>W.z?0.:W.y>W.z?1.:0.,0.);Wc.z=1.-Wc.x-Wc.y;
          }
          float aa=foot*1.3+.003,cw=.01;
          float ck=(1.-smoothstep(cw,cw+aa,a.x*.5*v5cs))*Wc.x+(1.-smoothstep(cw,cw+aa,b.x*.5*v5cs))*Wc.y+(1.-smoothstep(cw,cw+aa,c.x*.5*v5cs))*Wc.z;
          float hv=a.y*Wc.x+b.y*Wc.y+c.y*Wc.z;
          vec3 tl=(vec3(0.,a.y-.5,a.z-.5)*Wc.x+vec3(b.y-.5,0.,b.z-.5)*Wc.y+vec3(c.y-.5,c.z-.5,0.)*Wc.z)*.32;
          Nr=normalize(Nr+(tl-Nr*dot(tl,Nr))*v5fk);
          alpAlbedo*=mix(1.,mix(.92,1.08,hv)*(1.-.5*ck),v5fk);
        }
`;
  const G_PROP = `
      /* flow2 valley5 rock (flow2-valley5-rock.js): the shore's stones (all instanced rock, the page's shore blocks too): dry stone
         above the lap line, a crisp wet band where the river laps (darker, a satin sheen), and a net of joints that breaks each
         block into chunks with crisp cracks (near the lens only). */
      if(uV5RP.x>.001){
        float v5wl=uV5RP.w*(.36+(aNoise(P.xz*.9+vec2(3.3,1.7))-.5)*.3);
        float v5aa=max(foot*1.5,.015);
        float v5wet=1.-smoothstep(v5wl-v5aa,v5wl+v5aa,P.y);
        float v5damp=(1.-smoothstep(v5wl,v5wl+.45,P.y))*(1.-v5wet);
        float v5back=mix(1.,1./mix(1.,.45,alpWet),.55);
        alpAlbedo*=mix(1.,mix(v5back,.55,v5wet)*mix(1.,.8,v5damp),uV5RP.x);
        alpRough=mix(alpRough,mix(.9,.42,v5wet),uV5RP.x);
        alpWet=mix(alpWet,v5wet,uV5RP.x);
/*V5CRACKS*/      }
`;
  const U = { uV5R: { value: [0, 1, 1, 1] }, uV5R2: { value: [6.5, 0, .8, 0] }, uV5R3: { value: [7.5, 0, .42, 0] }, uV5RS: { value: [0, 1, 1.7, 1] }, uV5RP: { value: [0, 1, 1.1, 1] } };

  function walls(built) {
    if (!built?.scene) { state.walls = 'no canyon handed over'; return; }
    const seen = new Set();
    built.scene.traverse(object => {
      for (const material of [].concat(object.material || [])) {
        if (!material?.userData?.alpineTerrain || seen.has(material) || typeof material.onBeforeCompile !== 'function') continue;
        seen.add(material);
        const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
        material.onBeforeCompile = function (shader, renderer) {
          compile.call(this, shader, renderer);
          const f0 = shader.fragmentShader;
          if (f0.includes('#define ALP_LITE\n') || f0.includes('uV5R')) return;
          /* the instanced shore stones' program (the page's shore blocks and this round's rock) */
          if (f0.includes('#define ALP_PROP\n')) {
            const n = count(f0, A_NORMALS); state.patches.stones = n === 1 ? 'on' : 'skipped (' + n + ')';
            if (n !== 1 || !f0.includes(A_MAIN)) return;
            const gp = G_PROP.replace('/*V5CRACKS*/', startRank === 0 ? '' : G_PROP_CRACKS);
            shader.fragmentShader = f0.replace(A_MAIN, DECL + A_MAIN).replace(A_NORMALS, () => gp + A_NORMALS);
            for (const k of Object.keys(U)) shader.uniforms[k] = U[k];
            state.programs++; return;
          }
          /* the walls' full program only (not the phone's, not the mountains seen from the air) */
          if (!f0.includes('#define ALP_BANK\n')) return;
          if (!cap.erosion) { cap.erosion = shader.uniforms.alpineErosion || null; cap.relief = shader.uniforms.uCliffRelief || null; }
          if (!T.walls.on) { state.walls = 'off (?v5walls=0)'; return; }
          const nM = count(f0, A_MAIN), nR = count(f0, A_SCREE), nA = count(f0, A_ALBEDO);
          state.patches.form = nR === 1 ? 'on' : 'skipped (' + nR + ')'; state.patches.value = nA === 1 ? 'on' : 'skipped (' + nA + ')';
          if (nM < 1 || (nR !== 1 && nA !== 1)) { state.walls = 'the wall shader has changed: left as it was'; return; }
          let f = f0.replace(A_MAIN, DECL + A_MAIN);
          if (nR === 1 && startRank > 0) f = f.replace(A_SCREE, () => G_FORM + G_SHORE + A_SCREE);
          if (startRank === 0) state.patches.form = 'not at a low start';
          if (nA === 1) f = f.replace(A_ALBEDO, () => G_VALUE + A_ALBEDO);
          shader.fragmentShader = f;
          for (const k of Object.keys(U)) shader.uniforms[k] = U[k];
          state.programs++; state.walls = 'on'; stamp('wallsCompiled');
        };
        material.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|flow2-valley5-rock-1'; };
        material.needsUpdate = true;
      }
    });
    if (state.walls === 'not built yet') state.walls = seen.size ? 'waiting for the walls to be drawn' : 'no terrain material found';
  }
  const cap = { erosion: null, relief: null };

  /* ================= rock geometry: exact convex polyhedra ================= */
  const vAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vMul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const vCross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const vNorm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const rng = seed => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  function box(sx, sy, sz) {
    const S = [sx, sy, sz], F = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]];
    const m = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
    return F.map(([n, u, v]) => {
      const c = m(n, S), U2 = m(u, S), V2 = m(v, S);
      return { n, p: [vSub(vSub(c, U2), V2), vSub(vAdd(c, U2), V2), vAdd(vAdd(c, U2), V2), vAdd(vSub(c, U2), V2)] };
    });
  }
  /* keep n·x <= d; the cut leaves a flat cap with a crisp edge */
  function clip(faces, n, d) {
    const E = 1e-7, out = [], cap0 = [];
    for (const f of faces) {
      const res = [], P = f.p;
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length], da = vDot(n, a) - d, db = vDot(n, b) - d;
        if (da <= E) res.push(a);
        if (Math.abs(da) <= E) cap0.push(a);
        if ((da < -E && db > E) || (da > E && db < -E)) { const p = vAdd(a, vMul(vSub(b, a), da / (da - db))); res.push(p); cap0.push(p); }
      }
      if (res.length >= 3) out.push({ n: f.n, p: res });
    }
    const pts = [];
    for (const p of cap0) if (!pts.some(q => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) < 1e-6)) pts.push(p);
    if (pts.length >= 3) {
      const c = vMul(pts.reduce((s, p) => vAdd(s, p), [0, 0, 0]), 1 / pts.length);
      const a = Math.abs(n[0]) < .9 ? [1, 0, 0] : [0, 1, 0], cu = vNorm(vCross(n, a)), cv = vCross(n, cu);
      pts.sort((p, q) => Math.atan2(vDot(vSub(p, c), cv), vDot(vSub(p, c), cu)) - Math.atan2(vDot(vSub(q, c), cv), vDot(vSub(q, c), cu)));
      out.push({ n, p: pts });
    }
    return out;
  }
  const spanOn = (faces, n) => { let m = -1e9; for (const f of faces) for (const p of f.p) m = Math.max(m, vDot(n, p)); return m; };
  /* a jointed block: a box (the bedding level), fractures across it, corners knocked off */
  function block(R, sx, sy, sz, cuts, chips) {
    let f = box(sx, sy, sz);
    for (let k = 0; k < cuts; k++) {
      const az = R() * Math.PI * 2, el = (R() - .5) * 1.5, n = vNorm([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]);
      f = clip(f, n, spanOn(f, n) * (.62 + R() * .26));
    }
    for (let k = 0; k < chips; k++) {
      const n = vNorm([(R() < .5 ? -1 : 1) * (.6 + R() * .8), (R() < .5 ? -1 : 1) * (.6 + R() * .8), (R() < .5 ? -1 : 1) * (.6 + R() * .8)]);
      f = clip(f, n, spanOn(f, n) * (.8 + R() * .12));
    }
    return f;
  }
  function boulder(R, sx, sy, sz) {
    let f = box(sx, sy, sz);
    const cuts = 11 + Math.floor(R() * 5);
    for (let k = 0; k < cuts; k++) {
      const az = R() * Math.PI * 2, el = (R() - .35) * 1.9, n = vNorm([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]);
      f = clip(f, n, spanOn(f, n) * (.7 + R() * .22));
    }
    for (let k = 0; k < 6; k++) {
      const n = vNorm([(R() < .5 ? -1 : 1) * (.5 + R()), (R() < .5 ? -.4 : 1) * (.5 + R()), (R() < .5 ? -1 : 1) * (.5 + R())]);
      f = clip(f, n, spanOn(f, n) * (.84 + R() * .1));
    }
    for (let k = 0, n0 = 4 + Math.floor(R() * 2); k < n0; k++) {   /* the top breaks into sloping facets */
      const az = (k / n0 + R() * .2) * Math.PI * 2, el = .6 + R() * .5, n = vNorm([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]);
      f = clip(f, n, spanOn(f, n) * (.78 + R() * .12));
    }
    return f;
  }
  /* pieces → one geometry (flat facets), its local y = 0 at the burial line, terrainAO darker toward the ground */
  function build(THREE, pieces, bury, centred = false) {
    const pos = [], nor = [], m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3(), nn = new THREE.Vector3();
    for (const { faces, at, rot, scale } of pieces) {
      m.compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
      nm.getNormalMatrix(m);
      for (const f of faces) {
        nn.set(...f.n).applyMatrix3(nm).normalize();
        const P = f.p.map(p => v.set(...p).applyMatrix4(m).toArray());
        const c = vMul(P.reduce((s, p) => vAdd(s, p), [0, 0, 0]), 1 / P.length);
        for (let i = 0; i < P.length; i++) {
          const a = P[i], b = P[(i + 1) % P.length];
          pos.push(...c, ...a, ...b); for (let k = 0; k < 3; k++) nor.push(nn.x, nn.y, nn.z);
        }
      }
    }
    let y0 = Infinity, y1 = -Infinity; for (let i = 1; i < pos.length; i += 3) { y0 = Math.min(y0, pos[i]); y1 = Math.max(y1, pos[i]); }
    const H = y1 - y0, yb = y0 + bury * H, shift = centred ? (y0 + y1) / 2 : yb, ao = new Float32Array(pos.length / 3);
    for (let i = 0; i < ao.length; i++) { const y = pos[i * 3 + 1]; const t = Math.min(1, Math.max(0, (y - yb + .04 * H) / (.4 * H))); ao[i] = .5 + .5 * t * t * (3 - 2 * t); pos[i * 3 + 1] = y - shift; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('terrainAO', new THREE.BufferAttribute(ao, 1));
    g.computeBoundingSphere();
    g.userData.height = H * (1 - bury);
    return g;
  }
  function makeGeometries(THREE) {
    const R = rng(51077);
    /* fallen blocks: a big jointed block and two pieces that broke off it */
    const blocks = build(THREE, [
      { faces: boulder(R, 1, .8, .9), at: [0, 0, 0], rot: [.05, .3, -.04], scale: [1, 1, 1] },
      { faces: boulder(R, .5, .42, .46), at: [1.02, -.4, .38], rot: [.25, 1.1, .35], scale: [1, 1, 1] },
      { faces: boulder(R, .36, .3, .4), at: [-.6, -.52, .95], rot: [-.3, 2.2, .2], scale: [1, 1, 1] }
    ], .24);
    /* bed slabs: a run of three short stairs of beds along the shore (local x), each stepping down toward +z (the river): uneven
       bed thickness and set-back, broken edges, a fallen piece at the foot of some */
    const sl = [];
    for (let seg = 0; seg < 3; seg++) {
      const x0 = (seg - 1) * 1.95 + (R() - .5) * .3, beds = OLD ? 2 + Math.floor(R() * 2.6) : 2 + Math.floor(R() * 1.6);
      let y = 0, zb = (R() - .5) * .25, w = OLD ? .95 + R() * .25 : .78 + R() * .22, dpt = .85 + R() * .2;
      for (let k = 0; k < beds; k++) {
        const th = OLD ? .1 + R() * .17 : .17 + R() * .16;
        const turn = OLD ? [.07, .12, .07] : [.16, .34, .16];
        sl.push({ faces: block(R, w, th, dpt, OLD ? 4 : 6, OLD ? 6 : 9), at: [x0 + (R() - .5) * .25, y + th, zb], rot: [(R() - .5) * turn[0], (R() - .5) * turn[1], (R() - .5) * turn[2]], scale: [1, 1, 1] });
        y += th * 2 - .02; zb -= .2 + R() * .3; w *= .78 + R() * .14; dpt *= .74 + R() * .14;
      }
      if (R() < .6) { const s0 = .16 + R() * .2; sl.push({ faces: block(R, s0 * 1.3, s0 * .7, s0, 4, 4), at: [x0 + (R() - .5) * 1.2, s0 * .4, .95 + R() * .35], rot: [(R() - .5) * .5, R() * 6.28, (R() - .5) * .5], scale: [1, 1, 1] }); }
    }
    const slabs = build(THREE, sl, .14);
    /* a talus patch: angular stones of mixed size, piled low */
    const sp = [];
    for (let k = 0; k < 10; k++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * .95, s = .14 + Math.pow(R(), 1.6) * .3;
      sp.push({ faces: block(R, s, s * (.6 + R() * .3), s * (.75 + R() * .4), 3, 3), at: [Math.cos(a) * r, s * .35 - r * .18, Math.sin(a) * r], rot: [(R() - .5) * .8, R() * 6.28, (R() - .5) * .8], scale: [1, 1, 1] });
    }
    const scree = build(THREE, sp, .3);
    return { blocks, slabs, scree };
  }

  /* the page's own shore blocks (icosahedra cut by a few planes: soft lumps) get exact jointed blocks of the same size; the
     instances, their places and their material stay. Swapped back when this module is turned down to 0. */
  let sharp = null;
  function sharpen(THREE, scene) {
    const list = []; scene.traverse(o => { if (o.isInstancedMesh && /^Jointed shore blocks [A-D]$/.test(o.name || '')) list.push(o); });
    const flat = { A: .72, B: .6, C: .84, D: .52 };
    sharp = list.map(m => {
      const k = m.name.slice(-1), R = rng(7000 + k.charCodeAt(0));
      const g = build(THREE, [{ faces: boulder(R, .78, .74, .72), at: [0, 0, 0], rot: [0, R() * 6.28, 0], scale: [1, flat[k] || .7, 1] }], .5, true);
      return { mesh: m, orig: m.geometry, sharp: g };
    });
    state.sharpened = sharp.length;
  }
  let sharpOn = false;
  function sharpenSwap(want) {
    if (!sharp || want === sharpOn) return; sharpOn = want;
    for (const e of sharp) e.mesh.geometry = want ? e.sharp : e.orig;
  }

  /* ================= the walls' own displacement (alpBankDisp, as in alpine-terrain-material.js) ================= */
  function eroReader(tex) {
    const img = tex?.image; if (!img) return null;
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const c = new OffscreenCanvas(w, h), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, w, h).data, b = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) b[i] = d[i * 4 + 2];
    const flip = tex.flipY !== false;
    return (u, v) => {
      const x = u * w - .5, y = (flip ? 1 - v : v) * h - .5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const X0 = ((x0 % w) + w) % w, X1 = (X0 + 1) % w, Y0 = ((y0 % h) + h) % h, Y1 = (Y0 + 1) % h;
      const a = b[Y0 * w + X0], bb = b[Y0 * w + X1], c2 = b[Y1 * w + X0], dd = b[Y1 * w + X1];
      return ((a + (bb - a) * fx) * (1 - fy) + (c2 + (dd - c2) * fx) * fy) / 255;
    };
  }
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function bankDisp(B, relief, p, n) {
    const amp = 6 * relief * sstep(3, 14, p[1]) * (1 - sstep(.62, .9, n[1]));
    if (!B || amp <= .001) return p;
    const H = q => {
      let wx = Math.pow(Math.abs(n[0]), 4), wy = Math.pow(Math.abs(n[1]), 4), wz = Math.pow(Math.abs(n[2]), 4); const s = Math.max(wx + wy + wz, 1e-4); wx /= s; wy /= s; wz /= s;
      const h = B(q[2] / 64, q[1] * .62 / 64) * wx + B(q[0] / 64, q[2] / 64) * wy + B(q[0] / 64, q[1] * .62 / 64) * wz;
      const f = B(q[2] / 21 + .37, q[1] * .7 / 21 + .37) * wx + B(q[0] / 21 + .37, q[2] / 21 + .37) * wy + B(q[0] / 21 + .37, q[1] * .7 / 21 + .37) * wz;
      return Math.min(1, Math.max(0, h * .72 + f * .28 - .28));
    };
    return vAdd(p, vMul(n, H(p) * amp));
  }

  /* ================= placing the rock ================= */
  const nextFrame = () => new Promise(r => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(go); setTimeout(go, 160); });
  const slicer = () => { let t = performance.now(), worst = 0; return { get worst() { return worst; }, async rest(force) { const d = performance.now() - t; if (d > 4 || force) { worst = Math.max(worst, d); await nextFrame(); t = performance.now(); } } }; };
  const KINDS = ['blocks', 'slabs', 'scree', 'crags'];
  /* three meshes (three draw calls): the crest outcrops are blocks too */
  const MESHES = { blocks: ['blocks', 'crags'], slabs: ['slabs'], scree: ['scree'] };
  /* drawn window along the river, in rows (~3.2 m each): behind, ahead */
  const WINDOW = { blocks: [10, 200], slabs: [10, 115], scree: [10, 85], crags: [20, 430] };
  /* the instanced-rock program draws stone darker than the walls' (no wall lifts, wet below 5 m): matched here */
  const MATCH = 1.0;
  let R0 = null;   // the built rock: { meshes, data, rows, cen }
  /* each kind's footprint per unit of instance scale: horizontal radius (× max(sx, sz)), height above the ground (× sy) */
  const EXTENT = { blocks: [1.5, 1.25], slabs: [3.1, 1.3], scree: [1.1, .5], crags: [1.5, 1.25] };
  async function rocks(handles) {
    const { THREE, canyon } = handles, S = slicer();
    state.rocks = 'reading the banks'; stamp('rocksStart');
    const banks = canyon.scene.children.filter(m => m.userData?.rim && /shore detail/.test(m.name || '')).sort((a, b) => (/West/.test(a.name) ? 0 : 1) - (/West/.test(b.name) ? 0 : 1));
    if (banks.length !== 2) { state.rocks = 'the two banks were not found: no rock'; return; }
    let host = null; canyon.scene.traverse(o => { if (!host && o.isInstancedMesh && /Jointed shore blocks/.test(o.name || '') && o.material?.userData?.alpineTerrain) host = o; });
    if (!host) canyon.scene.traverse(o => { if (!host && o.isInstancedMesh && o.instanceColor && o.material?.userData?.alpineTerrain) host = o; });
    if (!host) { state.rocks = 'no instanced rock material found: no rock'; return; }
    try { sharpen(THREE, canyon.scene); } catch (error) { state.notes.push('shore blocks not sharpened: ' + (error?.message || error)); }
    /* the erosion tile (the walls' displacement reads it) */
    let B = null;
    try {
      const maps = await (handles.terrainTextures?.() || Promise.resolve(null));
      const ero = Array.isArray(maps) ? maps[6] : cap.erosion?.value;
      await S.rest(true);
      B = eroReader(ero || cap.erosion?.value);
    } catch (error) { state.notes.push('erosion tile not read: rock above 3 m may float by up to a few metres'); }
    stamp('tile'); await S.rest(true);
    const relief = Math.min(2.5, Math.max(0, +(window.__ALPINE_TERRAIN__?.cliffRelief ?? 1) || 0));
    const { rows, columns: C } = banks[0].userData.rim, L = rows - 1;
    const lat = j => Math.pow(j / (C - 1), 1.62) * 250;
    /* the river: centre, level normal, half width per row */
    const cen = new Float32Array(rows * 2), nrm = new Float32Array(rows * 2), half = new Float32Array(rows), tan = new Float32Array(rows * 2);
    for (let i = 0; i < rows; i++) {
      const t = i / L, c = canyon.curve.getPointAt(t), d = canyon.curve.getTangentAt(t);
      cen[i * 2] = c.x; cen[i * 2 + 1] = c.z; tan[i * 2] = d.x; tan[i * 2 + 1] = d.z; nrm[i * 2] = -d.z; nrm[i * 2 + 1] = d.x; half[i] = canyon.widthAt(t);
      if (!(i & 127)) await S.rest();
    }
    const camLat = Math.abs(+(window.__MONTIS_STUDY__?.CONFIG?.canyonView?.lateral) || 0) + 1;
    const data = {}; for (const k of KINDS) data[k] = [];
    const R = rng(90211);
    for (let s = 0; s < 2; s++) {
      const bank = banks[s], side = s === 0 ? -1 : 1, P = bank.geometry.attributes.position.array, N = bank.geometry.attributes.normal.array;
      const at = (i, j) => { const o = (i * C + j) * 3; return [P[o], P[o + 1], P[o + 2]]; };
      const nAt = (i, j) => { const o = (i * C + j) * 3; return [N[o], N[o + 1], N[o + 2]]; };
      /* a point on the bank at row i (fractional) and lateral column jf (fractional), with its normal; displaced as the walls are */
      const ground = (fi, jf) => {
        const i0 = Math.max(0, Math.min(L - 1, Math.floor(fi))), j0 = Math.max(0, Math.min(C - 2, Math.floor(jf))), a = Math.min(1, Math.max(0, fi - i0)), b = Math.min(1, Math.max(0, jf - j0));
        const mix3 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
        const p = mix3(mix3(at(i0, j0), at(i0, j0 + 1), b), mix3(at(i0 + 1, j0), at(i0 + 1, j0 + 1), b), a);
        const n = vNorm(mix3(mix3(nAt(i0, j0), nAt(i0, j0 + 1), b), mix3(nAt(i0 + 1, j0), nAt(i0 + 1, j0 + 1), b), a));
        return { p: bankDisp(B, relief, p, n), n };
      };
      const jOf = d => (C - 1) * Math.pow(Math.max(0, d) / 250, 1 / 1.62);
      /* per row: the waterline, the wall's foot, its brow, the skyline seen from the river, the wall's height */
      const info = new Array(rows);
      for (let i = 0; i < rows; i++) {
        let shore = 0; while (shore < C - 1 && at(i, shore)[1] < .05) shore++;
        let foot = -1;
        for (let j = Math.max(1, shore); j < C - 6; j++) {
          const d0 = lat(j), y0 = at(i, j)[1], d1 = lat(j + 1), y1 = at(i, j + 1)[1];
          if ((y1 - y0) / Math.max(.2, d1 - d0) > .9 && at(i, Math.min(C - 1, j + 5))[1] - y0 > 6) { foot = j; break; }
        }
        let brow = -1, sky = -1, best = -1e9;
        const cx = cen[i * 2], cz = cen[i * 2 + 1];
        if (foot >= 0) for (let j = foot + 1; j < C - 1; j++) {
          const d0 = lat(j), y0 = at(i, j)[1], y1 = at(i, j + 1)[1];
          if (brow < 0 && (y1 - y0) / Math.max(.2, lat(j + 1) - d0) < .45) brow = j;
        }
        for (let j = Math.max(1, shore); j < C; j++) {
          const p = at(i, j), e = Math.atan2(p[1] - 2.4, Math.hypot(p[0] - cx, p[2] - cz));
          if (e > best) { best = e; sky = j; }
        }
        const fy = foot >= 0 ? at(i, foot)[1] : 0, by = brow >= 0 ? at(i, brow)[1] : fy;
        info[i] = { shore, foot, brow, sky, wallH: Math.max(0, by - fy), footY: fy };
        if (!(i & 63)) await S.rest();
      }
      /* gullies: the wall stands back (lower at the same distance past its foot) against the rows either side */
      const hAt = i => { const f = info[i]; return f.foot >= 0 ? at(i, Math.min(C - 1, f.foot + 3))[1] : 0; };
      for (let i = 0; i < rows; i++) {
        let m = 0, n = 0; for (const o of [-6, -5, -4, 4, 5, 6]) { const k = i + o; if (k >= 0 && k < rows) { m += hAt(k); n++; } }
        info[i].gully = n ? Math.max(0, m / n - hAt(i)) : 0;
        const a = Math.max(0, i - 8), b = Math.min(L, i + 8), turn = (tan[b * 2] - tan[a * 2]) * nrm[i * 2] + (tan[b * 2 + 1] - tan[a * 2 + 1]) * nrm[i * 2 + 1];
        info[i].inside = turn * side > .02 ? 1 : 0;
      }
      await S.rest();
      /* clear of the flight: the lens slides toward the inside of a bend (canyon-racing.js, at most 0.45 x the half width) and
         keeps near the centre line elsewhere; toward this bank it reaches 0.45 w where this bank is the inside of a bend within
         ~35 m, else 0.18 w (+ the view's lateral offset). Nothing within 5 m of that, nothing over 1.2 m high within 9 m. */
      const reach = new Float32Array(rows);
      for (let i = 0; i < rows; i++) { let ins = 0; for (let k = Math.max(0, i - 11); k <= Math.min(L, i + 11); k++) ins = Math.max(ins, info[k].inside); reach[i] = (ins ? .45 : .18) * half[i] + camLat; }
      const clear = (i, p, r, top) => {
        const k = Math.max(0, Math.min(L, Math.round(i))), off = ((p[0] - cen[k * 2]) * nrm[k * 2] + (p[2] - cen[k * 2 + 1]) * nrm[k * 2 + 1]) * side;
        const room = off - r - reach[k];
        return room > 9 || (room > 5 && top < 1.2);
      };
      const yawTo = (dx, dz) => Math.atan2(dx, dz);   // rotation about y that turns local +z to (dx, dz)
      const push = (kind, i, g, o) => {
        const { p, n } = g, q = new THREE.Quaternion();
        const up = new THREE.Vector3(...n), lean = o.lean ?? .5;
        const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0).lerp(up, lean).normalize());
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.yaw).premultiply(tilt);
        if (o.rx || o.rz) q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, 0, o.rz || 0)));
        const ext = EXTENT[kind], sxz = Math.max(o.s[0], o.s[2]), y = p[1] + (o.dy || 0);
        /* (the stones' program link takes the page's broad wet darkening back above the lap line; MATCH evens the rest) */
        const comp = MATCH;
        data[kind].push({ kind, row: i, rank: R(), p: [p[0], y, p[2]], q: [q.x, q.y, q.z, q.w], s: o.s, tint: o.tint.map(v => v * comp), r: sxz * ext[0], top: o.s[1] * ext[1] });
      };
      const tintOf = (base, spread, fresh) => { const v = base + (R() - .5) * spread; return fresh ? [v * 1.06, v * 1.08, v * 1.1] : [v * (.98 + R() * .04), v, v * (1 + R() * .05)]; };
      for (let i = 2; i < rows - 2; i++) {
        const f = info[i]; if (f.foot < 0) continue;
        const ox = nrm[i * 2] * side, oz = nrm[i * 2 + 1] * side;   // outward from the river, level
        const dShore = lat(f.shore), dFoot = lat(f.foot), shelf = dFoot - dShore;
        const tall = Math.min(1.6, .35 + f.wallH / 70), gully = Math.min(1, f.gully / 3.5);
        /* fallen blocks (generated at twice the default density; the rank decides what the amount shows) */
        const nB = (.28 * tall + .5 * gully) * 2;
        for (let k = 0, n = Math.floor(nB + R()); k < n; k++) {
          const u = R(), roll = R();
          let d, size = Math.min(1.1 + 3.4 * tall, .55 * Math.pow(1 - R() * .985, -1 / 1.55));
          if (roll < .66) d = dFoot - Math.abs(R() + R() - 1) * (2.5 + .05 * f.wallH) - size * .3;
          else if (roll < .9) d = dShore + 1 + R() * Math.max(0, shelf - 1);
          else { d = dShore - .5 - R() * 3.5; size = Math.min(size, 2.4); }
          const fi = i + (u - .5), g = ground(fi, jOf(d));
          if (d < dShore) g.p[1] = Math.max(g.p[1], -1.2);
          const sx = size * (.8 + R() * .5), sy = size * (.7 + R() * .45), sz = size * (.8 + R() * .5);
          const top = g.p[1] + sy * .95 * 1.6;
          if (!clear(fi, g.p, Math.max(sx, sz) * 1.6, top)) continue;
          push('blocks', i, g, { yaw: R() * 6.283, lean: .45, rx: (R() - .5) * .3, rz: (R() - .5) * .3, s: [sx, sy, sz], tint: tintOf(size > 3 && R() < .35 ? 1.4 : 1.25, .22, size > 3 && R() < .3) });
        }
        /* THE SHORE (first priority, client: 「海岸岩石細緻度要再繼續加強1倍」) */
        /* 1. the shelf's RISER at the water: a broken stair of beds from the river up to the shelf's top, never above it (the
              turf and the grass on the shelf stay in view over it), in runs that overlap (about one stair per row) */
        if (shelf > 2.5) for (let k = 0, n = 1 + (R() < (OLD ? .45 : .25) ? 1 : 0); k < n; k++) {
          const fi = i + (R() - .5) * 1.2, d = dShore - .6 + R() * .8, g = ground(fi, jOf(Math.max(0, d)));
          g.p[1] = Math.max(g.p[1], -.6);
          const top = ground(fi, jOf(dShore + Math.min(2.5, shelf * .5))).p[1], room = top - g.p[1];
          if (room < .35) continue;
          const len = OLD ? 3 + R() * 4 : 2.2 + R() * 2.6, sx = len / 6, sy = Math.min(1.25, room * (.75 + R() * .2)) / 1.1, sz = .6 + R() * .45;
          if (!clear(fi, g.p, len * .55 * 1.6, g.p[1] + sy * 1.2 * 1.6)) continue;
          push('slabs', i, g, { yaw: yawTo(-ox, -oz) + (R() - .5) * .45, lean: .4, s: [sx, sy, sz], tint: tintOf(SLAB_TINT[0], SLAB_TINT[1]) });
        }
        /* 2. the wall's foot steps down in beds (its lowest 0-8 m): bigger stairs set into the foot */
        if (f.wallH > 25 && R() < .22) {
          const d = dFoot - .6 + R() * 1.4, fi = i + R() - .5, g = ground(fi, jOf(d));
          if (g.p[1] < 8) {
            const len = 4 + R() * 4, sx = len / 6, sy = 1 + R() * 1.4, sz = 1.1 + R() * 1.2;
            if (clear(fi, g.p, len * .55 * 1.6, g.p[1] + sy * 1.2 * 1.6)) push('slabs', i, g, { yaw: yawTo(-ox, -oz) + (R() - .5) * .45, lean: .3, dy: -sy * .25, s: [sx, sy, sz], tint: tintOf(SLAB_TINT[0], SLAB_TINT[1] * .9) });
          }
        }
        /* 3. boulders at the waterline and in the shallows, in small groups (sharp facets, a wet band where the water laps) */
        if (R() < .42) {
          const d0 = dShore - 2.5 + R() * 3, fi0 = i + R() - .5;
          for (let k = 0, n = 1 + Math.floor(R() * 2.2); k < n; k++) {
            const size = .3 + Math.pow(R(), 2) * .75, d = d0 + (R() - .5) * 2.2, fi = fi0 + (R() - .5) * .8, g = ground(fi, jOf(d));
            if (d < dShore) g.p[1] = Math.max(g.p[1], -1.1);
            const shelfTop = ground(fi, jOf(dShore + 2)).p[1];
            const sx = size * (.8 + R() * .5), sz = size * (.8 + R() * .5);
            let sy = size * (.65 + R() * .4); sy = Math.min(sy, Math.max(.2, (shelfTop + .15 - g.p[1]) / 1.25));
            if (!clear(fi, g.p, Math.max(sx, sz) * 1.5 * 1.6, g.p[1] + sy * 1.25 * 1.6)) continue;
            push('blocks', i, g, { yaw: R() * 6.283, lean: .35, rx: (R() - .5) * .4, rz: (R() - .5) * .4, s: [sx, sy, sz], tint: tintOf(1.2, .22) });
          }
        }
        /* 4. pebbles and small stones between them: patches on the shelf, not a carpet */
        if (shelf > 1.5 && R() < .55) {
          const d = dShore + .3 + R() * Math.max(.5, shelf - .8), fi = i + R() - .5, g = ground(fi, jOf(d)), sc = .55 + R() * .7;
          if (clear(fi, g.p, sc * 1.1 * 1.6, g.p[1] + sc * .5)) push('scree', i, g, { yaw: R() * 6.283, lean: .85, s: [sc, sc * (.5 + R() * .3), sc * (.8 + R() * .4)], tint: tintOf(1.2, .2) });
        }
        /* the wall's benches higher up: joint blocks on the ledges */
        for (let j = f.foot + 1; j < Math.min(C - 2, (f.brow > 0 ? f.brow : f.foot + 8) + 3); j++) {
          const y0 = at(i, j - 1)[1], y1 = at(i, j)[1], y2 = at(i, j + 1)[1], d0 = lat(j - 1), d1 = lat(j), d2 = lat(j + 1);
          const below = (y1 - y0) / Math.max(.2, d1 - d0), above = (y2 - y1) / Math.max(.2, d2 - d1);
          if (y1 > 6 && y1 < 70 && below > 1 && above < .55 && R() < (OLD ? .5 : .32)) {
            const g = ground(i + R() - .5, j + R() * .6), len = 4 + R() * 6, sx = len / 6, sy = .8 + R() * 1.3, sz = len * (.18 + R() * .1);
            if (OLD) push('slabs', i, g, { yaw: yawTo(-ox, -oz) + (R() - .5) * .6, lean: .8, s: [sx, sy, sz], tint: tintOf(1.3, .2) });
            else { const c = Math.min(2.2, .55 + len * .12), sits = g.n[1] > .55;   /* a block on a ledge too steep to hold it would hang off the wall */
              const s0 = [c * (.9 + R() * .35), c * (.75 + R() * .3), c * (.85 + R() * .35)], yw = R() * 6.283, rx0 = (R() - .5) * .3, rz0 = (R() - .5) * .3;
              if (sits) push('blocks', i, g, { yaw: yw, lean: .75, rx: rx0, rz: rz0, dy: -c * .35, s: s0, tint: tintOf(1.15, .24) }); }
          }
        }
        /* talus: fans under the gullies, an apron along the foot; never within 2 m of the water */
        const fans = gully > .25 ? 4 + Math.floor(gully * 6) : (R() < .22 ? 1 : 0);
        for (let k = 0; k < fans * 2; k++) {
          const dist = Math.pow(R(), .8) * (5 + 9 * gully), lateralRows = (R() - .5) * dist * .9 / 3.2;
          const d = Math.max(dShore + 2, dFoot - .5 - dist), g = ground(i + lateralRows, jOf(d));
          if (g.p[1] < .6) continue;
          const sc = 1.5 + R() * 1.8;
          if (!clear(i + lateralRows, g.p, sc * 1.6, g.p[1] + sc * .5)) continue;
          push('scree', i, g, { yaw: R() * 6.283, lean: .85, s: [sc, sc * (.45 + R() * .3), sc * (.8 + R() * .4)], tint: tintOf(1.2, .16) });
        }
        /* crest outcrops: chunky jointed blocks sunk into the skyline seen from the river (a broken crest, not a row of teeth) */
        if (f.sky > f.foot && R() < .32) {
          const g = ground(i + R() - .5, f.sky + (R() - .5) * .6);
          if (g.p[1] > 22) {
            const sz0 = Math.min(OLD ? 7 : 4.5, Math.max(2, (.025 + R() * .035) * g.p[1]));
            const yw = R() * 6.283, rx0 = (R() - .5) * .25, rz0 = (R() - .5) * .25, a0 = R(), a1 = R(), a2 = R(), tc = tintOf(OLD ? 1.3 : 1.15, OLD ? .16 : .22);
            if (OLD) push('crags', i, g, { yaw: yw, lean: .6, rx: rx0, rz: rz0, dy: -sz0 * .35, s: [sz0 * (1 + a0 * .5), sz0 * (.45 + a1 * .3), sz0 * (.9 + a2 * .4)], tint: tc });
            else if (g.n[1] > .6) push('crags', i, g, { yaw: yw, lean: .9, rx: rx0, rz: rz0, dy: -sz0 * .55, s: [sz0 * (.9 + a0 * .35), sz0 * (.75 + a1 * .35), sz0 * (.85 + a2 * .35)], tint: tc });   /* crest too steep: none */
          }
        }
        if (!(i & 31)) await S.rest();
      }
    }
    stamp('placed');
    /* the meshes: the shore blocks' own material (same program), one window of instances drawn */
    const G = makeGeometries(THREE); await S.rest(true);
    const meshes = {};
    for (const m of Object.keys(MESHES)) {
      const list = [].concat(...MESHES[m].map(k => data[k])).sort((a, b) => a.row - b.row), n = list.length;
      const first = new Int32Array(rows + 2); { let c = 0; for (let i = 0; i <= rows + 1; i++) { while (c < n && list[c].row < i) c++; first[i] = c; } }
      const mesh = new THREE.InstancedMesh(G[m], host.material, Math.max(1, n));
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, new THREE.Color(1, 1, 1)); mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = !!host.castShadow; mesh.receiveShadow = !!host.receiveShadow;
      mesh.name = 'flow2 valley5 rock · ' + m; mesh.userData.flow2Valley5 = true;
      meshes[m] = { mesh, list, first, at: -1e9, sig: '', kinds: MESHES[m] };
      canyon.scene.add(mesh);
    }
    for (const k of KINDS) state.counts[k] = data[k].length;
    R0 = { meshes, rows, cen, THREE, host };
    markReady(true);
    state.rocks = 'on'; state.worstSlice = Math.round(S.worst * 10) / 10; stamp('rocksBuilt');
    state.liveAtBuild = !!document.body?.classList.contains('is-ready') && document.documentElement.dataset.flow2Still !== 'on';
  }

  /* the drawn window: the instances in rows around the lens, at the amount and size the dials ask */
  const _m = { p: null, q: null, s: null, m: null, c: null };
  function windowUpdate(entry, iCam, force) {
    const T2 = T.rocks, amt = {}; let sig = (+T2.size).toFixed(3) + '|' + (+T2.tone).toFixed(3) + '|' + rankNow;
    for (const k of entry.kinds) { amt[k] = amountOf(k); sig += '|' + amt[k].toFixed(3); }
    if (!force && sig === entry.sig && Math.abs(iCam - entry.at) < 3) return;
    entry.sig = sig; entry.at = iCam;
    const THREE = R0.THREE, { mesh, list, first } = entry;
    _m.p ||= new THREE.Vector3(); _m.q ||= new THREE.Quaternion(); _m.s ||= new THREE.Vector3(); _m.m ||= new THREE.Matrix4();
    const wk = tier().win;
    let back = 0, ahead = 0; for (const k of entry.kinds) { back = Math.max(back, WINDOW[k][0]); ahead = Math.max(ahead, Math.round(WINDOW[k][1] * wk)); }
    const i0 = Math.max(0, iCam - back), i1 = Math.min(R0.rows, iCam + ahead), size = Math.max(.3, Math.min(2, +T2.size || 1)), tone = Math.max(.3, Math.min(2, +T2.tone || 1));
    const M = mesh.instanceMatrix.array, Cc = mesh.instanceColor.array; let n = 0;
    for (let c = first[i0], e = first[i1 + 1]; c < e; c++) {
      const r = list[c], w = WINDOW[r.kind];
      if (r.rank >= amt[r.kind] * .5 || r.row < iCam - w[0] || r.row > iCam + w[1] * wk) continue;
      _m.p.set(r.p[0], r.p[1], r.p[2]); _m.q.set(r.q[0], r.q[1], r.q[2], r.q[3]); _m.s.set(r.s[0] * size, r.s[1] * size, r.s[2] * size);
      _m.m.compose(_m.p, _m.q, _m.s); _m.m.toArray(M, n * 16);
      Cc[n * 3] = r.tint[0] * tone; Cc[n * 3 + 1] = r.tint[1] * tone; Cc[n * 3 + 2] = r.tint[2] * tone; n++;
    }
    mesh.count = n; state.drawn[entry.kinds.join('+')] = n;
    mesh.instanceMatrix.clearUpdateRanges?.(); mesh.instanceMatrix.addUpdateRange?.(0, Math.max(16, n * 16)); mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.clearUpdateRanges?.(); mesh.instanceColor.addUpdateRange?.(0, Math.max(3, n * 3)); mesh.instanceColor.needsUpdate = true;
  }

  /* ================= every frame ================= */
  let running = false, iCam = -1, dirty = true;
  const smooth = sstep;
  function start() {
    if (running) return; running = true;
    (function frame() {
      requestAnimationFrame(frame);
      const S = window.__MONTIS_STUDY__, p = +S?.journey?.progress;
      const LF = window.__FLOW2_LIFT_FADE__, dial = Number.isFinite(p) ? 1 - smooth(LF ? LF[0] : 9.7, LF ? LF[1] : 10.7, p) : 1; /* flow2 unify (2026-11-14): with the lift cut on, the canyon keeps its full look up to the cut (window.__FLOW2_LIFT_FADE__, set by flow2-lift-cut.js); without it, the original window */
      const A = Math.max(0, Math.min(1.5, +T.amount || 0)) * dial, W = T.walls, on = W.on ? A : 0;
      const a = U.uV5R.value, b = U.uV5R2.value, c = U.uV5R3.value;
      a[0] = on; a[1] = +W.beds; a[2] = +W.pillars; a[3] = +W.shadow;
      const TT = tier();
      b[0] = Math.max(1, +W.bedH || 6.5); b[1] = (+W.floor || 0) * Math.min(1, on); b[2] = +W.far * TT.far;
      c[1] = TT.joints; c[3] = TT.proj;
      c[0] = Math.max(1, +W.spacing || 7.5); c[2] = +W.ao;
      const SH = T.shore, sOn = SH.on ? A : 0, us = U.uV5RS.value, up = U.uV5RP.value;
      us[0] = W.on ? sOn : 0; us[1] = +SH.relief; us[2] = Math.max(.4, +SH.cell || 1.7); us[3] = Math.max(.3, +SH.bedH || 1);
      up[0] = sOn; up[1] = +SH.cracks * TT.cracks; up[2] = Math.max(.15, +SH.crackCell || 1.1); up[3] = Math.max(0, +SH.lap);
      sharpenSwap(T.rocks.on && A > 0);
      if (!R0) return;
      const show = !(Number.isFinite(p) && p > 10.35);
      /* receive the sun's shadow as the page's own shore blocks do (a uniform, not a program change; they switch it with the canyon
         phase). They do not cast: only a window of them exists at a time and the shadow map is baked once. */
      const rs = !!R0.host?.receiveShadow;
      for (const m of Object.keys(MESHES)) { const me = R0.meshes[m].mesh; me.visible = show; me.receiveShadow = rs; }
      if (!show) return;
      /* the lens's row: searched near the last one */
      const cam = S?.canyon?.camera || window.__MONTIS_STUDY__?.camera; if (!cam) return;
      const x = cam.position.x, z = cam.position.z, rows = R0.rows, cen = R0.cen;
      let best = iCam, bd = Infinity; const lo = iCam < 0 ? 0 : Math.max(0, iCam - 14), hi = iCam < 0 ? rows - 1 : Math.min(rows - 1, iCam + 14);
      for (let i = lo; i <= hi; i++) { const d = (cen[i * 2] - x) ** 2 + (cen[i * 2 + 1] - z) ** 2; if (d < bd) { bd = d; best = i; } }
      iCam = best;
      for (const m of Object.keys(MESHES)) windowUpdate(R0.meshes[m], iCam, dirty);
      dirty = false;
    })();
  }

  QL?.on?.(e => { rankNow = Math.min(startRank, Number.isFinite(+e?.rank) ? +e.rank : rankNow); state.tier.now = ['low', 'medium', 'high'][rankNow]; dirty = true; });

  /* ================= the panel ================= */
  window.__FLOW2_PANEL__?.add({
    id: 'valley5-rock', title: '山谷岩石', key: 'v', tune: T,
    rows: [
      ['整體強度', 'amount', 0, 1.5, .01],
      ['— 水邊岩石 —'],
      ['平台的裂縫與岩塊', 'shore.relief', 0, 2, .01], ['平台岩塊大小（公尺）', 'shore.cell', .6, 4, .05], ['岩壁腳岩層厚度（公尺）', 'shore.bedH', .4, 3, .05],
      ['石頭的裂紋', 'shore.cracks', 0, 2, .01], ['裂紋間距（公尺）', 'shore.crackCell', .3, 2.5, .01], ['石頭水線高度', 'shore.lap', 0, 3, .01],
      ['— 岩壁的層次 —'],
      ['岩層凸出', 'walls.beds', 0, 2.5, .01], ['岩層厚度（公尺）', 'walls.bedH', 2, 12, .1], ['岩層下的陰影', 'walls.shadow', 0, 1.6, .01],
      ['凹處的暗部', 'walls.ao', 0, .9, .01], ['遠處的大岩層', 'walls.far', 0, 2, .01],
      ['直向節理（岩柱）', 'walls.pillars', 0, 2.5, .01], ['節理間距（公尺）', 'walls.spacing', 3, 20, .1],
      ['岩石暗部提亮', 'walls.floor', 0, .25, .005],
      ['— 落石與碎石 —'],
      ['崩落巨石', 'rocks.blocks', 0, 2, .01], ['平台邊的岩階', 'rocks.slabs', 0, 2, .01], ['岩壁腳的碎石坡', 'rocks.scree', 0, 2, .01],
      ['稜線岩峰', 'rocks.crags', 0, 2, .01], ['石頭大小', 'rocks.size', .5, 1.6, .01], ['石頭明暗', 'rocks.tone', .6, 1.5, .01]
    ],
    onChange: () => { dirty = true; }
  });

  /* ================= hook: after the earlier rounds on the page's hand-over call ================= */
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const before = host.canyon;
  host.canyon = function (handles = {}) {
    try { return before?.call(this, handles); } finally {
      stamp('canyon');
      if (handles.lite || innerWidth < 760) { state.walls = state.rocks = 'off: the lighter drawing'; markReady(false); }
      else {
        try { walls(handles.canyon); } catch (error) { state.walls = 'failed: ' + (error?.message || error); console.warn('flow2 valley5 rock: the walls keep their look', error); }
        if (T.rocks.on) rocks(handles).catch(error => { state.rocks = 'failed: ' + (error?.message || error); console.warn('flow2 valley5 rock: no added rock', error); }).finally(() => markReady(!!R0));
        else { state.rocks = 'off (?v5rocks=0)'; markReady(false); }
        start();
      }
    }
  };
  /* when the page is live (for the record: was the rock there before the first live frame?) */
  (function watch() { if (document.body?.classList.contains('is-ready') && document.documentElement.dataset.flow2Still !== 'on') { stamp('pageLive'); return; } setTimeout(watch, 100); })();
})();
