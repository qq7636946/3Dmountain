import{SVGLoader}from"three/addons/loaders/SVGLoader.js";import{MeshSurfaceSampler}from"three/addons/math/MeshSurfaceSampler.js";export const WORD_PATHS=["M276.565 445.066 L276.565 475.218 L280.639 475.218 L280.639 464.406 L280.639 461.586 L280.639 458.258 L280.639 456.538 L280.639 448.394 L294.391 448.394 L294.391 445.066 Z","M294.391 451.973 L294.391 457.709 C294.391 457.709 283.705 457.865 282.196 468.735 C282.196 468.735 280.422 454.237 294.391 451.973 Z","M318.657 445.066 L318.657 475.218 L314.582 475.218 L314.582 445.066 Z","M340.036 475.218 L340.036 445.066 L344.666 445.066 L355.697 460.673 C358.215 464.306 360.034 467.205 361.583 470.266 L361.686 470.203 C361.308 466.418 361.261 462.809 361.261 458.321 L361.261 445.066 L365.117 445.066 L365.117 475.218 L360.927 475.218 L350.054 459.676 C347.696 456.185 345.42 452.738 343.772 449.625 L343.625 449.688 C343.848 453.437 343.891 457.007 343.891 461.511 L343.891 475.218 Z","M386.46 475.218 L386.46 445.066 L391.09 445.066 L402.122 460.673 C404.639 464.306 406.458 467.205 408.011 470.266 L408.11 470.203 C407.733 466.418 407.685 462.809 407.685 458.321 L407.685 445.066 L411.541 445.066 L411.541 475.218 L407.352 475.218 L396.479 459.676 C394.12 456.185 391.849 452.738 390.197 449.625 L390.05 449.688 C390.272 453.437 390.316 457.007 390.316 461.511 L390.316 475.218 Z","M462 459.807 C462 469.842 454.884 475.754 446.258 475.754 C437.264 475.754 430.974 469.278 430.974 460.505 C430.974 451.102 437.658 444.53 446.636 444.53 C455.9 444.53 462 451.074 462 459.807 Z M435.275 460.375 C435.275 466.911 439.543 472.538 446.453 472.538 C453.407 472.538 457.699 467.161 457.699 459.997 C457.699 453.87 453.867 447.747 446.537 447.747 C439.17 447.747 435.275 453.62 435.275 460.375 Z","M488.923 475.218 L478.053 445.066 L482.465 445.066 L487.727 460.168 C489.22 464.457 490.411 467.912 491.325 471.311 L491.412 471.311 C492.389 467.963 493.763 464.302 495.324 460.268 L501.157 445.066 L505.494 445.066 L493.465 475.218 Z","M525.347 465.596 L521.857 475.218 L517.584 475.218 L528.961 445.066 L533.933 445.066 L545.433 475.218 L541.013 475.218 L537.368 465.596 Z M536.478 462.46 L533.019 453.445 C532.297 451.527 531.828 449.958 531.352 448.402 L531.264 448.402 C530.804 449.99 530.323 451.587 529.676 453.366 L526.241 462.46 Z","M566.959 448.422 L556.551 448.422 L556.551 445.066 L581.497 445.066 L581.497 448.422 L571.037 448.422 L571.037 475.218 L566.959 475.218 Z","M602.999 445.066 L602.999 475.218 L598.92 475.218 L598.92 445.066 Z","M653.481 459.807 C653.481 469.842 646.365 475.754 637.74 475.754 C628.746 475.754 622.455 469.278 622.455 460.505 C622.455 451.102 629.139 444.53 638.117 444.53 C647.382 444.53 653.481 451.074 653.481 459.807 Z M626.756 460.375 C626.756 466.911 631.025 472.538 637.935 472.538 C644.888 472.538 649.181 467.161 649.181 459.997 C649.181 453.87 645.349 447.747 638.018 447.747 C630.652 447.747 626.756 453.62 626.756 460.375 Z","M672.946 475.218 L672.946 445.066 L677.576 445.066 L688.608 460.673 C691.126 464.306 692.945 467.205 694.497 470.266 L694.596 470.203 C694.219 466.418 694.172 462.809 694.172 458.321 L694.172 445.066 L698.028 445.066 L698.028 475.218 L693.838 475.218 L682.965 459.676 C680.606 456.185 678.335 452.738 676.683 449.625 L676.536 449.688 C676.758 453.437 676.802 457.007 676.802 461.511 L676.802 475.218 Z"];const MARK_PATHS=["M674.5,292.42v23.5s-48.67,5.25-58,55.42c0,0-10.5-64.33,58-78.92Z","M674.5,331.88v29.29s-40.5,14.5-38.5,47.5,40.33,35.5,59.67,28.33,46.89-33.89,28.33-76.33c0,0-13.19-27.14-48.17-28.79v-15.21s44.44,3.5,58.28,42.67c13.83,39.17-7.44,82.49-55.94,85.99s-71.51-55.16-45.01-88.66c0,0,14-19.08,41.33-24.79Z"],QUALITY={high:24e3,medium:16e3,low:9700},WATER_QUALITY={high:7800,medium:5e3,low:3e3},SPHERE_PROFILE=`
float sphereDiameter(vec4 seed, float r){
  float gs = (r + fract(r*13.7) + fract(r*71.3) - 1.5)*2.0;
  return 0.0091*exp(0.2*gs)*(seed.w < 0.025 ? 1.5+seed.x : 1.0);
}`,FLOW_FIELD=`
vec3 flow(vec3 p, float t){   // divergence-free sine field: a cheap stand-in for curl noise
  return 0.5*vec3(sin(p.y*1.3+t)+sin(p.z*2.1-t*0.7), sin(p.z*1.1+t*1.2)+sin(p.x*1.9+t*0.5), sin(p.x*1.4-t*0.9)+sin(p.y*2.3+t*0.8));
}
vec3 churn(vec3 p, float t){  // 3 octaves, each warped by the one before: irregular like curl noise, a few sines per vertex
  vec3 a = flow(p, t);
  vec3 b = flow(p.yzx*2.03 + a*0.9 + 11.3, t*1.37);
  vec3 c = flow(p.zxy*4.11 + b*0.8 + 4.7, t*1.83);
  return a + 0.55*b + 0.3*c;
}`,VERT=`
attribute vec3 aNormal;
attribute vec4 aSeed;   // x phase, y size/kind, z role (shed / trail), w misc
attribute float aKind;  // 0 = particle, 1..3 = droplet companion of the particle before it
attribute vec2 aSim;    // this sphere's texel in the pointer simulation
uniform sampler2D tSim; uniform float uSimOn;   // 2026-11-18 eve: per-sphere offset + velocity, stepped every frame on the GPU (smooth, no jumps)
uniform float uTime, uSize, uDrift, uBreath, uBubbleShare, uShedFrac, uShedSpeed, uSurfaceY, uTrail, uTrailLen;
uniform float uUnit;   // sphere size unit (metres): the mark width for the ring; smaller for a long word mark
uniform float uPx, uWidth, uBokeh, uCountComp, uTwinkle, uPxMin, uFrac, uThick;
uniform float uSpark, uGrad, uShade, uHaloSize, uHaloFrac, uThin, uThinLit;   // lead fix 2026-11-18 eve: more glints, stronger lit/unlit arm, no dark beads, a halo layer, sparser away from the light
uniform vec3 uLight, uCenterW, uCamF;
uniform vec4 uPtr[12];   // pointer wake: xyz = world point on the mark's plane, w = strength (0 = off); 12 slots since 2026-11-18 eve (a longer wake)
uniform vec3 uPtrV[12];  // direction of travel \xD7 speed (0..1) at that point
uniform float uPtrR, uPtrPush, uPtrSwirl, uPtrDrag, uPtrLight, uPtrAny;
uniform vec3 uSmear;     // the mark smears with the cursor's recent travel (world metres; each sphere lags by its own share)
varying vec3 vCol;
varying float vBub, vRing, vAge, vAir, vRnd, vPx, vDof, vOp, vSpec;
${FLOW_FIELD}
${SPHERE_PROFILE}
void main(){
  float ph = aSeed.x*6.2831853;
  float r2 = fract(aSeed.y*91.7);
  vec3 p = position + aNormal*sin(uTime*0.6 + position.y*0.55 + ph*0.25)*uBreath;
  vec2 simO = uSimOn > 0.5 ? texture2D(tSim, aSim).xy : vec2(0.0);
  p.xy += simO;
  vec3 w = (modelMatrix*vec4(p,1.0)).xyz;
  vec3 nW = normalize(mat3(modelMatrix)*aNormal);
  float restAir = smoothstep(uSurfaceY-0.03, uSurfaceY+0.12, w.y);
  w += (churn(w*0.42, uTime*0.55)*0.07 + flow(w*2.1+ph, uTime*1.1)*0.03)*uDrift*mix(1.0, 0.3, restAir);

  /* --- pointer: spheres near the cursor are pushed aside, dragged a little along its travel and swirled; the wake eases back --- */
  float ptrF = 0.0;
  w += uSmear*(0.15+0.85*fract(aSeed.w*91.37+aSeed.x*3.7))*mix(1.0, 0.0, restAir);
  if (uPtrAny > 0.001) {
    vec3 dsp = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      vec3 d = w - uPtr[i].xyz; d -= uCamF*dot(d, uCamF);              // distance in the plane that faces the lens
      float r = length(d), f = (1.0-smoothstep(0.17*uPtrR, uPtrR, r))*uPtr[i].w;   // hard core \u2248 0.05 MW, fading out by the radius (SPEC-INTERACT \xA74.3)
      vec3 dn = d/max(r, 1e-4), tg = cross(uCamF, dn);
      dsp += (dn*uPtrPush*(0.6+0.8*r2) + uPtrV[i]*uPtrDrag*uPtrPush + tg*uPtrSwirl*uPtrPush*sin(ph+float(i)*1.7))*f;
      ptrF += f;
    }
    w += dsp/max(1.0, ptrF*0.75);
    ptrF = min(1.0, ptrF);
  }

  float alpha = 1.0, ring = 0.0, age = 0.0;
  float isBub = step(1.0-uBubbleShare, aSeed.y);
  /* sphere DIAMETER in metres: 0.7\u20131.6 % of the mark width, median 0.9 % (measured on the target); the sprite is d/0.78 */
  float dia = sphereDiameter(aSeed, r2);
  float sz = mix(dia*uUnit, 0.09*(uUnit/6.0), isBub)/0.80;
  bool drop = aKind > 0.5, cull = fract(aSeed.x*7.77+aSeed.z*3.31) > uFrac;   // quality = a random share (the buffer is depth-sorted)

  /* --- shedding: a share of the particles sits in the mark for a while, then wobbles upward and is recycled --- */
  float shed = step(aSeed.z, uShedFrac)*(1.0-step(0.5, restAir));
  bool popped = false; float tau = 0.0;
  if (shed > 0.5) {
    float period = mix(7.0, 13.0, aSeed.w);
    float c = fract(uTime/period + aSeed.x*17.31);
    float tr = max(0.0, c-0.22)*period;                 // seconds spent rising
    float vy = uShedSpeed*(0.6+0.8*r2);
    float over = w.y + tr*vy - uSurfaceY;
    if (over > 0.0 && tr > 0.0) { popped = true; tau = over/vy; tr -= tau; }
    float k = min(tr, 2.5);
    w.y += tr*vy;
    w.x += sin(tr*2.3+ph)*0.07*k + sin(tr*0.7+ph*2.0)*0.10*k;
    w.z += cos(tr*1.9+ph*1.7)*0.07*k;
    sz *= 0.85+0.2*min(tr, 3.0)/3.0;
    alpha *= smoothstep(0.0, 0.08, c)*(1.0-smoothstep(0.86, 1.0, c));
    if (popped) {
      if (drop) {                                        // 3 droplets jump out and fall back
        float a = ph + aKind*2.1, vh = 0.2+0.35*fract(aSeed.w*7.0+aKind*0.37), v0 = 0.8+0.8*fract(aSeed.w*13.0+aKind*0.61);
        float y = v0*tau - 2.2*tau*tau;
        if (y < 0.0) cull = true;
        w = vec3(w.x+cos(a)*vh*tau, uSurfaceY+y, w.z+sin(a)*vh*tau);
        sz = 0.03; isBub = 0.0; alpha = 1.6;
      } else {                                           // the bubble itself becomes a short ring on the surface
        age = tau/0.55; if (age > 1.0) cull = true;
        w.y = uSurfaceY + 0.01; ring = 1.0; sz = 0.16+0.5*sz; isBub = 0.0;
      }
    } else if (drop) cull = true;
  } else if (drop) cull = true;

  /* --- the rise trail: a share of the particles lags behind (below) the mark while it climbs --- */
  if (!popped && uTrail > 0.001 && aSeed.z > 0.6 && aSeed.z < 0.86) {
    float c2 = fract(uTime*(0.22+0.2*aSeed.w) + aSeed.x*9.1);
    float d = c2*c2*uTrailLen*uTrail*(0.4+0.6*r2);
    w.y -= d;
    w.x = mix(w.x, uCenterW.x + (w.x-uCenterW.x)*0.45, c2*uTrail) + sin(c2*9.0+ph)*0.10*c2*uTrail;
    w.z = mix(w.z, uCenterW.z + (w.z-uCenterW.z)*0.45, c2*uTrail);
    float f = min(1.0, uTrail*4.0);
    alpha *= mix(1.0, (1.0-c2)*(1.0-smoothstep(uSurfaceY-0.05, uSurfaceY+0.05, w.y)), f);

  }

  /* --- air: above the surface no bubble survives; the mark is a cold glowing particle mark --- */
  float air = (ring > 0.5 || drop) ? 0.0 : smoothstep(uSurfaceY-0.03, uSurfaceY+0.12, w.y);
  isBub *= 1.0-air;
  sz *= mix(1.0, 0.6, air);
  if (ring < 0.5 && !drop && shed < 0.5) {               // the waterline through the mark fizzes with tiny rings
    float band = exp(-pow((w.y-uSurfaceY)/0.07, 2.0));
    float fl = fract(aSeed.w*5.0 + uTime*0.8);
    if (band > 0.45 && fl > 0.7) { ring = 1.0; age = (fl-0.7)/0.3; sz = 0.12+sz; isBub = 0.0; w.y = uSurfaceY+0.01; air = 0.0; }
  }

  /* --- light: square-on, so the gradient comes from where a sphere sits on the mark (upper right \u2248 1, lower left \u2248 0.6) --- */
  float across = smoothstep(-0.95, 0.6, dot(w-uCenterW, uLight)/(uWidth*0.5));
  float var = fract(aSeed.w*57.3+aSeed.x*3.1);
  /* the light is on the MARK, not on the sprite (SPEC-SPHERE \xA73, \xA79): a soft field from the upper right that sweeps with a
     5.5 s period. Most spheres are blue-grey bodies, those in the mark's own shade are near silhouettes, and the top
     10\u201315 % blow out to white (HDR) and feed the bloom. No per-sphere flicker. */
  vec3 lp = (w-uCenterW)/uWidth;
  float sweep = uTime*1.142;                              // 2\u03C0 / 5.5 s
  float fld = 0.5+0.25*sin(dot(lp.xy, vec2(5.1, 3.4))-sweep)+0.25*sin(dot(lp.xy, vec2(-3.3, 6.7))+sweep*0.63+1.7);
  float v2 = fract(aSeed.y*43.7+aSeed.w*17.9);            // wide per-sphere spread: the band is a blue-grey foam, not a white sheet
  float body = mix(1.0-uGrad, 1.0, across*across)*mix(0.8, 1.2, fld)*(0.42+1.0*v2*v2+0.12*var);
  body *= 1.0-0.4*uShade*step(0.97, fract(var*7.31+aSeed.x));    // a few sit in shade: dark silhouettes in front of brighter ones (uShade 0 = none)
  /* the hot band follows the lit arm: how far a sphere sits toward the light (not saturating), plus the outline walls that face it */
  float toward = smoothstep(-0.2, 0.75, dot(w-uCenterW, uLight)/(uWidth*0.5));
  /* the outline walls that face up / toward the light are the glowing edges: the outer edge of the lit arc, the blade's top-left edge */
  float edge = (1.0-abs(aNormal.z))*max(0.0, dot(normalize(nW.xy+1e-4), normalize(vec2(uLight.x*0.4, uLight.y*0.4+0.75))));
  float thr = 0.87-0.04*sin(sweep)-uSpark;               // uSpark > 0: more spheres blow out to glints
  /* uThin: the far arm is sparser, not darker (the target's far arm is the same white points, fewer of them) */
  if (shed < 0.5 && !drop && fract(aSeed.x*13.13+aSeed.w*7.71) < uThin*(1.0-across) + uThinLit*across) cull = true;   // uThinLit: the lit arm is packed at build; with light that adds up it would burn to white
  float hot = smoothstep(thr, thr+0.07, 0.45*toward+0.12*fld+0.43*var+0.3*edge)*(1.0-air);
  float bright = body*(1.0+uPtrLight*ptrF)*(1.0+0.55*edge);
  float tw = hot;
  vec4 mv = viewMatrix*vec4(w, 1.0);
  float rel = (mv.z - (viewMatrix*vec4(uCenterW, 1.0)).z)/uWidth;   // <0 = behind the mark's centre
  /* depth of field through the ribbon's thickness: 0 = front skin (crisp), 1 = back (larger, softer, dimmer, bluer) */
  float dof = (ring > 0.5 || drop) ? 0.0 : clamp(0.5 - rel/uThick, 0.0, 1.0);
  dof = dof*dof*(3.0-2.0*dof)*clamp(uBokeh, 0.0, 1.5);
  vec3 col = mix(vec3(1.0), vec3(0.62, 0.80, 1.0), min(1.0, dof*0.85));
  col = mix(col, vec3(0.62, 0.82, 1.0), air);            // air: cold white-blue
  bright *= 1.0-0.5*min(1.0, dof);
  if (ring > 0.5 || drop) { col = vec3(0.8, 0.92, 1.0); bright = 0.7; }
  float sw = sz*uSize*uCountComp*(1.0+0.3*dof*(1.0-ring));
  float px = sw*uPx/max(0.1, -mv.z);
#ifdef HALO
  /* the halo layer: a share of the resting spheres again, as big soft additive light; together they make the lit band glow from inside */
  if (shed > 0.5 || ring > 0.5 || drop || air > 0.5 || fract(aSeed.w*31.7+aSeed.x*5.3) > uHaloFrac) cull = true;
  px *= uHaloSize*(0.7+0.6*var);
  bright *= 0.55+1.6*hot;
  alpha = 1.0;
#endif
  alpha *= min(1.0, (px*px)/(uPxMin*uPxMin));
  gl_PointSize = max(px, uPxMin);
  gl_Position = cull ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix*mv;
  vCol = col*bright;
  vOp = alpha; vDof = min(1.0, dof); vSpec = hot;
  vPx = max(px, uPxMin); vBub = isBub; vRing = ring; vAge = age; vAir = air; vRnd = aSeed.w;
}`,FRAG=`
uniform float uGlow, uRim, uFringe, uSquash;
uniform float uAdd, uWhite, uGlint, uHalo, uDot, uGrad;
uniform vec2 uLight2;
uniform vec3 uLightV;
varying vec3 vCol;
varying float vBub, vRing, vAge, vAir, vRnd, vPx, vDof, vOp, vSpec;
float band(float r, float r0, float w){ return smoothstep(r0-w, r0, r)*(1.0-smoothstep(r0, r0+w*0.55, r)); }
void main(){
  vec2 q = gl_PointCoord*2.0-1.0; q.y = -q.y;
  float r = length(q);
  vec3 c;
#ifdef HALO
  { float g = exp(-r*r*3.2)*(1.0-smoothstep(0.85, 1.0, r));
    vec3 hc = mix(vec3(0.38, 0.62, 1.0), vec3(0.85, 0.93, 1.0), vSpec);
    gl_FragColor = vec4(hc*vCol*g*vOp*uHalo*uGlow, 0.0);   // pure additive
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return; }
#endif
  if (vRing > 0.5) {                       // pop ring lying on the water
    vec2 e = vec2(q.x, q.y/uSquash); float re = length(e);
    float r0 = mix(0.18, 0.88, sqrt(vAge));
    c = vec3(band(re, r0, 0.14))*(1.0-vAge)*(1.0-vAge)*1.4;
  } else if (vBub > 0.5) {                 // see-through bubble: thin rim, offset highlight, faint fringe
    vec3 r0 = vec3(0.80) + vec3(-1.0, 0.0, 1.0)*0.035*uFringe;
    vec2 d = q/max(r, 1e-4);
    float side = 0.38 + 0.62*pow(abs(dot(d, uLight2)), 1.5);     // rim brighter on the lit side and its opposite
    vec3 rim = vec3(band(r, r0.r, 0.11), band(r, r0.g, 0.11), band(r, r0.b, 0.11))*side*uRim;
    float inside = 1.0-smoothstep(0.78, 0.84, r);
    float body = inside*(0.035 + 0.10*r*r*r);
    float hl = exp(-dot(q-uLight2*0.46, q-uLight2*0.46)*55.0)*1.5 + exp(-dot(q+uLight2*0.5, q+uLight2*0.5)*38.0)*0.32;
    c = rim + vec3(body) + vec3(hl)*inside;
  } else {
    /* SPHERE impostor (our own drawing): normal from the sprite coordinate, key light from tune.light, soft wrap diffuse over a
       blue ambient, a small hot specular dot, a faint rim, anti-aliased edge that softens with depth. Drawn "over" (premultiplied)
       so overlapping spheres make foam with dark gaps instead of adding up to flat white. */
    float R = 0.80, rr = r/R;
    float aa = clamp(1.3/vPx, 0.04, 0.4) + vDof*0.25;
    float cov = 1.0-smoothstep(1.0-max(aa, 0.15), 1.0+aa*0.4, rr);        // opaque disc, soft \xB10.15 R edge
    float nz = sqrt(max(0.0, 1.0-min(rr*rr, 1.0)));
    vec3 n = normalize(vec3(q/R, nz+1e-3));
    /* measured ball profile: flat bright middle to 0.5 R, smooth fall to 60 % at the edge; the side away from the light 17 % darker;
       no specular dot, no rim */
    float shade = mix(0.60, 1.0, smoothstep(1.0, 0.45, rr))*(0.83+0.17*(0.5+0.5*dot(n.xy, uLight2)));
    vec3 base = mix(vec3(0.47, 0.73, 1.16), vec3(0.78, 0.90, 1.12), uWhite)*uRim;   // normal body \u2248 rgb(92,122,160) on screen; uWhite \u2192 paler, colder
    vec3 lit = base*vCol*shade;
    /* glints: a hot core that falls off fast (a point of light inside a bubble), not a flat white disc */
    float core = exp(-rr*rr*5.0);
    vec3 hotc = vec3(0.90, 0.95, 1.0)*(0.95+0.55*vSpec)*mix(0.8, 1.0, shade)*mix(1.0, 0.45+1.6*core, uGlint);
    float a = cov*vOp;
    /* uDot: the lit disc becomes a soft point of light with a bright middle (the target's specks), 0 = the matte sphere */
    float dotp = exp(-rr*rr*3.2)*(1.0-smoothstep(0.85, 1.12, rr));
    float prof = mix(1.0, dotp*1.3/max(shade, 0.3), uDot);
    vec3 col = (mix(lit, hotc, vSpec)*a*prof + vec3(0.6, 0.8, 1.0)*exp(-r*r*2.6)*0.06*vSpec*vOp)*uGlow;
    /* uAdd: 0 = opaque foam ("over"), 1 = light that adds up. Spheres in the mark's shade (uGrad) do not turn into grey pebbles darker than
       the water: they go see-through instead (the target's far arm is faint light, never dark beads) */
    float lum = dot(vCol, vec3(0.3, 0.59, 0.11));
    gl_FragColor = vec4(col, a*(1.0-uAdd)*mix(1.0, smoothstep(0.15, 0.75, lum), min(1.0, uGrad*1.6)));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    return;
  }
  vec3 col = vCol*c*uGlow*vOp;
  gl_FragColor = vec4(col, 0.0);            // rings and see-through bubbles stay additive
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,WATER_VERT=`
attribute vec3 aNormal;
attribute vec4 aSeed;
attribute vec2 aSim;
uniform float uTime, uSize, uPx, uPxMin, uWidth, uUnit, uThick, uCountComp;
uniform float uDrift, uBreath, uGather, uBubbleShare, uShedFrac, uShedSpeed;
uniform float uLeadRelease, uGlint, uSimOn, uPointerRadius;
uniform int uLeadIndex;
uniform vec3 uLight, uCenterW;
uniform sampler2D tSim;
uniform vec3 uCursor;
uniform vec2 uSmear;
varying float vTop, vRandom, vBubble, vLife, vPx, vFront, vDepth, vSpark, vPad;
${FLOW_FIELD}
${SPHERE_PROFILE}
void main(){
  float phase = aSeed.x*6.2831853;
  float shape = fract(aSeed.y*91.7);
  bool lead = gl_VertexID == uLeadIndex;
  float drift = lead ? 0.0 : uDrift;
  vec3 p = position + aNormal*sin(uTime*0.6 + position.y*0.55 + phase*0.25)*(lead ? 0.0 : uBreath);
  if (!lead) {
    #ifdef POINTER_SIM
    if (uSimOn > 0.5) p.xy += texture2D(tSim, aSim).xy;
    #else
    vec2 d = position.xy-uCursor.xy;
    float r = length(d);
    p.xy += d/max(0.001,r)*(1.0-smoothstep(0.12*uPointerRadius,uPointerRadius,r))*uCursor.z*uPointerRadius*0.7;
    #endif
    p.xy += uSmear*(0.12 + 0.88*fract(shape*71.3+aSeed.w));
  }
  float spread = lead ? 0.0 : 1.0-uGather;
  p += (p*0.15 + vec3(cos(phase), sin(phase), shape-0.5)*uWidth*(0.12 + aSeed.w*0.38))*spread*spread;
  vec3 w = (modelMatrix*vec4(p, 1.0)).xyz;
  w += (churn(w*0.42, uTime*0.44)*0.065 + flow(w*2.1+phase, uTime*0.75)*0.028)*drift;

  float life = 1.0;
  float bubble = step(1.0-uBubbleShare, aSeed.y);
  if (!lead && aSeed.z < uShedFrac) {
    float period = mix(7.0, 13.0, aSeed.w);
    float cycle = fract(uTime/period + aSeed.x*17.31);
    float rise = max(0.0, cycle-0.22)*period;
    float swing = min(rise, 2.5);
    w += vec3((sin(rise*1.7+phase)*0.07 + sin(rise*0.7+phase)*0.09)*swing,
              rise*uShedSpeed*(0.6+0.8*shape), cos(rise*1.2+phase)*0.07*swing);
    life = smoothstep(0.0, 0.12, cycle)*(1.0-smoothstep(0.76, 1.0, cycle))*mix(0.64, 1.0, uGather);
    bubble = 1.0;
  }
  if (lead) {
    bubble = 1.0;
    life *= 1.0-uLeadRelease;
  }

  vec4 mv = viewMatrix*vec4(w, 1.0);
  vec3 offset = w-uCenterW;
  float front = smoothstep(-0.52, 0.52, (viewMatrix*vec4(offset, 0.0)).z/(uWidth*uThick));
  float dia = sphereDiameter(aSeed, shape);
  float size = mix(dia, (0.013+0.009*shape), bubble)*uUnit*uSize*uCountComp;
  float px = (size/0.80)*uPx/max(0.1, -mv.z)*mix(1.17, 1.0, front);
  vRandom = fract(aSeed.w*57.3+aSeed.x*3.1);
  vTop = smoothstep(-0.62, 0.68, (offset.y*0.74 + dot(offset, uLight)*0.36)/uWidth);
  vec2 xy = position.xy/uWidth;
  float refracted = 0.5 + 0.27*sin(dot(xy, vec2(8.2, -5.7)) + uTime*0.65)
                        + 0.23*sin(dot(xy, vec2(-4.4, 9.6)) - uTime*0.48 + 1.7);
  float band = smoothstep(0.18, 0.95, refracted);
  float spark = smoothstep(0.61, 0.88, 0.48*band + 0.34*vRandom + 0.18*vTop)*mix(0.59,1.0,front);
  vSpark = spark;
  vPad = 1.0 + min(1.4, 1.31*spark*uGlint);
  vPx = min(24.0, max(px, uPxMin));
  gl_PointSize = min(40.0, vPx*vPad);
  gl_Position = projectionMatrix*mv;
  vDepth = max(0.0, -mv.z);
  vFront = front;
  vLife = life*min(1.0, px*px/(uPxMin*uPxMin));
  vBubble = bubble;
}`,WATER_FRAG=`
uniform float uGlow, uContrast, uGlint, uOpacity, uTeal, uFogDensity;
uniform vec3 uPearl, uAqua, uSlate, uFog, uLightV;
uniform vec2 uLight2, uOutputSize;
uniform vec4 uCopyRect;
varying float vTop, vRandom, vBubble, vLife, vPx, vFront, vDepth, vSpark, vPad;
void main(){
  vec2 q = (gl_PointCoord*2.0-1.0)*vPad;
  q.y = -q.y;
  float r2 = dot(q, q);
  float r = sqrt(r2);
  float aa = clamp(0.64/vPx, 0.035, 0.24) + (1.0-vFront)*0.075;
  float disc = 1.0-smoothstep(0.79-aa, 0.79+aa, r);
  vec3 n = normalize(vec3(q/0.79, sqrt(max(0.001, 1.0-r2/0.6241))));
  float diffuse = clamp(0.48 + 0.48*dot(n, uLightV), 0.0, 1.0);
  float edgeLight = 0.31 + 0.69*smoothstep(-0.45, 0.9, dot(q/max(r, 1e-4), uLight2));
  float rim = (1.0-smoothstep(aa*0.45, 0.15+aa*0.2, abs(r-0.71)))*edgeLight;
  vec2 delta = q-uLight2*0.4;
  float highlight = exp(-dot(delta, delta)*(18.0+vFront*13.0))*disc;
  float foam = disc*(0.24 + 0.49*diffuse) + rim*0.18 + highlight*0.29;
  float shell = disc*0.11 + rim*0.75 + highlight*0.48;
  float strength = mix(foam, shell, vBubble);

  float clear = exp(-uFogDensity*max(0.0, vDepth-2.0));
  vec3 water = mix(uSlate, uAqua, clamp(0.20+0.46*diffuse+0.23*vTop+0.14*vFront, 0.0, 1.0));
  water = mix(uPearl*mix(0.64, 0.95, diffuse), water, uTeal);
  float tone = clamp(0.50 + (0.30*vTop + 0.42*vRandom + 0.28*diffuse - 0.50)*uContrast, 0.0, 1.0);
  float spec = uGlint*vSpark;
  vec2 pearlOffset = q-uLight2*0.22;
  float pearl = smoothstep(0.29, 0.86, vSpark)*exp(-13.0*dot(pearlOffset, pearlOffset))*uGlint;
  float glint = clamp(highlight*(0.38+0.45*tone+0.77*spec) + rim*(0.18+0.18*tone+0.44*spec), 0.0, 0.99);
  vec3 color = mix(water, uPearl, max(glint, min(1.0, pearl)));
  // Shape the midtones while rolling bright pearl highlights gently toward white.
  color = color*uGlow / (1.0 + color*(uGlow-1.0));
  color = mix(uFog, color, 0.45+0.55*clear);

  vec2 screen = gl_FragCoord.xy/uOutputSize;
  vec2 gap = max(uCopyRect.xy-screen, screen-uCopyRect.zw);
  float copyFade = mix(0.25, 1.0, smoothstep(-0.012, 0.034, max(gap.x, gap.y)));
  // Increasing exposure also strengthens the optically lit part of each bubble.
  float lift = 1.0 - 1.0/max(1.0, uGlow);
  float exposure = pow(uGlow, 0.64)*(1.0 + 0.52*lift);
  float body = 0.45*strength*mix(0.29, 1.43, tone)*mix(0.62, 1.0, vFront)*exposure;
  float rimLight = lift*rim*mix(0.15, 0.34, vBubble)*mix(0.42, 1.0, tone);
  float shine = spec*(0.39*highlight + 0.14*rim) + (1.24 + 0.70*lift)*pearl + rimLight;
  float visibility = vLife*uOpacity*clear*copyFade;
  float alpha = 1.0-exp(-visibility*(body+shine));
  // Gorge's scene target stores display-encoded RGB, shared by its native water shaders.
  vec3 displayColor = sRGBTransferOETF(vec4(clamp(color, 0.0, 1.0), 1.0)).rgb;
  float glowRadius = r/max(1.0,vPad);
  float halo = spec*exp(-5.0*glowRadius*glowRadius)*(1.0-smoothstep(0.55,1.0,glowRadius));
  float haze = min(0.14, halo*0.16*visibility)*(1.0-alpha);
  gl_FragColor = vec4(displayColor*alpha + vec3(0.69, 0.88, 0.97)*haze, alpha+haze);
}`;function createPointerSimulation(THREE,geometry,renderer){if(!renderer?.extensions?.has("EXT_color_buffer_float"))return null;const positions=geometry.attributes.position,seeds=geometry.attributes.aSeed,columns=Math.ceil(Math.sqrt(positions.count)),rows=Math.ceil(positions.count/columns),uv=new Float32Array(positions.count*2),home=new Float32Array(columns*rows*4);for(let i=0;i<positions.count;i++)uv[i*2]=(i%columns+.5)/columns,uv[i*2+1]=(Math.floor(i/columns)+.5)/rows,home[i*4]=positions.getX(i),home[i*4+1]=positions.getY(i),home[i*4+2]=seeds.getX(i),home[i*4+3]=1;geometry.setAttribute("aSim",new THREE.BufferAttribute(uv,2));const rest=new THREE.DataTexture(home,columns,rows,THREE.RGBAFormat,THREE.FloatType);rest.minFilter=rest.magFilter=THREE.NearestFilter,rest.needsUpdate=!0;const makeTarget=()=>new THREE.WebGLRenderTarget(columns,rows,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:!1,stencilBuffer:!1,generateMipmaps:!1}),rts=[makeTarget(),makeTarget()],mat=new THREE.ShaderMaterial({depthTest:!1,depthWrite:!1,uniforms:{tState:{value:null},tHome:{value:rest},uP:{value:new THREE.Vector3},uV:{value:new THREE.Vector2},uDt:{value:0},uA:{value:0},uR:{value:1},uK:{value:1},uDamp:{value:4},uMax:{value:1},uSwirl:{value:0},uDrag:{value:0},uReset:{value:1}},vertexShader:"varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }",fragmentShader:`
      varying vec2 vUv;
      uniform sampler2D tState, tHome;
      uniform vec3 uP;
      uniform vec2 uV;
      uniform float uDt, uA, uR, uK, uDamp, uMax, uSwirl, uDrag, uReset;
      void main(){
        vec4 st = texture2D(tState, vUv) * (1.0 - uReset);
        vec4 hm = texture2D(tHome, vUv);
        vec2 off = st.xy, vel = st.zw, d = hm.xy + off - uP.xy;
        float r = length(d);
        vec2 dir = r > 1e-5 ? d / r : vec2(cos(hm.z * 6.2832), sin(hm.z * 6.2832));
        float f = (1.0 - smoothstep(0.3 * uR, uR, r)) * uP.z * (0.75 + 0.5 * hm.z);
        vel += (dir * uA + vec2(-dir.y, dir.x) * uA * uSwirl * (hm.z - 0.5) + uV * uDrag) * f * uDt;
        vel -= off * uK * uDt;
        vel *= exp(-uDamp * uDt);
        off += vel * uDt;
        float m = length(off);
        if (m > uMax) { off *= uMax / m; vel *= 0.5; }
        gl_FragColor = vec4(off, vel);
      }`}),quad=new THREE.BufferGeometry;quad.setAttribute("position",new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));const mesh=new THREE.Mesh(quad,mat),scene=new THREE.Scene,camera=new THREE.Camera;mesh.frustumCulled=!1,scene.add(mesh);const uniforms=mat.uniforms;let front=0;return{rts,mat,step(dt){const previous=renderer.getRenderTarget();uniforms.tState.value=rts[front].texture,uniforms.uDt.value=dt,front^=1;try{renderer.setRenderTarget(rts[front]),renderer.render(scene,camera)}finally{renderer.setRenderTarget(previous)}return uniforms.uReset.value=0,rts[front].texture},dispose(){for(const target of rts)target.dispose();rest.dispose(),mat.dispose(),quad.dispose()}}}function createWaterMark(THREE,geometry,order,{width,height,depth,unit,quality,light,renderer,reach=width}){const X={accel:1,push:.23,damp:4.3,swirl:.11,drag:.21},sim=createPointerSimulation(THREE,geometry,renderer),positions=geometry.attributes.position,leadPoint=new THREE.Vector3,candidate=new THREE.Vector3,aim=new THREE.Vector3(-width*.08,height*.43,depth*.36);let leadIndex=-1,nearest=1/0;for(let i=0;i<order.length;i++){if(order[i]>=WATER_QUALITY.low)continue;const distance=candidate.fromBufferAttribute(positions,i).distanceToSquared(aim);distance<nearest&&(nearest=distance,leadIndex=i,leadPoint.copy(candidate))}const U={uTime:{value:0},uSize:{value:1},uPx:{value:1},uPxMin:{value:1.65},uWidth:{value:width},uUnit:{value:unit},uThick:{value:depth/width},uCountComp:{value:1},uDrift:{value:0},uBreath:{value:0},uGather:{value:1},uLeadIndex:{value:leadIndex},uLeadRelease:{value:0},tSim:{value:sim?.step(0)??null},uSimOn:{value:0},uPointerRadius:{value:reach*.25},uCursor:{value:new THREE.Vector3},uSmear:{value:new THREE.Vector2},uBubbleShare:{value:.095},uShedFrac:{value:0},uShedSpeed:{value:.27},uLight:{value:light.clone()},uCenterW:{value:new THREE.Vector3},uLightV:{value:light.clone()},uLight2:{value:new THREE.Vector2(0,1)},uGlow:{value:1},uContrast:{value:1},uGlint:{value:1},uOpacity:{value:0},uTeal:{value:.8},uFogDensity:{value:.023},uPearl:{value:new THREE.Color("#f1fbfc")},uAqua:{value:new THREE.Color("#a8e6f0")},uSlate:{value:new THREE.Color("#4b8fa8")},uFog:{value:new THREE.Color},uOutputSize:{value:new THREE.Vector2(1,1)},uCopyRect:{value:new THREE.Vector4(-3,-3,-2,-2)}},material=new THREE.ShaderMaterial({uniforms:U,vertexShader:WATER_VERT,fragmentShader:WATER_FRAG,defines:sim?{POINTER_SIM:1}:{},transparent:!0,premultipliedAlpha:!0,blending:THREE.NormalBlending,depthTest:!0,depthWrite:!1,toneMapped:!1}),points=new THREE.Points(geometry,material);points.name="bubble-logo",points.frustumCulled=!1,points.renderOrder=23,points.scale.z=1.82;const group=new THREE.Group;group.name="rise-underwater-bubble-logo",group.add(points),points.onBeforeRender=(renderer2,scene,camera)=>{const target=renderer2.getRenderTarget(),size=U.uOutputSize.value;target?size.set(target.width,target.height):renderer2.getDrawingBufferSize(size),U.uPx.value=size.y*.5*camera.projectionMatrix.elements[5]};const IndexArray=order.length>65536?Uint32Array:Uint16Array,index=new THREE.BufferAttribute(new IndexArray(order.length),1).setUsage(THREE.DynamicDrawUsage);geometry.setIndex(index);let count;function setQuality(level){const limit=WATER_QUALITY[level]??WATER_QUALITY.high,next=Math.min(limit,order.length);if(next===count)return;let cursor2=0;for(let i=0;i<order.length;i++)order[i]<next&&(index.array[cursor2++]=i);count=cursor2,index.needsUpdate=!0,geometry.setDrawRange(0,count),U.uCountComp.value=Math.pow(Math.min(WATER_QUALITY.high,order.length)/Math.max(1,count),.14)}setQuality(quality);const{clamp}=THREE.MathUtils,fast=new THREE.Vector2,slow=new THREE.Vector2,inverse=new THREE.Matrix4,eye=new THREE.Vector3,direction=new THREE.Vector3,hit=new THREE.Vector3,cursor=U.uCursor.value,velocity=new THREE.Vector2,speedVector=new THREE.Vector2;let lastTime=0,inWindow=!1,hitLast=!1,dwell=0,lastPressure=-1/0;function pointerFrame(pointer,camera,time,dt,active,force,settle){let hitNow=!1;if(active&&force>.001){points.updateWorldMatrix(!0,!1),inverse.copy(points.matrixWorld).invert(),eye.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse),direction.set(pointer.x,pointer.y,.5).unproject(camera).applyMatrix4(inverse).sub(eye);const distance=Math.abs(direction.z)>1e-4?-eye.z/direction.z:-1;distance>0&&(hit.copy(eye).addScaledVector(direction,distance),hitNow=Math.abs(hit.x)<width*.82&&Math.abs(hit.y)<Math.max(height*.78,reach*.3))}hitNow?(hitLast&&dt>0?speedVector.set(hit.x-cursor.x,hit.y-cursor.y).multiplyScalar(1/dt):speedVector.set(0,0),velocity.lerp(speedVector,1-Math.exp(-dt/.076)),cursor.x=hit.x,cursor.y=hit.y):velocity.set(0,0),hitLast=hitNow;const speed=velocity.length()/reach;dwell=hitNow&&speed<.31?Math.min(1,dwell+dt/1.55):Math.max(0,dwell-dt*2.2);const pressure=hitNow?force*(.52+.48*dwell)/(1+speed*.58):0;if(cursor.z+=(pressure-cursor.z)*(1-Math.exp(-dt/.085)),pressure>.001&&(lastPressure=time),!sim)return;const M=sim.mat.uniforms,running=active&&hitNow||time-lastPressure<Math.max(1.1,settle*1.9);if(U.uSimOn.value=+running,!running){M.uReset.value=1;return}M.uP.value.copy(cursor),M.uV.value.copy(velocity).clampLength(0,3.8),M.uA.value=2.25*reach*X.accel,M.uR.value=U.uPointerRadius.value,M.uMax.value=X.push*reach,M.uDamp.value=X.damp,M.uK.value=3*M.uDamp.value/settle,M.uSwirl.value=X.swirl,M.uDrag.value=X.drag;const steps=Math.max(1,Math.ceil(dt/.025));for(let step=0;step<steps;step++)U.tSim.value=sim.step(dt/steps)}function update({camera,time,motion,gather,opacity,size,teal,brightness,contrast,glints,sun,fogDensity,fogColor,copyRect,release,pointer,pointerForce,pointerSway,pointerReturn,drift=.74,breath=.018,shed=.018,shedSpeed=.27,bubbleShare=.095,depthScale=1.82,tiltX=.08,tiltY=-.09,swayTurn=1,pointerRadius=.25,pointerPush=.23,pointerAccel=1,pointerDamp=4.3,pointerSwirl=.11,pointerDrag=.21,pearl,aqua,slate}){Object.assign(X,{accel:pointerAccel,push:pointerPush,damp:Math.max(.5,pointerDamp),swirl:pointerSwirl,drag:pointerDrag}),U.uPointerRadius.value=reach*pointerRadius,points.scale.z=depthScale,U.uBubbleShare.value=bubbleShare,U.uShedSpeed.value=shedSpeed,pearl&&U.uPearl.value.set(pearl),aqua&&U.uAqua.value.set(aqua),slate&&U.uSlate.value.set(slate);const dt=clamp(time-lastTime,0,.055);lastTime=time;const active=motion&&group.visible&&pointer.active;active&&!inWindow&&(fast.copy(pointer),slow.copy(pointer)),active?(fast.lerp(pointer,1-Math.exp(-dt/.19)),slow.lerp(pointer,1-Math.exp(-dt/.84))):motion?slow.lerp(fast,1-Math.exp(-dt/.4)):fast.copy(slow),inWindow=active;const gain=pointerSway*(1-release),sx=clamp((fast.x-slow.x)*gain,-1,1),sy=clamp((fast.y-slow.y)*gain,-1,1);points.position.set(sx*.71,sy*.32,0),points.rotation.set(tiltX+Math.sin(time*.22)*.022-sy*.34*swayTurn,tiltY+Math.sin(time*.19)*.075-sx*.59*swayTurn,Math.sin(time*.23)*.015-sx*.086),U.uSmear.value.set(sx*reach*.14,sy*reach*.067),motion&&group.visible&&dt>0?pointerFrame(pointer,camera,time,dt,active,pointerForce*(1-release),pointerReturn):(U.uSimOn.value=0,cursor.z=dwell=0,hitLast=!1,lastPressure=-1/0,sim&&(sim.mat.uniforms.uReset.value=1)),group.getWorldPosition(U.uCenterW.value),U.uTime.value=time,U.uSize.value=size,U.uWidth.value=width*group.scale.x,U.uUnit.value=unit*group.scale.x,U.uThick.value=depth/width*points.scale.z,U.uDrift.value=motion?drift:0,U.uBreath.value=motion?breath:0,U.uShedFrac.value=motion?shed:0,U.uGather.value=gather,U.uLeadRelease.value=release,U.uOpacity.value=opacity,U.uGlow.value=brightness,U.uContrast.value=contrast,U.uGlint.value=glints,U.uTeal.value=teal,U.uFogDensity.value=fogDensity,U.uFog.value.copy(fogColor),U.uCopyRect.value.copy(copyRect),U.uLight.value.copy(sun);const inView=U.uLightV.value.copy(sun).transformDirection(camera.matrixWorldInverse);U.uLight2.value.set(inView.x,inView.y).normalize()}function dispose(){group.removeFromParent(),sim?.dispose(),geometry.dispose(),material.dispose()}return{group,points,update,setQuality,dispose,leadPosition:out=>points.localToWorld(out.copy(leadPoint)),info:{width,height,depth}}}function mulberry32(a){return function(){a|=0,a=a+1831565813|0;let t=Math.imul(a^a>>>15,1|a);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296}}export function createBubbleLogo(THREE,opts={}){const underwater=opts.underwater===!0,quality=underwater?WATER_QUALITY:QUALITY,width=opts.width||6,maxCount=opts.maxCount||quality.high,rnd=mulberry32(opts.seed||7),reduced=opts.reducedMotion!=null?!!opts.reducedMotion:typeof matchMedia=="function"&&matchMedia("(prefers-reduced-motion: reduce)").matches,svg=new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1366 768">${(opts.paths||MARK_PATHS).map(d=>`<path d="${d}"/>`).join("")}</svg>`),shapes=[];for(const p of svg.paths)shapes.push(...SVGLoader.createShapes(p));const flat=new THREE.ShapeGeometry(shapes);flat.computeBoundingBox();const bb=flat.boundingBox,w0=bb.max.x-bb.min.x,h0=bb.max.y-bb.min.y;flat.dispose();const cx=(bb.min.x+bb.max.x)/2,cy=(bb.min.y+bb.max.y)/2,depth0=w0*(opts.thickness||.2),bevel=Math.min(w0,h0)*.022*(opts.bevel!=null?opts.bevel:1),solid=new THREE.ExtrudeGeometry(shapes,{depth:depth0,curveSegments:28,bevelEnabled:!0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:3}),S=width/w0,sampler=new MeshSurfaceSampler(new THREE.Mesh(solid)).setRandomGenerator(rnd).build(),light=underwater&&opts.light?opts.light.clone().normalize():new THREE.Vector3(.6,.6,.53).normalize(),hsh=(i,j,k)=>{let h=Math.imul(i,374761393)^Math.imul(j,668265263)^Math.imul(k,1274126177);return h=Math.imul(h^h>>>13,1274126177),((h^h>>>16)>>>0)/4294967296},vnoise=(x,y,z)=>{const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z);let u=x-i,v=y-j,t=z-k;u=u*u*(3-2*u),v=v*v*(3-2*v),t=t*t*(3-2*t);const L=(a,b,f)=>a+(b-a)*f;return L(L(L(hsh(i,j,k),hsh(i+1,j,k),u),L(hsh(i,j+1,k),hsh(i+1,j+1,k),u),v),L(L(hsh(i,j,k+1),hsh(i+1,j,k+1),u),L(hsh(i,j+1,k+1),hsh(i+1,j+1,k+1),u),v),t)},rows=[],pos=new THREE.Vector3,nor=new THREE.Vector3,unit=opts.unit||width,clump=opts.clump!=null?opts.clump:1,thick=depth0*S,k6=unit/6;let mains=0,guard=0;for(;mains<maxCount&&guard++<maxCount*200;){if(sampler.sample(pos,nor),nor.dot(nor)<.5)continue;let x=(pos.x-cx)*S,y=-(pos.y-cy)*S,z;const nx=nor.x,ny=-nor.y,nz=nor.z,wall=Math.abs(nz)<.3,eL=wall?Math.max(0,(nx*light.x*.4+ny*(light.y*.4+.75))/(Math.hypot(nx,ny)*Math.hypot(light.x*.4,light.y*.4+.75)+1e-6)):0;if(wall){if(rnd()>.1+.8*eL)continue;z=(pos.z-depth0/2)*S}else z=thick*(.5-Math.pow(rnd(),2));const acr=Math.min(1,Math.max(0,((x*light.x+y*light.y)/(width*.5)+.95)/1.55)),tdv=Math.min(1,Math.max(0,((x*light.x+y*light.y)/(width*.5)+.1)/.9)),ac=tdv*tdv*(3-2*tdv);if(!(wall&&eL>.3)&&rnd()>.52+.48*ac)continue;const cl=.62*vnoise(x/k6*5.2+7.3,y/k6*5.2+1.9,z/k6*3)+.38*vnoise(x/k6*11.5+3.1,y/k6*11.5+8.2,z/k6*6+4.4),g=Math.min(1,Math.max(0,(cl-(.45-.07*ac))/.11));if(rnd()>.05+.95*(1-clump+clump*g*g*(3-2*g)))continue;const stray=rnd()<.16?Math.min(.06*unit,-Math.log(1-rnd()*.98)*.018*unit):0,sa=rnd()*6.2832;x+=Math.cos(sa)*stray+(rnd()-.5)*.085*k6,y+=Math.sin(sa)*stray+(rnd()-.5)*.085*k6;const seed=[rnd(),rnd(),rnd(),rnd()];if(rows.push([x,y,z,nx,ny,nz,seed,0,mains++]),!underwater&&seed[2]<.03)for(let k=1;k<=3;k++)rows.push([x,y,z+1e-4*k,nx,ny,nz,seed,k])}let hotN=0,hotAll=0;{const fr=v=>v-Math.floor(v),ss=(a,b,v)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t)};for(const r of rows){if(r[7])continue;const sd=r[6],lx=r[0]/width,ly=r[1]/width,tw=ss(-.2,.75,(r[0]*light.x+r[1]*light.y+r[2]*light.z)/(width*.5)),fld=.5+.25*Math.sin(lx*5.1+ly*3.4)+.25*Math.sin(-lx*3.3+ly*6.7+1.7),ed=(1-Math.abs(r[5]))*Math.max(0,(r[3]*light.x*.4+r[4]*(light.y*.4+.75))/(Math.hypot(r[3],r[4])*Math.hypot(light.x*.4,light.y*.4+.75)+1e-6));hotAll++,.45*tw+.12*fld+.43*fr(sd[3]*57.3+sd[0]*3.1)+.3*ed>.905&&hotN++}}rows.sort((a,b)=>a[2]-b[2]);const P=[],N=[],SD=[],K=[];for(const r of rows)P.push(r[0],r[1],r[2]),N.push(r[3],r[4],r[5]),SD.push(...r[6]),K.push(r[7]);solid.dispose();const total=K.length,geo=new THREE.BufferGeometry;if(geo.setAttribute("position",new THREE.Float32BufferAttribute(P,3)),geo.setAttribute("aNormal",new THREE.Float32BufferAttribute(N,3)),geo.setAttribute("aSeed",new THREE.Float32BufferAttribute(SD,4)),geo.boundingSphere=new THREE.Sphere(new THREE.Vector3,width*3),underwater){const order=rows.map(row=>row[8]);return createWaterMark(THREE,geo,order,{width,height:h0*S,depth:thick,unit,quality:opts.quality,light,renderer:opts.renderer,reach:opts.reach||width})}geo.setAttribute("aKind",new THREE.Float32BufferAttribute(K,1));const tune={count:QUALITY[opts.quality]||QUALITY.high,size:1.15,bubbleShare:.03,rim:1,fringe:1,glow:1,twinkle:1,drift:1,breath:.035,shedRate:.04,shedSpeed:.55,sway:0,swaySpeed:.22,yaw:0,pitch:0,bokeh:.3,trail:1,trailLen:7,pxMin:1.7,calm:reduced?.3:1,pointer:reduced?.25:1,pointerRadius:.26,pointerPush:.22,pointerForce:1.8,pointerDamp:4,pointerGrow:3,pointerReturn:4,pointerSwirl:0,pointerDrag:0,pointerLight:0,pointerDown:1,pointerKick:.45,pointerKickFast:2.5,smear:1,depth:2.2,add:.85,dot:.8,spark:.05,glint:1,white:.8,grad:.3,thin:.45,thinLit:.65,shade:0,halo:.12,haloSize:5,haloFrac:.18,light},U={uTime:{value:0},uSize:{value:1},uDrift:{value:1},uBreath:{value:.035},uBubbleShare:{value:.03},uShedFrac:{value:.06},uShedSpeed:{value:.55},uSurfaceY:{value:0},uTrail:{value:0},uTrailLen:{value:7},uPx:{value:1e3},uWidth:{value:width},uUnit:{value:opts.unit||width},uBokeh:{value:1},uCountComp:{value:1},uTwinkle:{value:1},uPxMin:{value:1.7},uFrac:{value:1},uThick:{value:.2},uLight:{value:light.clone()},uCenterW:{value:new THREE.Vector3},uGlow:{value:1},uRim:{value:1},uFringe:{value:1},uSquash:{value:.4},uLight2:{value:new THREE.Vector2(.62,.78)},uLightV:{value:light.clone()},uCamF:{value:new THREE.Vector3(0,0,-1)},uPtr:{value:Array.from({length:12},()=>new THREE.Vector4(0,0,0,0))},uPtrV:{value:Array.from({length:12},()=>new THREE.Vector3)},uPtrAny:{value:0},uSmear:{value:new THREE.Vector3},tSim:{value:null},uSimOn:{value:0},uPtrR:{value:1.8},uPtrPush:{value:1},uPtrSwirl:{value:0},uPtrDrag:{value:0},uPtrLight:{value:0},uSpark:{value:0},uGrad:{value:.26},uShade:{value:1},uHaloSize:{value:7},uHaloFrac:{value:.18},uAdd:{value:0},uWhite:{value:0},uGlint:{value:0},uHalo:{value:0},uDot:{value:0},uThin:{value:0},uThinLit:{value:0}},sim=createPointerSimulation(THREE,geo,opts.renderer),blend={transparent:!0,depthWrite:!1,depthTest:!0,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor},mat=new THREE.ShaderMaterial({uniforms:U,vertexShader:VERT,fragmentShader:FRAG,...blend}),haloMat=new THREE.ShaderMaterial({uniforms:U,vertexShader:VERT,fragmentShader:FRAG,defines:{HALO:1},...blend}),points=new THREE.Points(geo,mat);points.frustumCulled=!1,points.renderOrder=20,points.name="bubble-logo";const halo=new THREE.Points(geo,haloMat);halo.frustumCulled=!1,halo.renderOrder=19,halo.name="bubble-logo-halo";const _sz=new THREE.Vector2;points.onBeforeRender=halo.onBeforeRender=(renderer,scene,camera)=>{const rt=renderer.getRenderTarget(),h=rt?rt.height:renderer.getDrawingBufferSize(_sz).y;U.uPx.value=h*.5*camera.projectionMatrix.elements[5]};const inner=new THREE.Group;inner.add(halo,points);const group=new THREE.Group;group.name="bubble-logo-group",group.add(inner);const _v=new THREE.Vector3,_l=new THREE.Vector3,NS=12,PW={pos:new THREE.Vector3,vel:new THREE.Vector3,has:!1,s:0,k:0,d:0,last:new THREE.Vector3,cp:new THREE.Vector3,dir:new THREE.Vector3,hit:new THREE.Vector3},weakest=up=>{let w=1;for(let i=2;i<NS;i++)up[i].w<up[w].w&&(w=i);return w};function pointerStep(state,cam,dt){const up=U.uPtr.value,uv=U.uPtrV.value,ptr=state.pointer,R=tune.pointerRadius*width,tau=Math.max(.05,tune.pointerReturn/3);U.uPtrR.value=R,U.uPtrPush.value=tune.pointerPush*width*tune.pointer,U.uPtrSwirl.value=tune.pointerSwirl,U.uPtrDrag.value=tune.pointerDrag,U.uPtrLight.value=tune.pointerLight*Math.min(1,tune.pointer);const k=Math.exp(-dt/tau);for(let i=1;i<NS;i++)up[i].w*=k;let on=!1;if(cam&&ptr&&ptr.active&&tune.pointer>0&&isFinite(ptr.x)&&isFinite(ptr.y)){cam.getWorldPosition(PW.cp),PW.dir.set(ptr.x,ptr.y,.5).unproject(cam).sub(PW.cp).normalize();const dn=PW.dir.dot(U.uCamF.value);if(dn>1e-4){const tHit=PW.hit.copy(U.uCenterW.value).sub(PW.cp).dot(U.uCamF.value)/dn;PW.hit.copy(PW.cp).addScaledVector(PW.dir,tHit),PW.has||(PW.pos.copy(PW.hit),PW.last.copy(PW.hit),PW.vel.set(0,0,0),PW.has=!0,PW.s=0,PW.k=0,PW.d=0),dt>0&&(_l.copy(PW.hit).sub(PW.pos).multiplyScalar(1/dt),PW.vel.lerp(_l,1-Math.exp(-dt/.08))),PW.pos.copy(PW.hit),on=!0;const speed=PW.vel.length()/width,kTarget=1-Math.min(1,Math.max(0,(speed-.4)/Math.max(.1,tune.pointerKickFast-.4)));if(PW.k+=(kTarget-PW.k)*(1-Math.exp(-dt/.12)),PW.pos.distanceTo(PW.last)>R*.22){const w=weakest(up);PW.s>up[w].w&&(up[w].set(PW.last.x,PW.last.y,PW.last.z,PW.s),uv[w].copy(uv[0])),PW.last.copy(PW.pos),PW.d=0}const sp=Math.min(1,PW.vel.length()/(width*1.2));uv[0].copy(PW.vel).multiplyScalar(sp/Math.max(1e-4,PW.vel.length())),PW.d=Math.min(1,PW.d+dt/Math.max(.05,tune.pointerGrow));const kick=Math.min(1,Math.max(0,tune.pointerKick));PW.s=Math.min(ptr.down?tune.pointerDown:1,kick*PW.k+(1-kick)*PW.d)}}if(!on){if(PW.has&&PW.s>0){const w=weakest(up);PW.s>up[w].w&&up[w].set(PW.last.x,PW.last.y,PW.last.z,PW.s)}PW.has=!1,PW.s=0,PW.k=0,PW.d=0}up[0].set(PW.last.x,PW.last.y,PW.last.z,PW.s);let any=0;for(let i=0;i<NS;i++)any+=up[i].w;U.uPtrAny.value=any}const SI={on:!1,x:0,y:0,px:0,py:0,vx:0,vy:0,dwell:0,inv:new THREE.Matrix4,o:new THREE.Vector3,d:new THREE.Vector3,s:0};function simStep(state,cam,dt){U.uPtrAny.value=0,U.uSimOn.value=1;const M=sim.mat.uniforms,ptr=state.pointer;let on=!1;if(cam&&ptr&&ptr.active&&tune.pointer>0&&isFinite(ptr.x)&&isFinite(ptr.y)&&(inner.updateWorldMatrix(!0,!1),SI.inv.copy(inner.matrixWorld).invert(),cam.getWorldPosition(SI.o),SI.d.set(ptr.x,ptr.y,.5).unproject(cam),SI.o.applyMatrix4(SI.inv),SI.d.applyMatrix4(SI.inv).sub(SI.o),Math.abs(SI.d.z)>1e-6)){const t=-SI.o.z/SI.d.z,x=SI.o.x+SI.d.x*t,y=SI.o.y+SI.d.y*t;if(SI.on&&dt>0){const k=1-Math.exp(-dt/.06);SI.vx+=((x-SI.x)/dt-SI.vx)*k,SI.vy+=((y-SI.y)/dt-SI.vy)*k}else SI.vx=SI.vy=0;SI.x=x,SI.y=y,on=!0}const speed=Math.hypot(SI.vx,SI.vy)/width;SI.dwell=on&&speed<.35?Math.min(1,SI.dwell+dt/Math.max(.1,tune.pointerGrow)):Math.max(0,SI.dwell-dt*1.5);const kick=Math.min(1,Math.max(0,tune.pointerKick)),target=on?tune.pointer*(kick+(1-kick)*SI.dwell)*(ptr.down?tune.pointerDown:1):0;SI.s+=(target-SI.s)*(1-Math.exp(-dt/.08)),SI.on=on,M.uP.value.set(SI.x,SI.y,SI.s),M.uV.value.set(SI.vx,SI.vy),M.uA.value=tune.pointerForce*width,M.uR.value=tune.pointerRadius*width,M.uMax.value=tune.pointerPush*width,M.uDamp.value=Math.max(.5,tune.pointerDamp),M.uK.value=M.uDamp.value*3/Math.max(.3,tune.pointerReturn),M.uSwirl.value=tune.pointerSwirl,M.uDrag.value=tune.pointerDrag;let left=Math.min(.1,Math.max(0,dt));if(left<=0){U.tSim.value=sim.rts[0].texture;return}for(;left>1e-4;){const h=Math.min(left,.016666666666666666);U.tSim.value=sim.step(h),left-=h}}const SM={fx:0,fy:0,sx:0,sy:0,r:new THREE.Vector3,u:new THREE.Vector3};function smearStep(state,cam,dt){const ptr=state.pointer;if(ptr&&isFinite(ptr.x)&&isFinite(ptr.y)&&dt>0&&(SM.fx+=(ptr.x-SM.fx)*(1-Math.exp(-dt/.25)),SM.fy+=(ptr.y-SM.fy)*(1-Math.exp(-dt/.25)),SM.sx+=(ptr.x-SM.sx)*(1-Math.exp(-dt/1)),SM.sy+=(ptr.y-SM.sy)*(1-Math.exp(-dt/1))),!cam){U.uSmear.value.set(0,0,0);return}const e=cam.matrixWorld.elements;SM.r.set(e[0],e[1],e[2]),SM.u.set(e[4],e[5],e[6]);const a=tune.smear*tune.calm*width;U.uSmear.value.copy(SM.r).multiplyScalar((SM.fx-SM.sx)*.05*a).addScaledVector(SM.u,(SM.fy-SM.sy)*.025*a)}let swayT=0,lastTime=null;function update(state={}){const time=state.time||0,dt=state.dt!=null?state.dt:lastTime==null?0:Math.min(.1,Math.max(0,time-lastTime));lastTime=time;const calm=tune.calm,rise=Math.min(1,Math.max(0,state.rise||0));swayT+=dt*tune.swaySpeed*(.4+.6*calm);const sw=tune.sway*Math.PI/180*(.35+.65*calm);inner.rotation.set(tune.pitch+Math.sin(swayT*.83+1.3)*sw*.22,tune.yaw+Math.sin(swayT)*sw,Math.sin(swayT*.61)*sw*.08),inner.scale.z=Math.max(.05,tune.depth),group.updateWorldMatrix(!0,!0);const n=Math.max(500,Math.min(maxCount,tune.count|0));U.uFrac.value=n/maxCount,U.uThick.value=depth0*S*Math.max(.05,tune.depth)/width,U.uCountComp.value=Math.pow(QUALITY.high/n,.3),U.uTime.value=time,U.uSize.value=tune.size,U.uDrift.value=tune.drift*calm,U.uBreath.value=tune.breath*calm,U.uBubbleShare.value=tune.bubbleShare,U.uShedFrac.value=tune.shedRate*.12*(.4+.6*calm),U.uShedSpeed.value=tune.shedSpeed,U.uSurfaceY.value=state.surfaceY!=null?state.surfaceY:0;const s=Math.min(1,rise/.15),e=1-Math.min(1,Math.max(0,(rise-.78)/.22));U.uTrail.value=tune.trail*s*s*(3-2*s)*e*e*(3-2*e),U.uTrailLen.value=tune.trailLen,U.uBokeh.value=tune.bokeh,U.uTwinkle.value=tune.twinkle,U.uPxMin.value=tune.pxMin,U.uGlow.value=tune.glow,U.uRim.value=tune.rim,U.uFringe.value=tune.fringe,U.uAdd.value=Math.min(1,Math.max(0,tune.add)),U.uSpark.value=tune.spark,U.uGlint.value=tune.glint,U.uWhite.value=tune.white,U.uGrad.value=Math.min(.95,Math.max(0,tune.grad)),U.uShade.value=tune.shade,U.uDot.value=tune.dot,U.uThin.value=Math.min(.95,Math.max(0,tune.thin)),U.uThinLit.value=Math.min(.95,Math.max(0,tune.thinLit)),U.uHaloSize.value=Math.max(1,tune.haloSize),U.uHaloFrac.value=Math.min(1,Math.max(0,tune.haloFrac)),U.uHalo.value=tune.halo*.16/(Math.max(1,tune.haloSize)*Math.max(1,tune.haloSize)/49*Math.max(.02,tune.haloFrac)/.18*U.uFrac.value/(QUALITY.high/maxCount)),halo.visible=tune.halo>.001,U.uLight.value.copy(tune.light).normalize(),group.getWorldPosition(U.uCenterW.value);const cam=state.camera;if(cam){cam.getWorldDirection(_v),U.uSquash.value=Math.max(.16,Math.min(1,Math.abs(_v.y)+.12)),_l.copy(U.uLight.value).transformDirection(cam.matrixWorldInverse),U.uLightV.value.copy(_l),U.uCamF.value.copy(_v);const m=Math.hypot(_l.x,_l.y)||1;U.uLight2.value.set(_l.x/m,_l.y/m)}sim?simStep(state,cam,dt):pointerStep(state,cam,dt),smearStep(state,cam,dt)}function setQuality(level){tune.count=QUALITY[level]||QUALITY.high}function dispose(){geo.dispose(),mat.dispose(),haloMat.dispose(),sim?.dispose(),group.parent&&group.parent.remove(group)}return update({time:0,dt:0}),{group,update,setQuality,dispose,tune,points,halo,info:{total,mains,width,height:h0*S,depth:depth0*S,svg:{cx,cy,scale:S},hotShare:hotN/Math.max(1,hotAll)}}}