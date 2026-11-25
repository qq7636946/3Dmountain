/* Text reveal · the #16 "Filament" effect, ported for index1-5-canyon-forest.html (Team TX, 2026-11-17; client: 「字體特效使用16號」).

   From Codrops' "Text Character Animations with GSAP" (js/variations/filament.js), MIT License,
   Copyright (c) 2009 - 2026 Codrops (https://codrops.com); the full notice is in LICENSE-codrops-MIT.txt next to this file.

   The letters catch one after another in reading order, each line starting a moment after the one before, like lamps along a wall.
   A letter warms up like a filament: a dim, deep red glow on its strokes, heating through orange to a warm yellow-white, with a soft
   halo around it that's brightest when the letter is hottest. Then it cools to the plain text colour and the halo fades. Some letters
   flicker as they catch, two or three quick dips in brightness. Drawn by gl-text.js over the page text.

   What changed from the demo: the shader is the demo's, word for word, except that its output is multiplied by uAlpha (the chapter's
   own scroll-led opacity, and the hand-over fade), and that the heat colours are a palette: 'white' by default (client: 「這文案特效
   不要帶顏色 都是白色的漸層」: a dim cool grey glow brightening to a luminous white, no hue), 'original' = the demo's red → orange →
   warm white (?filament=red), 'gold' = amber → gold → warm white-gold (?filament=gold). Catch order, timing, flicker and halo are the
   demo's in every palette. The cooled end is paint(uColor.a): exactly the page text's colour.
   The timings are the demo's. */

export const settings = {
    // seconds each letter takes to warm up and cool down
    duration: 1,
    // seconds between two letters catching, and between the starts of two lines
    letter: 0.04,
    line: 0.3,
    overlap: true,
    // how soft the letters the halo is made from are, in em
    blur: 0.12,
    // no blending of the letters' starts: each letter keeps its own seed (its flicker)
    smoothStart: 0,
    // the halo spreads that blur over a disc this wide across, in em
    haloRadius: 0.32,
    // places on the disc the halo is gathered from
    haloTaps: 24,
    // how far the drawing reaches past the text, in em: room for the halo to fade out. The demo's 1em; the halo is zero beyond
    // haloRadius + the blur's reach (about .32 + .36 = .68em), so .75em draws the same picture on about a fifth fewer pixels
    pad: 0.75,
};

// The halo's taps, spread evenly over the disc on a sunflower spiral, in em
const taps = Array.from({length: settings.haloTaps}, (_, i) => {
    const k = i + 0.5;
    const radius = Math.sqrt(k / settings.haloTaps) * settings.haloRadius;
    const angle = k * 2.39996;
    return `vec2(${(Math.cos(angle) * radius).toFixed(4)}, ${(Math.sin(angle) * radius).toFixed(4)})`;
});

// The filament's light as it heats, 0 cold to 1 hottest
const GLOW = {
    // the page's default (client: 「這文案特效不要帶顏色 都是白色的漸層」): no hue, only a white ramp: a dim, barely cool grey glow
    // brightening to a luminous white a little brighter than the text colour; the cooled end is still exactly the text colour
    white: `vec3(0.955, 0.975, 1.0) * smoothstep(0.0, 0.8, heat)`,
    // the demo's: dark red, deep red, orange, warm white
    original: `vec3(
        smoothstep(0.0, 0.4, heat),
        0.88 * smoothstep(0.3, 0.95, heat),
        0.72 * smoothstep(0.65, 1.0, heat)
    )`,
    // the variant for the client to compare: the same ramp moved toward amber, gold and a warm white-gold (less red over the blue canyon)
    gold: `vec3(
        smoothstep(0.0, 0.35, heat),
        0.92 * smoothstep(0.0, 0.75, heat),
        0.74 * smoothstep(0.4, 1.0, heat)
    )`,
};

export const fragmentFor = (palette = 'white') => `
// The halo's taps, in em from this pixel, and its strength at the hottest
const int HALO_TAPS = ${settings.haloTaps};
const vec2 TAPS[HALO_TAPS] = vec2[HALO_TAPS](${taps.join(', ')});
const float HALO = 1.2;
// Shares of a letter's time: hottest at HOT, cooling from COOL to the end
const float HOT = 0.45;
const float COOL = 0.5;
// Letters with a seed below this flicker as they catch
const float FLICKERING = 0.4;

// How hot a letter is, 0 cold to 1 hottest, and how far it has cooled back
// to the text colour, at its own time t from 0 to 1
float heatAt(float t) {
    return smoothstep(0.0, HOT, t);
}

float coolAt(float t) {
    return smoothstep(COOL, 1.0, t);
}

// The filament's light as it heats
vec3 glow(float heat) {
    return ${GLOW[palette] || GLOW.white};
}

// Two or three quick dips in brightness in the first third, for the letters that flicker
float flicker(float t, float seed) {
    if ( seed >= FLICKERING ) return 1.0;
    // 0 to 1 among the flickering letters, to vary their dips
    float s = seed / FLICKERING;
    float dips = s < 0.5 ? 2.0 : 3.0;
    float bright = 1.0;
    for (int i = 0; i < 3; i++) {
        float k = float(i);
        if ( k >= dips ) break;
        float at = 0.07 + 0.085 * k + 0.03 * fract(s * 7.0 + k * 0.37);
        float depth = mix(0.55, 0.85, fract(s * 13.0 + k * 0.61));
        bright -= depth * (1.0 - smoothstep(0.0, 0.022, abs(t - at)));
    }
    return max(bright, 0.0);
}

// Light as premultiplied colour: as opaque as its brightest channel
vec4 light(vec3 rgb) {
    return vec4(rgb, max(rgb.r, max(rgb.g, rgb.b)));
}

void main() {
    // The halo: the blurred letters around this pixel, each glowing at its own
    // letter's time, so neighbouring letters and lines blend into one glow
    vec3 halo = vec3(0.0);
    for (int i = 0; i < HALO_TAPS; i++) {
        vec4 tap = texelNearby(TAPS[i] * uFontSize);
        if ( !hasLetter(tap) ) continue;
        float t = (uTime - letterStart(tap)) / uDuration;
        if ( t < 0.0 || t >= 1.0 ) continue;
        float heat = heatAt(t);
        halo += glow(heat) * tap.g * heat * heat * (1.0 - coolAt(t)) * flicker(t, letterSeed(tap));
    }
    halo = min(halo * HALO / float(HALO_TAPS), 1.0);

    // The letter itself: glowing as it heats, then cooling into the text colour
    vec4 here = texel();
    vec4 letter = vec4(0.0);
    if ( hasLetter(here) ) {
        float t = (uTime - letterStart(here)) / uDuration;
        vec4 cold = paint(uColor.a);
        if ( t >= 1.0 ) {
            letter = cold * here.r;
        } else if ( t >= 0.0 ) {
            vec4 hot = light(glow(heatAt(t)) * flicker(t, letterSeed(here)));
            letter = mix(hot, cold, coolAt(t)) * here.r;
        }
    }

    // The halo shows around the letter, wherever the letter doesn't cover it
    fragColor = (letter + light(halo) * (1.0 - letter.a)) * uAlpha;
}
`;
