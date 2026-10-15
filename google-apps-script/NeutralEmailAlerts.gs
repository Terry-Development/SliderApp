/**
 * SliderApp — free neutral Gmail notification webhook.
 *
 * Deploy this as a Google Apps Script WEB APP:
 * Execute as: Me | Who has access: Anyone
 *
 * Script properties (Project Settings > Script Properties):
 *   ALERT_SECRET    = a randomly generated 32+ character secret
 *   ALERT_TO_EMAIL  = the consenting recipient's Gmail address
 *
 * Only this Apps Script holds the recipient email address. The Render backend
 * sends no chat text, sender name, or chat metadata.
 */

const SUBJECT = 'Account update';
const NEUTRAL_NOTICES = [
  'Your latest update is available.',
  'Your daily note is ready.',
  'A new account update is available.'
];
const TWO_MINUTES_MS = 2 * 60 * 1000;

function output_(message) {
  return ContentService.createTextOutput(message)
    .setMimeType(ContentService.MimeType.TEXT);
}

function safeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const maxLength = Math.max(a.length, b.length);
  let different = a.length ^ b.length;
  for (let i = 0; i < maxLength; i++) {
    different |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return different === 0;
}

function doPost(e) {
  let lock;
  try {
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('ALERT_SECRET');
    const recipient = props.getProperty('ALERT_TO_EMAIL');

    // Fail closed if project was deployed before it was configured.
    if (!secret || secret.length < 32 || !recipient ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return output_('NOT_CONFIGURED');
    }

    const received = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (received.action !== 'generic-update' ||
        !safeEqual_(received.secret, secret)) {
      return output_('UNAUTHORIZED');
    }

    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return output_('RETRY');

    // Throttle here too, in case the webhook is accidentally requested twice
    // or two independent backends send at the same time.
    const now = Date.now();
    const lastSent = Number(props.getProperty('LAST_ALERT_SENT_AT') || 0);
    if (lastSent && now - lastSent < TWO_MINUTES_MS) return output_('OK');

    if (MailApp.getRemainingDailyQuota() < 1) return output_('QUOTA_EXCEEDED');

    const notice = NEUTRAL_NOTICES[
      Math.floor(Math.random() * NEUTRAL_NOTICES.length)
    ];

    // The authenticated Gmail address remains visible as the real sender.
    // No sender spoofing and no private chat text is included in the email.
    MailApp.sendEmail({
      to: recipient,
      subject: SUBJECT,
      body: notice,
      name: 'General Updates'
    });

    props.setProperty('LAST_ALERT_SENT_AT', String(now));
    return output_('OK');
  } catch (error) {
    console.error('Neutral Gmail delivery failed: ' + (error && error.message));
    return output_('ERROR');
  } finally {
    if (lock) lock.releaseLock();
  }
}

function doGet() {
  return output_('POST only');
}

// Run this once from the Apps Script editor to authorize email permissions
// BEFORE deploying. It does not send any email.
function authorizeMail() {
  const remaining = MailApp.getRemainingDailyQuota();
  console.log('Mail authorization OK. Remaining recipients today: ' + remaining);
}
