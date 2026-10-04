// Static server with an overlay: requests under /__base__/ are served from the baseline
// backup folder first, then fall back to the project root (so logo.gltf, mp4, svg... still resolve).
// usage: node static-server2.cjs <root> <port> <baselineDir>
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.argv[3] || 5200);
const baseDir = path.resolve(process.argv[4] || root);
const PREFIX = '/__base__/';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.gltf': 'model/gltf+json', '.glb': 'model/gltf-binary',
  '.bin': 'application/octet-stream', '.wasm': 'application/wasm', '.ktx2': 'image/ktx2', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

function resolveFile(rel) {
  const tryFiles = [];
  if (rel.startsWith(PREFIX)) {
    const sub = rel.slice(PREFIX.length);
    tryFiles.push(path.join(baseDir, sub), path.join(root, sub));
  } else {
    tryFiles.push(path.join(root, rel));
  }
  for (const f of tryFiles) {
    const n = path.normalize(f);
    if (!(n.startsWith(root) || n.startsWith(baseDir))) continue;
    try { if (fs.statSync(n).isFile()) return n; } catch {}
  }
  return null;
}

http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const rel = decodeURIComponent(url.pathname);
    const file = resolveFile(rel);
    if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404 ' + rel); }
    const st = fs.statSync(file);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const base = { 'Content-Type': type, 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? parseInt(m[2], 10) : st.size - 1;
      if (end >= st.size) end = st.size - 1;
      if (start > end) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, { ...base, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...base, 'Content-Length': st.size });
    fs.createReadStream(file).pipe(res);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} (+overlay ${PREFIX} -> ${baseDir}) on http://127.0.0.1:${port}`));
