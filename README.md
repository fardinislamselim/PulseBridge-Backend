# PulseBridge Backend — Production API Audit & API Testing Guide

PulseBridge is an enterprise-grade RESTful API engineered for voluntary blood donation coordination, intelligent ABO/Rh compatibility matching, real-time emergency assistance, and secure financial contribution processing.

This guide provides a comprehensive audit of all **65+ genuine registered endpoints**, along with an execution-order testing manual designed for testing the backend from scratch using **Postman** or **Swagger UI**.

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Prerequisites & Initial Setup](#2-prerequisites--initial-setup)
3. [Environment Configuration](#3-environment-configuration)
4. [Database Setup, Migrations & Seeding](#4-database-setup-migrations--seeding)
5. [Starting the Application & Background Services](#5-starting-the-application--background-services)
6. [Interactive Swagger & Postman Setup](#6-interactive-swagger--postman-setup)
7. [Complete Registered API Inventory](#7-complete-registered-api-inventory)
8. [End-to-End API Dependency Map](#8-end-to-end-api-dependency-map)
9. [Role-Based Access Control (RBAC) Matrix](#9-role-based-access-control-rbac-matrix)
10. [Step-by-Step API Testing Sequence (Phases 1 – 15)](#10-step-by-step-api-testing-sequence-phases-1--15)
    - [Phase 1: Health Check & System Verification](#phase-1-health-check--system-verification)
    - [Phase 2: Authentication & Token Lifecycle](#phase-2-authentication--token-lifecycle)
    - [Phase 3: Administrative Access & Seeding](#phase-3-administrative-access--seeding)
    - [Phase 4: Donor Profile & Availability](#phase-4-donor-profile--availability)
    - [Phase 5: ABO/Rh Blood Compatibility Engine](#phase-5-aborh-blood-compatibility-engine)
    - [Phase 6: Blood Request Creation & Lifecycle](#phase-6-blood-request-creation--lifecycle)
    - [Phase 7: Administrative Request Moderation](#phase-7-administrative-request-moderation)
    - [Phase 8: Intelligent Matching & Discovery](#phase-8-intelligent-matching--discovery)
    - [Phase 9: Donation Creation & Verification](#phase-9-donation-creation--verification)
    - [Phase 10: 90-Day Cooldown & Eligibility Engine](#phase-10-90-day-cooldown--eligibility-engine)
    - [Phase 11: Emergency Alerts & Notifications](#phase-11-emergency-alerts--notifications)
    - [Phase 12: Voluntary Payment Integrations (SSLCommerz & Stripe)](#phase-12-voluntary-payment-integrations-sslcommerz--stripe)
    - [Phase 13: Refund Management & Transaction Safety](#phase-13-refund-management--transaction-safety)
    - [Phase 14: Admin Dashboard & Multi-Domain Analytics](#phase-14-admin-dashboard--multi-domain-analytics)
    - [Phase 15: Administrative User & Donor Governance](#phase-15-administrative-user--donor-governance)
11. [Realistic Request Payload Samples](#11-realistic-request-payload-samples)
12. [Common Testing Errors & Troubleshooting](#12-common-testing-errors--troubleshooting)
13. [API Testing Progress Checklist](#13-api-testing-progress-checklist)
14. [Automated Verification & Test Commands](#14-automated-verification--test-commands)

---

## 1. Technology Stack

- **Runtime & Language:** Node.js (v20+ / v26 LTS recommended), TypeScript 7.x (Strict Mode)
- **Web Framework:** Express 5.x with modular router architecture
- **Database:** PostgreSQL with Prisma ORM 7.x (`@prisma/adapter-pg` native driver adapter, multi-file schema architecture)
- **Distributed Cache & Memory Store:** Redis via dual-client architecture (`redis` v6 & `ioredis` v6)
- **Authentication & Security:** JWT (Access Token + Refresh Token Session Rotation with reuse detection), bcrypt (salted hashing), Google OAuth 2.0 via `google-auth-library`, Helmet, CORS, and distributed rate limiting
- **Validation:** Zod schemas applied via centralized `validateRequest` middleware
- **Email Delivery:** Nodemailer with EJS template layout rendering
- **Payments:** Dual gateway integration supporting **SSLCommerz** (Sandbox & Live) and **Stripe** (Checkout Sessions, Webhooks, Refunds)
- **Documentation:** Interactive Swagger UI (`swagger-ui-express`, `yamljs`), OpenAPI 3.0.3 YAML/JSON specifications, and Postman Collection v2.1

---

## 2. Prerequisites & Initial Setup

Ensure the following runtimes and services are available on your machine or network:
- **Node.js:** `v20.0.0` or later
- **pnpm:** `v9.0.0` or later (`npm` or `yarn` may also be used)
- **PostgreSQL:** `v14.0` or later
- **Redis:** `v6.0` or later

Clone the repository and install project dependencies:

```bash
git clone https://github.com/your-org/pulsebridge-backend.git
cd pulsebridge-backend
pnpm install
```

---

## 3. Environment Configuration

Copy the sample environment file to create your local `.env`:

```bash
cp .env.example .env
```

### Essential Configuration Variables

| Variable | Description | Default / Recommended Local Value |
|---|---|---|
| `NODE_ENV` | Application runtime mode | `development` |
| `PORT` | Local HTTP listening port | `5000` |
| `API_PREFIX` | Versioned route prefix | `/api/v1` |
| `FRONTEND_URL` | Allowed CORS frontend origin | `http://localhost:3000` |
| `BACKEND_URL` | Self-referencing backend URL | `http://localhost:5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/pulsebridge?schema=public` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Secret key for access token signing | *Min 32 characters random string* |
| `JWT_REFRESH_SECRET` | Secret key for refresh token signing | *Min 32 characters random string* |
| `JWT_ACCESS_EXPIRES_IN` | Lifespan of short-lived access tokens | `15m` |
| `JWT_REFRESH_EXPIRES_IN`| Lifespan of rotating refresh sessions | `7d` |
| `SEED_ADMIN_PASSWORD` | Password assigned to initial seeded admin account | `AdminPassword123!` |
| `ADMIN_EMAIL` | Email address of initial seeded administrator | `admin@pulsebridge.com` |
| `ADMIN_PASSWORD` | Fallback administrator password | `AdminPassword123!` |
| `PAYMENT_DEFAULT_PROVIDER`| Default gateway provider | `SSLCOMMERZ` |
| `SSLCOMMERZ_STORE_ID` | Sandbox Store ID for SSLCommerz | *Obtained from SSLCommerz Developer Portal* |
| `SSLCOMMERZ_STORE_PASSWORD`| Sandbox Store Password | *Obtained from SSLCommerz Developer Portal* |
| `SSLCOMMERZ_IS_LIVE` | Live transaction flag | `false` |
| `STRIPE_SECRET_KEY` | Stripe secret API key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |

> [!CAUTION]
> Never commit actual secret keys, production database credentials, or email credentials to source control.

---

## 4. Database Setup, Migrations & Seeding

PulseBridge utilizes Prisma's multi-file schema feature (`prisma/schema/*.prisma`).

### Validate and Synchronize Schema
```bash
# Validate Prisma schema configuration
pnpm run db:validate

# Format all schema files
pnpm run db:format

# Push schema directly to PostgreSQL database
npx prisma db push

# Generate typed Prisma client
pnpm run db:generate
```

### Seed Development Accounts & Base Data
```bash
pnpm run db:seed
```

The seed script creates the following default accounts idempotently (existing accounts and passwords are not overwritten on re-runs):

| Email | Default Password | Role | Description |
|---|---|---|---|
| `admin@pulsebridge.com` | Set via `SEED_ADMIN_PASSWORD` | `ADMIN` | Operational administrator |
| `superadmin@pulsebridge.com` | Set via `ADMIN_PASSWORD` | `SUPER_ADMIN` | Top-level system super administrator |
| `donor.john@pulsebridge.com` | `DemoPassword123!` | `DONOR` | Verified test donor (Blood Group: `O_POSITIVE`) |
| `recipient.alice@pulsebridge.com` | `DemoPassword123!` | `REQUESTER` | Verified requester with a demo urgent blood request |

---

## 5. Starting the Application & Background Services

### Development Mode (with Live Reload)
```bash
pnpm run dev
```

The server starts on port `5000` (or `PORT` from `.env`). It verifies PostgreSQL and Redis connections, performs SMTP configuration verification, and initiates background schedulers for:
1. **Blood Request Expiration Cron:** Automatically transitions expired requests past `requiredAt` to `EXPIRED`.
2. **Payment Reconciliation Cron:** Polls pending gateway sessions older than the timeout threshold.

### Production Build & Execution
```bash
# Build TypeScript and templates
pnpm run build

# Start production runtime
pnpm run start
```

---

## 6. Interactive Swagger & Postman Setup

### Interactive Swagger UI
Open your browser to:
- **Swagger Documentation:** [http://localhost:5000/api-docs](http://localhost:5000/api-docs) (Alias: [http://localhost:5000/api/docs](http://localhost:5000/api/docs))
- **OpenAPI JSON Spec:** [http://localhost:5000/api-docs.json](http://localhost:5000/api-docs.json)
- **OpenAPI YAML Spec:** [http://localhost:5000/api-docs.yaml](http://localhost:5000/api-docs.yaml)

To authorize requests in Swagger UI:
1. Click the **Authorize** button at the top right.
2. Under `bearerAuth`, enter your access token: `Bearer <your_token>`.
3. Click **Authorize** and then **Close**. All subsequent requests will attach the `Authorization` header.

### Postman Collection Setup
1. Download the bundled Postman collection directly:
   - **Local File:** [`postman/PulseBridge.postman_collection.json`](postman/PulseBridge.postman_collection.json)
   - **HTTP Download Endpoint:** [http://localhost:5000/api-docs/postman-collection](http://localhost:5000/api-docs/postman-collection)
2. In Postman, click **Import** and select the downloaded JSON file.
3. PulseBridge uses **Collection Variables** (no separate environment file is required):
   - `baseUrl`: Defaults to `http://localhost:5000/api/v1`
   - `accessToken`: Automatically saved on login/registration/refresh
   - `refreshToken`: Automatically saved on login/registration
   - `adminToken`: Automatically saved when logging in with an admin account
4. Postman tests will automatically update these variables upon executing authentication requests.

---

## 7. Complete Registered API Inventory

Below is the verified inventory of every genuine route currently registered in the PulseBridge Express application.

### 7.1 Infrastructure, Health & Documentation

| Method | Endpoint | Auth | Role | Description | Mutates DB? |
|---|---|:---:|:---:|---|:---:|
| `GET` | `/` | Public | None | Welcome banner, version, health & docs links | No |
| `GET` | `/api-docs` | Public | None | Interactive Swagger UI documentation | No |
| `GET` | `/api-docs.json` | Public | None | OpenAPI 3.0 specification in JSON format | No |
| `GET` | `/api-docs.yaml` | Public | None | OpenAPI 3.0 specification in YAML format | No |
| `GET` | `/api-docs/postman-collection` | Public | None | Download standalone Postman collection file | No |
| `GET` | `/api/v1/health` | Public | None | System health check (PostgreSQL + Redis connectivity) | No |

### 7.2 Authentication & Session Management (`/api/v1/auth`)

| Method | Endpoint | Auth | Role | Description | Mutates DB? |
|---|---|:---:|:---:|---|:---:|
| `POST` | `/api/v1/auth/register` | Public | None | Register new user (DONOR requires bloodGroup & district; REQUESTER) | Yes |
| `POST` | `/api/v1/auth/login` | Public | None | Authenticate with email/password; returns JWT & sets HttpOnly cookie | Yes (session) |
| `GET` | `/api/v1/auth/google` | Public | None | Get Google OAuth 2.0 authorization URL | No |
| `POST` | `/api/v1/auth/google` | Public | None | Exchange Google ID token for authenticated session | Yes |
| `POST` | `/api/v1/auth/refresh` | Public | None | Rotate refresh token; generates new access and refresh tokens | Yes |
| `POST` | `/api/v1/auth/logout` | Public | None | Invalidate current session and clear refresh token cookie | Yes |
| `POST` | `/api/v1/auth/verify-email` | Public | None | Verify account email address using 6-digit OTP | Yes |
| `POST` | `/api/v1/auth/resend-verification-otp` | Public | None | Resend email verification OTP with 60-second cooldown | Yes |
| `POST` | `/api/v1/auth/resend-verification` | Public | None | Alias endpoint for resending verification OTP | Yes |
| `POST` | `/api/v1/auth/forgot-password` | Public | None | Request password reset OTP to registered email | Yes |
| `POST` | `/api/v1/auth/verify-reset-otp` | Public | None | Verify password reset OTP; returns short-lived reset token | Yes |
| `POST` | `/api/v1/auth/reset-password` | Public | None | Set new account password using reset token | Yes |
| `GET` | `/api/v1/auth/me` | Bearer / Cookie | Any | Retrieve authenticated profile and active session context | No |
| `POST` | `/api/v1/auth/logout-all` | Bearer / Cookie | Any | Terminate all active refresh sessions across all devices | Yes |
| `GET` | `/api/v1/auth/sessions` | Bearer / Cookie | Any | List all active refresh sessions for current user | No |
| `DELETE` | `/api/v1/auth/sessions/:id` | Bearer / Cookie | Any | Revoke a specific active refresh session by session ID | Yes |

### 7.3 User Profile Management (`/api/v1/users`)

| Method | Endpoint | Auth | Role | Description | Mutates DB? |
|---|---|:---:|:---:|---|:---:|
| `GET` | `/api/v1/users/me` | Bearer / Cookie | Any | Retrieve personal user profile | No |
| `PATCH` | `/api/v1/users/me` | Bearer / Cookie | Any | Update own profile (name, phone, avatar) | Yes |
| `GET` | `/api/v1/users` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Paginated user directory with role and status filtering | No |
| `GET` | `/api/v1/users/:userId` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Inspect any user's profile and administrative history | No |
| `PATCH` | `/api/v1/users/:userId/status` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Update user status (ACTIVE, BLOCKED, DELETED) | Yes |
| `PATCH` | `/api/v1/users/:userId/role` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Promote user role according to strict elevation policy | Yes |

### 7.4 Donor Management, Search & Eligibility (`/api/v1/donors`)

| Method | Endpoint | Auth | Role | Description | Mutates DB? |
|---|---|:---:|:---:|---|:---:|
| `GET` | `/api/v1/donors/me` | Bearer / Cookie | Any (DONOR) | Retrieve own donor profile | No |
| `PATCH` | `/api/v1/donors/me` | Bearer / Cookie | Any (DONOR) | Update own donor profile (bloodGroup, gender, address, location) | Yes |
| `PATCH` | `/api/v1/donors/me/availability` | Bearer / Cookie | Any (DONOR) | Toggle donor availability status (`isAvailable: true/false`) | Yes |
| `GET` | `/api/v1/donors/me/eligibility` | Bearer / Cookie | Any (DONOR) | Evaluate own medical eligibility and 90-day cooldown status | No |
| `GET` | `/api/v1/donors/search` | Bearer / Cookie | Any | Search donors with multi-criteria filters (bloodGroup, district, distance) | No |
| `GET` | `/api/v1/donors/compatible` | Bearer / Cookie | Any | Discover compatible donors for a specific blood group | No |
| `GET` | `/api/v1/donors/nearby` | Optional Auth | Any | Proximity radius search using geographic coordinates | No |
| `GET` | `/api/v1/donors/:donorId` | Optional Auth | Any | Public sanitized donor summary (unmasked for Admin) | No |
| `GET` | `/api/v1/donors/:donorId/eligibility`| Optional Auth | Any | Privacy-safe donor eligibility status | No |
| `GET` | `/api/v1/donors` | Optional Auth | Any | General donor directory with pagination | No |

### 7.5 Blood Requests & Lifecycle Management (`/api/v1/blood-requests`)

| Method | Endpoint | Auth | Role | Description | Mutates DB? |
|---|---|:---:|:---:|---|:---:|
| `POST` | `/api/v1/blood-requests` | Bearer / Cookie | REQUESTER, ADMIN, SUPER_ADMIN | Create a new blood donation request | Yes |
| `GET` | `/api/v1/blood-requests` | Optional Auth | Any | Public search and listing of active blood requests | No |
| `GET` | `/api/v1/blood-requests/me` | Bearer / Cookie | Any | List blood requests submitted by authenticated user | No |
| `GET` | `/api/v1/blood-requests/:requestId` | Optional Auth | Any | Detailed inspection of a specific blood request | No |
| `GET` | `/api/v1/blood-requests/:requestId/history` | Bearer / Cookie | Owner / ADMIN | Audit timeline of request status changes | No |
| `PATCH` | `/api/v1/blood-requests/:requestId` | Bearer / Cookie | Owner / ADMIN | Update details of an active request (patient, hospital, units) | Yes |
| `PATCH` | `/api/v1/blood-requests/:requestId/cancel` | Bearer / Cookie | Owner / ADMIN | Cancel request with mandatory reason | Yes |
| `PATCH` | `/api/v1/blood-requests/:requestId/approve`| Bearer / Cookie | ADMIN, SUPER_ADMIN | Approve pending request (transitions to APPROVED/MATCHING) | Yes |
| `PATCH` | `/api/v1/blood-requests/:requestId/reject` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Reject pending request with explanation reason | Yes |
| `PATCH` | `/api/v1/blood-requests/:requestId/urgency`| Bearer / Cookie | ADMIN, SUPER_ADMIN | Change request urgency (NORMAL, URGENT, EMERGENCY) | Yes |
| `PATCH` | `/api/v1/blood-requests/:requestId/expire` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Manually expire request | Yes |

### 7.6 ABO/Rh Blood Compatibility & Matching (`/api/v1/matching`)

| Method | Endpoint | Auth | Role | Description | Mutates DB? |
|---|---|:---:|:---:|---|:---:|
| `GET` | `/api/v1/matching/compatibility` | Public | None | Check compatibility between donor and recipient blood groups | No |
| `GET` | `/api/v1/matching/requests/:requestId/donors` | Optional Auth | Any | Discover matching eligible donors for a blood request | No |
| `GET` | `/api/v1/matching/find-donors` | Optional Auth | Any | Discover compatible donors matching query parameters | No |

### 7.7 Donations, History & Verification (`/api/v1/donations`)

| Method | Endpoint | Auth | Role | Description | Mutates DB? |
|---|---|:---:|:---:|---|:---:|
| `GET` | `/api/v1/donations/me` | Bearer / Cookie | DONOR, ADMIN, SUPER_ADMIN | Get own donation records and 90-day cooldown status | No |
| `POST` | `/api/v1/donations` | Bearer / Cookie | REQUESTER, ADMIN, SUPER_ADMIN | Create a donation record for a fulfilled request | Yes |
| `GET` | `/api/v1/donations` | Bearer / Cookie | Any Authenticated | List donations (Admin sees all; users see scoped records) | No |
| `GET` | `/api/v1/donations/:donationId` | Bearer / Cookie | Any Authenticated | Retrieve specific donation record details | No |
| `PATCH` | `/api/v1/donations/:donationId/verify` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Atomically verify & complete donation (updates cooldown & request units) | Yes |
| `PATCH` | `/api/v1/donations/:donationId/reject` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Reject donation record with explanation | Yes |

### 7.8 Voluntary Payments, Webhooks & Refunds (`/api/v1/payments`)

| Method | Endpoint | Auth | Role | Description | Mutates DB? |
|---|---|:---:|:---:|---|:---:|
| `POST` | `/api/v1/payments/sslcommerz/success` | Public | None | SSLCommerz payment gateway success return callback | Yes |
| `POST` | `/api/v1/payments/sslcommerz/fail` | Public | None | SSLCommerz payment failure callback | Yes |
| `POST` | `/api/v1/payments/sslcommerz/cancel` | Public | None | SSLCommerz cancellation callback | Yes |
| `POST` | `/api/v1/payments/sslcommerz/ipn` | Public | None | SSLCommerz Instant Payment Notification (IPN) server callback | Yes |
| `POST` | `/api/v1/payments/stripe/webhook` | Public | None | Stripe signed webhook event handler (signature verified) | Yes |
| `POST` | `/api/v1/payments/initiate` | Bearer / Cookie | Any Authenticated | Initiate voluntary platform support or campaign donation payment | Yes |
| `GET` | `/api/v1/payments/me` | Bearer / Cookie | Any Authenticated | List personal voluntary payment transactions | No |
| `GET` | `/api/v1/payments/statistics` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Aggregate financial volume and refund summaries | No |
| `GET` | `/api/v1/payments` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin listing of all payment transactions | No |
| `GET` | `/api/v1/payments/:paymentId` | Bearer / Cookie | Owner / ADMIN | Retrieve specific payment transaction details | No |
| `GET` | `/api/v1/payments/:paymentId/verify` | Bearer / Cookie | Owner / ADMIN | Direct server-to-server gateway verification of payment status | Yes |
| `GET` | `/api/v1/payments/:paymentId/refunds` | Bearer / Cookie | Owner / ADMIN | List refund records associated with a payment | No |
| `POST` | `/api/v1/payments/:paymentId/refund` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Initiate full or partial refund with row-level balance locking | Yes |
| `GET` | `/api/v1/refunds/:refundId` | Bearer / Cookie | Owner / ADMIN | Inspect specific refund transaction details | No |

### 7.9 Administration, Multi-Domain Analytics & Governance (`/api/v1/admin`)

| Method | Endpoint | Auth | Role | Description | Mutates DB? |
|---|---|:---:|:---:|---|:---:|
| `GET` | `/api/v1/admin/dashboard` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Legacy dashboard counts and recent audit logs | No |
| `GET` | `/api/v1/admin/dashboard/overview` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Comprehensive multi-domain platform operational statistics | No |
| `GET` | `/api/v1/admin/dashboard/recent-activities` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Chronological platform activities with privacy-safe display names | No |
| `GET` | `/api/v1/admin/analytics/users` | Bearer / Cookie | ADMIN, SUPER_ADMIN | User registration trends, role and status distributions | No |
| `GET` | `/api/v1/admin/analytics/donors` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Donor availability, medical eligibility, 90-day cooldown status | No |
| `GET` | `/api/v1/admin/analytics/blood-requests` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Request volume, urgency breakdown, fulfillment rate calculations | No |
| `GET` | `/api/v1/admin/analytics/donations` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Verified donation metrics, timeline trends, and top donors | No |
| `GET` | `/api/v1/admin/analytics/assignments` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Assignment lifecycle, acceptance rate, completion duration | No |
| `GET` | `/api/v1/admin/analytics/emergency` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Emergency request volume, response timings, alert deliveries | No |
| `GET` | `/api/v1/admin/analytics/payments` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Currency-safe collection volume, refund rates, provider split | No |
| `GET` | `/api/v1/admin/analytics/notifications` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Notification volume, channel delivery, read rates | No |
| `GET` | `/api/v1/admin/analytics/growth` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Period-over-period comparative growth rates and monthly activity | No |
| `GET` | `/api/v1/admin/audit-logs` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Paginated system audit logs | No |
| `GET` | `/api/v1/admin/users` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin user directory | No |
| `GET` | `/api/v1/admin/users/:userId` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin view user details | No |
| `PATCH` | `/api/v1/admin/users/:userId/status`| Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin update user status (ACTIVE, BLOCKED, DELETED) | Yes |
| `PATCH` | `/api/v1/admin/users/:userId/role` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin promote or demote user role | Yes |
| `GET` | `/api/v1/admin/donors` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Unmasked administrative donor directory | No |
| `GET` | `/api/v1/admin/donors/:donorId` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Full donor profile details | No |
| `PATCH` | `/api/v1/admin/donors/:donorId/verification` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Toggle verified donor badge | Yes |
| `PATCH` | `/api/v1/admin/donors/:donorId/restrictions` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Set or clear donor medical restrictions | Yes |
| `GET` | `/api/v1/admin/donors/:donorId/eligibility` | Bearer / Cookie | ADMIN, SUPER_ADMIN | View unmasked donor eligibility breakdown | No |
| `GET` | `/api/v1/admin/donors/:donorId/donation-history` | Bearer / Cookie | ADMIN, SUPER_ADMIN | View unmasked donor donation history | No |
| `GET` | `/api/v1/admin/donations` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Administrative view of all donations | No |
| `GET` | `/api/v1/admin/donations/:donationId` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Administrative view of donation details | No |
| `GET` | `/api/v1/admin/blood-requests` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Administrative view of all blood requests | No |
| `GET` | `/api/v1/admin/blood-requests/:requestId` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Administrative blood request inspection | No |
| `PATCH` | `/api/v1/admin/blood-requests/:requestId/approve` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin approve request | Yes |
| `PATCH` | `/api/v1/admin/blood-requests/:requestId/reject` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin reject request | Yes |
| `PATCH` | `/api/v1/admin/blood-requests/:requestId/urgency` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin change urgency | Yes |
| `PATCH` | `/api/v1/admin/blood-requests/:requestId/expire` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin expire request | Yes |
| `GET` | `/api/v1/admin/payments/statistics` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin payment statistics | No |
| `GET` | `/api/v1/admin/payments` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin view all payment transactions | No |
| `GET` | `/api/v1/admin/payments/:paymentId` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin view payment details | No |
| `GET` | `/api/v1/admin/payments/:paymentId/refunds` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin view payment refunds | No |
| `POST` | `/api/v1/admin/payments/:paymentId/refund` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin initiate refund | Yes |
| `GET` | `/api/v1/admin/refunds` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin list all refund records | No |
| `GET` | `/api/v1/admin/refunds/:refundId` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin view refund record details | No |
| `POST` | `/api/v1/admin/refunds/:refundId/retry` | Bearer / Cookie | ADMIN, SUPER_ADMIN | Admin retry failed refund | Yes |

---

## 8. End-to-End API Dependency Map

The following Mermaid diagram illustrates the exact prerequisite relationships between entities in PulseBridge:

```mermaid
flowchart TD
    A[Phase 1: Health Check<br/>GET /health] --> B[Phase 2: Register Users<br/>POST /auth/register]
    B --> C[Verify Email via OTP<br/>POST /auth/verify-email]
    C --> D[Login & Obtain Tokens<br/>POST /auth/login]
    
    D --> E[Phase 4: Donor Profile<br/>PATCH /donors/me]
    D --> F[Phase 6: Create Blood Request<br/>POST /blood-requests]
    
    E --> G[Toggle Availability & Medical History<br/>PATCH /donors/me/availability]
    G --> H[Check Cooldown & Eligibility<br/>GET /donors/me/eligibility]
    
    F --> I[Phase 7: Admin Moderation<br/>PATCH /admin/blood-requests/:id/approve]
    
    H & I --> J[Phase 8: ABO/Rh Matching<br/>GET /matching/requests/:id/donors]
    
    J --> K[Phase 9: Create Donation Record<br/>POST /donations]
    K --> L[Admin Verify & Complete Donation<br/>PATCH /donations/:id/verify]
    
    L --> M[Phase 10: 90-Day Cooldown Triggered<br/>Donor Ineligible for 90 Days]
    L --> N[Request Units Fulfilled<br/>Status -> FULFILLED]
    
    D --> O[Phase 12: Voluntary Contribution<br/>POST /payments/initiate]
    O --> P[Gateway Return / Webhook<br/>POST /payments/sslcommerz/ipn]
    P --> Q[Phase 13: Admin Refund<br/>POST /admin/payments/:id/refund]
    
    N & M & Q --> R[Phase 14: Multi-Domain Analytics<br/>GET /admin/dashboard/overview<br/>GET /admin/analytics/*]
```

---

## 9. Role-Based Access Control (RBAC) Matrix

PulseBridge enforces security via centralized `authenticate` and `authorize(...roles)` middlewares:

| Endpoint Resource | Public | `DONOR` | `REQUESTER` | `ADMIN` | `SUPER_ADMIN` |
|---|:---:|:---:|:---:|:---:|:---:|
| System Health (`/health`) | Allowed | Allowed | Allowed | Allowed | Allowed |
| User Registration & Login | Allowed | Allowed | Allowed | Allowed | Allowed |
| Email / OTP Verification | Allowed | Allowed | Allowed | Allowed | Allowed |
| Password Reset Flow | Allowed | Allowed | Allowed | Allowed | Allowed |
| Own Profile & Sessions (`/users/me`, `/auth/sessions`) | Denied (401) | Allowed | Allowed | Allowed | Allowed |
| Own Donor Profile (`/donors/me`) | Denied (401) | Allowed | Denied (403) | Allowed | Allowed |
| Create Blood Request (`POST /blood-requests`) | Denied (401) | Denied (403) | Allowed | Allowed | Allowed |
| Cancel Own Request (`PATCH /blood-requests/:id/cancel`) | Denied (401) | Denied (403) | Allowed (Owner) | Allowed | Allowed |
| Approve / Reject Request (`PATCH .../approve`) | Denied (401) | Denied (403) | Denied (403) | Allowed | Allowed |
| Blood Group Compatibility (`/matching/compatibility`) | Allowed | Allowed | Allowed | Allowed | Allowed |
| Discover Matching Candidates (`/matching/requests/...`) | Allowed | Allowed | Allowed | Allowed | Allowed |
| Create Donation Record (`POST /donations`) | Denied (401) | Denied (403) | Allowed (Owner) | Allowed | Allowed |
| Verify Donation (`PATCH /donations/:id/verify`) | Denied (401) | Denied (403) | Denied (403) | Allowed | Allowed |
| Initiate Payment (`POST /payments/initiate`) | Denied (401) | Allowed | Allowed | Allowed | Allowed |
| Process Refund (`POST /payments/:id/refund`) | Denied (401) | Denied (403) | Denied (403) | Allowed | Allowed |
| Admin Dashboard Overview (`/admin/dashboard/overview`) | Denied (401) | Denied (403) | Denied (403) | Allowed | Allowed |
| Platform Analytics (`/admin/analytics/*`) | Denied (401) | Denied (403) | Denied (403) | Allowed | Allowed |
| User Status Governance (`PATCH /users/:id/status`) | Denied (401) | Denied (403) | Denied (403) | Allowed | Allowed |
| Role Promotion (`PATCH /users/:id/role`) | Denied (401) | Denied (403) | Denied (403) | Allowed* | Allowed |

*\*Note: An `ADMIN` cannot modify another `ADMIN` or promote anyone to `SUPER_ADMIN`. Only `SUPER_ADMIN` has top-level authority.*

---

## 10. Step-by-Step API Testing Sequence (Phases 1 – 15)

Follow these phases in sequential order when testing a fresh installation.

### Phase 1: Health Check & System Verification
1. Call `GET {{baseUrl}}/health` (Public, no headers required).
2. Expected response: HTTP 200 with `status: "healthy"` and services `database: "connected"`, `redis: "connected"`.

### Phase 2: Authentication & Token Lifecycle
1. **Register a Donor:**
   - Call `POST {{baseUrl}}/auth/register` with role `DONOR`, `bloodGroup: "A_POSITIVE"`, `district: "Dhaka"`.
   - Save the returned `userId` and note the email used.
2. **Verify Donor Email:**
   - In development, inspect server console logs or query Redis for the OTP.
   - Call `POST {{baseUrl}}/auth/verify-email` with `{ "email": "...", "otp": "..." }`.
3. **Register a Requester:**
   - Call `POST {{baseUrl}}/auth/register` with role `REQUESTER`.
   - Verify email using `POST {{baseUrl}}/auth/verify-email`.
4. **Login as Donor:**
   - Call `POST {{baseUrl}}/auth/login` with donor credentials.
   - Save the returned `accessToken` in Postman variable `accessToken`.
5. **Token Rotation:**
   - Call `POST {{baseUrl}}/auth/refresh` (cookie or body `refreshToken`).
   - Confirm a new access token is generated.
6. **Session Inspection:**
   - Call `GET {{baseUrl}}/auth/sessions` with `Bearer {{accessToken}}` to verify active refresh session tracking.

### Phase 3: Administrative Access & Seeding
1. Ensure the database was seeded via `pnpm run db:seed`.
2. Call `POST {{baseUrl}}/auth/login` using `admin@pulsebridge.com` and password from `SEED_ADMIN_PASSWORD`.
3. Save the returned access token into Postman variable `adminToken`.
4. Test permission isolation:
   - Call `GET {{baseUrl}}/admin/dashboard/overview` with `Bearer {{accessToken}}` (Donor token) -> Expected: **HTTP 403 Forbidden**.
   - Call `GET {{baseUrl}}/admin/dashboard/overview` with `Bearer {{adminToken}}` -> Expected: **HTTP 200 OK**.

### Phase 4: Donor Profile & Availability
1. Login as Donor (`Bearer {{accessToken}}`).
2. Call `GET {{baseUrl}}/donors/me` to inspect initialized profile.
3. Call `PATCH {{baseUrl}}/donors/me` with updated phone, address, and city.
4. Call `PATCH {{baseUrl}}/donors/me/availability` with `{ "isAvailable": true }`.
5. Call `GET {{baseUrl}}/donors/me/eligibility` -> Verifies the donor is eligible and cooldown is inactive.

### Phase 5: ABO/Rh Blood Compatibility Engine
1. Call `GET {{baseUrl}}/matching/compatibility?donor=O_NEGATIVE&recipient=AB_POSITIVE` (Public).
   - Expected response: `isCompatible: true`.
2. Call `GET {{baseUrl}}/matching/compatibility?donor=AB_POSITIVE&recipient=O_POSITIVE`.
   - Expected response: `isCompatible: false`.
3. Call `GET {{baseUrl}}/matching/compatibility?bloodGroup=O_NEGATIVE`.
   - Returns the complete list of compatible donor groups and compatible recipient groups.

### Phase 6: Blood Request Creation & Lifecycle
1. Login as Requester (`Bearer {{requesterToken}}`).
2. Call `POST {{baseUrl}}/blood-requests` with realistic patient details, hospital, units, and `urgency: "NORMAL"`.
3. Save the returned `requestId`. Status starts as `PENDING`.
4. Call `GET {{baseUrl}}/blood-requests/me` -> Verifies request appears in requester's list.
5. Call `GET {{baseUrl}}/blood-requests/{{requestId}}` -> Verify unapproved request is visible.
6. Call `PATCH {{baseUrl}}/blood-requests/{{requestId}}` -> Update contact phone or patient details.

### Phase 7: Administrative Request Moderation
1. Login as Admin (`Bearer {{adminToken}}`).
2. Call `GET {{baseUrl}}/admin/blood-requests` to view pending requests.
3. Call `PATCH {{baseUrl}}/admin/blood-requests/{{requestId}}/approve`.
   - Status transitions from `PENDING` to `APPROVED` or `MATCHING`.
4. Call `GET {{baseUrl}}/blood-requests/{{requestId}}/history` -> Audit timeline logs the approval action.

### Phase 8: Intelligent Matching & Discovery
1. Call `GET {{baseUrl}}/matching/requests/{{requestId}}/donors` (using the approved `requestId`).
   - Returns eligible matching donors based on:
     - ABO/Rh compatibility
     - Availability (`isAvailable: true`)
     - Active cooldown status (excluded if < 90 days since last donation)
     - Medical restrictions (excluded if `hasMedicalRestriction: true`)
2. Call `GET {{baseUrl}}/donors/search?bloodGroup=O_POSITIVE&district=Dhaka`.

### Phase 9: Donation Creation & Verification
1. Login as Requester or Admin.
2. Call `POST {{baseUrl}}/donations` with `{ "donorProfileId": "...", "bloodRequestId": "{{requestId}}", "unitsDonated": 1 }`.
   - Donation record starts with status `PENDING`.
3. Login as Admin (`Bearer {{adminToken}}`).
4. Call `PATCH {{baseUrl}}/donations/{{donationId}}/verify` with `{ "verified": true }`.
   - Execution is wrapped in an atomic database transaction.
   - Status changes to `COMPLETED`.
   - Blood request fulfilled units increment.

### Phase 10: 90-Day Cooldown & Eligibility Engine
1. Login as the Donor whose donation was verified in Phase 9.
2. Call `GET {{baseUrl}}/donors/me/eligibility`.
   - Expected: `isEligible: false`, `isCooldownActive: true`, and `daysRemaining: 90`.
3. Call `GET {{baseUrl}}/donations/me` to view completed donation history.
4. Try to match this donor again via `GET {{baseUrl}}/matching/requests/{{requestId}}/donors` -> Donor is automatically excluded.

### Phase 11: Emergency Alerts & Notifications
1. Login as Requester.
2. Call `POST {{baseUrl}}/blood-requests` with `urgency: "EMERGENCY"`.
3. Login as Admin and call `PATCH {{baseUrl}}/admin/blood-requests/{{emergencyRequestId}}/approve`.
4. Server triggers automated emergency matching and dispatches notification alerts.
5. Login as Admin and call `GET {{baseUrl}}/admin/analytics/emergency`.

### Phase 12: Voluntary Payment Integrations (SSLCommerz & Stripe)
> [!NOTE]
> PulseBridge does not charge users for blood donations, donor matching, or emergency assistance. Payments are strictly for voluntary platform support and charitable campaigns.

#### SSLCommerz Flow
1. Login as user and call `POST {{baseUrl}}/payments/initiate`:
   ```json
   {
     "amount": 500,
     "currency": "BDT",
     "provider": "SSLCOMMERZ",
     "paymentPurpose": "PLATFORM_SUPPORT"
   }
   ```
2. Save the returned `paymentId` and open `paymentUrl` in a browser.
3. In the sandbox page, complete a test transaction.
4. Call `GET {{baseUrl}}/payments/{{paymentId}}/verify` -> Confirms state transitions to `SUCCESS`.

#### Stripe Flow
1. Call `POST {{baseUrl}}/payments/initiate` with `provider: "STRIPE"`, `currency: "USD"`, `amount: 15`.
2. Open the returned checkout session URL and complete payment using test card numbers (`4242...`).
3. Stripe triggers the webhook `POST {{baseUrl}}/payments/stripe/webhook`.

### Phase 13: Refund Management & Transaction Safety
1. Login as Admin (`Bearer {{adminToken}}`).
2. Identify a successful payment ID from Phase 12.
3. Call `POST {{baseUrl}}/admin/payments/{{paymentId}}/refund` with `{ "amount": 250, "reason": "Donor voluntary adjustment" }`.
   - Employs PostgreSQL row-level locking (`SELECT ... FOR UPDATE`) to prevent race conditions.
4. Call `GET {{baseUrl}}/payments/{{paymentId}}/refunds` to verify the partial refund record.
5. Attempt a refund exceeding the remaining balance -> Rejected with **HTTP 400 Bad Request**.

### Phase 14: Admin Dashboard & Multi-Domain Analytics
1. Login as Admin (`Bearer {{adminToken}}`).
2. Call `GET {{baseUrl}}/admin/dashboard/overview` -> Comprehensive platform counts across users, donors, requests, assignments, donations, and currency-safe payment totals.
3. Call `GET {{baseUrl}}/admin/dashboard/recent-activities?page=1&limit=20` -> Chronological activity log.
4. Call each specialized analytics endpoint with query filters (`?period=30d`):
   - `GET {{baseUrl}}/admin/analytics/users`
   - `GET {{baseUrl}}/admin/analytics/donors`
   - `GET {{baseUrl}}/admin/analytics/blood-requests`
   - `GET {{baseUrl}}/admin/analytics/donations`
   - `GET {{baseUrl}}/admin/analytics/assignments`
   - `GET {{baseUrl}}/admin/analytics/emergency`
   - `GET {{baseUrl}}/admin/analytics/payments`
   - `GET {{baseUrl}}/admin/analytics/notifications`
   - `GET {{baseUrl}}/admin/analytics/growth`

### Phase 15: Administrative User & Donor Governance
1. Call `GET {{baseUrl}}/admin/users` to review all registered accounts.
2. Call `PATCH {{baseUrl}}/admin/users/{{userId}}/status` with `{ "status": "BLOCKED" }`.
   - Verify the blocked user can no longer log in.
3. Call `PATCH {{baseUrl}}/admin/donors/{{donorId}}/verification` with `{ "isVerified": true }`.
4. Call `PATCH {{baseUrl}}/admin/donors/{{donorId}}/restrictions` with `{ "hasMedicalRestriction": true, "reason": "Temporary low hemoglobin" }`.
   - Verify donor is immediately marked ineligible in matching and discovery.

---

## 11. Realistic Request Payload Samples

### 1. Donor Registration (`POST /api/v1/auth/register`)
```json
{
  "name": "Tariqul Islam",
  "email": "tariqul.donor@example.com",
  "password": "Password123!",
  "phone": "+8801712345678",
  "role": "DONOR",
  "bloodGroup": "O_POSITIVE",
  "district": "Dhaka"
}
```

### 2. Requester Registration (`POST /api/v1/auth/register`)
```json
{
  "name": "Sultana Begum",
  "email": "sultana.requester@example.com",
  "password": "Password123!",
  "phone": "+8801812345678",
  "role": "REQUESTER"
}
```

### 3. User Login (`POST /api/v1/auth/login`)
```json
{
  "email": "tariqul.donor@example.com",
  "password": "Password123!"
}
```

### 4. Create Blood Request (`POST /api/v1/blood-requests`)
```json
{
  "patientName": "Rahim Uddin",
  "bloodGroup": "A_POSITIVE",
  "unitsRequired": 2,
  "hospitalName": "Dhaka Medical College Hospital",
  "hospitalAddress": "Secretariat Road, Dhaka 1000",
  "city": "Dhaka",
  "district": "Dhaka",
  "contactPerson": "Sultana Begum",
  "contactPhone": "+8801812345678",
  "urgency": "NORMAL",
  "requiredAt": "2026-11-25T14:00:00.000Z",
  "details": "Elective bypass surgery blood requirement."
}
```

### 5. Create Donation Record (`POST /api/v1/donations`)
```json
{
  "donorProfileId": "c5d19db8-1234-4567-89ab-cdef01234567",
  "bloodRequestId": "e8a93fb2-2345-6789-01bc-def012345678",
  "unitsDonated": 1,
  "hospitalName": "Dhaka Medical College Hospital",
  "notes": "Successful whole blood donation completed."
}
```

### 6. Voluntary Platform Contribution (`POST /api/v1/payments/initiate`)
```json
{
  "amount": 1000,
  "currency": "BDT",
  "provider": "SSLCOMMERZ",
  "paymentPurpose": "PLATFORM_SUPPORT",
  "description": "Voluntary support for server infrastructure"
}
```

---

## 12. Common Testing Errors & Troubleshooting

| HTTP Code | Error Name | Common Cause | Resolution |
|---|---|---|---|
| **400** | `ZodError` / `BadRequestError` | Missing required fields, invalid date format, or invalid enum value. | Inspect `error.issues` and correct payload fields against Zod schema. |
| **401** | `UnauthorizedError` | Missing, expired, or malformed `Authorization: Bearer <token>` header. | Call `POST /auth/login` or `POST /auth/refresh` to obtain an active token. |
| **403** | `ForbiddenError` | Authenticated user's role lacks permission for the endpoint. | Switch to an account with the required role (`ADMIN` or `SUPER_ADMIN`). |
| **404** | `NotFoundError` | Entity ID in path parameters does not exist in the database. | Verify the ID was created in an earlier prerequisite step. |
| **409** | `ConflictError` | Duplicate registration email or duplicate active assignment. | Use unique test emails or complete/cancel existing active assignments. |
| **429** | `RateLimitError` | Exceeded rate limit (e.g. >20 auth attempts / 15 min). | Wait for the window to expire or reset the Redis rate limiter keys. |
| **500** | `AppError` | Infrastructure connection failure (PostgreSQL or Redis unreachable). | Check service health at `GET /health` and confirm `.env` connection strings. |

---

## 13. API Testing Progress Checklist

- [ ] **Infrastructure & Health**
  - [ ] `GET /` — Welcome endpoint responds
  - [ ] `GET /api/v1/health` — PostgreSQL and Redis reports connected
  - [ ] `GET /api-docs` — Swagger UI loads in browser
  - [ ] `GET /api-docs/postman-collection` — Downloads valid Postman collection JSON
- [ ] **Authentication**
  - [ ] Register DONOR (`POST /auth/register`)
  - [ ] Register REQUESTER (`POST /auth/register`)
  - [ ] Verify Email with OTP (`POST /auth/verify-email`)
  - [ ] Login (`POST /auth/login`)
  - [ ] Rotate Refresh Token (`POST /auth/refresh`)
  - [ ] Inspect Active Sessions (`GET /auth/sessions`)
  - [ ] Revoke Session (`DELETE /auth/sessions/:id`)
  - [ ] Logout (`POST /auth/logout`)
- [ ] **Donor Management & Discovery**
  - [ ] Get own donor profile (`GET /donors/me`)
  - [ ] Update donor profile (`PATCH /donors/me`)
  - [ ] Toggle availability (`PATCH /donors/me/availability`)
  - [ ] Check eligibility (`GET /donors/me/eligibility`)
  - [ ] Search donors (`GET /donors/search`)
  - [ ] Proximity search (`GET /donors/nearby`)
- [ ] **Blood Requests & Moderation**
  - [ ] Create normal blood request (`POST /blood-requests`)
  - [ ] Retrieve my requests (`GET /blood-requests/me`)
  - [ ] Admin approve request (`PATCH /admin/blood-requests/:id/approve`)
  - [ ] Discover compatible donors (`GET /matching/requests/:id/donors`)
- [ ] **Donations & Cooldown Verification**
  - [ ] Submit donation record (`POST /donations`)
  - [ ] Admin verify donation (`PATCH /donations/:id/verify`)
  - [ ] Verify donor entered 90-day cooldown (`GET /donors/me/eligibility`)
  - [ ] Verify request fulfillment units updated
- [ ] **Voluntary Payments & Refunds**
  - [ ] Initiate SSLCommerz contribution (`POST /payments/initiate`)
  - [ ] Verify payment server-side (`GET /payments/:id/verify`)
  - [ ] Admin partial refund (`POST /admin/payments/:id/refund`)
- [ ] **Admin Dashboard & Analytics**
  - [ ] Overview statistics (`GET /admin/dashboard/overview`)
  - [ ] Recent activities (`GET /admin/dashboard/recent-activities`)
  - [ ] User analytics (`GET /admin/analytics/users`)
  - [ ] Donor analytics (`GET /admin/analytics/donors`)
  - [ ] Blood request analytics (`GET /admin/analytics/blood-requests`)
  - [ ] Donation analytics (`GET /admin/analytics/donations`)
  - [ ] Assignment analytics (`GET /admin/analytics/assignments`)
  - [ ] Emergency analytics (`GET /admin/analytics/emergency`)
  - [ ] Payment analytics (`GET /admin/analytics/payments`)
  - [ ] Growth analytics (`GET /admin/analytics/growth`)

---

## 14. Automated Verification & Test Commands

Run the following test and quality assurance suites to verify backend integrity:

```bash
# 1. Prisma schema validation
pnpm run db:validate

# 2. TypeScript compilation check
pnpm run type-check

# 3. ESLint style and code quality check
pnpm run lint

# 4. Run automated test suite
pnpm run test
```

### Verification Command Status
- `prisma validate`: **Passed (0 errors)**
- `prisma generate`: **Passed (Generated to src/generated/prisma in 181ms)**
- `tsc --noEmit`: **Passed (0 type errors)**
- `eslint`: **Passed (0 errors)**
- `vitest run tests/admin-dashboard-analytics.test.ts`: **Passed (17/17 tests passing)**
