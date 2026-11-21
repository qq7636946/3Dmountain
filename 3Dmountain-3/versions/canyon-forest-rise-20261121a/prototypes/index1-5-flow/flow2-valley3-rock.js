(()=>{const Q=new URLSearchParams(location.search),on=Q.has("v3rock")?Q.get("v3rock"):Q.get("v3");if(on==="0"||on!=="1"&&window.__FLOW2_QUALITY__?.start==="low")return;const T={rock:((key,fallback)=>{const v=parseFloat(Q.get(key));return Number.isFinite(v)?v:fallback})("v3rockAmt",1),near:9,far:34,contrast:1.7,sat:.16,relief:1.15,joint:.42,lift:1.07,tame:.55,moss:.85,algae:1,flipG:1},ROOT=new URL("prototypes/index1-5-flow/assets/blender-valley/v2/tex/",document.baseURI),FILES={color:new URL("cliff_side-color-2k.webp",ROOT).href,normal:new URL("cliff_side-normal-2k.webp",ROOT).href};{const TT=document.documentElement.hasAttribute("data-flow2-opt")&&Q.get("bake")!=="0"?window.__FLOW2_TEX_TIER__:null;if(TT&&TT.tier!=="high"){const B=new URL("prototypes/index1-5-flow/assets/baked/",document.baseURI).href;FILES.color=TT.url(B+"cliff-color",2048,"webp",256),FILES.normal=TT.url(B+"cliff-normal",2048,"webp",256)}else if(TT&&document.documentElement.hasAttribute("data-rise-studio-pbr")&&Q.get("perf")!=="0"&&Q.get("optT")!=="0"&&Q.get("perfTiles")!=="full"&&(qq=>!!qq&&(qq.start==="medium"||qq.start==="low"))(window.__FLOW2_QUALITY__)){const B=new URL("prototypes/index1-5-flow/assets/baked/",document.baseURI).href;FILES.color=B+"cliff-color-1024.webp",FILES.normal=B+"cliff-normal-1024.webp"}}const state={rock:"not built yet",textures:"loading",programs:0,patches:{}},U={uV3Rk:{value:[0,0,T.near,T.far]},uV3Rk2:{value:[T.contrast,T.sat,T.relief,T.joint]},uV3Rk3:{value:[T.moss,T.algae,1,T.flipG]},uV3Rk4:{value:[T.tame,0,0,0]},uV3Mean:{value:[1,1,1]},v3RockC:{value:null},v3RockN:{value:null}},srgb=c=>(c/=255,c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)),bitmap=url=>fetch(url).then(r=>{if(!r.ok)throw new Error(r.status+" "+url);return r.blob()}).then(b=>createImageBitmap(b,{imageOrientation:"flipY",premultiplyAlpha:"none",colorSpaceConversion:"none"})),pictures=Promise.all([bitmap(FILES.color),bitmap(FILES.normal)]).then(([color,normal])=>{try{const c=new OffscreenCanvas(32,32),g=c.getContext("2d");g.drawImage(color,0,0,32,32);const d=g.getImageData(0,0,32,32).data,m=[0,0,0];for(let i=0;i<d.length;i+=4)m[0]+=srgb(d[i]),m[1]+=srgb(d[i+1]),m[2]+=srgb(d[i+2]);U.uV3Mean.value=m.map(v=>Math.max(v/1024,.01))}catch{U.uV3Mean.value=[.32,.2,.1]}return state.textures="decoded",{color,normal}}).catch(error=>(state.textures="failed: "+(error?.message||error),null));function textures(THREE,renderer){const make=(image,color)=>{const t=new THREE.Texture(image);return t.wrapS=t.wrapT=THREE.RepeatWrapping,t.flipY=!1,t.generateMipmaps=!0,t.minFilter=THREE.LinearMipmapLinearFilter,t.magFilter=THREE.LinearFilter,t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace,t.anisotropy=Math.min(8,renderer?.capabilities?.getMaxAnisotropy?.()||4),t.needsUpdate=!0,t};pictures.then(p=>{if(!p)return;const color=make(p.color,!0),normal=make(p.normal,!1);U.v3RockC.value=color,U.v3RockN.value=normal,requestAnimationFrame(()=>{try{renderer?.initTexture?.(color)}catch{}requestAnimationFrame(()=>{try{renderer?.initTexture?.(normal)}catch{}requestAnimationFrame(()=>{U.uV3Rk.value[1]=1,state.textures="on"})})})})}const ANCHOR="      vec3 rockVar=vec3(1.);   // water streaks / varnish",GLSL=`
      /* flow2 valley v3 rock (flow2-valley3-rock.js): photographed bedded stone on the canyon walls */
      float v3On=clamp(uV3Rk.x*uV3Rk3.z,0.,1.);
      float v3Tame=0.,v3Ledge=0.,v3Crev=0.,v3Side=1.-smoothstep(.55,.86,N0.y);
      if(v3On*uV3Rk.y>.001){
        float v3K=v3On*v3Side*(1.-smoothstep(3.,9.,foot));          /* walls, from the river; nothing of it from the air */
        {   /* (no per-pixel branch around the texture reads: their mip choice needs neighbours) */
          /* the beds' height (the same dip as flow2-valley-real.js) is the photograph's up; the two side projections */
          float v3Dip=P.y+dot(P.xz,vec2(.085,-.06))+(aNoise(P.xz*.016+vec2(2.7,9.1))-.5)*16.+(aNoise(P.xz*.06+vec2(6.3,1.2))-.5)*3.;
          float v3Wx=W.x/max(W.x+W.z,1e-4);
          float s1=uV3Rk.z,s2=uV3Rk.w;
          vec2 v3a1=vec2(P.z,v3Dip)/s1,v3b1=vec2(P.x,v3Dip)/s1+vec2(.37,.61);
          mat2 v3R=mat2(.96,.28,-.28,.96);
          vec2 v3a2=v3R*vec2(P.z,v3Dip*1.15)/s2+vec2(.13,.42),v3b2=v3R*vec2(P.x,v3Dip*1.15)/s2+vec2(.71,.19);
          float fN=1.-smoothstep(s1*.01,s1*.035,foot),fF=1.-smoothstep(s2*.006,s2*.02,foot);
          vec3 v3M=vec3(uV3Mean);
          vec3 cN=(texture2D(v3RockC,v3a1).rgb*v3Wx+texture2D(v3RockC,v3b1).rgb*(1.-v3Wx))/v3M;
          vec3 cF=(texture2D(v3RockC,v3a2).rgb*v3Wx+texture2D(v3RockC,v3b2).rgb*(1.-v3Wx))/v3M;
          float lN=max(aLuma(cN),.02),lF=max(aLuma(cF),.02);
          /* the wet foot shows its grain darker and stronger */
          float v3WetB=1.-smoothstep(.6,4.5,P.y);
          float con=uV3Rk2.x*(1.+.35*v3WetB);
          float t=clamp(pow(clamp(lN,.25,2.6),.78*fN*con)*pow(clamp(lF,.3,2.2),.7*fF*con),.3,1.75);
          vec3 ch=mix(vec3(1.),mix(cF/lF,cN/lN,fN),uV3Rk2.y);
          rock*=mix(vec3(1.),t*ch*uV3Rk4.z,v3K);   /* (lift: the white chips and pale flute ribs it removes had brightened the walls) */
          /* the low shelves at the river (flat rock the wall steps down to): the same stone seen from above */
          float wT=v3On*(1.-v3Side)*(1.-smoothstep(3.,6.5,P.y))*(1.-smoothstep(3.,9.,foot));
          float lT=max(aLuma(texture2D(v3RockC,mat2(.8,.6,-.6,.8)*P.xz/(s1*.8)+vec2(.29,.83)).rgb/v3M),.02);
          rock*=mix(1.,clamp(pow(clamp(lT,.25,2.6),.85*con*(1.-smoothstep(s1*.008,s1*.03,foot))),.3,1.75),wT);
          if(uV3Rk4.y>1.5)rock=texture2D(v3RockC,v3a1).rgb;else if(uV3Rk4.y>.5)rock=vec3(.2)*t*ch*mix(.3,1.,v3K);   /* debug: 2 = the raw photograph, 1 = what is kept of it */
          /* its relief: the ledges catch the sky, the undercuts hold shade */
          vec3 nN1=texture2D(v3RockN,v3a1).xyz*2.-1.,nN2=texture2D(v3RockN,v3b1).xyz*2.-1.;
          vec3 nF1=texture2D(v3RockN,v3a2).xyz*2.-1.,nF2=texture2D(v3RockN,v3b2).xyz*2.-1.;
          nN1.y*=uV3Rk3.w;nN2.y*=uV3Rk3.w;nF1.y*=uV3Rk3.w;nF2.y*=uV3Rk3.w;
          nF1.xy=transpose(v3R)*nF1.xy;nF2.xy=transpose(v3R)*nF2.xy;
          vec3 dN=vec3(0.,nN1.y,nN1.x)*v3Wx+vec3(nN2.x,nN2.y,0.)*(1.-v3Wx);
          vec3 dF=vec3(0.,nF1.y,nF1.x)*v3Wx+vec3(nF2.x,nF2.y,0.)*(1.-v3Wx);
          vec3 v3d=(dN*fN+dF*.75*fF)*uV3Rk2.z*v3K*(1.-.6*v3WetB);   /* calmer where the stone is wet (its sheen must not sparkle) */
          Nr=normalize(Nr+v3d-Nr*dot(Nr,v3d));
          /* where plants can sit on a wall: the photograph's shelves (relief turned up) and its dark cracks */
          v3Ledge=smoothstep(.12,.42,mix(dF.y,dN.y,fN))*v3K;
          v3Crev=smoothstep(.8,.5,mix(lF,lN,fN))*v3K;
          v3Tame=uV3Rk4.x*v3K*max(fN,fF*.8);
          /* a faint cool film of algae where the river laps */
          float v3Alg=(1.-smoothstep(.2,1.6,P.y+(aNoise(P.xz*.7+vec2(3.1,8.2))-.5)*.8))*smoothstep(.35,.6,aNoise(P.xz*.21+vec2(1.4,6.6)));
          rock*=mix(vec3(1.),vec3(.84,.95,.9),v3Alg*uV3Rk3.y*v3On*.7);
        }
      }
`,EDITS=[["joint","          Nr=normalize(Nr+jp*jk*2.2);","          Nr=normalize(Nr+jp*jk*2.2*mix(1.,uV3Rk2.w,v3On));   /* flow2 valley v3: the joint panels tilt less (no white chips) */"],["flute","        float fl=uRockFlute*jm*wallK;","        float fl=uRockFlute*jm*wallK*(1.-v3Tame);   /* flow2 valley v3: the photograph carries the detail here */"],["stain","        float sk=uRockStain*jm*(1.-smoothstep(.5,.8,N0.y))*(1.-smoothstep(.5,2.2,foot));","        float sk=uRockStain*jm*(1.-smoothstep(.5,.8,N0.y))*(1.-smoothstep(.5,2.2,foot))*(1.-v3Tame*.6);"],["plants","      vec3 col=mix(rock*rockVar,scree,screeM);",`      if(v3On*uV3Rk.y>.001){   /* flow2 valley v3: on a wall, turf and moss keep to the ledges and cracks */
        float v3g=clamp(v3Ledge*1.4+v3Crev*.7,0.,1.),v3w=uV3Rk3.x*v3Side*step(.001,v3Ledge+v3Crev+v3Tame);
        grassM*=mix(1.,.15+.85*v3g,v3w);mossM*=mix(1.,.3+.7*v3g,v3w);
      }
      vec3 col=mix(rock*rockVar,scree,screeM);`]],count=(s,a)=>s.split(a).length-1;function stone(built,THREE,renderer){if(!built?.scene){state.rock="no canyon handed over";return}textures(THREE,renderer);const seen=new Set;built.scene.traverse(object=>{for(const material of[].concat(object.material||[])){if(!material?.userData?.alpineTerrain||seen.has(material)||typeof material.onBeforeCompile!="function")continue;seen.add(material);const compile=material.onBeforeCompile,key=material.customProgramCacheKey;material.onBeforeCompile=function(shader,renderer2){compile.call(this,shader,renderer2);let f=shader.fragmentShader;if(!(!f.includes(`#define ALP_BANK
`)||f.includes(`#define ALP_LITE
`)||f.includes("uV3Rk"))){if(count(f,ANCHOR)!==1||!f.includes("void main() {")){state.rock="the wall shader has changed: left as it was";return}f=f.replace("void main() {",`uniform vec4 uV3Rk,uV3Rk2,uV3Rk3,uV3Rk4;uniform vec3 uV3Mean;uniform sampler2D v3RockC,v3RockN;
void main() {`).replace(ANCHOR,GLSL+ANCHOR);for(const[name,a,b]of EDITS){const n=count(f,a);state.patches[name]=n===1?"on":"skipped ("+n+")",n===1&&(f=f.replace(a,b))}shader.fragmentShader=f;for(const k of Object.keys(U))shader.uniforms[k]=U[k];state.programs++,state.rock="on"}},material.customProgramCacheKey=function(){return(key?key.call(this):"")+"|flow2-valley3-rock-1"},material.needsUpdate=!0}}),state.rock==="not built yet"&&(state.rock=seen.size?"waiting for the walls to be drawn":"no terrain material found");const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};(function frame(){requestAnimationFrame(frame);const a=U.uV3Rk.value,b=U.uV3Rk2.value,c=U.uV3Rk3.value,d=U.uV3Rk4.value,p=window.__MONTIS_STUDY__?.journey?.progress??0;a[0]=T.rock,a[2]=T.near,a[3]=T.far,b[0]=T.contrast,b[1]=T.sat,b[2]=T.relief,b[3]=T.joint;const LF=window.__FLOW2_LIFT_FADE__;c[0]=T.moss,c[1]=T.algae,c[2]=1-smooth(LF?LF[0]:9.7,LF?LF[1]:10.7,p),c[3]=T.flipG,d[0]=T.tame,d[1]=+T.debug||0,d[2]=T.lift})()}const host=window.__FLOW2_FINE_JOURNEY__||={},before=host.canyon;host.canyon=function(handles={}){try{before?.call(this,handles)}finally{if(handles.lite)state.rock="not on the lighter drawing";else try{stone(handles.canyon,handles.THREE,handles.renderer)}catch(error){state.rock="failed: "+(error?.message||error),console.warn("flow2 valley v3 rock: the walls keep their look",error)}}},window.__FLOW2_VALLEY3_ROCK__={tune:T,state,uniforms:U}})();