const express = require("express");
const { requireAuth, requireRole } = require("../middleware/auth");
const { asyncHandler } = require("../middleware/errorHandler");
const { createOrder, listOrders, getOrder, updateOrder } = require("../controllers/orderController");
const { createAssignment, listOrderAssignments } = require("../controllers/assignmentController");

const router = express.Router();

router.use(requireAuth, requireRole("OWNER", "MANAGER"));

router.post("/", asyncHandler(createOrder));
router.get("/", asyncHandler(listOrders));
router.get("/:id", asyncHandler(getOrder));
router.patch("/:id", asyncHandler(updateOrder));
router.post("/:orderId/assignments", asyncHandler(createAssignment));
router.get("/:orderId/assignments", asyncHandler(listOrderAssignments));

module.exports = router;
