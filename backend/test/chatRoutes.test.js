'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const cloudinary = require('cloudinary').v2;

function fakeDatabase() {
  const messages = [];
  const chatMessages = {
    async insertOne(document) { messages.push(document); return { acknowledged: true }; },
    find() {
      return {
        sort() { return this; },
        limit() { return this; },
        async toArray() { return [...messages]; }
      };
    },
    async findOne(filter) {
      return messages.find(message => message.id === filter.id &&
        (!filter.ownerId || message.ownerId === filter.ownerId)) || null;
    },
    async updateMany(filter, update) {
      let modifiedCount = 0;
      for (const message of messages) {
        if (filter.id.$in.includes(message.id) && message.ownerId === filter.ownerId && !message.seenAt) {
          message.seenAt = update.$set.seenAt;
          modifiedCount++;
        }
      }
      return { modifiedCount };
    },
    async updateOne(filter, update) {
      const message = messages.find(item => item.id === filter.id);
      if (!message) return { matchedCount: 0 };
      message.reactions ||= {};
      if (update.$set) {
        const [[key, emoji]] = Object.entries(update.$set);
        message.reactions[key.split('.')[1]] = emoji;
      }
      if (update.$unset) {
        const [key] = Object.keys(update.$unset);
        delete message.reactions[key.split('.')[1]];
      }
      return { matchedCount: 1 };
    },
    async deleteOne(filter) {
      const index = messages.findIndex(message => message.id === filter.id && message.ownerId === filter.ownerId);
      if (index < 0) return { deletedCount: 0 };
      messages.splice(index, 1);
      return { deletedCount: 1 };
    }
  };
  return {
    messages,
    collection(name) {
      if (name === 'chat_messages') return chatMessages;
      if (name === 'subscriptions') return { find: () => ({ toArray: async () => [] }) };
      throw new Error(`Unexpected collection ${name}`);
    }
  };
}

test('chat routes support text, photos, read receipts, reactions and ownership', { timeout: 15000 }, async () => {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousPreview = process.env.IS_PULL_REQUEST;
  process.env.ADMIN_PASSWORD = 'test-password';
  process.env.IS_PULL_REQUEST = 'true'; // Never send real preview notifications.

  const database = fakeDatabase();
  const dbModule = require('../db/mongodb');
  const originalGetDatabase = dbModule.getDatabase;
  dbModule.getDatabase = async () => database;
  const originalUpload = cloudinary.uploader.upload_stream;
  const originalDestroy = cloudinary.uploader.destroy;
  const uploadedFolders = [];
  const destroyedIds = [];
  cloudinary.uploader.upload_stream = (options, callback) => ({
    end(buffer) {
      assert.ok(buffer.length > 0);
      uploadedFolders.push(options.folder);
      callback(null, {
        public_id: `${options.folder}/${options.public_id}`,
        secure_url: 'https://res.cloudinary.com/example/image/upload/chat-photo.jpg',
        width: 100,
        height: 100
      });
    }
  });
  cloudinary.uploader.destroy = async publicId => { destroyedIds.push(publicId); };

  // Import after replacing the database module: server.js destructures it.
  const app = require('../server');
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = person => ({
    'Content-Type': 'application/json',
    'x-admin-password': 'test-password',
    'x-user-id': person
  });
  const request = (path, options) => fetch(`${url}${path}`, {
    ...options,
    signal: AbortSignal.timeout(3000)
  });

  try {
    let response = await request('/chat/messages', {
      method: 'POST', headers: { ...headers('terence'), 'x-admin-password': 'wrong' },
      body: JSON.stringify({ text: 'Unauthorized' })
    });
    assert.equal(response.status, 401);

    response = await request('/chat/messages', {
      method: 'POST', headers: headers('terence'), body: JSON.stringify({ text: 'Hello Jessy' })
    });
    assert.equal(response.status, 201);
    const textMessage = await response.json();
    assert.equal(textMessage.text, 'Hello Jessy');
    assert.equal(textMessage.image, undefined);

    const form = new FormData();
    form.append('text', 'A photo');
    form.append('image', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])], { type: 'image/jpeg' }), 'photo.jpg');
    response = await request('/chat/messages', {
      method: 'POST', headers: { 'x-admin-password': 'test-password', 'x-user-id': 'terence' }, body: form
    });
    assert.equal(response.status, 201);
    const photoMessage = await response.json();
    assert.ok(photoMessage.image.url.includes('cloudinary.com'));
    assert.deepEqual(uploadedFolders, ['sliderapp-preview-chat/pr']);

    response = await request('/chat/messages/seen', {
      method: 'POST', headers: headers('terence'), body: JSON.stringify({ ids: [textMessage.id, photoMessage.id] })
    });
    assert.equal((await response.json()).updated, 0, 'Sender cannot mark own messages seen');

    response = await request('/chat/messages/seen', {
      method: 'POST', headers: headers('partner'), body: JSON.stringify({ ids: [textMessage.id, photoMessage.id] })
    });
    assert.equal((await response.json()).updated, 2);
    assert.ok(database.messages.every(message => message.seenAt));

    response = await request(`/chat/messages/${textMessage.id}/reaction`, {
      method: 'PATCH', headers: headers('partner'), body: JSON.stringify({ emoji: '❤️' })
    });
    assert.deepEqual((await response.json()).reactions, { partner: '❤️' });

    response = await request(`/chat/messages/${textMessage.id}/reaction`, {
      method: 'PATCH', headers: headers('terence'), body: JSON.stringify({ emoji: '😂' })
    });
    assert.deepEqual((await response.json()).reactions, { partner: '❤️', terence: '😂' });

    response = await request(`/chat/messages/${textMessage.id}/reaction`, {
      method: 'PATCH', headers: headers('partner'), body: JSON.stringify({ emoji: null })
    });
    assert.deepEqual((await response.json()).reactions, { terence: '😂' });

    response = await request(`/chat/messages/${textMessage.id}/reaction`, {
      method: 'PATCH', headers: headers('partner'), body: JSON.stringify({ emoji: '$bad' })
    });
    assert.equal(response.status, 400);

    response = await request(`/chat/messages/${photoMessage.id}`, {
      method: 'DELETE', headers: headers('partner')
    });
    assert.equal(response.status, 404, 'Other person cannot delete a photo message');

    response = await request(`/chat/messages/${photoMessage.id}`, {
      method: 'DELETE', headers: headers('terence')
    });
    assert.equal(response.status, 200);
    assert.deepEqual(destroyedIds, [photoMessage.image.publicId]);
    assert.equal(database.messages.length, 1);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    dbModule.getDatabase = originalGetDatabase;
    cloudinary.uploader.upload_stream = originalUpload;
    cloudinary.uploader.destroy = originalDestroy;
    if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previousPassword;
    if (previousPreview === undefined) delete process.env.IS_PULL_REQUEST;
    else process.env.IS_PULL_REQUEST = previousPreview;
  }
});
