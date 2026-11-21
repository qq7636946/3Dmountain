import*as THREE from"three";import{SVGLoader}from"three/addons/loaders/SVGLoader.js";const WATER_Y=.107;export const DEFAULT_CURTAIN_CONFIG={enabled:!0,showTributaries:!0,showLogo:!0,height:.56,speed:.28,brightness:.78,progress:1,scanIntensity:.5,pulseStrength:.9,color:"#88ccf8",contactColor:"#d9f2ff",logoScale:1.4,logoHeight:.42,logoRotation:0};const CURTAIN_VERT=`
  attribute vec4 aPath;    /* x = isTributary (0=main, 1=trib), y = pathSeed, z = heightScale, w = pathWorldLen */
  attribute vec3 aTangent; /* horizontal curve tangent (xz) for clean grazing-angle fade */

  uniform sampler2D tCanopy;
  uniform vec4 uBounds;
  uniform vec2 uYRange;
  uniform float uRelief;
  uniform float uHeight;

  varying vec2 vUv;
  varying vec4 vPath;
  varying vec3 vWorld;
  varying vec3 vRibbonN;

  void main() {
    vec3 baseP = position;
    float isTrib = aPath.x;

    /* Align base vertex smoothly to terrain relief (rivers sit cleanly at WATER_Y; valley tributaries hug tCanopy height!) */
    float groundY = ${WATER_Y.toFixed(4)};
    if (isTrib > 0.5) {
      vec2 fuv = (baseP.xz - uBounds.xy) * uBounds.zw;
      vec2 cfuv = clamp(fuv, 0.002, 0.998);
      float hC = texture2D(tCanopy, cfuv).r;
      float reliefY = 0.105 + (uYRange.x + hC * uYRange.y - 0.105) * uRelief;
      groundY = max(reliefY + 0.005, ${WATER_Y.toFixed(4)});
    }

    /* Extrude cleanly upward along +Y by uHeight * uv.y * per-path height scale */
    float localH = uHeight * aPath.z;
    vec3 worldP = vec3(baseP.x, groundY + uv.y * localH, baseP.z);

    /* Ribbon surface normal perpendicular to curve tangent in XZ */
    vec2 tXZ = normalize(max(abs(aTangent.xz), vec2(1e-5)) * sign(aTangent.xz + vec2(1e-6)));
    vRibbonN = normalize(vec3(-tXZ.y, 0.0, tXZ.x));

    vUv = uv;
    vPath = aPath;
    vWorld = worldP;

    gl_Position = projectionMatrix * viewMatrix * vec4(worldP, 1.0);
  }
`,CURTAIN_FRAG=`
  precision highp float;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uBrightness;
  uniform float uRiverRefined;
  uniform float uProgress;
  uniform float uScanIntensity;
  uniform float uPulseStrength;
  uniform float uShowTribs;
  uniform vec3 uColor;
  uniform vec3 uContactColor;

  varying vec2 vUv;
  varying vec4 vPath;
  varying vec3 vWorld;
  varying vec3 vRibbonN;

  float lcHash(float n) { return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

  void main() {
    float isTrib = vPath.x;
    if (isTrib > 0.5 && uShowTribs < 0.5) discard;

    float seed = vPath.y;
    float pathLen = max(vPath.w, 0.5);

    /* 1. Head & Tail smoothstep fade + uProgress (0->1) growth wipe */
    float tailFade = smoothstep(0.0, 0.075, vUv.x);
    float headFade = 1.0 - smoothstep(0.91, 1.0, vUv.x);
    float endMask = tailFade * headFade;

    /* When uProgress < 1, curtain grows sleekly from 0 -> uProgress with a soft luminous leading crest */
    float pHead = uProgress * 1.06;
    float progMask = 1.0 - smoothstep(pHead - 0.09, pHead, vUv.x);
    if (progMask <= 0.002) discard;
    float activeWipe = step(0.005, uProgress) * (1.0 - smoothstep(0.96, 1.0, uProgress));
    float leadCrest = exp(-pow((vUv.x - max(0.0, pHead - 0.035)) / 0.026, 2.0)) * activeWipe;

    /* 2. Vertical Alpha Gradient: pow(1.0 - vUv.y, 2.2) fading cleanly to 0 at top edge */
    float yInv = clamp(1.0 - vUv.y, 0.0, 1.0);
    float vGrad = pow(yInv, 2.2) * smoothstep(1.0, 0.90, vUv.y);

    /* 3. Sharp Ground/Water Contact Line right at vUv.y = 0 (#d9f2ff architectural datum line) */
    float contactSharp = exp(-vUv.y * 54.0);
    float contactGlow  = exp(-vUv.y * 14.0);

    /* 4. Animated UV Flow (Travelling light pulses gliding along vUv.x) */
    float f1 = fract(vUv.x * 1.85 - uTime * uSpeed + seed * 0.37);
    float p1 = exp(-pow((f1 - 0.5) / 0.13, 2.0));
    float f2 = fract(vUv.x * 4.20 - uTime * uSpeed * 1.38 + seed * 0.71);
    float p2 = exp(-pow((f2 - 0.5) / 0.075, 2.0)) * 0.55;
    float pulseWave = (p1 + p2) * uPulseStrength;

    /* 5. Subtle Japanese Architectural / 3D GIS vertical survey filaments & elevation datum hairlines */
    float surveyX = vUv.x * pathLen * 11.0;
    float fineTick = pow(0.5 + 0.5 * sin(surveyX * 6.2831853), 18.0);
    float majorTick = pow(0.5 + 0.5 * sin(surveyX * 1.256637), 38.0);
    float cellNoise = lcHash(floor(surveyX * 2.0) + seed * 19.0);
    float subtleStrata = exp(-pow((vUv.y - 0.32) / 0.011, 2.0)) * 0.22 + exp(-pow((vUv.y - 0.62) / 0.014, 2.0)) * 0.10;
    float scanLayer = uScanIntensity * (fineTick * (0.14 + 0.16 * cellNoise) + majorTick * 0.36 + subtleStrata);

    /* 6. Restrained grazing-angle attenuation so overlapping turns stay airy & never blow out white */
    vec3 V = normalize(cameraPosition - vWorld);
    float facing = abs(dot(normalize(vRibbonN), V));
    /* Keep contact filament visible even from straight top-down (facing near 0), soften upper veil at extreme edge-on angles */
    float veilAngle = mix(0.42, 1.0, smoothstep(0.05, 0.55, facing));

    /* Combine curtain body veil + travelling flow + architectural ticks + crisp ground-contact filament */
    float tribScale = mix(1.0, 0.54, isTrib);
    float bodyAlpha = vGrad * (0.36 + 0.42 * pulseWave + scanLayer) * veilAngle;
    float contactAlpha = contactSharp * (1.15 + 0.45 * pulseWave) + contactGlow * (0.28 + 0.22 * pulseWave);
    // Leave room for the fine moving current beneath the veil; the central logo keeps its own shader.
    bodyAlpha *= mix(1.0, 0.78, uRiverRefined);
    contactAlpha *= mix(1.0, 0.58, uRiverRefined);
    float frontAlpha = leadCrest * (0.55 * vGrad + 0.95 * contactSharp);

    vec3 bodyCol = uColor * (bodyAlpha + frontAlpha * 0.65);
    vec3 lineCol = uContactColor * (contactAlpha * 0.78 + frontAlpha * 0.90 + majorTick * vGrad * uScanIntensity * 0.24);

    /* Linear additive emission (AdditiveBlending uses SRC_ALPHA * ONE -> set alpha = 1.0 to avoid squaring fades!) */
    vec3 emission = (bodyCol + lineCol) * uBrightness * tribScale * endMask * progMask;
    float peakE = max(emission.r, max(emission.g, emission.b));
    if (peakE < 0.002) discard;

    gl_FragColor = vec4(emission, 1.0);
  }
`;function uvToWorldXZ(u,v){return new THREE.Vector3(-7+u*14,WATER_Y,-3.917+v*7.834)}const EXT_MAIN_SPECS={NW:{dir:[-.76,-.65],len:1.35},NE:{dir:[.5,-.86],len:1.25},SW:{dir:[-.88,.47],len:1.15},SE:{dir:[.42,.91],len:1.25}};function prependExtendedHead(name,corePts){const sp=EXT_MAIN_SPECS[name];if(!sp||!corePts.length)return corePts;const start=corePts[0],dl=Math.hypot(sp.dir[0],sp.dir[1])||1,dx=sp.dir[0]/dl,dz=sp.dir[1]/dl,ext=[],steps=4;for(let i=steps;i>=1;i--){const t=sp.len*i/steps;ext.push(new THREE.Vector3(start.x+dx*t,WATER_Y,start.z+dz*t))}return ext.concat(corePts)}function buildCurtainGeometry(pathSpecs){const positions=[],uvs=[],pathAttrs=[],tangents=[],indices=[];let vBase=0;for(const spec of pathSpecs){if(!spec.points||spec.points.length<3)continue;const curve=new THREE.CatmullRomCurve3(spec.points,!1,"centripetal",.5),totalLen=Math.max(curve.getLength(),.25),segs=spec.segments||Math.max(48,Math.round(totalLen*18)),sampled=curve.getSpacedPoints(segs);for(let i=0;i<=segs;i++){const p=sampled[i],pPrev=sampled[Math.max(0,i-1)],pNext=sampled[Math.min(segs,i+1)];let tx=pNext.x-pPrev.x,tz=pNext.z-pPrev.z;const tl=Math.hypot(tx,tz)||1;tx/=tl,tz/=tl;const u=i/segs;if(positions.push(p.x,p.y,p.z),uvs.push(u,0),pathAttrs.push(spec.isTrib?1:0,spec.seed,spec.heightScale,totalLen),tangents.push(tx,0,tz),positions.push(p.x,p.y,p.z),uvs.push(u,1),pathAttrs.push(spec.isTrib?1:0,spec.seed,spec.heightScale,totalLen),tangents.push(tx,0,tz),i<segs){const a=vBase+i*2,b=a+1,c=a+2,d=a+3;indices.push(a,c,b,b,c,d)}}vBase+=(segs+1)*2}const geo=new THREE.BufferGeometry;return geo.setAttribute("position",new THREE.Float32BufferAttribute(positions,3)),geo.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2)),geo.setAttribute("aPath",new THREE.Float32BufferAttribute(pathAttrs,4)),geo.setAttribute("aTangent",new THREE.Float32BufferAttribute(tangents,3)),geo.setIndex(indices),geo.computeBoundingSphere(),geo}const LOGO_WALL_VERT=`
  attribute float aPart;   /* 0 = cyan signature blade (cls-1), 1 = architectural ring (cls-2) */
  attribute vec3 aTangent;

  uniform float uLogoHeight;
  uniform float uProgress;

  varying vec2 vUv;
  varying float vPart;
  varying vec3 vWorld;
  varying vec3 vRibbonN;

  void main() {
    float appear = smoothstep(0.62, 0.98, uProgress);
    vec3 p = position;
    p.y = uv.y * uLogoHeight * appear;

    vec4 wPos = modelMatrix * vec4(p, 1.0);
    vec3 wTan = normalize(mat3(modelMatrix) * aTangent);
    vRibbonN = normalize(vec3(-wTan.z, 0.0, wTan.x));

    vUv = uv;
    vPart = aPart;
    vWorld = wPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * wPos;
  }
`,LOGO_WALL_FRAG=`
  precision highp float;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uBrightness;
  uniform float uProgress;
  uniform float uScanIntensity;
  uniform float uPulseStrength;
  uniform vec3 uColor;
  uniform vec3 uContactColor;

  varying vec2 vUv;
  varying float vPart;
  varying vec3 vWorld;
  varying vec3 vRibbonN;

  void main() {
    float appear = smoothstep(0.60, 0.98, uProgress);
    if (appear <= 0.002) discard;

    /* Vertical gradient pow(1 - uv.y, 2.2) + crisp water-contact SVG outline filament */
    float yInv = clamp(1.0 - vUv.y, 0.0, 1.0);
    float vGrad = pow(yInv, 2.2) * smoothstep(1.0, 0.90, vUv.y);
    float contactSharp = exp(-vUv.y * 56.0);
    float contactGlow  = exp(-vUv.y * 15.0);

    /* Orbiting perimeter light pulse around the SVG contour */
    float f1 = fract(vUv.x * 2.0 - uTime * uSpeed * 0.85 + vPart * 0.45);
    float p1 = exp(-pow((f1 - 0.5) / 0.14, 2.0));
    float f2 = fract(vUv.x * 5.0 + uTime * uSpeed * 0.55);
    float p2 = exp(-pow((f2 - 0.5) / 0.07, 2.0)) * 0.42;
    float pulse = (p1 + p2) * uPulseStrength;

    /* Delicate Japanese architectural vertical ticks along logo wall */
    float fineTick = pow(0.5 + 0.5 * sin(vUv.x * 160.0), 16.0);
    float hDatum = exp(-pow((vUv.y - 0.36) / 0.014, 2.0)) * 0.24;
    float scan = uScanIntensity * (fineTick * 0.26 + hDatum);

    vec3 V = normalize(cameraPosition - vWorld);
    float facing = abs(dot(normalize(vRibbonN), V));
    float veilAngle = mix(0.48, 1.0, smoothstep(0.05, 0.52, facing));

    /* Preserve load_logo2.svg's 2-part identity: Path 0 = vivid FINNOVATION cyan-blue blade, Path 1 = refined ice-silver ring */
    vec3 bladeCol = mix(vec3(0.08, 0.68, 0.98), uColor, 0.28);
    vec3 ringCol  = mix(uColor, vec3(0.84, 0.94, 1.00), 0.38);
    vec3 partCol  = mix(bladeCol, ringCol, vPart);

    float bodyA = vGrad * (0.44 + 0.48 * pulse + scan) * veilAngle;
    float lineA = contactSharp * (1.25 + 0.45 * pulse) + contactGlow * (0.34 + 0.22 * pulse);

    vec3 emission = (partCol * bodyA + mix(vec3(0.55, 0.88, 1.0), uContactColor, vPart) * lineA * 0.82) * uBrightness * appear;
    if (max(emission.r, max(emission.g, emission.b)) < 0.002) discard;

    gl_FragColor = vec4(emission, 1.0);
  }
`,LOGO_FILL_VERT=`
  attribute float aPart;
  varying vec2 vLocalXZ;
  varying float vPart;
  void main() {
    vLocalXZ = position.xz;
    vPart = aPart;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,LOGO_FILL_FRAG=`
  precision highp float;

  uniform float uTime;
  uniform float uBrightness;
  uniform float uProgress;
  uniform float uScanIntensity;
  uniform vec3 uColor;
  uniform vec3 uContactColor;

  varying vec2 vLocalXZ;
  varying float vPart;

  void main() {
    float appear = smoothstep(0.62, 0.98, uProgress);
    if (appear <= 0.002) discard;

    float r = length(vLocalXZ);
    float breathe = 0.86 + 0.14 * sin(uTime * 1.6 - r * 4.5);
    /* Subtle architectural scanlines across the floating water-surface emblem */
    float grid = 1.0 + uScanIntensity * 0.22 * pow(0.5 + 0.5 * sin((vLocalXZ.x - vLocalXZ.y) * 90.0), 14.0);

    /* Path 0 (cls-1): luminous cyan gradient blade (#00a0e9); Path 1 (cls-2): translucent frosted silver-ice ring */
    vec3 bladeC = mix(vec3(0.02, 0.56, 0.92), vec3(0.45, 0.86, 1.00), clamp(0.5 + vLocalXZ.x * 1.1, 0.0, 1.0));
    vec3 ringC  = mix(uColor * 0.72, uContactColor * 0.88, 0.45);
    vec3 col    = mix(bladeC * 0.78, ringC * 0.46, vPart);

    vec3 emission = col * breathe * grid * uBrightness * appear;
    gl_FragColor = vec4(emission, 1.0);
  }
