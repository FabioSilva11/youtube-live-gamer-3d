const ENTRY_MODES = new Set(['current', 'spotlight', 'drop', 'portal']);
const EXIT_MODES = new Set(['current', 'walk', 'float', 'portal']);
const clampProgress = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const easeOutCubic = (value) => 1 - (1 - value) ** 3;

export function normaliseEntryMode(value) {
  return ENTRY_MODES.has(value) ? value : 'current';
}

export function normaliseExitMode(value) {
  return EXIT_MODES.has(value) ? value : 'current';
}

export function entryMotion(mode, progress) {
  const eased = easeOutCubic(clampProgress(progress));
  if (mode === 'drop') {
    return { heightOffset: (1 - eased) * 5.5, scaleMultiplier: .62 + eased * .38, spin: (1 - eased) * .8 };
  }
  if (mode === 'portal') {
    return { heightOffset: 0, scaleMultiplier: .08 + eased * .92, spin: (1 - eased) * Math.PI * 4 };
  }
  return { heightOffset: 0, scaleMultiplier: 1, spin: 0 };
}

export function exitMotion(mode, progress) {
  const amount = clampProgress(progress);
  const eased = easeOutCubic(amount);
  if (mode === 'float') {
    return { heightOffset: eased * 5.8, scaleMultiplier: 1 - eased * .55, spin: eased * .8 };
  }
  if (mode === 'portal') {
    return { heightOffset: eased * .6, scaleMultiplier: Math.max(.05, 1 - eased), spin: eased * Math.PI * 4 };
  }
  return { heightOffset: 0, scaleMultiplier: 1, spin: 0 };
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
