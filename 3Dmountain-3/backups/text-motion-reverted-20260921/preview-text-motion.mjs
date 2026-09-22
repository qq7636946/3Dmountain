import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=await fsp.realpath(fileURLToPath(new URL('../',import.meta.url)));
const port=Number(process.argv[2]??process.env.MONTIS_TEXT_PREVIEW_PORT??0);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('Pass a loopback port between 0 and 65535.');
const types=new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.gltf','model/gltf+json'],['.bin','application/octet-stream'],['.svg','image/svg+xml'],['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],['.mp4','video/mp4'],['.woff','font/woff'],['.woff2','font/woff2']]);
const assets=new Set(['logo.svg','logo.mp4']);
const modelDirs=new Set(['drop_of_water','river_water_runtime']);
const modelExtensions=new Set(['.gltf','.bin','.png','.jpg','.jpeg','.webp']);
function allowed(relative){
  if(relative==='index4-6.html'||assets.has(relative))return true;
  if(/^water-[a-z0-9-]+\.js$/i.test(relative))return true;
  const first=relative.split('/')[0];
  return modelDirs.has(first)&&modelExtensions.has(path.extname(relative).toLowerCase());
}
function inside(file){const relative=path.relative(root,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
function respond(res,status,message){res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(message);}
const server=http.createServer(async(req,res)=>{
  if(!/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(req.headers.host||'')){respond(res,403,'Loopback host required');return;}
  if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');respond(res,405,'Read-only preview');return;}
  let requested;
  try{requested=decodeURIComponent((req.url||'/').split('?')[0]);}catch{respond(res,400,'Malformed path');return;}
  if(!requested.startsWith('/')||requested.includes('\\')||requested.includes('\0')||requested.split('/').some(part=>part.startsWith('.'))){respond(res,403,'Path unavailable');return;}
  if(requested==='/favicon.ico'){res.writeHead(204,{'Cache-Control':'no-store'});res.end();return;}
  const relative=requested==='/'?'index4-6.html':requested.slice(1);
  if(!allowed(relative)){respond(res,404,'File not in this preview');return;}
  const filename=path.resolve(root,relative);
  if(!inside(filename)){respond(res,403,'Path unavailable');return;}
  try{
    const real=await fsp.realpath(filename);
    if(!inside(real)){respond(res,403,'Path unavailable');return;}
    const stat=await fsp.stat(real);
    if(!stat.isFile()){respond(res,404,'File unavailable');return;}
    let start=0,end=stat.size-1,status=200;
    const headers={'Content-Type':types.get(path.extname(real).toLowerCase())||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'};
    if(req.headers.range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
      if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1;}
      else{start=Math.max(0,stat.size-Number(match[2]));}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`});res.end();return;}
      status=206;headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
    }
    headers['Content-Length']=Math.max(0,end-start+1);res.writeHead(status,headers);
    if(req.method==='HEAD'||stat.size===0){res.end();return;}
    const stream=fs.createReadStream(real,{start,end});
    stream.on('error',error=>{console.error(`Read failed for ${relative}: ${error.code||error.message}`);res.destroy(error);});
    res.on('close',()=>stream.destroy());stream.pipe(res);
  }catch(error){
    console.error(`Preview asset unavailable: ${relative} (${error.code||error.message})`);
    if(!res.headersSent)respond(res,error.code==='ENOENT'?404:500,'Preview asset unavailable');else res.destroy(error);
  }
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${server.address().port}/index4-6.html`));
for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>server.close(()=>process.exit(0)));
