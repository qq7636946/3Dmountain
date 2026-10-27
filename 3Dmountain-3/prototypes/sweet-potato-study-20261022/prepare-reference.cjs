// Read-only analysis of the supplied photo. Writes geometry samples, not an edited image.
const fs=require('node:fs/promises'),path=require('node:path');
const sharp=require('C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async()=>{
  const {data,info}=await sharp(path.join(__dirname,'assets/reference.png')).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const rows=[];
  for(let y=394;y<=916;y+=3){
    const hits=[];
    for(let x=145;x<350;x++){
      const i=(y*info.width+x)*info.channels,r=data[i],g=data[i+1],b=data[i+2];
      if(r>g*1.13&&r>b*.96&&Math.max(r,g,b)<240&&r>35)hits.push(x);
    }
    if(hits.length>3) rows.push({y,left:hits[0]+.8,right:hits.at(-1)-.8});
  }
  const smooth=rows.map((r,i)=>{const around=rows.slice(Math.max(0,i-2),Math.min(rows.length,i+3));return {y:r.y,left:around.reduce((s,a)=>s+a.left,0)/around.length,right:around.reduce((s,a)=>s+a.right,0)/around.length};});
  const profile=smooth.reverse().map(r=>({t:(920-r.y)/530,radius:(r.right-r.left)*.00778/2,cx:((r.right+r.left)/2-244)*.00778}));
  profile.unshift({t:0,radius:.018,cx:profile[0].cx});profile.push({t:1,radius:.052,cx:profile.at(-1).cx});
  await fs.writeFile(path.join(__dirname,'assets/tuber-profile.json'),JSON.stringify({source:'Supplied reference photo; red/brown silhouette samples and five-row smoothing.',width:info.width,height:info.height,profile},null,2));
  console.log('Profile samples',profile.length,'photo',info.width,info.height);
})().catch(e=>{console.error(e);process.exit(1)});
