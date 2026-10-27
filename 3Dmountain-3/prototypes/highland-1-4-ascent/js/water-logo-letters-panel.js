/* index1-4 · highland copy of js/water-logo-letters-panel.js (built by prototypes/highland-1-4/build.cjs): only its storage key differs. */
/** 水滴字母 · 參數列 — a small panel of its own for the LOGO chapter's letters and
 * the swirl of drops that carries them: what the workshop (T) has in two long
 * groups among fifty, set out for the hand that only wants this chapter.
 *
 * It is a tool, not part of the page: the module is fetched only when the
 * panel is asked for (a local address, ?letters=1, or the L key), it writes
 * nothing but the two config groups the chapter already reads every frame, and
 * what is changed here lives in this browser alone (localStorage) until the
 * numbers are copied out and made the defaults.
 *
 * Three ways in, coarse to fine: the switches at the top move a handful of
 * values at once along one idea (pace, how liquid, water, ice, how much);
 * the sliders below are every value by name — the chapter's own, and then
 * the drops' groups (liquid physics, spray and beads, light, entrance) under
 * the names the workshop and index2.html's panel give them; and any number
 * can be typed. While the
 * pointer is elsewhere the panel thins to a ghost, so the picture it is
 * changing can be seen behind it.
 */
const STORE = 'finnovation:letters-panel:v1';

/* [label, group, key, min, max, step, hint] — a colour has no range. The
   first five sections are this chapter's own. The four after them are the
   drops' own groups as the workshop — and index2.html's panel — names them,
   row for row and under the same names, less the rows that only the
   photographs' choreographies read: what is set there by hand can be set
   here the same way. */
