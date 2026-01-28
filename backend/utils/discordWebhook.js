import axios from "axios";

const WEBHOOK_URLS = [
  process.env.DISCORD_WEBHOOK_URL,
  process.env.DISCORD_WEBHOOK_URL_2
].filter(Boolean);

/* -----------------------------------
   MASK EMAIL FOR PRIVACY
----------------------------------- */
const maskEmail = (email) => {
  if (!email) return "N/A";

  const [user, domain] = email.split("@");
  const maskedUser = user.slice(0, 3) + "***";

  const [domainName, domainExt] = domain.split(".");
  const maskedDomain = domainName[0] + "***." + domainExt;

  return `${maskedUser}@${maskedDomain}`;
};

/* -----------------------------------
   CREATE EMBED PAYLOAD
----------------------------------- */
const createEmbed = (order) => ({
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
});

/* -----------------------------------
   1️⃣ SEND NEW ORDER MESSAGE
   RETURNS OBJECT of message IDs
----------------------------------- */
export async function sendOrderToDiscord(order) {
  if (WEBHOOK_URLS.length === 0) {
    console.error("❌ No Discord webhook URLs found");
    return null;
  }

  const payload = createEmbed(order);

  try {
    const results = await Promise.all(
      WEBHOOK_URLS.map(async (url) => {
        const res = await axios.post(url + "?wait=true", payload);
        return { url, messageId: res.data.id };
      })
    );

    // return array: [ { url, messageId }, ... ]
    return results;

  } catch (err) {
    console.error("❌ Discord webhook failed:", err.message);
    return null;
  }
}

/* -----------------------------------
   2️⃣ UPDATE EXISTING MESSAGE
----------------------------------- */
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
    console.error("❌ Failed updating Discord embed:", err.message);
  }
}
