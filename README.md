# SMS Backend — Phase 1 (Auth)

## What's in this phase
- Owner registration (creates Owner + their Shop together)
- Owner login
- Staff login (for employees/managers you'll create in Phase 2)
- JWT access + refresh tokens
- A protected `/api/me` route to prove auth works

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
cd sms-backend
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

> **If you already ran migrate once before this update:** the schema changed (the old
> separate `Owner` table was merged into `User`). Since there's no real data yet, the
> easiest fix is to reset: `npx prisma migrate reset` then re-run the command above.

### 6. Run the server
```
npm run dev
```
You should see: `SMS backend running on http://localhost:5000`

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
  "shopName": "Jane's Store",
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

## Useful commands
- `npx prisma studio` — opens a visual browser for your database (great for beginners to see data)
- `npm run dev` — restarts automatically on file changes