const SECTIONS = [
  ['節奏與順暢', true, [
    ['螺旋慣性（秒）', 'logoDrops', 'swirlEase', 0, 2, .01, '捲動停手後，螺旋還要滑多久才停下來。0＝緊跟捲動、不帶慣性。'],
    ['水滴破開（秒）', 'logoDrops', 'breakTime', .1, 1.6, .01, '一顆字母水滴從開始破到完全散開的時間。和捲動快慢無關。'],
    ['字母飛入（秒）', 'logoDrops', 'flyTime', .2, 2.4, .01, '字母離開水滴到落進字標的時間。和捲動快慢無關。'],
    ['飛入過衝', 'logoLetters', 'overshoot', 0, 2.5, .01, '落位時衝過頭再回來的幅度。0＝不回彈，平順停住。'],
    ['飛行拋起', 'logoLetters', 'flightArc', 0, 1, .01, '字母離開水滴時先往上拋多高再落下（以字高為單位）。0＝直線落下。'],
    ['飛行翻身（度）', 'logoLetters', 'flightTurn', 0, 90, 1, '字母飛行途中側轉的角度，落位時轉正，讓冰的側壁吃到光。0＝不轉。'],
    ['整字融合（秒）', 'logoDrops', 'fuseTime', .2, 3, .01, '11 個字到齊後，從霜化成玻璃、光掃過去的時間。'],
    ['成字鼓起', 'logoLetters', 'fuseSwell', 0, .12, .005, '11 個字到齊那一下，整個字標輕輕脹大再回來的幅度。0＝不動。'],
    ['成字水滴外推', 'logoDrops', 'fuseKick', 0, .25, .005, '成字那一下，整圈水滴往外退開再慢慢收回的幅度。0＝不動。'],
    ['整章轉幾圈', 'logoDrops', 'swirlTurns', .4, 2.5, .01, '螺旋在整個章節裡總共轉幾圈。1＝和 index2 的螺旋同速。'],
    ['第一個字到位', 'logoDrops', 'deliverStart', 0, .5, .005, '第一顆字母水滴轉到字標上方的時間點（章節進度 0–1）。'],
    ['最後一個字到位', 'logoDrops', 'deliverEnd', .4, 1, .005, '最後一顆字母水滴到位的時間點（章節進度 0–1）。'],
    ['尾聲開始升空', 'logoDrops', 'swirlLeaveStart', .3, 1.5, .01, '剩下的清水水滴從什麼時候開始往上離場。'],
    ['單顆升空時間', 'logoDrops', 'swirlLeaveClimb', .04, .5, .01, '每一顆離場時往上衝的長度（章節進度）。'],
    ['上升追加圈數', 'logoDrops', 'leaveSpin', 0, 1.5, .01, '離場往上衝的同時再多轉幾圈。'],
    ['衝出高度', 'logoDrops', 'leaveRise', 1, 2.5, .01, '離場時衝到畫面上緣外多遠。1＝剛好出畫面。'],
    ['上升半徑', 'logoDrops', 'leaveRadius', .3, 1.6, .01, '往上衝時螺旋半徑變成幾倍。小於 1 會收成一束。'],
    ['靜止時輕晃', 'logoDrops', 'swirlSway', 0, .15, .005, '不捲動時，整圈水滴來回輕輕晃動的幅度。0＝完全靜止。'],
    ['靜止時波浪', 'logoDrops', 'swirlWave', 0, .08, .002, '不捲動時，一道慢波沿著整串水滴往後傳，水滴依序輕輕起伏。0＝不動。']
  ]],
  ['水滴群', false, [
    ['清水水滴數量', 'logoDrops', 'crowd', 0, 1.6, .01, '沒有字母的水滴有多少。1＝設計值；往上到 1.6 會再多出一批。'],
    ['字母水滴大小', 'logoDrops', 'letterSize', .08, .4, .005],
    ['字母水滴差異', 'logoDrops', 'letterSizeVar', 0, 1.5, .01, '字母水滴彼此大小的落差。0＝全部一樣大。'],
    ['清水水滴大小', 'logoDrops', 'plainSize', .04, .25, .005],
    ['清水水滴差異', 'logoDrops', 'plainSizeVar', 0, 1.5, .01, '清水水滴彼此大小的落差。'],
    ['螺旋半徑', 'logoDrops', 'swirlRadius', .8, 2.2, .01],
    ['每弧度升高', 'logoDrops', 'swirlPitch', 0, .3, .005, '螺旋每轉一點升多高。太大會壓到標題。'],
    ['螺旋過頂高度', 'logoDrops', 'gateLift', -.6, .9, .01, '水滴從正面通過時，比字標高多少。'],
    ['螺旋前後傾斜', 'logoDrops', 'swirlTiltX', -20, 20, .5],
    ['螺旋左右傾斜', 'logoDrops', 'swirlTiltZ', -20, 20, .5],
    ['水滴凝結位置（圈）', 'logoDrops', 'swirlBorn', .5, 1.5, .01, '水滴在轉到正面之前幾圈的地方凝結出來。0.8＝從左側出現，繞後方一次就到正面；1.25＝更早，會先從標題前方經過一次。'],
    ['過頂後起飛點', 'logoDrops', 'climbFrom', 0, 3.14, .01, '通過正面之後再轉多少弧度才開始往上飛。小＝一過頂就往左上甩出畫面；3.14＝繞到字標後方才升。'],
    ['過頂後升空力道', 'logoDrops', 'climbOut', 0, 14, .1, '起飛之後往上爬升得多急。'],
    ['串列高低起伏', 'logoDrops', 'stringLift', 0, .12, .002, '相鄰水滴一高一低的落差，讓它像一串水滴而不是一條軌道。'],
    ['波動幅度', 'logoDrops', 'wave', 0, .15, .005, '螺旋線本身上下起伏的幅度。'],
    ['手機尺寸', 'logoDrops', 'mobileScale', .4, 1, .01, '手機上整圈水滴縮小的比例。']
  ]],
  ['水珠質感', false, [
    ['窗光高光', 'logoDrops', 'swirlGloss', 0, 2, .01, '水珠左上角那塊窗戶反光的亮度。'],
    ['內部光暈', 'logoDrops', 'swirlGlow', 0, 1, .01, '水珠裡面發亮的程度。調低＝更清透，調高＝更霧潤。'],
    ['水珠邊線', 'logoDrops', 'swirlRing', 0, 1, .01, '水珠邊緣那圈深色線的深淺。'],
    ['底部亮弧', 'logoDrops', 'swirlCaustic', 0, 2, .01, '光穿過水珠後聚在邊緣的亮弧。'],
    ['遠處霧化', 'logoDrops', 'swirlHaze', 0, .6, .01, '繞到字標後方的水滴淡進空氣裡的程度（景深感）。'],
    ['水中朦朧', 'logoDrops', 'veil', 0, .6, .01, '字母被水蓋住一點、透出後面的程度。'],
    ['透明度', 'logoDrops', 'opacity', .15, 1, .01, '整群水滴的不透明度。']
  ]],
  ['水裡的字母', false, [
    ['字母佔水滴比例', 'logoDrops', 'letterFill', .2, .7, .01, '字母在水滴裡的大小。'],
    ['字母側轉', 'logoDrops', 'letterYaw', 0, 40, .5, '字母在水裡左右轉多少度（看得到側面的厚度）。'],
    ['字母俯仰', 'logoDrops', 'letterPitch', 0, 25, .5],
    ['字母漂浮', 'logoDrops', 'letterFloat', 0, 2.5, .01, '字母在水裡晃動、偏離中心的程度。'],
    ['水中陰影', 'logoDrops', 'letterShadow', 0, .6, .01, '字母投在水裡的影子深淺。'],
    ['破裂點隨字移動', 'logoDrops', 'gateSpread', 0, 1, .01, '1＝每顆水滴在自己那個字的正上方破開；0＝都在正中央破。'],
    ['到位前傾', 'logoDrops', 'gatePush', 0, .6, .01, '水滴要破開前往鏡頭靠近多少。'],
    ['破開膨脹', 'logoDrops', 'popSwell', 0, .8, .01],
    ['破開水花', 'logoDrops', 'popSpray', 0, 3, .01]
  ]],
  ['冰的質感', false, [
    ['冰面色', 'logoLetters', 'tint'],
    ['冰壁色', 'logoLetters', 'ink'],
    ['結霜量', 'logoLetters', 'frost', 0, 1, .01, '字母表面霜的多寡。'],
    ['通透度', 'logoLetters', 'clear', 0, 1, .01, '看得到字母後面的程度。0＝整塊霜、不透。'],
    ['霜面明度', 'logoLetters', 'tone', .5, 1.2, .01],
    ['霜針紋理', 'logoLetters', 'needles', 0, 1.5, .01, '沿著字高的細直紋。'],
    ['冰晶閃點', 'logoLetters', 'sparkle', 0, 1.5, .01],
    ['切邊寬度', 'logoLetters', 'cut', .01, .1, .001, '字母邊緣斜面有多寬。'],
    ['切邊斜度', 'logoLetters', 'bevel', 0, 2.5, .01, '斜面有多陡——越陡，受光與背光的明暗差越大。'],
    ['輪廓亮線', 'logoLetters', 'rimLight', 0, 1.5, .01],
    ['折射彎曲', 'logoLetters', 'bend', 1, 1.5, .005, '透過字母看到的背景被折彎的程度。'],
    ['冰壁深度', 'logoLetters', 'wall', 0, 1, .01, '字母側面的深淺。'],
    ['棚燈光澤', 'logoLetters', 'sheen', 0, 2, .01],
    ['背光透亮', 'logoLetters', 'glow', 0, 1.5, .01],
    ['鎖定後殘霜', 'logoLetters', 'locked', 0, 1, .01, '字母落進字標後還留多少霜（整字融合時才化掉）。'],
    ['鎖定邊光', 'logoLetters', 'lockFlash', 0, 1, .01, '字母落位那一下邊線亮多少。'],
    ['融合掃光', 'logoLetters', 'fuseGlint', 0, 1.5, .01]
  ]],
  ['水滴 · 液體物理', false, [
    ['蠕動幅度', 'logoDrops', 'wobble', 0, .2, .001, '水滴靜止時表面慢慢蠕動、不那麼圓的程度。0＝完美的圓球。'],
    ['蠕動速度', 'logoDrops', 'wobbleSpeed', 0, 3, .01, '表面蠕動得多快。'],
    ['蠕動尺度', 'logoDrops', 'wobbleScale', .4, 4, .01, '蠕動的起伏有多大塊：小＝整顆在鼓動，大＝表面細細地爬。'],
    ['慣性甩動', 'logoDrops', 'inertia', 0, 2, .01, '加減速時水被甩向後／向前的程度。0＝不甩動。'],
    ['彈性頻率', 'logoDrops', 'jiggle', 2, 20, .1, '被甩動之後回彈、抖動得多快。'],
    ['彈性阻尼', 'logoDrops', 'damping', .02, 1.2, .01, '回彈多快停下來：小＝來回抖好幾下，大＝很快穩住。'],
    ['速度拉長', 'logoDrops', 'stretch', 0, 3, .01, '移動時水滴沿著前進方向被拉長的程度。'],
    ['水滴拖尾', 'logoDrops', 'tail', 0, 3, .01, '速度快時尾端拉出水滴狀的程度。'],
    ['重力下垂', 'logoDrops', 'sag', 0, .25, .005, '水滴因為重量往下垂的程度。'],
    ['表面滾動', 'logoDrops', 'roll', 0, 1.5, .01, '水滴移動時表面跟著滾動的程度。'],
    ['內部晃動', 'logoDrops', 'slosh', 0, 3, .01, '水滴裡的字母隨水流傾斜、再盪回來的程度。'],
    ['變形上限', 'logoDrops', 'limit', .05, .9, .01, '以上各種變形加起來的上限。']
  ]],
  ['水滴 · 飛濺與散珠', false, [
    ['飛濺量', 'logoDrops', 'spray', 0, 2.5, .01, '水滴移動、破開時甩出的小水珠量。'],
    ['飛濺持續', 'logoDrops', 'sprayLife', .2, 2.5, .01, '甩出的小水珠能存在多久。'],
    ['飛濺大小', 'logoDrops', 'spraySize', .3, 2.5, .01],
    ['散珠數量', 'logoDrops', 'ambient', 0, 1, .01, '飄在空中的細小水珠數量。'],
    ['散珠大小', 'logoDrops', 'ambientSize', .3, 2.5, .01],
    ['散珠視差', 'logoDrops', 'parallax', -1, 1, .01, '空中的小水珠跟著轉多少——不跟足，看起來就有遠近。'],
    ['散珠漂浮', 'logoDrops', 'float', 0, 3, .01, '小水珠與清水水滴上下漂動的幅度。'],
    ['小水滴不規則', 'logoDrops', 'beadLump', 0, .5, .01, '小水珠不圓的程度。0＝圓的。'],
    ['小水滴蠕動速度', 'logoDrops', 'beadWobble', 0, 3, .01]
  ]],
  ['水滴 · 光線', false, [
    ['折射率', 'logoDrops', 'ior', 1.1, 1.8, .005, '水把後面的景物折彎的程度（水是 1.333）。'],
    ['色散', 'logoDrops', 'dispersion', 0, .06, .001, '邊緣的彩色分光。'],
    ['表面反射', 'logoDrops', 'reflect', 0, 2, .01],
    ['高光', 'logoDrops', 'spec', 0, 3, .01, '棚燈與太陽在水珠上的亮點。'],
    ['邊緣墨色', 'logoDrops', 'rim', 0, 1, .01, '水珠邊緣內側那圈深色。'],
    ['背光弧', 'logoDrops', 'caustic', 0, 2, .01, '背光在水珠下緣聚成的亮弧。'],
    ['水的染色', 'logoDrops', 'absorb', 0, 1.5, .01, '水本身帶的顏色深淺。'],
    ['光核亮度', 'logoDrops', 'glow', 0, 2, .01, '水珠裡看到的那團光有多亮。']
  ]],
  ['水滴 · 進場與模糊', false, [
    ['進場 0淡入 1回流 2內聚', 'logoDrops', 'entrance', 0, 2, 1, '0＝原地淡入；1＝從畫面外飛回來；2＝先聚成一點再散開。'],
    ['開始進場', 'logoDrops', 'enterStart', -.6, -.05, .01, '第一顆水滴開始進場的時間點（章節進度；負數＝本章開始之前）。'],
    ['先後間隔', 'logoDrops', 'enterStagger', 0, .3, .01, '最後一顆比第一顆晚多久出發。'],
    ['旋入圈數', 'logoDrops', 'enterSwirl', 0, 1.5, .01, '飛進來時繞著鏡頭軸線捲多少。'],
    ['顯影時機', 'logoDrops', 'develop', 0, .95, .01, '飛進來的途中，字母多晚才在水裡浮現。'],
    ['內聚匯合點', 'logoDrops', 'enterMerge', -.4, -.02, .01, '「內聚」進場時，水滴聚成一點的時間點。'],
    ['白光幕保留', 'logoDrops', 'enterFlash', 0, 1, .01, '進場時保留多少原本的白光閃一下。'],
    ['動態模糊', 'logoDrops', 'blur', 0, 4, .01, '水滴高速移動時的殘影長度。'],
    ['螺旋也模糊', 'logoDrops', 'blurSpiral', 0, 1, 1, '1＝轉動時也加動態模糊；0＝只有進場時才有。'],
    ['遠處淡入空氣', 'logoDrops', 'haze', 0, 1, .01, '離鏡頭遠的水滴淡進空氣裡的程度。']
  ]]
];

