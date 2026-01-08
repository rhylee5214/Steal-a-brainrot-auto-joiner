import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Webhooks distintos según rango
const WEBHOOK_LOW = "https://discord.com/api/webhooks/1447732354679574619/pej-yrBqP1id3D8AP52xFHpqVp1vxQaLU1J16_BEZ_KQzlH3-rcd2doou-tUjXCfFEd4";   // 1–10 millones
const WEBHOOK_HIGH = "https://discord.com/api/webhooks/1446783650413805733/otrtXV75ymi3f3N6uAspE0SXa7omjVSGJTiAjqPKxr016IONoQWd5NhFuGQXpWyt6RmW";  // >10 millones

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
      title: "hyper hub",
      color: 16742400,
      fields: [
        { name: "Name", value: line || "N/A", inline: false },
        { name: "Job ID", value: jobId, inline: false },
        { name: "Join Link", value: `[Click para unirse](${joinLink})`, inline: false },
        { name: "Join Script (PC)", value: "```lua\n" + joinScript + "\n```", inline: false }
      ]
    }]
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(embed)
  });

  // Guardar notificación según rango
  if (webhookUrl === WEBHOOK_HIGH) {
    lastHighNotification = {
      name: topBrainrot.name,
      value: topBrainrot.value,
      placeId,
      jobId
    };
  } else if (webhookUrl === WEBHOOK_LOW) {
    lastLowNotification = {
      name: topBrainrot.name,
      value: topBrainrot.value,
      placeId,
      jobId
    };
  }
}

// Endpoint que recibe datos desde Roblox
app.post("/data", async (req, res) => {
  try {
    const payload = req.body;

    // Separar brainrots por rango
    const lowBrainrots = payload.brainrots.filter(b => b.value >= 1e6 && b.value <= 1e7);
    const highBrainrots = payload.brainrots.filter(b => b.value > 1e7);

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

// Render necesita escuchar en el puerto asignado
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
