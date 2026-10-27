// Dry-run of prototypes/index1-5/build.cjs into an OVERLAY folder (nothing in the shared project is written).
//   node dryrun.cjs [--register] [--overlay .qa/index1-5/camera/overlay]      (VALLEY_CAMERA_DEV=0 → the new look is the default)
// --register applies, in memory only, the one-line registration of valley-scene-build.cjs that is later made in the real build.cjs.
// Serve the result with:  node scripts/logo-letters/overlay-server.cjs <root> 5641 <overlay>   and point the QA tools at it with I15_BASE=http://127.0.0.1:5641/
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..'), PROTO = path.join(ROOT, 'prototypes', 'index1-5');
const args = process.argv.slice(2), flag = k => args.includes('--' + k), val = (k, d) => args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : d;
const overlay = path.resolve(ROOT, val('overlay', '.qa/index1-5/camera/overlay'));
let code = fs.readFileSync(path.join(PROTO, 'build.cjs'), 'utf8');
if (flag('register')) code = applyRegistration(code);
function applyRegistration(text) {
  const must = (s, a, b) => { if (s.split(a).length !== 2) throw new Error('registration anchor: ' + a.slice(0, 80)); return s.replace(a, () => b); };
  if (text.includes("'valley-scene-build.cjs'")) return text;
  text = must(text, "'valley-polish-build.cjs','user-preset-build.cjs'", "'valley-polish-build.cjs','valley-scene-build.cjs','user-preset-build.cjs'");
  text = must(text, "({main,drops,letters,glass,html,extra});({main,drops,letters,glass,html}=r);", "({main,drops,letters,glass,html,extra,journey});({main,drops,letters,glass,html}=r);if(r.journey)journey=r.journey;");
  return text;
}
module.exports = { applyRegistration };
if (require.main === module) {
  const realWrite = fs.writeFileSync, written = [];
  const redirect = f => { const abs = path.resolve(String(f)); const rel = path.relative(ROOT, abs); if (rel.startsWith('prototypes' + path.sep + 'index1-5' + path.sep + 'js' + path.sep) || rel === 'index1-5.html') return path.join(overlay, rel); return null; };
  fs.writeFileSync = function (f, data, o) { const r = redirect(f); if (r) { fs.mkdirSync(path.dirname(r), { recursive: true }); written.push(path.relative(overlay, r)); return realWrite.call(fs, r, data, o); } return realWrite.apply(fs, arguments); };
  const m = new Module(path.join(PROTO, 'build.cjs'), null); m.filename = path.join(PROTO, 'build.cjs'); m.paths = Module._nodeModulePaths(PROTO);
  m._compile(code, m.filename);
  fs.writeFileSync = realWrite;
  console.log('dry-run wrote', written.length, 'files into', overlay);
}
