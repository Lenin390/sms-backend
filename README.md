# SMS Backend — Phase 1, 2 & 3

## What's in Phase 1 (Auth)
- Owner registration (creates a User with role OWNER + their Shop together)
- Single login endpoint for everyone — owner, manager, staff
- JWT access + refresh tokens, refresh returns fresh user/shop data too
- A protected `/api/me` route

## What's in Phase 2 (Employees, Attendance, Payroll)
- Employee records, separate from login accounts
- A separate "grant login access" step for employees who need one
- Check-in/check-out for hourly employees, manual marking for daily/weekly/monthly employees
- Staff can only mark their own attendance; owners/managers can mark anyone's
- Payroll preview and saved payroll runs

## What's in Phase 3 (Orders & Work Assignments)
- Orders: client name/phone, instructions, delivery date, amount, advance payment. Balance is calculated automatically (amount minus advance) and included in every response.
- Order status moves through PENDING → IN_PROGRESS → READY → DELIVERED, or CANCELLED
- Work assignments link an order to an employee with a task and due date
- Owners/managers assign work and can edit anything; staff can see their own tasks and update only the status of their own assignments

**Phase 3.4 — Dashboard aggregation**
- `GET /api/dashboard/summary` — one call returns everything the frontend dashboard needs: stat
  counts, a 7-day orders trend, order status breakdown, today's orders, today's attendance, and a
  recent activity feed.
- New `ActivityLog` table, written to (safely, never blocking the request) when an employee is
  added, an order is created, an order is delivered, or a payroll run is marked paid.

**Phase 3.5 — Password reset**
- `POST /api/auth/forgot-password` — always returns the same generic message whether or not the
  email exists, so it can't be used to enumerate registered accounts. Generates a one-time token,
  stores only its hash (never the raw token) in a new `PasswordResetToken` table, expires in 30
  minutes.
- `POST /api/auth/reset-password` — takes the raw token from the email link + a new password.
- **Email sending is a dev stub right now** (`src/utils/email.js` just logs the reset link to your
  console). Before this goes live, swap that function's body for a real provider (Resend, SendGrid,
  etc.) — everywhere else in the app calls `sendResetEmail(...)` the same way regardless.

## Setup steps

### 1. Install Node.js
Download from https://nodejs.org (LTS version). Verify:
```
node -v
npm -v
```

### 2. Get a PostgreSQL database
- **Neon** (https://neon.tech) or **Supabase** (https://supabase.com) both have free tiers and give you a `DATABASE_URL` instantly

### 3. Install dependencies
```
cd bms-backend
npm install
```

### 4. Configure environment variables
```
cp .env.example .env
```
Fill in your `DATABASE_URL`, and generate JWT secrets:
```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run that twice, once for `JWT_ACCESS_SECRET` and once for `JWT_REFRESH_SECRET`.

### 5. Create the database tables
```
npx prisma migrate dev --name phase3_4_dashboard_phase3_5_password_reset
```
This adds the `Order` and `WorkAssignment` tables on top of your existing Phase 1/2 data — nothing gets wiped.

### 6. Run the server
```
npm run dev
```
Visit `http://localhost:5000/docs` for the interactive Swagger UI covering every endpoint.

## Test Phase 3 (use the accessToken from login)

**Create an order:**
```
POST http://localhost:5000/api/orders
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "clientName": "Anjali Rao",
  "clientPhone": "9123456780",
  "instructions": "Blue silk saree, blouse stitching, size 38",
  "deliveryDate": "2026-08-25T00:00:00.000Z",
  "amount": 3500,
  "advancePayment": 1000
}
```
Copy the returned `id` — that's your `orderId`.

**Assign an employee to it:**
```
POST http://localhost:5000/api/orders/<orderId>/assignments
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "employeeId": "<paste employee id from Phase 2>",
  "task": "Stitch blouse",
  "dueDate": "2026-08-23T00:00:00.000Z"
}
```

**See the order with its assignments:**
```
GET http://localhost:5000/api/orders/<orderId>
Authorization: Bearer <accessToken>
```

**As the assigned employee, update task status:**
```
PATCH http://localhost:5000/api/assignments/<assignment id>
Authorization: Bearer <employee's accessToken>
Content-Type: application/json

{ "status": "IN_PROGRESS" }
```
If that employee tries to send `task` or `notes` instead of just `status`, they'll get a 403 — only owners/managers can edit assignment details.

Full endpoint reference: `openapi.json`, or browse it live at `/docs` once the server's running.

## Useful commands
- `npx prisma studio` — visual database browser
- `npm run dev` — restarts automatically on file changes

## Next: Phase 4
React frontend — login/register pages, dashboard, employee & attendance management, order board, and the protected route wrapper we designed earlier.
