/* Header branding only. Use the client's logo3.svg artwork; the lake's 3D
   symbol and its parameters are separate and must not be changed here. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
function removeHeaderExplore(source){
 const button=/<button\b[^>]*\bclass="fi-explore"[^>]*>[\s\S]*?<\/button>/g;
 if((source.match(button)||[]).length>1)throw Error('Header Explore anchor is ambiguous');
 return source.replace(button,'');
}
function artwork(){
 let svg=fs.readFileSync(path.join(root,'logo3.svg'),'utf8');
 svg=svg.slice(svg.indexOf('<svg')).replace(/<!--[^]*?-->/g,'');
 svg=svg.replace(/<svg\b[^>]*>/, '<svg class="fi-brand-art" data-source="logo3.svg" viewBox="70 295 645 190" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" focusable="false">');
 svg=svg.replace(/<title>[\s\S]*?<\/title>/g,'');
 // Keep the original paths and blue gradients. Neutral artwork inherits the
 // header's existing light/dark ink so it stays legible in every chapter.
 svg=svg.replace(/\.cls-([0-9]+)/g,'.fb3-cls-$1').replace(/class="cls-([0-9]+)"/g,'class="fb3-cls-$1"');
 svg=svg.replace(/(\.fb3-cls-2\s*\{\s*fill:)\s*[^;}]+/,'$1currentColor');
 svg=svg.replace(/id="([^"]+)"/g,'id="fb3-$1"').replace(/url\(#([^\)]+)\)/g,'url(#fb3-$1)').replace(/xlink:href="#([^"]+)"/g,'xlink:href="#fb3-$1"');
 return svg;
}
function header(source,logo){
 let out=source.replace(/<header class="fi-header"(?: data-header-logo[23])?\s*>/,'<header class="fi-header" data-header-logo3>');
 out=out.replace(/\s*<p class="fi-brand-context"[^>]*>[\s\S]*?<\/p>/,'');
 const re=/<a\b([^>]*class="fi-brand(?: fi-brand-logo[23])?"[^>]*)>[\s\S]*?<\/a>/;
 let count=0;
 out=out.replace(re,(m,attrs)=>{count++;return '<a'+attrs.replace(/class="fi-brand(?: fi-brand-logo[23])?"/,'class="fi-brand fi-brand-logo3"')+'>'+logo+'</a>';});
 if(count!==1)throw Error('Header brand anchor: '+count);
 return removeHeaderExplore(out);
}
module.exports=({html,ui})=>{
 const logo=artwork();
 html=header(html,logo);
 ui=ui.replace(/^const logo = (?:'[^\n]+'|"(?:[^"\\]|\\.)*");/m,()=> 'const logo = '+JSON.stringify(logo)+';');
 ui=header(ui,'${logo}');
 const css=fs.readFileSync(path.join(__dirname,'header-brand.css'));
 const href='prototypes/index1-5/header-brand.css?v='+crypto.createHash('md5').update(css).digest('hex').slice(0,10);
 if(html.includes('data-header-brand'))html=html.replace(/<link[^>]*data-header-brand[^>]*>/,'<link rel="stylesheet" data-header-brand href="'+href+'">');
 else html=html.replace('</head>','  <link rel="stylesheet" data-header-brand href="'+href+'">\n</head>');
 return {html,ui};
};
module.exports.removeHeaderExplore=removeHeaderExplore;
