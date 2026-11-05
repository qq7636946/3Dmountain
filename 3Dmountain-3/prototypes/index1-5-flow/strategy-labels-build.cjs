'use strict';
/* FLOW-only placement patch. CLI updates only the current label module and
   its cache keys; it never rebuilds main or replaces HTML from a stale copy. */
function patchAlpine(source) {
  if (!source.includes('FLOW_SUMMIT_LABELS')) {
    const anchor="const sides = pin.side === 'up' ? ['up', 'right', 'left'] : [pin.side, 'up', pin.side === 'right' ? 'left' : 'right'];";
    if (source.split(anchor).length !== 2) throw Error('FLOW summit labels: placement anchor changed');
    source=source.replace(anchor,"const sides = ['up'];   /* FLOW_SUMMIT_LABELS: vertical leaders; same river search and occlusion rules. */");
  }
  if (!source.includes('FLOW_STRATEGY_NUMBERS')) {
    const anchor='    tag.append(line);';
    if (source.split(anchor).length !== 2) throw Error('FLOW summit labels: number anchor changed');
    source=source.replace(anchor,`    /* FLOW_STRATEGY_NUMBERS: measured with the label so collision checks include the outlined number. */
    const number = el('span', 'alp-tag-index', String(PATHS.indexOf(opts.id) + 1).padStart(2, '0'));
    number.setAttribute('aria-hidden', 'true');
    tag.append(number, line);`);
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
