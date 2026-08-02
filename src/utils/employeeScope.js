const prisma = require("../config/db");

async function resolveEmployeeId(auth, requestedEmployeeId) {
  if (auth.role === "OWNER" || auth.role === "MANAGER") {
    if (!requestedEmployeeId) {
      const err = new Error("employeeId is required");
      err.status = 400;
      throw err;
    }
    return requestedEmployeeId;
  }

  // STAFF: ignore whatever employeeId was sent, always use their own
  const employee = await prisma.employee.findUnique({
    where: { linkedUserId: auth.id },
  });

  if (!employee) {
    const err = new Error("No employee record is linked to your account");
    err.status = 403;
    throw err;
  }

  return employee.id;
}

module.exports = { resolveEmployeeId };
