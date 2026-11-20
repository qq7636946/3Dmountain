/* Text reveal · the chapter titles of index1-5-canyon-forest.html in the Codrops type, with the demo's #16 "Filament" reveal (default) or
   its #19 "Caustics" (?typefx=caustics) (Team TX, 2026-11-17; the folder and file keep the first request's name).

   Client: 「TextCharacterAnimations-main 字體改成這資料夾的字體然後特效改成 19號的特效，然後這樣排版 可以後面再改」
   = the demo folder's fonts (Host Grotesk for the big words, Plus Jakarta Sans for the text), its effect no. 19 (Caustics: each letter
   first shows as caustic light thrown through moving water, then the water calms into the crisp letter), then 「字體特效使用16號」: no. 16
   (Filament: each letter catches like a lamp filament, deep red through orange to warm white with a soft halo, some flickering, then
   cools to the text colour); Caustics stays behind ?typefx=caustics. And the client's layout,
   then moved on the mock-up (an arrow from the upper-left paragraph to under the title: 「擺到下面好了」) and trimmed (「拿掉  變兩排英文
   一排中文共三排」: no FINNOVATION chip, two English lines and one Chinese line): one centred column low on the screen: the kicker,
   a huge thin title over the water, under it two short English lines and the chapter's Chinese line, the chapter's button at the foot. The upper part stays clear: the glass mark, the drop and the canyon are untouched.
   2026-11-18 (client: 「文字字體改回去原本的oswald 字體跟大小。 特效維持」): the type is the page's own again (title Oswald 500 at the
   page's title size, kicker and button Oswald, Chinese line Noto Sans TC 22 px, the English lines the page's running text); the layout
   and the Filament reveal stay. The reveal draws in the face and size the page text has (gl-text.js reads them), so the fonts awaited
   below are read from the chapters' own computed styles. Host Grotesk / Plus Jakarta Sans are no longer used.

   Every chapter of the canyon and of the view from above (INSIGHT WITH DISCIPLINE … FOUR PATHS ONE VISION, and the four paths' own
   panels) takes it; the opening chapter (#chapter-knowledge) keeps its own layout.

   WHEN: the page still decides when a title comes and goes. flow2-hud.js shows a title (class f2s-on) when its words' scroll-led
   opacity rises past half (copy-motion.js), and takes it away when they fade; this file watches that class. When a title comes in,
   its title plays the reveal, then its paragraph line after line, then its Chinese line (gl-text.js, one shared canvas), each block
   at the page's own scroll-led opacity; then the canvas hands over to the crisp page text and goes idle. When the chapter leaves, the page's own fade
   takes the text away (the hud's streak is replaced by a short fade here); once it is fully gone, it is ready to play again.
   A chapter that comes back while it is still fading out simply stays (no replay over visible text).

   COST: nothing is drawn unless a reveal plays; the shared canvas spans only the playing blocks (plus 24 px) and is 1×1 and hidden
   otherwise; textures are worked out in a worker, only for the chapter on screen and its two neighbours, in idle moments.

   Switches: ?type=old = today's typography and title motion (the head line does not set html[data-tx-type], nothing here runs).
   ?typefx=caustics = the #19 Caustics reveal instead of Filament. Filament's heat colours: white by default (「這文案特效不要帶顏色
   都是白色的漸層」: grey → luminous white → the text colour, no hue; title, English lines and Chinese line alike), ?filament=red = the
   demo's red → orange → warm white, ?filament=gold = amber → gold → warm white-gold. html[data-tx-fx] says which runs.
   Under "reduce motion" the text is simply there (the new type and layout, no reveal). Without WebGL2: the text fades in.
   Live: window.__FLOW2_TX__ = { tune, stage, states, boxes(), replay(id), seek(t), stats() }.

   For the light beam (prototypes/canyon-seagull/flow2-light-beam.js "title hold"): its union of '.fi-copy-kicker, h1, h2, .fi-copy-zh'
   in the active panel still covers the whole column (kicker above the title, Chinese line under the paragraph); the paragraph itself is
   '.tx-lines'. __FLOW2_TX__.boxes() gives { title, lede } boxes in CSS px (lede = kicker + paragraph + Chinese line). */

import * as caustics from './caustics.js?v=1';
import * as filament from './filament.js?v=3-white';
import {TextStage, TextBlock} from './gl-text.js?v=3-e1';

