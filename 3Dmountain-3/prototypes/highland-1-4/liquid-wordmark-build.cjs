/* Local liquid-wordmark patches. Generated files are written by build.cjs. */
module.exports = ({ main, letters, glass }) => {
  glass=glass.replace(/\r\n/g,'\n');
  const edit=(s,a,b)=>{if(s.split(a).length!==2)throw Error('liquid wordmark anchor '+a.slice(0,80));return s.replace(a,b)};
  main=edit(main,'      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));',`      Object.assign(CONFIG.logoGlass,{iorA:1.333,iorDelta:.005,iridescence:.008,sceneMix:.97,normalScale:.065,reflectionStrength:1.18,envRoughness:.022,frostBlur:.0008,iridPatch:.015,tiles:0,swell:.20,grain:.006,bubble:0,cloud:0,frost:0,frostFine:0,rough:.009,shade:.20,reflectFloor:.035,tint:'#f3fbff',sunSpec:.78,sunPow:245,rim:.075});
      Object.assign(CONFIG.logoLetters,{liquid:1,frost:0,needles:0,sparkle:0,locked:0,fused:0,clear:.95,iceEdge:.015,lockFlash:.08,fuseGlint:.45});
      Object.assign(CONFIG.logo,{bevel:.025,bevelSize:.0044,bevelSegments:8,curveSegments:64,edge:.012});
      const DEFAULT_CONFIG = JSON.parse(JSON.stringify(CONFIG));`);
  main=edit(main,'logoGlass.update({ palette: CONFIG.field });','logoGlass.update({ palette: CONFIG.field, time, reducedMotion: reduceMotion });');
  letters=edit(letters,'letter.uniforms.uIce.value = frost;','letter.uniforms.uIce.value = config.liquid ? 0 : frost;');
  glass=edit(glass,'uBackdrop:{value:target.texture},','uLiquidTime:{value:0},uLiquidAmount:{value:1},\n    uBackdrop:{value:target.texture},');
  glass=edit(glass,'      varying vec2 vUv;\n      void main(){',`      varying vec2 vUv;
      uniform float uLiquidTime,uLiquidAmount;
      void main(){`);
  glass=edit(glass,'        vec4 w=modelMatrix*vec4(position,1.);',`        float t=uLiquidTime;
        vec3 lp=position;
        lp.x+=sin(position.y*5.2+position.x*2.1+t*.74)*.006*uLiquidAmount;
        lp.y+=sin(position.x*3.5+position.y*2.0-t*.63)*.010*uLiquidAmount;
        lp.z+=sin(position.x*5.0+position.y*3.1+t*.81)*.008*uLiquidAmount;
        vec4 w=modelMatrix*vec4(lp,1.);`);
  glass=edit(glass,'      uniform sampler2D uBackdrop,uSpectrum,uNormalMap;', '      uniform float uLiquidTime,uLiquidAmount;\n      uniform sampler2D uBackdrop,uSpectrum,uNormalMap;');
  glass=edit(glass,'mapN.xy*=uNormalScale;',`mapN.xy*=uNormalScale;
        mapN.xy+=vec2(sin(vObj.x*2.1+vObj.y*3.4+uLiquidTime*.74),cos(vObj.x*2.7-vObj.y*2.3-uLiquidTime*.63))*.030*uLiquidAmount;
        // Capillary ripples: a smooth secondary scale, no extra texture fetches.
        vec2 cap=vec2(sin(vObj.x*11.3-vObj.y*7.1+uLiquidTime*.46),cos(vObj.x*8.7+vObj.y*12.1-uLiquidTime*.39));
        mapN.xy+=cap*.010*uLiquidAmount;
        mapN=normalize(mapN);`);
  glass=edit(glass,'function update({palette,opacity=1}={}){',`function update({palette,opacity=1,time=0,reducedMotion=false}={}){
    uniforms.uLiquidTime.value=reducedMotion?0:time;
    uniforms.uLiquidAmount.value=reducedMotion?0:1;`);
  main=edit(main,'const writing = delivering && !lettering.assembled;','const writing = delivering && (!lettering.assembled || CONFIG.logoLetters.liquid);');
  letters=edit(letters,'if (state.assembled) group.visible = false;','if (state.assembled && !config.liquid) group.visible = false;');
  letters=edit(letters,'const fragmentShader = (base.fragmentShader.slice(0, fragmentAt)', 'let fragmentShader = (base.fragmentShader.slice(0, fragmentAt)');
  glass=edit(glass,'        color+=min(spec,vec3(uSpecCap));', `        // A broad shoulder around the tight sun glint keeps the wet highlight continuous.
        spec+=uSunCol*pow(max(dot(N,H),0.),uSunPow*.18)*uSunSpec*.13*grazeFade;
        color*=exp(-vec3(.085,.027,.012)*pow(1.-NdV,1.6));
        color+=min(spec,vec3(uSpecCap));`);
  const rounded = `vec3 Ng=normalize(vNormal);if(!gl_FrontFacing)Ng=-Ng;
        vec2 lq=vLetterP.xy*uLetterTile+.5,le=vec2(1.25/LIQUID_GLYPH_SIZE.,0.);
        float ld=max(0.,-letterField(lq));
        vec2 lg=vec2(letterField(lq+le)-letterField(lq-le),letterField(lq+le.yx)-letterField(lq-le.yx));
        lg/=max(length(lg),.00001);
        float lens=pow(1.-smoothstep(0.,.105,ld),1.15)*.62*smoothstep(.6,.95,abs(vLetterN.z));
        Ng=normalize(Ng+(vLetterX*lg.x+vLetterY*lg.y)*lens);`;
  letters=edit(letters,'    return new THREE.ShaderMaterial({', '    fragmentShader=fragmentShader.replace("vec3 Ng=normalize(vNormal);if(!gl_FrontFacing)Ng=-Ng;", '+JSON.stringify(rounded)+'.replace("LIQUID_GLYPH_SIZE",String(GLYPH_SIZE)));\n    return new THREE.ShaderMaterial({');
  return {main,letters,glass};
};
