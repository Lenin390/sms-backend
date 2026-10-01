# SMS Backend — Store Management System

A complete Express.js + Prisma backend for managing orders, employees, attendance, and payroll.

## Quick Start

### 1. Prerequisites
- **Node.js** LTS (https://nodejs.org) — Verify: `node -v && npm -v`
- **PostgreSQL** database — Use [Neon](https://neon.tech) or [Supabase](https://supabase.com) free tier

### 2. Install & Configure

```bash
# Clone and install
git clone <repo>
cd store-management-platform-BE
npm install

# Create environment file
cp .env.example .env

# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Run twice: once for JWT_ACCESS_SECRET, once for JWT_REFRESH_SECRET
```

### 3. Setup `.env` File

```
DATABASE_URL=postgresql://user:password@host/database
JWT_ACCESS_SECRET=<random-hex-from-above>
JWT_REFRESH_SECRET=<random-hex-from-above>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:5173
```

### 4. Initialize Database

```bash
npx prisma migrate dev --name init
```

This creates all tables: User, Shop, Employee, Attendance, PayrollRun, RefreshToken, Order, WorkAssignment, ActivityLog, PasswordResetToken

### 5. Start Server

```bash
npm run dev
```

Server runs at `http://localhost:5000`
API docs available at `http://localhost:5000/docs`

### 6. Test All Endpoints

```bash
node scripts/test_all_endpoints.js
```

Expected: all endpoint checks passing (100%)

---

## Features

### 🔐 Authentication & Authorization
- Owner registration (creates User + Shop)
- Single login for all roles (Owner, Manager, Staff)
- HttpOnly cookie-based access and refresh tokens with refresh-token rotation
- Role-based access control (RBAC)
- Password reset with email tokens
- Protected `/api/me` endpoint

### 👥 Employee Management
- Create and manage employee records
- Separate from login accounts
- Grant login access to employees
- Soft delete (deactivate) employees

### 📍 Attendance Tracking
- Check-in/check-out for hourly employees
- Manual marking for daily/weekly/monthly employees
- Staff mark only their own attendance
- Owners/managers mark anyone's attendance
- Attendance history with date range filters

### 💰 Payroll System
- Calculate pay by hours, attendance, or completed pieces
- Preview payroll without saving
- Create and save payroll runs
- Mark payroll as paid with audit trail
- Automatic activity logging

### 📋 Order Management
- Create orders with client info and delivery date
- Automatic balance calculation (amount - advance payment)
- Order status workflow: PENDING → IN_PROGRESS → READY → DELIVERED (or CANCELLED)
- Track all order details in responses

### 🎯 Work Assignments
- Assign employees to orders with tasks
- Set due dates and notes
- Staff can update only their own task status
- Owners/managers can edit all assignment details
- Role-based permission enforcement

### 📊 Dashboard & Activity Log
- Single endpoint for all dashboard metrics
- Stats: total employees, active orders, revenue, pending payments
- 7-day order trend
- Order status breakdown
- Today's orders and attendance
- Recent activity feed with audit trail

---

## API Overview

The SMS Backend is a RESTful API built with Express.js and Prisma ORM. It provides comprehensive endpoints for managing:

- **Authentication**: Registration, login, token refresh, and password reset
- **Employees**: Create, read, update, delete employee records and grant login access
- **Attendance**: Check-in/check-out, manual marking, and attendance history
- **Payroll**: Preview calculations, create runs, and mark payments as complete
- **Orders**: Create orders, track status, calculate automatic balances
- **Work Assignments**: Assign employees to orders, track task status
- **Dashboard**: Unified summary of business metrics and activity

### API Base URL
```
http://localhost:5000/api
```

### API Documentation
Access interactive API documentation at:
```
http://localhost:5000/docs
```

## Authentication

Protected endpoints use the `sms_access` HttpOnly cookie. Login and registration set it automatically; browser clients must use `credentials: "include"` (or `withCredentials: true` in Axios). Configure `CORS_ORIGIN` with the exact frontend origin. Production cookies use `Secure` and `SameSite=None` by default; `AUTH_COOKIE_SAME_SITE` can override the same-site policy.

### Authentication Flow

1. **Register a new owner** (creates User + Shop)
   ```
   POST /api/auth/register
   ```

2. **Login** to set the auth cookies
   ```
   POST /api/auth/login
   ```

3. **Use the cookies** for API requests (15-minute access-token expiry by default)
   ```
   GET /api/me
   ```

4. **Refresh token** when access token expires
   ```
   POST /api/auth/refresh
   ```

`POST /api/auth/refresh` rotates the refresh cookie; its token is never accepted from or returned in JSON. `POST /api/auth/logout` revokes the current refresh session and clears both cookies. Unsafe requests authenticated by cookies must include an allowed `Origin` header.

## Response Format

### Success Response (200-201)
Most endpoints return the data directly:

```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  ...
}
```

### Error Response (400-500)
Error responses follow a consistent format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - validation failed |
| 401 | Unauthorized - invalid/missing token |
| 403 | Forbidden - insufficient permissions |
| 404 | Not Found - resource doesn't exist |
| 409 | Conflict - duplicate email or constraint violation |
| 500 | Server Error |

## User Roles & Permissions

### OWNER
- Full access to all endpoints
- Can create/manage employees, orders, assignments
- Can view all attendance and payroll records
- Can generate and mark payroll as paid

### MANAGER
- Similar to OWNER but typically shop-specific
- Cannot access all owner-level analytics
- Can manage employees and orders for their shop

### STAFF
- Limited to own data
- Can check in/out, view own attendance
- Can view assigned tasks and update task status only
- Cannot access other employees' data

## Core Endpoints

### Authentication
- `POST /auth/register` - Register new owner
- `POST /auth/login` - Login (all roles)
- `POST /auth/refresh` - Refresh access token
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Complete password reset
- `GET /me` - Get authenticated user info

### Employees
- `POST /employees` - Create employee
- `GET /employees` - List employees (supports `?active=true` filter)
- `GET /employees/{id}` - Get employee details
- `PATCH /employees/{id}` - Update employee
- `DELETE /employees/{id}` - Deactivate employee (soft delete)
- `POST /employees/{id}/grant-access` - Grant login access to employee

### Attendance
- `POST /attendance/checkin` - Check in (hourly employees)
- `POST /attendance/checkout` - Check out (hourly employees)
- `POST /attendance/mark` - Manually mark attendance
- `GET /attendance` - Get attendance records (supports filters: `employeeId`, `from`, `to`)

### Payroll
- `POST /payroll/preview` - Calculate pay without saving
- `POST /payroll/runs` - Create and save payroll run
- `GET /payroll/runs` - List payroll runs (supports filters: `employeeId`, `status`)
- `PATCH /payroll/runs/{id}/pay` - Mark payroll as paid

### Orders
- `POST /orders` - Create order
- `GET /orders` - List orders (supports filters: `status`, `from`, `to`)
- `GET /orders/{id}` - Get order with assignments
- `PATCH /orders/{id}` - Update order details or status

### Work Assignments
- `POST /orders/{orderId}/assignments` - Create assignment
- `GET /orders/{orderId}/assignments` - List assignments for order
- `GET /assignments` - List all assignments (role-aware)
- `PATCH /assignments/{id}` - Update assignment (staff can only update status)

### Dashboard
- `GET /dashboard/summary` - Get dashboard metrics and activity

## Testing All Endpoints

A comprehensive test suite is included to validate all endpoints:

```bash
# Start the server in one terminal
npm run dev

# Run all tests in another terminal
node scripts/test_all_endpoints.js
```

This will:
- Test all 30 endpoints
- Display pass/fail results
- Show success rate
- Report any failures with details

### Test Results
✅ **100% API Coverage** - All endpoints tested and working
- 30 total endpoints
- All authentication flows validated
- All CRUD operations verified
- Permission checks validated

## Common Workflows

### Workflow 1: Register and Setup Shop

```javascript
// 1. Register owner
POST /auth/register
{
  "name": "Shop Owner",
  "email": "owner@shop.com",
  "phone": "9876543210",
  "password": "SecurePass123!",
  "shopName": "My Tailor Shop",
  "shopAddress": "123 Main St"
}

// Response includes user and shop data. Auth tokens are set as HttpOnly cookies.
```

### Workflow 2: Add and Manage Employees

```javascript
// 1. Create employee (owner/manager only)
POST /employees
// Send the auth cookies automatically (credentials: "include")
{
  "name": "John Tailor",
  "phone": "9123456789",
  "designation": "Master Tailor",
  "payType": "MONTHLY",
  "payRate": 20000,
  "joiningDate": "2026-01-15T00:00:00.000Z"
}

// 2. Grant login access to employee
POST /employees/<employeeId>/grant-access
{
  "email": "john@shop.com",
  "role": "STAFF",
  "password": "TempPass123!"
}

// Employee can now login with their email/password
// and see only their own data
```

### Workflow 3: Track Orders and Assignments

```javascript
// 1. Create order
POST /orders
{
  "clientName": "Anjali Rao",
  "clientPhone": "9123456780",
  "instructions": "Blue silk saree, size 38",
  "deliveryDate": "2026-09-15T00:00:00.000Z",
  "amount": 3500,
  "advancePayment": 1000
}
// Returns: order with balance = 2500 (amount - advance)

// 2. Assign employee to order
POST /orders/<orderId>/assignments
{
  "employeeId": "<employeeId>",
  "task": "Stitch blouse",
  "dueDate": "2026-09-14T00:00:00.000Z"
}

// 3. Employee updates task status
PATCH /assignments/<assignmentId>
// Send the employee's auth cookies automatically
{
  "status": "IN_PROGRESS"
}
// Staff can ONLY update status, not task/notes

// 4. Owner/manager can update anything
PATCH /assignments/<assignmentId>
// Send the owner's auth cookies automatically
{
  "status": "DONE",
  "notes": "Quality checked and approved"
}
```

### Workflow 4: Attendance and Payroll

```javascript
// 1. Hourly employee checks in
POST /attendance/checkin
{
  "employeeId": "<employeeId>"
}

// 2. Employee checks out
POST /attendance/checkout
{
  "employeeId": "<employeeId>"
}
// Returns: hoursWorked calculated automatically

// 3. Preview payroll for period
POST /payroll/preview
{
  "employeeId": "<employeeId>",
  "periodStart": "2026-08-01T00:00:00.000Z",
  "periodEnd": "2026-08-31T23:59:59.000Z"
}

// 4. Create actual payroll run
POST /payroll/runs
{
  "employeeId": "<employeeId>",
  "periodStart": "2026-08-01T00:00:00.000Z",
  "periodEnd": "2026-08-31T23:59:59.000Z"
}

// 5. Mark payroll as paid
PATCH /payroll/runs/<runId>/pay
// Status changes from DRAFT to PAID
// Activity log is updated
```

For piece-rate employees, include a non-negative `piecesCompleted` integer when marking attendance. Payroll uses the total recorded pieces in the selected period multiplied by that employee's `payRate`.

## Database Models

The API uses Prisma ORM with PostgreSQL. Key models:

- **User** - Login accounts (OWNER, MANAGER, STAFF)
- **Shop** - Store information
- **Employee** - Employee records (separate from Users)
- **Attendance** - Check-in/out and manual marks
- **PayrollRun** - Calculated and paid salary records
- **Order** - Client orders with automatic balance calculation
- **WorkAssignment** - Tasks assigned to employees
- **ActivityLog** - Audit trail of important actions
- **PasswordResetToken** - One-time password reset tokens

## Environment Variables

Required `.env` file:

```
DATABASE_URL=postgresql://user:password@host/database
JWT_ACCESS_SECRET=<random-64-char-hex>
JWT_REFRESH_SECRET=<random-64-char-hex>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
NODE_ENV=development
PORT=5000
```

Generate secure secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Development & Debugging

### View Database
```bash
npx prisma studio
```

### Run Migrations
```bash
# Create new migration
npx prisma migrate dev --name <migration_name>

# Reset database (destructive!)
npx prisma migrate reset
```

### Enable Debug Logging
```bash
DEBUG=* npm run dev
```

### Common Issues

**Issue**: Email validation errors
- **Solution**: Use valid email format in test requests

**Issue**: JWT token expired
- **Solution**: Use refresh endpoint to get new access token

**Issue**: "Insufficient permissions" (403)
- **Solution**: Verify user role has access to resource

**Issue**: "Employee not found"
- **Solution**: Make sure employee is in same shop as authenticated user

## Performance Considerations

- JWT tokens are validated on every request
- Database queries are optimized with proper includes/selects
- Attendance check-in/out uses transaction to ensure data consistency
- Activity logging is non-blocking (async)
- Rate limiting on password reset endpoints (429 status)

## Security Features

✅ **Password Hashing** - bcrypt with salt rounds 12
✅ **JWT Token Expiry** - Access tokens expire in 15 minutes
✅ **Role-Based Access Control** - RBAC enforced on all endpoints
✅ **Email Enumeration Prevention** - forgot-password always returns same message
✅ **Token Hashing** - Reset tokens stored as hashes only
✅ **Database Constraints** - Unique constraints on email, shop-scoped data isolation

## Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Generate strong random `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
- [ ] Use managed PostgreSQL database (Neon, Supabase, AWS RDS, etc.)
- [ ] Configure email provider in `src/utils/email.js` (currently logs to console)
- [ ] Set appropriate `JWT_ACCESS_EXPIRY` and `JWT_REFRESH_EXPIRY`
- [ ] Enable HTTPS (use reverse proxy like Nginx)
- [ ] Configure CORS for frontend domain
- [ ] Setup monitoring and error logging
- [ ] Test all endpoints in production
- [ ] Setup database backups

## Useful commands
- `npm run dev` — Start server with auto-reload
- `npm start` — Start server (production)
- `npx prisma studio` — Visual database browser
- `npx prisma migrate dev` — Create and run migrations
- `node scripts/test_all_endpoints.js` — Run comprehensive tests

## Next: Phase 4
React frontend — login/register pages, dashboard, employee & attendance management, order board, and the protected route wrapper we designed earlier.

