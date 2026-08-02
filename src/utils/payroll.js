function calculatePay(employee, attendanceRecords) {
  const daysPresent = attendanceRecords.filter((a) => a.status === "PRESENT").length;
  const halfDays = attendanceRecords.filter((a) => a.status === "HALF_DAY").length;
  const totalHours = attendanceRecords.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);

  let grossPay = 0;

  switch (employee.payType) {
    case "HOURLY":
      grossPay = totalHours * employee.payRate;
      break;

    case "DAILY":
      grossPay = (daysPresent + halfDays * 0.5) * employee.payRate;
      break;

    case "WEEKLY":
    case "MONTHLY":
      grossPay = employee.payRate;
      break;

    default:
      grossPay = 0;
  }

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    daysPresent,
    grossPay: Math.round(grossPay * 100) / 100,
    netPay: Math.round(grossPay * 100) / 100,
  };
}

module.exports = { calculatePay };
