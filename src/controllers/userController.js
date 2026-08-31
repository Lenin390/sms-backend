const { z } = require("zod");
const prisma = require("../config/db");
const { validateRequest } = require("../utils/validation");

const updateProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  phone: z.string().min(7, "Invalid phone number").optional(),
});

async function updateProfile(req, res) {
  const data = validateRequest(req, res, updateProfileSchema);
  if (!data) return;

  const updated = await prisma.user.update({
    where: { id: req.auth.id },
    data,
  });

  res.json({
    success: true,
    message: "Profile updated",
    user: { id: updated.id, name: updated.name, email: updated.email, phone: updated.phone, role: updated.role },
  });
}

module.exports = { updateProfile };
