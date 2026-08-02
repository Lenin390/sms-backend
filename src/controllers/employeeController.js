const { z } = require("zod");
const prisma = require("../config/db");

const employeeSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
  designation: z.string().optional(),
  payType: z.enum(["HOURLY", "DAILY", "WEEKLY", "MONTHLY"]),
  payRate: z.number().positive("Pay rate must be greater than 0"),
  joiningDate: z.string().datetime().optional(),
});

async function createEmployee(req, res) {
  const parsed = employeeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const employee = await prisma.employee.create({
    data: { ...parsed.data, shopId: req.auth.shopId },
  });

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
    return res.status(404).json({ error: "Employee not found" });
  }

  res.json(employee);
}

async function updateEmployee(req, res) {
  const parsed = employeeSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  // findFirst first so we don't accidentally update an employee from another shop
  const existing = await prisma.employee.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Employee not found" });
  }

  const updated = await prisma.employee.update({
    where: { id: existing.id },
    data: parsed.data,
  });

  res.json(updated);
}

// Soft delete - we never want to lose attendance/payroll history
async function deactivateEmployee(req, res) {
  const existing = await prisma.employee.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
  });
  if (!existing) {
    return res.status(404).json({ error: "Employee not found" });
  }

  await prisma.employee.update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  res.json({ message: "Employee deactivated" });
}

const bcrypt = require("bcrypt");
const crypto = require("crypto");

const grantAccessSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["MANAGER", "STAFF"]).default("STAFF"),
  password: z.string().min(8).optional(), // if not given, we generate one
});

// Separate from createEmployee on purpose - most employees never need this.
async function grantLoginAccess(req, res) {
  const parsed = grantAccessSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }

  const employee = await prisma.employee.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
  });
  if (!employee) {
    return res.status(404).json({ error: "Employee not found" });
  }
  if (employee.linkedUserId) {
    return res.status(409).json({ error: "This employee already has login access" });
  }

  const { email, role } = parsed.data;
  const tempPassword = parsed.data.password || crypto.randomBytes(6).toString("hex");
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

  res.status(201).json({
    message: "Login access granted",
    user: { id: user.id, email: user.email, role: user.role },
    // only returned here, this one time - make sure the owner shares it securely
    temporaryPassword: parsed.data.password ? undefined : tempPassword,
  });
}

module.exports = {
  createEmployee,
  listEmployees,
  getEmployee,
  updateEmployee,
  deactivateEmployee,
  grantLoginAccess,
};
