const jwt = require("jsonwebtoken");

const ACCESS_COOKIE_NAME = "sms_access";
const REFRESH_COOKIE_NAME = "sms_refresh";
const ACCESS_COOKIE_PATH = "/";
const REFRESH_COOKIE_PATH = "/api/auth";

function readCookie(req, name) {
  const prefix = `${name}=`;
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return null;
  }
}

function cookieOptions(path, maxAge) {
  const configuredSameSite = (process.env.AUTH_COOKIE_SAME_SITE || "").toLowerCase();
  const sameSite = ["strict", "lax", "none"].includes(configuredSameSite)
    ? configuredSameSite
    : process.env.NODE_ENV === "production" ? "none" : "lax";
  const secure = process.env.NODE_ENV === "production" || sameSite === "none";
  const parts = [
    `Path=${path}`,
    `Max-Age=${Math.max(0, Math.floor(maxAge / 1000))}`,
    "HttpOnly",
    `SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function tokenMaxAge(token) {
  const decoded = jwt.decode(token);
  if (!decoded || typeof decoded.exp !== "number") return 0;
  return Math.max(0, decoded.exp * 1000 - Date.now());
}

function setAuthCookies(res, accessToken, refreshToken) {
  res.append(
    "Set-Cookie",
    `${ACCESS_COOKIE_NAME}=${encodeURIComponent(accessToken)}; ${cookieOptions(
      ACCESS_COOKIE_PATH,
      tokenMaxAge(accessToken)
    )}`
  );
  res.append(
    "Set-Cookie",
    `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}; ${cookieOptions(
      REFRESH_COOKIE_PATH,
      tokenMaxAge(refreshToken)
    )}`
  );
}

function clearAuthCookies(res) {
  res.append(
    "Set-Cookie",
    `${ACCESS_COOKIE_NAME}=; ${cookieOptions(ACCESS_COOKIE_PATH, 0)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
  res.append(
    "Set-Cookie",
    `${REFRESH_COOKIE_NAME}=; ${cookieOptions(REFRESH_COOKIE_PATH, 0)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
}

module.exports = {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  readCookie,
  setAuthCookies,
  clearAuthCookies,
};