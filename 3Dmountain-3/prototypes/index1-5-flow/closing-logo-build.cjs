'use strict';
/* Restore the original lake/mark after the globe, on the sky leg only. */
function patchWorld(source) {
  if(source.includes('FLOW_CLOSING_LOGO'))return source;
  const once=(anchor,replacement)=>{
    if(source.split(anchor).length!==2)throw Error('Flow closing logo: '+anchor.slice(0,90));
    source=source.replace(anchor,()=>replacement);
  };
  const disabled="  const logo = ocean && document.documentElement.dataset.siteSections !== 'five' ? createWorldLogo({";
  const enabled='  const logo = ocean ? createWorldLogo({';
  once(source.includes(disabled)?disabled:enabled,'  /* FLOW_CLOSING_LOGO: original closing scene, following the globe. */\n'+enabled);
  once('    logo?.shape(o, yy);',"    if (leg === 'sky') logo?.shape(o, yy);");
  once('l: logo ? logo.sample(yy) : null',"l: logo && leg === 'sky' ? logo.sample(yy) : null");
  once('const logoDrawn = logo ? logo.render(s, time,',"const logoDrawn = logo && leg === 'sky' ? logo.render(s, time,");
  once('    logo?.paint(s);',"    if (leg === 'sky') logo?.paint(s);");
  once("get y() { return y; },","get y() { return y; }, get endY() { return maxY; },");
  return source;
}
function patchHTML(html) {
  let count=0;
  html=html.replace(/<section\b[^>]*\bid="logo-seal"[^>]*>/g,tag=>{count++;return tag.replace(/\s+hidden\b/g,'');});
  if(count!==1)throw Error('Flow closing logo: missing original markup');
  return html;
}
module.exports={patchWorld,patchHTML};
