// Compare the river-light / mountain-tone settings of the current main.js, the archived 1010_bk/index.html, and the
// values in the user's screenshots.   node config-compare.cjs
const fs = require('node:fs');
const P = 'G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3/';
const SOURCES = { now: P + 'js/main.js', bk: P + '_archive/backups/1010_bk/index.html' };
const WANT = {
  'watershedFlow.count': 5, 'watershedFlow.width': .010, 'watershedFlow.brightness': .90, 'watershedFlow.speed': .90, 'watershedFlow.glow': .50,
  'watershedFlow.color': '#196f9a', 'watershedFlow.mist': 1.50, 'watershedFlow.core': 1.00, 'watershedFlow.halo': 1.50, 'watershedFlow.pulse': 1.50,
  'watershedFlow.sparkle': 1.50, 'watershedFlow.join': 1.25, 'watershedFlow.meander': 1.50, 'watershedFlow.depth': 1.00, 'watershedFlow.headSize': 5.00,
  'watershedFlow.headBright': 3.45, 'watershedFlow.headGlow': 2.35, 'watershedFlow.headWidth': .30, 'watershedFlow.tail': .40, 'watershedFlow.spacing': 1.45,
  'watershedStyle.exposure': 1.00, 'watershedStyle.haze': 1.00, 'watershedStyle.relief': 1.00, 'watershedStyle.rockColor': '#bdd3e5',
  'watershedStyle.skyColor': '#cdd9e5', 'watershedStyle.mistColor': '#ffffff', 'shoreline.crease': 2.50, 'shoreline.frost': .45,
  'relief.ridgeFrost': 2.00, 'relief.layers': .45, 'watershedWater.base': '#699fce', 'watershedWater.highlight': '#b4bec5', 'watershedWater.reflection': .25
};
// the first object literal after "<group>: {" (balanced braces), its top-level "key: value" pairs
function group(src, name) {
  const re = new RegExp('[\\s,{]' + name + '\\s*:\\s*\\{', 'g'); const found = [];
  let m; while ((m = re.exec(src))) {
    let i = m.index + m[0].length, depth = 1; const start = i;
    while (i < src.length && depth) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
    const body = src.slice(start, i - 1).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const out = {}; let d = 0, key = null, buf = '';
    for (const part of body.split(/(,|\{|\}|\[|\])/)) {
      if (part === '{' || part === '[') d++; if (part === '}' || part === ']') d--;
      if (part === ',' && d === 0) { if (key) out[key] = buf.trim(); key = null; buf = ''; continue; }
      if (!key && d === 0) { const kv = part.match(/^\s*([A-Za-z_]\w*)\s*:\s*([\s\S]*)$/); if (kv) { key = kv[1]; buf = kv[2]; continue; } }
      if (key) buf += part;
    }
    if (key) out[key] = buf.trim();
    found.push(out);
  }
  return found;
}
const groups = ['watershedFlow', 'watershedStyle', 'shoreline', 'relief', 'watershedWater'];
const table = {};
for (const [tag, file] of Object.entries(SOURCES)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const g of groups) {
    const all = group(src, g);
    const pick = all.find(o => Object.keys(o).length > 3) ?? all[0] ?? {};
    for (const [k, v] of Object.entries(pick)) (table[g + '.' + k] ??= {})[tag] = v.replace(/\s+/g, ' ').slice(0, 40);
    (table['#' + g] ??= {})[tag] = all.length + ' literal(s)';
  }
}
const norm = v => v === undefined ? undefined : String(v).replace(/['"]/g, '').replace(/^0\./, '.').replace(/^(-?)0\./, '$1.').toLowerCase();
const num = v => { const n = Number(String(v).replace(/['"]/g, '')); return Number.isFinite(n) ? n : null; };
console.log('key'.padEnd(28), 'screenshot'.padEnd(11), 'now(main.js)'.padEnd(14), '1010_bk'.padEnd(14), 'same?');
for (const key of Object.keys(WANT)) {
  const w = WANT[key], now = table[key]?.now, bk = table[key]?.bk;
  const eq = (a, b) => a !== undefined && (num(a) !== null && typeof b === 'number' ? Math.abs(num(a) - b) < 1e-6 : norm(a) === norm(b));
  console.log(key.padEnd(28), String(w).padEnd(11), String(now).padEnd(14), String(bk).padEnd(14), (eq(now, w) ? 'now=shot ' : '') + (eq(bk, w) ? 'bk=shot' : ''));
}
for (const g of groups) console.log('#' + g, JSON.stringify(table['#' + g]));
