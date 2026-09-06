import * as THREE from 'three';
import { BlockRegistry } from './BlockRegistry.js';
import { BLOCK_SIZE } from './BlockGrid.js';
import { VoxelWorld } from './VoxelWorld.js';
import { StructureManager } from './StructureManager.js';
import { BuilderAI } from './BuilderAI.js';
import { createMinecraftCharacter } from './MinecraftCharacters.js';

// Load before the stage starts, so there is never a half-initialized construction loop.
const blueprints = await Promise.all(['house', 'tower', 'bridge', 'farm', 'monument'].map(async name => {
  const response = await fetch(new URL(`./structures/${name}.json`, import.meta.url));
  if (!response.ok) throw new Error(`Não foi possível carregar a estrutura ${name}.`);
  return response.json();
}));

export class MinecraftBiome {
  constructor() {
    this.id = 'minecraft'; this.scene = new THREE.Scene(); this.scene.background = new THREE.Color(0x9dd4ec); this.scene.fog = new THREE.Fog(0x9dd4ec, 36, 80);
    this.cameraPreset = { fov: 45, maxDistance: 42, position: { x: 15, y: 19, z: 26 }, target: { x: 0, y: 0, z: 0 }, fog: { near: 36, far: 80 } };
    this.registry = new BlockRegistry(); this.world = new VoxelWorld(this.registry); this.scene.add(this.world.root);
    this.scene.add(new THREE.HemisphereLight(0xe5f7ff, 0x6d7954, 2.2));
    const sun = new THREE.DirectionalLight(0xfff0cf, 3); sun.position.set(-10, 22, 12); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, far: 60 }); sun.shadow.normalBias = .04; this.scene.add(sun);
    this.buildTerrain();
    this.structures = new StructureManager(this.world, blueprints); this.builders = new BuilderAI(this.structures, this.world);
    for (const site of this.structures.sites) {
      this.addSiteLabel(site);
    }
    this.particles = []; this.builders.onBlock = (block, mode) => this.blockEffect(block, mode);
    this.statusElapsed = 1;
  }
  buildTerrain() {
    for (let x = -17; x <= 17; x++) for (let z = -13; z <= 13; z++) {
      if (Math.abs(x) === 17 && Math.abs(z) > 10 || Math.abs(z) === 13 && Math.abs(x) > 13) continue;
      this.world.set({ x, y: -1, z, type: 'grass' });
      this.world.set({ x, y: -2, z, type: 'dirt' });
      if (Math.abs(x) < 16 && Math.abs(z) < 12) this.world.set({ x, y: -3, z, type: 'stone' });
      if (z === 1 || z === 2) this.world.set({ x, y: -1, z, type: 'sand' });
    }
    for (const [x, z] of [[-14, -10], [-15, 8], [13, -10], [13, 9], [7, 11]]) {
      for (let y = 0; y < 4; y++) this.world.set({ x, y, z, type: 'wood' });
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let y = 3; y <= 4; y++) if (dx || dz || y === 4) this.world.set({ x: x + dx, y, z: z + dz, type: 'leaves' });
      this.world.set({ x, y: 5, z, type: 'leaves' });
    }
    for (let x = 10; x <= 14; x++) for (let z = 4; z <= 6; z++) this.world.set({ x, y: -1, z, type: 'water' });
    this.clouds = new THREE.Group(); this.scene.add(this.clouds);
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 8; i++) {
      const cloud = new THREE.Mesh(new THREE.BoxGeometry(3 + i % 3, .6, 1.7), white);
      cloud.position.set(-22 + i * 6, 10 + i % 3, -15 - i % 2 * 5); this.clouds.add(cloud);
    }
  }
  layout(index) { return { x: (-7 + (index % 5) * 3.5) * BLOCK_SIZE, z: (index < 5 ? 1 : 2) * BLOCK_SIZE, scale: .68 }; }
  heightAt(x, z) { return Math.max(0, this.world.surface(Math.round(x / BLOCK_SIZE), Math.round(z / BLOCK_SIZE))) * BLOCK_SIZE; }
  createBody(id) { return createMinecraftCharacter(id); }
  resetPaths() { this.builders.resetPaths(); }
  updateBuilders(avatars, dt, time) { this.builders.update(avatars, dt, time); }
  addSiteLabel(site) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, toneMapped: false }));
    sprite.position.set((site.origin.x + 2) * BLOCK_SIZE, .3, (site.origin.z + 6.7) * BLOCK_SIZE); sprite.scale.set(4.5, .75, 1); this.scene.add(sprite);
    site.label = { canvas, texture };
  }
  update(time, dt) {
    this.clouds.position.x = Math.sin(time * .018) * 3;
    this.statusElapsed += dt;
    if (this.statusElapsed >= .5) {
      this.statusElapsed = 0;
      const phases = { waiting: 'Aguardando construtores', building: 'Construindo', ready: 'Pronta · aguardando outras obras', enjoying: 'Todas prontas · explorando', dismantling: 'Desmontando', cleared: 'Canteiro liberado', cooldown: 'Próxima rodada' };
      for (const site of this.structures.sites) {
        const { canvas, texture } = site.label, ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 768, 128);
        ctx.fillStyle = '#163a32'; ctx.fillRect(0, 0, 768, 116);
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 30px system-ui'; ctx.textAlign = 'center';
        ctx.fillText(`Obra ${site.index + 1} · ${site.blueprint?.name || 'Canteiro livre'}`, 384, 42);
        ctx.fillStyle = '#c9e8c1'; ctx.font = '26px system-ui';
        const pending = this.structures.pending(site);
        const task = pending[0]?.scaffold ? (site.phase === 'dismantling' ? 'Retirando andaimes' : 'Montando andaimes') : phases[site.phase];
        const status = !this.structures.ids.length ? phases.waiting : ['building', 'dismantling'].includes(site.phase) ? task : phases[site.phase];
        ctx.fillText(`${status} · ${site.placed.size}/${site.blocks.length} blocos`, 384, 83);
        ctx.fillStyle = '#9bd65b'; ctx.fillRect(0, 110, site.blocks.length ? 768 * site.placed.size / site.blocks.length : 0, 6); texture.needsUpdate = true;
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.life -= dt; p.mesh.position.addScaledVector(p.velocity, dt); p.velocity.y -= dt * 3; p.mesh.rotation.x += dt * 5; p.mesh.scale.setScalar(Math.max(0, p.life) * .15);
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); }
    }
  }
  blockEffect(block, mode) {
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(this.registry.geometry, this.registry.material(block.type)); mesh.scale.setScalar(.1); mesh.position.set(block.x * BLOCK_SIZE, (block.y + .7) * BLOCK_SIZE, block.z * BLOCK_SIZE); this.scene.add(mesh);
      this.particles.push({ mesh, life: .65, velocity: new THREE.Vector3(Math.cos(i * 2.4), mode === 'building' ? 1.3 : 2, Math.sin(i * 2.4)) });
    }
  }
  dispose() {
    this.resetPaths(); this.world.dispose();
    for (const site of this.structures.sites) site.label.texture.dispose();
    this.scene.traverse(o => { if (o.isSprite) o.material.dispose(); });
    this.clouds.children[0]?.material.dispose(); this.clouds.children.forEach(c => c.geometry.dispose());
    this.registry.dispose(); this.scene.clear(); this.particles.length = 0;
  }
}
