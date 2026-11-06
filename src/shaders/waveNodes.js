import * as THREE from 'three/webgpu';
import {
  Fn,
  uniform,
  float,
  vec2,
  vec3,
  vec4,
  color,
  sin,
  cos,
  mix,
  clamp,
  length,
  max,
  abs,
  sqrt,
  pow,
  smoothstep,
  normalize,
  cross,
  floor,
  mod,
  positionLocal,
  normalLocal,
  normalView,
  attribute
} from 'three/tsl';

/**
 * Initializes reactive uniforms for animation, touch interaction, and GPU morphing
 */
export function createWaveUniforms(config) {
  const totalCount = config.grid.countX * config.grid.countZ;

  return {
    uTime: uniform(0.0),
    uSpeed: uniform(config.wave.speed),
    uFrequency: uniform(config.wave.frequency),
    uAmplitude: uniform(config.wave.heightAmplitude),
    uChebyshev: uniform(config.wave.chebyshevFactor),
    uRippleCenter: uniform(new THREE.Vector2(0, 0)),
    uRippleTime: uniform(-999.0),
    uRippleSpeed: uniform(config.wave.rippleSpeed),
    uRippleDecay: uniform(config.wave.rippleDecay),
    uRippleHeight: uniform(config.wave.rippleHeight),

    // Grid Dimensions
    uCountX: uniform(float(config.grid.countX)),
    uCountZ: uniform(float(config.grid.countZ)),
    uTotalInstances: uniform(float(totalCount)),

    // Morphing State Uniforms
    uMorphProgress: uniform(0.0),
    uSourceShape: uniform(0.0), // 0.0: Grid, 1.0: Sphere, 2.0: Torus
    uTargetShape: uniform(0.0),
    uSphereRadius: uniform(13.2),
    uTorusRadius: uniform(13.5),
    uTorusTube: uniform(4.6),

    // Vibrant Chromatic Signatures per Topological Shape
    // Shape 0 (Grid): Deep Obsidian & Warm Champagne Gold
    uColor0Primary: uniform(new THREE.Color('#0e0e13')),
    uColor0Accent: uniform(new THREE.Color('#f0c986')),

    // Shape 1 (Fibonacci Sphere): Deep Obsidian Jade & Luminous Quantum Cyan
    uColor1Primary: uniform(new THREE.Color('#061410')),
    uColor1Accent: uniform(new THREE.Color('#38f2c6')),

    // Shape 2 (Toroidal Ring): Dark Smoked Titanium & Electric Cyber Violet
    uColor2Primary: uniform(new THREE.Color('#10091b')),
    uColor2Accent: uniform(new THREE.Color('#bf75ff')),
  };
}

/**
 * Procedural TSL Displacement Node:
 * All forms are centered at Y = 0.0 for dead-center camera framing.
 * Sphere and Torus feature architectural tile scaling (py * 0.45) to eliminate hedgehog needles
 * and 2D grid wrapping for pristine mathematical symmetry.
 */
