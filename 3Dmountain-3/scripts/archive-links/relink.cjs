// Re-point the local references of the HTML pages in _archive/backups/1010_bk at where the files are now.
// The pages were written when they stood in the project root; the restructure (docs/restructure-manifest.json) moved
// what they point at, and moved the pages themselves three folders down. Nothing is moved here: only the references
// inside the pages are rewritten, byte for byte otherwise (the files are handled as latin1, so encoding and line
// endings are untouched).
//   node relink.cjs            report only
//   node relink.cjs --yes      write (originals must already be backed up; see backup.cjs)
const fs = require('node:fs'), path = require('node:path');
const P = 'G:/我的雲端硬碟/2026_專案資料夾/2607_恒灝/site/3Dmountain-3';
const DIR = '_archive/backups/1010_bk', UP = '../../../';
const YES = process.argv.includes('--yes'), VERBOSE = process.argv.includes('--verbose');
// --out <root>: write the rewritten pages under that root instead (a staging overlay), leaving the project alone
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const SHIM = fs.readFileSync(path.join(__dirname, 'shim.html'), 'utf8').trim();
const SHIM_BLOCK = /\r?\n<script data-1010-bk-paths>[\s\S]*?<\/script>/;
const NEEDS_SHIM = /(?:js\/water-logo-cards\.js|js\/water-logo-drops\.js|legacy-js\/slide\.js|legacy-js\/index6-scene\.js|legacy-js\/index6-logo\.js)(?:[?#]|$)/;
const manifest = JSON.parse(fs.readFileSync(path.join(P, 'docs/restructure-manifest.json'), 'utf8'));
const moves = manifest.moves.map(m => [m.from, m.to]).sort((a, b) => b[0].length - a[0].length);
const exists = rel => { try { fs.accessSync(path.join(P, rel)); return true; } catch { return false; } };
const isDir = rel => { try { return fs.statSync(path.join(P, rel)).isDirectory(); } catch { return false; } };
// where a path that used to be relative to the project root is now (still relative to the root)
function moved(old) {
  for (const [from, to] of moves) {
    if (old === from) return to;
    if (old.startsWith(from + '/')) return to + old.slice(from.length);
  }
  return old;
}
const EXT = 'js|mjs|cjs|css|png|jpe?g|webp|avif|gif|svg|ico|gltf|glb|bin|mp4|webm|mov|mp3|wav|ogg|hdr|exr|json|woff2?|ttf|otf|ktx2|basis|wasm|html?|md|txt|xml|webmanifest|zip|fbx|obj|mtl';
const FILE = new RegExp('^(?:\\.{1,2}/)*[^\\s\'"`<>|*?#:\\\\${}()]+\\.(?:' + EXT + ')(?:[?#][^\\s\'"`<>]*)?$', 'i');
const FOLDER = /^(?:\.{1,2}\/)*[A-Za-z0-9_\-.][A-Za-z0-9_\-./ ]*\/$/;
// every string that could be a reference: quoted literals, and url(...) without quotes
const LITERAL = /(["'`])((?:(?!\1)[^\\\r\n]){1,400})\1|url\(\s*([^'"`)\s][^)\s]*)\s*\)/g;

const report = [];
for (const name of fs.readdirSync(path.join(P, DIR)).filter(f => /\.html?$/i.test(f)).sort()) {
  const file = path.join(P, DIR, name);
  const original = fs.readFileSync(file, 'latin1');
  const dec = s => Buffer.from(s, 'latin1').toString('utf8'), enc = s => Buffer.from(s, 'utf8').toString('latin1');
  // (a shim put in by an earlier run is taken out first, so its own path strings are not read as the page's)
  const src = original.replace(SHIM_BLOCK, '');
  const seen = new Map();   // original reference -> { to, why, count }
  const out = src.replace(LITERAL, (whole, quote, quoted, bare, at) => {
    const raw = quoted ?? bare; if (raw === undefined) return whole;
    const ref = dec(raw);
    if (/^(?:[a-z][a-z0-9+.\-]*:|\/\/|\/|#|\?)/i.test(ref)) return whole;          // absolute, protocol, data:, root-absolute, fragment
    if (ref.startsWith(UP)) return whole;                                           // already pointed up out of the archive
    const folder = FOLDER.test(ref) && !FILE.test(ref);
    if (!folder && !FILE.test(ref)) return whole;
    const cut = ref.search(/[?#]/), tail = cut < 0 ? '' : ref.slice(cut), bareRef = cut < 0 ? ref : ref.slice(0, cut);
    const lead = bareRef.match(/^(?:\.\/)+/)?.[0] ?? '';
    let old; try { old = decodeURI(bareRef.slice(lead.length)); } catch { old = bareRef.slice(lead.length); }
    if (old.startsWith('../')) { note(ref, null, 'points above the old root: left alone'); return whole; }
    const trimmed = old.replace(/\/$/, '');
    if (!trimmed || trimmed === '.' ) return whole;
    // a folder literal only counts if it names something that is, or was, a folder of the project
    const now = moved(trimmed), here = path.posix.join(DIR, trimmed);
    if (folder && !(isDir(now) || isDir(trimmed) || isDir(here))) return whole;
    if (!folder && exists(here) && !isDir(here)) { note(ref, null, 'a file beside the page: left alone'); return whole; }
    if (!exists(now)) {
      if (/^three\//.test(trimmed)) return whole;   // an import-map name, not a path
      // not a module specifier or a path at all, most likely (a word with a dot in it) — only report the plausible ones
      if (/[\/]/.test(trimmed) || /\.(?:js|css|png|jpe?g|svg|gltf|glb|mp4|webp|html?)$/i.test(trimmed)) note(ref, null, 'NOT FOUND anywhere in the project');
      return whole;
    }
    const to = UP + encodeSpaces(now) + (folder ? '/' : '') + tail;
    note(ref, to, now === trimmed ? 'not moved, but the page was' : 'moved by the restructure');
    return quoted !== undefined ? quote + enc(to) + quote : whole.replace(raw, enc(to));
  });
  function note(ref, to, why) { const k = ref; const r = seen.get(k) ?? { to, why, count: 0 }; r.count++; seen.set(k, r); }
  function encodeSpaces(s) { return s; }
  const changed = [...seen].filter(([, r]) => r.to), missing = [...seen].filter(([, r]) => /NOT FOUND/.test(r.why));
  report.push({ name, bytes: src.length, changed: changed.length, places: changed.reduce((n, [, r]) => n + r.count, 0), missing: missing.map(([k]) => k), left: [...seen].filter(([, r]) => !r.to && !/NOT FOUND/.test(r.why)).map(([k, r]) => k + '  (' + r.why + ')') });
  if (VERBOSE) { console.log('\n== ' + name); for (const [k, r] of seen) console.log('  ' + (r.to ? k + '  ->  ' + r.to : k + '   [' + r.why + ']') + (r.count > 1 ? '  ×' + r.count : '')); }
  // The pages that load one of the modules which fetch pictures by a path relative to the PAGE (the shared logo cards
  // and drops; the archived slide and index6 scripts) get the shim: a link in the page cannot reach those.
  const shimmed = [...seen.values()].some(r => r.to && NEEDS_SHIM.test(r.to));
  let final = out;
  if (shimmed) {
    const eol = /\r\n/.test(out) ? '\r\n' : '\n', block = enc(SHIM.replace(/\r?\n/g, eol));
    const charset = /<meta\s+charset=[^>]*>/i.exec(out), head = /<head[^>]*>/i.exec(out), anchor = charset ?? head;
    if (!anchor) throw new Error(name + ': nowhere to put the shim');
    const at = anchor.index + anchor[0].length;
    final = out.slice(0, at) + eol + block + out.slice(at);
  }
  report[report.length - 1].shim = shimmed;
  if (OUT) { fs.mkdirSync(path.join(OUT, DIR), { recursive: true }); fs.writeFileSync(path.join(OUT, DIR, name), final, 'latin1'); }
  else if (YES && final !== original) fs.writeFileSync(file, final, 'latin1');
}
for (const r of report) console.log(r.name.padEnd(22), String(r.changed).padStart(3) + ' refs / ' + String(r.places).padStart(3) + ' places', r.shim ? '+ shim' : '      ', r.missing.length ? '| missing: ' + r.missing.join(', ') : '');
if (process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(report, null, 1));
console.log(YES ? '\nwritten.' : '\ndry run. --yes to write, --verbose for every reference.');
