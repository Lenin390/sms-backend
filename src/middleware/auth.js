const { verifyAccessToken } = require("../utils/token");
const { ACCESS_COOKIE_NAME, readCookie } = require("../utils/authCookies");

// Require a valid JWT for this route
function requireAuth(req, res, next) {
  const token = readCookie(req, ACCESS_COOKIE_NAME);
  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.auth = decoded;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired" });
    }
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
}

// Restrict route access to specific roles
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    if (!allowedRoles.includes(req.auth.role)) {
      return res.status(403).json({ success: false, message: "Insufficient permissions" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
