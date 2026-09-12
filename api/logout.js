module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Метод колдоого алынбайт"
    });
  }

  res.setHeader(
    "Set-Cookie",
    "ozgor_parent_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"
  );

  return res.status(200).json({
    success: true
  });
};
