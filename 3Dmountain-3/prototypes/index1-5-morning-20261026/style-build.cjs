/* index1-5: Ascent typography, slate room and independent liquid wordmark.
   Used only by this page's build; source pages and shared modules stay intact. */
const fs = require('node:fs');
const path = require('node:path');
module.exports = ({ main, html }) => {
  main = main.replace(/\r\n/g, '\n');
  const edit = (find, replacement) => {
    const count = main.split(find).length - 1;
    if (count !== 1) throw new Error('index1-5 style anchor: ' + count + ' × ' + find.slice(0, 85));
    main = main.replace(find, () => replacement);
  };
  edit('      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));', `      /* Match index1-4-ascent's live art direction; this page keeps its own landscape and route. */
      Object.assign(CONFIG.field,{zenith:'#bacbd7',upper:'#d4e0e5',top:'#18374e',horizon:'#aebfc9',lower:'#657f8e',floor:'#294b60',ink:'#203b50',core:.9,coreSpread:.55,bandGain:.035});
      Object.assign(CONFIG.grade,{hue:0,sat:.93,temp:.015,tint:0});
      Object.assign(CONFIG.drop,{roughness:.028,f0:.94,aniso:.08,streak:1.55,iris:.58,irisEdge:1.35,contour:.55,card:.92,rim:.55,rimEdge:12,lens:.34,lensEdge:8.5});
      Object.assign(CONFIG.droplet,{sheen:1});
      Object.assign(CONFIG.chrome,{bands:1.5,bandPhase:.145,bandLight:1.2,bandInk:1.35,rail:2.1,railY:.48,f0:.88,rough:.024,aniso:.55,streak:1.15,iris:.085,irisPhase:2.4,irisEdge:3.5,occlude:.11});
      CONFIG.sea.screenDown=60;
      CONFIG.scene.exposure=.88;
      CONFIG.scene.grain=.006;
      Object.assign(CONFIG.distortion,{waveMorph:.85,amount:.72,waveAmplitude:.075,waveFrequency:1.15,waveSpeed:.60,twist:.055,twistFrequency:3.6,breathing:.038});
      Object.assign(CONFIG.logoDrops,{noPhotos:1,freeLetters:1,popSpray:0,fuseKick:0,letterSize:.115,swirlRadius:1.30,swirlLeaveStart:.54,swirlLeaveEnd:.90,swirlLeaveClimb:.25,swirlGloss:.66,swirlGlow:.30,swirlRing:.38,swirlCaustic:.42,glow:.30,rim:.34,haze:.26});
      Object.assign(CONFIG.logoLetters,{freeHelix:1,liquid:1,frost:0,needles:0,sparkle:0,locked:0,fused:0,clear:.95,iceEdge:.015,lockFlash:.08,fuseGlint:.45});
      Object.assign(CONFIG.logoGlass,{iorA:1.333,iorDelta:.005,iridescence:.008,sceneMix:.97,normalScale:.065,reflectionStrength:1.18,envRoughness:.022,frostBlur:.0008,iridPatch:.015,tiles:0,swell:.20,grain:.006,bubble:0,cloud:0,frost:0,frostFine:0,rough:.009,shade:.20,reflectFloor:.035,tint:'#f3fbff',sunSpec:.78,sunPow:245,rim:.075});
      Object.assign(CONFIG.logo,{bevel:.025,bevelSize:.0044,bevelSegments:8,curveSegments:64,edge:.012});
      CONFIG.portfolio.base=[.77,.83,.885];
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
  edit('logoGlass.update({ palette: CONFIG.field });', 'logoGlass.update({ palette: CONFIG.field, time, reducedMotion: reduceMotion });');
  edit('          spin: logoSpin.quaternion, scale: markScale, edge: L.edge, reducedMotion: reduceMotion', '          progress: tRaw, spin: logoSpin.quaternion, scale: markScale, edge: L.edge, reducedMotion: reduceMotion');
  edit('const writing = delivering && !lettering.assembled;', 'const writing = delivering && (!lettering.assembled || CONFIG.logoLetters.liquid);');
  edit('if (CONFIG.logoDrops.enabled > .5 && !(lettersBuilt && CONFIG.logoDrops.letters > .5)) void logoDrops.loadAssets();', 'if (!CONFIG.logoDrops.noPhotos && CONFIG.logoDrops.enabled > .5 && !(lettersBuilt && CONFIG.logoDrops.letters > .5)) void logoDrops.loadAssets();');
  edit('uEnvGlow: { value: new THREE.Vector3(1.00, 1.03, 1.10) },', 'uEnvGlow: { value: new THREE.Vector3(.676, .694, .686) },');
  // Keep the reference defaults stable until an editing panel is explicitly requested.
  edit("if (lookFlag !== null || /^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname))", "if (lookFlag !== null && !/^(0|false|off)$/i.test(lookFlag))");
  edit("const lettersWanted = !lettersOff && (lettersFlag !== null || /^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname));", 'const lettersWanted = !lettersOff && lettersFlag !== null;');
  edit("if (worldEpilogue && !/^(0|false|off)$/i.test(gradeFlag ?? '')", "if (worldEpilogue && gradeFlag !== null && !/^(0|false|off)$/i.test(gradeFlag ?? '')");
  const reference = fs.readFileSync(path.resolve(__dirname, '../../index1-4-ascent.html'), 'utf8');
  const copyBlock = /<main class="fi-copy"[\s\S]*?<\/main>/;
  const copy = reference.match(copyBlock);
  if (!copy || !copyBlock.test(html)) throw new Error('index1-5: chapter copy missing');
  html = html.replace(copyBlock, () => copy[0]);
  html = html.replace(/<html\b([^>]*?)>/, (_, attrs) => '<html' + attrs.replace(/\sdata-look="[^"]*"/g, '') + ' data-look="index1-5">');
  html = html.replace(/(<meta name="theme-color" content=")[^"]*/, '$1#1d3446');
  if (!html.includes('prototypes/index1-5-morning-20261026/index1-5.css')) html = html.replace(/(<link rel="icon")/, '<link rel="stylesheet" href="prototypes/index1-5-morning-20261026/index1-5.css">\n  $1');
  return { main, html };
};
