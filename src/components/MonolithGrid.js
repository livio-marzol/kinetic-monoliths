import * as THREE from 'three/webgpu';
import { InstancedBufferAttribute } from 'three';
import {
  createWaveUniforms,
  createKineticDisplacementNode,
  createKineticColorNode
} from '../shaders/waveNodes.js';

export class MonolithGrid {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.uniforms = createWaveUniforms(config);
    this.mesh = null;
    this.geometry = null;
    this.material = null;

    // Morphing transition management
    this.currentShapeIndex = 0; // 0: Grid, 1: Sphere, 2: Torus
    this.targetShapeIndex = 0;
    this.isMorphing = false;
    this.morphStartTime = 0;
    this.morphDuration = 1.8;

    this.init();
  }

  init() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.geometry?.dispose();
      this.material?.dispose();
    }

    const { countX, countZ, spacing, monolithWidth, monolithHeight, monolithDepth } = this.config.grid;
    const totalCount = countX * countZ;

    // Optimized Box geometry (1, 1, 1: minimal vertex budget for maximum GPU throughput)
    this.geometry = new THREE.BoxGeometry(monolithWidth, monolithHeight, monolithDepth, 1, 1, 1);

    // Coordinate attributes for GPU node shader: [x, z, instanceIdx, distFromOrigin]
    const instanceData = new Float32Array(totalCount * 4);
    const halfWidthX = ((countX - 1) * spacing) * 0.5;
    const halfWidthZ = ((countZ - 1) * spacing) * 0.5;

    // Node Material with WGSL / TSL vertex and color nodes
    this.material = new THREE.MeshStandardNodeMaterial({
      roughness: this.config.theme.roughness,
      metalness: this.config.theme.metalness,
    });

    this.material.positionNode = createKineticDisplacementNode(this.uniforms);
    this.material.colorNode = createKineticColorNode(this.uniforms);

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, totalCount);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;

    const dummy = new THREE.Object3D();
    let idx = 0;

    for (let r = 0; r < countZ; r++) {
      for (let c = 0; c < countX; c++) {
        const posX = c * spacing - halfWidthX;
        const posZ = r * spacing - halfWidthZ;
        const dist = Math.sqrt(posX * posX + posZ * posZ);

        // Populate base matrix at origin
        dummy.position.set(0, 0, 0);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(idx, dummy.matrix);

        // Store coordinate in instance buffer for GPU shader
        const attrIdx = idx * 4;
        instanceData[attrIdx] = posX;
        instanceData[attrIdx + 1] = posZ;
        instanceData[attrIdx + 2] = idx;
        instanceData[attrIdx + 3] = dist;

        idx++;
      }
    }

    this.geometry.setAttribute('aInstanceData', new InstancedBufferAttribute(instanceData, 4));
    this.mesh.instanceMatrix.needsUpdate = true;
    this.uniforms.uTotalInstances.value = totalCount;
    this.uniforms.uCountX.value = countX;
    this.uniforms.uCountZ.value = countZ;

    this.scene.add(this.mesh);
  }

  /**
   * Triggers smooth GPU morphing to a target topological form
   * @param {number} targetIndex - 0: Grid, 1: Sphere, 2: Torus
   * @param {number} duration - Transition duration in seconds
   */
  morphTo(targetIndex, duration = 1.8) {
    if (targetIndex === this.currentShapeIndex && !this.isMorphing) {
      return;
    }

    if (this.isMorphing) {
      // Smoothly blend from current interpolated state
      const currentVal = this.uniforms.uSourceShape.value + 
        (this.uniforms.uTargetShape.value - this.uniforms.uSourceShape.value) * this.uniforms.uMorphProgress.value;
      this.uniforms.uSourceShape.value = currentVal;
    } else {
      this.uniforms.uSourceShape.value = this.currentShapeIndex;
    }

    this.targetShapeIndex = targetIndex;
    this.uniforms.uTargetShape.value = targetIndex;
    this.uniforms.uMorphProgress.value = 0.0;
    this.isMorphing = true;
    this.morphStartTime = performance.now() * 0.001;
    this.morphDuration = duration;
  }

  update(time) {
    this.uniforms.uTime.value = time;

    // Handle active morph progress
    if (this.isMorphing) {
      const elapsed = time - this.morphStartTime;
      const progress = elapsed / this.morphDuration;

      if (progress >= 1.0) {
        this.uniforms.uMorphProgress.value = 1.0;
        this.uniforms.uSourceShape.value = this.targetShapeIndex;
        this.currentShapeIndex = this.targetShapeIndex;
        this.isMorphing = false;
      } else {
        this.uniforms.uMorphProgress.value = Math.max(0.0, Math.min(1.0, progress));
      }
    }
  }

  triggerRipple(worldX, worldZ, currentTime) {
    this.uniforms.uRippleCenter.value.set(worldX, worldZ);
    this.uniforms.uRippleTime.value = currentTime;
  }

  setTheme(primaryHex, accentHex) {
    this.uniforms.uColor0Primary.value.set(primaryHex);
    this.uniforms.uColor0Accent.value.set(accentHex);
  }

  rebuildGrid(countX, countZ) {
    this.config.grid.countX = countX;
    this.config.grid.countZ = countZ;
    this.init();
  }

  get instanceCount() {
    return this.config.grid.countX * this.config.grid.countZ;
  }

  dispose() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.geometry?.dispose();
      this.material?.dispose();
      this.mesh.dispose();
    }
  }
}