/* ================================================================== PLACEHOLDER COPY — for the client to replace
   Two short English lines per chapter, under the title, above the chapter's own Chinese line (client: 「變兩排英文一排中文共三排」).
   Written by Team TX as placeholders in the brand's voice (approach, insight, discipline, long-term value); NOT approved copy.
   Replace the strings below (one string per line, about 45–55 characters each). */
/* 2026-11-17 (client: 「章節英文…要換成正式文案。可以」): the lines below are the release copy, each chapter's two English lines
   saying what its Chinese line says (以科技洞察市場… / 讓洞察形成方向… / 讓資源流向… / 知識、科技、企業… / 四大投資領域…). */
const PLACEHOLDER_COPY = {
    innovation: [
        'We read markets through technology,',
        'and turn insight into long-term value with discipline.',
    ],
    convergence: [
        'Insight gives us our direction;',
        'capital moves forward with it.',
    ],
    value: [
        'We direct resources to where value is real:',
        'businesses built to grow, and built to last.',
    ],
    perspective: [
        'Knowledge, technology, enterprise, talent and capital',
        'meet at Finnovation, and grow stronger together.',
    ],
    strategies: [
        'Four fields of investment, one vision:',
        'connecting technology and finance to industry value.',
    ],
};
/* ================================================================== end of placeholder copy */

const html = document.documentElement;
const Q = new URLSearchParams(location.search);
const FX = Q.get('typefx') === 'caustics' ? 'caustics' : 'filament';
const PALETTE = {red: 'original', original: 'original', gold: 'gold'}[Q.get('filament')] || 'white';
const EFFECT = FX === 'caustics'
    ? {settings: {overlap: true, ...caustics.settings}, fragment: caustics.fragment}
    : {settings: {...filament.settings}, fragment: filament.fragmentFor(PALETTE)};
const settings = EFFECT.settings;
const T = {
    wait: 1100,         // ms a coming title waits for its textures before it simply fades in (a cold first load builds in ≈ .75 s)
    rearm: 450,         // ms after a chapter left before it is ready to play again (its fade-out is done by then)
    keep: 3,            // chapters whose textures are kept (the one on screen and its neighbours)
    zh: true,           // the Chinese line plays the reveal too (after the paragraph's lines)
    after: 0.45,        // s after the title's first letter before the paragraph's first letter
    maxPixelRatio: 1.5, // the canvas's device pixels per CSS pixel, at most
    // the curve on the drawn letters' edges (gl-text.js `edge`; its default 2.4 thinned the canvas letters to Host Grotesk Light's page
    // weight). Oswald / Noto Sans TC (2026-11-18): 1 = the canvas letters as heavy as the page text at the hand-over (bright pixels over
    // the title, canvas / page, at 1880×930: 1.00 with 1, .93–.95 with 2.4; English lines .95 vs .64–.68; Chinese line 1.02–1.04 vs .77–.82)
    edge: 1,
};

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const alphaOf = el => {
    if (!el) return 0;
    const v = parseFloat(el.style.getPropertyValue('--copy-alpha'));
    return Number.isFinite(v) ? v : 1;
};
const idle = fn => (window.requestIdleCallback ? requestIdleCallback(fn, {timeout: 1500}) : setTimeout(fn, 60));

