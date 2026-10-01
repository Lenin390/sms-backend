// Takes an employee and their attendance rows for a period, returns the pay breakdown.
// Kept as a plain function (no DB calls) so it's easy to unit test later.
function calculatePay(employee, attendanceRecords) {
  const daysPresent = attendanceRecords.filter((a) => a.status === "PRESENT").length;
  const halfDays = attendanceRecords.filter((a) => a.status === "HALF_DAY").length;
  const totalHours = attendanceRecords.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
  const totalPieces = attendanceRecords.reduce((sum, a) => sum + (a.piecesCompleted || 0), 0);

  let grossPay = 0;

  switch (employee.payType) {
    case "HOURLY":
      grossPay = totalHours * employee.payRate;
      break;

    case "DAILY":
      grossPay = (daysPresent + halfDays * 0.5) * employee.payRate;
      break;

    // Weekly/monthly staff are usually paid the flat rate regardless of minor
    // attendance gaps - we still record daysPresent for the owner to see,
    // but it doesn't reduce pay. If that's not what you want, this is the
    // one place to change.
    case "WEEKLY":
    case "MONTHLY":
      grossPay = employee.payRate;
      break;

    case "PIECE_RATE":
      grossPay = totalPieces * employee.payRate;
      break;

    default:
      grossPay = 0;
  }

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    totalPieces,
    daysPresent,
    grossPay: Math.round(grossPay * 100) / 100,
    netPay: Math.round(grossPay * 100) / 100, // deductions can be subtracted here later
  };
}

module.exports = { calculatePay };
