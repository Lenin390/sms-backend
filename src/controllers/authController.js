const bcrypt = require("bcrypt");
const { z } = require("zod");
const prisma = require("../config/db");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../utils/token");
const { withRetry, cleanupRegistrationArtifacts } = require("../utils/dbRetry");
const { validateRequest } = require("../utils/validation");

const SALT_ROUNDS = 12;

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

  const tokenPayload = { id: user.id, shopId: shop.id, role: user.role };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  res.status(201).json({
    success: true,
    message: "Registered successfully",
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    shop: { id: shop.id, name: shop.name },
    accessToken,
    refreshToken,
  });
}

// Login handles all roles the same way
async function login(req, res) {
  const data = validateRequest(req, res, loginSchema);
  if (!data) return;
  const { email, password } = data;

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

  const tokenPayload = { id: user.id, shopId: user.shopId, role: user.role };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  res.json({
    success: true,
    message: "Logged in successfully",
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    shop: { id: user.shopId, name: user.shop?.name ?? null },
    accessToken,
    refreshToken,
  });
}

// Refresh access token
async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ success: false, message: "Refresh token required" });
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { shop: { select: { id: true, name: true } } },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
    }

    const tokenPayload = { id: user.id, shopId: user.shopId, role: user.role };
    const accessToken = signAccessToken(tokenPayload);
    const refreshAccessToken = signRefreshToken(tokenPayload);

    res.json({
      success: true,
      message: "Token refreshed successfully",
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      shop: { id: user.shopId, name: user.shop?.name ?? null },
      accessToken,
      refreshToken: refreshAccessToken,
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
  }
}

module.exports = { register, login, refresh };
