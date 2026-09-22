// Copy edited from the supplied Finnovation company introduction.
// Five rivers = one strategy overview + the four documented business areas.
export const STORY_CHAPTERS = [
  {id:'knowledge',from:.18,to:.86,en:['ROOTED IN','KNOWLEDGE'],zh:'以知為本，從洞察開始。',kicker:'OUR FOUNDATION',side:'left'},
  {id:'converge',from:2.25,to:3.65,en:['IDEAS','CONVERGE'],zh:'匯聚科技知識，連結金融價值。',kicker:'CONNECTED THINKING',side:'right'},
  {id:'technology',from:3.95,to:5.68,en:['TECHNOLOGY','MEETS FINANCE'],zh:'科技知識賦能，金融元素加值。',kicker:'THE FINNOVATION APPROACH',side:'left'},
  {id:'value',from:6.00,to:7.74,en:['VALUE','IN MOTION'],zh:'以穩健誠信為本，探索產業的長遠價值。',kicker:'OUR CONVICTION',side:'right'},
  {id:'perspective',from:8.30,to:9.55,en:['A WIDER','PERSPECTIVE'],zh:'邏輯數據之外，看見產業，也看見人。',kicker:'INSIGHT WITH HUMANITY',side:'left'},
  {id:'strategy',from:9.78,to:10.58,en:['FOUR PATHS','ONE VISION'],zh:'四大投資領域，連結科技與金融的產業價值。',kicker:'INVESTMENT STRATEGIES',side:'right'},
  {id:'ai',from:10.66,to:11.30,en:['AI','QUANT TRADING'],zh:'以 AI 與量化思維，探索市場中的投資機會。',kicker:'01 / AI 量化交易',side:'right'},
  {id:'public',from:11.38,to:12.02,en:['PUBLIC','EQUITIES'],zh:'關注上市櫃企業，洞察產業發展中的投資價值。',kicker:'02 / 上市櫃投資',side:'left'},
  {id:'private',from:12.10,to:12.74,en:['PRE-IPO','INVESTMENT'],zh:'與具潛力的企業對話，探索上市前的成長契機。',kicker:'03 / 未上市與 PRE-IPO',side:'left'},
  {id:'derivatives',from:12.82,to:13.65,en:['DERIVATIVE','STRATEGIES'],zh:'透過衍生性商品，拓展金融策略的可能。',kicker:'04 / 衍生性商品',side:'left'},
];
const ease=x=>{const t=Math.max(0,Math.min(1,x));return t*t*t*(t*(t*6-15)+10)};
export function mountJourneyStory(){
  const root=document.createElement('section');root.className='journey-story';root.setAttribute('aria-label','恒灝創新的投資理念與核心業務');
  const scrim=document.createElement('div');scrim.className='story-scrim';scrim.setAttribute('aria-hidden','true');root.append(scrim);
  const cards=STORY_CHAPTERS.map(c=>{
    const card=document.createElement('article');card.className='story-card story-'+c.side;card.dataset.chapter=c.id;card.setAttribute('aria-hidden','true');
    const kicker=document.createElement('p');kicker.className='story-kicker';kicker.textContent=c.kicker;
    const heading=document.createElement('h2');heading.lang='en';heading.className='story-title';heading.setAttribute('aria-label',c.en.join(' '));
    c.en.forEach((line,i)=>{const mask=document.createElement('span');mask.className='story-line';const text=document.createElement('span');text.textContent=line;text.style.setProperty('--line-delay',i);mask.append(text);heading.append(mask)});
    const subtitle=document.createElement('p');subtitle.className='story-zh';subtitle.lang='zh-Hant';subtitle.textContent=c.zh;card.append(kicker,heading,subtitle);
    if(c.signature){const sign=document.createElement('p');sign.className='story-signature';const words=c.signature.split(' · ');for(let i=0;i<words.length;i+=2){const phrase=document.createElement('span');phrase.textContent=words.slice(i,i+2).join(' · ');sign.append(phrase)}card.append(sign)}
    root.append(card);return {c,card,shown:false};
  });
  document.body.append(root);let active=null,hasScrolled=false,heroKey='',scrimKey='',activeKey=null,sideKey=null;
  // Mobile perf: every write below is skipped when the value did not change (identical output, no per-frame DOM mutation).
  const cardKeys=new WeakMap();const hero=[...document.querySelectorAll('.hero-title,.hero-sub')];
  function update(p,reduced=false){
    if(p>.005)hasScrolled=true;
    if(hasScrolled){const opening=1-ease(p/.22),key=opening.toFixed(4);if(key!==heroKey){heroKey=key;for(const el of hero){el.style.transition='none';el.style.opacity=key;el.style.transform='translateY('+(-16*(1-opening)).toFixed(2)+'px)';}}}
    let strongest=0;
    for(const item of cards){const {c,card}=item;const show=p>c.from&&p<c.to;
      if(show!==item.shown){item.shown=show;card.classList.toggle('is-active',show);card.setAttribute('aria-hidden',String(!show))}
      if(!show)continue;
      const fade=Math.min(.19,(c.to-c.from)*.23),enter=ease((p-c.from)/fade),out=Number.isFinite(c.to)?ease((p-c.to+fade)/fade):0;
      const opacity=enter*(1-out),zh=ease((p-c.from-fade*.36)/fade)*(1-out);
      const ck=opacity.toFixed(4)+'|'+enter.toFixed(4)+'|'+out.toFixed(4)+'|'+zh.toFixed(4)+'|'+reduced;
      if(cardKeys.get(card)!==ck){cardKeys.set(card,ck);card.style.setProperty('--opacity',opacity.toFixed(4));card.style.setProperty('--entry',enter.toFixed(4));card.style.setProperty('--exit',out.toFixed(4));card.style.setProperty('--zh',zh.toFixed(4));card.style.setProperty('--movement',reduced?'0px':'24px');}
      if(opacity>strongest){strongest=opacity;active=c.id;if(sideKey!==c.side){sideKey=c.side;root.dataset.side=c.side}}
    }
    const scrim=(strongest*(p<2.8?.12:p>=8?.25:.36)).toFixed(4);if(scrim!==scrimKey){scrimKey=scrim;root.style.setProperty('--scrim',scrim)}
    const act=strongest>.01?active:'';if(act!==activeKey){activeKey=act;root.dataset.active=act}
  }
  return {update,root,chapters:STORY_CHAPTERS};
}

// Analytic critically damped motion: identical elapsed-time response at 20/60/120fps.
export function stepJourneyMotion(state,dt,reduced=false){
  if(reduced){state.progress=state.target;state.velocity=0;return}
  const omega=10.5,t=Math.max(0,Math.min(.18,dt));
  const x=state.progress-state.target,v=state.velocity||0,decay=Math.exp(-omega*t),temp=(v+omega*x)*t;
  state.progress=state.target+(x+temp)*decay;state.velocity=(v-omega*temp)*decay;
  if(state.progress<0||state.progress>state.max){state.progress=Math.max(0,Math.min(state.max,state.progress));state.velocity=0}
  if(Math.abs(state.progress-state.target)<.00005&&Math.abs(state.velocity)<.0005){state.progress=state.target;state.velocity=0}
}
