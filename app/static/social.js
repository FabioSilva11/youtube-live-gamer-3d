const SOCIAL_CYCLE_MS = 18_000;
const APPROACH_END_MS = 3_200;
const INTERACTION_END_MS = 6_800;
const EXPLORATION_END_MS = 15_000;
const PERSONAL_SPACE = 0.7;

export function socialPartnerIndex(index, count) {
  if (count < 2 || index < 0 || index >= count) return null;
  const partner = index % 2 === 0 ? index + 1 : index - 1;
  return partner < count ? partner : null;
}

export function socialInteractionPhase(elapsedMs, hasPartner, pairIndex = 0) {
  const staggered = (elapsedMs + pairIndex * 1_700) % SOCIAL_CYCLE_MS;
  if (hasPartner && staggered < APPROACH_END_MS) return 'approach';
  if (hasPartner && staggered < INTERACTION_END_MS) return 'interact';
  if (staggered < EXPLORATION_END_MS) return 'explore';
  return 'rest';
}

export function socialCycleIndex(elapsedMs, index = 0) {
  return Math.floor((Math.max(0, elapsedMs) + index * 850) / SOCIAL_CYCLE_MS);
}

export function explorationTarget(index, cycle) {
  const angle = (index * 2.399963 + cycle * 1.618034) % (Math.PI * 2);
  const radius = 3.1 + ((index * 17 + cycle * 13) % 8) * .38;
  let x = Math.cos(angle) * radius * 1.1;
  const z = Math.sin(angle) * radius * .75;
  const lakeDistance = ((x + 3.8) ** 2) / 2.5 + ((z + 1.4) ** 2) / 1.15;
  if (lakeDistance < 2) x = Math.abs(x) * .8 + 1.2;
  return { x, z };
}

export function socialMeetingTarget(self, partner) {
  const midpointX = (self.x + partner.x) / 2;
  const midpointZ = (self.z + partner.z) / 2;
  const deltaX = self.x - partner.x;
  const deltaZ = self.z - partner.z;
  const distance = Math.hypot(deltaX, deltaZ);
  const directionX = distance > 0.001 ? deltaX / distance : -1;
  const directionZ = distance > 0.001 ? deltaZ / distance : 0;
  return {
    x: midpointX + directionX * PERSONAL_SPACE,
    z: midpointZ + directionZ * PERSONAL_SPACE,
  };
}

export function avatarActivityAnimation({ moving, socialPhase, index }) {
  if (moving) return 'walk';
  if (socialPhase === 'interact') return index % 2 === 0 ? 'emote-yes' : 'interact-right';
  return 'idle';
}
