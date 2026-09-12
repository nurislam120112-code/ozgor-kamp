const crypto = require("crypto");

function getCookie(req, name) {
  const cookies = req.headers.cookie || "";

  const parts = cookies.split(";");

  for (const part of parts) {
    const [key, ...valueParts] = part.trim().split("=");

    if (key === name) {
      return valueParts.join("=");
    }
  }

  return null;
}

function base64urlSignature(value) {
  return value
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function verifySession(token, secret) {
  try {
    if (!token || !secret) {
      return null;
    }

    const parts = token.split(".");

    if (parts.length !== 2) {
      return null;
    }

    const encodedPayload = parts[0];
    const receivedSignature = parts[1];

    const expectedSignature = base64urlSignature(
      crypto
        .createHmac("sha256", secret)
        .update(encodedPayload)
        .digest("base64")
    );

    const receivedBuffer = Buffer.from(receivedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (receivedBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        receivedBuffer,
        expectedBuffer
      )
    ) {
      return null;
    }

    let base64 = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    while (base64.length % 4) {
      base64 += "=";
    }

    const payload = JSON.parse(
      Buffer.from(base64, "base64").toString("utf8")
    );

    if (!payload.parentId || !payload.exp) {
      return null;
    }

    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;

  } catch (error) {
    console.error("Session verification error:", error);
    return null;
  }
}

module.exports = async function handler(req, res) {

  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Метод колдоого алынбайт"
    });
  }

  try {

    const {
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
      PARENT_SESSION_SECRET
    } = process.env;


    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY ||
      !PARENT_SESSION_SECRET
    ) {
      return res.status(500).json({
        error: "Сервер толук жөндөлө элек"
      });
    }


    const sessionToken = getCookie(
      req,
      "ozgor_parent_session"
    );


    const session = verifySession(
      sessionToken,
      PARENT_SESSION_SECRET
    );


    if (!session) {
      return res.status(401).json({
        error: "Кирүүгө уруксат жок"
      });
    }


    const parentResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/parent_requests?id=eq.${encodeURIComponent(session.parentId)}&status=eq.approved&select=id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization:
            `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );


    if (!parentResponse.ok) {
      return res.status(500).json({
        error: "Уруксатты текшерүүдө ката кетти"
      });
    }


    const parents = await parentResponse.json();


    if (!parents.length) {
      return res.status(401).json({
        error: "Кирүүгө уруксат жок"
      });
    }


    const updatesResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/daily_updates?select=id,title,content,created_at&order=created_at.desc`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization:
            `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );


    if (!updatesResponse.ok) {
      const text = await updatesResponse.text();

      console.error("Supabase updates error:", text);

      return res.status(500).json({
        error: "Маалыматтарды алуу мүмкүн болгон жок"
      });
    }


    const updates = await updatesResponse.json();


    return res.status(200).json({
      success: true,
      updates: updates
    });


  } catch (error) {

    console.error("Daily updates error:", error);

    return res.status(500).json({
      error: "Серверде ката кетти"
    });

  }
};
