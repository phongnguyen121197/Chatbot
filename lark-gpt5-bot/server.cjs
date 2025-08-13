// CommonJS to avoid ESM/CJS interop issues with @larksuiteoapi/node-sdk
const express = require("express");
const bodyParser = require("body-parser");
const OpenAI = require("openai");
const larkpkg = require("@larksuiteoapi/node-sdk");
const { Client: LarkClient, Config, LEVEL } = larkpkg;

const app = express();
app.use(bodyParser.json({ type: "*/*" }));

const {
  PORT = 3000,
  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,
  cli_a816ab3b94b8d010,
  7V0HzQJ8dDw1XwXl7yvw38O7Q4yhfcFT,
  jxqgS86EHkrnXaj30722AcPyLXwjZNqR, // optional in this minimal sample
} = process.env;

// OpenAI (Responses API)
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Lark SDK config
const larkConf = new Config({
  appId: LARK_APP_ID,
  appSecret: LARK_APP_SECRET,
  appType: Config.AppType.SelfBuild,
  domain: Config.Domain.LarkSuite,
  loggerLevel: LEVEL.ERROR,
});
const lark = new LarkClient(larkConf);

// Helper: verify token from Lark (enable if you filled LARK_VERIFICATION_TOKEN)
function verifyToken(req) {
  if (!LARK_VERIFICATION_TOKEN) return true; // skip if not set
  const token = req.body?.token || req.headers["x-lark-signature-token"];
  return token === jxqgS86EHkrnXaj30722AcPyLXwjZNqR;
}

app.get("/", (_, res) => res.send("Lark x GPT-5 bot running (CJS)"));

app.post("/lark/callback", async (req, res) => {
  try {
    const body = req.body || {};

    // 1) URL verification handshake
    if (body?.type === "url_verification" && body?.challenge) {
      return res.status(200).send(body.challenge);
    }

    // 2) Token check (optional)
    if (!verifyToken(req)) {
      return res.status(401).send("invalid token");
    }

    // 3) Direct messages to bot (1:1)
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

      const ai = await openai.responses.create({
        model: "gpt-5",
        input: `User: ${userText}\nAssistant:`,
      });
      const reply = (ai.output_text || "").trim() || "(no response)";

      await lark.im.message.create({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          content: JSON.stringify({ text: reply }),
          msg_type: "text",
        },
      });

      return res.status(200).send("ok");
    }

    // 4) Group @-mentions
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
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          content: JSON.stringify({ text: reply }),
          msg_type: "text",
        },
      });

      return res.status(200).send("ok");
    }

    return res.status(200).send("ignored");
  } catch (err) {
    console.error(err);
    // still 200 to avoid aggressive retries
    return res.status(200).send("ok");
  }
});

app.listen(PORT, () => console.log(`Server on :${PORT}`));
