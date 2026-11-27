# PulseBridge API — Blood Donation & Emergency Coordination Backend

PulseBridge is a high-trust voluntary blood donation coordination, ABO/Rh antigen compatibility matching, 90-day medical cooldown enforcement, and voluntary platform support backend built with **Node.js**, **Express 5**, **TypeScript**, **PostgreSQL**, **Prisma ORM 7**, and **Redis**.

---

## 1. Project Overview & Core Problem Solved

During medical emergencies, finding a medically eligible, blood-group-compatible donor near a hospital without risking donor health or falling prey to unverified appeals is time-critical. PulseBridge solves this with three core clinical and operational safeguards:

1. **Verified Emergency Blood Appeals & Lifecycle Tracking:**
   - Requesters submit hospital-specific blood requests with urgency tiers (`NORMAL`, `URGENT`, `EMERGENCY`), units required, and geographic coordinates.
   - Administrators moderate appeals (`PENDING` → `APPROVED` / `REJECTED`), track partial fulfillment (`PARTIALLY_FULFILLED` → `FULFILLED`), and automatically expire stale appeals via scheduled expiration services.
2. **ABO/Rh Antigen Compatibility Engine:**
   - Reciprocal red blood cell compatibility rules across all 8 blood groups (`O_NEGATIVE`, `O_POSITIVE`, `A_NEGATIVE`, `A_POSITIVE`, `B_NEGATIVE`, `B_POSITIVE`, `AB_NEGATIVE`, `AB_POSITIVE`) power instant donor-to-request matching and proximity discovery (`/api/v1/matching`).
3. **Atomic 90-Day Biological Medical Cooldown Enforcement:**
   - When a donation is verified (`PATCH /api/v1/donations/:donationId/verify`), a PostgreSQL transaction atomically marks the donation `VERIFIED`, increments the request's `fulfilledUnits`, updates `lastDonationDate`, and sets `eligibleAt` to **90 days in the future** while locking donor availability to protect donors from over-donation.

---

## 2. Live Links, API Documentation & ERD

| Resource | URL / Path |
| :--- | :--- |
| **Live Backend API** | https://pulse-bridge-backend.vercel.app (`https://pulse-bridge-backend.vercel.app/api/v1`) |
| **Health Check Endpoint** | https://pulse-bridge-backend.vercel.app/api/v1/health |
| **Interactive API Docs (Swagger UI)** | https://pulse-bridge-backend.vercel.app/api-docs/ |
| **Database ERD Diagram (DrawSQL)** | https://drawsql.app/teams/fardin-islam/diagrams/pulsebridge |
| **Live Frontend Application** | https://pulsebridge-frontend.vercel.app |
| **Public Blood Requests Feed** | https://pulsebridge-frontend.vercel.app/blood-requests |
| **Backend GitHub Repository** | https://github.com/fardinislamselim/pulsebridge-backend |
| **Frontend GitHub Repository** | https://github.com/fardinislamselim/pulsebridge-frontend |
| **Postman Collection** | [`./postman/PulseBridge.postman_collection.json`](./postman/PulseBridge.postman_collection.json) |

---

## 3. Demo Evaluation Credentials

Seeded via `prisma/seed.ts`, `prisma/seed-donors.ts`, and `prisma/seed-requests.ts` for immediate evaluation:

