import http from 'node:http';
import fs from 'node:fs/promises';
const publicFiles = new Map([
  ['/', ['../index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['../index.html', 'text/html; charset=utf-8']],
  ['/water-hero.js', ['../water-hero.js', 'text/javascript; charset=utf-8']],
  ['/drop_of_water/scene.gltf', ['../drop_of_water/scene.gltf', 'model/gltf+json']],
  ['/drop_of_water/scene.bin', ['../drop_of_water/scene.bin', 'application/octet-stream']],
  ['/hatom-inspired.html', ['../hatom-inspired.html', 'text/html; charset=utf-8']],
  ['/logo.svg', ['../logo.svg', 'image/svg+xml']]
]);
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const file = publicFiles.get(path);
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end(); return; }
  try {
    const content = await fs.readFile(new URL(file[0], import.meta.url));
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store', 'Content-Length': content.length });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(500); res.end('Preview file unavailable'); }
});
const previewEntry=process.argv[2]==='hatom-inspired.html'?'hatom-inspired.html':'index.html';
const previewPort = Number(process.env.MONTIS_PREVIEW_PORT || 0);
server.listen(previewPort, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + server.address().port + '/' + previewEntry));
