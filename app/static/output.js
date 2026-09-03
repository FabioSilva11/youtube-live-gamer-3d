export function outputDimensions() {
  return { width: 1280, height: 720 };
}

export function previewFovForAspect(baseFov, outputAspect, previewAspect) {
  if (previewAspect >= outputAspect) return baseFov;
  const halfFov = baseFov * Math.PI / 360;
  return Math.atan(Math.tan(halfFov) * outputAspect / previewAspect) * 360 / Math.PI;
}

export function rankingOverlayLayout(frameWidth, frameHeight) {
  const width = Math.min(390, frameWidth * .42);
  const height = width * 430 / 768;
  return {
    width,
    height,
    x: frameWidth - width / 2 - 24,
    y: frameHeight - height / 2 - 24,
  };
}

export function outputCameraPreset() {
  return {
    fov: 45,
    maxDistance: 30,
    position: { x: 0, y: 4.5, z: 24 },
    target: { x: 0, y: -0.8, z: 0 },
    fog: { near: 26, far: 52 },
  };
}
