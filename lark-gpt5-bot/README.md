# Lark x GPT-5 Bot (Railway)

Webhook server for a LarkSuite bot that forwards messages to OpenAI GPT‑5 and replies back in chat.

## Quick Start (Local test)

1. Install Node.js 18+.
2. Install deps:
   ```bash
   npm i
   ```
3. Set environment variables (see `.env.example`). If you run locally, export them in your shell or use a dotenv loader.
4. Start:
   ```bash
   npm start
   ```
5. The server listens on `http://localhost:3000`. The webhook endpoint is `/lark/callback`.

## Deploy on Railway

1. Push this repo to GitHub.
2. On Railway: **New Project → Deploy from GitHub repo**.
3. In **Variables**, add:
   - `OPENAI_API_KEY`
   - `LARK_APP_ID`
   - `LARK_APP_SECRET`
   - `LARK_VERIFICATION_TOKEN`
   - (optional) `LARK_ENCRYPT_KEY`
   - `PORT` = `3000` (Railway can also auto-assign, but 3000 is fine)
4. Wait until logs show `Server on :3000`.
5. Copy your public URL, e.g. `https://<project>.up.railway.app`.

## Connect in Lark Developer Console

1. Go to **Events & Callbacks → Subscription mode**.
2. Request URL: `https://<project>.up.railway.app/lark/callback`.
3. Set **Verification Token** (and **Encrypt Key** if you enabled encryption).
4. Verify. Then **Add Events**:
   - Receive messages in 1:1 chats (`im.message.receive_v1`)
   - Receive group messages mentioning the bot (`im.message.group_at_msg_v1`)

## Notes

- This sample handles only text messages; other message types are acknowledged with `[non-text message]`.
- Encryption strategy is not implemented in this minimal sample; keep it **disabled** on Lark unless you add decrypt logic.
