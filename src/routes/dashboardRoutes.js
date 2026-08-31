const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { getSummary } = require("../controllers/dashboardController");

const router = express.Router();

router.use(requireAuth);

router.get("/summary", asyncHandler(getSummary));

module.exports = router;
