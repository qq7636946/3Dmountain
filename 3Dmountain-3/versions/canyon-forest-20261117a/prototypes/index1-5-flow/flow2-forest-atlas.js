/* Forest Atlas integration, mark page only. Uses the newly authored forest
   assets without starting another renderer or replacing the Flow navigation runtime.
   2026-11-15, third team (D2):
   - THE AIR: prototypes/forest-aerial/flow2-scene-air.js (cloud banks, low mist, the clouds' shadow) is added to the forest scene
     and updated each frame; window.__FLOW2_FOREST_AIR__ = { uniforms, glsl, inMaterial } is made HERE, before the scene module is
     imported, so the scene's own material may read the shadow map. ?air=0 leaves it out (the scene's own mist as before).
     Panel 「森林雲霧」, key A.
   - THE INTERFACE: the four points sit on the scene's anchors and follow the drag (as before); a thin ring round the lake with a
     tick toward each river; the hint as a caption line; at FOUR PATHS the step's field is emphasised (its label, its point, its
     tick; the scene's atlas.setActive(k) when it has one) and the others stand back. ?ring=0 leaves the ring out. */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('topdown') === '0') return;
  const base = document.currentScript.src;
  /* ONE stamp: the ?v= of this file's own <script> line also stamps its stylesheet, the scene module and the air module */
  const V = (v => encodeURIComponent(!v || v === 'four-rivers-1' ? 'td3-1' : v))(new URL(base).searchParams.get('v'));   // the 13:17 stamp counts as none: its stylesheet may be cached
  const html = document.documentElement;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = matchMedia('(pointer: coarse)');
  const clamp = x => Math.max(0, Math.min(1,x));
  const smooth = (a,b,x) => { const u=clamp((x-a)/(b-a));return u*u*(3-2*u); };
  const airOn = Q.get('air') !== '0';
  const tune = { view:1, from:7.66, points:1, cloud:airOn?0:.72, drift:1, ring:Q.get('ring')==='1'?1:0 };   /* lead 2026-11-15, client: 「圓形線條拿掉」 — the ring is off (?ring=1 brings it back) */
  /* the air's dials (the panel's object is the live one) and what the scene's material may read: see flow2-scene-air.js */
  /* flow2 air2 (2026-11-15): the cloud layers' dials (defaults = flow2-scene-air.js DEFAULTS) */
  const airTune = { clouds:1, banks:1, billows:1, high:0, mist:1, inner:1, thick:1, height:1, erosion:1, bright:1, shadeCol:'#b2bfcc',
    shadow:1, strength:.4, reach:.55, wind:1, windAngle:-14, sunAngle:149, keepUI:1, lift:1, res:1, isles:1 };
  /* D2 (2026-11-16, client's target picture): a softer low mist over the hollows and a few more small clouds at the edges — the same layers,
     denser (no new layer, no extra cost); ?waterlook=old keeps the air of before */
  if (Q.get('waterlook')!=='old') Object.assign(airTune, { mist:1.4, isles:1.15, bright:1.04, shadeCol:'#bccad3' });
  const AIR = airOn ? (window.__FLOW2_FOREST_AIR__ = { inMaterial:false,
    uniforms:{ uAirShadowMap:{value:null}, uAirRect:{value:[-8.6,-5.517,1/17.2,1/11.034]}, uAirShadow:{value:[0,0,0]} },
    glsl:`
  uniform sampler2D uAirShadowMap; uniform vec4 uAirRect; uniform vec3 uAirShadow;
  float forestAirShadow(vec2 xz){ return texture2D(uAirShadowMap,(xz-uAirRect.xy)*uAirRect.zw).r; }
  vec3 forestAir(vec3 c,vec2 xz){ return c*mix(vec3(1.),vec3(.56,.63,.72),forestAirShadow(xz)*uAirShadow.x); }` }) : null;
  /* flow2 grade (lead, 2026-11-16; client: 「整體色調要跟前面一致喔」): the view from above in the canyon's colour family — the page's own grade
     (偏藍: hue −7°, a touch cooler) plus less yellow in the greens and a little of the valley's blue in the shadows. Panel 「俯視色調」 key K. */
  const gradeTune = { on: Q.get('forestgrade')==='0'?0:1, hue:-7, sat:.95, temp:-.28, yellow:.38, lift:.05, liftColor:'#2c5170', bright:1.03, shade:1, contrast:1 };
  /* the canyon-style bake (2026-11-16) is already in the canyon's colours: only the page's own small blue shift, no darkening */
  if (Q.get('forestbake')!=='0') Object.assign(gradeTune, { hue:-4, sat:1.06, temp:-.08, yellow:.1, lift:0, bright:1.1, shade:0 });
  /* D2 (2026-11-16, client's target picture): warmer sun, fuller natural greens and teal — moved toward the picture, still a dial away from the
     canyon's family (panel 俯視色調 K / 森林水流 O 整體顏色); ?waterlook=old keeps the cooler grade of before */
  if (Q.get('forestbake')!=='0' && Q.get('waterlook')!=='old') Object.assign(gradeTune, { hue:-1, sat:1.1, temp:.04, yellow:.04, bright:1.07, contrast:1.06 });
  window.__FLOW2_FOREST_GRADE__ = gradeTune;   /* 2026-11-16: also shown in panel 「森林水流」 (O) as 整體顏色 */
  window.__FLOW2_PANEL__?.add({ id:'forestgrade', title:'俯視色調', key:'k', tune:gradeTune, rows:[
    ['色調統一（0＝原圖）', 'on', 0, 1, .01], ['色相（度）', 'hue', -25, 15, .5], ['飽和度', 'sat', .5, 1.4, .01], ['冷暖（負＝冷）', 'temp', -1, .6, .01],
    ['黃綠收斂', 'yellow', 0, 1, .01], ['暗部帶藍', 'lift', 0, .25, .005], ['暗部顏色', 'liftColor', 'color'], ['亮度', 'bright', .7, 1.4, .01], ['對比', 'contrast', .6, 1.6, .01], ['畫面下方壓暗', 'shade', 0, 1, .01]
  ] });
  if (airOn) window.__FLOW2_PANEL__?.add({ id:'forestair', title:'森林雲霧', key:'a', tune:airTune, rows:[
    ['雲量（整體）','clouds',0,2,.01], ['小雲朵（高 2）','banks',0,2,.01], ['薄雲絲（高 3）','billows',0,2,.01], ['高空薄紗（高 4.4）','high',0,2,.01],
    ['低處薄霧（高 1.25）','mist',0,2,.01], ['飄過森林的雲島','isles',0,2,.01], ['中間零星的小雲','inner',0,3,.01], ['雲的濃度（透明度）','thick',0,1.6,.01], ['雲層高度（倍）','height',.4,2.5,.01],
    ['雲邊的細碎','erosion',0,2,.01], ['雲頂亮度','bright',.5,1.5,.01], ['雲的暗面顏色','shadeCol','color'],
    ['— 雲影 —'], ['雲影','shadow',0,1,.01], ['雲影深淺','strength',0,1,.01], ['影子離雲多遠（1＝照太陽）','reach',0,1.5,.01],
    ['— 風、太陽、介面 —'], ['風（飄移速度）','wind',0,5,.05], ['風向（度，0＝往東）','windAngle',-180,180,1], ['太陽方向（度）','sunAngle',-180,180,1],
    ['標題與標籤周圍淨空','keepUI',0,1,.01], ['畫面下方的雲提亮','lift',0,1,.01], ['雲的解析度','res',.25,1,.05]
  ] });
  const state = { stage:'waiting',mode:'forest-atlas',view:0,clock:0,ready:false,gate:false,errors:[],frames:0 };
  const api = window.__FLOW2_FOREST_ATLAS__ = { tune,state };
  // Compatibility flags used by the page's labels; no old procedural land loads.
  window.__FLOW2_TOPDOWN__ = api;
  const style = document.createElement('link'); style.rel='stylesheet';
  style.href=new URL('flow2-forest-atlas.css?v='+V,base).href; document.head.append(style);
  const sceneModule = import(new URL('../forest-aerial/flow2-original-scene.js?v='+V,base).href);
  const airModule = airOn ? import(new URL('../forest-aerial/flow2-scene-air.js?v='+V,base).href).catch(error=>({error})) : null;
  // Attach a handler immediately, even if the renderer has not been created yet.
  sceneModule.catch(error=>fail(error));
  let THREE, renderer, composer, ShaderPass, canyon, study, atlas, air, pass, atlasTarget, heldTarget, copyPass;
  let started=false, disposed=false, ready=false, active=false, weight=0, lastFrame=performance.now(), fadeAt=0, fading=false, previousActive=false;
  const inputAbort = new AbortController();
  let wanted=NaN, gateOpen=false, gateTimer=0, holdSince=0, savedLiftFade, ownsLiftFade=false;
  let layer, status, resetButton, nodes=[], lastStatus='', width=0, height=0, goTimer=0, goWant=0, goSince=0;
  let captured=false, drag=null, emptyScene, projected, ring=null, ringKey='', lastCurrent=-2;
  const fields=[['01','AI 量化交易','AI QUANT TRADING'],['02','上市櫃投資','PUBLIC EQUITIES'],['03','未上市與 PRE-IPO','PRE-IPO INVESTMENT'],['04','衍生性商品','DERIVATIVE STRATEGIES']];
  const host=window.__FLOW2_FINE_JOURNEY__ ||= {};
  const beforeAttach=host.attach, beforeCanyon=host.canyon;
  host.attach=function(h={}) { try{return beforeAttach?.call(this,h);}finally{THREE||=h.THREE;renderer||=h.renderer;composer=h.composer||composer;ShaderPass||=h.ShaderPass;start();} };
  host.canyon=function(h={}) { try{return beforeCanyon?.call(this,h);}finally{THREE||=h.THREE;renderer||=h.renderer;canyon=h.canyon||canyon;start();} };
  /* flow2 brush (lead, 2026-11-15): while flow2-lift-cut.js paints this view over the valley, it sets api.override = { clock, brush, dir, look, reduce }:
     the view is drawn live at that clock (its own arrival) and composited through the brush mask over the live valley */
  const ov=()=>api.override&&api.override.on?api.override:null;
  const clock=()=>{const o=ov();return o?o.clock:(study?.journeyClock(study.journey.progress) || 0);};
  const shift=()=>study.journey.max-study.journeyClock(study.journey.max);
  const cutPlaying=()=>['armed','play'].includes(window.__FLOW2_LIFT_CUT__?.state.phase);
  function restoreLiftFade() {
    if(!ownsLiftFade)return;
    if(savedLiftFade===undefined)delete window.__FLOW2_LIFT_FADE__;
    else window.__FLOW2_LIFT_FADE__=savedLiftFade;
    ownsLiftFade=false;
  }

  function fail(error) {
    if(disposed)return;
    ready=false;state.ready=false;state.stage='failed';state.errors.push(String(error?.message||error));
    releaseGate();restoreLiftFade();if(pass)pass.enabled=false;
    html.removeAttribute('data-flow2-topdown');html.removeAttribute('data-flow2-forest');
    layer?.classList.remove('is-on');
    message('森林地景暫時無法載入，已保留原本的章節。');
    console.warn('Flow forest atlas:',error);
  }
  function message(text) { if(!status)return; if(lastStatus!==text){lastStatus=text;status.textContent=text;}status.hidden=!text; }
  function releaseGate() {
    if(!gateOpen)return;gateOpen=false;state.gate=false;clearInterval(gateTimer);
    const target=wanted;wanted=NaN;message('');
    if(Number.isFinite(target)&&target>study.journey.target)study.journey.target=target;
  }
  function installGate() {
    gateOpen=true;state.gate=true;
    for(const key of ['target','progress']) {
      const J=study.journey,d=Object.getOwnPropertyDescriptor(J,key);let value=d?.value;
      const get=d?.get?()=>d.get.call(J):()=>value, set=d?.set?v=>d.set.call(J,v):v=>{value=v;};
      Object.defineProperty(J,key,{configurable:true,enumerable:true,get,set(v){
        if(gateOpen&&Number.isFinite(v)) {
          if(ready||tune.view<.5||state.stage==='failed')releaseGate();
          else {
            const cut=window.__FLOW2_LIFT_CUT__?.tune;
            const limit=(cut?.from??7.6)-(cut?.reach??.06)-.02+shift();
            if(v>limit){if(key==='target')wanted=v;holdSince ||= performance.now();v=limit;message('正在準備森林地景…');}
          }
        }
        set(v);
      }});
    }
    gateTimer=setInterval(()=>{if(ready||state.stage==='failed')releaseGate();else if(holdSince&&performance.now()-holdSince>25000)fail(new Error('Forest loading timed out'));},100);
  }
  function buildUI() {
    layer=document.createElement('div');layer.className='f2td-layer';layer.setAttribute('role','group');layer.setAttribute('aria-label','森林中的四大投資領域');
    fields.forEach(([n,zh,en],k)=>{
      const button=document.createElement('button');button.type='button';button.className='f2td-point';button.dataset.k=k;button.dataset.side=k===0||k===3?'right':'left';
      button.setAttribute('aria-label',`${n} ${zh} ${en}`);button.tabIndex=-1;
      button.innerHTML=`<span class="f2td-target" aria-hidden="true"><i></i></span><span class="f2td-pole" aria-hidden="true"></span><span class="f2td-tag"><b>${n}</b><span class="f2td-zh">${zh}</span><span class="f2td-en">${en}</span></span>`;
      button.addEventListener('click',()=>go(k));layer.append(button);nodes.push(button);
    });
    resetButton=document.createElement('button');resetButton.className='f2fa-home';resetButton.type='button';resetButton.addEventListener('click',()=>atlas?.reset());layer.append(resetButton);
    /* the ring round the lake: one hairline, a finer dotted one inside it, a tick toward each river (drawn first: under the labels) */
    ring=document.createElementNS('http://www.w3.org/2000/svg','svg');ring.setAttribute('class','f2fa-ring');ring.setAttribute('viewBox','-100 -100 200 200');ring.setAttribute('aria-hidden','true');
    ring.innerHTML='<circle class="f2fa-ring-a" r="96"/><circle class="f2fa-ring-b" r="93.4"/>'+fields.map((f,k)=>`<g class="f2fa-ring-t" data-k="${k}"><line x1="96" y1="0" x2="98.6" y2="0"/></g>`).join('');
    layer.prepend(ring);
    (document.querySelector('.finnovation-ui')||document.body).append(layer);
    status=document.createElement('div');status.className='f2fa-status';status.setAttribute('role','status');status.hidden=true;document.body.append(status);
    if(Q.get('atlasqa')==='1'){const debug=document.createElement('output');debug.id='forest-atlas-debug';debug.hidden=true;document.body.append(debug);}
    window.addEventListener('pointerdown',event=>{
      // Vertical touch remains the site's chapter navigation; it must not also pan the atlas.
      if(!active||weight<.99||study.world?.open||study.portfolio?.open||event.pointerType==='touch'||event.button!==0||event.target.closest('button,a,input,textarea,[role="dialog"],.is-menu-open'))return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY};html.dataset.flow2ForestDrag='on';
    },{signal:inputAbort.signal});
    window.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;atlas?.pan(event.clientX-drag.x,event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY;},{signal:inputAbort.signal});
    const end=()=>{drag=null;html.removeAttribute('data-flow2-forest-drag');};
    window.addEventListener('pointerup',end,{signal:inputAbort.signal});window.addEventListener('pointercancel',end,{signal:inputAbort.signal});window.addEventListener('blur',end,{signal:inputAbort.signal});
  }
  function go(k) {
    if(!study?.strategyReveal)return;goWant=k+1;goSince=performance.now();if(goTimer)return;
    const step=()=>{goTimer=0;if(performance.now()-goSince>8000)return;
      const J=study.journey,sr=study.strategyReveal;
      if(J.progress<J.max-.046){J.velocity=0;J.target=J.max;goTimer=setTimeout(step,90);return;}
      if(sr.state.count===goWant)return;sr.take(sr.state.count < goWant ? .15 : -.15,'click');goTimer=setTimeout(step,300);
    };step();
  }
  function projectPoints() {
    const compact=innerWidth<600||coarsePointer.matches;
    const resetLabel=compact?'FOREST OVERVIEW':'DRAG TO EXPLORE · RESET VIEW';
    if(resetButton.textContent!==resetLabel){resetButton.textContent=resetLabel;resetButton.setAttribute('aria-label',compact?'回到森林全景':'拖曳探索森林，點擊回到全景');}
    const visible=active&&weight>.97&&tune.points>=.5&&!cutPlaying()&&!fading&&!study.world?.open&&!study.portfolio?.open;
    layer.classList.toggle('is-on',visible);layer.inert=!visible;
    const cur=document.querySelector('.finnovation-ui')?.dataset.chapter==='strategies'?study.strategyReveal?.state.count-1:-1;
    const current=visible&&cur>=0&&cur<4?cur:-1;
    if(current!==lastCurrent){lastCurrent=current;layer.classList.toggle('has-current',current>=0);try{atlas.setActive?.(current);}catch(error){}
      ring?.querySelectorAll('.f2fa-ring-t').forEach((g,k)=>g.classList.toggle('is-current',k===current));}
    placeRing(visible);
    nodes.forEach((node,k)=>{
      node.classList.toggle('is-in',visible);node.tabIndex=visible?0:-1;
      const chosen=k===cur;node.classList.toggle('is-current',chosen);
      if(chosen)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');
      if(!visible)return;
      node.dataset.side=innerWidth>=760?(k===1?'left':'right'):(k===0||k===3?'right':'left');
      projected.copy(atlas.anchors[k]).project(atlas.camera);
      let x=(projected.x*.5+.5)*innerWidth, y=(.5-projected.y*.5)*innerHeight;
      if(innerWidth<600){x=innerWidth*(k===0||k===3 ? .08 : .92);y=innerHeight*[.17,.22,.80,.75][k];}   /* phones (2026-11-16): two names above the title block, two below the button, none over the title */
      else {x=Math.max(52,Math.min(innerWidth-52,x));y=Math.max(145,Math.min(innerHeight*.87,y));}
      node.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    });
  }
  /* the ring stands on the lake (the scene's atlas.lake when it gives one) and moves with the drag; its ticks point at the four points */
  function placeRing(visible) {
    if(!ring)return;
    const on=visible&&tune.ring>=.5&&innerWidth>=760;ring.classList.toggle('is-in',on);if(!on)return;
    const L=atlas.lake?.outer?atlas.lake:null, cx=L?.center?.x??.0846, cy=L?.center?.y??.105, cz=L?.center?.z??-.1112, R=L?.outer||2.965;   // the scene's ring round the whole lake (atlas.lake.outer), else the modeller's lake (manifest: centre, 1.25 × the radius round its body)
    projected.set(cx,cy,cz).project(atlas.camera);const x=(projected.x*.5+.5)*innerWidth, y=(.5-projected.y*.5)*innerHeight;
    projected.set(cx+R,cy,cz).project(atlas.camera);const r=Math.abs((projected.x*.5+.5)*innerWidth-x);
    const size=(r*200/96).toFixed(1);if(ring.style.width!==size+'px'){ring.style.width=ring.style.height=size+'px';}
    ring.style.transform=`translate3d(${(x-r*100/96).toFixed(1)}px,${(y-r*100/96).toFixed(1)}px,0)`;
    const key=size+'|'+innerWidth+'|'+innerHeight;if(key===ringKey)return;ringKey=key;
    ring.querySelectorAll('.f2fa-ring-t').forEach((g,k)=>{projected.copy(atlas.anchors[k]).project(atlas.camera);
      const ax=(projected.x*.5+.5)*innerWidth-x, ay=(.5-projected.y*.5)*innerHeight-y;g.setAttribute('transform',`rotate(${(Math.atan2(ay,ax)*180/Math.PI).toFixed(2)})`);});
  }
  function seat() {
    const passes=composer.passes, index=passes.indexOf(pass);
    if(index>=0)passes.splice(index,1);
    const cut=passes.findIndex(p=>p.uniforms?.tHeld&&p.uniforms?.uCell);
    if(cut>=0)passes.splice(cut,0,pass);else passes.push(pass);
  }
  function sync() {
    if(disposed)return;
    const current=performance.now(),dt=Math.min(.05,Math.max(0,(current-lastFrame)/1000));lastFrame=current;
    const c=clock();state.clock=+c.toFixed(3);
    const sea=study.seaFlow?.amount||0;
    const covered=study.portfolio?.open||(study.world?.open&&!study.world.seaLeg);
    /* the view takes over where the cut fires (flow2-lift-cut.js moved it earlier on 2026-11-15: nothing of the old lift is ever drawn, also when the page's own navigation travels across) */
    const cut=window.__FLOW2_LIFT_CUT__, from=cut&&cut.state.stage==='ready'&&Number.isFinite(+cut.tune.from)?Math.min(tune.from,+cut.tune.from+.06):tune.from;state.from=from;
    const o=ov();
    active=ready&&tune.view>=.5&&(o||c>=from)&&!covered&&sea<.999;
    /* lead (2026-11-15, client: 「還是會顯示原本的那個河流啊」): the view no longer fades out with the bridge to the sea — that fade showed the engine's
       old aerial (its old rivers) under the mosaic. The sea comes in over it on its own canvas; the view lets go only when the sea is whole. */
    weight=active?1:0;
    /* lead 2026-11-16 (client: 「草蔓延的那個特效怎沒了」): every arrival replays the spreading — also through the rail / menu, not only through the stroke */
    /* Engineer 3 (2026-11-16): the spreading is the view's one entrance — a return within the replay gap shows the land as it was left (flow2-lift-cut.js window.__FLOW2_MOTION__) */
    { const M=window.__FLOW2_MOTION__;
      if(active&&!previousActive&&!o&&!reducedMotion){ if(M&&M.recent()&&atlas?.growth>.02)atlas?.autoGrowth?.(); else atlas?.arrive?.(); }
      if(!active&&previousActive&&!o&&M&&M.on){ M.left(); atlas?.setGrowth?.(atlas.growth); } }
    if(previousActive!==active) {
      if(!cutPlaying()&&captured&&!reducedMotion){fadeAt=current;fading=true;}
      previousActive=active;
      if(active){savedLiftFade=window.__FLOW2_LIFT_FADE__;ownsLiftFade=true;window.__FLOW2_LIFT_FADE__=[1e4,1e4+1];}
      else restoreLiftFade();
    }
    if(fading&&(cutPlaying()||current-fadeAt>550))fading=false;
    if(pass)pass.enabled=ready&&(active||fading||Math.abs(c-from)<.8||cutPlaying()||!!o);
    html.toggleAttribute('data-forest-atlas-ready',ready);
    /* flow2 brush: the page restyles itself when these change (a forced layout of the whole page, ≈ 20 ms): never while the brush paints —
       forward they change with the jump at its end, backward with the jump at its start, both while the view from above fills the screen */
    const dom=active&&!o;
    if(dom){if(html.dataset.flow2Forest!=='on'){html.dataset.flow2Topdown='on';html.dataset.flow2Forest='on';}}
    else if(html.hasAttribute('data-flow2-forest')||html.hasAttribute('data-flow2-topdown')){html.removeAttribute('data-flow2-topdown');html.removeAttribute('data-flow2-forest');}
    state.view=active?1:0;
    if(atlas&&active){if(width!==innerWidth||height!==innerHeight){width=innerWidth;height=innerHeight;atlas.resize(width,height);}atlas.update(c,dt,tune);
      if(air){const q=window.__FLOW2_QUALITY__;air.setTier(q&&Number.isFinite(+q.rank)?+q.rank:2);air.update(dt,tune);}}
    if(atlas)projectPoints();
    const debug=document.getElementById('forest-atlas-debug');
    if(debug&&state.frames%30===0)debug.textContent=JSON.stringify({...state,weight,sea,cut:window.__FLOW2_LIFT_CUT__?.state.phase,count:study.strategyReveal?.state.count,metrics:atlas?.metrics});
  }
  function installPass() {
    atlasTarget=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,depthBuffer:true});
    heldTarget=new THREE.WebGLRenderTarget(4,4,{depthBuffer:false});
    pass=new ShaderPass({uniforms:{tDiffuse:{value:null},tForest:{value:null},tHeld:{value:null},uWeight:{value:0},uFade:{value:1},
        uBrush:{value:new THREE.Vector4(0,1,1,0)},uBrushLook:{value:new THREE.Vector4(.28,1,1,1)},uRes:{value:new THREE.Vector2(1,1)},
        uGradeA:{value:new THREE.Vector4(0,1,0,0)},uGradeB:{value:new THREE.Vector4(0,0,0,0)},uGradeC:{value:new THREE.Vector4(1,1,1,1)},uGradeD:{value:new THREE.Vector4(1,0,0,0)}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform sampler2D tDiffuse,tForest,tHeld;uniform float uWeight,uFade;uniform vec4 uBrush,uBrushLook;uniform vec2 uRes;uniform vec4 uGradeA,uGradeB,uGradeC,uGradeD;
        vec3 fGrade(vec3 c){
          float cs=cos(uGradeA.x),sn=sin(uGradeA.x);
          c=mat3(.213+cs*.787-sn*.213,.213-cs*.213+sn*.143,.213-cs*.213-sn*.787,.715-cs*.715-sn*.715,.715+cs*.285+sn*.140,.715-cs*.715+sn*.715,.072-cs*.072+sn*.928,.072-cs*.072-sn*.283,.072+cs*.928+sn*.072)*c;
          float l=dot(c,vec3(.2126,.7152,.0722));
          float yel=clamp((min(c.r,c.g)-c.b)/max(max(c.r,c.g),1e-3),0.,1.)*smoothstep(.2,.9,c.r/max(c.g,1e-3));
          c=mix(c,vec3(l)+(c-vec3(l))*vec3(.78,1.,1.12),yel*uGradeB.x);
          c=vec3(l)+(c-vec3(l))*uGradeA.y;
          c*=vec3(1.+.05*uGradeA.z,1.+.01*uGradeA.z,1.-.05*uGradeA.z);
          c+=uGradeC.rgb*uGradeB.y*(1.-smoothstep(0.,.35,l));
          l=dot(max(c,0.),vec3(.2126,.7152,.0722)); c*=pow(max(l,1e-4)/.2,uGradeD.x-1.);   /* 對比: a power curve around mid grey, hue kept */
          return c*uGradeB.z;
        }
        float bH(float x){return fract(sin(x*127.1+.7)*43758.5453);}
        float bN(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(bH(i),bH(i+1.),f);}
        float bF(float x){return bN(x)*.55+bN(x*2.13+7.)*.3+bN(x*4.71+3.)*.15;}
        float bN2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=bH(i.x+i.y*57.),b=bH(i.x+1.+i.y*57.),c=bH(i.x+(i.y+1.)*57.),d=bH(i.x+1.+(i.y+1.)*57.);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
        void main(){
          /* the brush: one wide stroke along uBrushLook.x; 1 behind its front (the view from above), 0 ahead (the valley) */
          float m=1.;vec2 offF=vec2(0.),offB=vec2(0.);
          if(uBrush.x>.5){
            if(uBrush.w>.5)m=uBrush.y;
            else{
              float asp=uRes.x/uRes.y;vec2 p=(vUv-.5)*vec2(asp,1.);
              vec2 d=vec2(cos(uBrushLook.x),sin(uBrushLook.x)),n=vec2(-d.y,d.x);
              float s=dot(p,d),q=dot(p,n);
              float ext=.5*(abs(d.x)*asp+abs(d.y)),ext2=.5*(abs(n.x)*asp+abs(n.y));
              /* lead 2026-11-15 (client: 「刷過去的那種要羽化不要那麼銳利邊」): a wide feathered edge — the stroke's shape stays (curved head, soft
                 fibres ahead, a softly broken band behind), but nothing is sharp */
              float band=.26*uBrushLook.y;
              float qn=q/ext2;
              float f=mix(-ext-band*.45-.3,ext+band*1.05+.4,uBrush.y);   /* at 1 every corner is covered: the jump to picture two is never seen */
              float e=f-.15*qn*qn+((bF(q*18.)-.5)*.06+(bF(q*5.+3.)-.5)*.12)*uBrushLook.z+pow(bF(q*60.+11.),5.)*.06*uBrushLook.z;
              float paint=1.-smoothstep(e-band*.9,e+band*.4,s);
              float behind=clamp((e-s)/band,0.,1.);
              float dry=smoothstep(.05,.95,bN2(vec2(q*24.,s*2.))+behind*.7);
              m=paint*mix(mix(1.,dry,.6*min(1.,uBrushLook.z)),1.,smoothstep(.1,.9,behind));
              m=smoothstep(0.,1.,m);
              /* both pictures dragged a little along the stroke where the brush is */
              float at=exp(-abs(s-e+band*.25)/(.12*uBrushLook.y))*uBrushLook.w;
              vec2 du=d/vec2(asp,1.);
              offF=-du*.016*at;offB=du*.006*at;
            }
          }
          vec3 base=texture2D(tDiffuse,vUv+offB).rgb;
          vec3 forest=sRGBTransferOETF(vec4(texture2D(tForest,vUv+offF).rgb,1.)).rgb;
          forest=mix(forest,fGrade(forest),uGradeA.w);
          float shade=smoothstep(.44,1.,1.-vUv.y)*.40*uGradeB.w;
          forest*=1.-shade*uWeight;
          vec3 live=mix(base,forest,uWeight*m);gl_FragColor=vec4(mix(texture2D(tHeld,vUv).rgb,live,uFade),1.);}`});
    pass.uniforms.tForest.value=atlasTarget.texture;
    pass.uniforms.tHeld.value=heldTarget.texture;
    pass.material.toneMapped=false;pass.enabled=false;
    copyPass=new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D tDiffuse;void main(){gl_FragColor=texture2D(tDiffuse,vUv);}'});
    copyPass.material.toneMapped=false;
    const draw=pass.render.bind(pass);
    pass.render=function(r,write,read,dt,mask){
      const w=read.width,h=read.height;
      if(atlasTarget.width!==w||atlasTarget.height!==h){atlasTarget.setSize(w,h);heldTarget.setSize(w,h);captured=false;fading=false;}
      const afterCovered=!!window.__FLOW2_AFTER__?.covered;   /* AFTER (team F3): the next block covers the screen: the view is not drawn behind it */
      if(active&&air&&!afterCovered){air.setView(w,h);air.render(r);}
      if(active&&!afterCovered){
        const target=r.getRenderTarget(),tone=r.toneMapping,shadow=r.shadowMap.autoUpdate;
        try{r.toneMapping=THREE.NoToneMapping;r.shadowMap.autoUpdate=false;r.setRenderTarget(atlasTarget);r.clear();r.render(atlas.scene,atlas.camera);try{window.__FLOW2_LAKE_MARK__?.draw?.(r,atlasTarget,atlas,THREE);}catch(error){}try{window.__FLOW2_AFTER__?.lens?.(r,atlasTarget,pass,atlas,THREE);}catch(error){}}
        finally{r.toneMapping=tone;r.shadowMap.autoUpdate=shadow;r.setRenderTarget(target);}
      }
      pass.uniforms.uWeight.value=weight;
      {const G=gradeTune,U=pass.uniforms;U.uGradeA.value.set(G.hue*Math.PI/180,G.sat,G.temp,Math.min(1,Math.max(0,+G.on||0)));U.uGradeB.value.set(G.yellow,G.lift,G.bright,G.shade);const c=new THREE.Color(G.liftColor);U.uGradeC.value.set(c.r,c.g,c.b,1);U.uGradeD.value.set(Number.isFinite(+G.contrast)?+G.contrast:1,0,0,0);}
      {const o=ov(),U=pass.uniforms;U.uRes.value.set(w,h);U.uBrush.value.set(o?1:0,o?Math.min(1,Math.max(0,+o.brush||0)):1,o?o.dir:1,o?.reduce?1:0);if(o?.look)U.uBrushLook.value.fromArray(o.look);}
      pass.uniforms.uFade.value=fading?smooth(0,550,performance.now()-fadeAt):1;
      const screen=this.renderToScreen;
      // Keep the fully assembled forest / canyon picture for direct chapter jumps.
      // The lift-cut separately captures this same output for its glass transition.
      this.renderToScreen=false;draw(r,write,read,dt,mask);this.renderToScreen=screen;
      if(!fading){copyPass.renderToScreen=false;copyPass.render(r,heldTarget,write,dt,mask);captured=true;}
      if(screen){copyPass.renderToScreen=true;copyPass.render(r,write,write,dt,mask);}
      state.frames++;
    };
    composer.addPass(pass);seat();
    emptyScene=new THREE.Scene();projected=new THREE.Vector3();
    const main=study.mainRenderPass,render=main.render;
    main.render=function(...args){
      sync();const scene=this.scene;
      // Keep main's buffer swap and depth bookkeeping; don't draw an invisible canyon.
      if(active&&weight>.999&&!ov())this.scene=emptyScene;
      try{return render.apply(this,args);}finally{this.scene=scene;}
    };
    const update=canyon.update;
    canyon.update=function(...args){const result=update.apply(this,args);seat();return result;};
  }
  async function start() {
    if(disposed||started||!THREE||!renderer||!composer||!ShaderPass||!canyon)return;
    study=window.__MONTIS_STUDY__;if(!study)return;
    started=true;state.stage='loading';buildUI();installGate();installPass();
    const begin=performance.now();
    try {
      const module=await sceneModule;atlas=await module.createForestScene(renderer,reducedMotion);
      if(disposed||state.stage==='failed'){atlas.dispose();return;}
      api.scene=atlas;
      if(airModule){
        /* the air never stops the view: if it cannot be made, the scene's own mist stays */
        try{const made=await airModule;if(made.error)throw made.error;
          air=made.createForestAir(renderer,{reducedMotion,atlas,shared:AIR,tune:airTune});atlas.scene.add(air.group);api.air=air;
          for(const o of atlas.scene.children)if(o!==air.group&&o.isGroup&&o.children.length&&o.children.every(m=>m.material?.uniforms?.seed&&m.material?.uniforms?.alpha))o.visible=false;
        }catch(error){air=null;tune.cloud=.72;delete window.__FLOW2_FOREST_AIR__;state.errors.push('air: '+String(error?.message||error));console.warn('Flow forest air: left out',error);}
        if(disposed){air?.dispose();return;}
      }
      /* flow2 birds (2026-11-15): seagulls over the view (../forest-aerial/flow2-scene-birds.js, panel 「海鷗」 key S; ?birds=0 = none). Updated by the
         scene's own frame hook (only while the view is drawn), compiled with the scene just below; their shadows go to the air's map. Never stops the view. */
      if(Q.get('birds')!=='0')try{const made=await import(new URL('../forest-aerial/flow2-scene-birds.js?v='+V,base).href);
        const birds=made.createForestBirds(renderer,{reducedMotion,atlas,shared:AIR});atlas.scene.add(birds.group);api.birds=birds;atlas.onUpdate?.(f=>birds.update(f.dt));
      }catch(error){state.errors.push('birds: '+String(error?.message||error));console.warn('Flow forest birds: left out',error);}
      /* flow2 water W1 (2026-11-16): the water of this view as a SURFACE (../forest-aerial/flow2-scene-water.js: a mesh over the lake and the four rivers,
         waves carried down the rivers into the lake, the canyon river's shading; panel 「俯視水面」 key N; ?wsurf=0 = the scene's own water). Updated by the
         scene's frame hook, compiled with the scene just below. Never stops the view. */
      if(Q.get('wsurf')!=='0')try{const made=await import(new URL('../forest-aerial/flow2-scene-water.js?v='+V,base).href);
        const water=await made.createForestWater(renderer,{reducedMotion,atlas,shared:AIR});if(water){atlas.scene.add(water.group);api.water=water;atlas.onUpdate?.(f=>water.update(f));}
      }catch(error){state.errors.push('water: '+String(error?.message||error));console.warn('Flow forest water surface: left out',error);}
      /* end flow2 water W1 */
      /* flow2 water W2 (2026-11-16): the FLOW of this view made visible (../forest-aerial/flow2-scene-flow.js: ribbons along the baked streamlines
         original/w2-streamlines.json — the four luminous currents that continue the canyon's four beams, streaks and foam carried down the rivers into
         the lake and round to its centre, eddies at the mouths; panel 「俯視水流」 key U; ?wflow=0 = none). Updated by the scene's frame hook (which
         also tells it the active field), compiled with the scene just below. Never stops the view. */
      if(Q.get('wflow')!=='0')try{const made=await import(new URL('../forest-aerial/flow2-scene-flow.js?v='+V,base).href);
        const flow=await made.createForestFlow(renderer,{reducedMotion,atlas});if(flow){atlas.scene.add(flow.group);api.flow=flow;atlas.onUpdate?.(f=>flow.update(f));}
      }catch(error){state.errors.push('flow: '+String(error?.message||error));console.warn('Flow forest water flow: left out',error);}
      /* end flow2 water W2 */
      const tiny=new THREE.WebGLRenderTarget(8,8,{type:THREE.HalfFloatType});
      let previous=renderer.getRenderTarget(),tone=renderer.toneMapping,compiling;
      try{renderer.toneMapping=THREE.NoToneMapping;renderer.setRenderTarget(tiny);compiling=renderer.compileAsync?.(atlas.scene,atlas.camera);}
      finally{renderer.setRenderTarget(previous);renderer.toneMapping=tone;}
      await compiling;
      if(disposed){tiny.dispose();return;}
      /* flow2-tex ENGINE (2026-11-16, iGPU: 「這跑內顯時候會卡」): the warm draw below and the air's warm-up first only COMPILE what they will draw, on the
         driver's threads, and wait until it is ready — so neither blocks the canyon for 0.25–0.37 s. Only where flow2-tex-engine.js is loaded (?texE=0 = as before). */
      if(window.__FLOW2_TEX_ENGINE__?.settle){try{await window.__FLOW2_TEX_ENGINE__.settle(renderer,()=>{const p=renderer.getRenderTarget(),t=renderer.toneMapping;try{renderer.toneMapping=THREE.NoToneMapping;renderer.setRenderTarget(tiny);renderer.render(atlas.scene,atlas.camera);}finally{renderer.setRenderTarget(p);renderer.toneMapping=t;}air?.warm(renderer);});}catch(error){}if(disposed){tiny.dispose();return;}}
      previous=renderer.getRenderTarget();tone=renderer.toneMapping;
      try{renderer.toneMapping=THREE.NoToneMapping;renderer.setRenderTarget(tiny);renderer.render(atlas.scene,atlas.camera);}
      finally{renderer.setRenderTarget(previous);renderer.toneMapping=tone;tiny.dispose();}
      /* the air's noise picture and first shadow map: made now, while the page prepares, never when the view opens */
      try{air?.warm(renderer);}catch(error){air?.dispose();air=null;tune.cloud=.72;state.errors.push('air: '+String(error?.message||error));console.warn('Flow forest air: left out',error);}
      state.stage='ready';state.ready=ready=true;state.readyMs=Math.round(performance.now()-begin);releaseGate();
    } catch(error){fail(error);}
  }
  function dispose() {
    if(disposed)return;disposed=true;active=ready=false;state.stage='off';state.ready=false;state.view=0;
    inputAbort.abort();drag=null;releaseGate();clearInterval(gateTimer);clearTimeout(goTimer);restoreLiftFade();
    ['data-flow2-topdown','data-flow2-forest','data-flow2-forest-drag','data-forest-atlas-ready'].forEach(name=>html.removeAttribute(name));
    layer?.remove();status?.remove();if(pass)pass.enabled=false;
    air?.dispose();atlas?.dispose();atlasTarget?.dispose();heldTarget?.dispose();pass?.dispose();copyPass?.dispose();
  }
  window.addEventListener('finnovation:text-mode',dispose,{once:true});
  window.addEventListener('finnovation:render-stop',dispose,{once:true});
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
})();