/* The switches: one idea each, three places along it. The middle is always
   the design — the defaults of whatever keys its neighbours move. 液體感's
   first place is the liquid physics turned right down, slider for slider as
   it was set by hand in index2.html's panel: round, still beads. */
const AXES = [
  ['節奏', [
    ['柔慢', { logoDrops: { swirlEase: 1.15, breakTime: .75, flyTime: 1.15, fuseTime: 1.5 }, logoLetters: { overshoot: .22 } }],
    ['設計值', null],
    ['俐落', { logoDrops: { swirlEase: .45, breakTime: .38, flyTime: .6, fuseTime: .8 }, logoLetters: { overshoot: .85 } }]
  ]],
  ['液體感', [
    ['靜止', { logoDrops: { wobble: 0, wobbleSpeed: 0, wobbleScale: .53, inertia: 0, jiggle: 2, damping: .02, stretch: 0, tail: 0, sag: 0, roll: 0, slosh: 0 } }],
    ['設計值', null],
    ['活潑', { logoDrops: { wobble: .085, wobbleSpeed: 1.1, inertia: 1.5, damping: .18, stretch: 1.5, tail: 1.5, sag: .06, roll: .6, slosh: 1.5 } }]
  ]],
  ['水珠', [
    ['霧潤', { logoDrops: { swirlGloss: .45, swirlGlow: .85, swirlRing: .4, swirlCaustic: .3 } }],
    ['設計值', null],
    ['晶透', { logoDrops: { swirlGloss: 1.3, swirlGlow: .25, swirlRing: .8, swirlCaustic: .85 } }]
  ]],
  ['冰字', [
    ['通透', { logoLetters: { frost: .42, clear: .72, tone: .95, needles: .8, sparkle: .5 } }],
    ['設計值', null],
    ['濃霜', { logoLetters: { frost: .85, clear: .28, tone: .97, needles: 1.25, sparkle: .85 } }]
  ]],
  ['水滴數量', [
    ['少', { logoDrops: { crowd: .55 } }],
    ['設計值', null],
    ['多', { logoDrops: { crowd: 1.5 } }]
  ]]
];

