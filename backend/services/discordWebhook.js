export async function sendApiOrderDiscordNotification(order) {
  const webhookURL = process.env.DISCORD_WEBHOOK_URL_2;

  if (!webhookURL) {
    console.log("ℹ️ DISCORD_WEBHOOK_URL_2 is not configured");
    return;
  }

  const payload = {
    embeds: [
      {
        title: "🔔 New PlagX API Order",

        fields: [
          {
            name: "Order ID",
            value: String(order._id),
            inline: false
          },
          {
            name: "File",
            value: order.filename || "Unknown",
            inline: false
          },
          {
            name: "Status",
            value: order.status || "pending",
            inline: true
          }
        ],

        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    const response = await fetch(webhookURL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "❌ DISCORD WEBHOOK ERROR:",
        response.status,
        errorText
      );

      return;
    }

    console.log(
      "✅ DISCORD API ORDER NOTIFICATION SENT:",
      order._id.toString()
    );

  } catch (err) {
    console.error(
      "❌ DISCORD WEBHOOK FAILED:",
      err.message
    );
  }
}
