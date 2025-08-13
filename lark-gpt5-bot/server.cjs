const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const lark = require("@larksuiteoapi/node-sdk");
const OpenAI = require("openai");

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Lark Client
const client = new lark.Client({
  appId: process.env.LARK_APP_ID,
  appSecret: process.env.LARK_APP_SECRET,
  appType: lark.AppType.SelfBuild
});

// OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Webhook từ Lark
app.post("/webhook", async (req, res) => {
  try {
    const event = req.body?.event;
    if (!event || !event.message) {
      return res.status(400).send("No message data");
    }

    const chatId = event.message.chat_id;
    const text = event.message.content.text || "";

    // Gửi sang GPT-5
    const completion = await openai.responses.create({
      model: "gpt-5",
      input: text
    });

    const reply = completion.output[0].content[0].text;

    // Trả lời lại Lark
    await client.im.message.create({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: chatId,
        content: JSON.stringify({ text: reply }),
        msg_type: "text"
      }
    });

    res.status(200).send("ok");
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
