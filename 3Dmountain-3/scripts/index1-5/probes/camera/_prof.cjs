const S=require('./sim4.cjs'); const d=require('./design-lib.cjs');
const res=S.solve({r:60,delta:60,sigmaU:.3,lead:.25,anchors:S.ANCH}); const x=S.gaussArr(res.x,.04);
let line=[];
for (let i=0;i<=S.NP;i+=10){ const p=S.pAt(i); if(p<4.7||p>10.2)continue; const rate=i>=10?((S.psiOld[i]+x[i])-(S.psiOld[i-10]+x[i-10]))/(.1):0; line.push(`${p.toFixed(2)} old${S.psiOld[i].toFixed(0).padStart(4)} cam${(S.psiOld[i]+x[i]).toFixed(0).padStart(4)} x${x[i].toFixed(0).padStart(4)} rate${rate.toFixed(0).padStart(4)}`); }
console.log(line.join('\n'));
