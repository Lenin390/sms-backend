const { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } = require("../utils/authCookies");

const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function verifyRequestOrigin(req, res, next) {
  const origin = req.get("origin");
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ success: false, message: "Request origin is not allowed" });
  }

  const hasAuthCookie = [ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME].some((name) =>
    new RegExp(`(?:^|;\\s*)${name}=`).test(req.headers.cookie || "")
  );
  if (!safeMethods.has(req.method) && hasAuthCookie && !allowedOrigins.has(origin)) {
    return res.status(403).json({ success: false, message: "Request origin is not allowed" });
  }

  next();
}

module.exports = { verifyRequestOrigin };