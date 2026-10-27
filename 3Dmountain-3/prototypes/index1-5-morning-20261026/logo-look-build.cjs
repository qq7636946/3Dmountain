/* index1-5 only — 水字 · 本體質感: the LOGO body as clear LIQUID in the valley's light (2026-10-23).
 * Client: 「3D LOGO 這樣的特效是 OK，但就是本體風格設計視覺不夠好」, then on a first (icy, deep-blue) pass:
 * 「3D文字太爛了，用原本那個，我要液體感覺的3D文字」. Spec for the light: presets/logo-look-spec.md (visual director).
 * Run by build.cjs after letters-entrance-build.cjs and before opening-world-build.cjs.
 *
 * The original liquid-glass letters, kept as the base, made to read as WATER: a clear body that the scene is seen
 * through and bent by, rounded by surface tension, wet and lit by the valley — not ice, not tinted glass.
 *   BODY: a faint cyan where the water is thick (red goes first), the deep tint kept small.
 *   SURFACE: the water's edge — a bright meniscus line on the outline and a dark refraction ring just inside it (the
 *         ring a drop has), darker on the side away from the sun; the cobalt sky and the horizon reflected as one
 *         clean band; a warm rim where the low sun comes through the sun-side edge; a hot, warm wet glint; a little
 *         sky fill from above and the lake's bounce from below. Surface tension: the letters' own lens (the rounding
 *         of each stroke) can be dialled up, and the water's own flowing ripple is a touch stronger.
 *   LIGHT: the opening world's sun (CONFIG.openingWorld.sunAzimuth/sunElevation/sunColor; −18°/11°/#ffdcb8
 *         otherwise), turning toward −32° as the mark hands over to the canyon.
 * One GLSL chunk (GLACIER_GLSL) in the wordmark glass is used by the whole wordmark, each letter's glass, the brand
 * F's stroke and the letters' water while it forms (letters-water-fx.js reads it off the material), so the hand-over
 * from forming water to glass keeps one look. ?logolook=original (or 液體質感 0) shows the original body exactly.
 * Dials: 「水字 · 本體質感」 in the LOGO section. Effect, timing and the client's preset are untouched. */
