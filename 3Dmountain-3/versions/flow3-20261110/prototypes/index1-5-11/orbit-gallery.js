/* Scroll-scrubbed spatial gallery, studied from the supplied SYBIOSME video.
   Uses the site's existing Three renderer dependency and portfolio host API.
   No RAF, wheel capture, or global navigation controller is added here. */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const vertex = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const silkFragment = `precision highp float;
varying vec2 vUv;
uniform float uTime,uCover,uVelocity;
uniform vec2 uResolution,uPointer;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){
  vec2 p=(vUv-.5)*vec2(uResolution.x/uResolution.y,1.);
  p+=uPointer*.045;
  float t=uTime*.22;
  float warp=noise(p*1.5+vec2(t*.4,-t*.2))*.9;
  float fold=sin(p.x*3.1+p.y*3.8+warp*2.5+t);
  float crossFold=sin(p.x*-2.0+p.y*2.8+sin(p.y*3.0+t)*.65-t*.6);
  float shade=smoothstep(-.55,.8,fold*.7+crossFold*.45);
  float ribbon=exp(-pow((fold+crossFold*.3-.15)*2.5,2.));
  float light=.76+.205*shade+.052*ribbon;
  light+=.018*sin(p.x*8.+p.y*4.+t)*(1.-shade);
  vec2 grid=fract(gl_FragCoord.xy/(3.5*uResolution.y/900.))-.5;
  float dotInk=(1.-smoothstep(.035,.12,length(grid)))*.07;
  float grain=(hash(gl_FragCoord.xy)-.5)*.016;
  vec3 col=vec3(light-dotInk+grain)+vec3(.005,.007,.009);
  gl_FragColor=vec4(col,uCover);
}`;
const cardVertex = `varying vec2 vUv;
uniform float uBend,uTime,uFlutter;
void main(){
 vUv=uv; vec3 p=position;
 float x=uv.x-.5,y=uv.y-.5;
 p.z += x*x*uBend + sin(x*3.14159)*y*uFlutter;
 p.z += sin(uv.y*3.14159+uTime*.65)*sin(uv.x*3.14159)*.018;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const cardFragment = `precision highp float;
