import { blockKey } from './BlockGrid.js';

export function worldBlocks(blueprint, origin) {
  const seen = new Set();
  return blueprint.blocks.map(b => {
    if (![b.x, b.y, b.z].every(Number.isInteger) || b.y < 0 || !b.type) throw new Error('Blueprint inválido.');
    const block = { ...b, x: origin.x + b.x, y: origin.y + b.y, z: origin.z + b.z };
    const key = blockKey(block); if (seen.has(key)) throw new Error('Bloco duplicado no blueprint.'); seen.add(key);
    return block;
  }).sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
}

export const DEFAULT_SITES = [{ x: -10, y: 0, z: -6 }, { x: 3, y: 0, z: -6 }, { x: -4, y: 0, z: 4 }];

export function scaffoldBlocks(blocks, origin) {
  const height = Math.max(...blocks.map(b => b.y - origin.y));
  const steps = height <= 2 ? 0 : height + 1, result = [];
  for (let y = 0; y < steps; y++) for (let step = y; step < steps; step++) {
    result.push({ x: origin.x - 1, y: origin.y + y, z: origin.z + 5 - steps + step, type: 'wood', scaffold: true });
  }
  return result;
}

export class StructureManager {
  constructor(world, blueprints, { holdSeconds = 24, cooldownSeconds = 4, origins = DEFAULT_SITES } = {}) {
    this.world = world; this.blueprints = blueprints; this.holdSeconds = holdSeconds; this.cooldownSeconds = cooldownSeconds;
    this.sites = origins.map((origin, index) => ({ origin, index, cycle: 0, members: [], phase: 'waiting', blocks: [], placed: new Set(), claims: new Map(), elapsed: 0, completed: 0 }));
    this.assignments = new Map(); this.ids = []; this.phase = 'waiting'; this.cycle = 0; this.elapsed = 0; this.demolitionIndex = 0;
  }
  syncMembers(ids) {
    this.ids = [...new Set(ids)];
    for (const [id, index] of this.assignments) if (!this.ids.includes(id)) { this.sites[index].claims.delete(id); this.assignments.delete(id); }
    this.rebalance();
  }
  rebalance() {
    const available = this.phase === 'dismantling' ? [this.sites[this.demolitionIndex]]
      : this.phase === 'building' ? this.sites.filter(s => s.phase === 'building') : this.sites;
    const eligible = new Set(available.map(s => s.index));
    for (const [id, index] of this.assignments) if (!eligible.has(index)) { this.sites[index].claims.delete(id); this.assignments.delete(id); }
    for (const id of this.ids) if (!this.assignments.has(id) && available.length) {
      const count = site => [...this.assignments.values()].filter(i => i === site.index).length;
      // Small initial crews, then everyone can help with the last remaining job.
      const site = available.find(s => count(s) < 4) || [...available].sort((a, b) => count(a) - count(b))[0];
      this.assignments.set(id, site.index);
    }
    for (const site of this.sites) site.members = this.ids.filter(id => this.assignments.get(id) === site.index);
  }
  start(site) {
    const blueprint = this.blueprints[(site.index + this.cycle) % this.blueprints.length];
    const structure = worldBlocks(blueprint, site.origin);
    site.blueprint = blueprint; site.blocks = [...scaffoldBlocks(structure, site.origin), ...structure];
    site.bounds = { minX: Math.min(...structure.map(b => b.x)), maxX: Math.max(...structure.map(b => b.x)), minZ: Math.min(...structure.map(b => b.z)), maxZ: Math.max(...structure.map(b => b.z)) };
    site.placed.clear(); site.claims.clear(); site.elapsed = 0; site.phase = 'building'; site.cycle = this.cycle;
  }
  update(dt) {
    if (!this.ids.length) return;
    if (this.phase === 'waiting') { this.sites.forEach(s => this.start(s)); this.phase = 'building'; }
    if (this.phase === 'building') {
      for (const site of this.sites) if (site.phase === 'building' && site.placed.size === site.blocks.length) { site.phase = 'ready'; site.completed++; }
      if (this.sites.every(s => s.phase === 'ready')) {
        this.phase = 'enjoying'; this.elapsed = 0;
        for (const site of this.sites) { site.phase = 'enjoying'; site.elapsed = 0; }
      }
    } else if (this.phase === 'enjoying') {
      this.elapsed += dt; this.sites.forEach(s => { s.elapsed = this.elapsed; });
      if (this.elapsed >= this.holdSeconds) {
        this.phase = 'dismantling'; this.demolitionIndex = 0;
        for (const site of this.sites) { site.phase = 'ready'; site.claims.clear(); }
        this.sites[0].phase = 'dismantling';
      }
    } else if (this.phase === 'dismantling') {
      const site = this.sites[this.demolitionIndex];
      if (site.placed.size === 0) {
        site.phase = 'cleared'; site.claims.clear(); this.demolitionIndex++;
        if (this.demolitionIndex < this.sites.length) this.sites[this.demolitionIndex].phase = 'dismantling';
        else { this.phase = 'cooldown'; this.elapsed = 0; this.sites.forEach(s => { s.phase = 'cooldown'; }); }
      }
    } else if (this.phase === 'cooldown') {
      this.elapsed += dt;
      if (this.elapsed >= this.cooldownSeconds) { this.cycle++; this.sites.forEach(s => this.start(s)); this.phase = 'building'; }
    }
    this.rebalance();
  }
  pending(site) {
    const removing = site.phase === 'dismantling';
    const blocks = site.blocks.filter(b => removing === site.placed.has(blockKey(b)));
    const first = blocks.filter(b => removing ? !b.scaffold : b.scaffold);
    return first.length ? first : blocks;
  }
  claim(id, start) {
    const site = this.sites[this.assignments.get(id)];
    if (!site || !['building', 'dismantling'].includes(site.phase)) return null;
    if (site.claims.has(id)) return site.claims.get(id);
    const removing = site.phase === 'dismantling';
    const pending = this.pending(site);
    if (!pending.length) return null;
    const level = removing ? Math.max(...pending.map(b => b.y)) : Math.min(...pending.map(b => b.y));
    const reserved = new Set([...site.claims.values()].map(c => blockKey(c.block)));
    const innerDepth = b => Math.min(b.x - site.bounds.minX, site.bounds.maxX - b.x, b.z - site.bounds.minZ, site.bounds.maxZ - b.z);
    const candidates = pending.filter(b => b.y === level && !reserved.has(blockKey(b))).sort((a, b) => (removing ? innerDepth(b) - innerDepth(a) : 0) || Math.hypot(a.x - start.x, a.z - start.z) - Math.hypot(b.x - start.x, b.z - start.z));
    for (const block of candidates) {
      const path = this.world.workPath(start, block, site.phase);
      if (!path) continue;
      const claim = { block, path, mode: site.phase, site: site.index }; site.claims.set(id, claim); return claim;
    }
    return null;
  }
  release(id) { this.sites[this.assignments.get(id)]?.claims.delete(id); }
  complete(id, feet) {
    const site = this.sites[this.assignments.get(id)], claim = site?.claims.get(id);
    if (!claim || claim.mode !== site.phase) return false;
    const b = claim.block, distance = Math.hypot(feet.x - b.x, feet.z - b.z);
    if (distance < .8 || distance > 1.65 || b.y - feet.y > 2.05 || b.y - feet.y < -1.05) return false;
    if (claim.mode === 'building') { this.world.set(b); site.placed.add(blockKey(b)); }
    else { this.world.remove(b); site.placed.delete(blockKey(b)); }
    site.claims.delete(id); return true;
  }
}
