'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  recipientForMessage,
  buildDiscreetSmsBody,
  smsConfig,
  dispatchChatAlert
} = require('../utils/chatNotifications');

test('chat notifications route to the other person only', () => {
  assert.equal(recipientForMessage('terence'), 'partner');
  assert.equal(recipientForMessage('partner'), 'terence');
  assert.equal(recipientForMessage('nobody'), null);
});

test('all SMS variants contain no sender names or chat content', () => {
  for (let index = 0; index < 3; index++) {
    const body = buildDiscreetSmsBody('ExampleBrand', index);
    assert.match(body, /^RM0\.00 ExampleBrand: /);
    assert.doesNotMatch(body, /Terence|Jessy|SliderApp|Chat|message from/i);
  }
});

test('SMS brand must be a nonempty legitimate configured name', () => {
  assert.throws(() => buildDiscreetSmsBody(' !?! '), /brand/i);
  assert.match(buildDiscreetSmsBody('Example Brand!!', 0), /Example Brand:/);
});

test('SMS stays disabled without a provider configuration', () => {
  const names = [
    'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TERENCE_SMS_TO',
    'TWILIO_FROM', 'TWILIO_MESSAGING_SERVICE_SID'
  ];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    names.forEach((name) => { delete process.env[name]; });
    assert.equal(smsConfig(), null);
  } finally {
    names.forEach((name) => {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    });
  }
});

test('legacy unnamed reminder subscriptions never get Jessy chat pushes', async () => {
  let filter;
  const db = {
    collection(name) {
      assert.equal(name, 'subscriptions');
      return {
        find(query) {
          filter = query;
          return { toArray: async () => [] };
        }
      };
    }
  };
  const result = await dispatchChatAlert(db, {
    id: 'test-message', ownerId: 'terence', sender: 'Terence', text: 'Hello'
  });
  assert.deepEqual(filter, { ownerId: 'partner' });
  assert.deepEqual(result, { channel: 'push', attempted: 0, delivered: 0 });
});
