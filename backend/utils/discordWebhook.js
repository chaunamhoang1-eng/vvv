import axios from "axios";

const WEBHOOK_URLS = [
  process.env.DISCORD_WEBHOOK_URL,
  process.env.DISCORD_WEBHOOK_URL_2
].filter(Boolean);

const maskEmail = (email) => {
  if (!email) return "N/A";
  const [user, domain] = email.split("@");
  const maskedUser = user.slice(0, 3) + "***";
  const [domainName, domainExt] = domain.split(".");
  const maskedDomain = domainName[0] + "***." + domainExt;
  return `${maskedUser}@${maskedDomain}`;
};

const createEmbed = (order) => ({
 
  embeds: [
    {
      title: "📄 Order Status",
      color: order.status === "completed" ? 0x00ff00 : 0x00b0f4,
      fields: [
        { name: "📦 File", value: order.filename },
        { name: "👤 Email", value: maskEmail(order.email) },
        { name: "🆔 Order ID", value: order._id.toString() },
        { name: "🌐 Source", value: order.source || "website", inline: true },
        { name: "⏳ Status", value: order.status, inline: true },
        ...(order.status === "completed"
          ? [
              {
                name: "🧑 Completed By",
                value: order.completedBy || "system",
                inline: true
              }
            ]
          : [])
      ],
      timestamp: new Date().toISOString()
    }
  ]
});

export async function sendOrderToDiscord(order) {
  if (WEBHOOK_URLS.length === 0) {
    console.error("❌ No Discord webhook URLs found");
    return null;
  }

  const payload = createEmbed(order);

  try {
    const results = await Promise.all(
      WEBHOOK_URLS.map(async (url) => {
        // FIXED: must use wait=true to get messageId
        const res = await axios.post(url + "?wait=true", payload);

        console.log("📨 Discord response:", res.data);

        return { url, messageId: res.data.id };
      })
    );

    return results;

  } catch (err) {
    console.error("❌ Discord webhook failed:", err.response?.data || err.message);
    return null;
  }
}

export async function updateDiscordOrder(order, discordMessages) {
  if (!discordMessages || discordMessages.length === 0) {
    console.log("⚠ No stored Discord message ids for update.");
    return;
  }

  const payload = createEmbed(order);

  try {
    await Promise.all(
      discordMessages.map(({ url, messageId }) => {
        const editURL = `${url}/messages/${messageId}`;
        return axios.patch(editURL, payload);
      })
    );

    console.log("✅ Discord messages updated for:", order._id);

  } catch (err) {
    console.error("❌ Failed updating Discord embed:", err.response?.data || err.message);
  }
}
