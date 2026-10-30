/* Final visitor experience patches; scoped to index1-5, idempotent. */
const fs=require('node:fs'),path=require('node:path');
function patchMain(main) {

 const needle='portfolioNavPending = p > journey.max; if (portfolioNavPending) void loadPortfolio();';
 if(main.split(needle).length!==2)throw Error('visitor navigation anchor');
 if(!main.includes('/* VISITOR_NAVIGATION_EVENT */'))main=main.replace(needle,needle+'\n          /* VISITOR_NAVIGATION_EVENT */\n          window.dispatchEvent(new CustomEvent("finnovation:navigate", {detail:{target:journey.target}}));');
 if(!main.includes('/* EARLY_READING_MODE_GUARD */')) {
  main=main.replace('    async function startJourneyScene() {','    async function startJourneyScene() {\n      /* EARLY_READING_MODE_GUARD */\n      if (document.documentElement.dataset.renderMode === "text") return;');
  main=main.replace("      document.documentElement.dataset.renderMode = 'starting';","      if (document.documentElement.dataset.renderMode === 'text') return;\n      document.documentElement.dataset.renderMode = 'starting';");
  main=main.replace("if (event.key === 'Home') { event.preventDefault(); journey.target = 0; }","if (event.key === 'Home') { event.preventDefault(); journeyUI.root.querySelector('[data-chapter=\"0\"]')?.click(); }");
 }
 main=main.replace(/CONFIG\.logoSeal = (\{[^\n]+\});/, (all,json)=>{const value=JSON.parse(json);value.transition=0;return "CONFIG.logoSeal = "+JSON.stringify(value)+";";}); /* CONTINUOUS_LOGO_DEFAULT */
 if(!main.includes('/* READING_SCENE_DISPOSAL */')) {
  main=main.replace('        stopChapterPlayback();\n        world?.dispose(); portfolio?.dispose(); stopLettersPlay();','        stopChapterPlayback(); stopLettersPlay();');
  const anchor='        cancelAnimationFrame(resizeFrame); resizeFrame = 0;\n        stopChapterPlayback();';
  if(main.split(anchor).length!==2)throw Error('reading disposal anchor');
  main=main.replace(anchor,anchor+'\n        /* READING_SCENE_DISPOSAL */\n        world?.dispose(); portfolio?.dispose();');
 }
 return main;
}
function patchInterface(ui) {
 if(ui.includes('/* READING_MODE_AUDIO_CLEANUP */'))return ui;
 const needle="  soundButton.addEventListener('click',toggleSound);";
 if(ui.split(needle).length!==2)throw Error('visitor audio anchor');
 return ui.replace(needle,needle+'\n  /* READING_MODE_AUDIO_CLEANUP */\n  window.addEventListener("finnovation:text-mode",()=>{soundOn=false; audio?.close().catch(()=>{}); soundButton.setAttribute("aria-pressed","false");}, {once:true});');
}
function patchHTML(html) {
 if(!html.includes('data-i15-experience'))html=html.replace('</head>','  <link rel="stylesheet" href="prototypes/index1-5/experience.css?v=experience-20261030" data-i15-experience>\n  <script defer src="prototypes/index1-5/experience.js?v=experience-20261030"></script>\n</head>');
 if(!html.includes('class="fi-skip"'))html=html.replace('<body>','<body>\n  <button type="button" class="fi-skip" data-reading-mode>跳至文字閱讀</button>');
 html=html.replace(/(<div class="loader-note">)[^<]*(<\/div>)/,'$1準備水光之境 · FORMING THE CURRENT$2');
 if(!html.includes('class="loader-reading"'))html=html.replace(/(<div class="loader-note">[\s\S]*?<\/div>)/,'$1\n      <button class="loader-reading" type="button" data-reading-mode>文字閱讀 · READ WITHOUT MOTION</button>');
 if(!html.includes('class="fi-menu-reading"'))html=html.replace('<span>EXPLORE WITH PURPOSE</span>','<button class="fi-menu-reading" type="button" data-reading-mode>文字閱讀 · READING MODE</button>');
 if(!html.includes('class="fi-navigation-status"'))html=html.replace('  <!-- FINNOVATION_STATIC_UI_END -->','  <!-- FINNOVATION_STATIC_UI_END -->\n  <div class="fi-navigation-status" role="status" aria-live="polite" aria-atomic="true"><span></span><button type="button" data-reading-mode>文字閱讀</button></div>\n  <button type="button" class="fi-readable-return" data-resume-experience>回到互動體驗 · RETURN TO THE EXPERIENCE</button>');
 html=html.replace(/\s*<ul class="fiw-legal">[\s\S]*?<\/ul>/,'');
 const outro='<div class="fiw-outro">\n            <p class="fiw-outro-kicker" lang="en">FINANCE × INNOVATION</p>\n            <h2 class="fiw-outro-title" lang="en">Knowledge in flow.<span>Capital moving forward.</span></h2>\n            <p class="fiw-outro-copy">以知為本，以紀律守護長期價值。<br>讓知識、科技與資本相互連結，源遠流長。</p>\n            <div class="fiw-outro-links"><button type="button" data-world-go="principles">我們的理念 <span aria-hidden="true">↗</span></button><button type="button" data-world-go="responsibility">四大投資策略 <span aria-hidden="true">↗</span></button></div>\n          </div>\n';
 html=html.replace(/<div class="fiw-offices">[\s\S]*?(?=<div class="fiw-footer-line")/,outro+'          ');
 return html;
}
module.exports=state=>({...state,main:patchMain(state.main),html:patchHTML(state.html)});
module.exports.patchMain=patchMain;module.exports.patchHTML=patchHTML;

module.exports.patchInterface=patchInterface;
