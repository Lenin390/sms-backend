const { z } = require("zod");
const prisma = require("../config/db");
const { validateRequest } = require("../utils/validation");

const createSchema = z.object({
  employeeId: z.string(),
  task: z.string().min(2, "Task description is required"),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  task: z.string().min(2).optional(),
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE"]).optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

async function createAssignment(req, res) {
  const data = validateRequest(req, res, createSchema);
  if (!data) return;

  const order = await prisma.order.findFirst({
    where: { id: req.params.orderId, shopId: req.auth.shopId },
  });
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  const employee = await prisma.employee.findFirst({
    where: { id: data.employeeId, shopId: req.auth.shopId },
  });
  if (!employee) {
    return res.status(404).json({ success: false, message: "Employee not found" });
  }

  const assignment = await prisma.workAssignment.create({
    data: {
      orderId: order.id,
      employeeId: data.employeeId,
      task: data.task,
      dueDate: data.dueDate,
      notes: data.notes,
    },
  });

  res.status(201).json({ success: true, data: assignment });
}

async function listOrderAssignments(req, res) {
  const order = await prisma.order.findFirst({
    where: { id: req.params.orderId, shopId: req.auth.shopId },
  });
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  const assignments = await prisma.workAssignment.findMany({
    where: { orderId: order.id },
    include: { employee: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  res.json({ success: true, data: assignments });
}

async function listAssignments(req, res) {
  const { employeeId: requested, status, orderId } = req.query;

  let employeeFilter;

  if (req.auth.role === "STAFF") {
    const employee = await prisma.employee.findUnique({
      where: { linkedUserId: req.auth.id },
    });
    if (!employee) {
      return res.status(403).json({ success: false, message: "No employee record is linked to your account" });
    }
    employeeFilter = employee.id;
  } else if (requested) {
    employeeFilter = requested;
  }

  const assignments = await prisma.workAssignment.findMany({
    where: {
      order: { shopId: req.auth.shopId },
      ...(employeeFilter ? { employeeId: employeeFilter } : {}),
      ...(status ? { status } : {}),
      ...(orderId ? { orderId } : {}),
    },
    include: {
      employee: { select: { name: true } },
      order: { select: { clientName: true, deliveryDate: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ success: true, data: assignments });
}

async function updateAssignment(req, res) {
  const data = validateRequest(req, res, updateSchema);
  if (!data) return;

  const assignment = await prisma.workAssignment.findFirst({
    where: { id: req.params.id, order: { shopId: req.auth.shopId } },
    include: { employee: true },
  });
  if (!assignment) {
    return res.status(404).json({ success: false, message: "Assignment not found" });
  }

  if (req.auth.role === "STAFF") {
    if (assignment.employee.linkedUserId !== req.auth.id) {
      return res.status(403).json({ success: false, message: "You can only update your own assignments" });
    }
    const attemptingMoreThanStatus = Object.keys(data).some((key) => key !== "status");
    if (attemptingMoreThanStatus) {
      return res.status(403).json({ success: false, message: "You can only update the status of your assignment" });
    }
  }

  const updated = await prisma.workAssignment.update({
    where: { id: assignment.id },
    data,
  });

  res.json(updated);
}

module.exports = { createAssignment, listOrderAssignments, listAssignments, updateAssignment };
