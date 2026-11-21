import{HalfFloatType,Mesh,OrthographicCamera,PlaneGeometry,Scene,ShaderMaterial,Vector2,Vector3,WebGLRenderTarget}from"three";const DURATION=1780,fragmentShader=`
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 uOrigin, uMetric;
uniform float uFront, uWidth, uAmount;

void main() {
  vec2 delta = (vUv - uOrigin) * uMetric;
  float r = length(delta);
  vec2 direction = delta / max(r, .001);
  // Slightly uneven shoulders keep the expanding wave organic.
  float bend = .018 * direction.x * direction.y + .008 * direction.y;
  float band = (r - uFront + bend) / uWidth;
  if (abs(band) >= 1.) {
    gl_FragColor = texture2D(tDiffuse, vUv);
    return;
  }
  float envelope = (1. - smoothstep(.20, 1., abs(band))) * smoothstep(.012, .075, r);
  float phase = band * 8.8;
  float slope = sin(phase) * envelope;
  vec2 sampleUv = vUv + direction / uMetric * (uAmount * slope);
  vec4 scene = texture2D(tDiffuse, clamp(sampleUv, vec2(.001), vec2(.999)));
  // Small light/shade pair along the actual lens fold, not a drawn outline.
  float crest = max(0., cos(phase)) * envelope * uAmount;
  scene.rgb = scene.rgb * (1. - max(0., -slope) * uAmount * .6) + vec3(.46, .70, .94) * crest * .62;
  gl_FragColor = scene;
}`,root=document.documentElement,reduced=matchMedia("(prefers-reduced-motion: reduce)"),smooth=(a,b,value)=>{const t=Math.max(0,Math.min(1,(value-a)/(b-a)));return t*t*(3-2*t)};async function warmShader(renderer,material){const geometry=new PlaneGeometry(2,2),scene=new Scene,camera=new OrthographicCamera(-1,1,1,-1,0,1);scene.add(new Mesh(geometry,material));const target=new WebGLRenderTarget(1,1,{type:HalfFloatType,depthBuffer:!1}),previous=renderer.getRenderTarget();try{let compile;try{renderer.setRenderTarget(target),compile=renderer.compileAsync?renderer.compileAsync(scene,camera):renderer.compile(scene,camera)}finally{renderer.setRenderTarget(previous)}await compile}finally{target.dispose(),geometry.dispose()}}function mountEntryWave(){let prepared=null,played=!1,disposed=!1,restore=null;function clear(){if(!disposed){if(disposed=!0,observer.disconnect(),restore?.(),prepared){const{material,warming}=prepared;warming.then(()=>material.dispose()),prepared=null}delete root.dataset.entryWave,removeEventListener("finnovation:text-mode",clear),removeEventListener("pagehide",clear)}}function prepare(study){const cursor=study?.sceneCursor,pass=cursor?.pass;if(!pass?.uniforms?.tDiffuse||!pass.material||!study.renderer||!study.camera||!study.dropRoot)return null;const uniforms={tDiffuse:pass.uniforms.tDiffuse,uOrigin:{value:new Vector2(.5,.5)},uMetric:{value:new Vector2(1,1)},uFront:{value:0},uWidth:{value:.18},uAmount:{value:0}},material=new ShaderMaterial({name:"Entry wave \xB7 index1-5-11",uniforms,fragmentShader,vertexShader:pass.material.vertexShader,depthTest:!1,depthWrite:!1,toneMapped:!1}),warming=warmShader(study.renderer,material).catch(()=>{});return{cursor,pass,material,uniforms,study,warming}}function play(){const{cursor,pass,material,uniforms,study}=prepared,originalUpdate=cursor.update,originalMaterial=pass.material,center=study.dropRoot.getWorldPosition(new Vector3).project(study.camera),limit=value=>Math.max(.08,Math.min(.92,value));Number.isFinite(center.x+center.y)&&center.z>-1&&center.z<1&&uniforms.uOrigin.value.set(limit((center.x+1)/2),limit((center.y+1)/2));let normalEnabled=pass.enabled,width=0,height=0,reach=1;const started=performance.now();function update(...args){originalUpdate.apply(this,args),normalEnabled=pass.enabled;const p=(performance.now()-started)/DURATION;if(p>=1||reduced.matches||study.journey.target>.12){restore();return}if(width!==innerWidth||height!==innerHeight){width=innerWidth,height=Math.max(1,innerHeight);const{x,y}=uniforms.uOrigin.value,aspect=width/height;uniforms.uMetric.value.set(aspect,.92),reach=Math.hypot(Math.max(x,1-x)*aspect,Math.max(y,1-y)*.92)}uniforms.uFront.value=.022+(reach+.25)*(1-Math.pow(1-p,1.52)),uniforms.uWidth.value=.12+.14*p,uniforms.uAmount.value=(width<=680?.056:.076)*smooth(0,.075,p)*(1-smooth(.32,.95,p)),pass.enabled=!0}restore=()=>{cursor.update===update&&(cursor.update=originalUpdate),pass.material===material&&(pass.material=originalMaterial,pass.fsQuad?.material===material&&(pass.fsQuad.material=originalMaterial),pass.enabled=normalEnabled),restore=null,disposed||(root.dataset.entryWave="done")},pass.material=material,cursor.update=update,root.dataset.entryWave="playing"}function sync(){if(disposed)return;const state=root.dataset.gate;if(!state||state==="off"||root.dataset.renderMode==="text"){clear();return}if(!prepared&&!reduced.matches&&document.body.classList.contains("is-ready")&&(prepared=prepare(window.__MONTIS_STUDY__),prepared&&(observer.disconnect(),observer.observe(root,{attributes:!0,attributeFilter:["data-gate","data-render-mode"]}),root.dataset.entryWave="ready")),!(state!=="enter"||played)){if(!prepared||reduced.matches||window.__GATE__?.sound!==!1){clear();return}played=!0,play()}}const observer=new MutationObserver(sync);observer.observe(root,{attributes:!0,attributeFilter:["data-gate","data-render-mode"]}),observer.observe(document.body,{attributes:!0,attributeFilter:["class"]}),addEventListener("finnovation:text-mode",clear,{once:!0}),addEventListener("pagehide",clear,{once:!0}),sync()}!reduced.matches&&root.dataset.gate&&root.dataset.gate!=="off"&&mountEntryWave();