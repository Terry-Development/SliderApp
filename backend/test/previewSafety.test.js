'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveDatabaseName } = require('../db/mongodb');
const { smsConfig } = require('../utils/chatNotifications');

function withEnv(changes, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(changes)) {
    previous[key] = process.env[key];
    if (value === null) delete process.env[key];
    else process.env[key] = value;
  }
  try { fn(); } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('production remains on its normal database', () => {
  withEnv({ IS_PULL_REQUEST: 'false', MONGODB_DB_NAME: null }, () => {
    assert.equal(resolveDatabaseName(), 'sliderapp');
  });
});

test('PR preview isolates data even when production DB name is inherited', () => {
  withEnv({
    IS_PULL_REQUEST: 'true',
    RENDER_EXTERNAL_HOSTNAME: 'sliderapp-pr-2.onrender.com',
    MONGODB_DB_NAME: 'sliderapp',
    MONGODB_PREVIEW_DB_NAME: null
  }, () => {
    assert.equal(resolveDatabaseName(), 'sliderapp_preview_sliderapp_pr_2');
  });
});

test('PR preview rejects unsafe database names', () => {
  withEnv({
    IS_PULL_REQUEST: 'true',
    MONGODB_PREVIEW_DB_NAME: 'sliderapp'
  }, () => {
    assert.throws(resolveDatabaseName, /preview/i);
  });
});

test('PR preview cannot send inherited Twilio SMS without explicit opt-in', () => {
  withEnv({
    IS_PULL_REQUEST: 'true',
    ALLOW_PREVIEW_SMS: null,
    TWILIO_ACCOUNT_SID: 'AC' + 'a'.repeat(32),
    TWILIO_AUTH_TOKEN: 'not-a-real-token',
    TERENCE_SMS_TO: '+60123456789',
    TWILIO_MESSAGING_SERVICE_SID: 'MG' + 'a'.repeat(32)
  }, () => {
    assert.equal(smsConfig(), null);
  });
});
