const { z } = require("zod");
const prisma = require("../config/db");
const { validateRequest } = require("../utils/validation");
const { logActivity } = require("../utils/activityLog");

const employeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  designation: z.string().optional(),
  payType: z.enum(["HOURLY", "DAILY", "WEEKLY", "MONTHLY", "PIECE_RATE"]),
  payRate: z.number().positive("Pay rate must be greater than 0"),
  joiningDate: z.string().datetime().optional(),
});

function denyManagerSelfManagement(req, res, employee) {
  if (req.auth.role === "MANAGER" && employee.linkedUserId === req.auth.id) {
    res.status(403).json({ success: false, message: "You can't manage your own employee record" });
    return true;
  }
  return false;
}

async function createEmployee(req, res) {
  const data = validateRequest(req, res, employeeSchema);
  if (!data) return;

  const employee = await prisma.employee.create({
    data: { ...data, shopId: req.auth.shopId },
  });

  logActivity(req.auth.shopId, "EMPLOYEE_ADDED", `New employee ${employee.name} added`);

  res.status(201).json(employee);
}

async function listEmployees(req, res) {
  const { active } = req.query;

  const employees = await prisma.employee.findMany({
    where: {
      shopId: req.auth.shopId,
      ...(active !== undefined ? { isActive: active === "true" } : {}),
    },
    orderBy: { name: "asc" },
  });

  res.json(employees);
}

async function getEmployee(req, res) {
  const employee = await prisma.employee.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
  });

  if (!employee) {
    return res.status(404).json({ success: false, message: "Employee not found" });
  }

  res.json(employee);
}

async function getEmployeeSummary(req, res) {
  const employee = await prisma.employee.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
  });
  if (!employee) {
    return res.status(404).json({ success: false, message: "Employee not found" });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const [attendanceLast30Days, recentPayrollRuns, currentAssignments] = await Promise.all([
    prisma.attendance.findMany({
      where: { employeeId: employee.id, date: { gte: thirtyDaysAgo } },
      orderBy: { date: "desc" },
    }),
    prisma.payrollRun.findMany({
      where: { employeeId: employee.id },
      orderBy: { periodStart: "desc" },
      take: 5,
    }),
    prisma.workAssignment.count({
      where: { employeeId: employee.id, status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
  ]);

  const attendanceSummary = {
    present: attendanceLast30Days.filter((a) => a.status === "PRESENT").length,
    absent: attendanceLast30Days.filter((a) => a.status === "ABSENT").length,
    halfDay: attendanceLast30Days.filter((a) => a.status === "HALF_DAY").length,
    onLeave: attendanceLast30Days.filter((a) => a.status === "ON_LEAVE").length,
    totalHours: attendanceLast30Days.reduce((sum, a) => sum + (a.hoursWorked || 0), 0),
  };

  res.json({
    success: true,
    data: {
      employee,
      attendanceSummary,
      recentAttendance: attendanceLast30Days.slice(0, 10),
      recentPayrollRuns,
      activeAssignmentsCount: currentAssignments,
    },
  });
}

async function updateEmployee(req, res) {
  const data = validateRequest(req, res, employeeSchema.partial());
  if (!data) return;

  // findFirst first so we don't accidentally update an employee from another shop
  const existing = await prisma.employee.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
  });
  if (!existing) {
    return res.status(404).json({ success: false, message: "Employee not found" });
  }
  if (denyManagerSelfManagement(req, res, existing)) return;

  const updated = await prisma.employee.update({
    where: { id: existing.id },
    data,
  });

  res.json(updated);
}

// Soft delete - we never want to lose attendance/payroll history
async function deactivateEmployee(req, res) {
  const existing = await prisma.employee.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
  });
  if (!existing) {
    return res.status(404).json({ success: false, message: "Employee not found" });
  }
  if (denyManagerSelfManagement(req, res, existing)) return;

  await prisma.employee.update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  res.json({ success: true, message: "Employee deactivated" });
}

async function reactivateEmployee(req, res) {
  const existing = await prisma.employee.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
  });
  if (!existing) {
    return res.status(404).json({ success: false, message: "Employee not found" });
  }
  if (denyManagerSelfManagement(req, res, existing)) return;

  await prisma.employee.update({
    where: { id: existing.id },
    data: { isActive: true },
  });

  res.status(200).json({ success: true, message: "Employee reactivated" });
}

const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { sendAccessGrantedEmail } = require("../utils/email");

const grantAccessSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["MANAGER", "STAFF"]).default("STAFF"),
  password: z.string().min(8).optional(), // if not given, we generate one
});

async function grantLoginAccess(req, res) {
  const data = validateRequest(req, res, grantAccessSchema);
  if (!data) return;

  const employee = await prisma.employee.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
  });
  if (!employee) {
    return res.status(404).json({ success: false, message: "Employee not found" });
  }
  if (denyManagerSelfManagement(req, res, employee)) return;
  if (!employee.isActive) {
    return res.status(409).json({ success: false, message: "Reactivate this employee before granting login access" });
  }
  if (employee.linkedUserId) {
    return res.status(409).json({ success: false, message: "This employee already has login access" });
  }

  const { email, role } = data;
  const tempPassword = data.password || crypto.randomBytes(6).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      name: employee.name,
      email,
      phone: employee.phone,
      passwordHash,
      role,
      shopId: req.auth.shopId,
    },
  });

  await prisma.employee.update({
    where: { id: employee.id },
    data: { linkedUserId: user.id },
  });

  const loginUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/login`;
  sendAccessGrantedEmail(email, data.password ? undefined : tempPassword, loginUrl).catch((err) =>
    console.error("Failed to send access-granted email:", err.message)
  );

  res.status(201).json({
    success: true,
    message: "Login access granted",
    user: { id: user.id, email: user.email, role: user.role },
    temporaryPassword: data.password ? undefined : tempPassword,
  });
}

module.exports = {
  createEmployee,
  listEmployees,
  getEmployee,
  getEmployeeSummary,
  updateEmployee,
  deactivateEmployee,
  reactivateEmployee,
  grantLoginAccess,
};
