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

    // Auto Tour choreography state
    this.isTourActive = false;
    this.tourInterval = 9.0; // Seconds per form in auto tour
    this.lastTourSwitch = 0;
    this.tourBtn = document.getElementById('tour-btn');
    this.shapeButtons = [];

    this.init();
  }

  async init() {
    // 1. Setup Three.js WebGPURenderer (Optimized for Vega 7 and Mobile Adreno)
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
    this.scene.fog = new THREE.FogExp2(0x0a0a0c, 0.009);

    // 3. Camera Setup with Dead-Center Framing
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, aspect, CONFIG.camera.near, CONFIG.camera.far);
    this.camera.position.set(...CONFIG.camera.defaultPos);

    // 4. Initialize Core Components
    this.grid = new MonolithGrid(this.scene, CONFIG);
    this.lighting = new StudioLighting(this.scene, CONFIG);
    this.input = new InputController(this.camera, this.canvas, this.grid, this.lighting, CONFIG);

    // 5. Setup UI, Switchers & GUI
    this.updateInstanceCount();
    this.setupShapeSwitcher();
    this.setupKeyboardShortcuts();
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

  setupShapeSwitcher() {
    this.shapeButtons = Array.from(document.querySelectorAll('.shape-pill[data-shape]'));

    this.shapeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const shapeId = parseInt(btn.getAttribute('data-shape'), 10);
        this.selectShape(shapeId);
      });
    });

    if (this.tourBtn) {
      this.tourBtn.addEventListener('click', () => {
        this.toggleAutoTour();
      });
    }
  }

  selectShape(shapeId) {
    if (!this.grid) return;
    this.grid.morphTo(shapeId);

    // Update active class on pills
    this.shapeButtons.forEach(btn => {
      const btnShape = parseInt(btn.getAttribute('data-shape'), 10);
      if (btnShape === shapeId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  toggleAutoTour() {
    this.isTourActive = !this.isTourActive;
    if (this.tourBtn) {
      this.tourBtn.classList.toggle('active', this.isTourActive);
    }
    if (this.isTourActive) {
      this.lastTourSwitch = this.clock.getElapsedTime();
    }
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this.selectShape(0);
      if (e.key === '2') this.selectShape(1);
      if (e.key === '3') this.selectShape(2);
      if (e.key.toLowerCase() === 't' || e.code === 'Space') {
        e.preventDefault();
        this.toggleAutoTour();
      }
    });
  }

  setupGUI() {
    this.gui = new GUI({ title: 'Parâmetros Cinéticos', closeFolders: true });
    if (isMobile) {
      this.gui.close(); // Start collapsed on mobile screens
    }

    // Topologies & Morphing folder
    const morphFolder = this.gui.addFolder('Morfismo Topológico');
    const shapeOptions = { 'Grid Plano': 0, 'Esfera Fibonacci': 1, 'Vórtice Toroidal': 2 };
    const currentShapeParam = { forma: 0, tour: false, duracao: 1.8 };

    morphFolder.add(currentShapeParam, 'forma', shapeOptions).name('Forma Atual').onChange(val => {
      this.selectShape(val);
    }).listen();

    morphFolder.add(currentShapeParam, 'tour').name('Tour Automático').onChange(val => {
      this.isTourActive = val;
      this.tourBtn?.classList.toggle('active', val);
    }).listen();

    morphFolder.add(currentShapeParam, 'duracao', 0.8, 3.5, 0.1).name('Tempo Transição (s)').onChange(val => {
      this.grid.morphDuration = val;
    });

    morphFolder.add(this.grid.uniforms.uSphereRadius, 'value', 8.0, 18.0, 0.5).name('Raio Esfera');
    morphFolder.add(this.grid.uniforms.uTorusRadius, 'value', 9.0, 20.0, 0.5).name('Raio Toroide');
    morphFolder.add(this.grid.uniforms.uTorusTube, 'value', 2.0, 7.0, 0.2).name('Tubo Toroide');

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

    // 1. Auto Tour choreography loop
    if (this.isTourActive && !this.grid.isMorphing) {
      if (elapsedTime - this.lastTourSwitch >= this.tourInterval) {
        const nextShape = (this.grid.currentShapeIndex + 1) % 3;
        this.selectShape(nextShape);
        this.lastTourSwitch = elapsedTime;
      }
    }

    // 2. Update procedural wave displacement and morphing
    this.grid.update(elapsedTime);

    // 3. Update ground elevation based on morph state
    const morphProgress = this.grid.uniforms.uMorphProgress.value;
    const sourceShape = this.grid.uniforms.uSourceShape.value;
    const targetShape = this.grid.uniforms.uTargetShape.value;
    const currentShapeVal = sourceShape + (targetShape - sourceShape) * morphProgress;
    this.lighting.update(currentShapeVal);

    // 4. Update camera dampening
    this.input.update();

    // 5. Render frame via WebGPURenderer
    this.renderer.render(this.scene, this.camera);

    // 6. Update FPS counter
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
