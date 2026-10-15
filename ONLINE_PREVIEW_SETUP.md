# Online preview of chat notifications (feature branch)

## URLs and branch
- Test frontend (Vercel branch preview): https://slider-app-git-feature-discre-f0ff94-terences-projects-72226b28.vercel.app/chat
- GitHub branch: `feature/discreet-chat-alerts-20261015`
- Production main remains unchanged.

## Important
The frontend preview is online but requires a **separate feature-branch backend** to test newly added chat API endpoints.
Do **not** retarget the existing production Render service to the feature branch and do not configure the Vercel Preview frontend to use production as a notification test environment.
Provider SMS requests must remain disabled until the authorized phone is configured and explicitly opted in.

## A. Create a new preview backend on Render
1. Open https://dashboard.render.com and choose **New → Web Service**, then connect the `Terry-Development/SliderApp` GitHub repository.
2. Name: `sliderapp-chat-preview` (or any available unique name).
3. Branch: `feature/discreet-chat-alerts-20261015` — **not** `main`.
4. Runtime: Node.
5. Root directory: `backend`.
6. Build command: `npm ci`.
7. Start command: `npm start`.
8. Health check path: `/health`.
9. Choose the appropriate plan; a free instance may be offered, subject to Render's current policy.
10. In the new preview service's Environment settings, set:
   - `ADMIN_PASSWORD`: a **different** test password from production.
   - `MONGODB_URI`: a MongoDB Atlas connection string for a test account or existing authorised cluster.
   - `MONGODB_DB_NAME=sliderapp_preview`: separate database to isolate test messages, pushes and reminders.
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: your existing public VAPID key.
   - `VAPID_PRIVATE_KEY`: matching private VAPID key.
   - Cloudinary variables are optional for chat-only testing. Needed for gallery images: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
   - **Do not** set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TERENCE_SMS_TO`, or Twilio sender details until you are ready for a paid, opted-in SMS test.
11. Create the service and verify `https://<YOUR-NEW-RENDER-HOST>/health` responds `OK`.

Important: the preview database's chat history is independent of the production database. A person must use the preview URL to read preview messages. The provided `MONGODB_DB_NAME` configuration is supported only on the feature branch and later versions that include this change.

## B. Connect the Vercel frontend preview to the Render test backend
1. Open https://vercel.com/terences-projects-72226b28/slider-app and go to **Settings → Environment Variables**.
2. Set `NEXT_PUBLIC_API_URL` to the **new preview Render service** origin, e.g. `https://sliderapp-chat-preview.onrender.com`. Do not append `/health` or `/chat`.
3. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` to the public VAPID key also used by the preview backend.
4. Scope environment variables to the `feature/discreet-chat-alerts-20261015` preview branch. Avoid modifying Production variables.
5. Redeploy the branch's Vercel Preview deployment so Next.js embeds the updated `NEXT_PUBLIC_*` variables at build time.
6. Visit the preview /chat URL and sign in with the new preview `ADMIN_PASSWORD`.

## C. Push test
1. On Jessy's browser/device, open the **preview URL**, select Jessy, and click **Enable alerts**.
2. Approve the notification prompt. The browser must support Web Push. On iOS, add the web app to the Home Screen on a supported device.
3. On another browser/device, open the *same preview URL*, select Terence, and send a test message.
4. Verify Jessy receives the push, and tapping the alert navigates to `/chat`.
5. In Jessy's Chat page, click **Mute alerts**, then send another message; chat pushes should stop on that device but existing reminder notifications should remain enabled.

## D. SMS test (separate opt-in step)
With explicit authorization from the intended phone recipient, add the following **only to the preview Render backend**:
```
TWILIO_ACCOUNT_SID=<account ID>
TWILIO_AUTH_TOKEN=<secret>
TWILIO_MESSAGING_SERVICE_SID=<approved messaging service>
TERENCE_SMS_TO=+60<test phone digits>
SMS_ALERT_BRAND=<your approved sending brand>
```
Twilio can require sender verification, registration, and other compliance steps. Malaysian SMS routes generally require legitimate sender identification and the `RM0.00` convention; private sender identity cannot be guaranteed. Never put chat text in the outbound SMS.

1. Send a message *as Jessy* on preview.
2. Verify the backend submits an SMS and, if approved, the phone receives a neutral notification.
3. A second message inside the same two-minute bucket is suppressed to limit cost.
4. Provider response success is not proof of final handset delivery.

## Cost and safety
The Vercel preview may be covered by the existing plan; Render and SMS may incur charges depending on tier and usage. Never commit credentials to GitHub. Preview uses its own database name to avoid mixing production message and reminder data. Do not promote/merge the branch until mobile notifications, authentication, and the complete app have been verified.
