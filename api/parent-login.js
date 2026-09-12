const crypto = require("crypto");

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createSession(parentId, secret) {
  const payload = {
    parentId,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  };

  const encodedPayload = base64url(JSON.stringify(payload));

  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedPayload}.${signature}`;
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
      PARENT_SESSION_SECRET
    } = process.env;

    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY ||
      !PARENT_SESSION_SECRET
    ) {
      return res.status(500).json({
        success: false,
        error: "Сервер толук жөндөлө элек"
      });
    }

    const phone = normalizePhone(req.body?.phone);
    const loginCode = String(req.body?.loginCode || "").trim();

    if (!phone || !loginCode) {
      return res.status(400).json({
        success: false,
        error: "Телефон жана кирүү коду керек"
      });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/parent_requests?select=id,parent_phone,status,login_code`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Supabase error:", text);

      return res.status(500).json({
        success: false,
        error: "Маалыматты текшерүүдө ката кетти"
      });
    }

    const parents = await response.json();

    const parent = parents.find((item) => {
      return (
        normalizePhone(item.parent_phone) === phone &&
        String(item.login_code || "").trim() === loginCode &&
        item.status === "approved"
      );
    });

    if (!parent) {
      return res.status(401).json({
        success: false,
        error: "Телефон же код туура эмес, же уруксат бериле элек"
      });
    }

    const sessionToken = createSession(
      parent.id,
      PARENT_SESSION_SECRET
    );

    res.setHeader(
      "Set-Cookie",
      `ozgor_parent_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`
    );

    return res.status(200).json({
      success: true,
      accessToken: "session-created"
    });

  } catch (error) {
    console.error("Parent login error:", error);

    return res.status(500).json({
      success: false,
      error: "Серверде ката кетти"
    });
  }
};