varying vec2 vUv;
uniform sampler2D uMap;
uniform float uAlpha,uBlur,uShade;
uniform vec2 uImageRatio;
float rounded(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return min(max(q.x,q.y),0.)+length(max(q,0.))-r;}
void main(){
 float d=rounded(vUv-.5,vec2(.5),.026);
 float a=(1.-smoothstep(-.002,.002,d))*uAlpha;
 if(a<.002)discard;
 vec2 uv=(vUv-.5)*uImageRatio+.5;
 vec2 blur=vec2(uBlur,0.);
 vec4 photo=texture2D(uMap,uv)*.40;
 photo+=texture2D(uMap,uv+blur)*.24;
 photo+=texture2D(uMap,uv-blur)*.24;
 photo+=texture2D(uMap,uv+blur*2.)*.06;
 photo+=texture2D(uMap,uv-blur*2.)*.06;
 float edge=1.-smoothstep(.0,.012,abs(d));
 vec3 color=photo.rgb*uShade+edge*.035;
 gl_FragColor=vec4(color,a);
 #include <colorspace_fragment>
}`;

export async function prepareSlider() { return null; }

export function createSlider(canvas, { images = [], dpr = 1.5, skipIntro = false, externalEntrance = true } = {}) {
  const reduced = skipIntro || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.25 : Math.min(1.5, dpr)));
  renderer.setClearColor(0xffffff, 0);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(39, 1, .1, 80);
  const backdrop = new THREE.Scene(), backdropCamera = new THREE.Camera();
  const backdropMaterial = new THREE.ShaderMaterial({
    vertexShader: vertex, fragmentShader: silkFragment, transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uCover: { value: 0 }, uVelocity: { value: 0 },
      uResolution: { value: new THREE.Vector2() }, uPointer: { value: new THREE.Vector2() } }
  });
  const backgroundQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backdropMaterial); backdrop.add(backgroundQuad);
  const ring = new THREE.Group(); scene.add(ring);
  const geometry = new THREE.PlaneGeometry(2.45, 2.12, 40, 16);
  const items = images.length ? images.slice(0, 7) : [''];
  const count = items.length, step = TAU / (count + 1), strip = Math.max(1, count - 1) * 1150;
  const firstAngle = 1.1, totalRotation = (count - 1) * step + firstAngle;
  let disposed = false, contextLost = false, width = 1, height = 1, mobile = false;
  let target = 0, shown = 0, speed = 0, entrance = externalEntrance ? 0 : 1, cover = entrance;
  let active = false, finalPhase = 0, imageSettled = false, lastIndex = -1, elapsed = 0;
  const pointer = new THREE.Vector2(), pointerAim = new THREE.Vector2();
  const layer = canvas.parentElement;
  layer?.classList.add('fi-orbit-layer');
  canvas.setAttribute('aria-label', '立體環繞卡片，可左右拖曳或捲動瀏覽');
  const syncActive = () => {
    const shownLayer = entrance > .01 && layer?.classList.contains('is-on') && layer.style.visibility !== 'hidden';
    if(active!==shownLayer){active=shownLayer;document.body.classList.toggle('is-orbit-gallery',active);}
  };
  const visibilityObserver = new MutationObserver(syncActive);
  if(layer)visibilityObserver.observe(layer,{attributes:true,attributeFilter:['class','style']});
  const controls = document.createElement('div'); controls.className = 'fi-orbit-controls';
  controls.innerHTML = '<h2 class="fi-orbit-accessible">最新消息 · Latest news</h2><p class="fi-orbit-category">LATEST NEWS</p><div class="fi-orbit-actions"><button type="button" aria-label="上一張環繞卡片">←</button><output aria-live="polite">01 / 07</output><button type="button" aria-label="下一張環繞卡片">→</button></div><p class="fi-orbit-hint">SCROLL TO EXPLORE</p>';
  layer?.append(controls);
  const buttons = controls.querySelectorAll('button'), counter = controls.querySelector('output');
  const category = controls.querySelector('.fi-orbit-category');
  const categories = ['COMPANY UPDATES','INDUSTRY INSIGHTS','EVENTS'];
  controls.addEventListener('pointerdown', event => event.stopPropagation());
  const advance = delta => { const next=clamp(lastIndex+delta,0,count-1);target=(firstAngle+next*step)/totalRotation*.82; };
  buttons[0].addEventListener('click', () => advance(-1)); buttons[1].addEventListener('click', () => advance(1));
  const onKey = event => {
    if (!active || event.target.closest?.('input,textarea,select,dialog')) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); advance(event.key === 'ArrowRight' ? 1 : -1); }
  };
  const onPointer = event => { pointerAim.set((event.clientX / width - .5) * 2, (.5 - event.clientY / height) * 2); };
  addEventListener('keydown', onKey); addEventListener('pointermove', onPointer, { passive: true });
  const onLost = event => { event.preventDefault(); contextLost = true; };
  const onRestored = () => { contextLost = false; resize(); };
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRestored);

  function textureFromCanvas(paint, w = 1024, h = 884) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t;
  }
  const placeholder = textureFromCanvas((ctx,w,h) => {
    const g = ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#edf3f5');g.addColorStop(1,'#9ab8cb');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
  });
  const cancelled = [], textures = [], uploaded = new Set();
  const cards = items.map((url, index) => {
    const material = new THREE.ShaderMaterial({ vertexShader: cardVertex, fragmentShader: cardFragment,
      transparent: true, side: THREE.DoubleSide, depthWrite: true,
      uniforms: { uMap: { value: placeholder }, uAlpha: { value: 0 }, uBlur: { value: 0 }, uShade: { value: 1 },
        uImageRatio: { value: new THREE.Vector2(1,1) }, uBend: { value: .55 }, uTime: { value: 0 }, uFlutter: { value: 0 } } });
    const mesh = new THREE.Mesh(geometry, material); ring.add(mesh);
    const loaded = new Promise(resolve => {
      const image = new Image(); image.crossOrigin = 'anonymous'; image.decoding = 'async'; let done = false;
      const finish = ok => {
        if (done) return; done = true; clearTimeout(timer); image.onload = image.onerror = null;
        if (ok && !disposed) {
          const tex = textureFromCanvas((ctx,w,h) => {
            const ph = h * .91, scale = Math.max(w/image.width, ph/image.height);
            ctx.fillStyle = '#f8f8f5'; ctx.fillRect(0,0,w,h);
            ctx.drawImage(image,(w-image.width*scale)/2,(ph-image.height*scale)/2,image.width*scale,image.height*scale);
            ctx.fillStyle = '#f8f8f5'; ctx.fillRect(0,ph,w,h-ph);
            ctx.fillStyle = '#243b48'; ctx.font = '500 20px "DM Sans",sans-serif';
            ctx.fillText(categories[index%3],30,ph+46); ctx.textAlign='right';ctx.fillText(String(index+1).padStart(2,'0'),w-30,ph+46);
          });
          textures.push(tex); material.uniforms.uMap.value = tex;
        }
        resolve(ok);
      };
      const timer = setTimeout(() => finish(false), 12000);
      image.onload = () => image.decode ? image.decode().then(() => finish(true), () => finish(true)) : finish(true);
      image.onerror = () => finish(false); cancelled.push(() => finish(false));
      if(url) image.src = url; else finish(false);
    });
    return { mesh, material, loaded };
  });

  let titleTexture, endTexture;
  function labelTexture(end = false) {
    return textureFromCanvas((ctx,w,h) => {
      ctx.clearRect(0,0,w,h); ctx.fillStyle='#181d21'; ctx.textBaseline='top';
      if (end) {
        ctx.textAlign='center'; ctx.font='400 58px "DM Sans",sans-serif';ctx.fillText('GLOBAL PRESENCE',w/2,150);
        ctx.fillStyle='#687178'; ctx.font='400 36px "Noto Sans TC",sans-serif';ctx.fillText('讓智匯之流跨越邊界',w/2,232);
        ctx.font='400 40px "DM Sans",sans-serif';ctx.fillText('↓',w/2,326);
      } else {
        ctx.font='500 96px "DM Sans",sans-serif';ctx.fillText('Latest news.',30,112);
        ctx.fillText('Ideas in motion.',30,218);
      }
    },1024,512);
  }
  titleTexture = labelTexture(); endTexture = labelTexture(true);
  const titleMaterial = new THREE.MeshBasicMaterial({ map:titleTexture,transparent:true,depthWrite:false,opacity:0 });
  const title = new THREE.Mesh(new THREE.PlaneGeometry(3.35,1.675),titleMaterial); title.position.set(0,0,-.12); scene.add(title);
  const endMaterial = new THREE.MeshBasicMaterial({map:endTexture,transparent:true,depthWrite:false,opacity:0});
  const endLabel = new THREE.Mesh(new THREE.PlaneGeometry(4,2),endMaterial);endLabel.position.z=3.22;scene.add(endLabel);
  const glassMaterial = new THREE.ShaderMaterial({ vertexShader: cardVertex,
    fragmentShader:`varying vec2 vUv;uniform float uAlpha;void main(){vec2 q=abs(vUv-.5)-vec2(.475,.462);float d=length(max(q,0.))+min(max(q.x,q.y),0.)-.025;float a=(1.-smoothstep(-.002,.002,d))*uAlpha;float edge=exp(-abs(d)*260.);float shade=.79+.14*vUv.y+.025*sin(vUv.x*5.+vUv.y*3.);gl_FragColor=vec4(vec3(shade)+edge*.1,a*.84);}`,
    uniforms:{uAlpha:{value:0},uBend:{value:.6},uTime:{value:0},uFlutter:{value:0}},transparent:true,side:THREE.DoubleSide,depthWrite:false });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.65,3.1,32,12),glassMaterial);glass.position.z=3.2;scene.add(glass);
  glass.renderOrder=10; endLabel.renderOrder=11;
  document.fonts?.ready.then(() => {
    if(disposed)return; titleTexture.dispose();endTexture.dispose();
    titleTexture=labelTexture();endTexture=labelTexture(true);titleMaterial.map=titleTexture;endMaterial.map=endTexture;
  });

  function resize() {
    if(disposed)return; width=innerWidth;height=innerHeight;mobile=width<700;
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.25:Math.min(1.5,dpr)));
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.fov=mobile?43:39;camera.position.set(0,0,mobile?12.7:8.3);camera.updateProjectionMatrix();
    backdropMaterial.uniforms.uResolution.value.set(width*renderer.getPixelRatio(),height*renderer.getPixelRatio());
    title.scale.setScalar(mobile?.77:1);
  }
  resize();addEventListener('resize',resize);
  const loaded=Promise.all(cards.map(card=>card.loaded)).then(result=>{imageSettled=true;return result.every(Boolean);});
  const ready=Promise.all(cards.slice(0,3).map(card=>card.loaded)).then(()=>{if(!disposed){textures.slice(0,3).forEach(t=>{renderer.initTexture(t);uploaded.add(t);});renderer.compile(scene,camera);renderer.compile(backdrop,backdropCamera);}});

  function frame(now,dt=1/60) {
    if(disposed||contextLost)return;dt=clamp(dt,0,.06);
    const omega=8.8,offset=shown-target,j=(speed+omega*offset)*dt,decay=Math.exp(-omega*dt);
    if(reduced){shown=target;speed=0;}else{shown=clamp(target+(offset+j)*decay);speed=(speed-omega*j)*decay;}
    if(Math.abs(shown-target)<.00001&&Math.abs(speed)<.0001){shown=target;speed=0;}
    elapsed+=reduced?0:dt;if(reduced)pointer.set(0,0);else pointer.lerp(pointerAim,1-Math.exp(-4*dt));
    syncActive();
    const enter=smooth(.03,.92,entrance), rotation=clamp(shown/.82)*totalRotation;
    finalPhase=smooth(.82,1,shown);
    ring.rotation.set(reduced?0:.08+pointer.y*.035,reduced?0:pointer.x*.045,reduced?0:.17+pointer.x*.018);
    ring.position.y=mobile?.18:0;
    ring.position.x=mobile?.55*(1-smooth(0,.2,shown)):0;
    let visible=0;
    cards.forEach(({mesh,material},index)=>{
      const angle=rotation-index*step-firstAngle;
      const a=angle;
      const front=smooth(-.24,.24,Math.cos(a));
      mesh.position.set(Math.sin(a)*(mobile?2.45:3.75),Math.sin(a)*.05,Math.cos(a)*2.25-(1-enter)*5.5);
      mesh.rotation.set(0,a,0);mesh.scale.setScalar(mobile?.95:.88);
      const alpha=enter*front*(1-smooth(1.53,1.82,Math.abs(a)))*(1-smooth(.02,.72,finalPhase));
      mesh.visible=alpha>.002;if(mesh.visible)visible++;
      const u=material.uniforms;u.uAlpha.value=alpha;u.uTime.value=elapsed;u.uShade.value=.88+.12*front;
      u.uBend.value=reduced?0:.48+clamp(Math.abs(speed)*1.3,0,.8);u.uFlutter.value=reduced?0:clamp(speed,-1,1)*.55;
      u.uBlur.value=reduced?0:clamp(speed*.007,-.018,.018);
    });
    titleMaterial.opacity=enter*(1-smooth(0,.6,finalPhase));
    glassMaterial.uniforms.uAlpha.value=enter*smooth(0,.27,finalPhase);
    glassMaterial.uniforms.uTime.value=elapsed;glassMaterial.uniforms.uBend.value=(1-finalPhase)*.75;
    const gs=(mobile?.6:1)*(.66+finalPhase*.34);glass.scale.setScalar(gs);endLabel.scale.setScalar(gs);
    glass.position.y=(1-finalPhase)*-.7;endLabel.position.y=glass.position.y;
    glass.rotation.y=(1-finalPhase)*-.35;endLabel.rotation.y=glass.rotation.y;
    endMaterial.opacity=enter*smooth(.12,.72,finalPhase);
    backdropMaterial.uniforms.uTime.value=elapsed;backdropMaterial.uniforms.uCover.value=cover;
    backdropMaterial.uniforms.uPointer.value.copy(pointer);backdropMaterial.uniforms.uVelocity.value=speed;
    controls.style.opacity=String(enter*(1-smooth(.1,.7,finalPhase)));
    controls.inert=!active||finalPhase>.5;
    const index=clamp(Math.round((rotation-firstAngle)/step),0,count-1);
    if(index!==lastIndex){lastIndex=index;counter.textContent=String(index+1).padStart(2,'0')+' / '+String(count).padStart(2,'0');category.textContent=categories[index%3];buttons[0].disabled=index===0;buttons[1].disabled=index===count-1;}
    canvas.dataset.orbitProgress=shown.toFixed(4);canvas.dataset.orbitTarget=target.toFixed(4);canvas.dataset.orbitStage=finalPhase>0?'closing':'orbit';canvas.dataset.orbitVisible=String(visible);
    const oldPanel=document.querySelector('.fi-portfolio-copy');if(active&&oldPanel){oldPanel.inert=true;oldPanel.setAttribute('aria-hidden','true');}
    renderer.clear();renderer.render(backdrop,backdropCamera);renderer.clearDepth();renderer.render(scene,camera);
  }
  function seek(value,instant=true){target=clamp(value);if(instant){shown=target;speed=0;}}
  return {ready,loaded,frame,resize,count,
    setEntrance(value){entrance=clamp(value);cover=entrance;},
    setBridge(value,m={}){const start=Number.isFinite(+m.start)?+m.start:.3,end=Number.isFinite(+m.end)?+m.end:.9;cover=smooth(start,Math.max(start+.02,end),value);entrance=clamp((value-.12)/.88);},
    setGrade(){},groundCss(){return 'rgb(236,237,238)';},
    pending(){return !imageSettled||textures.some(t=>!uploaded.has(t));},
    warm(){if(disposed)return false;const next=textures.find(t=>!uploaded.has(t));if(next){renderer.initTexture(next);uploaded.add(next);}return !imageSettled||textures.some(t=>!uploaded.has(t));},
    addScroll(delta){target=clamp(target+delta/strip);},
    scrollBy(delta){if(delta<0&&target>=1)return shown<.998;if(delta>0&&target<=0)return shown>.002;target=clamp(target-delta/strip);return true;},
    reset(atEnd){seek(atEnd?1:0,true);},seek,
    get displayProgress(){return shown;},get progress(){return target;},get introDone(){return entrance>=.999;},replayIntro(){},
    dispose(){if(disposed)return;disposed=true;visibilityObserver.disconnect();cancelled.forEach(fn=>fn());removeEventListener('resize',resize);removeEventListener('keydown',onKey);removeEventListener('pointermove',onPointer);canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);document.body.classList.remove('is-orbit-gallery');layer?.classList.remove('fi-orbit-layer');controls.remove();scene.traverse(obj=>{obj.geometry?.dispose();if(obj.material)obj.material.dispose();});backgroundQuad.geometry.dispose();backdropMaterial.dispose();placeholder.dispose();textures.forEach(tex=>tex.dispose());titleTexture.dispose();endTexture.dispose();renderer.dispose();renderer.forceContextLoss();}
  };
}
