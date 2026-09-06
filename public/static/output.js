const OUTPUT_PROFILES = Object.freeze({
  fullhd: Object.freeze({ id: 'fullhd', width: 1920, height: 1080, fps: 60, videoBitsPerSecond: 9_000_000 }),
  economy: Object.freeze({ id: 'economy', width: 854, height: 480, fps: 24, videoBitsPerSecond: 1_350_000 }),
  normal: Object.freeze({ id: 'normal', width: 1280, height: 720, fps: 30, videoBitsPerSecond: 3_000_000 }),
});

export function normaliseOutputProfile(profileId) {
  return Object.hasOwn(OUTPUT_PROFILES, profileId) ? profileId : 'economy';
}

export function outputProfile(profileId = 'economy') {
  return OUTPUT_PROFILES[normaliseOutputProfile(profileId)];
}

export const normaliseOrientation = value => value === 'portrait' ? 'portrait' : 'landscape';

export const compositionKey = (biome = 'fantasy', orientation = 'landscape') =>
  `${biome === 'minecraft' ? 'minecraft' : 'fantasy'}:${normaliseOrientation(orientation)}`;

export function defaultSceneView(orientation = 'landscape') {
  return normaliseOrientation(orientation) === 'portrait'
    ? { ranking: { x: .54, y: .04, width: .41, height: .21 }, pix: { x: .04, y: .67, width: .28, height: .28 } }
    : { ranking: { x: .70, y: .04, width: .27, height: .25 }, pix: { x: .03, y: .60, width: .17, height: .34 } };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export function normaliseSceneBox(value, fallback) {
  const box = value && typeof value === 'object' ? value : {};
  const safe = (entry, other) => Number.isFinite(entry) ? entry : other;
  const width = clamp(safe(box.width, fallback.width), .1, .8);
  const height = clamp(safe(box.height, fallback.height), .08, .8);
  return { x: clamp(safe(box.x, fallback.x), 0, 1 - width), y: clamp(safe(box.y, fallback.y), 0, 1 - height), width, height };
}

export function normaliseSceneView(value, orientation = 'landscape') {
  const fallback = defaultSceneView(orientation), view = value && typeof value === 'object' ? value : {};
  const result = { ranking: normaliseSceneBox(view.ranking, fallback.ranking), pix: normaliseSceneBox(view.pix, fallback.pix) };
  const position = view.camera?.position, target = view.camera?.target;
  if (position && target && [...Object.values(position), ...Object.values(target)].every(Number.isFinite)) {
    result.camera = { position: { ...position }, target: { ...target }, fov: clamp(Number.isFinite(view.camera.fov) ? view.camera.fov : 45, 20, 85) };
  }
  return result;
}

export function outputDimensions(profileId = 'economy', orientation = 'landscape') {
  const { width, height } = outputProfile(profileId);
  return normaliseOrientation(orientation) === 'portrait' ? { width: height, height: width } : { width, height };
}

export function previewFovForAspect(baseFov, outputAspect, previewAspect) {
  if (previewAspect >= outputAspect) return baseFov;
  const halfFov = baseFov * Math.PI / 360;
  return Math.atan(Math.tan(halfFov) * outputAspect / previewAspect) * 360 / Math.PI;
}

export function rankingOverlayLayout(frameWidth, frameHeight, peopleCount = 0) {
  const portrait = frameHeight > frameWidth;
  const width = portrait ? Math.min(260, frameWidth * .43) : Math.min(320, frameWidth * .32);
  const sourceHeight = portrait ? 66 + Math.min(peopleCount, 3) * 52 : peopleCount > 0 ? 102 + Math.min(peopleCount, 5) * 61 : 84;
  const height = width * sourceHeight / (portrait ? 384 : 768);
  const margin = Math.max(14, Math.round(frameWidth * .018));
  return {
    width,
    height,
    x: frameWidth - width / 2 - margin,
    y: frameHeight - height / 2 - margin,
  };
}

export function pixOverlayLayout(frameWidth, frameHeight) {
  const width = frameHeight > frameWidth ? Math.min(200, frameWidth * .3) : Math.min(180, frameWidth * .2);
  const height = width * 1160 / 1024;
  const margin = Math.max(14, Math.round(frameWidth * .018));
  return {
    width,
    height,
    x: width / 2 + margin,
    y: height / 2 + margin,
  };
}

export function orientedCameraPreset(preset, orientation) {
  if (normaliseOrientation(orientation) !== 'portrait') return preset;
  const factor = 1.6;
  return { ...preset, maxDistance: preset.maxDistance * factor,
    position: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, preset.target[axis] + (preset.position[axis] - preset.target[axis]) * factor])),
    fog: {near: preset.fog.near * factor, far: preset.fog.far * factor} };
}

export function outputCameraPreset() {
  return {
    fov: 45,
    maxDistance: 30,
    position: { x: 0, y: 4.5, z: 24 },
    target: { x: 0, y: -0.8, z: 0 },
    fog: { near: 30, far: 76 },
  };
}