function once(source, anchor, replacement) {
  const count = source.split(anchor).length - 1;
  if (count !== 1) throw Error('logo-look-build: anchor found ' + count + 'x: ' + anchor.slice(0, 90));
  return source.replace(anchor, () => replacement);
}
const BODY = '水字 · 本體質感';
const GLACIER_GLSL = String.raw`
  uniform float uGlOn,uGlDepth,uGlThick,uGlBand,uGlBandY,uGlRim,uGlInk,uGlFill,uGlBounce,uGlEdge,uGlGlint,uGlGlintPow,uGlLens,uGlInner,uGlCaustic;
  uniform vec3 uGlCore,uGlBandHigh,uGlBandLow,uGlRimCol,uGlInkCol,uGlFillCol,uGlBounceCol,uGlSun;
  /* What the surface being shaded knows about the glyph: how far in from its outline (wordmark heights, <0 unknown),
     how much it is a face rather than a wall (<0 unknown), which way the outline faces there (world), and how much
     of it is the brand's blue stroke. Set in main() by the letter's glass and the blue stroke; the defaults fall
     back to the view angle. */
  float glInner=-1.,glFace=-1.,glBrand=0.;
  vec3 glOutW=vec3(0.);
  /* The water's body: clear, a faint cyan where it is thick. */
  vec3 glacierBody(vec3 through,float NdV,float inner,float face,vec3 obj){
    if(uGlOn<.5)return through;
    float f=face<0.?smoothstep(.55,.95,NdV):face;
    float core=inner<0.?.4:clamp(inner/.06,0.,1.);
    float T=uGlThick*mix(1.,.15+.85*core,f)/max(NdV,.4);
    vec3 tr=exp(-uGlDepth*(1.-.8*glBrand)*T*vec3(.5,.2,.07));
    return mix(through*tr,uGlCore,clamp(uGlDepth*.16*core*f*(1.-glBrand),0.,.22));
  }
  /* The light on the water. */
  vec3 glacierSurface(vec3 color,vec3 N,vec3 V,float NdV,vec3 R,vec3 obj,float inner,float face,vec3 outW){
    if(uGlOn<.5)return color;
    vec3 S=normalize(uGlSun);
    float edge=1.-NdV;
    float f=face<0.?smoothstep(.55,.95,NdV):face;
    /* which way this bit faces across the picture (the outline's own direction on a letter), against the sun —
       which stands mostly behind the mark, a little up and to the left: left and top edges catch it */
    vec2 nxy=dot(outW.xy,outW.xy)>1e-6?normalize(outW.xy):(dot(N.xy,N.xy)>1e-6?normalize(N.xy):vec2(0.));
    float sunward=dot(nxy,normalize(S.xy+vec2(1e-4,0.)));
    float sunSide=smoothstep(.25,.85,sunward);
    /* the water's edge: a dark refraction ring just inside the outline, darker away from the sun ... */
    float ring=inner<0.?smoothstep(.3,.75,edge)*(1.-smoothstep(.82,.97,edge))
      :smoothstep(.003,.014,inner)*(1.-smoothstep(.02,.055,inner))*f;
    color=mix(color,color*.42+uGlInkCol*.3,clamp(uGlInk*ring*mix(1.,.55,sunSide),0.,1.));
    /* ... and the bright meniscus line on the outline itself, warm on the sun side */
    float meniscus=inner<0.?pow(edge,7.):(1.-smoothstep(0.,.007,inner))*f;
    color+=mix(vec3(.9,.95,1.),uGlRimCol,sunSide)*meniscus*uGlEdge;
    /* the sky in it: cobalt above, the bright horizon line, the haze below — strongest where the water turns away */
    float by=obj.y*.42+R.y*.8-uGlBandY;
    vec3 band=mix(uGlBandLow,uGlBandHigh,smoothstep(-.3,.45,by));
    float bandAmt=uGlBand*(.12+.88*pow(edge,1.4))*(1.-.5*glBrand);
    color=color*(1.-.25*bandAmt)+(band*.35+uGlBandLow*exp(-by*by/.006)*.75)*bandAmt;
    /* the low sun coming through the sun-side edge */
    color+=uGlRimCol*(inner<0.?pow(edge,2.2):(1.-smoothstep(0.,.035,inner))*f)*sunSide*uGlRim;
    /* a little sky from above, the lake from below */
    color+=uGlFillCol*uGlFill*smoothstep(-.1,.8,N.y)*edge;
    color+=uGlBounceCol*uGlBounce*smoothstep(.05,-.8,N.y);
    /* light inside the water: the room's windows seen off its back surface — what makes a drop sparkle — strongest
       where the water faces the lens */
    vec3 rIn=refract(V,N,.75);
    color+=textureCubeLodEXT(uEnv,vec3(rIn.x,rIn.y,-rIn.z),1.2).rgb*uGlInner*.35*f*(1.-.6*glBrand)*NdV;
    /* the low sun gathered by the rounded water onto its far side: a soft warm caustic just inside the far edge */
    float far=inner<0.?smoothstep(.2,.6,edge)*(1.-smoothstep(.7,.95,edge)):smoothstep(.012,.03,inner)*(1.-smoothstep(.045,.08,inner))*f;
    color+=mix(uGlRimCol,vec3(1.),.45)*far*smoothstep(.15,-.6,sunward)*uGlCaustic;
    /* the wet glint: small, hot, warm, high on the sun side */
    vec3 K=normalize(vec3(S.x*1.4,max(S.y,.1)*1.4+.4,.8));
    color+=mix(vec3(1.),uGlRimCol,.45)*pow(max(dot(R,K),0.),uGlGlintPow)*uGlGlint;
    return color;
  }
`;
module.exports = ({ main, drops, letters, glass, html }) => {
  /* ---- glass: the chunk, its uniforms and config, and the sun ---- */
  glass = once(glass, 'export const REFERENCE_LOGO_GLASS = {',
    "export const GLACIER_GLSL = /* glsl */`" + GLACIER_GLSL + "`;\n"
    + 'export const REFERENCE_LOGO_GLASS = {\n'
    + "  /* the liquid body in the valley's light (logo-look-build.cjs): off unless GL ON; colours sRGB */\n"
    + "  glOn:0, glCore:'#2c6aa6', glDepth:.55, glThick:1, glLens:1, glBandHigh:'#3b74b9', glBandLow:'#dbe6f0', glBand:.45, glBandY:.05,\n"
    + "  glRimColor:'#ffc690', glRim:.7, glInkColor:'#13233c', glInk:.55, glFillColor:'#3b74b9', glFill:.08, glBounceColor:'#4d7f8c', glBounce:.05,\n"
    + "  glEdge:.7, glGlint:1.3, glGlintPow:26, glInner:.5, glCaustic:.3,\n");
  glass = once(glass, "uSpecCap:'specCap'};",
    "uSpecCap:'specCap',uGlOn:'glOn',uGlDepth:'glDepth',uGlThick:'glThick',uGlLens:'glLens',uGlBand:'glBand',uGlBandY:'glBandY',uGlRim:'glRim',uGlInk:'glInk',uGlFill:'glFill',uGlBounce:'glBounce',uGlEdge:'glEdge',uGlGlint:'glGlint',uGlGlintPow:'glGlintPow',uGlInner:'glInner',uGlCaustic:'glCaustic'};");
  glass = once(glass, "const colorBindings=[['uTint','tint'],['uShadeColor','shadeColor'],['uSSSColor','sssColor']]",
    "const colorBindings=[['uTint','tint'],['uShadeColor','shadeColor'],['uSSSColor','sssColor'],['uGlCore','glCore'],['uGlBandHigh','glBandHigh'],['uGlBandLow','glBandLow'],['uGlRimCol','glRimColor'],['uGlInkCol','glInkColor'],['uGlFillCol','glFillColor'],['uGlBounceCol','glBounceColor']]");
  glass = once(glass, "uSunDir:{value:new THREE.Vector3(-.35,.28,-.9).normalize()},uSunCol:{value:new THREE.Color('#ffffff')}",
    "uSunDir:{value:new THREE.Vector3(-.35,.28,-.9).normalize()},uSunCol:{value:new THREE.Color('#ffffff')},\n"
    + "    uGlCore:{value:new THREE.Color()},uGlBandHigh:{value:new THREE.Color()},uGlBandLow:{value:new THREE.Color()},\n"
    + "    uGlRimCol:{value:new THREE.Color()},uGlInkCol:{value:new THREE.Color()},uGlFillCol:{value:new THREE.Color()},uGlBounceCol:{value:new THREE.Color()},\n"
    + "    uGlSun:{value:new THREE.Vector3(-.31,.19,-.93).normalize()}");
  glass = once(glass, '      vec3 perturb(vec3 P,vec3 N,vec3 mapN,vec2 uv){', '      ${GLACIER_GLSL}\n      vec3 perturb(vec3 P,vec3 N,vec3 mapN,vec2 uv){');
  glass = once(glass, 'vec3 through=acc/max(wsum,vec3(.001))*uTint;',
    'vec3 through=acc/max(wsum,vec3(.001))*uTint;\n        through=glacierBody(through,clamp(dot(N,-V),0.,1.),glInner,glFace,vObj);');
  glass = once(glass, '        color*=exp(-vec3(.085,.027,.012)*pow(1.-NdV,1.6));',
    '        color=glacierSurface(color,N,V,NdV,R,vObj,glInner,glFace,glOutW);\n        color*=exp(-vec3(.085,.027,.012)*pow(1.-NdV,1.6));');
  glass = once(glass, 'function update({palette,opacity=1,time=0,reducedMotion=false}={}){',
    'function update({palette,opacity=1,time=0,reducedMotion=false,sun=null}={}){\n'
    + '    /* the valley sun, when the page gives one: the liquid look lights by it (left as it was with the look off) */\n'
    + '    if(sun&&config.glOn>.5){uniforms.uGlSun.value.copy(sun.dir);uniforms.uSunDir.value.copy(sun.dir);uniforms.uSunCol.value.set(sun.color);}');
  glass = once(glass, "const reliefKeys=['tiles','swell','grain','reliefScale'];",
    "/* the letters' water while it forms reads the look from here (letters-water-fx.js) */\n  material.userData.glacierGlsl=GLACIER_GLSL;\n  const reliefKeys=['tiles','swell','grain','reliefScale'];");

  /* ---- letters: each letter's glass tells the chunk where its outline is; surface tension rounds it more ---- */
  letters = once(letters, 'float lens=pow(1.-smoothstep(0.,.105,ld),1.15)*.62*smoothstep(.6,.95,abs(vLetterN.z));',
    'float lens=pow(1.-smoothstep(0.,.105,ld),1.15)*.62*(uGlOn>.5?uGlLens:1.)*smoothstep(.6,.95,abs(vLetterN.z));glInner=ld;glFace=smoothstep(.6,.95,abs(vLetterN.z));glOutW=vLetterX*lg.x+vLetterY*lg.y;');

  /* ---- main: the brand stroke marks itself; the sun; the look's values (unless ?logolook=original); the dials ---- */
  main = once(main, "'        vec3 bTint=mix(uTint,bBlue,uBlueDensity);\\n' + body;",
    "'        vec3 bTint=mix(uTint,bBlue,uBlueDensity);glBrand=uBlueDensity;\\n' + body;");
  main = once(main, '        logoGlass.update({ palette: CONFIG.field, time, reducedMotion: reduceMotion });',
    '        logoGlass.update({ palette: CONFIG.field, time, reducedMotion: reduceMotion, sun: glacierSun() });');
  main = once(main, '      function updateBrandMark(p, progress, time, mix) {',
    `      /* 水字本體的主光＝開場世界的太陽（左上、低角度、暖色）；交給峽谷時轉向 −32°。導演的 CONFIG.openingWorld 有值就照它。 */
      const glacierSunState = { dir: new THREE.Vector3(), color: '#ffdcb8' };
      function glacierSun() {
        const W = CONFIG.openingWorld || {}, d = THREE.MathUtils.degToRad;
        const az = d(THREE.MathUtils.lerp(W.sunAzimuth ?? -18, W.handoverAzimuth ?? -32, easeJourney(logoFlight.t / .8))), el = d(W.sunElevation ?? 11);
        glacierSunState.dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
        glacierSunState.color = typeof W.sunColor === 'string' ? W.sunColor : '#ffdcb8';
        return glacierSunState;
      }
      function updateBrandMark(p, progress, time, mix) {`);
  main = once(main, 'const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',
    '/* 水字 · 本體質感（客戶 2026-10-23「我要液體感覺的3D文字」）：原本的液態玻璃字當底，讀起來像水——清透、看得到後面被水彎曲的山與天、\n'
    + '         表面張力圓邊、濕亮的高光；山谷的光只當打光（暖金邊、冷影、天空反射帶）。網址 ?logolook=original＝原本的本體，一個數字都不動。 */\n'
    + "      if (new URLSearchParams(location.search).get('logolook') !== 'original') {\n"
    + "        Object.assign(CONFIG.logoGlass, { tint: '#edf6fd', shadeColor: '#1b3352', shade: .3, sss: .04, iridescence: .006, iridPatch: 0,\n"
    + '          sunSpec: .9, envSky: 1, envStudio: .3, sceneDepth: 12, normalScale: .085, glOn: 1, glLens: 1.9, glDepth: .3 });\n'
    + '      }\n'
    + '      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));');
  main = once(main, "          ['卡牌轉場 Cards', [",
    `          /* 水字 · 本體質感：字標本體＝清透的水。看得到後面被水彎曲的景；表面張力圓邊；邊上一圈暗環＋一條亮的水邊線；
             鈷藍天到霧白的反射帶；太陽側暖金邊、濕亮高光。0 關掉＝原本的玻璃（網址 ?logolook=original 連數值都是原本的）。 */
          ['${BODY}', [
            ['液體質感（0 原本／1 山谷光的水）', 'logoGlass', 'glOn', 0, 1, 1],
            ['清面色（透光）', 'logoGlass', 'tint'], ['水的色調（厚處）', 'logoGlass', 'glCore'],
            ['色調深度', 'logoGlass', 'glDepth', 0, 2, .01], ['厚度', 'logoGlass', 'glThick', 0, 3, .01],
            ['表面張力圓邊', 'logoGlass', 'glLens', 0, 2.5, .01], ['折射深度（看穿後面的彎曲）', 'logoGlass', 'sceneDepth', 0, 24, .1],
            ['折射率', 'logoGlass', 'iorA', 1, 1.6, .005], ['水紋流動', 'logoGlass', 'normalScale', 0, .4, .005],
            ['邊緣暗環', 'logoGlass', 'glInk', 0, 1.2, .01], ['暗環色', 'logoGlass', 'glInkColor'], ['水邊亮線', 'logoGlass', 'glEdge', 0, 2, .01],
            ['反射帶 · 天', 'logoGlass', 'glBandHigh'], ['反射帶 · 地平線', 'logoGlass', 'glBandLow'],
            ['反射帶強度', 'logoGlass', 'glBand', 0, 1.5, .01], ['反射帶高低', 'logoGlass', 'glBandY', -1, 1, .01],
            ['反射強度', 'logoGlass', 'reflectionStrength', 1, 2.5, .01], ['天空反射', 'logoGlass', 'envSky', 0, 2, .01], ['棚燈反射', 'logoGlass', 'envStudio', 0, 1, .01],
            ['暖金邊光色', 'logoGlass', 'glRimColor'], ['暖金邊光', 'logoGlass', 'glRim', 0, 2, .01],
            ['水中反光（內部）', 'logoGlass', 'glInner', 0, 2, .01], ['遠側焦散', 'logoGlass', 'glCaustic', 0, 1.5, .01],
            ['濕亮高光', 'logoGlass', 'glGlint', 0, 3, .01], ['高光銳利度', 'logoGlass', 'glGlintPow', 8, 400, 1], ['太陽高光', 'logoGlass', 'sunSpec', 0, 2, .01],
            ['冷陰影色', 'logoGlass', 'shadeColor'], ['冷陰影', 'logoGlass', 'shade', 0, 1, .01],
            ['天空補光', 'logoGlass', 'glFill', 0, .6, .01], ['湖面反光', 'logoGlass', 'glBounce', 0, .5, .01],
            ['品牌藍濃度', 'logo', 'logo3Blue', 0, 1, .01], ['品牌藍亮度', 'logo', 'logo3Glow', 0, 1.5, .01]
          ]],
          ['卡牌轉場 Cards', [`);
  main = once(main, "'水字 · 出海成字', '山體建模',", `'水字 · 出海成字', '${BODY}', '山體建模',`);
  main = once(main, '        motionActions.append(playSeam, playChapter, editRhythm, editCount, editWater, editLetters, editMotion);',
    `        const editBody = document.createElement('button'); editBody.type = 'button'; editBody.textContent = '本體質感';
        editBody.addEventListener('click', () => jumpTo('${BODY}'));
        motionActions.append(playSeam, playChapter, editRhythm, editCount, editWater, editBody, editLetters, editMotion);`);
  return { main, drops, letters, glass, html };
};
