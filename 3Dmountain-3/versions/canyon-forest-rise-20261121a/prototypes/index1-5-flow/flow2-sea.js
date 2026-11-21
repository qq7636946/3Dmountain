(()=>{if(new URLSearchParams(location.search).get("sea")==="0")return;const T={cross:.5,wake:.14,wakeEvery:.5,mirror:.6,reach:2.6,under:1.45},MAX=12;let U=null,S=null;const PARS=`uniform vec4 uF2Bead[${MAX}];
uniform float uF2BeadA[${MAX}];
uniform float uF2Mirror,uF2Reach;
`,ANCHOR="col*=1.-uDropOcclude*exp(-r2)*(.30+.70*smoothstep(.34,-.26,vWorld.y));",GLSL=`
      /* flow2: the string's beads mirrored in the sea (flow2-sea.js). Spheres, met by the reflected ray; each shows the room it
         stands in, as the sea does. */
      if(uF2Mirror>.001){
        vec3 f2R=reflect(-V,nrm);
        for(int i=0;i<${MAX};i++){
          vec4 f2B=uF2Bead[i];
          if(f2B.w<=0.)continue;
          vec3 f2o=vWorld-f2B.xyz;
          float f2b=dot(f2o,f2R),f2h=f2b*f2b-dot(f2o,f2o)+f2B.w*f2B.w;
          if(f2h>0.&&f2b<0.){
            float f2s=sqrt(f2h),f2t=-f2b-f2s;
            vec3 f2n=(f2o+f2R*f2t)/f2B.w;
            vec3 f2c=montisEnv(reflect(f2R,f2n),.10,uBandGain,0.);
            float f2a=smoothstep(0.,.75,f2s/f2B.w)*(1.-smoothstep(uF2Reach*.15,uF2Reach,f2t))*uF2BeadA[i];
            col=mix(col,f2c,f2a*uF2Mirror);
          }
        }
      }
`;function install({THREE,material}){if(!material?.isShaderMaterial||material.fragmentShader.split(ANCHOR).length!==2||!material.fragmentShader.includes("vec3 montisEnv(")){console.warn("flow2 sea: the opening sea shader has changed; the beads are not mirrored");return}U={uF2Bead:{value:Array.from({length:MAX},()=>new THREE.Vector4)},uF2BeadA:{value:new Array(MAX).fill(0)},uF2Mirror:{value:0},uF2Reach:{value:T.reach}},Object.assign(material.uniforms,U),material.fragmentShader=PARS+material.fragmentShader.replace(ANCHOR,ANCHOR+GLSL),material.needsUpdate=!0}const lowered=(shift,camera,depth)=>shift*Math.tan(camera.fov*Math.PI/360)*depth;function framed(root,camera,framing,THREE){const depth=Math.max(.1,-S.v.copy(root.position).applyMatrix4(camera.matrixWorldInverse).z);return(framing?.y||0)*2*depth*Math.tan(camera.fov*Math.PI/360)/Math.max(1,innerHeight)}const state=THREE=>S??={v:new THREE.Vector3,s:new THREE.Vector3,side:new Int8Array(96),seen:new Uint8Array(96),wake:new Float32Array(96),time:null,list:[]};function seaLevel({THREE,seaY,camera,shift,root,framing,far=22}){return state(THREE),seaY-Math.max(0,lowered(shift,camera,far)-framed(root,camera,framing,THREE))-T.under}function frame({THREE,logoDrops,camera,seaY,shift,root,framing,time,spawnRipple,queueRipple,reduceMotion,on}){state(THREE);const dt=S.time===null?0:Math.min(.05,Math.max(0,time-S.time));S.time=time;const list=S.list;list.length=0;const meshes=on?logoDrops?.meshes:null,down=meshes?framed(root,camera,framing,THREE):0;if(meshes)for(let i=0;i<meshes.length&&i<96;i++){const mesh=meshes[i];if(!mesh.visible){S.seen[i]=0;continue}const opacity=mesh.material?.uniforms?.uOpacity?.value??1;mesh.getWorldPosition(S.v),mesh.getWorldScale(S.s),S.v.y-=down;const r=S.s.x,depth=Math.max(.1,-S.s.copy(S.v).applyMatrix4(camera.matrixWorldInverse).z),y=S.v.y+lowered(shift,camera,depth)-seaY;if(opacity>.3&&!reduceMotion){const side=y>0?1:-1;S.seen[i]&&side!==S.side[i]&&dt>0?(spawnRipple?.(S.v.x,S.v.z,T.cross*(.6+r)),queueRipple?.(S.v.x,S.v.z,T.cross*.4*(.6+r),.18),S.wake[i]=0):Math.abs(y)<r*.9&&(S.wake[i]+=dt,S.wake[i]>T.wakeEvery&&(S.wake[i]=0,spawnRipple?.(S.v.x,S.v.z,T.wake*(.6+r)))),S.side[i]=side,S.seen[i]=1}else S.seen[i]=0;opacity>.05&&y>-r&&y<T.reach&&list.push({x:S.v.x,y,z:S.v.z,r,a:opacity,d:depth})}if(U){list.sort((p,q)=>p.y-q.y);for(let i=0;i<MAX;i++){const b=list[i];b?(U.uF2Bead.value[i].set(b.x,b.y+seaY,b.z,b.r),U.uF2BeadA.value[i]=b.a):(U.uF2Bead.value[i].set(0,0,0,0),U.uF2BeadA.value[i]=0)}U.uF2Mirror.value=list.length?T.mirror:0,U.uF2Reach.value=T.reach}}window.__FLOW2_SEA__={install,seaLevel,frame,tune:T}})();