# PulseBridge Backend

PulseBridge is a production-oriented RESTful API engineered for blood donation coordination, donor availability matching, and emergency assistance management. Built with a function-based architecture, TypeScript, Express 5.x, PostgreSQL with Prisma ORM 7.x, and Redis.

---

## Tech Stack

- **Runtime:** Node.js (v20+ / v26 LTS recommended)
- **Language:** TypeScript 7.x (Strict Mode)
- **Framework:** Express 5.x
- **Database:** PostgreSQL with Prisma ORM 7.x (`@prisma/adapter-pg` driver adapter, multi-file schema)
- **Cache & Key-Value Store:** Redis via `ioredis` / `redis` client
- **Authentication:** JWT (Access & Refresh Token Rotation with Session Reuse Detection), bcrypt, Google OAuth 2.0 via `google-auth-library` (**No Passport**)
- **Validation:** Zod (reusable route-level validation middleware)
- **Security:** Helmet, CORS, express-rate-limit, HttpOnly cookies
- **Status Codes & Response Formatting:** `http-status`, `sendResponse`, centralized `AppError`
- **Documentation:** Swagger UI (`swagger-ui-express`, `yamljs`), OpenAPI 3.0.3, Postman Collection v2.1
- **Email Engine:** Nodemailer with EJS template layout system
- **Testing:** Vitest & Supertest
- **Formatting & Linting:** Prettier & ESLint

---

## Getting Started

### 1. Prerequisites

- Node.js (v20+)
- PostgreSQL database (v14+)
- Redis server (v6+)
- pnpm (v9+ / v12+) or npm

### 2. Environment Setup

Copy `.env.example` to `.env` and fill in your environment configurations:

```bash
cp .env.example .env
```

#### Required Environment Variables

| Variable | Description | Example / Default |
|---|---|---|
| `NODE_ENV` | Application environment (`development`, `test`, `production`) | `development` |
| `PORT` | Server listening port | `5000` |
| `API_PREFIX` | Versioned API route prefix | `/api/v1` |
| `FRONTEND_URL` | Allowed CORS origin | `http://localhost:3000` |
| `BACKEND_URL` | Backend server URL | `http://localhost:5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://USER:PASSWORD@localhost:5432/pulsebridge?schema=public` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Secret key for access token signing | *Required (min 32 chars)* |
| `JWT_REFRESH_SECRET` | Secret key for refresh token signing | *Required (min 32 chars)* |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | `7d` |
| `SEED_ADMIN_PASSWORD` | Password for default admin account created during seed | `AdminSecurePassword123!` |
| `ADMIN_EMAIL` | Default administrator email | `admin@pulsebridge.com` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID | *Optional in Dev* |

### 3. Installation

```bash
pnpm install
```

### 4. Database Setup, Migrations & Seeding

Validate and format Prisma schemas:

```bash
pnpm run db:validate
pnpm run db:format
```

Apply migrations or synchronize schema:

```bash
pnpm run db:migrate
# or direct schema push
npx prisma db push
```

Generate the typed Prisma Client:

```bash
pnpm run db:generate
```

Seed initial development data and default administrator:

```bash
pnpm run db:seed
```

> [!NOTE]
> **Default Admin Account:**
> - Email: `admin@pulsebridge.com`
> - Role: `ADMIN`
> - Status: `ACTIVE`
> - Email Verified: `true`
> - Password: Set via `SEED_ADMIN_PASSWORD` in your `.env` file.
> - The seed operation is idempotent: re-running `pnpm run db:seed` will never duplicate accounts or overwrite an existing admin password.

Launch Prisma Studio web interface:

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

## API Documentation & Postman Collection

### 1. Swagger UI & OpenAPI Documentation

When the application is running, interactive Swagger UI documentation and raw specifications are available at:

- **Swagger UI:** [http://localhost:5000/api-docs](http://localhost:5000/api-docs) (Alias: [http://localhost:5000/api/docs](http://localhost:5000/api/docs))
- **OpenAPI YAML Specification:** [http://localhost:5000/api-docs.yaml](http://localhost:5000/api-docs.yaml) (Alias: [http://localhost:5000/api/docs/openapi.yaml](http://localhost:5000/api/docs/openapi.yaml))
- **OpenAPI JSON Specification:** [http://localhost:5000/api-docs.json](http://localhost:5000/api-docs.json)

### 2. Single Postman Collection

PulseBridge includes a single, self-contained Postman collection with embedded collection variables and automated auth token scripts:

- **File Location:** [`postman/PulseBridge.postman_collection.json`](postman/PulseBridge.postman_collection.json)
- **Direct Download URL:** [http://localhost:5000/api-docs/postman-collection](http://localhost:5000/api-docs/postman-collection)
- **Usage Guide:** See [docs/postman-guide.md](docs/postman-guide.md) for step-by-step import and variable usage instructions.

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

## Testing & Quality Assurance

- **Run all automated tests:**
  ```bash
  pnpm run test
  ```
- **Type-check codebase:**
  ```bash
  pnpm run type-check
  ```
- **Run ESLint:**
  ```bash
  pnpm run lint
  ```

---

## Detailed Documentation Directory (`docs/`)

- [Architecture & System Design](docs/architecture.md)
- [Complete API Specification](docs/api-specification.md)
- [Authentication & JWT / OAuth Guide](docs/authentication.md)
- [Role Permissions & Promotion Matrix](docs/role-permissions.md)
- [Database Schema & Data Models](docs/database-schema.md)
- [Error Codes & Global Handling](docs/error-codes.md)
- [Environment Setup & Deployment Guide](docs/environment-setup.md)
- [Postman Guide & Automated Testing](docs/postman-guide.md)
- [OpenAPI 3.0 Specification](docs/openapi.yaml)