`,LOGO_RING_VERT=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,LOGO_RING_FRAG=`
  precision highp float;
  uniform float uTime;
  uniform float uSpeed;
  uniform float uBrightness;
  uniform float uProgress;
  uniform vec3 uColor;
  uniform vec3 uContactColor;
  varying vec2 vUv;

  float waterRipple(float r, float phase, float ang, float t) {
    float rad = 0.38 + phase * 0.58;
    float fadeIn = smoothstep(0.0, 0.14, phase);
    float fadeOut = pow(1.0 - phase, 1.45);
    float crest = exp(-pow((r - rad) / 0.014, 2.0));
    float trail = exp(-pow((r - (rad - 0.030)) / 0.046, 2.0)) * 0.32;
    float shimmer = 0.86 + 0.14 * sin(ang * 4.0 + t * 0.8 + phase * 6.283);
    return (crest + trail) * fadeIn * fadeOut * shimmer;
  }

  void main() {
    float appear = smoothstep(0.64, 0.98, uProgress);
    if (appear <= 0.002) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    if (r > 1.0) discard;
    float ang = atan(p.y, p.x);

    /* Pure concentric expanding water ripples (no outer gear/compass ticks) */
    float rate = max(0.09, uSpeed * 0.38);
    float t0 = uTime * rate;
    float rip1 = waterRipple(r, fract(t0), ang, uTime);
    float rip2 = waterRipple(r, fract(t0 + 0.333), ang, uTime);
    float rip3 = waterRipple(r, fract(t0 + 0.667), ang, uTime);
    float ripples = (rip1 + rip2 + rip3) * 0.58;

    float coreGlow = exp(-r * r * 6.8) * 0.16;
    float edgeFade = 1.0 - smoothstep(0.84, 1.0, r);

    vec3 emission = (uColor * (ripples * 0.72 + coreGlow) + uContactColor * (ripples * 0.42)) * uBrightness * appear * edgeFade;
    if (max(emission.r, max(emission.g, emission.b)) < 0.002) discard;
    gl_FragColor = vec4(emission, 1.0);
  }
