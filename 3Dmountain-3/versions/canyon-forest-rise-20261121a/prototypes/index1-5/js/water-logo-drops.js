import{mergeVertices}from"three/addons/utils/BufferGeometryUtils.js";export const LOGO_DROP_DEFAULTS={enabled:1,mode:0,blur:1.2,blurSpiral:0,haze:.45,entrance:1,enterStart:-.42,enterStagger:.1,enterSwirl:.45,develop:.4,enterMerge:-.12,enterFlash:.15,count:8,radius:1.2,spacing:.78,pitch:.18,turns:1,phase:40,tiltX:-8,tiltZ:-7,offsetY:-.02,tailTaper:.18,tailDepth:.18,wave:.035,autoSpeed:0,leave:1,leaveStart:.5,leaveEnd:.97,leaveClimb:.22,leaveSpin:.35,leaveRise:1.25,leaveRadius:.85,lungeStart:.04,lungeEnd:.95,lungeFlight:.3,lungeDepth:7,lungeSpread:.8,lungeDrift:.14,lungeCurve:2,lungeRecoil:0,stream:1.4,bloomAt:0,bloomTime:.2,bloomSpread:1,bloomDepth:1,bloomTurn:16,bloomDrift:1.2,bloomEnd:0,pounceCurve:2,rainStart:.52,rainEnd:.97,rainFall:.2,rainLand:-.88,splash:1,size:.2,sizeVar:.7,ior:1.333,dispersion:.012,zoom:1.2,fuse:.5,veil:.1,wobble:.058,wobbleSpeed:.8,wobbleScale:1.3,inertia:1,jiggle:9,damping:.22,stretch:1,tail:1,sag:.04,roll:.4,slosh:1,limit:.45,reflect:1,spec:1,rim:.55,caustic:.5,absorb:.2,glow:.55,spray:.6,sprayLife:1,spraySize:1,ambient:.8,ambientSize:1,parallax:.35,float:1,beadLump:.3,beadWobble:1,tintStrength:.3,saturation:.72,contrast:1.08,brightness:1.03,opacity:1,mobileScale:.68,letters:0,deliverStart:.06,deliverEnd:.68,swirlEase:.8,breakTime:.55,flyTime:.85,fuseTime:.9,swirlRadius:1.4,swirlTurns:1.3,swirlPitch:.105,swirlTiltX:-3,swirlTiltZ:2,letterSize:.19,letterSizeVar:.18,crowd:1,plainSize:.11,plainSizeVar:1,crowdSpread:1,stringLift:.032,climbOut:9,climbFrom:.3,swirlBorn:.8,swirlWave:.02,fuseKick:.07,swirlRing:.6,swirlGloss:.9,swirlGlow:.5,swirlCaustic:.5,swirlHaze:.2,swirlSway:.03,swirlLeaveStart:.8,swirlLeaveEnd:1,swirlLeaveClimb:.1,gateSpread:.6,gateLift:.25,gatePush:.12,letterFill:.33,letterLens:1.3,letterYaw:15,letterPitch:7,letterFloat:1,letterShadow:.36,letterWarp:.25,popSwell:.16,popSpray:1};const PHOTOS=[["drop-digital-agency.jpg","Digital Agency"],["drop-alone-journey.jpg","Alone Journey"],["swank-flat.jpg","SWANK"],["dfz-watch.jpg","DFZ Watch"],["drop-style-crew.jpg","Style Crew"],["novaglam.jpg","Novaglam"],["headphones.jpg","Every Note"],["editorial.jpg","Selected Work"]],STRIP_ORDER=[0,1,3,7,2,5,4,6];export const LOGO_DROP_MAX=16;const SIZE_RHYTHM=(()=>{const raw=[1.16,.66,.9,1.38,.72,.54,1.08,.8],mean=raw.reduce((a,b)=>a+b,0)/raw.length;return raw.map(v=>v/mean)})(),LETTER_RHYTHM=(()=>{const raw=[1.42,.78,1.06,.88,1.16,.84,1.1,.8,.72,1.04,1.22],mean=raw.reduce((a,b)=>a+b,0)/raw.length;return raw.map(v=>v/mean)})(),GOLDEN=2.399963229728653,fract=v=>v-Math.floor(v),letterPlace=k=>k+Math.floor(k/3),DELIVER_LEAD=.028,CROWD_PEERS=[[.02,1.45],[-.03,1.35],[.03,1.5]],CROWD_AHEAD=[1.45,.95,1.3,.8,1.15,.7,.9,.55],CROWD_BEHIND=[1.45,1,1.55,.9,1.4,1.1,1.5,.9,1.35,1,1.2,.8],CROWD_RESERVE=[[-9.1,0,0,.8],[13.1,0,0,.9],[-10.2,.3,-.03,.5],[14.2,0,.02,.75],[15.3,-.24,.08,.5]];function composeCrowd(n){const list=[],last=letterPlace(n-1),add=(where,out,up,size)=>list.push({where,out,up,size});for(let k=3,peer=0;k<n;k+=3,peer++)add(letterPlace(k)-1,0,...CROWD_PEERS[peer%CROWD_PEERS.length]);for(let m=0,where=-5.5;where<last+CROWD_BEHIND.length-.5;m++,where+=2){const outside=m%3===1;add(where,outside?.34:-.3,outside?-.05:.13,[.5,.45,.6,.4][m%4])}CROWD_AHEAD.forEach((size,i)=>add(-1-i+.1*Math.sin(i*2.1+.5),0,.012*Math.cos(i*1.7),size)),CROWD_BEHIND.forEach((size,i)=>add(last+1+i+.1*Math.sin(i*1.9+1.2),0,.012*Math.cos(i*2.3+1),size)),list.forEach((drop,index)=>{drop.order=fract(index*.618034+.11),drop.enter=fract(index*.381966+.47)});const composed=list.length;for(let m=0,where=-6.5;where<last+11;m++,where+=4)add(where,.48,[-.06,.05,-.04][m%3],[1,.9,1.05][m%3]);for(const[where,out,up,size]of CROWD_RESERVE)add(where<0?where:last+where,out,up,size);for(let m=0,where=-6.5;where<last+11;m++,where+=4)add(where,-.34,.16,.6);for(let index=composed;index<list.length;index++)list[index].order=1.07+(index-composed)*.56/Math.max(1,list.length-composed),list[index].enter=fract(index*.381966+.47);return list}const CONSTELLATION=[{x:.42,y:.41,z:0},{x:.05,y:.52,z:-.55},{x:-.36,y:.46,z:-.3},{x:-.5,y:-.56,z:.35},{x:.02,y:-.5,z:0},{x:-.78,y:.02,z:-.35},{x:.62,y:-.44,z:.25},{x:.8,y:0,z:-.4}],NOISE_GLSL=`
  float hash13(vec3 p){
    p=fract(p*.1031);
    p+=dot(p,p.zyx+31.32);
    return fract((p.x+p.y)*p.z);
  }
  float vnoise(vec3 p){
    vec3 i=floor(p),f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(
      mix(mix(hash13(i),hash13(i+vec3(1.,0.,0.)),f.x),mix(hash13(i+vec3(0.,1.,0.)),hash13(i+vec3(1.,1.,0.)),f.x),f.y),
      mix(mix(hash13(i+vec3(0.,0.,1.)),hash13(i+vec3(1.,0.,1.)),f.x),mix(hash13(i+vec3(0.,1.,1.)),hash13(i+vec3(1.,1.,1.)),f.x),f.y),
      f.z);
  }
`,ROOM_GLSL=`
  uniform vec3 uRoomTop,uRoomHorizon,uRoomLower,uRoomInk,uRoomCore;
  uniform vec3 uSunDir,uSunCol;
  vec3 roomEnv(vec3 R){
    float h=clamp(R.y,-1.,1.);
    vec3 sky=mix(uRoomHorizon,uRoomTop,pow(max(h,0.),.6));
    vec3 sea=mix(uRoomHorizon,uRoomLower,pow(max(-h,0.),.35));
    sea=mix(sea,uRoomInk,smoothstep(.35,1.,-h)*.55);
    vec3 c=mix(sea,sky,smoothstep(-.015,.015,h));
    {
      float az=atan(R.x,-R.z);
      float ridge=.035+.03*sin(az*3.1+.6)+.018*sin(az*7.3+1.9)+.009*sin(az*17.+.4)+.004*sin(az*41.+2.2);
      float land=smoothstep(ridge+.004,ridge-.004,h)*smoothstep(-.03,.0,h);
      c=mix(c,mix(uRoomInk,uRoomHorizon,.52+.22*smoothstep(-.02,ridge,h)),land*.78);
    }
    float core=max(dot(R,normalize(vec3(0.,.08,-1.))),0.);
    c+=uRoomCore*(pow(core,24.)*.9+pow(core,4.)*.18);
    return c+uSunCol*pow(max(dot(R,uSunDir),0.),900.)*1.1;
  }
`,STRETCH_GLSL=`
  vec3 stretchV(vec3 v){
    float along=dot(v,uStretchDir);
    return uStretchDir*along*(1.+uStretchAmt)+(v-uStretchDir*along)*inversesqrt(1.+uStretchAmt);
  }
  vec3 unstretch(vec3 v){
    float along=dot(v,uStretchDir);
    return uStretchDir*along/(1.+uStretchAmt)+(v-uStretchDir*along)*sqrt(1.+uStretchAmt);
  }
`,letterGLSL=(ice,size)=>`
    uniform sampler2D uGlyphMap;
    /* x: wordmark heights to one drop radius; y: one over the tile's width;
       z: half the letter's thickness; w: the round on its edges. */
    uniform vec4 uGlyph;
    uniform vec3 uGlyphPos,uGlyphLook;
    uniform float uGlyphOn,uGlyphPixel,uBurst,uSwirl;
    /* A drop of the swirl is mostly clear water, and is drawn as a clear
       bead: x is the gloss of the studio's windows on it, y how much of the
       room's core is taken out of what shows through it (the photographs'
       drops are lit from inside by it; a clear bead has to sit in the room,
       not glow against it), z more of the backlit crescent. All 0 for a drop
       that carries a photograph. */
    uniform vec3 uSwirlLook;
    vec3 roomCore(vec3 R){
      float core=max(dot(R,normalize(vec3(0.,.08,-1.))),0.);
      return uRoomCore*(pow(core,24.)*.9+pow(core,4.)*.18);
    }
    /* The key window and the rim strip as a bead of water mirrors them: a
       soft-edged pane high on the left, one mullion through it, and a thin
       upright strip low on the right. */
    float beadGloss(vec3 R){
      vec3 k=normalize(vec3(-.64,.7,.3)),kx=normalize(cross(vec3(0.,1.,0.),k)),ky=cross(k,kx);
      float kd=dot(R,k);
      vec2 q=vec2(dot(R,kx),dot(R,ky))/max(kd,1e-3);
      float pane=step(0.,kd)*(1.-smoothstep(0.,.06,max(abs(q.x)-.24,abs(q.y)-.15)));
      pane*=.45+.55*smoothstep(0.,.03,abs(q.x+.04));
      vec3 r=normalize(vec3(.72,-.18,.3)),rx=normalize(cross(vec3(0.,1.,0.),r)),ry=cross(r,rx);
      float rd=dot(R,r);
      vec2 p=vec2(dot(R,rx),dot(R,ry))/max(rd,1e-3);
      float strip=step(0.,rd)*(1.-smoothstep(0.,.05,max(abs(p.x)-.05,abs(p.y)-.42)));
      return pane+strip*.5;
    }
    /* How far the march may go. A uniform, not a constant: a loop whose
       length the compiler cannot know it has to leave a loop. */
    uniform int uGlyphSteps;
    vec4 gLetter;
    float gLetterS,gLetterShade,gRim;
    ${ice}
    /* Level 0, said out loud: a fetch that needs no derivatives can stay
       inside a real loop, where an implicit one makes the compiler unroll
       the whole march (and take most of a second over it). */
    vec2 glyphField(vec2 q){return texture2DLodEXT(uGlyphMap,q*uGlyph.y+.5,0.).rg;}
    /* The outline extruded, its edges rounded. GROW: the letter coming up in
       the water \u2014 thin and shallow first, out of its own spine. */
    float glyphSolid(float d2,float z,vec2 grow){
      vec2 w=vec2(d2+grow.x,abs(z)-uGlyph.z*grow.y)+uGlyph.w;
      return min(max(w.x,w.y),0.)+length(max(w,0.))-uGlyph.w;
    }
    /* Once per pixel, at the middle wavelength: refract in, and march the
       letter across the unstretched sphere in its own frame. Leaves the
       letter's colour and coverage, how far along the ray it stands, and the
       shadow it casts in the water round it \u2014 for every trace of this pixel
       to pick up. */
    void letter(vec3 pL,vec3 vL,vec3 nL){
      gLetter=vec4(0.);gLetterS=0.;gLetterShade=1.;
      if(uGlyphOn<.5)return;
      /* The squirm bends the room as hard as it likes, but only some of it is
         let through to the letter, which has to stay legible. */
      vec3 t=refract(vL,normalize(mix(normalize(pL),nL,uGlyphLook.y)),1./uIor);
      vec3 pS=unstretch(pL);
      vec3 tS=normalize(unstretch(t));
      float b=dot(pS,tS),c=dot(pS,pS)-1.;
      float sExit=max(-b+sqrt(max(b*b-c,0.)),0.)*uGlyph.x;
      vec3 o=(uPhotoRot*pS-uGlyphPos)*uGlyph.x,d=uPhotoRot*tS;
      vec2 grow=vec2((1.-uDevelop)*.05,.3+.7*uDevelop);
      /* Only the slab the letter stands in, inside its tile. */
      vec3 box=vec3(vec2(.5/uGlyph.y),uGlyph.z);
      vec3 dd=d+step(abs(d),vec3(1e-5))*2e-5;
      vec3 t1=(-box-o)/dd,t2=(box-o)/dd;
      vec3 tn=min(t1,t2),tf=max(t1,t2);
      float s0=max(max(tn.x,tn.y),max(tn.z,0.)),s1=min(min(tf.x,tf.y),min(tf.z,sExit));
      if(s1<=s0)return;
      float px=max(uGlyphPixel,1e-4);
      float s=s0,best=1e3,sBest=s0;
      vec2 fBest=vec2(1.);
      for(int i=0;i<uGlyphSteps;i++){
        vec3 p=o+d*s;
        vec2 f=glyphField(p.xy);
        float dist=glyphSolid(min(f.x,f.y),p.z,grow);
        if(dist<best){best=dist;sBest=s;fBest=f;}
        if(dist<px*.15||s>s1)break;
        s+=max(dist,px*.3);
      }
      /* The nearest the ray came is its coverage: a pixel that grazes the
         letter is partly letter, so its edge is as soft as the drop's own. */
      float cover=clamp(1.-best/px,0.,1.);
      /* What the letter does to the water round it: a closeness of shade
         right at its outline, and the shadow it throws into the water behind
         it \u2014 down and away from the key light, soft, a little way off \u2014 so
         that it stands in the drop and is not printed on it. */
      vec2 fs=glyphField((o+d*tf.z).xy+vec2(-.045,.07));
      float thrown=1.-smoothstep(-.04,.11,min(fs.x,fs.y));
      gLetterShade=1.-uGlyphLook.x*max(exp(-max(best,0.)/.07)*.55,thrown)*(1.-cover)*uDevelop;
      if(cover<=0.)return;
      vec3 p=o+d*sBest;
      vec2 e=vec2(1.5/(${size}.*uGlyph.y),0.);
      vec2 fa=glyphField(p.xy+e),fb=glyphField(p.xy-e),fc=glyphField(p.xy+e.yx),fd=glyphField(p.xy-e.yx);
      float m=min(fBest.x,fBest.y);
      float ma=min(fa.x,fa.y),mb=min(fb.x,fb.y),mc=min(fc.x,fc.y),md=min(fd.x,fd.y);
      vec3 n=normalize(vec3(
        glyphSolid(ma,p.z,grow)-glyphSolid(mb,p.z,grow),
        glyphSolid(mc,p.z,grow)-glyphSolid(md,p.z,grow),
        glyphSolid(m,p.z+e.x,grow)-glyphSolid(m,p.z-e.x,grow))+vec3(0.,0.,1e-6));
      /* The cut: toward its outline a face turns outward, as a block of ice
         sawn to shape and softened by the water does. RIM is how far in from
         the outline this point is, G which way the outline faces. */
      vec2 g=vec2(ma-mb,mc-md);
      g/=max(length(g),1e-6);
      float rim=max(-m-grow.x,0.);
      float flatness=abs(n.z),onFace=smoothstep(.5,.9,flatness);
      n=normalize(n+vec3(iceCut(g,rim)*onFace,0.));
      /* What is behind it, seen through it. The ray bends at the letter's
         surface \u2014 unevenly, where the frost lies \u2014 runs on to the far side
         of the drop, and leaves into the room as any other ray does. */
      vec3 nf=dot(n,d)>0.?-n:n;
      vec3 d2=refract(d,normalize(nf+vec3(iceBump(p)*onFace,0.)),1./uIceCut.z);
      if(dot(d2,d2)<1e-6)d2=d;
      vec3 q=(p/uGlyph.x+uGlyphPos)*uPhotoRot,dS=d2*uPhotoRot;
      float b2=dot(q,dS),c2=dot(q,q)-1.;
      vec3 eS=q+dS*max(-b2+sqrt(max(b2*b2-c2,0.)),0.);
      vec3 tOut=normalize(stretchV(dS));
      vec3 eN=normalize(unstretch(eS));
      vec3 oOut=refract(tOut,-eN,uIor);
      if(dot(oOut,oOut)<1e-6)oOut=reflect(tOut,-eN);
      vec3 through=roomEnv(normalize(oOut*uToLocal));
      vec3 N=normalize(unstretch(n*uPhotoRot)*uToLocal);
      vec3 ice=iceShade(p,n,N,normalize(t*uToLocal),vec2(flatness,step(fBest.y,fBest.x)),through,rim,px);
      gLetter=vec4(ice,cover*smoothstep(0.,.3,uDevelop)*(1.-uGlyphLook.z));
      gLetterS=sBest/uGlyph.x;
    }
`;export function createLogoDrops(THREE,{config,renderer,env,lite=!1,onSplash=null,deferTextures=!1,progressiveTextures=!1,letters=null,chrome=null}){if(!chrome)throw new Error("index1-5 logo drops: the opening chrome (montis room + metal) was not passed");const odUniforms={...chrome.uniforms,...chrome.flow,uOdFlow:{value:0},uOdChrome:{value:new THREE.Vector4(1,.22,.35,.012)},uOdEdge:{value:new THREE.Vector4(1,12,.9,3.4)},uOdLook:{value:new THREE.Vector4(.55,1.2,0,0)}},OD_GLSL=(lite?`#define MONTIS_LITE 1
`:"")+chrome.glsl+`
    uniform vec4 uOdChrome,uOdEdge,uOdLook,uOdVar;
    /* DROPLET_COHERENCE_FLOW: shared hero clock and tints; no extra render pass. */
    uniform float uOdFlow,uOdNoiseTime,uOdNoiseScale,uOdContrast,uOdSheen;
    uniform mat3 uOdNoiseView;
    uniform vec3 uOdTint0,uOdTint1;
float odHeroRnd(vec3 p){
  /* Periodic in 256, so the phase wraps without a seam and sin() never
     sees an argument large enough to lose precision. */
  p=mod(p,256.);
  return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453123);
}
float odHeroNoise(vec3 p){
  vec3 i=floor(p);
  vec3 f=fract(p);
  float a000=odHeroRnd(i);
  float a100=odHeroRnd(i+vec3(1.,0.,0.));
  float a010=odHeroRnd(i+vec3(0.,1.,0.));
  float a110=odHeroRnd(i+vec3(1.,1.,0.));
  float a001=odHeroRnd(i+vec3(0.,0.,1.));
  float a101=odHeroRnd(i+vec3(1.,0.,1.));
  float a011=odHeroRnd(i+vec3(0.,1.,1.));
  float a111=odHeroRnd(i+vec3(1.,1.,1.));
  vec3 u=f*f*(3.-2.*f);
  float k0=a000;
  float k1=a100-a000;
  float k2=a010-a000;
  float k3=a001-a000;
  float k4=a000-a100-a010+a110;
  float k5=a000-a010-a001+a011;
  float k6=a000-a100-a001+a101;
  float k7=-a000+a100+a010-a110+a001-a101-a011+a111;
  return k0+k1*u.x+k2*u.y+k3*u.z+k4*u.x*u.y+k5*u.y*u.z+k6*u.z*u.x+k7*u.x*u.y*u.z;
}
    /* Chapter 1's burst: the same metal against the same room, the iris wandering by a per-drop seed.
       2026-10-24 (client \u300C\u9019\u87BA\u65CB\u6C34\u6EF4\u5F88\u602A\uFF0C\u53EF\u80FD\u592A\u898F\u5247\u300D): a row of mirror balls in one infinitely far room all show the
       same picture \u2014 printed copies. Each drop now mirrors the room turned a little its own way (uOdVar.y/z: tumbling
       water never shows its studio square-on), goes softer when it is near the lens (w: defocus), and carries the real
       low sun as nothing else in it does: a warm rim on its sun side and one hard glint that moves with the drop. */
    mat3 odTurn(float a,float b){
      float ca=cos(a),sa=sin(a),cb=cos(b),sb=sin(b);
      return mat3(ca,0.,-sa,0.,1.,0.,sa,0.,ca)*mat3(1.,0.,0.,0.,cb,sb,0.,-sb,cb);
    }
    vec3 odChrome(vec3 N,vec3 Vc,float seed){
      mat3 T=odTurn(uOdVar.y,uOdVar.z);
      vec3 Nt=T*N,Vt=T*Vc;
      float mask=smoothstep(.25,.85,fract(seed+Nt.y*.5+Nt.x*.31));
      vec3 phase=vec3(fract(seed)*9.7);
      if(uOdFlow>.001){
        // Broad, slow refraction moves within the round silhouette.
        float t=uOdNoiseTime;
        vec3 A=vec3(2.1,3.4,1.3),B=vec3(-2.7,1.8,3.1);
        vec3 bend=(A*cos(dot(Nt,A)+t*1.1+seed)+B*cos(dot(Nt,B)-t*.8+seed))*.012*uOdFlow;
        Nt=normalize(Nt+bend-Nt*dot(Nt,bend));
        mask=smoothstep(.25,.85,odHeroNoise(Nt*uOdNoiseScale+t+phase));
      }
      vec3 c=montisChrome(Nt,Vt,vec2(0.,1.),.35,uOdChrome.w+uOdVar.w*.07,mask,uOdChrome.z,uOdChrome.y);
      if(uOdFlow>.001){
        // Same two moving interior light fields as the hero, with staggered phases.
        vec3 r=reflect(vec3(0.,0.,-1.),normalize(uOdNoiseView*Nt));
        float a=odHeroNoise(r*uOdNoiseScale+uOdNoiseTime+phase);
        float b=odHeroNoise(r*uOdNoiseScale-uOdNoiseTime+phase);
        vec3 light=pow(max((uOdTint0*a+uOdTint1*b)*2.3,vec3(0.)),vec3(uOdContrast))*uOdSheen;
        vec3 sheen=min(light,vec3(1.))*uOdSheen*.35*min(uOdFlow,1.);
        c=vec3(1.)-(vec3(1.)-c)*(vec3(1.)-sheen);
      }
      float face=clamp(dot(N,Vc),0.,1.);
      c+=uEnvGlow*uOdEdge.x*pow(1.-face,uOdEdge.y);
      vec3 S=normalize(uEnvCoreDir);
      float behind=clamp(dot(-Vc,S),0.,1.);
      c+=uEnvGlow*uOdEdge.z*pow(face,uOdEdge.w)*behind;
      vec3 sunC=uEnvGlow*(1.+uEnvSunTint);
      c+=sunC*uOdLook.x*pow(1.-face,2.2)*smoothstep(-.15,.7,dot(N,S));
      c+=sunC*uOdLook.y*pow(max(dot(reflect(-Vc,N),S),0.),mix(900.,90.,uOdVar.w));
      return max(c,vec3(0.));
    }
  `,group=new THREE.Group;group.name="logo-water-drops",group.visible=!1;const weldedSphere=detail=>{const raw=new THREE.IcosahedronGeometry(1,detail);raw.deleteAttribute("normal"),raw.deleteAttribute("uv");const welded=mergeVertices(raw);return raw.dispose(),welded},geometry=weldedSphere(lite?4:5),meshes=[],textures=[],fallbackCanvas=document.createElement("canvas");fallbackCanvas.width=fallbackCanvas.height=2;const fallbackContext=fallbackCanvas.getContext("2d");fallbackContext.fillStyle="#c9d7e3",fallbackContext.fillRect(0,0,2,2);const placeholder=new THREE.CanvasTexture(fallbackCanvas);placeholder.colorSpace=THREE.SRGBColorSpace;const MAX_SAMPLES=lite?3:8,letterShader=letters?letterGLSL(letters.glsl,Math.round(letters.size)):"",vertexShader=`
    uniform float uTime,uWobble,uWobbleSpeed,uWobbleScale,uSeed,uStretchAmt,uBlurOn;
    uniform vec3 uStretchDir,uTail,uSweep;
    uniform mat3 uRollNoise;
    varying vec3 vWorld;
    varying vec3 vNormalW;
    ${NOISE_GLSL}
    ${STRETCH_GLSL}
    /* The squirm: three octaves drifting through the surface in three
       different directions at three different rates, so the drop heaves
       and bulges at once and never returns to a shape it has held. The
       octaves fall away steeply on purpose: surface tension smooths short
       wavelengths first, so water keeps its big slow lobes and loses its
       fine ones \u2014 weight them evenly and a bead reads as crumpled film.
       Roughly -1..1. */
    float wriggle(vec3 d){
      vec3 p=d*uWobbleScale+uSeed*7.31;
      float t=uTime*uWobbleSpeed;
      float w=vnoise(p+vec3(t*.31,-t*.23,t*.17))-.5;
      w+=(vnoise(p*2.13+vec3(-t*.47,t*.39,t*.29)+11.)-.5)*.38;
      w+=(vnoise(p*4.37+vec3(t*.71,t*.63,-t*.55)+23.)-.5)*.08;
      return w*2.3;
    }
    /* The whole surface, as a function of direction: squirm, then the
       inertial stretch (volume-preserving, along the lag), then the tear. */
    vec3 surf(vec3 n){
      /* The liquid's own frame, rolled: the lumps are carried round as the
         drop travels, and do not turn with the photograph's facing. */
      vec3 p=stretchV(n*(1.+uWobble*wriggle(uRollNoise*n)));
      float tl=length(uTail);
      if(tl>1e-5){
        vec3 b=uTail/tl;
        float c=dot(n,b);
        float back=max(0.,-c),front=max(0.,c);
        /* The back pulls out into a tear; the front, pushing into the air,
           flattens a little. */
        p+=-b*tl*(back*back*1.15)-b*tl*front*front*front*.22;
      }
      return p;
    }
    void main(){
      vec3 n=normalize(position);
      if(uBlurOn>.5){
        /* Blurred, the mesh is only the hull of the sweep \u2014 the drop now and
           where it was when the shutter opened, joined into a capsule, a
           little oversize. The fragment shader fills it exactly. */
        vec3 p=stretchV(n*(1.04+uStretchAmt*.08));
        if(dot(n,uSweep)<0.)p-=uSweep;
        vec4 hull=modelMatrix*vec4(p,1.);
        vWorld=hull.xyz;
        vNormalW=normalize(mat3(modelMatrix)*n);
        gl_Position=projectionMatrix*viewMatrix*hull;
        return;
      }
      /* The normal of the surface actually drawn, by finite difference \u2014
         whatever the squirm, the stretch and the tear do, the highlights
         and the refraction follow them. */
      vec3 t1=normalize(abs(n.y)<.99?cross(n,vec3(0.,1.,0.)):cross(n,vec3(1.,0.,0.)));
      vec3 t2=cross(n,t1);
      const float e=.035;
      vec3 p0=surf(n);
      vec3 p1=surf(normalize(n+t1*e));
      vec3 p2=surf(normalize(n+t2*e));
      vec3 nn=normalize(cross(p1-p0,p2-p0));
      if(dot(nn,p0)<0.)nn=-nn;
      vec4 world=modelMatrix*vec4(p0,1.);
      vWorld=world.xyz;
      vNormalW=normalize(mat3(modelMatrix)*nn);
      gl_Position=projectionMatrix*viewMatrix*world;
    }
  `,fragmentShader=`
    uniform sampler2D uPhoto;
    uniform samplerCube uEnv;
    uniform mat3 uToLocal,uPhotoRot;
    uniform vec3 uCenter,uPaper,uInk,uStretchDir,uSweep;
    uniform vec2 uCover,uFuse;
    uniform float uRadius,uIor,uDispersion,uVeil,uReflect,uSpec,uRim,uCaustic,uAbsorb,uOpacity,uStretchAmt;
    uniform float uTintStrength,uSaturation,uContrast,uBrightness,uEnvStudio,uBlurOn,uBlurSamples,uHaze,uTime,uClipY,uDevelop;
    varying vec3 vWorld,vNormalW;
    ${ROOM_GLSL}
    ${STRETCH_GLSL}
    uniform float uSeed;
    ${OD_GLSL}
    /* The cards' grade, so the two rings share one palette. */
    vec3 grade(vec3 c){
      float lum=dot(c,vec3(.2126,.7152,.0722));
      float tone=clamp((pow(max(lum,0.),.78)-.5)*uContrast+.5,0.,1.);
      vec3 silver=mix(uInk,uPaper,tone);
      return mix(mix(vec3(lum),c,uSaturation),silver,uTintStrength)*uBrightness;
    }
${letterShader}
    /* One wavelength through the drop. Refract in at the true surface; trace
       across the unstretched sphere, where the photograph lies on the plane
       through the centre (tipped by the slosh) and covers the whole disc;
       leave through the back at the true ellipsoid's normal. Every boundary
       of the construction sits where the picture has already dissolved to
       nothing, so none can show, and every sample is taken outside any
       branch. */
    vec3 trace(vec3 pL,vec3 vL,vec3 nL,float ior,out float onPhoto){
      vec3 t=refract(vL,nL,1./ior);
      vec3 pS=unstretch(pL);
      vec3 tS=normalize(unstretch(t));
      float b=dot(pS,tS),c=dot(pS,pS)-1.;
      float sExit=max(-b+sqrt(max(b*b-c,0.)),0.);
      vec3 pP=uPhotoRot*pS,tP=uPhotoRot*tS;
      float tz=abs(tP.z)>1e-4?tP.z:1e-4;
      float sPhoto=-pP.z/tz;
      vec2 q=pP.xy+tP.xy*sPhoto;
      float inFront=step(0.,sPhoto)*step(sPhoto,sExit);
      /* DEVELOP: while a drop is still arriving it is only water; the
         picture comes up in it as it settles. */
      onPhoto=inFront*(1.-smoothstep(uFuse.x,uFuse.y,length(q)))*uDevelop;
      vec2 uv=q*uCover+.5;
      /* Seen from behind the picture is mirrored, as a card's back is. */
      uv.x=mix(uv.x,1.-uv.x,step(0.,tP.z));
      vec3 photo=grade(texture2D(uPhoto,clamp(uv,0.,1.)).rgb);${letters?`
      /* Carrying a letter, that is what the ray meets \u2014 already marched,
         once, for this point of the drop. */
      if(uGlyphOn>.5){onPhoto=gLetter.a;photo=gLetter.rgb;sPhoto=gLetterS;}`:""}
      vec3 exitS=pS+tS*sExit;
      vec3 exitN=normalize(unstretch(exitS));
      vec3 o=refract(t,-exitN,ior);
      /* Past the critical angle the light cannot leave: it turns back into
         the drop, which is where the bright ring at the rim of every real
         water bead comes from. */
      if(dot(o,o)<1e-6)o=reflect(t,-exitN);
      vec3 room=roomEnv(normalize(o*uToLocal));
      room=mix(room,montisEnv(normalize(o*uToLocal),.03,.035,0.),uOdLook.z);${letters?`
      room-=roomCore(normalize(o*uToLocal))*uSwirlLook.y;
      room*=gLetterShade;`:""}
      /* Suspended, not printed: the room that would have come through the
         back still does, a little, through the picture itself. */
      photo=mix(photo,room,uVeil);
      /* Water tints what it carries, by how far it carried it. */
      float path=mix(sExit,sPhoto,onPhoto);
      return mix(room,photo,onPhoto)*exp(-vec3(.13,.095,.075)*uAbsorb*path*2.);
    }

    /* Everything the drop shows at one point of its surface: the trace (three
       wavelengths, or one when the point is one of several blur samples and
       the dispersion could not show anyway), the dark thick edge, the
       backlit crescent, the Fresnel mirror, the windows and the sun. */
    vec3 surface(vec3 pL,vec3 vL,vec3 nL,vec3 V,vec3 N,bool mono){
      vec3 col;
      if(mono){
        float on;
        col=trace(pL,vL,nL,uIor,on);
      }else{
        float onR,onG,onB;
        vec3 cR=trace(pL,vL,nL,uIor-uDispersion,onR);
        vec3 cG=trace(pL,vL,nL,uIor,onG);
        vec3 cB=trace(pL,vL,nL,uIor+uDispersion*1.6,onB);
        col=vec3(cR.r,cG.g,cB.b);
      }
      float NdV=clamp(dot(N,-V),0.,1.);${letters?`
      gRim=pow(1.-NdV,1.6);`:""}
      /* The thick edge: a clean dark band just inside the silhouette, where
         the rays leaving the back are bent far enough to see the floor, or
         cannot leave at all. Steep, so it is a band and not a vignette. */
      col=mix(col,col*mix(vec3(1.),uInk*1.35,.72),pow(1.-NdV,4.)*uRim);${letters?`
      /* In the swirl most of a drop is plain water, and the water has to
         draw itself: a line of shade just inside its edge, where the dark of
         a room gathers in a clear bead, under the bright line of the mirror
         outside it. */
      col=mix(col,col*mix(vec3(1.),uInk,.86),smoothstep(.5,.86,1.-NdV)*uSwirl);`:""}
      /* The backlit crescent: light from behind, gathered by the ball and
         thrown out through the lower front edge toward the lens. */
      float crescent=pow(max(dot(N,-uSunDir),0.),3.)*pow(1.-NdV,1.2);
      col+=uSunCol*vec3(.95,.98,1.)*crescent*uCaustic*.6;${letters?`
      col+=uSunCol*vec3(.95,.98,1.)*crescent*uSwirlLook.z;`:""}
      /* The mirror on the front. Water's F0 is two percent, so the room's
         reflection lives almost entirely at the rim \u2014 the thin bright line
         outside the dark band. */
      vec3 R=reflect(V,N);
      float fresnel=.04+.96*pow(1.-NdV,5.);
      col=mix(col,roomEnv(R),clamp(fresnel*uReflect,0.,1.));
      /* The windows: the studio's softboxes, sharp. On a real bead the key
         light's reflection is the brightest thing in the frame. */
      vec3 studio=textureCubeLodEXT(uEnv,R,.6).rgb;
      col+=studio*uEnvStudio*(.08+fresnel)*uSpec*1.6;${letters?`
      col+=vec3(.97,.985,1.)*beadGloss(R)*uSwirlLook.x;`:""}
      /* And one hard point of sun with a soft bloom around it. */
      vec3 H=normalize(uSunDir-V);
      float nh=max(dot(N,H),0.);
      col+=uSunCol*(pow(nh,900.)*2.4+pow(nh,60.)*.12)*uSpec;
      return col;
    }

    void main(){
      vec3 V=normalize(vWorld-cameraPosition);
      vec3 vL=normalize(uToLocal*V);
      vec3 col;
      float alpha=uOpacity;
      if(uBlurOn>.5){
        /* The motion blur, solved. In the drop's own unstretched frame its
           centre moves from -sweep to 0 over the exposure (tau from -1 to 0)
           and the drop is the unit sphere. The squared distance from the
           moving centre to this pixel's ray is a quadratic in tau; where it
           is under one, the ray is inside the drop. The length of that
           interval is how much of the exposure this pixel saw water \u2014 the
           alpha \u2014 and the colour is the drop traced at moments spread
           across it, dithered so few samples read as a smear, not as
           copies. */
        vec3 oS=unstretch(uToLocal*((cameraPosition-uCenter)/uRadius));
        vec3 dS=unstretch(vL),wS=unstretch(uSweep);
        float dd=dot(dS,dS),wd=dot(wS,dS),md=-dot(oS,dS);
        float A=dot(wS,wS)-wd*wd/dd;
        float B=2.*(-dot(oS,wS)-md*wd/dd);
        float C=dot(oS,oS)-md*md/dd-1.;
        float lo=-1.,hi=0.;
        if(A>1e-7){
          float disc=B*B-4.*A*C;
          if(disc<=0.)discard;
          float q=sqrt(disc);
          lo=max(lo,(-B-q)/(2.*A));
          hi=min(hi,(-B+q)/(2.*A));
        }else if(C>0.)discard;
        if(hi<=lo)discard;
        /* White noise, new every frame: with no temporal filter to settle
           it, a structured dither shows as a pattern; this reads as grain. */
        vec3 q3=fract(vec3(gl_FragCoord.xyx+fract(uTime*7.31)*97.)*.1031);
        q3+=dot(q3,q3.yzx+33.33);
        float jitter=fract((q3.x+q3.y)*q3.z);
        col=vec3(0.);
        float kept=0.;${letters?`
        /* The letter is marched once, where the drop is now \u2014 not once for
           every moment of the smear: a drop fast enough to smear has not yet
           brought its letter up, and the march is the costly part. */
        float b0=dot(oS,dS),h0=b0*b0-dd*(dot(oS,oS)-1.);
        vec3 pNow=oS+dS*((-b0-sqrt(max(h0,0.)))/dd);
        letter(stretchV(pNow),vL,normalize(unstretch(pNow)));
        gLetter.a*=step(0.,h0);gLetterShade=mix(1.,gLetterShade,step(0.,h0));`:""}
        for(int k=0;k<${MAX_SAMPLES};k++){
          if(float(k)>=uBlurSamples)break;
          float tau=mix(lo,hi,(float(k)+jitter)/uBlurSamples);
          vec3 oc=oS-wS*tau;
          float b=dot(oc,dS),c=dot(oc,oc)-1.;
          vec3 pS=oc+dS*((-b-sqrt(max(b*b-dd*c,0.)))/dd);
          /* Under the waterline at that moment, the sea has it. */
          if(uCenter.y+(stretchV(pS+wS*tau)*uToLocal).y*uRadius<uClipY)continue;
          vec3 nL=normalize(unstretch(pS));
          col+=surface(stretchV(pS),vL,nL,V,normalize(nL*uToLocal),true);
          kept+=1.;
        }
        if(kept<.5)discard;
        col/=kept;
        alpha*=(hi-lo)*kept/uBlurSamples;
      }else{
        /* A drop going into the sea is cut by the waterline. */
        if(vWorld.y<uClipY)discard;
        vec3 N=normalize(vNormalW);${letters?`
        letter(uToLocal*((vWorld-uCenter)/uRadius),vL,normalize(uToLocal*N));`:""}
        col=surface(uToLocal*((vWorld-uCenter)/uRadius),vL,normalize(uToLocal*N),V,N,false);${letters?`
        /* Breaking: the body of the drop clears first and its rim last, so
           what is left for a moment is a ring of water round the letter. */
        alpha*=mix(1.,min(1.,gRim*1.9),uBurst);`:""}
      }
      /* Distance: a far drop sinks into the room's pale air. */
      /* The hero's metal over the water. A letter still inside its drop shows through. */
      {
        float od=uOdChrome.x*uOdVar.x;${letters?`
        od*=1.-uGlyphOn*gLetter.a*.85;`:""}
        col=mix(col,odChrome(normalize(vNormalW),-V,uSeed*5.17),clamp(od,0.,1.));
        /* out of focus near the lens: the edge goes soft as a lens draws it */
        alpha*=mix(1.,smoothstep(0.,.45,clamp(dot(normalize(vNormalW),-V),0.,1.)),uOdVar.w);
      }
      col=mix(col,uRoomHorizon,uHaze);
      gl_FragColor=vec4(col,alpha);
    }
  `,shared={uSunDir:env?.uSunDir??{value:new THREE.Vector3(-.35,.28,-.9).normalize()},uSunCol:env?.uSunCol??{value:new THREE.Color("#ffffff")},uEnv:env?.uEnv??{value:null},uEnvStudio:env?.uEnvStudio??{value:.26},uRoomTop:{value:new THREE.Color("#92a8cd")},uRoomHorizon:{value:new THREE.Color("#e6edf7")},uRoomLower:{value:new THREE.Color("#c9d5e8")},uRoomInk:{value:new THREE.Color("#3f5a7e")},uRoomCore:{value:new THREE.Color("#ffffff")},uFuse:{value:new THREE.Vector2(.54,1)},...odUniforms},roomSources=Object.create(null);function syncRoomColor(name,source){(roomSources[name]!==source||source&&typeof source=="object")&&(shared[name].value.set(source),roomSources[name]=source)}const worldPosition=new THREE.Vector3,worldQuaternion=new THREE.Quaternion,worldScale=new THREE.Vector3,toLocal=new THREE.Matrix4;function makeDrop(index){const photo=STRIP_ORDER[index%STRIP_ORDER.length],uniforms={...shared,uPhoto:{value:placeholder},uCover:{value:new THREE.Vector2(.5,.5)},uCenter:{value:new THREE.Vector3},uRadius:{value:1},uToLocal:{value:new THREE.Matrix3},uPaper:{value:new THREE.Color},uInk:{value:new THREE.Color},uTime:{value:0},uSeed:{value:index*.137+.05},uStretchDir:{value:new THREE.Vector3(0,1,0)},uStretchAmt:{value:0},uTail:{value:new THREE.Vector3},uSweep:{value:new THREE.Vector3},uRollNoise:{value:new THREE.Matrix3},uPhotoRot:{value:new THREE.Matrix3}};for(const name of["Wobble","WobbleSpeed","WobbleScale","Ior","Dispersion","Veil","Reflect","Spec","Rim","Caustic","Absorb","Opacity","TintStrength","Saturation","Contrast","Brightness","BlurOn","BlurSamples","Haze"])uniforms["u"+name]={value:0};uniforms.uClipY={value:-1e9},uniforms.uOdVar={value:new THREE.Vector4(1,0,0,0)},uniforms.uDevelop={value:progressiveTextures?0:1},letters&&Object.assign(uniforms,letters.uniforms,{uGlyphMap:{value:null},uGlyph:{value:new THREE.Vector4(1,1,.1,.014)},uGlyphPos:{value:new THREE.Vector3},uGlyphLook:{value:new THREE.Vector3},uGlyphOn:{value:0},uGlyphPixel:{value:.01},uBurst:{value:0},uSwirl:{value:0},uSwirlLook:{value:new THREE.Vector3},uGlyphSteps:{value:lite?12:18}});const material=new THREE.ShaderMaterial({name:"Water drop \xB7 "+PHOTOS[photo][1],uniforms,vertexShader,fragmentShader,transparent:!0,depthWrite:!0}),mesh=new THREE.Mesh(geometry,material);return mesh.name="Water drop "+(index+1)+" \xB7 "+PHOTOS[photo][1],mesh.frustumCulled=!1,mesh.visible=!1,mesh.renderOrder=4,mesh.userData.slot=index,mesh.userData.photo=photo,mesh.userData.aspect=1.42,mesh.userData.body={fresh:!0,prev:new THREE.Vector3,vel:new THREE.Vector3,velPrev:new THREE.Vector3,accel:0,owed:0,wet:0,spring:new THREE.Vector3,springVel:new THREE.Vector3,roll:new THREE.Quaternion,rollAxis:new THREE.Vector3(1,0,0),slosh:0,sloshVel:0},mesh.onBeforeRender=function(drawing,scene,camera){this.matrixWorld.decompose(worldPosition,worldQuaternion,worldScale);const u=this.material.uniforms;if(u.uCenter.value.copy(worldPosition),u.uRadius.value=worldScale.x,toLocal.makeRotationFromQuaternion(worldQuaternion).transpose(),u.uToLocal.value.setFromMatrix4(toLocal),letters&&camera?.isPerspectiveCamera){const height=drawing.getRenderTarget()?.height??drawing.domElement.height,span=2*worldPosition.distanceTo(camera.position)/(camera.projectionMatrix.elements[5]*Math.max(1,height));u.uGlyphPixel.value=span/Math.max(1e-6,worldScale.x)*u.uGlyph.value.x/Math.max(1,config.letterLens)}},mesh}for(let index=0;index<LOGO_DROP_MAX;index++){const mesh=makeDrop(index);group.add(mesh),meshes.push(mesh)}const core=makeDrop(LOGO_DROP_MAX);core.name="Water drop \xB7 the converging core",core.material.name="Water drop \xB7 core",core.material.uniforms.uDevelop.value=0,group.add(core);let crowd=[];const crowdMeshes=[];function ensureCrowd(n){for(crowd=composeCrowd(n);crowdMeshes.length<crowd.length;){const index=crowdMeshes.length,mesh=makeDrop(LOGO_DROP_MAX+1+index);mesh.name="Water drop \xB7 plain "+(index+1),mesh.material.name="Water drop \xB7 plain",mesh.material.uniforms.uDevelop.value=0,mesh.userData.plain=index,mesh.userData.photo=-1,group.add(mesh),meshes.push(mesh),crowdMeshes.push(mesh)}}const SPRAY_MAX=lite?160:300,AMBIENT_BASE=lite?44:80,AMBIENT_MAX=AMBIENT_BASE*2,BEADS=SPRAY_MAX+AMBIENT_MAX,beadGeometry=weldedSphere(lite?2:3),beadData=new Float32Array(BEADS*4),beadAttribute=new THREE.InstancedBufferAttribute(beadData,4).setUsage(THREE.DynamicDrawUsage);beadGeometry.setAttribute("aBead",beadAttribute);const beadUniforms={uSunDir:shared.uSunDir,uSunCol:shared.uSunCol,uEnv:shared.uEnv,uEnvStudio:shared.uEnvStudio,uRoomTop:shared.uRoomTop,uRoomHorizon:shared.uRoomHorizon,uRoomLower:shared.uRoomLower,uRoomInk:shared.uRoomInk,uRoomCore:shared.uRoomCore,uTime:{value:0},uBeadWobble:{value:1},uIor:{value:1.333},uReflect:{value:1},uSpec:{value:1},uRim:{value:.55},uCaustic:{value:.5},uAbsorb:{value:.2},...odUniforms,uOdVar:{value:new THREE.Vector4(1,0,0,0)}},beadMaterial=new THREE.ShaderMaterial({name:"Water drops \xB7 spray and loose beads",uniforms:beadUniforms,transparent:!0,depthWrite:!0,vertexShader:`
      attribute vec4 aBead;
      uniform float uTime,uBeadWobble;
      varying vec3 vWorld,vNormalW,vCenter;
      varying float vOdSeed;
      varying mat3 vInv;
      varying float vAlpha;
      ${NOISE_GLSL}
      /* Lumps at the scale of the bead itself \u2014 two octaves, the second
         weak \u2014 so it reads as a small body of water that has not yet pulled
         itself round, not as a round bead with a rough skin. Each bead its
         own lobe count: from one broad heave to three or four bulges. */
      float lumps(vec3 n){
        vec3 p=n*(1.1+fract(aBead.x*3.71)*.95)+aBead.x*19.7;
        float t=uTime*uBeadWobble*(.8+fract(aBead.x*7.13)*.6);
        float w=vnoise(p+vec3(t*.53,-t*.41,t*.37))-.5;
        w+=(vnoise(p*2.2+vec3(-t*.71,t*.6,t*.47)+13.)-.5)*.45;
        return w*2.4;
      }
      /* Local +y is the direction of flight: the back draws out into a tear. */
      vec3 surf(vec3 n){
        vec3 p=n*(1.+aBead.z*lumps(n));
        float back=max(0.,-n.y);
        p.y-=aBead.w*back*back*1.4;
        return p;
      }
      void main(){
        #ifdef USE_INSTANCING
          mat4 M=modelMatrix*instanceMatrix;
        #else
          mat4 M=modelMatrix;
        #endif
        vec3 n=normalize(position);
        vec3 t1=normalize(abs(n.y)<.99?cross(n,vec3(0.,1.,0.)):cross(n,vec3(1.,0.,0.)));
        vec3 t2=cross(n,t1);
        const float e=.05;
        vec3 w0=(M*vec4(surf(n),1.)).xyz;
        vec3 w1=(M*vec4(surf(normalize(n+t1*e)),1.)).xyz;
        vec3 w2=(M*vec4(surf(normalize(n+t2*e)),1.)).xyz;
        vCenter=(M*vec4(0.,0.,0.,1.)).xyz;
        vec3 nn=normalize(cross(w1-w0,w2-w0));
        if(dot(nn,w0-vCenter)<0.)nn=-nn;
        /* Back to the unit sphere the instance was made from, for the
           trace: the ellipsoid of the flight stretch undone exactly. */
        vInv=inverse(mat3(M));
        vWorld=w0;
        vNormalW=nn;
        vAlpha=aBead.y;
        vOdSeed=aBead.x;
        gl_Position=projectionMatrix*viewMatrix*vec4(w0,1.);
      }
    `,fragmentShader:`
      uniform samplerCube uEnv;
      uniform float uIor,uReflect,uSpec,uRim,uCaustic,uAbsorb,uEnvStudio;
      ${OD_GLSL}
      varying vec3 vWorld,vNormalW,vCenter;
      varying float vOdSeed;
      varying mat3 vInv;
      varying float vAlpha;
      ${ROOM_GLSL}
      /* The big drops' trace without the photograph: in at the true surface,
         across the (stretched) sphere, out through the back into the room \u2014
         so each bead holds the room upside down, as the drops do. */
      void main(){
        vec3 N=normalize(vNormalW);
        vec3 V=normalize(vWorld-cameraPosition);
        float NdV=clamp(dot(N,-V),0.,1.);
        vec3 t=refract(V,N,1./uIor);
        vec3 pS=vInv*(vWorld-vCenter);
        vec3 tS=normalize(vInv*t);
        float b=dot(pS,tS),c=dot(pS,pS)-1.;
        float s=max(-b+sqrt(max(b*b-c,0.)),0.);
        vec3 exitN=normalize(transpose(vInv)*(pS+tS*s));
        vec3 o=refract(t,-exitN,uIor);
        if(dot(o,o)<1e-6)o=reflect(t,-exitN);
        vec3 col=roomEnv(normalize(o))*exp(-vec3(.13,.095,.075)*uAbsorb*s);
        col=mix(col,col*mix(vec3(1.),uRoomInk*1.35,.72),pow(1.-NdV,3.)*uRim);
        float crescent=pow(max(dot(N,-uSunDir),0.),3.)*pow(1.-NdV,1.2);
        col+=uSunCol*crescent*uCaustic*.6;
        vec3 R=reflect(V,N);
        float fresnel=.04+.96*pow(1.-NdV,5.);
        col=mix(col,roomEnv(R),clamp(fresnel*uReflect,0.,1.));
        col+=textureCubeLodEXT(uEnv,R,.6).rgb*uEnvStudio*(.08+fresnel)*uSpec*1.6;
        vec3 H=normalize(uSunDir-V);
        float nh=max(dot(N,H),0.);
        col+=uSunCol*(pow(nh,500.)*2.4+pow(nh,50.)*.12)*uSpec;
        /* The metal reads the bead's smooth body, not its lumps: a mirror on a twelve-pixel lump of facets is crumpled foil. */
        vec3 odN=normalize(mix(N,normalize(transpose(vInv)*(vInv*(vWorld-vCenter))),.85));
        col=mix(col,odChrome(odN,-V,uOdFlow>.001?vOdSeed*5.17:fract(dot(vCenter,vec3(.71,.37,.53))*3.1)),clamp(uOdChrome.x,0.,1.));
        gl_FragColor=vec4(col,vAlpha);
      }
    `}),beads=new THREE.InstancedMesh(beadGeometry,beadMaterial,BEADS);beads.name="Water drops \xB7 spray and loose beads",beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage),beads.count=0,beads.frustumCulled=!1,beads.renderOrder=3.9,group.add(beads);const sprayPos=new Float32Array(SPRAY_MAX*3),sprayVel=new Float32Array(SPRAY_MAX*3),sprayLife=new Float32Array(SPRAY_MAX),sprayMax=new Float32Array(SPRAY_MAX),spraySize=new Float32Array(SPRAY_MAX),sprayLump=new Float32Array(SPRAY_MAX),spraySeed=new Float32Array(SPRAY_MAX);let sprayNext=0,seedState=2654435769;const seeded=()=>(seedState=seedState*1664525+1013904223>>>0,seedState/4294967296),ambient=Array.from({length:AMBIENT_MAX},()=>{const kind=seeded(),large=kind>.88,medium=kind>.66&&!large,near=seeded()<.12,rho=near?1.25+seeded()*.4:.3+Math.sqrt(seeded())*1.25,theta=near?(seeded()-.5)*1.2:seeded()*Math.PI*2,squash=.7+seeded()*.7,axis2=new THREE.Vector3(seeded()-.5,seeded()-.5,seeded()-.5);return axis2.lengthSq()<1e-4&&axis2.set(0,1,0),axis2.normalize(),{theta,rho,y:-.82+seeded()*1.55,size:large?.03+seeded()*.016:medium?.015+seeded()*.012:.005+Math.pow(seeded(),1.4)*.01,squash:[1/Math.sqrt(squash),squash,1/Math.sqrt(squash)],axis:axis2,spinRate:(seeded()-.5)*.9,tumble:seeded()*Math.PI*2,lump:.65+seeded()*.8,seed:seeded(),phase:seeded()*Math.PI*2,bob:.5+seeded()*.9,swirl:(seeded()-.5)*.08,lane:seeded(),order:seeded()}});for(let j=AMBIENT_BASE;j<AMBIENT_MAX;j++)ambient[j].order+=1;const randomUnit=out=>{const z=Math.random()*2-1,a=Math.random()*Math.PI*2,s=Math.sqrt(1-z*z);return out.set(Math.cos(a)*s,z,Math.sin(a)*s)},scatter=new THREE.Vector3,trail=new THREE.Vector3,ambientPos=new THREE.Vector3,layouts=new Map;function layoutFor(count){if(layouts.has(count))return layouts.get(count);const lanes=[],places=[];for(let s=0;s<count;s++){const a=s*GOLDEN+.7,r=.62+.38*fract(s*.618034+.21);if(lanes.push({x:Math.cos(a)*r*1.3,y:Math.sin(a)*r*.78}),s<CONSTELLATION.length)places.push({...CONSTELLATION[s]});else{const b=s*GOLDEN+2.1,ring=.85+.15*fract(s*.618034+.5),x=Math.cos(b)*.8*ring;let y=Math.sin(b)*.62*ring;Math.abs(x)<.56&&Math.abs(y)<.3&&(y=(y<0?-1:1)*(.3+Math.abs(y)*.5)),places.push({x,y,z:-.2+Math.sin(b*1.7+.6)*.45})}}const rankBy=key=>{const out=new Array(count);return[...Array(count).keys()].sort((i,j)=>key(i)-key(j)).forEach((slot,k)=>{out[slot]=count>1?k/(count-1):1}),out},layout={lanes,places,lunge:rankBy(s=>fract(s*.618034+.37)),bloom:rankBy(s=>fract(s*.381966+.13)),rain:rankBy(s=>places[s].y),enter:rankBy(s=>fract(s*.618034+.71))};return layouts.set(count,layout),layout}function emit(mesh,C,radius,forward){const body=mesh.userData.body,i=sprayNext;sprayNext=(sprayNext+1)%SPRAY_MAX;const speed=body.vel.length();speed>1e-4?trail.copy(body.vel).divideScalar(speed):trail.set(0,1,0),forward||trail.negate(),randomUnit(scatter);const direction=scatter.multiplyScalar(.55).add(trail).normalize(),o=i*3;sprayPos[o]=mesh.position.x+direction.x*radius*.92,sprayPos[o+1]=mesh.position.y+direction.y*radius*.92,sprayPos[o+2]=mesh.position.z+direction.z*radius*.92;const keep=forward?.9+Math.random()*.25:.45+Math.random()*.35,fling=(forward?.35:.18)*speed+.25;sprayVel[o]=body.vel.x*keep+direction.x*fling*Math.random(),sprayVel[o+1]=body.vel.y*keep+direction.y*fling*Math.random()+.18*Math.random(),sprayVel[o+2]=body.vel.z*keep+direction.z*fling*Math.random(),sprayMax[i]=sprayLife[i]=(.55+Math.random()*.75)*Math.max(.1,C.sprayLife),spraySize[i]=radius*(.035+Math.pow(Math.random(),2.4)*.11)*Math.max(.1,C.spraySize),sprayLump[i]=.8+Math.random()*.7,spraySeed[i]=Math.random()}function crown(x,y,z,radius,C,strength){const n=Math.round((8+14*strength)*Math.max(.2,C.spray+.4)),reach=Math.sqrt(radius/.2);for(let k=0;k<n;k++){const i=sprayNext,o=i*3;sprayNext=(sprayNext+1)%SPRAY_MAX;const a=Math.random()*Math.PI*2,out=radius*(.8+Math.random()*.35);sprayPos[o]=x+Math.cos(a)*out,sprayPos[o+1]=y+radius*.04,sprayPos[o+2]=z+Math.sin(a)*out;const jet=Math.random()<.2?1.7:1,up=(.3+Math.random()*.55)*jet*reach*strength,side=(.45+Math.random()*.6)*reach*strength/jet;sprayVel[o]=Math.cos(a)*side,sprayVel[o+1]=up,sprayVel[o+2]=Math.sin(a)*side,sprayMax[i]=sprayLife[i]=(.45+Math.random()*.55)*Math.max(.1,C.sprayLife),spraySize[i]=radius*(.05+Math.pow(Math.random(),2)*.12)*Math.max(.1,C.spraySize),sprayLump[i]=.8+Math.random()*.7,spraySeed[i]=Math.random()}}function burst(mesh,C,radius,toward){const n=Math.round((10+8*Math.random())*Math.max(0,C.popSpray)*Math.max(.2,C.spray+.4)),reach=Math.sqrt(radius/.2);for(let k=0;k<n;k++){const i=sprayNext,o=i*3;sprayNext=(sprayNext+1)%SPRAY_MAX,randomUnit(scatter),scatter.addScaledVector(toward,-.72*scatter.dot(toward)).normalize(),sprayPos[o]=mesh.position.x+scatter.x*radius*.96,sprayPos[o+1]=mesh.position.y+scatter.y*radius*.96,sprayPos[o+2]=mesh.position.z+scatter.z*radius*.96;const speed=(.45+Math.random()*.85)*reach;sprayVel[o]=scatter.x*speed,sprayVel[o+1]=scatter.y*speed+.22*Math.random(),sprayVel[o+2]=scatter.z*speed,sprayMax[i]=sprayLife[i]=(.5+Math.random()*.65)*Math.max(.1,C.sprayLife),spraySize[i]=radius*(.045+Math.pow(Math.random(),2.2)*.12)*Math.max(.1,C.spraySize),sprayLump[i]=.8+Math.random()*.7,spraySeed[i]=Math.random()}}function stepSpray(dt){const drag=Math.exp(-dt*2.6);for(let i=0;i<SPRAY_MAX;i++){if(sprayLife[i]<=0)continue;sprayLife[i]-=dt;const o=i*3;sprayVel[o]*=drag,sprayVel[o+2]*=drag,sprayVel[o+1]=sprayVel[o+1]*drag-2.6*dt,sprayPos[o]+=sprayVel[o]*dt,sprayPos[o+1]+=sprayVel[o+1]*dt,sprayPos[o+2]+=sprayVel[o+2]*dt}}const loader=new THREE.TextureLoader;let ready=null,disposed=!1,lastTime=null;function loadAssets(){return config.noPhotos?Promise.resolve([]):disposed?Promise.resolve([]):ready||(ready=Promise.all(PHOTOS.map(([file],photo)=>new Promise(resolve=>{loader.load("./images/slides/"+file,texture=>{if(disposed){texture.dispose(),resolve(!1);return}texture.colorSpace=THREE.SRGBColorSpace,texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy()),textures.push(texture);const aspect=texture.image.width/texture.image.height,loadedAt=lastTime??0;for(const mesh of meshes)mesh.userData.photo===photo&&(mesh.material.uniforms.uPhoto.value=texture,mesh.userData.aspect=aspect,mesh.userData.loadedAt=loadedAt);resolve(!0)},void 0,error=>{console.warn("Logo drop photo unavailable:",file,error),resolve(!1)})}))),ready)}deferTextures||loadAssets();const tilt=new THREE.Euler,orientation=new THREE.Quaternion,own=new THREE.Euler(0,0,0,"YXZ"),ownQuaternion=new THREE.Quaternion,velocity=new THREE.Vector3,accel=new THREE.Vector3,drive=new THREE.Vector3,radial=new THREE.Vector3,axis=new THREE.Vector3,step=new THREE.Quaternion,inverse=new THREE.Quaternion,noiseFrame=new THREE.Quaternion,local=new THREE.Vector3,matrix=new THREE.Matrix4,facing=new THREE.Matrix4,viewPoint=new THREE.Vector3,upView=new THREE.Vector3,cameraLocal=new THREE.Vector3,groupScale=new THREE.Vector3,groupPosition=new THREE.Vector3,splashPoint=new THREE.Vector3,turnAxis=new THREE.Vector3(0,1,0),lensAxis=new THREE.Vector3(0,0,1),lensRight=new THREE.Vector3(1,0,0),lensUp=new THREE.Vector3(0,1,0),rayOrigin=new THREE.Vector3,rayDirection=new THREE.Vector3,groupInverse=new THREE.Matrix4,placeLocal=new THREE.Vector3,fallTarget=new THREE.Vector3,beadMatrix=new THREE.Matrix4,beadQuaternion=new THREE.Quaternion,beadScale=new THREE.Vector3,beadPosition=new THREE.Vector3,flight=new THREE.Vector3,UP=new THREE.Vector3(0,1,0);let autoAngle=0,lastCount=-1,lastMode=-1,lastProgress=null,progressRate=0;const state={pulse:0,entering:!1,core:0},entranceTarget=new THREE.Vector3,entranceOrigin=new THREE.Vector3,entranceCore=new THREE.Vector3(0,0,-.35);let letterSet=null;state.delivering=!1,state.fuse=0,state.delivery=Array.from({length:LOGO_DROP_MAX},()=>({stage:0,snap:0,lock:-9,alpha:1,position:new THREE.Vector3,quaternion:new THREE.Quaternion,scale:1,anchor:new THREE.Vector3,offset:new THREE.Vector3,attitude:new THREE.Quaternion,correction:new THREE.Quaternion}));const dock=new THREE.Vector3,gatePoint=new THREE.Vector3,letterQuaternion=new THREE.Quaternion,letterInverse=new THREE.Quaternion,letterEuler=new THREE.Euler(0,0,0,"YXZ"),letterOffset=new THREE.Vector3,deliver={count:1,step:.055,turn:Math.PI*2,gap:.41,floor:-.6,clock:null,raw:0,rate:0,fuse:0,sway:0,kick:0,breakTime:.55,flyTime:.85,release:.25,at:new Float32Array(LOGO_DROP_MAX),s:new Float32Array(LOGO_DROP_MAX),on:new Uint8Array(LOGO_DROP_MAX),since:new Float32Array(LOGO_DROP_MAX),leave:{window:.2,climb:.14,from:0,span:1}},gateAngle=new Float32Array(LOGO_DROP_MAX);function swirlPlace(s,out,up,t,target){const C=config,angle=s-deliver.turn*t-deliver.sway,ring=Math.max(.2,(C.swirlRadius+out)*(1+deliver.kick)),over=Math.max(0,-angle-C.climbFrom);let y=C.gateLift-C.swirlPitch*angle+up+Math.max(0,C.climbOut)*.035*over*over;!C.directedHelix&&y<deliver.floor+.2&&(y=deliver.floor+.2*Math.exp((y-deliver.floor-.2)/.2));const frac=C.directedHelix?clamp01((s-deliver.s[0])/Math.max(.1,deliver.s[deliver.count-1]-deliver.s[0])):1,radius=C.directedHelix?ring*(1-C.tailTaper+frac*C.tailTaper):ring;return target.set(Math.sin(angle)*radius,y+C.wave*Math.sin(angle*1.6),Math.cos(angle)*radius-(C.directedHelix?C.tailDepth*(1-frac):0)).applyQuaternion(orientation),target.y-=gatePoint.y,angle}function swirlAt(where){const last=deliver.count-1,end=letterPlace(last);if(where<=0)return deliver.s[0]+where*deliver.gap;if(where>=end)return deliver.s[last]+(where-end)*deliver.gap;const k=Math.min(last-1,Math.floor(where)-Math.floor((Math.floor(where)+1)/4)),from=letterPlace(k),to=letterPlace(k+1);return THREE.MathUtils.lerp(deliver.s[k],deliver.s[k+1],(where-from)/(to-from))}const dropHash=(s,k)=>fract(Math.sin(s*127.1+k*311.7)*43758.5453);function dropSizeVary(mesh,plain){const C=config,s=mesh.material.uniforms.uSeed.value;let v=1+(dropHash(s,4)-.5)*2*(C.swirlSizeJitter??0)*(plain?.7:1);return!plain&&dropHash(s,5)<(C.swirlHeroShare??0)&&(v*=1+(C.swirlHero??0)),Math.max(.3,v)}function jitterDrop(mesh,time,amount){const C=config,s=mesh.material.uniforms.uSeed.value,j=(C.swirlJitter??0)*C.swirlRadius*amount,d=(C.swirlDrift??0)*amount;if(j<=0&&d<=0)return;const a=dropHash(s,1)*Math.PI*2,out=dropHash(s,2)-.5,up=dropHash(s,3)-.5;mesh.position.x+=Math.sin(a)*out*2*j+Math.sin(time*.31+s*17)*d,mesh.position.z+=Math.cos(a)*out*2*j+Math.cos(time*.27+s*11)*d,mesh.position.y+=up*1.2*j+Math.sin(time*.37+s*23)*d*.8}const stringLift=where=>config.stringLift*(Math.round(where)%2?-1:1)*(.7+.3*Math.sin(where*1.9+.4));let waveTime=0;const stringWave=where=>config.swirlWave*Math.sin(waveTime*.85-where*.7),swirlBorn=angle=>{const at=Math.PI*2*config.swirlBorn;return 1-smooth(angle,at-.6,at)},gateLean=short=>{const near=1-Math.min(1,Math.max(0,short/.5));return near*near*(3-2*near)},letterYaw=(slot,C)=>THREE.MathUtils.degToRad(C.letterYaw)*(slot%2?-1:1)*(.78+.22*Math.sin(slot*2.4+.6)),letterPitch=(slot,C)=>THREE.MathUtils.degToRad(C.letterPitch)*Math.cos(slot*1.7+.3);function setLetters(list){letterSet=letters&&list?.length?list.slice(0,LOGO_DROP_MAX):null,letterSet&&ensureCrowd(letterSet.length);for(const mesh of meshes)mesh.userData.body.fresh=!0}const clearance={on:!1,f:1,scale:1,camera:null,frameW:2,frameH:1.25,logoX:0,logoY:0};function prepareClearance(camera){if(clearance.on=!!camera?.isPerspectiveCamera,group.updateWorldMatrix(!0,!1),group.matrixWorld.decompose(groupPosition,worldQuaternion,groupScale),clearance.scale=Math.max(1e-6,groupScale.y),groupInverse.copy(group.matrixWorld).invert(),!clearance.on){cameraLocal.set(0,0,4.75),clearance.frameW=2,clearance.frameH=1.25,clearance.logoX=clearance.logoY=0;return}clearance.f=camera.projectionMatrix.elements[5],clearance.camera=camera,upView.copy(UP).transformDirection(group.matrixWorld).transformDirection(camera.matrixWorldInverse),cameraLocal.setFromMatrixPosition(camera.matrixWorld),cameraLocal.applyMatrix4(groupInverse),clearance.frameH=cameraLocal.length()/clearance.f,clearance.frameW=clearance.frameH*camera.aspect,viewPoint.copy(groupPosition).project(camera),clearance.logoX=viewPoint.x,clearance.logoY=viewPoint.y}function screenRay(nx,ny){const camera=clearance.camera;rayOrigin.setFromMatrixPosition(camera.matrixWorld),rayDirection.set(nx,ny,.5).unproject(camera).sub(rayOrigin),rayOrigin.applyMatrix4(groupInverse),rayDirection.transformDirection(groupInverse)}function screenToLocal(nx,ny,z,out){if(!clearance.on)return out.set(nx*clearance.frameW,ny*clearance.frameH,z);screenRay(nx,ny);const along=Math.abs(rayDirection.z)>1e-4?rayDirection.z:-1e-4;return out.copy(rayOrigin).addScaledVector(rayDirection,(z-rayOrigin.z)/along)}function screenToLevel(nx,ny,y,out){return!clearance.on||(screenRay(nx,ny),rayDirection.y>-.001)?null:out.copy(rayOrigin).addScaledVector(rayDirection,(y-rayOrigin.y)/rayDirection.y)}function travelToClear(localPoint,radius,sign){if(!clearance.on)return Math.max(0,sign>0?1.3-localPoint.y:localPoint.y+1.3);viewPoint.copy(localPoint).applyMatrix4(group.matrixWorld).applyMatrix4(clearance.camera.matrixWorldInverse);const depth=Math.max(.05,-viewPoint.z),f=clearance.f,edge=1+1.6*f*radius*clearance.scale/depth+.04,denominator=f*upView.y+sign*edge*upView.z;return denominator<.05?3:Math.max(0,(edge*depth-sign*f*viewPoint.y)/denominator/clearance.scale)}function stepBody(mesh,dt,C,reducedMotion,rel){const body=mesh.userData.body;if(body.fresh||dt<=0){body.prev.copy(mesh.position),body.fresh=!1,body.vel.set(0,0,0),body.velPrev.set(0,0,0),body.spring.set(0,0,0),body.springVel.set(0,0,0),body.slosh=0,body.sloshVel=0,body.accel=0,body.owed=0;return}if(mesh.position.distanceToSquared(body.prev)>1.44){body.fresh=!0,stepBody(mesh,0,C,reducedMotion,rel);return}velocity.subVectors(mesh.position,body.prev).divideScalar(dt),velocity.length()>60&&velocity.setLength(60),body.prev.copy(mesh.position),body.vel.lerp(velocity,1-Math.exp(-dt*22)),accel.subVectors(body.vel,body.velPrev).divideScalar(dt),accel.length()>400&&accel.setLength(400),body.velPrev.copy(body.vel);const speed=body.vel.length();if(body.accel=speed>1e-4?accel.dot(body.vel)/speed:0,reducedMotion){body.spring.set(0,0,0),body.springVel.set(0,0,0),body.slosh=0,body.sloshVel=0;return}const omega=Math.max(.5,C.jiggle*Math.pow(rel,-.75)),zeta=Math.max(0,C.damping),k=omega*omega,c=2*zeta*omega,steps=Math.max(1,Math.ceil(dt/(1/120))),h=dt/steps;drive.copy(accel).multiplyScalar(-C.inertia*.0012);for(let i=0;i<steps;i++)body.springVel.addScaledVector(body.spring,-k*h),body.springVel.addScaledVector(body.springVel,-c*h),body.springVel.addScaledVector(drive,k*h),body.spring.addScaledVector(body.springVel,h);body.spring.length()>C.limit&&(body.spring.setLength(C.limit),body.springVel.multiplyScalar(.5)),radial.set(mesh.position.x,0,mesh.position.z),radial.lengthSq()<1e-8&&radial.set(0,0,1),radial.normalize(),speed>1e-4&&(axis.crossVectors(radial,body.vel),axis.lengthSq()<1e-8&&axis.crossVectors(UP,body.vel),axis.lengthSq()>1e-8&&body.rollAxis.copy(axis.normalize()),step.setFromAxisAngle(body.rollAxis,speed/Math.max(.02,C.size*rel)*C.roll*dt),body.roll.premultiply(step).normalize());const target=THREE.MathUtils.clamp(speed*.06*C.slosh,-.45,.45),so=6.5,sz=.32;body.sloshVel+=(so*so*(target-body.slosh)-2*sz*so*body.sloshVel)*dt,body.slosh+=body.sloshVel*dt}const smooth=(x,a,b)=>THREE.MathUtils.smoothstep(x,a,b),clamp01=x=>Math.min(1,Math.max(0,x)),easeOutBack=(e,s=1.4)=>1+(s+1)*Math.pow(e-1,3)+s*Math.pow(e-1,2),easeOutCubic=e=>1-Math.pow(1-e,3);function update({progress=0,enter=progress,reveal=1,exit=0,time=0,reducedMotion=!1,palette,mobile=!1,camera=null,seaLevel=0,slots=null,hold=!1}={}){const C=config,delivering=!!(letterSet&&slots)&&C.letters>.5&&C.enabled>.5&&slots.length>=letterSet.length;state.delivering=delivering,odUniforms.uOdFlow.value=Math.max(0,config.innerFlow??0),state.fuse=0;const dt=lastTime===null?0:Math.min(.05,Math.max(0,time-lastTime));if(lastTime=time,delivering){const n=letterSet.length;deliver.count=n;const jumped=deliver.clock===null||Math.abs(enter-deliver.raw)>.2;if(jumped||reducedMotion||!(C.swirlEase>.02)||dt<=0)deliver.clock=enter,deliver.rate=0;else{const omega=4.74/C.swirlEase,x=deliver.clock-enter,decay=Math.exp(-omega*dt),carried=(deliver.rate+omega*x)*dt;deliver.clock=enter+(x+carried)*decay,deliver.rate=(deliver.rate-omega*carried)*decay}deliver.raw=enter;const breakTime=deliver.breakTime=Math.max(.05,C.breakTime)*(reducedMotion?.5:1),flyTime=deliver.flyTime=Math.max(.05,C.flyTime)*(reducedMotion?.5:1),release=deliver.release=breakTime*(C.directedHelix?.58:.45),whole=release+flyTime+.6,hurry=enter>1?4:1;deliver.step=n>1?Math.max(.004,(C.deliverEnd-C.deliverStart)/letterPlace(n-1)):0;let home=0;for(let k=0;k<n;k++){const at=deliver.at[k]=C.deliverStart+letterPlace(k)*deliver.step,record=state.delivery[k],on=deliver.clock>at-DELIVER_LEAD-(deliver.on[k]?.004:0);deliver.on[k]=on?1:0;const since=deliver.since[k]=jumped?on?whole:0:THREE.MathUtils.clamp(deliver.since[k]+(on?dt:-dt*1.6)*hurry,0,whole);record.stage=since>0?1:0,record.alpha=C.directedHelix?smooth(since/breakTime,.28,.58):1,jumped&&(record.offset.set(0,0,0),record.correction.identity()),record.snap=clamp01((since-release)/flyTime),record.lock=(since-release-flyTime)/.09,record.snap>=1&&home++}const set=home===n;deliver.fuse=jumped?set?1:0:clamp01(deliver.fuse+(set?dt*hurry/Math.max(.05,C.fuseTime):-dt*3)),state.fuse=deliver.fuse,deliver.kick=reducedMotion?0:C.fuseKick*Math.sin(Math.PI*Math.pow(deliver.fuse,.7))}else deliver.clock=null;reducedMotion||(autoAngle=(autoAngle+dt*C.autoSpeed)%(Math.PI*2)),lastProgress!==null&&dt>0&&(progressRate+=((progress-lastProgress)/dt-progressRate)*(1-Math.exp(-dt*10))),lastProgress=progress;const flow=delivering?deliver.clock:enter,entranceMode=THREE.MathUtils.clamp(Math.round(C.entrance),0,2),entering=entranceMode>0&&flow<0&&!reducedMotion,presence=entranceMode>0?enter>C.enterStart?1:0:reveal;state.pulse=0,state.entering=entering;const fade=presence*(1-exit)*C.opacity,wasVisible=group.visible;if(group.visible=C.enabled>.5&&fade>.001&&!hold,!group.visible){wasVisible&&(sprayLife.fill(0),beads.count=0);return}!delivering&&!C.noPhotos&&loadAssets();const count=delivering?letterSet.length:THREE.MathUtils.clamp(Math.round(C.count),1,LOGO_DROP_MAX),mode=delivering?0:THREE.MathUtils.clamp(Math.round(C.mode),0,2);if(!wasVisible||count!==lastCount||mode!==lastMode){for(const mesh of meshes)mesh.userData.body.fresh=!0;mode!==lastMode&&sprayLife.fill(0)}lastCount=count,lastMode=mode;const groupScale2=mobile?C.mobileScale:1;group.scale.setScalar(groupScale2),prepareClearance(camera);const clock=Math.max(delivering?deliver.clock:enter,C.enterStart*.3),rhythm=delivering?LETTER_RHYTHM:SIZE_RHYTHM;tilt.set(THREE.MathUtils.degToRad(delivering?C.swirlTiltX:C.tiltX),0,THREE.MathUtils.degToRad(delivering?C.swirlTiltZ:C.tiltZ)),orientation.setFromEuler(tilt);const phase=THREE.MathUtils.degToRad(C.phase),spin=phase-progress*C.turns*Math.PI*2,centering=C.pitch*(phase-Math.PI*C.turns)+C.offsetY,spacing=C.spacing*8/count,layout=layoutFor(count),seaY=(seaLevel-groupPosition.y)/clearance.scale;shared.uFuse.value.set(THREE.MathUtils.lerp(.96,.12,clamp01(C.fuse)),1),palette&&(syncRoomColor("uRoomTop",palette.top??"#92a8cd"),odUniforms.uOdChrome.value.set(C.chromeLook??1,C.chromeCard??.22,C.chromeBand??.35,C.chromeRough??.012),odUniforms.uOdEdge.value.set(C.chromeRim??1,C.chromeRimEdge??12,C.chromeLens??.9,C.chromeLensEdge??3.4),odUniforms.uOdLook.value.set(C.swirlSunRim??0,C.swirlSunGlint??0,delivering?C.swirlRefract??0:0,0),syncRoomColor("uRoomHorizon",palette.horizon??"#e6edf7"),syncRoomColor("uRoomLower",palette.lower??"#c9d5e8"),syncRoomColor("uRoomInk",palette.ink??"#3f5a7e"),shared.uRoomCore.value.copy(shared.uRoomHorizon.value).multiplyScalar(Math.max(0,(palette.core??1.5)*C.glow)));const zoom=Math.max(1,C.zoom),size=Math.max(.02,delivering?C.letterSize:C.size),sizeVar=THREE.MathUtils.clamp(delivering?C.letterSizeVar:C.sizeVar,0,1.5),motion=reducedMotion?0:1,blurring=(mode!==0||C.blurSpiral>.5||entering)&&C.blur>.001&&!reducedMotion,logoDistance=cameraLocal.length();lensAxis.copy(cameraLocal).normalize(),lensRight.crossVectors(UP,lensAxis),lensRight.lengthSq()<1e-6&&lensRight.set(1,0,0),lensRight.normalize(),lensUp.crossVectors(lensAxis,lensRight);const leaveWindow=Math.max(.02,C.leaveEnd-C.leaveStart),leaveClimb=THREE.MathUtils.clamp(C.leaveClimb,.02,leaveWindow),lungeWindow=Math.max(.02,C.lungeEnd-C.lungeStart),lungeFlight=THREE.MathUtils.clamp(C.lungeFlight,.04,lungeWindow),rainWindow=Math.max(.02,C.rainEnd-C.rainStart),rainFall=THREE.MathUtils.clamp(C.rainFall,.04,rainWindow),hangSpan=Math.max(.05,C.rainStart-C.bloomAt-C.bloomTime),bloomTurn=THREE.MathUtils.degToRad(C.bloomTurn)*Math.max(0,(progress-C.bloomAt-C.bloomTime*.5)/hangSpan);let absorbed=0,cast=0;const crowdShown=delivering?THREE.MathUtils.clamp(C.crowd,0,1.6)*(lite?.62:1)*1.06:0,plainSize=Math.max(.02,C.plainSize),plainVar=THREE.MathUtils.clamp(C.plainSizeVar,0,1.5);if(delivering){deliver.turn=Math.PI*2*C.swirlTurns,deliver.sway=C.swirlSway*Math.sin(time*.7)*motion,waveTime=time*motion,deliver.floor=seaY+.32,gatePoint.set(0,0,C.swirlRadius).applyQuaternion(orientation);for(let k=0;k<count;k++)gateAngle[k]=clamp01(C.gateSpread)*Math.asin(THREE.MathUtils.clamp(slots[k].x/groupScale2/C.swirlRadius,-.92,.92)),deliver.s[k]=gateAngle[k]+deliver.turn*deliver.at[k];deliver.gap=count>1?Math.max(.05,(deliver.s[count-1]-deliver.s[0])/letterPlace(count-1)):.41;const leaving=deliver.leave;leaving.window=Math.max(.02,C.swirlLeaveEnd-C.swirlLeaveStart),leaving.climb=THREE.MathUtils.clamp(C.swirlLeaveClimb,.02,leaving.window),leaving.from=deliver.turn*C.swirlLeaveStart-Math.min(Math.PI*1.75,Math.max(0,C.climbFrom)+2.2);let end=0;for(const drop of crowd)drop.order<crowdShown&&(end=Math.max(end,drop.where));leaving.span=Math.max(.5,swirlAt(end)-leaving.from)}for(const mesh of meshes){const slot=mesh.userData.slot,body=mesh.userData.body,plain=mesh.userData.plain,water=plain===void 0||!delivering?null:crowd[plain]??null,thin=water?Math.min(1,(crowdShown-water.order)/.06):1;if(plain===void 0?slot>=count:!water||thin<=0){mesh.visible=!1,body.fresh=!0;continue}cast++;const rel=water?Math.max(.15,plainSize*Math.max(.3,1+(water.size-1)*plainVar)*thin/size)*dropSizeVary(mesh,!0):Math.max(.25,1+(rhythm[slot%rhythm.length]-1)*sizeVar)*(delivering?dropSizeVary(mesh,!1):1),give=Math.pow(rel,.35),radiusNow=size*rel;let gone=!1,vanish=0,grow=1,faceLens=!0,falling=!1,develop=1,entryAlpha=1,docked=0,popping=0,shell=1,condensed=1;if(water){const s=swirlAt(water.where),leaving=deliver.leave,departed=clamp01((clock-C.swirlLeaveStart-clamp01((s-leaving.from)/leaving.span)*(leaving.window-leaving.climb))/leaving.climb),rise=departed*departed,onward=Math.pow(departed,1.5),spread=Math.max(0,C.crowdSpread),angle=swirlPlace(s-(C.swirlLeaveSpin??C.leaveSpin)*Math.PI*2*onward,(C.swirlRadius+water.out*spread)*THREE.MathUtils.lerp(1,C.swirlLeaveRadius??C.leaveRadius,rise)-C.swirlRadius,water.up*spread+(water.out?0:stringLift(water.where))+stringWave(water.where)+Math.sin(time*.5+plain*1.7)*.012*C.float*motion,clock,mesh.position);jitterDrop(mesh,time*motion,.65);const born=swirlBorn(angle);departed>=.999||born<=0||angle<-Math.PI*3||mesh.position.y>2.6?gone=!0:(rise>0&&(mesh.position.y+=travelToClear(mesh.position,radiusNow*1.4,1)*(C.swirlLeaveRise??C.leaveRise)*rise),grow=.35+.65*born,condensed=smooth(born,0,.5),vanish=Math.max(departed,smooth(-angle,Math.PI*2.6,Math.PI*3)))}else if(delivering){const glyph=letterSet[slot],record=state.delivery[slot],carried=C.directedHelix?clock:Math.min(clock,deliver.at[slot]+.9/deliver.turn),departed=C.freeLetters?clamp01((clock-C.swirlLeaveStart-clamp01((deliver.s[slot]-deliver.leave.from)/deliver.leave.span)*(deliver.leave.window-deliver.leave.climb))/deliver.leave.climb):0,rise=departed*departed,angle=swirlPlace(deliver.s[slot]-(C.freeLetters?(C.swirlLeaveSpin??C.leaveSpin)*Math.PI*2*Math.pow(departed,1.5):0),C.freeLetters?C.swirlRadius*((C.swirlLeaveRadius??C.leaveRadius)-1)*rise:0,stringLift(letterPlace(slot))+stringWave(letterPlace(slot)),carried,dock);C.freeLetters&&rise>0&&(dock.y+=travelToClear(dock,radiusNow*1.4,1)*(C.swirlLeaveRise??C.leaveRise)*rise),docked=gateLean(angle-gateAngle[slot]),dock.addScaledVector(lensAxis,C.gatePush*docked),mesh.position.copy(dock),jitterDrop(mesh,time*motion,1);const born=swirlBorn(angle);if((born<=0||C.freeLetters&&(departed>=.999||angle<-Math.PI*3||dock.y>2.6))&&(gone=!0),C.freeLetters&&(vanish=departed),grow=(1+.06*docked)*(.35+.65*born),C.freeLetters){const keep=clamp01(((C.swirlBig??1)-fract(slot*.618034+.31))/.06);grow*=keep,keep<=0&&(gone=!0)}condensed=smooth(born,0,.5),popping=C.freeLetters?0:clamp01(deliver.since[slot]/deliver.breakTime),popping>=1?gone=!0:popping>0&&!gone&&(grow*=1+C.popSwell*easeOutCubic(popping),shell=1-smooth(popping,0,1)),record.position.copy(dock).multiplyScalar(groupScale2),facing.lookAt(cameraLocal,dock,UP),letterEuler.set(letterPitch(slot,C)*.75,letterYaw(slot,C)*.75,Math.sin(slot*3.1+1)*.03),record.quaternion.setFromRotationMatrix(facing).multiply(letterQuaternion.setFromEuler(letterEuler)),record.scale=radiusNow*groupScale2*Math.max(.05,C.letterFill)/glyph.fit*C.letterLens,C.directedHelix&&(record.anchor.copy(record.position),record.attitude.copy(record.quaternion),record.position.add(record.offset),record.quaternion.multiply(record.correction))}else if(mode===0){let departed=0;if(C.leave>.5){const rank=count>1?slot/(count-1):1;departed=clamp01((progress-C.leaveStart-rank*(leaveWindow-leaveClimb))/leaveClimb)}if(departed>=1)gone=!0;else{const rise=departed*departed,onward=Math.pow(departed,1.5),frac=count>1?slot/(count-1):.5,radius=C.radius*(1-C.tailTaper+frac*C.tailTaper)*THREE.MathUtils.lerp(1,C.leaveRadius,rise),pathAngle=(slot-(count-1)/2)*spacing+spin-C.leaveSpin*Math.PI*2*onward,angle=pathAngle+autoAngle;mesh.position.set(Math.sin(angle)*radius,-C.pitch*pathAngle+C.wave*Math.sin(pathAngle*1.6),Math.cos(angle)*radius-C.tailDepth*(1-frac)),mesh.position.applyQuaternion(orientation),mesh.position.y+=centering,rise>0&&(mesh.position.y+=travelToClear(mesh.position,radiusNow*1.4,1)*C.leaveRise*rise),vanish=departed,own.set(0,angle,0),ownQuaternion.setFromEuler(own),mesh.quaternion.copy(orientation).multiply(ownQuaternion),faceLens=!1}}else if(mode===1){const lane=layout.lanes[slot],e=clamp01((progress-C.lungeStart-layout.lunge[slot]*(lungeWindow-lungeFlight))/lungeFlight);if(e>=1)gone=!0;else{const k=1.70158*Math.max(0,C.lungeRecoil),leap=k>0?(k+1)*e*e*e-k*e*e:Math.pow(e,Math.max(1,C.lungeCurve)),creep=Math.max(-.2,Math.min(.9,Math.max(0,C.lungeDrift)*enter*motion)),travel=creep+(1-creep)*leap,sFar=-Math.max(1,C.lungeDepth),sNear=logoDistance-.2,spread=Math.max(.1,C.lungeSpread),lateral=2.3*spread+(.1*spread+.35)*travel,idle=motion*(1-smooth(e,0,.3));mesh.position.copy(lensAxis).multiplyScalar(sFar+(sNear-sFar)*travel).addScaledVector(lensRight,lane.x*lateral+Math.cos(time*.5+slot*2.1)*.05*idle).addScaledVector(lensUp,lane.y*lateral+Math.sin(time*.7+slot*1.3)*.06*idle),vanish=e,mesh.position.distanceTo(cameraLocal)<radiusNow*1.6&&(gone=!0)}}else{const spot=layout.places[slot],tau=Math.max(0,(progress-C.bloomAt-layout.bloom[slot]*.07)/Math.max(.02,C.bloomTime)),e=Math.min(1,tau),drift=Math.max(0,C.bloomDrift)*Math.max(0,tau-.35)*motion,out=1-Math.exp(-3.2*tau)+drift*.06;screenToLocal(clearance.logoX+spot.x*C.bloomSpread,clearance.logoY+spot.y*C.bloomSpread,spot.z*C.bloomDepth,placeLocal);const swing=Math.sin(Math.PI*e)*.55*C.bloomDepth;mesh.position.set(placeLocal.x*out+Math.sin(slot*1.7)*.03*(1-Math.min(1,out)),placeLocal.y*out+Math.cos(slot*2.3)*.03*(1-Math.min(1,out)),-.35+(placeLocal.z+.35)*out+swing),mesh.position.applyAxisAngle(lensAxis,bloomTurn),mesh.position.addScaledVector(lensAxis,drift*.35);const hang=motion*smooth(e,.6,1);mesh.position.x+=Math.cos(time*.6+slot*1.1)*.012*hang,mesh.position.y+=Math.sin(time*.8+slot*1.7)*.02*hang,grow=.28+.72*easeOutCubic(e);const rainOut=C.bloomEnd>.5,r=clamp01((progress-C.rainStart-(rainOut?layout.rain:layout.lunge)[slot]*(rainWindow-rainFall))/rainFall);if(r>=1)gone=!0;else if(r>0&&!rainOut){const travel=Math.pow(r,Math.max(1,C.pounceCurve)),s0=mesh.position.dot(lensAxis),x0=mesh.position.dot(lensRight),y0=mesh.position.dot(lensUp),open=1+1.2*travel+.35*travel/Math.max(.05,Math.hypot(x0,y0));mesh.position.copy(lensAxis).multiplyScalar(s0+(logoDistance-.2-s0)*travel).addScaledVector(lensRight,x0*open).addScaledVector(lensUp,y0*open),vanish=r,mesh.position.distanceTo(cameraLocal)<radiusNow*1.6&&(gone=!0)}else if(r>0){const fall=r*r;if(viewPoint.copy(mesh.position).applyMatrix4(group.matrixWorld),clearance.on?screenToLevel(THREE.MathUtils.clamp(viewPoint.project(clearance.camera).x*1.06,-.92,.92),C.rainLand,seaY,fallTarget):null)mesh.position.lerp(fallTarget,Math.min(1,fall/.8)),mesh.position.y-=Math.max(0,(fall-.8)/.2)*radiusNow*2.8;else{const below=Math.max(travelToClear(mesh.position,radiusNow*1.2,-1),mesh.position.y-seaY+radiusNow*2.2);mesh.position.y-=below*1.08*fall}falling=!0,vanish=Math.max(0,(r-.97)/.03)}}if(entering&&!gone){const start=Math.min(-.02,C.enterStart+(water?water.enter:layout.enter[slot])*Math.max(0,C.enterStagger)),e=clamp01((flow-start)/-start);if(e<=0)gone=!0;else{entranceTarget.copy(mesh.position),viewPoint.copy(entranceTarget).applyMatrix4(group.matrixWorld),clearance.on?viewPoint.project(clearance.camera):viewPoint.set(entranceTarget.x/clearance.frameW,entranceTarget.y/clearance.frameH,0);let dx=viewPoint.x-clearance.logoX,dy=viewPoint.y-clearance.logoY;Math.hypot(dx,dy)<.05&&(dx=Math.cos(slot*GOLDEN),dy=Math.sin(slot*GOLDEN));const reach=1.3/Math.max(Math.abs(dx),Math.abs(dy)),nx=clearance.logoX+dx*reach,ny=clearance.logoY+dy*reach,targetGrow=grow;if(entranceMode===1){clearance.on?(screenRay(nx,ny),entranceOrigin.copy(rayOrigin).addScaledVector(rayDirection,logoDistance*.45)):entranceOrigin.set(nx*clearance.frameW,ny*clearance.frameH,3),entranceOrigin.y=Math.max(entranceOrigin.y,seaY+.35);const u2=1-Math.pow(1-e,3);mesh.position.lerpVectors(entranceOrigin,entranceTarget,u2),step.setFromAxisAngle(lensAxis,C.enterSwirl*Math.PI*Math.pow(1-u2,2)),mesh.position.applyQuaternion(step),grow=THREE.MathUtils.lerp(1,targetGrow,u2),develop=smooth(u2,C.develop,1),entryAlpha=smooth(e,0,.06)}else{const merge=Math.min(-.01,Math.max(start+.02,C.enterMerge));if(flow<merge){const a=clamp01((flow-start)/(merge-start)),u2=a*a;screenToLocal(nx,ny,0,entranceOrigin),entranceOrigin.y=Math.max(entranceOrigin.y,seaY+.35),mesh.position.lerpVectors(entranceOrigin,entranceCore,u2),step.setFromAxisAngle(lensAxis,C.enterSwirl*Math.PI*u2),mesh.position.applyQuaternion(step),grow=THREE.MathUtils.lerp(1,.8,u2),develop=0,entryAlpha=smooth(a,0,.08)*(1-smooth(a,.86,1)),absorbed+=smooth(a,.78,1)}else{const b=clamp01((flow-merge)/-merge);mesh.position.lerpVectors(entranceCore,entranceTarget,easeOutBack(b,1.2)),grow=THREE.MathUtils.lerp(.8,targetGrow,Math.min(1,b*1.25)),develop=smooth(b,.4,1),entryAlpha=smooth(b,0,.1),absorbed+=1}state.pulse=Math.max(state.pulse,Math.exp(-Math.pow((flow-merge)/.03,2)))}}}if(C.directedHelix&&delivering&&(condensed*=smooth(mesh.position.y-seaY,-.08,.2)),gone){mesh.visible=!1,body.fresh=!0;continue}if(mesh.visible=!0,body.fresh&&(body.wet=0),faceLens&&(facing.lookAt(cameraLocal,mesh.position,UP),mesh.quaternion.setFromRotationMatrix(facing)),mesh.scale.setScalar(radiusNow*grow),delivering&&!water){const broken=popping>(C.directedHelix?.42:0);body.fresh?body.broken=broken:broken!==body.broken&&(broken&&motion&&dt>0&&C.spray>.001&&burst(mesh,C,radiusNow,lensAxis),body.broken=broken)}stepBody(mesh,dt,C,reducedMotion,rel);const u=mesh.material.uniforms,radiusDrawn=radiusNow*grow,side=mode===2&&C.bloomEnd>.5&&mesh.position.y<=seaY?-1:1;if(!body.wet)body.wet=side;else if(side!==body.wet){if(mode===2&&motion&&dt>0){const strength=C.splash*(side<0?1:.45)*Math.min(1.6,.5+body.vel.length()*.12);crown(mesh.position.x,seaY,mesh.position.z,radiusDrawn,C,strength),onSplash&&(splashPoint.set(mesh.position.x,seaY,mesh.position.z),group.localToWorld(splashPoint),onSplash(splashPoint.x,splashPoint.y,splashPoint.z,strength*rel))}body.wet=side}if(motion&&C.spray>.001&&dt>0&&side>0){const speed=body.vel.length();for(body.owed+=(Math.max(0,speed-.9)*5.5+Math.max(0,-body.accel-18)*.09)*C.spray*dt,body.owed=Math.min(body.owed,6);body.owed>=1;)body.owed-=1,emit(mesh,C,radiusDrawn,body.accel<-18&&Math.random()<.6)}inverse.copy(mesh.quaternion).invert(),local.copy(body.spring).addScaledVector(body.vel,.0075*C.stretch*motion),local.multiplyScalar(give/size);const amount=Math.min(C.limit,local.length());amount>1e-5&&u.uStretchDir.value.copy(local).normalize().applyQuaternion(inverse),u.uStretchAmt.value=amount,local.copy(body.vel).multiplyScalar(blurring?C.blur/60/radiusDrawn*(entering?.5:1):0),local.length()>4&&local.setLength(4);const sweep=local.length();u.uSweep.value.copy(local).applyQuaternion(inverse);const blurOn=blurring&&sweep>.08,settle=blurring?1-smooth(sweep,.02,.08):1;if(u.uBlurOn.value=blurOn?1:0,u.uBlurSamples.value=THREE.MathUtils.clamp(Math.round(2+sweep*1.6),2,MAX_SAMPLES),mesh.material.depthWrite=!blurring,mesh.renderOrder=blurring&&mesh.position.distanceTo(cameraLocal)<logoDistance-.05?7:4,popping>0&&(mesh.material.depthWrite=!1,mesh.renderOrder=7),local.copy(body.vel).multiplyScalar(.008*C.tail*motion*give/size),local.y-=C.sag*give,local.length()>C.limit&&local.setLength(C.limit),local.multiplyScalar(settle),u.uTail.value.copy(local).applyQuaternion(inverse),noiseFrame.copy(body.roll).invert().multiply(mesh.quaternion),u.uRollNoise.value.setFromMatrix4(matrix.makeRotationFromQuaternion(noiseFrame)),axis.copy(body.rollAxis).applyQuaternion(inverse),delivering&&!water&&!C.freeLetters){const glyph=letterSet[slot],calm=1-.25*docked,alive=motion*(1-docked)*C.letterFloat;if(letterEuler.set(letterPitch(slot,C)*calm+Math.sin(time*.43+slot*2.1)*.06*alive,letterYaw(slot,C)*calm+Math.sin(time*.31+slot*1.3)*.09*alive,Math.sin(slot*3.1+1)*.04*calm+Math.sin(time*.37+slot*.7)*.04*alive),step.setFromAxisAngle(axis,body.slosh*(1-docked)),letterQuaternion.setFromEuler(letterEuler).premultiply(step),letterInverse.copy(letterQuaternion).invert(),u.uPhotoRot.value.setFromMatrix4(matrix.makeRotationFromQuaternion(letterInverse)),letterOffset.copy(body.spring).multiplyScalar(.55/radiusDrawn).clampLength(0,.14).applyQuaternion(inverse),letterOffset.y+=Math.sin(time*.9+slot*1.9)*.025*alive,letterOffset.x+=Math.sin(slot*2.3+.8)*.07,letterOffset.y+=Math.cos(slot*1.7+.2)*.045-.035,u.uGlyphPos.value.copy(letterOffset.multiplyScalar(C.letterFloat*(1-docked)).applyQuaternion(letterInverse)),u.uGlyphOn.value=1,u.uSwirl.value=C.swirlRing,u.uSwirlLook.value.set(C.swirlGloss,1-clamp01(C.swirlGlow),C.swirlCaustic),u.uGlyphMap.value=glyph.map,u.uGlyph.value.set(glyph.fit/Math.max(.05,C.letterFill)*grow,.5/glyph.tile,glyph.depth,glyph.round),u.uGlyphLook.value.set(C.letterShadow,THREE.MathUtils.clamp(C.letterWarp,0,1),C.directedHelix?state.delivery[slot].alpha:0),C.directedHelix){const record=state.delivery[slot];record.quaternion.copy(mesh.quaternion).multiply(letterQuaternion),record.position.copy(u.uGlyphPos.value).applyQuaternion(letterQuaternion).multiplyScalar(radiusDrawn).applyQuaternion(mesh.quaternion).add(mesh.position).multiplyScalar(groupScale2),record.offset.copy(record.position).sub(record.anchor),record.correction.copy(record.attitude).invert().multiply(record.quaternion)}u.uBurst.value=popping}else step.setFromAxisAngle(axis,body.slosh),u.uPhotoRot.value.setFromMatrix4(matrix.makeRotationFromQuaternion(step)),letters&&(u.uGlyphOn.value=0,u.uBurst.value=0,u.uSwirl.value=water||C.freeLetters&&delivering?C.swirlRing:0,water||C.freeLetters&&delivering?u.uSwirlLook.value.set(C.swirlGloss,1-clamp01(C.swirlGlow),C.swirlCaustic):u.uSwirlLook.value.set(0,0,0));u.uTime.value=time,u.uClipY.value=falling?seaLevel:-1e9,u.uOpacity.value=fade*entryAlpha*(1-smooth(vanish,.88,1))*(mode===2?smooth(grow,.28,.45):1)*shell*condensed;const photoFade=progressiveTextures?mesh.userData.loadedAt===void 0?0:reducedMotion?1:smooth(time-mesh.userData.loadedAt,0,.28):1;u.uDevelop.value=water||C.noPhotos?0:delivering?develop*(C.directedHelix?1:1-smooth(popping,.3,.5)):develop*photoFade;const distance=mesh.position.distanceTo(cameraLocal);if(u.uHaze.value=Math.min(1,C.haze*Math.pow(clamp01((distance-logoDistance-.6)/8),.8)+(delivering?C.swirlHaze*smooth(distance-logoDistance,0,C.swirlRadius*1.1):0)),delivering){const sd=u.uSeed.value,h1=fract(Math.sin(sd*91.7)*43758.5453),h2=fract(Math.sin(sd*47.3+1.3)*24634.6345),h3=fract(Math.sin(sd*13.9+2.1)*12345.678),metal=THREE.MathUtils.clamp((C.swirlMetal??1)+(h1-.5)*2*(C.swirlMetalVar??0)+(C.uniformColor?0:(rel-1)*.3),.12,1),turn2=C.swirlEnvTurn??0;u.uOdVar.value.set(metal,(h2-.5)*2*turn2,(h3-.5)*turn2*.6,(C.swirlDefocus??0)*smooth(logoDistance-distance-.35,0,1.6))}else u.uOdVar.value.set(1,0,0,0);u.uWobble.value=C.wobble*Math.pow(rel,.3)*motion*settle*(1+1.6*popping),u.uWobbleSpeed.value=C.wobbleSpeed*Math.pow(rel,-.5),u.uWobbleScale.value=C.wobbleScale,u.uIor.value=Math.max(1.01,C.ior),u.uDispersion.value=C.dispersion,u.uVeil.value=C.veil,u.uReflect.value=C.reflect,u.uSpec.value=C.spec,u.uRim.value=C.rim,u.uCaustic.value=C.caustic,u.uAbsorb.value=C.absorb,u.uTintStrength.value=C.tintStrength,u.uSaturation.value=C.saturation,u.uContrast.value=C.contrast,u.uBrightness.value=C.brightness;const aspect=mesh.userData.aspect,halfH=zoom*Math.max(1,1/aspect),halfW=halfH*aspect;u.uCover.value.set(.5/halfW,.5/halfH),palette&&(palette.horizon!=null&&u.uPaper.value.copy(shared.uRoomHorizon.value),palette.ink!=null&&u.uInk.value.copy(shared.uRoomInk.value)),falling&&body.wet<0&&(mesh.visible=mesh.position.y>seaY-radiusDrawn*1.2)}let coreAlpha=0,coreScale=0;if(entering&&entranceMode===2){const merge=Math.min(-.01,C.enterMerge),held=absorbed/Math.max(1,cast);if(flow<merge)coreScale=size*(.3+1.6*Math.cbrt(held)),coreAlpha=smooth(held,0,.12);else{const b=clamp01((flow-merge)/-merge);coreScale=size*1.9*(1+b*1.5),coreAlpha=1-smooth(b,0,.26)}}if(core.visible=coreAlpha*fade>.01,core.visible){const u=core.material.uniforms;core.position.copy(entranceCore),facing.lookAt(cameraLocal,core.position,UP),core.quaternion.setFromRotationMatrix(facing),core.scale.setScalar(coreScale),core.renderOrder=4,core.material.depthWrite=!1,u.uTime.value=time,u.uOpacity.value=fade*coreAlpha,u.uWobble.value=C.wobble*1.8*motion,u.uWobbleSpeed.value=C.wobbleSpeed*1.4,u.uWobbleScale.value=C.wobbleScale,u.uStretchAmt.value=0,u.uTail.value.set(0,0,0),u.uBlurOn.value=0,u.uHaze.value=0,u.uClipY.value=-1e9,u.uDevelop.value=0,u.uIor.value=Math.max(1.01,C.ior),u.uDispersion.value=C.dispersion,u.uVeil.value=C.veil,u.uReflect.value=C.reflect,u.uSpec.value=C.spec*1.4,u.uRim.value=Math.min(1,C.rim*1.7),u.uCaustic.value=C.caustic,u.uAbsorb.value=C.absorb*1.5,palette&&(palette.horizon!=null&&u.uPaper.value.copy(shared.uRoomHorizon.value),palette.ink!=null&&u.uInk.value.copy(shared.uRoomInk.value))}state.core=coreAlpha;let written=0;const lump=Math.max(0,C.beadLump),writeBead=(alpha,lumpiness,tear,seed)=>{beadMatrix.compose(beadPosition,beadQuaternion,beadScale),beads.setMatrixAt(written,beadMatrix);const o=written*4;beadData[o]=seed,beadData[o+1]=alpha,beadData[o+2]=lumpiness,beadData[o+3]=tear,written++};if(dt>0&&stepSpray(dt),motion)for(let i=0;i<SPRAY_MAX;i++){if(sprayLife[i]<=0)continue;const t=1-sprayLife[i]/sprayMax[i],r=spraySize[i]*Math.min(1,t/.06)*Math.pow(1-smooth(t,.45,1),.7),o=i*3;if(r<1e-4||sprayPos[o+1]<seaY-r)continue;beadPosition.set(sprayPos[o],sprayPos[o+1],sprayPos[o+2]),flight.set(sprayVel[o],sprayVel[o+1],sprayVel[o+2]);const speed=flight.length();speed>.001?beadQuaternion.setFromUnitVectors(UP,flight.divideScalar(speed)):beadQuaternion.identity();const drawn=Math.min(1.1,speed*.1),across=r/Math.sqrt(1+drawn);beadScale.set(across,r*(1+drawn),across),writeBead(fade*Math.min(1,(1-t)/.2),Math.min(.5,lump*sprayLump[i]*(1+.6*(1-t))),Math.min(.5,speed*.05),spraySeed[i])}const shown=THREE.MathUtils.clamp(C.ambient,0,2),turn=(spin+autoAngle)*C.parallax,burstAll=easeOutCubic(clamp01((progress-C.bloomAt)/Math.max(.02,C.bloomTime*1.2))),rainAll=clamp01((progress-C.rainStart)/rainWindow),streamFar=-Math.max(1,C.lungeDepth),streamNear=logoDistance-.3,streamSpeed=progressRate*C.stream*(streamNear-streamFar),airX=clearance.frameW/1.35,airY=clearance.frameH/.9,airPresence=entering?smooth(flow,C.enterStart,C.enterStart*.35):1;for(let j=0;j<AMBIENT_MAX;j++){const a=ambient[j];if(a.order>=shown)continue;let r=a.size*Math.max(.1,C.ambientSize)*Math.min(1,(shown-a.order)/.05),stretchAlong=0;const rho=a.rho*airX,height=a.y*airY;if(mode===1){const u=fract(a.lane+progress*C.stream+time*.012*motion),lateral=.35+rho*1.05;ambientPos.copy(lensAxis).multiplyScalar(streamFar+(streamNear-streamFar)*u).addScaledVector(lensRight,Math.cos(a.theta)*lateral*1.25).addScaledVector(lensUp,height*1.05+Math.sin(a.theta)*.2),r*=smooth(u,0,.08),stretchAlong=Math.min(4,Math.abs(streamSpeed)*(blurring?C.blur/60:0)/Math.max(.001,r))}else if(mode===2){const theta=a.theta+bloomTurn,open=.12+.88*burstAll;if(ambientPos.set(Math.sin(theta)*rho*open,height*burstAll,Math.cos(theta)*rho*open-.35*(1-burstAll)),ambientPos.y+=Math.sin(time*a.bob*.6*motion+a.phase)*.05*C.float*burstAll,r*=smooth(burstAll,0,.35),C.bloomEnd>.5)ambientPos.y-=rainAll*rainAll*(1.3+a.bob)*.9,r*=1-smooth(rainAll,.4,.95),ambientPos.y<seaY&&(r=0);else{const rush=rainAll*rainAll,rushSpeed=2*rainAll*Math.abs(progressRate)/rainWindow*logoDistance*.9;ambientPos.addScaledVector(lensAxis,rush*logoDistance*.9),r*=1-smooth(rainAll,.6,1),stretchAlong=Math.min(3,rushSpeed*(blurring?C.blur/60:0)/Math.max(.001,r))}}else{const theta=a.theta+turn+time*a.swirl*motion;ambientPos.set(Math.sin(theta)*rho,height+Math.sin(time*a.bob*.6*motion+a.phase)*.06*C.float,Math.cos(theta)*rho).applyQuaternion(orientation)}if(airPresence<1&&(ambientPos.multiplyScalar(1+.7*(1-airPresence)),r*=airPresence),r*=smooth(ambientPos.distanceTo(cameraLocal),.55,1.1),!(r<1e-4)){if(beadPosition.copy(ambientPos),stretchAlong>.05){beadQuaternion.setFromUnitVectors(UP,lensAxis);const across=r/Math.sqrt(1+stretchAlong);beadScale.set(across,r*(1+stretchAlong),across)}else beadQuaternion.setFromAxisAngle(a.axis,a.tumble+time*a.spinRate*motion),beadScale.set(r*a.squash[0],r*a.squash[1],r*a.squash[2]);writeBead(fade,Math.min(.5,lump*a.lump),0,a.seed)}}beads.count=written,beads.instanceMatrix.needsUpdate=!0,beadAttribute.needsUpdate=!0,beadUniforms.uTime.value=time,beadUniforms.uBeadWobble.value=C.beadWobble*motion,beadUniforms.uIor.value=Math.max(1.01,C.ior),beadUniforms.uReflect.value=C.reflect,beadUniforms.uSpec.value=C.spec,beadUniforms.uRim.value=C.rim,beadUniforms.uCaustic.value=C.caustic,beadUniforms.uAbsorb.value=C.absorb}return{group,meshes,beads,get ready(){return loadAssets()},loadAssets,update,state,setLetters,dispose(){disposed=!0,geometry.dispose(),beadGeometry.dispose(),beadMaterial.dispose(),beads.dispose(),placeholder.dispose(),textures.forEach(texture=>texture.dispose()),meshes.forEach(mesh=>mesh.material.dispose()),core.material.dispose()}}}