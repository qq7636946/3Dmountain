/* =====================================================================
   OGL image slider — adapted to live inside one section of the page.
   Differences from the standalone original:
     · no VirtualScroll / lodash / popmotion imports (the host drives it)
     · exposes init / setActive / resize / addScroll / dispose
     · only starts loading its images the first time the section is shown
   ===================================================================== */
import {
  Renderer, Program, Mesh, Vec2, Transform, Plane, Triangle,
  Camera, TextureLoader, Post, RenderTarget
} from "https://esm.sh/ogl@0.0.93";

function createSpring(from = 0, springCoef = 0.004, frictionCoef = 0.9) {
  let velocity = 0;
  return function f(to) {
    const springVel = (to - from) * springCoef;
    velocity = (velocity + springVel) * frictionCoef;
    if (Math.abs(velocity) < 0.001) velocity = 0;
    from = from + velocity;
    return [from, velocity];
  };
}

const imageUrls = [
  "https://images.unsplash.com/photo-1491833485966-73cfb9ccea53?ixlib=rb-1.2.1&auto=format&fit=crop&w=1024&h=1024&q=80",
  "https://images.unsplash.com/photo-1566765790386-c43812572bc2?ixlib=rb-1.2.1&auto=format&fit=crop&w=1024&h=1024&q=80",
  "https://images.unsplash.com/photo-1568152950566-c1bf43f4ab28?ixlib=rb-1.2.1&auto=format&fit=crop&w=1024&h=1024&q=80",
  "https://images.unsplash.com/photo-1506891536236-3e07892564b7?ixlib=rb-1.2.1&auto=format&fit=crop&w=1024&h=1024&q=80",
  "https://images.unsplash.com/photo-1559624989-7b9303bd9792?ixlib=rb-1.2.1&auto=format&fit=crop&w=1024&h=1024&q=80",
  "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?ixlib=rb-1.2.1&auto=format&fit=crop&w=1024&h=1024&q=80",
  "https://images.unsplash.com/photo-1573865526739-10659fec78a5?ixlib=rb-1.2.1&auto=format&fit=crop&w=1024&h=1024&q=80",
  "https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?ixlib=rb-1.2.1&auto=format&fit=crop&w=1024&q=80",
  "https://images.unsplash.com/photo-1478098711619-5ab0b478d6e6?ixlib=rb-1.2.1&auto=format&fit=crop&w=1024&h=1024&q=80",
  "https://images.unsplash.com/photo-1511275539165-cc46b1ee89bf?ixlib=rb-1.2.1&auto=format&fit=crop&w=1024&h=1024&q=80",
  "https://images.unsplash.com/photo-1596854307943-279e29c90c14?ixlib=rb-1.2.1&auto=format&fit=crop&w=1024&h=1024&q=80"
];

/* ---------- shaders (unchanged from the original) ---------- */

const blurPassFragment = /* glsl */ `
precision highp float;
vec4 blur5(sampler2D image, vec2 uv, vec2 resolution, vec2 direction) {
  vec4 color = vec4(0.0);
  vec2 off1 = vec2(1.3333333333333333) * direction;
  color += texture2D(image, uv) * 0.29411764705882354;
  color += texture2D(image, uv + (off1 / resolution)) * 0.35294117647058826;
  color += texture2D(image, uv - (off1 / resolution)) * 0.35294117647058826;
  return color;
}
uniform sampler2D tMap;
uniform vec2 uDirection;
uniform vec2 uResolution;
varying vec2 vUv;
void main() { gl_FragColor = blur5(tMap, vUv, uResolution, uDirection); }
`;

