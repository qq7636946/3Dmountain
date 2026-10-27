'use strict';
/* QA · keyboard Tab order in every state (journey, cards, world, ocean, principles, LOGO, footer).
   Records, for each Tab press: which element took focus, whether it is on screen / opaque / uncovered, the focus ring, and the page state afterwards
   (so "Tab moved the camera", "focus on an invisible control", "focus trap" show up as data).
   Run:  node scripts/index1-5/probe.cjs --script scripts/index1-5/probes/qa/kbd-tab-order.probe.cjs --out qa-kbd-tab   [--phone] [--reduced]
   Env:  QA_STATES="top,p:2.96,..." to run only some states.  Detail JSON: .qa/index1-5/qa-interaction/kbd-tab-order<-suffix>.json */
const Q = require('./_qa.cjs'), fs = require('node:fs'), path = require('node:path');
module.exports = async ({ page, L, vp }) => {
  const states = (process.env.QA_STATES || 'top,p:2.96,p:5.56,p:max,cards,world,h:0,h:2,principles,logo,footer').split(',');
  const detail = {}, summary = [];
  await page.addStyleTag({ content: '.letters-panel{display:none!important}' }).catch(() => { });
  let worldState = null;
  for (const name of states) {
    if (/^(world|h:|principles|logo|footer|global)/.test(name) && !worldState) worldState = (await L.enterWorld(page, vp)).state;
    await Q.goState(page, L, vp, name, worldState);
    await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(300);
    const before = await Q.study(page);
    const walk = await Q.tabWalk(page, 60);
    const after = await Q.study(page);
    await Q.shot(page, `tab-${name.replace(':', '')}${vp.phone ? '-phone' : ''}`, 70).catch(() => { });
    // reverse once from the last landed element
    const rev = []; for (let i = 0; i < 4; i++) { await page.keyboard.press('Shift+Tab'); await page.waitForTimeout(120); rev.push(await Q.focusInfo(page)); }
    detail[name] = { before, after, walk, rev };
    const bad = walk.filter(f => !f.body && (!f.inView || f.opacity < .1 || f.hidden || f.covered || f.inert));
    const noRing = walk.filter(f => !f.body && !f.ring && !f.shadow);
    summary.push({
      state: name, before: Q.short(before), after: Q.short(after), tabs: walk.length, cycled: !!walk.find(f => f.cycle),
      landed: walk.filter(f => !f.body).map(f => `${f.part || ''}:${f.label || f.cls}${!f.inView ? '[OFF]' : ''}${f.opacity < .1 ? '[INVIS]' : ''}${f.covered ? '[COVERED:' + f.covered + ']' : ''}`),
      offscreenOrInvisible: bad.length, noRing: noRing.length, bodyHits: walk.filter(f => f.body).length
    });
  }
  const dir = path.join(Q.ROOT, '.qa', 'index1-5', 'qa-interaction'); fs.mkdirSync(dir, { recursive: true });
  const suffix = (vp.phone ? '-phone' : '') + (process.env.QA_SUFFIX || '');
  fs.writeFileSync(path.join(dir, 'kbd-tab-order' + suffix + '.json'), JSON.stringify(detail, null, 1));
  return { ok: true, summary };
};
