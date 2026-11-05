'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const read=n=>fs.readFileSync(path.join(__dirname,n),'utf8').replace(/\r\n/g,'\n');
function once(s,a,b){const n=s.split(a).length-1;if(n!==1)throw Error('five sections: '+n+' anchors: '+a.slice(0,90));return s.replace(a,()=>b);}
function patchRuntime(state){
  let main=state.main;const extra={...state.extra};
  main=once(main,"from './chapter-flow.js'","from './site-sections.js'");
  main=once(main,'CONFIG.portfolio.images.map(url => url.replace(', 'CONFIG.portfolio.images.slice(0, 7).map(url => url.replace(');
  main=once(main,': CONFIG.portfolio.images, base: CONFIG.portfolio.base',': CONFIG.portfolio.images.slice(0, 7), base: CONFIG.portfolio.base');
  let slider=extra['portfolio-slider-firstpass.js'];
  if(!slider)throw Error('five sections: the sliced WebGL card renderer is missing');
  slider=once(slider,'const strip = totalSlidesWidth * 1000;', 'const strip = Math.max(1, textures.length - 1) * (slideWidth + slideGap) * 1000;');
  slider=once(slider,'  let travel = 0;', '  let shownTravel = 0;\n  let travel = 0;');
  slider=once(slider,'    const [scrollPos, scrollVel] = scrollEase(scroll.y, dt);','    const [scrollPos, scrollVel] = scrollEase(scroll.y, dt);\n    shownTravel = Math.max(0, Math.min(1, -scrollPos / strip));');
  slider=once(slider,'    addScroll(delta) { scroll.y += delta; },','    addScroll(delta) { scroll.y = Math.max(-strip, Math.min(0, scroll.y + delta)); travel = -scroll.y / strip; },');
  slider=once(slider,'      scroll.y += delta;\n      travel = Math.min(1, Math.max(0, travel + (-delta) / strip));','      scroll.y = Math.max(-strip, Math.min(0, scroll.y + delta));\n      travel = -scroll.y / strip;');
  slider=once(slider,'    get progress() { return travel; },',`    seek(value, instant = true) {
      travel = Math.max(0, Math.min(1, value)); scroll.y = -strip * travel;
      if (instant) { shownTravel = travel; scrollEase.reset(scroll.y); const empty = new Transform(); for (const target of renderTargets) if (target) renderer.render({ scene: empty, camera, target, clear: true }); }
    },
    get displayProgress() { return shownTravel; },
    get progress() { return travel; },`);
  slider=once(slider,'    get progress() { return real ? real.progress : 0; },','    get progress() { return real ? real.progress : 0; },\n    get displayProgress() { return real ? real.displayProgress : 0; },\n    seek: (v, instant) => real?.seek(v, instant),');
  extra['portfolio-slider-firstpass.js']=slider;
  const v=crypto.createHash('sha256').update(slider).digest('hex').slice(0,12);
  const sliderRef=main.match(/sliderUrl: '\.\/portfolio-slider-firstpass\.js\?v=[^']+'/)?.[0];
  if(!sliderRef)throw Error('five sections: slider import URL missing');
  main=once(main,sliderRef,`sliderUrl: './portfolio-slider-firstpass.js?v=sections-${v}'`);
  let cards=extra['portfolio-epilogue-polish.js'];
  if(!cards)throw Error('five sections: card host missing');
  cards=once(cards,'    preload: load, close,',`    preload: load, close,
    async openAt(progress = 0) {
      await load(); if (disposed || !prepared || !slider) return false;
      if (!open) beginBridge();
      bt = amount = 1; velocity = 0; exit = 0; suspended = false; painted = NaN;
      slider.setEntrance(1); slider.seek(progress, true); paint(); run(); return true;
    },
    seekProgress(progress, instant = true) { if (!slider) return; slider.seek(progress, instant); run(); },
    get displayStrip() { return slider?.displayProgress ?? 0; },`);
  extra['portfolio-epilogue-polish.js']=cards;
  let world=extra['finnovation-world.js'];
  world=once(world,'  const ocean = createWorldOcean({',"  const ocean = document.documentElement.dataset.siteSections === 'five' ? null : createWorldOcean({");
  world=once(world,'  const principles = createWorldPrinciples({',"  const principles = document.documentElement.dataset.siteSections === 'five' ? null : createWorldPrinciples({");
  world=once(world,'    at.footer = top(f); at.footerH = f?.offsetHeight || 0;','    at.footer = top(f); at.footerH = f?.offsetHeight || 0;\n    if (document.documentElement.dataset.siteSections === \'five\') at.resp = at.block = at.footer;');
  world=once(world,'      photo: o ? o.show : smooth(at.block - H * 1.15, at.block - H * .3, yy),',"      photo: document.documentElement.dataset.siteSections === 'five' ? 0 : o ? o.show : smooth(at.block - H * 1.15, at.block - H * .3, yy),");
  extra['finnovation-world.js']=world;
  extra['site-sections.js']=read('site-sections.js');
  return {...state,main,extra};
}
function patchHTML(html){
  html=html.replace(/\sdata-site-sections="[^"]*"/g,'').replace('<html ','<html data-site-sections="five" ');
  // Keep the source hooks for the legacy build helpers. These sections are
  // absent from layout/accessibility and their WebGL constructors are disabled.
  html=html.replace(/<section\b[^>]*\bid="(?:responsibility|principles|logo-seal)"[^>]*>/g,s=>s.replace(/\s+hidden\b/g,'').replace(/>$/,' hidden>'));
  html=html.replace(/(<p class="fiw-kicker"[^>]*>)[\s\S]*?(<\/p>)/,(m,a,b)=>a+'05 / GLOBAL PRESENCE · 全球布局'+b);
  html=html.replace(/(<h2[^>]*id="fiwGlobalTitle"[^>]*>)[\s\S]*?(<\/h2>)/,(m,a,b)=>a+'跨越邊界，讓價值相連'+b);
  const sections=[['核心價值','core-values'],['投資策略','investment-strategies'],['為何選擇我們','why-us'],['最新消息','latest-news'],['全球布局','global-presence']];
  html=html.replace(/(<ul[^>]*>)([\s\S]*?)(<\/ul>)/g,(m,a,body,b)=>body.includes('data-chapter-link=')?a+sections.map(([label,id],i)=>`<li><button type="button" data-section="${i}">${label}</button></li>`).join('')+b:m);
  html=html.replace(/<button\b[^>]*\bdata-world-top\b[^>]*>/g,s=>s.replace(/\sdata-section="\d+"/g,'').replace(/>$/,' data-section="0">'));
  html=html.replace(/(<div class="fiw-outro-links">)([\s\S]*?)(<\/div>)/,(m,a,body,b)=>a+body.replace(/<button\b[^>]*>/g,s=>s.replace(/\sdata-section="\d+"/g,'').replace(/>$/,` data-section="${s.includes('data-world-go="responsibility"')?1:0}">`))+b);
  html=html.replace(/\s*<link[^>]*data-site-sections-style[^>]*>/g,'');
  const hash=crypto.createHash('sha256').update(read('site-sections.css')).digest('hex').slice(0,12);
  return html.replace('</head>',`  <link rel="stylesheet" href="prototypes/index1-5/site-sections.css?v=${hash}" data-site-sections-style>\n</head>`);
}
function restoreBuildHooks(html){
  return html.replace(/(<ul[^>]*>)([\s\S]*?)(<\/ul>)/g,(m,a,body,b)=>body.includes('data-section="0"')&&body.includes('核心價值')?a+['Knowledge','Insight','Direction','Value','Confluence','Strategies'].map((name,i)=>`<li><button type="button" data-chapter-link="${i}">${name}</button></li>`).join('')+b:m);
}
module.exports={patchRuntime,patchHTML,restoreBuildHooks};
