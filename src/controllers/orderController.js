const { z } = require("zod");
const prisma = require("../config/db");
const { validateRequest } = require("../utils/validation");
const { logActivity } = require("../utils/activityLog");

const orderSchema = z.object({
  title: z.string().trim().min(2, "Order title must be at least 2 characters"),
  clientName: z.string().min(2, "Client name must be at least 2 characters"),
  clientPhone: z.string().min(7, "Invalid phone number"),
  instructions: z.string().optional(),
  deliveryDate: z.string().datetime(),
  amount: z.number().positive("Amount must be greater than 0"),
  advancePayment: z.number().min(0).optional(),
});

const updateSchema = orderSchema.partial().extend({
  status: z.enum(["PENDING", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"]).optional(),
});

function withBalance(order) {
  return { ...order, balance: order.amount - order.advancePayment };
}

async function createOrder(req, res) {
  const data = validateRequest(req, res, orderSchema);
  if (!data) return;

  const order = await prisma.order.create({
    data: { ...data, shopId: req.auth.shopId },
  });

  logActivity(req.auth.shopId, "ORDER_CREATED", `Order ${order.title} for ${order.clientName} created`);

  res.status(201).json(withBalance(order));
}

async function listOrders(req, res) {
  const { status, from, to } = req.query;

  const orders = await prisma.order.findMany({
    where: {
      shopId: req.auth.shopId,
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            deliveryDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    },
    orderBy: { deliveryDate: "asc" },
  });

  res.json(orders.map(withBalance));
}

async function getOrder(req, res) {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
    include: {
      assignments: {
        include: { employee: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  res.json(withBalance(order));
}

async function updateOrder(req, res) {
  const data = validateRequest(req, res, updateSchema);
  if (!data) return;

  const existing = await prisma.order.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
  });
  if (!existing) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  const updated = await prisma.order.update({
    where: { id: existing.id },
    data,
  });

  if (data.status === "DELIVERED" && existing.status !== "DELIVERED") {
    logActivity(req.auth.shopId, "ORDER_DELIVERED", `Order ${updated.title || `for ${updated.clientName}`} completed`);
  }

  res.json(withBalance(updated));
}

async function deleteOrder(req, res) {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, shopId: req.auth.shopId },
  });
  if (!order) {
    return res.status(404).json({ success: false, message: "Order not found" });
  }

  await prisma.order.delete({ where: { id: order.id } });
  logActivity(req.auth.shopId, "ORDER_DELETED", `Order ${order.title || `for ${order.clientName}`} deleted`);

  res.json({ success: true, message: "Order deleted" });
}

module.exports = { createOrder, listOrders, getOrder, updateOrder, deleteOrder };
