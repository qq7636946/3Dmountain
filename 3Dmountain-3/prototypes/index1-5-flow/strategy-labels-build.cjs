'use strict';
/* FLOW-only placement patch. CLI updates only the current label module and
   its cache keys; it never rebuilds main or replaces HTML from a stale copy. */
function patchAlpine(source) {
  if (!source.includes('FLOW_SUMMIT_LABELS')) {
    const anchor="const sides = pin.side === 'up' ? ['up', 'right', 'left'] : [pin.side, 'up', pin.side === 'right' ? 'left' : 'right'];";
    if (source.split(anchor).length !== 2) throw Error('FLOW summit labels: placement anchor changed');
    source=source.replace(anchor,"const sides = ['up'];   /* FLOW_SUMMIT_LABELS: vertical leaders; same river search and occlusion rules. */");
  }
  if (source.includes('FLOW_STRATEGY_NUMBERS')) {
    const numbered = /    \/\* FLOW_STRATEGY_NUMBERS:[^\r\n]*\*\/\r?\n    const number = el\('span', 'alp-tag-index',[^\r\n]*\r?\n    number.setAttribute\('aria-hidden', 'true'\);\r?\n    tag.append\(number, line\);/g;
    if ([...source.matchAll(numbered)].length !== 1) throw Error('FLOW strategy labels: legacy number anchor changed');
    source=source.replace(numbered,'    tag.append(line);');
  }
  if (!source.includes('FLOW_WHITE_GLASS_LAYOUT')) {
    const fs=require('node:fs'),path=require('node:path');
    const layout=fs.readFileSync(path.join(__dirname,'strategy-glass-layout.part.js'),'utf8');
    const insert='/* ---------- loop ---------- */';
    if(source.split(insert).length!==2)throw Error('Flow white glass: layout hook changed');
    source=source.replace(insert,'/* FLOW_WHITE_GLASS_LAYOUT */\n'+layout+'\n'+insert);
    const hook='  for (const pin of pins) {\n    if (pin.kind === \'tag\' && !STRATEGY_IDS.has(id))';
    if(source.split(hook).length!==2)throw Error('Flow white glass: projected label hook changed');
    source=source.replace(hook,"  if (STRATEGY_IDS.has(id)) { layoutGlassStrategies(S, project, now, obstacles); return; }\n"+hook);
  }
  // The latest reference pairs a large number with a fine vertical divider.
  if (!source.includes("el('span','alp-tag-index'")) {
    const markup='    tag.append(line);';
    if(source.split(markup).length!==2)throw Error('Flow numbered labels: markup anchor changed');
    source=source.replace(markup,"    const number = el('span','alp-tag-index',String(PATHS.indexOf(opts.id)+1).padStart(2,'0'));\n    number.setAttribute('aria-hidden','true');\n    tag.append(number,line);");
  }
  return source;
}
module.exports = { patchAlpine };
if (require.main === module) {
  const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
  const root=path.resolve(__dirname,'../..'),file=path.join(__dirname,'js/alpine-ui.js'),htmlFile=path.join(root,'index1-5-flow.html');
  const ui=patchAlpine(fs.readFileSync(file,'utf8'));
  let html=fs.readFileSync(htmlFile,'utf8');
  const tag=s=>'peak-labels-'+crypto.createHash('sha256').update(s).digest('hex').slice(0,12);
  for(const [asset,version] of [
    ['strategy-labels.css',tag(fs.readFileSync(path.join(__dirname,'strategy-labels.css')))],
    ['js/alpine-ui.js',tag(ui)]
  ]) {
    const needle='prototypes/index1-5-flow/'+asset;
    const re=new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\?v=[^"\\s]+','g');
    if ([...html.matchAll(re)].length!==1) throw Error('FLOW summit labels: HTML asset anchor '+asset);
    html=html.replace(re,needle+'?v='+version);
  }
  fs.writeFileSync(file,ui);fs.writeFileSync(htmlFile,html);
  console.log('Updated FLOW label module and its two cache keys; main scene was not rebuilt.');
}
