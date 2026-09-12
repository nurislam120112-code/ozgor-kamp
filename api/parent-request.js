export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { childName, parentPhone } = req.body;

    if (!childName || !parentPhone) {
      return res.status(400).json({
        error: "Баланын аты жана телефон номери керек",
      });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return res.status(500).json({
        error: "Telegram настройкасы табылган жок",
      });
    }

    const text =
      `Жаңы ата-эне суроо жөнөттү\n\n` +
      `Бала: ${childName}\n` +
      `Телефон: ${parentPhone}\n` +
      `Статус: Күтүүдө`;

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramData.ok) {
      return res.status(500).json({
        error: "Telegram'га жөнөтүлгөн жок",
      });
    }

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Серверде ката кетти",
    });
  }
}
