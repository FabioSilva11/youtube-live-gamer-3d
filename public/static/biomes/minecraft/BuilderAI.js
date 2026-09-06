import { BLOCK_SIZE } from './BlockGrid.js';

export class BuilderAI {
  constructor(manager, world) { this.manager = manager; this.world = world; this.workers = new Map(); }
  resetPaths() { for (const id of this.workers.keys()) this.manager.release(id); this.workers.clear(); }
  update(avatars, dt, time) {
    const active = [...avatars.values()].filter(a => a.userData.phase === 'active');
    this.manager.syncMembers(active.map(a => a.userData.id)); this.manager.update(dt);
    const activeIds = new Set(active.map(a => a.userData.id));
    for (const id of this.workers.keys()) if (!activeIds.has(id)) this.workers.delete(id);
    for (const avatar of active) {
      const id = avatar.userData.id;
      let worker = this.workers.get(id);
      if (!worker) { worker = { task: null, path: [], work: 0, retry: 0, tour: -1 }; this.workers.set(id, worker); }
      const feet = () => ({ x: avatar.position.x / BLOCK_SIZE, y: avatar.position.y / BLOCK_SIZE, z: avatar.position.z / BLOCK_SIZE });
      const site = this.manager.sites[this.manager.assignments.get(id)];
      avatar.userData.builderWorking = false; avatar.userData.builderWalking = false;
      if (!site) continue;
      if (worker.site !== site.index || worker.cycle !== site.cycle || worker.phase !== site.phase) {
        worker.task = null; worker.path = []; worker.work = 0; worker.retry = 0; worker.tour = -1;
        worker.site = site.index; worker.cycle = site.cycle; worker.phase = site.phase;
      }
      if (worker.task && !site.claims.has(id)) { worker.task = null; worker.path = []; }
      worker.retry -= dt;
      if (!worker.task && worker.retry <= 0 && ['building', 'dismantling'].includes(site.phase)) {
        worker.task = this.manager.claim(id, feet());
        worker.path = worker.task ? [...worker.task.path] : [];
        worker.work = 0; worker.retry = .5;
      }
      if (!worker.task && site.phase === 'enjoying') {
        const tour = Math.floor(site.elapsed / 7);
        if (tour !== worker.tour) {
          worker.tour = tour;
          const slot = (site.members.indexOf(id) + tour) % 4;
          const points = [[-2, -2], [6, -2], [6, 6], [-2, 6]];
          const [x, z] = points[slot];
          worker.path = this.world.pathTo(feet(), p => p.x === site.origin.x + x && p.z === site.origin.z + z) || [];
        }
      }
      if (worker.path.length) {
        const next = worker.path[0];
        if (!this.world.canStand(next)) { this.manager.release(id); worker.task = null; worker.path = []; worker.retry = .2; continue; }
        const x = next.x * BLOCK_SIZE, y = next.y * BLOCK_SIZE, z = next.z * BLOCK_SIZE;
        const dx = x - avatar.position.x, dz = z - avatar.position.z, distance = Math.hypot(dx, dz);
        avatar.userData.target.set(x, y, z);
        const step = Math.min(distance, dt * 1.8);
        if (distance > .01) {
          avatar.position.x += dx / distance * step; avatar.position.z += dz / distance * step;
          avatar.lookAt(x, avatar.position.y, z); avatar.userData.builderWalking = true;
        }
        avatar.position.y += Math.sign(y - avatar.position.y) * Math.min(Math.abs(y - avatar.position.y), dt * 2.8);
        if (distance < .045 && Math.abs(y - avatar.position.y) < .03) worker.path.shift();
      } else if (worker.task) {
        const b = worker.task.block;
        avatar.lookAt(b.x * BLOCK_SIZE, avatar.position.y, b.z * BLOCK_SIZE);
        avatar.userData.builderWorking = true; avatar.userData.builderBlock = b.type;
        worker.work += dt;
        if (worker.work >= .7) {
          if (this.manager.complete(id, feet())) this.onBlock?.(b, worker.task.mode);
          else this.manager.release(id);
          worker.task = null; worker.work = 0;
        }
      } else if (site.phase === 'enjoying') {
        avatar.lookAt((site.origin.x + 2) * BLOCK_SIZE, avatar.position.y, (site.origin.z + 2) * BLOCK_SIZE);
      }
      if (!worker.path.length) avatar.userData.target.copy(avatar.position);
      this.animateBody(avatar, time, dt, site.phase === 'enjoying');
    }
  }
  animateBody(avatar, time, dt, celebrating) {
    const body = avatar.userData.body, limbs = body?.userData.limbs;
    if (!limbs) return;
    const moving = avatar.userData.builderWalking, working = avatar.userData.builderWorking;
    const stride = moving ? Math.sin(time * 9) * .65 : 0;
    limbs.leftLeg.rotation.x = stride; limbs.rightLeg.rotation.x = -stride;
    limbs.leftArm.rotation.x = -stride;
    limbs.rightArm.rotation.x = working ? -1.2 + Math.sin(time * 15) * .55 : stride;
    if (!moving && celebrating) limbs.leftArm.rotation.z = -.5 + Math.sin(time * 3) * .3;
    else limbs.leftArm.rotation.z = 0;
    limbs.block.visible = working || (moving && Boolean(this.workers.get(avatar.userData.id)?.task?.mode === 'building'));
  }
}
