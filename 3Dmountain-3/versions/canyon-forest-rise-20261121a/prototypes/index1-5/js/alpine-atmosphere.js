import{ALPINE_LIGHT}from"./alpine-light-params.js?v=i15-mw30beoi";const DEFAULTS={...ALPINE_LIGHT},HAZE_PARS=`varying vec3 vAlpWorld;
uniform vec4 uAlpHaze;      // strength (x 1e-3 per unit at the floor), height scale, floor offset, layer contrast
uniform vec4 uAlpFloorBox;  // floor map: min x, min z, span x, span z
uniform vec3 uAlpHazeCol, uAlpSunDir, uAlpSunCol;
uniform float uAlpHazeSun, uAlpFloorOn;
uniform sampler2D uAlpFloor;
`,HAZE_FRAGMENT=`#ifdef USE_FOG
  {
    #ifdef FOG_EXP2
      float alpDist = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float alpDist = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    vec3 alpRay = vAlpWorld - cameraPosition;
    float alpLen = max(length(alpRay), 1e-3);
    vec3 alpDir = alpRay / alpLen;
    float alpFloor = uAlpHaze.z + (uAlpFloorOn > .5 ? texture2D(uAlpFloor, clamp((vAlpWorld.xz - uAlpFloorBox.xy) / uAlpFloorBox.zw, 0., 1.)).r : 0.);
    float alpH = max(uAlpHaze.y, 1.);
    float alpYc = max(cameraPosition.y - alpFloor, -alpH), alpYp = max(vAlpWorld.y - alpFloor, -alpH);
    // Optical depth of rho(y) = exp(-y / H) along the ray (stable form; straight-on when the ray is level).
    float alpOd = abs(alpYc - alpYp) > .01 ? alpH * (exp(-alpYp / alpH) - exp(-alpYc / alpH)) / (alpYc - alpYp) * alpLen
                                         : alpLen * exp(-alpYc / alpH);
    float alpValley = 1.0 - exp( - max(alpOd, 0.) * uAlpHaze.x * 1e-3 );
    float alpAmt = 1.0 - (1.0 - alpDist) * (1.0 - alpValley);
    alpAmt = pow(clamp(alpAmt, 0., 1.), uAlpHaze.w);
    vec3 alpCol = mix(fogColor, uAlpHazeCol, alpValley / max(alpValley + alpDist, 1e-4));
    float alpSun = pow(max(dot(alpDir, uAlpSunDir), 0.), 4.) * uAlpHazeSun;
    alpCol = mix(alpCol, alpCol * .55 + uAlpSunCol * .5, clamp(alpSun, 0., 1.));
    gl_FragColor.rgb = mix( gl_FragColor.rgb, alpCol, alpAmt );
  }
#endif`,SKY_VERTEX=`varying vec3 vDirection;
void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.99999;}`,SKY_FRAGMENT=`uniform vec3 zenith,horizon,uMid,uSunDir,uSunCol,uCloudLit,uCloudShade,uFogColor;
uniform float uHaze,uSunSize,uGlowSize,uGlow,uFlare,uGrain,uTime,uSkyClouds,uCloudSea,uBright,uDrift,uSunEnergy,uTwilight;
uniform sampler2D uNoise;
varying vec3 vDirection;
float skyHash(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
void main(){
  vec3 d=normalize(vDirection);
  float y=d.y,h=max(y,0.);
  vec3 sd=normalize(uSunDir);
  float mu=dot(d,sd);
  float sunThroughCloud=1.;
  vec2 dh=normalize(d.xz+vec2(1e-5)),sh=normalize(sd.xz+vec2(1e-5));
  float sunSide=max(dot(dh,sh),0.);
  // Three-stop gradient: pale luminous haze band -> soft blue -> deep zenith.
  float band=smoothstep(0.,1.,clamp(h/max(uHaze,.01),0.,1.));
  vec3 col=mix(horizon,uMid,band);
  float upper=clamp((h-uHaze*.55)/max(1.-uHaze*.55,.05),0.,1.);
  col=mix(col,zenith,smoothstep(0.,1.,pow(upper,1.05)));
  // Warm haze: the light-filled air toward the sun is pale gold, mixed in (adding orange to blue turns it violet).
  vec3 warmHaze=mix(horizon,uSunCol,.42)*1.12;
  float ang=acos(clamp(mu,-1.,1.));
  float wash=clamp(uGlow*uTwilight*(exp(-ang/(.30*uGlowSize))*.55+pow(sunSide,5.)*exp(-h*9.)*.45),0.,.9);
  col=mix(col,warmHaze,wash);
  // Bright misty line right on the horizon.
  float line=exp(-abs(y)*42.);
  col=mix(col,mix(horizon*1.06,warmHaze,pow(sunSide,3.)*.6*uTwilight),line*.55);
  // High cumulus over the valleys: a plane far above, projected into the dome.
  if(uSkyClouds>.001&&y>.012){
    vec2 q=d.xz/(y+.06)*.16+vec2(uTime*.0009*uDrift,uTime*.0003*uDrift);
    vec4 c1=texture2D(uNoise,q*.55+vec2(.21,.43));
    vec4 c2=texture2D(uNoise,q*1.7+vec2(.71,.13));
    float D=c1.r*.66+c2.r*.34;
    float th=.86-.3*uSkyClouds;
    float a=smoothstep(th,th+.18,D)*smoothstep(.012,.07,y)*(1.-smoothstep(.3,.62,y));
    vec2 g=(c1.gb-.5)*.66+(c2.gb-.5)*.34*3.;
    float lit=clamp(.55+dot(-g,sh)*.9+(D-th)*1.4,0.,1.);
    vec3 cc=mix(uCloudShade,uCloudLit,lit)+uSunCol*pow(max(mu,0.),12.)*(1.-a)*.8*uSunEnergy;
    cc=mix(cc,horizon,.35*(1.-smoothstep(.02,.18,y)));
    col=mix(col,cc,a*.92);
    sunThroughCloud=exp(-a*5.);
  }
  // Distant cloud sea below the horizon (only where the terrain leaves the dome showing).
  if(y<.004){
    float dn=max(-y,.0035);
    vec2 q=d.xz/dn*.022+vec2(uTime*.0004*uDrift,0.);
    vec4 s1=texture2D(uNoise,q*.5);
    vec4 s2=texture2D(uNoise,q*1.9+.5);
    float D=s1.r*.6+s2.r*.4;
    float tops=smoothstep(.25,.75,D);
    vec2 g=(s1.gb-.5)+(s2.gb-.5)*1.5;
    float lit=clamp(.5+dot(-g,sh)*.6+tops*.35,0.,1.);
    vec3 sea=mix(uCloudShade,uCloudLit,lit)*mix(.82,1.,tops);
    sea+=uSunCol*.12*pow(sunSide,6.)*uTwilight;
    float toLine=exp(-dn*26.);
    sea=mix(sea,horizon*1.04,toLine*.8);
    col=mix(col,sea,clamp(uCloudSea,0.,1.)*smoothstep(.004,-.004,y));
  }
  // Sun: disc, two-scale halo, a wide warm wash, and a faint horizontal lens streak.
  float r=.0115*uSunSize;
  float disc=1.-smoothstep(r*.78,r,ang);
  float halo=exp(-ang/(.022*uGlowSize))*1.1+exp(-ang/(.085*uGlowSize))*.42;
  vec3 haloCol=mix(uSunCol,vec3(1.,.97,.92),.35);
  // The terrain depth-occludes this dome; its clouds and the geometric horizon also veil the sun.
  float horizonVis=smoothstep(-.006,.006,y);
  col+=haloCol*(disc*36.*uSunEnergy+halo*uGlow*uTwilight)*horizonVis*sunThroughCloud;
  vec3 vd=(viewMatrix*vec4(d,0.)).xyz,vs=(viewMatrix*vec4(sd,0.)).xyz;
  if(vs.z<-.05&&vd.z<-.05&&uFlare>.001){
    // Screen-proportional offsets from the sun (tangent plane), so the streak is resolution independent.
    vec2 o=vd.xy/-vd.z-vs.xy/-vs.z;
    float streak=exp(-abs(o.y)/.0026)*exp(-abs(o.x)/.3);
    float star=exp(-abs(o.y)/.011)*exp(-abs(o.x)/.09);
    col+=uSunCol*(streak*1.2+star*.45)*uFlare*uSunEnergy*horizonVis*sunThroughCloud;
  }
  // Fine film grain, strongest in the deep blue.
  float g1=skyHash(gl_FragCoord.xy+fract(uTime*7.31)*vec2(91.7,37.3)),g2=skyHash(gl_FragCoord.yx*1.37+fract(uTime*3.17)*vec2(13.1,71.9));
  col*=1.+(g1+g2-1.)*uGrain*.055*(1.-band*.6);
  gl_FragColor=vec4(max(col,vec3(0.))*uBright,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;export function createAlpineAtmosphere(THREE,{scene,camera,sky,hemisphere,sunlight,rim,clouds=null,lite=!1}={}){const L=ALPINE_LIGHT,num=key=>{const v=Number(L[key]);return Number.isFinite(v)?v:DEFAULTS[key]},col=(key,_,out)=>{try{out.set(L[key]||DEFAULTS[key])}catch{out.set(DEFAULTS[key])}return out},oldSky=sky.material,noise=clouds?.noise??null,skyUniforms={zenith:{value:new THREE.Color(L.skyZenith)},horizon:{value:new THREE.Color(L.skyHorizon)},uMid:{value:new THREE.Color(L.skyMid)},uSunDir:{value:new THREE.Vector3(0,.2,-1).normalize()},uSunCol:{value:new THREE.Color(L.sunColor)},uCloudLit:{value:new THREE.Color(L.cloudLit)},uCloudShade:{value:new THREE.Color(L.cloudShade)},uFogColor:{value:new THREE.Color(L.fogColor)},uHaze:{value:.24},uSunSize:{value:1},uGlowSize:{value:1},uGlow:{value:1},uFlare:{value:.5},uGrain:{value:.5},uTime:{value:0},uSkyClouds:{value:noise?.8:0},uCloudSea:{value:noise?1:0},uBright:{value:1},uDrift:{value:1},uSunEnergy:{value:1},uTwilight:{value:1},uNoise:{value:noise}},skyMaterial=new THREE.ShaderMaterial({name:"Alpine sky dome",side:THREE.BackSide,depthWrite:!1,fog:!1,uniforms:skyUniforms,vertexShader:SKY_VERTEX,fragmentShader:SKY_FRAGMENT});sky.material=skyMaterial,oldSky.dispose();const sunDir=new THREE.Vector3,rimDir=new THREE.Vector3,ROI={canyon:new THREE.Box3(new THREE.Vector3(-800,-20,-2700),new THREE.Vector3(800,800,300)),aerial:new THREE.Box3(new THREE.Vector3(-6500,-20,-10500),new THREE.Vector3(6500,1800,2600))},world=new THREE.Box3(new THREE.Vector3(-9e3,-20,-12e3),new THREE.Vector3(9e3,1800,4800));let phase="canyon";const roiCenter=ROI.aerial.getCenter(new THREE.Vector3);sunlight.target.position.copy(roiCenter).setY(0),sunlight.target.updateMatrixWorld();const lightView=new THREE.Matrix4,corner=new THREE.Vector3,lightBox=new THREE.Box3;rim.castShadow=!1,rim.target.parent||scene.add(rim.target);const fill=new THREE.DirectionalLight("#7f9de0",0);fill.name="Alpine sky fill",fill.target.position.copy(sunlight.target.position),scene.add(fill,fill.target);const fillDir=new THREE.Vector3;clouds?.linkSun?.(sunDir);const hazeUniforms={uAlpHaze:{value:new THREE.Vector4(0,220,0,1)},uAlpHazeCol:{value:new THREE.Color(L.valleyHazeColor||"#d3e0ec")},uAlpSunDir:{value:sunDir},uAlpSunCol:{value:new THREE.Color(L.sunColor)},uAlpHazeSun:{value:.5},uAlpFloor:{value:clouds?.floorMap??null},uAlpFloorBox:{value:clouds?.floorBox??new THREE.Vector4(-9e3,-12e3,18e3,16800)},uAlpFloorOn:{value:clouds?.floorMap?1:0}},hazed=[];scene.traverse(object=>{if(!(!object.isMesh||object===sky))for(const material of[].concat(object.material)){if(!material?.isMeshStandardMaterial||material.fog===!1||material.userData.alpineHaze)continue;const before=material.onBeforeCompile,key=material.customProgramCacheKey;material.onBeforeCompile=function(shader,renderer){before.call(this,shader,renderer),!(!shader.fragmentShader.includes("#include <fog_fragment>")||!shader.vertexShader.includes("#include <project_vertex>"))&&(Object.assign(shader.uniforms,hazeUniforms),shader.vertexShader=`varying vec3 vAlpWorld;
