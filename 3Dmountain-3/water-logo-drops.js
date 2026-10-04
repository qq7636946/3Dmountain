import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/** Water drops around the logo, each with a photograph dissolved into it,
 * each moving as liquid does, shedding spray as it goes, in air that carries
 * loose beads of its own. Three choreographies, all owned by the scroll and
 * all running backward with it:
 *
 *   SPIRAL (螺旋) — the cards' open helix one to one, and at the end of the
 *   chapter the string climbs off the top of the frame, head first, until the
 *   last drop is gone.
 *
 *   LUNGE (前撲) — no spiral. The drops wait far behind the mark; one after
 *   another each crouches back and then throws itself straight at the lens,
 *   growing, smearing with its own speed, past the edge of the frame. The air
 *   streams past with them.
 *
 *   BLOOM (綻放) — the drops burst out from behind the mark, overshoot and
 *   settle into a constellation that turns slowly while it hangs, then, one
 *   after another, crouch and pounce at the lens from where they hang, as the
 *   lunge's drops do, with the air rushing out past us behind them. (The old
 *   ending, a rain into the sea with a crown and a ring for each strike, is
 *   still there behind BLOOM END.)
 *
 * OPTICS. Each drop is traced analytically in its own fragment shader: the
 * view ray refracts into the water, meets the photograph on the plane through
 * the drop's centre, and otherwise refracts out through the back into the
 * room. That is a real ball lens, so the picture swells toward the middle and
 * compresses toward the rim, and what shows at the rim is the room upside down
 * — the one detail that makes a bead of water read as water rather than as a
 * glass button. Three wavelengths are traced, each at its own index. The
 * photograph covers the drop's whole cross-section, so there is no rectangle
 * anywhere, and it dissolves toward the rim into the inverted room, the dark
 * band and the bright Fresnel edge.
 *
 * MOTION BLUR. Exact, per drop: over the shutter the drop sweeps a capsule,
 * and for every pixel the shader solves when during the exposure its ray was
 * inside the moving drop — a quadratic in time — so the coverage (the alpha)
 * is the true fraction of the exposure, and the colour is the drop traced at
 * several moments across that interval. A drop coming straight at the lens
 * blooms outward with a soft rim and smears back toward the vanishing point,
 * which is exactly what a camera sees.
 *
 * MOTION. All of it driven by each drop's own measured velocity, so it
 * belongs to the scroll: a squirm at rest (smooth 3-D noise in a frame that
 * rolls as the drop travels); inertia (a damped spring driven by acceleration
 * — left behind when the drop starts, thrown ahead when it stops, ringing down
 * at a rate set by its size); and a tear at the back at speed. The stretch is
 * volume-preserving and affine, so the fragment shader undoes it exactly
 * before tracing — the optics stay a true lens, and the photograph, being in
 * the water, stretches with the water. The picture also sloshes: it tips with
 * the flow and swings back upright when the drop stops.
 *
 * SPRAY AND BEADS. A moving drop sheds droplets from its back — more the
 * faster it goes, and a spatter forward when it stops short — which keep some
 * of its momentum, lose it quickly to drag, fall, and shrink away. Around the
 * whole mark hang loose beads. None of them is round: each is a small
 * irregular body of water, lumpy, squirming, the spray drawn out along its
 * flight into a tear. They are drawn as real little lenses in the drops' own
 * terms — the room refracted through them upside down, a dark rim, the
 * Fresnel edge, the window's spark.
 *
 * Nothing here samples the page's refraction backdrop: all of it sits inside
 * that capture, so the logo glass bends it with no feedback loop. The
 * photographs are the cards' works in the cards' order, at full resolution.
 */
export const LOGO_DROP_DEFAULTS = {
  enabled: 1,
  /* MODE: 0 spiral, 1 lunge, 2 bloom. BLUR is the shutter, in sixtieths of a
     second: how far a fast drop smears. It is on in the lunge and the bloom;
     BLUR SPIRAL gives it to the spiral too. HAZE: how far a distant drop
     fades into the room. */
  mode: 0, blur: 1.2, blurSpiral: 0, haze: .45,
  /* The entrance — how the drops arrive after the hero drop has burst, in
     the stretch before the chapter proper. Times are the chapter's own units,
     so they are negative: -.3 is about when the last of the burst has passed
     the lens.
       0 FADE: they fade in where they start, with the mark, as before.
       1 RETURN (回流): the water that flew past the lens comes back. Each drop
         sweeps in from beyond the edge of the frame, curling round the lens's
         axis, smeared by its own speed; it slows into its place as its
         photograph develops in it, and they all arrive as the mark finishes
         condensing between them.
       2 CONVERGE (內聚): they are drawn in from the edges to a point just
         behind the mark and merge there — a flash as the mark forms — then
         are thrown back out to their places.
     ENTER START is when the first sets off, ENTER STAGGER how far behind it
     the last one does; ENTER SWIRL is how far round the axis the paths curl
     (half-turns); DEVELOP how late in its flight a photograph appears;
     ENTER MERGE when the converging drops meet; ENTER FLASH how much of the
     old white light curtain is kept (it hid everything). */
  entrance: 1, enterStart: -.42, enterStagger: .1, enterSwirl: .45, develop: .4,
  enterMerge: -.12, enterFlash: .15,
  /* The helix, number for number the cards' — except the radius, opened so a
     drop at the side of the ring clears the end of the LOGO 3 wordmark.
     COUNT is how many drops there are, in every mode; on the helix the run
     keeps its length, so more drops pack it tighter rather than running it
     off the frame — SPACING is the gap between neighbours at eight. */
  count: 8,
  radius: 1.2, spacing: .78, pitch: .18, turns: 1, phase: 40,
  tiltX: -8, tiltZ: -7, offsetY: -.02, tailTaper: .18, tailDepth: .18, wave: .035, autoSpeed: 0,
  /* The spiral's exit, in the chapter's own 0–1. LEAVE turns it on. The
     head drop starts its climb at LEAVE START, the last one is gone at LEAVE
     END, and each takes LEAVE CLIMB to go. LEAVE SPIN is how far on round the
     ring a drop travels while it climbs (turns); LEAVE RISE how far past the
     top edge it goes (1 = just clear of it); LEAVE RADIUS what the ring's
     radius becomes on the way up (below 1 it tightens into a column). */
  leave: 1, leaveStart: .5, leaveEnd: .97, leaveClimb: .22,
  leaveSpin: .35, leaveRise: 1.25, leaveRadius: .85,
  /* The lunge. The drops wait LUNGE DEPTH behind the mark, spread LUNGE
     SPREAD around its axis. From LUNGE START to LUNGE END they go, one after
     another, each taking LUNGE FLIGHT from its crouch to past the lens; LUNGE
     RECOIL is how far it draws back first. STREAM is how much air rushes
     past with them over the chapter. */
  lungeStart: .04, lungeEnd: .95, lungeFlight: .3, lungeDepth: 7, lungeSpread: .8,
  /* No pauses: every drop drifts in from the start (LUNGE DRIFT, the share
     of the way it creeps over the chapter) and leaps out of that drift with
     an acceleration of power LUNGE CURVE. RECOIL 0 is no crouch. */
  lungeDrift: .14, lungeCurve: 2, lungeRecoil: 0, stream: 1.4,
  /* The bloom. At BLOOM AT the gathered drops burst from behind the mark,
     taking BLOOM TIME to reach a constellation BLOOM SPREAD wide and BLOOM
     DEPTH deep, which turns BLOOM TURN degrees while it hangs. From RAIN
     START to RAIN END they leave, one after another, each taking RAIN FALL:
     BLOOM END 0 pounces at the lens from where it hangs — no crouch, one
     smooth run from rest, POUNCE CURVE the power of its acceleration — and
     1 falls toward the lens into the sea at the foot of the frame, where
     RAIN LAND is how high on the screen it strikes (-1 the bottom edge) and
     SPLASH how hard. */
  /* BLOOM DRIFT is how fast the figure keeps opening and coming on after
     the burst, so it never hangs still. */
  bloomAt: 0, bloomTime: .2, bloomSpread: 1, bloomDepth: 1, bloomTurn: 16, bloomDrift: 1.2,
  bloomEnd: 0, pounceCurve: 2, rainStart: .52, rainEnd: .97, rainFall: .2, rainLand: -.88, splash: 1,
  /* The drop. SIZE is the mean radius in the ring's units — small enough that
     the ring frames the wordmark rather than burying it. SIZE VAR is how far
     the drops depart from it, along a set rhythm (see SIZE_RHYTHM): 0 makes
     them all one size. */
  size: .2, sizeVar: .7, ior: 1.333, dispersion: .012,
  /* The picture in it. ZOOM: how far into the photograph the drop looks
     (1 = its short side just spans the drop). FUSE: how much of the drop,
     from the rim inward, the picture dissolves across. VEIL: how much of the
     refracted room shows through the picture everywhere. */
  zoom: 1.2, fuse: .5, veil: .1,
  /* Squirm. WOBBLE is how far the surface moves (drop radii), WOBBLE SPEED
     how fast the shape changes, WOBBLE SCALE how large its lobes are (low =
     the whole drop heaves, high = the surface crawls). */
  wobble: .058, wobbleSpeed: .8, wobbleScale: 1.3,
  /* Liquid physics. INERTIA: how hard acceleration throws the water (the
     spring's drive). JIGGLE: the spring's frequency, rad/s, for a drop of
     mean size. DAMPING: its damping ratio — under .3 it rings, over .7 it
     just settles. STRETCH: how much speed elongates it. TAIL: how much of
     that goes into a tear at the back. SAG: a constant pull downward, so it
     has weight. ROLL: how much of true rolling the surface turns through.
     SLOSH: how far the picture tips with the flow before it swings back
     upright. LIMIT caps the stretch. */
  inertia: 1, jiggle: 9, damping: .22, stretch: 1, tail: 1, sag: .04,
  roll: .4, slosh: 1, limit: .45,
  /* Light. REFLECT scales the Fresnel mirror, SPEC the windows and the sun's
     point, RIM the inky thick edge, CAUSTIC the backlit crescent, ABSORB the
     water's tint, GLOW the room's core seen through a drop. */
  reflect: 1, spec: 1, rim: .55, caustic: .5, absorb: .2, glow: .55,
  /* Spray and the loose beads. SPRAY is how much a moving drop sheds from its
     back (and flings forward when it stops short); SPRAY LIFE and SPRAY SIZE
     scale the droplets' life and size. AMBIENT is how many loose beads hang
     in the air around the mark; AMBIENT SIZE their size; PARALLAX how much
     of the ring's turn they follow (less than all of it, so they read as
     nearer and further than the ring); FLOAT how far they bob. BEAD LUMP is
     how far from round every small drop is, BEAD WOBBLE how fast its shape
     crawls. */
  spray: .6, sprayLife: 1, spraySize: 1,
  ambient: .8, ambientSize: 1, parallax: .35, float: 1,
  beadLump: .3, beadWobble: 1,
  /* The picture's grade — the cards' controls, with the colour left in:
     inside a drop the photograph is the subject. */
  tintStrength: .3, saturation: .72, contrast: 1.08, brightness: 1.03,
  opacity: 1, mobileScale: .68
};

