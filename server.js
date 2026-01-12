import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

// Load environment variables with error handling
const dotenvResult = dotenv.config();
if (dotenvResult.error) {
  console.warn("Warning: Could not load .env file. Using environment variables only.");
}

const app = express();

// Configuration constants
const DISCORD_WEBHOOK_TIMEOUT = 5000; // 5 seconds

// Rate limiting: 15s window, 30 req/IP
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 15000; // 15 seconds
const RATE_LIMIT_MAX = 30;

// Deduplication: 60s per jobId
const dedupMap = new Map();
const DEDUP_WINDOW = 60000; // 60 seconds

// Store last 50 payload summaries
const lastPayloads = [];
const MAX_PAYLOAD_HISTORY = 50;

// Validate required env vars
const WEBHOOK_LOW = process.env.WEBHOOK_LOW;
const WEBHOOK_HIGH = process.env.WEBHOOK_HIGH;
const SECRET_TOKEN = process.env.SECRET_TOKEN;

if (!WEBHOOK_LOW || !WEBHOOK_HIGH) {
  console.error("FATAL ERROR: Missing required environment variables WEBHOOK_LOW and/or WEBHOOK_HIGH");
  process.exit(1);
}

// Tolerant JSON parsing middleware
app.use((req, res, next) => {
  if (req.method === "POST" && req.url === "/data") {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try {
        req.body = JSON.parse(data);
      } catch (err) {
        console.warn("JSON parse error, trying to recover:", err.message);
        req.body = {};
      }
      next();
    });
  } else {
    express.json()(req, res, next);
  }
});

// Rate limiting middleware
function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip).filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (requests.length >= RATE_LIMIT_MAX) {
    return res.status(429).json({ ok: false, error: "Rate limit exceeded" });
  }
  
  requests.push(now);
  rateLimitMap.set(ip, requests);
  
  // Cleanup old entries
  if (rateLimitMap.size > 1000) {
    for (const [key, value] of rateLimitMap.entries()) {
      if (value.every(timestamp => now - timestamp > RATE_LIMIT_WINDOW)) {
        rateLimitMap.delete(key);
      }
    }
  }
  
  next();
}

// Auth middleware (optional)
function authMiddleware(req, res, next) {
  if (SECRET_TOKEN) {
    const token = req.headers["x-notifier-token"];
    if (token !== SECRET_TOKEN) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
  }
  next();
}

// Guardar últimas notificaciones
let lastLowNotification = null;
let lastHighNotification = null;

// Función para construir y enviar embed
async function sendEmbed(brainrots, payload, webhookUrl) {
  const jobId = payload.jobId || "N/A";
  const placeId = payload.placeId || "N/A";

  // Seleccionar el brainrot con mayor valor
  const topBrainrot = brainrots.reduce((max, b) => (b.value > max.value ? b : max), brainrots[0]);

  // Línea única con nombre y dinero
  const line = `${topBrainrot.name} / $${(topBrainrot.value/1e6).toFixed(2)} M/s`;

  const joinLink = `https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${jobId}`;
  const joinScript = `game:GetService("TeleportService"):TeleportToPlaceInstance(${placeId},"${jobId}",game.Players.LocalPlayer)`;

  const embed = {
    username: ".",
    embeds: [{
      title: "Blossom Finder",
      color: 16742400,
      fields: [
        { name: "Name", value: line || "N/A", inline: false },
        { name: "Join Link", value: `[Click para unirse](${joinLink})`, inline: false },
      ]
    }]
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DISCORD_WEBHOOK_TIMEOUT);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(embed),
      signal: controller.signal
    });
    
    if (!response.ok) {
      throw new Error(`Discord webhook returned ${response.status}`);
    }
  } catch (err) {
    console.error("Error sending to Discord:", err.message);
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  // Guardar notificación según rango
  if (webhookUrl === WEBHOOK_HIGH) {
    lastHighNotification = {
      name: topBrainrot.name,
      value: topBrainrot.value,
      placeId,
      jobId,
      timestamp: new Date().toISOString()
    };
  } else if (webhookUrl === WEBHOOK_LOW) {
    lastLowNotification = {
      name: topBrainrot.name,
      value: topBrainrot.value,
      placeId,
      jobId,
      timestamp: new Date().toISOString()
    };
  }
}

// Endpoint que recibe datos desde Roblox
app.post("/data", rateLimitMiddleware, authMiddleware, async (req, res) => {
  try {
    const payload = req.body;

    // Validate payload
    if (!payload || !payload.brainrots || !Array.isArray(payload.brainrots)) {
      return res.status(400).json({ ok: false, error: "Invalid payload: brainrots array required" });
    }

    const jobId = payload.jobId || "unknown";
    const placeId = payload.placeId || "unknown";

    // Deduplication check
    const dedupKey = jobId;
    const now = Date.now();
    if (dedupMap.has(dedupKey)) {
      const lastSent = dedupMap.get(dedupKey);
      if (now - lastSent < DEDUP_WINDOW) {
        return res.json({ ok: true, message: "Duplicate request ignored (dedup)" });
      }
    }
    dedupMap.set(dedupKey, now);

    // Cleanup old dedup entries
    if (dedupMap.size > 500) {
      for (const [key, timestamp] of dedupMap.entries()) {
        if (now - timestamp > DEDUP_WINDOW) {
          dedupMap.delete(key);
        }
      }
    }

    // Truncate to 25 entries
    const truncatedBrainrots = payload.brainrots.slice(0, 25);

    // Store payload summary
    lastPayloads.push({
      timestamp: new Date().toISOString(),
      jobId,
      placeId,
      count: truncatedBrainrots.length,
      ip: req.ip || req.socket?.remoteAddress || 'unknown'
    });
    if (lastPayloads.length > MAX_PAYLOAD_HISTORY) {
      lastPayloads.shift();
    }

    // Log minimal info
    console.log(`[${new Date().toISOString()}] POST /data - JobId: ${jobId}, PlaceId: ${placeId}, Brainrots: ${truncatedBrainrots.length}`);

    // Separar brainrots por rango
    const lowBrainrots = truncatedBrainrots.filter(b => b.value >= 1e6 && b.value <= 1e7);
    const highBrainrots = truncatedBrainrots.filter(b => b.value > 1e7);

    // Enviar solo el top brainrot de cada rango
    if (lowBrainrots.length > 0) {
      await sendEmbed(lowBrainrots, payload, WEBHOOK_LOW);
    }
    if (highBrainrots.length > 0) {
      await sendEmbed(highBrainrots, payload, WEBHOOK_HIGH);
    }

    res.json({ ok: true, message: "Top brainrot enviado según rango" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Endpoints para consultar últimas notificaciones
app.get("/notifications/high", (req, res) => {
  res.json(lastHighNotification || {});
});

app.get("/notifications/low", (req, res) => {
  res.json(lastLowNotification || {});
});

// Health endpoint
app.get("/health", (req, res) => {
  res.json({ ok: true, status: "healthy" });
});

// Status endpoint
app.get("/status", (req, res) => {
  res.json({
    ok: true,
    webhooksConfigured: !!(WEBHOOK_LOW && WEBHOOK_HIGH),
    authEnabled: !!SECRET_TOKEN,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint
app.get("/debug/last", (req, res) => {
  res.json({
    ok: true,
    lastPayloads: lastPayloads.slice(-50)
  });
});

// Render necesita escuchar en el puerto asignado
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
  console.log(`Webhooks configured: ${!!(WEBHOOK_LOW && WEBHOOK_HIGH)}`);
  console.log(`Auth enabled: ${!!SECRET_TOKEN}`);
});
