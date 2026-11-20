/* studio-3d-lines.js — Toggleable Architectural 3D Line Topographic Wireframe System
   Covers the full 37.0 x 30.84 extended alpine watershed + widened central lake + 4 rivers + 9 tributaries.
   Supports BOTH:
   - Overlay Mode (darkGround = 0): luminous 3D topographic grid hugging the photorealistic 3D valley, rivers & lake
   - Pure 3D Wireframe Mode (darkGround = 1): dark-navy #070c1a topographic terrain with exaggerated 3D relief & distance haze
   Zero modifications to flow2-original-scene.js; 1 draw call for all 3D lines! */
import * as THREE from 'three';
import { makeWatershedGlsl } from './studio-forest-layer.js?v=st34';

export const DEFAULT_3D_LINE_CONFIG = {
  enabled: false,       /* 1-click toggle option in Studio UI */
  opacity: 0.78,        /* line brightness / alpha */
  darkGround: 0.0,      /* 0 = overlay on real terrain, 1 = pure dark-navy 3D wireframe terrain */
  exaggeration: 2.4,    /* vertical relief multiplier in dark wireframe mode (overlay hugs real terrain at 1.0x) */
  density: 1.0,         /* grid line density multiplier */
  waterGlow: 0.72,      /* accent highlight along rivers & widened central lake */
  color: '#d4e6ff',     /* primary crest/ridge line color */
  accentColor: '#76c4ff'/* river/lake & accent glow color */
};

const HEIGHT_GLSL = `
  uniform sampler2D tCanopy;
  uniform vec4 uBounds;
  uniform vec2 uYRange;
  uniform float uRelief, uEx;

  float lnHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lnNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(lnHash(i), lnHash(i + vec2(1.0, 0.0)), f.x),
               mix(lnHash(i + vec2(0.0, 1.0)), lnHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  ${makeWatershedGlsl('lnNoise')}

  float lnOutDist(vec2 uvR) {
    vec2 d = max(vec2(0.0) - uvR, uvR - vec2(1.0));
    return length(max(d, 0.0) / uBounds.zw);
  }

  /* Exact mirror of studio-forest-layer.js terrain VERT elevation (returns vec2(heightY, waterMask)) */
  vec2 lnSample(vec2 xz) {
    vec2 uvR = (xz - uBounds.xy) * uBounds.zw;
    float outD = lnOutDist(uvR);
    vec2 uvC = clamp(uvR, 0.002, 0.998);
    float hC = texture2D(tCanopy, uvC).r;
    float baseY = max(0.105 + (uYRange.x + hC * uYRange.y - 0.105) * uRelief, 0.105);

    vec3 ws = stWatershed(xz, outD);
    vec3 lb = stCentralLakeBasin(xz);
    vec2 crF;
    vec3 cr = outD <= 0.35 ? stCoreRivers(xz, crF) : vec3(0.0);
    float y = baseY;
    float wm = 0.0;

    if (outD > 0.0005) {
      float carvedH = 0.105 + (stOuterCarvedH(xz, ws) - 0.105) * uRelief;
      float blendO = smoothstep(0.0, 2.25, outD);
      float borderCarved = mix(baseY, 0.105, max(smoothstep(0.12, 0.56, ws.x), cr.y));
      float targetY = mix(borderCarved, carvedH, blendO);
      float rimEase = 1.0 - smoothstep(8.6, 11.4, outD) * 0.22;
      y = max(0.105, 0.105 + (targetY - 0.105) * rimEase);
      wm = ws.x * (1.0 - smoothstep(8.2, 10.8, outD));
    } else {
      float coreCarve = max(lb.y, max(cr.y, smoothstep(0.10, 0.55, ws.x)));
      if (coreCarve > 0.001) y = max(0.105, mix(y, 0.105, coreCarve));
      wm = max(max(lb.x, cr.x), ws.x);
    }

    /* Exaggerate elevation smoothly above water level (water & widened lake stay flat at y = 0.105) */
    float exY = 0.105 + max(y - 0.105, 0.0) * uEx;
    float isLowWater = max(wm, 1.0 - smoothstep(0.105, 0.116, y));
    return vec2(exY, isLowWater);
  }
`;

