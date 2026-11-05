'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
function artwork(){
  let svg=fs.readFileSync(path.join(root,'logo3.svg'),'utf8');
  svg=svg.slice(svg.indexOf('<svg')).replace(/<!--[\s\S]*?-->/g,'').replace(/<title>[\s\S]*?<\/title>/g,'');
  svg=svg.replace(/<svg\b[^>]*>/,'<svg class="gate-brand-art" data-source="logo3.svg" viewBox="70 295 645 190" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" focusable="false">');
  svg=svg.replace(/\.cls-(\d+)/g,'.gb3-cls-$1').replace(/class="cls-(\d+)"/g,'class="gb3-cls-$1"');
  svg=svg.replace(/(\.gb3-cls-2\s*\{\s*fill:)\s*[^;}]+/,'$1currentColor');
  svg=svg.replace(/id="([^"]+)"/g,'id="gate-logo-$1"').replace(/url\(#([^\)]+)\)/g,'url(#gate-logo-$1)').replace(/xlink:href="#([^"]+)"/g,'xlink:href="#gate-logo-$1"');
  return svg.replace(/[ \t]+$/gm,'');
}
function patchHTML(html){
  const pattern=/(<div\b[^>]*\bid="gateBrand"[^>]*>)[\s\S]*?(<\/div>)/g;
  if([...html.matchAll(pattern)].length!==1)throw Error('Loading logo: expected one gate brand');
  html=html.replace(pattern,(_m,a,b)=>a+artwork()+'<span class="gate-brand-sr">恒灝創新 FINNOVATION</span>'+b);
  html=html.replace(/\s*<link\b[^>]*\bdata-gate-brand-style\b[^>]*>/g,'');
  const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'gate-brand.css'))).digest('hex').slice(0,12);
  return html.replace('</head>',`  <link rel="stylesheet" href="prototypes/index1-5-flow/gate-brand.css?v=${hash}" data-gate-brand-style>\n</head>`);
}
module.exports={patchHTML};
if(require.main===module){
  const target=path.join(root,'index1-5-flow.html');
  fs.writeFileSync(target,patchHTML(fs.readFileSync(target,'utf8')));
  console.log('Updated Loading header with the approved logo3.svg artwork.');
}