`;async function buildCentralSvgLogo(svgUrl,uniforms,centerXZ){const loader=new SVGLoader,cleanSvg=(await fetch(svgUrl).then(r=>r.text())).replace(/url\(#linear-gradient-1\)/g,"#009ce5"),data=loader.parse(cleanSvg);let minX=1/0,maxX=-1/0,minY=1/0,maxY=-1/0;const partShapes=[];data.paths.forEach((path,pIdx)=>{SVGLoader.createShapes(path).forEach(sh=>{partShapes.push({shape:sh,part:pIdx===0?0:1}),sh.getSpacedPoints(80).forEach(pt=>{pt.x<minX&&(minX=pt.x),pt.x>maxX&&(maxX=pt.x),pt.y<minY&&(minY=pt.y),pt.y>maxY&&(maxY=pt.y)})})});const cx=(minX+maxX)*.5,cy=(minY+maxY)*.5,span=Math.max(maxX-minX,maxY-minY,1),toNormXZ=pt=>[(pt.x-cx)/span,(pt.y-cy)/span],fillPos=[],fillPart=[],fillIdx=[];let fBase=0;const wallPos=[],wallUv=[],wallPart=[],wallTan=[],wallIdx=[],outlines=[];let wBase=0;const pushContourWall=(pts2d,partVal,segCount)=>{if(!pts2d||pts2d.length<3)return;const closed=pts2d.slice(),first=closed[0],last=closed[closed.length-1];first.distanceTo(last)>.5&&closed.push(first.clone());const n=closed.length-1;let totalLen=0;const cum=[0];for(let i=0;i<n;i++)totalLen+=closed[i].distanceTo(closed[i+1]),cum.push(totalLen);if(!(totalLen<.001)){for(let i=0;i<=n;i++){const[x,z]=toNormXZ(closed[i]),pPrev=closed[i===0?n-1:i-1],pNext=closed[i===n?1:i+1];let tx=pNext.x-pPrev.x,tz=pNext.y-pPrev.y;const tl=Math.hypot(tx,tz)||1;tx/=tl,tz/=tl;const u=cum[i]/totalLen;if(wallPos.push(x,0,z,x,0,z),wallUv.push(u,0,u,1),wallPart.push(partVal,partVal),wallTan.push(tx,0,tz,tx,0,tz),i<n){const a=wBase+i*2,b=a+1,c=a+2,d=a+3;wallIdx.push(a,c,b,b,c,d)}}wBase+=(n+1)*2}};for(const{shape,part}of partShapes){const sg=new THREE.ShapeGeometry(shape,40),posA=sg.attributes.position;for(let i=0;i<posA.count;i++){const nx=(posA.getX(i)-cx)/span,nz=(posA.getY(i)-cy)/span;fillPos.push(nx,0,nz),fillPart.push(part)}if(sg.index){const idxA=sg.index;for(let i=0;i<idxA.count;i+=3)fillIdx.push(fBase+idxA.getX(i),fBase+idxA.getX(i+2),fBase+idxA.getX(i+1))}else for(let i=0;i<posA.count;i+=3)fillIdx.push(fBase+i,fBase+i+2,fBase+i+1);fBase+=posA.count,sg.dispose();const outer=shape.getSpacedPoints(180);outlines.push(outer.map(toNormXZ)),pushContourWall(outer,part,180);for(const hole of shape.holes)pushContourWall(hole.getSpacedPoints(140),part,140)}const fillGeo=new THREE.BufferGeometry;fillGeo.setAttribute("position",new THREE.Float32BufferAttribute(fillPos,3)),fillGeo.setAttribute("aPart",new THREE.Float32BufferAttribute(fillPart,1)),fillGeo.setIndex(fillIdx);const wallGeo=new THREE.BufferGeometry;wallGeo.setAttribute("position",new THREE.Float32BufferAttribute(wallPos,3)),wallGeo.setAttribute("uv",new THREE.Float32BufferAttribute(wallUv,2)),wallGeo.setAttribute("aPart",new THREE.Float32BufferAttribute(wallPart,1)),wallGeo.setAttribute("aTangent",new THREE.Float32BufferAttribute(wallTan,3)),wallGeo.setIndex(wallIdx);const ringGeo=new THREE.PlaneGeometry(1.75,1.75);ringGeo.rotateX(-Math.PI/2);const wallMat=new THREE.ShaderMaterial({uniforms,vertexShader:LOGO_WALL_VERT,fragmentShader:LOGO_WALL_FRAG,transparent:!0,depthWrite:!1,depthTest:!0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:!1}),fillMat=new THREE.ShaderMaterial({uniforms,vertexShader:LOGO_FILL_VERT,fragmentShader:LOGO_FILL_FRAG,transparent:!0,depthWrite:!1,depthTest:!0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:!1}),ringMat=new THREE.ShaderMaterial({uniforms,vertexShader:LOGO_RING_VERT,fragmentShader:LOGO_RING_FRAG,transparent:!0,depthWrite:!1,depthTest:!0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:!1}),group=new THREE.Group;group.name="Studio Central Holographic SVG Logo (load_logo2.svg)",group.position.set(centerXZ.x,WATER_Y+.004,centerXZ.z);const ringMesh=new THREE.Mesh(ringGeo,ringMat);ringMesh.position.y=-.001,ringMesh.renderOrder=11,ringMesh.frustumCulled=!1;const fillMesh=new THREE.Mesh(fillGeo,fillMat);fillMesh.position.y=.002,fillMesh.renderOrder=13,fillMesh.frustumCulled=!1;const wallMesh=new THREE.Mesh(wallGeo,wallMat);return wallMesh.renderOrder=14,wallMesh.frustumCulled=!1,group.add(ringMesh,fillMesh,wallMesh),{group,outlines,dispose(){fillGeo.dispose(),wallGeo.dispose(),ringGeo.dispose(),fillMat.dispose(),wallMat.dispose(),ringMat.dispose()}}}export async function createStudioLightCurtain(atlas,initialConfig={}){const cfg={...DEFAULT_CURTAIN_CONFIG,...initialConfig},url=rel=>new URL(rel,import.meta.url).href,[streamData,tribData]=await Promise.all([fetch(url("../original/w2-streamlines.json")).then(r=>r.json()),fetch(url("../flow2-river-beams.json")).then(r=>r.json()).catch(()=>({tributaries:[]}))]),pathSpecs=[];(streamData?.rivers||[]).forEach((rv,idx)=>{const raw=rv?.current?.middle||rv?.current?.pts||[];if(raw.length<4)return;const corePts=[];for(let i=0;i<raw.length;i+=3)corePts.push(uvToWorldXZ(raw[i][0],raw[i][1]));const last=raw[raw.length-1];corePts.push(uvToWorldXZ(last[0],last[1]));const fullPts=prependExtendedHead(rv.name,corePts);pathSpecs.push({name:rv.name||"R"+idx,points:fullPts,isTrib:!1,seed:idx*.27+.11,heightScale:1,segments:220})}),(tribData?.tributaries||[]).forEach((tr,idx)=>{const raw=tr?.uv||[];if(raw.length<4)return;const pts=[];for(let i=0;i<raw.length;i+=2)pts.push(uvToWorldXZ(raw[i][0],raw[i][1]));const last=raw[raw.length-1];pts.push(uvToWorldXZ(last[0],last[1])),pathSpecs.push({name:"Trib"+idx,points:pts,isTrib:!0,seed:idx*.19+.53,heightScale:.55,segments:72})});const geometry=buildCurtainGeometry(pathSpecs),uniforms={tCanopy:atlas.uniforms.tCanopy,uBounds:atlas.uniforms.uBounds,uYRange:atlas.uniforms.uYRange,uRelief:atlas.uniforms.uRelief,uTime:atlas.uniforms.uTime,uHeight:{value:cfg.height},uLogoHeight:{value:cfg.logoHeight},uSpeed:{value:cfg.speed},uBrightness:{value:cfg.brightness},uRiverRefined:{value:cfg.refinedRivers?1:0},uProgress:{value:cfg.progress},uScanIntensity:{value:cfg.scanIntensity},uPulseStrength:{value:cfg.pulseStrength},uShowTribs:{value:cfg.showTributaries?1:0},uColor:{value:new THREE.Color(cfg.color)},uContactColor:{value:new THREE.Color(cfg.contactColor)}},material=new THREE.ShaderMaterial({uniforms,vertexShader:CURTAIN_VERT,fragmentShader:CURTAIN_FRAG,transparent:!0,depthWrite:!1,depthTest:!0,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:!1}),mesh=new THREE.Mesh(geometry,material);mesh.name="Studio Volumetric Light Curtain (3D GIS)",mesh.frustumCulled=!1,mesh.renderOrder=12,mesh.visible=!!cfg.enabled,atlas.scene.add(mesh);const cUv=streamData?.centre||[.5087,.4928],lakeCenter=uvToWorldXZ(cUv[0],cUv[1]);let logo=null;try{logo=await buildCentralSvgLogo(url("../../../load_logo2.svg"),uniforms,lakeCenter),atlas.scene.add(logo.group)}catch(err){console.warn("[studio-light-curtain] load_logo2.svg failed to load",err)}function apply(){if(mesh.visible=!!cfg.enabled,uniforms.uHeight.value=Math.max(.05,+cfg.height||.56),uniforms.uLogoHeight.value=Math.max(0,+cfg.logoHeight),uniforms.uSpeed.value=Math.max(0,+cfg.speed||0),uniforms.uBrightness.value=Math.max(0,+cfg.brightness||0),uniforms.uProgress.value=Math.max(0,Math.min(1,+cfg.progress)),uniforms.uScanIntensity.value=Math.max(0,+cfg.scanIntensity||0),uniforms.uPulseStrength.value=Math.max(0,+cfg.pulseStrength||0),uniforms.uShowTribs.value=cfg.showTributaries?1:0,uniforms.uColor.value.set(cfg.color),uniforms.uContactColor.value.set(cfg.contactColor),logo){logo.group.visible=!!cfg.showLogo;const s=Math.max(.2,+cfg.logoScale||1.65);logo.group.scale.set(s,1,s),logo.group.rotation.y=(+cfg.logoRotation||0)*Math.PI/180}}return apply(),{mesh,logo,material,uniforms,config:cfg,pathCount:pathSpecs.length,apply,setProgress(p){cfg.progress=Math.max(0,Math.min(1,+p)),uniforms.uProgress.value=cfg.progress},dispose(){atlas.scene.remove(mesh),geometry.dispose(),material.dispose(),logo&&(atlas.scene.remove(logo.group),logo.dispose())}}}