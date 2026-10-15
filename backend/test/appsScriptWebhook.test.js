'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptSource = fs.readFileSync(
  path.join(__dirname, '../../google-apps-script/NeutralEmailAlerts.gs'), 'utf8'
);

function bootScript() {
  const values = new Map([
    ['ALERT_SECRET', 'x'.repeat(40)],
    ['ALERT_TO_EMAIL', 'recipient@example.com']
  ]);
  const messages = [];
  const lock = {
    tryLock: () => true,
    releaseLock: () => {}
  };
  const context = {
    console: { log: () => {}, error: () => {} },
    ContentService: {
      MimeType: { TEXT: 'text/plain' },
      createTextOutput(body) {
        return {
          body,
          setMimeType() { return this; }
        };
      }
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty(key) { return values.get(key) || null; },
        setProperty(key, value) { values.set(key, value); }
      })
    },
    LockService: { getScriptLock: () => lock },
    MailApp: {
      getRemainingDailyQuota: () => 100,
      sendEmail(message) { messages.push(message); }
    }
  };
  vm.runInNewContext(scriptSource, context);
  return { context, messages, values };
}

test('Apps Script rejects requests without the secret and never sends', () => {
  const { context, messages } = bootScript();
  const answer = context.doPost({
    postData: { contents: JSON.stringify({ action: 'generic-update', secret: 'bad' }) }
  });
  assert.equal(answer.body, 'UNAUTHORIZED');
  assert.equal(messages.length, 0);
});

test('Apps Script sends only generic copy and is throttled', () => {
  const { context, messages, values } = bootScript();
  const request = {
    postData: { contents: JSON.stringify({
      action: 'generic-update', secret: 'x'.repeat(40), chatText: 'SECRET MESSAGE'
    }) }
  };
  const answer = context.doPost(request);
  assert.equal(answer.body, 'OK');
  assert.equal(messages.length, 1);
  const email = messages[0];
  assert.equal(email.to, 'recipient@example.com');
  assert.equal(email.subject, 'Account update');
  assert.match(email.body, /latest update|daily note|account update/);
  assert.doesNotMatch(JSON.stringify(email), /SECRET MESSAGE|Terence|Jessy|SliderApp|chat/i);
  assert.ok(Number(values.get('LAST_ALERT_SENT_AT')) > 0);
  assert.equal(context.doPost(request).body, 'OK');
  assert.equal(messages.length, 1);
});

test('Apps Script can authorize MailApp without emailing anybody', () => {
  const { context, messages } = bootScript();
  context.authorizeMail();
  assert.equal(messages.length, 0);
});
