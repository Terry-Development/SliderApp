# SliderApp Chat: Seen, reactions, and photo messages

These features extend the existing two-person Chat screen without changing old
messages or the Terence/Jessy notification routing.

## Chat behavior

- **Seen**: When the chat is visible, the client marks the other person's
  messages displayed in its current message list as seen. A sender's most
  recent message shows `Sent` until its recipient opens the chat, then
  `Seen` and the time. Background tabs do not issue read receipts.
- **Reactions**: Either person can apply one emoji to each message from
  ❤️ 😂 😮 😢 👍 🔥. Applying the same emoji again removes that person's
  reaction. Both people's reactions are retained independently.
- **Photos**: Attach one JPEG, PNG, GIF, or WebP photo up to 10 MB per
  message, with an optional caption. Photos preview before sending and can be
  opened full-size. Existing text-only clients still use the same JSON API.

## Server API and storage

| Endpoint | Purpose |
| --- | --- |
| `POST /chat/messages` | Existing JSON text or `multipart/form-data` with `image` and optional `text` |
| `POST /chat/messages/seen` | Mark listed IDs from the *other* person as seen |
| `PATCH /chat/messages/:id/reaction` | Set an allowed `emoji`, or send `null` to remove your reaction |
| `GET /chat/messages` | Returns existing fields plus optional `image`, `reactions`, `seenAt` |
| `DELETE /chat/messages/:id` | Deletes own message and tries to clean up its chat photo |

Chat photos are uploaded to Cloudinary under `sliderapp-chat/`, separate from
the photo Gallery. PR previews use `sliderapp-preview-chat/<service>/` so their
media cannot mix with production photos. MongoDB stores the image URL, ID and
dimensions in the existing `chat_messages` collection. No migration is needed.

**Privacy note:** As with the existing Gallery, Cloudinary's standard image
URLs are accessible to anyone who possesses their URL. The chat message list
requires the existing shared app password, but this is not end-to-end encrypted
or private-media access control. Stronger privacy requires a separate signed
media access design and genuinely separate user authentication.

## Verification

1. `cd backend && npm ci && npm test` — includes isolated HTTP tests using a
   fake MongoDB and Cloudinary uploader; never contacts production services.
2. `cd frontend && npm ci && npm run build` — verify the static export/PWA.
3. In a **PR preview** with a separate database, select Terence, send a text
   and image message, then select Jessy on another device; confirm images,
   reactions and Seen receipts sync both ways. Test background-tab behavior.
4. Keep the preview's existing notification safeguards (`IS_PULL_REQUEST=true`)
   and verify that production Telegram/Gmail recipients receive no preview alert.

All existing live data, notification secrets, and production deployment remain
untouched by the code change until this feature branch is merged and deployed.
