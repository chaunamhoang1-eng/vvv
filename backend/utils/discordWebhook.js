import axios from "axios";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function sendOrderToDiscord(order) {
  if (!WEBHOOK_URL) return;

  const payload = {
    username: "PlagX Orders",
    embeds: [
      {
        title: "📥 New Order Created",
        color: 0x00b0f4,
        fields: [
          {
            name: "📄 File",
            value: order.filename,
            inline: false
          },
          {
            name: "👤 User Email",
            value: order.email,
            inline: false
          },
          {
            name: "🆔 Order ID",
            value: order._id.toString(),
            inline: false
          },
          {
            name: "🌐 Source",
            value: order.source || "website",
            inline: true
          },
          {
            name: "⏳ Status",
            value: order.status,
            inline: true
          }
        ],
        footer: {
          text: "PlagX Detector"
        },
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
