# SMS Backend — Phase 1 & 2

## What's in Phase 1 (Auth)
- Owner registration (creates a User with role OWNER + their Shop together)
- Single login endpoint for everyone — owner, manager, staff. Role comes back from the DB, the frontend never has to guess which one to call.
- JWT access + refresh tokens
- A protected `/api/me` route to prove auth works

## What's in Phase 2 (Employees, Attendance, Payroll)
- Employee records, separate from login accounts — most employees don't need to log in at all
- A separate "grant login access" step for the few who do (e.g. managers)
- Check-in/check-out for hourly employees, manual present/absent marking for daily/weekly/monthly employees
- Staff can only mark their own attendance; owners/managers can mark anyone's
- Payroll preview (calculate without saving) and payroll runs (saved + mark as paid)

## Setup steps

### 1. Install Node.js
Download from https://nodejs.org (LTS version). Verify:
```
node -v
npm -v
```

### 2. Get a PostgreSQL database
Easiest options for beginners (no local install needed):
- **Neon** (https://neon.tech) — free tier, gives you a `DATABASE_URL` instantly
- **Supabase** (https://supabase.com) — also free tier
- Or install Postgres locally if you prefer

Copy the connection string they give you — it looks like:
`postgresql://user:password@host:5432/dbname`

### 3. Install dependencies
```
cd bms-backend
npm install
```

### 4. Configure environment variables
```
cp .env.example .env
```
Open `.env` and paste in your real `DATABASE_URL`. Generate secrets by running:
```
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Run that twice — once for `JWT_ACCESS_SECRET`, once for `JWT_REFRESH_SECRET`.

### 5. Create the database tables
```
npx prisma migrate dev --name init
```
This reads `prisma/schema.prisma` and creates the actual tables in your Postgres database.

If you're pulling in the Phase 2 update (Employee/Attendance/PayrollRun tables) on top of an
existing Phase 1 database, just run migrate again with a new name — it'll add the new tables
without touching your existing data:
```
npx prisma migrate dev --name phase2_employees_attendance_payroll
```

### 6. Run the server
```
npm run dev
```
You should see: `BMS backend running on http://localhost:5000`

## Test it (use Postman, Insomnia, or curl)

**Register an owner:**
```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "9998887777",
  "password": "SecurePass123",
  "shopName": "Jane's Boutique",
  "shopAddress": "123 Main St"
}
```
This returns an `accessToken`. Copy it.

**Login (works for owners AND staff — same endpoint, role comes back from the DB):**
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "SecurePass123"
}
```

**Call the protected route:**
```
GET http://localhost:5000/api/me
Authorization: Bearer <paste accessToken here>
```
You should get back your decoded auth info. Without the header, you get a 401.

## Test Phase 2 (use the accessToken from login above)

**Create an employee:**
```
POST http://localhost:5000/api/employees
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Ravi Kumar",
  "phone": "9876543210",
  "payType": "HOURLY",
  "payRate": 150
}
```
Copy the returned `id` — you'll need it as `employeeId` below.

**Check in / check out (as owner, on behalf of that employee):**
```
POST http://localhost:5000/api/attendance/checkin
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "employeeId": "<paste employee id>" }
```
Wait a bit, then call `/api/attendance/checkout` the same way — `hoursWorked` gets calculated automatically.

**Preview payroll for that employee:**
```
POST http://localhost:5000/api/payroll/preview
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "employeeId": "<paste employee id>",
  "periodStart": "2026-08-01T00:00:00.000Z",
  "periodEnd": "2026-08-31T00:00:00.000Z"
}
```
This calculates pay from the attendance you just logged, without saving anything.

**Grant an employee login access (optional, e.g. for a manager):**
```
POST http://localhost:5000/api/employees/<employee id>/grant-access
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "email": "ravi@example.com", "role": "STAFF" }
```
Returns a `temporaryPassword` — this is shown once, make sure to save it.

Full endpoint reference is in `openapi.json` — paste it into https://editor.swagger.io to browse it visually.

## Useful commands
- `npx prisma studio` — opens a visual browser for your database (great for beginners to see data)
- `npm run dev` — restarts automatically on file changes