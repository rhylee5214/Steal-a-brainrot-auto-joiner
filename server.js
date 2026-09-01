import express from "express";
import fetch from "node-fetch";

const app = express();
app.get("/health", (req, res) => {
  res.json({ ok: true, status: "healthy" });
});
app.use(express.json());

const WEBHOOK_LOW = "https://discord.com/api/webhooks/1544495633363370054/KYhnDQlK-5wKQPml4cclTd6QK5Wz6w0le2Zx05JvBpGThVCPzj4LVuaVaFQNUScjCCx5";
const WEBHOOK_HIGH = "https://discord.com/api/webhooks/1544495633363370054/KYhnDQlK-5wKQPml4cclTd6QK5Wz6w0le2Zx05JvBpGThVCPzj4LVuaVaFQNUScjCCx5";
  
let lastLowNotification = null;
let lastHighNotification = null;

async function sendEmbed(brainrots, payload, webhookUrl) {
  const jobId = payload.jobId || "N/A";
  const placeId = payload.placeId || "N/A";
  const topBrainrot = brainrots.reduce((max, b) => (b.value > max.value ? b : max), brainrots[0]);
  const line = `${topBrainrot.name} / $${(topBrainrot.value/1e6).toFixed(2)} M/s`;
  const joinLink = `https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${jobId}`;

  const embed = {
    username: "Angies hub",
    embeds: [{
      title: "Angies Hub",
      color: 16742400,
      fields: [
        { name: "Name", value: line || "N/A", inline: false },
        { name: "Join Link", value: joinLink, inline: false }
      ]
    }]
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(embed)
  });

  const updateData = { name: topBrainrot.name, value: topBrainrot.value, placeId, jobId };
  if (webhookUrl === WEBHOOK_HIGH) { lastHighNotification = updateData; } 
  else { lastLowNotification = updateData; }
}

app.post("/data", async (req, res) => {
  try {
    const payload = req.body;
    const lowBrainrots = payload.brainrots.filter(b => b.value >= 1e6 && b.value <= 1e7);
    const highBrainrots = payload.brainrots.filter(b => b.value > 1e7);

    if (lowBrainrots.length > 0) { await sendEmbed(lowBrainrots, payload, WEBHOOK_LOW); }
    if (highBrainrots.length > 0) { await sendEmbed(highBrainrots, payload, WEBHOOK_HIGH); }

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

app.get("/notifications/high", (req, res) => res.json(lastHighNotification || {}));
app.get("/notifications/low", (req, res) => res.json(lastLowNotification || {}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Desplegado ${PORT}`); });
