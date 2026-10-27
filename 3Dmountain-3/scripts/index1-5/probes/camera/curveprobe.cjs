const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=d3d11','--ignore-gpu-blocklist','--enable-gpu','--enable-webgl']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();p.setDefaultTimeout(150000);
 await p.goto(process.argv[2],{waitUntil:'commit'});
 await p.waitForFunction(()=>window.__MONTIS_STUDY__&&window.__MONTIS_STUDY__.journey&&document.body.classList.contains('is-ready'),null,{polling:250});
 const r=await p.evaluate(()=>{const s=window.__MONTIS_STUDY__,c=s.canyon.curve,L=c.getLength();const shift=s.journey.max-10.18;const out=[];
  let prev=null;for(let i=0;i<=400;i++){const route=i/400;const t=route*.865;const tg=c.getTangentAt(t);const h=Math.atan2(tg.x,-tg.z)*180/Math.PI;
   // journey p for this route: base = 1.404 + route*(8-1.404)
   const base=1.404+route*(8-1.404);out.push([+(base+shift).toFixed(3),+h.toFixed(2)]);}
  // heading change per journey unit, windowed
  const rates=[];for(let i=1;i<out.length;i++){let d=out[i][1]-out[i-1][1];if(d>180)d-=360;if(d<-180)d+=360;rates.push([out[i][0],+(d/(out[i][0]-out[i-1][0])).toFixed(1)]);}
  return {L,shift,rates:rates.filter(x=>Math.abs(x[1])>60)};});
 console.log('pathLength',r.L.toFixed(0),'shift',r.shift.toFixed(3));console.log(JSON.stringify(r.rates));
 await Promise.race([b.close(),new Promise(r=>setTimeout(r,8000))]);process.exit(0);
})();
