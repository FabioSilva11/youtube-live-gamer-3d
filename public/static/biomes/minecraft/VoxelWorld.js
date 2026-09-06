import * as THREE from 'three';
import { BlockGrid, BLOCK_SIZE, blockKey } from './BlockGrid.js';

export class VoxelWorld extends BlockGrid {
  constructor(registry) { super(); this.registry = registry; this.root = new THREE.Group(); this.pools = new Map(); this.transform = new THREE.Object3D(); }
  set(block) {
    if (this.has(block)) this.remove(block);
    super.set(block);
    let pool = this.pools.get(block.type);
    if (!pool) {
      const mesh = new THREE.InstancedMesh(this.registry.geometry, this.registry.material(block.type), 4096);
      mesh.count = 0; mesh.castShadow = block.type !== 'water'; mesh.receiveShadow = true;
      mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      pool = { mesh, keys: [], indices: new Map() }; this.pools.set(block.type, pool); this.root.add(mesh);
    }
    const key = blockKey(block), index = pool.keys.length;
    if (index >= 4096) throw new Error('Limite de blocos do material atingido.');
    pool.keys.push(key); pool.indices.set(key, index);
    this.transform.position.set(block.x * BLOCK_SIZE, (block.y + .5) * BLOCK_SIZE, block.z * BLOCK_SIZE);
    this.transform.scale.setScalar(BLOCK_SIZE); this.transform.updateMatrix();
    pool.mesh.setMatrixAt(index, this.transform.matrix); pool.mesh.count = pool.keys.length; pool.mesh.instanceMatrix.needsUpdate = true;
  }
  remove(block) {
    const key = blockKey(block), existing = this.blocks.get(key);
    if (!existing) return false;
    const pool = this.pools.get(existing.type), index = pool.indices.get(key), last = pool.keys.length - 1;
    if (index !== last) {
      const matrix = new THREE.Matrix4(); pool.mesh.getMatrixAt(last, matrix); pool.mesh.setMatrixAt(index, matrix);
      pool.keys[index] = pool.keys[last]; pool.indices.set(pool.keys[index], index);
    }
    pool.keys.pop(); pool.indices.delete(key); pool.mesh.count--; pool.mesh.instanceMatrix.needsUpdate = true;
    return super.remove(block);
  }
  dispose() { for (const { mesh } of this.pools.values()) mesh.dispose(); this.root.clear(); this.pools.clear(); this.blocks.clear(); }
}