`+shader.vertexShader.replace("#include <project_vertex>",`#include <project_vertex>
{ vec4 alpW = vec4(transformed, 1.);
#ifdef USE_INSTANCING
alpW = instanceMatrix * alpW;
#endif
vAlpWorld = (modelMatrix * alpW).xyz; }`),shader.fragmentShader=HAZE_PARS+shader.fragmentShader.replace("#include <fog_fragment>",HAZE_FRAGMENT))},material.customProgramCacheKey=function(){return key.call(this)+"|alpine-haze-1"},material.userData.alpineHaze=!0,material.needsUpdate=!0,hazed.push(material)}}),rim.target.position.copy(sunlight.target.position),rim.target.updateMatrixWorld();const bakedDir=new THREE.Vector3(0,-1,0),lastDir=new THREE.Vector3;let bakedPhase="",settled=0,shadowBakedAt=-1/0;const casterBox=new THREE.Box3;function lightSpace(box,out){out.makeEmpty();for(let i=0;i<8;i++)corner.set(i&1?box.max.x:box.min.x,i&2?box.max.y:box.min.y,i&4?box.max.z:box.min.z).applyMatrix4(lightView),out.expandByPoint(corner);return out}function fitShadow(){const roi=ROI[phase];sunlight.position.copy(sunlight.target.position).addScaledVector(sunDir,16e3),sunlight.updateMatrixWorld(),lightView.lookAt(sunlight.position,sunlight.target.position,Math.abs(sunDir.y)>.99?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0)),lightView.setPosition(sunlight.position),lightView.invert(),lightSpace(roi,lightBox),lightSpace(world,casterBox);const cam=sunlight.shadow.camera,pad=phase==="canyon"?60:200,halfW=Math.min(7600,(lightBox.max.x-lightBox.min.x)/2+pad),halfH=Math.min(7600,(lightBox.max.y-lightBox.min.y)/2+pad),cx=(lightBox.max.x+lightBox.min.x)/2,cy=(lightBox.max.y+lightBox.min.y)/2;Object.assign(cam,{left:cx-halfW,right:cx+halfW,bottom:cy-halfH,top:cy+halfH,near:Math.max(50,-casterBox.max.z-300),far:-Math.min(lightBox.min.z,casterBox.min.z)+300}),cam.updateProjectionMatrix();const texel=2*halfW/Math.max(1,sunlight.shadow.mapSize.x);sunlight.shadow.normalBias=THREE.MathUtils.clamp(texel*1.4,1.2,6),sunlight.shadow.bias=-THREE.MathUtils.clamp(texel*.6,.4,3)/Math.max(1,cam.far-cam.near),sunlight.shadow.needsUpdate=!0}const COUNT=lite?260:900,BOX=46,seeds=new Float32Array(COUNT*4);for(let i=0;i<COUNT;i++)seeds[i*4]=Math.random(),seeds[i*4+1]=Math.random(),seeds[i*4+2]=Math.random(),seeds[i*4+3]=Math.random();const pGeometry=new THREE.BufferGeometry;pGeometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(COUNT*3),3)),pGeometry.setAttribute("aSeed",new THREE.BufferAttribute(seeds,4));const pUniforms={uTime:{value:0},uBox:{value:BOX},uAmount:{value:1},uCam:{value:new THREE.Vector3},uSunDir:skyUniforms.uSunDir,uSunCol:skyUniforms.uSunCol,uPixel:{value:1},uBright:{value:1},uShade:{value:new THREE.Color(L.shadowColor)},uSunEnergy:skyUniforms.uSunEnergy},pMaterial=new THREE.ShaderMaterial({name:"Alpine air ice",uniforms:pUniforms,transparent:!0,depthWrite:!1,depthTest:!0,blending:THREE.AdditiveBlending,fog:!1,vertexShader:`attribute vec4 aSeed;uniform float uTime,uBox,uAmount,uPixel,uSunEnergy;uniform vec3 uCam,uSunDir;
      varying float vA,vSpark;
      void main(){
        float on=step(aSeed.w,uAmount*.34);
        vec3 drift=vec3(sin(uTime*.31+aSeed.x*40.)*1.6+uTime*1.1,-uTime*(.55+aSeed.y*.7),cos(uTime*.23+aSeed.z*30.)*1.4+uTime*.35);
        vec3 p=aSeed.xyz*uBox+drift;
        p=mod(p-uCam+uBox*.5,uBox)-uBox*.5+uCam;
        vec4 view=viewMatrix*vec4(p,1.);
        float dist=-view.z;
        vec3 V=normalize(p-cameraPosition);
        vSpark=(pow(max(dot(V,uSunDir),0.),5.)*1.6+.12)*uSunEnergy;
        vA=on*smoothstep(.8,2.6,dist)*(1.-smoothstep(uBox*.30,uBox*.5,dist))*(.45+.55*fract(aSeed.w*17.31));
        gl_PointSize=clamp(uPixel*(.9+aSeed.x*1.4)*14./max(dist,.5),1.,5.)*step(.001,vA);
        gl_Position=projectionMatrix*view;}`,fragmentShader:`uniform vec3 uSunCol,uShade;uniform float uBright;varying float vA,vSpark;
      void main(){vec2 c=gl_PointCoord-.5;float r=dot(c,c)*4.;float a=(1.-r)*(1.-r)*vA;if(a<.003)discard;
        vec3 col=mix(uShade*.7,uSunCol,clamp(vSpark,0.,1.))*(.14+vSpark*.5);
        gl_FragColor=vec4(col*a*uBright*.5,1.);}`}),particles=new THREE.Points(pGeometry,pMaterial);particles.name="Alpine drifting ice",particles.frustumCulled=!1,particles.renderOrder=30,scene.add(particles);let clock=0,last=null,disposed=!1;function update(reveal=0,time=0,reduceMotion=!1){if(disposed)return;const B=THREE.MathUtils.clamp(num("brightness",1),.05,4),camY=camera.position.y,k=THREE.MathUtils.smootherstep(camY,80,800),az=THREE.MathUtils.degToRad(THREE.MathUtils.lerp(num("sunAzimuth"),num("sunAzimuthAerial"),k)),elevation=THREE.MathUtils.clamp(THREE.MathUtils.lerp(num("sunElevation"),num("sunElevationAerial"),k),-12,89),el=THREE.MathUtils.degToRad(elevation);sunDir.set(Math.cos(el)*Math.sin(az),Math.sin(el),-Math.cos(el)*Math.cos(az)).normalize();const sunAbove=THREE.MathUtils.smoothstep(elevation,-1.5,1.5),radiance=Math.min(1,Math.max(0,num("sunIntensity"))/4),sunEnergy=sunAbove*radiance,twilight=THREE.MathUtils.smoothstep(elevation,-7,2)*radiance;sunlight.position.copy(sunlight.target.position).addScaledVector(sunDir,16e3),sunlight.updateMatrixWorld(),phase==="canyon"&&camY>120?phase="aerial":phase==="aerial"&&camY<80&&(phase="canyon");const turned=bakedDir.angleTo(sunDir);settled=sunDir.distanceToSquared(lastDir)<1e-12?settled+1:0,lastDir.copy(sunDir);const now=performance.now(),settledPose=turned>1e-4&&settled>6;(phase!==bakedPhase||settledPose||turned>.0044&&now-shadowBakedAt>(lite?150:90))&&(bakedPhase=phase,bakedDir.copy(sunDir),shadowBakedAt=now,fitShadow()),col("sunColor","#ffc796",sunlight.color),sunlight.intensity=Math.max(0,num("sunIntensity"))*sunAbove*THREE.MathUtils.lerp(.8,1,k)*B;const rimAz=THREE.MathUtils.degToRad(num("rimAzimuth")),rimEl=THREE.MathUtils.degToRad(Math.max(0,num("rimElevation")));rimDir.set(Math.cos(rimEl)*Math.sin(rimAz),Math.sin(rimEl),-Math.cos(rimEl)*Math.cos(rimAz)),rim.position.copy(rim.target.position).addScaledVector(rimDir,1e3),col("rimColor","#ffd2a6",rim.color),rim.intensity=Math.max(0,num("rimStrength",1.6))*sunAbove*B,col("shadowColor","#7b93c4",hemisphere.color),col("groundColor","#4a4a52",hemisphere.groundColor);const shade=Math.max(0,num("shadowStrength",1.05));hemisphere.intensity=shade*B,col("shadowColor","#7b93c4",fill.color),fill.intensity=shade*Math.max(0,num("fillShare"))*B;const fillEl=THREE.MathUtils.degToRad(38);fillDir.set(-Math.cos(fillEl)*Math.sin(az),Math.sin(fillEl),Math.cos(fillEl)*Math.cos(az)),fill.position.copy(fill.target.position).addScaledVector(fillDir,1e3),"environmentIntensity"in scene&&(scene.environmentIntensity=Math.max(0,num("ambient",.22))*B),col("fogColor","#b9c9dc",scene.fog.color);const w=THREE.MathUtils.smoothstep(reveal,.05,.8),above=THREE.MathUtils.smoothstep(camY,25,320);hazeUniforms.uAlpHaze.value.set(Math.max(0,num("valleyHaze"))*above,Math.max(1,num("valleyHazeHeight")),num("valleyHazeFloor"),THREE.MathUtils.lerp(1,THREE.MathUtils.clamp(num("layerContrast"),.3,3),above)),col("valleyHazeColor","#d3e0ec",hazeUniforms.uAlpHazeCol.value),col("sunColor","#ffdcb8",hazeUniforms.uAlpSunCol.value),hazeUniforms.uAlpHazeSun.value=Math.max(0,num("hazeSunGlow"))*twilight,scene.fog.density*=THREE.MathUtils.lerp(Math.max(0,num("fogNear",1)),Math.max(0,num("fogFar",1.15)),w);const thin=.00105/(1+Math.max(0,camera.position.y)/60)+9e-5;scene.fog.density=Math.min(scene.fog.density,thin*Math.max(1,num("fogNear",1))*THREE.MathUtils.lerp(1,Math.max(.2,num("fogFar",1.15)),w)),scene.background?.isColor&&col("skyHorizon","#cbd8e6",scene.background).multiplyScalar(B);const U=skyUniforms;col("skyZenith","#0b2b68",U.zenith.value),col("skyMid","#2a5ea6",U.uMid.value),col("skyHorizon","#cbd8e6",U.horizon.value),col("cloudLit","#fff0e0",U.uCloudLit.value),col("cloudShade","#7487a6",U.uCloudShade.value),col("fogColor","#b9c9dc",U.uFogColor.value),U.uSunDir.value.copy(sunDir),col("sunColor","#ffc796",U.uSunCol.value),U.uSunEnergy.value=sunEnergy,U.uTwilight.value=twilight,U.uHaze.value=THREE.MathUtils.clamp(num("hazeHeight",.24),.01,1),U.uSunSize.value=Math.max(.05,num("sunSize",1)),U.uGlowSize.value=Math.max(.05,num("glowSize",1)),U.uGlow.value=Math.max(0,num("glowStrength",1)),U.uFlare.value=Math.max(0,num("flare",.55)),U.uGrain.value=Math.max(0,num("skyGrain",.55)),U.uBright.value=B,U.uSkyClouds.value=noise?Math.max(0,num("skyClouds",.8)):0,U.uCloudSea.value=noise?Math.max(0,num("cloudSea",1)):0,U.uDrift.value=num("cloudDrift",1);const dt=last===null?0:THREE.MathUtils.clamp(time-last,0,.1);last=time,reduceMotion||(clock+=dt),U.uTime.value=clock;const dpr=Math.min(globalThis.devicePixelRatio||1,2);pUniforms.uTime.value=reduceMotion?0:clock,pUniforms.uAmount.value=Math.max(0,num("particles",1)),pUniforms.uCam.value.copy(camera.position),pUniforms.uPixel.value=(globalThis.innerHeight||900)/900*Math.min(dpr,2),pUniforms.uBright.value=B,col("shadowColor","#7b93c4",pUniforms.uShade.value),particles.visible=pUniforms.uAmount.value>.001}function finishClouds(){!disposed&&clouds?.uniforms?.uSunCol&&clouds.uniforms.uSunCol.value.multiplyScalar(skyUniforms.uSunEnergy.value)}function dispose(){disposed||(disposed=!0,particles.removeFromParent(),pGeometry.dispose(),pMaterial.dispose(),skyMaterial.dispose(),fill.removeFromParent(),fill.target.removeFromParent(),fill.dispose())}return{update,finishClouds,dispose,sky:skyMaterial,particles,fill,hazed,hazeUniforms,sunDirection:sunDir,uniforms:skyUniforms,get phase(){return phase}}}