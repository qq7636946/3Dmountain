// node chart.cjs out.jpg "title" "xlabel" "ylabel" series.json   series: [{name,color,points:[[x,y],...]}], optional bands [{x0,x1,label}]
const { chromium } = require('C:/Users/lee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs');const [out,title,xl,yl,file]=process.argv.slice(2);const data=JSON.parse(fs.readFileSync(file,'utf8'));
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const p=await b.newPage();
const url=await p.evaluate(({data,title,xl,yl})=>{const W=1400,H=560,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);
const L=80,R=W-30,T=60,B=H-60;const all=data.series.flatMap(s=>s.points);const xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
const x0=data.xmin??Math.min(...xs),x1=data.xmax??Math.max(...xs),y0=data.ymin??0,y1=data.ymax??Math.max(...ys)*1.08;const X=v=>L+(v-x0)/(x1-x0)*(R-L),Y=v=>B-(v-y0)/(y1-y0)*(B-T);
(data.bands||[]).forEach(bd=>{x.fillStyle=bd.color||'rgba(255,190,90,.18)';x.fillRect(X(bd.x0),T,X(bd.x1)-X(bd.x0),B-T);x.fillStyle='#7a5a20';x.font='13px system-ui';x.fillText(bd.label,X(bd.x0)+4,T+16);});
(data.hlines||[]).forEach(h=>{x.strokeStyle=h.color||'#c33';x.setLineDash([6,4]);x.beginPath();x.moveTo(L,Y(h.y));x.lineTo(R,Y(h.y));x.stroke();x.setLineDash([]);x.fillStyle=h.color||'#c33';x.font='13px system-ui';x.fillText(h.label,R-260,Y(h.y)-6);});
x.strokeStyle='#999';x.lineWidth=1;x.beginPath();x.moveTo(L,T);x.lineTo(L,B);x.lineTo(R,B);x.stroke();x.fillStyle='#444';x.font='13px system-ui';
for(let i=0;i<=5;i++){const v=y0+(y1-y0)*i/5;x.fillText(v.toFixed(0),L-46,Y(v)+4);x.strokeStyle='#eee';x.beginPath();x.moveTo(L+1,Y(v));x.lineTo(R,Y(v));x.stroke();}
const step=data.xstep||.5;for(let v=Math.ceil(x0/step)*step;v<=x1+1e-6;v+=step){x.fillText(v.toFixed(1),X(v)-10,B+18);}
data.series.forEach(s=>{x.strokeStyle=s.color;x.lineWidth=2;x.beginPath();s.points.forEach((pt,i)=>{const a=X(pt[0]),bb=Y(Math.min(pt[1],y1));i?x.lineTo(a,bb):x.moveTo(a,bb);});x.stroke();});
x.fillStyle='#111';x.font='600 18px system-ui';x.fillText(title,L,32);x.font='13px system-ui';x.fillStyle='#444';x.fillText(xl,R-200,H-18);x.save();x.translate(18,B);x.rotate(-Math.PI/2);x.fillText(yl,0,0);x.restore();
let lx=L+10;data.series.forEach(s=>{x.fillStyle=s.color;x.fillRect(lx,T+28,18,4);x.fillStyle='#222';x.fillText(s.name,lx+24,T+34);lx+=x.measureText(s.name).width+60;});
return c.toDataURL('image/jpeg',.9);},{data,title,xl,yl});fs.writeFileSync(out,Buffer.from(url.split(',')[1],'base64'));console.log('ok',out);await b.close();})();
