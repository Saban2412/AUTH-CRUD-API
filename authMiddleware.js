const supabase = require("./supabaseClient.js");

async function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  try {
    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ") ||
      authHeader.slice(7) === ""
    ) {
      return res.status(401).json({ error: "Access token required." });
    }
    const token = authHeader.slice(7);
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      console.error("Supabase token verification error: ", error.message);
      return res.status(401).json({ error: "Invalid or expired token." });
    }
    req.user = data.user;
    next();
  } catch (error) {
    console.error("Error while fetching: ", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
}

module.exports = requireAuth;