const PHOTOS = [
  ['drop-digital-agency.jpg', 'Digital Agency'],
  ['drop-alone-journey.jpg', 'Alone Journey'],
  ['swank-flat.jpg', 'SWANK'],
  ['dfz-watch.jpg', 'DFZ Watch'],
  ['drop-style-crew.jpg', 'Style Crew'],
  ['novaglam.jpg', 'Novaglam'],
  ['headphones.jpg', 'Every Note'],
  ['editorial.jpg', 'Selected Work']
];
/* The photograph at each place along the strip — the cards' own order — and
   repeated past eight, so a longer string of drops cycles the same works. */
const STRIP_ORDER = [0, 1, 3, 7, 2, 5, 4, 6];
/* The most drops there can be. Built once; the count only shows more or
   fewer of them. */
export const LOGO_DROP_MAX = 16;
/* Relative sizes, place by place, repeating. Composed, not random: a string
   of drops reads as one gesture when it has a rhythm — a large one, then a
   run that falls away, the largest of all near the middle where the ring
   crosses in front of the mark, the smallest just after it so the hero has
   room. Normalised to a mean of 1 so SIZE stays the mean. */
const SIZE_RHYTHM = (() => {
  const raw = [1.16, .66, .9, 1.38, .72, .54, 1.08, .8];
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  return raw.map(v => v / mean);
})();
const GOLDEN = 2.399963229728653;
const fract = v => v - Math.floor(v);
/* The bloom's composed places for the first eight drops. X and Y are on the
   screen — offsets from the centre of the wordmark, in the frame's own
   half-width and half-height, so the figure is composed the same on any
   screen — and Z is depth in the ring's units, toward the lens. The wordmark
   spans about ±.46 across and ±.1 up and down in these terms. Each place is
   set for the size the rhythm gives that slot — 3 is the largest, 5 the
   smallest: the largest low and forward at the left, answered by a large one
   high on the right and another low on the right, the small ones deep in the
   gaps and past the ends of the word, never on its band. */
const CONSTELLATION = [
  { x: .42, y: .41, z: 0 },      // 0 · large, high right
  { x: .05, y: .52, z: -.55 },   // 1 · small, top centre, deep
  { x: -.36, y: .46, z: -.3 },   // 2 · mid, high left, back
  { x: -.5, y: -.56, z: .35 },   // 3 · largest, low left, forward
  { x: .02, y: -.5, z: 0 },      // 4 · mid-small, under the word
  { x: -.78, y: .02, z: -.35 },  // 5 · smallest, past the left end, deep
  { x: .62, y: -.44, z: .25 },   // 6 · large, low right, forward
  { x: .8, y: 0, z: -.4 }        // 7 · mid, past the right end, deep
];

/* Smooth 3-D value noise, shared by the drops and the beads. A hash without
   sin(), so it is the same on every GPU. */
const NOISE_GLSL = /* glsl */`
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
`;

/* The room as the page actually paints it: a bright silver sea that mirrors
   the room — pale at the horizon, ink only far below — under a periwinkle
   ceiling, with a core of light low and ahead. That core, turned upside down
   in every drop, is most of what makes them look lit from inside. */
const ROOM_GLSL = /* glsl */`
  uniform vec3 uRoomTop,uRoomHorizon,uRoomLower,uRoomInk,uRoomCore;
  uniform vec3 uSunDir,uSunCol;
  vec3 roomEnv(vec3 R){
    float h=clamp(R.y,-1.,1.);
    vec3 sky=mix(uRoomHorizon,uRoomTop,pow(max(h,0.),.6));
    vec3 sea=mix(uRoomHorizon,uRoomLower,pow(max(-h,0.),.35));
    sea=mix(sea,uRoomInk,smoothstep(.35,1.,-h)*.55);
    vec3 c=mix(sea,sky,smoothstep(-.015,.015,h));
    float core=max(dot(R,normalize(vec3(0.,.08,-1.))),0.);
    c+=uRoomCore*(pow(core,24.)*.9+pow(core,4.)*.18);
    return c+uSunCol*pow(max(dot(R,uSunDir),0.),900.)*1.1;
  }
`;

/* The drops' affine stretch, both ways. Symmetric and volume-preserving:
   STRETCH elongates along uStretchDir, UNSTRETCH takes it back to the unit
   sphere — and, being symmetric, also carries a sphere's normal to the
   ellipsoid's. */
const STRETCH_GLSL = /* glsl */`
  vec3 stretchV(vec3 v){
    float along=dot(v,uStretchDir);
    return uStretchDir*along*(1.+uStretchAmt)+(v-uStretchDir*along)*inversesqrt(1.+uStretchAmt);
  }
  vec3 unstretch(vec3 v){
    float along=dot(v,uStretchDir);
    return uStretchDir*along/(1.+uStretchAmt)+(v-uStretchDir*along)*sqrt(1.+uStretchAmt);
  }
`;

