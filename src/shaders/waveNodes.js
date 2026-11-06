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
  positionLocal,
  normalLocal,
  attribute
} from 'three/tsl';

/**
 * Raw WGSL reference implementation for direct WebGPU Compute Pipeline execution.
 * Demonstrates the compute-stage mathematical logic running in parallel for all monoliths.
 */
export const RAW_WGSL_COMPUTE_CODE = /* wgsl */ `
struct MonolithInstance {
  position: vec4<f32>,
  rotation: vec4<f32>,
  energy: f32,
  padding: vec3<f32>,
};

struct Uniforms {
  time: f32,
  speed: f32,
  frequency: f32,
  amplitude: f32,
  chebyshev: f32,
  rippleCenter: vec2<f32>,
  rippleTime: f32,
  rippleSpeed: f32,
  rippleDecay: f32,
  rippleHeight: f32,
  gridWidth: u32,
  spacing: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var<storage, read_write> instances: array<MonolithInstance>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= arrayLength(&instances)) {
    return;
  }

  let col = f32(idx % u.gridWidth);
  let row = f32(idx / u.gridWidth);
  let halfWidth = f32(u.gridWidth) * 0.5;

  let x = (col - halfWidth) * u.spacing;
  let z = (row - halfWidth) * u.spacing;

  let dist = sqrt(x * x + z * z);
  let phase = dist * u.frequency - u.time * u.speed;

  // Chebyshev-inspired harmonic wave modulation
  let wave1 = sin(phase);
  let wave2 = cos(phase * 0.5 + x * 0.12) * u.chebyshev;
  var height = (wave1 + wave2) * u.amplitude;

  // Radial touch ripple propagation
  let deltaRipple = vec2<f32>(x, z) - u.rippleCenter;
  let distToRipple = length(deltaRipple);
  let timeSinceRipple = max(u.time - u.rippleTime, 0.0);
  let waveFront = timeSinceRipple * u.rippleSpeed;
  let distFromWaveFront = abs(distToRipple - waveFront);

  if (timeSinceRipple > 0.0 && distFromWaveFront < 3.5) {
    let decay = exp(-timeSinceRipple * u.rippleDecay);
    let ripplePulse = cos(distFromWaveFront * 1.5) * decay * u.rippleHeight;
    height = height + ripplePulse;
  }

  // Calculate surface gradients for dynamic kinetic tilt
  let gradX = cos(phase) * u.frequency * (x / (dist + 0.001));
  let gradZ = cos(phase) * u.frequency * (z / (dist + 0.001));

  instances[idx].position = vec4<f32>(x, height, z, 1.0);
  instances[idx].rotation = vec4<f32>(-gradZ * 0.12, 0.0, gradX * 0.12, 0.0);
  instances[idx].energy = clamp((height + u.amplitude) / (2.0 * u.amplitude + 0.5), 0.0, 1.0);
}
`;

/**
 * Initializes reactive uniforms for animation and touch interaction
 */
export function createWaveUniforms(config) {
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
    uPrimaryColor: uniform(new THREE.Color(config.theme.primaryColor)),
    uAccentColor: uniform(new THREE.Color(config.theme.accentColor)),
  };
}

/**
 * Procedural TSL Displacement Node:
 * Calculates kinetic height displacement and tilting per monolith instance.
 */
export function createKineticDisplacementNode(uniforms) {
  return Fn(() => {
    // Instance coordinate attribute: [x, z, distanceFromCenter]
    const instCoord = attribute('aInstanceCoord', 'vec3');
    const posX = instCoord.x;
    const posZ = instCoord.z;
    const dist = instCoord.y;

    // Harmonic wave calculation
    const phase = dist.mul(uniforms.uFrequency).sub(uniforms.uTime.mul(uniforms.uSpeed));
    const wave1 = sin(phase);
    const wave2 = cos(phase.mul(0.5).add(posX.mul(0.12))).mul(uniforms.uChebyshev);
    let height = wave1.add(wave2).mul(uniforms.uAmplitude);

    // Touch/click radial shockwave ripple
    const deltaRipple = vec2(posX, posZ).sub(uniforms.uRippleCenter);
    const distToRipple = length(deltaRipple);
    const timeSinceRipple = max(uniforms.uTime.sub(uniforms.uRippleTime), float(0.0));
    const waveFront = timeSinceRipple.mul(uniforms.uRippleSpeed);
    const distFromFront = abs(distToRipple.sub(waveFront));

    const rippleDecay = sin(clamp(timeSinceRipple.mul(uniforms.uRippleDecay), float(0.0), float(3.14159)));
    const rippleShape = cos(distFromFront.mul(1.6));
    const isClose = clamp(float(2.5).sub(distFromFront), float(0.0), float(1.0));
    const rippleEffect = rippleShape.mul(rippleDecay).mul(uniforms.uRippleHeight).mul(isClose);

    height = height.add(rippleEffect);

    // Approximate gradients for subtle kinetic tilt
    const gradX = cos(phase).mul(uniforms.uFrequency).mul(posX.div(dist.add(0.001)));
    const gradZ = cos(phase).mul(uniforms.uFrequency).mul(posZ.div(dist.add(0.001)));

    // Apply tilt to local vertices
    const tiltedX = positionLocal.x;
    const tiltedZ = positionLocal.z;
    const tiltOffsetY = tiltedX.mul(gradX.mul(0.15)).add(tiltedZ.mul(gradZ.mul(0.15)));

    // Displace vertex
    const finalY = positionLocal.y.add(height).add(tiltOffsetY);

    return vec3(positionLocal.x, finalY, positionLocal.z);
  })();
}

/**
 * Procedural TSL Color / Surface Node:
 * Transitions between matte obsidian ceramic and champagne gold/titanium on wave crests and top edges.
 */
export function createKineticColorNode(uniforms) {
  return Fn(() => {
    const instCoord = attribute('aInstanceCoord', 'vec3');
    const posX = instCoord.x;
    const posZ = instCoord.z;
    const dist = instCoord.y;

    // Phase and elevation indicator
    const phase = dist.mul(uniforms.uFrequency).sub(uniforms.uTime.mul(uniforms.uSpeed));
    const waveVal = sin(phase);
    
    // Normalized elevation [0.0, 1.0]
    const elevation = clamp(waveVal.mul(0.5).add(0.5), float(0.0), float(1.0));

    // Accentuate top-facing bevels
    const isTopFace = clamp(normalLocal.y.sub(0.6).mul(2.5), float(0.0), float(1.0));

    // Blend primary obsidian and accent gold
    const blendFactor = clamp(elevation.mul(0.7).add(isTopFace.mul(0.6)), float(0.0), float(1.0));
    const surfaceColor = mix(uniforms.uPrimaryColor, uniforms.uAccentColor, blendFactor);

    return surfaceColor;
  })();
}
