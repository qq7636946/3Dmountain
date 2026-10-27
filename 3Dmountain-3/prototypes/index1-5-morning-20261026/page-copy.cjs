/* index1-5 copy from 恒灝官網建置企劃_20260910pptx.pptx, slides 3–10.
   Keep the existing camera order and IDs. The four horizontal investment
   chapters, their images, layout and controls are deliberately outside this map. */
const CHAPTERS = [
  { id:'knowledge', en:'KNOWLEDGE', zh:'一滴知識', title:['A DROP OF','KNOWLEDGE'], zhLines:[['head','以知為本・恒灝創新・資本賦能・善水長流'],['body','科技賦能，金融加值，創造長期產業價值。']], text:'以知為本・恒灝創新・資本賦能・善水長流　科技賦能，金融加值，創造長期產業價值。', kicker:'WHERE THE CURRENT BEGINS', cta:'FOLLOW THE DROP' },
  { id:'innovation', en:'INSIGHT', zh:'洞察訊號', title:['INSIGHT WITH DISCIPLINE'], zhLines:[['head','以科技洞察市場，以紀律創造長期價值'],['mid','四大投資策略']], text:'以科技洞察市場，以紀律創造長期價值　四大投資策略', kicker:'OUR INVESTMENT APPROACH', cta:'FOLLOW THE CURRENT' },
  { id:'convergence', en:'DIRECTION', zh:'洞察成流', title:['INSIGHT','SETS THE COURSE'], text:'讓洞察形成方向，讓資本隨之向前。', kicker:'INSIGHT INTO ACTION', cta:'FOLLOW THE VALUE' },
  { id:'value', en:'VALUE', zh:'資本向前', title:['CAPITAL','FLOWS FORWARD'], text:'讓資源流向真正有價值的地方。', kicker:'CAPITAL WITH PURPOSE', cta:'SEE WHAT CONNECTS' },
  { id:'perspective', en:'CONFLUENCE', zh:'智匯相連', title:['WHERE','VALUE CONNECTS'], text:'知識、科技、企業、人才與資本，在恒灝相互連結。', kicker:'KNOWLEDGE IN CONFLUENCE', cta:'EXPLORE OUR STRATEGIES' }
];
const SEAL_COPY = {
  kicker:'THE FINNOVATION SPIRIT', title:'Finance × Innovation', zh:'恒灝創新',
  line:'恒，是長期；灝，是流動與匯聚。\n智匯成流，資本向前，源遠流長。', pill:'THE SPIRIT'
};
const GLOBAL_COPY = {
  kicker:'GLOBAL REACH · 善水長流',
  title:'Across borders, we connect knowledge, technology and capital to explore opportunities for lasting value.',
  zh:'讓智匯之流跨越邊界，連結全球資源，讓長期價值持續延伸。'
};
const MENU = { title:'Knowledge in flow.<br>Capital moving forward.', zh:'智匯成流，資本向前，源遠流長。' };
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function one(s,re,fn,label){let n=0;const out=s.replace(re,(...a)=>{n++;return fn(...a);});if(n!==1)throw Error('Page copy '+label+': '+n);return out;}
function menuCopy(s){
  s=one(s,/(<h2 id="fi-menu-title">)[\s\S]*?(<\/h2>)/,(m,a,b)=>a+MENU.title+b,'menu title');
  return one(s,/(<h2 id="fi-menu-title">[\s\S]*?<\/h2>\s*<p>)[\s\S]*?(<\/p>)/,(m,a,b)=>a+MENU.zh+b,'menu subtitle');
}
function zhHtml(c){return c.zhLines?c.zhLines.map(([role,t])=>'<span class="fi-zh-'+role+'">'+esc(t)+'</span>').join(''):esc(c.text);}
function patchInterface(ui){
  ui=one(ui,/const chapters = (\[[\s\S]*?\n\]);/,(m,literal)=>{
    const current=new Function('return ('+literal+')')();
    if(current.length!==6)throw Error('Expected six journey chapters');
    return 'const chapters = '+JSON.stringify(current.map(c=>{const n=CHAPTERS.find(x=>x.id===c.id);return n?{...n,text:zhHtml(n)}:c;}),null,2)+';';
  },'chapter data');
  return menuCopy(ui);
}
function patchHTML(html){
  const oceanBefore=html.match(/<section class="fiw-resp"[\s\S]*?<\/section>/)?.[0];
  for(const [i,c]of CHAPTERS.entries()){
    html=one(html,new RegExp('(<article\\b[^>]*id="chapter-'+c.id+'"[^>]*>)([\\s\\S]*?)(<\\/article>)'),(m,open,body,close)=>{
      if(c.mark&&!/data-mark=/.test(open))open=open.replace(/>$/,' data-mark="'+esc(c.mark)+'">');
      body=one(body,/(<p class="fi-copy-kicker">)[\s\S]*?(<\/p>)/,(m,a,b)=>a+esc(c.kicker)+b,c.id+' kicker');
      body=one(body,/(<h[12]\b[^>]*>)[\s\S]*?(<\/h[12]>)/,(m,a,b)=>a+c.title.map(t=>'<span>'+esc(t)+'</span>').join(' ')+b,c.id+' title');
      body=one(body,/(<p class="fi-copy-zh">)[\s\S]*?(<\/p>)/,(m,a,b)=>a+zhHtml(c)+b,c.id+' text');
      body=one(body,/(<\/span>)\s*[^<]+(<svg\b)/,(m,a,b)=>a+esc(c.cta)+b,c.id+' action');
      return open+body+close;
    },c.id+' panel');
    html=one(html,/(<nav class="fi-rail"[^>]*>)([\s\S]*?)(<\/nav>)/,(m,a,body,b)=>{
      body=one(body,new RegExp('<button([^>]*data-chapter="'+i+'"[^>]*)>([\\s\\S]*?)<\\/button>'),(m,attrs,inside)=>{
        attrs=attrs.replace(/aria-label="[^"]*"/,'aria-label="'+String(i+1).padStart(2,'0')+' '+c.zh+'"');
        return '<button'+attrs+'>'+inside.replace(/(<\/span>)[^<]*$/,'$1'+c.en)+'</button>';
      },c.id+' rail');return a+body+b;
    },'rail');
    html=one(html,/(<nav class="fi-menu-links"[^>]*>)([\s\S]*?)(<\/nav>)/,(m,a,body,b)=>{
      body=one(body,new RegExp('(<button[^>]*data-chapter="'+i+'"[^>]*>)([\\s\\S]*?)(<\\/button>)'),(m,a,inside,b)=>a+inside.replace(/(class="fi-menu-link-en">)[^<]*/,'$1'+c.en).replace(/(class="fi-menu-link-zh">)[^<]*/,'$1'+c.zh)+b,c.id+' menu');
      return a+body+b;
    },'menu');
    html=one(html,new RegExp('(<button[^>]*data-chapter-link="'+i+'"[^>]*>)[^<]*(<\\/button>)'),(m,a,b)=>a+c.en[0]+c.en.slice(1).toLowerCase()+b,c.id+' footer');
  }
  html=menuCopy(html);
  html=html.replace(/(<p class="hero-title">)[^<]*(<\/p>)/,(m,a,b)=>a+CHAPTERS[0].title.join(' ')+b)
    .replace(/(<p class="hero-sub">)[^<]*(<\/p>)/,(m,a,b)=>a+CHAPTERS[0].text+b)
    .replace(/(<div class="study">)[^<]*(<\/div>)/,(m,a,b)=>a+CHAPTERS[0].kicker+b);
  html=one(html,/(<section class="fiw-global\b[\s\S]*?)(<\/section>)/,(m,body,end)=>{
    body=one(body,/(<p class="fiw-kicker"[^>]*>)[\s\S]*?(<\/p>)/,(m,a,b)=>a+GLOBAL_COPY.kicker+b,'global kicker');
    body=one(body,/(<h2[^>]*id="fiwGlobalTitle"[^>]*>)[\s\S]*?(<\/h2>)/,(m,a,b)=>a+GLOBAL_COPY.title+b,'global title');
    body=one(body,/(<p class="fiw-statement-zh"[^>]*>)[\s\S]*?(<\/p>)/,(m,a,b)=>a+GLOBAL_COPY.zh+b,'global text');
    return body+end;
  },'global');
  for(const [key,cls]of [['title','fisl-title'],['zh','fisl-zh'],['line','fisl-line']]){
    html=one(html,new RegExp('(<(?:h2|p) class="'+cls+'"[^>]*>)[\\s\\S]*?(<\\/(?:h2|p)>)'),(m,a,b)=>a+esc(SEAL_COPY[key]).replace(/\n/g,'<br>')+b,'seal '+key);
  }
  if(html.match(/<section class="fiw-resp"[\s\S]*?<\/section>/)?.[0]!==oceanBefore)throw Error('Horizontal strategy section changed');
  return html;
}
module.exports={CHAPTERS,SEAL_COPY,GLOBAL_COPY,patchHTML,patchInterface};