| Role | Email | Password | Portal Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@pulsebridge.com` | `AdminSecurePassword123!` | Moderation, donor verification, donation verification, refunds & analytics |
| **Requester** | `recipient.alice@pulsebridge.com` | `DemoPassword123!` | Create/manage blood requests, log donations, view request history |
| **Donor (O+)** | `donor.john@pulsebridge.com` | `DemoPassword123!` | Toggle availability, check 90-day eligibility, view donation history |

> Note: In `prisma/seed.ts`, the admin password is read from `SEED_ADMIN_PASSWORD` or `ADMIN_PASSWORD` in `.env` (configured as `AdminSecurePassword123!`, falling back to `AdminSecurePassword123!` if unset).

---

## 4. Tech Stack & Modular Layered Architecture

### Technology Stack
- **Runtime & Language:** Node.js, TypeScript (`^7.0.2`), ESM (`"type": "module"`)
- **Web Framework:** Express (`^5.3.0`) with Helmet, CORS, Cookie Parser, Morgan, and Express Rate Limit
- **Database & ORM:** PostgreSQL with Prisma ORM (`^7.10.1`) & `@prisma/adapter-pg` (multi-file schema in `prisma/schema/`)
- **Caching & State:** Redis (`ioredis ^6.0.0`, `redis ^6.3.1`)
- **Authentication & Security:** JWT Access/Refresh Token rotation (`jsonwebtoken ^9.0.3`), `bcrypt ^6.0.0`, Google Identity Services (`google-auth-library ^11.3.4`), 6-digit OTP email verification
- **Validation & Docs:** Zod (`^4.6.7`), Swagger UI (`swagger-ui-express ^5.0.1`), `yamljs`
- **Payments & Email:** SSLCommerz (BDT) & Stripe (USD) with idempotency & PostgreSQL row-locked refunds, Nodemailer (`^10.6.0`) + EJS templates (`^7.0.2`)
- **Testing & Quality:** Vitest (`^5.1.0`), Supertest (`^7.3.2`), ESLint, Prettier

### Modular Architecture (`Routes -> Controllers -> Services -> Prisma`)

```text
pulsebridge-backend/
├── api/                          # Vercel serverless entrypoint
├── postman/                      # Exported Postman collection
├── prisma/
│   ├── schema/                   # Modular Prisma schema files (User, DonorProfile, BloodRequest, Donation, Payment, etc.)
│   ├── seed.ts                   # Core admin, demo donor/requester, request & audit seed
│   ├── seed-donors.ts            # 26+ verified voluntary donors across Bangladesh & all 8 blood groups
│   └── seed-requests.ts          # 21+ hospital blood requests across Bangladesh
└── src/
    ├── config/                   # Database, Redis, and Zod-validated env config
    ├── docs/                     # OpenAPI specification & Swagger UI router
    ├── middlewares/              # authenticate, authorize (RBAC), validateRequest, rateLimiter, errorHandler
    ├── modules/
    │   ├── admin/                # Admin moderation, analytics & audit logs
    │   ├── auth/                 # Register, Login, Google OAuth, OTP, Refresh sessions
    │   ├── donations/            # Donation logging, atomic verification & 90-day cooldown
    │   ├── donors/               # Donor profile, availability, eligibility & proximity search
    │   ├── matching/             # ABO/Rh compatibility engine & eligible donor discovery
    │   ├── otp/                  # OTP generation, hashing & cooldown checks
    │   ├── payments/             # SSLCommerz, Stripe, webhooks, reconciliation & row-locked refunds
    │   ├── requests/             # Blood request CRUD, moderation & expiration
    │   └── users/                # User profile (/me) & admin user management
    ├── routes/                   # Centralized v1 API router & health check
    ├── services/                 # Audit logging, email dispatch & in-app notifications
    ├── shared/                   # Shared location & geolocation utilities
    ├── templates/                # EJS transactional email templates
    ├── types/                    # Shared TypeScript interfaces & health check types
    ├── utils/                    # ApiResponse, AppError, JWT, password & cookie helpers
    ├── app.ts                    # Express app assembly
    └── server.ts                 # HTTP server bootstrap
