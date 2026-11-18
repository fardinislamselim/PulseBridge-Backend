# PulseBridge Backend

PulseBridge is a production-oriented RESTful API engineered for blood donation coordination, donor availability matching, and emergency assistance management.

---

## Tech Stack

- **Runtime:** Node.js (v20+ / v26 LTS recommended)
- **Language:** TypeScript 7.x (Strict Mode)
- **Framework:** Express 5.x
- **Database:** PostgreSQL with Prisma ORM 7.x (`@prisma/adapter-pg`)
- **Cache / Store:** Redis via `redis` client
- **Authentication:** JWT, bcrypt, Google OAuth 2.0 via `google-auth-library` (**No Passport**)
- **Validation:** Zod
- **Security:** Helmet, CORS, express-rate-limit, HttpOnly cookies
- **Status Codes & Response Formatting:** `http-status`, `sendResponse`, centralized `AppError`
- **Testing:** Vitest & Supertest
- **Formatting & Linting:** Prettier & ESLint

---

## Getting Started

### 1. Prerequisites

- Node.js (v20+)
- PostgreSQL instance (v14+)
- Redis server (v6+)
- pnpm (or npm)

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in the required environment variables:

```bash
cp .env.example .env
```

#### Required Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | Application environment (`development`, `test`, `production`) | `development` |
| `PORT` | Server listening port | `5000` |
| `API_PREFIX` | Versioned API route prefix | `/api/v1` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |
| `BACKEND_URL` | Backend server URL | `http://localhost:5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://USER:PASSWORD@localhost:5432/pulsebridge?schema=public` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `REDIS_HOST` | Redis server host | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_USER` | Redis username | `default` |
| `REDIS_PASSWORD` | Redis password | `""` |
| `JWT_ACCESS_SECRET` | Secret key for access token signing | *Required* |
| `JWT_REFRESH_SECRET` | Secret key for refresh token signing | *Required* |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID for Google Identity Services | *Optional in Dev* |

### 3. Installation

```bash
pnpm install
```

### 4. Database Setup & Migrations

Validate and format schema:

```bash
pnpm run db:validate
pnpm run db:format
```

Apply migrations:

```bash
pnpm run db:migrate:dev
```

Generate the typed Prisma Client:

```bash
pnpm run db:generate
```

Seed initial development data:

```bash
pnpm run db:seed
```

Launch Prisma Studio GUI:

```bash
pnpm run db:studio
```

### 5. Running the Application

- **Development mode** (with live reload via `tsx`):
  ```bash
  pnpm run dev
  ```

- **Production build**:
  ```bash
  pnpm run build
  ```

- **Start production server**:
  ```bash
  pnpm run start
  ```

---

## Response & Error Contract

All API responses strictly follow the standardized format:

### Success Response (`2xx`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```
*(The `meta` object is included only when pagination is applicable).*

### Error Response (`4xx`, `5xx`)
```json
{
  "success": false,
  "statusCode": 401,
  "message": "You are not logged in. Please log in to access this resource.",
  "error": {
    "name": "AppError"
  }
}
```

---

## Authentication Endpoints (`/api/v1/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Register with email, password, name, phone |
| `POST` | `/api/v1/auth/login` | Public | Log in with email & password, sets HttpOnly cookies |
| `POST` | `/api/v1/auth/google` | Public | Log in with Google ID token credential |
| `POST` | `/api/v1/auth/refresh` | Public | Rotate refresh token and obtain new access token |
| `POST` | `/api/v1/auth/logout` | Public | Invalidate current session and clear auth cookies |
| `POST` | `/api/v1/auth/logout-all`| Authenticated | Invalidate all sessions for the authenticated user |
| `GET` | `/api/v1/auth/me` | Authenticated | Retrieve current user profile |
| `GET` | `/api/v1/auth/sessions` | Authenticated | View active refresh sessions for the current user |
| `DELETE`| `/api/v1/auth/sessions/:id`| Authenticated | Revoke a specific active session |
| `POST` | `/api/v1/auth/verify-email` | Public | Verify user email with token |
| `POST` | `/api/v1/auth/resend-verification` | Public | Resend email verification link |

---

## Available Scripts

| Script | Command | Purpose |
|---|---|---|
| `pnpm run dev` | `tsx watch src/server.ts` | Starts development server with file watching |
| `pnpm run build` | `prisma generate && tsc && tsc-alias` | Generates client, compiles TypeScript, and resolves path aliases |
| `pnpm run start` | `node dist/server.js` | Runs the compiled production server |
| `pnpm run test` | `vitest run` | Executes all test suites |
| `pnpm run test:watch` | `vitest` | Runs tests in interactive watch mode |
| `pnpm run type-check` | `tsc --noEmit` | Performs strict TypeScript type checks |
| `pnpm run lint` | `tsc --noEmit && eslint . --no-error-on-unmatched-pattern` | Lints the codebase |
| `pnpm run format` | `prettier --write "src/**/*.ts"` | Formats TypeScript source files |
| `pnpm run format:check` | `prettier --check "src/**/*.ts"` | Validates Prettier formatting |
| `pnpm run db:validate` | `prisma validate` | Validates Prisma schema syntax and relations |
| `pnpm run db:format` | `prisma format` | Formats Prisma schema files |
| `pnpm run db:generate` | `prisma generate` | Generates typed Prisma Client into `src/generated/prisma` |
| `pnpm run db:migrate:dev` | `prisma migrate dev` | Creates and applies development migrations |
| `pnpm run db:migrate:deploy` | `prisma migrate deploy` | Applies pending migrations in production |
| `pnpm run db:seed` | `tsx prisma/seed.ts` | Runs the safe development seed script |
| `pnpm run db:studio` | `prisma studio` | Opens Prisma Studio web interface |

---

## Further Documentation

- [Authentication Guide & Google OAuth Setup](docs/authentication.md)
- [Database Architecture & ERD](docs/database.md)
- [System Architecture Guide](docs/architecture.md)
- [API Specification](docs/api-specification.md)
- [Project Progress](docs/progress.md)
