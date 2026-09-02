const ENTRY_MODES = new Set(['current', 'spotlight']);
const EXIT_MODES = new Set(['current', 'walk']);

export function normaliseEntryMode(value) {
  return ENTRY_MODES.has(value) ? value : 'current';
}

export function normaliseExitMode(value) {
  return EXIT_MODES.has(value) ? value : 'current';
}

export class ArrivalQueue {
  constructor() {
    this.pending = [];
    this.active = null;
  }

  enqueue(avatarId) {
    if (!avatarId || avatarId === this.active || this.pending.includes(avatarId)) return;
    this.pending.push(avatarId);
  }

  startNext() {
    if (this.active || !this.pending.length) return null;
    this.active = this.pending.shift();
    return this.active;
  }

  complete(avatarId) {
    if (this.active === avatarId) this.active = null;
  }

  remove(avatarId) {
    this.pending = this.pending.filter((id) => id !== avatarId);
    if (this.active === avatarId) this.active = null;
  }

  flush() {
    const released = this.active ? [this.active, ...this.pending] : [...this.pending];
    this.active = null;
    this.pending = [];
    return released;
  }
}
