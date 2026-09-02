import assert from 'node:assert/strict';
import test from 'node:test';

import { terrainHeightAt } from '../app/static/terrain.js';

test('terrain height is deterministic and stays gently rolling', () => {
  const first = terrainHeightAt(2.25, -3.5);

  assert.equal(first, terrainHeightAt(2.25, -3.5));
  assert.ok(Math.abs(first) <= .35);
  assert.ok(Math.abs(terrainHeightAt(-6.1, 4.2)) <= .35);
});

test('lake basin is lower than the nearby meadow', () => {
  assert.ok(terrainHeightAt(-3.8, -1.4) < terrainHeightAt(-1.8, -1.4));
});
