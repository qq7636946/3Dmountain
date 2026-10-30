/* One reversible scroll clock for copy, photographs and chapter handoffs.
   Geometry, camera paths, horizontal stop positions and brand copy stay owned
   by their existing modules. No timers or competing animation loops. */
export const clamp01=v=>Math.max(0,Math.min(1,v));
export function motionEase(a,b,v){const t=clamp01((v-a)/Math.max(.00001,b-a));return t*t*(3-2*t);}
export function motionPose(enter,exit,index=0,reduced=false){
 const delay=Math.min(index,6)*.026;
 const a=motionEase(delay,.78+delay,enter),b=motionEase(delay,.80+delay,exit);
 return {alpha:a*(1-b),y:reduced?0:(1-a)*22-b*20};
}
const paintedStyles=new WeakMap();
function style(el,key,value,priority=''){
 if(!el)return;
 let previous=paintedStyles.get(el);if(!previous){previous={};paintedStyles.set(el,previous);}
 if(previous[key]===value&&el.style.getPropertyValue(key)===value)return;
 previous[key]=value;el.style.setProperty(key,value,priority);
}
function apply(el,enter,exit,i,reduced){
 const p=motionPose(enter,exit,i,reduced),key=p.alpha.toFixed(3)+'|'+p.y.toFixed(2);
 if(el.dataset.motionPose===key)return p.alpha;
 el.dataset.motionPose=key;el.classList.add('fi-motion-node');
 el.style.setProperty('--motion-opacity',p.alpha.toFixed(3));
 el.style.setProperty('--motion-y',p.y.toFixed(2)+'px');
 if(el.inert!==(p.alpha<.015))el.inert=p.alpha<.015;
 return p.alpha;
}
const children=el=>el?[...el.children].filter(n=>!n.matches('script,style')):[];

export function createJourneyCopyMotion({root,reducedMotion=false}){
 const panels=[...root.querySelectorAll('.fi-copy-panel')];
 const nodes=panels.map(children);
 panels.forEach(el=>el.classList.add('fi-motion-copy'));
 return {update(state,thresholds,chapters,business){
  const ranges=chapters.map((c,i)=>({id:c.id,from:thresholds[i]}));
  for(const c of business)ranges.push({id:c.id,from:c.from+state.shift-.025});
  ranges.sort((a,b)=>a.from-b.from);
  panels.forEach((el,i)=>{
   const k=ranges.findIndex(c=>c.id===el.dataset.copy);
   if(k<0)return;
   const start=ranges[k].from,end=ranges[k+1]?.from??state.max+.15;
   const enter=k===0?1:clamp01((state.progress-start+.12)/.30);
   const exit=clamp01((state.progress-end+.28)/.34);
   const show=enter>0&&exit<1;
   style(el,'--motion-panel-alpha',motionPose(enter,exit,0,reducedMotion).alpha.toFixed(3));
   style(el,'visibility',show?'visible':'hidden');style(el,'pointer-events',show&&el.classList.contains('is-active')?'auto':'none');
   const inert=!show||!el.classList.contains('is-active');
   if(el.inert!==inert)el.inert=inert;
   if(el.getAttribute('aria-hidden')!==String(inert))el.setAttribute('aria-hidden',String(inert));
   // The Alpine typography layer adds its signature after interface mount.
   if(nodes[i].length!==el.children.length)nodes[i]=children(el);
   nodes[i].forEach((n,j)=>apply(n,enter,exit,j,reducedMotion));
  });
 }};
}

