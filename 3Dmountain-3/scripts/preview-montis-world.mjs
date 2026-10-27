import http from 'node:http';
import fs from 'node:fs/promises';
const entry = new URL('../overworld-montis.html', import.meta.url);
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (!['GET', 'HEAD'].includes(request.method) || !['/', '/overworld-montis.html'].includes(url.pathname)) {
    response.writeHead(404); response.end('Not found'); return;
  }
  try {
    const body = await fs.readFile(entry);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500); response.end('The preview is unavailable.');
  }
});
server.listen(0, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${server.address().port}/overworld-montis.html`));
