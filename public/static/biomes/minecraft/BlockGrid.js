export const BLOCK_SIZE = .7;
export const blockKey = ({ x, y, z }) => `${x},${y},${z}`;
export class BlockGrid {
  constructor() { this.blocks = new Map(); this.revision = 0; this.heights = new Map(); this.routes = new Map(); }
  set(block) { this.blocks.set(blockKey(block), { ...block }); this.heights.delete(`${block.x},${block.z}`); this.routes.clear(); this.revision++; }
  remove(block) { const removed = this.blocks.delete(blockKey(block)); if (removed) { this.heights.delete(`${block.x},${block.z}`); this.routes.clear(); this.revision++; } return removed; }
  has(block) { return this.blocks.has(blockKey(block)); }
  surface(x, z) {
    const key = `${x},${z}`;
    if (this.heights.has(key)) return this.heights.get(key);
    for (let y = 9; y >= -4; y--) {
      const b = this.blocks.get(`${x},${y},${z}`);
      if (b && b.type !== 'water' && b.type !== 'leaves') { this.heights.set(key, y + 1); return y + 1; }
    }
    this.heights.set(key, -99);
    return -99;
  }
  walkable(x, z) { return Math.abs(x) <= 16 && Math.abs(z) <= 12 && this.surface(x, z) >= 0; }
  solid(x, y, z) { const block = this.blocks.get(`${x},${y},${z}`); return Boolean(block && block.type !== 'water' && block.type !== 'leaves'); }
  canStand({x, y, z}) { return Math.abs(x) <= 16 && Math.abs(z) <= 12 && y >= 0 && y <= 10 && this.solid(x, y - 1, z) && !this.solid(x, y, z) && !this.solid(x, y + 1, z); }
  // Breadth-first search on the current surface: one block per step, no wall crossing.
  pathTo(start, goal) {
    const first = { x: Math.round(start.x), z: Math.round(start.z) };
    first.y = Math.round(start.y ?? this.surface(first.x, first.z));
    if (!this.canStand(first)) first.y = this.surface(first.x, first.z);
    const cacheKey = blockKey(first);
    const cached = this.routes.get(cacheKey);
    const queue = cached?.queue || [first], visited = cached?.visited || new Map([[cacheKey, null]]);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i];
      if (cached) continue;
      for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const x = p.x + dx, z = p.z + dz;
        for (const y of [p.y, p.y + 1, p.y - 1]) {
          const next = { x, y, z }, key = blockKey(next);
          if (visited.has(key) || !this.canStand(next)) continue;
          visited.set(key, p); queue.push(next);
        }
      }
    }
    if (this.routes.size > 20) this.routes.clear();
    this.routes.set(cacheKey, { queue, visited });
    const destination = queue.find(goal);
    if (destination) {
      const path = [destination]; let previous = visited.get(blockKey(destination));
      while (previous) { path.push(previous); previous = visited.get(blockKey(previous)); }
      return path.reverse();
    }
    return null;
  }
  workPath(start, block, mode) {
    const rejected = new Set();
    for (let attempt = 0; attempt < 24; attempt++) {
    const path = this.pathTo(start, p => {
      const distance = Math.hypot(p.x - block.x, p.z - block.z);
      // Always stand beside the target; never remove the block beneath a builder.
      return !rejected.has(blockKey(p)) && distance >= 1 && distance <= 1.5 && block.y - p.y >= -1 && block.y - p.y <= 2;
    });
    if (!path || mode !== 'dismantling') return path;
    // Do not cut off the worker's route back down while taking a roof apart.
    const key = blockKey(block), saved = this.blocks.get(key), end = path.at(-1);
    this.blocks.delete(key); this.heights.clear(); this.routes.clear();
    let escape;
    try { escape = this.pathTo(end, p => p.y === 0); }
    finally { if (saved) this.blocks.set(key, saved); this.heights.clear(); this.routes.clear(); }
    if (escape) return path;
    rejected.add(blockKey(end));
    }
    return null;
  }
}
