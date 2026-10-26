'use strict';

const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024;
const CHAT_REACTIONS = Object.freeze(['❤️', '😂', '😮', '😢', '👍', '🔥']);
const CHAT_IMAGE_MIMES = Object.freeze(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function detectChatImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a') return 'image/gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function validateChatImage(file) {
  if (!file) return null;
  if (!CHAT_IMAGE_MIMES.includes(file.mimetype)) return 'Choose a JPEG, PNG, GIF or WebP image.';
  if (!file.size || file.size > MAX_CHAT_IMAGE_BYTES) return 'Photos must be 10 MB or smaller.';
  if (detectChatImageMime(file.buffer) !== file.mimetype) return 'This file is not a valid image.';
  return null;
}

function chatImageFolder(env = process.env) {
  if (env.IS_PULL_REQUEST !== 'true') return 'sliderapp-chat';
  const raw = String(env.RENDER_EXTERNAL_HOSTNAME || env.RENDER_SERVICE_NAME || 'pr').split('.')[0];
  const service = raw.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 36) || 'pr';
  return `sliderapp-preview-chat/${service}`;
}

function validSeenIds(ids) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 500) return null;
  if (!ids.every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{8,128}$/.test(id))) return null;
  return [...new Set(ids)];
}

function chatNotificationPreview(message) {
  const text = String(message.text || '').trim();
  return text ? text.slice(0, 140) : message.image ? 'sent a photo' : 'sent a message';
}

module.exports = {
  MAX_CHAT_IMAGE_BYTES,
  CHAT_REACTIONS,
  CHAT_IMAGE_MIMES,
  detectChatImageMime,
  validateChatImage,
  chatImageFolder,
  validSeenIds,
  chatNotificationPreview
};
