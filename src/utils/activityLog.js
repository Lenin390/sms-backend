const prisma = require("../config/db");

async function logActivity(shopId, type, message, actorName) {
  try {
    await prisma.activityLog.create({
      data: { shopId, type, message, actorName },
    });
  } catch (err) {
    console.error("Failed to write activity log:", err.message);
  }
}

module.exports = { logActivity };
