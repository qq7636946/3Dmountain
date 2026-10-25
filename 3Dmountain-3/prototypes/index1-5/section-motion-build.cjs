const fs=require('fs'),path=require('path'),crypto=require('crypto');
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8').replace(/\r\n/g,'\n');
function patchWorld(src,version=''){
 if(src.includes('SECTION_MOTION_HOOK'))return src;
 const once=(a,b)=>{if(src.split(a).length!==2)throw Error('Section motion world anchor: '+a);src=src.replace(a,()=>b);};
 once("import * as THREE from 'three';", "import * as THREE from 'three';\n/* SECTION_MOTION_HOOK */\nimport { createWorldSectionMotion } from './section-motion.js"+(version?'?v='+version:'')+"';");
 once("  /* GSAP's scroll reveals stay off the horizontal section (it reveals its chapters itself, by stop) */", "  const sectionMotion = createWorldSectionMotion({ root, reducedMotion });\n  /* GSAP's scroll reveals stay off the horizontal section (it reveals its chapters itself, by stop) */");
 once('    maxY = Math.max(1, content.offsetHeight - H);','    maxY = Math.max(1, content.offsetHeight - H);\n    sectionMotion.measure(W, H, top, { ocean: ocean?.state, logo: logo?.state });');
 once('    principles?.paint(s);','    principles?.paint(s);\n    sectionMotion.paint(s, y);');
 once('    principles?.close();','    sectionMotion.close();\n    principles?.close();');
 once('      if (disposed) return;\n      gsapCtx = gsap.context(', '      if (disposed || sectionMotion) return;\n      gsapCtx = gsap.context(');
 return src;
}
function patchUI(src,version=''){
 if(src.includes('JOURNEY_COPY_MOTION_HOOK'))return src;
 src="/* JOURNEY_COPY_MOTION_HOOK */\nimport { createJourneyCopyMotion } from './section-motion.js"+(version?'?v='+version:'')+"';\n"+src;
 const a="  const panels=[...root.querySelectorAll('.fi-copy-panel')];";
 if(src.split(a).length!==2)throw Error('Section motion UI panel anchor');
 src=src.replace(a,a+'\n  const copyMotion=createJourneyCopyMotion({root,reducedMotion});');
 const b='    const key=Math.max(0,Math.min(1,state.progress/state.max)).toFixed(4);';
 if(src.split(b).length!==2)throw Error('Section motion UI update anchor');
 return src.replace(b,'    copyMotion.update(state,thresholds,chapters,business);\n'+b);
}
function patchHTML(html){
 const v=crypto.createHash('sha256').update(read('section-motion.css')).digest('hex').slice(0,10);
 const link='<link rel="stylesheet" data-section-motion href="prototypes/index1-5/section-motion.css?v='+v+'">';
 return html.includes('data-section-motion')?html.replace(/<link[^>]*data-section-motion[^>]*>/,link):html.replace('</head>','  '+link+'\n</head>');
}
module.exports=({main,drops,letters,glass,html,extra})=>{
 extra['finnovation-world.js']=patchWorld(extra['finnovation-world.js']);
 extra['section-motion.js']=read('section-motion.js');
 return{main,drops,letters,glass,html:patchHTML(html),extra};
};
module.exports.patchWorld=patchWorld;module.exports.patchUI=patchUI;module.exports.patchHTML=patchHTML;
