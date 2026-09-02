import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeDashboardStatus } from '../app/static/status.js';

test('retains stream availability when a chat-only websocket event arrives', () => {
  const before = {
    chat_connected: true,
    ffmpeg_available: true,
    stream_configured: true,
    stream_running: false,
  };
  const chatOnlyEvent = { chat_connected: true, chat_error: null };

  const merged = mergeDashboardStatus(before, chatOnlyEvent);

  assert.equal(merged.ffmpeg_available, true);
  assert.equal(merged.stream_configured, true);
  assert.equal(merged.stream_running, false);
});
