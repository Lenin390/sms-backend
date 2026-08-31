const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { updateProfile } = require("../controllers/userController");
const prisma = require("../config/db");

const router = express.Router();

router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth.id },
    include: { shop: { select: { id: true, name: true } } },
  });

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  res.json({
    success: true,
    message: "You are authenticated",
    auth: {
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
      shop: { id: user.shopId, name: user.shop?.name ?? null },
    },
  });
}));

router.patch("/", requireAuth, asyncHandler(updateProfile));

module.exports = router;
