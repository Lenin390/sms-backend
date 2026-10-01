const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
} = require("../controllers/authController");
const { asyncHandler } = require("../middleware/errorHandler");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many login attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many reset attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Too many attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", asyncHandler(register));
router.post("/login", loginLimiter, asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", asyncHandler(logout));
router.post("/forgot-password", resetLimiter, asyncHandler(forgotPassword));
router.post("/reset-password", resetLimiter, asyncHandler(resetPassword));
router.post("/change-password", requireAuth, changePasswordLimiter, asyncHandler(changePassword));

module.exports = router;
