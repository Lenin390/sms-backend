const prisma = require("../config/db");

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function getSummary(req, res) {
  const shopId = req.auth.shopId;
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  const sevenDaysAgo = startOfDay(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000));

  const [
    totalEmployees,
    activeOrders,
    ordersDueToday,
    ordersLast7Days,
    orderStatusGroups,
    todaysOrders,
    todaysAttendance,
    recentActivity,
    paymentTotals,
  ] = await Promise.all([
    prisma.employee.count({ where: { shopId, isActive: true } }),

    prisma.order.count({
      where: { shopId, status: { in: ["PENDING", "IN_PROGRESS", "READY"] } },
    }),

    prisma.order.count({
      where: { shopId, deliveryDate: { gte: todayStart, lte: todayEnd } },
    }),

    prisma.order.findMany({
      where: { shopId, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),

    prisma.order.groupBy({
      by: ["status"],
      where: { shopId },
      _count: { status: true },
    }),

    prisma.order.findMany({
      where: { shopId, deliveryDate: { gte: todayStart, lte: todayEnd } },
      orderBy: { deliveryDate: "asc" },
      take: 5,
      select: { id: true, clientName: true, amount: true, deliveryDate: true, status: true },
    }),

    prisma.attendance.findMany({
      where: { date: todayStart, employee: { shopId } },
      include: { employee: { select: { name: true } } },
    }),

    prisma.activityLog.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),

    prisma.order.aggregate({
      where: { shopId, status: { in: ["PENDING", "IN_PROGRESS", "READY"] } },
      _sum: { amount: true, advancePayment: true },
    }),
  ]);

  const ordersPerDay = {};
  for (let i = 0; i < 7; i++) {
    const day = new Date(sevenDaysAgo.getTime() + i * 24 * 60 * 60 * 1000);
    ordersPerDay[day.toISOString().slice(0, 10)] = 0;
  }
  ordersLast7Days.forEach((order) => {
    const key = order.createdAt.toISOString().slice(0, 10);
    if (key in ordersPerDay) ordersPerDay[key] += 1;
  });

  const orderStatusBreakdown = orderStatusGroups.reduce((acc, group) => {
    acc[group.status] = group._count.status;
    return acc;
  }, {});

  const [ordersCreatedToday, ordersDeliveredToday] = await Promise.all([
    prisma.order.findMany({
      where: { shopId, createdAt: { gte: todayStart, lte: todayEnd } },
      select: { advancePayment: true },
    }),
    prisma.order.findMany({
      where: { shopId, status: "DELIVERED", updatedAt: { gte: todayStart, lte: todayEnd } },
      select: { amount: true, advancePayment: true },
    }),
  ]);

  const revenueFromNewAdvances = ordersCreatedToday.reduce((sum, o) => sum + o.advancePayment, 0);
  const revenueFromDeliveries = ordersDeliveredToday.reduce(
    (sum, o) => sum + (o.amount - o.advancePayment),
    0
  );
  const todaysRevenue = revenueFromNewAdvances + revenueFromDeliveries;

  const totalAmount = paymentTotals._sum.amount || 0;
  const totalAdvance = paymentTotals._sum.advancePayment || 0;
  const pendingPayments = totalAmount - totalAdvance;

  res.json({
    success: true,
    data: {
      stats: {
        totalEmployees,
        activeOrders,
        ordersDueToday,
        todaysRevenue,
        pendingPayments,
      },
      ordersOverview: Object.entries(ordersPerDay).map(([date, count]) => ({ date, count })),
      orderStatusBreakdown,
      todaysOrders,
      todaysAttendance: todaysAttendance.map((a) => ({
        employeeId: a.employeeId,
        employeeName: a.employee.name,
        status: a.status,
        checkIn: a.checkIn,
        checkOut: a.checkOut,
      })),
      recentActivity,
    },
  });
}

module.exports = { getSummary };
