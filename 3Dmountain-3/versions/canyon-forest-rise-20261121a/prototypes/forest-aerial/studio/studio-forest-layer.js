import*as THREE from"three";import{GLTFLoader}from"three/addons/loaders/GLTFLoader.js";export function jsLakeBasinR(x,z){const qx=(x-.122)/1.66,qz=(z+.056)/1.42,r=Math.hypot(qx,qz),ang=Math.atan2(qz,qx),wobble=.085*Math.sin(ang*3+.7)+.055*Math.cos(ang*5-1.2)+.035*Math.sin(ang*7+2.4);return r+wobble}const JS_CORE_RIVERS=[[[-6.34,-3.65],[-5.85,-3.23],[-5.15,-3.21],[-4.55,-3.03],[-4.26,-2.59],[-3.51,-2.3],[-2.86,-1.99],[-2.64,-1.58],[-2.1,-1.39],[-1.39,-1.24],[-.79,-.83]],[[5.66,-3.76],[5.34,-3.23],[5.25,-2.8],[4.82,-2.57],[4.24,-2.49],[3.7,-2.26],[3.62,-1.91],[3.42,-1.46],[2.91,-1.31],[2.36,-1.2],[1.72,-1.19],[1.18,-.88]],[[6.8,3.78],[6.26,3.14],[5.67,2.78],[5.17,2.68],[4.56,2.41],[3.9,2.3],[3.25,2.33],[2.65,2.17],[2.53,1.6],[2.26,1.15],[1.58,.91],[1.12,.58]],[[-6.98,1.5],[-6.47,1.38],[-6,1.41],[-5.43,1.27],[-4.95,1.05],[-4.41,.7],[-4.04,.58],[-3.48,.53],[-2.98,.52],[-2.53,.5],[-2.27,.19],[-1.42,.06]]];export function jsCoreRiverDist(x,z){let minD=99;for(let r=0;r<JS_CORE_RIVERS.length;r++){const pts=JS_CORE_RIVERS[r];for(let i=0;i<pts.length-1;i++){const ax=pts[i][0],az=pts[i][1],bx=pts[i+1][0],bz=pts[i+1][1],dx=bx-ax,dz=bz-az,len2=dx*dx+dz*dz||1e-6,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/len2)),d=Math.hypot(x-(ax+dx*t),z-(az+dz*t));d<minD&&(minD=d)}}return minD}const STUDIO_VER="st-20261119-40";export const STUDIO_SUN=new THREE.Vector3(.6198,.5599,-.5499).normalize();const MAX_REAL_TREES=15e3;export const DEFAULT_STUDIO_CONFIG={style:1,density:1,crownScale:1.45,heightScale:1.38,sunGlow:1,shadow:1.05,grassPbr:1,relief:1.32,waterClear:.96,mist:0,wind:.9,layers:{atmosphere:!1,ecoTrees:!0,grass3d:!0,rocks3d:!0,legacyTrees:!1,water:!0,terrainStyle:!0},species:[!0,!0,!0,!0]};const REAL_TREE_VERT=`
  attribute vec4 color;       /* glTF COLOR_0: r = baked 3D canopy AO, g = isLeaf (1=leaf, 0=bark), b = crown height */
  attribute vec4 aInstData;   /* rgb = ecological grove tint, a = yaw radians */

  uniform sampler2D tCanopy;
  uniform vec4 uBounds;
  uniform vec2 uYRange;
  uniform vec3 uSun;
  uniform float uRelief, uTime, uCrownScale, uTreeHeight, uWind;

  varying vec3 vWorld, vNormalW, vTint;
  varying vec2 vUv, vFootUv;
  varying float vAO, vIsLeaf, vCrownH, vRnd, vTerrSun;

  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    float id = float(gl_InstanceID);
    float r1 = fract(sin(id * 12.9898 + 78.233) * 43758.5453);
    float r2 = fract(r1 * 7.13 + 0.31);
    float r3 = fract(r1 * 13.71 + 0.77);

    vec4 foot = m * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 fuv = (foot.xz - uBounds.xy) * uBounds.zw;
    vec2 cfuv = clamp(fuv, 0.002, 0.998);
    float hC = texture2D(tCanopy, cfuv).r;
    float ground = max(0.105 + (uYRange.x + hC * uYRange.y - 0.105) * uRelief, 0.105);

    /* Macro terrain slope sunlight so back-facing mountain slopes fall into rich dark forest shadow */
    vec2 te = vec2(0.0045, 0.0080);
    float hL = texture2D(tCanopy, clamp(cfuv - vec2(te.x, 0.0), 0.0, 1.0)).r;
    float hR = texture2D(tCanopy, clamp(cfuv + vec2(te.x, 0.0), 0.0, 1.0)).r;
    float hD = texture2D(tCanopy, clamp(cfuv - vec2(0.0, te.y), 0.0, 1.0)).r;
    float hU = texture2D(tCanopy, clamp(cfuv + vec2(0.0, te.y), 0.0, 1.0)).r;
    vec3 tN = normalize(vec3(-(hR - hL) * 10.5 * uRelief, 1.0, -(hU - hD) * 10.5 * uRelief));
    vTerrSun = clamp(dot(tN, normalize(uSun)), 0.0, 1.0);

    vec3 localP = position;
    vec4 rawW = m * vec4(localP, 1.0);
    vec3 off = rawW.xyz - foot.xyz;
    off.xz *= uCrownScale;
    off.y  *= uTreeHeight;

    /* Subtle natural organic trunk lean + breeze sway strictly on foliage */
    off.xz += max(0.0, off.y) * vec2(r1 - 0.5, r2 - 0.5) * 0.14;
    float sway = sin(uTime * 1.25 + foot.x * 2.2 + foot.z * 2.6 + localP.x * 5.0 + r3 * 6.283) * 0.006 * uWind * color.g * smoothstep(0.15, 0.95, localP.y);
    off.x += sway;
    off.z += sway * 0.65;

    /* Embed root flare slightly (-0.009) so real 3D trunks never float on steep mountain cliffs */
    vec3 worldP = vec3(foot.x, ground - 0.009, foot.z) + off;
    vWorld = worldP;

    mat3 nm = mat3(m);
    vec3 sx = vec3(length(nm[0]), length(nm[1]), length(nm[2]));
    vec3 nLocalScaled = normal / max(sx * vec3(uCrownScale, uTreeHeight, uCrownScale), vec3(1e-4));
    vNormalW = normalize(nm * nLocalScaled);

    vTint = aInstData.rgb;
    vUv = uv;
    vFootUv = fuv;
    vAO = color.r;
    vIsLeaf = color.g;
    vCrownH = color.b;
    vRnd = r3;

    gl_Position = projectionMatrix * viewMatrix * vec4(worldP, 1.0);
  }
`,REAL_TREE_FRAG=`
  uniform sampler2D tRealTreeAtlas, tStudioShadow, tPlate;
  uniform vec3 uSun;
  uniform vec4 uBounds, uView;
  uniform float uStudioStyle, uSunGlow, uStudioShadow, uHaze, uDist, uVig, uMirror;

  varying vec3 vWorld, vNormalW, vTint;
  varying vec2 vUv, vFootUv;
  varying float vAO, vIsLeaf, vCrownH, vRnd, vTerrSun;

  void main() {
    if (uMirror > 0.5 && vWorld.y < 0.107) discard;

    vec4 tex = texture2D(tRealTreeAtlas, vUv);
    /* MSAA alphaToCoverage anti-aliased foliage silhouettes: eliminates harsh distant pixel shimmer & noise! */
    float cov = 1.0;
    if (vIsLeaf > 0.5) {
      vec2 dx = dFdx(vUv * vec2(2048.0, 1024.0)), dy = dFdy(vUv * vec2(2048.0, 1024.0));
      float lod = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1.0));
      float alpha = tex.a * (1.0 + lod * 0.45);
      cov = smoothstep(0.24, 0.54, alpha);
      if (cov < 0.08) discard;
    }

    vec3 sunDir = normalize(uSun);
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vWorld);
    float hillSun = smoothstep(0.10, 0.86, vTerrSun);
    vec3 shMap = texture2D(tStudioShadow, clamp(vFootUv, 0.0, 1.0)).rgb;

    /* Real 3D Bark / Trunk / Main Branches from \u6A391, \u6A392, \u6A393 (soft warm-grey bark, never crushed black) */
    if (vIsLeaf < 0.5) {
      float bLit = clamp((dot(N, sunDir) + 0.35) / 1.35, 0.0, 1.0);
      float bShade = 1.0 - max(shMap.r * 0.36, shMap.g * 0.34) * uStudioShadow;
      vec3 barkCol = tex.rgb * vec3(0.56, 0.50, 0.42) * (vec3(0.32, 0.38, 0.36) + vec3(1.10, 1.04, 0.88) * bLit * bShade) * (0.55 + 0.45 * vAO);
      gl_FragColor = vec4(barkCol, 1.0);
      #include <colorspace_fragment>
      return;
    }

    /* Spherical + Upward-Biased Crown Shading: fluffy dome illumination with wrap diffuse (ZERO black card artifacts!) */
    float ndl = dot(N, sunDir);
    float wrapSun = clamp((ndl + 0.42) / 1.42, 0.0, 1.0);
    float sunCrescent = smoothstep(0.05, 0.92, wrapSun);
    float castShade = 1.0 - shMap.g * 0.38 * (1.0 - smoothstep(0.42, 0.88, vCrownH)) * uStudioShadow;
    float sunVis = (0.36 + 0.64 * hillSun) * castShade;

    /* Preserve real species leaf texture while brightening & harmonizing directly with Scottish Highland moss-olive turf! */
    float texLum = dot(tex.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 leafHue = tex.rgb / max(texLum, 0.06);
    float leafDetail = clamp(0.68 + texLum * 1.15, 0.64, 1.32);

    float warmT = clamp((vTint.r - 0.28) / 0.82, 0.0, 1.0);
    float topSun = smoothstep(0.35, 0.96, vCrownH);
    /* Nordic Highlands / Scottish Valley harmonized palette: velvety moss base -> olive-sage mid -> warm sunlit yellow-green tips */
    vec3 cDeep = vec3(0.052, 0.104, 0.064);
    vec3 cMid  = vec3(0.108, 0.186, 0.092);
    vec3 cSun  = vec3(0.218, 0.278, 0.106);
    vec3 ecoCol = mix(
      mix(cDeep, cMid, smoothstep(0.0, 0.62, warmT * 0.65 + topSun * 0.55)),
      cSun,
      smoothstep(0.38, 0.98, topSun * 0.72 + warmT * 0.40) * (0.45 + 0.55 * hillSun)
    );
    vec3 baseCol = mix(tex.rgb * vec3(0.66, 0.80, 0.62), ecoCol * mix(vec3(1.0), leafHue * vec3(0.92, 1.02, 0.90), 0.32) * leafDetail, 0.78) * (0.90 + 0.20 * vRnd);

    vec3 plateC = texture2D(tPlate, clamp(vFootUv, 0.0, 1.0)).rgb;
    baseCol = mix(plateC * leafDetail * 0.98, baseCol, clamp(uStudioStyle, 0.0, 1.0));

    /* Soft grounded crown AO (clamped >= 0.42 so interior shadows stay plush mossy green, never dead black!) */
    float aoSoft = mix(0.42, 1.0, smoothstep(0.10, 0.95, vAO));
    vec3 skyAmb = vec3(0.16, 0.23, 0.26) * (0.48 + 0.52 * max(0.0, N.y));
    vec3 sunKey = vec3(1.38, 1.40, 1.24) * sunCrescent * sunVis;
    vec3 col = baseCol * (skyAmb * (0.52 + 0.48 * aoSoft) + sunKey * (0.34 + 0.66 * aoSoft));

    /* Backlight subsurface translucency (SSS) + warm sunlit rim glow through outer leaves */
    float backView = pow(clamp(dot(V, -sunDir), 0.0, 1.0), 2.4);
    float rimGrazing = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0);
    float sssMask = (backView * 0.68 + rimGrazing * 0.46) * smoothstep(0.28, 0.96, vCrownH) * sunVis * aoSoft;
    col += vec3(0.14, 0.21, 0.07) * sssMask * (0.55 + 0.65 * warmT) * uSunGlow;

    /* Warm sunlit crown-top tender yellow-green kiss */
    float topRim = smoothstep(0.56, 0.98, vCrownH) * smoothstep(0.18, 0.85, wrapSun) * sunVis * aoSoft;
    col += vec3(0.075, 0.115, 0.042) * topRim * uSunGlow;

    /* Subtle distance atmospheric aerial fog blending distant groves cleanly into Nordic mountain air */
    float camDist = length(cameraPosition - vWorld);
    float distFog = smoothstep(20.0, 56.0, camDist) * 0.22;
    col = mix(col, vec3(0.10, 0.15, 0.19), distFog);

    if (uHaze > 0.001) {
      float far = clamp((camDist - uDist) / max(uDist, 1.0) * 4.5, 0.0, 1.0);
      float low = 1.0 - smoothstep(0.12, 0.85, vWorld.y);
      vec3 hazeCol = mix(vec3(0.58, 0.74, 0.74), vec3(0.86, 0.92, 0.80), smoothstep(-3.0, 6.0, vWorld.x - vWorld.z));
      col = mix(col, hazeCol, far * (0.26 + 0.74 * low) * uHaze * 0.42);
    }

    vec2 sc = (gl_FragCoord.xy - uView.xy) / max(uView.zw, vec2(1.0)) - 0.5;
    col *= 1.0 - uVig * smoothstep(0.5, 1.9, dot(sc, sc) * 4.0);

    gl_FragColor = vec4(col, cov);
    #include <colorspace_fragment>
  }
`,STUDIO_ROCK_VERT=`
  attribute float aYOff;

  uniform sampler2D tCanopy;
  uniform vec4 uBounds;
  uniform vec2 uYRange;
  uniform float uRelief;

  varying vec3 vWorld, vNormalW;
  varying vec2 vUv, vFootUv;
  varying float vRnd, vLocalY;

  float rkHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float rkNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(rkHash(i), rkHash(i + vec2(1.0, 0.0)), f.x),
               mix(rkHash(i + vec2(0.0, 1.0)), rkHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float rkLakeCarve(vec2 p) {
    vec2 q = (p - vec2(0.122, -0.056)) / vec2(1.66, 1.42);
    float r = length(q);
    float ang = atan(q.y, q.x);
    float wobble = 0.085 * sin(ang * 3.0 + 0.7) + 0.055 * cos(ang * 5.0 - 1.2) + 0.035 * sin(ang * 7.0 + 2.4);
    float cove = (rkNoise(p * 1.45 + vec2(3.7, -2.1)) - 0.5) * 0.055;
    float lr = r + wobble + cove;
    float cragN = (rkNoise(p * 3.1 + vec2(-2.4, 5.1)) - 0.5) * 0.095
                + (rkNoise(p * 7.6 + vec2(6.1, -3.3)) - 0.5) * 0.036;
    return 1.0 - smoothstep(0.93, 1.17, lr + cragN);
  }
  void rkSeg(vec2 p, vec2 a, vec2 b, inout float minD) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    minD = min(minD, length(pa - ba * h));
  }
  float rkCoreRiverCarve(vec2 p) {
    float minD = 9.0;
    if (p.x < 0.2 && p.y < 0.2) {
      rkSeg(p, vec2(-6.34, -3.65), vec2(-5.85, -3.23), minD); rkSeg(p, vec2(-5.85, -3.23), vec2(-5.15, -3.21), minD);
      rkSeg(p, vec2(-5.15, -3.21), vec2(-4.55, -3.03), minD); rkSeg(p, vec2(-4.55, -3.03), vec2(-4.26, -2.59), minD);
      rkSeg(p, vec2(-4.26, -2.59), vec2(-3.51, -2.30), minD); rkSeg(p, vec2(-3.51, -2.30), vec2(-2.86, -1.99), minD);
      rkSeg(p, vec2(-2.86, -1.99), vec2(-2.64, -1.58), minD); rkSeg(p, vec2(-2.64, -1.58), vec2(-2.10, -1.39), minD);
      rkSeg(p, vec2(-2.10, -1.39), vec2(-1.39, -1.24), minD); rkSeg(p, vec2(-1.39, -1.24), vec2(-0.79, -0.83), minD);
    }
    if (p.x > 0.2 && p.y < 0.2) {
      rkSeg(p, vec2(5.66, -3.76), vec2(5.34, -3.23), minD); rkSeg(p, vec2(5.34, -3.23), vec2(5.25, -2.80), minD);
      rkSeg(p, vec2(5.25, -2.80), vec2(4.82, -2.57), minD); rkSeg(p, vec2(4.82, -2.57), vec2(4.24, -2.49), minD);
      rkSeg(p, vec2(4.24, -2.49), vec2(3.70, -2.26), minD); rkSeg(p, vec2(3.70, -2.26), vec2(3.62, -1.91), minD);
      rkSeg(p, vec2(3.62, -1.91), vec2(3.42, -1.46), minD); rkSeg(p, vec2(3.42, -1.46), vec2(2.91, -1.31), minD);
      rkSeg(p, vec2(2.91, -1.31), vec2(2.36, -1.20), minD); rkSeg(p, vec2(2.36, -1.20), vec2(1.72, -1.19), minD);
      rkSeg(p, vec2(1.72, -1.19), vec2(1.18, -0.88), minD);
    }
    if (p.x > 0.2 && p.y > -0.2) {
      rkSeg(p, vec2(6.80, 3.78), vec2(6.26, 3.14), minD); rkSeg(p, vec2(6.26, 3.14), vec2(5.67, 2.78), minD);
      rkSeg(p, vec2(5.67, 2.78), vec2(5.17, 2.68), minD); rkSeg(p, vec2(5.17, 2.68), vec2(4.56, 2.41), minD);
      rkSeg(p, vec2(4.56, 2.41), vec2(3.90, 2.30), minD); rkSeg(p, vec2(3.90, 2.30), vec2(3.25, 2.33), minD);
      rkSeg(p, vec2(3.25, 2.33), vec2(2.65, 2.17), minD); rkSeg(p, vec2(2.65, 2.17), vec2(2.53, 1.60), minD);
      rkSeg(p, vec2(2.53, 1.60), vec2(2.26, 1.15), minD); rkSeg(p, vec2(2.26, 1.15), vec2(1.58, 0.91), minD);
      rkSeg(p, vec2(1.58, 0.91), vec2(1.12, 0.58), minD);
    }
    if (p.x < 0.2 && p.y > -0.4) {
      rkSeg(p, vec2(-6.98, 1.50), vec2(-6.47, 1.38), minD); rkSeg(p, vec2(-6.47, 1.38), vec2(-6.00, 1.41), minD);
      rkSeg(p, vec2(-6.00, 1.41), vec2(-5.43, 1.27), minD); rkSeg(p, vec2(-5.43, 1.27), vec2(-4.95, 1.05), minD);
      rkSeg(p, vec2(-4.95, 1.05), vec2(-4.41, 0.70), minD); rkSeg(p, vec2(-4.41, 0.70), vec2(-4.04, 0.58), minD);
      rkSeg(p, vec2(-4.04, 0.58), vec2(-3.48, 0.53), minD); rkSeg(p, vec2(-3.48, 0.53), vec2(-2.98, 0.52), minD);
      rkSeg(p, vec2(-2.98, 0.52), vec2(-2.53, 0.50), minD); rkSeg(p, vec2(-2.53, 0.50), vec2(-2.27, 0.19), minD);
      rkSeg(p, vec2(-2.27, 0.19), vec2(-1.42, 0.06), minD);
    }
    if (minD > 1.2) return 0.0;
    float bankRough = rkNoise(p * 2.1 + vec2(4.2, -1.7));
    float nearLake = 1.0 - smoothstep(1.3, 2.5, length(p - vec2(0.122, -0.056)));
    float w = mix(0.124, 0.195, nearLake) * (0.86 + 0.28 * bankRough);
    float cragR = (rkNoise(p * 4.2 + vec2(1.9, -4.3)) - 0.5) * 0.030;
    return 1.0 - smoothstep(w * 1.16, w * 1.88 + 0.08, minD + cragR);
  }

  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    float id = float(gl_InstanceID);
    vRnd = fract(sin(id * 37.13 + 19.71) * 43758.5453);

    vec4 foot = m * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 fuv = (foot.xz - uBounds.xy) * uBounds.zw;
    float hC = texture2D(tCanopy, clamp(fuv, 0.002, 0.998)).r;
    float rawGround = max(0.105, 0.105 + (uYRange.x + hC * uYRange.y - 0.105) * uRelief);
    /* Exact carved rocky cliff elevation matching lake precipice & 4 core rivers -> ZERO floating rocks! */
    float carve = max(rkLakeCarve(foot.xz), rkCoreRiverCarve(foot.xz));
    float rawRel = max(0.0, rawGround - 0.105);
    float cliffBoost = smoothstep(0.003, 0.055, rawRel) * (1.0 - smoothstep(0.065, 0.16, rawRel));
    float cragStep = 0.55 + 0.45 * rkNoise(foot.xz * 2.8 + vec2(3.7, -5.2));
    float cliffY = rawGround + cliffBoost * 0.055 * uRelief * cragStep;
    float cliffRise = pow(max(0.0, 1.0 - carve), 0.58);
    float ground = max(0.105, mix(0.105, cliffY, cliffRise));

    vec4 rawW = m * vec4(position, 1.0);
    vec3 worldP = vec3(foot.x, ground + aYOff, foot.z) + (rawW.xyz - foot.xyz);

    mat3 nm = mat3(m);
    vec3 sx = vec3(length(nm[0]), length(nm[1]), length(nm[2]));
    vNormalW = normalize(nm * (normal / max(sx, vec3(1e-4))));
    vWorld = worldP;
    vUv = uv;
    vFootUv = fuv;
    vLocalY = worldP.y - ground;

    gl_Position = projectionMatrix * viewMatrix * vec4(worldP, 1.0);
  }
`,STUDIO_ROCK_FRAG=`
  uniform sampler2D tRockAtlas, tRockNrm, tRockDetail, tRockDetailNrm, tStudioShadow;
  uniform vec3 uSun;
  uniform vec4 uView;
  uniform float uStudioShadow, uHaze, uDist, uVig, uMirror, uTime;

  varying vec3 vWorld, vNormalW;
  varying vec2 vUv, vFootUv;
  varying float vRnd, vLocalY;

  float rHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float rNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(rHash(i), rHash(i + vec2(1.0, 0.0)), f.x),
               mix(rHash(i + vec2(0.0, 1.0)), rHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  /* GLSL ES 1.00 cotangent-frame TBN for crisp true 2K tangent-space NormalGL! */
  mat3 rCotangentFrame(vec3 N, vec3 p, vec2 uv) {
    vec3 dp1 = dFdx(p);
    vec3 dp2 = dFdy(p);
    vec2 duv1 = dFdx(uv);
    vec2 duv2 = dFdy(uv);
    vec3 dp2perp = cross(dp2, N);
    vec3 dp1perp = cross(N, dp1);
    vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
    vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
    float invmax = inversesqrt(max(dot(T, T), dot(B, B)) + 1e-8);
    return mat3(T * invmax, B * invmax, N);
  }

  void main() {
    if (uMirror > 0.5 && vWorld.y < 0.106) discard;

    vec3 Ng = normalize(vNormalW);
    vec3 sunDir = normalize(uSun);
    vec3 V = normalize(cameraPosition - vWorld);

    /* True 2K Photogrammetry Albedo + Roughness + Tangent-Space NormalGL */
    vec4 albRgh = texture2D(tRockAtlas, vUv);
    vec3 tsN = texture2D(tRockNrm, vUv).rgb * 2.0 - 1.0;
    tsN.xy *= 1.55;
    tsN = normalize(tsN);
    mat3 TBN = rCotangentFrame(Ng, vWorld, vUv);
    vec3 N = normalize(TBN * tsN);

    /* Close-up 2K Triplanar micro-slate detail overlay so rocks stay razor-sharp & seamlessly fuse with canyon slate walls! */
    vec3 absNg = abs(Ng);
    vec2 uvDet = (absNg.y >= absNg.x && absNg.y >= absNg.z)
      ? vWorld.xz * 6.5
      : (absNg.x >= absNg.z ? vWorld.zy * 6.5 : vWorld.xy * 6.5);
    vec3 detAlb = texture2D(tRockDetail, uvDet).rgb;
    vec2 detNxy = texture2D(tRockDetailNrm, uvDet).ba * 2.0 - 1.0;
    N = normalize(N + (TBN[0] * detNxy.x + TBN[1] * detNxy.y) * 0.34);

    float lum = dot(albRgh.rgb, vec3(0.2126, 0.7152, 0.0722));
    float rough = clamp(albRgh.a, 0.30, 0.96);

    /* Cool silvery alpine granite-slate palette matching the surrounding canyon cliff walls (zero dark chocolate blobs!) */
    vec3 slateTone = vec3(lum * 1.18 + 0.03) * vec3(0.90, 0.96, 1.03);
    vec3 rockTint = mix(vec3(0.74, 0.80, 0.86), vec3(1.02, 1.06, 1.10), vRnd);
    vec3 alb = mix(slateTone, albRgh.rgb * 1.15, 0.26) * rockTint;
    alb = mix(alb, detAlb * 1.38 + vec3(0.025, 0.030, 0.036), 0.34);

    /* Gentle natural crevice & ground-contact AO (grounds base cleanly without harsh black outline) */
    float contactAO = mix(0.66, 1.0, smoothstep(-0.004, 0.042, vLocalY));
    float creviceAO = clamp(0.68 + 0.32 * tsN.z, 0.48, 1.0);

    float ndl = clamp(dot(N, sunDir), 0.0, 1.0);
    vec3 shS = texture2D(tStudioShadow, clamp(vFootUv, 0.0, 1.0)).rgb;
    float shVis = 1.0 - max(shS.g * 0.50, shS.r * 0.34) * uStudioShadow;

    /* Natural alpine moss & lichen settling softly on dry upward-facing rock ledges (matched to terrain moss!) */
    float dry = smoothstep(0.128, 0.185, vWorld.y);
    float mossNoise = rNoise(vWorld.xz * 12.0 + vRnd * 9.0) * 0.62 + rNoise(vWorld.xz * 32.0) * 0.38;
    float mossMask = smoothstep(0.60, 0.88, N.y) * smoothstep(0.40, 0.74, mossNoise) * dry;
    vec3 mossCol = vec3(0.095, 0.165, 0.078) * (0.76 + 0.48 * mossNoise);
    alb = mix(alb, mossCol, mossMask * 0.55);
    rough = mix(rough, 0.92, mossMask * 0.55);

    /* Wet glossy dark slate rim strictly right near waterline (y = 0.105 .. 0.125) */
    float wet = 1.0 - smoothstep(0.104, 0.125, vWorld.y);
    alb *= mix(1.0, 0.56, wet);
    rough = mix(rough, 0.18, wet);

    /* Luminous cool-blue alpine sky fill matching terrain cliffs so shadow faces stay natural slate-grey */
    vec3 amb = vec3(0.28, 0.35, 0.43) * (0.46 + 0.54 * max(0.0, N.y)) + vec3(0.09, 0.11, 0.10) * (1.0 - max(0.0, N.y));
    vec3 sun = vec3(1.48, 1.45, 1.36) * smoothstep(0.02, 0.88, ndl) * shVis;
    vec3 col = alb * contactAO * creviceAO * (amb + sun);

    /* Physically grounded roughness-driven mineral + wet Fresnel specular */
    vec3 H = normalize(V + sunDir);
    float ndh = max(dot(N, H), 0.0);
    float specPow = mix(64.0, 12.0, rough);
    float spec = pow(ndh, specPow) * (1.0 - rough * 0.72) * shVis;
    float wetFres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.6) * wet;
    col += mix(vec3(0.50, 0.54, 0.58), vec3(0.75, 0.86, 0.94), wet) * spec * mix(0.28, 0.65, wet);
    col += vec3(0.22, 0.36, 0.48) * wetFres * 0.38;

    /* Whisper-thin broken water-lap collar right at y = 0.106 */
    float lap = exp(-pow((vWorld.y - 0.1062) / 0.0034, 2.0));
    float lapBreak = smoothstep(0.44, 0.78, rNoise(vWorld.xz * 30.0 + vec2(uTime * 0.22, -uTime * 0.16)));
    col = mix(col, vec3(0.78, 0.86, 0.92), lap * lapBreak * 0.38);

    if (uHaze > 0.001) {
      float far = clamp((length(cameraPosition - vWorld) - uDist) / max(uDist, 1.0) * 4.5, 0.0, 1.0);
      float low = 1.0 - smoothstep(0.12, 0.85, vWorld.y);
      col = mix(col, vec3(0.62, 0.76, 0.76), far * (0.28 + 0.72 * low) * uHaze * 0.42);
    }

    vec2 sc = (gl_FragCoord.xy - uView.xy) / max(uView.zw, vec2(1.0)) - 0.5;
    col *= 1.0 - uVig * smoothstep(0.5, 1.9, dot(sc, sc) * 4.0);
    col = col / (1.0 + col * 0.18);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`,STUDIO_GRASS_VERT=`
  attribute vec3 aGrassCol;

  uniform sampler2D tCanopy;
  uniform vec4 uBounds;
  uniform vec2 uYRange;
  uniform vec3 uSun;
  uniform float uRelief, uTime, uWind;

  varying vec3 vWorld, vNormalW, vCol;
  varying vec2 vUv, vFootUv;
  varying float vH, vTerrSun;

  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 foot = m * vec4(0.0, 0.0, 0.0, 1.0);
    vec2 fuv = (foot.xz - uBounds.xy) * uBounds.zw;
    vec2 cfuv = clamp(fuv, 0.002, 0.998);
    float hC = texture2D(tCanopy, cfuv).r;
    float ground = max(0.105 + (uYRange.x + hC * uYRange.y - 0.105) * uRelief, 0.105);

    vec2 te = vec2(0.0045, 0.0080);
    float hL = texture2D(tCanopy, clamp(cfuv - vec2(te.x, 0.0), 0.0, 1.0)).r;
    float hR = texture2D(tCanopy, clamp(cfuv + vec2(te.x, 0.0), 0.0, 1.0)).r;
    float hD = texture2D(tCanopy, clamp(cfuv - vec2(0.0, te.y), 0.0, 1.0)).r;
    float hU = texture2D(tCanopy, clamp(cfuv + vec2(0.0, te.y), 0.0, 1.0)).r;
    vec3 tN = normalize(vec3(-(hR - hL) * 10.0 * uRelief, 1.0, -(hU - hD) * 10.0 * uRelief));
    vTerrSun = clamp(dot(tN, normalize(uSun)), 0.0, 1.0);

    float hNorm = clamp(position.y, 0.0, 1.0);
    vec4 rawW = m * vec4(position, 1.0);
    vec3 off = rawW.xyz - foot.xyz;
    /* Rolling meadow wind ripple across photogrammetry grass blades & fern fronds */
    float wave = sin(uTime * 1.85 + foot.x * 3.4 + foot.z * 2.7) * 0.007 * uWind * hNorm * hNorm;
    off.x += wave;
    off.z += wave * 0.55;

    vec3 worldP = vec3(foot.x, ground - 0.004, foot.z) + off;
    vWorld = worldP;
    vNormalW = normalize(mat3(m) * normal);
    vCol = aGrassCol;
    vUv = uv;
    vFootUv = fuv;
    vH = hNorm;

    gl_Position = projectionMatrix * viewMatrix * vec4(worldP, 1.0);
  }
`,STUDIO_GRASS_FRAG=`
  uniform sampler2D tGroundCoverAtlas, tStudioShadow;
  uniform vec3 uSun;
  uniform vec4 uView;
  uniform float uStudioShadow, uHaze, uDist, uVig, uMirror;

  varying vec3 vWorld, vNormalW, vCol;
  varying vec2 vUv, vFootUv;
  varying float vH, vTerrSun;

  void main() {
    if (uMirror > 0.5 && vWorld.y < 0.106) discard;

    vec3 sunDir = normalize(uSun);
    vec3 N = normalize(vNormalW);
    if (!gl_FrontFacing) N = -N;

    vec3 tex = texture2D(tGroundCoverAtlas, vUv).rgb;
    float hillSun = smoothstep(0.14, 0.85, vTerrSun);
    float bladeSun = clamp(dot(N, sunDir) * 0.55 + 0.45, 0.0, 1.0);
    vec3 shS = texture2D(tStudioShadow, clamp(vFootUv, 0.0, 1.0)).rgb;
    float shVis = 1.0 - max(shS.g * 0.65, shS.r * 0.55) * uStudioShadow;

    /* Root-to-tip self-occlusion + cool Nordic alpine sage/emerald reeds & ferns matching Image 2 & 3 */
    float rootAO = mix(0.54, 1.24, smoothstep(0.0, 0.88, vH));
    vec3 baseC = mix(tex * vec3(0.78, 0.96, 0.88), tex * vCol * vec3(0.95, 1.22, 1.08), 0.52);
    vec3 tipTint = mix(baseC, baseC * vec3(1.08, 1.16, 0.92), smoothstep(0.38, 1.0, vH));
    vec3 col = tipTint * (vec3(0.24, 0.34, 0.34) + vec3(1.38, 1.42, 1.24) * (0.34 + 0.66 * hillSun) * bladeSun * shVis) * rootAO;

    if (uHaze > 0.001) {
      float far = clamp((length(cameraPosition - vWorld) - uDist) / max(uDist, 1.0) * 4.5, 0.0, 1.0);
      float low = 1.0 - smoothstep(0.12, 0.85, vWorld.y);
      col = mix(col, vec3(0.62, 0.76, 0.76), far * (0.28 + 0.72 * low) * uHaze * 0.42);
    }
    vec2 sc = (gl_FragCoord.xy - uView.xy) / max(uView.zw, vec2(1.0)) - 0.5;
    col *= 1.0 - uVig * smoothstep(0.5, 1.9, dot(sc, sc) * 4.0);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`,MIST_VERT=`
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`,MIST_FRAG=`
  uniform float uTime, uMist, uSeed, uWarm;
  varying vec2 vUv;
  varying vec3 vWorld;

  float mHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float mNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mHash(i), mHash(i + vec2(1.0, 0.0)), f.x),
               mix(mHash(i + vec2(0.0, 1.0)), mHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float mFbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * mNoise(p); p = p * 2.05 + vec2(13.1, 7.7); a *= 0.5; }
    return v;
  }

  void main() {
    vec2 d = (vUv - 0.5) * 2.0;
    float radial = 1.0 - smoothstep(0.18, 1.0, dot(d, d));
    vec2 p = vUv * 2.6 + vec2(uSeed + uTime * 0.012, uSeed * 0.7 - uTime * 0.007);
    float wisp = smoothstep(0.32, 0.76, mFbm(p) * 0.7 + mFbm(p * 1.9 + 4.2) * 0.3);
    float alpha = radial * wisp * uMist;
    if (alpha < 0.003) discard;
    vec3 coolMist = vec3(0.76, 0.88, 0.86);
    vec3 sunMist  = vec3(1.00, 0.98, 0.88);
    vec3 col = mix(coolMist, sunMist, uWarm);
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;function buildExtendedReliefGrid(width,depth,nx,nz,skirt,sn){const easeOut=t=>t*.65+t*t*.35,line=(n,size)=>{const a=[];for(let i=0;i<sn;i++){const f=(sn-i)/sn;a.push(-size/2-skirt*easeOut(f))}for(let i=0;i<=n;i++)a.push(-size/2+size*i/n);for(let i=1;i<=sn;i++){const f=i/sn;a.push(size/2+skirt*easeOut(f))}return a},xs=line(nx,width),zs=line(nz,depth),cx=xs.length-1,cz=zs.length-1,pos=new Float32Array(xs.length*zs.length*3),idx=new Uint32Array(cx*cz*6);let p=0,q=0;for(const z of zs)for(const x of xs)pos[p++]=x,pos[p++]=0,pos[p++]=z;for(let j=0;j<cz;j++)for(let i=0;i<cx;i++){const a=j*(cx+1)+i,b=a+1,c=a+cx+1,d2=c+1;idx[q++]=a,idx[q++]=c,idx[q++]=b,idx[q++]=b,idx[q++]=c,idx[q++]=d2}const g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.BufferAttribute(pos,3)),g.setIndex(new THREE.BufferAttribute(idx,1));const w=width+2*skirt,d=depth+2*skirt;return g.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,.8,0),Math.hypot(w,d)/2+3),g.boundingBox=new THREE.Box3(new THREE.Vector3(-w/2,0,-d/2),new THREE.Vector3(w/2,3,d/2)),g}export function makeWatershedGlsl(noiseFn){return`
    /* Widened organic central confluence lake basin around load_logo2.svg center (0.122, -0.056) */
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

    /* Smooth maximum for natural flared river confluences & valley joins (zero phantom bleed on dry land) */
    float stSmax(float a, float b, float k) {
      float mn = min(a, b);
      if (mn <= 0.0) return max(a, b);
      float h = max(k - abs(a - b), 0.0) / k;
      return max(a, b) + h * h * min(mn, k * 0.25);
    }

    /* Capsule segment helper for continuous core river bridging (smooth Gaussian downstream tangent) */
    void stSegAcc(vec2 p, vec2 a, vec2 b, inout float minD, inout vec2 dirAcc) {
      vec2 pa = p - a, ba = b - a;
      float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
      float d = length(pa - ba * h);
      minD = min(minD, d);
      dirAcc += normalize(ba) * exp(-d * 10.0);
    }

    /* Continuous unbroken core river channels along NW, NE, SE, SW from outer mouths right into the widened lake! */
    vec3 stCoreRivers(vec2 p, out vec2 flowDir) {
      flowDir = vec2(0.0);
      if (abs(p.x) > 7.55 || abs(p.y) > 4.45) return vec3(0.0);
      float minD = 9.0;
      vec2 bDir = vec2(0.0);

      /* NW Core River -> Lake */
      if (p.x < 0.2 && p.y < 0.2) {
        stSegAcc(p, vec2(-6.34, -3.65), vec2(-5.85, -3.23), minD, bDir);
        stSegAcc(p, vec2(-5.85, -3.23), vec2(-5.15, -3.21), minD, bDir);
        stSegAcc(p, vec2(-5.15, -3.21), vec2(-4.55, -3.03), minD, bDir);
        stSegAcc(p, vec2(-4.55, -3.03), vec2(-4.26, -2.59), minD, bDir);
        stSegAcc(p, vec2(-4.26, -2.59), vec2(-3.51, -2.30), minD, bDir);
        stSegAcc(p, vec2(-3.51, -2.30), vec2(-2.86, -1.99), minD, bDir);
        stSegAcc(p, vec2(-2.86, -1.99), vec2(-2.64, -1.58), minD, bDir);
        stSegAcc(p, vec2(-2.64, -1.58), vec2(-2.10, -1.39), minD, bDir);
        stSegAcc(p, vec2(-2.10, -1.39), vec2(-1.39, -1.24), minD, bDir);
        stSegAcc(p, vec2(-1.39, -1.24), vec2(-0.79, -0.83), minD, bDir);
      }
      /* NE Core River -> Lake */
      if (p.x > 0.2 && p.y < 0.2) {
        stSegAcc(p, vec2(5.66, -3.76), vec2(5.34, -3.23), minD, bDir);
        stSegAcc(p, vec2(5.34, -3.23), vec2(5.25, -2.80), minD, bDir);
        stSegAcc(p, vec2(5.25, -2.80), vec2(4.82, -2.57), minD, bDir);
        stSegAcc(p, vec2(4.82, -2.57), vec2(4.24, -2.49), minD, bDir);
        stSegAcc(p, vec2(4.24, -2.49), vec2(3.70, -2.26), minD, bDir);
        stSegAcc(p, vec2(3.70, -2.26), vec2(3.62, -1.91), minD, bDir);
        stSegAcc(p, vec2(3.62, -1.91), vec2(3.42, -1.46), minD, bDir);
        stSegAcc(p, vec2(3.42, -1.46), vec2(2.91, -1.31), minD, bDir);
        stSegAcc(p, vec2(2.91, -1.31), vec2(2.36, -1.20), minD, bDir);
        stSegAcc(p, vec2(2.36, -1.20), vec2(1.72, -1.19), minD, bDir);
        stSegAcc(p, vec2(1.72, -1.19), vec2(1.18, -0.88), minD, bDir);
      }
      /* SE Core River -> Lake */
      if (p.x > 0.2 && p.y > -0.2) {
        stSegAcc(p, vec2(6.80, 3.78), vec2(6.26, 3.14), minD, bDir);
        stSegAcc(p, vec2(6.26, 3.14), vec2(5.67, 2.78), minD, bDir);
        stSegAcc(p, vec2(5.67, 2.78), vec2(5.17, 2.68), minD, bDir);
        stSegAcc(p, vec2(5.17, 2.68), vec2(4.56, 2.41), minD, bDir);
        stSegAcc(p, vec2(4.56, 2.41), vec2(3.90, 2.30), minD, bDir);
        stSegAcc(p, vec2(3.90, 2.30), vec2(3.25, 2.33), minD, bDir);
        stSegAcc(p, vec2(3.25, 2.33), vec2(2.65, 2.17), minD, bDir);
        stSegAcc(p, vec2(2.65, 2.17), vec2(2.53, 1.60), minD, bDir);
        stSegAcc(p, vec2(2.53, 1.60), vec2(2.26, 1.15), minD, bDir);
        stSegAcc(p, vec2(2.26, 1.15), vec2(1.58, 0.91), minD, bDir);
        stSegAcc(p, vec2(1.58, 0.91), vec2(1.12, 0.58), minD, bDir);
      }
      /* SW Core River -> Lake */
      if (p.x < 0.2 && p.y > -0.4) {
        stSegAcc(p, vec2(-6.98, 1.50), vec2(-6.47, 1.38), minD, bDir);
        stSegAcc(p, vec2(-6.47, 1.38), vec2(-6.00, 1.41), minD, bDir);
        stSegAcc(p, vec2(-6.00, 1.41), vec2(-5.43, 1.27), minD, bDir);
        stSegAcc(p, vec2(-5.43, 1.27), vec2(-4.95, 1.05), minD, bDir);
        stSegAcc(p, vec2(-4.95, 1.05), vec2(-4.41, 0.70), minD, bDir);
        stSegAcc(p, vec2(-4.41, 0.70), vec2(-4.04, 0.58), minD, bDir);
        stSegAcc(p, vec2(-4.04, 0.58), vec2(-3.48, 0.53), minD, bDir);
        stSegAcc(p, vec2(-3.48, 0.53), vec2(-2.98, 0.52), minD, bDir);
        stSegAcc(p, vec2(-2.98, 0.52), vec2(-2.53, 0.50), minD, bDir);
        stSegAcc(p, vec2(-2.53, 0.50), vec2(-2.27, 0.19), minD, bDir);
        stSegAcc(p, vec2(-2.27, 0.19), vec2(-1.42, 0.06), minD, bDir);
      }

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

    /* Returns vec3(waterMask, valleyCarve, shoreDepth) & exact local downstream tangent for one domain-warped river/tributary */
    vec3 stStreamEx(vec2 p, vec2 o, vec2 d, float len, float w0, float w1, float amp, float freq, float ph, float bankRough, inout vec2 flowAcc, inout float flowW) {
      vec2 perp = vec2(-d.y, d.x);
      vec2 rel = p - o;
      float t = dot(rel, d);
      float s = dot(rel, perp);
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
      float wmS = 1.0 - smoothstep(w * 0.52, w * 1.02, dist);
      float shS = 1.0 - smoothstep(0.0, w * 1.02, dist);
      float flatFloor = max(w * 1.38, 0.13);
      float vSlope = 1.0 - smoothstep(flatFloor, w * 4.4 + 1.55, dist);
      float carve = pow(clamp(vSlope, 0.0, 1.0), 1.65);
      if (wmS > 0.01) {
        /* Negative tangent points DOWNSTREAM toward the central lake! */
        vec2 downDir = -normalize(d + perp * clamp(dMeand, -1.2, 1.2));
        flowAcc += downDir * wmS;
        flowW += wmS;
      }
      return vec3(wmS, carve, shS);
    }

    vec3 stCombineStream(vec3 a, vec3 b) {
      return vec3(
        stSmax(a.x, b.x, 0.18),
        stSmax(a.y, b.y, 0.22),
        max(a.z, b.z)
      );
    }

    /* Full extended outer watershed + analytical downstream flow direction: 4 continuing main rivers + 9 acute-angle tributaries */
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

      /* 4 Main Rivers matching exact core exit widths (0.155) & tangents seamlessly (ZERO border step!) */
      r = stCombineStream(r, stStreamEx(pw, vec2(-6.26, -3.57), normalize(vec2(-0.76, -0.65)), 12.4, 0.155, 0.095, 0.78, 0.44, 0.4, bankRough, fAcc, fW));  /* NW Main */
      r = stCombineStream(r, stStreamEx(pw, vec2( 5.58, -3.64), normalize(vec2( 0.50, -0.86)), 12.2, 0.160, 0.100, 0.85, 0.42, 1.9, bankRough, fAcc, fW));  /* NE Main */
      r = stCombineStream(r, stStreamEx(pw, vec2(-6.86,  1.47), normalize(vec2(-0.88,  0.47)), 12.0, 0.155, 0.095, 0.74, 0.46, 3.1, bankRough, fAcc, fW));  /* SW Main */
      r = stCombineStream(r, stStreamEx(pw, vec2( 6.72,  3.68), normalize(vec2( 0.62,  0.78)), 12.0, 0.165, 0.105, 0.82, 0.40, 5.2, bankRough, fAcc, fW));  /* SE Main */

      /* 9 Natural Acute-Angle Mountain Tributary Creeks (\u5C0F\u652F\u6D41) \u2014 all flow downstream into the 4 main rivers */
      r = stCombineStream(r, stStreamEx(pw, vec2(-8.20, -5.15), normalize(vec2(-0.22, -0.97)),  8.8, 0.13, 0.048, 0.62, 0.68, 1.1, bankRough, fAcc, fW)); /* T1: NW -> North valley */
      r = stCombineStream(r, stStreamEx(pw, vec2(-9.65, -6.30), normalize(vec2(-0.98, -0.18)),  8.2, 0.12, 0.048, 0.56, 0.74, 2.6, bankRough, fAcc, fW)); /* T2: NW -> Far West creek */
      r = stCombineStream(r, stStreamEx(pw, vec2( 6.85, -5.65), normalize(vec2(-0.18, -0.98)),  8.4, 0.14, 0.048, 0.66, 0.64, 4.0, bankRough, fAcc, fW)); /* T3: NE -> North-Center gorge */
      r = stCombineStream(r, stStreamEx(pw, vec2( 7.65, -7.15), normalize(vec2( 0.88, -0.47)),  8.8, 0.13, 0.048, 0.58, 0.70, 0.7, bankRough, fAcc, fW)); /* T4: NE -> Far NE ridge */
      r = stCombineStream(r, stStreamEx(pw, vec2( 6.45, -4.95), normalize(vec2( 0.94, -0.34)),  9.2, 0.12, 0.048, 0.65, 0.66, 5.5, bankRough, fAcc, fW)); /* T5: NE flank -> East gorge */
      r = stCombineStream(r, stStreamEx(pw, vec2(-9.85,  3.05), normalize(vec2(-0.96, -0.26)),  7.8, 0.12, 0.048, 0.54, 0.76, 1.8, bankRough, fAcc, fW)); /* T6: SW -> West-NW creek */
      r = stCombineStream(r, stStreamEx(pw, vec2(-9.15,  2.85), normalize(vec2(-0.34,  0.94)),  9.2, 0.14, 0.048, 0.64, 0.66, 3.4, bankRough, fAcc, fW)); /* T7: SW -> South-West valley */
      r = stCombineStream(r, stStreamEx(pw, vec2( 7.55,  5.85), normalize(vec2(-0.26,  0.96)),  8.8, 0.14, 0.050, 0.64, 0.64, 2.2, bankRough, fAcc, fW)); /* T8: SE -> South valley */
      r = stCombineStream(r, stStreamEx(pw, vec2( 8.25,  7.25), normalize(vec2( 0.86,  0.51)),  9.2, 0.13, 0.048, 0.60, 0.70, 4.7, bankRough, fAcc, fW)); /* T9: SE -> Far SE canyon */

      flowDir = fW > 0.001 ? normalize(fAcc / fW) : vec2(0.0);
      return r;
    }

    vec3 stWatershed(vec2 p, float outD) {
      vec2 tmpF;
      return stWatershedEx(p, outD, tmpF);
    }

    float stAlpineMountainH(vec2 xz) {
      /* Match the exact elevation rhythm & dramatic granite-ridge relief of the core terrain (0.16 .. 0.62) */
      float v = 0.0, a = 0.50;
      vec2 p = xz * 0.27 + vec2(4.1, -2.7);
      for (int i = 0; i < 4; i++) {
        float n = ${noiseFn}(p);
        v += a * mix(n, n * n * 1.45, 0.42);
        p = mat2(0.80, -0.60, 0.60, 0.80) * p * 2.06 + vec2(11.3, 6.7);
        a *= 0.48;
      }
      float crag = 1.0 - abs(${noiseFn}(xz * 0.48 + vec2(-6.4, 3.9)) * 2.0 - 1.0);
      return 0.16 + v * 0.36 + crag * crag * 0.16;
    }

    /* Natural V-valley carving: river bed at y=0.105, rising smoothly right outside water's edge into alpine slopes */
    float stOuterCarvedH(vec2 xz, vec3 ws) {
      float mH = stAlpineMountainH(xz);
      float valleyH = mix(mH, 0.105, ws.y);
      return max(0.105, mix(valleyH, 0.105, smoothstep(0.04, 0.36, ws.x)));
    }
  `}function patchTerrainMaterial(atlas,shadowTex,pbrTex,studioUniforms){let patched=!1;const seen=new Set;atlas.uniforms?.uSkirt&&atlas.uniforms.uSkirt.value.set(3.5/1494,3.5/836,0,0),atlas.uniforms?.uSkirtAir&&atlas.uniforms.uSkirtAir.value.set(99,120);const coreW=atlas.uniforms?.uBounds?1/atlas.uniforms.uBounds.value.z:14,coreD=atlas.uniforms?.uBounds?1/atlas.uniforms.uBounds.value.w:7.84;return atlas.terrain.traverse(obj=>{if(!obj.isMesh||!obj.material)return;if(obj.geometry&&!obj.userData.studioExtended){const oldGeo=obj.geometry;obj.geometry=buildExtendedReliefGrid(coreW,coreD,240,136,11.5,76),obj.frustumCulled=!1,obj.userData.studioExtended=!0,oldGeo.dispose?.()}if(seen.has(obj.material))return;seen.add(obj.material);const mat=obj.material;if(!mat.fragmentShader||mat.fragmentShader.includes("uStudioStyle"))return;if(mat.defines&&(delete mat.defines.FOREST_LOGO,delete mat.defines.FOREST_GROW),Object.assign(mat.uniforms,{tStudioShadow:{value:shadowTex},tMossCol:{value:pbrTex.mossCol},tAerialCol:{value:pbrTex.aerialCol},tGrassCol:{value:pbrTex.grassCol},tRockCol:{value:pbrTex.rockCol},tMossyRockCol:{value:pbrTex.mossyRockCol},tRiverBankCol:{value:pbrTex.riverBankCol},tPbrNrm:{value:pbrTex.pbrNrm},uStudioStyle:studioUniforms.uStudioStyle,uStudioShadow:studioUniforms.uStudioShadow,uStudioGrassPbr:studioUniforms.uStudioGrassPbr,uStudioTerrainOn:studioUniforms.uStudioTerrainOn}),mat.vertexShader&&!mat.vertexShader.includes("stWatershed")){const vFuncs=`
        float stVHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float stVNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(stVHash(i), stVHash(i + vec2(1.0, 0.0)), f.x),
                     mix(stVHash(i + vec2(0.0, 1.0)), stVHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        ${makeWatershedGlsl("stVNoise")}
      `,vInject=`
        #ifdef FOREST_RELIEF
        float stOutD = forestOut(uvR);
        vec3 stWS = stWatershed(p.xz, stOutD);
        vec3 stLB = stCentralLakeBasin(p.xz);
        vec2 stVCRFlow;
        vec3 stVCR = stOutD <= 0.35 ? stCoreRivers(p.xz, stVCRFlow) : vec3(0.0);
        if (stOutD > 0.0005) {
          /* Seamless height handoff from core border (0..2.2u) into 100% organic domain-warped alpine valleys & tributaries */
          float carvedH = 0.105 + (stOuterCarvedH(p.xz, stWS) - 0.105) * uRelief;
          float blendO = smoothstep(0.0, 2.25, stOutD);
          float borderCarved = mix(p.y, 0.105, max(stWS.y, max(smoothstep(0.05, 0.40, stWS.x), stVCR.y)));
          float targetY = mix(borderCarved, carvedH, blendO);
          float rimEase = 1.0 - smoothstep(8.6, 11.4, stOutD) * 0.22;
          p.y = max(0.105, 0.105 + (targetY - 0.105) * rimEase);
        } else {
          /* Carve widened organic central lake basin & 4 core rivers with sheer rocky cliff precipices (ZERO flat sandy beaches!) */
          float coreCarve = max(stLB.y, max(stVCR.y, smoothstep(0.10, 0.55, stWS.x)));
          float rawRel = max(0.0, p.y - 0.105);
          float cliffBoost = smoothstep(0.003, 0.055, rawRel) * (1.0 - smoothstep(0.065, 0.16, rawRel));
          float cragStep = 0.55 + 0.45 * stVNoise(p.xz * 2.8 + vec2(3.7, -5.2));
          float cliffY = p.y + cliffBoost * 0.055 * uRelief * cragStep;
          float cliffRise = pow(max(0.0, 1.0 - coreCarve), 0.58);
          p.y = max(0.105, mix(0.105, cliffY, cliffRise));
        }
        #endif
        vec4 w=modelMatrix*vec4(p,1.);
      `;mat.vertexShader=mat.vertexShader.replace("void main(){",vFuncs+`
void main(){`).replace("vec4 w=modelMatrix*vec4(p,1.);",vInject)}const decls=`
      uniform sampler2D tStudioShadow, tMossCol, tAerialCol, tGrassCol, tRockCol, tMossyRockCol, tRiverBankCol, tPbrNrm;
      uniform float uStudioStyle, uStudioShadow, uStudioGrassPbr, uStudioTerrainOn;
      vec3 stUnpackNrm(vec2 rg) {
        vec2 xy = rg * 2.0 - 1.0;
        return vec3(xy, sqrt(max(0.02, 1.0 - dot(xy, xy))));
      }
      ${makeWatershedGlsl("forestNoise")}
    `,inject=`
      /* STUDIO ALPINE WATERSHED (IMAGE 2 & 3 BOTTOM STYLE) \xB7 37x31 EXTENDED TERRAIN + 9 TRIBUTARIES + 7x 2K PBR */
      if (uStudioTerrainOn > 0.001) {
        float stAmt = clamp(uStudioStyle, 0.0, 1.25) * uStudioTerrainOn;
        float pbrAmt = clamp(uStudioGrassPbr, 0.0, 1.5) * uStudioTerrainOn;
        float outDist = forestOut(uvR);

        /* Evaluate organic domain-warped extended watershed (with exact downstream flow vector) + widened central lake + core river bridges! */
        vec2 wsFlow;
        vec3 ws = stWatershedEx(vForestWorld.xz, outDist, wsFlow);
        vec3 lb = stLB0;
        float wsFade = 1.0 - smoothstep(8.2, 10.8, outDist);
        float wsWm = ws.x * wsFade;

        /* Inside core: native tWater + widened central lake + continuous 4 core rivers + mouth overlap; Outside core: full analytical watershed */
        float flatWaterGate = 1.0 - smoothstep(0.111, 0.128, vForestWorld.y);
        float stWm = (outDist > 0.0005 ? wsWm : max(wm, wsWm)) * flatWaterGate;
        float stShore = outDist > 0.0005 ? ws.z : max(shore, ws.z * step(0.05, wsWm));
        float stLakeN = outDist > 0.0005 ? 0.0 : lakeN;

        float landM = 1.0 - smoothstep(0.06, 0.42, stWm);
        vec3 sunNS = normalize(uSun);
        vec3 viewV = normalize(cameraPosition - vForestWorld);

        if (landM > 0.001) {
          /* Strictly mask tree shadow map to the core footprint & clear shadows inside widened lake & bridged core riverbanks */
          vec3 shS = texture2D(tStudioShadow, clamp(uvR, 0.0, 1.0)).rgb * (1.0 - smoothstep(0.0, 0.18, outDist)) * (1.0 - max(lb.y, stCR0.y) * 0.85);
          vec2 eS = 1.5 / PX;
          float hL = texture2D(tCanopy, uv - vec2(eS.x, 0.0)).r;
          float hR = texture2D(tCanopy, uv + vec2(eS.x, 0.0)).r;
          float hD = texture2D(tCanopy, uv - vec2(0.0, eS.y)).r;
          float hU = texture2D(tCanopy, uv + vec2(0.0, eS.y)).r;
          float sgnX = (uvR.x < uSkirt.x || uvR.x > 1.0 - uSkirt.x) ? -1.0 : 1.0;
          float sgnZ = (uvR.y < uSkirt.y || uvR.y > 1.0 - uSkirt.y) ? -1.0 : 1.0;
          vec3 sN = normalize(vec3(-(hR - hL) * 14.5 * sgnX, 1.0, -(hU - hD) * 14.5 * sgnZ));

          /* Account for sheer carved rocky cliff precipice bank slope right at the waterline */
          if (lb.y > 0.001 && outDist <= 0.0005) {
            float eb = 0.04;
            float bL = stCentralLakeBasin(vForestWorld.xz - vec2(eb, 0.0)).y;
            float bR = stCentralLakeBasin(vForestWorld.xz + vec2(eb, 0.0)).y;
            float bD = stCentralLakeBasin(vForestWorld.xz - vec2(0.0, eb)).y;
            float bU = stCentralLakeBasin(vForestWorld.xz + vec2(0.0, eb)).y;
            sN = normalize(sN + vec3((bR - bL) * 5.4, 0.0, (bU - bD) * 5.4));
          }

          /* Smooth analytical normal matching core slope steepness & organic tributary valley flanks */
          if (outDist > 0.0005) {
            float epsO = 0.10;
            vec2 pxL = vForestWorld.xz - vec2(epsO, 0.0);
            vec2 pxR = vForestWorld.xz + vec2(epsO, 0.0);
            vec2 pzD = vForestWorld.xz - vec2(0.0, epsO);
            vec2 pzU = vForestWorld.xz + vec2(0.0, epsO);
            float ohL = stOuterCarvedH(pxL, stWatershed(pxL, outDist));
            float ohR = stOuterCarvedH(pxR, stWatershed(pxR, outDist));
            float ohD = stOuterCarvedH(pzD, stWatershed(pzD, outDist));
            float ohU = stOuterCarvedH(pzU, stWatershed(pzU, outDist));
            vec3 outN = normalize(vec3(-(ohR - ohL) / (2.0 * epsO) * 2.15, 1.0, -(ohU - ohD) / (2.0 * epsO) * 2.15));
            sN = normalize(mix(sN, outN, smoothstep(0.0, 2.25, outDist)));
          }
          float slopeS = length(sN.xz);
          float sunS = clamp(dot(sN, sunNS), 0.0, 1.0);

          float mxS = max(col.r, max(col.g, col.b));
          float mnS = min(col.r, min(col.g, col.b));
          float satS = (mxS - mnS) / max(mxS, 1e-4);
          float lumS = dot(col, vec3(0.2126, 0.7152, 0.0722));
          /* Smooth macro outcrop hint (NO low-res blocky tPlate pixel speckles at rock-to-grass edges!) */
          float vegS = mix(smoothstep(0.015, 0.14, (col.g - max(col.r, col.b)) / max(mxS, 1e-4)), 0.88, smoothstep(0.25, 1.8, outDist));
          float plateRockHint = (1.0 - vegS) * (1.0 - smoothstep(0.16, 0.36, satS)) * smoothstep(0.12, 0.28, slopeS);
          float rockNoise = forestFbm(vForestWorld.xz * 0.62 + vec2(-3.2, 5.1));
          float highPeakRock = smoothstep(0.36, 0.68, vForestWorld.y) * smoothstep(0.14, 0.34, slopeS) * (0.45 + 0.55 * rockNoise);
          float gorgeRock = ws.y * smoothstep(0.16, 0.38, slopeS) * (0.35 + 0.55 * rockNoise);
          float rockS = clamp(plateRockHint * 0.55 + smoothstep(0.18, 0.44, slopeS) * 1.05 + highPeakRock + gorgeRock, 0.0, 1.0);

          vec2 wp = vForestWorld.xz;
          mat2 rotP = mat2(0.80, -0.60, 0.60, 0.80);
          vec2 warp = vec2(forestFbm(wp * 0.36 + vec2(3.1, -5.4)), forestFbm(wp * 0.36 + vec2(-6.7, 2.8))) - 0.5;
          vec2 wpW = wp + warp * 1.85;
          float patchMix = forestFbm(wpW * 0.56 + vec2(4.2, -2.7));
          float macroVar = forestFbm(wpW * 0.92 + vec2(-6.1, 8.3));

          /* --- A. 2K NORDIC HIGHLANDS / SCOTTISH VALLEY DUAL-SCALE GRASS, MOSS & UPLAND HEATH PBR (Poly Haven 2K aerial_grass_rock + grass_ground + withered_grass + mossy_rock!) --- */
          float pSun = sunS;
          float grassHeight = 0.5;
          if (pbrAmt > 0.01) {
            /* Macro non-repeating Scottish highland biome patches (deep moss hollows / plush olive meadows / sunlit golden-olive ridges) */
            float macroBiomeA = forestFbm(wpW * 0.34 + vec2(11.4, -7.8));
            float macroBiomeB = forestFbm(wpW * 0.68 + vec2(-9.7, 13.2));
            float dryHighland = smoothstep(0.40, 0.72, macroBiomeA * 0.65 + macroBiomeB * 0.35);
            float coolHollow  = smoothstep(0.38, 0.72, forestFbm(wpW * 0.52 + vec2(-12.3, 11.1)));
            float meadowWave  = forestFbm(wp * 2.80 + vec2(2.1, 7.6));

            /* Dual-scale UV pairs (Micro fine detail + Macro rotated anti-tiling scale) */
            vec2 uvMossA   = wp * 2.25;
            vec2 uvMossB   = rotP * wp * 0.76 + vec2(0.37, 0.71);
            vec2 uvAerialA = wp * 1.12;
            vec2 uvAerialB = rotP * wp * 0.42 + vec2(0.61, 0.19);
            vec2 uvGrassA  = wp * 2.85;
            vec2 uvGrassB  = rotP * wp * 0.94 + vec2(0.23, 0.53);

            vec4 sMossA   = texture2D(tMossCol, uvMossA);
            vec4 sMossB   = texture2D(tMossCol, uvMossB);
            vec3 cMoss    = mix(sMossA.rgb, sMossB.rgb, patchMix);
            vec4 sAerA    = texture2D(tAerialCol, uvAerialA);
            vec4 sAerB    = texture2D(tAerialCol, uvAerialB);
            vec3 cAerial  = mix(sAerA.rgb, sAerB.rgb, patchMix);
            vec4 sGrassA  = texture2D(tGrassCol, uvGrassA);
            vec4 sGrassB  = texture2D(tGrassCol, uvGrassB);
            vec3 cGrass   = mix(sGrassA.rgb, sGrassB.rgb, patchMix);

            /* Dual-octave 2K PBR tangent normals (RG = grass_ground+withered_grass nor_gl, BA = aerial_grass_rock nor_gl) */
            vec4 pnMacro = texture2D(tPbrNrm, uvGrassA);
            vec4 pnMicro = texture2D(tPbrNrm, wp * 7.80 + vec2(0.17, 0.43));
            vec4 pnAerM  = texture2D(tPbrNrm, uvAerialA);
            vec4 pnAerB  = texture2D(tPbrNrm, uvAerialB);
            vec2 nGrass  = (pnMacro.rg * 2.0 - 1.0) * 0.85 + (pnMicro.rg * 2.0 - 1.0) * 0.64;
            vec2 nAerial = (pnAerM.ba * 2.0 - 1.0) * 0.95 + (pnAerB.ba * 2.0 - 1.0) * 0.52 + (pnMicro.ba * 2.0 - 1.0) * 0.36;

            float wMoss   = clamp(shS.b * 0.95 + (1.0 - sunS) * 0.56 + (1.0 - macroVar) * 0.38 + coolHollow * 0.48, 0.0, 1.0);
            float wAerial = clamp(smoothstep(0.06, 0.30, slopeS) * 1.55 + rockS * 0.72 + (macroVar - 0.28) * 0.46 + 0.16, 0.0, 1.0);
            float wGrass  = clamp((1.0 - shS.b * 0.45) * (1.0 - smoothstep(0.16, 0.42, slopeS)) * (0.48 + 0.62 * sunS) + 0.18, 0.0, 1.0);
            float wSum = max(wMoss + wAerial + wGrass, 0.001);
            wMoss /= wSum; wAerial /= wSum; wGrass /= wSum;

            /* Boosted 2K NormalMap micro-relief so treeless Scottish highland grass slopes look thick, tactile & sculptural! */
            vec2 nBlend = nGrass * (wGrass + wMoss * 0.58) + nAerial * wAerial;
            vec3 pN = normalize(sN + vec3(nBlend.x, 0.0, -nBlend.y) * 1.38 * min(pbrAmt, 1.25));
            pSun = clamp(dot(pN, sunNS), 0.0, 1.0);

            /* True packed 2K PBR Roughness from Alpha channels (matte plush grass vs slightly smoother rocky scree) */
            float pbrRough = clamp(sMossA.a * wMoss + sAerA.a * wAerial + sGrassA.a * wGrass, 0.25, 0.96);

            /* Authentic Scottish Valley / Nordic Highlands turf palette: deep moss green, lush olive meadow, warm sunlit highland yellow-green */
            vec3 bMoss   = cMoss   * vec3(0.46, 0.80, 0.62);
            vec3 bAerial = cAerial * mix(vec3(0.68, 0.84, 0.70), vec3(0.56, 0.78, 0.74), coolHollow);
            vec3 bGrass  = cGrass  * mix(vec3(0.64, 0.84, 0.60), vec3(0.88, 0.94, 0.62), smoothstep(0.32, 0.88, pSun) * (0.42 + 0.58 * macroVar));
            vec3 bDry    = mix(cGrass, cAerial, 0.46) * vec3(1.00, 0.94, 0.66);

            vec3 splatCol = bMoss * wMoss + bAerial * wAerial + bGrass * wGrass;
            grassHeight = clamp((1.0 - pbrRough) * 0.40 + dot(splatCol, vec3(0.25, 0.60, 0.15)) * 1.35, 0.0, 1.0);

            /* Macro warm sun-baked upland heath patches on open sunlit ridges & hills */
            float dryMask = dryHighland * (1.0 - shS.b * 0.82) * smoothstep(0.20, 0.76, pSun) * (0.46 + 0.54 * (wGrass + wAerial));
            splatCol = mix(splatCol, bDry, dryMask * 0.62 * min(stAmt, 1.0));
            /* Cool steel-blue sky shadow shift in leeward valley hollows */
            float shadeCool = (1.0 - smoothstep(0.16, 0.64, pSun)) * (1.0 - rockS * 0.65);
            splatCol = mix(splatCol, splatCol * vec3(0.58, 0.76, 0.86), shadeCool * 0.42);

            float waveMod = 0.78 + 0.42 * meadowWave;
            float hillLitP = smoothstep(0.06, 0.88, pSun);
            float macroShade = outDist > 0.25 ? 0.96 : (0.86 + 0.28 * clamp(lumS * 1.85, 0.0, 1.0));
            vec3 litSplat = splatCol * waveMod * macroShade * (vec3(0.20, 0.28, 0.32) + vec3(1.42, 1.44, 1.30) * hillLitP);

            /* Physically grounded PBR roughness grazing sheen (velvet highland grass glint & damp scree micro-specular) */
            vec3 Hg = normalize(viewV + sunNS);
            float shininess = mix(42.0, 6.0, pbrRough);
            float pbrSpec = pow(max(dot(pN, Hg), 0.0), shininess) * (1.0 - pbrRough * 0.72) * hillLitP;
            litSplat += vec3(0.22, 0.26, 0.20) * pbrSpec * 0.32;

            col = mix(col, litSplat, landM * clamp(pbrAmt * 0.98, 0.0, 0.99));
          }

          /* --- B. PURE 2K CC0 Rock051 STRATIFIED CANYON CLIFFS & SHEER SHORELINE PRECIPICES (ZERO SAND / ZERO SPARKLING GRAVEL!) --- */
          float shoreBreak = (forestNoise(wp * 2.4 + vec2(-5.1, 3.7)) - 0.5) * 0.024;
          float relY = vForestWorld.y - 0.105 + shoreBreak;
          float outerBankCap = outDist > 0.05 ? smoothstep(0.42, 0.88, ws.y) : 1.0;
          /* Force solid stratified rocky cliff precipices right down into EVERY lake & river shoreline! */
          float shoreCliff = (1.0 - smoothstep(0.0, 0.095, relY)) * outerBankCap;
          float wetCliff   = (1.0 - smoothstep(0.0, 0.036, relY)) * outerBankCap;
          float dampRim    = (1.0 - smoothstep(0.030, 0.085, relY)) * (1.0 - wetCliff) * outerBankCap;

          float sheerRock = clamp(rockS * 1.15 + smoothstep(0.16, 0.38, slopeS) * 0.96 + shoreCliff * 1.38, 0.0, 1.0);
          if (sheerRock > 0.025) {
            /* Sharp triplanar projection weights (pow 6.5) -> ZERO vertical cliff stretching & ZERO ghosting! */
            vec3 absN = abs(sN);
            vec3 triW = pow(max(absN - 0.18, 0.001), vec3(6.5));
            triW /= max(triW.x + triW.y + triW.z, 1e-4);

            /* Monumental 1:1 isotropic Rock051 canyon strata scale (0.76 -> bold authentic weathered cliff layers!) */
            float rScale = 0.76;
            vec2 rW = warp * 0.12;
            vec2 uvRX = vForestWorld.zy * rScale + rW;
            vec2 uvRY = vForestWorld.xz * rScale + rW;
            vec2 uvRZ = vForestWorld.xy * rScale + rW;

            /* Pure 2K Rock051 Albedo + Roughness (A) */
            vec4 rAlbX = texture2D(tRockCol, uvRX);
            vec4 rAlbY = texture2D(tRockCol, uvRY);
            vec4 rAlbZ = texture2D(tRockCol, uvRZ);
            vec4 rockAlbR = rAlbX * triW.x + rAlbY * triW.y + rAlbZ * triW.z;

            /* TRUE 2K Rock051 Triplanar NormalGL (RG) + Displacement (B) + AO (A) via tMossyRockCol slot (0 extra texture units!) */
            vec4 rNrmX = texture2D(tMossyRockCol, uvRX);
            vec4 rNrmY = texture2D(tMossyRockCol, uvRY);
            vec4 rNrmZ = texture2D(tMossyRockCol, uvRZ);
            vec3 tNX = stUnpackNrm(rNrmX.rg);
            vec3 tNY = stUnpackNrm(rNrmY.rg);
            vec3 tNZ = stUnpackNrm(rNrmZ.rg);

            vec3 wNX = vec3(sN.x, tNX.y, tNX.x * sign(sN.x));
            vec3 wNY = vec3(tNY.x, sN.y, -tNY.y * sign(sN.y));
            vec3 wNZ = vec3(tNZ.x * sign(sN.z), tNZ.y, sN.z);
            vec3 triRockN = normalize(wNX * triW.x + wNY * triW.y + wNZ * triW.z);

            /* Coarse fractured cliff-foot rock ledges (Rocks007 at bold 0.68x slab scale \u2014 ZERO fine sand or sparkles!) */
            float cliffFoot = clamp(shoreCliff * 0.72 + wetCliff * 0.55, 0.0, 1.0);
            vec4 ledgeAlb = rockAlbR;
            if (cliffFoot > 0.04) {
              ledgeAlb = texture2D(tRiverBankCol, wp * 0.68 + warp * 0.10);
            }
            float ledgeMix = cliffFoot * smoothstep(0.58, 0.90, sN.y) * 0.44;

            vec3 rockN = normalize(mix(sN, triRockN, clamp(pbrAmt * 0.92, 0.25, 1.0)));
            float rockSun = clamp(dot(rockN, sunNS), 0.0, 1.0);

            float rockDisp  = rNrmX.b * triW.x + rNrmY.b * triW.y + rNrmZ.b * triW.z;
            float rockAO    = rNrmX.a * triW.x + rNrmY.a * triW.y + rNrmZ.a * triW.z;
            float rockRough = clamp(mix(rockAlbR.a, 0.26, wetCliff * 0.75), 0.24, 0.96);
            float creviceAO = clamp(smoothstep(0.04, 0.78, rockDisp) * 0.55 + rockAO * 0.45, 0.24, 1.0);

            /* Subtle macro geological bedding reinforcing Rock051's diagonal strata + cool canyon slate grading */
            float dipCoord = vForestWorld.y * 18.0 + dot(wp, vec2(1.2, -0.8)) + rockNoise * 3.6;
            float macroStrata = 0.84 + 0.26 * smoothstep(-0.6, 0.7, sin(dipCoord));
            vec3 rockAlb = mix(rockAlbR.rgb, ledgeAlb.rgb * vec3(0.86, 0.90, 0.96), ledgeMix) * vec3(0.82, 0.86, 0.92) * macroStrata;

            /* Physical wet dark charcoal-slate cliff base darkening where canyon bedrock plunges straight into water */
            rockAlb *= mix(1.0, 0.58, wetCliff);

            vec3 rockSky = vec3(0.25, 0.35, 0.49) * (0.60 + 0.40 * max(0.0, rockN.y));
            vec3 rockKey = vec3(1.66, 1.66, 1.58) * smoothstep(0.02, 0.88, rockSun);
            vec3 litRock = rockAlb * (rockSky * (0.44 + 0.56 * creviceAO) + rockKey * (0.36 + 0.64 * creviceAO));

            /* Grounded mineral & damp cliff-base sheen (smoothed wet normal -> ZERO sandy sparkle dots!) */
            vec3 Hc = normalize(viewV + sunNS);
            vec3 wetN = normalize(mix(sN, rockN, 0.58));
            float mineralSpec = pow(max(dot(wetN, Hc), 0.0), mix(24.0, 48.0, wetCliff)) * (1.0 - rockRough * 0.65) * rockSun * creviceAO;
            float wetFres = pow(1.0 - clamp(dot(wetN, viewV), 0.18, 1.0), 4.0) * wetCliff * creviceAO;
            litRock += mix(vec3(0.32, 0.36, 0.40), vec3(0.50, 0.60, 0.72), wetCliff) * mineralSpec * mix(0.24, 0.42, wetCliff);
            litRock += vec3(0.20, 0.30, 0.44) * wetFres * 0.22;

            /* Razor-sharp height-blended rocky cliff edge (overhanging grass & moss lip above sheer cliff!) */
            float crispRockMask = smoothstep(0.22, 0.58, sheerRock + (rockDisp - grassHeight) * 0.38);
            col = mix(col, litRock, crispRockMask * landM * min(stAmt, 1.0) * 0.99);
          }

          /* --- C. Subtle damp moss overhang rim right above rocky cliff lip (NO sandy/sparkling gravel beach!) --- */
          col *= mix(1.0, 0.82, dampRim * 0.65 * landM * min(stAmt, 1.0));

          /* --- D. Live Cluster Canopy AO (34%\u201340% Darkening Strictly Under Surviving Tree Groves!) + Directional Cast Shadows --- */
          float shAmt = clamp(uStudioShadow, 0.0, 1.5) * landM;
          col = mix(col, col * vec3(0.58, 0.64, 0.62), shS.r * 0.88 * shAmt);
          col = mix(col, col * vec3(0.62, 0.68, 0.74), shS.g * 0.65 * shAmt * (1.0 - shS.r * 0.40));
        }

        /* --- E. CRYSTAL-CRISP FLOWING THREE.JS GLACIAL RIVERS (Core via FOREST_RIVER + Outer 4 Rivers & 9 Tributaries with Valley Reflections, Caustics & Whitewater Rapids!) --- */
        if (stWm > 0.03) {
          float shDepth = smoothstep(0.0, 0.95, stShore);
          float outerWaterMask = (outDist > 0.001) ? stWm : (smoothstep(0.06, 0.44, wsWm) * (1.0 - smoothstep(0.18, 0.56, wm)));
          if (outerWaterMask > 0.005) {
            vec2 wqO = vForestWorld.xz;
            vec2 fwO = length(wsFlow) > 0.01 ? normalize(wsFlow) : normalize(-wqO);
            float spdO = mix(0.72, 1.0, smoothstep(0.05, 0.72, stShore));

            /* Exact two-phase downstream wave advection using bound tWaves normal map (0 extra texture units!) */
            float phO = uTime * uRvSpeed * 0.46;
            float a1O = fract(phO), a2O = fract(phO + 0.5);
            float b1O = 1.0 - abs(2.0 * a1O - 1.0), b2O = 1.0 - b1O;
            float bnO = inversesqrt(b1O * b1O + b2O * b2O);
            float LcO = 0.28 * spdO;
            vec2 o1O = fwO * (a1O - 0.5) * LcO, o2O = fwO * (a2O - 0.5) * LcO;

            vec2 n1O = texture2D(tWaves, (wqO - o1O) * 7.3).rg - 0.5;
            vec2 n2O = texture2D(tWaves, (wqO - o2O) * 7.3 + 0.41).rg - 0.5;
            vec2 m1O = texture2D(tWaves, (wqO - o1O * 1.7) * 16.2 + 0.20).rg - 0.5;
            vec2 m2O = texture2D(tWaves, (wqO - o2O * 1.7) * 16.2 + 0.63).rg - 0.5;
            vec2 f1O = texture2D(tWaves, (wqO - o1O * 2.6) * 37.0 + 0.13).rg - 0.5;
            vec2 f2O = texture2D(tWaves, (wqO - o2O * 2.6) * 37.0 + 0.71).rg - 0.5;
            vec2 flowSO = ((n1O * b1O + n2O * b2O) + (m1O * b1O + m2O * b2O) * 0.65 + (f1O * b1O + f2O * b2O) * 0.55) * bnO;

            float sh2O = stShore * stShore;
            float shoreNO = clamp(sh2O * 4.0, 0.0, 1.0);
            vec2 slO = flowSO * (0.78 + 0.58 * spdO) * 8.0 * 0.085 * uRvWave * mix(0.45, 1.0, smoothstep(0.0, 0.5, shoreNO));
            vec3 NwO = normalize(vec3(-slO.x, 1.0, -slO.y));
            float ndvO = clamp(dot(NwO, viewV), 0.0, 1.0);

            /* Refracted 2K submerged canyon bedrock & boulders (coarse scale 1.35/0.72 -> ZERO fine sand!) */
            vec4 bedS1 = texture2D(tRiverBankCol, wqO * 1.35 + slO * 0.055);
            vec4 bedS2 = texture2D(tRiverBankCol, mat2(0.80, -0.60, 0.60, 0.80) * wqO * 0.72 + vec2(0.31, 0.57) + slO * 0.042);
            vec3 cobBedO = mix(bedS1.rgb, bedS2.rgb, 0.42) * (0.62 + 0.58 * bedS1.a);
            float shallO = 1.0 - smoothstep(0.02, 0.56, sh2O);
            float caustO = pow(max(0.0, 0.5 + 0.5 * sin(wqO.x * 24.0 + wqO.y * 18.0 + uTime * 1.6 + slO.x * 16.0) * sin(wqO.x * 16.0 - wqO.y * 26.0 - uTime * 1.2 + slO.y * 16.0)), 3.4) * shallO;
            vec3 alpBedO = mix(vec3(0.11, 0.22, 0.30), cobBedO * vec3(0.76, 0.96, 1.12), 0.82) + vec3(0.16, 0.24, 0.30) * caustO * 0.48;

            float depthO = 1.0 - (1.0 - clamp(smoothstep(0.04, 1.0, sh2O) * 0.72, 0.0, 1.0)) * uRvBed;
            vec3 bodyO = mix(alpBedO * vec3(0.78, 0.94, 1.0), uRvDeep, depthO * mix(0.88, 1.0, 1.0 - uRvBed));
            float bankO = 1.0 - smoothstep(0.0, 0.72, shoreNO);
            float shalO = pow(bankO * bankO * (3.0 - 2.0 * bankO), 1.30) * 0.70;
            bodyO = mix(bodyO, uRvShallow * (0.80 + 0.44 * bedS1.a), shalO * uRvLook.x * 0.72);
            bodyO *= 1.0 - smoothstep(0.42, 1.0, sh2O) * 0.22;

            /* Authentic gorge cliff-wall reflection darkening along outer riverbanks + bright sky reflection down channel center! */
            vec3 RwO = reflect(-viewV, NwO);
            vec3 skywO = mix(uRvSky, uRvSky * vec3(0.54, 0.72, 0.96), smoothstep(0.15, 1.0, RwO.y));
            vec3 gorgeRefl = mix(vec3(0.025, 0.042, 0.052), skywO, smoothstep(0.12, 0.62, shoreNO));
            float frO = clamp((mix(0.10, 0.26, uRvBed) + 0.74 * pow(1.0 - ndvO, 3.0)) * uRvRefl, 0.0, 0.88);
            vec3 wcO = mix(bodyO, gorgeRefl, frO);

            vec3 HsO = normalize(viewV + sunNS);
            float nhO = max(dot(NwO, HsO), 0.0);
            wcO += vec3(0.96, 0.98, 0.94) * (pow(nhO, 280.0) * 1.15 + pow(nhO, 68.0) * 0.06 + pow(nhO, 22.0) * 0.015) * uRvSun;

            /* Crisp silky downstream current streaks + lively whitewater rapids + delicate broken shore lap foam */
            float thO = texture2D(tWaves, vec2(dot(wqO, vec2(-fwO.y, fwO.x)) * 54.0, dot(wqO, fwO) * 5.0 - phO * 1.7 * spdO)).b * b1O
                      + texture2D(tWaves, vec2(dot(wqO, vec2(-fwO.y, fwO.x)) * 54.0 + 0.5, dot(wqO, fwO) * 5.0 - (phO + 0.5) * 1.7 * spdO)).b * b2O;
            wcO += vec3(0.62, 0.78, 0.92) * smoothstep(0.56, 0.84, thO) * 0.22 * spdO * smoothstep(0.08, 0.48, shoreNO);

            float riffNO = texture2D(tWaves, (wqO - o1O * 1.3) * 11.0).b * b1O + texture2D(tWaves, (wqO - o2O * 1.3) * 11.0 + 0.5).b * b2O;
            float riffO = smoothstep(0.54, 0.84, riffNO) * spdO * smoothstep(0.08, 0.48, shoreNO);
            float narrowO = smoothstep(0.45, 0.90, spdO) * (1.0 - smoothstep(0.24, 0.82, sh2O));
            float wwtO = texture2D(tWaves, vec2(dot(wqO, vec2(-fwO.y, fwO.x)) * 84.0, dot(wqO, fwO) * 13.0 - phO * 2.3 * spdO)).b;
            riffO = max(riffO, smoothstep(0.56, 0.84, wwtO) * narrowO);
            float lapLO = smoothstep(0.0, 0.07, shoreNO) * (1.0 - smoothstep(0.07, 0.24, shoreNO + (texture2D(tWaves, wqO * 6.0 + vec2(uTime * 0.02, 0.0)).b - 0.5) * 0.12));
            lapLO *= smoothstep(0.32, 0.68, texture2D(tWaves, wqO * 29.0 + vec2(uTime * 0.05, -uTime * 0.03)).b);
            wcO = mix(wcO, vec3(0.88, 0.94, 0.97), clamp(riffO * 0.36 * uRvLook.z + lapLO * 0.14, 0.0, 1.0) * uRvFoam);

            col = mix(col, wcO, smoothstep(0.10, 0.52, outerWaterMask) * min(stAmt, 1.0));
          }

          /* Subtle land-side wet slate rim (keeps water surface glassy & crisp while eliminating any green tPlate border pixels!) */
          float landWetRim = smoothstep(0.02, 0.20, stWm) * (1.0 - smoothstep(0.20, 0.42, stWm)) * landM;
          col = mix(col, vec3(0.022, 0.034, 0.044), landWetRim * 0.45 * min(stAmt, 1.0));
        }

        /* --- F. Organic Irregular Outer Horizon Fade (Melts distant mountain ridges seamlessly into #101920 alpine void!) --- */
        float horizonNoise = (forestFbm(vForestWorld.xz * 0.15 + vec2(3.1, -2.4)) - 0.5) * 3.0;
        float horizonFade = smoothstep(7.40, 11.20, outDist + horizonNoise);
        col = mix(col, vec3(0.0052, 0.0097, 0.0144), horizonFade);
      }
    `,waterExpandReplace=`
      float stOut0 = forestOut(uvR);
      vec3 stLB0 = (stOut0 <= 0.0005 && uStudioTerrainOn > 0.001) ? stCentralLakeBasin(vForestWorld.xz) : vec3(0.0);
      vec2 stCRFlow = vec2(0.0);
      vec3 stCR0 = (stOut0 <= 0.0005 && uStudioTerrainOn > 0.001) ? stCoreRivers(vForestWorld.xz, stCRFlow) : vec3(0.0);
      float wm = max(max(wt.r, stLB0.x), stCR0.x);
      float shore = max(max(wt.g, stLB0.z * 0.94 * smoothstep(0.05, 0.35, stLB0.x)), stCR0.z * 0.58 * smoothstep(0.05, 0.35, stCR0.x));
      float lakeN = max(wt.b, smoothstep(0.05, 0.42, stLB0.x));
    `,flowReplace=`
      vec2 F=fl.rg*2.-1.;
      if (stCR0.x > 0.05 && length(F) < 0.22 && length(stCRFlow) > 0.01) {
        F = mix(F, stCRFlow * 0.72, smoothstep(0.05, 0.40, stCR0.x));
      }
    `,bedReplace=`
      vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;
      if (uStudioTerrainOn > 0.001 && uStudioGrassPbr > 0.01) {
        float tbAmt = clamp(uStudioStyle, 0.0, 1.0) * clamp(uStudioGrassPbr, 0.0, 1.0) * uStudioTerrainOn;
        vec2 bUv1 = wq * 1.35 + sl * 0.055;
        vec2 bUv2 = mat2(0.80, -0.60, 0.60, 0.80) * wq * 0.72 + vec2(0.31, 0.57) + sl * 0.042;
        vec4 bS1 = texture2D(tRiverBankCol, bUv1);
        vec4 bS2 = texture2D(tRiverBankCol, bUv2);
        vec3 cobBed = mix(bS1.rgb, bS2.rgb, 0.42) * (0.62 + 0.58 * bS1.a);
        float shW = 1.0 - smoothstep(0.02, 0.58, sh2);
        vec3 alpBed = mix(vec3(0.12, 0.22, 0.30), cobBed * vec3(0.76, 0.94, 1.12), 0.84);
        bed = mix(bed, alpBed, max(tbAmt * (0.58 + 0.42 * shW), smoothstep(0.05, 0.35, max(stLB0.x, stCR0.x))));
      }
    `;mat.fragmentShader=mat.fragmentShader.replace("void main(){",decls+`
void main(){`).replace("float wm=wt.r, shore=wt.g, lakeN=wt.b;",waterExpandReplace).replace("vec2 F=fl.rg*2.-1.;",flowReplace).replace("vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;",bedReplace).replace("col=forestHaze(col,vForestWorld);",inject+`
col=forestHaze(col,vForestWorld);`),mat.needsUpdate=!0,patched=!0}),patched}function patchWaterSurfaceMaterial(atlas,riverBankCol,studioUniforms){let patched=!1;const seen=new Set;return atlas.scene.traverse(obj=>{if(!obj.isMesh||!obj.material||seen.has(obj.material))return;seen.add(obj.material);const mat=obj.material;if(!mat.fragmentShader||!mat.fragmentShader.includes("vW1World")||!mat.fragmentShader.includes("vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;")||mat.fragmentShader.includes("tStudioRiverBed"))return;Object.assign(mat.uniforms,{tStudioRiverBed:{value:riverBankCol},uStudioStyle:studioUniforms.uStudioStyle,uStudioGrassPbr:studioUniforms.uStudioGrassPbr,uStudioTerrainOn:studioUniforms.uStudioTerrainOn});const wDecls=`
      uniform sampler2D tStudioRiverBed;
      uniform float uStudioStyle, uStudioGrassPbr, uStudioTerrainOn;
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
      vec3 stLBw = (uStudioTerrainOn > 0.001) ? stWCentralLake(wq) : vec3(0.0);
      float wm=wt.r;
      float shore=max(wt.g, stLBw.z * 0.94 * smoothstep(0.05, 0.35, stLBw.x));
      float lakeN=max(wt.b, smoothstep(0.05, 0.42, stLBw.x));
      float sh2=shore*shore, shoreN=clamp(sh2*4.,0.,1.);
      float body=smoothstep(.2,.7,wm), rim=smoothstep(.02,.3,wm)*(1.-body)*uW1B.z*(1.0 - smoothstep(0.10, 0.45, stLBw.x));
    `,wBedReplace=`
      vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;
      if (uStudioTerrainOn > 0.001 && uStudioGrassPbr > 0.01) {
        float wBedAmt = clamp(uStudioStyle, 0.0, 1.0) * clamp(uStudioGrassPbr, 0.0, 1.0) * uStudioTerrainOn;
        vec2 pUv1 = wq * 1.35 + sl * 0.055;
        vec2 pUv2 = mat2(0.80, -0.60, 0.60, 0.80) * wq * 0.72 + vec2(0.31, 0.57) + sl * 0.042;
        vec4 pS1 = texture2D(tStudioRiverBed, pUv1);
        vec4 pS2 = texture2D(tStudioRiverBed, pUv2);
        vec3 cobbleBed = mix(pS1.rgb, pS2.rgb, 0.42) * (0.62 + 0.58 * pS1.a);
        float shallW = 1.0 - smoothstep(0.02, 0.58, sh2);
        float cw1 = sin(wq.x * 26.0 + wq.y * 19.0 + uTime * 1.65 + sl.x * 18.0);
        float cw2 = sin(wq.x * 18.0 - wq.y * 29.0 - uTime * 1.25 + sl.y * 18.0);
        float caust = pow(max(0.0, 0.5 + 0.5 * cw1 * cw2), 3.8) * shallW;
        /* Cool glacial slate-blue submerged cobble bed + crisp silvery caustics matching Image 2 & 3 river floor */
        vec3 alpineBed = mix(vec3(0.12, 0.22, 0.30), cobbleBed * vec3(0.76, 0.94, 1.12), 0.84) + vec3(0.14, 0.20, 0.26) * caust * 0.55;
        bed = mix(bed, alpineBed, wBedAmt * (0.58 + 0.42 * shallW));
      }
    `;mat.fragmentShader=mat.fragmentShader.replace("void main(){",wDecls+`
void main(){`).replace(`float wm=wt.r, shore=wt.g, lakeN=wt.b, sh2=shore*shore, shoreN=clamp(sh2*4.,0.,1.);
    float body=smoothstep(.2,.7,wm), rim=smoothstep(.02,.3,wm)*(1.-body)*uW1B.z;`,wMaskReplace).replace("vec3 bed=texture2D(tPlate,uv+sl*.010).rgb;",wBedReplace),mat.needsUpdate=!0,patched=!0}),patched}export async function createStudioForestLayer(renderer,atlas,initialConfig={}){const cfg={...DEFAULT_STUDIO_CONFIG,...initialConfig,layers:{...DEFAULT_STUDIO_CONFIG.layers,...initialConfig.layers||{}},species:[...initialConfig.species||DEFAULT_STUDIO_CONFIG.species]},baseUrl=name=>new URL("./"+name+"?v="+STUDIO_VER,import.meta.url).href,texLoader=new THREE.TextureLoader,gltfLoader=new GLTFLoader,loadTex=(name,{srgb=!1,mips=!0,repeat=!1}={})=>new Promise((resolve,reject)=>{texLoader.load(baseUrl(name),tex=>{tex.flipY=!1,tex.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace,tex.generateMipmaps=mips,tex.minFilter=mips?THREE.LinearMipmapLinearFilter:THREE.LinearFilter,tex.magFilter=THREE.LinearFilter,tex.wrapS=tex.wrapT=repeat?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping,mips&&(tex.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy())),resolve(tex)},void 0,reject)}),[meta,head,binBuf,realTreeGltf,realTreeAtlas,shadowTex,mossCol,aerialCol,grassCol,rockCol,mossyRockCol,riverBankCol,pbrNrm,rockMeta,rockBin,rockGltf,rockAtlasTex,rockNrmTex,grassMeta,grassBin,gcGltf,gcAtlasTex]=await Promise.all([fetch(baseUrl("studio-trees-meta.json")).then(r=>r.json()),fetch(baseUrl("studio-trees.json")).then(r=>r.json()),fetch(baseUrl("studio-trees.bin")).then(r=>r.arrayBuffer()),gltfLoader.loadAsync(baseUrl("studio-real-trees.glb")),loadTex("studio-real-trees-atlas.webp",{srgb:!0,mips:!0}),loadTex("studio-shadow-map.png",{srgb:!1,mips:!0}),loadTex("pbr-moss-albedo.webp",{srgb:!0,mips:!0,repeat:!0}),loadTex("pbr-grass-wild.webp",{srgb:!0,mips:!0,repeat:!0}),loadTex("pbr-grass-albedo.webp",{srgb:!0,mips:!0,repeat:!0}),loadTex("pbr-rock-albedo.webp",{srgb:!0,mips:!0,repeat:!0}),loadTex("pbr-rock-nrm.webp",{srgb:!1,mips:!0,repeat:!0}),loadTex("pbr-rock-basalt.webp",{srgb:!0,mips:!0,repeat:!0}),loadTex("pbr-grass-nrm.webp",{srgb:!1,mips:!0,repeat:!0}),fetch(baseUrl("studio-rocks.json")).then(r=>r.json()).catch(()=>null),fetch(baseUrl("studio-rocks.bin")).then(r=>r.arrayBuffer()).catch(()=>null),gltfLoader.loadAsync(baseUrl("studio-rocks.glb")).catch(()=>null),loadTex("studio-rocks-atlas.webp",{srgb:!0,mips:!0}).catch(()=>null),loadTex("studio-rocks-nrm.webp",{srgb:!1,mips:!0}).catch(()=>null),fetch(baseUrl("studio-grass.json")).then(r=>r.json()).catch(()=>null),fetch(baseUrl("studio-grass.bin")).then(r=>r.arrayBuffer()).catch(()=>null),gltfLoader.loadAsync(baseUrl("studio-groundcover.glb")).catch(()=>null),loadTex("studio-groundcover-atlas.webp",{srgb:!0,mips:!0}).catch(()=>null)]);function rewriteSphericalCrownNormals(geo){const posAttr=geo.attributes.position,nrmAttr=geo.attributes.normal,colAttr=geo.attributes.color;if(!posAttr||!nrmAttr||!colAttr)return;let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9,minZ=1e9,maxZ=-1e9,cnt=0;for(let i=0;i<posAttr.count;i++){if(colAttr.getY(i)<.5)continue;const x=posAttr.getX(i),y=posAttr.getY(i),z=posAttr.getZ(i);x<minX&&(minX=x),x>maxX&&(maxX=x),y<minY&&(minY=y),y>maxY&&(maxY=y),z<minZ&&(minZ=z),z>maxZ&&(maxZ=z),cnt++}if(!cnt)return;const cx=(minX+maxX)*.5,cy=minY+(maxY-minY)*.42,cz=(minZ+maxZ)*.5,rx=Math.max((maxX-minX)*.5,.05),ry=Math.max((maxY-minY)*.5,.05),rz=Math.max((maxZ-minZ)*.5,.05);for(let i=0;i<posAttr.count;i++){if(colAttr.getY(i)<.5)continue;const dx=(posAttr.getX(i)-cx)/rx,dy=(posAttr.getY(i)-cy)/ry,dz=(posAttr.getZ(i)-cz)/rz,rad=Math.min(1,Math.hypot(dx,dy,dz));let sx=dx,sy=dy+.6,sz=dz;const sl=Math.hypot(sx,sy,sz)||1;sx/=sl,sy/=sl,sz/=sl;let nx=sx*.84+nrmAttr.getX(i)*.16,ny=sy*.84+nrmAttr.getY(i)*.16,nz=sz*.84+nrmAttr.getZ(i)*.16;const nl=Math.hypot(nx,ny,nz)||1;nrmAttr.setXYZ(i,nx/nl,ny/nl,nz/nl);const hNorm=Math.max(0,Math.min(1,(posAttr.getY(i)-minY)/Math.max(maxY-minY,.05))),softAO=.42+.58*Math.min(1,rad*.55+hNorm*.55);colAttr.setX(i,Math.max(colAttr.getX(i),softAO)),colAttr.setZ(i,hNorm)}nrmAttr.needsUpdate=!0,colAttr.needsUpdate=!0}const jsHash2=(ix,iz)=>{const s=Math.sin(ix*127.1+iz*311.7)*43758.5453123;return s-Math.floor(s)},jsNoise2=(x,z)=>{const ix=Math.floor(x),iz=Math.floor(z);let fx=x-ix,fz=z-iz;fx=fx*fx*(3-2*fx),fz=fz*fz*(3-2*fz);const a=jsHash2(ix,iz),b=jsHash2(ix+1,iz),c=jsHash2(ix,iz+1),d=jsHash2(ix+1,iz+1);return(a*(1-fx)+b*fx)*(1-fz)+(c*(1-fx)+d*fx)*fz},jsFbm2=(x,z)=>jsNoise2(x,z)*.54+jsNoise2(x*2.07+7.3,z*2.07-4.1)*.3+jsNoise2(x*4.21-3.9,z*4.21+9.2)*.16,smoothstep=(e0,e1,v)=>{const t=Math.max(0,Math.min(1,(v-e0)/(e1-e0)));return t*t*(3-2*t)},totalInFile=head.count,useCount=Math.min(totalInFile,MAX_REAL_TREES),R=head.ranges,q16=new Uint16Array(binBuf,0,totalInFile*5),q8=new Uint8Array(binBuf,totalInFile*10,totalInFile*4),dq=(v,k)=>R[k][0]+v/65535*(R[k][1]-R[k][0]),tintMax=R.tintMax||1.5,bySpecies=[[],[],[],[]],keptTrees=[];for(let i=0;i<useCount;i++){const k=q8[i*4],x=dq(q16[i*5],"x"),z=dq(q16[i*5+1],"z");if(jsLakeBasinR(x,z)<1.24)continue;const rDist=jsCoreRiverDist(x,z);if(rDist<.21)continue;const cMacro=jsFbm2(x*.56+2.4,z*.56-3.8),cDetail=jsFbm2(x*1.55-5.1,z*1.55+4.3),riverHollow=smoothstep(.2,.44,rDist)*(1-smoothstep(.68,1.46,rDist)),flankFrame=smoothstep(3.35,5.7,Math.abs(x))*(.58+.42*smoothstep(-1.4,2.6,z)),fgBottom=smoothstep(1.95,3.45,z)*(1-smoothstep(1.8,3.6,Math.abs(x))*.25),h1=riverHollow*(cMacro*1.22+cDetail*.26-.14),h2=Math.max(flankFrame,fgBottom*.72)*(cMacro*1.15+cDetail*.28-.12),groveScore=Math.max(h1,h2);if(groveScore<.445)continue;const edgeCore=smoothstep(.445,.76,groveScore),rndA=jsHash2(i*.73+1.1,k*3.7+5.3),rndB=jsHash2(i*1.19+9.4,x*2.1-z*1.7);if(edgeCore<.28&&rndB>.38+edgeCore*2.2)continue;const sizeMul=edgeCore<.32?.58+edgeCore*.95+rndA*.24:.72+rndA*.76*(.72+.28*edgeCore),h=dq(q16[i*5+2],"h")*sizeMul,w=dq(q16[i*5+3],"w")*(.92+.16*rndB)*sizeMul,rot=dq(q16[i*5+4],"rot");bySpecies[k]&&(bySpecies[k].push({i,x,z,h,w,rot}),keptTrees.push({x,z,h,w}))}function buildLiveClusterShadowTex(trees){const ao=new Float32Array(147456),cast=new Float32Array(512*288),moss=new Float32Array(512*288),b=atlas.uniforms.uBounds.value,x0=b.x,z0=b.y,invW=b.z,invD=b.w,sunOffX=-STUDIO_SUN.x*.22,sunOffZ=-STUDIO_SUN.z*.22,splat=(buf,cx,cz,radW,strength)=>{const pu=(cx-x0)*invW*512,pv=(cz-z0)*invD*288,rx=Math.max(1.5,radW*invW*512),ry=Math.max(1.5,radW*invD*288),ix0=Math.max(0,Math.floor(pu-rx)),ix1=Math.min(511,Math.ceil(pu+rx)),iy0=Math.max(0,Math.floor(pv-ry)),iy1=Math.min(287,Math.ceil(pv+ry)),irx=1/rx,iry=1/ry;for(let py=iy0;py<=iy1;py++){const dy=(py-pv)*iry,dy2=dy*dy,row=py*512;for(let px=ix0;px<=ix1;px++){const dx=(px-pu)*irx,d2=dx*dx+dy2;if(d2>=1)continue;const k=(1-d2)*(1-d2)*strength,idx=row+px;buf[idx]=1-(1-buf[idx])*(1-k)}}};for(let t=0;t<trees.length;t++){const tr=trees[t],rad=Math.max(.055,tr.w*cfg.crownScale*.58);splat(ao,tr.x,tr.z,rad*1.45,.58),splat(cast,tr.x+sunOffX*tr.h*cfg.heightScale,tr.z+sunOffZ*tr.h*cfg.heightScale,rad*1.35,.48),splat(moss,tr.x,tr.z,rad*2.55,.42)}const data=new Uint8Array(512*288*4);for(let i=0;i<512*288;i++)data[i*4]=Math.min(255,Math.round(ao[i]*255)),data[i*4+1]=Math.min(255,Math.round(cast[i]*255)),data[i*4+2]=Math.min(255,Math.round(moss[i]*255)),data[i*4+3]=255;const tex=new THREE.DataTexture(data,512,288,THREE.RGBAFormat);return tex.flipY=!1,tex.colorSpace=THREE.NoColorSpace,tex.minFilter=THREE.LinearFilter,tex.magFilter=THREE.LinearFilter,tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping,tex.needsUpdate=!0,tex}const liveShadowTex=buildLiveClusterShadowTex(keptTrees);shadowTex.dispose?.(),atlas.scene.background=new THREE.Color(1055008);const origSun=atlas.uniforms.uSun.value.clone();atlas.uniforms.uSun.value.copy(STUDIO_SUN);const studioUniforms={tRealTreeAtlas:{value:realTreeAtlas},tStudioShadow:{value:liveShadowTex},tCanopy:atlas.uniforms.tCanopy,tPlate:atlas.uniforms.tPlate,uBounds:atlas.uniforms.uBounds,uYRange:atlas.uniforms.uYRange,uRelief:atlas.uniforms.uRelief,uTime:atlas.uniforms.uTime,uSun:atlas.uniforms.uSun,uView:atlas.uniforms.uView,uHaze:atlas.uniforms.uHaze,uDist:atlas.uniforms.uDist,uVig:atlas.uniforms.uVig,uMirror:atlas.uniforms.uMirror||{value:0},uStudioStyle:{value:cfg.style},uCrownScale:{value:cfg.crownScale},uTreeHeight:{value:cfg.heightScale},uSunGlow:{value:cfg.sunGlow},uStudioShadow:{value:cfg.shadow},uStudioGrassPbr:{value:cfg.grassPbr},uStudioTerrainOn:{value:cfg.layers.terrainStyle?1:0},uWind:{value:cfg.wind}},terrainPatched=patchTerrainMaterial(atlas,liveShadowTex,{mossCol,aerialCol,grassCol,rockCol,mossyRockCol,riverBankCol,pbrNrm},studioUniforms),waterPatched=patchWaterSurfaceMaterial(atlas,riverBankCol,studioUniforms),legacyMeshes=[...atlas.trees.children],realTreeGeos=[];realTreeGltf.scene.traverse(o=>{o.isMesh&&o.geometry&&(rewriteSphericalCrownNormals(o.geometry),realTreeGeos.push(o.geometry))});const treeMaterial=new THREE.ShaderMaterial({uniforms:studioUniforms,vertexShader:REAL_TREE_VERT,fragmentShader:REAL_TREE_FRAG,side:THREE.DoubleSide,alphaToCoverage:!0,toneMapped:!1}),view4=new THREE.Vector4,beforeRender=r=>{r.getCurrentViewport(view4),atlas.uniforms.uView.value.copy(view4)},matrix=new THREE.Matrix4,pos=new THREE.Vector3,quat=new THREE.Quaternion,scl=new THREE.Vector3,yAxis=new THREE.Vector3(0,1,0),speciesMeshes=[],speciesFullCounts=[];meta.species.forEach((sp,sIdx)=>{const entries=bySpecies[sIdx],srcGeo=realTreeGeos[sIdx]||realTreeGeos[0];if(!srcGeo||!entries.length)return;const geo=srcGeo.clone(),instData=new Float32Array(entries.length*4),mesh=new THREE.InstancedMesh(geo,treeMaterial,entries.length);mesh.name="Real 3D tree \xB7 "+sp.id,mesh.frustumCulled=!1,mesh.onBeforeRender=beforeRender;for(let n=0;n<entries.length;n++){const e=entries[n],o8=e.i*4;matrix.compose(pos.set(e.x,0,e.z),quat.setFromAxisAngle(yAxis,e.rot),scl.set(e.w,e.h,e.w)),mesh.setMatrixAt(n,matrix),instData[n*4]=q8[o8+1]/255*tintMax,instData[n*4+1]=q8[o8+2]/255*tintMax,instData[n*4+2]=q8[o8+3]/255*tintMax,instData[n*4+3]=e.rot}geo.setAttribute("aInstData",new THREE.InstancedBufferAttribute(instData,4)),mesh.instanceMatrix.needsUpdate=!0,atlas.trees.add(mesh),speciesMeshes.push(mesh),speciesFullCounts.push(entries.length)});const rockMeshes=[];if(rockMeta&&rockBin&&rockGltf&&rockAtlasTex&&rockNrmTex){const rCount=rockMeta.count,stride=rockMeta.strideFloats||9,rf32=new Float32Array(rockBin,0,rCount*stride),rKind=new Uint8Array(rockBin,rCount*stride*4,rCount),numKinds=rockMeta.names.length,byRock=Array.from({length:numKinds},()=>[]);for(let i=0;i<rCount;i++){const rx=rf32[i*stride],rz=rf32[i*stride+1];jsLakeBasinR(rx,rz)<1.02||jsCoreRiverDist(rx,rz)<.14||byRock[rKind[i]]?.push(i)}const rockGeoMap=new Map;rockGltf.scene.traverse(o=>{o.isMesh&&o.geometry&&rockGeoMap.set(o.name,o.geometry)});const rockMaterial=new THREE.ShaderMaterial({uniforms:{...studioUniforms,tRockAtlas:{value:rockAtlasTex},tRockNrm:{value:rockNrmTex},tRockDetail:{value:rockCol},tRockDetailNrm:{value:pbrNrm}},vertexShader:STUDIO_ROCK_VERT,fragmentShader:STUDIO_ROCK_FRAG,side:THREE.FrontSide,toneMapped:!1}),upVec=new THREE.Vector3(0,1,0),slopeVec=new THREE.Vector3,qSlope=new THREE.Quaternion,qYaw=new THREE.Quaternion;rockMeta.names.forEach((name,k)=>{const srcGeo=rockGeoMap.get(name),ids=byRock[k];if(!srcGeo||!ids.length)return;const geo=srcGeo.clone(),yOffs=new Float32Array(ids.length),mesh=new THREE.InstancedMesh(geo,rockMaterial,ids.length);mesh.name="Studio 3D rock \xB7 "+name,mesh.frustumCulled=!1,mesh.onBeforeRender=beforeRender;for(let n=0;n<ids.length;n++){const i=ids[n],o=i*stride,x=rf32[o],z=rf32[o+1],sx=rf32[o+2],sy=rf32[o+3],rot=rf32[o+4],nx=rf32[o+5],nz=rf32[o+6],yoff=rf32[o+7],szr=stride>=9?rf32[o+8]:1,ny=Math.sqrt(Math.max(.08,1-nx*nx-nz*nz));slopeVec.set(nx*.68,ny+.32,nz*.68).normalize(),qSlope.setFromUnitVectors(upVec,slopeVec),qYaw.setFromAxisAngle(upVec,rot),quat.copy(qSlope).multiply(qYaw),matrix.compose(pos.set(x,0,z),quat,scl.set(sx,sy,sx*szr)),mesh.setMatrixAt(n,matrix),yOffs[n]=yoff}geo.setAttribute("aYOff",new THREE.InstancedBufferAttribute(yOffs,1)),mesh.instanceMatrix.needsUpdate=!0,atlas.trees.add(mesh),rockMeshes.push(mesh)})}const grassMeshes=[];if(grassMeta&&grassBin&&gcGltf&&gcAtlasTex){const gCount=grassMeta.count,gR=grassMeta.ranges,gq16=new Uint16Array(grassBin,0,gCount*5),gq8=new Uint8Array(grassBin,gCount*10,gCount*4),gdq=(v,k)=>gR[k][0]+v/65535*(gR[k][1]-gR[k][0]),gColMax=gR.colMax||1.5,gcGeos={};gcGltf.scene.traverse(o=>{o.isMesh&&o.geometry&&(gcGeos[o.name]=o.geometry)});const fernIds=[],grassIds=[];for(let i=0;i<gCount;i++){const gx=gdq(gq16[i*5],"x"),gz=gdq(gq16[i*5+1],"z");jsLakeBasinR(gx,gz)<1.05||jsCoreRiverDist(gx,gz)<.14||(gq8[i*4]===2?fernIds.push(i):grassIds.push(i))}const gMat=new THREE.ShaderMaterial({uniforms:{...studioUniforms,tGroundCoverAtlas:{value:gcAtlasTex}},vertexShader:STUDIO_GRASS_VERT,fragmentShader:STUDIO_GRASS_FRAG,side:THREE.DoubleSide,toneMapped:!1}),buildGC=(srcGeo,ids,name,scaleMul)=>{if(!srcGeo||!ids.length)return;const geo=srcGeo.clone(),cols=new Float32Array(ids.length*3),mesh=new THREE.InstancedMesh(geo,gMat,ids.length);mesh.name=name,mesh.frustumCulled=!1,mesh.onBeforeRender=beforeRender;for(let n=0;n<ids.length;n++){const i=ids[n],o16=i*5,o8=i*4,x=gdq(gq16[o16],"x"),z=gdq(gq16[o16+1],"z"),h=gdq(gq16[o16+2],"h")*scaleMul,w=gdq(gq16[o16+3],"w")*scaleMul,rot=gdq(gq16[o16+4],"rot");matrix.compose(pos.set(x,0,z),quat.setFromAxisAngle(yAxis,rot),scl.set(w,h,w)),mesh.setMatrixAt(n,matrix),cols[n*3]=gq8[o8+1]/255*gColMax,cols[n*3+1]=gq8[o8+2]/255*gColMax,cols[n*3+2]=gq8[o8+3]/255*gColMax}geo.setAttribute("aGrassCol",new THREE.InstancedBufferAttribute(cols,3)),mesh.instanceMatrix.needsUpdate=!0,atlas.scene.add(mesh),grassMeshes.push(mesh)};buildGC(gcGeos.RealFern,fernIds,"Studio 3D photogrammetry ferns (fern_02)",1.55),buildGC(gcGeos.RealGrass,grassIds,"Studio 3D photogrammetry grass (grass_medium_01)",1.35)}const mistGroup=new THREE.Group;mistGroup.name="Studio Atmosphere & Mist (Layer 1)";const mistPlane=new THREE.PlaneGeometry(1,1),mistMats=[];[{x:2.4,y:1.06,z:-2.4,sx:6.8,sz:3.8,alpha:.42,warm:.95,seed:1.4},{x:-2.6,y:1.12,z:-2.6,sx:6.6,sz:3.6,alpha:.34,warm:.65,seed:4.7},{x:4.6,y:.96,z:-1.5,sx:5.2,sz:3.6,alpha:.28,warm:.9,seed:8.2},{x:-4.8,y:.98,z:-1.4,sx:5,sz:3.4,alpha:.24,warm:.45,seed:11.9},{x:.8,y:1.22,z:-2.9,sx:8.2,sz:3.2,alpha:.38,warm:.98,seed:15.3}].forEach(s=>{const m=new THREE.ShaderMaterial({uniforms:{uTime:atlas.uniforms.uTime,uMist:{value:s.alpha*cfg.mist},uSeed:{value:s.seed},uWarm:{value:s.warm}},vertexShader:MIST_VERT,fragmentShader:MIST_FRAG,transparent:!0,depthWrite:!1,side:THREE.DoubleSide}),mesh=new THREE.Mesh(mistPlane,m);mesh.position.set(s.x,s.y,s.z),mesh.rotation.x=-Math.PI*.5,mesh.scale.set(s.sx,s.sz,1),mesh.renderOrder=15,mistGroup.add(mesh),mistMats.push({mat:m,baseAlpha:s.alpha})}),atlas.scene.add(mistGroup);const origTune={relief:atlas.tune.relief,strata:atlas.tune.strata,moss:atlas.tune.moss,reliefShade:atlas.tune.reliefShade,haze:atlas.tune.haze,rv:atlas.tune.rv,rvDeep:atlas.tune.rvDeep,rvShallow:atlas.tune.rvShallow,rvSky:atlas.tune.rvSky,rvClear:atlas.tune.rvClear,rvRapids:atlas.tune.rvRapids,rvFoam:atlas.tune.rvFoam,rvSun:atlas.tune.rvSun,rvRefl:atlas.tune.rvRefl,rvBed:atlas.tune.rvBed,rvSparkle:atlas.tune.rvSparkle};function apply(){const s=Math.max(0,Math.min(1.25,cfg.style)),lerpHex=(aHex,bHex,t)=>"#"+new THREE.Color(aHex).lerp(new THREE.Color(bHex),Math.max(0,Math.min(1,t))).getHexString();atlas.uniforms.uSun.value.copy(origSun).lerp(STUDIO_SUN,Math.min(1,s)).normalize(),studioUniforms.uStudioStyle.value=s,studioUniforms.uCrownScale.value=cfg.crownScale,studioUniforms.uTreeHeight.value=cfg.heightScale,studioUniforms.uSunGlow.value=cfg.sunGlow,studioUniforms.uStudioShadow.value=cfg.layers.ecoTrees?cfg.shadow:0,studioUniforms.uStudioGrassPbr.value=cfg.grassPbr,studioUniforms.uStudioTerrainOn.value=cfg.layers.terrainStyle?1:0,studioUniforms.uWind.value=cfg.wind,atlas.tune.relief=cfg.relief,atlas.tune.strata=1+.55*Math.min(1,s),atlas.tune.moss=1+.35*Math.min(1,s),atlas.tune.reliefShade=1+.45*Math.min(1,s),atlas.tune.haze=cfg.layers.atmosphere?Math.max(0,cfg.mist*.35):0,cfg.layers.water?(atlas.tune.rv=1,atlas.tune.rvDeep=lerpHex(origTune.rvDeep,"#0a182c",s),atlas.tune.rvShallow=lerpHex(origTune.rvShallow,"#244264",s),atlas.tune.rvSky=lerpHex(origTune.rvSky,"#7ea0c6",s),atlas.tune.rvClear=Math.max(0,Math.min(1.2,cfg.waterClear*Math.min(1,s)+origTune.rvClear*(1-Math.min(1,s)))),atlas.tune.rvRapids=2.8+.9*Math.min(1,s),atlas.tune.rvFoam=1.35+.38*Math.min(1,s),atlas.tune.rvSun=1.25+.45*Math.min(1,s),atlas.tune.rvRefl=.54-.02*Math.min(1,s),atlas.tune.rvBed=.52+.18*Math.min(1,s),atlas.tune.rvSparkle=.45+.15*Math.min(1,s)):atlas.tune.rv=0;const dFrac=Math.max(.05,Math.min(1,cfg.density));speciesMeshes.forEach((mesh,idx)=>{mesh.visible=!!(cfg.layers.ecoTrees&&cfg.species[idx]),mesh.count=Math.max(1,Math.round(speciesFullCounts[idx]*dFrac))}),rockMeshes.forEach(mesh=>{mesh.visible=!!cfg.layers.rocks3d}),grassMeshes.forEach(mesh=>{mesh.visible=!!cfg.layers.grass3d}),legacyMeshes.forEach(mesh=>{mesh.visible=!!cfg.layers.legacyTrees}),mistGroup.visible=!!cfg.layers.atmosphere&&cfg.mist>.005,mistMats.forEach(({mat,baseAlpha})=>{mat.uniforms.uMist.value=baseAlpha*cfg.mist})}return apply(),{config:cfg,meta,head,terrainPatched,waterPatched,speciesMeshes,rockMeshes,legacyMeshes,mistGroup,uniforms:studioUniforms,apply,getStats(){let activeTrees=0,activeRocks=0;return speciesMeshes.forEach(m=>{m.visible&&(activeTrees+=m.count)}),rockMeshes.forEach(m=>{m.visible&&(activeRocks+=m.count)}),{totalScattered:useCount,activeTrees,activeRocks,activeGrassTufts:grassMeshes.reduce((s,m)=>s+(m.visible?m.count:0),0),realTreeMeshes:realTreeGeos.length,species:meta.species.map((sp,i)=>({id:sp.id,label:sp.label,total:speciesFullCounts[i]||0,active:speciesMeshes[i]?.visible?speciesMeshes[i].count:0}))}}}}