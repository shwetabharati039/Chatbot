const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENROUTER_API_KEY;
const IS_PLACEHOLDER_KEY = API_KEY === "your_openrouter_api_key_here";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.CHAT_MODEL || "openai/gpt-4o-mini";
const CHATS_FILE = path.join(__dirname, "chats.json");

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));
function readChats() {
  try {
    if (!fs.existsSync(CHATS_FILE)) return [];
    return JSON.parse(fs.readFileSync(CHATS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeChats(chats) {
  fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2), "utf-8");
}

app.post("/api/chat", async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "Server is missing OPENROUTER_API_KEY. Add it to your .env file.",
    });
  }

  const { message, history = [], image } = req.body;

  if ((!message || typeof message !== "string" || !message.trim()) && !image) {
    return res.status(400).json({ error: "Message or image is required." });
  }

  const chatMessage = message?.trim() || "Please analyze this image.";

  const messages = [
    {
      role: "system",
      content:
        `You are a helpful, professional AI assistant. Be concise, clear, and friendly.

My creator, owner, and developer is Shweta Bharati.

If a user asks "Who is Shweta Bharati?" or wants to know about my creator, you may provide the following information:

Shweta Bharati is a technology enthusiast, AI learner, and BCA student at Swami Vivekananda University. She is currently in the later stage of her degree and is deeply passionate about technology, innovation, and continuous learning.

She has a strong interest in Artificial Intelligence (AI), Machine Learning (ML), Software Development, Full-Stack Development, Data Science, SAP, Product Management, and emerging technologies. She loves exploring how technology works and enjoys learning about new tools, systems, and innovations. Her curiosity drives her to constantly expand her knowledge and stay updated with the tech world.

Shweta dreams of building impactful technology products and intelligent AI systems that can help people in real life. One of her long-term ambitions is to create advanced AI assistants inspired by futuristic technologies and continuously improve them over time.

Her personality can be described as ambitious, curious, determined, creative, hardworking, and growth-oriented. She enjoys taking on challenges, learning from mistakes, experimenting with new ideas, and pushing herself beyond her comfort zone. She believes that consistency, learning, and dedication are the keys to achieving big goals.

She is passionate about understanding every aspect of technology, from software development and AI to product thinking and innovation. Rather than limiting herself to a single field, she enjoys exploring multiple domains and understanding how different technologies work together to create meaningful solutions.

Her goals include:
- Becoming highly skilled in AI and software development.
- Building innovative technology products.
- Creating intelligent AI assistants and automation systems.
- Developing strong technical and problem-solving abilities.
- Contributing to impactful projects in the technology industry.
- Continuously learning and growing with advancements in technology.

Rules:
- If asked "Who created you?" answer: "I was created, owned, and developed by Shweta Bharati."
- If asked about Shweta Bharati, provide relevant information based on the question.
- If the user asks for a full introduction, provide the complete profile above.
- Do not reveal all details unless specifically requested.
- Do not invent facts beyond this profile.
- Always represent Shweta Bharati respectfully and professionally.`,
    },
    ...history
      .filter((entry) => entry?.role && entry?.content)
      .map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
  ];

  const userContent = image
    ? [
        { type: "text", text: chatMessage },
        {
          type: "image_url",
          image_url: { url: `data:${image.mime_type};base64,${image.data}` },
        },
      ]
    : chatMessage;

  messages.push({ role: "user", content: userContent });

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "AI Chatbot",
      },
      body: JSON.stringify({
        model: image ? process.env.VISION_MODEL || "openai/gpt-4o-mini" : MODEL,
        messages,
      }),
    });

    const raw = await response.text();
    let data = {};

    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        return res.status(502).json({ error: "Invalid response from AI provider." });
      }
    }

    if (!response.ok) {
      const errorMessage =
        data?.error?.message || data?.message || "Failed to get a response.";
      return res.status(response.status).json({ error: errorMessage });
    }

    const reply = data?.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return res.status(502).json({ error: "Empty response from AI provider." });
    }

    res.json({ reply });
  } catch (error) {
    res.status(500).json({
      error: error.message || "Unexpected server error.",
    });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/status", (_req, res) => {
  res.json({
    secure: true,
    apiConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    model: MODEL,
    visionModel: process.env.VISION_MODEL || "openai/gpt-4o-mini",
  });
});

app.get("/api/chats", (_req, res) => {
  const chats = readChats();
  const summaries = chats
    .map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(summaries);
});

app.get("/api/chats/:id", (req, res) => {
  const chats = readChats();
  const chat = chats.find((c) => c.id === req.params.id);
  if (!chat) return res.status(404).json({ error: "Chat not found." });
  res.json(chat);
});

app.post("/api/chats", (req, res) => {
  const { title } = req.body;
  const chats = readChats();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const chat = {
    id,
    title: title || "New chat",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  chats.push(chat);
  writeChats(chats);
  res.status(201).json(chat);
});

app.put("/api/chats/:id", (req, res) => {
  const chats = readChats();
  const idx = chats.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Chat not found." });
  const { messages, title } = req.body;
  if (messages) chats[idx].messages = messages;
  if (title) chats[idx].title = title;
  chats[idx].updatedAt = new Date().toISOString();
  writeChats(chats);
  res.json(chats[idx]);
});

app.delete("/api/chats/:id", (req, res) => {
  const chats = readChats();
  const filtered = chats.filter((c) => c.id !== req.params.id);
  if (filtered.length === chats.length)
    return res.status(404).json({ error: "Chat not found." });
  writeChats(filtered);
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "chatbot.html"));
});

app.use(express.static(path.join(__dirname)));

const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  const { networkInterfaces } = require("os");
  const nets = networkInterfaces();
  const localIP = Object.values(nets)
    .flat()
    .find((n) => n.family === "IPv4" && !n.internal)?.address;

  console.log(`Chatbot running at:`);
  console.log(`  Local:   http://localhost:${PORT}`);
  if (localIP) {
    console.log(`  Network: http://${localIP}:${PORT}  <-- use this on your phone`);
  }
  console.log(`\nTo share publicly, open a NEW terminal and run:\n  npx lt --port ${PORT} --subdomain nova-assistant\n`);
  if (!API_KEY) {
    console.log(`  ⚠ No OPENROUTER_API_KEY found. Create a .env file with your key.`);
  } else if (IS_PLACEHOLDER_KEY) {
    console.log(`  ⚠ Replace the placeholder API key in .env with your real OpenRouter key.`);
  }
});
