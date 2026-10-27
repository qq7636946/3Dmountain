import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let pathname;
  try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch{res.writeHead(400);return res.end();}
  if(pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
  if(pathname==='/')pathname='/slide.html';
  const allowed=['/slide.html','/slide.js'].includes(pathname)||/^\/slide-assets\/[a-zA-Z0-9_-]+\.(jpg|png|webp|svg)$/.test(pathname);
  if(!allowed){res.writeHead(404);return res.end('Not found');}
  try{
    const data=await fs.readFile(path.join(root,pathname.slice(1)));
    res.writeHead(200,{'content-type':types[path.extname(pathname)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(Number(process.env.SLIDE_PREVIEW_PORT||0),'127.0.0.1',()=>{
  console.log('Slide preview: http://127.0.0.1:'+server.address().port+'/slide.html');
});
