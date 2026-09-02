import test from 'node:test';
import assert from 'node:assert/strict';

import {
  avatarActivityAnimation,
  socialInteractionPhase,
  socialMeetingTarget,
  socialPartnerIndex,
} from '../app/static/social.js';

test('organises visible characters in stable social pairs', () => {
  assert.equal(socialPartnerIndex(0, 6), 1);
  assert.equal(socialPartnerIndex(1, 6), 0);
  assert.equal(socialPartnerIndex(4, 6), 5);
  assert.equal(socialPartnerIndex(4, 5), null);
  assert.equal(socialPartnerIndex(0, 1), null);
});

test('cycles pairs through approach, interaction and rest', () => {
  assert.equal(socialInteractionPhase(1_000, true), 'approach');
  assert.equal(socialInteractionPhase(4_500, true), 'interact');
  assert.equal(socialInteractionPhase(9_000, true), 'rest');
  assert.equal(socialInteractionPhase(4_500, false), 'rest');
});

test('brings a pair together while preserving personal space', () => {
  assert.deepEqual(
    socialMeetingTarget({ x: -3, z: 0 }, { x: 3, z: 0 }),
    { x: -0.7, z: 0 },
  );
  assert.deepEqual(
    socialMeetingTarget({ x: 3, z: 0 }, { x: -3, z: 0 }),
    { x: 0.7, z: 0 },
  );
});

test('uses real walking and gesture clips for character activity', () => {
  assert.equal(avatarActivityAnimation({ moving: true, socialPhase: 'rest', index: 0 }), 'walk');
  assert.equal(avatarActivityAnimation({ moving: false, socialPhase: 'interact', index: 0 }), 'emote-yes');
  assert.equal(avatarActivityAnimation({ moving: false, socialPhase: 'interact', index: 1 }), 'interact-right');
  assert.equal(avatarActivityAnimation({ moving: false, socialPhase: 'rest', index: 0 }), 'idle');
});
