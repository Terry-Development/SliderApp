'use strict';

const crypto = require('node:crypto');
const webpush = require('web-push');
const { chatNotificationPreview } = require('./chatFeatures');

const TELEGRAM_COOLDOWN_MS = 2 * 60 * 1000;
const PROMOTIONAL_NOTICES = Object.freeze([
  '🎉 Congratulations! You have been selected for an exclusive prize draw.',
  '🎁 Lucky winner notice: A special reward has been reserved for you!',
  '✨ Exclusive promotion! Your surprise bonus is waiting today.'
]);

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

function telegramAlertConfig(env = process.env) {
  // Render PR previews can inherit production secrets. They must explicitly
  // opt in before being allowed to contact the real Telegram recipient.
  if (env.IS_PULL_REQUEST === 'true' && env.ALLOW_PREVIEW_TELEGRAM !== 'true') {
    return null;
  }

  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(env.TELEGRAM_CHAT_ID || '').trim();
  if (!token && !chatId) return null;
  if (!/^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(token) || !/^[1-9]\d*$/.test(chatId)) {
    throw new Error('TELEGRAM_BOT_TOKEN or private TELEGRAM_CHAT_ID is invalid');
  }
  return { token, chatId };
}

function promotionalNotice(nowMs = Date.now()) {
  return PROMOTIONAL_NOTICES[Math.floor(nowMs / TELEGRAM_COOLDOWN_MS) % PROMOTIONAL_NOTICES.length];
}

async function sendViaTelegram(config, notice, fetchFn = fetch, sleepFn = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  // The payload is deliberately unrelated to any chat data, people or app URL.
  // Only a server-side token and a single private recipient ID are used.
  const body = JSON.stringify({
    chat_id: config.chatId,
    text: notice,
    disable_notification: false,
    protect_content: true
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    let response;
    try {
      response = await fetchFn(`https://api.telegram.org/bot${config.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10000)
      });
    } catch (_error) {
      if (attempt === 0) {
        await sleepFn(1000);
        continue;
      }
      throw new Error('Telegram API could not be reached');
    }

    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok === true && Number.isInteger(result.result?.message_id)) {
      return { messageId: result.result.message_id };
    }

    const status = result?.error_code || response.status;
    if (attempt === 0 && (status === 429 || status >= 500)) {
      const retrySeconds = Number(result?.parameters?.retry_after);
      await sleepFn(Number.isFinite(retrySeconds) && retrySeconds > 0
        ? Math.min(retrySeconds * 1000, 5000) : 1000);
      continue;
    }
    throw new Error(`Telegram API did not acknowledge the alert (HTTP ${response.status})`);
  }
  throw new Error('Telegram API did not acknowledge the alert');
}

async function sendDiscreetTelegramToTerence(db, config, send = sendViaTelegram, nowMs = Date.now()) {
  const locks = db.collection('chat_telegram_alert_state');
  const now = new Date(nowMs);
  const attemptId = crypto.randomUUID();

  // Atomic reservation: a true rolling two-minute interval, including when
  // several chat requests or Render instances arrive at the same moment.
  try {
    await locks.findOneAndUpdate(
      {
        _id: 'terence',
        $or: [{ nextEligibleAt: { $lte: now } }, { nextEligibleAt: { $exists: false } }]
      },
      {
        $set: {
          nextEligibleAt: new Date(nowMs + TELEGRAM_COOLDOWN_MS),
          attemptedAt: now,
          attemptId
        }
      },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (error) {
    if (error.code === 11000) return { channel: 'telegram', status: 'throttled' };
    throw error;
  }

  // Keep the cooldown even if Telegram fails and Gmail fallback is used:
  // the user asked for no more than one alert attempt every two minutes.
  const result = await send(config, promotionalNotice(nowMs));
  console.info('Private promotional Telegram alert submitted');
  return { channel: 'telegram', status: 'submitted', messageId: result?.messageId ?? null };
}

async function sendPushToJessy(db, message) {
  const collection = db.collection('subscriptions');
  // Reminder-only subscribers do not get chat alerts. Jessy must opt in.
  const subscriptions = await collection.find({ ownerId: 'partner' }).toArray();
  if (!subscriptions.length) return { channel: 'push', attempted: 0, delivered: 0 };

  const payload = JSON.stringify({
    title: 'SliderApp Chat',
    body: `${message.sender}: ${chatNotificationPreview(message)}`,
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

async function sendAlertToTerence(db, sendTelegram = sendViaTelegram, sendEmail = sendViaAppsScript) {
  let config;
  try {
    config = telegramAlertConfig();
  } catch (_error) {
    console.error('Telegram configuration invalid; trying existing Gmail fallback');
    return sendDiscreetEmailToTerence(db, sendEmail);
  }

  // Keep the current Gmail behavior until the two Telegram environment
  // variables are configured; also preserves safe PR-preview behavior.
  if (!config) return sendDiscreetEmailToTerence(db, sendEmail);

  try {
    return await sendDiscreetTelegramToTerence(db, config, sendTelegram);
  } catch (_error) {
    console.error('Telegram submission failed; trying existing Gmail fallback');
    const fallback = await sendDiscreetEmailToTerence(db, sendEmail);
    if (fallback.status === 'not_configured') {
      return { channel: 'telegram', status: 'failed', fallback: 'not_configured' };
    }
    return { ...fallback, fallbackFrom: 'telegram' };
  }
}

async function dispatchChatAlert(db, message) {
  const recipient = recipientForMessage(message.ownerId);
  if (recipient === 'partner') return sendPushToJessy(db, message);
  if (recipient === 'terence') return sendAlertToTerence(db);
  return { channel: 'none' };
}

module.exports = {
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
};
