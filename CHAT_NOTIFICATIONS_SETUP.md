# Chat notifications (Jessy: web push; Terence: discreet SMS)

## Intended behavior

- Message **from Terence**: notify only Jessy's chat-registered browser/PWA devices, with sender and preview. Clicking opens `/chat`.
- Message **from Jessy**: submit one generic SMS alert for Terence. Never include Jessy's name, the sender, the recipient, the message contents, a direct link, or the fact that the alert was triggered by chat.
- No SMS is sent when credentials are missing. Chat messages still save and load normally.
- SMS alerts are throttled to **one per two-minute time bucket** to limit costs. Failed gateway calls release the lock for a later message.
- Reminder broadcasts continue using their existing `subscriptions` collection. Chat pushes use subscriptions specifically marked `ownerId: 'partner'`.
- A device with Reminders enabled must still opt in from Chat as Jessy. Selecting a name within the current shared-password app is not strong user authentication.

## Jessy's device (browser/PWA)

1. Open the SliderApp Chat page on the desired device.
2. Select **Jessy** in the existing identity switcher.
3. Select **Enable alerts** and approve the operating system/browser push prompt.
4. Verify the server's existing VAPID variables and PWA service worker are configured. Chat uses those same keys; no new push service is necessary.
5. **Mute alerts** removes only the chat routing for that device. It does **not** unsubscribe from Reminders.

iOS web push requires installation to the Home Screen and supported iOS versions. Android and desktop browser behavior varies with permissions and OS settings.

## Terence's SMS (backend only)

Configure the existing backend deployment's secret environment variables (e.g. on Render). Never place these values in `NEXT_PUBLIC_*` variables, in source code, or in GitHub:

```env
TWILIO_ACCOUNT_SID=AC................................
TWILIO_AUTH_TOKEN=<secret>
TERENCE_SMS_TO=+60..........
TWILIO_MESSAGING_SERVICE_SID=MG................................
# OR specify TWILIO_FROM=<your SMS-capable sender>, not both
SMS_ALERT_BRAND=YourLegitimateRegisteredBrand
```

The SMS helper calls Twilio's HTTPS Messages endpoint using Node's built-in HTTPS module, so no npm dependency is necessary. If `TWILIO_MESSAGING_SERVICE_SID` is defined it takes precedence over `TWILIO_FROM`.

**Malaysia:** Confirm the sender registration and use case with the SMS provider. Malaysian operators require compliant sender identification, `RM0.00`, and a legitimate brand in the message body. Fully anonymous SMS or fabricated sender IDs are **not** supported. Depending on routing, an operator may replace the displayed sender with a shortcode. Avoid links and phone numbers inside SMS content. The generic text variants in `backend/utils/chatNotifications.js` follow these formatting constraints, but live delivery still needs provider approval and testing.

Messages do not reveal the chat or personal names. However, neither SMS nor WhatsApp can guarantee that a third party will not infer that a private alert arrived. Terence needs to consent to receiving these automated texts. SMS service charges apply.

## Server and client change list

- `backend/utils/chatNotifications.js`: recipient routing, Jessy push, Terence SMS, provider timeout, and coarse SMS throttling.
- `backend/server.js`: new chat push subscription/status/unsubscribe endpoints, recipient alert after message persistence.
- `frontend/src/pages/chat.js`: Jessy's opt-in and mute button.
- `frontend/public/push-sw.js`: chat push opens `/chat`, existing reminder push behavior preserved.
- `backend/test/chatNotifications.test.js`: routing and privacy regression tests.

## Testing checklist

```bash
cd backend
npm install
npm test
node --check server.js
node --check utils/chatNotifications.js
```

Frontend:

```bash
cd frontend
npm install
npm run build
```

Manual checks:
1. With SMS env variables missing, send from Jessy; message must still save (no SMS).
2. Enable push on Jessy's device; send from Terence; Jessy sees a notification and tapping opens Chat.
3. Mute chat notifications on Jessy's device; send from Terence; no chat push is expected, but Reminders should still work.
4. Add real SMS credentials/verified recipient to the deployed backend. Send from Jessy; confirm the SMS body includes no message text or personal names.
5. Send several messages from Jessy in the same two-minute bucket; at most one SMS should be submitted.
6. Test on the actual mobile carrier; successful API acceptance does **not** guarantee carrier delivery.
7. Ensure a phone/device's identity selection is not shared by the wrong recipient.

**Note:** This feature has not been live-delivery tested against Twilio, MongoDB Atlas, or the user's phones. Provider credentials and an opted-in recipient are required for an end-to-end test.

## Optional later improvements

A proper device-to-person sign-in would prevent anyone with the shared password from selecting another identity. Delivery receipt webhooks and provider failure metrics would improve SMS reliability. WhatsApp Business could be added later, but its account/template/sender identification requirements make it less suitable for discreet automatic alerts.
