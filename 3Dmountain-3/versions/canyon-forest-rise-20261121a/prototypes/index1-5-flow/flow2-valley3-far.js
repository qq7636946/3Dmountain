(()=>{const Q=new URLSearchParams(location.search),on=Q.has("v3far")?Q.get("v3far"):Q.get("v3");if(on==="0"||on!=="1"&&window.__FLOW2_QUALITY__?.start==="low")return;const num=(key,fallback)=>{const v=parseFloat(Q.get(key));return Number.isFinite(v)?v:fallback},T={amount:num("v3farAmount",1),air:Q.get("v3farAir")==="0"?0:1,haze:{strength:num("v3farHaze",.3),height:num("v3farHazeH",50),floor:num("v3farHazeFloor",0),contrast:num("v3farContrast",1)},curve:{on:Q.get("v3farCurve")==="0"?0:1,c:num("v3farC",.55),k:num("v3farK",1.2)},mesh:Q.get("v3farMesh")==="1"?1:0,relief:num("v3farRelief",1),sky:Q.get("v3farSky")==="0"?0:1,cirrus:num("v3farCirrus",.45),cirrusScale:num("v3farCirrusScale",.6)},state={air:"waiting for the canyon",sky:"waiting for the canyon",weight:0},smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)},mix=(a,b,t)=>a+(b-a)*t,weight=()=>{const j=window.__MONTIS_STUDY__?.journey;if(!j)return 0;const LF=window.__FLOW2_LIFT_FADE__;return 1-smooth(LF?LF[0]:9.7,LF?LF[1]:10.5,j.progress)},SKY_ANCHOR="  // Sun: disc, two-scale halo",SKY_GLSL=`  // flow2 valley3 far (flow2-valley3-far.js): high thin cloud, where the sky shows between the canyon walls
  if(uF2Far.x>.001&&y>.04){
    vec2 cq=d.xz/(y+.14)*uF2Far.y;
    cq=mat2(.93,-.37,.37,.93)*cq+vec2(uTime*.00022*uDrift,uTime*.00006*uDrift);
    float cn1=texture2D(uNoise,cq*vec2(.42,2.3)+vec2(.13,.71)).r;
    float cn2=texture2D(uNoise,cq*vec2(1.3,6.2)+vec2(.57,.29)).r;
    float cn3=texture2D(uNoise,cq*.16+vec2(.41,.07)).r;
    float cs=smoothstep(.48,.86,cn1*.68+cn2*.32)*smoothstep(.34,.72,cn3);
    cs*=smoothstep(.04,.2,y)*(1.-smoothstep(.8,.99,y));
    vec3 ccol=mix(col,mix(uCloudLit,horizon,.35),.62)+uSunCol*pow(max(mu,0.),7.)*.22*uSunEnergy;
    col=mix(col,ccol,clamp(cs*uF2Far.x,0.,.6));
  }
`;function skyCloud(built,THREE){const A=built?.alpineAtmosphere,m=A?.sky;if(!m||!m.isShaderMaterial){state.sky="no sky dome handed over";return}if(!m.fragmentShader.includes(SKY_ANCHOR)||!m.fragmentShader.includes("uniform sampler2D uNoise;")){state.sky="the sky shader has changed: left as it was";return}m.fragmentShader.includes("uF2Far")||(m.uniforms.uF2Far={value:new THREE.Vector4(0,0,0,0)},m.fragmentShader=m.fragmentShader.replace("uniform sampler2D uNoise;",`uniform sampler2D uNoise;
uniform vec4 uF2Far;`).replace(SKY_ANCHOR,SKY_GLSL+SKY_ANCHOR),m.needsUpdate=!0,state.sky="on")}const FOG_PARS="uniform vec4 uAlpHaze;",FOG_ANCHOR="    vec3 alpRay = vAlpWorld - cameraPosition;",FOG_GLSL=`    #ifdef FOG_EXP2
      alpDist = mix(alpDist, 1.0 - exp(-pow(max(fogDensity * vFogDepth * uF2FarFog.y, 0.), uF2FarFog.z)), uF2FarFog.x);   /* flow2-valley3-far.js */
    #endif
`,MESH_ANCHOR="      alpN=normalize(mix(Nf,Nsn,snowM));",MESH_GLSL=`
      #if defined(ALP_MESH) && !defined(ALP_LITE)
      if(uF2FarFog.w>.001){
        float f3k=uF2FarFog.w*smoothstep(120.,320.,camD);
        if(f3k>.001){
          vec3 f3w=aTriW(N0);
          float f3a=1.-smoothstep(3.8,9.5,foot),f3b=1.-smoothstep(1.4,3.5,foot);
          vec3 f3p=P/38.;
          float f3h=((1.-abs(aNoise(f3p.zy+vec2(3.1,.7))*2.-1.))*f3w.x+(1.-abs(aNoise(f3p.xz+vec2(.4,5.2))*2.-1.))*f3w.y+(1.-abs(aNoise(f3p.xy+vec2(7.3,2.9))*2.-1.))*f3w.z)*22.*f3a;
          f3p=P/14.;
          f3h+=((1.-abs(aNoise(f3p.zy+vec2(1.7,8.3))*2.-1.))*f3w.x+(1.-abs(aNoise(f3p.xz+vec2(6.6,.2))*2.-1.))*f3w.y+(1.-abs(aNoise(f3p.xy+vec2(2.2,4.4))*2.-1.))*f3w.z)*7.*f3b;
          vec3 f3Px=dFdx(P),f3Py=dFdy(P);float f3Hx=dFdx(f3h),f3Hy=dFdy(f3h);
          vec3 f3R1=cross(f3Py,alpN),f3R2=cross(alpN,f3Px);float f3Det=dot(f3Px,f3R1);
          vec3 f3G=sign(f3Det)*(f3Hx*f3R1+f3Hy*f3R2);
          f3G*=min(1.,1.5*abs(f3Det)/max(length(f3G),1e-6));
          alpN=normalize(mix(alpN,normalize(abs(f3Det)*alpN-f3G),f3k));
        }
      }
      #endif
`,fogU={uF2FarFog:{value:null}};function fogCurve(built,A,THREE){fogU.uF2FarFog.value=new THREE.Vector4(0,T.curve.c,T.curve.k,0);let n=0;for(const material of A.hazed||[]){if(!material||typeof material.onBeforeCompile!="function"||material.userData.f2Far)continue;const compile=material.onBeforeCompile,key=material.customProgramCacheKey;material.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);let f=shader.fragmentShader;f.includes("uF2FarFog")||!f.includes(FOG_PARS)||!f.includes(FOG_ANCHOR)||(f=f.replace(FOG_PARS,FOG_PARS+`
uniform vec4 uF2FarFog;`).replace(FOG_ANCHOR,FOG_GLSL+FOG_ANCHOR),T.mesh&&f.includes(`#define ALP_MESH
`)&&!f.includes(`#define ALP_LITE
`)&&f.includes(MESH_ANCHOR)&&(f=f.replace(MESH_ANCHOR,MESH_ANCHOR+MESH_GLSL),state.mesh="on"),shader.fragmentShader=f,shader.uniforms.uF2FarFog=fogU.uF2FarFog,state.programs=(state.programs||0)+1)},material.customProgramCacheKey=function(){return(key?key.call(this):"")+"|flow2-valley3-far-1"},material.userData.f2Far=!0,material.needsUpdate=!0,n++}state.curve=n?`on (${n} materials)`:"no hazed materials"}function air(built,THREE){const A=built?.alpineAtmosphere;if(!A?.hazeUniforms?.uAlpHaze||typeof A.update!="function"){state.air="no haze on this page";return}T.air&&fogCurve(built,A,THREE);const H=A.hazeUniforms.uAlpHaze.value,sky=A.sky?.uniforms?.uF2Far?.value,F=fogU.uF2FarFog,update=A.update;A.update=function(){const r=update.apply(this,arguments);try{const w=weight()*Math.min(1,Math.max(0,T.amount));state.weight=+w.toFixed(3);const wa=w*T.air;F.value&&(F.value.x=wa*T.curve.on,F.value.y=T.curve.c,F.value.z=T.curve.k,F.value.w=wa*T.relief),wa>0&&(H.x=mix(H.x,T.haze.strength,wa),H.y=mix(H.y,T.haze.height,wa),H.z=mix(H.z,T.haze.floor,wa),H.w=mix(H.w,T.haze.contrast,wa)),sky&&(sky.x=T.cirrus*w*T.sky,sky.y=T.cirrusScale)}catch(error){state.air="failed: "+(error?.message||error)}return r},state.air=T.air?"on":"off (?v3farAir=0)"}const host=window.__FLOW2_FINE_JOURNEY__||={},before=host.canyon;host.canyon=function(handles={}){try{before?.call(this,handles)}finally{if(handles.lite)state.air=state.sky="not on the lighter drawing";else{try{T.sky?skyCloud(handles.canyon,handles.THREE||window.THREE):state.sky="off (?v3farSky=0)"}catch(error){state.sky="failed: "+(error?.message||error),console.warn("flow2 valley3 far: the sky keeps its own look",error)}try{air(handles.canyon,handles.THREE||window.THREE)}catch(error){state.air="failed: "+(error?.message||error),console.warn("flow2 valley3 far: the air keeps its own look",error)}}}},window.__FLOW2_VALLEY3_FAR__={tune:T,state}})();