const LINE_VERT = `
  attribute float aMinor;
  uniform float uLift, uTime;
  varying vec3 vW;
  varying float vLit, vWet, vMinor, vH, vOutFade;
  ${HEIGHT_GLSL}

  void main() {
    vec3 p = position;
    vec2 s = lnSample(p.xz);
    float h = s.x;
    vWet = s.y;
    vH = max(h - 0.105, 0.0);
    p.y = h + uLift;

    /* Slope lighting toward upper-right/NW light so ridges & valley canyons read with 3D sculpted depth */
    float e = 0.09;
    float hL = lnSample(p.xz - vec2(e, 0.0)).x;
    float hR = lnSample(p.xz + vec2(e, 0.0)).x;
    float hD = lnSample(p.xz - vec2(0.0, e)).x;
    float hU = lnSample(p.xz + vec2(0.0, e)).x;
    vec3 n = normalize(vec3(hL - hR, 2.0 * e / 2.8, hD - hU));
    float lit = clamp(0.26 + 1.18 * max(dot(n, normalize(vec3(-0.48, 0.68, -0.55))), 0.0), 0.22, 1.48);
    float crest = smoothstep(0.02, 0.55 * uEx, vH);
    vLit = lit * mix(0.62, 1.38, crest);

    /* Adaptive density: minor grid lines fade out over flat water/flats and appear crisply on slopes & crests */
    float slopeMag = length(n.xz);
    vMinor = aMinor * (1.0 - smoothstep(0.08, 0.28, vH / max(uEx, 1.0) + slopeMag * 0.42)) * 0.85;

    vec2 uvR = (p.xz - uBounds.xy) * uBounds.zw;
    float outD = lnOutDist(uvR);
    vOutFade = 1.0 - smoothstep(7.2, 11.2, outD);

    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
    gl_Position.z -= 0.00045 * gl_Position.w;
  }
`;

const LINE_FRAG = `
  uniform vec3 uCol, uAcc;
  uniform float uAlpha, uWaterGlow, uDarkGround, uTime;
  varying vec3 vW;
  varying float vLit, vWet, vMinor, vH, vOutFade;

  void main() {
    float dist = distance(cameraPosition, vW);
    float farFade = 1.0 - smoothstep(22.0, 95.0, dist) * 0.58;
    float wet = clamp(vWet * uWaterGlow, 0.0, 1.0);

    /* Subtle topographic elevation contour glint */
    float contour = smoothstep(0.90, 0.99, abs(sin(vH * 28.0)));
    float baseA = uAlpha * mix(vLit, 1.15, wet) * (1.0 - vMinor) * farFade * vOutFade;
    baseA *= mix(0.82, 1.12, uDarkGround);
    if (baseA < 0.004) discard;

    vec3 col = mix(uCol, uAcc * 1.18, wet * 0.85);
    col += uAcc * contour * 0.22 * (1.0 - wet);
    /* Linear additive emission so bright ridges & river contours glow cleanly without washing out */
    vec3 emission = col * baseA;
    gl_FragColor = vec4(emission, 1.0);
  }
`;

