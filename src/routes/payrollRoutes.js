const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const {
  previewPayroll,
  createPayrollRun,
  listPayrollRuns,
  markPayrollPaid,
} = require("../controllers/payrollController");

const router = express.Router();

router.use(requireAuth, requireRole("OWNER", "MANAGER"));

router.post("/preview", asyncHandler(previewPayroll));
router.post("/runs", asyncHandler(createPayrollRun));
router.get("/runs", asyncHandler(listPayrollRuns));
router.patch("/runs/:id/pay", asyncHandler(markPayrollPaid));

module.exports = router;
