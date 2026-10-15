'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  recipientForMessage,
  gmailAlertConfig,
  gmailAlertRequest,
  sendViaAppsScript,
  sendDiscreetEmailToTerence,
  dispatchChatAlert
} = require('../utils/chatNotifications');

const fakeUrl = 'https://script.google.com/macros/s/AKfycbx_Test123/exec';
const fakeSecret = 'a'.repeat(40);

test('new messages route to the other person only', () => {
  assert.equal(recipientForMessage('terence'), 'partner');
  assert.equal(recipientForMessage('partner'), 'terence');
  assert.equal(recipientForMessage('nobody'), null);
});

test('Gmail alerts have no chat text, names, or recipient email in the payload', () => {
  const payload = gmailAlertRequest(fakeSecret);
  assert.deepEqual(payload, { secret: fakeSecret, action: 'generic-update' });
  assert.doesNotMatch(JSON.stringify(payload), /Terence|Jessy|chat|sender|message|recipient|@/i);
});

test('Gmail config accepts only Google Apps Script deployments and long secrets', () => {
  const options = {
    GMAIL_ALERT_WEBHOOK_URL: fakeUrl,
    GMAIL_ALERT_SECRET: fakeSecret,
    IS_PULL_REQUEST: 'false'
  };
  assert.deepEqual(gmailAlertConfig(options), { url: fakeUrl, secret: fakeSecret });
  assert.throws(() => gmailAlertConfig({ ...options, GMAIL_ALERT_WEBHOOK_URL: 'https://evil.example/notify' }), /Apps Script/i);
  assert.throws(() => gmailAlertConfig({ ...options, GMAIL_ALERT_SECRET: 'short' }), /32/);
  assert.equal(gmailAlertConfig({}), null);
});

test('preview email is off unless explicitly enabled, even with inherited credentials', () => {
  const options = {
    GMAIL_ALERT_WEBHOOK_URL: fakeUrl,
    GMAIL_ALERT_SECRET: fakeSecret,
    IS_PULL_REQUEST: 'true'
  };
  assert.equal(gmailAlertConfig(options), null);
  assert.deepEqual(gmailAlertConfig({ ...options, ALLOW_PREVIEW_EMAIL: 'true' }), {
    url: fakeUrl, secret: fakeSecret
  });
});

test('Apps Script POST sends a generic alert and handles Google redirects', async () => {
  let invocation;
  const fakeFetch = async (url, options) => {
    invocation = { url, options };
    return { ok: true, text: async () => 'OK' };
  };
  await sendViaAppsScript({ url: fakeUrl, secret: fakeSecret }, fakeFetch);
  assert.equal(invocation.url, fakeUrl);
  assert.equal(invocation.options.method, 'POST');
  assert.equal(invocation.options.redirect, 'follow');
  assert.deepEqual(JSON.parse(invocation.options.body), gmailAlertRequest(fakeSecret));
  assert.doesNotMatch(invocation.url, /secret|@/);
  await assert.rejects(
    sendViaAppsScript({ url: fakeUrl, secret: fakeSecret },
      async () => ({ ok: true, text: async () => 'NOT_CONFIGURED' })),
    /confirm email delivery/
  );
});

test('one email is submitted per two-minute bucket for Terence', async () => {
  const prior = {
    IS_PULL_REQUEST: process.env.IS_PULL_REQUEST,
    ALLOW_PREVIEW_EMAIL: process.env.ALLOW_PREVIEW_EMAIL,
    GMAIL_ALERT_WEBHOOK_URL: process.env.GMAIL_ALERT_WEBHOOK_URL,
    GMAIL_ALERT_SECRET: process.env.GMAIL_ALERT_SECRET
  };
  Object.assign(process.env, {
    IS_PULL_REQUEST: 'true',
    ALLOW_PREVIEW_EMAIL: 'true',
    GMAIL_ALERT_WEBHOOK_URL: fakeUrl,
    GMAIL_ALERT_SECRET: fakeSecret
  });
  try {
    const ids = new Set();
    const db = {
      collection(name) {
        assert.equal(name, 'chat_email_alert_locks');
        return {
          async insertOne(doc) {
            if (ids.has(doc._id)) throw Object.assign(new Error('duplicate'), { code: 11000 });
            ids.add(doc._id);
          },
          async deleteOne(doc) { ids.delete(doc._id); }
        };
      }
    };
    let count = 0;
    const send = async (config) => {
      assert.equal(config.url, fakeUrl);
      count++;
    };
    assert.deepEqual(await sendDiscreetEmailToTerence(db, send), { channel: 'email', status: 'submitted' });
    assert.deepEqual(await sendDiscreetEmailToTerence(db, send), { channel: 'email', status: 'throttled' });
    assert.equal(count, 1);
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('legacy unnamed reminder subscriptions never receive Jessy chat pushes', async () => {
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
