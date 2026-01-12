import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const WEBHOOK_LOW = "https://discord.com/api/webhooks/1458754029818744833/aM98FXJ9Yksoo1FNamrLJfOhXT2Eefcfw2tvA36m-OM1G3SmbQl4Urid185Tu2S-xzSV";   
const WEBHOOK_HIGH = "https://discord.com/api/webhooks/1458754235884765267/HwFdHLzFSNGjnrSCIOD3XkE66BtV3NjO90rLLgedRXmULZ2l6YNcAI2PVYUaWAlW7I3V";  

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
        { name: "Join Link", value: `[Click para unirse](${joinLink})`, inline: false }
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
