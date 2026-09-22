/** Aerial-only river surface. The opening droplet / sea materials stay untouched. */
export function createRiverFlowMaterial(THREE, { index = 0, lite = false } = {}) {
  return new THREE.ShaderMaterial({
    name: `Forest river water ${index + 1}`,
    uniforms: {
      uTime: { value: 0 },
      uFocus: { value: index === 1 ? 1 : 0 },
      uReveal: { value: 1 },
      uSeed: { value: index * 13.71 + 4.2 }
    },
    defines: lite ? { FLOW_LITE: 1 } : {},
    transparent: false,
    depthWrite: true,
    side: THREE.FrontSide,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime, uFocus, uReveal, uSeed;
      varying vec2 vUv;
      varying vec3 vWorld;
      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise21(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1,0)), f.x),
                   mix(hash21(i + vec2(0,1)), hash21(i + vec2(1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float n = noise21(p) * .57;
        p = mat2(.8,-.6,.6,.8) * p * 2.03 + 13.7;
        n += noise21(p) * .28;
        #ifndef FLOW_LITE
          p = mat2(.8,-.6,.6,.8) * p * 2.11 + 7.1;
          n += noise21(p) * .15;
        #else
          n += .075;
        #endif
        return n;
      }
      void main() {
        float t = uTime;
        vec2 flow = vec2(vUv.x * 52.0, vUv.y * 3600.0);
        float edge = min(vUv.x, 1.0 - vUv.x);
        // Slow, long eddies move downstream; the finer ripples ride over them.
        vec2 drift = vec2(uSeed, -t * 2.5);
        float eddy = fbm(flow * vec2(.072,.018) + drift * .025);
        vec2 rippleCoords = flow * vec2(.22,.061) + vec2(uSeed,-t*.13);
        float irregular = fbm(rippleCoords);
        float phase = flow.y * (.19 + fract(uSeed)*.061) - t * .95 + irregular * 11.0 + uSeed;
        float wave = sin(phase) * .11 * (.45 + eddy*.55);
        wave += (noise21(rippleCoords*vec2(1.7,2.3)+eddy*3.0)-.5)*.36;
        wave += sin(flow.y*.043 + flow.x*.19 - t*.38 + eddy*7.0)*.18;
        // Derivative normal follows the actual curved ribbon, not a global plane.
        vec3 displaced = vWorld + vec3(0.0, wave, 0.0);
        vec3 N = normalize(cross(dFdx(displaced), dFdy(displaced)));
        if (N.y < 0.0) N = -N;
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 R = reflect(-V, N);
        float fresnel = .055 + .58 * pow(1.0 - max(dot(N,V), 0.0), 4.0);
        float shallows = 1.0 - smoothstep(.015,.21,edge);
        vec3 deep = vec3(.010,.039,.050);
        vec3 water = mix(deep, vec3(.029,.089,.094), shallows * .55);
        water *= .85 + eddy * .38;
        // Dark foliage reflected at each bank gives the channel visual depth.
        float leafReflection = fbm(vec2(flow.x*.14,flow.y*.035)+uSeed);
        float bankShade = (1.0 - smoothstep(.025,.25,edge)) * (.33 + leafReflection*.30);
        water *= 1.0 - bankShade;
        // Soft reflected sky, with broad moving breaks rather than one bright stripe.
        float skyPatch = fbm(vWorld.xz * .006 + vec2(R.x,R.z)*2.0 + vec2(uSeed,0));
        float openSky = smoothstep(.31,.74,skyPatch);
        vec3 sky = mix(vec3(.085,.137,.162), vec3(.39,.51,.56), openSky);
        float reflectedSky = (.15 + fresnel*.62) * smoothstep(.025,.22,edge);
        water = mix(water, sky, reflectedSky);
        vec3 lightDir = normalize(vec3(-.38,.88,.29));
        vec3 H = normalize(V + lightDir);
        float broad = pow(max(dot(N,H),0.0), 22.0);
        float fine = pow(max(dot(N,H),0.0), 84.0);
        float shimmer = (broad*.075 + fine*.10) * (.25+openSky*.75) * (.45+irregular*.55);
        water += vec3(.56,.71,.76) * shimmer;
        // Foam is intermittent and breaks into elongated flecks; no continuous curb.
        float ragged = noise21(vec2(flow.x*.6,flow.y*.17-t*.28)+uSeed);
        float foamEdge = .045 + noise21(vec2(flow.y*.073,uSeed))*.042;
        float bankMask = 1.0-smoothstep(foamEdge*.25,foamEdge+ .045,edge);
        float foamPatches = smoothstep(.40,.69,fbm(vec2(flow.x*.28,flow.y*.10-t*.09)+uSeed));
        float froth = smoothstep(.43,.78,ragged + sin(flow.y*1.8-t*2.0)*.11);
        float foam = bankMask * foamPatches * (.25 + froth*.65);
        water = mix(water,vec3(.46,.61,.60),foam*.74);
        // A wide, softly interrupted flow caustic guides the eye down the chosen river.
        float focusCenter = .46 + sin(flow.y*.009+uSeed)*.12 + (eddy-.5)*.16;
        float focusWidth = .13 + eddy*.11;
        float focusRibbon = exp(-pow((vUv.x-focusCenter)/focusWidth,2.0));
        float movingLight = smoothstep(.39,.72,fbm(vec2(flow.x*.027,flow.y*.006-t*.055)+uSeed));
        float accent = clamp(uFocus,0.0,1.0) * focusRibbon * movingLight * .13;
        water += vec3(.23,.45,.52)*accent;
        water *= mix(.72,1.0,clamp(uReveal,0.0,1.0));
        gl_FragColor = vec4(water,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
}
