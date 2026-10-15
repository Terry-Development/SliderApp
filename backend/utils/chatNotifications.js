'use strict';

const crypto = require('crypto');
const https = require('https');
const webpush = require('web-push');

// These are deliberately unrelated to the chat content. Never pass a message
// body, sender name, or recipient name to the SMS provider.
const NEUTRAL_ALERTS = Object.freeze([
  'Your latest update is available.',
  'Your daily note is ready.',
  'A new account update is available.'
]);

function recipientForMessage(ownerId) {
  if (ownerId === 'terence') return 'partner';
  if (ownerId === 'partner') return 'terence';
  return null;
}

function buildDiscreetSmsBody(brand = process.env.SMS_ALERT_BRAND, index) {
  if (typeof brand !== 'string' || !brand.trim()) throw new Error('An approved SMS_ALERT_BRAND is required');
  const safeBrand = brand.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 30);
  if (!safeBrand) throw new Error('An approved SMS_ALERT_BRAND is required');
  const chosen = Number.isInteger(index)
    ? Math.abs(index) % NEUTRAL_ALERTS.length
    : crypto.randomInt(NEUTRAL_ALERTS.length);

  // Malaysian SMS guidelines specify an RM 0.00 header and legitimate brand.
  return `RM 0.00 ${safeBrand}: ${NEUTRAL_ALERTS[chosen]}`;
}

function smsConfig() {
  // Render PR previews inherit production env vars. SMS must be explicitly
  // enabled for the preview to avoid accidental texts or charges.
  if (process.env.IS_PULL_REQUEST === 'true' && process.env.ALLOW_PREVIEW_SMS !== 'true') {
    return null;
  }
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const to = process.env.TERENCE_SMS_TO;
  const from = process.env.TWILIO_FROM;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const brand = process.env.SMS_ALERT_BRAND;

  if (!sid || !token || !to || !(from || messagingServiceSid) || !brand?.trim()) return null;
  if (!/^AC[a-f0-9]{32}$/i.test(sid)) throw new Error('Invalid Twilio account configuration');
  if (!/^\+[1-9]\d{6,14}$/.test(to)) throw new Error('TERENCE_SMS_TO must be an E.164 phone number');
  return { sid, token, to, from, messagingServiceSid, brand };
}

function sendSmsThroughTwilio(config, body) {
  return new Promise((resolve, reject) => {
    const form = new URLSearchParams({ To: config.to, Body: body });
    if (config.messagingServiceSid) form.set('MessagingServiceSid', config.messagingServiceSid);
    else form.set('From', config.from);
    const encoded = form.toString();

    const request = https.request({
      hostname: 'api.twilio.com',
      path: `/2010-04-01/Accounts/${config.sid}/Messages.json`,
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.sid}:${config.token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(encoded)
      },
      timeout: 10000
    }, (response) => {
      // Drain the response without logging sensitive provider metadata.
      response.resume();
      response.on('end', () => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve();
        else reject(new Error(`SMS provider returned HTTP ${response.statusCode}`));
      });
      response.on('error', reject);
    });

    request.on('timeout', () => request.destroy(new Error('SMS gateway timeout')));
    request.on('error', reject);
    request.end(encoded);
  });
}

async function sendPushToJessy(db, message) {
  const collection = db.collection('subscriptions');
  // Legacy reminder subscribers do not have ownerId. Do not broadcast chat
  // messages to them; Jessy must opt in from Chat on each desired device.
  const subscriptions = await collection.find({ ownerId: 'partner' }).toArray();
  if (!subscriptions.length) return { channel: 'push', attempted: 0, delivered: 0 };

  const payload = JSON.stringify({
    title: 'SliderApp Chat',
    body: `${message.sender}: ${message.text.slice(0, 140)}`,
    url: '/chat',
    tag: `sliderapp-chat-${message.id}`
  });

  const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await collection.deleteOne({ endpoint: subscription.endpoint, ownerId: 'partner' });
      }
      throw error;
    }
  }));

  return {
    channel: 'push',
    attempted: subscriptions.length,
    delivered: results.filter((result) => result.status === 'fulfilled').length
  };
}

async function sendDiscreetSmsToTerence(db) {
  const config = smsConfig();
  if (!config) return { channel: 'sms', status: 'not_configured' };

  // At most one SMS per two-minute bucket. This avoids a storm of paid SMS
  // messages for a rapid exchange, including across multiple server instances.
  const locks = db.collection('chat_sms_alert_locks');
  const bucket = Math.floor(Date.now() / (2 * 60 * 1000));
  const lockId = `terence:${bucket}`;

  try {
    await locks.insertOne({ _id: lockId, createdAt: new Date() });
  } catch (error) {
    if (error.code === 11000) return { channel: 'sms', status: 'throttled' };
    throw error;
  }

  try {
    const body = buildDiscreetSmsBody(config.brand);
    await sendSmsThroughTwilio(config, body);
    return { channel: 'sms', status: 'submitted' };
  } catch (error) {
    // A later message may retry if sending failed.
    await locks.deleteOne({ _id: lockId }).catch(() => {});
    throw error;
  }
}

async function dispatchChatAlert(db, message) {
  const recipient = recipientForMessage(message.ownerId);
  if (recipient === 'partner') return sendPushToJessy(db, message);
  if (recipient === 'terence') return sendDiscreetSmsToTerence(db);
  return { channel: 'none' };
}

module.exports = {
  recipientForMessage,
  buildDiscreetSmsBody,
  smsConfig,
  dispatchChatAlert
};
