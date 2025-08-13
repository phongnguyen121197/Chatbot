// server.js
import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import { Client as LarkClient, Config, LEVEL } from "@larksuiteoapi/node-sdk";

const app = express();
// Lark sends JSON; accept any content-type just in case
app.use(bodyParser.json({ type: "*/*" }));

const {
  PORT = 3000,
  OPENAI_API_KEY,
  LARK_APP_ID,
  LARK_APP_SECRET,
  LARK_VERIFICATION_TOKEN,
  LARK_ENCRYPT_KEY // optional; only if encryption strategy is enabled
} = process.env;

// --- OpenAI (Responses API) ---
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// --- Lark SDK config ---
const larkConf = new Config({
  appId: LARK_APP_ID,
  appSecret: LARK_APP_SECRET,
  appType: Config.AppType.SelfBuild,
  domain: Config.Domain.LarkSuite,
  loggerLevel: LEVEL.ERROR,
});
const lark = new LarkClient(larkConf);

// Verify Lark token util
function verifyLarkToken(req) {
  const token = req.body?.token || req.headers["x-lark-signature-token"];
  return token === LARK_VERIFICATION_TOKEN;
}

// Health check
app.get("/", (_req, res) => res.send("Lark x GPT-5 bot running"));

// Webhook endpoint for Lark
app.post("/lark/callback", async (req, res) => {
  try {
    const body = req.body || {};

    // 1) URL verification handshake
    if (body?.type === "url_verification" && body?.challenge) {
      return res.status(200).send(body.challenge);
    }

    // 2) Optional: decrypt if using encryption (not implemented; typically unnecessary)
    //    If you enabled Encryption Strategy in Lark, implement decrypt here using LARK_ENCRYPT_KEY.

    // 3) Verify token
    if (!verifyLarkToken(req)) {
      return res.status(401).send("invalid token");
    }

    // 4) Handle direct messages to bot
    if (body?.header?.event_type === "im.message.receive_v1") {
      const event = body.event;
      const chatId = event?.message?.chat_id;
      const msgType = event?.message?.message_type;

      let userText = "";
      if (msgType === "text") {
        const content = JSON.parse(event?.message?.content || "{}");
        userText = content.text || "";
      } else {
        userText = "[non-text message]";
      }

      // Call OpenAI
      const ai = await openai.responses.create({
        model: "gpt-5",
        input: `User: ${userText}\nAssistant:`,
      });
      const reply = (ai.output_text || "").trim() || "(no response)";

      // Send back to Lark
      await lark.im.message.create({
        data: {
          receive_id: chatId,
          receive_id_type: "chat_id",
          content: JSON.stringify({ text: reply }),
          msg_type: "text",
        },
      });

      return res.status(200).send("ok");
    }

    // 5) Handle group @-mentions
    if (body?.header?.event_type === "im.message.group_at_msg_v1") {
      const event = body.event;
      const chatId = event?.message?.chat_id;
      const content = JSON.parse(event?.message?.content || "{}");
      const userText = content.text || "";

      const ai = await openai.responses.create({
        model: "gpt-5",
        input: userText,
      });
      const reply = (ai.output_text || "").trim() || "(no response)";

      await lark.im.message.create({
        data: {
          receive_id: chatId,
          receive_id_type: "chat_id",
          content: JSON.stringify({ text: reply }),
          msg_type: "text",
        },
      });

      return res.status(200).send("ok");
    }

    return res.status(200).send("ignored");
  } catch (err) {
    console.error(err);
    // Always 200 so Lark doesn't retry aggressively
    return res.status(200).send("ok");
  }
});

app.listen(PORT, () => console.log(`Server on :${PORT}`));
