const { chromium } = require('C:/Users/qq763/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.goto('http://127.0.0.1:57603/index4-6.html?view=finale',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__MONTIS_STUDY__&&document.body.classList.contains('is-ready'),null,{timeout:60000});
    await page.evaluate(()=>{const j=window.__MONTIS_STUDY__.journey;j.target=j.progress=13.8;j.velocity=0;});
    await page.waitForTimeout(2200);
    await page.screenshot({path:path.resolve(__dirname,'../.qa/confluence/iteration-finale.png')});
    console.log(JSON.stringify({errors}));
    if(errors.length)process.exitCode=1;
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
