// Local analytical water refraction: no extra framebuffer or transmission pass.
module.exports = function alpineWater(main) {
 const edit=(a,b)=>{if(main.split(a).length!==2)throw Error('alpine water anchor '+a.slice(0,80));main=main.replace(a,b)};
 edit("uEnvRidgeCol: { value: paletteLinear('#5f7d90') },", "uEnvRidgeCol: { value: paletteLinear('#5f7d90') },\n        uHlFluid: { value: HL_CONFLUENCE ? 1 : 0 },");
 edit('uniform vec4 uEnvRidge; uniform vec3 uEnvRidgeCol;', 'uniform vec4 uEnvRidge; uniform vec3 uEnvRidgeCol; uniform float uHlFluid;');
 edit(`  col=mix(col,vec3(1.)-(vec3(1.)-col)*(vec3(1.)-flash),wt);
  return col;`, `  col=mix(col,vec3(1.)-(vec3(1.)-col)*(vec3(1.)-flash),wt);
  if(uHlFluid>.5 && card>.1){
    // Refraction through both faces of a spherical drop. The room is the same
    // one mirrored by the sea and the small helix drops; no metallic F0 floor.
    vec3 inside=refract(-V,N,1./1.333);
    float path=max(.0,-2.*dot(N,inside));
    vec3 exitN=normalize(N+inside*path);
    vec3 through=refract(inside,-exitN,1.333);
    vec3 body=montisEnv(through,rough*.6,0.,0.);
    body*=exp(-vec3(.055,.026,.014)*path);
    float waterF=.02+.98*pow(1.-ndv,5.);
    col=mix(body,env,waterF);
#ifndef MONTIS_LITE
    // Keep the reference's travelling surface glint after replacing its metal
    // body with water. It follows the deforming normal and flow, not a new clock.
    col+=uEnvGlow*uChromeSpec.w*lift*mix(.08,.28,waterF);
#endif
    float skin=max(dot(N,normalize(uEnvCoreDir+V)),0.);
    col+=uEnvGlow*(pow(skin,110.)*.14+pow(skin,500.)*.20);
  }
  return col;`);
 return main;
};
