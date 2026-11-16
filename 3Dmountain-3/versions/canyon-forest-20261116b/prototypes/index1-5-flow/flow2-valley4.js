/* Flow2 valley, fourth round (2026-11-14): the canyon and its river drawn finer (director A: rock, shore, river, air).
   index1-5-flow2.html only. Client: 「山谷河流精緻度還要再加強3倍」. ?v4=0 leaves all of it out.
   The valley's shape, the camera, the flow, the opening and the aerial chapters are not touched; phones and weak GPUs keep the
   page as it was (this builds on the third round's water and rock, which are off there).

   What the frames lacked, and what this draws:
   1. THE RIVER'S FINE SURFACE (?v4water=0). The third round's river is eleven sine trains: seen close it was soft, one scale of
      smooth swell from the lens to the middle distance. Added on top, inside the same wave code: a made ripple map (wind ripples
      with sharp crests, 512², built for this page, no download) at three sizes that cross one another (23 m, 6.5 m, 1.7 m per
      tile; the smallest only exists within ~12 m of the lens). They tilt the same surface the third round lights, so the faces,
      the mirrored canyon and the sun's path all break finer at once. Each size is drawn while a pixel can hold it (mipmaps +
      8× anisotropic filtering, then a fade); what a pixel can no longer hold is kept as roughness, never as shimmer.
      CAT'S PAWS: the wind ruffles the water in patches and leaves glassy lanes between them and in the lee of the walls. In the
      lanes the canyon's picture holds together; in the patches it breaks. (The third round's waves are eased in the lanes too.)
   2. THE WATER'S EDGE (?v4shore=0). The river used to turn its PALEST blue exactly where it met the dark wet stone (a pale band
      that read as ice). Now the bed shows through the first metre of water as wet cobbled stone of the bank's own shade, the
      pale blue is only a tinge over the middle depths, and the deep blue follows. A thin lap line rises and falls a hand's width
      at the bank instead of the white foam line. The page's older shore washes (pale shallows, lift, wall tint), of which the
      third round kept a quarter, step back fully (through that module's own tune).
   3. THE WALLS (?v4rock=0), no new pictures in the walls' program:
      - their relief (beds, cracks, joints, the photograph's own relief map) is now shaded by the open sky above the canyon, so
        it reads in the shade as well: before, a shaded wall was flat colour, because the sky and the ground light were equal;
      - the white slivers on walls turned away from the sun are gone: they were the relief map tilting single pixels into the
        sun on a face the sun cannot reach. The sun now asks the wall's own face first;
      - low flat shelves at the water no longer glare toward the sun (matte wet stone instead of a pale sheet);
      - the shore's boulders (the instanced stones, a separate small program) carry the same photographed stone as the walls.
   4. THE CANYON'S AIR (?v4air=0). A little more of the third round's layered valley haze (its own dial, flow2-valley3-far.js
      tune.haze.strength .3 -> .4: air pooled low over the river), so each wall down the canyon is a step paler than the one
      before it; the far water takes the same step. Values only.
   Nothing here moves by a clock of its own except the ripples and the lap line (the river's own time); with "reduce motion"
   they stand still. Everything eases out before the lens climbs out of the canyon (p 9.6 → 10.7).

   How: chained after the third round on the page's two hand-over calls (__FLOW2_CANYON_LIGHT__.install for the river,
   __FLOW2_FINE_JOURNEY__.canyon for the walls). The river's shader source is edited once before it compiles; the walls get one
   more onBeforeCompile link that anchors only on the base shader's own lines. No new shader program, no new draw call, one
   picture (assets/valley4/ripple-512.webp, 221 KB).
   Live: window.__FLOW2_VALLEY4__.tune / .state (tune.amount = 0 shows the page without it). */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('v4') === '0' || (Q.get('v4') !== '1' && window.__FLOW2_QUALITY__?.start === 'low')) return;   /* flow2 quality (2026-11-14): not installed when the page starts at the low tier (flow2-quality.js); ?v4=1 forces it */
  const num = (key, fallback) => { const v = parseFloat(Q.get(key)); return Number.isFinite(v) ? v : fallback; };
  const part = key => Q.get(key) !== '0';
  const T = {
    amount: num('v4amt', 1),            // all of it (0 = the page as the third round left it)
    water: {
      on: part('v4water'),
      ripple: .13,                      // the fine ripples' slope (rms) in ruffled water
      mid: .1,                          // the middle size's
      calm: .28,                        // how much of the ripples is left in a glassy lane (lower = a clearer mirror, but the
                                        // mirrored walls then draw thin veins on the swell)
      lee: .8,                          // and under the walls (within ~16 m of the bank)
      ease: .45,                        // how far the third round's own waves are eased in a lane (1 = not at all)
      tiles: [6.5, 1.7, 23],            // metres per tile: near, nearest, middle distance
      time: .8,                         // the ripples' clock (× the river's)
      crest: .5                         // how much the ripple crests take part in the paler crest tint
    },
    shore: {
      on: part('v4shore'),
      see: 1.2,                         // how fast the bed is lost with depth (per metre): larger = a narrower band of visible bed
      perMetre: .42,                    // how fast the bed shelves away from the bank (metres of depth per metre out)
      bed: [.07, .085, .105],           // the bed's stone (linear), × the valley's light
      cobble: 1,                        // contrast of the stones on the bed
      tint: .5,                         // how much of the pale shallow blue is kept over the middle depths
      lap: .55,                         // the lap line
      foam: .85                         // how far the page's white foam line steps back
    },
    rock: {
      on: part('v4rock'),
      relief: 1.3,                      // how strongly the open sky shades the wall's relief (beds, ledges)
      side: 1.8,                        // and the bright end of the canyon (upright ribs, flutes, joints)
      slivers: 1,                       // 1 = no sunlit pixels on a face turned away from the sun
      matte: 1,                         // low flat shelves: matte wet stone (no glare toward the sun)
      /* the low shelves and the wall's foot at the water (y 0–8 m, to ~40 m from the lens): the photographed stone at a close
         size on all three faces (beds on the risers, their traces across the treads), its relief, a clear tread / riser tone */
      foot: { on: 1, tile: 4.5, contrast: 2, tone: 1, relief: 1.8, riser: .82, tread: 1.12, top: 8.5 },
      stones: 1,                        // the photographed stone on the shore's boulders
      stoneTile: 4.6, stoneContrast: 2.1, stoneRelief: 1.7
    },
    air: {
      on: part('v4air'),
      river: .0002                      // the same step of air over the far water (per metre)
    },
    /* values of the third round's modules, set through their own tune objects while this is on (water: with the shore part;
       far: with the air part) */
    theirs: { water: { 'shore.shallow': 1, 'shore.wall': 1, body: .56 }, far: { 'haze.strength': .4 } }
  };
  const state = { water: 'not built yet', rock: 'not built yet', ripple: 'loading', programs: 0, patches: {} };
  window.__FLOW2_VALLEY4__ = { tune: T, state };
  if (innerWidth < 760) { state.water = state.rock = 'small screen: off'; return; }
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- the ripple map: fetched and decoded off the main thread now, made into a texture when THREE arrives ---------- */
  const RIPPLE = new URL('prototypes/index1-5-flow/assets/valley4/ripple-512.webp', document.baseURI).href;
  let rippleBitmap = null, rippleFade = 0, rippleAt = 0;
  const ripplePicture = fetch(RIPPLE).then(r => { if (!r.ok) throw new Error(r.status + ' ' + RIPPLE); return r.blob(); })
    .then(b => createImageBitmap(b, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' }))
    .then(bitmap => { rippleBitmap = bitmap; state.ripple = 'decoded'; return bitmap; })
    .catch(error => { state.ripple = 'failed: ' + (error?.message || error); return null; });

  const ctx = { THREE: null, renderer: null, journey: null, CONFIG: null, sea: null };
  /* the river's uniforms */
  const UW = {
    uV4Rip: { value: null },
    uV4W: { value: [0, T.water.ripple, T.water.calm, T.water.mid] },     // amount (× ready), ripple slope, calm share, middle size's slope
    uV4W2: { value: [T.water.tiles[0], T.water.tiles[1], T.water.tiles[2], T.water.time] },
    uV4W3: { value: [T.water.lee, T.water.ease, T.water.crest, 0] },
    uV4S: { value: [0, T.shore.see, T.shore.lap, T.shore.perMetre] },      // shore amount, bed lost per metre of depth, lap line, depth per metre from the bank
    uV4S2: { value: [T.shore.tint, 0, T.shore.cobble, 0] },                // pale tinge kept, foam stepped back, cobble contrast, air per metre
    uV4Bed: { value: [0, 0, 0] },
    uV4Mo: { value: 1 }
  };
  /* the walls' */
  const UR = { uV4R: { value: [0, T.rock.relief, 0, 0] }, uV4R2: { value: [T.rock.side, 0, 0, 0] } };   // relief amount, the sky key's strength, sliver fix, matte shelves · the side key's strength
  /* the low shelves' (they borrow the boulders' two photographs) */
  const UF = { uV4F: { value: [0, T.rock.foot.tile, T.rock.foot.contrast, T.rock.foot.tone] }, uV4F2: { value: [T.rock.foot.relief, T.rock.foot.riser, T.rock.foot.tread, T.rock.foot.top] } };
  /* the boulders' */
  const US = {
    uV4St: { value: [0, T.rock.stoneTile, T.rock.stoneContrast, T.rock.stoneRelief] },
    uV4RockC: { value: null }, uV4RockN: { value: null }, uV4Mean: { value: [1, 1, 1] }
  };

  /* ================= the river ================= */
  const R_PARS = 'uniform sampler2D uV4Rip;uniform vec4 uV4W,uV4W2,uV4W3,uV4S,uV4S2;uniform vec3 uV4Bed;uniform float uV4Mo;\n';
  /* anchors in the third round's wave code (flow2-valley3-water.js), each needed exactly once */
  const A_GUST = 'vec2 f3sl=vec2(0.);float f3va=0.,f3hg=0.,f3t=uSeaTime*uF3Flow.z,f3g=uF3W.y*f3gust;';
  const A_NORMAL = 'f3n=normalize(vec3(nrm.x-f3sl.x,nrm.y,nrm.z-f3sl.y));';
  const A_BODY = 'vec2 f3sh=normalize(uF3Sun.xz+vec2(1e-4));';
  /* and in the page's own river shader */
  const A_SHORE = 'if(uRiverSurface>.5&&uShore.w>.5){';
  const A_FOAM = 'col=mix(col,uShoreFoamColor,clamp(foamAmt,0.,.82));';
  const G_GUST = `/* flow2 valley4 (flow2-valley4.js): cat's paws. The wind ruffles the river in patches and leaves glassy lanes between
           them and in the lee of the walls: there the canyon's picture holds together */
        float v4rough=1.,v4t=uSeaTime*uV4Mo;vec2 v4p=vWorld.xz+uF3Flow.xy*v4t;
        if(uV4W.x>.001){
          vec2 v4q=v4p*vec2(.019,.0075);
          float v4a=seaNoise(v4q+vec2(v4t*.005,v4t*.009))*.62+seaNoise(v4q*2.9+vec2(3.1,7.7)-vec2(0.,v4t*.016))*.38;
          float v4lee=mix(uV4W3.x,1.,smoothstep(1.,16.,max(vShore.y,0.)));
          v4rough=mix(1.,mix(uV4W.z,1.,smoothstep(.26,.5,v4a))*v4lee,uV4W.x);
          f3gust*=mix(1.,uV4W3.y+(1.-uV4W3.y)*v4rough,uV4W.x);
        }
        `;
  const G_RIPPLE = `/* flow2 valley4: fine wind ripples, a made ripple map at three sizes crossing one another; the smallest only exists near the
           lens. Each is drawn while a pixel can hold its waves (and read only there); what the pixel can no longer hold is kept
           as roughness */
        if(uV4W.x>.001){
          float v4tx=f3px*512.,v4c=v4t*uV4W2.w;
          mat2 v4R1=mat2(.956,.292,-.292,.956),v4R2=mat2(.921,-.391,.391,.921),v4R3=mat2(.985,-.174,.174,.985);
          vec2 v4dx=dFdx(vWorld.xz),v4dy=dFdy(vWorld.xz);
          float v4k1=1.-smoothstep(3.,40.,v4tx/uV4W2.x),v4k2=1.-smoothstep(3.,40.,v4tx/uV4W2.y),v4k3=1.-smoothstep(3.,40.,v4tx/uV4W2.z);
          float v4a1=uV4W.y*v4rough*uV4W.x,v4a2=uV4W.y*.65*v4rough*uV4W.x,v4a3=uV4W.w*(.4+.6*v4rough)*uV4W.x;
          if(v4k1*v4a1>.0004){
            vec3 v4m=textureGrad(uV4Rip,v4R1*v4p/uV4W2.x+vec2(.013,.071)*v4c,v4R1*v4dx/uV4W2.x,v4R1*v4dy/uV4W2.x).xyz;
            f3sl+=((v4m.xy*2.-1.)*v4R1)*(3.*v4a1*v4k1);f3hg+=(v4m.z-.5)*v4a1*v4k1*uV4W3.z;
          }
          if(v4k2*v4a2>.0004){
            vec3 v4m=textureGrad(uV4Rip,v4R2*v4p/uV4W2.y+vec2(-.05,.21)*v4c,v4R2*v4dx/uV4W2.y,v4R2*v4dy/uV4W2.y).xyz;
            f3sl+=((v4m.xy*2.-1.)*v4R2)*(3.*v4a2*v4k2);
          }
          if(v4k3*v4a3>.0004){
            vec3 v4m=textureGrad(uV4Rip,v4R3*v4p/uV4W2.z+vec2(.004,.027)*v4c,v4R3*v4dx/uV4W2.z,v4R3*v4dy/uV4W2.z).xyz;
            f3sl+=((v4m.xy*2.-1.)*v4R3)*(3.*v4a3*v4k3);f3hg+=(v4m.z-.5)*v4a3*v4k3*2.*uV4W3.z;
          }
          f3va+=.5*(v4a1*v4a1*(1.-v4k1*v4k1)+v4a2*v4a2*(1.-v4k2*v4k2)+v4a3*v4a3*(1.-v4k3*v4k3));
        }
        `;
  const G_BODY = `/* flow2 valley4: the shallows. The bank goes on under the water as a shelving bed (the mesh's own bed drops to 6 m within
           3 m of the bank, which left only a pale rim): over the first metres the bed shows through, wet cobbled stone of the
           bank's own shade, bent a little by the ripples; the pale blue stays as a tinge over the middle depths; then the deep body */
        if(uV4S.x>.001){
          float v4d=min(max(-vShore.x,0.),max(vShore.y,0.)*uV4S.w+.03);
          f3body=mix(f3body,mix(uF2Deep,uF2Shallow,exp(-v4d*uF2Tone.x*1.5)*uV4S2.x)*uF3B.x,uV4S.x);
          float v4see=exp(-v4d*uV4S.y)*uV4S.x*(1.-smoothstep(.08,.7,f3px));
          if(v4see>.004){
            float v4lod=log2(max(f3px*176.,1.));
            vec2 v4b=vWorld.xz+f3sl*(.25+.6*v4d);
            float v4c1=textureLod(uV4Rip,mat2(.8,.6,-.6,.8)*v4b/2.9,v4lod).z,v4c2=textureLod(uV4Rip,v4b/.83+.37,v4lod+1.8).z;
            float v4cob=clamp(.5+((v4c1-.5)*3.2+(v4c2-.5)*1.6)*uV4S2.z,0.,1.);
            f3body=mix(f3body,uV4Bed*(.4+1.2*v4cob*v4cob),v4see);
          }
        }
        `;
  const G_EDGE = `/* flow2 valley4: the water's edge. A thin lap line that rises and falls a hand's width at the bank, out of step along it;
         and the canyon's air over the far water */
      if(uRiverSurface>.5&&f3w>.001&&(uV4S.x>.001||uV4S2.w>0.)){
        float v4px=fwidth(vWorld.x)+fwidth(vWorld.z)+1e-3,v4tt=uSeaTime*uV4Mo;
        if(uV4S.x*uV4S.z>.001&&v4px<1.2&&abs(vShore.y-.1)<1.3){
          float v4in=vShore.y+(seaNoise(vWorld.xz*1.3+vec2(4.1,2.7))-.5)*.35+sin(v4tt*.9+seaNoise(vWorld.xz*.17)*12.)*.06;
          float v4line=(1.-smoothstep(0.,.07+v4px*1.2,abs(v4in-.1)))*smoothstep(.3,.55,seaNoise(vWorld.xz*.6+vec2(1.7,9.2)+v4tt*.05))*(1.-smoothstep(.25,1.2,v4px));
          col=mix(col,mix(col,uF2Fog.rgb,.55)+.02,v4line*uV4S.z*uV4S.x*f3w);
        }
        col=mix(col,uF2Fog.rgb,(1.-exp(-vDist*uV4S2.w))*f3w);
      }
      `;

  function river(args) {
    const { THREE, seaMaterial, journey, CONFIG } = args;
    ctx.THREE ||= THREE; ctx.journey ||= journey; ctx.CONFIG ||= CONFIG;
    if (!THREE || !seaMaterial?.isShaderMaterial) { state.water = 'no canyon river'; return; }
    const W3 = window.__FLOW2_VALLEY3_WATER__;
    if (!/^on/.test(W3?.state?.water || '')) { state.water = 'the third round\'s water is not on here (' + (W3?.state?.water || 'not loaded') + '): the river stays as it is'; return; }
    let fs = seaMaterial.fragmentShader;
    const once = a => fs.split(a).length === 2;
    if (fs.includes('uV4Rip')) { state.water = 'already installed'; return; }
    if (!once(A_SHORE)) { state.water = 'the river shader has changed: left as it is'; return; }
    const done = [], skipped = [];
    const put = (name, anchor, code, after) => { if (once(anchor)) { fs = fs.replace(anchor, () => after ? anchor + code : code + anchor); done.push(name); } else skipped.push(name); };
    if (T.water.on && once(A_GUST) && once(A_NORMAL)) { put('paws', A_GUST, G_GUST); put('ripples', A_NORMAL, G_RIPPLE); } else skipped.push('ripples');
    if (T.shore.on) {
      put('shallows', A_BODY, G_BODY);
      if (once(A_FOAM)) { fs = fs.replace(A_FOAM, 'col=mix(col,uShoreFoamColor,clamp(foamAmt*(1.-uV4S2.y),0.,.82));'); done.push('foam'); } else skipped.push('foam');
    }
    put('edge', A_SHORE, G_EDGE);
    seaMaterial.fragmentShader = R_PARS + fs; Object.assign(seaMaterial.uniforms, UW); seaMaterial.needsUpdate = true;
    ctx.sea = seaMaterial;
    state.water = 'on (' + done.join(', ') + ')' + (skipped.length ? ' · not found: ' + skipped.join(', ') : '');
    document.documentElement.dataset.flow2Valley4 = 'on';
    start();
  }

  /* ================= the walls ================= */
  const count = (s, a) => s.split(a).length - 1;
  const W_MAIN = 'void main() {';
  const W_SCREE = '      float screeM=0.;';
  const W_EMISSIVE = '#include <emissivemap_fragment>';
  const W_ROCKVAR = '      vec3 rockVar=vec3(1.);   // water streaks / varnish';
  const G_FOOT = `      /* flow2 valley4 (flow2-valley4.js): the low shelves and the wall's foot at the water, the stepped rock the lens passes at
         15–40 m. They were smooth pale putty. Here: the photographed bedded stone at a close size on all three faces (level
         beds on the risers, their traces across the treads), its relief turning the surface, the riser a tone darker than
         the tread, wet and dark only at the lap line. Read only there (explicit gradients). */
      vec3 v4Px=dFdx(P),v4Py=dFdy(P);
      float v4z=uV4F.x*(1.-smoothstep(uV4F2.w-3.5,uV4F2.w,P.y))*(1.-smoothstep(.05,.16,foot));
      if(v4z>.004){
        vec3 v4q=P/uV4F.y,v4qx=v4Px/uV4F.y,v4qy=v4Py/uV4F.y;
        mat2 v4T=mat2(.8,.6,-.6,.8);
        vec2 v4ua=v4q.zy,v4ub=v4q.xy+vec2(.37,0.),v4ut=v4T*v4q.xz+vec2(.29,.83);
        vec2 v4tx=v4T*v4qx.xz,v4ty=v4T*v4qy.xz;
        vec3 v4c=(textureGrad(uV4RockC,v4ua,v4qx.zy,v4qy.zy).rgb*W.x+textureGrad(uV4RockC,v4ut,v4tx,v4ty).rgb*W.y+textureGrad(uV4RockC,v4ub,v4qx.xy,v4qy.xy).rgb*W.z)/uV4Mean;
        float v4l=clamp(aLuma(v4c),.2,2.8);
        /* wet and dark only where the river laps (to about 1.5 m, an uneven upper edge); the page darkens the foot evenly up
           to 5 m, which hid the stone: above the lap zone that is taken back, so the shelf faces are dry stone that can be read */
        float v4wb=mix(1.,.45,1.-smoothstep(.4,5.,P.y)),v4wn=mix(1.,.5,1.-smoothstep(.35,1.5,P.y+(aNoise(P.xz*.45+vec2(2.1,7.3))-.5)*.7));
        rock*=mix(1.,(v4wn/v4wb)*clamp(pow(v4l,uV4F.z),.26,1.9)*uV4F.w*mix(uV4F2.y,uV4F2.z,smoothstep(.25,.85,N0.y)),v4z);
        vec3 v4na=textureGrad(uV4RockN,v4ua,v4qx.zy,v4qy.zy).xyz*2.-1.,v4nb=textureGrad(uV4RockN,v4ub,v4qx.xy,v4qy.xy).xyz*2.-1.,v4nt=textureGrad(uV4RockN,v4ut,v4tx,v4ty).xyz*2.-1.;
        vec2 v4nr=v4nt.xy*v4T;
        vec3 v4d=(vec3(0.,v4na.y,v4na.x)*W.x+vec3(v4nr.x,0.,v4nr.y)*W.y+vec3(v4nb.x,v4nb.y,0.)*W.z)*(uV4F2.x*v4z);
        Nr=normalize(Nr+v4d-Nr*dot(Nr,v4d));
      }
`;
  const G_RELIEF = `      /* flow2 valley4 (flow2-valley4.js): the wall's relief read in the shade as well. The sky and the ground light were equal, so
         a shaded wall was flat colour; here every turn of the relief (beds, cracks, joints, flutes, the photograph's relief map)
         is shaded by two soft keys that cast no shadow and have no edge: the open sky above the canyon, and the bright end of
         the canyon (the sky on the sun's side), which models the upright ribs. No texture reads. */
      if(uV4R.x>.001){
        float v4k=uV4R.x*(1.-.6*smoothstep(.6,.9,N0.y))*(1.-smoothstep(2.5,8.,foot));
        vec3 v4dn=Nr-N0;
        float v4s=dot(v4dn,normalize(vec3(N0.x*.5,.9,N0.z*.5)))*uV4R.y;
        #if NUM_DIR_LIGHTS > 0
        v4s+=dot(v4dn,normalize(vec3(sunW.x,.12,sunW.z)))*uV4R2.x;
        #endif
        rock*=1.+clamp(v4s,-.62,1.)*v4k;
      }
`;
  const G_LIGHT = `      /* flow2 valley4: (a) no sunlit slivers on a face turned away from the sun (the relief map tilted single pixels into a sun the
         face itself cannot see); (b) low flat shelves at the water are matte wet stone, they do not glare toward the sun */
      #if NUM_DIR_LIGHTS > 0
      if(uV4R.z>.001){
        vec3 v4L=directionalLights[0].direction;
        float v4g=dot(normalize(mat3(viewMatrix)*N0),v4L),v4d=dot(normal,v4L);
        normal=normalize(normal-v4L*(max(v4d,0.)*(1.-smoothstep(-.1,.24,v4g))*uV4R.z));
      }
      #endif
      roughnessFactor=mix(roughnessFactor,.97,uV4R.w*smoothstep(.45,.8,N0.y)*(1.-smoothstep(5.,9.,P.y)));
      `;
  const G_STONE = `      /* flow2 valley4 (flow2-valley4.js): the shore's boulders carry the photographed stone of the walls (its light and shade, its relief) */
      if(uV4St.x>.001){
        vec3 v4q=P/uV4St.y;
        float v4f=uV4St.x*(1.-smoothstep(uV4St.y*.012,uV4St.y*.045,foot));
        vec3 v4c=(texture2D(uV4RockC,v4q.zy).rgb*W.x+texture2D(uV4RockC,v4q.xz).rgb*W.y+texture2D(uV4RockC,v4q.xy).rgb*W.z)/uV4Mean;
        rock*=mix(1.,clamp(pow(clamp(aLuma(v4c),.25,2.6),uV4St.z),.3,1.8),v4f);
        float v4cv=1.;
        Nr=aTriN(uV4RockN,v4q,Nr,W,uV4St.w*v4f,v4cv);
      }
`;

  function walls(built) {
    if (!built?.scene) { state.rock = 'no canyon handed over'; return; }
    const seen = new Set();
    built.scene.traverse(object => {
      for (const material of [].concat(object.material || [])) {
        if (!material?.userData?.alpineTerrain || seen.has(material) || typeof material.onBeforeCompile !== 'function') continue;
        seen.add(material);
        const compile = material.onBeforeCompile, key = material.customProgramCacheKey;
        material.onBeforeCompile = function (shader, renderer) {
          compile.call(this, shader, renderer);
          let f = shader.fragmentShader;
          if (f.includes('#define ALP_LITE\n') || f.includes('uV4R') || f.includes('uV4St') || !f.includes(W_MAIN)) return;
          if (f.includes('#define ALP_BANK\n')) {
            /* the canyon walls' full program */
            const edits = [['relief', W_SCREE, (T.rock.foot.on ? G_FOOT : '') + G_RELIEF + W_SCREE], ['light', W_EMISSIVE, G_LIGHT + W_EMISSIVE]];
            let any = false;
            for (const [name, a, b] of edits) { const n = count(f, a); state.patches[name] = n === 1 ? 'on' : 'skipped (' + n + ')'; if (n === 1) { f = f.replace(a, () => b); any = true; } }
            if (!any) { state.rock = 'the wall shader has changed: left as it was'; return; }
            shader.fragmentShader = f.replace(W_MAIN, 'uniform vec4 uV4R,uV4R2,uV4F,uV4F2;uniform vec3 uV4Mean;uniform sampler2D uV4RockC,uV4RockN;\n' + W_MAIN);
            for (const k of Object.keys(UR)) shader.uniforms[k] = UR[k];
            for (const k of Object.keys(UF)) shader.uniforms[k] = UF[k];
            for (const k of ['uV4RockC', 'uV4RockN', 'uV4Mean']) shader.uniforms[k] = US[k];
            state.programs++; state.rock = 'on';
          } else if (f.includes('#define ALP_PROP\n') && T.rock.on) {
            /* the instanced shore stones' program */
            const n = count(f, W_ROCKVAR); state.patches.stones = n === 1 ? 'on' : 'skipped (' + n + ')';
            if (n !== 1) return;
            shader.fragmentShader = f.replace(W_ROCKVAR, () => G_STONE + W_ROCKVAR).replace(W_MAIN, 'uniform vec4 uV4St;uniform vec3 uV4Mean;uniform sampler2D uV4RockC,uV4RockN;\n' + W_MAIN);
            for (const k of Object.keys(US)) shader.uniforms[k] = US[k];
            state.programs++;
          }
        };
        material.customProgramCacheKey = function () { return (key ? key.call(this) : '') + '|flow2-valley4-1'; };
        material.needsUpdate = true;
      }
    });
    if (state.rock === 'not built yet') state.rock = seen.size ? 'waiting for the walls to be drawn' : 'no terrain material found';
    start();
  }

  /* ================= every frame: the dials ================= */
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const luma = c => .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
  /* the third round's values this holds while it is on: [object, key path] → the value before */
  const held = new Map(); let heldAt = '';
  function theirs(amounts) {
    const sig = JSON.stringify(amounts); if (sig === heldAt) return; heldAt = sig;
    const targets = { water: window.__FLOW2_VALLEY3_WATER__?.tune, rock: window.__FLOW2_VALLEY3_ROCK__?.tune, far: window.__FLOW2_VALLEY3_FAR__?.tune };
    for (const who of Object.keys(T.theirs)) {
      const tune = targets[who], amount = amounts[who] || 0; if (!tune) continue;
      for (const [pathKey, value] of Object.entries(T.theirs[who])) {
        const keys = pathKey.split('.'), last = keys.pop(); let o = tune; for (const k of keys) o = o?.[k];
        if (!o || typeof o[last] !== 'number') continue;
        const id = who + ':' + pathKey; if (!held.has(id)) held.set(id, o[last]);
        o[last] = held.get(id) + (value - held.get(id)) * amount;
      }
    }
    state.theirs = Object.fromEntries(held);
  }
  let running = false, last = 0;
  function start() {
    if (running) return; running = true;
    (function frame(now) {
      requestAnimationFrame(frame);
      const dt = Math.min(.1, Math.max(0, ((now || 0) - last) / 1000)); last = now || 0;
      const S = window.__MONTIS_STUDY__, THREE = ctx.THREE, renderer = ctx.renderer || S?.renderer;
      const p = +(ctx.journey || S?.journey)?.progress, LF = window.__FLOW2_LIFT_FADE__; const dial = Number.isFinite(p) ? 1 - smooth(LF ? LF[0] : 9.7, LF ? LF[1] : 10.7, p) : 1; /* flow2 unify (2026-11-14): with the lift cut on, the canyon keeps its full look up to the cut (window.__FLOW2_LIFT_FADE__, set by flow2-lift-cut.js); without it, the original window */
      const A = Math.min(1, Math.max(0, +T.amount || 0)), riverDial = Number.isFinite(p) ? 1 - smooth(LF ? LF[0] : 9.6, LF ? LF[1] : 10.3, p) : 1;
      /* the ripple map: made into a texture once, uploaded in a frame of its own, then eased in */
      if (rippleBitmap && THREE && renderer && !UW.uV4Rip.value) {
        const t = new THREE.Texture(rippleBitmap);
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.flipY = false; t.generateMipmaps = true; t.colorSpace = THREE.NoColorSpace;
        t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
        t.anisotropy = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() || 4); t.needsUpdate = true;
        UW.uV4Rip.value = t; try { renderer.initTexture?.(t); } catch { } rippleAt = 2; state.ripple = 'uploaded';
      } else if (rippleAt > 0 && --rippleAt === 0) state.ripple = 'on';
      if (state.ripple === 'on') rippleFade = Math.min(1, rippleFade + dt / .8);
      const ready = rippleFade * rippleFade * (3 - 2 * rippleFade);
      /* the river */
      const w = UW.uV4W.value, w2 = UW.uV4W2.value, w3 = UW.uV4W3.value, s = UW.uV4S.value, s2 = UW.uV4S2.value;
      w[0] = T.water.on ? A * ready : 0; w[1] = T.water.ripple; w[2] = T.water.calm; w[3] = T.water.mid;
      w2[0] = T.water.tiles[0]; w2[1] = T.water.tiles[1]; w2[2] = T.water.tiles[2]; w2[3] = T.water.time;
      w3[0] = T.water.lee; w3[1] = T.water.ease; w3[2] = T.water.crest;
      s[0] = T.shore.on ? A * ready : 0; s[1] = T.shore.see; s[2] = T.shore.lap; s[3] = T.shore.perMetre;
      s2[0] = T.shore.tint; s2[1] = T.shore.on ? T.shore.foam * A * riverDial : 0; s2[2] = T.shore.cobble; s2[3] = T.air.on ? T.air.river * A * riverDial : 0;
      UW.uV4Mo.value = still.matches ? 0 : 1;
      /* the bed's stone stands in the valley's light: the fog's brightness is the day's (flow2-day.js moves it) */
      const fog = ctx.sea?.uniforms?.uF2Fog?.value, light = fog ? Math.min(1.6, Math.max(.25, luma([fog.x, fog.y, fog.z]) / .62)) : 1;
      const bed = UW.uV4Bed.value; bed[0] = T.shore.bed[0] * light; bed[1] = T.shore.bed[1] * light; bed[2] = T.shore.bed[2] * light;
      /* the walls */
      const r = UR.uV4R.value, st = US.uV4St.value, on = T.rock.on ? A * dial : 0;
      r[0] = on; r[1] = T.rock.relief; r[2] = on * T.rock.slivers; r[3] = on * T.rock.matte; UR.uV4R2.value[0] = T.rock.side;
      /* the boulders borrow the third round's two photographs once they are on the GPU */
      const V3 = window.__FLOW2_VALLEY3_ROCK__;
      if (!US.uV4RockC.value && V3?.state?.textures === 'on' && V3.uniforms?.v3RockC?.value) { US.uV4RockC.value = V3.uniforms.v3RockC.value; US.uV4RockN.value = V3.uniforms.v3RockN.value; US.uV4Mean.value = V3.uniforms.uV3Mean.value; state.stones = 'on'; }
      const F = T.rock.foot, f = UF.uV4F.value, f2 = UF.uV4F2.value;
      f[0] = US.uV4RockC.value ? on * F.on : 0; f[1] = F.tile; f[2] = F.contrast; f[3] = F.tone; f2[0] = F.relief; f2[1] = F.riser; f2[2] = F.tread; f2[3] = F.top;
      st[0] = US.uV4RockC.value ? on * T.rock.stones : 0; st[1] = T.rock.stoneTile; st[2] = T.rock.stoneContrast; st[3] = T.rock.stoneRelief;
      theirs({ water: /^on/.test(state.water) && T.shore.on ? A : 0, far: T.air.on ? A : 0 });
    })();
  }

  /* ---------- hooks: after the third round on both of the page's hand-over calls ---------- */
  const prevLight = window.__FLOW2_CANYON_LIGHT__;
  window.__FLOW2_CANYON_LIGHT__ = { ...(prevLight || {}), install(args) { try { prevLight?.install?.(args); } finally { try { river(args || {}); } catch (error) { state.water = 'failed: ' + (error?.message || error); console.warn('flow2 valley4: the river stays as it was', error); } } } };
  const host = window.__FLOW2_FINE_JOURNEY__ ||= {};
  const before = host.canyon;
  host.canyon = function (handles = {}) {
    try { before?.call(this, handles); } finally {
      ctx.THREE ||= handles.THREE; ctx.renderer ||= handles.renderer;
      if (!handles.lite) { try { walls(handles.canyon); } catch (error) { state.rock = 'failed: ' + (error?.message || error); console.warn('flow2 valley4: the walls keep their look', error); } }
      else state.rock = 'not on the lighter drawing';
    }
  };
  void ripplePicture;
})();
