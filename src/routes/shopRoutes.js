const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { getShop, updateShop } = require("../controllers/shopController");

const router = express.Router();

router.use(requireAuth);

router.get("/", asyncHandler(getShop));
router.patch("/", asyncHandler(updateShop));

module.exports = router;
