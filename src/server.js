require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const openapi = require("../openapi.json");
const { errorHandler } = require("./middleware/errorHandler");
const { verifyRequestOrigin } = require("./middleware/csrf");
const authRoutes = require("./routes/authRoutes");
const meRoutes = require("./routes/meRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const orderRoutes = require("./routes/orderRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const shopRoutes = require("./routes/shopRoutes");

const app = express();

app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json());
app.use(verifyRequestOrigin);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/shop", shopRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`SMS backend running on http://localhost:${PORT}`);
});
