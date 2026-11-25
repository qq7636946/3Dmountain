/* Optical finishing on the existing reversible scene clocks. No new RAF,
   input listener, texture upload or extra seconds in the scroll timeline. */
import { FLOW_MOTION } from '../motion-tokens.js?v=flow-unified-9c1fe0c6850f';
const optics=FLOW_MOTION.optics;
const clamp=n=>Math.max(0,Math.min(1,Number(n)||0));
const pulse=p=>Math.sin(Math.PI*clamp(p))**2;
let layer,previous='',lastH=0,lastTime=0,slideEnergy=0;
function paint(phase,progress,strength,reduced){
  const gate=document.documentElement.dataset.gate;
  const blocked=reduced||document.hidden||document.documentElement.dataset.renderMode==='text'||['hold','ready','finishing','enter'].includes(gate);
  const p=clamp(progress),alpha=blocked?0:pulse(p)*strength;
  if(!layer){
    layer=document.createElement('div');layer.className='flow-optics';layer.setAttribute('aria-hidden','true');
    layer.innerHTML='<i class="flow-optics-haze"></i>';
    document.body.append(layer);
  }
  const key=phase+'|'+p.toFixed(3)+'|'+alpha.toFixed(3);
  if(key===previous)return;previous=key;
  layer.dataset.phase=phase;layer.dataset.progress=p.toFixed(3);
  layer.style.opacity=alpha.toFixed(3);layer.style.visibility=alpha>.001?'visible':'hidden';
  layer.classList.toggle('is-active',alpha>.001);
}
export function clearTransition(){paint('rest',0,0,true);slideEnergy=0;lastH=0;lastTime=0;}
export function paintJourneyTransition({reduced,worldOpen,drop,flight,mix}){
  if(worldOpen)return;
  if(flight>.001&&flight<.999)return paint('word',flight,optics.word,reduced);
  if(mix>.001&&mix<.999)return paint('valley',mix,optics.valley,reduced);
  if(drop>.001&&drop<.999)return paint('drop',drop,optics.drop,reduced);
  paint('rest',0,0,reduced);
}
export function paintWorldTransition({s,leg,flow,cards,reduced}){
  if(leg==='sea'){
    if(flow&&flow.amount>0&&flow.amount<.999)return paint('sea',flow.amount,optics.sea,reduced);
    if(cards?.open&&cards.transition<.999)return paint('cards',cards.transition,optics.cards,reduced);
    const h=s.o?.h||0,now=performance.now(),dt=Math.max(.001,Math.min(.1,(now-lastTime)/1000));
    const speed=lastTime?Math.min(1,Math.abs(h-lastH)/dt*1.4):0;
    slideEnergy+=(speed-slideEnergy)*(1-Math.exp(-dt*9));lastH=h;lastTime=now;
    return paint('strategy',h-Math.floor(h),slideEnergy*.065,reduced);
  }
  slideEnergy=0;lastTime=0;
  if(s.c>.001&&s.c<.999)return paint('clouds',s.c,optics.clouds,reduced);
  if(s.principles?.enter>.001&&s.principles.enter<.999)return paint('principles',s.principles.enter,optics.principles,reduced);
  if(s.l?.qWave>.001&&s.l.qWave<.999)return paint('logo',s.l.qWave,optics.logo,reduced);
  const footer=clamp(1-(s.footerTop||0)/Math.max(1,innerHeight));
  if(footer>.001&&footer<.999)return paint('footer',footer,optics.footer,reduced);
  paint('rest',0,0,reduced);
}
