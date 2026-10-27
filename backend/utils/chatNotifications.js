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

// Operational diagnostics only. Never log the bot token, chat ID, notification
// body, Gmail secret, or private chat text.
function alertErrorDetails(error) {
  const safeType = /^[A-Za-z]{1,40}$/.test(error?.name || '') ? error.name : 'Error';
  const details = { stage: error?.alertStage || 'notification', type: safeType };
  if (error?.alertKind) details.kind = error.alertKind;
  if (Number.isInteger(error?.httpStatus)) details.httpStatus = error.httpStatus;
  if (Number.isInteger(error?.apiCode)) details.apiCode = error.apiCode;
  if (Number.isFinite(error?.retryAfterSeconds)) details.retryAfterSeconds = error.retryAfterSeconds;
  if (Number.isInteger(error?.attempts)) details.attempts = error.attempts;
  if (error?.networkCode && /^[A-Z0-9_]{1,40}$/.test(error.networkCode)) {
    details.networkCode = error.networkCode;
  }
  if (error?.code && /^[A-Z0-9_]{1,40}$/.test(String(error.code))) {
    details.errorCode = error.code;
  }
  if (error?.networkErrorName && /^[A-Za-z]{1,40}$/.test(error.networkErrorName)) {
    details.networkErrorName = error.networkErrorName;
  }
  if (error?.telegramDescription) details.telegramDescription = error.telegramDescription;
  return details;
}

function telegramApiError(response, result, attempt, token, chatId) {
  const error = new Error(`Telegram API did not acknowledge the alert (HTTP ${response.status})`);
  error.alertStage = 'telegram-api';
  error.alertKind = 'api-rejection';
  error.httpStatus = response.status;
  if (Number.isInteger(result?.error_code)) error.apiCode = result.error_code;
  const retryAfter = Number(result?.parameters?.retry_after);
  if (Number.isFinite(retryAfter) && retryAfter > 0) error.retryAfterSeconds = retryAfter;
  if (typeof result?.description === 'string') {
    error.telegramDescription = result.description
      .replaceAll(token, '[redacted]').replaceAll(chatId, '[redacted-chat]').slice(0, 240);
  }
  error.attempts = attempt;
  return error;
}

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
    } catch (error) {
      if (attempt === 0) {
        const networkErrorName = /^[A-Za-z]{1,40}$/.test(error?.name || '')
          ? error.name : 'Error';
        console.warn('Telegram transport retry scheduled', JSON.stringify({
          attempt: 1,
          networkErrorName,
          networkCode: /^[A-Z0-9_]{1,40}$/.test(error?.cause?.code || error?.code || '')
            ? (error?.cause?.code || error?.code) : undefined
        }));
        await sleepFn(1000);
        continue;
      }
      const transportError = new Error('Telegram API could not be reached');
      transportError.alertStage = 'telegram-transport';
      transportError.alertKind = 'network';
      transportError.networkErrorName = error?.name || 'Error';
      transportError.networkCode = error?.cause?.code || error?.code || null;
      transportError.attempts = attempt + 1;
      throw transportError;
    }

    const result = await response.json().catch(() => null);
    if (response.ok && result?.ok === true && Number.isInteger(result.result?.message_id)) {
      return { messageId: result.result.message_id };
    }

    const status = result?.error_code || response.status;
    if (attempt === 0 && (status === 429 || status >= 500)) {
      const retrySeconds = Number(result?.parameters?.retry_after);
      const delayMs = Number.isFinite(retrySeconds) && retrySeconds > 0
        ? Math.min(retrySeconds * 1000, 5000) : 1000;
      console.warn('Telegram API retry scheduled', JSON.stringify({
        httpStatus: response.status,
        apiCode: Number.isInteger(result?.error_code) ? result.error_code : null,
        retryAfterSeconds: Number.isFinite(retrySeconds) && retrySeconds > 0 ? retrySeconds : null,
        delayMs
      }));
      await sleepFn(delayMs);
      continue;
    }
    throw telegramApiError(response, result, attempt + 1, config.token, config.chatId);
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
    if (error.code === 11000) {
      // A duplicate-key conflict here means another attempt reserved the
      // rolling cooldown. Read-only lookup is best effort for diagnostics.
      const current = typeof locks.findOne === 'function'
        ? await locks.findOne({ _id: 'terence' }, { projection: { nextEligibleAt: 1 } }).catch(() => null)
        : null;
      const nextMs = new Date(current?.nextEligibleAt || 0).getTime();
      const remainingSeconds = Number.isFinite(nextMs) && nextMs > nowMs
        ? Math.ceil((nextMs - nowMs) / 1000) : null;
      console.info('Telegram alert skipped: cooldown', JSON.stringify({
        status: 'COOLDOWN', remainingSeconds
      }));
      return { channel: 'telegram', status: 'throttled' };
    }
    error.alertStage = 'cooldown-reservation';
    throw error;
  }

  // Keep the cooldown even if Telegram fails and Gmail fallback is used:
  // the user asked for no more than one alert attempt every two minutes.
  const result = await send(config, promotionalNotice(nowMs));
  console.info('Private promotional Telegram alert submitted', JSON.stringify({
    status: 'ACK', messageId: result?.messageId ?? null, attemptId
  }));
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
  async function emailOutcome(reason) {
    try {
      const result = await sendDiscreetEmailToTerence(db, sendEmail);
      console.info('Chat email notification outcome', JSON.stringify({ reason, status: result.status }));
      return result;
    } catch (error) {
      console.error('Chat email notification failed', JSON.stringify({
        reason, ...alertErrorDetails(error)
      }));
      throw error;
    }
  }

  let config;
  try {
    config = telegramAlertConfig();
  } catch (error) {
    console.error('Telegram configuration invalid; trying existing Gmail fallback',
      JSON.stringify({ kind: 'invalid-configuration', ...alertErrorDetails(error) }));
    return emailOutcome('telegram-invalid-configuration');
  }

  // Keep the current Gmail behavior until the two Telegram environment
  // variables are configured; also preserves safe PR-preview behavior.
  if (!config) return emailOutcome('telegram-not-configured-or-preview-disabled');

  try {
    return await sendDiscreetTelegramToTerence(db, config, sendTelegram);
  } catch (error) {
    console.error('Telegram submission failed; trying existing Gmail fallback',
      JSON.stringify(alertErrorDetails(error)));
    const fallback = await emailOutcome('telegram-failed');
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
