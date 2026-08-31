const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const {
  createEmployee,
  listEmployees,
  getEmployee,
  getEmployeeSummary,
  updateEmployee,
  deactivateEmployee,
  grantLoginAccess,
} = require("../controllers/employeeController");

const router = express.Router();

router.use(requireAuth, requireRole("OWNER", "MANAGER"));

router.post("/", asyncHandler(createEmployee));
router.get("/", asyncHandler(listEmployees));
router.get("/:id", asyncHandler(getEmployee));
router.get("/:id/summary", asyncHandler(getEmployeeSummary));
router.patch("/:id", asyncHandler(updateEmployee));
router.delete("/:id", asyncHandler(deactivateEmployee));
router.post("/:id/grant-access", asyncHandler(grantLoginAccess));

module.exports = router;
