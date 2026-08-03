const { z } = require("zod");
const prisma = require("../config/db");
const { resolveEmployeeId } = require("../utils/employeeScope");
const { validateRequest } = require("../utils/validation");

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function checkIn(req, res) {
  const employeeId = await resolveEmployeeId(req.auth, req.body.employeeId);
  const today = startOfDay(new Date());

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: today } },
  });
  if (existing?.checkIn) {
    return res.status(409).json({ success: false, message: "Already checked in today" });
  }

  const record = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date: today } },
    create: { employeeId, date: today, checkIn: new Date(), status: "PRESENT" },
    update: { checkIn: new Date(), status: "PRESENT" },
  });

  res.status(201).json(record);
}

async function checkOut(req, res) {
  const employeeId = await resolveEmployeeId(req.auth, req.body.employeeId);
  const today = startOfDay(new Date());

  const record = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date: today } },
  });
  if (!record || !record.checkIn) {
    return res.status(400).json({ success: false, message: "You haven't checked in today" });
  }
  if (record.checkOut) {
    return res.status(409).json({ success: false, message: "Already checked out today" });
  }

  const checkOutTime = new Date();
  const hoursWorked = (checkOutTime - record.checkIn) / (1000 * 60 * 60);

  const updated = await prisma.attendance.update({
    where: { id: record.id },
    data: { checkOut: checkOutTime, hoursWorked: Math.round(hoursWorked * 100) / 100 },
  });

  res.json(updated);
}

const markSchema = z.object({
  employeeId: z.string().optional(),
  date: z.string().datetime().optional(),
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE"]),
  notes: z.string().optional(),
});

// For daily/weekly/monthly employees who don't clock in - also doubles as
// a correction tool for owners/managers.
async function markAttendance(req, res) {
  const data = validateRequest(req, res, markSchema);
  if (!data) return;

  const employeeId = await resolveEmployeeId(req.auth, data.employeeId);
  const date = startOfDay(data.date || new Date());

  const record = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    create: { employeeId, date, status: parsed.data.status, notes: parsed.data.notes },
    update: { status: parsed.data.status, notes: parsed.data.notes },
  });

  res.json(record);
}

async function listAttendance(req, res) {
  const { employeeId: requested, from, to } = req.query;

  let where;
  if (req.auth.role === "STAFF") {
    const employeeId = await resolveEmployeeId(req.auth, requested);
    where = { employeeId };
  } else if (requested) {
    where = { employeeId: requested };
  } else {
    where = { employee: { shopId: req.auth.shopId } };
  }

  const records = await prisma.attendance.findMany({
    where: {
      ...where,
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: startOfDay(from) } : {}),
              ...(to ? { lte: startOfDay(to) } : {}),
            },
          }
        : {}),
    },
    include: { employee: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  res.json(records);
}

module.exports = { checkIn, checkOut, markAttendance, listAttendance };
