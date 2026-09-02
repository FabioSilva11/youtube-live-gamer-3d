import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ArrivalQueue,
  normaliseEntryMode,
  normaliseExitMode,
} from '../app/static/animation.js';

test('accepts only supported entry and exit modes', () => {
  assert.equal(normaliseEntryMode('spotlight'), 'spotlight');
  assert.equal(normaliseEntryMode('invalid'), 'current');
  assert.equal(normaliseExitMode('walk'), 'walk');
  assert.equal(normaliseExitMode('invalid'), 'current');
});

test('arrival queue presents one participant at a time in FIFO order', () => {
  const queue = new ArrivalQueue();
  queue.enqueue('avatar-a');
  queue.enqueue('avatar-b');
  queue.enqueue('avatar-a');

  assert.equal(queue.startNext(), 'avatar-a');
  assert.equal(queue.startNext(), null);
  queue.complete('avatar-a');
  assert.equal(queue.startNext(), 'avatar-b');
});

test('arrival queue flush releases the active and pending participants', () => {
  const queue = new ArrivalQueue();
  queue.enqueue('avatar-a');
  queue.enqueue('avatar-b');
  queue.startNext();

  assert.deepEqual(queue.flush(), ['avatar-a', 'avatar-b']);
  assert.equal(queue.startNext(), null);
});
