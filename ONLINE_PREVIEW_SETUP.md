# SliderApp PR #2 — Online chat notification test

## Test URLs

- **Frontend:** https://slider-app-git-feature-discre-f0ff94-terences-projects-72226b28.vercel.app/chat
- **Temporary backend:** https://sliderapp-pr-2.onrender.com
- **Backend health check:** https://sliderapp-pr-2.onrender.com/health
- **Source branch:** `feature/discreet-chat-alerts-20261015`
- **PR:** https://github.com/Terry-Development/SliderApp/pull/2

The frontend preview branch is configured to target the Render preview backend **only** on the exact Vercel feature-branch hostname above. Production and other hostnames continue using their existing API configuration.

Render automatically deploys new commits to the open PR preview. Vercel automatically deploys branch updates. Neither deployment means that the live push system or SMS gateway has been tested on a device.

## Safety: production data must not be touched

Render PR previews inherit environment variables, potentially including the production MongoDB URI and Cloudinary credentials. This branch includes the following safeguards **when Render sets `IS_PULL_REQUEST=true`**:

1. MongoDB always uses a separate database named `sliderapp_preview_<Render service>`, ignoring an inherited production `MONGODB_DB_NAME`.
2. Image and album writes/deletes are blocked; previews can read photos.
3. Gmail alerts are disabled by default, even if webhook credentials were inherited. Enable only with `ALLOW_PREVIEW_EMAIL=true`.
4. Existing reminder subscriptions are in the new preview database and will not receive chat pushes until Jessy opts in on a device.

In Render's preview Environment settings, you can explicitly set `MONGODB_PREVIEW_DB_NAME=sliderapp_preview_pr2` (optional). If your MongoDB user does not have permissions to create or access a new database, the preview will need separate MongoDB credentials with appropriate permissions.

**Verify in the Render dashboard that the preview is recognized as a PR preview before testing.** An incorrect manually-deployed server without `IS_PULL_REQUEST=true` would not receive these safeguards.

## Test Jessy's push notifications

1. Open the **frontend test link** above on Jessy's phone or desktop browser.
2. Log in using the backend's admin password, select Jessy in the existing identity picker.
3. Select **Enable alerts**, allow notifications, and check the success message.
4. On another browser or device, open the **same preview frontend**, select Terence, then send a short test message.
5. The push should arrive on Jessy's device. Tap it: it should open the Chat page.
6. Select **Mute alerts** on Jessy's device; send another test message and verify chat notifications stop. Reminder subscriptions are not disabled.

Push works only with supported browsers and notification permissions. On iOS, supported web push requires adding the app to the Home Screen. The VAPID public/private keys must exist in the Vercel and Render preview environments. The preview backend's first request can be slower if the service is sleeping.

## Test Terence's neutral Gmail alert (free)

1. Create a Google Apps Script project and paste **`google-apps-script/NeutralEmailAlerts.gs`**.
2. In **Project Settings → Script properties**, set `ALERT_SECRET` (long random secret) and `ALERT_TO_EMAIL` (Terence's consenting email address).
3. Run `authorizeMail` once in the Apps Script editor to approve Gmail send-only permissions.
4. Deploy it as **Web app**, **Execute as: Me**, **Who has access: Anyone**. Copy the deployed `https://script.google.com/macros/s/.../exec` URL.
5. In the **sliderapp-pr-2** Render preview Environment settings, set:
```text
GMAIL_ALERT_WEBHOOK_URL=https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec
GMAIL_ALERT_SECRET=<SAME_32_PLUS_CHAR_SECRET_AS_APPS_SCRIPT>
ALLOW_PREVIEW_EMAIL=true
```
6. After redeploying, open the frontend preview as **Jessy** and send a message. Terence will receive an email with generic subject `Account update` and a neutral randomized body, not the message content.
7. Check Android Gmail notifications are on and the sender address is one you're comfortable seeing on the lock screen.

Render Free blocks SMTP ports 25/465/587, so the preview calls Apps Script via HTTPS port 443 instead. Free consumer Google Apps Script mail sending has a quota (currently 100 email recipients/day). The visible Gmail sender address cannot be hidden.

See **`CHAT_NOTIFICATIONS_SETUP.md`** for detailed setup and troubleshooting.

## Automated checks and troubleshooting

- Automated checks: https://github.com/Terry-Development/SliderApp/actions/workflows/preview-chat-checks.yml
- The backend health endpoint should return `OK`. If it fails, check the Render PR preview deploy logs.
- A login **Connection error** on the Vercel site usually means the preview backend is not reachable or configured correctly.
- Login works but messages do not load: check MongoDB connection/permissions for the preview database.
- No Jessy push: check notification permission, VAPID keys, subscription status, and your service-worker installation.
- No email: expected until Google Apps Script is deployed and `ALLOW_PREVIEW_EMAIL=true` with the matching webhook URL and secret in the **preview** backend. Check Apps Script Executions logs.
- Closing or merging PR #2 deletes the Render PR service preview; your main branch remains untouched until a merge.

## Deployment status

This file only documents routing and safeguards. The actual browser-to-server and real email/push tests must be performed against the running URLs.
