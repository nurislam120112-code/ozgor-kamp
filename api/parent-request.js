function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID
    } = process.env;

    const childName = String(req.body?.childName || "").trim();
    const parentPhone = String(req.body?.parentPhone || "").trim();

    if (!childName || !parentPhone) {
      return res.status(400).json({
        success: false,
        error: "Баланын аты-жөнү жана телефон номери керек"
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        success: false,
        error: "Supabase настройкасы табылган жок"
      });
    }

    const normalizedPhone = normalizePhone(parentPhone);

    if (normalizedPhone.length < 9) {
      return res.status(400).json({
        success: false,
        error: "Телефон номери туура эмес"
      });
    }

    const supabaseResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/parent_requests`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify({
          child_name: childName,
          parent_phone: parentPhone,
          status: "pending"
        })
      }
    );

    if (!supabaseResponse.ok) {
      const errorText = await supabaseResponse.text();
      console.error("Supabase error:", errorText);

      return res.status(500).json({
        success: false,
        error: "Supabase'ка сакталган жок"
      });
    }

    const savedRows = await supabaseResponse.json();
    const savedRequest = savedRows[0];

    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const text =
        `Жаңы ата-эне суроо жөнөттү\n\n` +
        `Бала: ${childName}\n` +
        `Телефон: ${parentPhone}\n` +
        `Статус: Күтүүдө\n` +
        `ID: ${savedRequest?.id || "-"}`;

      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text
          })
        }
      );

      if (!telegramResponse.ok) {
        const telegramError = await telegramResponse.text();
        console.error("Telegram error:", telegramError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Суроо ийгиликтүү жөнөтүлдү"
    });

  } catch (error) {
    console.error("Parent request error:", error);

    return res.status(500).json({
      success: false,
      error: "Серверде ката кетти"
    });
  }
};
