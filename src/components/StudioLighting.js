import * as THREE from 'three/webgpu';
import { Fn, positionLocal, length, clamp, float, color, mix } from 'three/tsl';

export class StudioLighting {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;

    this.lights = {};
    this.ground = null;
    this.init();
  }

  init() {
    // 1. Ambient Baseline (Soft, high-end gallery fill)
    const ambientLight = new THREE.AmbientLight(0x1a1c24, 0.95);
    this.scene.add(ambientLight);
    this.lights.ambient = ambientLight;

    // 2. Key Light (Warm Champagne Studio Light)
    const keyLight = new THREE.DirectionalLight(0xfff3e2, 2.9);
    keyLight.position.set(35, 45, 25);
    keyLight.castShadow = false; // Zero shadow-map pass overhead for maximum FPS
    this.scene.add(keyLight);
    this.lights.key = keyLight;
    this.defaultKeyPos = keyLight.position.clone();

    // 3. Fill Light (Cool Slate Studio Softbox)
    const fillLight = new THREE.DirectionalLight(0x7695c5, 1.4);
    fillLight.position.set(-30, 25, -20);
    this.scene.add(fillLight);
    this.lights.fill = fillLight;

    // 4. Rim Light (Grazing Backlight for Edge Definition)
    const rimLight = new THREE.DirectionalLight(0x4ee1c2, 1.8);
    rimLight.position.set(0, 32, -40);
    this.scene.add(rimLight);
    this.lights.rim = rimLight;

    // 5. Studio Ground Plane with Procedural Ambient Occlusion (Contact Shadow)
    // Runs in a single ultra-fast pass without requiring depth-buffer render passes
    const groundGeo = new THREE.PlaneGeometry(260, 260);
    const groundMat = new THREE.MeshBasicNodeMaterial();
    
    groundMat.colorNode = Fn(() => {
      // Radial distance from center on the floor plane
      const dist = length(positionLocal.xy);
      // Soft ambient contact shadow under the sculpture
      const contactOcclusion = clamp(float(1.0).sub(dist.div(float(34.0))), float(0.0), float(1.0));
      const darkenedFloor = mix(color(0x0a0a0d), color(0x030305), contactOcclusion.mul(0.8));
      return darkenedFloor;
    })();

    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -2.2;
    this.scene.add(this.ground);
  }

  /**
   * Adjusts Key Light position based on device gyroscope orientation
   * @param {number} gamma - Left/right tilt in degrees (-90 to 90)
   * @param {number} beta - Front/back tilt in degrees (-180 to 180)
   */
  applyGyroTilt(gamma, beta) {
    if (!this.lights.key) return;
    const clampedGamma = Math.max(-45, Math.min(45, gamma)) * 0.4;
    const clampedBeta = Math.max(-45, Math.min(45, beta)) * 0.4;

    this.lights.key.position.x = this.defaultKeyPos.x + clampedGamma;
    this.lights.key.position.z = this.defaultKeyPos.z + clampedBeta;
  }

  dispose() {
    Object.values(this.lights).forEach(l => {
      this.scene.remove(l);
      l.dispose?.();
    });
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
      this.ground.material.dispose();
    }
  }
}