function boot() {
    const main = document.querySelector('.finnovation-ui main.fi-copy') || document.querySelector('main.fi-copy');
    if (!main) return void setTimeout(boot, 250);
    html.dataset.txFx = FX === 'filament' ? FX + '-' + PALETTE : FX;
    const stage = new TextStage({fragment: EFFECT.fragment, host: main, settings, maxPixelRatio: T.maxPixelRatio, edge: T.edge});
    Object.defineProperty(stage.opts, 'maxPixelRatio', {get: () => T.maxPixelRatio});   // the dial is live (the next textures built use it)
    Object.defineProperty(stage.opts, 'edge', {get: () => T.edge});                     // likewise
    let enabled = !reduced.matches;
    const states = [];

    /* ---- the chapters: the paragraph put in (placeholder copy), the Chinese line given one wrapper (its page-text opacity) */
    for (const panel of main.querySelectorAll(':scope > .fi-copy-panel')) {
        if (panel.id === 'chapter-knowledge') continue;
        const h = panel.querySelector(':scope > h1, :scope > h2');
        if (!h) continue;
        let lines = null;
        const copy = PLACEHOLDER_COPY[panel.dataset.copy];
        if (copy) {
            lines = document.createElement('div');
            lines.className = 'tx-lines';
            lines.lang = 'en';
            for (const text of copy) {
                const p = document.createElement('p');
                p.textContent = text;
                lines.append(p);
            }
            h.after(lines);   // reading order: kicker, title, paragraph, Chinese line
        }
        const zh = panel.querySelector(':scope > .fi-copy-zh');
        if (zh && !zh.querySelector(':scope > .tx-zh-in')) {
            const wrap = document.createElement('span');
            wrap.className = 'tx-zh-in';
            wrap.append(...zh.childNodes);
            zh.append(wrap);
        }
        const st = {panel, h, lines, zh, shown: false, armed: false, playing: 0, leftAt: -1e9, token: null, used: 0};
        st.blocks = [new TextBlock({stage, name: panel.id + ' title', lines: () => [st.h], dom: h, colorEl: h})];
        // the title first; the paragraph under it follows, line after line, then the Chinese line
        if (lines) st.blocks.push(new TextBlock({stage, name: panel.id + ' lines', lines: () => [...lines.children], dom: lines, lift: lines, alpha: () => alphaOf(lines), start: T.after, colorEl: lines.firstElementChild}));
        if (zh && T.zh) st.blocks.push(new TextBlock({stage, name: panel.id + ' zh', lines: () => [zh], dom: zh, lift: zh, alpha: () => alphaOf(zh), start: (lines ? T.after : 0) + (copy ? copy.length : 0) * settings.line, colorEl: zh}));
        states.push(st);
    }
    if (!states.length) return;

    /* ---- is a chapter's title standing? (flow2-hud's class; without the hud, the words' own scroll-led opacity) */
    const isShown = st => {
        if (window.__RISE_RHYTHM__ && !window.__RISE_RHYTHM__.canShowCopy()) return false;
        const h = st.h;
        if (h.classList.contains('f2s')) return h.classList.contains('f2s-on');
        const inks = h.getElementsByClassName('flow-copy-ink');
        if (!inks.length) return getComputedStyle(st.panel).visibility !== 'hidden';
        let sum = 0;
        for (const ink of inks) {
            const a = parseFloat(ink.style.getPropertyValue('--copy-ink-alpha'));
            sum += Number.isFinite(a) ? a : 1;
        }
        return sum / inks.length >= 0.5;
    };
    const doms = st => [st.h, st.lines, st.zh].filter(Boolean);
    const arm = st => {
        if (!enabled) return;
        st.armed = true;
        for (const el of doms(st)) {
            el.classList.remove('tx-fade');
            el.style.setProperty('--tx-dom', '0');
        }
    };
    const unmask = (st, fade) => {
        st.armed = false;
        for (const el of doms(st)) {
            el.classList.toggle('tx-fade', !!fade);
            el.style.removeProperty('--tx-dom');
        }
    };

    /* ---- textures: the chapter on screen and its neighbours, built in idle moments (never while a reveal plays) */
    let queue = [], building = false;
    const near = () => {
        let i = states.findIndex(s => s.shown);
        if (i < 0) i = states.findIndex(s => s.panel.classList.contains('is-active'));
        if (i < 0) i = 0;
        return [i, i + 1, i - 1].filter(k => k >= 0 && k < states.length).map(k => states[k]);
    };
    const schedule = () => {
        if (!enabled) return;
        queue = near();
        const keep = new Set(queue.slice(0, T.keep));
        for (const s of states) if (!keep.has(s) && !s.playing) s.blocks.forEach(b => b.forget());
        pump();
    };
    const pump = () => {
        if (building || !queue.length) return;
        if (stage.active.size) return void setTimeout(pump, 400);
        building = true;
        idle(async () => {
            const st = queue.shift();
            try {
                for (const b of st.blocks) await b.build();
            } catch (error) {
                console.warn('text reveal: build', error);
            }
            building = false;
            pump();
        });
    };

    /* ---- a title comes in: play, or (textures late) wait a moment, or fade in */
    const prepared = st => stage.ready && st.blocks.every(b => b.ready && b.measure()?.key === b.dataKey);
    const start = st => {
        st.armed = false;
        st.used = performance.now();
        const done = () => {
            st.playing = Math.max(0, st.playing - 1);
            if (!st.playing) schedule();
        };
        for (const b of st.blocks) {
            if (b.ready && stage.play(b, done)) st.playing++;
            else {
                b.dom?.classList.add('tx-fade');
                b.dom?.style.removeProperty('--tx-dom');
            }
        }
        if (!st.playing) schedule();
    };
    const enter = st => {
        st.shown = true;
        if (!st.armed) return;
        if (prepared(st)) return start(st);
        const token = (st.token = {});
        const late = setTimeout(() => {
            if (st.token !== token || !st.shown) return;
            st.token = null;
            unmask(st, true);
        }, T.wait);
        Promise.all([stage.warm(), ...st.blocks.map(b => b.build())]).then(() => {
            if (st.token !== token || !st.shown) return;
            clearTimeout(late);
            st.token = null;
            if (prepared(st)) start(st);
            else unmask(st, true);
        });
    };
    const leave = st => {
        st.shown = false;
        st.token = null;
        st.leftAt = performance.now();
        for (const b of st.blocks) stage.leave(b);
    };
    const check = st => {
        const now = isShown(st);
        if (now && !st.shown) enter(st);
        else if (!now && st.shown) leave(st);
        else if (!now && !st.armed && !st.playing && enabled && performance.now() - st.leftAt > T.rearm && alphaOf(st.lines) < 0.02 && alphaOf(st.zh) < 0.02 && getComputedStyle(st.panel).visibility === 'hidden') arm(st);
    };

    /* ---- layout helper: a desktop title that would not fit between the frame's margins is made smaller, and where it would reach
       the height of the side columns (the section list on the left, where-you-are on the right; short screens) it keeps clear of them */
    const range = document.createRange();
    const contentRect = el => {
        range.selectNodeContents(el);
        return range.getBoundingClientRect();
    };
    const unionOf = els => {
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
        for (const e of els) {
            const x = e.getBoundingClientRect();
            if (x.width < 1 || x.height < 1 || x.bottom < 0 || x.top > innerHeight) continue;
            l = Math.min(l, x.left);
            t = Math.min(t, x.top);
            r = Math.max(r, x.right);
            b = Math.max(b, x.bottom);
        }
        return r > l ? {left: l, top: t, right: r, bottom: b} : null;
    };
    // (a chapter whose reveal is playing keeps its size until it has ended: its letters were measured at that size)
    const layout = () => {
        const free = states.filter(st => !st.playing);
        for (const st of free) st.h.style.removeProperty('--tx-fit');
        const ms = getComputedStyle(main);
        const side = parseFloat(ms.getPropertyValue('--tx-title-side')) || 0;
        const M = main.getBoundingClientRect();
        const rail = unionOf(document.querySelectorAll('.fi-rail > [data-section], .fi-rail > button'));
        const right = unionOf(document.querySelectorAll('.f2u-side > *'));
        const rects = free.map(st => (getComputedStyle(st.h).whiteSpace === 'nowrap' ? contentRect(st.h) : null));
        const fits = rects.map(r => {
            if (!r || r.width < 1) return 1;
            let margin = side;
            const meets = c => c && r.top < c.bottom + 10 && r.bottom > c.top - 10;
            if (meets(rail) && rail.left < M.left + M.width / 2) margin = Math.max(margin, rail.right - M.left + 24);
            if (meets(right) && right.right > M.left + M.width / 2) margin = Math.max(margin, M.right - right.left + 24);
            const avail = M.width - 2 * margin;
            return r.width > avail && avail > 0 ? avail / r.width : 1;
        });
        free.forEach((st, i) => fits[i] < 1 && st.h.style.setProperty('--tx-fit', fits[i].toFixed(4)));
    };

    /* ---- watching: the hud's class on each title (at once), the active chapter (textures), and a slow look for the rest */
    const mo = new MutationObserver(records => {
        const seen = new Set();
        for (const r of records) {
            const st = states.find(s => s.h === r.target || s.panel === r.target);
            if (st && !seen.has(st)) {
                seen.add(st);
                check(st);
                if (r.target === st.panel) {
                    layout();
                    schedule();
                }
            }
        }
    });
    for (const st of states) {
        mo.observe(st.h, {attributes: true, attributeFilter: ['class']});
        mo.observe(st.panel, {attributes: true, attributeFilter: ['class']});
    }
    // the side columns are built and shown by the page's modules after this runs: the title fit is looked at again until they stand
    let sidesSeen = false;
    setInterval(() => {
        if (document.hidden) return;
        states.forEach(check);
        if (!sidesSeen && document.body.classList.contains('is-ready') && document.fonts.status === 'loaded') {
            sidesSeen = !!document.querySelector('.fi-rail > button, .fi-rail > [data-section]')?.getBoundingClientRect().width;
            layout();
        }
    }, 250);
    let resizeTimer = 0;
    addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            layout();
            schedule();
        }, 220);
    });

    /* ---- start: the chapters not on screen are made ready to play (page text hidden until their reveal); the one already standing
       (if any) is left as it is. WebGL is started now (compiled in the background), the fonts are awaited, the textures follow. */
    if (enabled) {
        for (const st of states) {
            st.shown = isShown(st);
            if (!st.shown) arm(st);
        }
    }
    // the faces the reveal draws with: whatever the page gives the title's letters, the English lines and the Chinese line (Oswald,
    // Noto Sans TC since 2026-11-18), each loaded for the text it has to draw
    const faces = new Map();
    for (const st of states) {
        const kicker = st.panel.querySelector(':scope > .fi-copy-kicker');
        for (const [el, text] of [[st.h.querySelector('.flow-copy-ink') || st.h, st.h], [st.lines?.firstElementChild, st.lines], [st.zh, st.zh], [kicker, kicker]]) {
            if (!el) continue;
            const cs = getComputedStyle(el);
            const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
            faces.set(font, (faces.get(font) || '') + text.textContent);
        }
    }
    const fonts = Promise.all([...faces].map(([font, text]) => document.fonts.load(font, [...new Set(text.replace(/\s+/g, '') + 'A')].join('')))).catch(() => null);
    if (enabled) {
        stage.warm().then(ok => {
            if (ok) return;
            enabled = false;
            html.dataset.txGl = 'off';
            for (const st of states) if (st.armed) unmask(st, true);
        });
    }
    fonts.then(() => {
        layout();
        schedule();
        states.forEach(check);
    });
    reduced.addEventListener?.('change', () => {
        enabled = !reduced.matches && html.dataset.txGl !== 'off';
        if (!enabled) for (const st of states) if (st.armed) unmask(st);
    });

    /* ---- live / test hooks */
    const find = id => states.find(s => s.panel.id === id || s.panel.dataset.copy === id) || states.find(s => s.shown);
    const box = els => {
        let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
        for (const el of els) {
            if (!el) continue;
            const x = contentRect(el);
            if (x.width < 1) continue;
            l = Math.min(l, x.left);
            t = Math.min(t, x.top);
            r = Math.max(r, x.right);
            b = Math.max(b, x.bottom);
        }
        return r > l ? {left: l, top: t, right: r, bottom: b} : null;
    };
    window.__FLOW2_TX__ = {
        tune: T,
        stage,
        states,
        layout,
        boxes() {
            const st = states.find(s => s.panel.classList.contains('is-active')) || states.find(s => s.shown);
            if (!st) return {title: null, lede: null};
            return {title: box([st.h]), lede: box([st.panel.querySelector(':scope > .fi-copy-kicker'), st.lines, st.zh])};
        },
        // plays a chapter's reveal again (tests, pictures): the chapter must be standing
        async replay(id) {
            const st = find(id);
            if (!st || !isShown(st)) return 'not shown';
            for (const b of st.blocks) stage.finish(b, true);
            st.playing = 0;
            await Promise.all([stage.warm(), ...st.blocks.map(b => b.build())]);
            arm(st);
            st.shown = false;
            enter(st);
            return st.playing ? 'playing' : 'not ready';
        },
        // holds every playing block at t seconds (null lets them run on)
        seek(t) {
            stage.seekTime = t;
            if (stage.active.size && !stage.raf) stage.raf = requestAnimationFrame(stage.frame);
        },
        stats() {
            const S = stage.stats;
            return {...S, gpu: S.gpu.slice(-400), cpuMean: S.frames ? S.cpuSum / S.frames : 0, pxMean: S.frames ? S.px / S.frames : 0, active: stage.active.size, ready: stage.ready, built: states.map(s => s.blocks.map(b => b.ready))};
        },
    };
    html.dataset.txReady = '';
}

if (html.dataset.txType === 'caustics') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
    else boot();
}
