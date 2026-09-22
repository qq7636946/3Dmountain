/** Five independently flowing silver-blue rivers, sharing one liquid finish throughout the journey. */
export function createConfluenceMaterial(THREE, { index = 0 } = {}) {
  return new THREE.ShaderMaterial({
    name: 'Confluence liquid ' + (index + 1),
    uniforms: {
      uTime: { value: 0 },
      uFocus: { value: 0 },
      uOpacity: { value: 1 },
      uMerge: { value: 0 },
      uSeed: { value: 3.27 + index * 7.139 },
      uSpeed: { value: .69 + index * .067 }
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    toneMapped: true,
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
      uniform float uTime, uFocus, uOpacity, uMerge, uSeed, uSpeed;
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
        return mix(mix(hash21(i), hash21(i + vec2(1.0,0.0)), f.x),
                   mix(hash21(i + vec2(0.0,1.0)), hash21(i + vec2(1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float n = noise21(p) * .57;
        p = mat2(.8,-.6,.6,.8) * p * 2.03 + 13.7;
        n += noise21(p) * .28;
        p = mat2(.8,-.6,.6,.8) * p * 2.11 + 7.1;
        n += noise21(p) * .15;
        return n;
      }
      float gaussian(float x, float width) {
        return exp(-x * x / max(width * width, .00001));
      }
      void main() {
        float merge = clamp(uMerge, 0.0, 1.0);
        float focus = clamp(uFocus, 0.0, 1.0);
        float clock = uTime * uSpeed;
        vec2 flow = vec2(vUv.x * 4.6, vUv.y * 29.0 - clock);
        float eddy = fbm(flow * vec2(.46,.38) + vec2(uSeed, uSeed * .37));
        float ripple = fbm(flow * vec2(1.5,1.08) + eddy * 1.8 + uSeed);
        float rolling = sin(vUv.y * 40.0 - clock * 3.1 + ripple * 8.0 + uSeed);
        float crossWave = sin(vUv.x * 13.0 + eddy * 8.0 + vUv.y * 19.0 - clock * .8);
        float wave = rolling * .009 + crossWave * .006 + (ripple - .5) * .015;

        // Derivative normals follow both the valley surface and the gathering curves.
        vec3 baseNormal = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
        vec3 V = normalize(cameraPosition - vWorld);
        if (dot(baseNormal, V) < 0.0) baseNormal = -baseNormal;
        vec3 surface = vWorld + baseNormal * wave;
        vec3 N = normalize(cross(dFdx(surface), dFdy(surface)));
        if (dot(N, V) < 0.0) N = -N;
        float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        float edge = min(vUv.x, 1.0 - vUv.x);
        float edgeWidth = .052 + .018 * noise21(vec2(vUv.y * 44.0, uSeed));
        float alpha = smoothstep(.001, edgeWidth, edge);
        alpha *= smoothstep(0.0, mix(.012,.16,merge), vUv.y)
          * smoothstep(0.0, .025, 1.0 - vUv.y);
        alpha *= clamp(uOpacity, 0.0, 1.0);
        if (alpha < .002) discard;

        // The original droplet's blue depth, silver sky reflections and clear edge
        // remain one material: merging changes its shape, never its palette.
        vec3 deep = vec3(.023, .051, .079);
        vec3 blue = vec3(.105, .190, .260);
        vec3 silver = vec3(.67, .78, .84);
        vec3 paleSky = vec3(.82, .89, .93);
        vec3 water = mix(deep, blue, .22 + eddy * .54);
        float broadCenter = .37 + sin(vUv.y * 9.0 + uSeed) * .12 + (eddy - .5) * .22;
        float reflectedBand = gaussian(vUv.x - broadCenter, .17 + ripple * .10);
        float skyBreak = smoothstep(.23, .79,
          fbm(vec2(vUv.x * 2.4, vUv.y * 11.0 - clock * .38) + uSeed));
        float shoulder = gaussian(edge - (.085 + eddy * .050), .070);
        float silverReflection = reflectedBand * (.20 + skyBreak * .56)
          + shoulder * (.24 + ripple * .20);
        water = mix(water, silver, clamp(silverReflection, 0.0, .84));

        // Broad reflected light gives a wet surface without a luminous centerline.
        vec3 R = reflect(-V, N);
        float sky = smoothstep(-.3, .85, R.y) * .12;
        water = mix(water, paleSky, sky + fresnel * .30);
        vec3 H = normalize(V + normalize(vec3(-.38, .62, .72)));
        float broadSpec = pow(max(dot(N, H), 0.0), 15.0);
        float fineSpec = pow(max(dot(N, H), 0.0), 72.0);
        float specular = (broadSpec * .16 + fineSpec * .36) * (.35 + ripple * .65);
        water = mix(water, paleSky, specular);

        // Broken silver streamlets travel at a distinct speed in each river.
        float filamentCenter = .35 + (eddy - .5) * .37
          + sin(vUv.y * 23.0 + uSeed) * .055;
        float filament = gaussian(vUv.x - filamentCenter, .021 + ripple * .020);
        float flecks = smoothstep(.52, .79,
          fbm(flow * vec2(1.1,.58) + vec2(17.3, uSeed)));
        float secondary = gaussian(vUv.x - (.77 - eddy * .24), .027)
          * smoothstep(.51,.72,ripple);
        float current = clamp(filament * flecks * .66 + secondary * .20, 0.0, .74);
        water = mix(water, paleSky, current);
        water *= .97 + focus * .065;

        float coverage = .92 + fresnel * .05;
        gl_FragColor = vec4(water, alpha * coverage);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
}
