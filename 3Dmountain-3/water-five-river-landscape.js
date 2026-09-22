// Five shared river valleys. The terrain and the moving water use these same
// coordinates, so the water follows a carved riverbed rather than crossing it.
const TAU = Math.PI * 2;
const clamp01 = n => Math.max(0, Math.min(1, n));
const smooth = (a, b, n) => { const t = clamp01((n - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = n => n - Math.floor(n);
function hash(x, y) { return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123); }
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function ridges(x, y) {
  let value = 0, weight = .57, previous = 1;
  for (let k = 0; k < 3; k++) {
    let r = 1 - Math.abs(noise(x, y) * 2 - 1);
    r *= r;
    value += r * weight * (.42 + previous * .58);
    previous = r;
    const nx = x * 1.83 - y * .61 + 7.2;
    y = x * .61 + y * 1.83 - 4.7; x = nx; weight *= .48;
  }
  return value;
}
function channelX(i, y) {
  const t = (y + 26) / 53, phase = i * .70;
  // Independent large bends with a shared gentle drift preserve the five
  // catchments while avoiding five synchronized parallel watercourses.
  return (i - 2) * 8 + Math.sin(t * TAU * 2.15 + phase - .35) * 2.1
    + Math.sin(t * TAU * 1.05 - .5) * .70
    + Math.sin(t * TAU * 3.1 + phase * 1.3) * .18;
}
function bedHeight(y) { return .26 + (y + 27) * .009 + Math.sin(y * .18) * .045; }

export function createRiverLandscape(THREE, { lite = false } = {}) {
  const group = new THREE.Group();
  group.name = 'Five valleys · contour landscape';

  const peaks = [
    [-3, 20, 8.0, 6.8, 8.6], [-13, 17, 5.8, 6.4, 9.4],
    [13, 23, 5.8, 7.1, 8.3],
    [19, 11, 4.8, 7.5, 11.0], [-22, 1, 3.9, 8.0, 12.0],
    [-1, 2, 5.2, 8.0, 12.0], [12, -10, 3.7, 9.0, 12.0],
    [-12, -20, 3.6, 9.0, 9.0], [23, -23, 3.0, 8.0, 9.0],
    [1, -26, 2.8, 8.0, 10.0],
  ];

  function heightAt(x, y) {
    let distance = 100;
    for (let i = 0; i < 5; i++) distance = Math.min(distance, Math.abs(x - channelX(i, y)));
    // Broad overlapping massifs make a landscape, rather than a row of
    // identical canyon walls. High-frequency needles are deliberately absent.
    let massif = 0, shoulder = 0;
    for (const peak of peaks) {
      const dx = (x - peak[0]) / peak[3], dy = (y - peak[1]) / peak[4];
      const h = peak[2] * Math.exp(-(dx * dx + dy * dy) * .72);
      if (h > massif) { shoulder = massif; massif = h; }
      else shoulder = Math.max(shoulder, h);
    }
    const ridge = ridges(x * .135 + 8.7, y * .12 - 4.2);
    const mediumRidge = ridges(x * .30 - 14.3, y * .26 + 9.1);
    const crags = mediumRidge * 1.08 * smooth(1.6, 3.2, massif);
    const mountains = (.32 + massif + shoulder * .075) * (.72 + ridge * .44) + crags;
    const valley = Math.pow(smooth(.42, 3.75, distance), .92);
    const shoreline = smooth(.34, .86, distance) * .07;
    return bedHeight(y) + mountains * valley + shoreline;
  }
  function riverPoint(i, t, out) {
    const y = -26 + clamp01(t) * 53, x = channelX(i, y);
    return out.set(x, y, bedHeight(y) + .06);
  }

  const columns = lite ? 145 : 218, rows = lite ? 171 : 252;
  const geometry = new THREE.PlaneGeometry(48, 56, columns, rows);
  const positions = geometry.attributes.position;
  let minHeight = Infinity, maxHeight = -Infinity;
  for (let j = 0; j < positions.count; j++) {
    const x = positions.getX(j), y = positions.getY(j) + 1;
    const z = heightAt(x, y);
    positions.setXYZ(j, x, y, z);
    minHeight = Math.min(minHeight, z); maxHeight = Math.max(maxHeight, z);
  }
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const uniforms = { uOpacity: { value: 1 }, uTime: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: true, side: THREE.DoubleSide,
    uniforms,
    vertexShader: /* glsl */`
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying float vDistance;
      void main() {
        vPosition = position;
        vNormal = normal;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDistance = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uOpacity;
      uniform float uTime;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying float vDistance;
      float line(float p, float width) {
        float footprint = max(fwidth(p), .0001);
        float d = abs(fract(p - .5) - .5) / footprint;
        float resolved = 1.0 - smoothstep(.30, .70, footprint);
        return (1.0 - smoothstep(.22 + width, .95 + width, d)) * resolved;
      }
      float hashRock(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float rockNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hashRock(i), hashRock(i + vec2(1.0, 0.0)), f.x),
                   mix(hashRock(i + vec2(0.0, 1.0)), hashRock(i + 1.0), f.x), f.y);
      }
      void main() {
        vec3 n = normalize(vNormal);
        float h = vPosition.z;
        float elevation = smoothstep(.8, 7.6, h);
        float light = max(dot(n, normalize(vec3(-.55, -.32, .83))), 0.0);
        float slope = 1.0 - max(n.z, 0.0);
        float grain = rockNoise(vPosition.xy * 3.7 + h * .43);
        float broad = rockNoise(vPosition.xy * .29 + h * .17);
        float bedding = h * 3.1 + vPosition.y * .075 + broad * 1.8;
        float stratum = smoothstep(.66, .94, abs(sin(bedding)));

        // The same daylight silver-blue stone as the first-person canyon:
        // wet blue recesses, solid mineral faces, and softly lit pale ridges.
        vec3 valley = vec3(.028, .057, .086);
        vec3 peak = vec3(.235, .300, .347);
        vec3 base = mix(valley, peak, pow(elevation, .76));
        base *= (.48 + light * .72) * (.87 + broad * .17 + grain * .10);
        base *= 1.0 - stratum * (.065 + slope * .085);
        float wet = (1.0 - smoothstep(.55, 2.3, h)) * (.5 + slope * .5);
        base = mix(base, base * vec3(.64, .76, .86), wet * .45);
        float shoulder = smoothstep(.55, .92, light) * smoothstep(2.7, 7.1, h);
        base += vec3(.055, .067, .074) * shoulder * (.56 + broad * .44);

        // Restrained etched contours describe the relief without introducing
        // a luminous wireframe or a second visual language.
        float contour = line(h * 3.4 + broad * .09, .012);
        float contourWeight = contour * (.013 + light * .014);
        base = mix(base, base * .72 + vec3(.018, .027, .034), contourWeight);

        float edge = (1.0 - smoothstep(21.7, 24.0, abs(vPosition.x)))
                   * smoothstep(-27.0, -23.6, vPosition.y)
                   * (1.0 - smoothstep(25.3, 29.0, vPosition.y));
        float mist = smoothstep(34.0, 84.0, vDistance) * .48;
        base = mix(base, vec3(.462, .571, .679), mist);
        gl_FragColor = vec4(base, edge * uOpacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Carved ridgelines';
  // Draw fading land before transparent water so water retains proper depth.
  mesh.renderOrder = -1;
  group.add(mesh);
  function update(opacity, time = 0, reduced = false) {
    uniforms.uOpacity.value = clamp01(opacity);
    uniforms.uTime.value = reduced ? 0 : time;
    group.visible = opacity > .001;
  }
  function dispose() { geometry.dispose(); material.dispose(); }
  return { group, riverPoint, heightAt, update, dispose, stats: {
    vertices: positions.count, triangles: columns * rows * 2,
    rivers: 5, minHeight, maxHeight,
  } };
}
