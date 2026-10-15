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
3. SMS sending is disabled by default, even if Twilio credentials were inherited.
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

## Test Terence's discreet SMS separately

SMS is **disabled on PR previews by default**. To enable a controlled test, configure the temporary Render preview's Environment settings with the recipient's explicit consent:

```text
ALLOW_PREVIEW_SMS=true
TWILIO_ACCOUNT_SID=<Twilio account SID>
TWILIO_AUTH_TOKEN=<secret>
TERENCE_SMS_TO=+60<authorized number>
TWILIO_MESSAGING_SERVICE_SID=<approved sender's messaging service SID>
SMS_ALERT_BRAND=<registered sending brand>
```

You may use `TWILIO_FROM` instead of a messaging service SID. No secrets or phone numbers should be committed to GitHub or put in frontend environment variables.

Malaysian sender verification and network regulations apply. SMS content remains generic, but the provider/required sending brand may still identify the service; it cannot be truly anonymous. SMS sending incurs charges. Messages are limited to one per two-minute bucket.

## Automated checks and troubleshooting

- Automated checks: https://github.com/Terry-Development/SliderApp/actions/workflows/preview-chat-checks.yml
- The backend health endpoint should return `OK`. If it fails, check the Render PR preview deploy logs.
- A login **Connection error** on the Vercel site usually means the preview backend is not reachable or configured correctly.
- Login works but messages do not load: check MongoDB connection/permissions for the preview database.
- No Jessy push: check notification permission, VAPID keys, subscription status, and your service-worker installation.
- No SMS: expected until `ALLOW_PREVIEW_SMS=true` and real Twilio credentials have been configured on the **preview** backend.
- Closing or merging PR #2 deletes the Render PR service preview; your main branch remains untouched until a merge.

## Deployment status

This file only documents routing and safeguards. The actual browser-to-server and real SMS/push tests must be performed against the running URLs.
