const { z } = require("zod");
const prisma = require("../config/db");
const { validateRequest } = require("../utils/validation");

async function getShop(req, res) {
  const shop = await prisma.shop.findUnique({
    where: { id: req.auth.shopId },
  });

  if (!shop) {
    return res.status(404).json({ success: false, message: "Shop not found" });
  }

  res.json({ success: true, data: shop });
}

const updateShopSchema = z.object({
  name: z.string().min(2, "Shop name must be at least 2 characters").optional(),
  address: z.string().optional(),
});

async function updateShop(req, res) {
  const data = validateRequest(req, res, updateShopSchema);
  if (!data) return;

  const shop = await prisma.shop.findUnique({ where: { id: req.auth.shopId } });
  if (!shop) {
    return res.status(404).json({ success: false, message: "Shop not found" });
  }
  if (shop.ownerId !== req.auth.id) {
    return res.status(403).json({ success: false, message: "Only the shop owner can update shop settings" });
  }

  const updated = await prisma.shop.update({
    where: { id: shop.id },
    data,
  });

  res.json({ success: true, message: "Shop updated", data: updated });
}

module.exports = { getShop, updateShop };
