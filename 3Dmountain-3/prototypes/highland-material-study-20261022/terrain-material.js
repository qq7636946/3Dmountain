import * as THREE from 'three';

// Real paired PBR maps, projected in world space. No fake normals from albedo luminance.
export function createTerrainMaterial(maps) {
  const material = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.94,metalness:0});
  material.onBeforeCompile = shader => {
    for (const [name, value] of Object.entries(maps)) shader.uniforms[name]={value};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      attribute float terrainAO;
      varying vec3 tWorld; varying vec3 tNormal; varying float tAO;`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      tWorld=(modelMatrix*vec4(position,1.0)).xyz;
      tNormal=normalize(mat3(modelMatrix)*normal); tAO=terrainAO;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      uniform sampler2D rockColor, rockNormal, rockRoughness, grassColor, grassNormal, grassRoughness, erosionNormal;
      varying vec3 tWorld; varying vec3 tNormal; varying float tAO;
      vec3 weights(vec3 n){vec3 w=pow(abs(n),vec3(4.));return w/max(dot(w,vec3(1.)),.0001);}
      vec3 tri(sampler2D tex, vec3 p, vec3 w){return texture2D(tex,p.zy).rgb*w.x+texture2D(tex,p.xz).rgb*w.y+texture2D(tex,p.xy).rgb*w.z;}
      vec3 triPerturb(sampler2D tex,vec3 p,vec3 n,vec3 w){
        vec3 x=texture2D(tex,p.zy).xyz*2.-1.;
        vec3 y=texture2D(tex,p.xz).xyz*2.-1.;
        vec3 z=texture2D(tex,p.xy).xyz*2.-1.;
        vec3 d=vec3(0.,x.y,x.x)*w.x+vec3(y.x,0.,y.y)*w.y+vec3(z.x,z.y,0.)*w.z;
        return d-n*dot(n,d);
      }
      vec3 terrainW; vec3 terrainN; float grassMix;
    `).replace('#include <map_fragment>',`
      terrainN=normalize(tNormal); terrainW=weights(terrainN);
      vec3 rock=tri(rockColor,tWorld/19.,terrainW);
      vec3 macro=tri(rockColor,tWorld/143.+vec3(.37,.19,.63),terrainW);
      float luma=dot(rock,vec3(.2126,.7152,.0722));
      // Neutral slate, not the brown source rock; preserve captured light-independent detail.
      rock=mix(vec3(luma),rock,.10)*vec3(.71,.77,.80);
      rock*=.84+.45*dot(macro,vec3(.333));
      vec3 grass=tri(grassColor,tWorld/27.,terrainW)*vec3(.64,.83,.67);
      grassMix=smoothstep(.48,.86,terrainN.y)*(.85+.15*sin(tWorld.x*.017+tWorld.z*.006));
      grassMix*=1.-smoothstep(230.,350.,tWorld.y)*.75;
      grassMix*=smoothstep(.5,10.,tWorld.y);
      float wet=smoothstep(.0,6.,tWorld.y);
      diffuseColor.rgb*=mix(rock,grass,grassMix)*mix(.47,1.,wet)*tAO;
    `).replace('#include <roughnessmap_fragment>',`
      float rr=tri(rockRoughness,tWorld/19.,terrainW).r;
      float gr=tri(grassRoughness,tWorld/27.,terrainW).r;
      float roughnessFactor=clamp(mix(rr,gr,grassMix)*.45+.50,.55,.98);
    `).replace('#include <normal_fragment_maps>',`
      vec3 rd=triPerturb(rockNormal,tWorld/19.,terrainN,terrainW);
      vec3 gd=triPerturb(grassNormal,tWorld/27.,terrainN,terrainW);
      vec3 en=texture2D(erosionNormal,vec2((tWorld.x+600.)/1200.,(600.-tWorld.z)/1200.)).xyz*2.-1.;
      vec3 tangent=normalize(vec3(1.,0.,0.)-terrainN*terrainN.x);
      vec3 bitangent=normalize(cross(terrainN,tangent));
      vec3 eroded=normalize(terrainN*en.z+tangent*en.x*.65+bitangent*en.y*.65);
      vec3 wd=normalize(eroded+mix(rd*.40,gd*.24,grassMix));
      normal=normalize(mat3(viewMatrix)*wd);
    `);
    material.userData.shader=shader;
  };
  material.customProgramCacheKey=()=> 'highland-pbr-triplanar-v1';
  return material;
}
