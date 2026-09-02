const OUTPUT_FORMATS = new Set(['desktop', 'mobile']);

export function normaliseOutputFormat(value) {
  return OUTPUT_FORMATS.has(value) ? value : 'desktop';
}

export function outputDimensions(value) {
  return normaliseOutputFormat(value) === 'mobile'
    ? { width: 720, height: 1280 }
    : { width: 1280, height: 720 };
}

export function outputCameraPreset(value) {
  if (normaliseOutputFormat(value) === 'mobile') {
    return {
      fov: 45,
      maxDistance: 60,
      position: { x: 0, y: 28, z: 38 },
      target: { x: 0, y: 0, z: 0 },
      fog: { near: 28, far: 75 },
    };
  }
  return {
    fov: 45,
    maxDistance: 19,
    position: { x: 0, y: 5.45, z: 14.8 },
    target: { x: 0, y: 1.3, z: 0 },
    fog: { near: 14, far: 35 },
  };
}
