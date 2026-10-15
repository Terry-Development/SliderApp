'use strict';

const webpush = require('web-push');

// A message from Terence is intended for Jessy, and vice versa.
function recipientForMessage(ownerId) {
  if (ownerId === 'terence') return 'partner';
  if (ownerId === 'partner') return 'terence';
  return null;
}

function gmailAlertConfig(env = process.env) {
  // Render previews inherit environment variables from the production service.
  // They are never allowed to send email without an explicit preview opt-in.
  if (env.IS_PULL_REQUEST === 'true' && env.ALLOW_PREVIEW_EMAIL !== 'true') {
    return null;
  }

  const url = String(env.GMAIL_ALERT_WEBHOOK_URL || '').trim();
  const secret = String(env.GMAIL_ALERT_SECRET || '').trim();
  if (!url || !secret) return null;
  if (secret.length < 32) throw new Error('GMAIL_ALERT_SECRET must be at least 32 characters');

  // Keep the webhook destination fixed to Google's Apps Script service.
  // Never allow arbitrary user-provided URLs to be fetched by the backend.
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url)) {
    throw new Error('GMAIL_ALERT_WEBHOOK_URL must be a deployed Google Apps Script /exec URL');
  }
  return { url, secret };
}

// The webhook sees only a shared secret and a generic event type. No message
// text, user name, recipient address, or link is ever sent to the email service.
function gmailAlertRequest(secret) {
  return { secret, action: 'generic-update' };
}

async function sendViaAppsScript(config, fetchFn = fetch) {
  const response = await fetchFn(config.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: JSON.stringify(gmailAlertRequest(config.secret)),
    redirect: 'follow', // Apps Script ContentService redirects to googleusercontent.com.
    signal: AbortSignal.timeout(20000)
  });
  const result = (await response.text()).trim();
  if (!response.ok || result !== 'OK') {
    throw new Error('Google Apps Script did not confirm email delivery');
  }
}

async function sendPushToJessy(db, message) {
  const collection = db.collection('subscriptions');
  // Reminder-only subscribers do not get chat alerts. Jessy must opt in.
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
    delivered: results.filter((item) => item.status === 'fulfilled').length
  };
}

async function sendDiscreetEmailToTerence(db, send = sendViaAppsScript) {
  const config = gmailAlertConfig();
  if (!config) return { channel: 'email', status: 'not_configured' };

  // Prevent an email for every message during a conversation. The unique
  // MongoDB _id deduplicates across concurrent requests/server instances.
  const locks = db.collection('chat_email_alert_locks');
  const bucket = Math.floor(Date.now() / (2 * 60 * 1000));
  const id = `terence:${bucket}`;

  try {
    await locks.insertOne({ _id: id, createdAt: new Date() });
  } catch (error) {
    if (error.code === 11000) return { channel: 'email', status: 'throttled' };
    throw error;
  }

  try {
    await send(config);
    return { channel: 'email', status: 'submitted' };
  } catch (error) {
    // A later message can retry after an unsuccessful delivery attempt.
    await locks.deleteOne({ _id: id }).catch(() => {});
    throw error;
  }
}

async function dispatchChatAlert(db, message) {
  const recipient = recipientForMessage(message.ownerId);
  if (recipient === 'partner') return sendPushToJessy(db, message);
  if (recipient === 'terence') return sendDiscreetEmailToTerence(db);
  return { channel: 'none' };
}

module.exports = {
  recipientForMessage,
  gmailAlertConfig,
  gmailAlertRequest,
  sendViaAppsScript,
  sendDiscreetEmailToTerence,
  dispatchChatAlert
};
