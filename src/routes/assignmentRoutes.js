const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { listAssignments, updateAssignment } = require("../controllers/assignmentController");

const router = express.Router();

router.use(requireAuth);

router.get("/", asyncHandler(listAssignments));
router.patch("/:id", asyncHandler(updateAssignment));

module.exports = router;