const distortPassFragment = /* glsl */ `
precision highp float;
uniform float uDispFactor;
uniform float uTime;
uniform float uScrollDir;
uniform sampler2D tMap;
uniform sampler2D tDisp;
varying vec2 vUv;
mat2 rotation2d(float angle) {
  float s = sin(angle); float c = cos(angle);
  return mat2(c, -s, s, c);
}
void main() {
  vec2 uv = vUv;
  float df = mix(0.005, 0.03, uDispFactor);
  float sf = mix(0.50, 0.25, uDispFactor);
  vec2 rotUv = rotation2d(uTime * 0.15) * (uv - 0.5) + 0.5;
  vec2 scaleUv = (rotUv - 0.5) * sf + 0.5;
  vec4 disp = texture2D(tDisp, scaleUv);
  vec2 dispUv = uv + (disp.xy - 0.5) * df;
  gl_FragColor = texture2D(tMap, dispUv);
}
`;

const noisePassFragment = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform float uTime;
uniform vec3 uBase;
varying vec2 vUv;
vec4 alphaCompos(vec4 src, vec4 dst) {
  return vec4(mix(dst.rgb * dst.a, src.rgb, src.a), src.a + dst.a * (1.0 - src.a));
}
float random(vec2 p) {
  vec2 K1 = vec2(23.14069263277926, 2.665144142690225);
  return fract( cos( dot(p, K1) ) * 12345.6789 );
}
void main() {
  vec2 uvRandom = vUv;
  vec4 noizeColor = vec4(uBase, 1.0);
  uvRandom.y *= random(vec2(uvRandom.y, uTime));
  noizeColor.rgb -= random(uvRandom) * 0.035;   /* grain darkens a light ground */
  vec4 tex = texture2D(tMap, vUv);
  gl_FragColor = alphaCompos(tex, noizeColor);
}
`;

const composePassFragment = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform sampler2D tImage;
varying vec2 vUv;
vec4 alphaCompos(vec4 src, vec4 dst) {
  return vec4(mix(dst.rgb * dst.a, src.rgb, src.a), mix(dst.a, 1.0, src.a));
}
void main() {
  vec4 fTex = texture2D(tImage, vUv);
  vec4 bTex = texture2D(tMap, vUv);
  gl_FragColor = alphaCompos(fTex, bTex);
}
`;

const viewDistPassFragment = /* glsl */ `
precision highp float;
uniform float uDistFactor;
uniform float uTime;
uniform float uScrollDir;
uniform sampler2D tMap;
varying vec2 vUv;
void main() {
  vec2 uv = vUv;
  float d = pow(abs(uv.x - 0.5) * 2.0, 2.0);
  vec2 growDistort   = vec2(mix(1.0, 0.85, d), mix(1.0, 0.55, d));
  vec2 shrinkDistort = vec2(mix(1.0, 0.90, d), mix(1.0, 1.25, d));
  vec2 scaleDistort;
  if (uScrollDir > 0.0) scaleDistort = mix(shrinkDistort, growDistort, step(uv.xx, vec2(0.5)));
  else                  scaleDistort = mix(shrinkDistort, growDistort, step(vec2(0.5), uv.xx));
  uv -= 0.5; uv *= scaleDistort; uv += 0.5;
  uv = mix(vUv, uv, uDistFactor);
  gl_FragColor = texture2D(tMap, uv);
  gl_FragColor.a *= step(0.5, 1.0 - abs(uv.y - 0.5));
}
`;

const vertexSlider = /* glsl */ `
attribute vec3 position;
attribute vec2 uv;
attribute vec3 normal;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
varying vec3 vNormal;
varying vec2 vUv;
void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentSlider = /* glsl */ `
precision highp float;
uniform sampler2D tImage;
varying vec2 vUv;
varying vec3 vNormal;
void main() { gl_FragColor = texture2D(tImage, vUv); }
`;

const vertexDefault = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0, 1); }
`;

