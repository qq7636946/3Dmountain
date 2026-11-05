'use strict';
/* FLOW-only colour defaults. Updates the current generated files in place;
   avoids rebuilding unrelated scene/HTML work from the base page. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
function once(source,re,replace,label,count=1) {
  if ([...source.matchAll(re)].length!==count) throw Error('FLOW deep water: '+label+' anchor changed');
  return source.replace(re,replace);
}
function patchWorld(source) {
  const palette=JSON.parse(read('world-look.json'));
  return once(source,/const LOOK = \{[\s\S]*?\n\};/g,block=>{
    for(const [key,value] of Object.entries(palette)) {
      if(!/^#[0-9a-f]{6}$/i.test(value)) throw Error('Invalid globe colour: '+key);
      block=once(block,new RegExp('\\b'+key+": '#[0-9a-f]{6}'",'g'),key+": '"+value+"'",key);
    }
    return block;
  },'globe palette');
}
function patchOcean(source) {
  // One instanced draw still owns all birds and their shadows.
  return once(source,/const MAXG = \d+;/g,'const MAXG = 24;','gull capacity');
}
function patchGullControl(source) {
  return once(source,/(\["海鷗 數量","worldOcean","gulls",0,)\d+(,1\])/g,
    (_match,start,end)=>start+'24'+end,'gull control');
}
module.exports={patchWorld,patchOcean,patchGullControl};
if(require.main===module) {
  const root=path.resolve(__dirname,'../..'),htmlFile=path.join(root,'index1-5-flow.html');
  const preset=JSON.parse(read('look-preset.json'));
  const ocean=patchOcean(read('js/world-ocean.js'));
  let world=patchWorld(read('js/finnovation-world.js'));
  const hash=s=>'deep-water-'+crypto.createHash('sha256').update(s).digest('hex').slice(0,12);
  let main=read('js/main.js'),html=fs.readFileSync(htmlFile,'utf8');
  for(const group of ['worldOcean','logoLake','logoMark']) {
    main=once(main,new RegExp('Object\\.assign\\(CONFIG\\["'+group+'"\\] \\|\\|= \\{\\}, [^\\n]*\\);','g'),
      'Object.assign(CONFIG['+JSON.stringify(group)+'] ||= {}, '+JSON.stringify(preset[group])+');',group+' preset');
  }
  main=patchGullControl(main);
  world=once(world,/\.\/world-ocean\.js\?v=[^']+/g,'./world-ocean.js?v='+hash(ocean),'ocean import');
  main=once(main,/\.\/finnovation-world\.js\?v=[^']+/g,'./finnovation-world.js?v='+hash(world),'world import');
  html=once(html,/prototypes\/index1-5-flow\/js\/main\.js\?v=[^"\s]+/g,
    'prototypes/index1-5-flow/js/main.js?v='+hash(main),'main script/preload',2);
  // Validate all anchors before changing any generated output.
  fs.writeFileSync(path.join(__dirname,'js/world-ocean.js'),ocean);
  fs.writeFileSync(path.join(__dirname,'js/finnovation-world.js'),world);
  fs.writeFileSync(path.join(__dirname,'js/main.js'),main);
  fs.writeFileSync(htmlFile,html);
  console.log('Updated FLOW sea/globe defaults and dependent cache keys.');
}
