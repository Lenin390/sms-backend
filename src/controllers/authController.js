const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { z } = require("zod");
const prisma = require("../config/db");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../utils/token");
const { withRetry, cleanupRegistrationArtifacts } = require("../utils/dbRetry");
const { validateRequest } = require("../utils/validation");
const { sendResetEmail } = require("../utils/email");
const {
  REFRESH_COOKIE_NAME,
  readCookie,
  setAuthCookies,
  clearAuthCookies,
} = require("../utils/authCookies");

const SALT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY_MINUTES = 30;

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(7, "Invalid phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  shopName: z.string().min(2, "Shop name is required"),
  shopAddress: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

// Register an owner and their shop together
async function register(req, res) {
  const data = validateRequest(req, res, registerSchema);
  if (!data) return;
  const { name, email, phone, password, shopName, shopAddress } = data;

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let user;
  let shop;

  try {
    const newUser = await withRetry(() =>
      prisma.user.create({
        data: { name, email, phone, passwordHash, role: "OWNER" },
      })
    );

    const newShop = await withRetry(() =>
      prisma.shop.create({
        data: {
          ownerId: newUser.id,
          name: shopName,
          address: shopAddress || null,
        },
      })
    );

    user = await withRetry(() =>
      prisma.user.update({
        where: { id: newUser.id },
        data: { shopId: newShop.id },
      })
    );
    shop = newShop;
  } catch (error) {
    await cleanupRegistrationArtifacts(prisma, {
      userId: user?.id,
      shopId: shop?.id,
    });
    throw error;
  }

  await issueAuthCookies(res, { ...user, shopId: shop.id });

  res.status(201).json({
    success: true,
    message: "Registered successfully",
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    shop: { id: shop.id, name: shop.name },
  });
}

// Login handles all roles the same way. rememberMe controls how long the
// refresh token stays valid - unchecked, it expires quickly (short session);
// checked, it lasts much longer so the person doesn't have to log in every day.
async function login(req, res) {
  const data = validateRequest(req, res, loginSchema);
  if (!data) return;
  const { email, password, rememberMe } = data;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { shop: { select: { id: true, name: true } } },
  });

  // never expose whether the user exists
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  const refreshExpiry = rememberMe
    ? process.env.JWT_REFRESH_EXPIRY_REMEMBER || "30d"
    : process.env.JWT_REFRESH_EXPIRY_SESSION || "1d";
  await issueAuthCookies(res, user, refreshExpiry, rememberMe);

  res.json({
    success: true,
    message: "Logged in successfully",
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    shop: { id: user.shopId, name: user.shop?.name ?? null },
  });
}

// Refresh access token
async function refresh(req, res) {
  const refreshToken = readCookie(req, REFRESH_COOKIE_NAME);
  if (!refreshToken) {
    clearAuthCookies(res);
    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    clearAuthCookies(res);
    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  }

  const existingSession = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    include: { user: { include: { shop: { select: { id: true, name: true } } } } },
  });
  const user = existingSession?.user;

  if (
    !existingSession || existingSession.revokedAt ||
    existingSession.expiresAt <= new Date() || !user?.isActive
  ) {
    clearAuthCookies(res);
    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  }

  const refreshExpiry = decoded.rememberMe === true
    ? process.env.JWT_REFRESH_EXPIRY_REMEMBER || "30d"
    : decoded.rememberMe === false
      ? process.env.JWT_REFRESH_EXPIRY_SESSION || "1d"
      : undefined;
  const tokenPayload = { id: user.id, shopId: user.shopId, role: user.role };
  const nextRefreshPayload = decoded.rememberMe === undefined
    ? tokenPayload
    : { ...tokenPayload, rememberMe: decoded.rememberMe };
  const nextRefreshToken = signRefreshToken(nextRefreshPayload, refreshExpiry);
  const nextDecoded = verifyRefreshToken(nextRefreshToken);
  const rotationSucceeded = await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({
      where: { id: existingSession.id, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) return false;
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(nextRefreshToken),
        expiresAt: new Date(nextDecoded.exp * 1000),
      },
    });
    return true;
  });
  if (!rotationSucceeded) {
    clearAuthCookies(res);
    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  }

  setAuthCookies(res, signAccessToken(tokenPayload), nextRefreshToken);
  return res.json({
    success: true,
    message: "Token refreshed successfully",
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    shop: { id: user.shopId, name: user.shop?.name ?? null },
  });
}

async function logout(req, res) {
  const refreshToken = readCookie(req, REFRESH_COOKIE_NAME);
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  clearAuthCookies(res);
  return res.json({ success: true, message: "Logged out successfully" });
}

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function issueAuthCookies(res, user, refreshExpiry, rememberMe) {
  const tokenPayload = { id: user.id, shopId: user.shopId, role: user.role };
  const accessToken = signAccessToken(tokenPayload);
  const refreshPayload = rememberMe === undefined ? tokenPayload : { ...tokenPayload, rememberMe };
  const refreshToken = signRefreshToken(refreshPayload, refreshExpiry);
  const decodedRefreshToken = verifyRefreshToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(decodedRefreshToken.exp * 1000),
    },
  });
  setAuthCookies(res, accessToken, refreshToken);
}

async function forgotPassword(req, res) {
  const data = validateRequest(req, res, forgotPasswordSchema);
  if (!data) return;

  const genericResponse = {
    success: true,
    message: "If an account exists for that email, a reset link has been sent.",
  };

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user || !user.isActive) {
    return res.json(genericResponse);
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${rawToken}`;

  try {
    await sendResetEmail(user.email, resetLink);
  } catch (err) {
    console.error("Failed to send reset email:", err.message);
  }

  res.json(genericResponse);
}

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

async function resetPassword(req, res) {
  const data = validateRequest(req, res, resetPasswordSchema);
  if (!data) return;

  const tokenHash = hashToken(data.token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ success: false, message: "This reset link is invalid or has expired" });
  }

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  const resetSucceeded = await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count !== 1) return false;
    await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
    await tx.refreshToken.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return true;
  });
  if (!resetSucceeded) {
    return res.status(400).json({ success: false, message: "This reset link is invalid or has expired" });
  }

  res.json({ success: true, message: "Password reset successfully. You can now log in." });
}

// Authenticated change-password - different from the forgot/reset flow above,
// this is for a logged-in user who knows their current password and wants
// to change it from Settings.
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

async function changePassword(req, res) {
  const data = validateRequest(req, res, changePasswordSchema);
  if (!data) return;

  const user = await prisma.user.findUnique({ where: { id: req.auth.id } });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const isMatch = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Current password is incorrect" });
  }

  const passwordHash = await bcrypt.hash(data.newPassword, SALT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  clearAuthCookies(res);

  res.json({ success: true, message: "Password changed successfully" });
}

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword, changePassword };
