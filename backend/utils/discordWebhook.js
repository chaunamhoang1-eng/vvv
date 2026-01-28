import axios from "axios";

const WEBHOOK_URLS = [
  process.env.DISCORD_WEBHOOK_URL,
  process.env.DISCORD_WEBHOOK_URL_2 // optional second webhook
].filter(Boolean); // removes undefined values

// Mask Email Function
const maskEmail = (email) => {
  if (!email) return "N/A";

  const [user, domain] = email.split("@");
  const maskedUser = user.slice(0, 3) + "***";

  const [domainName, domainExt] = domain.split(".");
  const maskedDomain = domainName[0] + "***." + domainExt;

  return `${maskedUser}@${maskedDomain}`;
};

export async function sendOrderToDiscord(order) {
  if (WEBHOOK_URLS.length === 0) {
    console.error("❌ No Discord webhook URLs found");
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
          { name: "👤 Email", value: maskEmail(order.email) },
          { name: "🆔 Order ID", value: order._id.toString() },
          { name: "🌐 Source", value: order.source || "website", inline: true },
          { name: "⏳ Status", value: order.status, inline: true }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    // Send to all webhooks (1 or 2)
    await Promise.all(
      WEBHOOK_URLS.map((url) => axios.post(url, payload))
    );
  } catch (err) {
    console.error("❌ Discord webhook failed:", err.message);
  }
}
