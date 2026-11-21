const TUNE={gridDensity:1,gridBright:.62,gridWidth:1.15,drape:5,contour:.7,contourStep:3.2,ghost:.2,sweepSoft:.16,sweepGlow:1.2,cloudAmount:1,cloudSpeed:1,cloudSoft:.3,cloudVeil:.3,cloudScale:1,monoContrast:1,monoLift:.03,monoTint:1,monoKeep:.08,monoRelief:.45,chanWidth:9,chanSlope:.38,chanTop:46,riverY:0,monoGamma:1.22,monoShoulder:.78,glowCut:1,glowCeil:.5,cloudOpacity:.78,cloudBank:.5,ghostSky:.15,lineEdge:1.4},ROWS=[{key:"gridDensity",label:"\u683C\u7DDA\u5BC6\u5EA6",min:.4,max:3,step:.05},{key:"gridBright",label:"\u683C\u7DDA\u4EAE\u5EA6",min:0,max:1.5,step:.01},{key:"gridWidth",label:"\u683C\u7DDA\u7C97\u7D30\uFF08px\uFF09",min:.6,max:3,step:.05},{key:"drape",label:"\u683C\u7DDA\u8CBC\u5730\u8D77\u4F0F",min:0,max:24,step:.5},{key:"contour",label:"\u7B49\u9AD8\u7DDA\u5F37\u5EA6",min:0,max:1.5,step:.01},{key:"contourStep",label:"\u7B49\u9AD8\u7DDA\u9593\u8DDD\uFF08m\uFF09",min:1,max:10,step:.1},{key:"ghost",label:"\u6D6E\u52D5\u7B49\u9AD8\u7DDA",min:0,max:1,step:.01},{key:"sweepSoft",label:"\u6383\u5165\u908A\u7DE3\u67D4\u5EA6",min:.03,max:.5,step:.01},{key:"sweepGlow",label:"\u6383\u5165\u524D\u7DE3\u4EAE\u5EA6",min:0,max:3,step:.05},{key:"cloudAmount",label:"\u96F2\u9727\u91CF",min:0,max:1.6,step:.01},{key:"cloudSpeed",label:"\u96F2\u9727\u6D41\u52D5\u901F\u5EA6",min:0,max:4,step:.05},{key:"cloudSoft",label:"\u96F2\u7DE3\u67D4\u5EA6",min:.05,max:.6,step:.01},{key:"cloudVeil",label:"\u8584\u9727",min:0,max:1,step:.01},{key:"cloudScale",label:"\u96F2\u5718\u5927\u5C0F",min:.4,max:2.5,step:.05},{key:"monoContrast",label:"\u892A\u8272\u5F8C\u5C0D\u6BD4",min:.6,max:2,step:.01},{key:"monoLift",label:"\u892A\u8272\u5F8C\u4EAE\u5EA6",min:-.2,max:.3,step:.005},{key:"monoTint",label:"\u51B7\u92FC\u7070\u8272\u8ABF",min:0,max:1.5,step:.01},{key:"monoKeep",label:"\u4FDD\u7559\u5C71\u8C37\u539F\u8272",min:0,max:.6,step:.01},{key:"monoGamma",label:"\u92FC\u7070\u6DF1\u6DFA\uFF08>1 \u8F03\u6DF1\uFF09",min:.6,max:2,step:.01},{key:"monoShoulder",label:"\u4EAE\u90E8\u58D3\u5236\u8D77\u9EDE",min:.4,max:1,step:.01},{key:"glowCut",label:"\u6CB3\u5149\u30FBLOGO \u4EAE\u7DDA\u58D3\u5236",min:0,max:1,step:.01},{key:"glowCeil",label:"\u6CB3\u5149\u58D3\u5230\u7684\u7070\u5EA6",min:.2,max:.9,step:.01},{key:"cloudOpacity",label:"\u96F2\u9727\u900F\u660E\u5EA6\uFF081\uFF1D\u5BE6\u5FC3\uFF09",min:.2,max:1,step:.01},{key:"cloudBank",label:"\u5DE6\u4E0B\u5927\u96F2\u5718",min:0,max:1.2,step:.01},{key:"ghostSky",label:"\u5929\u7A7A\u4E2D\u7684\u6D6E\u52D5\u7B49\u9AD8\u7DDA",min:0,max:1,step:.01},{key:"monoRelief",label:"\u5730\u5F62\u660E\u6697\u7ACB\u9AD4\u611F",min:0,max:2.5,step:.01},{key:"lineEdge",label:"\u7DDA\u689D\u9000\u5834\u524D\u7DE3\u4EAE\u5EA6",min:0,max:4,step:.05},{key:"chanWidth",label:"\u5CFD\u8C37\u6CB3\u9762\u534A\u5BEC\uFF08m\uFF09",min:3,max:30,step:.5},{key:"chanSlope",label:"\u5CFD\u8C37\u5CA9\u58C1\u5916\u50BE",min:0,max:1.5,step:.01},{key:"chanTop",label:"\u683C\u7DDA\u4E0A\u7DE3\u9AD8\u5EA6\uFF08m\uFF09",min:8,max:120,step:1}],VERT="varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }",BAKE=`
  precision highp float; varying vec2 vUv;
  float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  vec2 h22(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
  float vn(vec2 p, float per, float sd){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    float a = h21(mod(i, per) + sd), b = h21(mod(i + vec2(1., 0.), per) + sd), c = h21(mod(i + vec2(0., 1.), per) + sd), d = h21(mod(i + 1., per) + sd);
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
  float wn(vec2 p, float per, float sd){ vec2 i = floor(p), f = fract(p); float m = 1.;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(float(x), float(y)); vec2 o = h22(mod(i + g, per) + sd); m = min(m, length(g + o - f)); }
    return m; }
  float field(vec2 uv, float sd){
    float v = 0., a = .5, per = 4., w = 0., wa = .5;
    for (int i = 0; i < 6; i++) { v += a * vn(uv * per, per, sd + float(i) * 17.); a *= .5; per *= 2.; }
    per = 5.;
    for (int i = 0; i < 4; i++) { w += wa * (1. - wn(uv * per, per, sd + 91. + float(i) * 13.)); wa *= .5; per *= 2.; }
    v /= .984; w /= .9375;
    return clamp((v * .64 + w * .5 - .30) / .62, 0., 1.);
  }
  void main(){
    float b = 0., a = .5, per = 2.;
    for (int i = 0; i < 4; i++) { b += a * vn(vUv * per, per, 311. + float(i) * 7.); a *= .5; per *= 2.; }
    gl_FragColor = vec4(field(vUv, 3.), field(vUv + .37, 57.), clamp((b / .9375 - .2) / .6, 0., 1.), 1.);
  }`,FRAG=`
  precision highp float; varying vec2 vUv;
  uniform sampler2D tSrc, tNoise;
  uniform vec4 uRes;                    /* w, h, 1/w, 1/h in pixels */
  uniform float uTime, uSweep, uCloud, uMono, uGrid, uAerial, uCamH;
  uniform mat4 uInvProj; uniform vec3 uLx, uLy, uLz;
  uniform vec4 uG;                      /* line spacing (m), brightness, width (px), drape (m) */
  uniform vec4 uC;                      /* contour strength, contour step (m), ghost contours, sweep softness */
  uniform vec4 uK;                      /* cloud amount, cloud softness, veil, mono contrast */
  uniform vec4 uCh;                     /* floor half width, wall lean, wall top, mono lift */
  uniform vec4 uT;                      /* cool steel tint, colour kept, relief, lens push */
  uniform vec4 uX;                      /* glow ceiling, glow cut, highlight shoulder, gamma */
  uniform vec4 uQ;                      /* cloud opacity, lower-left bank, ghost in sky, - */
  uniform vec4 uM;                      /* front glow, cloud scale, cloud drift (already \xD7 speed), - */
  float lumOf(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
  float aaLine(float x, float wpx){ float fw = fwidth(x), d = abs(fract(x - .5) - .5);
    return (1. - smoothstep(fw * wpx * .5, fw * (wpx * .5 + 1.), d)) * (1. - smoothstep(.16, .5, fw)); }
  void main(){
    vec2 sUv = (vUv - vec2(.5, .46)) / (1. + uT.w) + vec2(.5, .46);                    /* TD-LEAD's lens push under the clouds (0 = none) */
    vec3 src = texture2D(tSrc, sUv).rgb;
    float lum = lumOf(src), aspect = uRes.x / uRes.y;
    vec2 p = vec2(vUv.x * aspect, vUv.y);
    vec3 nz = texture2D(tNoise, p * .19 + vec2(.13, .37)).rgb;

    /* ---- the sweep, from screen-left: cov 0 \u2192 1 behind a soft, uneven front ---- */
    float sField = max(vUv.x * .86 + (nz.b - .5) * .30 + (1. - vUv.y) * .06 + .07, .02);
    float sPos = uSweep * 1.34;
    float cov = smoothstep(0., uC.w, sPos - sField);
    float rim = exp(-pow((sPos - sField - uC.w * .45) / (uC.w * .8), 2.)) * step(.001, uSweep) * (1. - smoothstep(.88, 1., uSweep));
    cov = max(cov, uAerial);

    /* ---- the drained land (UPDATE 2: not black and white \u2014 the valley drained to a cool steel grey, strong lit relief) ---- */
    vec2 px = uRes.zw * 9.;
    float l1 = lumOf(texture2D(tSrc, sUv + px).rgb), l2 = lumOf(texture2D(tSrc, sUv - px).rgb);
    float l3 = lumOf(texture2D(tSrc, sUv + px * vec2(1., -1.)).rgb), l4 = lumOf(texture2D(tSrc, sUv + px * vec2(-1., 1.)).rgb);
    float lb = (lum * 2. + l1 + l2 + l3 + l4) / 6.;
    float rng = max(max(l1, l2), max(l3, l4)) - min(min(l1, l2), min(l3, l4));
    float g = (lum - .5) * uK.w + .5 + uCh.w + (lum - lb) * uT.z * 2.2;                 /* relief: ridges brighter, gullies darker than their surroundings */
    g = clamp(g, 0., 1.);
    /* v2: the river light and the logo ring (saturated blue light in the picture) and the page's own grid lines must not turn into white strokes */
    float glow = smoothstep(.10, .34, src.b - src.r) * smoothstep(.34, .72, lum);
    g = mix(g, min(g, uX.x + (g - uX.x) * .25), glow * uX.y);
    g = min(g, uX.z + (g - uX.z) * .35 + step(g, uX.z) * (g - uX.z) * .65);            /* soft shoulder: nothing blows out to paper white */
    g = pow(g, uX.w);
    vec3 steel = mix(vec3(.060, .078, .105), vec3(.86, .90, .955), g);                 /* cool shadows, silver lights */
    steel = mix(vec3(g), steel, uT.x);
    steel = mix(steel, steel * (src / max(lum, .04)), uT.y * (1. - g * .6));           /* a breath of the valley's own colour stays in it */
    float mLoc = clamp(uMono * (.55 + .9 * cov), 0., 1.);
    vec3 col = mix(src, clamp(steel, 0., 1.), mLoc);

    /* ---- the lattice in the canyon ---- */
    if (uAerial < .5 && cov > .002) {
      vec4 v4 = uInvProj * vec4(vUv * 2. - 1., 1., 1.); vec3 dc = normalize(v4.xyz / v4.w);
      vec3 d = vec3(dot(uLx, dc), dot(uLy, dc), dot(uLz, dc));                          /* x right, y up, z along the canyon */
      float h = uCamH, w0 = uCh.x, k = uCh.y;
      float tf = d.y < -1e-4 ? -h / d.y : 1e5;
      float s = d.x >= 0. ? 1. : -1., den = d.x - s * k * d.y;
      float tw = s * den > 1e-4 ? s * (w0 + k * h) / den : 1e5;
      float t = min(tf, tw); vec3 hp = d * t; float hy = hp.y + h, wall = step(tw, tf);
      /* the drape: broad forms fixed to the stand-in's surface (they travel with the land, not with the screen) + a little of the picture's light */
      float u0 = mix(abs(hp.x), w0 + hy * sqrt(1. + k * k), wall), s0 = hp.z + s * 37.;
      vec3 bump = texture2D(tNoise, vec2(u0, s0) * .011).rgb;
      float rel = ((bump.b - .5) * 1.4 + (bump.r - .5) * .35 + (lb - .3) * .04) * uG.w * mix(.3, 1., wall);
      float u = u0 + rel * .8;
      float vv = hp.z + (bump.g - .5) * uG.w * mix(.2, .7, wall);
      float grid = max(aaLine(u / uG.x, uG.z), aaLine(vv / uG.x, uG.z));
      float ct = wall * aaLine((hy + rel * 1.1) / uC.y, uG.z * 1.1);
      float top = 1. - smoothstep(uCh.z * .6, uCh.z, hy + (nz.g - .5) * uCh.z * .6);
      float sky = max(smoothstep(.30, .42, lb) * smoothstep(.05, .12, src.b - src.r), smoothstep(.40, .54, lb) * (1. - smoothstep(.10, .24, rng)));
      sky = max(sky, smoothstep(.36, .46, min(min(l1, l2), min(l3, l4))));
      sky = max(sky, smoothstep(.10, .17, src.b - src.r) * smoothstep(.25, .33, lb)) * smoothstep(-.03, .03, d.y);   /* above the horizon only: the river keeps its lines */              /* v2: bright all round = sky, whatever its colour */
      float m = top * (1. - sky) * (1. - smoothstep(140., 460., t)) * mix(.55, 1., wall) * step(t, 9e4);
      float lit = mix(.5, 1.2, smoothstep(.04, .55, lb));
      float gf = texture2D(tNoise, p * .105 + vec2(.41, .12)).b * 11. + vUv.y * 1.6;
      float ghost = aaLine(gf, 1.1) * uC.z * .5 * (1. - sky * (1. - uQ.z)) * smoothstep(.98, .80, vUv.y);
      float L = ((grid * .8 + ct * uC.x) * m * lit + ghost) * cov * (1. + rim * uM.x) * uG.y;
      col += vec3(.93, .965, 1.) * L * (1. - col * .35);
    }

    /* ---- clouds and mist, from screen-left ---- */
    if (uCloud > .0005) {
      float full = smoothstep(.55, .99, uCloud);
      float bank = (1. - smoothstep(.0, .62, length((vUv - vec2(.10, .22)) * vec2(1.25, 1.5)))) * uQ.y * smoothstep(.0, .22, uCloud);   /* a large soft bank, lower left */
      float c = pow(uCloud, 1.1) * 1.25 * uK.x - vUv.x * .9 - (vUv.y - .35) * .42 + (nz.b - .5) * .22 + bank;
      vec2 q = p / uM.y, drift = vec2(-uM.z, uM.z * .18);
      vec2 warp = (texture2D(tNoise, q * .23 + drift * .4).gb - .5) * .10;
      vec2 q1 = q * .34 + warp + drift * 1. + vec2(-uCloud * .30, .07), q2 = q * .83 + warp * 1.6 + drift * 1.7 + vec2(-uCloud * .46, .31);
      float d1 = texture2D(tNoise, q1).r, d2 = texture2D(tNoise, q2).g, d3 = texture2D(tNoise, q * 2.1 + warp * 2. + drift * 2.6).r;
      float dn = d1 * .72 + d2 * .22 + d3 * .06;
      float th = 1. - c * 1.12;
      float a = smoothstep(th, th + uK.y * 2., dn); a *= a;                    /* v2: long soft edges */
      a = max(a, smoothstep(.1, 1.3, c) * uK.z * (.45 + .55 * d1));          /* the thin mist ahead */
      a *= uQ.x;                                                             /* v2: translucent \u2014 the land and its grid show through */
      a = clamp(a + (1. - a) * pow(full, 2.2), 0., 1.);                      /* thickens evenly from cloud .5; whole only at \u2248 1 */
      vec2 sun = vec2(.035, .028);
      float sh = texture2D(tNoise, q1 + sun).r * .72 + texture2D(tNoise, q2 + sun * 1.6).g * .22 + d3 * .06;
      float light = clamp(.62 + (dn - sh) * 2.6 + (dn - .5) * .3, 0., 1.);
      vec3 cc = mix(vec3(.70, .73, .775), vec3(.945, .95, .955), light);
      cc = mix(cc, vec3(lumOf(cc)) * vec3(.985, .995, 1.01), clamp(uMono, 0., 1.) * .8);
      col = mix(col, cc, a);
    }
    gl_FragColor = vec4(col, 1.);
  }`,LINE_NAME="Studio 3D Line Grid",lineState={mesh:null,mode:"none",amount:1,alpha0:null,ready:!1};function findLines(patch){if(lineState.mesh&&lineState.mesh.parent&&(lineState.mode!=="none"||!patch))return lineState.mesh;let A=null;try{A=window.__FLOW2_FOREST_ATLAS__&&window.__FLOW2_FOREST_ATLAS__.scene}catch{return null}const m=A&&A.scene&&A.scene.getObjectByName?A.scene.getObjectByName(LINE_NAME):null;if(!m||!m.material||!m.material.uniforms)return null;lineState.mesh=m;const mt=m.material,lake=A.lake&&A.lake.center;if(mt.uniforms.uTdLine)return lineState.mode="retract",m;if(!patch)return m;if(mt.uniforms.uTdLine)lineState.mode="retract";else{const mark="if (baseA < 0.004) discard;";typeof mt.fragmentShader=="string"&&mt.fragmentShader.includes(mark)&&mt.fragmentShader.includes("varying float vLit, vWet, vMinor, vH, vOutFade;")?(mt.uniforms.uTdLine={value:1},mt.uniforms.uTdLake={value:[lake?lake.x:.12,lake?lake.z:-.06]},mt.uniforms.uTdEdge={value:1.4},mt.fragmentShader=mt.fragmentShader.replace("varying float vLit, vWet, vMinor, vH, vOutFade;",`varying float vLit, vWet, vMinor, vH, vOutFade;
  uniform float uTdLine, uTdEdge; uniform vec2 uTdLake;`).replace(mark,`{ /* RISE-TD LOOK: the withdrawal */
      float tdE = clamp(vH / .5, 0., 1.) * .6 + clamp(length(vW.xz - uTdLake) / 10., 0., 1.) * .4;
      tdE = clamp(tdE + (fract(sin(dot(floor(vW.xz * 7.), vec2(127.1, 311.7))) * 43758.5453) - .5) * .05, 0., 1.);
      float tdT = uTdLine * 1.3 - .3;
      float tdK = 1. - smoothstep(tdT, tdT + .3, tdE);
      float tdB = exp(-pow((tdE - tdT - .12) / .09, 2.)) * step(uTdLine, .999) * step(.001, uTdLine);
      baseA *= tdK * (1. + tdB * uTdEdge);
    }
    `+mark),mt.needsUpdate=!0,lineState.mode="retract"):lineState.mode="fade"}return m}export function setLines(amount){const a=Math.min(1,Math.max(0,Number.isFinite(+amount)?+amount:1));lineState.amount=a;const m=findLines(!1);if(!m)return!1;const u=m.material.uniforms;if(lineState.mode==="retract")u.uTdLine.value=a;else{if(lineState.mode==="none")return!1;u.uAlpha&&((lineState.alpha0==null||Math.abs(u.uAlpha.value-lineState.alpha0*lineState.applied)>1e-4)&&(lineState.alpha0=u.uAlpha.value),lineState.applied=a,u.uAlpha.value=lineState.alpha0*a)}return m.visible=a>.001,!0}export function createLook({THREE,renderer,width=1,height=1,dpr=1,lite=!1,quality="high"}={}){const tune={...TUNE},state={stage:"new",frames:0,noise:0,lite:!!lite,quality},NS=lite||quality==="low"?256:512,tri=new THREE.BufferGeometry;tri.setAttribute("position",new THREE.BufferAttribute(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3));const cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1),scene=new THREE.Scene,noiseRT=new THREE.WebGLRenderTarget(NS,NS,{depthBuffer:!1,generateMipmaps:!0,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,wrapS:THREE.RepeatWrapping,wrapT:THREE.RepeatWrapping});noiseRT.texture.colorSpace=THREE.NoColorSpace;const bakeMat=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:BAKE,depthTest:!1,depthWrite:!1,toneMapped:!1}),U={tSrc:{value:null},tNoise:{value:noiseRT.texture},uRes:{value:new THREE.Vector4(1,1,1,1)},uTime:{value:0},uSweep:{value:0},uCloud:{value:0},uMono:{value:0},uGrid:{value:1},uAerial:{value:0},uCamH:{value:2.8},uInvProj:{value:new THREE.Matrix4},uLx:{value:new THREE.Vector3(1,0,0)},uLy:{value:new THREE.Vector3(0,1,0)},uLz:{value:new THREE.Vector3(0,0,-1)},uG:{value:new THREE.Vector4},uC:{value:new THREE.Vector4},uK:{value:new THREE.Vector4},uCh:{value:new THREE.Vector4},uM:{value:new THREE.Vector4},uT:{value:new THREE.Vector4},uX:{value:new THREE.Vector4},uQ:{value:new THREE.Vector4}},mat=new THREE.ShaderMaterial({uniforms:U,vertexShader:VERT,fragmentShader:FRAG,depthTest:!1,depthWrite:!1,toneMapped:!1}),mesh=new THREE.Mesh(tri,mat);mesh.frustumCulled=!1,scene.add(mesh);let baked=!1,w=width,h=height,pr=dpr,drift=0;const clamp01=v=>Math.min(1,Math.max(0,+v||0)),num=(v,d)=>Number.isFinite(+v)?+v:d,fwd=new THREE.Vector3,lr=new THREE.Vector3,X=new THREE.Vector3,Y=new THREE.Vector3,Z=new THREE.Vector3;function bake(){if(baked)return;const prev=renderer.getRenderTarget();mesh.material=bakeMat,renderer.setRenderTarget(noiseRT),renderer.render(scene,cam),mesh.material=mat,renderer.setRenderTarget(prev),baked=!0,state.noise=NS}const tiny=new THREE.WebGLRenderTarget(4,4,{depthBuffer:!1}),compileFor=(target,material,sc,cm)=>{const prev=renderer.getRenderTarget(),keep=mesh.material;let p=null;try{material&&(mesh.material=material),renderer.setRenderTarget(target),p=renderer.compileAsync?renderer.compileAsync(sc||scene,cm||cam):null}catch(error){state.warmNote=String(error&&error.message||error)}finally{mesh.material=keep,renderer.setRenderTarget(prev)}return Promise.resolve(p).catch(()=>{})};let linesBusy=!1,linesTimer=0,lastDraw=0;async function prepareLines(){if(linesBusy||lineState.ready)return lineState.ready;let A=null;try{A=window.__FLOW2_FOREST_ATLAS__&&window.__FLOW2_FOREST_ATLAS__.scene}catch{}if(!A||!A.scene||!A.camera||!A.scene.getObjectByName(LINE_NAME))return!1;linesBusy=!0;const t0=performance.now();try{const m=findLines(!0);if(!m||lineState.mode!=="retract")return lineState.ready=!0,!0;const withState=fn=>{const prev=renderer.getRenderTarget(),tone=renderer.toneMapping,sh=renderer.shadowMap.autoUpdate,ac=renderer.autoClear;let out;try{renderer.toneMapping=THREE.NoToneMapping,renderer.shadowMap.autoUpdate=!1,renderer.setRenderTarget(tiny),out=fn()}finally{renderer.toneMapping=tone,renderer.shadowMap.autoUpdate=sh,renderer.autoClear=ac,renderer.setRenderTarget(prev)}return out},tmp=new THREE.Scene,proxy=new THREE.LineSegments(m.geometry,m.material);proxy.frustumCulled=!1,tmp.add(proxy),await Promise.resolve(withState(()=>renderer.compileAsync?renderer.compileAsync(tmp,A.camera):null)).catch(()=>{}),withState(()=>{const keep=m.material.uniforms.uTdLine.value;m.material.uniforms.uTdLine.value=.5;try{renderer.render(tmp,A.camera)}catch(error){state.warmNote="lines draw: "+(error&&error.message||error)}finally{m.material.uniforms.uTdLine.value=keep,tmp.remove(proxy)}}),lineState.ready=!0,state.linesWarmMs=Math.round(performance.now()-t0)}catch(error){state.warmNote="lines: "+(error&&error.message||error)}finally{linesBusy=!1,lineState.ready=!0,linesTimer&&(clearInterval(linesTimer),linesTimer=0)}return state.linesMode=lineState.mode,!0}function watchLines(){if(lineState.ready||linesTimer)return;let tries=0;linesTimer=setInterval(()=>{if(lineState.ready||++tries>400){clearInterval(linesTimer),linesTimer=0;return}performance.now()-lastDraw>600&&prepareLines().catch(()=>{})},500)}async function warm(){const t0=performance.now();await compileFor(noiseRT,bakeMat),bake(),await Promise.all([compileFor(null,mat),compileFor(tiny,mat)]);{const prev=renderer.getRenderTarget(),ac=renderer.autoClear;try{renderer.autoClear=!1,U.tSrc.value=noiseRT.texture,U.uSweep.value=U.uCloud.value=U.uMono.value=.5,renderer.setRenderTarget(tiny),renderer.render(scene,cam)}catch{}finally{renderer.autoClear=ac,renderer.setRenderTarget(prev),U.tSrc.value=null}}try{await prepareLines()||watchLines()}catch{watchLines()}state.stage="ready",state.warmMs=Math.round(performance.now()-t0)}function setCamera(camera){if(!camera)return;U.uInvProj.value.copy(camera.projectionMatrixInverse);const e=camera.matrixWorld.elements;X.set(e[0],e[1],e[2]).normalize(),Y.set(e[4],e[5],e[6]).normalize(),Z.set(e[8],e[9],e[10]).normalize(),fwd.set(-Z.x,0,-Z.z),fwd.lengthSq()<1e-6&&fwd.set(Y.x,0,Y.z),fwd.normalize(),lr.set(-fwd.z,0,fwd.x),U.uLx.value.set(lr.dot(X),lr.dot(Y),lr.dot(Z)),U.uLy.value.set(X.y,Y.y,Z.y),U.uLz.value.set(fwd.dot(X),fwd.dot(Y),fwd.dot(Z)),U.uCamH.value=Math.max(.6,e[13]-num(tune.riverY,0))}function update(f){if(!f||!f.source)return;baked||bake(),lastDraw=performance.now();const r=f.renderer||renderer,T=tune,W=Math.max(1,Math.round(num(f.width,w)*num(f.dpr,pr))),H=Math.max(1,Math.round(num(f.height,h)*num(f.dpr,pr)));U.tSrc.value=f.source,U.uRes.value.set(W,H,1/W,1/H);const aerial=f.scene==="aerial";U.uAerial.value=aerial?1:0,U.uSweep.value=clamp01(f.sweep),U.uCloud.value=clamp01(f.cloud),U.uMono.value=clamp01(f.mono),U.uGrid.value=f.grid==null?1:clamp01(f.grid),aerial||setCamera(f.camera);{const la=f.lines!=null?clamp01(f.lines):f.grid==null?1:clamp01(f.grid);setLines(aerial?la:1),state.lines=lineState.amount,state.linesMode=lineState.mode,lineState.mesh&&lineState.mesh.material.uniforms.uTdEdge&&(lineState.mesh.material.uniforms.uTdEdge.value=num(T.lineEdge,1.4))}const time=f.reduced?0:num(f.time,0);drift=time*.012*num(T.cloudSpeed,1),U.uTime.value=time,U.uG.value.set(2.6/Math.max(.2,num(T.gridDensity,1)),num(T.gridBright,.6),Math.max(.5,num(T.gridWidth,1.15))*Math.max(1,num(f.dpr,pr))*.8,num(T.drape,9)),U.uC.value.set(num(T.contour,.7),Math.max(.4,num(T.contourStep,3.2)),num(T.ghost,.2),Math.max(.02,num(T.sweepSoft,.16))),U.uK.value.set(num(T.cloudAmount,1),Math.max(.03,num(T.cloudSoft,.3)),num(T.cloudVeil,.3),num(T.monoContrast,1)),U.uCh.value.set(Math.max(1,num(T.chanWidth,9)),num(T.chanSlope,.38),Math.max(4,num(T.chanTop,46)),num(T.monoLift,.03)),U.uT.value.set(num(T.monoTint,1),num(T.monoKeep,.08),num(T.monoRelief,.45),Math.max(0,num(f.push,0))),U.uX.value.set(num(T.glowCeil,.5),num(T.glowCut,1),num(T.monoShoulder,.78),Math.max(.3,num(T.monoGamma,1.22))),U.uQ.value.set(Math.min(1,Math.max(0,num(T.cloudOpacity,.78))),num(T.cloudBank,.5),num(T.ghostSky,.15),0),U.uM.value.set(num(T.sweepGlow,1.2),Math.max(.2,num(T.cloudScale,1)),drift,0),r.setRenderTarget(f.target||null),r.render(scene,cam),state.frames++,state.scene=f.scene,state.last={sweep:U.uSweep.value,cloud:U.uCloud.value,mono:U.uMono.value,grid:U.uGrid.value}}function resize(nw,nh,nd){w=nw,h=nh,pr=nd||pr}function dispose(){linesTimer&&clearInterval(linesTimer),tiny.dispose(),tri.dispose(),mat.dispose(),bakeMat.dispose(),noiseRT.dispose(),window.__RISE_TD_LOOK__===api&&delete window.__RISE_TD_LOOK__}const api={tune,rows:ROWS,state,warm,update,resize,dispose,setLines};try{window.__RISE_TD_LOOK__=api}catch{}return api}export default createLook;