// node compare.cjs <baseline.json> <candidate.json> [--md out.md]
const fs = require('node:fs');
const [a, b] = [process.argv[2], process.argv[3]].map(p => JSON.parse(fs.readFileSync(p, 'utf8')));
const mdIdx = process.argv.indexOf('--md');
const f = (x, d = 2) => x === null || x === undefined ? 'n/a' : (Math.round(x * 10 ** d) / 10 ** d).toString();
const delta = (x, y, unit = '', d = 1) => {
  if (x === null || y === null || x === undefined || y === undefined) return 'n/a';
  if (x === 0 && y === 0) return '0';
  const p = x === 0 ? Infinity : (y - x) / x * 100;
  return `${y - x >= 0 ? '+' : ''}${f(y - x, d)}${unit} (${p >= 0 ? '+' : ''}${f(p, 0)}%)`;
};
function px(t1, t2) {
  const A = Buffer.from(t1.b64, 'base64'), B = Buffer.from(t2.b64, 'base64');
  if (A.length !== B.length) return { err: 'size mismatch' };
  let sum = 0, max = 0, over8 = 0, over24 = 0, se = 0, n = 0;
  for (let i = 0; i < A.length; i += 4) {
    let m = 0;
    for (let c = 0; c < 3; c++) { const d = Math.abs(A[i + c] - B[i + c]); sum += d; se += d * d; if (d > m) m = d; }
    if (m > max) max = m; if (m > 8) over8++; if (m > 24) over24++; n++;
  }
  const mse = se / (n * 3);
  return { mad: sum / (n * 3), max, over8: over8 / n * 100, over24: over24 / n * 100, psnr: mse === 0 ? Infinity : 10 * Math.log10(255 * 255 / mse) };
}
const lines = [];
const out = s => { lines.push(s); console.log(s); };
out(`### ${a.label} → ${b.label}  (profile ${a.profile}/${b.profile}, canvas ${Object.values(a.scenarios)[0]?.canvas?.w}×${Object.values(a.scenarios)[0]?.canvas?.h} → ${Object.values(b.scenarios)[0]?.canvas?.w}×${Object.values(b.scenarios)[0]?.canvas?.h}, GPU ${a.gpu})`);
out('');
out('| scenario | draw calls | triangles | CPU ms | drain ms | GPU ms | alloc KB/frame | GC/frames |');
out('|---|---|---|---|---|---|---|---|');
for (const name of Object.keys(a.scenarios)) {
  const x = a.scenarios[name], y = b.scenarios[name];
  if (!y) continue;
  out(`| ${name} | ${x.counts.calls} → ${y.counts.calls} | ${x.counts.triangles} → ${y.counts.triangles} | ${f(x.cpuStat.median)} → ${f(y.cpuStat.median)} | ${f(x.wallStat.median)} → ${f(y.wallStat.median)} | ${f(x.gpuStat?.median)} → ${f(y.gpuStat?.median)} (${delta(x.gpuStat?.median, y.gpuStat?.median, '', 2)}) | ${f(x.allocKBPerFrame, 1)} → ${f(y.allocKBPerFrame, 1)} | ${x.gcs} → ${y.gcs} |`);
}
out('');
out('| scenario | mean abs diff (0-255) | max | px>8 % | px>24 % | PSNR dB |');
out('|---|---|---|---|---|---|');
for (const name of Object.keys(a.scenarios)) {
  const x = a.scenarios[name], y = b.scenarios[name];
  if (!y) continue;
  const d = px(x.thumb, y.thumb);
  out(d.err ? `| ${name} | ${d.err} |||||` : `| ${name} | ${f(d.mad, 3)} | ${d.max} | ${f(d.over8, 2)} | ${f(d.over24, 2)} | ${d.psnr === Infinity ? '∞ (identical)' : f(d.psnr, 1)} |`);
}
if (a.memAfterBoot && b.memAfterBoot) { out(''); out(`memory after boot: ${JSON.stringify(a.memAfterBoot)} → ${JSON.stringify(b.memAfterBoot)}`); }
if (a.readyMs && b.readyMs) out(`time-to-ready (cold, local+CDN): ${a.readyMs} ms → ${b.readyMs} ms`);
if (a.console || b.console) out(`console errors: ${a.console?.errors?.length ?? '?'} → ${b.console?.errors?.length ?? '?'}  pageErrors: ${a.console?.pageErrors?.length ?? '?'} → ${b.console?.pageErrors?.length ?? '?'}`);
if (mdIdx > 0) fs.writeFileSync(process.argv[mdIdx + 1], lines.join('\n'));
