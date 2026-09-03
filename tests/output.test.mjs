import assert from 'node:assert/strict';
import test from 'node:test';

import {
  outputCameraPreset,
  outputDimensions,
  pixOverlayLayout,
  previewFovForAspect,
  rankingOverlayLayout,
} from '../app/static/output.js';

test('desktop output uses YouTube 16:9 HD dimensions', () => {
  assert.deepEqual(outputDimensions(), { width: 1280, height: 720 });
});

test('the PC camera keeps the whole meadow visible in the landscape frame', () => {
  const preset = outputCameraPreset();
  const distance = Math.hypot(
    preset.position.x - preset.target.x,
    preset.position.y - preset.target.y,
    preset.position.z - preset.target.z,
  );

  assert.ok(distance >= 14);
  assert.ok(preset.position.y >= 4);
  assert.ok(preset.fog.far > distance);
  assert.ok(preset.target.y <= 1);
});

test('a tall preview expands vertically instead of cropping the output framing', () => {
  assert.equal(previewFovForAspect(45, 16 / 9, 16 / 9), 45);
  assert.ok(previewFovForAspect(45, 16 / 9, 1) > 60);
  assert.equal(previewFovForAspect(45, 9 / 16, 16 / 9), 45);
});

test('ranking stays fully inside the 1280x720 live frame safe area', () => {
  const layout = rankingOverlayLayout(1280, 720);

  assert.equal(layout.width, 390);
  assert.ok(layout.x - layout.width / 2 >= 24);
  assert.ok(layout.y - layout.height / 2 >= 24);
  assert.ok(layout.x + layout.width / 2 <= 1280 - 24);
  assert.ok(layout.y + layout.height / 2 <= 720 - 24);
});

test('Pix donation QR stays smaller in the bottom-left without overlapping the ranking', () => {
  const frame = outputDimensions();
  const pix = pixOverlayLayout(frame.width, frame.height);
  const ranking = rankingOverlayLayout(frame.width, frame.height);

  assert.equal(pix.width, 220);
  assert.equal(pix.x - pix.width / 2, 38);
  assert.equal(pix.y - pix.height / 2, 34);
  assert.ok(pix.x + pix.width / 2 < ranking.x - ranking.width / 2);
});
