'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  recipientForMessage,
  gmailAlertConfig,
  gmailAlertRequest,
  sendViaAppsScript,
  telegramAlertConfig,
  promotionalNotice,
  sendViaTelegram,
  sendDiscreetTelegramToTerence,
  sendDiscreetEmailToTerence,
  sendAlertToTerence,
  dispatchChatAlert
} = require('../utils/chatNotifications');

const fakeUrl = 'https://script.google.com/macros/s/AKfycbx_Test123/exec';
const fakeSecret = 'a'.repeat(40);
const telegramToken = `123456789:${'x'.repeat(35)}`;
const telegramId = '123456789';

function fakeTelegramLocks() {
  let record = null;
  return {
    collection(name) {
      assert.equal(name, 'chat_telegram_alert_state');
      return {
        async findOneAndUpdate(filter, update, options) {
          assert.equal(filter._id, 'terence');
          assert.equal(options.upsert, true);
          const now = filter.$or[0].nextEligibleAt.$lte;
          if (record && record.nextEligibleAt > now) {
            throw Object.assign(new Error('duplicate'), { code: 11000 });
          }
          record = { _id: 'terence', ...update.$set };
          return { value: record };
        }
      };
    }
  };
}

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

test('Telegram configuration is private, validated and disabled on PR previews', () => {
  const env = { TELEGRAM_BOT_TOKEN: telegramToken, TELEGRAM_CHAT_ID: telegramId };
  assert.deepEqual(telegramAlertConfig(env), { token: telegramToken, chatId: telegramId });
  assert.equal(telegramAlertConfig({}), null);
  assert.equal(telegramAlertConfig({ ...env, IS_PULL_REQUEST: 'true' }), null);
  assert.deepEqual(telegramAlertConfig({ ...env, IS_PULL_REQUEST: 'true', ALLOW_PREVIEW_TELEGRAM: 'true' }), {
    token: telegramToken, chatId: telegramId
  });
  assert.throws(() => telegramAlertConfig({ ...env, TELEGRAM_CHAT_ID: '-1001234' }), /private/i);
  assert.throws(() => telegramAlertConfig({ ...env, TELEGRAM_BOT_TOKEN: 'bad' }), /invalid/i);
});

test('Telegram promotional notices reveal no chat content, identity or application', () => {
  for (let minute = 0; minute < 6; minute += 2) {
    const notice = promotionalNotice(minute * 60 * 1000);
    assert.match(notice, /prize|reward|bonus|promotion/i);
    assert.doesNotMatch(notice, /SliderApp|Jessy|Terence|chat|message|https?:\/\//i);
  }
});

test('Telegram POST uses only a decoy body and handles transient rate limits', async () => {
  const calls = [];
  const waits = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return {
      ok: false, status: 429,
      json: async () => ({ ok: false, error_code: 429, parameters: { retry_after: 2 } })
    };
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 57 } }) };
  };
  const config = { token: telegramToken, chatId: telegramId };
  const result = await sendViaTelegram(config, promotionalNotice(0), fakeFetch, async ms => { waits.push(ms); });
  assert.deepEqual(result, { messageId: 57 });
  assert.deepEqual(waits, [2000]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, 'POST');
  const payload = JSON.parse(calls[0].options.body);
  assert.deepEqual(payload, {
    chat_id: telegramId,
    text: promotionalNotice(0),
    disable_notification: false,
    protect_content: true
  });
  assert.doesNotMatch(payload.text, /Jessy|Terence|SliderApp|chat|hello/i);
  await assert.rejects(
    sendViaTelegram(config, 'Offer', async () => ({
      ok: false, status: 403, json: async () => ({ ok: false, error_code: 403 })
    }), async () => {}),
    /HTTP 403/
  );
});

test('Telegram alerts use a rolling two-minute cooldown across multiple messages', async () => {
  const db = fakeTelegramLocks();
  const config = { token: telegramToken, chatId: telegramId };
  const delivered = [];
  const send = async (_config, notice) => { delivered.push(notice); return { messageId: 81 }; };
  const firstAt = 119000; // 1:59, deliberately near a wall-clock bucket boundary
  assert.deepEqual(await sendDiscreetTelegramToTerence(db, config, send, firstAt), {
    channel: 'telegram', status: 'submitted', messageId: 81
  });
  assert.deepEqual(await sendDiscreetTelegramToTerence(db, config, send, firstAt + 2000), {
    channel: 'telegram', status: 'throttled'
  });
  assert.deepEqual(await sendDiscreetTelegramToTerence(db, config, send, firstAt + 120000), {
    channel: 'telegram', status: 'submitted', messageId: 81
  });
  assert.equal(delivered.length, 2);
});

test('Telegram failure uses existing Gmail backup without revealing the message', async () => {
  const prior = {
    IS_PULL_REQUEST: process.env.IS_PULL_REQUEST,
    GMAIL_ALERT_WEBHOOK_URL: process.env.GMAIL_ALERT_WEBHOOK_URL,
    GMAIL_ALERT_SECRET: process.env.GMAIL_ALERT_SECRET,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID
  };
  Object.assign(process.env, {
    IS_PULL_REQUEST: 'false',
    GMAIL_ALERT_WEBHOOK_URL: fakeUrl,
    GMAIL_ALERT_SECRET: fakeSecret,
    TELEGRAM_BOT_TOKEN: telegramToken,
    TELEGRAM_CHAT_ID: telegramId
  });
  try {
    const dbTelegram = fakeTelegramLocks();
    const emailIds = new Set();
    const db = {
      collection(name) {
        if (name === 'chat_telegram_alert_state') return dbTelegram.collection(name);
        assert.equal(name, 'chat_email_alert_locks');
        return {
          async insertOne(doc) {
            if (emailIds.has(doc._id)) throw Object.assign(new Error('duplicate'), { code: 11000 });
            emailIds.add(doc._id);
          },
          async deleteOne(doc) { emailIds.delete(doc._id); }
        };
      }
    };
    let emails = 0;
    const result = await sendAlertToTerence(db,
      async () => { throw new Error('no network'); },
      async () => { emails++; });
    assert.deepEqual(result, { channel: 'email', status: 'submitted', fallbackFrom: 'telegram' });
    assert.equal(emails, 1);
    assert.deepEqual(await sendAlertToTerence(db, async () => { throw new Error('no network'); }), {
      channel: 'telegram', status: 'throttled'
    });
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
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
