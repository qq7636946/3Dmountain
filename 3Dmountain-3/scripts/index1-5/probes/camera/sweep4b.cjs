const fs=require('fs'); const S=require('./sim4.cjs');
const log = JSON.parse(fs.readFileSync('.qa/index1-5/camera/before-a-log.json','utf8'));
const frames = log.frames.filter(f => f[11] === 0 && f[1] >= 4.7 && f[1] <= 10.4);
for (const [name,useTarget,sigmaU,lead] of [['jit',false,.3,.25],['flt .3/.25',true,.3,.25],['flt .2/.1',true,.2,.1],['flt .15/0',true,.15,0],['flt .4/.3',true,.4,.3]])
  for (const r of [55,60]) { const res = S.solve({ r, delta: 60, sigmaU, lead, anchors: S.ANCH, useTarget }); if(!res.ok){console.log(name,r,'infeasible',res.at);continue;}
   for (const sm of [.04,.08]) console.log(name.padEnd(12),'r',r,'sm',sm, JSON.stringify(S.summarize(S.evaluate(res, frames, sm)))); }