const CSS = `
.letters-panel{position:fixed;top:106px;right:18px;z-index:31;width:min(322px,calc(100vw - 36px));max-height:calc(100dvh - 190px);display:flex;flex-direction:column;
  color:#dcebf3;border:1px solid #e8f6ff4d;border-radius:9px;background:linear-gradient(135deg,#33536ad9,#18364eeb);
  box-shadow:0 18px 52px #15304530,inset 0 1px 0 #f4fbff57,inset 0 -1px 0 #0d29365c;
  backdrop-filter:blur(26px) saturate(118%);-webkit-backdrop-filter:blur(26px) saturate(118%);
  font:400 11px/1.4 "Jost","Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;transition:background .3s ease,box-shadow .3s ease}
.letters-panel.is-left{right:auto;left:18px}
html[data-tuning="true"] .letters-panel:not(.is-left){right:calc(18px + min(330px,100vw - 36px) + 10px)}
.letters-panel[hidden]{display:none}
.letters-panel *{box-sizing:border-box}
.letters-panel>*{transition:opacity .3s ease}
/* Away from the pointer it is a ghost: the picture shows through it. */
.letters-panel.is-idle:not(.is-folded){background:linear-gradient(135deg,#33536a2e,#18364e3d);box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}
.letters-panel.is-idle:not(.is-folded)>*{opacity:.62}
.letters-panel button{font:inherit;color:inherit;cursor:pointer;border-radius:4px}
.letters-panel button:focus-visible,.letters-panel input:focus-visible,.letters-panel summary:focus-visible{outline:2px solid #dbeef5;outline-offset:2px}
.lp-head{flex:none;height:42px;display:flex;align-items:center;gap:4px;padding:0 8px 0 14px;border-bottom:1px solid #eaf7ff29;border-radius:9px 9px 0 0;background:linear-gradient(110deg,#ffffff14,transparent)}
.lp-title{flex:1;font-size:12px;letter-spacing:.14em;white-space:nowrap}
.lp-key{padding:2px 5px;border:1px solid rgba(222,239,247,.28);border-radius:3px;font:400 9.5px/1 Consolas,monospace;color:rgba(222,239,247,.62)}
.lp-head button{width:26px;height:26px;border:0;background:transparent;font-size:14px;line-height:1}
.lp-head button:hover{background:rgba(217,239,248,.14)}
.letters-panel.is-folded{width:auto;max-height:none}
.letters-panel.is-folded .lp-body{display:none}
.letters-panel.is-folded .lp-head{border-bottom:0;border-radius:9px}
.lp-body{flex:1;min-height:0;overflow:auto;padding:11px 14px 14px;scrollbar-width:thin;scrollbar-color:rgba(205,230,242,.28) transparent;overscroll-behavior:contain}
.lp-scrub{display:grid;grid-template-columns:58px 1fr 44px;align-items:center;gap:8px;margin-bottom:8px}
.lp-scrub span{color:rgba(226,240,247,.72);letter-spacing:.06em}
.lp-scrub output{font:400 10.5px/1 Consolas,monospace;text-align:right;color:#e8f5fb}
.lp-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px}
.lp-actions button,.lp-foot button{height:28px;border:1px solid rgba(196,226,240,.22);background:rgba(217,239,248,.06);letter-spacing:.04em;transition:background .2s ease}
.lp-actions button:hover,.lp-foot button:hover{background:rgba(217,239,248,.16)}
.lp-axis{display:grid;grid-template-columns:58px 1fr;align-items:center;gap:8px;margin-top:6px}
.lp-axis span{color:rgba(226,240,247,.72);letter-spacing:.06em}
.lp-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.lp-seg button{height:26px;border:1px solid rgba(196,226,240,.2);background:rgba(217,239,248,.05);letter-spacing:.06em;transition:background .2s ease}
.lp-seg button:hover{background:rgba(217,239,248,.14)}
.lp-seg button[aria-pressed="true"]{color:#17354b;background:#c9e0eb;border-color:#dbeef5}
.lp-section{margin-top:12px;border-top:1px solid rgba(196,226,240,.12)}
.lp-section summary{padding:10px 0 7px;cursor:pointer;list-style:none;color:rgba(222,239,247,.82);letter-spacing:.2em;font-size:10.5px;display:flex;align-items:center;gap:8px}
.lp-section summary::-webkit-details-marker{display:none}
.lp-section summary:before{content:"+";width:10px;font:400 12px/1 Consolas,monospace;color:rgba(222,239,247,.55)}
.lp-section[open] summary:before{content:"−"}
.lp-section summary i{margin-left:auto;font-style:normal;letter-spacing:.04em;color:#a9d7ea;font-size:10px}
.lp-row{display:grid;grid-template-columns:98px minmax(0,1fr) 54px;align-items:center;gap:8px;min-height:28px}
.lp-row label{color:rgba(226,240,247,.78);font-size:10.5px;line-height:1.25;cursor:help}
.lp-row label:not([title]){cursor:default}
.lp-row.is-changed label{color:#fff}
.lp-row.is-changed label:after{content:" •";color:#8fd0ee}
.lp-row input[type=range],.lp-scrub input[type=range]{width:100%;height:14px;accent-color:#a9d7ea;cursor:ew-resize}
.lp-row input[type=number]{width:100%;min-width:0;padding:4px 3px;border:1px solid rgba(196,226,240,.16);border-radius:3px;background:rgba(255,255,255,.04);color:#e8f5fb;font:400 11px/1 Consolas,monospace;text-align:right}
.lp-row input[type=color]{width:100%;height:22px;padding:1px;border:1px solid rgba(196,226,240,.22);background:transparent;cursor:pointer}
.lp-row output{font:400 10.5px/1 Consolas,monospace;color:#e8f5fb;text-align:right}
.lp-foot{margin-top:14px;padding-top:11px;border-top:1px solid rgba(196,226,240,.12)}
.lp-foot p{margin:0 0 8px;color:rgba(222,239,247,.66);font-size:10.5px;line-height:1.55}
.lp-foot .lp-buttons{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.lp-foot textarea[hidden]{display:none}
.lp-foot textarea{display:block;width:100%;height:96px;margin-top:8px;padding:6px;border:1px solid rgba(196,226,240,.2);border-radius:4px;background:rgba(8,20,28,.5);color:#dcebf3;font:400 10.5px/1.35 Consolas,monospace;resize:vertical}
@media (max-width:760px){.letters-panel,.letters-panel.is-left{top:auto;bottom:88px;left:auto;right:10px;max-height:52dvh}}
`;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const digitsFor = step => step >= 1 ? 0 : step < .001 ? 4 : step < .01 ? 3 : 2;
const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value; else if (key === 'text') node.textContent = value; else if (key in node) node[key] = value; else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
};

