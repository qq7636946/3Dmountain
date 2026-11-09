/* ---------------------------------------------------------------- DOM */
/* The chapters move into a horizontal track (the elements are moved, not copied: ids, tabs and copy are the page's).
   Kickers and the gold line are decorative repeats (aria-hidden); the "next" pills are in-page navigation. */
export function prepareOceanDom(root) {
  const resp=root.querySelector('[data-world-part="responsibility"]'),global=root.querySelector('[data-world-part="global"]');
  if(!resp||!global||resp.classList.contains('fiwo'))return null;
  const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
  const dive=make('div','fiwo-dive');dive.dataset.worldPart='dive';dive.setAttribute('aria-hidden','true');global.after(dive);
  resp.classList.add('fiwo');
  const pin=make('div','fiwo-pin'),track=make('div','fiwo-track');
  /* FLOW_WHY_SECTION_HEADING: one shared title, card titles stay individual. */
  const heading=resp.querySelector(':scope > #fiwRespTitle');
  if(heading) {
    const header=make('header','flow-why-heading'),eyebrow=make('p','flow-why-eyebrow','03 / 為何選擇我們');
    eyebrow.lang='zh-Hant'; heading.classList.remove('fiw-sr'); heading.lang='en';
    header.append(eyebrow,heading); pin.append(header);
  }
  pin.append(track);
  const articles=[...resp.querySelectorAll(':scope > [data-strategy]')];
  if(articles.length!==4)throw Error('Expected four ocean strategy chapters.');
  resp.querySelector(':scope > .fiwo-source-intro')?.remove();
  articles.forEach((article,k)=>{article.classList.add('fiwo-panel');article.dataset.stop=String(k);track.append(article);});
  const N=articles.length,progress=make('nav','fiwo-progress');progress.setAttribute('aria-label','為何選擇我們');
  const label=make('span','fiwo-progress-label','WHY FINNOVATION');label.setAttribute('aria-hidden','true');
  const list=make('ol'),line=make('span','fiwo-progress-line');line.append(make('i'));line.setAttribute('aria-hidden','true');
  articles.forEach((article,k)=>{const li=make('li'),b=make('button','',String(k+1).padStart(2,'0'));b.type='button';b.dataset.oceanGo=String(k);b.setAttribute('aria-label',article.querySelector('.fiwo-strategy-tagline').textContent);li.append(b);list.append(li);});
  progress.append(label,line,list);pin.append(progress);resp.append(pin);
  return {resp,dive,pin,track,progress,ticks:[...list.querySelectorAll('button')],panels:articles,N};
}
