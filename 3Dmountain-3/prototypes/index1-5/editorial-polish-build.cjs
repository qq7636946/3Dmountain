/* Compatibility name for the page's final CSS build. Does not rebuild WebGL. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const patch = require('./site-styles-build.cjs');
module.exports = patch;
if (require.main === module) {
  const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
  const worldFile = path.join(__dirname, 'js/finnovation-world.js');
  const worldBefore = fs.readFileSync(worldFile, 'utf8');
  const world = patch.patchWorld(worldBefore);
  if (world !== worldBefore) fs.writeFileSync(worldFile, world);
  // Refresh dependency URLs only; animation logic and presets stay as-is.
  const mainFile = path.join(__dirname, 'js/main.js');
  const mainBefore = fs.readFileSync(mainFile, 'utf8');
  let main = mainBefore;
  main = main.replace(/\.\/finnovation-world\.js(?:\?[^"']*)?/g,
    './finnovation-world.js?v=ui-' + hash(world));
  if (main !== mainBefore) fs.writeFileSync(mainFile, main);
  const file = path.resolve(__dirname, '../../index1-5.html');
  let html = patch({ html: fs.readFileSync(file, 'utf8') }).html;
  html = html.replace(/prototypes\/index1-5\/js\/main\.js(?:\?[^"']*)?/g, url => {
    const clean = url.replace(/([?&])ui-style=[^&]+/g, '').replace(/[?&]$/, '');
    return clean + (clean.includes('?') ? '&' : '?') + 'ui-style=' + hash(main);
  });
  if (patch({ html }).html !== html) throw new Error('Unified CSS links must be idempotent');
  for (const marker of ['data-i15-layout', 'data-i15-typography', 'data-i15-font']) {
    if ((html.match(new RegExp(marker, 'g')) || []).length !== 1) throw new Error('Duplicate/missing ' + marker);
  }
  fs.writeFileSync(file, html);
  console.log('index1-5: one layout bundle, one typography source, one DM Sans preload.');
}
