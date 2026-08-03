const express = require("express");
const rateLimit = require("express-rate-limit");
const { register, login, refresh } = require("../controllers/authController");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many login attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", asyncHandler(register));
router.post("/login", loginLimiter, asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));

module.exports = router;
