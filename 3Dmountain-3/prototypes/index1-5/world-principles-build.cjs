/* Insert the editorial principles chapter after the horizontal strategies. */
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cards=[
 ['RESEARCH','以知為本','從資料、產業與市場脈絡出發，辨識訊號，讓判斷建立在持續累積的理解之上。'],
 ['TECHNOLOGY','科技賦能','運用科技整合資訊、驗證想法，讓複雜的市場訊息轉化為可思考、可執行的投資方向。'],
 ['DISCIPLINE','投資紀律','重視風險與機會的平衡，在每個投資階段檢視條件、假設與變化，保持清晰的決策節奏。'],
 ['PERSPECTIVE','看見全局','連結量化研究、公開市場、成長企業與金融工具，以多元視角理解不同週期中的價值。'],
 ['CONNECTION','匯聚專業','讓知識、科技、企業、人才與資本彼此連結，從專業之間的交流，看見新的可能。'],
 ['LONG TERM','長期同行','以長期尺度思考資本的方向，陪伴產業的成長與轉變，讓價值如水，源遠流長。']
];
const horizonCards=[
 ['STREAMS OF KNOWLEDGE','讓知識持續流動','把資料轉為理解，把觀察連結為洞察。從產業的脈絡與市場的變化中，持續校準思考的方向。'],
 ['CONNECTED EXPERTISE','讓專業彼此相連','連結科技、金融與企業視角，讓不同領域的經驗相互啟發，為複雜的問題找到更完整的理解。'],
 ['VALUE OVER TIME','讓價值經得起時間','以紀律面對每個選擇，以長期尺度看待成長。讓資本的每一次前行，都回到清晰而穩健的價值判斷。']
];
function patchHTML(html){
 html=html.replace(/[ \t]*<!-- PRINCIPLES_START -->[\s\S]*?<!-- PRINCIPLES_END -->\s*/g,'');
 const section=`        <!-- PRINCIPLES_START -->
        <section class="fiwp" id="principles" data-world-part="principles" aria-labelledby="fiwpTitle">
          <div class="fiwp-pin">
            <div class="fiwp-layout">
             <div class="fiwp-chapter" data-principles-chapter="1" aria-labelledby="fiwpTitle">
              <p class="fiwp-eyebrow" lang="en">FROM STRATEGY TO CONVICTION</p>
              <h2 class="fiwp-title" id="fiwpTitle" lang="en"><span>OUR PRINCIPLES</span><span>FOR LASTING VALUE</span></h2>
              <p class="fiwp-title-zh" lang="zh-Hant">以知為本，以紀律守護長期價值。</p>
              <div class="fiwp-columns">
                <div><p class="fiwp-lead" lang="zh-Hant">好的投資，始於理解。<br>讓知識、科技與資本相互連結，讓每一步決策回到長期價值。</p><p class="fiwp-lead-en" lang="en">Knowledge becomes insight.<br>Insight gives capital direction.</p></div>
                <div class="fiwp-cards">${cards.map(([en,zh,text],i)=>`<article class="fiwp-card"><h3 lang="en"><span>${String(i+1).padStart(2,'0')}</span>${esc(en)}</h3><h4 lang="zh-Hant">${esc(zh)}</h4><p lang="zh-Hant">${esc(text)}</p></article>`).join('\n')}</div>
              </div>
              <div class="fiwp-chapter-end" aria-hidden="true"><span>SCROLL TO CONTINUE</span><i>↓</i></div>
             </div>
             <div class="fiwp-chapter fiwp-chapter--horizon" data-principles-chapter="2" aria-labelledby="fiwpHorizonTitle">
              <p class="fiwp-eyebrow" lang="en">A CONTINUOUS CURRENT</p>
              <h2 class="fiwp-title" id="fiwpHorizonTitle" lang="en"><span>KNOWLEDGE IN FLOW.</span><span>VALUE OVER TIME.</span></h2>
              <p class="fiwp-title-zh" lang="zh-Hant">智匯成流，資本向前，源遠流長。</p>
              <div class="fiwp-columns">
                <div><p class="fiwp-lead" lang="zh-Hant">匯聚每一份洞察，<br>走向更長遠的價值。</p><p class="fiwp-lead-en" lang="en">Different perspectives.<br>A shared direction.</p></div>
                <div class="fiwp-cards">${horizonCards.map(([en,zh,text],i)=>`<article class="fiwp-card"><h3 lang="en"><span>${String(i+1).padStart(2,'0')}</span>${esc(en)}</h3><h4 lang="zh-Hant">${esc(zh)}</h4><p lang="zh-Hant">${esc(text)}</p></article>`).join('\n')}</div>
              </div>
              <div class="fiwp-bottom"><span lang="en">FINANCE × INNOVATION</span><button class="fiwp-next" type="button" data-world-go="logo"><span>THE FINNOVATION SPIRIT</span><i aria-hidden="true">→</i></button></div>
             </div>
            </div>
            <div class="fiwp-progress" aria-hidden="true"><span>OUR<br>PRINCIPLES</span></div>
          </div>
        </section>
        <!-- PRINCIPLES_END -->
`;
 const anchor=html.match(/[ \t]*<!-- LOGO_SEAL_START[^\n]*\n/);if(!anchor)throw Error('Principles: closing logo anchor missing');
 html=html.replace(anchor[0],section+anchor[0]);
 const css=read(path.join(__dirname,'world-principles.css')),v=crypto.createHash('md5').update(css).digest('hex').slice(0,10);
 const link='<link rel="stylesheet" data-world-principles href="prototypes/index1-5/world-principles.css?v='+v+'">';
 if(html.includes('data-world-principles'))html=html.replace(/<link[^>]*data-world-principles[^>]*>/,link);
 else html=html.replace('</head>','  '+link+'\n</head>');return html;
}
function patchWorld(src,version=''){
 if(src.includes('PRINCIPLES_FLOW_HOOK'))return src;
 const once=(a,b)=>{if(src.split(a).length!==2)throw Error('Principles anchor: '+a.slice(0,100));src=src.replace(a,()=>b);};
 src=src.replace(/import \{ createWorldLogo \} from '(\.\/world-logo\.js(?:\?[^']*)?)';/,(m)=>m+"\n/* PRINCIPLES_FLOW_HOOK */\nimport { createWorldPrinciples } from './world-principles.js"+(version?'?v='+version:'')+"';");
 if(!src.includes('PRINCIPLES_FLOW_HOOK'))throw Error('Principles import missing');
 const marker="  /* GSAP's scroll reveals stay off the horizontal section (it reveals its chapters itself, by stop) */";
 once(marker,`  const principles = createWorldPrinciples({ root, reducedMotion,
    go: value => { yt = clamp(value, 0, maxY); run(); }, remeasure: () => { measure(); refreshTriggers(); run(); }
  });\n`+marker);
 once('    logo?.layout(W, H);','    principles?.layout(W, H);\n    logo?.layout(W, H);');
 once('    logo?.measure(at, top);','    principles?.measure(at, top);\n    logo?.measure(at, top);');
 once('o, l: logo ? logo.sample(yy) : null, footerTop:','o, principles: principles ? principles.sample(yy) : null, l: logo ? logo.sample(yy) : null, footerTop:');
 once(`    const logoDrawn = logo ? logo.render(s, time, { renderer, world: () => ocean?.render(s, time), draw: () => renderer.render(scene, camera) }) : false;
    if (!logoDrawn) { ocean?.render(s, time); renderer.render(scene, camera); }`,
 `    const drawBase = () => { ocean?.render(s, time); renderer.render(scene, camera); };
    const drawBeforeSeal = () => { if (!principles?.render(s, time, { renderer, draw: drawBase })) drawBase(); };
    const logoDrawn = logo ? logo.render(s, time, { renderer, world: () => {}, draw: drawBeforeSeal }) : false;
    if (!logoDrawn) drawBeforeSeal();`);
 once('    logo?.paint(s);','    logo?.paint(s);\n    principles?.paint(s);');
 once('...(logo ? [logo.stopY()] : []), maxY].sort(', '...(principles ? [principles.stopY()] : []), ...(logo ? [logo.stopY()] : []), maxY].sort(');
 once("name === 'logo' ?", "name === 'principles' ? (principles ? principles.stopY() : maxY) : name === 'logo' ?");
 once('    logo?.close();','    principles?.close();\n    logo?.close();');
 once('logo: logo?.state,','principles: principles?.state, logo: logo?.state,');
 once('      logo?.dispose();','      principles?.dispose();\n      logo?.dispose();');return src;
}
module.exports=({main,drops,letters,glass,html,extra})=>{
 if(!extra?.['finnovation-world.js'])throw Error('Principles: world module missing');
 extra['finnovation-world.js']=patchWorld(extra['finnovation-world.js']);extra['world-principles.js']=read(path.join(__dirname,'world-principles.js'));
 return{main,drops,letters,glass,html:patchHTML(html),extra};
};
module.exports.patchHTML=patchHTML;module.exports.patchWorld=patchWorld;
