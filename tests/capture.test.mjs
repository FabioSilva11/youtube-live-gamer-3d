import assert from 'node:assert/strict';
import test from 'node:test';

import { captureSessionIsActive, stopMediaTracks } from '../app/static/capture.js';

test('stops every video and audio track owned by a canvas capture', () => {
  const stops = [];
  const stream = {
    getTracks() {
      return [
        { stop() { stops.push('video'); } },
        { stop() { stops.push('audio'); } },
      ];
    },
  };

  assert.equal(stopMediaTracks(stream), 2);
  assert.deepEqual(stops, ['video', 'audio']);
  assert.equal(stopMediaTracks(null), 0);
});

test('rejects a stale or already-closed output socket during capture startup', () => {
  const socket = { readyState: 1 };
  assert.equal(captureSessionIsActive(3, 3, socket, socket), true);
  assert.equal(captureSessionIsActive(2, 3, socket, socket), false);
  assert.equal(captureSessionIsActive(3, 3, { readyState: 1 }, socket), false);
  socket.readyState = 3;
  assert.equal(captureSessionIsActive(3, 3, socket, socket), false);
});
