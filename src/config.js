/**
 * Hardware-Aware Configuration for Kinetic Monoliths
 * Tuned for AMD Ryzen 4600G (Radeon Vega 7) and Moto G9 Power (Adreno 610)
 * Mode: Studio Pro (Optimized for rock-solid 60 FPS)
 */

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const isMobileScreen = window.innerWidth <= 768;
export const isMobile = isTouchDevice && isMobileScreen;

export const CONFIG = {
  isMobile,
  
  // Grid Dimensions & Spacing
  grid: {
    // 32x32 = 1,024 monoliths on desktop; 24x24 = 576 on mobile
    countX: isMobile ? 24 : 32,
    countZ: isMobile ? 24 : 32,
    spacing: 1.15,
    monolithWidth: 0.85,
    monolithHeight: 3.8,
    monolithDepth: 0.85,
  },

  // Rendering & Performance Budget
  renderer: {
    // Travar DPR em 1.0 elimina gargalos de fillrate e banda de memória DDR4 na Vega 7
    maxDpr: 1.0,
    shadows: false, // Desativa shadow maps dinâmicos caros em favor de sombra de contato suave
    antialias: true,
  },

  // Wave & Physics Dynamics (WGSL Uniforms)
  wave: {
    speed: 1.4,
    frequency: 0.35,
    heightAmplitude: 1.2,
    chebyshevFactor: 0.65,
    rotationFactor: 0.12,
    rippleSpeed: 6.0,
    rippleDecay: 2.2,
    rippleHeight: 1.8,
  },

  // Material & Color Themes
  theme: {
    primaryColor: '#121217',    // Obsidian Slate base
    accentColor: '#e2ba7d',     // Warm Champagne Gold
    roughness: 0.32,
    metalness: 0.82,
  },

  // Camera Defaults
  camera: {
    fov: 42,
    near: 0.5,
    far: 200,
    defaultPos: isMobile ? [24, 28, 34] : [26, 30, 36],
    target: [0, 1.0, 0],
  }
};
