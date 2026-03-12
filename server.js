import dotenv from "dotenv";
dotenv.config({ override: true });

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors());

// ─── Structured logging ───────────────────────────────────────────────────
function log(level, msg, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ─── Request logging middleware ────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api/")) {
      log("info", "request", {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        ms: Date.now() - start,
      });
    }
  });
  next();
});

// ─── Rate limiters ─────────────────────────────────────────────────────────
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment before trying again." },
  handler: (req, res, next, options) => {
    log("warn", "rate_limited", { path: req.path, ip: req.ip });
    res.status(options.statusCode).json(options.message);
  },
});

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification requests. Please wait." },
  handler: (req, res, next, options) => {
    log("warn", "rate_limited", { path: req.path, ip: req.ip });
    res.status(options.statusCode).json(options.message);
  },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", generalLimiter);

const PORT = process.env.PORT || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8000";

// ─── Validate API key ──────────────────────────────────────────────────────
function isValidKey(key) {
  return !!(key && !key.includes("xxxxx") && key.startsWith("sk-ant-"));
}

// ─── Health check ──────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeySet: isValidKey(ANTHROPIC_API_KEY),
    model: ANTHROPIC_MODEL,
  });
});

// ─── API proxy endpoint ────────────────────────────────────────────────────
app.post("/api/chat", chatLimiter, async (req, res) => {
  if (!isValidKey(ANTHROPIC_API_KEY)) {
    return res.status(500).json({
      error:
        "ANTHROPIC_API_KEY is not set or is still the placeholder. Open your .env file and paste a real key from https://console.anthropic.com/settings/keys",
    });
  }

  const { prompt, maxTokens = 4096 } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Anthropic API error ${response.status}:`, errText);
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    res.json({ text });
  } catch (err) {
    console.error("Proxy error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Streaming API proxy endpoint (SSE) ─────────────────────────────────────
app.post("/api/chat/stream", chatLimiter, async (req, res) => {
  if (!isValidKey(ANTHROPIC_API_KEY)) {
    return res.status(500).json({
      error:
        "ANTHROPIC_API_KEY is not set or is still the placeholder. Open your .env file and paste a real key from https://console.anthropic.com/settings/keys",
    });
  }

  const { prompt, maxTokens = 4096 } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: maxTokens,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Anthropic API stream error ${response.status}:`, errText);
      res.write(`event: error\ndata: ${JSON.stringify({ error: errText })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6);
          if (jsonStr === "[DONE]") continue;
          try {
            const evt = JSON.parse(jsonStr);
            if (evt.type === "content_block_delta" && evt.delta?.text) {
              res.write(`data: ${JSON.stringify({ text: evt.delta.text })}\n\n`);
            } else if (evt.type === "message_stop") {
              res.write(`data: [DONE]\n\n`);
            } else if (evt.type === "error") {
              res.write(`event: error\ndata: ${JSON.stringify({ error: evt.error?.message || "Unknown stream error" })}\n\n`);
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.startsWith("data: ")) {
      const jsonStr = buffer.slice(6);
      if (jsonStr !== "[DONE]") {
        try {
          const evt = JSON.parse(jsonStr);
          if (evt.type === "content_block_delta" && evt.delta?.text) {
            res.write(`data: ${JSON.stringify({ text: evt.delta.text })}\n\n`);
          }
        } catch { /* skip */ }
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    console.error("Stream proxy error:", err.message);
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// ─── Verification proxy to Python service ───────────────────────────────────
app.post("/api/verify", verifyLimiter, async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const resp = await fetch(`${PYTHON_SERVICE_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Python service error ${resp.status}:`, errText);
      return res.json({ error: "Verification service error", fallback: true });
    }

    res.json(await resp.json());
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("Verification timed out (60s)");
      return res.json({ error: "Verification timed out", fallback: true });
    }
    console.warn("Verification service unavailable:", err.message);
    res.json({ error: "Verification unavailable", fallback: true });
  }
});

// ─── Streaming verification proxy (SSE) ─────────────────────────────────────
app.post("/api/verify/stream", verifyLimiter, async (req, res) => {
  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 240000); // 4min for streaming (price trends scrapes 12 months)

    const resp = await fetch(`${PYTHON_SERVICE_URL}/verify/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`Python stream error ${resp.status}:`, errText);
      res.write(`event: error\ndata: ${JSON.stringify({ error: errText })}\n\n`);
      res.end();
      return;
    }

    // Pipe the SSE stream from Python through to the client
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }
    res.end();
  } catch (err) {
    if (err.name === "AbortError") {
      console.warn("Streaming verification timed out (120s)");
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Verification timed out" })}\n\n`);
    } else {
      console.warn("Streaming verification unavailable:", err.message);
      res.write(`event: error\ndata: ${JSON.stringify({ error: "Verification unavailable" })}\n\n`);
    }
    res.end();
  }
});

