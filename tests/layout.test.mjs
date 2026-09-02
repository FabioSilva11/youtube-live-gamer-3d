import assert from 'node:assert/strict';
import test from 'node:test';

import { avatarLayoutFor, latestVisualParticipants } from '../app/static/layout.js';
import { inactiveProfileImageIds, topChatRanking } from '../app/static/ranking.js';

test('keeps a large chat audience in separate meadow rings', () => {
  const layouts = Array.from({ length: 67 }, (_, index) => avatarLayoutFor(index, 67));

  assert.ok(new Set(layouts.map((layout) => layout.ring)).size >= 4);
  assert.ok(layouts.every((layout) => Math.hypot(layout.x, layout.z) <= 6.8));
  assert.ok(layouts.every((layout) => layout.scale <= .55));
});

test('keeps a single participant prominent at the center', () => {
  assert.deepEqual(avatarLayoutFor(0, 1), { x: 0, z: 0, scale: 1, ring: 0 });
});

test('keeps the newest public authors visible when the chat is crowded', () => {
  const people = Array.from({ length: 40 }, (_, index) => ({ id: `avatar-${index + 1}` }));

  const visible = latestVisualParticipants(people);

  assert.equal(visible.length, 18);
  assert.equal(visible[0].id, 'avatar-23');
  assert.equal(visible.at(-1).id, 'avatar-40');
});

test('ranks active chat authors by their message count', () => {
  const ranking = topChatRanking([
    { id: 'a', display_name: 'Ana', messages: 4 },
    { id: 'b', display_name: 'Bruno', messages: 9 },
    { id: 'c', display_name: 'Caio', messages: 6 },
  ]);

  assert.deepEqual(ranking.map((person) => person.id), ['b', 'c', 'a']);
});

test('ranking keeps the profile-image availability of each author', () => {
  const ranking = topChatRanking([
    { id: 'a', display_name: 'Ana', messages: 2, profile_image_available: true },
  ]);

  assert.equal(ranking[0].profile_image_available, true);
});

test('identifies cached profile images whose authors are no longer active', () => {
  const staleIds = inactiveProfileImageIds(['a', 'b', 'c'], [{ id: 'b' }, { id: 'c' }]);

  assert.deepEqual(staleIds, ['a']);
});
