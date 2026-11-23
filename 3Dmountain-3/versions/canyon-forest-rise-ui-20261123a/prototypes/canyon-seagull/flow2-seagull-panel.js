/* Flow2 · panel 「海鷗・LOGO 參數」 (Team SQ, 2026-11-17). index1-5-canyon-forest.html.
   Client: 「首頁那個LOGO 海鷗 開控制給我好了 直接放在海鷗參數給我調整」 — live dials for the first screen's gull flock (flow2-seagull.js) and the
   glass LOGO standing on the river (flow2-mark.js), in the page's own panel row (flow2-panel.js: same look, key E, 複製參數 JSON, 重設).
   · The dials write the modules' own live values (no copies): the flock's in window.__FLOW2_SEAGULL__.tune, the drop's ripples in
     window.__FLOW2_WAKE__.tune ('w.…'), the LOGO's in window.__FLOW2_MARK__.tune — the same values the LOGO panel (M) shows, so a change made here shows there too and the reverse.
     The exported JSON keys read 'g.…' (the gulls) and 'logo.…' (the LOGO's tune paths).
   · Defaults are today's picture. 「再飛一次」 plays the fly-by again from the lens's place now.
   · Like the other panels: hidden on phones (narrow screens), under automation unless ?panel=1, and with ?panel=0. */
(() => {
  'use strict';
  const P = window.__FLOW2_PANEL__, SG = window.__FLOW2_SEAGULL__, MK = window.__FLOW2_MARK__, WK = window.__FLOW2_WAKE__;
  if (!P || (!SG && !MK && !window.__FLOW2_DROP__)) return;
  const tune = {};
  const rows = [];
  if (SG && SG.flockOn !== false && SG.tune?.flock) {
    tune.g = SG.tune;
    rows.push(['— 海鷗（首頁飛過一次）—'],
      ['隻數', 'g.flock.count', 1, 9, 1], ['大小（倍）', 'g.flock.size', .4, 2.5, .05], ['飛行高度（畫面上下）', 'g.flock.height', -.6, .4, .01],
      ['起飛方向（1 右／-1 左）', 'g.flock.side', -1, 1, 2], ['路線左右偏移', 'g.flock.offX', -.8, .8, .01], ['離鏡頭遠近（倍）', 'g.flock.dist', .5, 2.5, .05],
      ['飛行秒數（小＝快）', 'g.flock.dur', 3, 14, .1], ['進場後幾秒起飛', 'g.flock.delay', 0, 6, .1], ['拍翅速度（倍）', 'g.flock.rate', .3, 2.5, .05],
      ['亮度', 'g.exposure', .3, 2, .01], ['融入霧氣（倍）', 'g.flock.fog', 0, 3, .05]);
  }
  if (MK && MK.tune) {
    tune.logo = MK.tune;
    rows.push(['— 首頁 LOGO（水上的玻璃標誌）—'],
      ['大小（高度 m）', 'logo.height', 8, 60, .5], ['左右位置（m）', 'logo.side', -40, 40, .5], ['離鏡頭距離（m）', 'logo.distance', 40, 160, 1],
      ['離水面（負＝浮起）', 'logo.dip', -8, 3, .05], ['轉向（度）', 'logo.yawDeg', -180, 180, 1], ['前後傾（度）', 'logo.tiltDeg', -30, 30, .5],
      ['玻璃亮度（環境反光）', 'logo.look.envIntensity', 0, 4, .05], ['亮點上限', 'logo.maxBright', .5, 6, .05], ['太陽打在玻璃上', 'logo.sun', 0, 3, .05],
      ['折射率', 'logo.look.ior', 1, 2.33, .01], ['折射厚度（背景扭曲）', 'logo.look.volume', 0, 3, .05],
      ['漣漪亮度', 'logo.rings.amount', 0, 4, .05], ['腳下的光', 'logo.rings.glow', 0, 3, .05],
      ['開始下沉（離鏡頭 m）', 'logo.sinkFar', 20, 120, 1], ['完全沉入（離鏡頭 m）', 'logo.sinkNear', 5, 80, 1]);
  }
  const DR = window.__FLOW2_DROP__;   /* the drop that leads down the canyon (flow2-drop-lead.js); 2026-11-17, client: 「這個水滴的大小也開給我控制 放在LOGO那個參數」 */
  if (DR && DR.tune) {
    tune.d = DR.tune;
    rows.push(['— 領路的水滴（山道上帶路）—'],
      ['大小（半徑 m）', 'd.radius', .4, 3, .05], ['跑動時左右晃（0 照河道／1 置中不晃）', 'd.calm', 0, 1, .05]);
  }
  if (WK && WK.tune) {   /* the drop's ripples on the river (flow2-bead-wake.js) */
    tune.w = WK.tune;
    rows.push(['— 水滴漣漪（水滴跑動時的水面）—'],
      ['強度', 'w.gain', 0, 3, .05], ['波紋大小（倍）', 'w.ringSize', .3, 3, .05], ['一圈裡的波紋數', 'w.ringCount', 1, 8, .5],
      ['波紋間距（m，大＝疏）', 'w.ringSpacing', 1, 12, .1], ['留存長短（倍）', 'w.fade', .3, 3, .05], ['光點閃爍', 'w.glint', 0, 3, .05],
      ['靜止時多久一圈（秒）', 'w.restRing', .6, 5, .1]);
  }
  if (!rows.length) return;
  P.add({ id: 'seagulllogo', title: '海鷗・LOGO', key: 'e', tune, rows, onChange: key => {
    if (/^logo\.(height|distance|side)$/.test(key)) MK?.place?.();
    if (key.startsWith('logo.look.')) MK?.setLook?.();
  } });
  /* 「再飛一次」 next to the panel's own buttons */
  if (!P.hidden && SG && tune.g) {   /* the flock's replay hook arrives with the model; the button looks it up when pressed */
    const box = [...document.querySelectorAll('.f2p-box')].pop(), actions = box && box.querySelector('.f2p-actions');
    if (actions && box.querySelector('.f2p-title span')?.textContent === '海鷗・LOGO') {
      const again = document.createElement('button'); again.type = 'button'; again.textContent = '再飛一次';
      again.addEventListener('click', () => { window.__FLOW2_SEAGULL__?.replayFlock?.(); });
      actions.prepend(again);
    }
  }
})();
