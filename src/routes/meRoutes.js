const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { updateProfile } = require("../controllers/userController");

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  res.json({
    success: true,
    message: "You are authenticated",
    auth: req.auth,
  });
});

router.patch("/", requireAuth, asyncHandler(updateProfile));

module.exports = router;
