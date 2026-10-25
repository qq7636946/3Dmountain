/* Studio motion 2026-10-25: same responsive spring through journey/world;
   the cinematic card bridge has one slightly softer spring, no extra filter.
   Local portfolio copy: shared pages keep their existing handoff. */
const fs=require('fs'),path=require('path');
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
function once(s,a,b,label){if(s.split(a).length!==2)throw Error('motion polish '+label+': '+a.slice(0,90));return s.replace(a,()=>b);}
function patchMain(s){
 if(s.includes('STUDIO_MOTION_MAIN'))return s;
 s=once(s,"    import * as THREE from 'three';","    import * as THREE from 'three';\n    /* STUDIO_MOTION_MAIN */\n    import { stepJourneyPolish } from './motion-response.js';",'main import');
 s=once(s,'        stepJourneyMotion(J, scrollDt, reduceMotion);','        stepJourneyPolish(J, scrollDt, reduceMotion);','journey response');
 s=once(s,'if (delta * ahead < 0) journey.target = journey.progress;','if (delta * ahead < 0) { journey.target = journey.progress; journey.velocity = 0; }','reverse input');
 s=once(s,'      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));','      /* One response profile across the journey, bridge and world. Existing dials remain editable. */\n      Object.assign(CONFIG.mist, {follow:8.5});\n      Object.assign(CONFIG.worldOcean, {ease:11.5});\n      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));','response defaults');
 const re=/import\('(?:\.\/|\.\.\/\.\.\/\.\.\/js\/)portfolio-epilogue\.js(?:\?[^']*)?'\)/g;
 if([...s.matchAll(re)].length!==1)throw Error('portfolio import');
 s=s.replace(re,"import('./portfolio-epilogue-polish.js')");
 s=once(s,"sliderUrl: './portfolio-slider.js?v=4dc9d73082',","sliderUrl: '../../../js/portfolio-slider.js?v=4dc9d73082',",'slider path');
 s=once(s,'          notch: () => 100 / Math.max(720, innerHeight * .85)\n','          notch: () => 100 / Math.max(720, innerHeight * .85),\n          carry: rest => advanceJourney(rest)\n','reverse carry');
 return s;
}
function patchWorld(s){
 if(s.includes('STUDIO_MOTION_WORLD'))return s;
 s=once(s,'const omega = ocean ? ocean.omega(y) : 9.5,','/* STUDIO_MOTION_WORLD: one response, even across globe/reading/footer. */\n      const omega = ocean ? ocean.omega(y) : 11.5,','world response');
 s=once(s,'    if (px < 0 && yt <= 0 && y < 2) { close(); return false; }','    if (px < 0 && yt <= 0 && y < 24) { close(); return false; }','world back edge');
 s=once(s,'    yt = clamp(yt + px, 0, maxY);','    // Reversing input owns the camera immediately; cancel the old-direction momentum.\n    if (px * (yt - y) < 0) { yt = y; vy = 0; }\n    yt = clamp(yt + px, 0, maxY);','world reverse');
 return s;
}
function patchOcean(s){
 if(s.includes('GLOBE_SCROLL_INERTIA'))return s;
 const anchor=s.includes('const omega = y => mix(9.5,')?'const omega = y => mix(9.5,':'const omega = y => mix(11.5,';
 return once(s,anchor,`/* GLOBE_SCROLL_INERTIA: a longer glide on the globe, blending back before the sea. */
  const globeResponse = document.documentElement.matches('[data-look="index1-5"]:not([data-opening-refinement])') ? 8.5 : 11.5;
  const omega = y => mix(globeResponse,`,'globe scroll inertia');
}
function patchPortfolio(s){
 s=once(s,'bridge = false, onEnd = null, grade = null, mist = null, notch = null }) {','bridge = false, onEnd = null, grade = null, mist = null, notch = null, carry = null }) {','carry param');
 s=once(s,'      const next = bt + delta / span();','      if (delta * (bt - amount) < 0) { bt = amount; velocity = 0; }\n      const next = bt + delta / span();','bridge reverse');
 s=once(s,'      if (next <= 0) { close(); return true; }','      if (next <= 0) { close(); if (next < 0) carry?.(next * span()); return true; }','bridge carry');
 s=once(s,'amount >= .97) onEnd?.(delta);','amount >= .92) onEnd?.(delta);','bridge handoff');
 return '/* index1-5 local portfolio: smooth reverse/carry, no shared-page changes. */\n'+s;
}
module.exports=({main,drops,letters,glass,html,extra={},journey})=>{
 const portfolio=patchPortfolio(read(path.resolve(__dirname,'../../js/portfolio-epilogue.js')));
 return {main:patchMain(main),drops,letters,glass,html,journey,extra:{...extra,'finnovation-world.js':patchWorld(extra['finnovation-world.js']),'world-ocean.js':patchOcean(extra['world-ocean.js']),'motion-response.js':read(path.join(__dirname,'motion-response.js')),'portfolio-epilogue-polish.js':portfolio}};
};
module.exports.patchMain=patchMain;module.exports.patchWorld=patchWorld;module.exports.patchOcean=patchOcean;module.exports.patchPortfolio=patchPortfolio;
