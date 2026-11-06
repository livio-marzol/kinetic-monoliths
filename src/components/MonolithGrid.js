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

    // Optimized Box geometry (1, 1, 1 segments: eliminates redundant vertices and reduces vertex shader workload)
    this.geometry = new THREE.BoxGeometry(monolithWidth, monolithHeight, monolithDepth, 1, 1, 1);

    // Coordinate attributes for GPU node shader: [x, distFromOrigin, z]
    const instanceCoords = new Float32Array(totalCount * 3);
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

        // Populate base matrix
        dummy.position.set(posX, 0, posZ);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(idx, dummy.matrix);

        // Store coordinate in instance buffer for GPU shader
        const attrIdx = idx * 3;
        instanceCoords[attrIdx] = posX;
        instanceCoords[attrIdx + 1] = dist;
        instanceCoords[attrIdx + 2] = posZ;

        idx++;
      }
    }

    this.geometry.setAttribute('aInstanceCoord', new InstancedBufferAttribute(instanceCoords, 3));
    this.mesh.instanceMatrix.needsUpdate = true;

    this.scene.add(this.mesh);
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }

  triggerRipple(worldX, worldZ, currentTime) {
    this.uniforms.uRippleCenter.value.set(worldX, worldZ);
    this.uniforms.uRippleTime.value = currentTime;
  }

  setTheme(primaryHex, accentHex) {
    this.uniforms.uPrimaryColor.value.set(primaryHex);
    this.uniforms.uAccentColor.value.set(accentHex);
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
