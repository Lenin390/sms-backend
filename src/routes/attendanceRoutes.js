const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { checkIn, checkOut, markAttendance, listAttendance } = require("../controllers/attendanceController");

const router = express.Router();

router.use(requireAuth);

router.post("/checkin", asyncHandler(checkIn));
router.post("/checkout", asyncHandler(checkOut));
router.post("/mark", asyncHandler(markAttendance));
router.get("/", asyncHandler(listAttendance));

module.exports = router;
