const jwt = require("jsonwebtoken");

function signAccessToken(payload) {
  return jwt.sign({ ...payload, tokenType: "access" }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || "15m",
    algorithm: "HS256",
  });
}

function signRefreshToken(payload, expiresInOverride) {
  return jwt.sign({ ...payload, tokenType: "refresh" }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: expiresInOverride || process.env.JWT_REFRESH_EXPIRY || "7d",
    algorithm: "HS256",
  });
}

function verifyAccessToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
  if (decoded.tokenType !== "access") throw new jwt.JsonWebTokenError("Invalid token type");
  return decoded;
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
  if (decoded.tokenType !== "refresh") throw new jwt.JsonWebTokenError("Invalid token type");
  return decoded;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