export function createKineticDisplacementNode(uniforms) {
  return Fn(() => {
    // Packed instance data: [posX, posZ, instanceIdx, distFromOrigin]
    const instData = attribute('aInstanceData', 'vec4');
    const posX = instData.x;
    const posZ = instData.y;
    const idx = instData.z;
    const dist = instData.w;

    const N = uniforms.uTotalInstances;
    const countX = uniforms.uCountX;
    const countZ = uniforms.uCountZ;

    const px = positionLocal.x;
    const py = positionLocal.y;
    const pz = positionLocal.z;

    // ==========================================
    // 1. SHAPE 0: PLANAR HARMONIC GRID (Y = 0.0)
    // ==========================================
    const phase0 = dist.mul(uniforms.uFrequency).sub(uniforms.uTime.mul(uniforms.uSpeed));
    const wave1 = sin(phase0);
    const wave2 = cos(phase0.mul(0.5).add(posX.mul(0.12))).mul(uniforms.uChebyshev);
    let height0 = wave1.add(wave2).mul(uniforms.uAmplitude);

    // Radial touch shockwave
    const deltaRipple = vec2(posX, posZ).sub(uniforms.uRippleCenter);
    const distToRipple = length(deltaRipple);
    const timeSinceRipple = max(uniforms.uTime.sub(uniforms.uRippleTime), float(0.0));
    const waveFront = timeSinceRipple.mul(uniforms.uRippleSpeed);
    const distFromFront = abs(distToRipple.sub(waveFront));

    const rippleDecay = sin(clamp(timeSinceRipple.mul(uniforms.uRippleDecay), float(0.0), float(3.14159)));
    const rippleShape = cos(distFromFront.mul(1.6));
    const isClose = clamp(float(2.8).sub(distFromFront), float(0.0), float(1.0));
    const rippleEffect = rippleShape.mul(rippleDecay).mul(uniforms.uRippleHeight).mul(isClose);
    height0 = height0.add(rippleEffect);

    // Dynamic tilt along wave gradient
    const gradX = cos(phase0).mul(uniforms.uFrequency).mul(posX.div(dist.add(0.001)));
    const gradZ = cos(phase0).mul(uniforms.uFrequency).mul(posZ.div(dist.add(0.001)));
    const tiltOffsetY = px.mul(gradX.mul(0.15)).add(pz.mul(gradZ.mul(0.15)));

    const pos0 = vec3(posX.add(px), height0.add(py).add(tiltOffsetY), posZ.add(pz));

    // ==========================================
    // 2. SHAPE 1: FIBONACCI GEODESIC CORE (CENTERED AT Y = 0.0)
    // ==========================================
    // Golden angle distribution on unit sphere: phi = pi * (3 - sqrt(5)) ~= 2.3999632
    const y_s = float(1.0).sub(idx.mul(2.0).add(1.0).div(N));
    const r_s = sqrt(max(float(0.001), float(1.0).sub(y_s.mul(y_s))));
    const theta_s = idx.mul(float(2.3999632));
    const normSphere = vec3(cos(theta_s).mul(r_s), y_s, sin(theta_s).mul(r_s));

    // Dynamic latitude/longitude wave ripple across the sphere
    const sphereWave = sin(normSphere.y.mul(4.5).sub(uniforms.uTime.mul(2.2)))
      .mul(cos(theta_s.mul(3.0).add(uniforms.uTime.mul(1.2))))
      .mul(1.4);

    const radSphere = uniforms.uSphereRadius.add(sphereWave).add(rippleEffect.mul(0.8));

    // Proportional tile compression: scales thickness to 0.45 so blocks look like
    // sleek faceted kinetic plates rather than long spiky needles
    const pySphere = py.mul(0.45);

    // Tangent coordinate frame for normal alignment
    const upRef = vec3(0.0, 1.0, 0.0);
    const tangentS = normalize(cross(normSphere, upRef));
    const bitangentS = cross(normSphere, tangentS);
    const localOrientedS = tangentS.mul(px).add(normSphere.mul(pySphere)).add(bitangentS.mul(pz));

    // Center placed exactly at Y = 0.0 for dead-center viewport framing
    const pos1 = normSphere.mul(radSphere).add(localOrientedS);

    // ==========================================
    // 3. SHAPE 2: VIBRANT TOROIDAL VORTEX (CENTERED AT Y = 0.0)
    // ==========================================
    // Seamless 2D grid parameterization (u, v) mapped to torus surface
    const colTorus = idx.mod(countX);
    const rowTorus = floor(idx.div(countX));

    const angleU = colTorus.div(countX).mul(float(6.2831853)).add(uniforms.uTime.mul(0.45));
    const angleV = rowTorus.div(countZ).mul(float(6.2831853)).add(uniforms.uTime.mul(0.9));

    // Helical harmonic wave travelling through the torus ring
    const torusWave = sin(angleU.mul(3.0).add(angleV.mul(2.0)).sub(uniforms.uTime.mul(2.4))).mul(0.85);

    const radTube = uniforms.uTorusTube.add(torusWave).add(rippleEffect.mul(0.6));
    const radMajor = uniforms.uTorusRadius;

    const cosU = cos(angleU);
    const sinU = sin(angleU);
    const cosV = cos(angleV);
    const sinV = sin(angleV);

    // Torus center coordinate (Centered at Y = 0.0)
    const torusX = radMajor.add(radTube.mul(cosV)).mul(cosU);
    const torusZ = radMajor.add(radTube.mul(cosV)).mul(sinU);
    const torusY = radTube.mul(sinV);

    // Normal and tangent frame along torus ring
    const normTorus = vec3(cosV.mul(cosU), sinV, cosV.mul(sinU));
    const tangMajor = vec3(sinU.negate(), float(0.0), cosU);
    const tangTube = vec3(sinV.negate().mul(cosU), cosV, sinV.negate().mul(sinU));

    const pyTorus = py.mul(0.45);
    const localOrientedT = tangMajor.mul(px).add(normTorus.mul(pyTorus)).add(tangTube.mul(pz));

    const pos2 = vec3(torusX, torusY, torusZ).add(localOrientedT);

    // ==========================================
    // 4. GPU ANALYTIC MORPH INTERPOLATION
    // ==========================================
    const getShapePosition = (shapeId) => {
      const isGridToSphere = clamp(shapeId, float(0.0), float(1.0));
      const pos0to1 = mix(pos0, pos1, isGridToSphere);
      const isSphereToTorus = clamp(shapeId.sub(1.0), float(0.0), float(1.0));
      return mix(pos0to1, pos2, isSphereToTorus);
    };

    const sourcePos = getShapePosition(uniforms.uSourceShape);
    const targetPos = getShapePosition(uniforms.uTargetShape);

    // Smooth Hermite cubic interpolation
    const morphWeight = smoothstep(float(0.0), float(1.0), uniforms.uMorphProgress);
    const finalPos = mix(sourcePos, targetPos, morphWeight);

    return finalPos;
  })();
}

