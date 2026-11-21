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
  const html = document.documentElement;
  const studioOn = html.hasAttribute('data-rise-studio-pbr');
  /* PERF STRIKE (2026-11-21, SHADE): rise page only, ?perf=0 = exactly as before. See .qa/perf/rise/PHASE-B.md */
  const PERF_RISE = studioOn && Q.get('perf') !== '0', PERF_CHECK = PERF_RISE && Q.get('perfCheck') === 'scissor';
  let boxNow = null;
  if (!studioOn && Q.get('topdown') === '0') return;
  const base = document.currentScript.src;
  /* ONE stamp: the ?v= of this file's own <script> line also stamps its stylesheet, the scene module and the air module */
  const V = (v => encodeURIComponent(!v || v === 'four-rivers-1' ? 'td3-1' : v))(new URL(base).searchParams.get('v'));   // the 13:17 stamp counts as none: its stylesheet may be cached
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = matchMedia('(pointer: coarse)');
  const clamp = x => Math.max(0, Math.min(1,x));
  const smooth = (a,b,x) => { const u=clamp((x-a)/(b-a));return u*u*(3-2*u); };
  const airOn = !studioOn && Q.get('air') !== '0';
  const tune = { view:1, from:7.66, points:1, cloud:airOn?0:.72, drift:1, ring:Q.get('ring')==='1'?1:0, scissor:Q.get('perfScissor')==='0'?0:1, surveyReach:Q.get('surveyReach')!=null?+Q.get('surveyReach'):1 };   /* lead 2026-11-15, client: 「圓形線條拿掉」 — the ring is off (?ring=1 brings it back) */
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
  if (!studioOn) window.__FLOW2_FOREST_GRADE__ = gradeTune;   /* 2026-11-16: also shown in panel 「森林水流」 (O) as 整體顏色 */
  if (!studioOn) window.__FLOW2_PANEL__?.add({ id:'forestgrade', title:'俯視色調', key:'k', tune:gradeTune, rows:[
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
  const studioModule = studioOn ? import(new URL('../forest-aerial/studio/flow2-studio-pbr-view.js?v='+V,base).href).catch(error=>({error})) : null;
  const airModule = airOn ? import(new URL('../forest-aerial/flow2-scene-air.js?v='+V,base).href).catch(error=>({error})) : null;
  // Attach a handler immediately, even if the renderer has not been created yet.
  sceneModule.catch(error=>fail(error));
  let THREE, renderer, composer, ShaderPass, canyon, study, atlas, air, studioView, pass, atlasTarget, heldTarget, copyPass, heldDirect=false, blackTex=null;
  let started=false, disposed=false, ready=false, active=false, weight=0, lastFrame=performance.now(), fadeAt=0, fading=false, previousActive=false;
  const inputAbort = new AbortController();
  let wanted=NaN, gateOpen=false, gateTimer=0, holdSince=0, savedLiftFade, ownsLiftFade=false;
  let layer, status, resetButton, nodes=[], lastStatus='', width=0, height=0, goTimer=0, goWant=0, goSince=0;
  let captured=false, drag=null, emptyScene, projected, ring=null, ringKey='', lastCurrent=-2, labelsWere=null;
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

  const failureMessage = () => studioOn ? '俯視山谷暫時無法載入，請重新整理後再試。' : '森林地景暫時無法載入，已保留原本的章節。';
  function fail(error) {
    if(disposed)return;
    ready=false;state.ready=false;state.stage='failed';state.errors.push(String(error?.message||error));
    if(studioOn){clearInterval(gateTimer);wanted=NaN;}
    else releaseGate();
    restoreLiftFade();if(pass)pass.enabled=false;
    html.removeAttribute('data-flow2-topdown');html.removeAttribute('data-flow2-forest');
    layer?.classList.remove('is-on');
    if(!studioOn||holdSince) message(failureMessage());
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
          if(ready||(!studioOn&&(tune.view<.5||state.stage==='failed')))releaseGate();
          else {
            const cut=window.__FLOW2_LIFT_CUT__?.tune;
            const limit=(cut?.from??7.6)-(cut?.reach??.06)-.02+shift();
            if(v>limit){
              if(key==='target'&&state.stage!=='failed')wanted=v;
              holdSince ||= performance.now();v=limit;
              message(state.stage==='failed'?failureMessage():'正在準備森林地景…');
            }
          }
        }
        set(v);
      }});
    }
    gateTimer=setInterval(()=>{if(ready||(!studioOn&&state.stage==='failed'))releaseGate();else if(holdSince&&performance.now()-holdSince>25000)fail(new Error('Forest loading timed out'));},100);
  }
  function buildUI() {
    layer=document.createElement('div');layer.className='f2td-layer';layer.setAttribute('role','group');layer.setAttribute('aria-label','森林中的四大投資領域');
    if(!studioOn)fields.forEach(([n,zh,en],k)=>{
      const button=document.createElement('button');button.type='button';button.className='f2td-point';button.dataset.k=k;button.dataset.side=k===0||k===3?'right':'left';
      button.setAttribute('aria-label',`${n} ${zh} ${en}`);button.tabIndex=-1;
      button.innerHTML=`<span class="f2td-target" aria-hidden="true"><i></i></span><span class="f2td-pole" aria-hidden="true"></span><span class="f2td-tag"><b>${n}</b><span class="f2td-zh">${zh}</span><span class="f2td-en">${en}</span></span>`;
      button.addEventListener('click',()=>go(k));layer.append(button);nodes.push(button);
    });
    resetButton=document.createElement('button');resetButton.className='f2fa-home';resetButton.type='button';if(studioOn)resetButton.hidden=true;/* rise page (client 11-20): the cursor sways the valley, no dragging, so no reset button */resetButton.addEventListener('click',()=>{atlas?.reset();studioView?.setPointer();});layer.append(resetButton);
    /* the ring round the lake: one hairline, a finer dotted one inside it, a tick toward each river (drawn first: under the labels) */
    ring=document.createElementNS('http://www.w3.org/2000/svg','svg');ring.setAttribute('class','f2fa-ring');ring.setAttribute('viewBox','-100 -100 200 200');ring.setAttribute('aria-hidden','true');
    ring.innerHTML='<circle class="f2fa-ring-a" r="96"/><circle class="f2fa-ring-b" r="93.4"/>'+fields.map((f,k)=>`<g class="f2fa-ring-t" data-k="${k}"><line x1="96" y1="0" x2="98.6" y2="0"/></g>`).join('');
    layer.prepend(ring);
    (document.querySelector('.finnovation-ui')||document.body).append(layer);
    status=document.createElement('div');status.className='f2fa-status';status.setAttribute('role','status');status.hidden=true;document.body.append(status);
    if(Q.get('atlasqa')==='1'){const debug=document.createElement('output');debug.id='forest-atlas-debug';debug.hidden=true;document.body.append(debug);}
    window.addEventListener('pointerdown',event=>{
      // Vertical touch remains the site's chapter navigation; it must not also pan the atlas.
      if(studioOn||!active||weight<.99||(studioOn&&ov())||study.world?.open||study.portfolio?.open||event.pointerType==='touch'||event.button!==0||event.target.closest('button,a,input,textarea,[role="dialog"],.is-menu-open'))return;
      studioView?.setPointer();
      drag={id:event.pointerId,x:event.clientX,y:event.clientY};html.dataset.flow2ForestDrag='on';
    },{signal:inputAbort.signal});
    window.addEventListener('pointermove',event=>{
      if(drag?.id===event.pointerId){atlas?.pan(event.clientX-drag.x,event.clientY-drag.y);drag.x=event.clientX;drag.y=event.clientY;return;}
      if(!studioView||event.pointerType!=='mouse'||!labelsVisible()||ov())return;
      if(event.target.closest?.('.map-callout'))return;
      if(event.target.closest?.('[data-flow2-panel],button,a,input,textarea,[role="dialog"]')){studioView.setPointer();return;}
      studioView.setPointer(2*clamp(event.clientX/innerWidth)-1,2*clamp(event.clientY/innerHeight)-1);
    },{passive:true,signal:inputAbort.signal});
    if(studioOn)html.addEventListener('pointerleave',()=>studioView?.setPointer(),{signal:inputAbort.signal});
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
  /* TX TYPE (team PN, 2026-11-17; lead: Team TX's centred text column — kicker, a huge thin title, two English lines, the Chinese line, the button —
     sits low on the screen, html[data-tx-type="caustics"], ?type=old = the old type and these rules off). The tags must not touch it:
     · phones: the two lower names (fixed places .75 / .80 of the height, made for the old layout) stand above the column's top (TX's
       window.__FLOW2_TX__.boxes() → { title, lede }, CSS px) with a margin, never below .58 of the height (also the fallback without boxes);
     · desktop: a tag whose box (point + label) meets the title's or the lede's box (plus a margin) takes the other side of its point if that is
       clear, else the smallest move that clears both (the point stays inside the tags' usual frame). The boxes are read at most every 300 ms. */
  let txCache={at:-1e9,key:'',val:null};
  function txPlace(){
    if(html.dataset.txType!=='caustics')return null;
    const now=performance.now(),key=innerWidth+'x'+innerHeight+'|'+(document.querySelector('.finnovation-ui')?.dataset.chapter||'');
    if(key===txCache.key&&now-txCache.at<300)return txCache.val;
    let b=null;try{b=window.__FLOW2_TX__?.boxes?.()||null;}catch(error){b=null;}
    const rects=[b?.title,b?.lede].filter(r=>r&&r.right>r.left&&r.bottom>r.top).map(r=>({left:r.left-14,top:r.top-14,right:r.right+14,bottom:r.bottom+14}));
    const top=rects.length?Math.min(...rects.map(r=>r.top)):Infinity;
    const upper=innerHeight*.22+34;   /* below the two upper names */
    const low=Math.max(upper+30,Math.min(innerHeight*.58,top-18)), gap=Math.max(28,Math.min(44,low-upper));
    txCache={at:now,key,val:{rects,low,gap}};
    return txCache.val;
  }
  function txAvoid(node,x,y){
    const tx=txPlace(),R=tx.rects;
    if(!node.__tagW){const t=node.querySelector('.f2td-tag');const r=t?.getBoundingClientRect();if(r&&r.width){node.__tagW=r.width;node.__tagH=r.height;}else return [x,y];}
    const w=node.__tagW,h=node.__tagH,base=node.dataset.side;
    const box=(px,py,side)=>{const t=side==='right'?[px+41,px+41+w]:[px-41-w,px-41];return {left:Math.min(px-16,t[0]),right:Math.max(px+16,t[1]),top:Math.min(py-16,py-h/2),bottom:Math.max(py+16,py+h/2)};};
    const hits=(b,m=0)=>R.some(r=>b.left<r.right+m&&b.right>r.left-m&&b.top<r.bottom+m&&b.bottom>r.top-m);
    const inFrame=(px,py,side)=>{const b=box(px,py,side);return px>=52&&px<=innerWidth-52&&py>=145&&py<=innerHeight*.87&&b.left>=8&&b.right<=innerWidth-8;};
    const other=base==='right'?'left':'right', flipped=node.dataset.txFlip==='1';
    /* the usual side when it is clear (with some room, so it does not flicker back and forth); else the side it has; else the other side */
    if(!hits(box(x,y,base),10)){if(flipped)delete node.dataset.txFlip;return [x,y];}
    if(flipped&&!hits(box(x,y,other))&&inFrame(x,y,other)){node.dataset.side=other;return [x,y];}
    if(!hits(box(x,y,base))){if(flipped)delete node.dataset.txFlip;return [x,y];}
    if(!hits(box(x,y,other))&&inFrame(x,y,other)){node.dataset.side=other;node.dataset.txFlip='1';return [x,y];}
    if(flipped)delete node.dataset.txFlip;
    /* the smallest straight move of the point that clears both boxes */
    const b0=box(x,y,base);let best=null,bd=Infinity;
    for(const r of R)for(const [dx,dy] of [[r.left-b0.right-2,0],[r.right-b0.left+2,0],[0,r.top-b0.bottom-2],[0,r.bottom-b0.top+2]]){
      const d=Math.abs(dx)+Math.abs(dy);if(d>=bd)continue;
      const nx=x+dx,ny=y+dy;if(!inFrame(nx,ny,base)||hits(box(nx,ny,base)))continue;
      best=[nx,ny];bd=d;
    }
    return best||[x,y];
  }
  function labelsVisible(){
    return active&&weight>.97&&tune.points>=.5&&!cutPlaying()&&!fading&&!study.world?.open&&!study.portfolio?.open;
  }
  let studioObstacles={at:-Infinity,rects:[]};
  function getStudioObstacles(){
    const now=performance.now();
    if(now-studioObstacles.at<120)return studioObstacles.rects;
    const rects=[...(txPlace()?.rects||[])];
    for(const element of document.querySelectorAll('.fi-rail, .f2u-side, .f2p-box:not([hidden])')){
      const r=element.getBoundingClientRect();
      if(r.width&&r.height) rects.push({left:r.left-8,right:r.right+8,top:r.top-8,bottom:r.bottom+8});
    }
    studioObstacles={at:now,rects};
    return rects;
  }
  function projectPoints() {
    const compact=innerWidth<600||coarsePointer.matches;
    const resetLabel=compact?'FOREST OVERVIEW':'DRAG TO EXPLORE · RESET VIEW';
    if(resetButton.textContent!==resetLabel){resetButton.textContent=resetLabel;resetButton.setAttribute('aria-label',compact?'回到森林全景':'拖曳探索森林，點擊回到全景');}
    const studioLabels=!studioView||(studioView.cartography.config.labels&&studioView.state.arrival>.6);
    const visible=studioLabels&&labelsVisible();
    /* PERF STRIKE: while the labels stay off (the whole canyon), their state is already applied: no DOM reads or writes per frame */
    if(PERF_RISE){if(!visible&&labelsWere===false&&lastCurrent===-1)return;if(visible!==labelsWere){labelsWere=visible;layer.classList.toggle('is-on',visible);layer.inert=!visible;}}
    else{layer.classList.toggle('is-on',visible);layer.inert=!visible;}
    const cur=document.querySelector('.finnovation-ui')?.dataset.chapter==='strategies'?study.strategyReveal?.state.count-1:-1;
    const current=visible&&cur>=0&&cur<4?cur:-1;
    if(current!==lastCurrent){lastCurrent=current;layer.classList.toggle('has-current',current>=0);try{atlas.setActive?.(current);}catch(error){}
      studioView?.cartography.setSelected?.(current);
      ring?.querySelectorAll('.f2fa-ring-t').forEach((g,k)=>g.classList.toggle('is-current',k===current));}
    placeRing(visible);
    if(studioOn)return;
    /* THE PAN (team PN, 2026-11-17; flow2-aerial-pan.js, ?pan=0 = as before): while the lens travels each label sits on its river — at its own
       point when that is on the screen, else at the farthest point of the same river (walking toward the lake) that is — and fades out while no
       part of that river between its point and the lake is on the screen, instead of being pushed along the screen's edge; a margin keeps it from
       flickering at the edge. At FOUR PATHS (the pan settled on the lake) a river with nothing on the screen docks at the edge toward it, as the
       PRE-IPO tag always was. Desktop only: the phones keep their fixed places. */
    const PAN=window.__FLOW2_AERIAL_PAN__, panLabels=!!(PAN&&PAN.ready&&+PAN.tune.labels>=.5&&innerWidth>=600);
    const inBox=(px,py,g)=>px>=52-g&&px<=innerWidth-52+g&&py>=145-g&&py<=innerHeight*.87+g;
    const tx=visible?txPlace():null;   /* TX TYPE: the text column's boxes (null with the old type) */
    let four=null;
    nodes.forEach((node,k)=>{
      let x=0,y=0,inView=true;
      if(visible){
        projected.copy(atlas.anchors[k]).project(atlas.camera);
        x=(projected.x*.5+.5)*innerWidth;y=(.5-projected.y*.5)*innerHeight;
        if(panLabels){
          const g=node.dataset.panOff==='1'?-24:24;   /* to come back it must be well inside; to leave, a little outside */
          /* BEAM (overnight 2026-11-18): with the river beams each label rides its beam — at the beam's head while the light has not yet reached the
             label's own place on the river, then at that place; a label whose lit stretch is off the screen fades out (?td=old: as before) */
          const BM=window.__FLOW2_RIVER_BEAMS__, lp=BM&&BM.labelPoint&&+BM.state.grow<.97?BM.labelPoint(k):null;
          if(BM&&BM.labelPoint&&+BM.state.grow<.97){
            if(lp){projected.set(lp[0],.105,lp[1]).project(atlas.camera);x=(projected.x*.5+.5)*innerWidth;y=(.5-projected.y*.5)*innerHeight;inView=projected.z<1&&inBox(x,y,g);}else inView=false;
            node.dataset.panOff=inView?'0':'1';
          } else {
          inView=projected.z<1&&inBox(x,y,g);
          const R=atlas.rivers&&atlas.rivers[k];
          if(!inView&&R&&R.points&&R.points.length){
            if(R.__panAt===undefined){let bi=0,bd=Infinity;R.points.forEach((p,i)=>{const d=p.distanceToSquared(atlas.anchors[k]);if(d<bd){bd=d;bi=i;}});R.__panAt=bi;}
            for(let i=R.__panAt;i>=0;i--){projected.copy(R.points[i]).project(atlas.camera);const px=(projected.x*.5+.5)*innerWidth,py=(.5-projected.y*.5)*innerHeight;if(projected.z<1&&inBox(px,py,g)){x=px;y=py;inView=true;break;}}
          }
          if(!inView&&PAN.progress>.97&&(four??=document.querySelector('.finnovation-ui')?.dataset.chapter==='strategies')){inView=true;projected.copy(atlas.anchors[k]).project(atlas.camera);x=(projected.x*.5+.5)*innerWidth;y=(.5-projected.y*.5)*innerHeight;}
          node.dataset.panOff=inView?'0':'1';
          }   /* end BEAM */
        } else if(node.dataset.panOff)delete node.dataset.panOff;
      }
      const on=visible&&inView;
      node.classList.toggle('is-in',on);node.tabIndex=on?0:-1;
      const chosen=k===cur;node.classList.toggle('is-current',chosen);
      if(chosen)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');
      if(!visible)return;
      node.dataset.side=innerWidth>=760?(k===1?'left':'right'):(k===0||k===3?'right':'left');
      if(innerWidth<600){x=innerWidth*(k===0||k===3 ? .08 : .92);y=innerHeight*[.17,.22,.80,.75][k];   /* phones (2026-11-16): two names above the title block, two below the button, none over the title */
        if(tx&&(k===2||k===3))y=k===3?tx.low:tx.low-tx.gap;}   /* TX type (2026-11-17): the two lower names stand above the text column (see txPlace) */
      else {x=Math.max(52,Math.min(innerWidth-52,x));y=Math.max(145,Math.min(innerHeight*.87,y));
        if(tx&&tx.rects.length){const p=txAvoid(node,x,y);x=p[0];y=p[1];}}
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
  /* PERF STRIKE item 1 (2026-11-21, SHADE; rise page only, ?perf=0 or tune.scissor = 0 = as before): while the stroke crosses, the composite below
     reads the land only behind the stroke's front (m > 0) or behind the survey front (survey > 0); everywhere else the land's picture is multiplied
     by 0. So the land is drawn only inside the box that holds those pixels: the same bytes on the screen, less of the land's shader. The box is
     worked out from the same numbers the composite gets (uBrush, uBrushLook), with the largest value its edge noise can take, plus a margin.
     ?perfCheck=scissor draws the frame both ways (the outside filled with magenta) and counts differing pixels into state.scissorCheck. */
  function landBox(w,h){
    boxNow=null;
    if(PERF_RISE&&tune.scissor>=.5&&pass){const o=ov();
      if(o&&!o.reduce&&+o.brush<1){
        const L=o.look||pass.uniforms.uBrushLook.value.toArray(),y=Math.min(1,Math.max(0,+o.brush||0));
        const a=+L[0],band=.26*Math.abs(+L[1]),z=Math.abs(+L[2]),asp=w/h,dx=Math.cos(a),dy=Math.sin(a);
        const ext=.5*(Math.abs(dx)*asp+Math.abs(dy)),start=-ext-band*.45-.3,end=ext+band*1.05+.4,edge=.15*z;
        let S=start+(end-start)*Math.min(1,Math.max(0,(y-.19)/.81))+edge+band*.4;
        if(y>.02)S=Math.max(S,start+(end-start)*Math.pow(Math.min(1,y/.59),.78)+edge+band*.22);
        S+=.016*Math.abs(+L[3]||0)+.03;
        let u0=0,u1=1,v0=0,v1=1;
        if(dx>1e-4)u1=Math.min(1,.5+(S+.5*Math.abs(dy))/(dx*asp));else if(dx<-1e-4)u0=Math.max(0,.5+(S+.5*Math.abs(dy))/(dx*asp));
        if(dy>1e-4)v1=Math.min(1,.5+(S+.5*Math.abs(dx)*asp)/dy);else if(dy<-1e-4)v0=Math.max(0,.5+(S+.5*Math.abs(dx)*asp)/dy);
        if(Number.isFinite(u0+u1+v0+v1)&&(u0>0||u1<1||v0>0||v1<1)){
          const x0=Math.max(0,Math.floor(u0*w)-2),x1=Math.min(Math.ceil(w),Math.ceil(u1*w)+2),y0=Math.max(0,Math.floor(v0*h)-2),y1=Math.min(Math.ceil(h),Math.ceil(v1*h)+2);
          boxNow=[x0,y0,Math.max(0,x1-x0),Math.max(0,y1-y0)];
        }
      }
    }
    setLandBox(boxNow);
    if(PERF_RISE){const k=boxNow?boxNow[2]*boxNow[3]/Math.max(1,w*h):1;state.scissor=boxNow?{frames:(state.scissor?.frames||0)+1,share:+k.toFixed(3),shareSum:+((state.scissor?.shareSum||0)+k).toFixed(3)}:state.scissor;}
  }
  function setLandBox(b){
    if(b){atlasTarget.scissor.set(b[0],b[1],b[2],b[3]);atlasTarget.scissorTest=true;}
    else if(atlasTarget.scissorTest){atlasTarget.scissorTest=false;atlasTarget.scissor.set(0,0,atlasTarget.width,atlasTarget.height);}
  }
  /* ?perfCheck=scissor only */
  let chk=null;
  function checkLandBox(r,read,dt,mask,draw){
    const w=read.width,h=read.height,box=boxNow;
    if(!chk){const o={depthBuffer:false,type:THREE.HalfFloatType};chk={a:new THREE.WebGLRenderTarget(4,4,o),b:new THREE.WebGLRenderTarget(4,4,o),d:new THREE.WebGLRenderTarget(4,4,{depthBuffer:false}),col:new THREE.Color(),
      pass:new ShaderPass({uniforms:{tDiffuse:{value:null},tB:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform sampler2D tDiffuse,tB;void main(){vec3 d=abs(texture2D(tDiffuse,vUv).rgb-texture2D(tB,vUv).rgb);gl_FragColor=vec4(vec3(step(1e-6,max(d.r,max(d.g,d.b)))),1.);}'}),buf:null};chk.pass.material.toneMapped=false;state.scissorCheck={frames:0,bad:0,maxPixels:0,minShare:1};}
    for(const t of [chk.a,chk.b,chk.d])if(t.width!==w||t.height!==h)t.setSize(w,h);
    const target=r.getRenderTarget(),tone=r.toneMapping,shadow=r.shadowMap.autoUpdate,screen=pass.renderToScreen;
    const land=(b,poison)=>{r.toneMapping=THREE.NoToneMapping;r.shadowMap.autoUpdate=false;
      if(poison){setLandBox(null);r.setRenderTarget(atlasTarget);r.getClearColor(chk.col);const al=r.getClearAlpha();r.setClearColor(0xff00ff,1);r.clear();r.setClearColor(chk.col,al);}
      setLandBox(b);r.setRenderTarget(atlasTarget);r.clear();r.render(atlas.scene,atlas.camera);studioView?.draw?.(r,atlasTarget);r.toneMapping=tone;r.shadowMap.autoUpdate=shadow;r.setRenderTarget(target);};
    try{pass.renderToScreen=false;
      land(box,true);draw(r,chk.a,read,dt,mask);
      land(null,false);draw(r,chk.b,read,dt,mask);
      chk.pass.uniforms.tB.value=chk.b.texture;chk.pass.renderToScreen=false;chk.pass.render(r,chk.d,chk.a,dt,mask);
      const W=Math.floor(chk.d.width),H=Math.floor(chk.d.height);if(!chk.buf||chk.buf.length!==W*H*4)chk.buf=new Uint8Array(W*H*4);
      r.readRenderTargetPixels(chk.d,0,0,W,H,chk.buf);let n=0;for(let i=0;i<chk.buf.length;i+=4)if(chk.buf[i])n++;
      const C=state.scissorCheck;C.frames++;if(n){C.bad++;C.maxPixels=Math.max(C.maxPixels,n);}C.minShare=Math.min(C.minShare,box[2]*box[3]/Math.max(1,w*h));C.last=n;
    }finally{pass.renderToScreen=screen;r.toneMapping=tone;r.shadowMap.autoUpdate=shadow;r.setRenderTarget(target);}
  }
  function seat() {
    const passes=composer.passes, index=passes.indexOf(pass);
    if(index>=0)passes.splice(index,1);
    const cut=passes.findIndex(p=>p.uniforms?.tHeld&&p.uniforms?.uCell);
    if(cut>=0)passes.splice(cut,0,pass);else passes.push(pass);
  }
  function sync() {
    if(disposed)return;
    const current=performance.now(),dt=Math.min(studioOn ? .1 : .05,Math.max(0,(current-lastFrame)/1000));lastFrame=current;
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
    if (!studioOn) { const M=window.__FLOW2_MOTION__;
      if(active&&!previousActive&&!o&&!reducedMotion){ if(M&&M.recent()&&atlas?.growth>.02)atlas?.autoGrowth?.(); else atlas?.arrive?.(); }
      if(!active&&previousActive&&!o&&M&&M.on){ M.left(); atlas?.setGrowth?.(atlas.growth); } }
    if(previousActive!==active) {
      if(!active&&c<from) studioView?.leave();
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
    if(atlas&&active){if(width!==innerWidth||height!==innerHeight){width=innerWidth;height=innerHeight;atlas.resize(width,height);}
      if(studioView) studioView.update(dt,o,tune); else atlas.update(c,dt,tune);
      if(air){const q=window.__FLOW2_QUALITY__;air.setTier(q&&Number.isFinite(+q.rank)?+q.rank:2);air.update(dt,tune);}}
    if(studioView&&!active)studioView.cartography.apply();
    if(atlas)projectPoints();
    const debug=document.getElementById('forest-atlas-debug');
    if(debug&&state.frames%30===0)debug.textContent=JSON.stringify({...state,weight,sea,cut:window.__FLOW2_LIFT_CUT__?.state.phase,count:study.strategyReveal?.state.count,metrics:atlas?.metrics});
  }
  function installPass() {
    heldDirect=html.hasAttribute('data-flow2-opt')&&Q.get('aerialopt')!=='0';tune.heldDirect=1;   /* PERF ROUND (Team A): see pass.render */
    if(heldDirect){blackTex=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);blackTex.needsUpdate=true;}
    atlasTarget=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,depthBuffer:true});
    heldTarget=new THREE.WebGLRenderTarget(4,4,heldDirect?{depthBuffer:false,type:THREE.HalfFloatType}:{depthBuffer:false});   /* PERF ROUND: half float like the composer's own buffers, so the screen gets exactly the bytes it got before */
    pass=new ShaderPass({uniforms:{tDiffuse:{value:null},tForest:{value:null},tHeld:{value:null},uWeight:{value:0},uFade:{value:1},
        uBrush:{value:new THREE.Vector4(0,1,1,0)},uBrushLook:{value:new THREE.Vector4(.28,1,1,1)},uRes:{value:new THREE.Vector2(1,1)},
        uGradeA:{value:new THREE.Vector4(0,1,0,0)},uGradeB:{value:new THREE.Vector4(0,0,0,0)},uGradeC:{value:new THREE.Vector4(1,1,1,1)},uGradeD:{value:new THREE.Vector4(1,0,0,0)},uTilt:{value:new THREE.Vector4(0,.42,1,0)},uSurvey:{value:new THREE.Vector2(0,0)}},   /* BEAM: the tilt-shift (px at the edges, band start, band end) */
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`varying vec2 vUv;uniform sampler2D tDiffuse,tForest,tHeld;uniform float uWeight,uFade;uniform vec4 uBrush,uBrushLook;uniform vec2 uRes;uniform vec4 uTilt;uniform vec2 uSurvey;uniform vec4 uGradeA,uGradeB,uGradeC,uGradeD;
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
        /* BEAM (overnight 2026-11-18): everswap's soft top and bottom — the view from above blurred toward the screen's upper and lower edges, sharp
           in the middle band (8 taps on a golden-angle ring, only where the band says so; uTilt.x = 0 = off: one read as before) */
        vec3 fForest(vec2 uv){
          vec3 c=texture2D(tForest,uv).rgb;
          if(uTilt.x<=0.)return c;
          float k=smoothstep(uTilt.y,uTilt.z,abs(uv.y-.5)*2.);
          if(k<.02)return c;
          vec2 r=uTilt.x*k/uRes;vec3 a=c*.2;
          for(int i=0;i<8;i++){float an=float(i)*2.39996+.6;float rr=sqrt((float(i)+.5)/8.);a+=textureLod(tForest,uv+vec2(cos(an),sin(an))*rr*r,0.).rgb*.1;}
          return a;
        }
        float bH(float x){return fract(sin(x*127.1+.7)*43758.5453);}
        float bN(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(bH(i),bH(i+1.),f);}
        float bF(float x){return bN(x)*.55+bN(x*2.13+7.)*.3+bN(x*4.71+3.)*.15;}
        float bN2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);float a=bH(i.x+i.y*57.),b=bH(i.x+1.+i.y*57.),c=bH(i.x+(i.y+1.)*57.),d=bH(i.x+1.+(i.y+1.)*57.);return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}
        void main(){
          /* the brush: one wide stroke along uBrushLook.x; 1 behind its front (the view from above), 0 ahead (the valley) */
          float m=1.;vec2 offF=vec2(0.),offB=vec2(0.);
          #ifdef STUDIO_PBR_VIEW
          float survey=0.;
          #endif
          if(uBrush.x>.5&&uBrush.y<1.){
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
              float start=-ext-band*.45-.3, end=ext+band*1.05+.4;
              float edgeShape=-.15*qn*qn+((bF(q*18.)-.5)*.06+(bF(q*5.+3.)-.5)*.12)*uBrushLook.z+pow(bF(q*60.+11.),5.)*.06*uBrushLook.z;
              float fillProgress=uBrush.y;
              #ifdef STUDIO_PBR_VIEW
              fillProgress=clamp((uBrush.y-.19)/.81,0.,1.);
              float surveyProgress=pow(clamp(uBrush.y/.59,0.,1.),.78);
              float surveyHead=mix(start,end,surveyProgress)+edgeShape;
              survey=1.-smoothstep(surveyHead-band*.18,surveyHead+band*.22,s);
              survey*=smoothstep(.025,.12,uBrush.y);
              #endif
              float e=mix(start,end,fillProgress)+edgeShape;  /* at 1 the aerial view covers every corner */
              #ifdef STUDIO_PBR_VIEW
              /* 2026-11-21 (client: 「線條在山道時候不要出現，應該是轉場才出現」): the survey lines ran ahead of the land over the whole canyon
                 (the exit showed a full canyon covered in lines for ~0.5 s). They now live only in a band just ahead of the land's edge,
                 uSurvey.x stroke bands wide (tune.surveyReach, ?surveyReach=; 0 = as before). */
              if(uSurvey.x>0.)survey*=1.-smoothstep(band*.2,band*(.2+uSurvey.x),s-e);
              #endif
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
          #ifdef STUDIO_PBR_VIEW
          vec4 terrain=texture2D(tForest,vUv+offF);
          vec3 forest=sRGBTransferOETF(vec4(terrain.rgb,1.)).rgb;
          float ink=clamp(1.-terrain.a,0.,1.)*survey*uWeight;
          vec3 surveyLight=max(base,vec3(.68,.86,.91));
          base=mix(base,surveyLight,ink*.96);
          #else
          vec3 forest=sRGBTransferOETF(vec4(fForest(vUv+offF),1.)).rgb;
          forest=mix(forest,fGrade(forest),uGradeA.w);
          float shade=smoothstep(.44,1.,1.-vUv.y)*.40*uGradeB.w;
          forest*=1.-shade*uWeight;
          #endif
          vec3 live=mix(base,forest,uWeight*m);gl_FragColor=vec4(mix(texture2D(tHeld,vUv).rgb,live,uFade),1.);}`});
    pass.uniforms.tForest.value=atlasTarget.texture;
    if(studioOn) pass.material.defines.STUDIO_PBR_VIEW=1;
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
        try{r.toneMapping=THREE.NoToneMapping;r.shadowMap.autoUpdate=false;landBox(w,h);r.setRenderTarget(atlasTarget);r.clear();r.render(atlas.scene,atlas.camera);studioView?.draw?.(r,atlasTarget);try{if(!studioOn)window.__FLOW2_LAKE_MARK__?.draw?.(r,atlasTarget,atlas,THREE);}catch(error){}try{window.__FLOW2_AFTER__?.lens?.(r,atlasTarget,pass,atlas,THREE);}catch(error){}}
        finally{r.toneMapping=tone;r.shadowMap.autoUpdate=shadow;r.setRenderTarget(target);}
      }
      pass.uniforms.uWeight.value=weight;
      if(!studioOn){const G=gradeTune,U=pass.uniforms;U.uGradeA.value.set(G.hue*Math.PI/180,G.sat,G.temp,Math.min(1,Math.max(0,+G.on||0)));U.uGradeB.value.set(G.yellow,G.lift,G.bright,G.shade);const c=new THREE.Color(G.liftColor);U.uGradeC.value.set(c.r,c.g,c.b,1);U.uGradeD.value.set(Number.isFinite(+G.contrast)?+G.contrast:1,0,0,0);}
      if(!studioOn){const BM=window.__FLOW2_RIVER_BEAMS__,BT=BM?.tune,q=window.__FLOW2_QUALITY__;pass.uniforms.uTilt.value.set(BT&&+BT.on>=.5&&!(q&&+q.rank===0)?Math.max(0,+(BM.state.tilt??BT.tilt)||0)*w/Math.max(1,innerWidth):0,Number.isFinite(+BT?.tiltFrom)?+BT.tiltFrom:.42,1,0);}   /* BEAM: the tilt-shift (河流光束 panel; none on the low tier, none with ?td=old) */
      {const o=ov(),U=pass.uniforms;U.uRes.value.set(w,h);U.uBrush.value.set(o?1:0,o?Math.min(1,Math.max(0,+o.brush||0)):1,o?o.dir:1,o?.reduce?1:0);if(o?.look)U.uBrushLook.value.fromArray(o.look);U.uSurvey.value.set(Math.max(0,+tune.surveyReach||0),0);}
      pass.uniforms.uFade.value=fading?smooth(0,550,performance.now()-fadeAt):1;
      if(PERF_CHECK&&boxNow&&active&&!afterCovered)checkLandBox(r,read,dt,mask,draw);   /* PERF STRIKE: ?perfCheck=scissor */
      const screen=this.renderToScreen;
      /* PERF ROUND (Team A, 2026-11-17; html[data-flow2-opt], not ?aerialopt=0; live switch tune.heldDirect = 0): when this pass is the last on the
         screen and no fade runs, the composite is drawn straight into the kept picture (heldTarget) and that is copied to the screen — one
         full-screen copy less per frame than drawing it, copying it to the kept picture and copying it again to the screen. Its tHeld input is
         a black texel then (uFade is 1: the kept picture does not enter the result; and a target cannot be read while drawn into). */
      if(heldDirect&&screen&&!fading&&tune.heldDirect>=.5){
        pass.uniforms.tHeld.value=blackTex;
        this.renderToScreen=false;try{draw(r,heldTarget,read,dt,mask);}finally{this.renderToScreen=screen;pass.uniforms.tHeld.value=heldTarget.texture;}
        captured=true;copyPass.renderToScreen=true;copyPass.render(r,write,heldTarget,dt,mask);
        state.frames++;return;
      }
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
      sync();const scene=this.scene,o=ov();
      // Keep the buffer bookkeeping while the aerial view completely covers the canyon.
      if(active&&weight>.999&&(!o||+o.brush>=1))this.scene=emptyScene;
      try{return render.apply(this,args);}finally{this.scene=scene;}
    };
    const update=canyon.update;
    canyon.update=function(...args){const result=update.apply(this,args);seat();return result;};
  }
  async function start() {
    if(disposed||started||!THREE||!renderer||!composer||!ShaderPass||!canyon)return;
    study=window.__MONTIS_STUDY__;if(!study)return;
    started=true;state.stage='loading';buildUI();installGate();installPass();
    /* PERF ROUND (Team A, 2026-11-17; only with html[data-flow2-opt], not ?aerialopt=0; Team T's boot finding): the view's pictures and models
       (≈ 11–13 MB, the 8K bake, uploads) were fetched and decoded during the canyon's own start (5.8–7.4 s, long tasks of 108–256 ms). Now they
       start once the canyon is live (the start still gone, the page ready) and the page has had a moment (≈ 0.3 s + an idle slot) — or at once
       when the visitor heads for the cut (journey clock past the cut − 1.9) or jumps there. The gate above still holds the journey before the
       cut if the view is not ready yet. MEASURED (A.md): a visitor who scrolls at once then waits 0.2–0.3 s at the cut and sees longer frames
       while scrolling (213–266 ms instead of 133–147 ms), because the load now falls into the live canyon; under the start still ≈ 0.4 s of long
       tasks go away. Not safe for the lift by that measure, so OFF by default: ?aerialdefer=1 turns it on (the lead decides). */
    if(html.hasAttribute('data-flow2-opt')&&Q.get('aerialopt')!=='0'&&Q.get('aerialdefer')==='1'){
      state.stage='waiting for the live canyon';
      await new Promise(go=>{
        let liveAt=0,done=false;const t0=performance.now();
        const finish=why=>{if(done)return;done=true;clearInterval(timer);state.deferred={why,ms:Math.round(performance.now()-t0)};go();};
        const heading=()=>{const J=study.journey,cut=window.__FLOW2_LIFT_CUT__?.tune,from=Number.isFinite(+cut?.from)?+cut.from:6.6;
          return Math.max(study.journeyClock(+J.target||0),study.journeyClock(+J.progress||0))>from-1.9;};
        const timer=setInterval(()=>{
          if(disposed)return finish('disposed');
          if(heading())return finish('visitor heading for the cut');
          const live=html.dataset.flow2Still!=='on'&&document.body.classList.contains('is-ready');
          if(!live){liveAt=0;return;}
          if(!liveAt)liveAt=performance.now();
          if(performance.now()-liveAt>300){clearInterval(timer);if(window.requestIdleCallback)requestIdleCallback(()=>finish('canyon live'),{timeout:900});else finish('canyon live');}
          if(performance.now()-t0>30000)finish('timeout');
        },100);
      });
      if(disposed)return;
      state.stage='loading';
    }
    const begin=performance.now();
    try {
      const module=await sceneModule;atlas=await module.createForestScene(renderer,reducedMotion,{studioPbr:studioOn});
      if(disposed||state.stage==='failed'){atlas.dispose();return;}
      if(!studioOn) api.scene=atlas;
      if(studioModule){
        const studio=await studioModule;
        if(studio.error) throw studio.error;
        studioView=await studio.createStudioPbrView(renderer,atlas,{reducedMotion,query:Q,labels:{
          parent:layer.parentNode, onSelect:go, isVisible:()=>labelsVisible()&&!ov(), getObstacles:getStudioObstacles
        }});
        if(disposed||state.stage==='failed'){studioView.dispose();atlas.dispose();return;}
        api.studio=studioView;
        state.mode='studio-pbr';
      }
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
      if(!studioOn&&Q.get('birds')!=='0')try{const made=await import(new URL('../forest-aerial/flow2-scene-birds.js?v='+V,base).href);
        const birds=made.createForestBirds(renderer,{reducedMotion,atlas,shared:AIR});atlas.scene.add(birds.group);api.birds=birds;atlas.onUpdate?.(f=>birds.update(f.dt));
      }catch(error){state.errors.push('birds: '+String(error?.message||error));console.warn('Flow forest birds: left out',error);}
      /* flow2 water W1 (2026-11-16): the water of this view as a SURFACE (../forest-aerial/flow2-scene-water.js: a mesh over the lake and the four rivers,
         waves carried down the rivers into the lake, the canyon river's shading; panel 「俯視水面」 key N; ?wsurf=0 = the scene's own water). Updated by the
         scene's frame hook, compiled with the scene just below. Never stops the view. */
      if(!studioOn&&Q.get('wsurf')!=='0')try{const made=await import(new URL('../forest-aerial/flow2-scene-water.js?v='+V,base).href);
        const water=await made.createForestWater(renderer,{reducedMotion,atlas,shared:AIR});if(water){atlas.scene.add(water.group);api.water=water;atlas.onUpdate?.(f=>water.update(f));}
      }catch(error){state.errors.push('water: '+String(error?.message||error));console.warn('Flow forest water surface: left out',error);}
      /* end flow2 water W1 */
      /* flow2 water W2 (2026-11-16): the FLOW of this view made visible (../forest-aerial/flow2-scene-flow.js: ribbons along the baked streamlines
         original/w2-streamlines.json — the four luminous currents that continue the canyon's four beams, streaks and foam carried down the rivers into
         the lake and round to its centre, eddies at the mouths; panel 「俯視水流」 key U; ?wflow=0 = none). Updated by the scene's frame hook (which
         also tells it the active field), compiled with the scene just below. Never stops the view. */
      if(!studioOn&&Q.get('wflow')!=='0')try{const made=await import(new URL('../forest-aerial/flow2-scene-flow.js?v='+V,base).href);
        const flow=await made.createForestFlow(renderer,{reducedMotion,atlas});if(flow){atlas.scene.add(flow.group);api.flow=flow;atlas.onUpdate?.(f=>flow.update(f));}
      }catch(error){state.errors.push('flow: '+String(error?.message||error));console.warn('Flow forest water flow: left out',error);}
      /* end flow2 water W2 */
      /* BEAM (overnight 2026-11-18, client: everswap-like 「4個主幹道河流光束 配一些支流」): four beams of light on the four rivers and twelve thinner
         ones on the side valleys, growing with the river walk (flow2-aerial-pan.js) — ../forest-aerial/flow2-river-beams.js, panel 「河流光束」 key G.
         After W2 (it rests W2's four fine currents). ?td=old = none (today's view), ?riverbeams=0 = no beams. Compiled with the scene just below. */
      if(!studioOn&&Q.get('td')!=='old'&&Q.get('riverbeams')!=='0')try{const made=await import(new URL('../forest-aerial/flow2-river-beams.js?v='+V,base).href);
        const beams=await made.createRiverBeams(renderer,{reducedMotion,atlas});if(beams){atlas.scene.add(beams.group);api.beams=beams;atlas.onUpdate?.(f=>beams.update(f));}
      }catch(error){state.errors.push('beams: '+String(error?.message||error));console.warn('Flow forest river beams: left out',error);}
      /* end BEAM */
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
      if(state.stage==='failed')return;
      api.scene=atlas;
      state.stage='ready';state.ready=ready=true;state.readyMs=Math.round(performance.now()-begin);releaseGate();
    } catch(error){fail(error);}
  }
  function dispose() {
    if(disposed)return;disposed=true;active=ready=false;state.stage='off';state.ready=false;state.view=0;
    inputAbort.abort();drag=null;releaseGate();clearInterval(gateTimer);clearTimeout(goTimer);restoreLiftFade();
    ['data-flow2-topdown','data-flow2-forest','data-flow2-forest-drag','data-forest-atlas-ready'].forEach(name=>html.removeAttribute(name));
    layer?.remove();status?.remove();if(pass)pass.enabled=false;
    studioView?.dispose();air?.dispose();atlas?.dispose();atlasTarget?.dispose();heldTarget?.dispose();blackTex?.dispose();pass?.dispose();copyPass?.dispose();
  }
  window.addEventListener('finnovation:text-mode',dispose,{once:true});
  window.addEventListener('finnovation:render-stop',dispose,{once:true});
  window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
})();
