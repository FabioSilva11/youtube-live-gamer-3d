import * as THREE from 'three';

export const BLOCKS = Object.freeze({
  grass: 0x72ad42, dirt: 0x88603e, stone: 0x939b9f, wood: 0x755033,
  oak_planks: 0xc89b5c, planks: 0xc89b5c, glass: 0xb3e6ec, leaves: 0x448642,
  water: 0x438dc5, sand: 0xdec88e, brick: 0xb56548, cobblestone: 0x727b80,
});

// Original pixel textures; no Minecraft assets or resource packs are required.
export class BlockRegistry {
  constructor() { this.materials = new Map(); this.geometry = new THREE.BoxGeometry(1, 1, 1); }
  material(type) {
    if (!Object.hasOwn(BLOCKS, type)) throw new Error(`Bloco desconhecido: ${type}`);
    if (this.materials.has(type)) return this.materials.get(type);
    const base = new THREE.Color(BLOCKS[type]);
    const pixels = new Uint8Array(16 * 16 * 4);
    for (let i = 0; i < 256; i++) {
      const x = i % 16, y = Math.floor(i / 16);
      let shade = .84 + ((i * 73 + y * 37) % 29) / 100;
      if ((type === 'oak_planks' || type === 'planks') && y % 5 === 0) shade = .64;
      if (type === 'brick' && (y % 5 === 0 || (x + (y < 5 || y > 10 ? 4 : 0)) % 8 === 0)) shade = 1.3;
      if (type === 'wood' && x % 4 === 0) shade = .65;
      const color = base.clone().multiplyScalar(shade).convertLinearToSRGB();
      pixels.set([color.r * 255, color.g * 255, color.b * 255, 255], i * 4);
    }
    const texture = new THREE.DataTexture(pixels, 16, 16);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    const transparent = type === 'glass' || type === 'water';
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .9, transparent, opacity: type === 'glass' ? .42 : type === 'water' ? .78 : 1, depthWrite: !transparent });
    this.materials.set(type, material);
    return material;
  }
  dispose() { this.geometry.dispose(); for (const m of this.materials.values()) { m.map.dispose(); m.dispose(); } this.materials.clear(); }
}