export function createWorldSectionMotion({root,reducedMotion=false}){
 const resp=root.querySelector('[data-world-part="responsibility"]'),pin=resp?.querySelector('.fiwo-pin');
 const progress=pin?.querySelector('.fiwo-progress');
 const panels=[...root.querySelectorAll('.fiwo-panel')];
 const slides=panels.map(panel=>({panel,copy:children(panel.querySelector('.fiwo-strategy-copy')),photo:panel.querySelector('.fiwo-photo--strategy'),meta:panel.querySelector('.fiwo-strategy-meta')}));
 const principles=root.querySelector('.fiwp'),ppin=principles?.querySelector('.fiwp-pin'),body=principles?.querySelector('.fiwp-layout');
 const pn=principles?[...principles.querySelectorAll('.fiwp-eyebrow,.fiwp-title,.fiwp-title-zh,.fiwp-lead,.fiwp-lead-en,.fiwp-card,.fiwp-bottom,.fiwp-chapter-end')]:[];
 const seal=root.querySelector('.fisl'),spin=seal?.querySelector('.fisl-pin'),text=seal?.querySelector('.fisl-text'),sn=children(text);
 const flow=[...root.querySelectorAll('.fiw-global > *, .fiw-footer > :not(.fiw-sr)')];
 let H=innerHeight,metrics=null,rows=[],pr=[],lastPin='',lastPpin='',lastSpin='';
 function measure(w,h,top,m){
  H=h;
  for(const el of [pin,body])if(el)paintedStyles.delete(el);
  const footer=root.querySelector('.fiw-footer');
  metrics={...m,footerTop:footer?top(footer):Infinity,footerEnd:footer?top(footer)+footer.offsetHeight-H:Infinity,respTop:resp?top(resp):0,respH:resp?.offsetHeight||0,principlesTop:principles?top(principles):0,principlesH:principles?.offsetHeight||0,bodyOffset:body?.offsetTop||0};
  rows=flow.map(el=>({el,top:top(el)-parseFloat(el.style.getPropertyValue('--motion-y')||0),height:el.offsetHeight}));
  pr=pn.map(el=>({el,top:top(el)-parseFloat(el.style.getPropertyValue('--motion-y')||0),height:el.offsetHeight}));
 }
 const movePin=(el,value,key)=>{const next='translate3d(0,'+value.toFixed(1)+'px,0)';if(el&&next!==key)el.style.transform=next;return next;};
 function paint(s,y){
  if(!metrics)return;
  root.classList.toggle('is-footer-reading',y>=metrics.footerTop-1);
  const o=s.o,N=slides.length,stops=metrics.ocean?.stops;
  if(o&&stops?.length){
   const last=stops[N-1],out=clamp01((y-last-H*.06)/(H*.72));
   root.classList.toggle('has-section-motion',y>metrics.respTop-H*.25);
   // Counter the natural sticky release until the last slide has completed
   // its outro. Without this it gets cropped underneath the header.
   lastPin=movePin(pin,Math.max(0,y-(metrics.respTop+metrics.respH-H)),lastPin);
   if(pin){style(pin,'opacity','1');style(pin,'visibility',out>=1?'hidden':'visible');}
   const inert=out>.96||s.principles?.enter>.05;
   if(resp&&resp.inert!==inert)resp.inert=inert;
   if(progress)apply(progress,o.panel0,out,0,reducedMotion);
   slides.forEach(({panel,copy,photo,meta},k)=>{
    const distance=o.h-k;
    const enter=k===0?o.panel0:clamp01((distance+1)/.80);
    const exit=k===N-1?out:clamp01((distance-.12)/.88);
    copy.forEach((el,i)=>apply(el,enter,exit,i,reducedMotion));
    if(photo){
     const alpha=apply(photo,enter,exit,2,reducedMotion);
     style(photo,'--motion-scale',(reducedMotion?1:1+(1-alpha)*.025).toFixed(4));
    }
    if(meta)apply(meta,enter,exit,5,reducedMotion);
    if(k===N-1){const inert=out>.96||Math.abs(distance)>1;if(panel.inert!==inert)panel.inert=inert;if(panel.getAttribute('aria-hidden')!==String(inert))panel.setAttribute('aria-hidden',String(inert));}
   });
  }
  // Normal-flow text receives the same entrance and exit envelope, instead
  // of a one-shot reveal which is still visible while crossing the header.
  rows.forEach(({el,top,height},i)=>{
   const screen=top-y,enter=clamp01((H*.96-screen)/(H*.26));
   const exit=1-clamp01((screen+height-108)/(H*.20));
   // At the document end, legal text must not remain trapped in its entrance fade.
   const settledFooter=el.parentElement?.classList.contains('fiw-footer')&&y>=metrics.footerEnd-2;
   apply(el,settledFooter?1:enter,settledFooter?0:exit,i%3,reducedMotion);
  });
  const p=s.principles;
  if(p&&body){
   style(body,'opacity','1','important');
   pr.forEach(({el,top:position,height},i)=>{
    const top=position-y;
    const enter=Math.min(clamp01((p.enter-.10)/.80),clamp01((H*.96-top)/(H*.24)));
    const exit=Math.max(p.exit,1-clamp01((top+height-112)/(H*.17)));
    apply(el,enter,exit,i%4,reducedMotion);
   });
  }
  const l=s.l,a=metrics.logo?.at;
  if(l&&a&&text){
   const exit=clamp01((y-a.end+H*.14)/(H*.40)),enter=y>a.end?1:l.textP;
   lastSpin=movePin(spin,Math.max(0,y-a.end),lastSpin);
   sn.forEach((el,i)=>apply(el,enter,exit,i,reducedMotion));
  }
 }
 function close(){root.classList.remove('has-section-motion','is-footer-reading');for(const el of [pin,ppin,spin])if(el){el.style.transform='';el.style.visibility='';paintedStyles.delete(el);}lastPin=lastPpin=lastSpin='';}
 return {measure,paint,close};
}