const fragmentCloning = /* glsl */ `
precision highp float;
uniform float uStepFactor;
uniform float uScaleFactor;
uniform sampler2D tForeground;
uniform sampler2D tBackground;
varying vec2 vUv;
vec4 alphaCompos(vec4 src, vec4 dst) {
  return vec4(mix(dst.rgb * dst.a, src.rgb, src.a), src.a + dst.a * (1.0 - src.a));
}
void main() {
  float st = mix(0.0, -0.08, uStepFactor);
  float sc = mix(0.9, 1.0 / 0.9, uScaleFactor);
  vec2 uvStep = vec2(0.0, st);
  vec2 backUv  = (vUv - 0.5 + uvStep) * sc + 0.5;
  vec2 frontUv = (vUv - 0.5) * sc + 0.5;
  vec4 bTex = texture2D(tBackground, backUv);
  vec4 fTex = texture2D(tForeground, frontUv);
  fTex.a *= step(0.5, 1.0 - abs(frontUv.x - 0.5));
  float alphaMult = mix(0.6, 0.95, uScaleFactor);
  bTex.a *= alphaMult;
  gl_FragColor = alphaCompos(fTex, bTex);
  gl_FragColor.a *= alphaMult;
}
`;

/* ---------------------------------------------------------------- */

export function createSlider(canvas, opts = {}) {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new Renderer({ canvas, alpha: true, dpr: pixelRatio });
  const gl = renderer.gl;
  const resolution = { value: new Vec2() };
  const postEffects = new Post(gl, { dpr: pixelRatio });

  const camera = new Camera(gl, { fov: 35 });
  camera.position.set(0, 0, 4);
  camera.lookAt([0, 0, 0]);

  let width, height, visibleWidth, visibleHeight, resized = false;

  function resize() {
    resized = true;
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setSize(width, height);
    postEffects.resize();
    resolution.value.set(width, height);
    const aspect = width / height;
    camera.perspective({ aspect });
    const halfFov = ((Math.PI / 180) * camera.fov) / 2;
    visibleHeight = 2 * Math.tan(halfFov) * camera.position.len();
    visibleWidth = visibleHeight * aspect;
  }
  resize();

  const scene = new Transform(gl);

  postEffects.addPass({
    fragment: blurPassFragment,
    uniforms: { uResolution: resolution, uDirection: { value: new Vec2(1, 0) } }
  });
  postEffects.addPass({
    fragment: blurPassFragment,
    uniforms: { uResolution: resolution, uDirection: { value: new Vec2(0, 1) } }
  });

  const dispTexture = TextureLoader.load(gl, {
    generateMipmaps: false,
    src: { webp: "https://tismes.com/img/13017-normal.jpg.webp" }
  });

  const displacePass = postEffects.addPass({
    fragment: distortPassFragment,
    uniforms: {
      uDispFactor: { value: 0 }, uTime: { value: 0 },
      uScrollDir: { value: 0 }, tDisp: { value: dispTexture }
    }
  });
  const noisePass = postEffects.addPass({
    fragment: noisePassFragment,
    uniforms: { uTime: { value: 0 }, uBase: { value: opts.base || [0.055, 0.055, 0.06] } }
  });
  const composePass = postEffects.addPass({
    fragment: composePassFragment,
    uniforms: { tImage: { value: null } }
  });
  const viewDistPass = postEffects.addPass({
    fragment: viewDistPassFragment,
    uniforms: { uTime: { value: 0 }, uScrollDir: { value: 0 }, uDistFactor: { value: 0 } }
  });

  const textures = imageUrls.map(url =>
    TextureLoader.load(gl, { generateMipmaps: false, src: { jpg: url } })
  );

  const slideWidth = 1, slideHeight = 1, slideGap = 0.15;
  const totalSlidesWidth = (slideWidth + slideGap) * textures.length;
  const slideGeometry = new Plane(gl, { width: slideWidth, height: slideHeight });
  const slideProgram = new Program(gl, {
    vertex: vertexSlider, fragment: fragmentSlider,
    uniforms: { tImage: { value: null } }
  });

  const slideMeshes = textures.map(tex => {
    const program = Object.create(slideProgram);
    program.uniforms = { tImage: { value: tex } };
    const mesh = new Mesh(gl, { geometry: slideGeometry, program });
    mesh.setParent(scene);
    return mesh;
  });

  const renderTargets = [new RenderTarget(gl, { depth: false }), null];
  const cloningProgram = new Program(gl, {
    vertex: vertexDefault, fragment: fragmentCloning,
    uniforms: {
      tForeground: { value: null }, tBackground: { value: null },
      uStepFactor: { value: 0 }, uScaleFactor: { value: 0 }
    }
  });
  const cloningMesh = new Mesh(gl, { geometry: new Triangle(gl), program: cloningProgram });

  /* ---- scroll state: the host feeds this ---- */
  const scroll = { y: 0 };
  const strip = totalSlidesWidth * 1000;   /* scroll units for one full pass */
  let travel = 0;                          /* 0..1 through the strip */
  const scrollEase = createSpring(0);
  let sceneTarget = null;
  let intro = { on: true, t: 0 };
  const initialScroll = { pos: 0, vel: 0, dir: -1 };

  Promise.all(textures.map(t => t.loaded)).catch(() => {});

  function frame(now, dt) {
    const [scrollPos, scrollVel] = scrollEase(scroll.y);

    /* a spring-ish fly-in the first time the section is shown */
    if (intro.on) {
      intro.t = Math.min(1, intro.t + dt / 3.0);
      const t = intro.t;
      const e = 1 - Math.pow(1 - t, 3);
      initialScroll.pos = -totalSlidesWidth * e;
      initialScroll.vel = 1 - Math.abs(e - 0.5) * 2;
      if (t >= 1) { intro.on = false; initialScroll.vel = 0; }
    }

    const firstSlideOffset = (visibleWidth - slideWidth) / 2;
    const tw = totalSlidesWidth;
    const sw = slideWidth + slideGap;

    slideMeshes.forEach((mesh, index) => {
      let x = sw * index + scrollPos * 0.001 + initialScroll.pos;
      x = (((x % tw) + tw + sw) % tw) - firstSlideOffset - sw;
      mesh.position.set(x, 0, 0);
    });

    if (resized || !sceneTarget) {
      sceneTarget = new RenderTarget(gl);
      renderTargets[1] = new RenderTarget(gl, { depth: false });
    }

    const svel = intro.on ? initialScroll.vel : Math.min(1, Math.abs(scrollVel / 50));
    const sdir = intro.on ? initialScroll.dir : (Math.sign(scrollVel) || 1);
    const time = now / 1000;

    renderer.render({ scene, camera, target: sceneTarget });

    cloningProgram.uniforms.tForeground.value = sceneTarget.texture;
    cloningProgram.uniforms.tBackground.value = renderTargets[0].texture;
    cloningProgram.uniforms.uStepFactor.value = svel;
    cloningProgram.uniforms.uScaleFactor.value = svel;
    renderer.render({ scene: cloningMesh, target: renderTargets[1] });

    displacePass.uniforms.uDispFactor.value = svel;
    displacePass.uniforms.uScrollDir.value = sdir;
    displacePass.uniforms.uTime.value = time;
    noisePass.uniforms.uTime.value = time;
    composePass.uniforms.tImage.value = sceneTarget.texture;
    viewDistPass.uniforms.uTime.value = time;
    viewDistPass.uniforms.uScrollDir.value = sdir;
    viewDistPass.uniforms.uDistFactor.value = svel;

    postEffects.render({ texture: renderTargets[1].texture });

    if (resized) { renderTargets[0] = new RenderTarget(gl, { depth: false }); resized = false; }
    renderTargets.reverse();
  }

  window.addEventListener("resize", resize);

  return {
    frame,
    resize,
    addScroll(delta) { scroll.y += delta; },

    /* the host hands us the wheel; we report whether we used it, so the page
       only moves on once the whole strip has gone past                     */
    scrollBy(delta) {
      const forward = delta < 0;                 /* wheel down = travel forward */
      if (forward && travel >= 1) return false;
      if (!forward && travel <= 0) return false;
      scroll.y += delta;
      travel = Math.min(1, Math.max(0, travel + (-delta) / strip));
      return true;
    },
    reset(atEnd) { travel = atEnd ? 1 : 0; },
    get progress() { return travel; },
    /* the host waits on this so the section is never cut away mid fly-in */
    get introDone() { return !intro.on; },
    replayIntro() { intro = { on: true, t: 0 }; }
  };
}
