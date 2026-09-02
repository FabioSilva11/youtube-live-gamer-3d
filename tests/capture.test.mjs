import assert from 'node:assert/strict';
import test from 'node:test';

import * as capture from '../app/static/capture.js';

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

  assert.equal(capture.stopMediaTracks(stream), 2);
  assert.deepEqual(stops, ['video', 'audio']);
  assert.equal(capture.stopMediaTracks(null), 0);
});

test('rejects a stale or already-closed output socket during capture startup', () => {
  const socket = { readyState: 1 };
  assert.equal(capture.captureSessionIsActive(3, 3, socket, socket), true);
  assert.equal(capture.captureSessionIsActive(2, 3, socket, socket), false);
  assert.equal(capture.captureSessionIsActive(3, 3, { readyState: 1 }, socket), false);
  socket.readyState = 3;
  assert.equal(capture.captureSessionIsActive(3, 3, socket, socket), false);
});

test('starts a selected track from the beginning in loop when the live starts', async () => {
  const audio = {
    currentTime: 48,
    loop: false,
    playCount: 0,
    async play() { this.playCount += 1; },
  };

  await capture.startMusicForLive(audio);

  assert.equal(audio.currentTime, 0);
  assert.equal(audio.loop, true);
  assert.equal(audio.playCount, 1);
});

test('keeps manual pause position but resets the selected track when the live stops', () => {
  const audio = {
    currentTime: 32,
    pauseCount: 0,
    pause() { this.pauseCount += 1; },
  };

  capture.pauseMusicPlayback(audio);
  assert.equal(audio.currentTime, 32);
  assert.equal(audio.pauseCount, 1);

  capture.stopMusicForLive(audio);
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.pauseCount, 2);
});

test('routes the selected track to both speakers and the live capture stream', () => {
  const connections = [];
  const disconnections = [];
  const streamTrack = { kind: 'audio' };
  const gain = {
    gain: { value: 1 },
    connect(target) { connections.push(['gain', target]); },
    disconnect(target) { disconnections.push(target); },
  };
  const source = { connect(target) { connections.push(['source', target]); } };
  const destination = { stream: { getAudioTracks: () => [streamTrack] } };
  const speaker = { name: 'speakers' };
  const context = {
    destination: speaker,
    createMediaElementSource: () => source,
    createGain: () => gain,
    createMediaStreamDestination: () => destination,
  };

  const route = capture.createMusicCaptureRoute(context, { name: 'track' }, 0.35);

  assert.equal(route.track, streamTrack);
  assert.equal(gain.gain.value, 0.35);
  assert.deepEqual(connections, [['source', gain], ['gain', speaker], ['gain', destination]]);
  route.detachCaptureTrack();
  assert.deepEqual(disconnections, [destination]);
});