const GROUND_VERT = `
  varying vec3 vW;
  varying float vOutFade;
  ${HEIGHT_GLSL}

  void main() {
    vec3 p = position;
    p.y = lnSample(p.xz).x;
    vec2 uvR = (p.xz - uBounds.xy) * uBounds.zw;
    vOutFade = 1.0 - smoothstep(7.6, 11.3, lnOutDist(uvR));
    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const GROUND_FRAG = `
  uniform vec3 uGround, uHazeCol;
  uniform float uVig;
  uniform vec4 uView;
  varying vec3 vW;
  varying float vOutFade;

  void main() {
    float far = smoothstep(16.0, 62.0, distance(cameraPosition, vW));
    vec3 col = mix(uGround, uHazeCol, far * 0.65);
    col = mix(vec3(0.0052, 0.0097, 0.0144), col, vOutFade);
    vec2 sc = (gl_FragCoord.xy - uView.xy) / max(uView.zw, vec2(1.0)) - 0.5;
    col *= 1.0 - uVig * smoothstep(0.5, 1.9, dot(sc, sc) * 4.0);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/* Build adaptive 1-draw-call XZ wireframe grid covering core (14 x 7.84) + extended outer range (+11.5 on each side -> 37 x 31) */
function buildAdaptiveLineGeometry(coreW, coreD, skirt, density) {
  const dens = Math.max(0.4, Math.min(2.0, +density || 1.0));
  const halfCoreX = coreW * 0.5, halfCoreZ = coreD * 0.5;
  const maxX = halfCoreX + skirt, maxZ = halfCoreZ + skirt;

  /* Generate line coordinates: dense in core (spCore), gradually widening outward in outer alpine mountains */
  const buildAxisLines = (halfCore, maxLim, spCore) => {
    const coords = [];
    /* Core lines (major + minor alternating) */
    const nCore = Math.max(8, Math.round((halfCore * 2) / spCore));
    const dx = (halfCore * 2) / nCore;
    for (let i = 0; i <= nCore; i++) {
      coords.push({ v: -halfCore + i * dx, minor: i % 2 });
    }
    /* Outer lines on both sides with gentle progressive spacing */
    const outerSpan = maxLim - halfCore;
    const outerSteps = Math.max(10, Math.round(24 * dens));
    for (let i = 1; i <= outerSteps; i++) {
      const t = i / outerSteps;
      const off = outerSpan * (t * 0.58 + t * t * 0.42);
      const mi = i % 2;
      coords.push({ v: -halfCore - off, minor: mi });
      coords.push({ v: halfCore + off, minor: mi });
    }
    return coords;
  };

  /* Sample points along each line: finer sampling inside core & river bends, smoothly coarser far out */
  const buildSamples = (halfCore, maxLim, stepCore) => {
    const pts = [];
    const outerSpan = maxLim - halfCore;
    const nOuter = 44;
    for (let i = nOuter; i >= 1; i--) {
      const t = i / nOuter;
      pts.push(-halfCore - outerSpan * (t * 0.62 + t * t * 0.38));
    }
    const nCore = Math.max(40, Math.round((halfCore * 2) / stepCore));
    for (let i = 0; i <= nCore; i++) {
      pts.push(-halfCore + (halfCore * 2) * (i / nCore));
    }
    for (let i = 1; i <= nOuter; i++) {
      const t = i / nOuter;
      pts.push(halfCore + outerSpan * (t * 0.62 + t * t * 0.38));
    }
    return pts;
  };

  const spCore = 0.16 / dens;
  const xLines = buildAxisLines(halfCoreX, maxX, spCore);
  const zLines = buildAxisLines(halfCoreZ, maxZ, spCore);
  const xSamples = buildSamples(halfCoreX, maxX, 0.08);
  const zSamples = buildSamples(halfCoreZ, maxZ, 0.08);

  const vertCount = zLines.length * xSamples.length + xLines.length * zSamples.length;
  const segCount = zLines.length * (xSamples.length - 1) + xLines.length * (zSamples.length - 1);
  const pos = new Float32Array(vertCount * 3);
  const minor = new Float32Array(vertCount);
  const idx = new Uint32Array(segCount * 2);

  let vp = 0, mp = 0, ip = 0;

  /* East-West lines (constant Z) */
  for (let li = 0; li < zLines.length; li++) {
    const z = zLines[li].v, mi = zLines[li].minor;
    const base = mp;
    for (let si = 0; si < xSamples.length; si++) {
      pos[vp++] = xSamples[si];
      pos[vp++] = 0;
      pos[vp++] = z;
      minor[mp++] = mi;
      if (si > 0) {
        idx[ip++] = base + si - 1;
        idx[ip++] = base + si;
      }
    }
  }

  /* North-South lines (constant X) */
  for (let li = 0; li < xLines.length; li++) {
    const x = xLines[li].v, mi = xLines[li].minor;
    const base = mp;
    for (let si = 0; si < zSamples.length; si++) {
      pos[vp++] = x;
      pos[vp++] = 0;
      pos[vp++] = zSamples[si];
      minor[mp++] = mi;
      if (si > 0) {
        idx[ip++] = base + si - 1;
        idx[ip++] = base + si;
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aMinor', new THREE.BufferAttribute(minor, 1));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.0, 0), Math.hypot(maxX * 2, maxZ * 2) * 0.5 + 4);
  return { geometry: g, vertices: vertCount, segments: segCount };
}

/* Lightweight dark-navy occluding ground mesh matching the extended terrain footprint (used when darkGround > 0.65) */
function buildWireGroundGeometry(coreW, coreD, skirt) {
  const easeOut = t => (t * 0.65 + t * t * 0.35);
  const line = (n, size, sn) => {
    const a = [];
    for (let i = 0; i < sn; i++) a.push(-size / 2 - skirt * easeOut((sn - i) / sn));
    for (let i = 0; i <= n; i++) a.push(-size / 2 + (size * i) / n);
    for (let i = 1; i <= sn; i++) a.push(size / 2 + skirt * easeOut(i / sn));
    return a;
  };
  const xs = line(140, coreW, 44), zs = line(80, coreD, 44);
  const cx = xs.length - 1, cz = zs.length - 1;
  const pos = new Float32Array(xs.length * zs.length * 3);
  const idx = new Uint32Array(cx * cz * 6);
  let p = 0, q = 0;
  for (const z of zs) for (const x of xs) { pos[p++] = x; pos[p++] = 0; pos[p++] = z; }
  for (let j = 0; j < cz; j++) for (let i = 0; i < cx; i++) {
    const a = j * (cx + 1) + i, b = a + 1, c = a + cx + 1, d = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.0, 0), Math.hypot(coreW + 2 * skirt, coreD + 2 * skirt) * 0.5 + 4);
  return g;
}

export function createStudio3DLines(atlas, { studio = null, parts = {} } = {}, initialConfig = {}) {
  const cfg = { ...DEFAULT_3D_LINE_CONFIG, ...initialConfig };
  const U = atlas.uniforms;
  const coreW = U?.uBounds ? (1.0 / U.uBounds.value.z) : 14.0;
  const coreD = U?.uBounds ? (1.0 / U.uBounds.value.w) : 7.84;
  const SKIRT = 11.5;

  const group = new THREE.Group();
  group.name = 'Studio 3D Line Topographic Wireframe';
  group.visible = !!cfg.enabled;

  const shared = {
    tCanopy: U.tCanopy,
    uBounds: U.uBounds,
    uYRange: U.uYRange,
    uRelief: U.uRelief,
    uEx: { value: 1.0 }
  };

  const lineMat = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uTime: U.uTime,
      uLift: { value: 0.011 },
      uCol: { value: new THREE.Color(cfg.color) },
      uAcc: { value: new THREE.Color(cfg.accentColor) },
      uAlpha: { value: cfg.opacity },
      uWaterGlow: { value: cfg.waterGlow },
      uDarkGround: { value: cfg.darkGround }
    },
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    blending: THREE.AdditiveBlending
  });

  let builtDensity = cfg.density;
  let built = buildAdaptiveLineGeometry(coreW, coreD, SKIRT, builtDensity);
  const lineMesh = new THREE.LineSegments(built.geometry, lineMat);
  lineMesh.name = 'Studio 3D Line Grid';
  lineMesh.frustumCulled = false;
  lineMesh.renderOrder = 22;

  const groundMat = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uGround: { value: new THREE.Color('#070c1a') },
      uHazeCol: { value: new THREE.Color('#192844') },
      uView: U.uView,
      uVig: U.uVig
    },
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    side: THREE.DoubleSide,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 2
  });
  const groundMesh = new THREE.Mesh(buildWireGroundGeometry(coreW, coreD, SKIRT), groundMat);
  groundMesh.name = 'Studio 3D Line Dark Ground';
  groundMesh.frustumCulled = false;
  groundMesh.visible = false;
  groundMesh.renderOrder = 2;

  group.add(groundMesh, lineMesh);
  atlas.scene.add(group);

  let hiddenForDarkMode = false;
  const savedTerrainVis = { terrain: true, trees: true, water: true, flow: true };
  const savedGrassVis = [];

  atlas.onUpdate?.(() => {
    if (!hiddenForDarkMode) return;
    if (parts.water?.group) parts.water.group.visible = false;
    if (parts.flow?.group) parts.flow.group.visible = false;
  });

  function setDarkSceneSwap(hideRealScene) {
    if (hideRealScene === hiddenForDarkMode) return;
    hiddenForDarkMode = hideRealScene;

    if (hideRealScene) {
      savedTerrainVis.terrain = atlas.terrain.visible;
      savedTerrainVis.trees = atlas.trees.visible;
      savedTerrainVis.water = parts.water?.group ? parts.water.group.visible : true;
      savedTerrainVis.flow = parts.flow?.group ? parts.flow.group.visible : true;

      atlas.terrain.visible = false;
      atlas.trees.visible = false;
      if (parts.water?.group) parts.water.group.visible = false;
      if (parts.flow?.group) parts.flow.group.visible = false;

      savedGrassVis.length = 0;
      for (const ch of atlas.scene.children) {
        if (ch.name && ch.name.startsWith('Studio 3D photogrammetry')) {
          savedGrassVis.push([ch, ch.visible]);
          ch.visible = false;
        }
      }
      groundMesh.visible = true;
    } else {
      atlas.terrain.visible = savedTerrainVis.terrain;
      atlas.trees.visible = savedTerrainVis.trees;
      if (parts.water?.group) parts.water.group.visible = savedTerrainVis.water;
      if (parts.flow?.group) parts.flow.group.visible = savedTerrainVis.flow;
      for (const [ch, vis] of savedGrassVis) ch.visible = vis;
      savedGrassVis.length = 0;
      groundMesh.visible = false;
    }
  }

  function apply() {
    const on = !!cfg.enabled;
    group.visible = on;

    if (Math.abs((+cfg.density || 1.0) - builtDensity) > 0.04) {
      builtDensity = Math.max(0.4, Math.min(2.0, +cfg.density || 1.0));
      const oldGeo = lineMesh.geometry;
      built = buildAdaptiveLineGeometry(coreW, coreD, SKIRT, builtDensity);
      lineMesh.geometry = built.geometry;
      oldGeo.dispose();
    }

    const dg = on ? Math.max(0, Math.min(1, +cfg.darkGround || 0)) : 0;
    /* In overlay mode (dg = 0), keep exact 1.0x relief so lines hug photorealistic terrain tightly;
       once swapped to pure dark-navy wireframe ground (dg >= 0.55), rise smoothly to cfg.exaggeration! */
    const swapOn = on && dg >= 0.55;
    const exagBlend = swapOn ? Math.min(1, (dg - 0.55) / 0.45) : 0;
    const effExag = 1.0 + (Math.max(1.0, +cfg.exaggeration || 1.0) - 1.0) * (exagBlend * exagBlend * (3 - 2 * exagBlend));

    shared.uEx.value = effExag;
    lineMat.uniforms.uAlpha.value = Math.max(0, Math.min(2.0, +cfg.opacity || 0));
    lineMat.uniforms.uWaterGlow.value = Math.max(0, Math.min(1.5, +cfg.waterGlow || 0));
    lineMat.uniforms.uDarkGround.value = dg;
    lineMat.uniforms.uCol.value.set(cfg.color);
    lineMat.uniforms.uAcc.value.set(cfg.accentColor);

    /* Smoothly darken the real terrain via built-in uLattice before swapping to the exaggerated dark ground */
    if (U.uLattice) U.uLattice.value = on ? Math.min(1, dg * 1.65) : 0.0;
    if (U.uLatticeGround) U.uLatticeGround.value.set('#070c1a');

    setDarkSceneSwap(swapOn);

    /* Ensure Studio scene backdrop shifts slightly deeper navy in dark wireframe mode and restores cleanly */
    if (atlas.scene.background && atlas.scene.background.isColor) {
      atlas.scene.background.set(on && dg > 0.5 ? '#070c1a' : '#101920');
    }
  }

  apply();

  return {
    config: cfg,
    group,
    lineMesh,
    groundMesh,
    uniforms: lineMat.uniforms,
    apply,
    getStats() {
      return {
        enabled: !!cfg.enabled,
        darkGround: cfg.darkGround,
        effectiveExaggeration: shared.uEx.value,
        vertices: built.vertices,
        segments: built.segments
      };
    },
    dispose() {
      setDarkSceneSwap(false);
      if (U.uLattice) U.uLattice.value = 0;
      lineMesh.geometry.dispose();
      groundMesh.geometry.dispose();
      lineMat.dispose();
      groundMat.dispose();
      atlas.scene.remove(group);
    }
  };
}
