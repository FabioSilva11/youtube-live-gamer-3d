import assert from 'node:assert/strict';
import test from 'node:test';

import { normaliseOutputFormat, outputCameraPreset, outputDimensions } from '../app/static/output.js';

test('desktop output uses YouTube 16:9 HD dimensions', () => {
  assert.deepEqual(outputDimensions('desktop'), { width: 1280, height: 720 });
});

test('mobile output uses a vertical 9:16 frame', () => {
  assert.deepEqual(outputDimensions('mobile'), { width: 720, height: 1280 });
});

test('unknown output formats fall back to desktop', () => {
  assert.equal(normaliseOutputFormat('square'), 'desktop');
});

test('mobile camera pulls back and looks down to keep the whole meadow visible', () => {
  const preset = outputCameraPreset('mobile');
  const distance = Math.hypot(
    preset.position.x - preset.target.x,
    preset.position.y - preset.target.y,
    preset.position.z - preset.target.z,
  );

  assert.ok(distance >= 45);
  assert.ok(preset.position.y >= 25);
  assert.ok(preset.fog.far > distance);
  assert.deepEqual(preset.target, { x: 0, y: 0, z: 0 });
});
