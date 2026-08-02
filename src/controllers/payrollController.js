const { z } = require("zod");
const prisma = require("../config/db");
const { calculatePay } = require("../utils/payroll");

const periodSchema = z.object({
  employeeId: z.string(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

async function getEmployeeAndAttendance(shopId, employeeId, periodStart, periodEnd) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, shopId },
  });
  if (!employee) {
    const err = new Error("Employee not found");
    err.status = 404;
    throw err;
  }

  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: { gte: new Date(periodStart), lte: new Date(periodEnd) },
    },
  });

  return { employee, attendanceRecords };
}

// Calculates pay without saving anything - lets the owner sanity check numbers first
async function previewPayroll(req, res) {
  const parsed = periodSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { employeeId, periodStart, periodEnd } = parsed.data;

  const { employee, attendanceRecords } = await getEmployeeAndAttendance(
    req.auth.shopId,
    employeeId,
    periodStart,
    periodEnd
  );

  const breakdown = calculatePay(employee, attendanceRecords);
  res.json({ employee: { id: employee.id, name: employee.name, payType: employee.payType }, ...breakdown });
}

// Actually saves the payroll run
async function createPayrollRun(req, res) {
  const parsed = periodSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { employeeId, periodStart, periodEnd } = parsed.data;

  const { employee, attendanceRecords } = await getEmployeeAndAttendance(
    req.auth.shopId,
    employeeId,
    periodStart,
    periodEnd
  );

  const breakdown = calculatePay(employee, attendanceRecords);

  const run = await prisma.payrollRun.create({
    data: {
      employeeId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      ...breakdown,
    },
  });

  res.status(201).json(run);
}

async function listPayrollRuns(req, res) {
  const { employeeId, status } = req.query;

  const runs = await prisma.payrollRun.findMany({
    where: {
      employee: { shopId: req.auth.shopId },
      ...(employeeId ? { employeeId } : {}),
      ...(status ? { status } : {}),
    },
    include: { employee: { select: { name: true, payType: true } } },
    orderBy: { periodStart: "desc" },
  });

  res.json(runs);
}

async function markPayrollPaid(req, res) {
  const run = await prisma.payrollRun.findFirst({
    where: { id: req.params.id, employee: { shopId: req.auth.shopId } },
  });
  if (!run) {
    return res.status(404).json({ error: "Payroll run not found" });
  }

  const updated = await prisma.payrollRun.update({
    where: { id: run.id },
    data: { status: "PAID", paidOn: new Date() },
  });

  res.json(updated);
}

module.exports = { previewPayroll, createPayrollRun, listPayrollRuns, markPayrollPaid };
