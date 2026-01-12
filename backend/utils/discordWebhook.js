import axios from "axios";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function sendOrderToDiscord(order) {
  if (!WEBHOOK_URL) {
    console.error("❌ DISCORD_WEBHOOK_URL missing");
    return;
  }

  const payload = {
    username: "PlagX Orders",
    embeds: [
      {
        title: "📥 New File Uploaded",
        color: 0x00b0f4,
        fields: [
          { name: "📄 File", value: order.filename },
          { name: "👤 Email", value: order.email },
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
  } catch (err) {
    console.error("❌ Discord webhook failed:", err.message);
  }
}
