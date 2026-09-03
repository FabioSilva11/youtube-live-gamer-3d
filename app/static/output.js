const OUTPUT_PROFILES = Object.freeze({
  economy: Object.freeze({ id: 'economy', width: 854, height: 480, fps: 24, videoBitsPerSecond: 1_350_000 }),
  normal: Object.freeze({ id: 'normal', width: 1280, height: 720, fps: 30, videoBitsPerSecond: 3_000_000 }),
});

export function normaliseOutputProfile(profileId) {
  return Object.hasOwn(OUTPUT_PROFILES, profileId) ? profileId : 'economy';
}

export function outputProfile(profileId = 'economy') {
  return OUTPUT_PROFILES[normaliseOutputProfile(profileId)];
}

export function outputDimensions(profileId = 'economy') {
  const { width, height } = outputProfile(profileId);
  return { width, height };
}

export function previewFovForAspect(baseFov, outputAspect, previewAspect) {
  if (previewAspect >= outputAspect) return baseFov;
  const halfFov = baseFov * Math.PI / 360;
  return Math.atan(Math.tan(halfFov) * outputAspect / previewAspect) * 360 / Math.PI;
}

export function rankingOverlayLayout(frameWidth, frameHeight, peopleCount = 0) {
  const width = Math.min(320, frameWidth * .32);
  const sourceHeight = peopleCount > 0 ? 102 + Math.min(peopleCount, 5) * 61 : 84;
  const height = width * sourceHeight / 768;
  const margin = Math.max(14, Math.round(frameWidth * .018));
  return {
    width,
    height,
    x: frameWidth - width / 2 - margin,
    y: frameHeight - height / 2 - margin,
  };
}

export function pixOverlayLayout(frameWidth, frameHeight) {
  const width = Math.min(180, frameWidth * .2);
  const height = width * 1160 / 1024;
  const margin = Math.max(14, Math.round(frameWidth * .018));
  return {
    width,
    height,
    x: width / 2 + margin,
    y: height / 2 + margin,
  };
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
