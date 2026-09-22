import { STORY_CHAPTERS } from './water-journey-story.js?v=five-rivers-only-1';

const chapters = [
  { id:'knowledge', en:'KNOWLEDGE', zh:'以知為本', title:['OMNI INVESTMENT','STRATEGIES'], text:'洞悉市場，全方位資產佈局', kicker:'KNOWLEDGE · CAPITAL · INNOVATION', cta:'EXPLORE OUR WORLD' },
  { id:'innovation', en:'INNOVATION', zh:'創新匯聚', title:['IDEAS','TAKE SHAPE'], text:'匯聚科技知識，連結金融價值。', kicker:'THE FINNOVATION SPIRIT', cta:'FOLLOW THE FLOW' },
  { id:'convergence', en:'CONVERGENCE', zh:'科技與金融', title:['TECHNOLOGY','MEETS FINANCE'], text:'科技知識賦能，金融元素加值。', kicker:'OUR APPROACH', cta:'DISCOVER OUR CONVICTION' },
  { id:'value', en:'VALUE', zh:'長遠價值', title:['VALUE','IN MOTION'], text:'以穩健誠信為本，探索產業的長遠價值。', kicker:'OUR CONVICTION', cta:'SEE THE BIGGER PICTURE' },
  { id:'perspective', en:'PERSPECTIVE', zh:'洞察未來', title:['A WIDER','PERSPECTIVE'], text:'邏輯數據之外，看見產業，也看見人。', kicker:'INSIGHT WITH HUMANITY', cta:'EXPLORE OUR STRATEGIES' },
  { id:'strategies', en:'STRATEGIES', zh:'投資策略', title:['FOUR PATHS','ONE VISION'], text:'四大投資領域，連結科技與金融的產業價值。', kicker:'INVESTMENT STRATEGIES', cta:'DISCOVER THE FOUR PATHS' }
];
const business = STORY_CHAPTERS.filter(c => c.from >= 10.66);
const arrow = '<svg class="fi-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-5-5 5 5-5 5"/></svg>';
const grid = '<span class="fi-grid-icon" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
const speaker = '<svg class="fi-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8h3l4-4v12l-4-4H3zM13 7c2 1.5 2 4.5 0 6m2-9c4 3 4 9 0 12"/></svg>';
const logo = '<svg class="fi-brand-mark" viewBox="610 286 137 165" aria-hidden="true"><path d="M674.5,292.42v23.5s-48.67,5.25-58,55.42c0,0-10.5-64.33,58-78.92Z"/><path d="M674.5,331.88v29.29s-40.5,14.5-38.5,47.5,40.33,35.5,59.67,28.33,46.89-33.89,28.33-76.33c0,0-13.19-27.14-48.17-28.79v-15.21s44.44,3.5,58.28,42.67c13.83,39.17-7.44,82.49-55.94,85.99s-71.51-55.16-45.01-88.66c0,0,14-19.08,41.33-24.79Z"/></svg>';

