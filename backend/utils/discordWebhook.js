import axios from "axios";

/* 🔎 DEBUG: confirm file is loaded & env exists */
console.log(
  "🔔 discordWebhook.js loaded | WEBHOOK exists:",
  Boolean(process.env.DISCORD_WEBHOOK_URL)
);

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function sendOrderToDiscord(order) {
  console.log("🚀 sendOrderToDiscord CALLED for order:", order?._id);

  if (!WEBHOOK_URL) {
    console.error("❌ DISCORD_WEBHOOK_URL missing");
    return;
  }

  const payload = {
    username: "PlagX Orders",
    embeds: [
      {
        title: "📥 New Order Created",
        color: 0x00b0f4,
        fields: [
          { name: "📄 File", value: order.filename || "—" },
          { name: "👤 Email", value: order.email || "—" },
          { name: "🆔 Order ID", value: order._id.toString() },
          { name: "🌐 Source", value: order.source || "website", inline: true },
          { name: "⏳ Status", value: order.status, inline: true }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    await axios.post(WEBHOOK_URL, payload);
    console.log("✅ Discord webhook sent successfully");
  } catch (err) {
    console.error("❌ Discord webhook failed:", err.message);
  }
}