/**
 * Procedural TSL Color Node with Luminous Silhouette Fresnel Sheen:
 * Guarantees that the silhouette of the sphere and torus catches an incandescent rim glow
 * even on the shadow side, transforming dark silhouettes into luxury illuminated sculptures.
 */
export function createKineticColorNode(uniforms) {
  return Fn(() => {
    const instData = attribute('aInstanceData', 'vec4');
    const posX = instData.x;
    const posZ = instData.y;
    const dist = instData.w;

    // View-space Fresnel silhouette glow (grazing angles illuminate the outer edges)
    const viewNormalZ = clamp(normalView.z, float(0.0), float(1.0));
    const fresnelRim = pow(float(1.0).sub(viewNormalZ), float(2.8));

    // Harmonic wave elevation indicator
    const phase = dist.mul(uniforms.uFrequency).sub(uniforms.uTime.mul(uniforms.uSpeed));
    const waveElevation = clamp(sin(phase).mul(0.5).add(0.5), float(0.0), float(1.0));

    // Accentuate top bevels
    const isTopBevel = clamp(normalLocal.y.sub(0.6).mul(2.5), float(0.0), float(1.0));
    const highlight = clamp(waveElevation.mul(0.5).add(isTopBevel.mul(0.7)), float(0.0), float(1.0));

    // Palette 0: Grid (Deep Obsidian + Rich Champagne Gold)
    const baseCol0 = mix(uniforms.uColor0Primary, uniforms.uColor0Accent, highlight);
    const col0 = mix(baseCol0, uniforms.uColor0Accent, fresnelRim.mul(0.45));

    // Palette 1: Sphere (Deep Jade + Luminous Quantum Cyan Glow)
    const baseCol1 = mix(uniforms.uColor1Primary, uniforms.uColor1Accent, highlight);
    const col1 = mix(baseCol1, uniforms.uColor1Accent, fresnelRim.mul(0.65));

    // Palette 2: Torus (Dark Titanium + Incandescent Electric Violet)
    const baseCol2 = mix(uniforms.uColor2Primary, uniforms.uColor2Accent, highlight);
    const col2 = mix(baseCol2, uniforms.uColor2Accent, fresnelRim.mul(0.65));

    // Helper to sample palette by shape ID
    const getPaletteColor = (shapeId) => {
      const isGridToSphere = clamp(shapeId, float(0.0), float(1.0));
      const col0to1 = mix(col0, col1, isGridToSphere);
      const isSphereToTorus = clamp(shapeId.sub(1.0), float(0.0), float(1.0));
      return mix(col0to1, col2, isSphereToTorus);
    };

    const sourceCol = getPaletteColor(uniforms.uSourceShape);
    const targetCol = getPaletteColor(uniforms.uTargetShape);

    const morphWeight = smoothstep(float(0.0), float(1.0), uniforms.uMorphProgress);
    return mix(sourceCol, targetCol, morphWeight);
  })();
}
