'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveDatabaseName } = require('../db/mongodb');
const { gmailAlertConfig } = require('../utils/chatNotifications');

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

test('PR preview cannot send inherited Gmail alerts without explicit opt-in', () => {
  withEnv({
    IS_PULL_REQUEST: 'true',
    ALLOW_PREVIEW_EMAIL: null,
    GMAIL_ALERT_WEBHOOK_URL: 'https://script.google.com/macros/s/AKfycbxtest/exec',
    GMAIL_ALERT_SECRET: 'x'.repeat(40)
  }, () => {
    assert.equal(gmailAlertConfig(), null);
  });
});