// ─── Hotel search proxy (for swap feature) ──────────────────────────────────
app.post("/api/hotels/search", verifyLimiter, async (req, res) => {
  try {
    const { city, check_in, check_out, adults, children, max_price, currency } = req.body;
    const params = new URLSearchParams({
      city: city || "",
      check_in: check_in || "",
      check_out: check_out || "",
      adults: String(adults || 2),
      children: String(children || 0),
      max_price: String(max_price || 0),
      currency: currency || "USD",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const resp = await fetch(`${PYTHON_SERVICE_URL}/hotels/search?${params}`, {
      method: "POST",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: errText });
    }
    res.json(await resp.json());
  } catch (err) {
    console.warn("Hotel search failed:", err.message);
    res.json([]);
  }
});

// ─── Restaurant alternatives (via Claude) ───────────────────────────────────
app.post("/api/restaurants/alternatives", chatLimiter, async (req, res) => {
  if (!isValidKey(ANTHROPIC_API_KEY)) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const { location, date, current_name, dietary } = req.body;
  const prompt = `You are a travel dining expert. Suggest exactly 4 alternative restaurants near ${location}${date ? ` for a meal on ${date}` : ""}.
${current_name ? `The traveler wants to swap out "${current_name}" for something different.` : ""}
${dietary ? `Dietary requirements: ${dietary}` : ""}

Return ONLY a JSON array (no markdown, no explanation) with exactly 4 objects:
[
  {
    "name": "Restaurant Name",
    "description": "Brief 1-sentence description of cuisine and vibe",
    "estimatedCostPP": 25,
    "mapsQuery": "Restaurant Name ${location}"
  }
]`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "[]";

    // Parse JSON from response (handle markdown wrapping)
    let alternatives;
    try {
      const cleaned = text.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
      alternatives = JSON.parse(cleaned);
    } catch {
      alternatives = [];
    }

    res.json(alternatives);
  } catch (err) {
    console.error("Restaurant alternatives error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Clear verification cache ─────────────────────────────────────────────
app.post("/api/clear-cache", async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${PYTHON_SERVICE_URL}/clear-cache`, {
      method: "POST",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      return res.json({ status: "error", message: "Failed to clear Python cache" });
    }
    console.log("  Cache cleared successfully");
    res.json(await resp.json());
  } catch (err) {
    console.warn("Cache clear failed (Python service may be offline):", err.message);
    res.json({ status: "cleared_local", message: "Python service offline, no cache to clear" });
  }
});

// ─── Verification health check ──────────────────────────────────────────────
app.get("/api/verify/health", async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${PYTHON_SERVICE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    res.json(await resp.json());
  } catch {
    res.json({ status: "offline", message: "Python verification service is not running" });
  }
});

// ─── Serve built frontend in production ────────────────────────────────────
const distPath = join(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(join(distPath, "index.html"));
});

// ─── Start server ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("");
  console.log(`  TripMind server running on http://localhost:${PORT}`);
  console.log("");
  if (!isValidKey(ANTHROPIC_API_KEY)) {
    console.warn("  WARNING: ANTHROPIC_API_KEY is not set or is still the placeholder.");
    console.warn("    1. Open the .env file in this directory");
    console.warn("    2. Replace the placeholder with your real key");
    console.warn("    3. Get a key at https://console.anthropic.com/settings/keys");
    console.warn("    4. Restart this server");
    console.warn("");
  } else {
    console.log(`  Model: ${ANTHROPIC_MODEL}`);
    console.log(`  API key: ...${ANTHROPIC_API_KEY.slice(-8)}`);
    console.log(`  Python service: ${PYTHON_SERVICE_URL}`);
    console.log("");
  }

  // Check Python service
  const ctrl = new AbortController();
  const tmo = setTimeout(() => ctrl.abort(), 3000);
  fetch(`${PYTHON_SERVICE_URL}/health`, { signal: ctrl.signal })
    .then((r) => { clearTimeout(tmo); return r.json(); })
    .then((d) => console.log(`  Verification service: ${d.status}`))
    .catch(() => { clearTimeout(tmo); console.warn("  Verification service: offline (start with: cd agents && python main.py)"); });
});
