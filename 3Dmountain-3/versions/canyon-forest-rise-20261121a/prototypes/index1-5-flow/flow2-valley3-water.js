(()=>{const Q=new URLSearchParams(location.search),on=Q.has("v3water")?Q.get("v3water"):Q.get("v3"),rise=document.documentElement.hasAttribute("data-rise-studio-pbr");if(on==="0"||!rise&&on!=="1"&&window.__FLOW2_QUALITY__?.start==="low")return;const T={amount:1,chop:((key,fallback)=>{const v=parseFloat(Q.get(key));return Number.isFinite(v)?v:fallback})("v3chop",1.2),faces:2.2,crests:.14,bend:.28,mirror:.95,body:.5,floor:.03,streak:.55,slant:1.1,flow:[0,.55],time:.8,sun:{elevation:10,strength:.045,cap:6,walls:.7},shore:{foam:.85,shallow:.8,lift:.85,wall:.75}},state={water:"not built yet"},FUNC=`
    /* flow2 valley3 water: one wave train, its slope added while it is larger than a pixel, its variance kept when it is not */
    void f3wave(vec2 p,float px,float t,vec2 d,float k,float s,inout vec2 sl,inout float va,inout float hg){
      float keep=1.-smoothstep(.7,2.,px*k);
      float ph=dot(p,d)*k-sqrt(9.81*k)*t;
      sl+=d*(s*keep*(cos(ph)+.32*cos(2.*ph+.6)));
      hg+=keep*s/k*(sin(ph)+.16*sin(2.*ph+.6));
      va+=(1.-keep*keep)*.55*s*s;
    }
`,PARS=`uniform vec4 uF3W,uF3B,uF3S,uF3Sun,uF3L;
uniform vec3 uF3Flow,uF3SunCol;
uniform float uF3Cap;
`,MAIN_ANCHOR="void main(){",SHORE_ANCHOR="if(uRiverSurface>.5&&uShore.w>.5){",VALLEY_GUARD="if(uF2Water.x>.001&&uRiverSurface>.5){",DITHER_ANCHOR="col+=montisDither(gl_FragCoord.xy)*mix(.004,.0006,uJourneyNight);",WATER=`
      /* flow2 valley3 water (flow2-valley3-water.js): the canyon river as water. Declared out here: the shore and the sun read them. */
      float f3w=0.,f3sig=0.,f3sky=1.;vec3 f3n=vec3(0.,1.,0.);
      if(uF3W.x>.001&&uRiverSurface>.5&&uF2Water.x>.001){
        f3w=clamp(uF3W.x*uF2Water.x*(1.-uJourneyNight),0.,1.);
        float f3px=fwidth(vWorld.x)+fwidth(vWorld.z)+1e-4;
        vec2 f3p=vWorld.xz+uF3Flow.xy*uSeaTime;
        float f3gust=.62+.38*smoothstep(.28,.78,seaNoise(f3p*.011+vec2(uSeaTime*.012,0.))*.65+seaNoise(f3p*.029-vec2(0.,uSeaTime*.017))*.35);
        vec2 f3pw=f3p+(vec2(seaNoise(f3p*.06),seaNoise(f3p*.06+vec2(5.2,1.3)))-.5)*2.4;
        vec2 f3sl=vec2(0.);float f3va=0.,f3hg=0.,f3t=uSeaTime*uF3Flow.z,f3g=uF3W.y*f3gust;
        f3wave(f3pw,f3px,f3t,vec2(.24,-.97),.62,.060*f3g,f3sl,f3va,f3hg);
        f3wave(f3pw,f3px,f3t,vec2(-.53,-.85),.97,.055*f3g,f3sl,f3va,f3hg);
        f3wave(f3pw,f3px,f3t,vec2(.71,-.70),1.53,.052*f3g,f3sl,f3va,f3hg);
        f3wave(f3pw,f3px,f3t,vec2(-.14,-.99),2.41,.050*f3g,f3sl,f3va,f3hg);
        f3wave(f3pw,f3px,f3t,vec2(.87,-.49),3.70,.046*f3g,f3sl,f3va,f3hg);
        f3wave(f3pw,f3px,f3t,vec2(-.80,-.60),5.80,.042*f3g,f3sl,f3va,f3hg);
        f3wave(f3pw,f3px,f3t,vec2(.43,-.90),9.10,.038*f3g,f3sl,f3va,f3hg);
        f3wave(f3pw,f3px,f3t,vec2(-.36,-.93),14.3,.034*f3g,f3sl,f3va,f3hg);
        f3wave(f3pw,f3px,f3t,vec2(.97,-.26),22.0,.030*f3g,f3sl,f3va,f3hg);
        f3wave(f3pw,f3px,f3t,vec2(-.62,-.78),34.0,.026*f3g,f3sl,f3va,f3hg);
        f3wave(f3pw,f3px,f3t,vec2(.18,-.98),52.0,.022*f3g,f3sl,f3va,f3hg);
        f3n=normalize(vec3(nrm.x-f3sl.x,nrm.y,nrm.z-f3sl.y));
        float f3foot=fwidth(f3sl.x)+fwidth(f3sl.y);
        f3sig=sqrt(f3va+.3*f3foot*f3foot+.00025);
        /* seen at a slant, the faces turned toward the lens are the ones in view: far water mirrors less and shows itself */
        float f3c=min(1.,clamp(dot(f3n,V),0.,1.)+uF3B.w*f3sig);
        float f3F=.02+.98*pow(1.-f3c,5.);
        /* the canyon in the water, bent by the waves and drawn out toward the lens */
        vec4 f3m=uF2MirrorMatrix*vec4(vWorld,1.);
        vec3 f3vn=mat3(viewMatrix)*(f3n-vec3(0.,1.,0.));
        vec2 f3uv=f3m.xy/max(f3m.w,1e-4)+vec2(f3vn.x,-f3vn.z)*uF3W.z;
        vec2 f3e=vec2(0.,f3sig*uF3B.z);
        vec3 f3R=texture2D(uF2Mirror,clamp(f3uv+f3e*.35,vec2(.002),vec2(.998))).rgb*.3
          +texture2D(uF2Mirror,clamp(f3uv-f3e*.15,vec2(.002),vec2(.998))).rgb*.3
          +texture2D(uF2Mirror,clamp(f3uv-f3e*.7,vec2(.002),vec2(.998))).rgb*.25
          +texture2D(uF2Mirror,clamp(f3uv-f3e*1.3,vec2(.002),vec2(.998))).rgb*.15;
        f3R=min(f3R,uF2Fog.rgb*2.2+.15);
        /* where the water mirrors rock rather than sky. In the sun's path the mirrored ray runs toward the sun, so this also
           says whether a wall stands between that water and the sun: there the path is in the wall's shadow */
        f3sky=smoothstep(.14,.42,dot(f3R,vec3(.2126,.7152,.0722))/max(dot(uF2Fog.rgb,vec3(.2126,.7152,.0722)),.05));
        vec3 f3body=mix(uF2Shallow,uF2Deep,1.-exp(-max(-vShore.x,0.)*uF2Tone.x))*uB3Body;
        /* the body is lit unevenly: faces turned to the sun take more light in, the thin crests let more of it back out */
        vec2 f3sh=normalize(uF3Sun.xz+vec2(1e-4));
        f3body*=max(.35,1.+uF3L.x*dot(-f3sl,f3sh)+uF3L.y*clamp(f3hg/.05,-1.,1.));
        vec3 f3col=mix(f3body,f3R,clamp(f3F*uF3W.w+uF3B.y,0.,1.));
        f3col=mix(f3col,uF2Fog.rgb,1.-exp(-pow(uF2Fog.a*vDist,2.)));
        col=mix(col,f3col,f3w);
      }
`.replace("uB3Body","uF3B.x"),SUN=`
      /* flow2 valley3 water: the sun on the water, from the slopes themselves (glints near the lens, a soft column far off) */
      if(f3w>.001&&uF3Sun.w>.001){
        vec3 f3H=normalize(uF3Sun.xyz+V);
        vec2 f3d=f3n.xz/max(f3n.y,.02)-f3H.xz/max(f3H.y,.02);
        float f3s2=2.*f3sig*f3sig+.0006;
        float f3P=exp(-dot(f3d,f3d)/f3s2)/(3.14159*f3s2);
        float f3Fh=.02+.98*pow(1.-clamp(dot(V,f3H),0.,1.),5.);
        float f3g=f3P*f3Fh/(4.*max(V.y,.06)*pow(max(f3H.y,.1),4.));
        col+=uF3SunCol*min(f3g*uF3Sun.w,uF3Cap)*f3w*mix(1.,f3sky,uF3L.z)*smoothstep(4.,18.,vDist)*(1.-smoothstep(900.,2600.,vDist));
      }
`,SHORE_EDITS=[["col=mix(col,mix(col,bedTint,.62)+.035,shallow*.55*vis);","col=mix(col,mix(col,bedTint,.62)+.035,shallow*.55*vis*(1.-uF3S.y*f3w));"],["col=mix(col,wallCol,bank*uShore.z*(.30+.70*grazing)*.62*vis*broken);","col=mix(col,wallCol,bank*uShore.z*(.30+.70*grazing)*.62*vis*broken*(1.-uF3S.w*f3w));"],["float lace=mix(.60,",`hug=mix(hug,(1.-smoothstep(.04+px,.5+px*1.5,inward+(n1-.5)*.45))*.85,f3w*uF3S.x);
        float lace=mix(.60,`],["float foamAmt=uShore.x*vis*(hug*lace+trail)*(1.-.88*aer);","float foamAmt=uShore.x*vis*(hug*lace+trail*(1.-uF3S.x*f3w))*(1.-.88*aer);"],["float lift=uShoreTone.x*(1.-smoothstep(.16,.52,waterL))*vis*(.28+.42*nearBank)*(1.-.5*aer);","float lift=uShoreTone.x*(1.-smoothstep(.16,.52,waterL))*vis*(.28+.42*nearBank)*(1.-.5*aer)*(1.-uF3S.z*f3w);"]];function install({THREE,seaMaterial,journey,CONFIG}){if(!THREE||!seaMaterial?.isShaderMaterial){state.water="no canyon river";return}const V=window.__FLOW2_VALLEY__;if(V?.state?.water!=="on"){state.water="flow2-valley.js has no water here ("+(V?.state?.water||"not loaded")+"): the river stays as it is";return}let fs=seaMaterial.fragmentShader;const once=a=>fs.split(a).length===2;if(!once(MAIN_ANCHOR)||!once(SHORE_ANCHOR)||!once(DITHER_ANCHOR)||!fs.includes("uniform sampler2D uF2Mirror")||!fs.includes("vec3 V=normalize(cameraPosition-vWorld);")){state.water="the river shader has changed: left as it is",console.warn("flow2 valley3 water: anchors not found; the river stays as it was");return}fs=PARS+fs.replace(MAIN_ANCHOR,FUNC+"    "+MAIN_ANCHOR).replace(SHORE_ANCHOR,WATER+"      "+SHORE_ANCHOR),fs.split(VALLEY_GUARD).length===2&&(fs=fs.replace(VALLEY_GUARD,"if(uF2Water.x>.001&&uRiverSurface>.5&&uF3W.x<.999){"));const skipped=[];for(const[a,b]of SHORE_EDITS)fs.split(a).length===2?fs=fs.replace(a,()=>b):skipped.push(a.slice(0,40));fs=fs.replace(DITHER_ANCHOR,SUN+"      "+DITHER_ANCHOR);const U={uF3W:{value:new THREE.Vector4},uF3B:{value:new THREE.Vector4},uF3S:{value:new THREE.Vector4},uF3Sun:{value:new THREE.Vector4(0,.14,-1,0)},uF3Flow:{value:new THREE.Vector3},uF3SunCol:{value:new THREE.Color(1,1,1)},uF3Cap:{value:T.sun.cap},uF3L:{value:new THREE.Vector4}};Object.assign(seaMaterial.uniforms,U),seaMaterial.fragmentShader=fs,seaMaterial.needsUpdate=!0;const light=window.__FLOW2_CANYON_LIGHT__;light?.GLINT&&(state.glintWas=light.GLINT.strength,light.GLINT.strength=0);const sunCol=new THREE.Color,warm=new THREE.Color("#fff2df");let lastSun="";(function frame(){requestAnimationFrame(frame);const L=CONFIG?.alpineLight,LF=window.__FLOW2_LIFT_FADE__,f0=LF?LF[0]:9.6,f1=LF?LF[1]:10.3,p=+journey?.progress,t=Number.isFinite(p)?Math.min(1,Math.max(0,(p-f0)/(f1-f0))):0;U.uF3W.value.set(T.amount*(1-t*t*(3-2*t)),T.chop,T.bend,T.mirror),U.uF3B.value.set(T.body,T.floor,T.streak,T.slant),U.uF3S.value.set(T.shore.foam,T.shore.shallow,T.shore.lift,T.shore.wall),U.uF3Flow.value.set(T.flow[0],T.flow[1],T.time);const az=(Number.isFinite(+L?.sunAzimuth)?+L.sunAzimuth:18)*Math.PI/180,el=T.sun.elevation*Math.PI/180;if(U.uF3Sun.value.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el),T.sun.strength),U.uF3Cap.value=T.sun.cap,U.uF3L.value.set(T.faces,T.crests,T.sun.walls,0),L?.sunColor&&L.sunColor!==lastSun){lastSun=L.sunColor;try{sunCol.set(L.sunColor).lerp(warm,.35),U.uF3SunCol.value.copy(sunCol)}catch{}}})(),state.water=skipped.length?"on (shore lines not found: "+skipped.join(" | ")+")":"on",document.documentElement.dataset.flow2Valley3Water="on"}window.__FLOW2_VALLEY3_WATER__={tune:T,state,install};const prev=window.__FLOW2_CANYON_LIGHT__;window.__FLOW2_CANYON_LIGHT__={...prev||{},install(args){try{prev?.install?.(args)}finally{try{install(args||{})}catch(error){state.water="failed: "+(error?.message||error),console.warn("flow2 valley3 water skipped",error)}}}}})();