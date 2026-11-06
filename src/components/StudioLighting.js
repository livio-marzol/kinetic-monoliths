import * as THREE from 'three/webgpu';
import { Fn, positionLocal, length, clamp, float, color, mix } from 'three/tsl';

export class StudioLighting {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;

    this.lights = {};
    this.ground = null;
    this.targetGroundY = -2.2;
    this.init();
  }

  init() {
    // 1. Ambient Baseline (Atmospheric gallery tone)
    const ambientLight = new THREE.AmbientLight(0x181a24, 1.1);
    this.scene.add(ambientLight);
    this.lights.ambient = ambientLight;

    // 2. Key Light (Warm Champagne Studio Light)
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 3.0);
    keyLight.position.set(35, 45, 25);
    keyLight.castShadow = false; // Zero shadow-map pass overhead for maximum FPS
    this.scene.add(keyLight);
    this.lights.key = keyLight;
    this.defaultKeyPos = keyLight.position.clone();

    // 3. Fill Light (Cool Slate Softbox)
    const fillLight = new THREE.DirectionalLight(0x7695c5, 1.5);
    fillLight.position.set(-35, 25, -20);
    this.scene.add(fillLight);
    this.lights.fill = fillLight;

    // 4. Rim Light (Grazing Backlight for Edge Definition)
    const rimLight = new THREE.DirectionalLight(0x5eead4, 2.0);
    rimLight.position.set(0, 35, -45);
    this.scene.add(rimLight);
    this.lights.rim = rimLight;

    // 5. Under-Light (Crucial Studio Uplight: Eliminates muddy black undersides on 3D Sphere & Torus)
    const underLight = new THREE.DirectionalLight(0x2a3854, 1.8);
    underLight.position.set(0, -35, 20);
    this.scene.add(underLight);
    this.lights.under = underLight;

    // 6. Studio Ground Plane with Procedural Ambient Occlusion (Contact Shadow)
    // Runs in a single ultra-fast pass without requiring depth-buffer render passes
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshBasicNodeMaterial();
    
    groundMat.colorNode = Fn(() => {
      // Radial distance from center on the floor plane
      const dist = length(positionLocal.xy);
      // Soft ambient contact shadow under the sculpture
      const contactOcclusion = clamp(float(1.0).sub(dist.div(float(38.0))), float(0.0), float(1.0));
      const darkenedFloor = mix(color(0x0a0a0d), color(0x020204), contactOcclusion.mul(0.85));
      return darkenedFloor;
    })();

    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -2.2;
    this.scene.add(this.ground);
  }

  /**
   * Dynamically adjusts ground floor elevation based on active shape
   * In Grid (shape 0), ground is at Y = -2.2 (right beneath grid).
   * In Sphere/Torus, ground lowers to Y = -16.2 so the 3D sculpture floats gracefully above the floor.
   */
  update(shapeInterpolation) {
    const is3D = Math.min(1.0, Math.max(0.0, shapeInterpolation));
    this.targetGroundY = -2.2 + is3D * (-14.0);
    this.ground.position.y += (this.targetGroundY - this.ground.position.y) * 0.08;
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
