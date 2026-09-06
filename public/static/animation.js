const ENTRY_MODES = new Set(['current', 'spotlight', 'drop', 'portal', 'bounce', 'rise', 'twirl']);
const EXIT_MODES = new Set(['current', 'walk', 'float', 'portal', 'rocket', 'shrink', 'twirl']);
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
  const amount = clampProgress(progress);
  if (mode === 'bounce') return { heightOffset: Math.abs(Math.sin(amount * Math.PI * 3)) * (1 - amount) * 2, scaleMultiplier: .3 + eased * .7, spin: 0 };
  if (mode === 'rise') return { heightOffset: (eased - 1) * 2, scaleMultiplier: .1 + eased * .9, spin: 0 };
  if (mode === 'twirl') return { heightOffset: Math.sin(amount * Math.PI) * 1.4, scaleMultiplier: .1 + eased * .9, spin: (1 - eased) * Math.PI * 6 };
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
  if (mode === 'rocket') return { heightOffset: amount ** 3 * 12, scaleMultiplier: 1 - amount * .8, spin: 0 };
  if (mode === 'shrink') return { heightOffset: 0, scaleMultiplier: Math.max(.001, 1 - eased), spin: 0 };
  if (mode === 'twirl') return { heightOffset: Math.sin(amount * Math.PI) * 1.4, scaleMultiplier: Math.max(.001, 1 - amount), spin: eased * Math.PI * 6 };
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