/* CONFIG and DEFAULTS are the page's live config and its defaults (objects of
   groups). CHANGED is called after anything here has written to CONFIG.
   PLAY(seconds) plays the chapter through; SCRUB(t) goes to a place in it,
   and WHERE() says where it is now — t is the chapter's own clock, 0 at its
   start and 1 at its end, negative while the drops are still arriving. */
export function mountLettersPanel({ config, defaults, changed = () => { }, play = null, scrub = null, where = null, open = true }) {
  // Keep this page's new choreography separate without deleting previous tuning.
  const STORE = config.logoDrops.directedHelix ? 'finnovation:letters-panel:highland-1-4-ascent:v1' : 'finnovation:letters-panel:highland-1-4-plain:v1';
  const rows = [];
  const read = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } };
  const write = patch => { try { localStorage.setItem(STORE, JSON.stringify({ ...read(), ...patch })); } catch { /* private mode: the panel still works, it only forgets */ } };
  const isColor = (group, key) => typeof defaults[group][key] === 'string';
  const same = (group, key) => isColor(group, key) ? String(config[group][key]).toLowerCase() === String(defaults[group][key]).toLowerCase() : Math.abs(config[group][key] - defaults[group][key]) < 1e-9;

  /* What was changed last time, back in place before the first frame that
     shows the panel. Only values the panel knows, and only inside their
     ranges: a stale or hand-edited store cannot push the scene somewhere odd. */
  const saved = read();
  for (const [, , items] of SECTIONS) for (const [, group, key, min, max] of items) {
    const value = saved.values?.[group + '.' + key];
    if (value === undefined || !(group in config) || !(key in defaults[group])) continue;
    if (isColor(group, key)) { if (/^#[0-9a-f]{6}$/i.test(value)) config[group][key] = value; }
    else if (Number.isFinite(value)) config[group][key] = clamp(value, min, max);
  }

  if (!document.getElementById('letters-panel-style')) document.head.append(el('style', { id: 'letters-panel-style', text: CSS }));
  const root = el('aside', { class: 'letters-panel is-idle', 'aria-label': '水滴字母參數', 'data-journey-ui': '' });
  const side = el('button', { type: 'button', 'aria-label': '換到另一側', title: '換到另一側', text: '⇄' });
  const fold = el('button', { type: 'button', 'aria-label': '收合參數列', title: '收合／展開（按 L 整個隱藏）', text: '−' });
  const body = el('div', { class: 'lp-body' });
  root.append(el('div', { class: 'lp-head' }, el('div', { class: 'lp-title', text: '水滴字母 · 參數' }), el('span', { class: 'lp-key', title: '按 L 隱藏／顯示', text: 'L' }), side, fold), body);

  /* ---- where in the chapter ---- */
  let scrubbing = false, watch = 0;
  const place = el('input', { type: 'range', min: -.45, max: 1, step: .001, 'aria-label': '章節位置' });
  const placeValue = el('output');
  if (scrub && where) {
    place.addEventListener('pointerdown', () => { scrubbing = true; });
    addEventListener('pointerup', () => { scrubbing = false; });
    place.addEventListener('input', () => { scrubbing = true; scrub(Number(place.value)); placeValue.textContent = Number(place.value).toFixed(2); });
    place.addEventListener('change', () => { scrubbing = false; });
    body.append(el('div', { class: 'lp-scrub', title: '章節位置：0＝本章開始，1＝結束；負數是水滴進場。拖動可以停在任何一格調整。' }, el('span', { text: '章節位置' }), place, placeValue));
    /* The page moves under its own scroll as well: the slider follows it. */
    const follow = () => {
      watch = requestAnimationFrame(follow);
      if (root.hidden || root.classList.contains('is-folded') || scrubbing) return;
      const t = clamp(where(), -.45, 1);
      if (Math.abs(t - Number(place.value)) > .0005) { place.value = t; placeValue.textContent = t.toFixed(2); }
    };
    watch = requestAnimationFrame(follow);
  }
  const actions = el('div', { class: 'lp-actions' });
  const action = (text, title, run) => { const button = el('button', { type: 'button', text, title }); button.addEventListener('click', run); actions.append(button); };
  if (scrub) action('到本章', '跳到 LOGO 章節開頭', () => scrub(0, true));
  if (play) { action('▶ 播放', '用穩定的速度把本章播一遍（約 9 秒）', () => play(9)); action('▶ 慢速', '慢慢播（約 16 秒），看清楚每個字', () => play(16)); }
  if (actions.children.length) body.append(actions);

  /* ---- the switches ---- */
  const axes = [];
  for (const [title, options] of AXES) {
    const keys = [];
    for (const [, patch] of options) if (patch) for (const [group, values] of Object.entries(patch)) for (const key of Object.keys(values)) if (!keys.some(k => k[0] === group && k[1] === key)) keys.push([group, key]);
    const seg = el('div', { class: 'lp-seg', role: 'group', 'aria-label': title });
    const buttons = options.map(([label, patch]) => {
      const button = el('button', { type: 'button', text: label, 'aria-pressed': 'false' });
      button.addEventListener('click', () => {
        for (const [group, key] of keys) config[group][key] = patch?.[group]?.[key] ?? defaults[group][key];
        commit();
      });
      seg.append(button);
      return { button, patch };
    });
    axes.push({ keys, buttons });
    body.append(el('div', { class: 'lp-axis' }, el('span', { text: title }), seg));
  }

  /* ---- every value by name ---- */
  const openSections = new Set(saved.sections ?? SECTIONS.filter(section => section[1]).map(section => section[0]));
  const sections = [];
  for (const [title, , items] of SECTIONS) {
    const count = el('i');
    const section = el('details', { class: 'lp-section' }, el('summary', {}, title, count));
    section.open = openSections.has(title);
    section.addEventListener('toggle', () => { if (section.open) openSections.add(title); else openSections.delete(title); write({ sections: [...openSections] }); });
    const mine = [];
    for (const [label, group, key, min, max, step, hint] of items) {
      if (!(group in config) || !(key in defaults[group])) continue;
      const color = isColor(group, key), id = 'lp-' + group + '-' + key;
      const caption = el('label', { for: id, text: label, title: (hint ? hint + '\n' : '') + '（雙擊名稱還原這一項）' });
      const input = el('input', color ? { id, type: 'color' } : { id, type: 'range', min, max, step });
      const value = color ? el('output', { for: id }) : el('input', { type: 'number', min, max, step, 'aria-label': label + ' 數值' });
      const row = el('div', { class: 'lp-row' }, caption, input, value);
      const digits = color ? 0 : digitsFor(step);
      const set = raw => {
        if (color) config[group][key] = raw;
        else {
          const number = Number(raw);
          if (raw === '' || !Number.isFinite(number)) { sync(); return; }
          /* On the slider's own steps, without the stray last digit that multiplying back by the step leaves. */
          config[group][key] = clamp(Number((Math.round(number / step) * step).toFixed(digits + 2)), min, max);
        }
        commit();
      };
      input.addEventListener('input', () => set(input.value));
      if (!color) value.addEventListener('change', () => set(value.value));
      caption.addEventListener('dblclick', event => { event.preventDefault(); set(defaults[group][key]); });
      const entry = { group, key, input, value, row, color, digits };
      rows.push(entry); mine.push(entry);
      section.append(row);
    }
    sections.push(() => { const n = mine.filter(r => !same(r.group, r.key)).length; count.textContent = n ? '已調 ' + n : ''; });
    body.append(section);
  }

  /* ---- what has been changed, and how to take it away ---- */
  const note = el('p');
  const copy = el('button', { type: 'button', text: '複製參數', title: '把改過的數值複製成文字——貼給工程師就能設成網站的預設值' });
  const reset = el('button', { type: 'button', text: '全部還原', title: '回到設計值，並清掉這個瀏覽器記住的調整' });
  const dump = el('textarea', { readOnly: true, hidden: true, 'aria-label': '改過的參數' });
  body.append(el('div', { class: 'lp-foot' }, note, el('div', { class: 'lp-buttons' }, copy, reset), dump));
  const changedValues = () => {
    const out = {};
    for (const r of rows) if (!same(r.group, r.key)) (out[r.group] ||= {})[r.key] = r.color ? config[r.group][r.key] : Number(Number(config[r.group][r.key]).toFixed(r.digits + 1));
    return out;
  };
  copy.addEventListener('click', async () => {
    const text = JSON.stringify(changedValues(), null, 2);
    dump.value = text; dump.hidden = false;
    try { await navigator.clipboard.writeText(text); copy.textContent = '已複製'; }
    catch { dump.focus(); dump.select(); copy.textContent = '請手動複製'; }
    setTimeout(() => { copy.textContent = '複製參數'; }, 1400);
  });
  reset.addEventListener('click', () => { for (const r of rows) config[r.group][r.key] = defaults[r.group][r.key]; dump.hidden = true; commit(); });

  /* The panel mirrors the config: called after anything writes to it, here
     or elsewhere (the workshop edits the same values). */
  function sync() {
    let n = 0;
    for (const r of rows) {
      const current = config[r.group][r.key], moved = !same(r.group, r.key);
      if (r.color) { r.input.value = current; r.value.textContent = current; }
      else { r.input.value = current; if (document.activeElement !== r.value) r.value.value = Number(current).toFixed(r.digits); }
      r.row.classList.toggle('is-changed', moved);
      if (moved) n++;
    }
    for (const { keys, buttons } of axes) for (const { button, patch } of buttons) {
      button.setAttribute('aria-pressed', String(keys.every(([group, key]) => { const want = patch?.[group]?.[key] ?? defaults[group][key]; return typeof want === 'string' ? config[group][key] === want : Math.abs(config[group][key] - want) < 1e-6; })));
    }
    for (const count of sections) count();
    note.textContent = n ? '已調整 ' + n + ' 項（標 • 的）。這些只記在這個瀏覽器裡——滿意後按「複製參數」把數值貼給我，就會變成網站的預設值。' : '目前是設計值。拖動滑桿即時生效；游標停在名稱上有說明，雙擊名稱還原單一項目。';
    if (!dump.hidden) dump.value = JSON.stringify(changedValues(), null, 2);
  }
  function commit() {
    const values = {};
    for (const r of rows) if (!same(r.group, r.key)) values[r.group + '.' + r.key] = config[r.group][r.key];
    write({ values });
    sync();
    changed();
  }

  /* Solid under the pointer or while a control in it has the keyboard; a
     ghost otherwise. */
  let inside = false;
  const idle = () => root.classList.toggle('is-idle', !inside && !root.contains(document.activeElement));
  root.addEventListener('pointerenter', () => { inside = true; idle(); });
  root.addEventListener('pointerleave', () => { inside = false; if (root.contains(document.activeElement) && document.activeElement.type !== 'number') document.activeElement.blur(); idle(); });
  root.addEventListener('focusin', idle);
  root.addEventListener('focusout', () => setTimeout(idle, 0));

  /* Folded, it is a tab in the corner — out of the picture's way, and still
     there to be found. L takes it off the page altogether (and brings it
     back), for a clean look at the frame; that is not remembered. */
  const setFolded = folded => { root.classList.toggle('is-folded', folded); fold.textContent = folded ? '+' : '−'; fold.setAttribute('aria-label', folded ? '展開參數列' : '收合參數列'); write({ folded }); };
  fold.addEventListener('click', () => setFolded(!root.classList.contains('is-folded')));
  const setSide = left => { root.classList.toggle('is-left', left); write({ left }); };
  side.addEventListener('click', () => setSide(!root.classList.contains('is-left')));
  const setOpen = shown => { root.hidden = !shown; };
  if (saved.folded) setFolded(true);
  if (saved.left) setSide(true);
  document.body.append(root);
  root.hidden = !open;
  sync();
  /* What was restored from the store has to reach the page as well. */
  if (rows.some(r => !same(r.group, r.key))) changed();

  return {
    element: root, sync, setOpen, get open() { return !root.hidden; },
    toggle() { setOpen(root.hidden); },
    dispose() { cancelAnimationFrame(watch); root.remove(); }
  };
}
