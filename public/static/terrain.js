const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function terrainHeightAt(x, z) {
  const rollingMeadow =
    Math.sin(x * 0.58) * 0.08 +
    Math.cos(z * 0.66) * 0.07 +
    Math.sin((x + z) * 1.05) * 0.035;

  const lakeX = x + 3.8;
  const lakeZ = z + 1.4;
  const lakeBasin = Math.exp(-((lakeX * lakeX) / 2.5 + (lakeZ * lakeZ) / 1.15));
  return clamp(rollingMeadow - lakeBasin * 0.27, -0.35, 0.35);
}
