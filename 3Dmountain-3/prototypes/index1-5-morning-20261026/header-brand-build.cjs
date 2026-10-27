/* Header branding only. Use the client's logo2.svg artwork; the lake's 3D
   symbol and its parameters are separate and must not be changed here. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
function removeHeaderExplore(source){
 const button=/<button\b[^>]*\bclass="fi-explore"[^>]*>[\s\S]*?<\/button>/g;
 if((source.match(button)||[]).length>1)throw Error('Header Explore anchor is ambiguous');
 return source.replace(button,'');
}
function artwork(){
 let svg=fs.readFileSync(path.join(root,'logo2.svg'),'utf8');
 svg=svg.slice(svg.indexOf('<svg')).replace(/<!--[^]*?-->/g,'');
 svg=svg.replace(/<svg\b[^>]*>/, '<svg class="fi-brand-art" data-source="logo2.svg" viewBox="75 150 650 500" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" focusable="false">');
 // Keep the original paths and blue gradients. Neutral artwork inherits the
 // header's existing light/dark ink so it stays legible in every chapter.
 svg=svg.replace(/\.st([0-9]+)/g,'.fb2-st$1').replace(/class="st([0-9]+)"/g,'class="fb2-st$1"');
 svg=svg.replace(/(\.fb2-st1\s*\{\s*fill:)\s*[^;]+;/,'$1 currentColor;');
 svg=svg.replace(/id="([^"]+)"/g,'id="fb2-$1"').replace(/url\(#([^\)]+)\)/g,'url(#fb2-$1)').replace(/xlink:href="#([^"]+)"/g,'xlink:href="#fb2-$1"');
 return svg;
}
function header(source,logo){
 let out=source.replace(/<header class="fi-header"(?: data-header-logo2)?\s*>/,'<header class="fi-header" data-header-logo2>');
 out=out.replace(/\s*<p class="fi-brand-context"[^>]*>[\s\S]*?<\/p>/,'');
 const re=/<a\b([^>]*class="fi-brand(?: fi-brand-logo2)?"[^>]*)>[\s\S]*?<\/a>/;
 let count=0;
 out=out.replace(re,(m,attrs)=>{count++;return '<p class="fi-brand-context" lang="en">KNOWLEDGE IN FLOW.<br><span>CAPITAL MOVING FORWARD.</span></p>\n      <a'+attrs.replace('class="fi-brand"','class="fi-brand fi-brand-logo2"')+'>'+logo+'</a>';});
 if(count!==1)throw Error('Header brand anchor: '+count);
 return removeHeaderExplore(out);
}
module.exports=({html,ui})=>{
 const logo=artwork();
 html=header(html,logo);
 ui=ui.replace(/^const logo = (?:'[^\n]+'|"(?:[^"\\]|\\.)*");/m,()=> 'const logo = '+JSON.stringify(logo)+';');
 ui=header(ui,'${logo}');
 const css=fs.readFileSync(path.join(__dirname,'header-brand.css'));
 const href='prototypes/index1-5-morning-20261026/header-brand.css?v='+crypto.createHash('md5').update(css).digest('hex').slice(0,10);
 if(html.includes('data-header-brand'))html=html.replace(/<link[^>]*data-header-brand[^>]*>/,'<link rel="stylesheet" data-header-brand href="'+href+'">');
 else html=html.replace('</head>','  <link rel="stylesheet" data-header-brand href="'+href+'">\n</head>');
 return {html,ui};
};
module.exports.removeHeaderExplore=removeHeaderExplore;
