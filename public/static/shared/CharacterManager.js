// User identity survives environment changes; moving the root does not create users again.
export class CharacterManager {
  constructor(THREE) { this.root = new THREE.Group(); this.avatars = new Map(); }
  attach(scene) { scene.add(this.root); }
}