```

---

## 5. Key API Endpoints Summary

All endpoints are prefixed with `/api/v1` (except Swagger UI at `/api-docs`).

### Health & Infrastructure
- `GET /api/v1/health` — Database & service health status

### Auth (`/api/v1/auth`)
- `POST /register` — Register `DONOR` or `REQUESTER` account
- `POST /login` — Email/password login with JWT access & refresh tokens
- `GET /google` & `POST /google` — Google OAuth 2.0 URL & ID token login
- `POST /refresh` — Refresh token rotation
- `POST /logout` & `POST /logout-all` — Revoke current or all active sessions
- `POST /verify-email`, `POST /resend-verification-otp`, `POST /resend-verification` — Email OTP verification
- `POST /forgot-password`, `POST /verify-reset-otp`, `POST /reset-password` — Password reset flow
- `GET /me`, `GET /sessions`, `DELETE /sessions/:id` — Current user & session management

### Users (`/api/v1/users`)
- `GET /me` & `PATCH /me` — Get or update authenticated user's profile & avatar
- `GET /`, `GET /:userId`, `PATCH /:userId/status`, `PATCH /:userId/role` — Admin user management

### Donors (`/api/v1/donors`)
- `GET /` & `GET /nearby` — Public donor directory & geolocation proximity search
- `GET /:donorId` & `GET /:donorId/eligibility` — Sanitized donor details & eligibility check
- `GET /me`, `PATCH /me`, `PATCH /me/availability`, `GET /me/eligibility` — Authenticated donor hub controls
- `GET /search` & `GET /compatible` — Authenticated advanced & compatible donor search

### Blood Requests (`/api/v1/blood-requests`)
- `GET /` & `GET /:requestId` — Public approved blood requests feed & details
- `POST /` — Create blood request (`REQUESTER`, `ADMIN`, `SUPER_ADMIN`)
- `GET /me`, `PATCH /:requestId`, `PATCH /:requestId/cancel`, `GET /:requestId/history` — Requester management & audit history
- `PATCH /:requestId/approve`, `PATCH /:requestId/reject`, `PATCH /:requestId/urgency`, `PATCH /:requestId/expire` — Admin moderation actions

### Matching (`/api/v1/matching`)
- `GET /compatibility` — Check ABO/Rh donor-recipient compatibility
- `GET /requests/:requestId/donors` & `GET /find-donors` — Discover compatible, eligible donors

### Donations (`/api/v1/donations`)
- `POST /` — Log a hospital blood donation (`REQUESTER`, `ADMIN`, `SUPER_ADMIN`)
- `GET /`, `GET /me`, `GET /:donationId` — Role-scoped donation history & 90-day cooldown tracking
- `PATCH /:donationId/verify` & `PATCH /:donationId/reject` — Admin atomic verification (enforces 90-day cooldown & updates fulfilled units)

### Payments (`/api/v1/payments`)
- `POST /initiate` — Initiate voluntary support payment (`SSLCOMMERZ` BDT or `STRIPE` USD)
- `GET /me`, `GET /:paymentId`, `GET /:paymentId/verify` — User payment history & receipt verification (supports UUID `id` or `transactionId`)
- `POST /sslcommerz/success`, `POST /sslcommerz/fail`, `POST /sslcommerz/cancel`, `POST /sslcommerz/ipn`, `POST /stripe/webhook` — Gateway callbacks & webhooks
- `GET /`, `GET /statistics`, `POST /:paymentId/refund`, `GET /:paymentId/refunds` — Admin payment analytics & row-locked refunds

### Admin & Analytics (`/api/v1/admin`)
- `GET /dashboard`, `GET /dashboard/overview`, `GET /dashboard/recent-activities` — Command center overview
- `GET /analytics/{users,donors,blood-requests,donations,assignments,emergency,payments,notifications,growth}` — Multi-domain analytics
- `GET /audit-logs` — Immutable system audit trail
- Full admin routes for `/users`, `/donors`, `/blood-requests`, `/donations`, `/payments`, and `/refunds`

---

## 6. Local Setup, Environment Variables & Database Seeding

### Prerequisites
- **Node.js** `>= 20`
- **pnpm** (`packageManager: pnpm@12.21.0`)
- **PostgreSQL** database & **Redis** instance

### Step-by-Step Setup

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your PostgreSQL, Redis, JWT, SMTP, Google OAuth, SSLCommerz, and Stripe credentials:
   ```bash
   cp .env.example .env
   ```
   Key variables in `.env`:
   - `DATABASE_URL` — PostgreSQL connection string
   - `REDIS_URL` / `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`
   - `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `EMAIL_USER` & `EMAIL_PASS` (Gmail SMTP)
   - `SSLCOMMERZ_STORE_ID` & `SSLCOMMERZ_STORE_PASSWORD`
   - `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET`

3. **Generate Prisma client & push schema:**
   ```bash
   pnpm run db:generate
   npx prisma db push
   ```

4. **Seed the database (idempotent scripts):**
   ```bash
   pnpm run db:seed
   pnpm run db:seed:donors
   pnpm run db:seed:requests
   ```

5. **Run the development server:**
   ```bash
   pnpm run dev
   ```
   The API will start on `http://localhost:5000` with Swagger UI available at `http://localhost:5000/api-docs`.

### Additional Scripts
- `pnpm run build` — Generate Prisma client, compile TypeScript, resolve aliases, and copy email templates
- `pnpm run type-check` — Run `tsc --noEmit`
- `pnpm run lint` — Type-check and run ESLint
- `pnpm run test` — Run Vitest test suite
