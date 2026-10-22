# SliderApp chat notifications — Jessy web push, Terence private Telegram alert

## What happens

- **Terence → Jessy:** sends a normal web-push alert, only to Jessy's devices explicitly subscribed from Chat.
- **Jessy → Terence:** the Render backend sends a **promotional-looking Telegram bot message**, with rotating generic prize/reward language. The Telegram request contains **no SliderApp name, Jessy name, real message, or app link**.
- Telegram messages are limited to **one attempt in any rolling two-minute window**, using an atomic MongoDB reservation so concurrent requests cannot bypass it. This means it does not send a message every two minutes unless Jessy sends a new chat message after the cooldown.
- Messages still save to MongoDB if the notification fails or is not configured.
- The existing neutral Gmail alert is an **optional fallback** when Telegram fails, and remains active until Telegram is configured. Jessy's existing browser push notifications are unchanged.

## 1 — Create a neutral-looking Telegram bot

1. Open **Telegram → @BotFather** (the verified Telegram account), send `/newbot`, and follow its instructions.
2. Choose a neutral, promotional display name (for example, **Daily Rewards**) rather than `SliderApp`, `Jessy`, or a romantic nickname. Telegram notifications display the **bot's name** as well as the message text, so the bot name matters for privacy.
3. Give the bot a unique username ending in `bot`, as BotFather requires. Keep its API token private; **do not put it in GitHub, frontend code, screenshots, or a message to anyone**.
4. Open a private chat with the new bot from **Terence's Telegram account**, press **Start** or send `/start`. Telegram requires the recipient to initiate the bot chat first.
5. Obtain that **private chat's numeric ID** from the bot's `getUpdates` Bot API response (look for `message.chat.id` after `/start`). Use only your own private-chat ID; group IDs are not accepted by this integration.

## 2 — Configure the Render production backend

In **Render → SliderApp production backend → Environment**, create these two secret environment variables:

```text
TELEGRAM_BOT_TOKEN=<TOKEN_FROM_BOTFATHER>
TELEGRAM_CHAT_ID=<YOUR_PRIVATE_NUMERIC_CHAT_ID>
```

Save/redeploy the service. No frontend change or new npm dependency is required. Keep the existing Gmail settings if you want email fallback for Telegram API errors. If you remove them, Telegram still works but has no email fallback.

**Safety:** Render PR previews can inherit production environment variables. This code refuses to send Telegram alerts from `IS_PULL_REQUEST=true` by default. Only set `ALLOW_PREVIEW_TELEGRAM=true` in an intentionally isolated preview if you really want its test messages on your phone; never turn this on casually.

## 3 — Verify

1. In Telegram, make sure the bot conversation is **not muted** and that Telegram notifications are allowed by Android/iOS. Set the notification importance to High if your device supports it, and check battery optimization restrictions.
2. Log into SliderApp **as Jessy**, send one message, and verify a generic promotional Telegram message arrives. It should have no names or message details.
3. Send a second message immediately. **No second Telegram alert** should be sent during the next 120 seconds.
4. Send a third message after 120 seconds. A new promotional Telegram message should arrive.
5. Log into SliderApp **as Terence** and send a message. Jessy's existing web-push behavior should remain unchanged and Terence should not receive a Telegram alert for his own message.
6. If no Telegram message arrives, inspect Render logs for `Telegram submission failed` or `Telegram configuration invalid`. Test BotFather's token, whether your account has started the bot, and the private chat ID. A successful Telegram Bot API response confirms acceptance by Telegram, **not that the phone displayed a push banner**.

No actual prize exists and the messages contain no claim link. They are decoy notices selected solely for the phone's notification preview.

---

## Optional legacy Gmail fallback

The sections below document the **previous** email implementation. They are needed only if you keep Gmail as backup; they are not required for the Telegram setup above.

Google Apps Script has a limited free email quota (currently **100 recipients/day** for consumer Google accounts, subject to change).

### A — Set up a Google Apps Script

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

### B — Configure the previous temporary Render PR #2 service (historical instructions)

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

### C — Test the legacy Gmail fallback

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

- `backend/utils/chatNotifications.js`: private Telegram Bot API routing, promotional decoy text, atomic rolling two-minute throttle, Gmail fallback and preview guard.
- `backend/test/chatNotifications.test.js`: Telegram privacy, configuration, retry, cooldown and fallback tests, alongside the existing Gmail tests.
- `CHAT_NOTIFICATIONS_SETUP.md`: Telegram activation instructions and retained Gmail fallback documentation.
- `google-apps-script/NeutralEmailAlerts.gs`: **unchanged**; existing optional Gmail fallback.
- Jessy's browser push UI and notifications remain unchanged.

**Security note:** a selected Chat identity is not strong authentication; the existing shared admin password grants access to both identities. Production should eventually replace it with person-specific accounts.
