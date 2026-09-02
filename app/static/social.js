const SOCIAL_CYCLE_MS = 12_000;
const APPROACH_END_MS = 3_200;
const INTERACTION_END_MS = 6_800;
const PERSONAL_SPACE = 0.7;

export function socialPartnerIndex(index, count) {
  if (count < 2 || index < 0 || index >= count) return null;
  const partner = index % 2 === 0 ? index + 1 : index - 1;
  return partner < count ? partner : null;
}

export function socialInteractionPhase(elapsedMs, hasPartner, pairIndex = 0) {
  if (!hasPartner) return 'rest';
  const staggered = (elapsedMs + pairIndex * 1_700) % SOCIAL_CYCLE_MS;
  if (staggered < APPROACH_END_MS) return 'approach';
  if (staggered < INTERACTION_END_MS) return 'interact';
  return 'rest';
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
