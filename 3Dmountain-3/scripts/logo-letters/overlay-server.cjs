// Static server with an overlay: a file under <overlay> wins over the same path under <root>.
// Lets a change be developed and verified without touching the (Drive-synced, Live-Server-watched) project.
//   node overlay-server.cjs <root> <port> [overlay]
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const [root, portArg, overlay] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4',
  '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon' };
const resolveIn = (base, rel) => { const p = path.join(base, rel); return p.startsWith(path.resolve(base)) ? p : null; };
http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
  if (rel.endsWith('/')) rel += 'index.html';
  const candidates = [overlay && resolveIn(path.resolve(overlay), rel), resolveIn(path.resolve(root), rel)].filter(Boolean);
  const file = candidates.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  if (!file) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('404 ' + rel); return; }
  const stat = fs.statSync(file), type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const headers = { 'content-type': type, 'cache-control': 'no-store', 'accept-ranges': 'bytes', 'x-served-from': file === candidates[0] && overlay && file.startsWith(path.resolve(overlay)) ? 'overlay' : 'root' };
  if (range) {
    const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${stat.size}`, 'content-length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res); return;
  }
  res.writeHead(200, { ...headers, 'content-length': stat.size });
  fs.createReadStream(file).pipe(res);
}).listen(Number(portArg), '127.0.0.1', () => console.log('serving', root, overlay ? '+ overlay ' + overlay : '', 'on', portArg));