// The interface reads the existing journey clock; it does not own the camera.
export function mountJourneyInterface({ navigate, reducedMotion = false }) {
  const root = document.createElement('div');
  root.className = 'finnovation-ui';
  root.dataset.journeyUi = '';
  const copies = [...chapters, ...business.map(c => ({ id:c.id, title:c.en, text:c.zh, kicker:c.kicker, cta:c.id==='derivatives'?'BACK TO THE BEGINNING':'EXPLORE THE NEXT PATH' }))];
  root.innerHTML = `
    <div class="fi-veil" aria-hidden="true"></div>
    <svg class="fi-frame" aria-hidden="true"><path/></svg>
    <header class="fi-header">
      <button class="fi-brand" data-chapter="0" aria-label="恒灝創新，回到首頁">${logo}<span><span class="fi-brand-name">FINNOVATION</span><span class="fi-brand-zh">恒灝創新</span></span></button>
      <div class="fi-header-right">
        <nav class="fi-topnav" aria-label="主要導覽"><button data-chapter="0">ABOUT</button><button data-chapter="2">OUR APPROACH</button><button data-chapter="5">STRATEGIES</button></nav>
        <div class="fi-header-actions"><button class="fi-explore" data-next>${arrow} EXPLORE</button><button class="fi-menu-toggle" aria-haspopup="dialog" aria-controls="fi-menu" aria-expanded="false">${grid} MENU</button></div>
      </div>
    </header>
    <nav class="fi-rail" aria-label="品牌篇章">${chapters.map((c,i)=>`<button data-chapter="${i}" aria-label="${String(i+1).padStart(2,'0')} ${c.zh}"><span class="fi-rail-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span>${c.en}</button>`).join('')}</nav>
    <main class="fi-copy" aria-label="恒灝創新的理念與投資策略">${copies.map((c,i)=>`<article class="fi-copy-panel" data-copy="${c.id}" aria-hidden="true" inert><p class="fi-copy-kicker">${c.kicker}</p><${i?'h2':'h1'} lang="en">${c.title.map(line=>`<span>${line}</span>`).join('')}</${i?'h2':'h1'}><p class="fi-copy-zh">${c.text}</p><button class="fi-copy-action" data-next><span>${grid}${c.cta}${arrow}</span></button></article>`).join('')}</main>
    <footer class="fi-footer">
      <button class="fi-sound" aria-pressed="false" aria-label="開啟環境水聲">${speaker}<span>SOUND OFF</span></button>
      <div class="fi-footer-center"><span class="fi-footer-current">KNOWLEDGE</span><span class="fi-footer-progress" aria-hidden="true"><i></i></span><span class="fi-footer-total">01 / 06</span></div>
      <button class="fi-footer-next" data-next><span>NEXT CHAPTER</span>${arrow}</button>
    </footer>
    <dialog class="fi-menu" id="fi-menu" aria-labelledby="fi-menu-title">
      <div class="fi-menu-top"><span>FINNOVATION</span><button class="fi-menu-close" aria-label="關閉選單">CLOSE <svg class="fi-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div>
      <div class="fi-menu-body"><div class="fi-menu-intro"><p class="fi-menu-eyebrow">KNOWLEDGE. CAPITAL. INNOVATION.</p><h2 id="fi-menu-title">A wider vision.<br>A lasting impact.</h2><p>科技知識賦能，金融元素加值。</p></div>
      <nav class="fi-menu-links" aria-label="全部篇章">${chapters.map((c,i)=>`<button data-chapter="${i}"><span class="fi-menu-link-number">${String(i+1).padStart(2,'0')}</span><span><span class="fi-menu-link-en">${c.en}</span><span class="fi-menu-link-zh">${c.zh}</span></span>${arrow}</button>`).join('')}</nav></div>
      <div class="fi-menu-bottom"><span>恒灝創新 FINNOVATION</span><span>EXPLORE WITH PURPOSE</span></div>
    </dialog>`;
  document.body.append(root);
  document.body.classList.add('has-finnovation-ui');
  const menu=root.querySelector('.fi-menu'), menuToggle=root.querySelector('.fi-menu-toggle');
  const rail=root.querySelector('.fi-rail'), railButtons=[...rail.querySelectorAll('button')];
  const panels=[...root.querySelectorAll('.fi-copy-panel')];
  const currentLabel=root.querySelector('.fi-footer-current'), total=root.querySelector('.fi-footer-total');
  const nextLabel=root.querySelector('.fi-footer-next span');
  let targets=[0,2.8,6.7,9,11.3,12.5], lastState=null, active=-1, copyId='', progressKey='';
  const frame=root.querySelector('.fi-frame path');
  const resize=new ResizeObserver(()=>{
    const w=root.clientWidth,h=root.clientHeight,c=innerWidth<681?14:22;
    frame.setAttribute('d',`M${c} .5H${w-c}L${w-.5} ${c}V${h-c}L${w-c} ${h-.5}H${c}L.5 ${h-c}V${c}Z`);
  });
  resize.observe(root);
  const closeMenu=()=>{if(menu.open)menu.close();};
  menuToggle.addEventListener('click',()=>{menu.showModal();menuToggle.setAttribute('aria-expanded','true');});
  root.querySelector('.fi-menu-close').addEventListener('click',closeMenu);
  menu.addEventListener('close',()=>{menuToggle.setAttribute('aria-expanded','false');menuToggle.focus({preventScroll:true});});
  menu.addEventListener('click',e=>{if(e.target!==menu)return;const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeMenu();});
  function go(p){closeMenu();navigate(p);}
  root.addEventListener('click',e=>{
    const chapter=e.target.closest('button[data-chapter]');
    if(chapter){go(targets[Number(chapter.dataset.chapter)]);return;}
    if(!e.target.closest('[data-next]')||!lastState)return;
    if(copyId==='derivatives'){go(0);return;}
    const stops=[...targets,...business.map(c=>(c.from+c.to)*.5+lastState.shift)];
    const next=stops.find(p=>p>lastState.progress+.35);
    go(next===undefined?0:next);
  });
  // Sound is synthesized locally, starts only after an explicit button click,
  // and is suspended in hidden tabs. No media downloads or autoplay.
  const soundButton=root.querySelector('.fi-sound');
  let audio=null, audioGain=null, soundOn=false;
  async function toggleSound(){
    soundButton.disabled=true;
    try{
      if(!audio){
        const Audio=window.AudioContext||window.webkitAudioContext;
        if(!Audio)throw new Error('Audio unavailable');
        audio=new Audio();
        const noise=audio.createBuffer(2,audio.sampleRate*5,audio.sampleRate);
        for(let channel=0;channel<2;channel++){
          const values=noise.getChannelData(channel);let soft=0;
          for(let i=0;i<values.length;i++){soft=soft*.96+(Math.random()*2-1)*.04;values[i]=soft*3;}
        }
        const source=audio.createBufferSource();source.buffer=noise;source.loop=true;
        const low=audio.createBiquadFilter();low.type='lowpass';low.frequency.value=1100;
        const high=audio.createBiquadFilter();high.type='highpass';high.frequency.value=90;
        audioGain=audio.createGain();audioGain.gain.value=0;
        source.connect(low);low.connect(high);high.connect(audioGain);audioGain.connect(audio.destination);source.start();
      }
      await audio.resume();soundOn=!soundOn;
      audioGain.gain.setTargetAtTime(soundOn?.22:0,audio.currentTime,.3);
      soundButton.setAttribute('aria-pressed',String(soundOn));
      soundButton.setAttribute('aria-label',soundOn?'關閉環境水聲':'開啟環境水聲');
      soundButton.querySelector('span').textContent=soundOn?'SOUND ON':'SOUND OFF';
    }catch{
      soundButton.querySelector('span').textContent='SOUND UNAVAILABLE';
      soundButton.setAttribute('aria-label','此瀏覽器無法播放環境水聲');
    }finally{soundButton.disabled=false;}
  }
  soundButton.addEventListener('click',toggleSound);
  document.addEventListener('visibilitychange',()=>{if(!audio)return;if(document.hidden)audio.suspend();else if(soundOn)audio.resume().catch(()=>{});});
  function update(state){
    lastState=state;
    const scene=state.progress-state.shift>3.8&&state.progress-state.shift<8.4?'canyon':'open';
    if(root.dataset.scene!==scene)root.dataset.scene=scene;
    targets=[0,state.logoStart+(state.logoEnd-state.logoStart)*.54,4.7+state.shift,6.85+state.shift,8.96+state.shift,10.15+state.shift];
    const thresholds=[0,state.logoStart,3.86+state.shift,5.88+state.shift,8.16+state.shift,9.66+state.shift];
    let index=0;
    for(let i=1;i<thresholds.length;i++)if(state.progress>=thresholds[i])index=i;
    if(index!==active){
      active=index;
      railButtons.forEach((b,i)=>{if(i===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
      currentLabel.textContent=chapters[index].en;total.textContent=`${String(index+1).padStart(2,'0')} / 06`;
      if(innerWidth<=680){const b=railButtons[index];rail.scrollTo({left:Math.max(0,b.offsetLeft-(rail.clientWidth-b.offsetWidth)*.5),behavior:reducedMotion?'instant':'smooth'});}
    }
    let id=chapters[index].id;
    if(index===5){for(const c of business)if(state.progress-state.shift>=c.from-.025)id=c.id;}
    if(id!==copyId){
      copyId=id;root.dataset.chapter=id;
      panels.forEach(p=>{const selected=p.dataset.copy===id;p.classList.toggle('is-active',selected);p.inert=!selected;p.setAttribute('aria-hidden',String(!selected));});
      nextLabel.textContent=id==='derivatives'?'BACK TO START':index===5?'NEXT STRATEGY':'NEXT CHAPTER';
    }
    const key=Math.max(0,Math.min(1,state.progress/state.max)).toFixed(4);
    if(key!==progressKey){progressKey=key;root.style.setProperty('--fi-progress',key);}
  }
  return {root,update,get menuOpen(){return menu.open;}};
}
