import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ArrivalQueue,
  entryMotion,
  exitMotion,
  normaliseEntryMode,
  normaliseExitMode,
} from '../app/static/animation.js';

test('accepts only supported entry and exit modes', () => {
  assert.equal(normaliseEntryMode('spotlight'), 'spotlight');
  assert.equal(normaliseEntryMode('drop'), 'drop');
  assert.equal(normaliseEntryMode('portal'), 'portal');
  assert.equal(normaliseEntryMode('invalid'), 'current');
  assert.equal(normaliseExitMode('walk'), 'walk');
  assert.equal(normaliseExitMode('float'), 'float');
  assert.equal(normaliseExitMode('portal'), 'portal');
  assert.equal(normaliseExitMode('invalid'), 'current');
});

test('drop and portal entries finish at the normal avatar pose', () => {
  assert.ok(entryMotion('drop', 0).heightOffset >= 5);
  assert.equal(entryMotion('drop', 1).heightOffset, 0);
  assert.ok(entryMotion('portal', 0).scaleMultiplier < .1);
  assert.equal(entryMotion('portal', 1).scaleMultiplier, 1);
  assert.deepEqual(entryMotion('current', 2), { heightOffset: 0, scaleMultiplier: 1, spin: 0 });
});

test('floating and portal exits move away from the normal avatar pose', () => {
  assert.ok(exitMotion('float', 1).heightOffset >= 5);
  assert.ok(exitMotion('portal', 1).scaleMultiplier <= .05);
  assert.deepEqual(exitMotion('walk', -1), { heightOffset: 0, scaleMultiplier: 1, spin: 0 });
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
