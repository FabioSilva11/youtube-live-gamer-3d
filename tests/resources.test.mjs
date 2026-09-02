import assert from 'node:assert/strict';
import test from 'node:test';

import { disposeOwnedRenderObject } from '../app/static/resources.js';

function disposable(counter, key) {
  return { dispose() { counter[key] = (counter[key] || 0) + 1; } };
}

test('disposes avatar-owned geometries and materials exactly once', () => {
  const calls = {};
  const child = {
    geometry: disposable(calls, 'geometry'),
    material: [disposable(calls, 'material'), disposable(calls, 'material')],
  };
  const owned = {
    userData: { ownsAvatarResources: true },
    traverse(visitor) { visitor(child); },
  };

  assert.equal(disposeOwnedRenderObject(owned), true);
  assert.deepEqual(calls, { geometry: 1, material: 2 });
  assert.equal(owned.userData.ownsAvatarResources, false);
  assert.equal(disposeOwnedRenderObject(owned), false);
  assert.deepEqual(calls, { geometry: 1, material: 2 });
});

test('never disposes shared character-template resources', () => {
  const calls = {};
  const shared = {
    userData: {},
    traverse(visitor) {
      visitor({ geometry: disposable(calls, 'geometry'), material: disposable(calls, 'material') });
    },
  };

  assert.equal(disposeOwnedRenderObject(shared), false);
  assert.deepEqual(calls, {});
});
