/* index1-5 · the client's own tuner settings baked in as defaults (2026-10-23: 「先改這設定」).
   presets/user-20261023.json is the panel's full 複製參數 JSON as pasted; presets/user-20261023.diff.json holds only the
   values that differed from the defaults at that moment (34, all in logoDrops), which is what is applied — so frame-tier
   values (camera, framing on phones) are not frozen to the desktop the JSON was copied on.
   Runs LAST among the main patches (build.cjs), so it wins over the helpers' own defaults. Newer presets: add a
   *.diff.json here; they apply in name order. */
const fs = require('fs'), path = require('path');
module.exports = ({ main, drops, letters, glass, html }) => {
  const dir = path.join(__dirname, 'presets');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.diff.json')).sort();
  let block = '';
  for (const f of files) {
    const preset = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    block += `      /* client preset ${f} */\n`;
    for (const [group, values] of Object.entries(preset)) block += `      if (CONFIG.${group}) Object.assign(CONFIG.${group}, ${JSON.stringify(values)});\n`;
  }
  const anchor = '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));';
  if (main.split(anchor).length !== 2) throw Error('user-preset anchor');
  main = main.replace(anchor, () => block + anchor);
  return { main, drops, letters, glass, html };
};
