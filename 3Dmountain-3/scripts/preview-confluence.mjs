import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=await fs.realpath(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.gltf':'model/gltf+json','.bin':'application/octet-stream','.svg':'image/svg+xml','.mp4':'video/mp4','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let name;try{name=decodeURIComponent((req.url||'/').split('?')[0]);}catch{res.writeHead(400);return res.end();}
  if(name==='/favicon.ico'){res.writeHead(204);return res.end();}
  if(name==='/')name='/index4-6.html';
  const allowed=['/index4-6.html','/logo.svg','/logo.mp4'].includes(name)||/^\/water-[a-z0-9-]+\.js$/i.test(name)||/^\/(drop_of_water|river_water_runtime)\/[a-zA-Z0-9_/-]+\.(gltf|bin|png|jpg|webp)$/.test(name);
  if(!allowed||name.includes('..')||name.includes('\\')){res.writeHead(404);return res.end();}
  try{
    const file=await fs.realpath(path.join(root,name.slice(1))),relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Outside preview');
    const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','Content-Length':data.length,'X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('Preview asset unavailable');}
});
server.listen(0,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port+'/index4-6.html?view=finale'));
