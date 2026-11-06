import * as THREE from 'three/webgpu';
import GUI from 'lil-gui';
import { CONFIG, isMobile } from './config.js';
import { MonolithGrid } from './components/MonolithGrid.js';
import { StudioLighting } from './components/StudioLighting.js';
import { InputController } from './components/InputController.js';

class KineticApp {
  constructor() {
    this.canvas = document.getElementById('canvas3d');
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.clock = new THREE.Clock();

    this.grid = null;
    this.lighting = null;
    this.input = null;
    this.gui = null;

    // Performance profiling variables
    this.frameCount = 0;
    this.lastFpsUpdate = performance.now();
    this.fpsLabel = document.getElementById('fps-label');
    this.instancesLabel = document.getElementById('instances-label');

    this.init();
  }

  async init() {
    // 1. Setup Three.js WebGPURenderer (Optimized for Ryzen Vega 7 and Mobile Adreno)
    this.renderer = new THREE.WebGPURenderer({
      canvas: this.canvas,
      antialias: CONFIG.renderer.antialias,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.renderer.maxDpr));

    // Initialize backend asynchronously
    await this.renderer.init();
    this.detectBackend();

    // 2. Scene & Subtle Depth Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0c);
    this.scene.fog = new THREE.FogExp2(0x0a0a0c, 0.012);

    // 3. Camera Setup
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, aspect, CONFIG.camera.near, CONFIG.camera.far);
    this.camera.position.set(...CONFIG.camera.defaultPos);

    // 4. Initialize Core Components
    this.grid = new MonolithGrid(this.scene, CONFIG);
    this.lighting = new StudioLighting(this.scene, CONFIG);
    this.input = new InputController(this.camera, this.canvas, this.grid, this.lighting, CONFIG);

    // 5. Setup UI & GUI
    this.updateInstanceCount();
    this.setupGUI();

    // 6. Window Resize Handler
    window.addEventListener('resize', () => this.onWindowResize());

    // 7. Start Render Loop
    this.renderer.setAnimationLoop(() => this.render());
  }

  detectBackend() {
    const isWebGPU = this.renderer.backend?.isWebGPUBackend || 
                     this.renderer.backend?.constructor?.name?.includes('WebGPU');
    const backendLabel = document.getElementById('backend-label');
    const backendDot = document.getElementById('backend-dot');

    if (isWebGPU) {
      backendLabel.textContent = 'WebGPU (WGSL Ativo)';
      backendDot.className = 'metric-dot webgpu';
    } else {
      backendLabel.textContent = 'WebGL2 (Fallback TSL)';
      backendDot.className = 'metric-dot webgl2';
    }
  }

  updateInstanceCount() {
    if (this.instancesLabel && this.grid) {
      this.instancesLabel.textContent = `${this.grid.instanceCount.toLocaleString('pt-BR')} Prismas`;
    }
  }

  setupGUI() {
    this.gui = new GUI({ title: 'Parâmetros Cinéticos', closeFolders: true });
    if (isMobile) {
      this.gui.close(); // Start collapsed on mobile screens
    }

    // Wave folder
    const waveFolder = this.gui.addFolder('Dinâmica de Onda');
    waveFolder.add(CONFIG.wave, 'speed', 0.2, 4.0, 0.1).name('Velocidade').onChange(v => {
      this.grid.uniforms.uSpeed.value = v;
    });
    waveFolder.add(CONFIG.wave, 'frequency', 0.1, 1.2, 0.05).name('Frequência').onChange(v => {
      this.grid.uniforms.uFrequency.value = v;
    });
    waveFolder.add(CONFIG.wave, 'heightAmplitude', 0.2, 3.5, 0.1).name('Amplitude').onChange(v => {
      this.grid.uniforms.uAmplitude.value = v;
    });
    waveFolder.add(CONFIG.wave, 'chebyshevFactor', 0.0, 1.5, 0.05).name('Fator Chebyshev').onChange(v => {
      this.grid.uniforms.uChebyshev.value = v;
    });

    // Ripple / Shockwave folder
    const rippleFolder = this.gui.addFolder('Ondulação de Toque');
    rippleFolder.add(CONFIG.wave, 'rippleHeight', 0.5, 4.0, 0.1).name('Intensidade').onChange(v => {
      this.grid.uniforms.uRippleHeight.value = v;
    });
    rippleFolder.add(CONFIG.wave, 'rippleSpeed', 2.0, 12.0, 0.5).name('Velocidade Pulso').onChange(v => {
      this.grid.uniforms.uRippleSpeed.value = v;
    });

    // Color & Material Themes
    const themeFolder = this.gui.addFolder('Estética & Materiais');
    const presets = {
      'Obsidian Gold': { primary: '#121217', accent: '#e2ba7d' },
      'Pearl Titanium': { primary: '#d8d8de', accent: '#70707b' },
      'Emerald Jade': { primary: '#0a1d17', accent: '#4ee1c2' },
      'Cyber Violet': { primary: '#110c1c', accent: '#b46aff' }
    };

    const currentPreset = { tema: 'Obsidian Gold' };
    themeFolder.add(currentPreset, 'tema', Object.keys(presets)).name('Tema Estúdio').onChange(name => {
      const p = presets[name];
      this.grid.setTheme(p.primary, p.accent);
    });

    // Grid Resolution Selector
    const gridFolder = this.gui.addFolder('Densidade do Grid');
    const resOptions = {
      'Leve (20x20 - 400)': 20,
      'Recomendada (32x32 - 1.024)': 32,
      'Alta (40x40 - 1.600)': 40,
    };
    const currentRes = { densidade: CONFIG.grid.countX };
    gridFolder.add(currentRes, 'densidade', resOptions).name('Resolução').onChange(val => {
      this.grid.rebuildGrid(val, val);
      this.updateInstanceCount();
    });
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.renderer.maxDpr));
  }

  render() {
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update procedural wave displacement
    this.grid.update(elapsedTime);

    // 2. Update camera dampening
    this.input.update();

    // 3. Render frame via WebGPURenderer
    this.renderer.render(this.scene, this.camera);

    // 4. Update FPS counter
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsUpdate >= 350) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.lastFpsUpdate));
      if (this.fpsLabel) {
        this.fpsLabel.textContent = `${fps} FPS`;
      }
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new KineticApp();
});
