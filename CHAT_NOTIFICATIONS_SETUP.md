# SliderApp chat notifications — Jessy web push, Terence neutral Gmail alert

## What happens

- **Terence → Jessy:** sends a normal web-push alert, only to Jessy's devices explicitly subscribed from Chat.
- **Jessy → Terence:** the Render backend calls a Google Apps Script web app over **HTTPS (port 443)**. That script sends a plain, generic email using Gmail's built-in `MailApp`. There is no message preview, sender name from the chat, URL or recipient detail in the email body.
- The actual **sending Gmail address is visible**, like every legitimate email. The Android Gmail app can show the email as a normal notification.
- Messages still save to MongoDB if email delivery fails or is not configured.
- One email is attempted per two-minute server bucket, with a second throttle inside Google Apps Script. There is no third-party paid SMS service, Twilio, WhatsApp Cloud API, or Gmail SMTP password.

Google Apps Script has a limited free email quota (currently **100 recipients/day** for consumer Google accounts, subject to change).

## 1 — Set up a Google Apps Script

1. Choose a Google account that will legitimately **send** the alerts. You can use a dedicated Gmail account with an unremarkable, truthful sender name. Do not impersonate another sender. The recipient's Gmail can be a different account.
2. Visit https://script.google.com/home/start and select **New project**.
3. Replace the contents of `Code.gs` with the source in `google-apps-script/NeutralEmailAlerts.gs` from this GitHub feature branch.
4. In Apps Script: **Project Settings → Script properties**, add:
   - `ALERT_SECRET`: a random secret with at least 32 characters; do not commit it. You can generate one on a local computer running Node with `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`.
   - `ALERT_TO_EMAIL`: the email address Terence wants to receive notifications at. Keep the address out of GitHub.
5. Select the `authorizeMail` function in the editor toolbar and click **Run**. Approve Google's permissions. It does **not** send an email; it only checks quota to authorize `MailApp`.
6. Select **Deploy → New deployment → Web app**. Choose **Execute as: Me** and **Who has access: Anyone**. Authorize the deployment.
7. Copy the resulting `https://script.google.com/macros/s/.../exec` web app URL. Use the **/exec** URL, **not** the editor link or **/dev** URL.

Because this web app is callable by anyone on the internet, it rejects requests without the matching long shared secret. Never put the secret into client JavaScript, query strings, or GitHub. If compromised, rotate the secret in both Apps Script settings and Render.

## 2 — Configure your temporary Render PR #2 service

Open https://dashboard.render.com and select **sliderapp-pr-2** (not the main production backend). Under **Environment**, set:

```text
IS_PULL_REQUEST=true                   # Verify Render assigned this
GMAIL_ALERT_WEBHOOK_URL=https://script.google.com/macros/s/<YOUR_DEPLOYMENT_ID>/exec
GMAIL_ALERT_SECRET=<THE_SAME_SECRET_AS_ALERT_SECRET>
ALLOW_PREVIEW_EMAIL=true
```

Render's **Free** services block outbound SMTP ports 25/465/587. That is why this uses Apps Script on HTTPS 443 and does **not** use the Gmail app password / SMTP method.

Only the temporary PR service needs these values for the first test. The code intentionally **disables email from PR previews unless `ALLOW_PREVIEW_EMAIL=true`**. The production `main` branch remains unchanged.

Save the environment variables and redeploy/restart the preview service if Render does not redeploy automatically.

## 3 — Test

1. Open https://slider-app-git-feature-discre-f0ff94-terences-projects-72226b28.vercel.app/chat
2. Sign in, choose **Jessy**, and send a short test message.
3. Watch the **Inbox** of `ALERT_TO_EMAIL` in the Android Gmail app. Enable Gmail notifications in Android settings. You may need to check Spam/Promotions.
4. The subject is `Account update`. The body is randomly selected from generic notices, such as `Your latest update is available.`
5. Send another message in the same two-minute interval; only one notification is expected.
6. Verify the recipient can still open SliderApp in Chrome when they want to read the chat; no app installation is required.

The notification **does not contain** the actual message. The sender Gmail address is still displayed by Gmail. Choose your sending account accordingly.

## Troubleshooting

- **No email:** check Render Logs for `Chat alert delivery failed`, and Apps Script's **Executions** tab for errors.
- **Missing Gmail permissions:** rerun `authorizeMail` in Apps Script editor and approve access.
- **Backend says not configured:** inspect the three environment variables and ensure the URL ends in `/exec`.
- **Bad Apps Script response:** verify deployment is `Execute as: Me`, `Anyone`, published, not `/dev`, and updated via **Manage deployments → Edit → New version** after changing its code.
- **No messages loading:** verify preview MongoDB permissions and `IS_PULL_REQUEST=true`.
- **Email arrives but Android is silent:** enable notifications for the Gmail account and allow its category, then check Do Not Disturb/battery restrictions.
- **Quota exceeded:** Google Apps Script consumer quota is limited. Throttling reduces alerts but does not guarantee availability.
- **Sender shows Google account name:** this is normal. Gmail cannot suppress or spoof the real sender's address.

## Files changed

- `backend/utils/chatNotifications.js`: email routing via HTTPS and durable two-minute lock.
- `google-apps-script/NeutralEmailAlerts.gs`: secure webhook, neutral Gmail text, second throttle.
- `backend/test/`: integration helper and Apps Script mock unit tests.
- Jessy's browser push UI and notifications remain unchanged.

**Security note:** a selected Chat identity is not strong authentication; the existing shared admin password grants access to both identities. Production should eventually replace it with person-specific accounts.
