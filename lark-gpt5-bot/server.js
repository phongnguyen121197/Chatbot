// server.js (fixed)
import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
// Lark SDK là CommonJS -> import mặc định rồi destructure
import larkpkg from "@larksuiteoapi/node-sdk";
const { Client: LarkClient, Config, LEVEL } = larkpkg;

const app = express();
app.use(bodyParser.json({ type: "*/*" }));

const {
  PORT = 3000,
  OPENAI_API_KEY,
  LARK_APP_ID,
  LARK_APP_SECRET,
  LARK_VERIFICATION_TOKEN,
  LARK_ENCRYPT_KEY, // optional
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

// Verify token from Lark
function verifyLarkToken(req) {
  const token = req.body?.token || req.headers["x-lark-signature-token"];
  return token === LARK_VERIFICATION_TOKEN;
}

app.get("/", (_, res) => res.send("Lark x GPT-5 bot running"));

app.post("/lark/callback", async (req, res) => {
  try {
    const body = req.body || {};

    // URL verification
    if (body?.type === "url_verification" && body?.challenge) {
      return res.status(200).send(body.challenge);
    }

    // (Nếu bật encryption thì cần giải mã ở đây — hiện đang tắt)

    // Verify token
    if (!verifyLarkToken(req)) {
      return res.status(401).send("invalid token");
    }

    // 1:1 messages
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
        // CHÚ Ý: receive_id_type nằm ở params, không phải data
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          content: JSON.stringify({ text: reply }),
          msg_type: "text",
        },
      });

      return res.status(200).send("ok");
    }

    // Group @-mentions
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
    return res.status(200).send("ok");
  }
});

app.listen(PORT, () => console.log(`Server on :${PORT}`));

