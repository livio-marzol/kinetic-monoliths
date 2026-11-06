/**
 * Hardware-Aware Configuration for Kinetic Monoliths
 * Tuned for AMD Ryzen 4600G (Radeon Vega 7) and Moto G9 Power (Adreno 610)
 * Mode: Studio Pro with Perfect Center Framing
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
    // Trava DPR em 1.0 para manter 60 FPS cravados sem sobrecarregar a largura de banda
    maxDpr: 1.0,
    shadows: false, // Desativa shadow maps dinâmicos pesados em favor de oclusão analítica ultra-rápida
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
    primaryColor: '#0e0e13',
    accentColor: '#f0c986',
    roughness: 0.28,
    metalness: 0.85,
  },

  // Camera Defaults (Dead-Center Framing on Y = 0.0)
  camera: {
    fov: 40,
    near: 0.5,
    far: 250,
    defaultPos: isMobile ? [26, 20, 34] : [28, 22, 38],
    target: [0, 0.0, 0], // Targets exact geometric center
  }
};
