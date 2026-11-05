import * as THREE from 'three';

// Sonido "posicional" sencillo: el volumen baja según la distancia
// entre la fuente y un elemento (normalmente la cámara).
export class Sound {

  constructor(sources, radius, scene, aditionalParams = {}) {
    this.audio = document.createElement('audio');
    this.audio.loop = true;
    this.radius = radius;
    this.scene = scene;

    for (const src of sources) {
      const source = document.createElement('source');
      source.src = src;
      this.audio.appendChild(source);
    }

    // Parámetros adicionales
    const ap = aditionalParams;
    this.volume = ('volume' in ap) ? Math.min(ap.volume, 1) : 1;

    this.position = ('position' in ap)
      ? new THREE.Vector3(ap.position.x, ap.position.y, ap.position.z)
      : new THREE.Vector3(0, 0, 0);

    if (ap.debug) this.debugMode();
  }

  debugMode() {
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(2, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
    );
    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  play() {
    this.audio.play().catch((e) => console.log(e));
  }

  pause() {
    this.audio.pause();
  }

  update(element) {
    const distance = this.position.distanceTo(element.position);
    this.audio.volume = (distance <= this.radius)
      ? this.volume * (1 - distance / this.radius)
      : 0;
  }
}
