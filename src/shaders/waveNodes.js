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
  smoothstep,
  normalize,
  cross,
  positionLocal,
  normalLocal,
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

    // Morphing State Uniforms
    uMorphProgress: uniform(0.0),
    uSourceShape: uniform(0.0), // 0.0: Grid, 1.0: Sphere, 2.0: Torus
    uTargetShape: uniform(0.0),
    uTotalInstances: uniform(totalCount),
    uSphereRadius: uniform(12.5),
    uTorusRadius: uniform(13.8),
    uTorusTube: uniform(4.2),

    // Chromatic Signatures per Topological Shape
    // Shape 0 (Grid): Obsidian & Champagne Gold
    uColor0Primary: uniform(new THREE.Color('#121217')),
    uColor0Accent: uniform(new THREE.Color('#e2ba7d')),

    // Shape 1 (Fibonacci Sphere): Deep Obsidian Jade & Quantum Cyan
    uColor1Primary: uniform(new THREE.Color('#081512')),
    uColor1Accent: uniform(new THREE.Color('#4ee1c2')),

    // Shape 2 (Toroidal Ring): Smoked Titanium & Electric Cyber Violet
    uColor2Primary: uniform(new THREE.Color('#120c1a')),
    uColor2Accent: uniform(new THREE.Color('#b66aff')),
  };
}

