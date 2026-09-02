import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, status: "healthy" });
});

// Discord webhook
const WEBHOOK =
  "https://discord.com/api/webhooks/1544495633363370054/KYhnDQlK-5wKQPml4cclTd6QK5Wz6w0le2Zx05JvBpGThVCPzj4LVuaVaFQNUScjCCx5";

// Store last notification
let lastNotification = null;

// Send embed to Discord
async function sendEmbed(brainrot, payload) {
  const jobId = payload.jobId || "N/A";
  const placeId = payload.placeId || "N/A";

  const line = `${brainrot.name} / $${brainrot.value.toLocaleString()}`;
  const joinLink = `https://www.roblox.com/games/start?placeId=${placeId}&gameInstanceId=${jobId}`;

  const embed = {
    username: "Angies Hub",
    embeds: [
      {
        title: "Angies Hub",
        color: 16742400,
        fields: [
          { name: "Name", value: line, inline: false },
          { name: "Join Link", value: joinLink, inline: false },
        ],
      },
    ],
  };

  await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(embed),
  });

  lastNotification = {
    name: brainrot.name,
    value: brainrot.value,
    placeId,
    jobId,
    joinLink,
  };
}

// Receive data from Roblox script
app.post("/data", async (req, res) => {
  try {
    const payload = req.body;

    if (!payload.brainrots || payload.brainrots.length === 0) {
      return res.json({ ok: false, error: "No brainrots received" });
    }

    // Highest value brainrot
    const top = payload.brainrots.reduce(
      (max, b) => (b.value > max.value ? b : max),
      payload.brainrots[0]
    );

    await sendEmbed(top, payload);

    res.json({ ok: true, top });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Return last notification (never plain {})
app.get("/notifications/high", (req, res) => {
  if (!lastNotification) {
    return res.json({
      ok: false,
      message: "No notifications yet. Wait for Roblox to POST /data.",
    });
  }
  res.json({ ok: true, notification: lastNotification });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
