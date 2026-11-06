import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class InputController {
  constructor(camera, domElement, monolithGrid, studioLighting, config) {
    this.camera = camera;
    this.domElement = domElement;
    this.monolithGrid = monolithGrid;
    this.studioLighting = studioLighting;
    this.config = config;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.intersectPoint = new THREE.Vector3();

    this.isDragging = false;
    this.pointerDownPos = { x: 0, y: 0 };
    this.gyroActive = false;
    this.gyroListener = null;

    this.controls = null;
    this.initControls();
    this.initEvents();
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera from going under floor
    this.controls.minDistance = 8;
    this.controls.maxDistance = 120;
    this.controls.target.set(...this.config.camera.target);
    this.controls.update();
  }

  initEvents() {
    // Pointer down tracking to differentiate between orbit drag and tap/click
    this.domElement.addEventListener('pointerdown', (e) => {
      this.isDragging = false;
      this.pointerDownPos.x = e.clientX;
      this.pointerDownPos.y = e.clientY;
    });

    this.domElement.addEventListener('pointermove', (e) => {
      const dx = Math.abs(e.clientX - this.pointerDownPos.x);
      const dy = Math.abs(e.clientY - this.pointerDownPos.y);
      if (dx > 6 || dy > 6) {
        this.isDragging = true;
      }
    });

    this.domElement.addEventListener('pointerup', (e) => {
      if (!this.isDragging) {
        this.handleTap(e.clientX, e.clientY);
      }
    });

    // Reset button
    const resetBtn = document.getElementById('reset-cam-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetCamera());
    }

    // Gyroscope button
    const gyroBtn = document.getElementById('gyro-btn');
    if (gyroBtn) {
      gyroBtn.addEventListener('click', () => this.toggleGyro(gyroBtn));
    }
  }

  handleTap(clientX, clientY) {
    const rect = this.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.intersectPoint);

    if (hit) {
      const currentTime = performance.now() * 0.001;
      this.monolithGrid.triggerRipple(this.intersectPoint.x, this.intersectPoint.z, currentTime);
    }
  }

  toggleGyro(btnElement) {
    if (this.gyroActive) {
      this.disableGyro(btnElement);
      return;
    }

    // iOS 13+ permission request
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then((response) => {
          if (response === 'granted') {
            this.enableGyro(btnElement);
          } else {
            alert('Permissão de giroscópio negada.');
          }
        })
        .catch(console.error);
    } else if (window.DeviceOrientationEvent) {
      // Standard Android Chrome (Moto G9 Power)
      this.enableGyro(btnElement);
    } else {
      alert('Giroscópio não suportado neste dispositivo.');
    }
  }

  enableGyro(btnElement) {
    this.gyroActive = true;
    btnElement.classList.add('active');

    this.gyroListener = (e) => {
      if (e.gamma !== null && e.beta !== null) {
        this.studioLighting.applyGyroTilt(e.gamma, e.beta);
      }
    };

    window.addEventListener('deviceorientation', this.gyroListener, true);
  }

  disableGyro(btnElement) {
    this.gyroActive = false;
    btnElement?.classList.remove('active');
    if (this.gyroListener) {
      window.removeEventListener('deviceorientation', this.gyroListener, true);
      this.gyroListener = null;
    }
    // Return key light to neutral
    this.studioLighting.applyGyroTilt(0, 0);
  }

  resetCamera() {
    const [dx, dy, dz] = this.config.camera.defaultPos;
    this.camera.position.set(dx, dy, dz);
    this.controls.target.set(...this.config.camera.target);
    this.controls.update();
  }

  update() {
    this.controls.update();
  }

  dispose() {
    this.disableGyro();
    this.controls.dispose();
  }
}