/**
 * Procedural TSL Displacement Node:
 * Calculates analytic positions & normal-aligned rotations for Grid, Fibonacci Sphere, and Torus,
 * smoothly interpolating on the GPU with zero VRAM/RAM overhead.
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
    const px = positionLocal.x;
    const py = positionLocal.y;
    const pz = positionLocal.z;

    // ==========================================
    // 1. SHAPE 0: PLANAR HARMONIC GRID
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
    const isClose = clamp(float(2.5).sub(distFromFront), float(0.0), float(1.0));
    const rippleEffect = rippleShape.mul(rippleDecay).mul(uniforms.uRippleHeight).mul(isClose);
    height0 = height0.add(rippleEffect);

    // Subtle tilt along wave gradient
    const gradX = cos(phase0).mul(uniforms.uFrequency).mul(posX.div(dist.add(0.001)));
    const gradZ = cos(phase0).mul(uniforms.uFrequency).mul(posZ.div(dist.add(0.001)));
    const tiltOffsetY = px.mul(gradX.mul(0.15)).add(pz.mul(gradZ.mul(0.15)));

    const pos0 = vec3(posX.add(px), height0.add(py).add(tiltOffsetY), posZ.add(pz));

    // ==========================================
    // 2. SHAPE 1: FIBONACCI SPHERICAL LATTICE
    // ==========================================
    // Golden angle distribution on sphere: phi = pi * (3 - sqrt(5)) ~= 2.3999632
    const y_s = float(1.0).sub(idx.mul(2.0).add(1.0).div(N));
    const r_s = sqrt(max(float(0.001), float(1.0).sub(y_s.mul(y_s))));
    const theta_s = idx.mul(float(2.3999632));
    const normSphere = vec3(cos(theta_s).mul(r_s), y_s, sin(theta_s).mul(r_s));

    // Harmonic pulse along sphere surface
    const spherePulse = sin(uniforms.uTime.mul(2.4).add(idx.mul(0.05))).mul(1.1);
    const radSphere = uniforms.uSphereRadius.add(spherePulse).add(rippleEffect.mul(0.8));

    // Dynamic normal alignment: align prism height (py) along normSphere
    const upVec = vec3(0.0, 1.0, 0.0);
    const tangentS = normalize(cross(normSphere, upVec));
    const bitangentS = cross(normSphere, tangentS);
    const orientedS = tangentS.mul(px).add(normSphere.mul(py)).add(bitangentS.mul(pz));

    // Center elevated at Y = 11.5
    const pos1 = normSphere.mul(radSphere).add(vec3(0.0, 11.5, 0.0)).add(orientedS);

    // ==========================================
    // 3. SHAPE 2: HELICAL TORUS VORTEX
    // ==========================================
    const angleU = idx.div(N).mul(float(6.2831853 * 2.0)).add(uniforms.uTime.mul(0.75));
    const angleV = idx.div(N).mul(float(6.2831853 * 16.0)).add(uniforms.uTime.mul(1.5));

    const torusTubePulse = sin(uniforms.uTime.mul(2.5).add(angleU.mul(2.0))).mul(0.5);
    const radTube = uniforms.uTorusTube.add(torusTubePulse).add(rippleEffect.mul(0.6));
    const radMajor = uniforms.uTorusRadius;

    const cosV = cos(angleV);
    const sinV = sin(angleV);
    const cosU = cos(angleU);
    const sinU = sin(angleU);

    const torusSurfaceX = radMajor.add(radTube.mul(cosV)).mul(cosU);
    const torusSurfaceZ = radMajor.add(radTube.mul(cosV)).mul(sinU);
    const torusSurfaceY = radTube.mul(sinV).add(11.5);

    // Torus surface orientation frame
    const normTorus = vec3(cosV.mul(cosU), sinV, cosV.mul(sinU));
    const tangentTorus = vec3(sinU.negate(), float(0.0), cosU);
    const bitangentTorus = cross(normTorus, tangentTorus);
    const orientedT = tangentTorus.mul(px).add(normTorus.mul(py)).add(bitangentTorus.mul(pz));

    const pos2 = vec3(torusSurfaceX, torusSurfaceY, torusSurfaceZ).add(orientedT);

    // ==========================================
    // 4. GPU ANALYTIC MORPH INTERPOLATION
    // ==========================================
    // Helper to evaluate position for a shape id [0.0 = Grid, 1.0 = Sphere, 2.0 = Torus]
    const getShapePosition = (shapeId) => {
      const isGridToSphere = clamp(shapeId, float(0.0), float(1.0));
      const pos0to1 = mix(pos0, pos1, isGridToSphere);
      const isSphereToTorus = clamp(shapeId.sub(1.0), float(0.0), float(1.0));
      return mix(pos0to1, pos2, isSphereToTorus);
    };

    const sourcePos = getShapePosition(uniforms.uSourceShape);
    const targetPos = getShapePosition(uniforms.uTargetShape);

    // Smooth cubic Hermite interpolation curve
    const morphWeight = smoothstep(float(0.0), float(1.0), uniforms.uMorphProgress);
    const finalPos = mix(sourcePos, targetPos, morphWeight);

    return finalPos;
  })();
}

/**
 * Procedural TSL Color Node:
 * Blends between distinct chromatic signatures (Obsidian Gold, Quantum Cyan, Electric Violet)
 * based on the active topological shape and current morph progress.
 */
export function createKineticColorNode(uniforms) {
  return Fn(() => {
    const instData = attribute('aInstanceData', 'vec4');
    const posX = instData.x;
    const posZ = instData.y;
    const dist = instData.w;

    // Harmonic wave elevation indicator
    const phase = dist.mul(uniforms.uFrequency).sub(uniforms.uTime.mul(uniforms.uSpeed));
    const waveElevation = clamp(sin(phase).mul(0.5).add(0.5), float(0.0), float(1.0));

    // Accentuate top bevels
    const isTopBevel = clamp(normalLocal.y.sub(0.6).mul(2.5), float(0.0), float(1.0));
    const highlight = clamp(waveElevation.mul(0.6).add(isTopBevel.mul(0.7)), float(0.0), float(1.0));

    // Palette 0: Grid (Obsidian Slate + Warm Gold)
    const col0 = mix(uniforms.uColor0Primary, uniforms.uColor0Accent, highlight);

    // Palette 1: Sphere (Deep Jade + Quantum Cyan)
    const col1 = mix(uniforms.uColor1Primary, uniforms.uColor1Accent, highlight);

    // Palette 2: Torus (Smoked Titanium + Electric Violet)
    const col2 = mix(uniforms.uColor2Primary, uniforms.uColor2Accent, highlight);

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
