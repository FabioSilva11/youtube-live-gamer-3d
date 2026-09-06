const RINGS = [
  { capacity: 8, radius: 2.2 },
  { capacity: 14, radius: 3.8 },
  { capacity: 20, radius: 5.3 },
  { capacity: 28, radius: 6.7 },
];
const MAX_VISUAL_PARTICIPANTS = 18;

export function latestVisualParticipants(people) {
  return people.slice(-MAX_VISUAL_PARTICIPANTS);
}

function avatarScaleFor(count) {
  if (count <= 8) return 1;
  if (count <= 22) return .78;
  if (count <= 42) return .63;
  return .52;
}

export function avatarLayoutFor(index, count) {
  if (count <= 1) return { x: 0, z: 0, scale: 1, ring: 0 };
  let offset = index;
  for (let ringIndex = 0; ringIndex < RINGS.length; ringIndex += 1) {
    const ring = RINGS[ringIndex];
    if (offset < ring.capacity) {
      const angle = offset / ring.capacity * Math.PI * 2 - Math.PI / 2 + ringIndex * .18;
      return {
        x: Math.cos(angle) * ring.radius,
        z: Math.sin(angle) * ring.radius,
        scale: avatarScaleFor(count),
        ring: ringIndex,
      };
    }
    offset -= ring.capacity;
  }
  const outer = RINGS.at(-1);
  const angle = index * 2.3999632297;
  return {
    x: Math.cos(angle) * outer.radius,
    z: Math.sin(angle) * outer.radius,
    scale: avatarScaleFor(count),
    ring: RINGS.length - 1,
  };
}