export function createLogoDrops(THREE, { config, renderer, env, lite = false, onSplash = null, deferTextures = false }) {
  const group = new THREE.Group();
  group.name = 'logo-water-drops';
  group.visible = false;
  /* An icosphere, welded: its vertices are even over the whole surface, so
     the silhouette is equally round from every side, and welding them means
     each is displaced once, not six times. Normals and UVs are dropped
     before the weld — the shader builds its own normals, and the UV seam
     would otherwise stop the weld along a meridian. */
  const weldedSphere = detail => {
    const raw = new THREE.IcosahedronGeometry(1, detail);
    raw.deleteAttribute('normal');
    raw.deleteAttribute('uv');
    const welded = mergeVertices(raw);
    raw.dispose();
    return welded;
  };
  const geometry = weldedSphere(lite ? 4 : 5);
  const meshes = [], textures = [];
  const fallbackCanvas = document.createElement('canvas');
  fallbackCanvas.width = fallbackCanvas.height = 2;
  const fallbackContext = fallbackCanvas.getContext('2d');
  fallbackContext.fillStyle = '#c9d7e3';
  fallbackContext.fillRect(0, 0, 2, 2);
  const placeholder = new THREE.CanvasTexture(fallbackCanvas);
  placeholder.colorSpace = THREE.SRGBColorSpace;
  const MAX_SAMPLES = lite ? 3 : 8;

  const vertexShader = /* glsl */`
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
       fine ones — weight them evenly and a bead reads as crumpled film.
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
        /* Blurred, the mesh is only the hull of the sweep — the drop now and
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
      /* The normal of the surface actually drawn, by finite difference —
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
  `;

  const fragmentShader = /* glsl */`
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
    /* The cards' grade, so the two rings share one palette. */
    vec3 grade(vec3 c){
      float lum=dot(c,vec3(.2126,.7152,.0722));
      float tone=clamp((pow(max(lum,0.),.78)-.5)*uContrast+.5,0.,1.);
      vec3 silver=mix(uInk,uPaper,tone);
      return mix(mix(vec3(lum),c,uSaturation),silver,uTintStrength)*uBrightness;
    }

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
      vec3 photo=grade(texture2D(uPhoto,clamp(uv,0.,1.)).rgb);
      vec3 exitS=pS+tS*sExit;
      vec3 exitN=normalize(unstretch(exitS));
      vec3 o=refract(t,-exitN,ior);
      /* Past the critical angle the light cannot leave: it turns back into
         the drop, which is where the bright ring at the rim of every real
         water bead comes from. */
      if(dot(o,o)<1e-6)o=reflect(t,-exitN);
      vec3 room=roomEnv(normalize(o*uToLocal));
      /* Suspended, not printed: the room that would have come through the
         back still does, a little, through the picture itself. */
      photo=mix(photo,room,uVeil);
      /* Water tints what it carries, by how far it carried it. */
      float path=mix(sExit,sPhoto,onPhoto);
      return mix(room,photo,onPhoto)*exp(-vec3(.20,.075,.018)*uAbsorb*path*2.);
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
      float NdV=clamp(dot(N,-V),0.,1.);
      /* The thick edge: a clean dark band just inside the silhouette, where
         the rays leaving the back are bent far enough to see the floor, or
         cannot leave at all. Steep, so it is a band and not a vignette. */
      col=mix(col,col*mix(vec3(1.),uInk*1.35,.72),pow(1.-NdV,4.)*uRim);
      /* The backlit crescent: light from behind, gathered by the ball and
         thrown out through the lower front edge toward the lens. */
      float crescent=pow(max(dot(N,-uSunDir),0.),3.)*pow(1.-NdV,1.2);
      col+=uSunCol*vec3(.95,.98,1.)*crescent*uCaustic*.6;
      /* The mirror on the front. Water's F0 is two percent, so the room's
         reflection lives almost entirely at the rim — the thin bright line
         outside the dark band. */
      vec3 R=reflect(V,N);
      float fresnel=.02+.98*pow(1.-NdV,5.);
      col=mix(col,roomEnv(R),clamp(fresnel*uReflect,0.,1.));
      /* The windows: the studio's softboxes, sharp. On a real bead the key
         light's reflection is the brightest thing in the frame. */
      vec3 studio=textureCubeLodEXT(uEnv,R,.6).rgb;
      col+=studio*uEnvStudio*(.08+fresnel)*uSpec*1.6;
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
           interval is how much of the exposure this pixel saw water — the
           alpha — and the colour is the drop traced at moments spread
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
        float kept=0.;
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
        vec3 N=normalize(vNormalW);
        col=surface(uToLocal*((vWorld-uCenter)/uRadius),vL,normalize(uToLocal*N),V,N,false);
      }
      /* Distance: a far drop sinks into the room's pale air. */
      col=mix(col,uRoomHorizon,uHaze);
      gl_FragColor=vec4(col,alpha);
    }
  `;

  /* The sun and the studio cube are the logo glass's, by reference, so a
     drop and the mark are lit by the same windows. The room colours and the
     dissolve are the drops' own, shared by every drop and every bead. */
  const shared = {
    uSunDir: env?.uSunDir ?? { value: new THREE.Vector3(-.35, .28, -.9).normalize() },
    uSunCol: env?.uSunCol ?? { value: new THREE.Color('#ffffff') },
    uEnv: env?.uEnv ?? { value: null },
    uEnvStudio: env?.uEnvStudio ?? { value: .26 },
    uRoomTop: { value: new THREE.Color('#92a8cd') },
    uRoomHorizon: { value: new THREE.Color('#e6edf7') },
    uRoomLower: { value: new THREE.Color('#c9d5e8') },
    uRoomInk: { value: new THREE.Color('#3f5a7e') },
    uRoomCore: { value: new THREE.Color('#ffffff') },
    uFuse: { value: new THREE.Vector2(.54, 1) }
  };

  const worldPosition = new THREE.Vector3(), worldQuaternion = new THREE.Quaternion(), worldScale = new THREE.Vector3();
  const toLocal = new THREE.Matrix4();
  function makeDrop(index) {
    const photo = STRIP_ORDER[index % STRIP_ORDER.length];
    const uniforms = {
      ...shared,
      uPhoto: { value: placeholder }, uCover: { value: new THREE.Vector2(.5, .5) },
      uCenter: { value: new THREE.Vector3() }, uRadius: { value: 1 }, uToLocal: { value: new THREE.Matrix3() },
      uPaper: { value: new THREE.Color() }, uInk: { value: new THREE.Color() },
      uTime: { value: 0 }, uSeed: { value: index * .137 + .05 },
      uStretchDir: { value: new THREE.Vector3(0, 1, 0) }, uStretchAmt: { value: 0 },
      uTail: { value: new THREE.Vector3() }, uSweep: { value: new THREE.Vector3() },
      uRollNoise: { value: new THREE.Matrix3() }, uPhotoRot: { value: new THREE.Matrix3() }
    };
    for (const name of ['Wobble', 'WobbleSpeed', 'WobbleScale', 'Ior', 'Dispersion', 'Veil', 'Reflect', 'Spec', 'Rim', 'Caustic', 'Absorb', 'Opacity', 'TintStrength', 'Saturation', 'Contrast', 'Brightness', 'BlurOn', 'BlurSamples', 'Haze']) {
      uniforms['u' + name] = { value: 0 };
    }
    uniforms.uClipY = { value: -1e9 };
    uniforms.uDevelop = { value: 1 };
    const material = new THREE.ShaderMaterial({
      name: 'Water drop · ' + PHOTOS[photo][1],
      uniforms, vertexShader, fragmentShader,
      transparent: true, depthWrite: true
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Water drop ' + (index + 1) + ' · ' + PHOTOS[photo][1];
    mesh.frustumCulled = false;
    mesh.visible = false;
    /* With the cards: before the logo glass, so it can bend them. */
    mesh.renderOrder = 4;
    mesh.userData.slot = index;
    mesh.userData.photo = photo;
    mesh.userData.aspect = 1.42;
    /* Each drop's own body: velocity, the inertial spring, the rolled frame
       the squirm is sampled in, the slosh of the picture, the spray it owes,
       and which side of the sea it is on. */
    mesh.userData.body = {
      fresh: true,
      prev: new THREE.Vector3(), vel: new THREE.Vector3(), velPrev: new THREE.Vector3(),
      accel: 0, owed: 0, wet: 0,
      spring: new THREE.Vector3(), springVel: new THREE.Vector3(),
      roll: new THREE.Quaternion(), rollAxis: new THREE.Vector3(1, 0, 0),
      slosh: 0, sloshVel: 0
    };
    /* The frame the trace runs in is taken at draw time, from the matrix
       three is about to draw with — never a frame late, which during the
       logo's reveal (a new scale every frame) would slide the picture across
       the inside of the drop. */
    mesh.onBeforeRender = function () {
      this.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
      const u = this.material.uniforms;
      u.uCenter.value.copy(worldPosition);
      u.uRadius.value = worldScale.x;
      toLocal.makeRotationFromQuaternion(worldQuaternion).transpose();
      u.uToLocal.value.setFromMatrix4(toLocal);
    };
    return mesh;
  }
  for (let index = 0; index < LOGO_DROP_MAX; index++) {
    const mesh = makeDrop(index);
    group.add(mesh);
    meshes.push(mesh);
  }
  /* The core the converging drops fall into: plain water, no photograph. It
     swells as they arrive and breaks open as the mark forms. Not one of the
     drops, so none of their choreography touches it. */
  const core = makeDrop(LOGO_DROP_MAX);
  core.name = 'Water drop · the converging core';
  core.material.name = 'Water drop · core';
  core.material.uniforms.uDevelop.value = 0;
  group.add(core);

  /* ---- spray and loose beads ------------------------------------------ */
  /* One instanced body of water for all of them. Every instance is its own
     irregular little drop: the instance matrix carries where it is, which way
     it is flying and how far that draws it out; aBead carries its seed, its
     alpha, how lumpy it is and how much of a tear it trails. */
  const SPRAY_MAX = lite ? 160 : 300;
  const AMBIENT_MAX = lite ? 44 : 80;
  const BEADS = SPRAY_MAX + AMBIENT_MAX;
  const beadGeometry = weldedSphere(lite ? 2 : 3);
  const beadData = new Float32Array(BEADS * 4);
  const beadAttribute = new THREE.InstancedBufferAttribute(beadData, 4).setUsage(THREE.DynamicDrawUsage);
  beadGeometry.setAttribute('aBead', beadAttribute);
  const beadUniforms = {
    uSunDir: shared.uSunDir, uSunCol: shared.uSunCol, uEnv: shared.uEnv, uEnvStudio: shared.uEnvStudio,
    uRoomTop: shared.uRoomTop, uRoomHorizon: shared.uRoomHorizon, uRoomLower: shared.uRoomLower,
    uRoomInk: shared.uRoomInk, uRoomCore: shared.uRoomCore,
    uTime: { value: 0 }, uBeadWobble: { value: 1 },
    uIor: { value: 1.333 }, uReflect: { value: 1 }, uSpec: { value: 1 }, uRim: { value: .55 },
    uCaustic: { value: .5 }, uAbsorb: { value: .2 }
  };
  const beadMaterial = new THREE.ShaderMaterial({
    name: 'Water drops · spray and loose beads',
    uniforms: beadUniforms,
    transparent: true, depthWrite: true,
    vertexShader: /* glsl */`
      attribute vec4 aBead;
      uniform float uTime,uBeadWobble;
      varying vec3 vWorld,vNormalW,vCenter;
      varying mat3 vInv;
      varying float vAlpha;
      ${NOISE_GLSL}
      /* Lumps at the scale of the bead itself — two octaves, the second
         weak — so it reads as a small body of water that has not yet pulled
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
        gl_Position=projectionMatrix*viewMatrix*vec4(w0,1.);
      }
    `,
    fragmentShader: /* glsl */`
      uniform samplerCube uEnv;
      uniform float uIor,uReflect,uSpec,uRim,uCaustic,uAbsorb,uEnvStudio;
      varying vec3 vWorld,vNormalW,vCenter;
      varying mat3 vInv;
      varying float vAlpha;
      ${ROOM_GLSL}
      /* The big drops' trace without the photograph: in at the true surface,
         across the (stretched) sphere, out through the back into the room —
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
        vec3 col=roomEnv(normalize(o))*exp(-vec3(.20,.075,.018)*uAbsorb*s);
        col=mix(col,col*mix(vec3(1.),uRoomInk*1.35,.72),pow(1.-NdV,3.)*uRim);
        float crescent=pow(max(dot(N,-uSunDir),0.),3.)*pow(1.-NdV,1.2);
        col+=uSunCol*crescent*uCaustic*.6;
        vec3 R=reflect(V,N);
        float fresnel=.02+.98*pow(1.-NdV,5.);
        col=mix(col,roomEnv(R),clamp(fresnel*uReflect,0.,1.));
        col+=textureCubeLodEXT(uEnv,R,.6).rgb*uEnvStudio*(.08+fresnel)*uSpec*1.6;
        vec3 H=normalize(uSunDir-V);
        float nh=max(dot(N,H),0.);
        col+=uSunCol*(pow(nh,500.)*2.4+pow(nh,50.)*.12)*uSpec;
        gl_FragColor=vec4(col,vAlpha);
      }
    `
  });
  const beads = new THREE.InstancedMesh(beadGeometry, beadMaterial, BEADS);
  beads.name = 'Water drops · spray and loose beads';
  beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  beads.count = 0;
  beads.frustumCulled = false;
  /* Before the drops, writing depth: a bead in front of a drop keeps its
     place whether or not the drop writes depth itself, and one behind it is
     covered. Before the logo glass, so the glass bends them too. */
  beads.renderOrder = 3.9;
  group.add(beads);

  /* The spray: a ring buffer of droplets in the ring's own units. */
  const sprayPos = new Float32Array(SPRAY_MAX * 3), sprayVel = new Float32Array(SPRAY_MAX * 3);
  const sprayLife = new Float32Array(SPRAY_MAX), sprayMax = new Float32Array(SPRAY_MAX), spraySize = new Float32Array(SPRAY_MAX);
  const sprayLump = new Float32Array(SPRAY_MAX), spraySeed = new Float32Array(SPRAY_MAX);
  let sprayNext = 0;
  /* The loose beads: a fixed, seeded layout, so the air is the same on
     every visit — spread through the frame around the mark, most of them
     fine, a few large enough to show their shape, a few on the lens side of
     the ring. */
  let seedState = 0x9e3779b9;
  const seeded = () => { seedState = (seedState * 1664525 + 1013904223) >>> 0; return seedState / 4294967296; };
  const ambient = Array.from({ length: AMBIENT_MAX }, () => {
    const kind = seeded();
    const large = kind > .88, medium = kind > .66 && !large;
    const near = seeded() < .12;
    /* Even over the disc, not bunched at the axis. */
    const rho = near ? 1.25 + seeded() * .4 : .3 + Math.sqrt(seeded()) * 1.25;
    const theta = near ? (seeded() - .5) * 1.2 : seeded() * Math.PI * 2;
    const squash = .7 + seeded() * .7;
    const axis = new THREE.Vector3(seeded() - .5, seeded() - .5, seeded() - .5);
    if (axis.lengthSq() < 1e-4) axis.set(0, 1, 0);
    axis.normalize();
    return {
      theta, rho,
      y: -.82 + seeded() * 1.55,
      size: large ? .03 + seeded() * .016 : medium ? .015 + seeded() * .012 : .005 + Math.pow(seeded(), 1.4) * .01,
      squash: [1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash)],
      axis, spinRate: (seeded() - .5) * .9, tumble: seeded() * Math.PI * 2,
      lump: .65 + seeded() * .8,
      seed: seeded(),
      phase: seeded() * Math.PI * 2,
      bob: .5 + seeded() * .9,
      swirl: (seeded() - .5) * .08,
      /* For the lunge: where along the stream this bead starts. */
      lane: seeded(),
      order: seeded()
    };
  });
  const randomUnit = (out) => {
    const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    return out.set(Math.cos(a) * s, z, Math.sin(a) * s);
  };
  const scatter = new THREE.Vector3(), trail = new THREE.Vector3(), ambientPos = new THREE.Vector3();

  /* Where each drop goes in the lunge and the bloom, and in what order —
     composed once per count. Lanes and places go round the axis by the
     golden angle, so any number of them spreads evenly with no two
     neighbours alike; the orders are shuffled the same way, so the drops
     that go one after another are never next to each other. */
  const layouts = new Map();
  function layoutFor(count) {
    if (layouts.has(count)) return layouts.get(count);
    const lanes = [], places = [];
    for (let s = 0; s < count; s++) {
      const a = s * GOLDEN + .7;
      const r = .62 + .38 * fract(s * .618034 + .21);
      lanes.push({ x: Math.cos(a) * r * 1.3, y: Math.sin(a) * r * .78 });
      /* The constellation. The first eight are composed, place by place,
         for the sizes the rhythm gives them: the largest low and forward at
         the left, answered by a large one high on the right and another low
         on the right, the small ones deep in the gaps and past the ends of
         the wordmark — a loose oval that frames the word and never sits on
         its band. Past eight, the rest fill a wider shell round them by the
         golden angle, kept off the same band. */
      if (s < CONSTELLATION.length) places.push({ ...CONSTELLATION[s] });
      else {
        const b = s * GOLDEN + 2.1;
        const ring = .85 + .15 * fract(s * .618034 + .5);
        const x = Math.cos(b) * .8 * ring;
        let y = Math.sin(b) * .62 * ring;
        if (Math.abs(x) < .56 && Math.abs(y) < .3) y = (y < 0 ? -1 : 1) * (.3 + Math.abs(y) * .5);
        places.push({ x, y, z: -.2 + Math.sin(b * 1.7 + .6) * .45 });
      }
    }
    const rankBy = key => {
      const out = new Array(count);
      [...Array(count).keys()].sort((i, j) => key(i) - key(j)).forEach((slot, k) => { out[slot] = count > 1 ? k / (count - 1) : 1; });
      return out;
    };
    const layout = {
      lanes, places,
      lunge: rankBy(s => fract(s * .618034 + .37)),
      bloom: rankBy(s => fract(s * .381966 + .13)),
      /* The rain empties the frame from the bottom up: the lowest first, the
         highest — the longest fall — last. */
      rain: rankBy(s => places[s].y),
      /* The order the drops come back in, shuffled like the others. */
      enter: rankBy(s => fract(s * .618034 + .71))
    };
    layouts.set(count, layout);
    return layout;
  }

  function emit(mesh, C, radius, forward) {
    const body = mesh.userData.body, i = sprayNext;
    sprayNext = (sprayNext + 1) % SPRAY_MAX;
    const speed = body.vel.length();
    /* From the back of a moving drop — or, when it stops short, off the
       front, where the water it was carrying runs on. */
    if (speed > 1e-4) trail.copy(body.vel).divideScalar(speed); else trail.set(0, 1, 0);
    if (!forward) trail.negate();
    randomUnit(scatter);
    const direction = scatter.multiplyScalar(.55).add(trail).normalize();
    const o = i * 3;
    sprayPos[o] = mesh.position.x + direction.x * radius * .92;
    sprayPos[o + 1] = mesh.position.y + direction.y * radius * .92;
    sprayPos[o + 2] = mesh.position.z + direction.z * radius * .92;
    /* It keeps some of the drop's momentum and is thrown a little off it;
       drag then takes the rest, which is what lays the droplets out as a
       trail behind the drop instead of a cloud around it. */
    const keep = forward ? .9 + Math.random() * .25 : .45 + Math.random() * .35;
    const fling = (forward ? .35 : .18) * speed + .25;
    sprayVel[o] = body.vel.x * keep + direction.x * fling * Math.random();
    sprayVel[o + 1] = body.vel.y * keep + direction.y * fling * Math.random() + .18 * Math.random();
    sprayVel[o + 2] = body.vel.z * keep + direction.z * fling * Math.random();
    sprayMax[i] = sprayLife[i] = (.55 + Math.random() * .75) * Math.max(.1, C.sprayLife);
    /* Mostly fine, now and then one large enough to show its shape. */
    spraySize[i] = radius * (.035 + Math.pow(Math.random(), 2.4) * .11) * Math.max(.1, C.spraySize);
    sprayLump[i] = .8 + Math.random() * .7;
    spraySeed[i] = Math.random();
  }

  /* A strike on the sea: a crown thrown up and out round the point of entry,
     the column's worth of water leaving the surface as the drop goes in. */
  function crown(x, y, z, radius, C, strength) {
    const n = Math.round((8 + 14 * strength) * Math.max(.2, C.spray + .4));
    const reach = Math.sqrt(radius / .2);
    for (let k = 0; k < n; k++) {
      const i = sprayNext, o = i * 3;
      sprayNext = (sprayNext + 1) % SPRAY_MAX;
      /* Round the rim of the hole the drop makes: most of the crown low and
         wide, hugging the water, and one in five a jet that goes higher. */
      const a = Math.random() * Math.PI * 2, out = radius * (.8 + Math.random() * .35);
      sprayPos[o] = x + Math.cos(a) * out;
      sprayPos[o + 1] = y + radius * .04;
      sprayPos[o + 2] = z + Math.sin(a) * out;
      const jet = Math.random() < .2 ? 1.7 : 1;
      const up = (.3 + Math.random() * .55) * jet * reach * strength, side = (.45 + Math.random() * .6) * reach * strength / jet;
      sprayVel[o] = Math.cos(a) * side;
      sprayVel[o + 1] = up;
      sprayVel[o + 2] = Math.sin(a) * side;
      sprayMax[i] = sprayLife[i] = (.45 + Math.random() * .55) * Math.max(.1, C.sprayLife);
      spraySize[i] = radius * (.05 + Math.pow(Math.random(), 2) * .12) * Math.max(.1, C.spraySize);
      sprayLump[i] = .8 + Math.random() * .7;
      spraySeed[i] = Math.random();
    }
  }

  function stepSpray(dt) {
    const drag = Math.exp(-dt * 2.6);
    for (let i = 0; i < SPRAY_MAX; i++) {
      if (sprayLife[i] <= 0) continue;
      sprayLife[i] -= dt;
      const o = i * 3;
      sprayVel[o] *= drag; sprayVel[o + 2] *= drag;
      sprayVel[o + 1] = sprayVel[o + 1] * drag - 2.6 * dt;
      sprayPos[o] += sprayVel[o] * dt;
      sprayPos[o + 1] += sprayVel[o + 1] * dt;
      sprayPos[o + 2] += sprayVel[o + 2] * dt;
    }
  }

  const loader = new THREE.TextureLoader();
  let ready = null, disposed = false;
  function loadAssets() {
    if (disposed) return Promise.resolve([]);
    if (ready) return ready;
    ready = Promise.all(PHOTOS.map(([file], photo) => new Promise(resolve => {
    loader.load('./slide-assets/' + file, texture => {
      if (disposed) { texture.dispose(); resolve(false); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      textures.push(texture);
      const aspect = texture.image.width / texture.image.height;
      /* One texture per photograph, shared by every drop that shows it. */
      for (const mesh of meshes) {
        if (mesh.userData.photo !== photo) continue;
        mesh.material.uniforms.uPhoto.value = texture;
        mesh.userData.aspect = aspect;
      }
      resolve(true);
    }, undefined, error => { console.warn('Logo drop photo unavailable:', file, error); resolve(false); });
  })));
    return ready;
  }
  if (!deferTextures) loadAssets();

  const tilt = new THREE.Euler(), orientation = new THREE.Quaternion();
  const own = new THREE.Euler(0, 0, 0, 'YXZ'), ownQuaternion = new THREE.Quaternion();
  const velocity = new THREE.Vector3(), accel = new THREE.Vector3(), drive = new THREE.Vector3();
  const radial = new THREE.Vector3(), axis = new THREE.Vector3(), step = new THREE.Quaternion();
  const inverse = new THREE.Quaternion(), noiseFrame = new THREE.Quaternion(), local = new THREE.Vector3();
  const matrix = new THREE.Matrix4(), facing = new THREE.Matrix4();
  const viewPoint = new THREE.Vector3(), upView = new THREE.Vector3(), cameraLocal = new THREE.Vector3(), groupScale = new THREE.Vector3();
  const groupPosition = new THREE.Vector3(), splashPoint = new THREE.Vector3(), turnAxis = new THREE.Vector3(0, 1, 0);
  const lensAxis = new THREE.Vector3(0, 0, 1), lensRight = new THREE.Vector3(1, 0, 0), lensUp = new THREE.Vector3(0, 1, 0);
  const rayOrigin = new THREE.Vector3(), rayDirection = new THREE.Vector3(), groupInverse = new THREE.Matrix4(), placeLocal = new THREE.Vector3();
  const fallTarget = new THREE.Vector3();
  const beadMatrix = new THREE.Matrix4(), beadQuaternion = new THREE.Quaternion(), beadScale = new THREE.Vector3();
  const beadPosition = new THREE.Vector3(), flight = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  let lastTime = null, autoAngle = 0, lastCount = -1, lastMode = -1, lastProgress = null, progressRate = 0;
  /* Read by the page each frame: PULSE is the flash of the converging drops
     meeting (0–1), ENTERING whether the entrance is playing. */
  const state = { pulse: 0, entering: false, core: 0 };
  const entranceTarget = new THREE.Vector3(), entranceOrigin = new THREE.Vector3(), entranceCore = new THREE.Vector3(0, 0, -.35);

  /* The camera's view of the ring, once a frame, for everything that has to
     leave the frame: how far a point in the ring has to rise, or fall, to
     clear an edge of it — and where the lens is, for the drops that face it
     and the beads that must not fill it. */
  /* FRAME is the frame's half-width and half-height, in ring units, at the
     distance of the mark; LOGO the mark's centre on the screen. Anything
     composed on the screen is composed in these. */
  const clearance = { on: false, f: 1, scale: 1, camera: null, frameW: 2, frameH: 1.25, logoX: 0, logoY: 0 };
  function prepareClearance(camera) {
    clearance.on = Boolean(camera?.isPerspectiveCamera);
    group.updateWorldMatrix(true, false);
    group.getWorldScale(groupScale);
    group.getWorldPosition(groupPosition);
    clearance.scale = Math.max(1e-6, groupScale.y);
    groupInverse.copy(group.matrixWorld).invert();
    if (!clearance.on) { cameraLocal.set(0, 0, 4.75); clearance.frameW = 2; clearance.frameH = 1.25; clearance.logoX = clearance.logoY = 0; return; }
    clearance.f = camera.projectionMatrix.elements[5];
    clearance.camera = camera;
    upView.copy(UP).transformDirection(group.matrixWorld).transformDirection(camera.matrixWorldInverse);
    cameraLocal.setFromMatrixPosition(camera.matrixWorld);
    group.worldToLocal(cameraLocal);
    clearance.frameH = cameraLocal.length() / clearance.f;
    clearance.frameW = clearance.frameH * camera.aspect;
    viewPoint.copy(groupPosition).project(camera);
    clearance.logoX = viewPoint.x;
    clearance.logoY = viewPoint.y;
  }
  /* The point in the ring at depth Z (ring units, toward the lens) that the
     camera sees at screen position (NX, NY). */
  function screenRay(nx, ny) {
    const camera = clearance.camera;
    rayOrigin.setFromMatrixPosition(camera.matrixWorld);
    rayDirection.set(nx, ny, .5).unproject(camera).sub(rayOrigin);
    rayOrigin.applyMatrix4(groupInverse);
    rayDirection.transformDirection(groupInverse);
  }
  function screenToLocal(nx, ny, z, out) {
    if (!clearance.on) return out.set(nx * clearance.frameW, ny * clearance.frameH, z);
    screenRay(nx, ny);
    const along = Math.abs(rayDirection.z) > 1e-4 ? rayDirection.z : -1e-4;
    return out.copy(rayOrigin).addScaledVector(rayDirection, (z - rayOrigin.z) / along);
  }
  /* Where the camera's ray through (NX, NY) meets the level Y — the sea —
     or null when that ray never comes down to it. */
  function screenToLevel(nx, ny, y, out) {
    if (!clearance.on) return null;
    screenRay(nx, ny);
    if (rayDirection.y > -1e-3) return null;
    return out.copy(rayOrigin).addScaledVector(rayDirection, (y - rayOrigin.y) / rayDirection.y);
  }
  /* The distance, in ring units, that takes a drop of RADIUS at LOCAL just
     past the top edge of the frame (SIGN 1) or the bottom (SIGN -1): solve
     for the travel along the ring's up that puts the drop's far side on the
     edge, in the camera's own projection. */
  function travelToClear(localPoint, radius, sign) {
    if (!clearance.on) return Math.max(0, sign > 0 ? 1.3 - localPoint.y : localPoint.y + 1.3);
    viewPoint.copy(localPoint).applyMatrix4(group.matrixWorld).applyMatrix4(clearance.camera.matrixWorldInverse);
    const depth = Math.max(.05, -viewPoint.z), f = clearance.f;
    const edge = 1 + 1.6 * f * radius * clearance.scale / depth + .04;
    const denominator = f * upView.y + sign * edge * upView.z;
    if (denominator < .05) return 3;
    return Math.max(0, (edge * depth - sign * f * viewPoint.y) / denominator / clearance.scale);
  }

  /* One drop's liquid body for one step. Everything is measured in the
     ring's own units, where the drop's radius is SIZE × its rhythm, so the
     numbers mean the same thing at any logo height or zoom. */
  function stepBody(mesh, dt, C, reducedMotion, rel) {
    const body = mesh.userData.body;
    if (body.fresh || dt <= 0) {
      body.prev.copy(mesh.position);
      body.fresh = false;
      body.vel.set(0, 0, 0); body.velPrev.set(0, 0, 0);
      body.spring.set(0, 0, 0); body.springVel.set(0, 0, 0);
      body.slosh = 0; body.sloshVel = 0; body.accel = 0; body.owed = 0;
      return;
    }
    /* A jump no scroll could make — a chapter skipped from the menu, a
       slider dragged — is a new start, not a blow the water has to take. */
    if (mesh.position.distanceToSquared(body.prev) > 1.44) {
      body.fresh = true;
      stepBody(mesh, 0, C, reducedMotion, rel);
      return;
    }
    /* Velocity, lightly smoothed: the scroll is already eased, this only
       takes the frame-to-frame jitter out of the difference. */
    velocity.subVectors(mesh.position, body.prev).divideScalar(dt);
    if (velocity.length() > 60) velocity.setLength(60);
    body.prev.copy(mesh.position);
    body.vel.lerp(velocity, 1 - Math.exp(-dt * 22));
    accel.subVectors(body.vel, body.velPrev).divideScalar(dt);
    if (accel.length() > 400) accel.setLength(400);
    body.velPrev.copy(body.vel);
    /* Signed along the travel: negative is braking, which is what flings
       the water on ahead. */
    const speed = body.vel.length();
    body.accel = speed > 1e-4 ? accel.dot(body.vel) / speed : 0;
    if (reducedMotion) {
      body.spring.set(0, 0, 0); body.springVel.set(0, 0, 0);
      body.slosh = 0; body.sloshVel = 0;
      return;
    }
    /* The inertial spring. The water is driven against the acceleration —
       left behind when the drop starts, thrown ahead when it stops — and
       rings down at JIGGLE with DAMPING. Semi-implicit, and sub-stepped, so
       a stiff spring stays stable at any frame rate.
       A drop's own ringing goes as the inverse three-halves power of its
       radius (Rayleigh: surface tension against the mass it has to move),
       so a small bead shivers quickly and a large one sways. Softened to
       three-quarters here, so the spread reads as weight and not as two
       different materials. */
    const omega = Math.max(.5, C.jiggle * Math.pow(rel, -.75)), zeta = Math.max(0, C.damping);
    const k = omega * omega, c = 2 * zeta * omega;
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    /* Calibrated against the page's own scroll: a wheel notch starts the
       ring at about 50 units/s² and runs it near 5 units/s, which at this
       gain rings the spring out to about a quarter of a drop radius — liquid
       that is clearly thrown, never pinned against LIMIT. */
    drive.copy(accel).multiplyScalar(-C.inertia * .0012);
    for (let i = 0; i < steps; i++) {
      body.springVel.addScaledVector(body.spring, -k * h);
      body.springVel.addScaledVector(body.springVel, -c * h);
      body.springVel.addScaledVector(drive, k * h);
      body.spring.addScaledVector(body.springVel, h);
    }
    if (body.spring.length() > C.limit) { body.spring.setLength(C.limit); body.springVel.multiplyScalar(.5); }
    /* Rolling: as if on the outside of a cylinder round the axis, about the
       axis across the direction of travel. A smaller drop turns over faster
       for the same travel, as a wheel does. */
    radial.set(mesh.position.x, 0, mesh.position.z);
    if (radial.lengthSq() < 1e-8) radial.set(0, 0, 1);
    radial.normalize();
    if (speed > 1e-4) {
      axis.crossVectors(radial, body.vel);
      if (axis.lengthSq() < 1e-8) axis.crossVectors(UP, body.vel);
      if (axis.lengthSq() > 1e-8) body.rollAxis.copy(axis.normalize());
      step.setFromAxisAngle(body.rollAxis, speed / Math.max(.02, C.size * rel) * C.roll * dt);
      body.roll.premultiply(step).normalize();
    }
    /* The slosh: the picture tips with the flow and swings back upright —
       about 18 degrees at a brisk scroll, legible throughout. */
    const target = THREE.MathUtils.clamp(speed * .06 * C.slosh, -.45, .45);
    const so = 6.5, sz = .32;
    body.sloshVel += (so * so * (target - body.slosh) - 2 * sz * so * body.sloshVel) * dt;
    body.slosh += body.sloshVel * dt;
  }

  /* The easing the choreographies are built from. */
  const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);
  const clamp01 = x => Math.min(1, Math.max(0, x));
  /* Out with an overshoot of about a tenth, then back: arriving, not
     stopping. */
  const easeOutBack = (e, s = 1.4) => 1 + (s + 1) * Math.pow(e - 1, 3) + s * Math.pow(e - 1, 2);
  const easeOutCubic = e => 1 - Math.pow(1 - e, 3);

  /* ENTER is the chapter's progress without the clamp: below 0 is the stretch
     before the chapter, where the entrance plays. PROGRESS stays clamped, so
     every choreography holds its opening pose while the drops arrive into it. */
  function update({ progress = 0, enter = progress, reveal = 1, exit = 0, time = 0, reducedMotion = false, palette, mobile = false, camera = null, seaLevel = 0 } = {}) {
    const C = config;
    const dt = lastTime === null ? 0 : Math.min(.05, Math.max(0, time - lastTime));
    lastTime = time;
    if (!reducedMotion) autoAngle = (autoAngle + dt * C.autoSpeed) % (Math.PI * 2);
    /* How fast the chapter is being scrolled, for the air in the lunge. */
    if (lastProgress !== null && dt > 0) progressRate += ((progress - lastProgress) / dt - progressRate) * (1 - Math.exp(-dt * 10));
    lastProgress = progress;
    /* With an entrance chosen the drops answer to it, not to the mark's own
       fade: present from the moment the first one sets off. */
    const entranceMode = THREE.MathUtils.clamp(Math.round(C.entrance), 0, 2);
    const entering = entranceMode > 0 && enter < 0 && !reducedMotion;
    const presence = entranceMode > 0 ? (enter > C.enterStart ? 1 : 0) : reveal;
    state.pulse = 0;
    state.entering = entering;
    const fade = presence * (1 - exit) * C.opacity;
    const wasVisible = group.visible;
    group.visible = C.enabled > .5 && fade > .001;
    if (!group.visible) {
      /* Out of view the air clears: spray does not hang waiting for the
         drops to come back. */
      if (wasVisible) { sprayLife.fill(0); beads.count = 0; }
      return;
    }
    loadAssets();
    const count = THREE.MathUtils.clamp(Math.round(C.count), 1, LOGO_DROP_MAX);
    const mode = THREE.MathUtils.clamp(Math.round(C.mode), 0, 2);
    /* Coming back into view, changing how many drops there are or how they
       move, is not a jump: each body starts from rest where its drop now
       is, and the old mode's spray is cleared. */
    if (!wasVisible || count !== lastCount || mode !== lastMode) {
      for (const mesh of meshes) mesh.userData.body.fresh = true;
      if (mode !== lastMode) sprayLife.fill(0);
    }
    lastCount = count;
    lastMode = mode;
    group.scale.setScalar(mobile ? C.mobileScale : 1);
    prepareClearance(camera);
    tilt.set(THREE.MathUtils.degToRad(C.tiltX), 0, THREE.MathUtils.degToRad(C.tiltZ));
    orientation.setFromEuler(tilt);
    const phase = THREE.MathUtils.degToRad(C.phase), spin = phase - progress * C.turns * Math.PI * 2;
    const centering = C.pitch * (phase - Math.PI * C.turns) + C.offsetY;
    /* The helix keeps its length whatever the count: SPACING is the gap at
       eight, and more drops share the same run. */
    const spacing = C.spacing * 8 / count;
    const layout = layoutFor(count);
    /* The sea, in the ring's own units. */
    const seaY = (seaLevel - groupPosition.y) / clearance.scale;
    shared.uFuse.value.set(THREE.MathUtils.lerp(.96, .12, clamp01(C.fuse)), 1);
    if (palette) {
      shared.uRoomTop.value.set(palette.top ?? '#92a8cd');
      shared.uRoomHorizon.value.set(palette.horizon ?? '#e6edf7');
      shared.uRoomLower.value.set(palette.lower ?? '#c9d5e8');
      shared.uRoomInk.value.set(palette.ink ?? '#3f5a7e');
      shared.uRoomCore.value.set(palette.horizon ?? '#e6edf7').multiplyScalar(Math.max(0, (palette.core ?? 1.5) * C.glow));
    }
    /* Cover, never contain: the photograph's short side spans the drop at
       ZOOM 1 and only grows from there. */
    const zoom = Math.max(1, C.zoom);
    const size = Math.max(.02, C.size);
    const sizeVar = THREE.MathUtils.clamp(C.sizeVar, 0, 1.5);
    const motion = reducedMotion ? 0 : 1;
    /* Motion blur, and the drawing it needs: a blurred drop is partly
       transparent all round its edge, so it must not write depth there — it
       is drawn sorted instead, before the logo glass when it is behind the
       mark and after it when it is in front. */
    const blurring = (mode !== 0 || C.blurSpiral > .5 || entering) && C.blur > .001 && !reducedMotion;
    const logoDistance = cameraLocal.length();
    /* The lens's axis through the mark, and the plane across it: the lunge
       and its stream of air run along it. */
    lensAxis.copy(cameraLocal).normalize();
    lensRight.crossVectors(UP, lensAxis);
    if (lensRight.lengthSq() < 1e-6) lensRight.set(1, 0, 0);
    lensRight.normalize();
    lensUp.crossVectors(lensAxis, lensRight);
    const leaveWindow = Math.max(.02, C.leaveEnd - C.leaveStart);
    const leaveClimb = THREE.MathUtils.clamp(C.leaveClimb, .02, leaveWindow);
    const lungeWindow = Math.max(.02, C.lungeEnd - C.lungeStart);
    const lungeFlight = THREE.MathUtils.clamp(C.lungeFlight, .04, lungeWindow);
    const rainWindow = Math.max(.02, C.rainEnd - C.rainStart);
    const rainFall = THREE.MathUtils.clamp(C.rainFall, .04, rainWindow);
    const hangSpan = Math.max(.05, C.rainStart - C.bloomAt - C.bloomTime);
    /* The constellation turns slowly in the picture plane, round the lens's own axis
       through the mark — a swirl that never pulls a drop back from the lens — and keeps
       turning at the same rate rather than coming to rest. */
    const bloomTurn = THREE.MathUtils.degToRad(C.bloomTurn) * Math.max(0, (progress - C.bloomAt - C.bloomTime * .5) / hangSpan);
    /* How many drops' worth of water the converging core holds. */
    let absorbed = 0;

    for (const mesh of meshes) {
      const slot = mesh.userData.slot, body = mesh.userData.body;
      if (slot >= count) { mesh.visible = false; body.fresh = true; continue; }
      /* This drop's size against the mean, and the share of the liquid
         physics that follows from it: a large drop deforms a little more
         and squirms a little slower, a small one holds its shape. */
      const rel = Math.max(.25, 1 + (SIZE_RHYTHM[slot % SIZE_RHYTHM.length] - 1) * sizeVar);
      const give = Math.pow(rel, .35);
      const radiusNow = size * rel;
      let gone = false, vanish = 0, grow = 1, faceLens = true, falling = false, develop = 1, entryAlpha = 1;

      if (mode === 0) {
        /* ---- SPIRAL ---- */
        let departed = 0;
        if (C.leave > .5) {
          const rank = count > 1 ? slot / (count - 1) : 1;
          departed = clamp01((progress - C.leaveStart - rank * (leaveWindow - leaveClimb)) / leaveClimb);
        }
        if (departed >= 1) gone = true;
        else {
          /* From rest, and leaving fast: the rise goes as the square, so the
             drop eases off the ring and is travelling hardest as it goes. */
          const rise = departed * departed, onward = Math.pow(departed, 1.5);
          const frac = count > 1 ? slot / (count - 1) : .5;
          const radius = C.radius * (1 - C.tailTaper + frac * C.tailTaper) * THREE.MathUtils.lerp(1, C.leaveRadius, rise);
          const pathAngle = (slot - (count - 1) / 2) * spacing + spin - C.leaveSpin * Math.PI * 2 * onward;
          const angle = pathAngle + autoAngle;
          mesh.position.set(
            Math.sin(angle) * radius,
            -C.pitch * pathAngle + C.wave * Math.sin(pathAngle * 1.6),
            Math.cos(angle) * radius - C.tailDepth * (1 - frac)
          );
          mesh.position.applyQuaternion(orientation);
          mesh.position.y += centering;
          if (rise > 0) mesh.position.y += travelToClear(mesh.position, radiusNow * 1.4, 1) * C.leaveRise * rise;
          vanish = departed;
          /* Facing outward as its card would. */
          own.set(0, angle, 0);
          ownQuaternion.setFromEuler(own);
          mesh.quaternion.copy(orientation).multiply(ownQuaternion);
          faceLens = false;
        }
      } else if (mode === 1) {
        /* ---- LUNGE ---- The drop waits far behind the mark; at its turn it
           crouches back (the dip of an ease-in-back) and then throws itself
           at the lens along a straight line that opens outward. The lines
           all run along the lens's own axis through the mark, so the mark is
           their vanishing point: on screen every drop comes straight out
           from behind the wordmark, accelerating, and leaves by the edge of
           the frame before it could reach the lens. */
        const lane = layout.lanes[slot];
        const e = clamp01((progress - C.lungeStart - layout.lunge[slot] * (lungeWindow - lungeFlight)) / lungeFlight);
        if (e >= 1) gone = true;
        else {
          /* No drop ever stands still: from the first moment every one is
             already drifting in toward the lens (LUNGE DRIFT of the way over
             the whole chapter), and at its turn it accelerates out of that
             drift — from the drift's own speed, faster all the way, the
             power LUNGE CURVE — so the leap grows out of a motion that was
             already there. LUNGE RECOIL above 0 puts back a crouch. */
          const k = 1.70158 * Math.max(0, C.lungeRecoil);
          const leap = k > 0 ? (k + 1) * e * e * e - k * e * e : Math.pow(e, Math.max(1, C.lungeCurve));
          /* On the unclamped clock, so the drift is already running while
             the drops are still arriving: the entrance lands them on a mark
             that is moving, and they carry that motion on through the start
             of the chapter instead of stopping on it. */
          const creep = Math.max(-.2, Math.min(.9, Math.max(0, C.lungeDrift) * enter * motion));
          const travel = creep + (1 - creep) * leap;
          const sFar = -Math.max(1, C.lungeDepth), sNear = logoDistance - .2;
          const spread = Math.max(.1, C.lungeSpread);
          /* Waiting, they ring the wordmark in the distance — above it,
             below it, past its ends — not on top of it. */
          const lateral = 2.3 * spread + (.1 * spread + .35) * travel;
          const idle = motion * (1 - smooth(e, 0, .3));
          mesh.position.copy(lensAxis).multiplyScalar(sFar + (sNear - sFar) * travel)
            .addScaledVector(lensRight, lane.x * lateral + Math.cos(time * .5 + slot * 2.1) * .05 * idle)
            .addScaledVector(lensUp, lane.y * lateral + Math.sin(time * .7 + slot * 1.3) * .06 * idle);
          vanish = e;
          /* Nothing may reach the lens. */
          if (mesh.position.distanceTo(cameraLocal) < radiusNow * 1.6) gone = true;
        }
      } else {
        /* ---- BLOOM ---- Gathered small behind the mark; burst out along a
           curve toward a place in the constellation — and never stop there:
           the burst eases off exponentially into a slow drift that keeps the
           figure opening and coming toward the lens while it turns, until
           each drop in its turn accelerates away out of that drift. */
        const spot = layout.places[slot];
        const tau = Math.max(0, (progress - C.bloomAt - layout.bloom[slot] * .07) / Math.max(.02, C.bloomTime));
        const e = Math.min(1, tau);
        /* Fast out, easing — but only ever easing, never arriving: 96% of
           the way at the end of BLOOM TIME, and then cruising on at a
           steady pace: a little further out along its own line, and mostly
           in toward the lens, so the whole figure keeps coming at us while
           it turns. The forward drift is kept well above what the turn can
           take back — where the two were close, a drop on the right of the
           figure stood still between them — and the outward share is kept
           small, or the outer drops leave the frame before their turn. */
        const drift = Math.max(0, C.bloomDrift) * Math.max(0, tau - .35) * motion;
        const out = 1 - Math.exp(-3.2 * tau) + drift * .06;
        /* Its place, composed on the screen round the wordmark and set at
           its depth. */
        screenToLocal(clearance.logoX + spot.x * C.bloomSpread, clearance.logoY + spot.y * C.bloomSpread, spot.z * C.bloomDepth, placeLocal);
        /* The burst leaves the mark on a curve, not a line: it swings out
           toward the lens on the way, so the bloom opens toward the viewer. */
        const swing = Math.sin(Math.PI * e) * .55 * C.bloomDepth;
        mesh.position.set(
          placeLocal.x * out + Math.sin(slot * 1.7) * .03 * (1 - Math.min(1, out)),
          placeLocal.y * out + Math.cos(slot * 2.3) * .03 * (1 - Math.min(1, out)),
          -.35 + (placeLocal.z + .35) * out + swing
        );
        mesh.position.applyAxisAngle(lensAxis, bloomTurn);
        /* ...and drifting in toward the lens the whole while. */
        mesh.position.addScaledVector(lensAxis, drift * .35);
        const hang = motion * smooth(e, .6, 1);
        mesh.position.x += Math.cos(time * .6 + slot * 1.1) * .012 * hang;
        mesh.position.y += Math.sin(time * .8 + slot * 1.7) * .02 * hang;
        grow = .28 + .72 * easeOutCubic(e);
        /* The exit from the hang, one drop after another: POUNCE (the
           lunge's own leap, taken from where the drop hangs) or RAIN into
           the sea. */
        const rainOut = C.bloomEnd > .5;
        const r = clamp01((progress - C.rainStart - (rainOut ? layout.rain : layout.lunge)[slot] * (rainWindow - rainFall)) / rainFall);
        if (r >= 1) gone = true;
        else if (r > 0 && !rainOut) {
          /* POUNCE. No crouch: it simply lets go of its place and runs at the
             lens, from rest and faster all the way (POUNCE CURVE is the
             power: 2 is an even acceleration), along a straight line that
             opens outward as the lunge's drops do, so it streams out past
             the edge of the frame instead of reaching the glass. */
          const travel = Math.pow(r, Math.max(1, C.pounceCurve));
          const s0 = mesh.position.dot(lensAxis), x0 = mesh.position.dot(lensRight), y0 = mesh.position.dot(lensUp);
          const open = 1 + 1.2 * travel + .35 * travel / Math.max(.05, Math.hypot(x0, y0));
          mesh.position.copy(lensAxis).multiplyScalar(s0 + (logoDistance - .2 - s0) * travel)
            .addScaledVector(lensRight, x0 * open)
            .addScaledVector(lensUp, y0 * open);
          vanish = r;
          /* Nothing may reach the lens. */
          if (mesh.position.distanceTo(cameraLocal) < radiusNow * 1.6) gone = true;
        } else if (r > 0) {
          /* It falls toward the lens as it falls, and lands where the sea
             actually shows — the strip of chrome water across the foot of
             the frame, RAIN LAND up from the bottom edge — not behind the
             mark, where the water has long since faded into the room. Down
             as the square of time, as a thing let go does, and on under the
             surface, which hides it. */
          const fall = r * r;
          viewPoint.copy(mesh.position).applyMatrix4(group.matrixWorld);
          const landing = clearance.on
            ? screenToLevel(THREE.MathUtils.clamp(viewPoint.project(clearance.camera).x * 1.06, -.92, .92), C.rainLand, seaY, fallTarget)
            : null;
          if (landing) {
            /* Onto the water at the landing point — it must strike there,
               not somewhere short of it where the sea no longer shows —
               and then straight down under it. */
            mesh.position.lerp(fallTarget, Math.min(1, fall / .8));
            mesh.position.y -= Math.max(0, (fall - .8) / .2) * radiusNow * 2.8;
          } else {
            const below = Math.max(travelToClear(mesh.position, radiusNow * 1.2, -1), mesh.position.y - seaY + radiusNow * 2.2);
            mesh.position.y -= below * 1.08 * fall;
          }
          falling = true;
          vanish = Math.max(0, (r - .97) / .03);
        }
      }

      /* ---- ENTRANCE ---- The pose above is where this drop has to be when
         the chapter begins. Before that, it is on its way there. */
      if (entering && !gone) {
        const start = Math.min(-.02, C.enterStart + layout.enter[slot] * Math.max(0, C.enterStagger));
        const e = clamp01((enter - start) / -start);
        if (e <= 0) gone = true;
        else {
          entranceTarget.copy(mesh.position);
          /* It comes in from the side of the frame its place is on, seen
             from the mark, so the drops close in on the mark from all round
             it rather than all from one quarter. */
          viewPoint.copy(entranceTarget).applyMatrix4(group.matrixWorld);
          if (clearance.on) viewPoint.project(clearance.camera);
          else viewPoint.set(entranceTarget.x / clearance.frameW, entranceTarget.y / clearance.frameH, 0);
          let dx = viewPoint.x - clearance.logoX, dy = viewPoint.y - clearance.logoY;
          if (Math.hypot(dx, dy) < .05) { dx = Math.cos(slot * GOLDEN); dy = Math.sin(slot * GOLDEN); }
          const reach = 1.3 / Math.max(Math.abs(dx), Math.abs(dy));
          const nx = clearance.logoX + dx * reach, ny = clearance.logoY + dy * reach;
          const targetGrow = grow;
          if (entranceMode === 1) {
            /* RETURN. From just past the edge of the frame, close to the lens
               — the water the burst threw past us — in along a line that
               curls round the lens's axis and unwinds as it arrives: fast in,
               slow to settle, so it lands in its place instead of stopping
               there. */
            if (clearance.on) { screenRay(nx, ny); entranceOrigin.copy(rayOrigin).addScaledVector(rayDirection, logoDistance * .45); }
            else entranceOrigin.set(nx * clearance.frameW, ny * clearance.frameH, 3);
            entranceOrigin.y = Math.max(entranceOrigin.y, seaY + .35);
            const u = 1 - Math.pow(1 - e, 3);
            mesh.position.lerpVectors(entranceOrigin, entranceTarget, u);
            step.setFromAxisAngle(lensAxis, C.enterSwirl * Math.PI * Math.pow(1 - u, 2));
            mesh.position.applyQuaternion(step);
            grow = THREE.MathUtils.lerp(1, targetGrow, u);
            develop = smooth(u, C.develop, 1);
            entryAlpha = smooth(e, 0, .06);
          } else {
            /* CONVERGE. Drawn in from beyond the edge, at the mark's own
               depth, faster and faster, winding round the axis and shrinking
               as it falls into the point just behind the mark; they meet at
               ENTER MERGE in a flash as the mark forms, and are thrown back
               out to their places, overshooting a little. */
            const merge = Math.min(-.01, Math.max(start + .02, C.enterMerge));
            if (enter < merge) {
              const a = clamp01((enter - start) / (merge - start)), u = a * a;
              screenToLocal(nx, ny, 0, entranceOrigin);
              entranceOrigin.y = Math.max(entranceOrigin.y, seaY + .35);
              mesh.position.lerpVectors(entranceOrigin, entranceCore, u);
              step.setFromAxisAngle(lensAxis, C.enterSwirl * Math.PI * u);
              mesh.position.applyQuaternion(step);
              grow = THREE.MathUtils.lerp(1, .8, u);
              develop = 0;
              /* It goes into the core rather than vanishing: gone as it
                 touches, and the core is that much bigger for it. */
              entryAlpha = smooth(a, 0, .08) * (1 - smooth(a, .86, 1));
              absorbed += smooth(a, .78, 1);
            } else {
              const b = clamp01((enter - merge) / -merge);
              mesh.position.lerpVectors(entranceCore, entranceTarget, easeOutBack(b, 1.2));
              grow = THREE.MathUtils.lerp(.8, targetGrow, Math.min(1, b * 1.25));
              develop = smooth(b, .4, 1);
              entryAlpha = smooth(b, 0, .1);
              absorbed += 1;
            }
            state.pulse = Math.max(state.pulse, Math.exp(-Math.pow((enter - merge) / .03, 2)));
          }
        }
      }
      if (gone) { mesh.visible = false; body.fresh = true; continue; }
      mesh.visible = true;
      /* A body starting afresh has not crossed anything yet. */
      if (body.fresh) body.wet = 0;
      if (faceLens) {
        /* Upright and looking at the lens, so each photograph reads. */
        facing.lookAt(cameraLocal, mesh.position, UP);
        mesh.quaternion.setFromRotationMatrix(facing);
      }
      mesh.scale.setScalar(radiusNow * grow);
      stepBody(mesh, dt, C, reducedMotion, rel);
      const u = mesh.material.uniforms;
      const radiusDrawn = radiusNow * grow;

      /* The sea: a drop crossing it strikes it — a crown of spray and a ring
         on the water — falling in, or (scrolled back) leaping out. Only the
         rain ever goes into the water; everything else flies over it. */
      const side = mode === 2 && C.bloomEnd > .5 && mesh.position.y <= seaY ? -1 : 1;
      if (!body.wet) body.wet = side;
      else if (side !== body.wet) {
        if (mode === 2 && motion && dt > 0) {
          const strength = C.splash * (side < 0 ? 1 : .45) * Math.min(1.6, .5 + body.vel.length() * .12);
          crown(mesh.position.x, seaY, mesh.position.z, radiusDrawn, C, strength);
          if (onSplash) {
            splashPoint.set(mesh.position.x, seaY, mesh.position.z);
            group.localToWorld(splashPoint);
            onSplash(splashPoint.x, splashPoint.y, splashPoint.z, strength * rel);
          }
        }
        body.wet = side;
      }

      /* Spray owed for this step: shed from the back in proportion to how
         far past a walking pace the drop is going, and flung forward in
         proportion to how hard it is braking. */
      if (motion && C.spray > .001 && dt > 0 && side > 0) {
        const speed = body.vel.length();
        body.owed += (Math.max(0, speed - .9) * 5.5 + Math.max(0, -body.accel - 18) * .09) * C.spray * dt;
        body.owed = Math.min(body.owed, 6);
        while (body.owed >= 1) {
          body.owed -= 1;
          emit(mesh, C, radiusDrawn, body.accel < -18 && Math.random() < .6);
        }
      }

      /* Everything below is handed to the shader in the drop's own frame. */
      inverse.copy(mesh.quaternion).invert();
      /* Stretch: the transient spring plus a steady pull along the travel —
         at 5 units/s about a fifth of a radius — capped at LIMIT. */
      local.copy(body.spring).addScaledVector(body.vel, .0075 * C.stretch * motion);
      local.multiplyScalar(give / size);
      const amount = Math.min(C.limit, local.length());
      if (amount > 1e-5) u.uStretchDir.value.copy(local).normalize().applyQuaternion(inverse);
      u.uStretchAmt.value = amount;
      /* The sweep over the shutter, in drop radii, in the drop's frame. The
         squirm and the tear hand over to the blur as it grows — both are
         gone by the time the blur takes the drop, so nothing pops. */
      /* Arriving drops are blurred at half the shutter: enough to read their
         speed, not so much that they come in as ghosts. */
      local.copy(body.vel).multiplyScalar(blurring ? C.blur / 60 / radiusDrawn * (entering ? .5 : 1) : 0);
      if (local.length() > 4) local.setLength(4);
      const sweep = local.length();
      u.uSweep.value.copy(local).applyQuaternion(inverse);
      const blurOn = blurring && sweep > .08;
      const settle = blurring ? 1 - smooth(sweep, .02, .08) : 1;
      u.uBlurOn.value = blurOn ? 1 : 0;
      /* Enough moments that neighbouring ones overlap: about one for every
         half radius of sweep. */
      u.uBlurSamples.value = THREE.MathUtils.clamp(Math.round(2 + sweep * 1.6), 2, MAX_SAMPLES);
      mesh.material.depthWrite = !blurring;
      mesh.renderOrder = blurring && mesh.position.distanceTo(cameraLocal) < logoDistance - .05 ? 7 : 4;
      /* Tear: behind the travel, plus the weight pulling it down — more of
         it on a heavy drop. */
      local.copy(body.vel).multiplyScalar(.008 * C.tail * motion * give / size);
      local.y -= C.sag * give;
      if (local.length() > C.limit) local.setLength(C.limit);
      local.multiplyScalar(settle);
      u.uTail.value.copy(local).applyQuaternion(inverse);
      /* The squirm's frame: fixed to the world, turned only by the roll —
         never by the photograph's facing, which is a choice of ours and not
         something the water does. */
      noiseFrame.copy(body.roll).invert().multiply(mesh.quaternion);
      u.uRollNoise.value.setFromMatrix4(matrix.makeRotationFromQuaternion(noiseFrame));
      /* The slosh, about the roll axis, in the drop's frame. */
      axis.copy(body.rollAxis).applyQuaternion(inverse);
      step.setFromAxisAngle(axis, body.slosh);
      u.uPhotoRot.value.setFromMatrix4(matrix.makeRotationFromQuaternion(step));

      u.uTime.value = time;
      /* Only a drop on its way into the sea is cut by it. */
      u.uClipY.value = falling ? seaLevel : -1e9;
      /* Past the edge by now in any frame; the fade only makes sure. */
      u.uOpacity.value = fade * entryAlpha * (1 - smooth(vanish, .88, 1)) * (mode === 2 ? smooth(grow, .28, .45) : 1);
      u.uDevelop.value = develop;
      const distance = mesh.position.distanceTo(cameraLocal);
      u.uHaze.value = C.haze * Math.pow(clamp01((distance - logoDistance - .6) / 8), .8);
      u.uWobble.value = C.wobble * Math.pow(rel, .3) * motion * settle;
      u.uWobbleSpeed.value = C.wobbleSpeed * Math.pow(rel, -.5);
      u.uWobbleScale.value = C.wobbleScale;
      u.uIor.value = Math.max(1.01, C.ior);
      u.uDispersion.value = C.dispersion;
      u.uVeil.value = C.veil;
      u.uReflect.value = C.reflect;
      u.uSpec.value = C.spec;
      u.uRim.value = C.rim;
      u.uCaustic.value = C.caustic;
      u.uAbsorb.value = C.absorb;
      u.uTintStrength.value = C.tintStrength;
      u.uSaturation.value = C.saturation;
      u.uContrast.value = C.contrast;
      u.uBrightness.value = C.brightness;
      const aspect = mesh.userData.aspect;
      const halfH = zoom * Math.max(1, 1 / aspect), halfW = halfH * aspect;
      u.uCover.value.set(.5 / halfW, .5 / halfH);
      if (palette) { u.uPaper.value.set(palette.horizon); u.uInk.value.set(palette.ink); }
      if (falling && body.wet < 0) mesh.visible = mesh.position.y > seaY - radiusDrawn * 1.2;
    }

    /* ---- the converging core ---- It swells by the water that has fallen
       into it (its radius as the cube root of the drops it holds, as a
       volume would), heaving as they strike; at the merge it breaks open —
       swelling and thinning out in a moment — as the mark forms and the
       drops are thrown back out of it. */
    let coreAlpha = 0, coreScale = 0;
    if (entering && entranceMode === 2) {
      const merge = Math.min(-.01, C.enterMerge), held = absorbed / count;
      if (enter < merge) { coreScale = size * (.3 + 1.6 * Math.cbrt(held)); coreAlpha = smooth(held, 0, .12); }
      else { const b = clamp01((enter - merge) / -merge); coreScale = size * 1.9 * (1 + b * 1.5); coreAlpha = 1 - smooth(b, 0, .26); }
    }
    core.visible = coreAlpha * fade > .01;
    if (core.visible) {
      const u = core.material.uniforms;
      core.position.copy(entranceCore);
      facing.lookAt(cameraLocal, core.position, UP);
      core.quaternion.setFromRotationMatrix(facing);
      core.scale.setScalar(coreScale);
      core.renderOrder = 4;
      core.material.depthWrite = false;
      u.uTime.value = time;
      u.uOpacity.value = fade * coreAlpha;
      u.uWobble.value = C.wobble * 1.8 * motion;
      u.uWobbleSpeed.value = C.wobbleSpeed * 1.4;
      u.uWobbleScale.value = C.wobbleScale;
      u.uStretchAmt.value = 0;
      u.uTail.value.set(0, 0, 0);
      u.uBlurOn.value = 0;
      u.uHaze.value = 0;
      u.uClipY.value = -1e9;
      u.uDevelop.value = 0;
      u.uIor.value = Math.max(1.01, C.ior);
      u.uDispersion.value = C.dispersion;
      u.uVeil.value = C.veil;
      u.uReflect.value = C.reflect;
      /* Clear water against the brightest part of the frame: a firmer rim
         and brighter windows, or it is lost in the light it stands in. */
      u.uSpec.value = C.spec * 1.4;
      u.uRim.value = Math.min(1, C.rim * 1.7);
      u.uCaustic.value = C.caustic;
      u.uAbsorb.value = C.absorb * 1.5;
      if (palette) { u.uPaper.value.set(palette.horizon); u.uInk.value.set(palette.ink); }
    }
    state.core = coreAlpha;

    /* ---- the beads, written into the instance buffers ---- */
    let written = 0;
    const lump = Math.max(0, C.beadLump);
    const writeBead = (alpha, lumpiness, tear, seed) => {
      beadMatrix.compose(beadPosition, beadQuaternion, beadScale);
      beads.setMatrixAt(written, beadMatrix);
      const o = written * 4;
      beadData[o] = seed; beadData[o + 1] = alpha; beadData[o + 2] = lumpiness; beadData[o + 3] = tear;
      written++;
    };
    /* The spray, stepped and written. A droplet swells in over its first
       few hundredths of a second and then shrinks away — evaporating, or
       gone back into the air — drawn out along its flight into a tear while
       it is fast, and lumpier the fresher it is. */
    if (dt > 0) stepSpray(dt);
    if (motion) {
      for (let i = 0; i < SPRAY_MAX; i++) {
        if (sprayLife[i] <= 0) continue;
        const t = 1 - sprayLife[i] / sprayMax[i];
        const r = spraySize[i] * Math.min(1, t / .06) * Math.pow(1 - smooth(t, .45, 1), .7);
        const o = i * 3;
        if (r < 1e-4 || sprayPos[o + 1] < seaY - r) continue;
        beadPosition.set(sprayPos[o], sprayPos[o + 1], sprayPos[o + 2]);
        flight.set(sprayVel[o], sprayVel[o + 1], sprayVel[o + 2]);
        const speed = flight.length();
        if (speed > 1e-3) beadQuaternion.setFromUnitVectors(UP, flight.divideScalar(speed));
        else beadQuaternion.identity();
        const drawn = Math.min(1.1, speed * .1);
        const across = r / Math.sqrt(1 + drawn);
        beadScale.set(across, r * (1 + drawn), across);
        writeBead(fade * Math.min(1, (1 - t) / .2), Math.min(.5, lump * sprayLump[i] * (1 + .6 * (1 - t))), Math.min(.5, speed * .05), spraySeed[i]);
      }
    }
    /* The loose beads. Only the first AMBIENT share of them shows, in a
       fixed order, so the slider thins the air evenly; one that drifts up
       to the lens shrinks away rather than filling it.
       SPIRAL: they bob, tumble, swirl a little, and turn with a fraction of
       the ring — nearer and further than it.
       LUNGE: they stream past toward the lens with the scroll, drawn out
       along the stream by the blur, and are born again far behind.
       BLOOM: they open out of the mark with the burst and fall with the
       rain, into the sea. */
    const shown = clamp01(C.ambient);
    const turn = (spin + autoAngle) * C.parallax;
    const burstAll = easeOutCubic(clamp01((progress - C.bloomAt) / Math.max(.02, C.bloomTime * 1.2)));
    const rainAll = clamp01((progress - C.rainStart) / rainWindow);
    const streamFar = -Math.max(1, C.lungeDepth), streamNear = logoDistance - .3;
    const streamSpeed = progressRate * C.stream * (streamNear - streamFar);
    /* The air's layout is drawn for a frame about 1.35 across and .9 up from
       the mark; it is stretched to the frame there actually is, so the beads
       fill the picture on any screen. */
    const airX = clearance.frameW / 1.35, airY = clearance.frameH / .9;
    /* During the entrance the air comes back with the drops: the beads fade
       in drifting inward from further out. */
    const airPresence = entering ? smooth(enter, C.enterStart, C.enterStart * .35) : 1;
    for (let j = 0; j < AMBIENT_MAX; j++) {
      const a = ambient[j];
      if (a.order >= shown) continue;
      let r = a.size * Math.max(.1, C.ambientSize) * Math.min(1, (shown - a.order) / .05);
      let stretchAlong = 0;
      const rho = a.rho * airX, height = a.y * airY;
      if (mode === 1) {
        const u = fract(a.lane + progress * C.stream + time * .012 * motion);
        const lateral = .35 + rho * 1.05;
        ambientPos.copy(lensAxis).multiplyScalar(streamFar + (streamNear - streamFar) * u)
          .addScaledVector(lensRight, Math.cos(a.theta) * lateral * 1.25)
          .addScaledVector(lensUp, height * 1.05 + Math.sin(a.theta) * .2);
        r *= smooth(u, 0, .08);
        stretchAlong = Math.min(4, Math.abs(streamSpeed) * (blurring ? C.blur / 60 : 0) / Math.max(1e-3, r));
      } else if (mode === 2) {
        const theta = a.theta + bloomTurn;
        const open = .12 + .88 * burstAll;
        ambientPos.set(Math.sin(theta) * rho * open, height * burstAll, Math.cos(theta) * rho * open - .35 * (1 - burstAll));
        ambientPos.y += Math.sin(time * a.bob * .6 * motion + a.phase) * .05 * C.float * burstAll;
        r *= smooth(burstAll, 0, .35);
        if (C.bloomEnd > .5) {
          /* With the rain the air empties too: the beads sink and fade. */
          ambientPos.y -= rainAll * rainAll * (1.3 + a.bob) * .9;
          r *= 1 - smooth(rainAll, .4, .95);
          if (ambientPos.y < seaY) r = 0;
        } else {
          /* With the pounce the air rushes out at the lens with the drops,
             drawn out along the rush by the blur, and is gone past it. */
          const rush = rainAll * rainAll, rushSpeed = 2 * rainAll * Math.abs(progressRate) / rainWindow * logoDistance * .9;
          ambientPos.addScaledVector(lensAxis, rush * logoDistance * .9);
          r *= 1 - smooth(rainAll, .6, 1);
          stretchAlong = Math.min(3, rushSpeed * (blurring ? C.blur / 60 : 0) / Math.max(1e-3, r));
        }
      } else {
        const theta = a.theta + turn + time * a.swirl * motion;
        ambientPos.set(
          Math.sin(theta) * rho,
          height + Math.sin(time * a.bob * .6 * motion + a.phase) * .06 * C.float,
          Math.cos(theta) * rho
        ).applyQuaternion(orientation);
      }
      if (airPresence < 1) { ambientPos.multiplyScalar(1 + .7 * (1 - airPresence)); r *= airPresence; }
      r *= smooth(ambientPos.distanceTo(cameraLocal), .55, 1.1);
      if (r < 1e-4) continue;
      beadPosition.copy(ambientPos);
      if (stretchAlong > .05) {
        /* Streaming: drawn out along the stream, like the drops' own blur. */
        beadQuaternion.setFromUnitVectors(UP, lensAxis);
        const across = r / Math.sqrt(1 + stretchAlong);
        beadScale.set(across, r * (1 + stretchAlong), across);
      } else {
        beadQuaternion.setFromAxisAngle(a.axis, a.tumble + time * a.spinRate * motion);
        beadScale.set(r * a.squash[0], r * a.squash[1], r * a.squash[2]);
      }
      writeBead(fade, Math.min(.5, lump * a.lump), 0, a.seed);
    }
    beads.count = written;
    beads.instanceMatrix.needsUpdate = true;
    beadAttribute.needsUpdate = true;
    beadUniforms.uTime.value = time;
    beadUniforms.uBeadWobble.value = C.beadWobble * motion;
    beadUniforms.uIor.value = Math.max(1.01, C.ior);
    beadUniforms.uReflect.value = C.reflect;
    beadUniforms.uSpec.value = C.spec;
    beadUniforms.uRim.value = C.rim;
    beadUniforms.uCaustic.value = C.caustic;
    beadUniforms.uAbsorb.value = C.absorb;
  }

  return {
    group, meshes, beads, get ready() { return loadAssets(); }, loadAssets, update, state,
    dispose() {
      disposed = true;
      geometry.dispose();
      beadGeometry.dispose();
      beadMaterial.dispose();
      beads.dispose();
      placeholder.dispose();
      textures.forEach(texture => texture.dispose());
      meshes.forEach(mesh => mesh.material.dispose());
      core.material.dispose();
    }
  };
}
