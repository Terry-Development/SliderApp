'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_CHAT_IMAGE_BYTES,
  CHAT_REACTIONS,
  detectChatImageMime,
  validateChatImage,
  chatImageFolder,
  validSeenIds,
  chatNotificationPreview
} = require('../utils/chatFeatures');

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const gif = Buffer.from('GIF89a______');
const webp = Buffer.from('RIFFxxxxWEBP');

test('only actual supported image formats pass upload validation', () => {
  for (const [mimetype, buffer] of [
    ['image/jpeg', jpeg], ['image/png', png], ['image/gif', gif], ['image/webp', webp]
  ]) {
    assert.equal(detectChatImageMime(buffer), mimetype);
    assert.equal(validateChatImage({ mimetype, size: buffer.length, buffer }), null);
  }
  assert.match(validateChatImage({ mimetype: 'image/png', size: jpeg.length, buffer: jpeg }), /valid image/);
  assert.match(validateChatImage({ mimetype: 'image/svg+xml', size: 100, buffer: png }), /JPEG/);
  assert.match(validateChatImage({ mimetype: 'image/png', size: MAX_CHAT_IMAGE_BYTES + 1, buffer: png }), /10 MB/);
  assert.equal(detectChatImageMime(Buffer.from('not-an-image!')), null);
});

test('preview uploads cannot share the production photo folder', () => {
  assert.equal(chatImageFolder({ IS_PULL_REQUEST: 'false' }), 'sliderapp-chat');
  const preview = chatImageFolder({
    IS_PULL_REQUEST: 'true', RENDER_EXTERNAL_HOSTNAME: 'sliderapp-pr-2.onrender.com'
  });
  assert.equal(preview, 'sliderapp-preview-chat/sliderapp-pr-2');
  assert.notEqual(preview, 'sliderapp-chat');
});

test('seen IDs are validated and deduplicated', () => {
  assert.deepEqual(validSeenIds(['a1234567', 'a1234567', 'b1234567']), ['a1234567', 'b1234567']);
  assert.equal(validSeenIds([]), null);
  assert.equal(validSeenIds(['$where']), null);
  assert.equal(validSeenIds(['a1234567', 3]), null);
  assert.equal(validSeenIds(Array(501).fill('a1234567')), null);
});

test('reactions are a small predefined set and photo alerts contain no empty text', () => {
  assert.deepEqual(CHAT_REACTIONS, ['❤️', '😂', '😮', '😢', '👍', '🔥']);
  assert.equal(chatNotificationPreview({ text: '' }), 'sent a message');
  assert.equal(chatNotificationPreview({ text: '', image: { url: 'test' } }), 'sent a photo');
  assert.equal(chatNotificationPreview({ text: 'Caption', image: { url: 'test' } }), 'Caption');
});
