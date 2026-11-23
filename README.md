# PulseBridge Backend 🩸

> **Enterprise Voluntary Blood Donation Coordination, Compatibility Engine & Contribution Platform**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.3-lightgrey.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.10-informational.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16%2B-blue.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-6%2F7-red.svg)](https://redis.io/)
[![Swagger](https://img.shields.io/badge/Swagger-OpenAPI%203.0-green.svg)](https://swagger.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 1. Project Title & Overview

**PulseBridge Backend** is the mission-critical, enterprise-grade RESTful API engine powering the PulseBridge voluntary blood donation ecosystem. Engineered specifically to bridge the critical gap between voluntary blood donors, emergency requesters, and healthcare administrators, the backend guarantees patient safety, medical integrity, and zero transactional exploitation.

### Core Architecture Pillars:
- **Voluntary Blood Donation Coordination:** Direct peer-to-peer and hospital-coordinated matching without financial intermediation for blood products.
- **Scientific ABO/Rh Compatibility Engine:** Strict, rule-based blood component matching algorithms ensuring recipient-donor biological compatibility across whole blood, red blood cells, and platelets.
- **Atomic 90-Day Medical Cooldown Enforcement:** Database-level transactional isolation guaranteeing that male and female donors cannot donate before their safe 90-day physiological recovery window elapses.
- **Voluntary Platform Contributions:** Dual-gateway financial infrastructure (SSLCommerz for BDT and Stripe for USD) accepting voluntary donor/requester platform support to keep the non-profit service operational, with row-level locked idempotency and automated audit logging.

---

## 2. Key Features

### 🛡️ Enterprise Security & Multi-Role RBAC
- **Strict Role-Based Access Control:** Differentiated access levels for `DONOR`, `REQUESTER`, `ADMIN`, and `SUPER_ADMIN`.
- **Dual-Token JWT Architecture:** Short-lived access tokens (15m) paired with cryptographically secure, rotating refresh tokens (7d) persisted in HTTP-only, SameSite secure cookies and synchronized with Redis token blacklists.
- **Google OAuth 2.0 Integration:** Native verification via `google-auth-library` enabling instant, one-click social authentication with automated role assignment.
- **Cryptographic 6-Digit Email OTP:** Nodemailer-driven SMTP verification pipeline with EJS-templated transactional emails, anti-brute-force rate limiting, and 10-minute expiry for password resets and critical role transitions.

### 🩸 Biological Compatibility & Cooldown Engine
- **ABO/Rh Compatibility Matrix:** Comprehensive algorithmic verification mapping exact compatible donor groups for recipients (e.g., $O^-$ universal donor, $AB^+$ universal recipient).
- **Atomic 90-Day Cooldown Verification:** All donation completions execute within PostgreSQL ACID transactions (`prisma.$transaction`) with `FOR UPDATE` row locks, verifying:
  $$\text{Current Date} - \text{Last Donation Date} \ge 90\text{ days}$$
  Rejecting premature attempts immediately with informative error payloads.
- **Automated Cron Jobs:** Scheduled background workers (`node-cron`) automatically evaluating expiring requests, resetting donor availability status once the 90-day cooldown concludes, and sweeping abandoned pending payment intents.

### 💳 Dual Payment Infrastructure & Row-Locked Refunds
- **Dual Gateways:** Seamless dual-currency integration:
  - **SSLCommerz:** Native Bangladeshi Taka (BDT) checkout supporting bKash, Nagad, Rocket, and local debit/credit cards with IPN (Instant Payment Notification) validation.
  - **Stripe:** Global USD support with Checkout Sessions, webhooks, and raw signature verification via `stripe-signature`.
- **Row-Locked Refund Orchestration:** Admin-supervised refund operations guarded by strict database row-level locking to prevent double-refund race conditions and ensure idempotent ledger reconciliation.

### 📊 Multi-Domain Admin Analytics & Auditing
- **Operational Dashboards:** Aggregated system telemetry including active emergency requests, blood group availability heatmaps, geographic distribution across Bangladesh divisions/districts, and donation completion ratios.
- **Financial Audit Log:** Immutable audit trails for every platform contribution, tracking gateway transaction IDs, payment statuses (`PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`), and admin actions.

---

## 3. Technology Stack

PulseBridge Backend is built using a modern, scalable TypeScript runtime with exact dependencies pinned in `package.json`:

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | `>=20.x` (v26 LTS ready) | Server-side JavaScript runtime |
| **Language** | TypeScript | `^7.0.2` | Static typing and compile-time safety |
| **Web Framework** | Express.js | `^5.3.0` | High-performance HTTP application framework |
| **Database** | PostgreSQL | `>=16.x` | Relational ACID-compliant data storage |
| **ORM** | Prisma ORM | `^7.10.1` | Type-safe query builder, migrations, and schema modeling |
| **Database Adapter** | `@prisma/adapter-pg` / `pg` | `^7.10.1` / `^8.23.1` | Native PostgreSQL connection pooling |
| **In-Memory Cache** | Redis / ioredis | `^6.3.1` / `^6.0.0` | Session state, rate limiting, and OTP blacklist caching |
| **Validation** | Zod | `^4.6.7` | Runtime schema parsing and request payload validation |
| **Authentication** | `jsonwebtoken` / `bcrypt` | `^9.0.3` / `^6.0.0` | JWT issuance/verification & salted password hashing |
| **OAuth** | `google-auth-library` | `^11.3.4` | Google Identity token validation |
| **Email Service** | Nodemailer / EJS | `^10.6.0` / `^7.0.2` | SMTP transactional email dispatch with rendered templates |
| **Payments (BDT)** | SSLCommerz API | REST API | Local payment gateway for Bangladesh |
| **Payments (USD)** | Stripe SDK | `^20.3.1` | Global card processing and Checkout Sessions |
| **API Documentation**| Swagger UI / YAMLJS | `^5.0.1` / `^0.3.0` | Interactive OpenAPI 3.0 specification & Postman collection |
| **Security & Utilities**| Helmet / CORS / Cookie-Parser | `^8.3.0` / `^2.8.6` / `^1.4.7` | HTTP security headers, CORS protection & cookie handling |
| **Rate Limiting** | `express-rate-limit` | `^8.7.4` | DDoS and brute-force endpoint protection |
| **Testing** | Vitest / Supertest | `^5.1.0` / `^7.3.2` | Unit, integration, and HTTP route test suites |
| **Package Manager** | pnpm | `^12.21.0` | Fast, disk space efficient package manager |

---

## 4. Prerequisites & Local Installation

### Prerequisites
Before running the backend, ensure the following services are installed and active on your system:
- **Node.js:** `v20.0.0` or higher (`node -v`)
- **pnpm:** `v9.x` or `v10.x` (`pnpm -v` or `npm install -g pnpm`)
- **PostgreSQL:** Running locally or via Docker on port `5432` (`psql --version`)
- **Redis:** Running locally or via Docker on port `6379` (`redis-cli ping` returns `PONG`)

### Step-by-Step Installation

#### 1. Clone the repository
```bash
git clone https://github.com/your-org/pulsebridge.git
cd pulsebridge/pulsebridge-backend
```

#### 2. Install dependencies
```bash
pnpm install
```

#### 3. Configure environment variables
Copy the template file to `.env`:
```bash
cp .env.example .env
```

Open `.env` and fill in the required configuration variables:

| Environment Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `NODE_ENV` | Application environment mode | `development` |
| `PORT` | HTTP server listening port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/pulsebridge?schema=public` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_SECRET` | Secret key for signing Access Tokens | `super-secret-jwt-key-min-32-chars` |
| `JWT_EXPIRES_IN` | Access token lifespan | `15m` |
| `JWT_REFRESH_SECRET` | Secret key for signing Refresh Tokens | `super-secret-refresh-key-min-32-chars` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `FRONTEND_URL` | Trusted client origin for CORS & redirects | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Google OAuth Web Client ID | `your-google-client-id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET`| Google OAuth Client Secret | `GOCSPX-your-google-client-secret` |
| `GOOGLE_CALLBACK_URL` | Google OAuth redirect callback | `http://localhost:5000/api/v1/auth/google/callback` |
| `SMTP_HOST` | Transactional email SMTP server | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username / email address | `noreply.pulsebridge@gmail.com` |
| `SMTP_PASS` | SMTP app password | `your-secure-app-password` |
| `EMAIL_FROM` | Sender display name & email | `PulseBridge Support <noreply.pulsebridge@gmail.com>` |
| `SSLCOMMERZ_STORE_ID` | SSLCommerz Merchant Store ID | `pulsebridge_sandbox` |
| `SSLCOMMERZ_STORE_PASS`| SSLCommerz Merchant Password | `pulsebridge_sandbox@ssl` |
| `SSLCOMMERZ_IS_SANDBOX`| Toggle sandbox test environment | `true` |
| `STRIPE_SECRET_KEY` | Stripe Secret API Key | `sk_test_51...` |
| `STRIPE_WEBHOOK_SECRET`| Stripe Webhook Signing Secret | `whsec_...` |
| `SEED_ADMIN_PASSWORD` | Password for seeded Admin accounts | `AdminPassword123!` |

#### 4. Push Database Schema to PostgreSQL
Synchronize the Prisma schema directly to your local database:
```bash
pnpm exec prisma db push
```

#### 5. Generate Prisma Client
Generate the type-safe client bindings:
```bash
pnpm run db:generate
```

#### 6. Seed the Database
Populate the database with initial admin accounts, demo donors, recipients, and sample blood requests:
```bash
pnpm run db:seed
```

#### 7. Start the Development Server
```bash
pnpm run dev
```
The server will boot on `http://localhost:5000` with hot-reloading enabled.

---

## 5. Interactive API Documentation & Postman

PulseBridge Backend exposes an interactive OpenAPI 3.0 specification via Swagger UI along with exportable definitions:

| Endpoint | Format | Description |
| :--- | :--- | :--- |
| `http://localhost:5000/api-docs` | **Swagger UI** | Interactive browser documentation with "Try it out" execution |
| `http://localhost:5000/api/docs` | **Swagger UI (Alias)** | Secondary redirect alias to the interactive Swagger UI |
| `http://localhost:5000/api-docs.json` | **JSON Schema** | Raw OpenAPI 3.0 specification in JSON format |
| `http://localhost:5000/api-docs.yaml` | **YAML Schema** | Raw OpenAPI 3.0 specification in YAML format |
| `http://localhost:5000/api-docs/postman-collection` | **Postman Collection** | Direct JSON export compatible with Postman v2.1 import |

To test endpoints directly, authorize Swagger UI with your Bearer JWT token generated from `/api/v1/auth/login`.

---

## 6. Seeded Demo Accounts Table

The `prisma/seed.ts` script provisions pre-configured personas for testing all core role perspectives:

| Role | Name | Email | Password | Details / Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **`SUPER_ADMIN`** | System Super Admin | `superadmin@pulsebridge.com` | `AdminSecurePassword123!` | Full system governance, role escalations, database oversight |
| **`ADMIN`** | PulseBridge Administrator | `admin@pulsebridge.com` | `AdminPassword123!` | Donation verification, refund approval, analytics & moderation |
| **`DONOR`** | John Doe | `donor.john@pulsebridge.com` | `DemoPassword123!` | **Blood Group:** $O^+$ • **Location:** Dhaka • Eligible to respond |
| **`REQUESTER`** | Alice Rahman | `recipient.alice@pulsebridge.com` | `DemoPassword123!` | Emergency blood request creator • Verified contact phone |

> **Note:** Seed credentials can be customized via the `SEED_ADMIN_PASSWORD` and `ADMIN_PASSWORD` environment variables in `.env`.

---

## 7. Core API Modules Summary (`/api/v1`)

All application routes are cleanly partitioned under the `/api/v1` prefix:

```text
/api/v1
├── /health            # Server heartbeat, database status & Redis ping
├── /auth              # Registration, JWT login, Google OAuth, Refresh token, OTP
├── /users             # Profile retrieval, password updates & user preferences
├── /donors            # Donor profiles, eligibility status, location & bio updates
├── /blood-requests    # Blood request creation, public listings, filtering & updates
├── /matching          # ABO/Rh compatibility matching engine & eligible donor alerts
├── /donations         # Donation completion logs, admin verification & cooldown tracking
├── /payments          # SSLCommerz (BDT) & Stripe (USD) session initiation & webhooks
├── /refunds           # Row-locked refund status and processing
└── /admin             # Platform analytics, user role moderation & system oversight
```

### Route Breakdown

#### 🩺 Health Check (`/api/v1/`)
- `GET /api/v1/health` — Returns application uptime, timestamp, and health status of PostgreSQL and Redis connections.

#### 🔐 Authentication & Session Management (`/api/v1/auth`)
- `POST /api/v1/auth/register` — Register a new account (`DONOR` or `REQUESTER`).
- `POST /api/v1/auth/login` — Authenticate using email and password; sets secure refresh cookie.
- `POST /api/v1/auth/google` — Authenticate or auto-provision accounts via Google OAuth `idToken`.
- `GET /api/v1/auth/google` — Get Google OAuth 2.0 authorization redirect URL.
- `POST /api/v1/auth/refresh-token` — Rotate refresh token and issue a fresh access token.
- `POST /api/v1/auth/logout` — Blacklist current tokens in Redis and invalidate refresh cookie.
- `POST /api/v1/auth/forgot-password` — Dispatch 6-digit cryptographic password reset OTP.
- `POST /api/v1/auth/reset-password` — Verify reset OTP and atomically update account password.

#### 👤 Users (`/api/v1/users`)
- `GET /api/v1/users/me` — Retrieve authenticated user profile with linked donor/requester data.
- `PATCH /api/v1/users/me` — Update personal contact details, avatar, and notification settings.

#### 🩸 Donors (`/api/v1/donors`)
- `GET /api/v1/donors` — Search and filter donors by blood group, division, district, and readiness.
- `GET /api/v1/donors/:id` — Public donor profile and verified donation statistics.
- `PATCH /api/v1/donors/availability` — Toggle donor availability (`AVAILABLE` / `UNAVAILABLE`).

#### 🚨 Blood Requests (`/api/v1/blood-requests`)
- `GET /api/v1/blood-requests` — Paginated public blood requests with blood group, urgency, and location filters.
- `GET /api/v1/blood-requests/:id` — Detailed blood request information, hospital address, and emergency contact.
- `POST /api/v1/blood-requests` — Create emergency blood request (`REQUESTER`, `ADMIN`).
- `PATCH /api/v1/blood-requests/:id` — Update blood request status (`PENDING`, `FULFILLED`, `CANCELLED`).

#### 🧬 Biological Matching Engine (`/api/v1/matching`)
- `GET /api/v1/matching/compatible-donors/:requestId` — Returns biologically compatible, cooldown-eligible donors for a specific blood request based on ABO/Rh rules.

#### 🤝 Donations & Cooldown Verification (`/api/v1/donations`)
- `POST /api/v1/donations` — Log a completed blood donation (pending verification).
- `GET /api/v1/donations/my-donations` — Authenticated donor's personal donation history and cooldown countdown.
- `PATCH /api/v1/donations/:id/verify` — Admin verification of hospital receipt; activates 90-day cooldown lock.

#### 💳 Payments & Contributions (`/api/v1/payments`)
- `POST /api/v1/payments/initiate` — Initiate voluntary contribution session (SSLCommerz BDT or Stripe USD).
- `GET /api/v1/payments/:id/verify` — Authoritatively verify payment transaction status.
- `POST /api/v1/payments/sslcommerz/ipn` — Instant Payment Notification webhook handler for SSLCommerz.
- `POST /api/v1/payments/stripe/webhook` — Raw signature-verified webhook handler for Stripe events.
- `POST /api/v1/payments/:id/refund` — Admin-only row-locked contribution refund request.

#### 🛡️ Administration & Oversight (`/api/v1/admin`)
- `GET /api/v1/admin/analytics/overview` — High-level system statistics, donation volumes, and active emergencies.
- `GET /api/v1/admin/users` — Comprehensive user list with role filters and account status toggles.
- `PATCH /api/v1/admin/users/:id/role` — Update user role (`SUPER_ADMIN` only).

---

## 8. Verification & Testing Commands

To maintain strict code quality, type safety, and test coverage, run the following verification commands:

```bash
# 1. Validate Prisma Schema integrity against database definitions
pnpm run db:validate

# 2. Run TypeScript compiler type-check without emitting output
pnpm run type-check

# 3. Execute ESLint across all source and test files
pnpm run lint

# 4. Run automated test suites via Vitest
pnpm run test

# 5. Run tests with interactive UI or coverage report
pnpm run test:ui
pnpm run test:coverage
```

### Production Build & Deployment

```bash
# Build TypeScript to optimized CommonJS/ESM in dist/
pnpm run build

# Start the compiled production server
pnpm run start
```

---

## 📄 License
This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full details.

---

<p align="center">
  <b>PulseBridge</b> • Saving Lives Through Seamless, Voluntary Blood Donation Coordination.
</p>
