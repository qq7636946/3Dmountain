import*as THREE from"three";import{HIGHLAND_GLSL,packArrivalField}from"./studio-highland-ecology.js?v=weather1-bank1-fast1";import{createStudioClouds}from"./studio-clouds.js?v=look1";import{createShoreCobbles}from"./studio-shore-cobbles.js?v=bank-toes1";import{refineHeadwaterBanks,headwaterStones}from"./studio-headwater-detail.js?v=ridge-banks2";const REFINE_HEADWATERS=document.documentElement.hasAttribute("data-rise-headwater-detail")&&new URLSearchParams(location.search).get("headwaters")!=="0",PBR_VER="pbr-20261119-09",SHORE_VER="shore-2",CORE_COLUMNS=256,CORE_ROWS=144,SHORE_ATLAS_GLSL=`
  // Both tiles have a periodic gutter equal to 1/16 of their width. Use the unwrapped
  // derivatives so a tile seam cannot select a coarse mip across the atlas.
  vec4 stTileGrad(sampler2D materialMap, vec2 uv, float tile, vec2 du, vec2 dv) {
    vec2 p=fract(uv)*0.875+0.0625;
    vec2 scale=vec2(0.4375,0.875);
    return textureGrad(materialMap,vec2((p.x+tile)*0.5,p.y),du*scale,dv*scale);
  }
  vec4 stMaterialTile(sampler2D materialMap, vec2 uv, float tile) {
    return stTileGrad(materialMap,uv,tile,dFdx(uv),dFdy(uv));
  }
  const mat2 stGravelAxes=mat2(0.9397,-0.3420,0.3420,0.9397);
  vec2 stGravelUV(vec2 p) {
    return stGravelAxes*p*3.35+0.25*sin(p.yx*vec2(1.3,1.7)+vec2(2.1,5.3));
  }
  vec2 stGravelSlope(vec2 normalXY) {
    vec2 n=normalXY*2.0-1.0;
    return transpose(stGravelAxes)*n/max(0.38,sqrt(max(0.0,1.0-dot(n,n))));
  }
`,GRAVEL_RELIEF_GLSL=`
  void stCobbleSurface(vec2 p, vec3 N, vec3 V, vec3 L, out vec4 color, out vec4 detail, out float contact) {
    vec2 uv=stGravelUV(p), du=dFdx(uv), dv=dFdy(uv);
    float footprint=max(length(du),length(dv))*672.0;
    float close=1.0-smoothstep(7.0,24.0,footprint);
    detail=stTileGrad(tRockNrm2,uv,1.0,du,dv);
    contact=1.0;
    if(close>0.01) {
      float facing=dot(V,N);
      vec2 ray=stGravelAxes*(V-N*facing).xz*(0.048*close/max(facing,0.36));
      vec2 hit=uv+ray*(detail.b-0.44);
      float h=stTileGrad(tRockNrm2,hit,1.0,du,dv).b;
      uv+=ray*(0.5*(h+detail.b)-0.44);
      detail=stTileGrad(tRockNrm2,uv,1.0,du,dv);
      float up=dot(L,N);
      vec2 towardSun=stGravelAxes*normalize((L-N*up).xz+vec2(0.00001));
      float blocker=stTileGrad(tRockNrm2,uv+towardSun*0.036,1.0,du,dv).b;
      contact-=close*0.58*smoothstep(0.025,0.34,blocker-detail.b-max(up,0.0)*0.36);
    }
    color=stTileGrad(tRockBasaltAlb,uv,1.0,du,dv);
  }
`;export function sunVecFromAngles(azDeg,elDeg,out=new THREE.Vector3){const az=(azDeg||0)*Math.PI/180,el=Math.max(6,Math.min(82,elDeg||19))*Math.PI/180;return out.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el)).normalize()}export const DEFAULT_PBR_CONFIG={style:1,grassSat:.84,grassCoverage:84,grassColor:"#346b5d",grassTipColor:"#829b79",grassMossColor:"#405a39",grassDryColor:"#ad9566",grassMossCoverage:72,grassDryCoverage:62,grassTipCoverage:64,rockColor:"#56616a",rockLayerColor:"#adb0af",grassPbr:1.18,rockSlope:.88,biomeContrast:1.04,cavityDepth:.48,strataStrength:1,shoreWet:1.12,relief:1.5,waterDeep:"#0a182c",waterShallow:"#264468",waterSpeed:1.1,waterWave:1.48,waterClear:.94,whitewater:1,waterGlow:.88,sunIntensity:1.28,sunShadow:.92,sunRays:.42,sunAzimuth:62,sunElevation:24,mist:.36,cloudStrength:.34,cloudShadow:0,airWhite:0,mistColor:"#a8b8c7",valleyMist:.28,mistHeight:.64,contourOpacity:.07,contourInterval:.105,layers:{tributaries:!0,contours:!0,terrainStyle:!0,water:!0,sunbeams:!0,atmosphere:!0,clouds:!0,gulls:!0}};const SKY_DOME_VERT=`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 wp = vec4(position + cameraPosition, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`,ALPINE_SKY_GLSL=`
  float skHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float skNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(skHash(i), skHash(i + vec2(1.0, 0.0)), f.x), mix(skHash(i + vec2(0.0, 1.0)), skHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float skFbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * skNoise(p); p = mat2(0.8,-0.6,0.6,0.8) * p * 2.04 + vec2(7.3, 4.1); a *= 0.5; }
    return v;
  }

  vec3 stAlpineSky(vec3 d,float style,float clouds,float arrival) {
    if (uLattice > 0.45) return vec3(0.0025,0.0045,0.011);
    vec3 sunD = normalize(uSun);
    float h = clamp(d.y, 0.0, 1.0);

    /* Exact index1-5-canyon-forest.html steel-periwinkle alpine sky: #4e6c93 zenith -> #819cbe mid -> #c0cfe2 horizon */
    vec3 cZenith  = vec3(0.088, 0.165, 0.340);
    vec3 cMid     = vec3(0.245, 0.355, 0.545);
    vec3 cHorizon = vec3(0.545, 0.640, 0.770);
    vec3 cBelow   = vec3(0.265, 0.327, 0.401);

    vec3 sky = mix(cHorizon, cMid, smoothstep(0.0, 0.30, h));
    sky = mix(sky, cZenith, smoothstep(0.22, 0.85, h));

    /* Crisp bright cool-white alpine sun disc & luminous silver atmospheric halo (matching reference screenshot!) */
    float sunDot = max(dot(d, sunD), 0.0);
    float sunHalo = pow(sunDot, 4.0) * 0.28 + pow(sunDot, 22.0) * 0.52 + pow(sunDot, 260.0) * 2.10;
    sky += vec3(0.98, 0.97, 0.95) * sunHalo * clamp(uSunIntensity, 0.25, 1.8) * smoothstep(-0.08, 0.12, d.y);

    if (d.y > 0.01 && clouds > 0.0) {
      vec2 cuv = d.xz / (d.y + 0.22) * 0.85 + vec2(uTime * 0.002, -uTime * 0.001);
      float wisp = smoothstep(0.42, 0.78, skFbm(cuv * vec2(1.4, 2.4)) * 0.72 + skFbm(cuv * 3.8 + 2.4) * 0.28);
      float cMask = wisp * smoothstep(0.02, 0.18, d.y) * (1.0 - smoothstep(0.58, 0.95, d.y));
      vec3 cCol = mix(vec3(0.76, 0.82, 0.90), vec3(1.00, 0.99, 0.96), pow(sunDot, 2.0) * 0.78);
      sky = mix(sky, cCol, cMask * 0.64 * clouds);
    }

    sky = mix(cBelow, sky, smoothstep(-0.80, 0.015, d.y));
    sky = mix(vec3(0.005, 0.010, 0.015), sky, clamp(style, 0.0, 1.0));
    return mix(vec3(dot(sky,vec3(0.2126,0.7152,0.0722))),sky,smoothstep(0.12,0.93,arrival));
  }
`,SKY_DOME_FRAG=`
  uniform vec3 uSun;
  uniform float uTime,uSunIntensity,uLattice,uStyle,uCloudLayer,uArrival;
  varying vec3 vDir;
  ${ALPINE_SKY_GLSL}
  void main() {
    gl_FragColor=vec4(stAlpineSky(normalize(vDir),uStyle,uCloudLayer,uArrival),1.0);
    #include <colorspace_fragment>
  }
`,SUNBEAM_VERT=`
  attribute vec4 aRay; /* x = seed, y = intensity, z = widthScale, w = layer */
  varying vec2 vUv;
  varying vec4 vRay;
  varying vec3 vWorld;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vRay = aRay;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`,SUNBEAM_FRAG=`
  uniform float uTime, uRayStrength, uSunIntensity, uLattice;
  varying vec2 vUv;
  varying vec4 vRay;
  varying vec3 vWorld;
  varying vec3 vNormalW;

  float sbHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float sbNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sbHash(i), sbHash(i + vec2(1.0, 0.0)), f.x), mix(sbHash(i + vec2(0.0, 1.0)), sbHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    if (uRayStrength <= 0.002 || uLattice > 0.35) discard;
    float xEdge = sin(clamp(vUv.x, 0.0, 1.0) * 3.14159265);
    xEdge = xEdge * xEdge * xEdge;
    float yFade = smoothstep(0.0, 0.24, vUv.y) * pow(1.0 - vUv.y, 1.15);

    /* Distinct soft crepuscular sunlight streaks drifting slowly through alpine air */
    float seed = vRay.x;
    float drift = uTime * 0.028 + seed * 3.7;
    float nW = sbNoise(vec2(vUv.x * 5.2 + seed, drift * 0.35));
    float s1 = pow(0.5 + 0.5 * sin(vUv.x * 22.0 + drift + nW * 2.4), 2.4);
    float s2 = pow(0.5 + 0.5 * sin(vUv.x * 38.0 - drift * 0.65 + seed * 7.3), 3.0);
    float beams = 0.28 + 0.72 * (s1 * 0.65 + s2 * 0.35);

    vec3 V = normalize(cameraPosition - vWorld);
    float facing = abs(dot(normalize(vNormalW), V));
    float angleSoft = smoothstep(0.05, 0.48, facing);
    float groundSoft = smoothstep(0.10, 0.48, vWorld.y);

    /* Stronger warm shafts at oblique/low angles, delicate warm sunlit ray sweep from overhead */
    float obliqueBoost = mix(1.65, 1.05, smoothstep(0.45, 0.95, abs(V.y)));
    float alpha = xEdge * yFade * beams * angleSoft * groundSoft * vRay.y * uRayStrength * clamp(uSunIntensity, 0.35, 1.8) * obliqueBoost * 0.175;
    if (alpha < 0.001) discard;

    /* Crisp cool-silver-white alpine sunbeams matching index1-5-canyon-forest.html (zero heavy orange tint!) */
    vec3 rayCol = mix(vec3(0.76, 0.84, 0.94), vec3(1.00, 0.99, 0.94), 0.35 + 0.65 * vUv.y);
    gl_FragColor = vec4(rayCol * alpha, 1.0);
  }
`;function buildExtendedReliefGrid(width,depth,nx,nz,skirt,sn,water,sub){const easeOut=t=>t*.4+t*t*.6,line=(n,size)=>{const a=[];for(let i=0;i<sn;i++)a.push(-size/2-skirt*easeOut((sn-i)/sn));for(let i=0;i<=n;i++)a.push(-size/2+size*i/n);for(let i=1;i<=sn;i++)a.push(size/2+skirt*easeOut(i/sn));return a},xs=line(nx,width),zs=line(nz,depth),cx=xs.length-1,cz=zs.length-1,pos=[],idx=[];for(const z of zs)for(const x of xs)pos.push(x,0,z);const fine=new Uint8Array(cx*cz),extra=new Map;if(water?.data)for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){let low=255,high=0;for(const dz of[.12,.5,.88])for(const dx of[.12,.5,.88]){const px=Math.floor((x+dx)/nx*water.width),pz=Math.floor((z+dz)/nz*water.height),cut=water.data[(pz*water.width+px)*4+3];low=Math.min(low,cut),high=Math.max(high,cut)}(high-low>27||high>207&&high-low>12)&&(fine[(z+sn)*cx+x+sn]=1)}const headwaterCells=REFINE_HEADWATERS?refineHeadwaterBanks(fine,xs,zs,width,depth):0;function vertex(x,z){const i=Math.floor(x/sub),j=Math.floor(z/sub),fx=x%sub,fz=z%sub;if(!fx&&!fz)return j*(cx+1)+i;const key=z*(cx*sub+1)+x;if(extra.has(key))return extra.get(key);const id=pos.length/3;return pos.push(fx?THREE.MathUtils.lerp(xs[i],xs[i+1],fx/sub):xs[i],0,fz?THREE.MathUtils.lerp(zs[j],zs[j+1],fz/sub):zs[j]),extra.set(key,id),id}for(let j=0;j<cz;j++)for(let i=0;i<cx;i++){const k=j*cx+i,x=i*sub,z=j*sub;if(fine[k])for(let dz=0;dz<sub;dz++)for(let dx=0;dx<sub;dx++){const a=vertex(x+dx,z+dz),b=vertex(x+dx+1,z+dz),c=vertex(x+dx,z+dz+1),d2=vertex(x+dx+1,z+dz+1);idx.push(a,c,b,b,c,d2)}else{const a=j*(cx+1)+i,b=a+1,c=a+cx+1,d2=c+1,left=i>0&&fine[k-1],bottom=fine[k+cx],right=i<cx-1&&fine[k+1],top=fine[k-cx];if(!(left||bottom||right||top)){idx.push(a,c,b,b,c,d2);continue}const loop=[a];if(left)for(let t=1;t<sub;t++)loop.push(vertex(x,z+t));if(loop.push(c),bottom)for(let t=1;t<sub;t++)loop.push(vertex(x+t,z+sub));if(loop.push(d2),right)for(let t=sub-1;t>0;t--)loop.push(vertex(x+sub,z+t));if(loop.push(b),top)for(let t=sub-1;t>0;t--)loop.push(vertex(x+t,z));const centre=pos.length/3;pos.push((xs[i]+xs[i+1])*.5,0,(zs[j]+zs[j+1])*.5);for(let t=0;t<loop.length;t++)idx.push(centre,loop[t],loop[(t+1)%loop.length])}}const g=new THREE.BufferGeometry;g.userData.headwaterCells=headwaterCells,g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)),g.setIndex(new THREE.Uint32BufferAttribute(idx,1));const w=width+2*skirt,d=depth+2*skirt;return g.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.8,0),Math.hypot(w,d)/2+3),g.boundingBox=new THREE.Box3(new THREE.Vector3(-w/2,0,-d/2),new THREE.Vector3(w/2,3,d/2)),g}const CORE_RIVER_PTS=[[-6.34,-3.65],[-5.85,-3.23],[-5.15,-3.21],[-4.55,-3.03],[-4.26,-2.59],[-3.51,-2.3],[-2.86,-1.99],[-2.64,-1.58],[-2.1,-1.39],[-1.39,-1.24],[-.79,-.83],[5.66,-3.76],[5.34,-3.23],[5.25,-2.8],[4.82,-2.57],[4.24,-2.49],[3.7,-2.26],[3.62,-1.91],[3.42,-1.46],[2.91,-1.31],[2.36,-1.2],[1.72,-1.19],[1.18,-.88],[6.8,3.78],[6.26,3.14],[5.67,2.78],[5.17,2.68],[4.56,2.41],[3.9,2.3],[3.25,2.33],[2.65,2.17],[2.53,1.6],[2.26,1.15],[1.58,.91],[1.12,.58],[-6.98,1.5],[-6.47,1.38],[-6,1.41],[-5.43,1.27],[-4.95,1.05],[-4.41,.7],[-4.04,.58],[-3.48,.53],[-2.98,.52],[-2.53,.5],[-2.27,.19],[-1.42,.06]],CORE_RIVER_PT_GLSL=CORE_RIVER_PTS.map(([x,y])=>`vec2(${x.toFixed(2)},${y.toFixed(2)})`).join(","),WS_STREAMS=[[-6.26,-3.57,-.76,-.65,12.4,.155,.095,.78,.44,.4],[5.58,-3.64,.5,-.86,12.2,.16,.1,.85,.42,1.9],[-6.86,1.47,-.88,.47,12,.155,.095,.74,.46,3.1],[6.72,3.68,.62,.78,12,.165,.105,.82,.4,5.2],[-8.2,-5.15,-.22,-.97,8.8,.13,.048,.62,.68,1.1],[-9.65,-6.3,-.98,-.18,8.2,.12,.048,.56,.74,2.6],[6.85,-5.65,-.18,-.98,8.4,.14,.048,.66,.64,4],[7.65,-7.15,.88,-.47,8.8,.13,.048,.58,.7,.7],[6.45,-4.95,.94,-.34,9.2,.12,.048,.65,.66,5.5],[-9.85,3.05,-.96,-.26,7.8,.12,.048,.54,.76,1.8],[-9.15,2.85,-.34,.94,9.2,.14,.048,.64,.66,3.4],[7.55,5.85,-.26,.96,8.8,.14,.05,.64,.64,2.2],[8.25,7.25,.86,.51,9.2,.13,.048,.6,.7,4.7]],WS_A_GLSL=WS_STREAMS.map(([ox,oy,dx,dy])=>{const m=Math.hypot(dx,dy)||1;return`vec4(${ox.toFixed(2)},${oy.toFixed(2)},${(dx/m).toFixed(6)},${(dy/m).toFixed(6)})`}).join(","),WS_B_GLSL=WS_STREAMS.map(s=>`vec4(${s[4]},${s[5]},${s[6]},${s[7]})`).join(","),WS_C_GLSL=WS_STREAMS.map(s=>`vec2(${s[8]},${s[9]})`).join(",");function makeWatershedGlsl(noiseFn){return`
    const vec2 ST_CR_PT[${CORE_RIVER_PTS.length}] = vec2[${CORE_RIVER_PTS.length}](${CORE_RIVER_PT_GLSL});
    const vec4 ST_WS_A[${WS_STREAMS.length}] = vec4[${WS_STREAMS.length}](${WS_A_GLSL});
    const vec4 ST_WS_B[${WS_STREAMS.length}] = vec4[${WS_STREAMS.length}](${WS_B_GLSL});
    const vec2 ST_WS_C[${WS_STREAMS.length}] = vec2[${WS_STREAMS.length}](${WS_C_GLSL});
    float stLakeBasinR(vec2 p) {
      vec2 q = (p - vec2(0.122, -0.056)) / vec2(1.66, 1.42);
      float r = length(q);
      float ang = atan(q.y, q.x);
      float wobble = 0.085 * sin(ang * 3.0 + 0.7) + 0.055 * cos(ang * 5.0 - 1.2) + 0.035 * sin(ang * 7.0 + 2.4);
      float cove = (${noiseFn}(p * 1.45 + vec2(3.7, -2.1)) - 0.5) * 0.055;
      return r + wobble + cove;
    }
    vec3 stCentralLakeBasin(vec2 p) {
      float lr = stLakeBasinR(p);
      float cragN = (${noiseFn}(p * 3.1 + vec2(-2.4, 5.1)) - 0.5) * 0.095
                  + (${noiseFn}(p * 7.6 + vec2(6.1, -3.3)) - 0.5) * 0.036;
      float wMask = 1.0 - smoothstep(0.86, 1.00, lr + cragN * 0.45);
      /* Sheer jagged rocky canyon cliff precipice right outside waterline (ZERO flat beach apron!) */
      float carve = 1.0 - smoothstep(0.93, 1.17, lr + cragN);
      float depth = 1.0 - smoothstep(0.0, 1.02, lr);
      return vec3(wMask, carve, depth);
    }

    float stWsFbm(vec2 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 3; i++) {
        v += a * ${noiseFn}(p);
        p = mat2(0.80, -0.60, 0.60, 0.80) * p * 2.05 + vec2(9.3, 5.7);
        a *= 0.5;
      }
      return v;
    }

    float stSmax(float a, float b, float k) {
      float mn = min(a, b);
      if (mn <= 0.0) return max(a, b);
      float h = max(k - abs(a - b), 0.0) / k;
      return max(a, b) + h * h * min(mn, k * 0.25);
    }

    void stSegAcc(vec2 p, vec2 a, vec2 b, inout float minD, inout vec2 dirAcc) {
      vec2 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      float d = length(pa - ba * h);
      minD = min(minD, d);
      /* C-infinity Gaussian tangent smoothing across river bends -> ZERO hard polyline seams! */
      dirAcc += normalize(ba) * exp(-d * 10.0);
    }

    vec3 stCoreRiversEx(vec2 p, out vec2 flowDir, out float outMinD) {
      flowDir = vec2(0.0);
      outMinD = 9.0;
      if (abs(p.x) > 7.55 || abs(p.y) > 4.45) return vec3(0.0);
      float minD = 9.0;
      vec2 bDir = vec2(0.0);

      /* Single data-driven loop (uniform-guarded trip count prevents ANGLE/FXC from unrolling 43 inline calls) */
      int s0 = 0, n0 = 0, s1 = 0, n1 = 0;
      if (p.x < 0.2) {
        if (p.y < 0.2)  { s0 = 0;  n0 = 10; }
        if (p.y > -0.4) { s1 = 35; n1 = 11; }
      } else if (p.x > 0.2) {
        if (p.y < 0.2)  { s0 = 11; n0 = 11; }
        if (p.y > -0.2) { s1 = 23; n1 = 11; }
      }
      int crTot = (uRelief > -1e4) ? (n0 + n1) : 0;
      for (int k = 0; k < crTot; k++) {
        int idx = k < n0 ? (s0 + k) : (s1 + (k - n0));
        stSegAcc(p, ST_CR_PT[idx], ST_CR_PT[idx + 1], minD, bDir);
      }

      outMinD = minD;
      if (minD > 1.2) return vec3(0.0);
      flowDir = length(bDir) > 1e-4 ? normalize(bDir) : vec2(0.0, 1.0);
      float bankRough = ${noiseFn}(p * 2.1 + vec2(4.2, -1.7));
      float nearLake = 1.0 - smoothstep(1.3, 2.5, length(p - vec2(0.122, -0.056)));
      /* Generous continuous gorge floor strictly wider than water mask -> zero pinched rivers & zero water climbing cliffs! */
      float w = mix(0.124, 0.195, nearLake) * (0.86 + 0.28 * bankRough);
      float cragR = (${noiseFn}(p * 4.2 + vec2(1.9, -4.3)) - 0.5) * 0.030;
      float wmC = 1.0 - smoothstep(w * 0.56, w * 1.02, minD + cragR * 0.22);
      float shC = 1.0 - smoothstep(0.0, w * 1.02, minD);
      float carveC = 1.0 - smoothstep(w * 1.16, w * 1.88 + 0.08, minD + cragR);
      return vec3(wmC, carveC, shC);
    }

    vec3 stCoreRivers(vec2 p, out vec2 flowDir) {
      float tmpD;
      return stCoreRiversEx(p, flowDir, tmpD);
    }

    vec3 stStreamEx(vec2 p, vec2 o, vec2 d, float len, float w0, float w1, float amp, float freq, float ph, float bankRough, inout vec2 flowAcc, inout float flowW) {
      vec2 perp = vec2(-d.y, d.x);
      vec2 rel = p - o;
      float t = dot(rel, d);
      float s = dot(rel, perp);
      #ifdef STUDIO_HEADWATERS
      // Outside this bound the water, the rock bench and the broad valley
      // masks are all zero, even at maximum warp and channel width.
      float widest = max(w0, w1) * 1.62;
      float reachLimit = max(1.55 + 4.4 * widest, 0.68 + 6.4 * widest);
      if (t < -reachLimit || t > len + reachLimit || abs(s) > 1.36 * abs(amp) + reachLimit) return vec3(0.0);
      #endif
      float tc = clamp(t, 0.0, len);
      float u = tc / max(len, 0.001);
      float ramp = smoothstep(0.0, 1.35, tc);
      float meand = (sin(tc * freq + ph) + 0.36 * sin(tc * freq * 2.13 + ph * 1.7)) * amp * ramp;
      float dMeand = (cos(tc * freq + ph) * freq + 0.36 * cos(tc * freq * 2.13 + ph * 1.7) * freq * 2.13) * amp * ramp;
      float ds = abs(s - meand);
      float endD = max(0.0, max(-t, t - len));
      float dist = length(vec2(ds, endD));
      float wVar = 0.80 + 0.42 * bankRough;
      float w = mix(w0, w1, smoothstep(0.0, 1.0, u)) * wVar;
      #ifdef STUDIO_HEADWATERS
      // Alternate pools and narrow reaches. The first mouth remains aligned
      // with the existing main channel; inner bends retain a shallow shelf.
      float reach = smoothstep(0.12,1.45,tc);
      float bend = clamp(sin(tc*freq+ph)+0.65*sin(tc*freq*2.13+ph*1.7),-1.0,1.0);
      float bankSide = sign(s-meand);
      float pool = 0.5+0.5*sin(tc*1.34+ph*1.9)*sin(tc*.61+ph);
      w *= 1.0+reach*((pool-.5)*.34+bend*bankSide*.14);
      #endif
      float wmS = 1.0 - smoothstep(w * 0.52, w * 1.02, dist);
      float shS = 1.0 - smoothstep(0.0, w * 1.02, dist);
      /* Flat valley riverbed floor strictly wider than water width -> outer river NEVER climbs canyon cliff walls! */
      float flatFloor = max(w * 1.38, 0.13);
      float vSlope = 1.0 - smoothstep(flatFloor, w * 4.4 + 1.55, dist);
      float carve = pow(clamp(vSlope, 0.0, 1.0), 1.65);
      #ifdef STUDIO_HEADWATERS
      // The outside of a bend cuts through bedrock. Its opposite bank opens
      // into a gravel bar. Both reach the same flat floor below the water.
      float cutSide = smoothstep(-0.70, 0.75, bend * bankSide);
      float toe = w * mix(1.58, 1.15, cutSide);
      float debrisFan = smoothstep(0.39, 0.73, bankRough * 0.72 + pool * 0.28);
      float face = toe + (w * mix(1.70, 0.91, cutSide) + mix(0.09, 0.046, cutSide)) * (0.92 + 0.54 * debrisFan);
      float channel = 1.0 - smoothstep(toe, face, dist);
      float spur = cutSide * smoothstep(0.20, 0.75, bankRough * 0.65 + pool * 0.35);
      float benchEnd = face + (w + 0.07) * (0.24 + 1.25 * spur);
      float shoulder = 1.0 - smoothstep(benchEnd, benchEnd + w * 1.16 + 0.08, dist);
      float valley = 1.0 - smoothstep(w * 2.1 + 0.06, w * 6.0 + 0.54, dist);
      float benchShare = 0.23 * spur;
      // Rockfall opens occasional ramps across the cut face. The inside
      // bank rises gradually across the floodplain rather than as one step.
      float wallShare = mix(0.43, 0.77, cutSide) * (1.0 - 0.21 * debrisFan);
      float carvedBank = channel * wallShare + shoulder * benchShare + valley * (1.0 - wallShare - benchShare);
      carve=mix(carve,carvedBank,reach*.94);
      shS*=mix(1.0,.62+.34*pool,reach);
      #endif
      if (wmS > 0.01) {
        vec2 downDir = -normalize(d + perp * clamp(dMeand, -1.2, 1.2));
        flowAcc += downDir * wmS;
        flowW += wmS;
      }
      return vec3(wmS, carve, shS);
    }

    vec3 stCombineStream(vec3 a, vec3 b) {
      return vec3(stSmax(a.x, b.x, 0.18), stSmax(a.y, b.y, 0.22), max(a.z, b.z));
    }

    vec3 stWatershedEx(vec2 p, float outD, out vec2 flowDir) {
      flowDir = vec2(0.0);
      float wRamp = smoothstep(0.0, 1.65, outD);
      vec2 warpMacro = vec2(stWsFbm(p * 0.26 + vec2(2.4, -3.8)), stWsFbm(p * 0.26 + vec2(-6.1, 4.9))) - 0.5;
      vec2 warpMicro = vec2(${noiseFn}(p * 1.45 + vec2(1.3, 8.2)), ${noiseFn}(p * 1.45 + vec2(-4.7, 2.1))) - 0.5;
      vec2 pw = p + (warpMacro * 2.15 + warpMicro * 0.34) * wRamp;
      float bankRough = ${noiseFn}(p * 0.95 + vec2(3.1, -5.2));

      vec3 r = vec3(0.0);
      vec2 fAcc = vec2(0.0);
      float fW = 0.0;

      /* Match core river mouth widths & exit tangents seamlessly via uniform-guarded loop (prevents 13x FXC inline blowup) */
      int wsCount = (uRelief > -1e4) ? ${WS_STREAMS.length} : 0;
      for (int i = 0; i < wsCount; i++) {
        vec4 sa = ST_WS_A[i];
        vec4 sb = ST_WS_B[i];
        vec2 sc = ST_WS_C[i];
        r = stCombineStream(r, stStreamEx(pw, sa.xy, sa.zw, sb.x, sb.y, sb.z, sb.w, sc.x, sc.y, bankRough, fAcc, fW));
      }

      flowDir = fW > 0.001 ? normalize(fAcc / fW) : vec2(0.0);
      return r;
    }

    vec3 stWatershed(vec2 p, float outD) {
      vec2 tmpF;
      return stWatershedEx(p, outD, tmpF);
    }

    float stAlpineMountainH(vec2 xz) {
      float v = 0.0, a = 0.50;
      vec2 p = xz * 0.27 + vec2(4.1, -2.7);
      for (int i = 0; i < 4; i++) {
        float n = ${noiseFn}(p);
        v += a * mix(n, n * n * 1.45, 0.42);
        p = mat2(0.80, -0.60, 0.60, 0.80) * p * 2.06 + vec2(11.3, 6.7);
        a *= 0.48;
      }
      float crag = 1.0 - abs(${noiseFn}(xz * 0.48 + vec2(-6.4, 3.9)) * 2.0 - 1.0);
      float mountain=0.16+v*.36+crag*crag*.16;
      #ifdef STUDIO_HEADWATERS
      // Long folded ridges set the silhouette. Shorter ribs interrupt their
      // flanks but die back in the hollows. The main valley peaks at ~0.79.
      vec2 strike = vec2(dot(xz, vec2(0.87, 0.49)), dot(xz, vec2(-0.49, 0.87)));
      float massif = smoothstep(0.15, 0.73, v);
      float foldAxis = ${noiseFn}(strike * vec2(0.32, 0.72) + vec2(2.7 + 1.4*v, -5.6)) * 2.0 - 1.0;
      float fold = 1.0 - smoothstep(0.0, 0.96, abs(foldAxis));
      float rib = 1.0 - abs(${noiseFn}(strike * vec2(0.83, 1.65) + vec2(3.8, -7.2)) * 2.0 - 1.0);
      // Give the crest a rounded crown; expose short spurs along its flanks.
      // A sharp crease sampled by the horizon mesh produces sawtooth tips.
      float flank = 4.0 * fold * (1.0 - fold);
      mountain = 0.18 + massif * 0.46 + fold*fold * (0.09 + 0.23*massif)
               + crag*crag * 0.055 + flank * rib*rib * (0.022 + 0.041*massif);
      #endif
      return mountain;
    }

    float stDryShoulder(vec3 ws) {
      return (1.0-clamp(ws.y,0.0,1.0))*(1.0-smoothstep(0.04,0.36,ws.x));
    }
    float stOuterCarvedH(vec2 xz, vec3 ws) {
      float mH = stAlpineMountainH(xz);
      return 0.105 + (mH-0.105)*stDryShoulder(ws);
    }
    float stRockBankHeight(vec2 xz, float baseY, float carved, float relief) {
      float clearance = max(0.0, baseY-0.105);
      float lip = smoothstep(0.003,0.085,clearance) * (1.0-smoothstep(0.11,0.28,clearance));
      float brokenLip = 0.55 + 0.45*${noiseFn}(xz*2.8+vec2(3.7,-5.2));
      return 0.105 + (clearance+lip*0.068*relief*brokenLip)*pow(max(0.0,1.0-carved),0.58);
    }
  `}function patchTerrainAndWater(atlas,pbrTex,studioUniforms){let patched=!1;const seen=new Set;atlas.uniforms?.uSkirt&&atlas.uniforms.uSkirt.value.set(3.5/1494,3.5/836,0,0),atlas.uniforms?.uSkirtAir&&atlas.uniforms.uSkirtAir.value.set(99,120);const coreW=atlas.uniforms?.uBounds?1/atlas.uniforms.uBounds.value.z:14,coreD=atlas.uniforms?.uBounds?1/atlas.uniforms.uBounds.value.w:7.84;let reliefGrid;return atlas.terrain.traverse(obj=>{if(!obj.isMesh||!obj.material)return;if(obj.geometry&&!obj.userData.pbrExtended){const oldGeo=obj.geometry;reliefGrid??=buildExtendedReliefGrid(coreW,coreD,CORE_COLUMNS,CORE_ROWS,11.5,92,atlas.uniforms.tWater.value.image,matchMedia("(pointer: coarse)").matches?2:3),obj.geometry=reliefGrid,obj.frustumCulled=!1,obj.userData.pbrExtended=!0,oldGeo.dispose?.()}if(seen.has(obj.material))return;seen.add(obj.material);const mat=obj.material;if(!mat.fragmentShader||mat.fragmentShader.includes("uPbrStyle"))return;if(REFINE_HEADWATERS&&(mat.defines.STUDIO_HEADWATERS=1),mat.defines&&(delete mat.defines.FOREST_LOGO,delete mat.defines.FOREST_GROW,delete mat.defines.FOREST_LAKEVIDEO,delete mat.defines.FOREST_WATER3D,delete mat.defines.FOREST_RIVER,delete mat.defines.FOREST_WATER,delete mat.defines.FOREST_DETAIL,delete mat.defines.FOREST_LIGHT),Object.assign(mat.uniforms,{tGrassAlb:{value:pbrTex.grassAlb},tGrassWildAlb:{value:pbrTex.grassWildAlb},tMossAlb:{value:pbrTex.mossAlb},tHeathAlb:{value:pbrTex.heathAlb},tGrassNrm:{value:pbrTex.grassNrm},tGrassNrm2:{value:pbrTex.grassNrm2},tRockAlb:{value:pbrTex.rockAlb},tRockBasaltAlb:{value:pbrTex.rockBasaltAlb},tRockMossAlb:{value:pbrTex.rockMossAlb},tRockNrm:{value:pbrTex.rockNrm},tRockNrm2:{value:pbrTex.rockNrm2},tWaterNrm:{value:pbrTex.waterNrm},uPbrStyle:studioUniforms.uPbrStyle,uPbrTerrainOn:studioUniforms.uPbrTerrainOn,uGrassPbr:studioUniforms.uGrassPbr,uGrassSat:studioUniforms.uGrassSat,uMeadowBase:studioUniforms.uMeadowBase,uMeadowTips:studioUniforms.uMeadowTips,uMeadowMoss:studioUniforms.uMeadowMoss,uMeadowDry:studioUniforms.uMeadowDry,uMeadowLayerCover:studioUniforms.uMeadowLayerCover,uRockBaseGain:studioUniforms.uRockBaseGain,uRockLayerGain:studioUniforms.uRockLayerGain,uGrassCover:studioUniforms.uGrassCover,uRockSlope:studioUniforms.uRockSlope,uShoreWet:studioUniforms.uShoreWet,uSunIntensity:studioUniforms.uSunIntensity,uSunShadow:studioUniforms.uSunShadow,uStudioMist:studioUniforms.uStudioMist,uBiomeContrast:studioUniforms.uBiomeContrast,uCavityDepth:studioUniforms.uCavityDepth,uStrataStrength:studioUniforms.uStrataStrength,uCloudLayer:studioUniforms.uCloudLayer,uCloudStrength:studioUniforms.uCloudStrength,uAirWhite:studioUniforms.uAirWhite,uBankShadow:studioUniforms.uBankShadow,uMistColor:studioUniforms.uMistColor,uValleyMist:studioUniforms.uValleyMist,uMistHeight:studioUniforms.uMistHeight,uArrival:studioUniforms.uArrival,uArrivalMap:studioUniforms.uArrivalMap,uTributaries:studioUniforms.uTributaries,uTributaryTexel:studioUniforms.uTributaryTexel,uContours:studioUniforms.uContours,uContourInterval:studioUniforms.uContourInterval,uEntrySurvey:studioUniforms.uEntrySurvey,uWaterDeep:studioUniforms.uWaterDeep,uWaterShallow:studioUniforms.uWaterShallow,uWaterSpeed:studioUniforms.uWaterSpeed,uWaterWave:studioUniforms.uWaterWave,uWaterClear:studioUniforms.uWaterClear,uWhitewater:studioUniforms.uWhitewater,uWaterGlow:studioUniforms.uWaterGlow,uWaterOn:studioUniforms.uWaterOn,uCurtainGlow:studioUniforms.uCurtainGlow,uCurtainCol:studioUniforms.uCurtainCol,uCurtainContact:studioUniforms.uCurtainContact,uCurtainLogo:studioUniforms.uCurtainLogo}),mat.vertexShader&&!mat.vertexShader.includes("stWatershed")){const vFuncs=`
        uniform sampler2D tWater;
        uniform float uTributaries;
        varying vec3 vStOutN;
        varying vec2 vStCurvature;
        varying float vStArrival;
        float stVHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float stVNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(stVHash(i), stVHash(i + vec2(1.0, 0.0)), f.x),
                     mix(stVHash(i + vec2(0.0, 1.0)), stVHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        ${makeWatershedGlsl("stVNoise")}
      `,vInject=`
        vStOutN = vec3(0.0, 1.0, 0.0);
        vStCurvature = vec2(0.0);
        #ifdef FOREST_RELIEF
        vStArrival = texture2D(tCanopy, uv).a;
        float stOutD = forestOut(uvR);
        vec3 stWS = (stOutD > 0.0005 || abs(p.x) > 4.2 || abs(p.z) > 2.2) ? stWatershed(p.xz, stOutD) : vec3(0.0);
        vec3 stLB = stCentralLakeBasin(p.xz);
        vec2 stVCRFlow;
        vec3 stVCR = stOutD <= 0.35 ? stCoreRivers(p.xz, stVCRFlow) : vec3(0.0);
        if (stOutD > 0.0005) {
          #ifdef STUDIO_HEADWATERS
          float mountain = stAlpineMountainH(p.xz);
          float bankLand = stDryShoulder(stWS);
          float carvedH = 0.105 + (mountain - 0.105) * bankLand * uRelief;
          #else
          float carvedH = 0.105 + (stOuterCarvedH(p.xz, stWS) - 0.105) * uRelief;
          #endif
          float blendO = smoothstep(0.0, 2.25, stOutD);
          float borderCarved = mix(p.y, 0.105, max(stWS.y, max(smoothstep(0.05, 0.40, stWS.x), stVCR.y)));
          float targetY = mix(borderCarved, carvedH, blendO);
          float rimEase = 1.0 - smoothstep(8.6, 11.4, stOutD) * 0.22;
          p.y = max(0.105, 0.105 + (targetY - 0.105) * rimEase);
          /* Outer normal and curvature share the existing per-vertex height taps. */
          float epsO = 0.12;
          #ifdef STUDIO_HEADWATERS
          epsO=0.055;
          #endif
          vec2 pxL = p.xz - vec2(epsO, 0.0), pxR = p.xz + vec2(epsO, 0.0);
          vec2 pzD = p.xz - vec2(0.0, epsO), pzU = p.xz + vec2(0.0, epsO);
          #ifdef STUDIO_HEADWATERS
          // Only the ridge needs four height taps. Differentiate the river
          // incision from the fragment's existing field, not four more sets
          // of thirteen tributaries per vertex. Y carries uncut height.
          float ohL = stAlpineMountainH(pxL), ohR = stAlpineMountainH(pxR);
          float ohD = stAlpineMountainH(pzD), ohU = stAlpineMountainH(pzU);
          vec2 ridgeSlope = vec2(ohR-ohL, ohU-ohD) * (uRelief*rimEase/(2.0*epsO));
          vStOutN = vec3(-ridgeSlope.x, 1.0, -ridgeSlope.y) * max(0.001, (mountain-0.105)*uRelief*rimEase);
          float centreH = mountain;
          #else
          float ohL = stOuterCarvedH(pxL, stWatershed(pxL, stOutD));
          float ohR = stOuterCarvedH(pxR, stWatershed(pxR, stOutD));
          float ohD = stOuterCarvedH(pzD, stWatershed(pzD, stOutD));
          float ohU = stOuterCarvedH(pzU, stWatershed(pzU, stOutD));
          vStOutN = normalize(vec3(-(ohR - ohL) / (2.0 * epsO) * 2.35 * uRelief, 1.0, -(ohU - ohD) / (2.0 * epsO) * 2.35 * uRelief));
          float centreH = (carvedH - 0.105) / max(uRelief, 0.01) + 0.105;
          #endif
          float bend = ((ohL + ohR + ohD + ohU) * 0.25 - centreH) / epsO;
          vStCurvature = vec2(smoothstep(0.006, 0.16, bend), smoothstep(0.006, 0.12, -bend));
        } else {
          // Meso-scale curvature: four height taps per existing vertex.
          vec2 ec = vec2(0.16) * uBounds.zw;
          float hcL = texture2D(tCanopy, forestMir(uvR - vec2(ec.x, 0.0))).r;
          float hcR = texture2D(tCanopy, forestMir(uvR + vec2(ec.x, 0.0))).r;
          float hcD = texture2D(tCanopy, forestMir(uvR - vec2(0.0, ec.y))).r;
          float hcU = texture2D(tCanopy, forestMir(uvR + vec2(0.0, ec.y))).r;
          float bend = ((hcL + hcR + hcD + hcU) * 0.25 - c.r) * uYRange.y * uRelief / 0.16;
          vStCurvature = vec2(smoothstep(0.002, 0.052, bend), smoothstep(0.003, 0.060, -bend));
          float coreCarve = max(stLB.y, max(stVCR.y, smoothstep(0.10, 0.55, stWS.x)));
          /* Sculpt sheer rocky cliff precipices right at the waterline (replaces flat sandy ramps with steep stepped rock bluffs!) */
          p.y = stRockBankHeight(p.xz,p.y,coreCarve,uRelief);
        }
        if (uTributaries > 0.5 && all(greaterThanEqual(uvR,vec2(0.0))) && all(lessThanEqual(uvR,vec2(1.0)))) {
          vec4 branch = texture2D(tWater,uvR);
          float bedY = 0.105 + branch.b * uYRange.y * uRelief;
          p.y = mix(p.y,min(p.y,bedY),branch.a);
        }
        #endif
        vec4 w=modelMatrix*vec4(p,1.);
      `;mat.vertexShader=mat.vertexShader.replace("void main(){",vFuncs+`
void main(){`).replace("vec4 w=modelMatrix*vec4(p,1.);",vInject)}const decls=`
      varying vec3 vStOutN;
      varying vec2 vStCurvature;
      varying float vStArrival;
      uniform vec2 uYRange;
      uniform float uRelief;
      #ifdef FOREST_MIRROR
      uniform sampler2D tRefl;
      uniform mat4 uReflMat;
      uniform float uMirror;
      #endif
      uniform sampler2D tGrassAlb, tGrassWildAlb, tMossAlb, tHeathAlb, tGrassNrm, tGrassNrm2;
      uniform sampler2D tRockAlb, tRockBasaltAlb, tRockMossAlb, tRockNrm, tRockNrm2, tWaterNrm;
      uniform float uPbrStyle, uPbrTerrainOn, uGrassPbr, uGrassSat, uRockSlope, uShoreWet, uGrassCover;
      uniform float uSunIntensity, uSunShadow, uStudioMist;
      uniform float uTributaries, uContours, uContourInterval, uEntrySurvey;
      uniform vec2 uTributaryTexel;
      uniform vec3 uWaterDeep, uWaterShallow, uCurtainCol, uCurtainContact;
      uniform float uWaterSpeed, uWaterWave, uWaterClear, uWaterGlow, uWaterOn, uCurtainGlow;
      uniform float uStrataStrength, uWhitewater, uCloudLayer;
      uniform float uAirWhite;
      uniform vec3 uRockBaseGain,uRockLayerGain;
      uniform vec4 uCurtainLogo;

      uniform vec3 uMeadowBase,uMeadowTips,uMeadowMoss,uMeadowDry;
      uniform vec3 uMeadowLayerCover; // moss, dry grass, blade tips
      vec3 stMeadowCover(vec3 habitat) {
        // Grow the footprint from favourable ground outwards. Zero clears
        // the whole layer, including the most favourable habitat.
        vec3 edge=mix(vec3(1.16),vec3(.28),uMeadowLayerCover);
        vec3 cover=smoothstep(edge-.14,edge+.14,clamp(habitat,0.0,1.0));
        cover.y*=1.0-.62*cover.x;
        cover.z*=1.0-.36*cover.y;
        return cover;
      }
      vec3 stMeadowDye(vec3 source,vec3 cover) {
        float value=dot(source,vec3(.2126,.7152,.0722));
        vec3 grain=clamp(source/max(.005,value),.63,1.45);
        vec3 pigment=mix(uMeadowBase/.12,uMeadowMoss/.11,cover.x);
        pigment=mix(pigment,uMeadowDry/.30,cover.y);
        pigment=mix(pigment,uMeadowTips/.29,cover.z);
        return value*pigment*mix(vec3(1.0),grain,.23);
      }
      vec3 stGrassAlbedo(vec4 scan) {
        return scan.r*scan.r*vec3(.94,1.037,.81);
      }
      vec3 stUnpackNrm(vec2 rg) {
        vec2 xy = rg * 2.0 - 1.0;
        return vec3(xy, sqrt(max(0.02, 1.0 - dot(xy, xy))));
      }
      vec3 stSat(vec3 c, float s) {
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        return max(vec3(0.0), mix(vec3(l), c, s));
      }
      float stGrassCover(float up,float rockExposure,float pocket) {
        float rooting=up-0.22*rockExposure+pocket+(0.88-uRockSlope)*0.30;
        float threshold=mix(1.32,0.14,uGrassCover);
        return smoothstep(threshold-0.112,threshold+0.122,rooting);
      }
      float stFbm2(vec2 p) {
        return forestNoise(p) * 0.67 + forestNoise(mat2(0.80, -0.60, 0.60, 0.80) * p * 2.04 + vec2(7.3, 4.1)) * 0.33;
      }
      vec2 stCreekCurrent(vec2 uv) {
        // Filter circular headings before converting back to a vector. Ordinary
        // byte interpolation reverses the current at the -pi / pi seam.
        vec2 grid=uv/uTributaryTexel-0.5;
        vec2 anchor=(floor(grid)+0.5)*uTributaryTexel, f=fract(grid);
        float h=texture2D(tCanopy,anchor).b;
        vec3 nearH=vec3(texture2D(tCanopy,anchor+vec2(uTributaryTexel.x,0.0)).b,
                        texture2D(tCanopy,anchor+vec2(0.0,uTributaryTexel.y)).b,
                        texture2D(tCanopy,anchor+uTributaryTexel).b);
        nearH=fract(nearH-h+0.5)-0.5;
        float turns=h+mix(nearH.x*f.x,mix(nearH.y,nearH.z,f.x),f.y);
        float angle=turns*6.2831853-3.14159265;
        return vec2(cos(angle),sin(angle));
      }
      ${HIGHLAND_GLSL}
      ${ALPINE_SKY_GLSL}
      ${SHORE_ATLAS_GLSL}
      ${GRAVEL_RELIEF_GLSL}
      ${makeWatershedGlsl("forestNoise")}

      /* Two height-field taps for terrain self-shadow. */
      float stTerrainSunShadow(vec3 wPos, vec3 sunDir, float outD, float branch) {
        if (uSunShadow <= 0.005 || outD > 1.1) return 1.0;
        vec2 sunXZ = sunDir.xz / max(length(sunDir.xz), 0.001);
        float tanEl = sunDir.y / max(length(sunDir.xz), 0.001);
        float baseH = max(wPos.y, 0.105);
        float fadeOut = 1.0 - smoothstep(0.0, 1.05, outD);

        vec2 uv1 = forestMir((wPos.xz + sunXZ * 0.42 - uBounds.xy) * uBounds.zw);
        vec2 uv2 = forestMir((wPos.xz + sunXZ * 1.25 - uBounds.xy) * uBounds.zw);

        float h1 = max(0.105, 0.105 + (uYRange.x + texture2D(tCanopy, uv1).r * uYRange.y - 0.105) * uRelief);
        float h2 = max(0.105, 0.105 + (uYRange.x + texture2D(tCanopy, uv2).r * uYRange.y - 0.105) * uRelief);
        if (branch > 0.01) {
          vec4 b1=texture2D(tWater,uv1),b2=texture2D(tWater,uv2);
          h1=mix(h1,min(h1,0.105+b1.b*uYRange.y*uRelief),b1.a);
          h2=mix(h2,min(h2,0.105+b2.b*uYRange.y*uRelief),b2.a);
        }

        float o1 = smoothstep(-0.015, 0.095, h1 - (baseH + tanEl * 0.42));
        float o2 = smoothstep(-0.015, 0.145, h2 - (baseH + tanEl * 1.25));
        float vis = 1.0 - max(o1, o2) * 0.84;
        return mix(1.0, vis, clamp(uSunShadow, 0.0, 1.2) * fadeOut);
      }
    `,inject=`
      /* =============================================================================================
         STANDALONE CC0 2K PBR TERRAIN + UNIFIED DUAL-NORMAL GLACIAL WATER + CANYON-FOREST SUNLIGHT
         ============================================================================================= */
      if (uPbrTerrainOn > 0.001) {
        float stAmt = clamp(uPbrStyle, 0.0, 1.25) * uPbrTerrainOn;
        float pbrAmt = clamp(uGrassPbr, 0.0, 1.6) * uPbrTerrainOn;
        float outDist = forestOut(uvR);

        /* Shared world basis (GLSL ES 1.00 compatible: explicit transposes, shared across terrain & water!) */
        vec2 wp = vForestWorld.xz;
        mat2 rotP  = mat2(0.80, -0.60, 0.60, 0.80);
        mat2 rotPT = mat2(0.80,  0.60, -0.60, 0.80);
        mat2 rotQ  = mat2(0.54, -0.84, 0.84, 0.54);
        mat2 rotQT = mat2(0.54,  0.84, -0.84, 0.54);
        vec3 sunNS = normalize(uSun);
        vec3 viewV = normalize(cameraPosition - vForestWorld);

        /* Exact index1-5-canyon-forest.html daylight split: crisp luminous cool-ivory sun + moody steel-periwinkle shadow fill! */
        vec3 sunKeyCol  = vec3(2.12, 1.99, 1.72) * clamp(uSunIntensity, 0.25, 2.0);
        vec3 skyFillCol = vec3(0.16, 0.24, 0.35);
        vec3 bounceCol  = vec3(0.065, 0.077, 0.085);

        /* Ultra-fast planar reflection pass (uMirror > 0.5): 2 texture taps instead of 28 -> saves ~35% GPU frame time! */
        #ifdef FOREST_MIRROR
        if (uMirror > 0.5) {
          vec2 eM = 1.6 / PX;
          float mL = texture2D(tCanopy, uv - vec2(eM.x, 0.0)).r;
          float mR = texture2D(tCanopy, uv + vec2(eM.x, 0.0)).r;
          float mD = texture2D(tCanopy, uv - vec2(0.0, eM.y)).r;
          float mU = texture2D(tCanopy, uv + vec2(0.0, eM.y)).r;
          vec3 mN = normalize(vec3(-(mR - mL) * 14.0 * uRelief, 1.0, -(mU - mD) * 14.0 * uRelief));
          if (outDist > 0.0005) mN = normalize(mix(mN, normalize(vStOutN), smoothstep(0.0, 2.25, outDist)));
          vec4 mScan=texture2D(tGrassAlb,wp*.48);
          vec3 mGrass=stGrassAlbedo(mScan)*vec3(.40,.66,.48);
          float mUp=smoothstep(.12,.72,(vForestWorld.y-.105)/max(.25,(uYRange.x+uYRange.y-.105)*uRelief));
          float mFacing=smoothstep(-.38,.46,dot(mN.xz,normalize(sunNS.xz)));
          vec3 mHabitat=vec3(.22+.29*(1.0-mUp)+.18*(1.0-mFacing)+.20*vStCurvature.x+.23*mScan.g,
                             .13+.32*mUp+.20*mFacing+.18*vStCurvature.y+.20*(1.0-mScan.g),
                             .16+.43*mScan.g+.16*mFacing+.08*mScan.b);
          mGrass=stMeadowDye(mGrass,stMeadowCover(mHabitat));
          vec3 mRock  = texture2D(tRockAlb, wp * 1.15).rgb*uRockBaseGain;
          float mSlope = 1.0 - smoothstep(uRockSlope - 0.16, uRockSlope + 0.025, mN.y);
          float mirroredGrass=stGrassCover(mN.y,mSlope,0.0);
          vec3 mAlb = mix(mRock,stSat(mGrass,clamp(uGrassSat,0.2,2.0)),mirroredGrass);
          float mLit = smoothstep(0.02, 0.88, clamp(dot(mN, sunNS), 0.0, 1.0)) * stCloudVisibility(wp);
          vec3 mCol = mAlb * (skyFillCol * (0.45 + 0.55 * max(0.0, mN.y)) + sunKeyCol * mLit);
          mCol = mCol / (1.0 + mCol * 0.22);
          col = mix(col, mCol, clamp(stAmt, 0.0, 1.0));
        } else
        #endif
        {
        float pxW = max(length(fwidth(wp)), 1e-4);
        float nearDetail = 1.0 - smoothstep(0.012, 0.068, pxW);
        float headwaterMix=0.0;
        #ifdef STUDIO_HEADWATERS
        vec2 coreEdge=max(uBounds.xy-wp,wp-(uBounds.xy+1.0/uBounds.zw));
        headwaterMix=smoothstep(-.80,1.30,max(coreEdge.x,coreEdge.y));
        #endif

        /* Skip 13 outer watershed streams across the entire central valley & lake! */
        vec2 wsFlow = vec2(0.0);
        vec3 ws = (outDist > 0.0005 || abs(wp.x) > 4.2 || abs(wp.y) > 2.2) ? stWatershedEx(wp, outDist, wsFlow) : vec3(0.0);
        vec3 lb = stLB0;
        float wsFade = 1.0 - smoothstep(8.2, 10.8, outDist);
        float wsWm = ws.x * wsFade;

        float stWm = outDist > 0.0005 ? wsWm : max(wm, wsWm);
        float stShore = outDist > 0.0005 ? ws.z : max(shore, ws.z * step(0.04, wsWm));
        float stLakeN = outDist > 0.0005 ? 0.0 : lakeN;

        /* The main rivers share the lake datum. Branch water follows its
           sloping bed with room for a shallow shelf at the waterline. */
        float branchY=0.105+wt.b*uYRange.y*uRelief;
        float branchGate=smoothstep(0.60,0.96,stBranch)*(1.0-smoothstep(0.034,0.12,vForestWorld.y-branchY));
        float stWmSafe=max(stWm*(1.0-smoothstep(0.111,0.128,vForestWorld.y)),wt.r*branchGate);
        float creekMix=smoothstep(0.44,0.94,stBranch)*smoothstep(0.055,0.34,stCRDist0)*(1.0-stLakeN);
        float waterBlend = (uWaterOn > 0.5) ? smoothstep(0.08, 0.48, stWmSafe) : 0.0;
        float landM = 1.0 - smoothstep(0.18, 0.62, stWmSafe);
        // Differentiate the actual incision mask in world XZ. The uncut
        // height map alone would project top-face textures down a carved wall.
        float innerCut=max(lb.y,stCR0.y);
        #ifdef STUDIO_HEADWATERS
        float outerCut = 1.0 - stDryShoulder(ws);
        innerCut = mix(innerCut, outerCut, headwaterMix);
        #endif
        vec2 px=dFdx(wp),py=dFdy(wp),cutDiff=vec2(dFdx(innerCut),dFdy(innerCut));
        float det=px.x*py.y-px.y*py.x;
        vec2 cutGrad=vec2(cutDiff.x*py.y-px.y*cutDiff.y,px.x*cutDiff.y-cutDiff.x*py.x)*
                     (sign(det)/max(abs(det),1e-10));

        /* Real-time mountain cast shadow + monumental slow-drifting cloud shadows (matching flow2-valley5-light.js!) */
        float cloudSh = stCloudVisibility3(vec3(wp.x, vForestWorld.y, wp.y));
        float sunVis = stTerrainSunShadow(vForestWorld, sunNS, outDist, stBranch) * cloudSh;

        /* -------------------- PART 1: CC0 2K PBR TERRAIN (DUAL-SCALE GRASS + TRIPLANAR SLATE CLIFFS + TIGHT WET SHORE) -------------------- */
        if (landM > 0.001) {
          /* Accurate world-space terrain normal (core heightmap + widened lake banks + vertex-computed outer alpine peaks) */
          vec2 eS = 1.35 / PX;
          float hL = texture2D(tCanopy, uv - vec2(eS.x, 0.0)).r;
          float hR = texture2D(tCanopy, uv + vec2(eS.x, 0.0)).r;
          float hD = texture2D(tCanopy, uv - vec2(0.0, eS.y)).r;
          float hU = texture2D(tCanopy, uv + vec2(0.0, eS.y)).r;
          if (stBranch > 0.005) {
            vec4 bL=texture2D(tWater,uv-vec2(eS.x,0.0)), bR=texture2D(tWater,uv+vec2(eS.x,0.0));
            vec4 bD=texture2D(tWater,uv-vec2(0.0,eS.y)), bU=texture2D(tWater,uv+vec2(0.0,eS.y));
            float bedZero=(0.105-uYRange.x)/uYRange.y;
            hL=mix(hL,min(hL,bedZero+bL.b),bL.a); hR=mix(hR,min(hR,bedZero+bR.b),bR.a);
            hD=mix(hD,min(hD,bedZero+bD.b),bD.a); hU=mix(hU,min(hU,bedZero+bU.b),bU.a);
          }
          float sgnX = (uvR.x < uSkirt.x || uvR.x > 1.0 - uSkirt.x) ? -1.0 : 1.0;
          float sgnZ = (uvR.y < uSkirt.y || uvR.y > 1.0 - uSkirt.y) ? -1.0 : 1.0;
          // Convert height differences to world gradients; a fixed multiplier
          // flattened the slope as the source height-map resolution changed.
          vec2 normalScale = uYRange.y * uRelief * uBounds.zw / (2.0 * eS);
          vec3 sN = normalize(vec3(-(hR - hL) * normalScale.x * sgnX, 1.0, -(hU - hD) * normalScale.y * sgnZ));

          if (innerCut>0.001 && outDist<=0.0005) {
            float uncut=max(.0,(uYRange.x+(hL+hR+hD+hU)*.25*uYRange.y-.105)*uRelief);
            float left=max(.035,1.0-innerCut);
            vec2 faceSlope=-sN.xz/max(.06,sN.y)*pow(left,.58)-
                           clamp(cutGrad,-22.0,22.0)*(.58*(uncut+.028)*pow(left,-.42));
            vec3 carved=normalize(vec3(-faceSlope.x,1.0,-faceSlope.y));
            sN=normalize(mix(sN,carved,.84*smoothstep(.005,.09,innerCut)*(1.0-smoothstep(.91,.998,innerCut))));
          }
          if (outDist > 0.0005) {
            #ifdef STUDIO_HEADWATERS
            // The gradient of (ridge height \xD7 land fraction) follows the
            // same incised surface as the mesh throughout the bend.
            vec2 ridgeSlope = -vStOutN.xz / max(0.001, vStOutN.y);
            vec2 slope = ridgeSlope*(1.0-outerCut) - vStOutN.y*clamp(cutGrad,-22.0,22.0);
            vec3 bankNormal = normalize(vec3(-slope.x*1.32, 1.0, -slope.y*1.32));
            sN = normalize(mix(sN, bankNormal, smoothstep(0.0, 2.25, outDist)));
            #else
            sN = normalize(mix(sN, normalize(vStOutN), smoothstep(0.0, 2.25, outDist)));
            #endif
          }
          float sunMacro = clamp(dot(sN, sunNS), 0.0, 1.0);

          /* Multi-scale organic domain warp & alpine biome zoning (fast 2-octave stFbm2 -> 4x faster ALU, ZERO grid repetition!) */
          vec2 warp = vec2(stFbm2(wp * 0.34 + vec2(3.1, -5.4)), stFbm2(wp * 0.34 + vec2(-6.7, 2.8))) - 0.5;
          vec2 wpW = wp + warp * 2.15;
          float patchMix    = stFbm2(wpW * 0.46 + vec2(4.2, -2.7));
          float macroBiomeA = stFbm2(wpW * 0.26 + vec2(11.4, -7.8));
          float macroBiomeB = forestNoise(wpW * 0.68 + vec2(-9.7, 13.2));
          float elevN = clamp((vForestWorld.y - 0.105) / max((uYRange.x + uYRange.y - 0.105) * uRelief, 0.25), 0.0, 1.0);
          float cavity = clamp(vStCurvature.x, 0.0, 1.0);
          float ridge = clamp(vStCurvature.y, 0.0, 1.0);
          float aspect = dot(sN.xz, normalize(sunNS.xz));
          float warmAspect = smoothstep(-0.12, 0.52, aspect);
          float coolAspect = 1.0 - smoothstep(-0.48, 0.10, aspect);
          float valleyFloor = 1.0 - smoothstep(0.10, 0.38, elevN);
          float exposed = smoothstep(0.36, 0.78, elevN);
          float coolHollow = clamp(cavity * 0.70 + valleyFloor * 0.46 + coolAspect * 0.30, 0.0, 1.0);
          float warmUpland = clamp(exposed * (0.76 + ridge * 0.24) + ridge * 0.28 + warmAspect * 0.16 - cavity * 0.35, 0.0, 1.0);
          /* Micro geological erosion ribs & highland heather/scree variation so treeless hills feel deeply detailed! */
          float erosionRib  = forestNoise(wp * 3.10 + warp * 1.4 + vec2(2.1, 7.6));
          float screeVeins  = smoothstep(0.48, 0.80, forestNoise(wpW * 1.15 + vec2(-4.8, 6.2)) * 0.70 + patchMix * 0.30);

          /* --- 1A. 4-LAYER PURE 2K CC0 ALPINE GRASS & GROUND BIOMES (Grass004 + forrest_ground_01 + Moss002 + aerial_rocks_04!) --- */
          float shoreBreak = (forestNoise(wp * 2.4 + vec2(-5.1, 3.7)) - 0.5) * 0.024;
          float localWaterY = mix(0.105,branchY,smoothstep(0.002,0.16,stBranch));
          float relY = vForestWorld.y - localWaterY + shoreBreak;
          float outerBankCap = outDist > 0.05 ? smoothstep(0.38, 0.85, ws.y) : 1.0;
          float shoreCliff = (1.0 - smoothstep(0.0, 0.095, relY)) * outerBankCap;
          float wetCliff   = (1.0 - smoothstep(0.0, 0.036, relY)) * outerBankCap * clamp(uShoreWet, 0.0, 1.5);
          float dampRim    = (1.0 - smoothstep(0.030, 0.092, relY)) * (1.0 - wetCliff) * outerBankCap * clamp(uShoreWet, 0.0, 1.5);
          // Small creeks retain mossy soil and gravel shoulders instead of
          // inheriting the main canyon's continuous dark basalt waterline.
          wetCliff*=mix(1.0,0.65,stBranch);
          shoreCliff*=mix(1.0,0.48,stBranch);
          wetCliff*=mix(1.0,.76,headwaterMix);
          shoreCliff*=mix(1.0,.68,headwaterMix);

          /* Independent rotated anti-tiling UVs for each of the 4 pure 2K grass/ground biomes (zero double-exposure blur!) */
          vec2 uvG1 = rotP * wp * 0.88 + vec2(0.19, 0.53) + warp * 0.14;  /* G1: Lush Grass004 meadow */
          vec2 uvG2 = wp * vec2(.57,.76) + vec2(.37,.11) - warp * .52;    /* G2: Sunlit Wild Highland forrest_ground_01 */
          vec2 uvG3 = rotQ * wp * .51 + vec2(.41,.77) + warp * .36;       /* G3: Deep Canyon Moss002 */
          vec2 uvG4 = rotP * wp * .43 + vec2(.63,.29) - warp * .42;       /* G4: Alpine Heather & Scree aerial_rocks_04 */

          vec4 g1Tex = texture2D(tGrassAlb,     uvG1);
          vec4 g2Tex = texture2D(tGrassWildAlb, uvG2);
          vec4 g3Tex = texture2D(tMossAlb,      uvG3);
          vec4 g4Tex = texture2D(tHeathAlb,     uvG4);

          // A continuous sward: broad cushions follow the fall line, with a
          // second, much finer scan for leaf blades, pore shadows and dew.
          vec3 g1Alb = stGrassAlbedo(g1Tex);
          vec3 g2Alb = g2Tex.rgb;
          vec4 cushionScan=g1Tex, bladeScan=g1Tex;
          vec2 lay=normalize(vec2(.86,.50)+warp*.62);
          mat2 toSward=mat2(lay.x,-lay.y,lay.y,lay.x);
          vec2 bedCoord=toSward*wp*vec2(1.55,2.85)+warp*.72;
          const float bladeScale=3.45;
          vec2 bladeUV=rotQ*wp*bladeScale+warp*.34+vec2(.29,.63);
          float opticalDetail=1.0-smoothstep(.018,.095,pxW*bladeScale);
          if (nearDetail > 0.04) {
            cushionScan=texture2D(tGrassAlb,bedCoord);
            // At a grazing angle, the tips reveal a little of the shaded soil
            // behind them. The prefiltered texture keeps distant ridges quiet.
            vec2 parallax=clamp(viewV.xz/max(.30,abs(viewV.y)),vec2(-1.7),vec2(1.7));
            bladeUV+=rotQ*parallax*((cushionScan.g-.50)*.034*opticalDetail);
            bladeScan=texture2D(tGrassAlb,bladeUV);
            g1Alb=mix(g1Alb,stGrassAlbedo(cushionScan),.36*nearDetail);
            g2Alb*=mix(1.0,.82+.36*cushionScan.g,.50*nearDetail);
          }

          /* Ecological 4-biome layering:
             - G1 Lush Emerald Grass: balanced mid-elevation meadows
             - G2 Wild Highland Olive-Sage Reed Grass: sweeping sunlit ridges, warm saddles & open windward slopes
             - G3 Deep Pine Canyon Moss: shady north slopes, cool valley hollows & damp lower depressions
             - G4 Alpine Heather/Peat Scree Rim: cliff lips, steep transitional shoulders & rocky high-altitude crowns */
          // Terrain determines the habitat; noise only breaks its boundaries.
          // Sun visibility deliberately does not enter these material weights:
          // passing clouds must not turn living moss into dry grass.
          float clumps = smoothstep(0.30, 0.68, patchMix * 0.72 + macroBiomeB * 0.28);
          float rimSlope = 1.0 - smoothstep(uRockSlope - 0.035, uRockSlope + 0.075, sN.y);
          float moisture = clamp(coolHollow * 0.82 + dampRim * 0.65 + wetCliff * 0.80 + stBranch * 0.36, 0.0, 1.0);
          float dryHeath = clamp(warmUpland * (0.72 + 0.28 * clumps) - moisture * 0.42, 0.0, 1.0);
          float cushion=clamp(.64*cushionScan.g+.36*g1Tex.g,0.0,1.0);
          float blades=(bladeScan.g-.50)*opticalDetail*nearDetail;
          float pores=(1.0-cushionScan.b)*nearDetail;
          // Green excess in the forest-floor photograph separates living leaves
          // from straw and soil. Moss luminance follows the scanned cushion relief.
          float greenExcess=dot(g2Tex.rgb,vec3(-.55,1.0,-.45))/max(.012,dot(g2Tex.rgb,vec3(1.0)));
          float liveLeaves=smoothstep(.018,.205,greenExcess);
          float mossCrown=smoothstep(.054,.157,g3Tex.g);
          float straw=smoothstep(.29,.79,(1.0-liveLeaves)*.53+dryHeath*.32+ridge*.12+erosionRib*.18);
          float ecology=clamp(uBiomeContrast,0.0,1.8);
          float exposedTips=smoothstep(.48,.74,cushion+blades*.63)*(1.0-pores*.54);
          float tipRelief=mix(mossCrown,exposedTips,.55*nearDetail);
          float mossHabitat=.11+.53*moisture+.31*mossCrown+.14*clumps+.10*coolAspect;
          float dryHabitat=.10+.34*dryHeath+.41*straw+.13*warmAspect+.10*ridge+.08*erosionRib-.13*moisture;
          float tipHabitat=.10+.30*liveLeaves+.29*tipRelief+.15*clumps+.13*cushion+.10*warmAspect;
          vec3 habitat=vec3(mossHabitat,dryHabitat,tipHabitat);
          vec3 grassLayers=stMeadowCover(.5+(habitat-.5)*(.76+.24*ecology));
          float wWild = 0.08 + dryHeath * 0.85 + .28*grassLayers.y;
          float wMoss = 0.08 + moisture * (1.25 + 0.36 * clumps) + .35*grassLayers.x;
          float wHeath = 0.06 + exposed * (0.35 + screeVeins * 0.54) + ridge * rimSlope * 0.38;
          float wLush = 0.24 + (1.0 - dryHeath) * (1.0 - moisture * 0.65) * (0.72 + 0.45 * clumps);
          float wSum   = max(wLush + wWild + wMoss + wHeath, 1e-4);
          wLush /= wSum; wWild /= wSum; wMoss /= wSum; wHeath /= wSum;

          /* Distinct canyon color-temperature harmony for each of the 4 grass layers -> rich multi-tone natural meadows! */
          vec3 colG1 = g1Alb * vec3(0.48, 0.64, 0.37);
          vec3 colG2 = g2Alb * vec3(0.79, 0.78, 0.61);
          vec3 colG3 = g3Tex.rgb * vec3(0.30, 0.48, 0.40);
          vec3 colG4 = g4Tex.rgb * vec3(0.78, 0.76, 0.66);

          vec3 turfBase = colG1 * wLush + colG2 * wWild + colG3 * wMoss + colG4 * wHeath;
          float roughDetail = clamp(g1Tex.a * wLush + g2Tex.a * wWild + g3Tex.a * wMoss + g4Tex.a * wHeath, 0.0, 1.0);
          float dryRough = mix(0.90, 0.96, roughDetail);
          float wetRough = mix(0.65, 0.75, roughDetail);
          float wetGrass=clamp(moisture+.16*grassLayers.x*(1.0-moisture)-.16*grassLayers.y*moisture,0.0,1.0);
          float turfRough = mix(dryRough, wetRough, wetGrass);
          turfRough=clamp(turfRough+blades*.065-pores*moisture*.036,
                          mix(.90,.65,wetGrass),mix(.96,.75,wetGrass));
          vec3 dryTint = vec3(1.15, 1.05, 0.90);
          vec3 wetTint = vec3(0.76, 0.87, 0.94);
          turfBase *= mix(vec3(1.0), dryTint, clamp(dryHeath * uBiomeContrast, 0.0, 1.0));
          turfBase *= mix(vec3(1.0), wetTint, clamp(moisture * uBiomeContrast, 0.0, 1.0));
          // Peat settles in concave, saturated ground instead of random spots.
          float peat = cavity * valleyFloor * moisture * (0.35 + 0.45 * (1.0 - clumps));
          turfBase = mix(turfBase, vec3(0.042, 0.052, 0.043) * (0.8 + roughDetail * 0.4), peat * 0.60);
          float swardAO=1.0-.21*pores-.12*(1.0-bladeScan.b)*opticalDetail;
          turfBase*=swardAO*(1.0+(cushion-.45)*.53+(bladeScan.r-.26)*.23*opticalDetail+blades*.63);

          /* True 2K Tangent-Space NormalGL for ALL FOUR grass/ground layers cleanly unrotated back to world XZ! */
          vec2 nG1 = rotPT * (texture2D(tGrassNrm,  uvG1).rg * 2.0 - 1.0);
          vec2 nG3 = rotQT * (texture2D(tGrassNrm,  uvG3).ba * 2.0 - 1.0);
          vec2 nG2 =          texture2D(tGrassNrm2, uvG2).rg * 2.0 - 1.0;
          vec2 nG4 = rotPT * (texture2D(tGrassNrm2, uvG4).ba * 2.0 - 1.0);
          vec2 turfNxy = nG1 * wLush + nG2 * wWild + nG3 * wMoss + nG4 * wHeath;
          // Bump the continuous turf at cushion scale as well as blade scale.
          // Screen derivatives use the existing XZ Jacobian, without height taps.
          float matHeight=.54*mossCrown+.30*liveLeaves+.16*cushion;
          vec2 hd=vec2(dFdx(matHeight),dFdy(matHeight));
          vec2 matSlope=vec2(hd.x*py.y-px.y*hd.y,px.x*hd.y-hd.x*py.x)*
                        (sign(det)/max(abs(det),1e-10))*.007;
          turfNxy+=vec2(-matSlope.x,matSlope.y)*inversesqrt(1.0+dot(matSlope,matSlope)*7.0)*nearDetail;
          if (nearDetail > 0.04) {
            vec4 microN=texture2D(tGrassNrm,bladeUV);
            vec2 nFine=rotQT*(mix(microN.rg,microN.ba,moisture*.68)*2.0-1.0);
            turfNxy+=nFine*(.72*nearDetail*opticalDetail);
          }

          /* Sculptural micro-terrain normal perturbation */
          vec3 turfT = normalize(vec3(sN.y, -sN.x, 0.0));
          vec3 turfB = normalize(cross(sN, turfT));
          vec3 grassN = normalize(sN + (turfT * turfNxy.x + turfB * turfNxy.y) * 1.05 * clamp(pbrAmt, 0.0, 1.5));
          float grassSun = clamp(dot(grassN, sunNS), 0.0, 1.0);
          float grassHeight = clamp((1.0 - turfRough) * 0.28 + dot(turfBase, vec3(0.26, 0.60, 0.14)) * 1.85 + wWild * 0.14 - wHeath * 0.16, 0.0, 1.0);

          /* Subtle sun/shade atmospheric color temperature shift + user saturation slider */
          turfBase *= mix(vec3(1.0), vec3(1.12, 1.04, 0.88), warmAspect * 0.62);
          turfBase *= mix(vec3(1.0), vec3(0.78, 0.88, 1.04), coolAspect * 0.58);
          turfBase=stMeadowDye(turfBase,grassLayers);
          float seams=(1.0-mossCrown)*(1.0-liveLeaves)*(.24+.55*moisture);
          turfBase*=1.0+(.16*(mossCrown-.5)+.12*(liveLeaves-.5)-.22*seams)*ecology;
          turfBase=stSat(turfBase,clamp(uGrassSat,.2,2.0));

          /* Dramatic canyon chiaroscuro lighting: sunlit wild-olive ridges vs deep cool-pine shadow hollows */
          float turfLit = mix(sunMacro, grassSun, 0.68) * sunVis;
          float valleyAO = max(0.42, 1.0 - cavity * uCavityDepth * 0.56);
          vec3 turfAmb = skyFillCol * (0.44 + 0.56 * max(0.0, grassN.y)) + bounceCol * (0.30 + 0.70 * (1.0 - max(0.0, grassN.y)));
          vec3 surfCol = turfBase * (turfAmb * valleyAO + sunKeyCol * turfLit * (1.0 - cavity * uCavityDepth * 0.12));
          surfCol *= 1.0 + ridge * uCavityDepth * 0.10;

          /* Crisp pale silvery-sage backlit grass rim light along sunlit wild-reed ridges & canyon lips */
          vec3 Hgrass = normalize(viewV + sunNS);
          float grassSpec = pow(max(dot(grassN, Hgrass), 0.0), mix(34.0, 8.0, turfRough)) * (1.0 - turfRough * 0.74) * turfLit;
          float ridgeRim  = pow(1.0 - clamp(dot(grassN, viewV), 0.0, 1.0), 2.8) * turfLit * (0.35 + 0.65 * smoothstep(0.16, 0.58, vForestWorld.y));
          vec3 grassSheen=mix(vec3(.20,.28,.19),uMeadowTips,grassLayers.z);
          surfCol += (vec3(0.17) + grassSheen*0.90) * (grassSpec * 0.24 + ridgeRim * (0.36 + 0.28 * wWild)) * clamp(uSunIntensity, 0.4, 1.8);

          /* --- 1B. 3-LAYER PURE 2K GEOLOGICAL ROCK & CLIFF SYSTEM (Rock051 Strata + Rock035 Dark Basalt + mossy_rock Ledges!) --- */
          float rockNoise  = patchMix * 0.45 + forestNoise(wp * 0.62 + vec2(-3.2, 5.1)) * 0.55;
          float rockFineN  = forestNoise(wp * 1.85 + vec2(6.4, -2.9));
          float darkRockZone = stFbm2(wpW * 0.38 + vec2(-8.2, 6.4));
          float slopeCut   = 1.0 - smoothstep(uRockSlope - 0.185, uRockSlope + 0.043, sN.y);
          float ridgeCrag  = exposed * (1.0 - smoothstep(uRockSlope - 0.06, uRockSlope + 0.06, sN.y)) * (0.32 + ridge * 0.68);
          float highScree  = exposed * smoothstep(0.38, 0.78, screeVeins * 0.58 + rockNoise * 0.42) * 0.66;
          float gorgeRock  = ws.y * (1.0 - smoothstep(uRockSlope - 0.14, uRockSlope + 0.06, sN.y)) * (0.50 + 0.50 * rockNoise);
          float sheerRock  = clamp(slopeCut * 1.24 + ridgeCrag * 1.05 + highScree + gorgeRock * 0.85 + shoreCliff * 1.38, 0.0, 1.0);
          sheerRock*=1.0-stBranch*smoothstep(0.30,0.82,sN.y)*0.62;

          // Carve masks describe the newly exposed walls continuously across
          // mesh triangles. Their half-depth transition is the steepest part.
          float cutEdge=max(max(lb.y*(1.0-lb.y),stCR0.y*(1.0-stCR0.y)),stBranch*(1.0-stBranch));
          cutEdge=max(cutEdge,ws.y*(1.0-ws.y)*headwaterMix);
          float bankFace=smoothstep(0.010,0.068,relY)*(1.0-smoothstep(0.27,0.60,relY));
          float rootingSlope=clamp(sN.y-cutEdge*1.32*bankFace,0.0,1.0);
          float rootPocket=(clumps-0.5)*0.10+(erosionRib-0.5)*0.12+(moisture-0.35)*0.05;
          vec2 fissureUV=vec2(dot(wp,vec2(.81,.59)),vForestWorld.y+dot(wp,vec2(-.18,.23)));
          rootPocket+=(forestNoise(fissureUV*8.7+warp)-0.5)*0.068+(g1Tex.a-g3Tex.a)*0.035;
          rootPocket-=clamp(wetCliff,0.0,1.0)*(1.0-rootingSlope)*0.19;
          float rockCover=1.0-stGrassCover(rootingSlope,sheerRock,rootPocket);
          #ifdef STUDIO_HEADWATERS
          // Expose the existing slate and basalt scans on broken shoulders.
          // Sheltered patches keep their moss, and the toe still takes gravel.
          float bankBelt = 4.0*ws.y*(1.0-ws.y)*headwaterMix;
          float ledgeFace = smoothstep(0.035,0.14,relY) * (1.0-smoothstep(0.56,0.94,sN.y));
          rockCover = max(rockCover, bankBelt*ledgeFace*smoothstep(0.22,0.67,rockFineN*.58+rockNoise*.42));
          #endif
          if (rockCover > 0.006) {
            vec3 absN = abs(sN);
            vec3 triW = pow(max(absN,0.001),vec3(3.8));
            triW /= max(triW.x + triW.y + triW.z, 1e-4);

            /* R1: Monumental diagonal stratified grey canyon wall (Rock051 Triplanar 3-axis Color + NormalGL + Disp + AO) */
            float rScale = 0.72;
            vec2 rWarp = warp * 0.12;
            vec2 uvRX = vForestWorld.zy * rScale + rWarp;
            vec2 uvRY = vForestWorld.xz * rScale + rWarp;
            vec2 uvRZ = vForestWorld.xy * rScale + rWarp;

            vec4 rAlbX = texture2D(tRockAlb, uvRX);
            vec4 rAlbY = texture2D(tRockAlb, uvRY);
            vec4 rAlbZ = texture2D(tRockAlb, uvRZ);
            vec4 rockAlbR = rAlbX * triW.x + rAlbY * triW.y + rAlbZ * triW.z;

            vec4 rNrmX = texture2D(tRockNrm, uvRX);
            vec4 rNrmY = texture2D(tRockNrm, uvRY);
            vec4 rNrmZ = texture2D(tRockNrm, uvRZ);
            vec3 tNX = stUnpackNrm(rNrmX.rg);
            vec3 tNY = stUnpackNrm(rNrmY.rg);
            vec3 tNZ = stUnpackNrm(rNrmZ.rg);
            vec3 wNX = vec3(sN.x, tNX.y, tNX.x * sign(sN.x));
            vec3 wNY = vec3(tNY.x, sN.y, -tNY.y * sign(sN.y));
            vec3 wNZ = vec3(tNZ.x * sign(sN.z), tNZ.y, sN.z);
            vec3 triRockN = normalize(wNX * triW.x + wNY * triW.y + wNZ * triW.z);

            float rockDisp = rNrmX.b * triW.x + rNrmY.b * triW.y + rNrmZ.b * triW.z;
            float rockAO   = rNrmX.a * triW.x + rNrmY.a * triW.y + rNrmZ.a * triW.z;

            // Keep weathering continuous across changes of dominant axis.
            // Where the oblique projection grazes a face, use the triplanar scan.
            vec2 uvDom=vec2(dot(vForestWorld,vec3(.80,0.0,.60)),
                            dot(vForestWorld,vec3(-.36,.80,.48)))*rScale+rWarp;
            float projectionWeight=smoothstep(.13,.60,abs(dot(sN,vec3(-.48,-.60,.64))));
            vec2 uvBasalt = rotP * uvDom * 1.48 + vec2(0.23, 0.59);
            vec2 uvMossRk = rotQ * uvDom * 1.18 + vec2(0.47, 0.13);

            vec4 basaltAlb = stMaterialTile(tRockBasaltAlb, uvBasalt, 0.0);
            vec4 mossyRkAlb = texture2D(tRockMossAlb,  uvMossRk);
            vec2 basaltNxy = stMaterialTile(tRockNrm2, uvBasalt, 0.0).rg * 2.0 - 1.0;
            vec2 mossyNxy  = stMaterialTile(tRockNrm2, uvMossRk, 0.0).ba * 2.0 - 1.0;
            basaltAlb=mix(rockAlbR*vec4(.78,.83,.88,1.0),basaltAlb,projectionWeight);
            mossyRkAlb=mix(rockAlbR,mossyRkAlb,projectionWeight);
            basaltNxy*=projectionWeight;
            mossyNxy*=projectionWeight;

            /* Close-up micro-fracture detail octave when zoomed in */
            vec4 rockFine = rockAlbR;
            vec2 fNxy = vec2(0.0);
            float chipHeight = rockDisp;
            if (nearDetail > 0.04) {
              vec2 uvDomFine = rotP * uvDom * 2.75 + vec2(0.31, 0.67);
              rockFine = mix(rockAlbR,texture2D(tRockAlb,uvDomFine),projectionWeight);
              vec4 chipMap = texture2D(tRockNrm,uvDomFine);
              fNxy = (chipMap.rg*2.0-1.0)*projectionWeight;
              chipHeight = mix(rockDisp,chipMap.b,nearDetail*projectionWeight);
            }

            // A tilted mineral bed thickens and pinches out along the wall.
            // Keep the breakup in world space across triplanar projection seams.
            vec2 wallUV = vec2(dot(wp,vec2(2.1,1.7)), vForestWorld.y*3.7);
            float joint = forestNoise(wallUV*2.9 + warp*1.8);
            float splinter = chipHeight*0.57 + rockDisp*0.27 + joint*0.16;
            vec2 chipUV=vec2(dot(wp,vec2(.78,.61))+.24*vForestWorld.y,
                             vForestWorld.y*1.16+dot(wp,vec2(-.27,.19)));
            float weather=forestNoise(chipUV*13.6+warp)*.53+forestNoise(rotQ*chipUV*31.5)*.27+splinter*.20;
            float fractures=smoothstep(.38,.68,weather);
            float column = vForestWorld.y*7.1 + dot(wp,vec2(0.30,-0.19)) + macroBiomeA*0.72;
            column += 0.28*sin(column*1.55 + macroBiomeB*2.6) + (erosionRib-0.5)*0.36;
            column += (joint-0.5)*0.22 + (rockDisp-0.5)*0.23 + (weather-.50)*0.39;
            float bedID = floor(column);
            float seed = forestHash(vec2(bedID,7.4));
            float lens = forestNoise(wp*1.75 + vec2(11.3,bedID*3.17));
            float halfBed = mix(.055,.23,seed)*mix(.30,1.17,smoothstep(.22,.76,lens));
            float offset = fract(column) - mix(0.40,0.60,seed);
            float resolution = fwidth(column);
            float blur = 0.054 + min(resolution,0.15);
            float ledge = 1.0-smoothstep(halfBed*0.50,halfBed+blur,abs(offset));
            float parting = 1.0-smoothstep(0.0,0.032+blur,abs(offset+halfBed));
            float outcrop = (1.0-smoothstep(0.70,0.97,sN.y))*(1.0-smoothstep(0.17,0.49,resolution));
            float bandAmount = min(1.0,outcrop*uStrataStrength*(0.40+0.44*smoothstep(0.19,0.63,lens)));
            // Fresh, irregular fracture facets cut through the weathered bedding.
            float flake = smoothstep(0.57,0.79,splinter + 0.19*(joint-0.5));
            float intact = smoothstep(0.23,0.69,splinter + 0.34*(erosionRib-0.5));
            float paleFace=(ledge*(.22+.50*lens)*(.23+.77*intact)*(.14+.86*fractures)+
                            flake*(.16+.16*ledge)*fractures)*bandAmount;
            float seam = parting*(0.28+0.72*smoothstep(0.32,0.69,joint))*(1.0-flake*0.64)*bandAmount;
            float lowerBasalt = (1.0-smoothstep(0.012,0.14,relY))*outerBankCap*(0.16+0.20*darkRockZone);
            float basaltW = clamp(wetCliff*0.36 + lowerBasalt + (1.0-rockDisp)*0.23 + seam*0.14,0.0,0.67);

            float borderRim = (1.0 - smoothstep(0.22, 0.74, sheerRock)) * (1.0 - wetCliff);
            float shelfBench = smoothstep(0.54, 0.84, sN.y) * (1.0 - wetCliff * 0.88) * (0.48 + 0.52 * patchMix);
            float mossyRkW = clamp((borderRim * 0.88 + shelfBench * 0.86 + dampRim * 0.58) * (1.0 - basaltW * 0.58), 0.0, 0.86);

            /* Blend true 2K normals from all 3 rock layers cleanly */
            vec3 secN = vec3(basaltNxy.x, 0.0, basaltNxy.y) * (0.68 * basaltW) + vec3(mossyNxy.x, 0.0, mossyNxy.y) * (0.58 * mossyRkW);
            vec3 beddingN = (vec3(0.0,1.0,0.0)-sN*sN.y)*(paleFace*0.19-seam*0.11);
            vec3 rockN = normalize(mix(sN, triRockN, clamp(pbrAmt * 0.95, 0.25, 1.0)) + secN + beddingN + vec3(fNxy.x, 0.0, fNxy.y) * 0.45 * nearDetail);
            float rockSun = clamp(dot(rockN, sunNS), 0.0, 1.0);

            float rockRough = mix(rockAlbR.a, basaltAlb.a, basaltW);
            rockRough = mix(rockRough, mossyRkAlb.a, mossyRkW);
            rockRough = mix(0.45, 0.65, clamp(rockRough * 0.76 + rockFine.a * 0.24 - wetCliff * 0.22, 0.0, 1.0));
            float creviceAO = clamp(smoothstep(0.04, 0.78, rockDisp) * 0.52 + rockAO * 0.48, 0.24, 1.0);

            float grain = dot(mix(rockAlbR.rgb,rockFine.rgb,0.23*nearDetail),vec3(0.2126,0.7152,0.0722));
            vec3 weathered = stSat(rockAlbR.rgb,0.45)*0.55 + vec3(0.071,0.080,0.084)*(0.42+0.80*rockAO);
            vec3 basalt = stSat(basaltAlb.rgb,0.55)*0.70 + vec3(0.059,0.070,0.078);
            vec3 rockBase = mix(weathered,basalt,basaltW);
            rockBase = mix(rockBase,mossyRkAlb.rgb*vec3(0.71,0.82,0.68),mossyRkW*0.77);
            rockBase *= uRockBaseGain;
            vec3 freshStone = mix(vec3(0.30,0.325,0.34),vec3(0.57,0.56,0.51),smoothstep(0.22,0.78,rockNoise+0.25*(joint-0.5)));
            freshStone *= 0.36 + grain*1.20 + rockDisp*0.23 + chipHeight*0.53;
            // Exposed beds retain the neighbouring slate's grain and albedo.
            // Only fractured mineral faces carry a distinctly lighter pigment.
            freshStone=mix(rockBase*(1.13+.25*weather),freshStone,.50+.19*fractures)*uRockLayerGain;
            rockBase = mix(rockBase,freshStone,paleFace)*(1.0-seam*.11);

            // Moss takes root in damp pockets between beds, giving way to bare split faces.
            float pocket = smoothstep(0.35,0.62,0.41*joint + 0.32*erosionRib + 0.27*(1.0-chipHeight));
            float ledgeMoss = pocket*(0.50*seam + moisture*0.46 + mossyRkW*0.59)*(1.0-flake*0.77);
            ledgeMoss *= smoothstep(0.012,0.070,relY)*grassLayers.x*smoothstep(0.0,.22,uGrassCover);
            vec3 moss = mix(mossyRkAlb.rgb*vec3(0.62,0.78,0.46),colG3+vec3(0.082,0.109,0.039),0.71);
            moss = stMeadowDye(moss,vec3(1.0,0.0,0.0));
            rockBase = mix(rockBase,moss,clamp(ledgeMoss*1.65,0.0,0.73));
            rockBase *= 1.0-clamp(wetCliff,0.0,1.0)*(0.12+0.10*joint);

            float rockLit = mix(sunMacro, rockSun, 0.58) * sunVis;
            vec3 rockAmb = mix(vec3(0.27,0.30,0.33),vec3(0.40,0.44,0.47),max(0.0,rockN.y)) + bounceCol*0.48;
            vec3 litRock = rockBase * (rockAmb * (0.58 + 0.42 * creviceAO) * valleyAO + sunKeyCol * 0.80 * rockLit * (0.56 + 0.44 * creviceAO));
            // Fractured pale faces catch skylight in the lee; the sunny faces
            // roll off earlier so the highlands keep their grey mineral colour.
            litRock+=paleFace*freshStone*(0.065+0.075*creviceAO)*(1.0-rockLit)*(1.0-ledgeMoss);
            float brightRock=dot(litRock,vec3(0.2126,0.7152,0.0722));
            litRock/=1.0+max(0.0,brightRock-0.26)*0.93;
            litRock *= 1.0 + ridge * uCavityDepth * 0.08;

            vec3 Hr = normalize(viewV + sunNS);
            vec3 wetN = normalize(mix(sN, rockN, 0.62));
            float rockSpec = pow(max(dot(wetN, Hr), 0.0), mix(36.0, 12.0, rockRough)) * (1.0 - rockRough * 0.68) * rockLit * creviceAO;
            float wetFres  = pow(1.0 - clamp(dot(wetN, viewV), 0.18, 1.0), 4.0) * wetCliff * creviceAO;
            float rockRim  = pow(1.0 - clamp(dot(rockN, viewV), 0.0, 1.0), 3.4) * rockLit * smoothstep(0.24, 0.62, vForestWorld.y);
            litRock += vec3(0.46, 0.52, 0.58) * (rockSpec * mix(0.24, 0.44, wetCliff) + rockRim * 0.16) * clamp(uSunIntensity, 0.4, 1.8);
            litRock += vec3(0.20, 0.30, 0.44) * wetFres * 0.24;

            float edge=4.0*rockCover*(1.0-rockCover);
            float rockMargin=clamp(rockCover+(rockDisp-grassHeight)*0.26*edge,0.0,1.0);
            surfCol=mix(surfCol,litRock,mix(rockMargin,smoothstep(0.0,1.0,rockMargin),0.38));
          }

          // Sediment settles on low, relatively flat shelves beside the
          // water. Patchy drift and moss keep gravel from outlining every bank.
          float riverBank=(1.0-smoothstep(0.11,0.34,stCRDist0))*(1.0-smoothstep(0.018,0.14,relY));
          float creekBank=smoothstep(0.06,0.46,stBranch)*(1.0-smoothstep(0.045,0.18,relY));
          float lakeBank=smoothstep(0.03,0.48,lb.y)*(1.0-smoothstep(0.027,0.13,relY));
          float drift=smoothstep(0.31,0.67,patchMix*0.45+rockFineN*0.55);
          float gravelShelf=max(max(riverBank,creekBank),lakeBank*0.72)*
                            smoothstep(0.33,0.72,sN.y)*(0.29+0.71*drift)*clamp(uShoreWet,0.0,1.4);
          float outerShelf=headwaterMix*smoothstep(.62,.96,ws.y)*(1.0-smoothstep(.018,.14,relY));
          gravelShelf=max(gravelShelf,outerShelf*smoothstep(.42,.78,sN.y)*(.28+.51*drift)*clamp(uShoreWet,0.0,1.4));
          float emergedBar=smoothstep(0.93,0.997,stBranch)*(1.0-smoothstep(0.020,0.059,abs(relY)))*
                           (1.0-smoothstep(0.09,0.52,wt.r));
          gravelShelf=max(gravelShelf,emergedBar*clamp(uShoreWet,0.0,1.0));
          if(gravelShelf>0.018) {
            vec4 gravel,gravelDetail;
            float contact;
            stCobbleSurface(wp,sN,viewV,sunNS,gravel,gravelDetail,contact);
            vec2 stoneSlope=stGravelSlope(gravelDetail.rg);
            vec3 slope=vec3(stoneSlope.x,0.0,stoneSlope.y);
            vec3 stoneN=normalize(sN+(slope-sN*dot(sN,slope))*1.24);
            float stoneLight=max(dot(stoneN,sunNS),0.0)*sunVis*contact;
            float cap=smoothstep(0.44,0.78,gravelDetail.b);
            float contactWet=1.0-smoothstep(0.008,0.065,relY+(cap-0.5)*0.036);
            vec3 stoneColor=gravel.rgb*mix(vec3(1.20,1.16,1.08),vec3(0.74,0.83,0.88),contactWet);
            stoneColor*=gravelDetail.a*(skyFillCol*(1.05+0.76*max(0.0,stoneN.y))+sunKeyCol*stoneLight*0.90);
            stoneColor*=(0.69+0.61*gravelDetail.b)*mix(0.82,1.0,contact);
            float stoneSpec=pow(max(dot(stoneN,normalize(viewV+sunNS)),0.0),32.0)*
                            (1.0-gravel.a)*contactWet*stoneLight;
            stoneColor+=vec3(0.86,0.93,0.98)*stoneSpec*0.16;
            float gravelCover=gravelShelf*max(emergedBar,smoothstep(0.11,0.53,gravelDetail.b+drift*0.32));
            surfCol=mix(surfCol,stoneColor,clamp(gravelCover,0.0,0.92));
          }

          /* Damp moss just above the waterline. */
          surfCol *= mix(1.0, 0.82, dampRim * 0.62);

          /* Filmic shoulder rolloff preserving crisp white sunlit rock highlights & deep charcoal shadows */
          surfCol = surfCol / (1.0 + surfCol * 0.20);
          col = mix(col, surfCol, clamp(stAmt, 0.0, 1.0));
        }

        /* -------------------- PART 2: SILKY DEEP STEEL-INDIGO CANYON RIVER & LAKE WATER (ZERO GREY WASHOUT / ZERO TIN-FOIL CHOP!) -------------------- */
        if (waterBlend > 0.003) {
          // Follow each tributary's own current, then merge that vector
          // across the width of the receiving river before shading the waves.
          vec2 flowRaw = (outDist > 0.0005) ? wsFlow : (length(stCRFlow) > 0.01 ? stCRFlow : wsFlow);
          float bedSill=0.0, bedGrade=0.0;
          if (creekMix > 0.002) {
            vec2 downstream=stCreekCurrent(uvR);
            vec2 alongBed=downstream*uBounds.zw*0.043;
            vec4 ahead=texture2D(tWater,uvR+alongBed), behind=texture2D(tWater,uvR-alongBed);
            bedGrade=smoothstep(0.04,0.37,(behind.b-ahead.b)*uYRange.y*uRelief/0.086);
            bedSill=smoothstep(0.014,0.13,(behind.g+ahead.g)*0.5-wt.g)*min(behind.r,ahead.r);
            vec2 branchCurrent=downstream*(0.52+0.21*bedGrade+0.13*bedSill);
            flowRaw=mix(flowRaw,branchCurrent,creekMix);
          }
          float flowLen = length(flowRaw);
          vec2 flowDir = flowLen > 0.01 ? (flowRaw / flowLen) : normalize(vec2(0.122, -0.056) - wp + vec2(1e-4));
          float flowSpd = mix(clamp(flowLen * 1.35 + 0.40, 0.40, 1.0), 0.24, stLakeN);
          flowSpd*=mix(1.0,0.66+0.29*(1.0-smoothstep(0.21,0.58,wt.g)),creekMix);

          /* Unified smooth water depth: dark cliff-shadowed lip -> rich deep steel-indigo river & lake basin */
          float depthNoise = (forestNoise(wp * 1.45 + vec2(5.2, -3.1)) - 0.5) * 0.08;
          float rawSh = clamp(stShore + depthNoise * smoothstep(0.04, 0.30, stShore), 0.0, 1.0);
          float inWideLake = smoothstep(0.05, 0.58, lb.x);
          float basinProfile=clamp(lb.z+depthNoise*.15,0.0,1.0);
          float lakeSmoothD=mix(sqrt(basinProfile),basinProfile,.30);
          float riverSmoothD = smoothstep(0.04, 0.56, rawSh) * 0.95;
          float shoreDist = clamp(max(smoothstep(0.0, 0.36, rawSh), smoothstep(0.0, 0.22, lb.z) * inWideLake), 0.0, 1.0);
          float wDepth = mix(riverSmoothD,lakeSmoothD,inWideLake);
          #ifdef STUDIO_HEADWATERS
          // Preserve a darker thalweg, with visible mineral shallows at bends.
          float outerDepth=mix(.16,.80,pow(clamp(ws.z,0.0,1.0),.78));
          wDepth=mix(wDepth,outerDepth,headwaterMix);
          #endif
          // The same optical depth controls clarity, color, and bottom light.
          // It converges to the receiving river's depth at the confluence.
          wDepth=mix(wDepth,clamp(wt.g+depthNoise*0.56,0.0,1.0),creekMix);
          shoreDist=mix(shoreDist,smoothstep(0.04,0.76,stWmSafe),creekMix);

          /* --- 2A. Silky Broad Sweeping Canyon Swells + Controlled Crossing Ripples (ZERO noisy tin-foil wrinkles!) --- */
          float wSpd = max(0.0, uWaterSpeed);
          float phBase = uTime * wSpd * 0.36;
          float a1 = fract(phBase), a2 = fract(phBase + 0.5);
          float b1 = 1.0 - abs(2.0 * a1 - 1.0), b2 = 1.0 - b1;
          float bn = inversesqrt(b1 * b1 + b2 * b2);

          float L1 = 0.56 * flowSpd;
          float L2 = 0.92 * flowSpd;
          vec2 o1A = flowDir * (a1 - 0.5) * L1, o2A = flowDir * (a2 - 0.5) * L1;
          vec2 o1B = flowDir * (a1 - 0.5) * L2, o2B = flowDir * (a2 - 0.5) * L2;

          /* Seamless world-space downstream advection (ZERO polyline-vertex UV cuts or rotated phase-shear stripes!) */
          mat2 crossR  = mat2(0.898, -0.438, 0.438, 0.898);
          mat2 crossRT = mat2(0.898,  0.438, -0.438, 0.898);
          float rippleScale=mix(1.0,1.45,headwaterMix);
          vec2 uvRiv1A = (wp - o1A) * 2.15*rippleScale;
          vec2 uvRiv2A = (wp - o2A) * 2.15*rippleScale + vec2(0.41, 0.27);
          vec4 wMac1 = texture2D(tWaterNrm, uvRiv1A);
          vec4 wMac2 = texture2D(tWaterNrm, uvRiv2A);
          vec4 wMic1 = texture2D(tWaterNrm, crossR * (wp - o1B) * 3.85*rippleScale + vec2(0.17, 0.63));
          vec4 wMic2 = texture2D(tWaterNrm, crossR * (wp - o2B) * 3.85*rippleScale + vec2(0.73, 0.19));

          vec2 rivN1 = ((wMac1.rg - 0.5) * b1 + (wMac2.rg - 0.5) * b2) * bn * 1.08;
          vec2 rivN2 = crossRT * (((wMic1.rg - 0.5) * b1 + (wMic2.rg - 0.5) * b2) * bn);
          float rivCaust = (wMac1.b * b1 + wMac2.b * b2) * 0.55 + (wMic1.b * b1 + wMic2.b * b2) * 0.45;
          float rivSwell = (wMac1.a * b1 + wMac2.a * b2);
          float rivFoamN = (wMic1.a * b1 + wMic2.a * b2);

          /* Central Lake: broad smooth sweeping canyon wind swells + delicate crossing ripples */
          vec2 lakeN1=vec2(0.0), lakeN2=vec2(0.0);
          float lakeCaust=0.0;
          if(stLakeN>0.002) {
            vec2 lUv1=wp*1.15+vec2(0.82,0.57)*uTime*0.048*wSpd;
            vec2 lUv2=crossR*wp*2.85+vec2(-0.52,0.85)*uTime*0.082*wSpd;
            vec4 lk1=texture2D(tWaterNrm,lUv1), lk2=texture2D(tWaterNrm,lUv2);
            lakeN1=lk1.rg-0.5;
            lakeN2=crossRT*(lk2.rg-0.5);
            lakeCaust=lk1.b*0.55+lk2.b*0.45;
          }

          float microAA = 1.0 - smoothstep(0.014, 0.072, pxW);
          /* Smooth grazing-distance attenuation so oblique distant rivers stay liquid & silky (zero noise aliasing!) */
          float grazeAA = mix(0.46, 1.0, smoothstep(0.10, 0.52, abs(viewV.y)));
          float windGust = 0.64 + 0.44 * smoothstep(0.28, 0.76, forestNoise(wp * 0.58 + vec2(uTime * 0.018, -uTime * 0.014)));
          vec2 dualSlope = mix(
            rivN1 * 1.25 + rivN2 * (0.78 * (0.35 + 0.65 * microAA)),
            lakeN1 * 1.12 + lakeN2 * (0.70 * (0.35 + 0.65 * microAA)),
            stLakeN
          ) * windGust * grazeAA;

          /* Concentric liquid ripple wave perturbation around the central holographic LOGO */
          vec2 toLogo = wp - vec2(0.122, -0.056);
          float logoR = length(toLogo);
          float logoRad = max(0.35, uCurtainLogo.y * 0.5);
          if (uCurtainLogo.x > 0.5 && logoR < logoRad * 2.2) {
            float nr = logoR / logoRad;
            float ripWave = sin(nr * 22.0 - uTime * max(0.35, uCurtainLogo.z * 2.5)) * exp(-abs(nr - 0.95) * 2.2) * smoothstep(0.24, 0.58, nr);
            dualSlope += normalize(toLogo + vec2(1e-4)) * ripWave * 0.085 * uCurtainGlow;
          }

          vec2 sl = dualSlope * 0.68 * clamp(uWaterWave, 0.1, 2.5) * mix(0.42, 1.0, smoothstep(0.0, 0.38, shoreDist));
          // Narrow headwaters need smaller ripples, not lake-sized facets.
          sl*=mix(1.0,.48,headwaterMix);
          vec3 Nw = normalize(vec3(-sl.x, 1.0, -sl.y));
          float ndv = clamp(dot(Nw, viewV), 0.0, 1.0);

          /* --- 2B. Shared gravel bed, mineral scattering and depth absorption --- */
          float exposedBed=1.0-smoothstep(0.045,0.75,wDepth);
          float shallMask=clamp(exposedBed*uWaterClear*1.27,0.0,0.98);
          vec3 mineralLight=vec3(0.043,0.145,0.131)*(0.70+0.30*sunVis);
          vec3 shallowTint=uWaterShallow*mix(0.92,0.60,creekMix)+mineralLight*mix(0.39,1.0,creekMix);
          shallowTint=mix(shallowTint,uWaterShallow*0.63+vec3(.023,.042,.048),0.55*inWideLake);
          vec3 deepTint=uWaterDeep*mix(vec3(1.0),vec3(.74,.81,.90),lakeSmoothD*inWideLake);
          vec3 waterBody=mix(shallowTint,deepTint,smoothstep(0.015,0.90,pow(wDepth,0.78)));
          float bedRelief=0.5;
          if(shallMask>0.012) {
            // Use the same world-space stone pattern as the dry gravel shelf.
            // Refraction moves the visible bed slightly as each wave passes.
            vec4 gravel,gravelDetail;
            float contact;
            vec3 refractedView=-refract(-viewV,vec3(0.0,1.0,0.0),0.75);
            stCobbleSurface(wp+sl*(0.006+0.018*wDepth),vec3(0.0,1.0,0.0),refractedView,sunNS,gravel,gravelDetail,contact);
            bedRelief=gravelDetail.b;
            vec2 bedSlope=stGravelSlope(gravelDetail.rg);
            vec3 bedN=normalize(vec3(bedSlope.x*1.22,1.0,bedSlope.y*1.22));
            float bedSun=max(dot(bedN,sunNS),0.0)*sunVis*contact;
            float caustic=smoothstep(0.49,0.87,mix(rivCaust,lakeCaust,stLakeN))*bedSun;
            float path=max(0.0,wDepth-(bedRelief-0.44)*0.15)/max(0.42,ndv);
            vec3 transmission=exp(-vec3(3.60,2.05,1.64)*path);
            vec3 bottom=gravel.rgb*gravelDetail.a*(skyFillCol*(1.14+0.65*bedN.y)+sunKeyCol*bedSun*0.90);
            // Fine ochre sediment collects between the stones on point bars.
            float silt=creekMix*(1.0-smoothstep(0.038,0.24,wDepth))*(1.0-bedSill)*
                       (1.0-smoothstep(0.37,0.69,bedRelief));
            bottom=mix(bottom,(vec3(0.27,0.235,0.156)+gravel.rgb*0.30)*(0.55+0.60*bedSun),silt*0.69);
            bottom*=vec3(0.95,0.98,0.98)*(0.68+bedRelief*0.65+caustic*0.23)*mix(0.83,1.0,contact);
            float exposedStone=smoothstep(0.60,0.86,bedRelief)*(1.0-smoothstep(0.018,0.18,wDepth));
            vec3 stoneTop=bottom*vec3(1.23,1.15,0.99);
            bottom=bottom*transmission+shallowTint*(0.32+0.43*(1.0-transmission));
            bottom=mix(bottom,stoneTop,exposedStone*0.83);
            float bedVisibility=shallMask*mix(.83,1.0,creekMix)*(1.0-inWideLake*(.15+.17*lakeSmoothD));
            waterBody=mix(waterBody,bottom,bedVisibility);
          }
          waterBody *= 1.0 - smoothstep(0.18, 0.98, wDepth) * 0.22;

          /* Deep indigo wave troughs vs crisp cool steel-blue sunlit wave faces */
          float waveFace = clamp(dot(Nw, sunNS), 0.0, 1.0);
          float waveContrast = 0.70 + 0.64 * smoothstep(0.08, 0.88, waveFace) * (0.32 + 0.68 * sunVis) * clamp(uSunIntensity, 0.5, 1.8);
          waterBody *= waveContrast;
          float sharpCrest = smoothstep(0.16, 0.68, abs(sl.x * 2.6 + sl.y * 2.2)) * smoothstep(0.35, 0.85, waveFace);
          waterBody += vec3(0.04, 0.085, 0.16) * sharpCrest * (0.35 + 0.65 * sunVis);
          // Cloud visibility already modulates the direct wave light above.
          // Preserve diffuse sky fill instead of multiplying it into black.

          /* --- 2C. Deep Atmospheric Canyon Sky & Dark Cliff Fresnel Mirror (ZERO pale grey oblique washout!) --- */
          vec3 Rw = reflect(-viewV, Nw);
          vec3 skyHorizon = vec3(0.28, 0.42, 0.62);
          vec3 skyZenith  = vec3(0.08, 0.17, 0.34);
          vec3 skyRefl = mix(skyHorizon, skyZenith, smoothstep(0.04, 0.72, max(0.0, Rw.y)));
          float sunReflBroad = pow(max(dot(Rw, sunNS), 0.0), 16.0) * sunVis;
          skyRefl += vec3(0.56, 0.60, 0.66) * sunReflBroad * clamp(uSunIntensity, 0.4, 1.8);

          /* Dark canyon cliff wall shadow reflection along BOTH riverbanks & lake shores -> anchors vertical cliffs into water! */
          vec3 cliffShadeRefl = mix(vec3(0.016, 0.034, 0.064), skyRefl, smoothstep(0.05, 0.52, shoreDist));
          vec3 reflCol = cliffShadeRefl;
          #ifdef FOREST_MIRROR
          float obliqueMirror = 1.0 - smoothstep(0.34, 0.90, abs(viewV.y));
          if (outDist <= 0.0005 && obliqueMirror > 0.01) {
            vec4 rp = uReflMat * vec4(vForestWorld, 1.0);
            vec4 rf = texture2D(tRefl, clamp(rp.xy / max(rp.w, 1e-4) + sl * 0.075, vec2(0.002), vec2(0.998)));
            vec3 safeBankRefl = max(rf.rgb * 0.68, uWaterDeep * 0.78);
            reflCol = mix(cliffShadeRefl, safeBankRefl, clamp(rf.a, 0.0, 0.88) * obliqueMirror);
          }
          #endif

          /* Balanced glossy liquid Fresnel (capped at 0.72 so low-angle rivers stay rich deep steel-indigo!) */
          float fres = clamp(0.065 + 0.70 * pow(1.0 - ndv, 3.8), 0.065, 0.72);
          vec3 wc = mix(waterBody, reflCol, fres * 0.78);

          /* Dark cliff-waterline contact AO so sheer basalt precipices plunge cleanly into deep water */
          wc *= mix(mix(0.70,0.89,exposedBed), 1.0, smoothstep(0.0, 0.22, shoreDist));

          /* Signature index1-5-canyon-forest silvery-white sunlit specular shimmer path dancing cleanly across ripples! */
          vec3 Hsun = normalize(viewV + sunNS);
          float nh = max(dot(Nw, Hsun), 0.0);
          float specShimmer = pow(nh, 380.0) * 3.60 + pow(nh, 68.0) * 0.36 + pow(nh, 20.0) * 0.08;
          float unresolved=clamp(length(fwidth(Nw))*1.8,0.0,1.0);
          float riverGlint=pow(nh,mix(138.0,48.0,unresolved))*mix(1.65,.72,unresolved)+pow(nh,29.0)*.24;
          specShimmer=mix(riverGlint/(1.0+riverGlint*.87),specShimmer/(1.0+specShimmer*.20),stLakeN);
          float shallowSpec=mix(1.0,0.42,exposedBed)*mix(1.0,0.69,creekMix);
          wc += vec3(0.94, 0.97, 1.00) * specShimmer * sunVis * clamp(uSunIntensity, 0.3, 2.0) * smoothstep(0.04, 0.26, shoreDist)*shallowSpec;
          #ifdef STUDIO_HEADWATERS
          wc=mix(wc,mix(waterBody,cliffShadeRefl,fres*.38)+vec3(.68,.81,.89)*
            specShimmer*sunVis*.22*shallowSpec,headwaterMix);
          #endif

          /* --- 2D. Holographic Light Curtain & Central LOGO Smooth Wave-Slope Water Reflection (ZERO cellular cobweb artifacts!) --- */
          if (uCurtainGlow > 0.002 && uWaterGlow > 0.002) {
            float cg = uCurtainGlow * uWaterGlow * (1.0-headwaterMix);
            float grazingCap = mix(0.16, 1.0, smoothstep(0.20, 0.66, abs(viewV.y)));
            /* Physically smooth wave-slope specular catch driven strictly by Nw & sl (never cellular caustVal!) */
            float slopeCatch = smoothstep(0.06, 0.58, length(sl) * 3.2) * (0.45 + 0.55 * smoothstep(-0.25, 0.35, dot(sl, normalize(viewV.xz + vec2(1e-4)))));
            float waveCatch = mix(0.22, 0.92, slopeCatch);

            float riverDist = (outDist <= 0.0005) ? stCRDist0 : (1.0 - clamp(ws.z, 0.0, 1.0)) * 0.24;
            float inRiverZone = (1.0 - stLakeN * 0.80) * smoothstep(0.12, 0.58, stWmSafe);
            float coreRefl = exp(-riverDist * riverDist * 135.0);
            float softPool = exp(-riverDist * riverDist * 22.0);
            float pulseTravel = 0.74 + 0.26 * sin(dot(wp, flowDir) * 3.8 - uTime * max(0.2, uCurtainLogo.z) * 5.5);
            float rivGlow = (coreRefl * (0.28 + 0.52 * waveCatch) + softPool * 0.14) * inRiverZone * pulseTravel;

            float logoBounce = 0.0;
            float logoSpecBounce = 0.0;
            if (uCurtainLogo.x > 0.5) {
              vec2 lRel = toLogo + sl * 0.19 - viewV.xz*logoRad*.10;
              float lrN = length(lRel) / logoRad;
              float logoSubPool = exp(-lrN * lrN * 1.32) * 0.26;
              float logoRingRefl = exp(-pow((lrN - 0.92) / 0.24, 2.0)) * (0.35 + 0.39 * waveCatch);
              float rRate = max(0.09, uCurtainLogo.z * 0.38);
              float rPh = fract(uTime * rRate);
              float ripR = 0.68 + rPh * 1.08;
              float ripGlow = exp(-pow((lrN - ripR) / 0.12, 2.0)) * (1.0 - rPh) * (0.12 + 0.22 * waveCatch);
              float lGate = smoothstep(0.18, 0.78, stLakeN) * smoothstep(0.55, 0.98, uCurtainLogo.w);
              logoBounce = (logoSubPool + logoRingRefl * 0.65 + ripGlow) * lGate;
              logoSpecBounce = (logoRingRefl * 0.52 + ripGlow * 0.45) * lGate;
            }

            float reflectedInRiver=mix(1.0,0.39,exposedBed)*mix(1.0,0.37,creekMix);
            vec3 iceScatter = uCurtainCol * (rivGlow * 0.40 * reflectedInRiver + logoBounce * 0.70);
            vec3 iceSpecular = uCurtainContact * (coreRefl * inRiverZone * waveCatch * 0.26 * reflectedInRiver + logoSpecBounce * 0.36) * (0.45 + 0.55 * fres);
            wc += (iceScatter + iceSpecular) * cg * grazingCap;
          }

          /* --- 2E. Silky World-Advected Downstream Current Shimmer & Whisper-Thin Shore Ripples (ZERO bend seams!) --- */
          vec2 streakUv1 = (wp - o1A * 1.45) * 4.80 + vec2(0.11, 0.37);
          vec2 streakUv2 = (wp - o2A * 1.45) * 4.80 + vec2(0.61, 0.83);
          vec2 threads=texture2D(tWaterNrm,streakUv1).ba*b1+texture2D(tWaterNrm,streakUv2).ba*b2;
          float threadVal=threads.y;
          float riverThreads = smoothstep(0.60, 0.90, threadVal) * (1.0 - stLakeN) * flowSpd * smoothstep(0.08, 0.42, shoreDist);
          wc += vec3(0.46, 0.62, 0.82) * riverThreads * 0.16 * grazeAA * mix(1.0,.55,headwaterMix);

          /* Delicate flow-advected rapid sheen strictly on sunlit river wave crests + whisper-thin shore lap */
          float narrowRapid = (1.0 - stLakeN) * smoothstep(0.48, 0.94, flowSpd) * (1.0 - smoothstep(0.10, 0.44, wDepth));
          float rapidStreak = smoothstep(0.68, 0.94, threadVal * 0.60 + rivSwell * 0.50) * narrowRapid * 0.18;
          float shoreLap = smoothstep(0.0, 0.04, shoreDist) * (1.0 - smoothstep(0.04, 0.14, shoreDist + (rivFoamN - 0.5) * 0.08));
          shoreLap *= smoothstep(0.56, 0.88, rivSwell) * 0.10;
          // The pockets of whitewater stay in shallow reaches while finer
          // streaks continue downstream with the two wave phases.
          float foam=0.0;
          if(uWhitewater>0.002 && stLakeN<0.70) {
            float rifflePatch=forestNoise(wp*4.1+vec2(-2.8,3.6));
            float riffle=smoothstep(0.43,0.74,rifflePatch)*smoothstep(0.045,0.15,wDepth)*
                         (1.0-smoothstep(0.34,0.60,wDepth));
            float aerated=threads.x*0.54+threadVal*0.33+rivFoamN*0.34+(bedRelief-0.5)*0.15;
            float filterWidth=min(.12,fwidth(aerated)*.75);
            float foamCrest=smoothstep(0.34-filterWidth,0.76+filterWidth,aerated);
            float gravelLip=smoothstep(0.53,0.77,bedRelief)*smoothstep(0.035,0.13,wDepth);
            float whiteReach=max(bedSill*0.93,bedGrade*(0.28+0.65*gravelLip))*
                             (1.0-smoothstep(0.19,0.46,wDepth));
            // Pool surfaces stay open. Broken downstream streaks form where
            // water spills over a shallow sill or a ridge of submerged gravel.
            float lace=smoothstep(0.41,0.74,threads.x*0.58+threadVal*0.39+rivCaust*0.29);
            float creekFoam=(0.15*riffle+whiteReach)*mix(foamCrest,lace,0.72);
            foam=mix(riffle*foamCrest*0.49,creekFoam,creekMix)*
                 smoothstep(0.37,0.85,stWmSafe)*(1.0-stLakeN);
            foam*=uWhitewater*(0.70+0.30*sunVis);
          }
          float froth=(rapidStreak+shoreLap+foam)*mix(1.0,.48,headwaterMix);
          wc=mix(wc,vec3(.76,.87,.93),min(.76,froth/(1.0+.28*froth)));

          wc = wc / (1.0 + wc * 0.14);
          col = mix(col, wc, waterBlend * clamp(stAmt, 0.0, 1.0));
        }

        // Screen-space antialiasing keeps real elevation contours hairline-thin.
        // Dense cliff contours fade before they turn into moire or white bands.
        if (uContours > 0.001 && landM > 0.01) {
          float h=(vForestWorld.y-0.105)/max(uContourInterval,0.025);
          float fw=max(fwidth(h),0.0001);
          float line=1.0-smoothstep(fw*0.25,fw*1.15,abs(fract(h+0.5)-0.5));
          float indexLine=1.0-step(0.5,mod(floor(h+0.5),4.0));
          float contourA=line*uContours*mix(0.30,0.80,indexLine)*(1.0-smoothstep(0.18,0.55,fw));
          contourA*=smoothstep(0.025,0.08,vForestWorld.y-0.105)*landM;
          contourA*=mix(1.0,0.22,smoothstep(0.12,0.85,stBranch));
          col=mix(col,vec3(0.52,0.59,0.55),contourA);
        }

        /* -------------------- PART 3: COOL CANYON AERIAL PERSPECTIVE -------------------- */
        if (uStudioMist > 0.002) {
          float camD = length(cameraPosition - vForestWorld);
          float obliqueFactor = 1.0 - smoothstep(0.52, 0.96, abs(viewV.y));
          float outerRidge=smoothstep(.65,5.9,outDist);
          float farA=smoothstep(uDist*mix(.61,.52,outerRidge),uDist*mix(2.35,1.82,outerRidge),camD);
          float sunSide = pow(max(dot(-viewV, sunNS), 0.0), 2.0);
          /* Cool steel-periwinkle canyon haze warming cleanly to silvery-white toward the sun! */
          vec3 airCol = mix(vec3(0.32, 0.44, 0.62), vec3(0.86, 0.90, 0.95), sunSide * 0.60);
          float ridgeAir=outerRidge*obliqueFactor*exp(-max(0.0,vForestWorld.y-.105)*.32);
          airCol=mix(airCol,vec3(.42,.52,.65),ridgeAir*.30);
          airCol=mix(airCol,vec3(.86,.90,.94),uAirWhite);   /* 2026-11-21 \u9060\u666F\u9727\u767D\u5EA6 (0 = as before) */
          float mistAmt=clamp(farA*((.28+.66*obliqueFactor)*.64+.17*ridgeAir)*uStudioMist,0.0,.74);
          col = mix(col, airCol, mistAmt);
        }

        col = stValleyAir(col, vForestWorld, cameraPosition);

        }
      }
    `,waterExpandReplace=`
      float stOut0 = forestOut(uvR);
      float stBranch = uTributaries > 0.5 && stOut0 < 0.0005 ? wt.a : 0.0;
      vec3 stLB0 = (stOut0 <= 0.0005 && uPbrTerrainOn > 0.001) ? stCentralLakeBasin(vForestWorld.xz) : vec3(0.0);
      vec2 stCRFlow = vec2(0.0);
      float stCRDist0 = 9.0;
      vec3 stCR0 = (stOut0 <= 0.0005 && uPbrTerrainOn > 0.001) ? stCoreRiversEx(vForestWorld.xz, stCRFlow, stCRDist0) : vec3(0.0);
      float wm = max(max(wt.r, stLB0.x), stCR0.x);
      float shore = max(max(wt.g, stLB0.z * 0.94 * smoothstep(0.05, 0.35, stLB0.x)), stCR0.z * 0.58 * smoothstep(0.05, 0.35, stCR0.x));
      float lakeN = max(stBranch > 0.001 ? 0.0 : wt.b, smoothstep(0.05, 0.42, stLB0.x));
    `,flowReplace=`
      vec2 F=fl.rg*2.-1.;
      if (stCR0.x > 0.05 && length(F) < 0.22 && length(stCRFlow) > 0.01) {
        F = mix(F, stCRFlow * 0.72, smoothstep(0.05, 0.40, stCR0.x));
      }
    `;document.documentElement.hasAttribute("data-rise-studio-pbr")&&(mat.fragmentShader=mat.fragmentShader.replace(/if\(landOn>\.001\)\{[\s\S]*?col\*=mix\(1\.,\.62\+\.62\*litG,\.6\*landK\*uLandB\.y\);\r?\n\s*\}/,"")),mat.fragmentShader=mat.fragmentShader.replace("void main(){",decls+`
void main(){`).replace("vec3 wt=texture2D(tWater,uv).rgb;","vec4 wt=texture2D(tWater,uv);").replace("float wm=wt.r, shore=wt.g, lakeN=wt.b;",waterExpandReplace).replace("vec2 F=fl.rg*2.-1.;",flowReplace).replace("float cshadow=smoothstep(.48,.78,forestFbm(vForestWorld.xz*.34+vec2(uTime*.004,-uTime*.002)));","float cshadow=uCloud>.001?smoothstep(.48,.78,forestFbm(vForestWorld.xz*.34+vec2(uTime*.004,-uTime*.002))):0.;").replace("col=forestHaze(col,vForestWorld);",inject+`
col=forestHaze(col,vForestWorld);
col=stArrivalColor(col,vForestWorld.xz,vStArrival);`).replace("gl_FragColor=vec4(col,1.);",`
        // Feather each side before the last row of the 11.5-unit skirt.
        // Evaluate the sky on this exact camera ray, after all land grading.
        vec2 past=max(max(-uvR,uvR-1.0),0.0)/uBounds.zw;
        float rim=max(past.x,past.y);
        if(rim>3.0 && uPbrTerrainOn>0.5) {
          float weather=forestNoise(vForestWorld.xz*0.41)*0.90-0.45;
          float edge=smoothstep(3.65,10.1,rim+weather);
          vec3 ray=normalize(vForestWorld-cameraPosition);
          col=mix(col,stAlpineSky(ray,uPbrStyle,uCloudLayer,uArrival),edge);
        }
        // The brush compositor reads the survey ink from alpha. RGB stays fully shaded.
        float surveyInk = 0.0;
        if (uEntrySurvey > 0.5) {
          float h = (vForestWorld.y - 0.105) / max(uContourInterval, 0.075);
          float aa = max(fwidth(h), 0.0001);
          float indexLine = 1.0 - step(0.5, mod(floor(h + 0.5), 4.0));
          float contour = 1.0 - smoothstep(aa * 0.22, aa * mix(1.08, 1.65, indexLine), abs(fract(h + 0.5) - 0.5));
          float reach = 1.0 - smoothstep(0.17, 0.58, aa);
          float land = (1.0 - smoothstep(0.30, 0.71, wm)) * smoothstep(0.025, 0.095, vForestWorld.y - 0.105);
          surveyInk = contour * reach * land * mix(0.51, 0.90, indexLine);
          surveyInk *= 1.0 - smoothstep(3.0, 8.2, rim);
        }
        gl_FragColor=vec4(col,1.0-surveyInk);`),mat.needsUpdate=!0,patched=!0}),patched}function patchWaterSurfaceMaterial(atlas,shoreAlb,studioUniforms){let patched=!1;const seen=new Set;return atlas.scene.traverse(obj=>{if(!obj.isMesh||!obj.material||seen.has(obj.material))return;seen.add(obj.material);const mat=obj.material;if(!mat.fragmentShader||!mat.fragmentShader.includes("vW1World")||!mat.fragmentShader.includes("vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;")||mat.fragmentShader.includes("tPbrRiverBed"))return;Object.assign(mat.uniforms,{tPbrRiverBed:{value:shoreAlb},uPbrStyle:studioUniforms.uPbrStyle,uPbrTerrainOn:studioUniforms.uPbrTerrainOn,uTributaries:studioUniforms.uTributaries,uCloudStrength:studioUniforms.uCloudStrength,uBankShadow:studioUniforms.uBankShadow,uMistColor:studioUniforms.uMistColor,uValleyMist:studioUniforms.uValleyMist,uMistHeight:studioUniforms.uMistHeight});const wDecls=`
      uniform sampler2D tPbrRiverBed;
      uniform float uPbrStyle, uPbrTerrainOn, uTributaries;
      float forestHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float forestNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(forestHash(i),forestHash(i+vec2(1.0,0.0)),f.x),mix(forestHash(i+vec2(0.0,1.0)),forestHash(i+vec2(1.0)),f.x),f.y);
      }
      float stFbm2(vec2 p) {
        return forestNoise(p)*0.67+forestNoise(mat2(0.80,-0.60,0.60,0.80)*p*2.04+vec2(7.3,4.1))*0.33;
      }
      ${HIGHLAND_GLSL}
      ${SHORE_ATLAS_GLSL}
      float stWLakeR(vec2 p) {
        vec2 q = (p - vec2(0.122, -0.056)) / vec2(1.66, 1.42);
        float r = length(q);
        float ang = atan(q.y, q.x);
        return r + 0.085 * sin(ang * 3.0 + 0.7) + 0.055 * cos(ang * 5.0 - 1.2) + 0.035 * sin(ang * 7.0 + 2.4);
      }
      vec3 stWCentralLake(vec2 p) {
        float lr = stWLakeR(p);
        return vec3(1.0 - smoothstep(0.86, 1.00, lr), 0.0, 1.0 - smoothstep(0.0, 1.02, lr));
      }
    `,wMaskReplace=`
      vec3 stLBw = (uPbrTerrainOn > 0.001) ? stWCentralLake(wq) : vec3(0.0);
      // This optional plane is at the lake datum. Let the conforming terrain
      // water shade elevated branches and fade the plane back in at the mouth.
      float raised=smoothstep(0.006,0.056,wt.b)*smoothstep(0.75,0.99,wt.a)*uTributaries;
      float wm=wt.r*(1.0-raised*(1.0-stLBw.x));
      float shore=max(wt.g, stLBw.z * 0.94 * smoothstep(0.05, 0.35, stLBw.x));
      float lakeN=max(uTributaries>0.5 && wt.a>0.005 ? 0.0 : wt.b, smoothstep(0.05, 0.42, stLBw.x));
      float sh2=shore*shore, shoreN=clamp(sh2*4.,0.,1.);
      float body=smoothstep(.2,.7,wm), rim=smoothstep(.02,.3,wm)*(1.-body)*uW1B.z*(1.0 - smoothstep(0.10, 0.45, stLBw.x));
    `,wBedReplace=`
      vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;
      if (uPbrTerrainOn > 0.001) {
        float wBedAmt = clamp(uPbrStyle, 0.0, 1.0) * uPbrTerrainOn;
        vec3 cobbleBed=stMaterialTile(tPbrRiverBed,stGravelUV(wq+sl*0.026),1.0).rgb;
        float shallW = 1.0 - smoothstep(0.02, 0.54, sh2);
        vec3 alpineBed = mix(vec3(0.07, 0.18, 0.26), cobbleBed * vec3(0.62, 0.92, 1.02), 0.84);
        bed = mix(bed, alpineBed, wBedAmt * (0.58 + 0.42 * shallW));
      }
    `;mat.fragmentShader=mat.fragmentShader.replace("void main(){",wDecls+`
void main(){`).replace("*uRvSun*(1.-shade)","*uRvSun*stCloudVisibility(wq)*(1.-shade)").replace("bodyC*=1.+clamp(dot(-ws,normalize(uSun.xz))*1.6*uW1A.z,-.25,.3);","bodyC*=1.+clamp(dot(-ws,normalize(uSun.xz))*1.6*uW1A.z,-.25,.3)*stCloudVisibility(wq);").replace("col=forestHaze(col,vW1World);","col=forestHaze(col,vW1World); col=stValleyAir(col,vW1World,cameraPosition);").replace("vec3 wt=texture2D(tWater,uv).rgb;","vec4 wt=texture2D(tWater,uv);").replace(/float wm=wt\.r, shore=wt\.g, lakeN=wt\.b, sh2=shore\*shore, shoreN=clamp\(sh2\*4\.,0\.,1\.\);\r?\n\s*float body=smoothstep\(\.2,\.7,wm\), rim=smoothstep\(\.02,\.3,wm\)\*\(1\.-body\)\*uW1B\.z;/,wMaskReplace).replace("vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;",wBedReplace),mat.needsUpdate=!0,patched=!0}),patched}function buildSunbeamGroup(atlas,studioUniforms){const specs=[{ox:3,oz:-2.2,w:6.4,h:10.2,rotY:0,intensity:1,seed:1.1},{ox:-1.2,oz:-1.8,w:5.8,h:9.6,rotY:.28,intensity:.85,seed:2.7},{ox:4.8,oz:1,w:6,h:9.2,rotY:-.24,intensity:.82,seed:4.3},{ox:.6,oz:.2,w:7,h:10.6,rotY:.52,intensity:.78,seed:6.1},{ox:-3.6,oz:1.4,w:5.2,h:8.8,rotY:-.45,intensity:.68,seed:8.5},{ox:2,oz:-3.5,w:6.2,h:9.8,rotY:.85,intensity:.8,seed:10.2}],pos=[],uvs=[],nrm=[],rays=[],idx=[];let vBase=0;for(const s of specs)for(let k=0;k<2;k++){const ang=s.rotY+k*(Math.PI*.5),ca=Math.cos(ang),sa=Math.sin(ang),hw=s.w*.5,nx=-sa,nz=ca,corners=[[-hw,0,0,0],[hw,0,1,0],[-hw,s.h,0,1],[hw,s.h,1,1]];for(const[lx,ly,u,v]of corners)pos.push(lx*ca+s.ox,ly,lx*sa+s.oz),uvs.push(u,v),nrm.push(nx,0,nz),rays.push(s.seed+k*.37,s.intensity,s.w,k);idx.push(vBase,vBase+1,vBase+2,vBase+1,vBase+3,vBase+2),vBase+=4}const geo=new THREE.BufferGeometry;geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)),geo.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2)),geo.setAttribute("normal",new THREE.Float32BufferAttribute(nrm,3)),geo.setAttribute("aRay",new THREE.Float32BufferAttribute(rays,4)),geo.setIndex(idx);const mat=new THREE.ShaderMaterial({uniforms:{uTime:atlas.uniforms.uTime,uRayStrength:studioUniforms.uSunRays,uSunIntensity:studioUniforms.uSunIntensity,uLattice:atlas.uniforms.uLattice||{value:0}},vertexShader:SUNBEAM_VERT,fragmentShader:SUNBEAM_FRAG,transparent:!0,depthWrite:!1,depthTest:!0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:!1}),mesh=new THREE.Mesh(geo,mat);mesh.name="Studio Alpine Sunlight Shafts",mesh.frustumCulled=!1,mesh.renderOrder=16;const pivot=new THREE.Group;pivot.name="Studio Sunbeam Pivot",pivot.position.set(0,.12,0),pivot.add(mesh);const up=new THREE.Vector3(0,1,0);function alignToSun(sunVec){pivot.quaternion.setFromUnitVectors(up,sunVec)}return{group:pivot,mesh,mat,alignToSun}}export async function createStudioTerrainPbrLayer(renderer,atlas,initialConfig={}){const cfg={...DEFAULT_PBR_CONFIG,...initialConfig,layers:{...DEFAULT_PBR_CONFIG.layers,...initialConfig.layers||{}}},arrivalPacked=packArrivalField(atlas);atlas.trees&&(atlas.trees.visible=!1,atlas.trees.children.forEach(m=>{m.visible=!1}));const baseUrl=name=>new URL("./"+name+"?v="+(name.includes("-shore")?SHORE_VER:PBR_VER),import.meta.url).href,texLoader=new THREE.TextureLoader,maxAniso=Math.min(8,renderer.capabilities.getMaxAnisotropy()),PERF_ON=new URLSearchParams(location.search).get("perf")!=="0"&&document.documentElement.hasAttribute("data-rise-studio-pbr")&&typeof createImageBitmap=="function",perfHalf=PERF_ON&&new URLSearchParams(location.search).get("perfTiles")!=="full"&&(q=>!!q&&(q.start==="medium"||q.start==="low"))(window.__FLOW2_QUALITY__),perfState=window.__RISE_PERF_TILES__={on:PERF_ON,half:perfHalf,decoded:0,fallback:0,initMs:[]},perfFrame=()=>new Promise(done=>{let over=!1;const go=()=>{over||(over=!0,done())};requestAnimationFrame(go),setTimeout(go,120)});let perfChain=Promise.resolve();const loadTexDecoded=async(name,{srgb=!1,mips=!0,repeat=!0,url:urlT="",tiered=!1}={})=>{const response=await fetch(urlT||baseUrl(name));if(!response.ok)throw new Error(name+" "+response.status);const options={premultiplyAlpha:"none",colorSpaceConversion:"none"};let bitmap=await createImageBitmap(await response.blob(),options);if(perfHalf&&!tiered&&bitmap.width>1024){const half=await createImageBitmap(bitmap,{...options,resizeWidth:bitmap.width>>1,resizeHeight:bitmap.height>>1,resizeQuality:"high"});bitmap.close(),bitmap=half}const tex=new THREE.Texture(bitmap);return tex.flipY=!1,tex.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace,tex.generateMipmaps=mips,tex.minFilter=mips?THREE.LinearMipmapLinearFilter:THREE.LinearFilter,tex.magFilter=THREE.LinearFilter,tex.wrapS=tex.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping,mips&&(tex.anisotropy=maxAniso),tex.userData.flow2Strips=!0,tex.needsUpdate=!0,perfState.decoded++,perfChain=perfChain.then(perfFrame).then(()=>{const t0=performance.now();try{renderer.initTexture?.(tex)}catch{}perfState.initMs.push(+(performance.now()-t0).toFixed(1))}),await perfChain,tex},loadTexPerf=(name,options)=>PERF_ON?loadTexDecoded(name,options).catch(error=>(perfState.fallback++,perfState.error=String(error?.message||error),loadTexImage(name,options))):loadTexImage(name,options),pageQuery=new URLSearchParams(location.search),KTX2_VER="ktx2-20261121-1",ktx2Phone=(()=>{try{return matchMedia("(pointer: coarse)").matches&&Math.min(innerWidth,innerHeight)<900}catch{return!1}})(),optT=PERF_ON&&pageQuery.get("optT")!=="0",texFmt=pageQuery.get("texFmt"),tierT=(()=>{const tt=window.__FLOW2_TEX_TIER__;if(tt&&(tt.tier==="medium"||tt.tier==="low"))return tt.tier;const q=window.__FLOW2_QUALITY__;return q&&(q.start==="medium"||q.start==="low")?q.start:ktx2Phone?"phone":"high"})(),T_HIGH_HALF=pageQuery.has("tHigh")?pageQuery.get("tHigh")==="half":!0,scaleT=!optT||pageQuery.get("perfTiles")==="full"?1:tierT==="high"?T_HIGH_HALF?.5:1:window.__FLOW2_TEX_TIER__&&window.__FLOW2_TEX_TIER__.tier==="low"?.25:.5,ktx2Want=PERF_ON&&pageQuery.get("ktx2")!=="0"&&!(optT&&texFmt==="webp")&&(pageQuery.get("ktx2")==="1"||optT&&/^ktx2[ue]?$/.test(texFmt||"")||ktx2Phone||(q=>!!q&&(q.start==="medium"||q.start==="low"))(window.__FLOW2_QUALITY__)),ktx2State=perfState.ktx2={want:ktx2Want,phone:ktx2Phone,loaded:0,fallback:0,formats:{},bytesGPU:0},ktx2Loader=ktx2Want?import("three/addons/loaders/KTX2Loader.js").then(module=>{const loader=new module.KTX2Loader().setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/basis/").detectSupport(renderer),c=loader.workerConfig||{};if(!(c.astcSupported||c.bptcSupported||c.etc2Supported))throw new Error("no ASTC / BC7 / ETC2 on this GPU");return loader}):null;ktx2Loader?.catch(error=>{ktx2State.error=String(error?.message||error)});const loadTexKtx2=async(name,{srgb=!1,mips=!0,repeat=!0,url:urlT=""}={})=>{const tex=await(await ktx2Loader).loadAsync(urlT||new URL("./ktx2/"+name.replace(/.webp$/,".ktx2")+"?v="+KTX2_VER,import.meta.url).href);if(!tex||!tex.isCompressedTexture||!(tex.mipmaps&&tex.mipmaps.length>1))throw tex?.dispose?.(),new Error(name+": not a compressed picture with mip-maps");tex.flipY=!1,tex.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace,tex.generateMipmaps=!1,tex.minFilter=mips?THREE.LinearMipmapLinearFilter:THREE.LinearFilter,tex.magFilter=THREE.LinearFilter,tex.wrapS=tex.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping,mips&&(tex.anisotropy=maxAniso),tex.needsUpdate=!0,ktx2State.loaded++,ktx2State.formats[tex.format]=(ktx2State.formats[tex.format]||0)+1;for(const level of tex.mipmaps)ktx2State.bytesGPU+=level.data?level.data.byteLength:0;return perfChain=perfChain.then(perfFrame).then(()=>{const t0=performance.now();try{renderer.initTexture?.(tex)}catch{}perfState.initMs.push(+(performance.now()-t0).toFixed(1))}),await perfChain,tex},loadTexOlder=(name,options)=>ktx2Want?loadTexKtx2(name,options).catch(error=>(ktx2State.fallback++,ktx2State.lastError=String(error?.message||error),loadTexPerf(name,options))):loadTexPerf(name,options),T_VER="tiers-20261121-1",T_COLOUR_MODE="-u",T_FULL_W={"pbr-sward-relief":1536,"pbr-basalt-shore":1536,"pbr-rock-shore-detail":1536,"pbr-water-nrm":1024},tState=perfState.t={on:optT,tier:tierT,scale:scaleT,fmt:texFmt||"auto",ktx2:0,webp:0,older:0,files:[]},loadTex=(name,options)=>{if(!optT||scaleT===1&&!/^ktx2[ue]?$/.test(texFmt||""))return loadTexOlder(name,options);const base=name.replace(/\.webp$/,""),w=Math.max(256,Math.round((T_FULL_W[base]||2048)*scaleT)),url=(suffix,ext)=>new URL("./tiers/"+base+"-"+w+suffix+"."+ext+"?v="+T_VER,import.meta.url).href,webp=()=>{const u=scaleT===1?baseUrl(name):url("","webp");return loadTexPerf(name,{...options,url:u,tiered:scaleT<1}).then(tx=>(tState.webp++,tState.files.push(u.replace(/^.*\/studio\//,"").replace(/\?.*/,"")),tx))},mode=options&&options.srgb?texFmt==="ktx2u"?"-u":texFmt==="ktx2e"?"-e":T_COLOUR_MODE:"-u";return(ktx2Want?loadTexKtx2(name,{...options,url:url(mode,"ktx2")}).then(tx=>(tState.ktx2++,tState.files.push(base+"-"+w+mode+".ktx2"),tx)):Promise.reject(new Error("no ktx2"))).catch(error=>(ktx2Want&&(ktx2State.fallback++,ktx2State.lastError=String(error?.message||error)),webp())).catch(error=>(tState.older++,tState.lastError=String(error?.message||error),loadTexOlder(name,options)))},loadTexImage=(name,{srgb=!1,mips=!0,repeat=!0}={})=>new Promise((resolve,reject)=>{texLoader.load(baseUrl(name),tex=>{tex.flipY=!1,tex.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace,tex.generateMipmaps=mips,tex.minFilter=mips?THREE.LinearMipmapLinearFilter:THREE.LinearFilter,tex.magFilter=THREE.LinearFilter,tex.wrapS=tex.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping,mips&&(tex.anisotropy=maxAniso),resolve(tex)},void 0,reject)}),[grassAlb,grassWildAlb,mossAlb,heathAlb,grassNrm,grassNrm2,rockAlb,rockBasaltAlb,rockMossAlb,rockNrm,rockNrm2,waterNrm]=await Promise.all([loadTex("pbr-sward-relief.webp",{mips:!0,repeat:!0}),loadTex("pbr-grass-wild.webp",{srgb:!0,mips:!0,repeat:!0}),loadTex("pbr-moss-albedo.webp",{srgb:!0,mips:!0,repeat:!0}),loadTex("pbr-heath-scree.webp",{srgb:!0,mips:!0,repeat:!0}),loadTex("pbr-grass-nrm.webp",{srgb:!1,mips:!0,repeat:!0}),loadTex("pbr-grass-nrm2.webp",{srgb:!1,mips:!0,repeat:!0}),loadTex("pbr-rock-albedo.webp",{srgb:!0,mips:!0,repeat:!0}),loadTex("pbr-basalt-shore.webp",{srgb:!0,mips:!0,repeat:!1}),loadTex("pbr-rock-mossy.webp",{srgb:!0,mips:!0,repeat:!0}),loadTex("pbr-rock-nrm.webp",{srgb:!1,mips:!0,repeat:!0}),loadTex("pbr-rock-shore-detail.webp",{srgb:!1,mips:!0,repeat:!1}),loadTex("pbr-water-nrm.webp",{srgb:!1,mips:!0,repeat:!0})]);atlas.scene.background=new THREE.Color(1319992);const origSun=atlas.uniforms.uSun.value.clone(),liveSun=sunVecFromAngles(cfg.sunAzimuth,cfg.sunElevation);atlas.uniforms.uSun.value.copy(liveSun);const studioUniforms={uPbrStyle:{value:cfg.style},uPbrTerrainOn:{value:cfg.layers.terrainStyle?1:0},uGrassPbr:{value:cfg.grassPbr},uGrassSat:{value:cfg.grassSat},uMeadowBase:{value:new THREE.Color(cfg.grassColor)},uMeadowTips:{value:new THREE.Color(cfg.grassTipColor)},uMeadowMoss:{value:new THREE.Color(cfg.grassMossColor)},uMeadowDry:{value:new THREE.Color(cfg.grassDryColor)},uMeadowLayerCover:{value:new THREE.Vector3},uRockBaseGain:{value:new THREE.Color(1,1,1)},uRockLayerGain:{value:new THREE.Color(1,1,1)},uGrassCover:{value:cfg.grassCoverage/100},uRockSlope:{value:cfg.rockSlope},uShoreWet:{value:cfg.shoreWet},uSunIntensity:{value:cfg.sunIntensity},uSunShadow:{value:cfg.sunShadow},uSunRays:{value:cfg.sunRays},uStudioMist:{value:cfg.mist},uBiomeContrast:{value:cfg.biomeContrast},uCavityDepth:{value:cfg.cavityDepth},uStrataStrength:{value:cfg.strataStrength},uCloudLayer:{value:cfg.layers.clouds?1:0},uCloudStrength:{value:cfg.cloudStrength},uBankShadow:{value:new THREE.Vector4(0,1,0,0)},uAirWhite:{value:0},uMistColor:{value:new THREE.Color(cfg.mistColor||"#a8b8c7")},uValleyMist:{value:cfg.valleyMist},uMistHeight:{value:cfg.mistHeight},uArrival:{value:1},uArrivalMap:{value:arrivalPacked?1:0},uTributaries:{value:atlas.studioHydrology?1:0},uTributaryTexel:{value:atlas.studioHydrology?.texel||new THREE.Vector2(1/1494,1/836)},uContours:{value:cfg.contourOpacity},uContourInterval:{value:cfg.contourInterval},uEntrySurvey:{value:0},uWaterDeep:{value:new THREE.Color(cfg.waterDeep)},uWaterShallow:{value:new THREE.Color(cfg.waterShallow)},uWaterSpeed:{value:cfg.waterSpeed},uWaterWave:{value:cfg.waterWave},uWaterClear:{value:cfg.waterClear},uWhitewater:{value:cfg.whitewater},uWaterGlow:{value:cfg.waterGlow},uWaterOn:{value:cfg.layers.water?1:0},uCurtainGlow:{value:.78},uCurtainCol:{value:new THREE.Color("#88ccf8")},uCurtainContact:{value:new THREE.Color("#d9f2ff")},uCurtainLogo:{value:new THREE.Vector4(1,1.4,.28,1)}},terrainPatched=patchTerrainAndWater(atlas,{grassAlb,grassWildAlb,mossAlb,heathAlb,grassNrm,grassNrm2,rockAlb,rockBasaltAlb,rockMossAlb,rockNrm,rockNrm2,waterNrm},studioUniforms),waterPatched=patchWaterSurfaceMaterial(atlas,rockBasaltAlb,studioUniforms),cobbles=createShoreCobbles(atlas,studioUniforms,rockBasaltAlb,REFINE_HEADWATERS?headwaterStones(atlas.uniforms.uBounds.value):[]);atlas.scene.add(cobbles);const skyDomeGeo=new THREE.SphereGeometry(185,32,20),skyDomeMat=new THREE.ShaderMaterial({uniforms:{uSun:atlas.uniforms.uSun,uTime:atlas.uniforms.uTime,uSunIntensity:studioUniforms.uSunIntensity,uLattice:atlas.uniforms.uLattice||{value:0},uStyle:studioUniforms.uPbrStyle,uCloudLayer:studioUniforms.uCloudLayer,uArrival:studioUniforms.uArrival},vertexShader:SKY_DOME_VERT,fragmentShader:SKY_DOME_FRAG,side:THREE.BackSide,depthWrite:!1,depthTest:!0,toneMapped:!1}),skyDome=new THREE.Mesh(skyDomeGeo,skyDomeMat);skyDomeMat.userData.handlesArrival=!0,skyDome.name="Studio Alpine Sky Dome",skyDome.frustumCulled=!1,skyDome.renderOrder=-10,atlas.scene.add(skyDome);const sunbeams=buildSunbeamGroup(atlas,studioUniforms);sunbeams.alignToSun(liveSun),atlas.scene.add(sunbeams.group);const mistGroup=createStudioClouds(atlas,studioUniforms);atlas.scene.add(mistGroup);const origTune={relief:atlas.tune.relief,land:atlas.tune.land,rvDeep:atlas.tune.rvDeep,rvShallow:atlas.tune.rvShallow,rvSky:atlas.tune.rvSky,rvClear:atlas.tune.rvClear};let linkedCurtain=null;function syncCurtain(){if(!linkedCurtain)return;const cc=linkedCurtain.config,on=cc.enabled?1:0;studioUniforms.uCurtainGlow.value=on*Math.max(0,+cc.brightness||0),studioUniforms.uCurtainCol.value.set(cc.color||"#88ccf8"),studioUniforms.uCurtainContact.value.set(cc.contactColor||"#d9f2ff"),studioUniforms.uCurtainLogo.value.set(cc.showLogo?1:0,Math.max(.2,+cc.logoScale||1.4),Math.max(0,+cc.speed||.28),Math.max(0,Math.min(1,+cc.progress)))}function bindCurtain(curtainApi){linkedCurtain=curtainApi||null,syncCurtain()}function inverseSwatch(hex){const c=new THREE.Color(hex);return c.setRGB(1/c.r,1/c.g,1/c.b)}const baseReference=inverseSwatch(DEFAULT_PBR_CONFIG.rockColor),layerReference=inverseSwatch(DEFAULT_PBR_CONFIG.rockLayerColor);function apply(){const s=Math.max(0,Math.min(1.25,cfg.style)),lerpHex=(aHex,bHex,t)=>"#"+new THREE.Color(aHex).lerp(new THREE.Color(bHex),Math.max(0,Math.min(1,t))).getHexString();sunVecFromAngles(cfg.sunAzimuth,cfg.sunElevation,liveSun),atlas.uniforms.uSun.value.copy(origSun).lerp(liveSun,Math.min(1,s)).normalize(),sunbeams.alignToSun(atlas.uniforms.uSun.value),studioUniforms.uPbrStyle.value=s,studioUniforms.uPbrTerrainOn.value=cfg.layers.terrainStyle?1:0,studioUniforms.uGrassPbr.value=Math.max(0,Math.min(1.6,+cfg.grassPbr||0)),studioUniforms.uGrassSat.value=Math.max(.2,Math.min(2,+cfg.grassSat||1)),studioUniforms.uMeadowBase.value.set(cfg.grassColor),studioUniforms.uMeadowTips.value.set(cfg.grassTipColor),studioUniforms.uMeadowMoss.value.set(cfg.grassMossColor),studioUniforms.uMeadowDry.value.set(cfg.grassDryColor),studioUniforms.uMeadowLayerCover.value.set(cfg.grassMossCoverage,cfg.grassDryCoverage,cfg.grassTipCoverage).multiplyScalar(.01).clampScalar(0,1),studioUniforms.uRockBaseGain.value.set(cfg.rockColor).multiply(baseReference),studioUniforms.uRockLayerGain.value.set(cfg.rockLayerColor).multiply(layerReference),studioUniforms.uGrassCover.value=THREE.MathUtils.clamp(Number(cfg.grassCoverage??DEFAULT_PBR_CONFIG.grassCoverage)/100,0,1),studioUniforms.uRockSlope.value=Math.max(.45,Math.min(.98,+cfg.rockSlope||.86)),studioUniforms.uShoreWet.value=Math.max(0,Math.min(1.8,+cfg.shoreWet||0)),studioUniforms.uSunIntensity.value=Math.max(.2,Math.min(2.2,+cfg.sunIntensity||1.24)),studioUniforms.uSunShadow.value=Math.max(0,Math.min(1.2,+cfg.sunShadow||0)),studioUniforms.uSunRays.value=cfg.layers.sunbeams&&cfg.layers.terrainStyle?Math.max(0,+cfg.sunRays||0):0,studioUniforms.uStudioMist.value=cfg.layers.atmosphere?Math.max(0,+cfg.mist||0):0,studioUniforms.uBiomeContrast.value=THREE.MathUtils.clamp(+cfg.biomeContrast||0,0,1.8),studioUniforms.uCavityDepth.value=THREE.MathUtils.clamp(+cfg.cavityDepth||0,0,1),studioUniforms.uStrataStrength.value=THREE.MathUtils.clamp(+cfg.strataStrength||0,0,1.4),studioUniforms.uCloudLayer.value=cfg.layers.clouds&&cfg.layers.terrainStyle?1:0,studioUniforms.uCloudStrength.value=cfg.layers.terrainStyle?THREE.MathUtils.clamp(+cfg.cloudStrength||0,0,.6):0;{const L=atlas.uniforms.uSun.value;studioUniforms.uBankShadow.value.set(L.x,L.y,L.z,cfg.layers.clouds&&cfg.layers.terrainStyle?THREE.MathUtils.clamp(+cfg.cloudShadow||0,0,1):0)}studioUniforms.uMistColor.value.set(cfg.mistColor||"#a8b8c7"),studioUniforms.uAirWhite.value=THREE.MathUtils.clamp(+cfg.airWhite||0,0,1),studioUniforms.uValleyMist.value=cfg.layers.atmosphere?THREE.MathUtils.clamp(+cfg.valleyMist||0,0,1.2):0,studioUniforms.uMistHeight.value=THREE.MathUtils.clamp(+cfg.mistHeight||.1,.1,1.8),studioUniforms.uTributaries.value=atlas.studioHydrology&&cfg.layers.tributaries&&cfg.layers.terrainStyle?1:0,atlas.studioHydrology?.setEnabled(studioUniforms.uTributaries.value>.5),studioUniforms.uContours.value=cfg.layers.contours?THREE.MathUtils.clamp(+cfg.contourOpacity||0,0,.8):0,studioUniforms.uContourInterval.value=THREE.MathUtils.clamp(+cfg.contourInterval||.105,.04,.22),studioUniforms.uWaterDeep.value.set(cfg.waterDeep||"#071c33"),studioUniforms.uWaterShallow.value.set(cfg.waterShallow||"#217582"),studioUniforms.uWaterSpeed.value=Math.max(0,+cfg.waterSpeed||0),studioUniforms.uWaterWave.value=Math.max(.1,+cfg.waterWave||1),studioUniforms.uWaterClear.value=THREE.MathUtils.clamp(+cfg.waterClear||0,0,1.3),studioUniforms.uWhitewater.value=THREE.MathUtils.clamp(+cfg.whitewater||0,0,1.5),studioUniforms.uWaterGlow.value=Math.max(0,+cfg.waterGlow||0),studioUniforms.uWaterOn.value=cfg.layers.water?1:0,atlas.tune.relief=cfg.relief,atlas.uniforms.uRelief.value=atlas.tune.relief,atlas.uniforms.uCanopy.value=atlas.tune.canopy,atlas.tune.haze=0,atlas.tune.land=cfg.layers.terrainStyle&&s>=.98?0:origTune.land,cfg.layers.water?(atlas.tune.rv=1,atlas.tune.rvDeep=lerpHex(origTune.rvDeep,cfg.waterDeep||"#071c33",s),atlas.tune.rvShallow=lerpHex(origTune.rvShallow,cfg.waterShallow||"#217582",s),atlas.tune.rvSky=lerpHex(origTune.rvSky,"#86a6cd",s),atlas.tune.rvSpeed=Math.max(0,+cfg.waterSpeed||1),atlas.tune.rvWave=Math.max(.1,+cfg.waterWave||1),atlas.tune.rvClear=Math.max(0,Math.min(1.3,cfg.waterClear*Math.min(1,s)+origTune.rvClear*(1-Math.min(1,s))))):atlas.tune.rv=0,atlas.trees&&(atlas.trees.visible=!1),cobbles.visible=!!(cfg.layers.terrainStyle&&s>.01&&cfg.shoreWet>0),skyDome.visible=!!cfg.layers.terrainStyle,sunbeams.group.visible=!!(cfg.layers.sunbeams&&cfg.layers.terrainStyle&&cfg.sunRays>.005),mistGroup.visible=studioUniforms.uCloudLayer.value>0||studioUniforms.uStudioMist.value>.005,syncCurtain()}return apply(),{config:cfg,terrainPatched,lineWatershed:REFINE_HEADWATERS?makeWatershedGlsl:null,waterPatched,skyDome,sunbeams,mistGroup,uniforms:studioUniforms,bindCurtain,syncCurtain,apply,disposeTextures(){for(const tex of[grassAlb,grassWildAlb,mossAlb,heathAlb,grassNrm,grassNrm2,rockAlb,rockBasaltAlb,rockMossAlb,rockNrm,rockNrm2,waterNrm])tex.dispose();arrivalPacked&&atlas.uniforms.tCanopy.value.dispose()},getStats(){return{mode:"pure-pbr-terrain-water",ecology:"height / aspect / finite-difference curvature / moisture",arrival:arrivalPacked?"authored canyon field in height alpha":"procedural fallback",activeTrees:0,activeRocks:cobbles.visible?cobbles.userData.stoneCount:0,tributaries:atlas.studioHydrology?.stats||null,textures:["pbr-sward-relief.webp (1536px Grass004 reflectance, blade height, cavity, roughness)","pbr-grass-wild.webp (SRGB, 2K Pure forrest_ground_01)","pbr-moss-albedo.webp (SRGB, 2K Pure Moss002)","pbr-heath-scree.webp (SRGB, 2K Pure aerial_rocks_04)","pbr-grass-nrm.webp (NoColorSpace, 2K Grass004+Moss002)","pbr-grass-nrm2.webp (NoColorSpace, 2K forrest_ground_01+aerial_rocks_04)","pbr-rock-albedo.webp (SRGB, 2K Pure Rock051)","pbr-basalt-shore.webp (sRGB atlas: Rock035 + Pers Scans shore gravel)","pbr-rock-mossy.webp (SRGB, 2K Pure mossy_rock)","pbr-rock-nrm.webp (NoColorSpace, 2K Rock051)","pbr-rock-shore-detail.webp (linear atlas: basalt/moss normals + gravel relief)","pbr-water-nrm.webp (NoColorSpace, 1K Silky Spectral Water)"]}}}}