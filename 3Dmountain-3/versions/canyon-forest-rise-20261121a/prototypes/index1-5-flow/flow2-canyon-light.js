(()=>{if(new URLSearchParams(location.search).get("light")==="0")return;const SUN={sunAzimuth:18,sunElevation:28},EASED={rimAzimuth:8,rimElevation:6,rimStrength:1.2,hazeSunGlow:.8,glowStrength:.9,valleyHaze:.7,layerContrast:1.35,shadowStrength:2.05},GLINT={elevation:6,strength:1},smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)},RIVER_PARS=`uniform vec4 uF2Glint;
uniform vec3 uF2GlintCol;
`,RIVER_FUNC=`
    float f2Glints(vec2 p,float seed){
      vec2 i=floor(p),f=fract(p)-.5;
      float h=montisHash(i+seed);
      vec2 o=vec2(montisHash(i+seed+17.3),montisHash(i+seed+41.9))-.5;
      float r=mix(.08,.2,montisHash(i+seed+5.1));
      float tw=pow(.5+.5*sin(uSeaTime*(1.1+2.4*h)+h*37.),5.);
      return smoothstep(r,0.,length(f-o*.6))*step(.5,h)*tw;
    }
`,MAIN_ANCHOR="void main(){",RIVER_ANCHOR="col+=montisDither(gl_FragCoord.xy)*mix(.004,.0006,uJourneyNight);",RIVER_GLSL=`
      /* flow2 canyon light: the sun's path on the river (flow2-canyon-light.js). */
      if(uRiverSurface>.5&&uF2Glint.w>.001){
        vec3 f2R=reflect(-V,nrm);
        float f2D=max(dot(f2R,uF2Glint.xyz),0.);
        float f2far=smoothstep(30.,700.,vDist);
        float f2px=fwidth(vWorld.x)+fwidth(vWorld.z)+1e-3;
        /* the column: a narrow core and a wide soft skirt, both widening with distance (the slope under a pixel) */
        /* (the core waits a few metres out: right under the lens a single wave facet would flash as a blob) */
        float f2col=pow(f2D,mix(260.,46.,f2far))*.9*smoothstep(12.,70.,vDist)+pow(f2D,mix(34.,11.,f2far))*.16;
        /* the glints: two layers of cells at different sizes and angles (one lattice reads as a dot grid),
           kept inside the column and only where a glint is larger than a pixel */
        float f2sp=f2Glints(mat2(.8,.6,-.6,.8)*vWorld.xz*.95,0.)+f2Glints(mat2(.47,-.88,.88,.47)*vWorld.xz*1.8,71.);
        f2sp*=pow(f2D,mix(40.,12.,f2far))*(1.-smoothstep(.35,1.1,f2px*.9));
        col+=uF2GlintCol*(f2col+f2sp*3.2)*uF2Glint.w*(1.-smoothstep(900.,2400.,vDist));
      }
`;function install({THREE,canyon,seaMaterial,journey,CONFIG}){if(!THREE||!canyon||!journey||!CONFIG?.alpineLight)return;const L=CONFIG.alpineLight;let glint=null,glintCol=null;const once=anchor=>seaMaterial?.fragmentShader?.split(anchor).length===2;seaMaterial?.isShaderMaterial&&once(RIVER_ANCHOR)&&once(MAIN_ANCHOR)?(glint=new THREE.Vector4(0,0,-1,0),glintCol=new THREE.Color,seaMaterial.uniforms.uF2Glint={value:glint},seaMaterial.uniforms.uF2GlintCol={value:glintCol},seaMaterial.fragmentShader=RIVER_PARS+seaMaterial.fragmentShader.replace(MAIN_ANCHOR,RIVER_FUNC+"    "+MAIN_ANCHOR).replace(RIVER_ANCHOR,RIVER_GLSL+"      "+RIVER_ANCHOR),seaMaterial.needsUpdate=!0):console.warn("flow2 canyon light: river shader anchor not found; the river is left as it was");const base={},written={},keys=[...Object.keys(SUN),...Object.keys(EASED)];for(const k of keys)base[k]=L[k];const az=SUN.sunAzimuth*Math.PI/180,el=GLINT.elevation*Math.PI/180;let lastSunColor="";function frame(){requestAnimationFrame(frame);for(const k of keys)L[k]!==written[k]&&(base[k]=L[k]);const p=journey.progress,w=1-smooth(6.95,8.9,p);for(const k of Object.keys(SUN))L[k]=written[k]=SUN[k];for(const[k,v]of Object.entries(EASED)){const b=+base[k];L[k]=written[k]=Number.isFinite(b)?b+(v-b)*w:v}glint&&(glint.set(Math.sin(az)*Math.cos(el),Math.sin(el),-Math.cos(az)*Math.cos(el),GLINT.strength*w),L.sunColor!==lastSunColor&&(lastSunColor=L.sunColor,glintCol.set(L.sunColor).lerp(new THREE.Color("#fff4e4"),.35)))}frame(),document.documentElement.dataset.flow2CanyonLight="on"}window.__FLOW2_CANYON_LIGHT__={install,SUN,EASED,GLINT}})();