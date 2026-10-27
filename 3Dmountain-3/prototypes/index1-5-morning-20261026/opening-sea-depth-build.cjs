/* Opening sea depth, independently enabled for each page. Canyon water is unchanged. */
module.exports = ({ main, drops, letters, glass, html }) => {
  if (typeof html === 'string' && !html.includes('data-opening-sea-depth')) html = html.replace('<html ', '<html data-opening-sea-depth ');
  // Feather the mountain texture's lower edge too: it otherwise draws a straight stripe behind the sea.
  const rangeAnchor = "        c=mix(c,rc,uEnvRangeA.x);";
  if (main.includes(rangeAnchor)) main = main.replace(rangeAnchor, "        c=mix(c,rc,uEnvRangeA.x${document.documentElement.matches('[data-opening-refinement], [data-opening-sea-depth]') ? '*smoothstep(0.,.22+.035*sin(rAz*17.),rV)' : ''});");
  if (main.includes('/* opening-sea-depth-20261025 */')) return { main, drops, letters, glass, html };
  const anchor = '      const RIVER_ROOM_KEYS = ';
  if (main.split(anchor).length !== 2) throw Error('opening sea depth: material anchor');
  const patch = "      /* opening-sea-depth-20261025 */\n      if (document.documentElement.matches('[data-opening-refinement], [data-opening-sea-depth]')) {\n        // Blend with the actual sky; the unshifted reflection left a straight seam.\n        openingSeaMaterial.transparent = true;\n        openingSeaMaterial.fragmentShader = openingSeaMaterial.fragmentShader\n          .replace('vec3 nrm=normalize(vNormal);', \"vec3 nrm=normalize(vNormal);\\n      vec2 offshoreP=vWorld.xz;\\n      float midWater=smoothstep(9.,23.,vDist)*(1.-smoothstep(100.,220.,vDist));\\n      float rippleFootprint=length(fwidth(offshoreP));\\n      float midDetail=midWater*(1.-smoothstep(.6,2.8,rippleFootprint));\\n      nrm.x+=cos(dot(offshoreP,vec2(.43,.19))-uSeaTime*.38)*.024*midDetail;\\n      nrm.z+=cos(dot(offshoreP,vec2(-.21,.57))+uSeaTime*.29)*.032*midDetail;\")\n          .replace('float hz=smoothstep(uHaze.x,uHaze.y,vDist);', \"float waterAir=seaNoise(vWorld.xz*vec2(.035,.019)+vec2(uSeaTime*.009,-uSeaTime*.006));\\n      float hz=smoothstep(uHaze.x,uHaze.y,vDist+(waterAir-.5)*28.);\")\n          .replace('gl_FragColor=vec4(max(col,vec3(0.)),1.);', \"// Uneven mist reveals the actual backdrop beneath the lowered sea.\\n      float waterAir2=seaNoise(vWorld.xz*vec2(.021,.013)+vec2(-uSeaTime*.006,uSeaTime*.004));\\n      float offshore=smoothstep(28.,185.,vDist+(waterAir2-.5)*38.);\\n      float waterAlpha=1.-offshore;\\n      if(waterAlpha<.003)discard;\\n      gl_FragColor=vec4(max(col,vec3(0.)),waterAlpha);\");\n      }\n";
  main = main.replace(anchor, () => patch + anchor);
  return { main, drops, letters, glass, html };
};
