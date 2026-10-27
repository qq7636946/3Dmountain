'use strict';
/* frozen-server.cjs — serves the PRE-OPTIMISATION index1-5 (the frozen before-state) next to the live tree, for parity baselines.
   index1-5.html and prototypes/index1-5/** come from a snapshot folder (default: the 2026-10-25 23:30 backup); every other path
   (shared js/, css/, images/, media/, models/, …) comes from the project root, which the snapshot was verified not to differ on.
   Why: build.cjs reads and rewrites index1-5.html and re-applies helper patches on top of the previous output, so switching a
   helper off does not restore the old page. A snapshot served on its own port never changes under a build.

   Usage: node scripts/index1-5/frozen-server.cjs [--port 5622] [--snapshot "<folder>"]
   Then point the QA tools at it:  set I15_BASE=http://127.0.0.1:5622/   (cmd)   or   I15_BASE=http://127.0.0.1:5622/ node …  (bash)
   Exit: runs until killed. */
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_SNAPSHOT = path.join(ROOT, '_archive', 'backups', 'index1-5-perf-before-20261025-20261025-2330');
const args = process.argv.slice(2);
const arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const port = Number(arg('--port')) || 5622;
const SNAP = path.resolve(arg('--snapshot') || DEFAULT_SNAPSHOT);
if (!fs.existsSync(path.join(SNAP, 'index1-5.html'))) { console.error('no index1-5.html in snapshot ' + SNAP); process.exit(2); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream', '.ktx2': 'application/octet-stream', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.wasm': 'application/wasm' };

function resolveFile(urlPath) {
  const rel = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '') || 'index1-5.html';
  const frozen = rel === 'index1-5.html' || rel.startsWith('prototypes/index1-5/');
  const base = frozen ? SNAP : ROOT;
  const file = path.resolve(base, rel);
  if (!file.startsWith(base + path.sep) && file !== base) return null;      // no traversal out of the folder
  return file;
}

http.createServer((req, res) => {
  const file = resolveFile(req.url || '/');
  if (!file) { res.writeHead(403).end('forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found: ' + req.url); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log(`frozen before-state on http://127.0.0.1:${port}/  (snapshot ${SNAP})`));
