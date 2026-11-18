# PulseBridge Backend

PulseBridge is a production-oriented RESTful API engineered for blood donation coordination, donor availability matching, and emergency assistance management.

---

## Tech Stack

- **Runtime:** Node.js (v20+ / v26 LTS recommended)
- **Language:** TypeScript 7.x (Strict Mode)
- **Framework:** Express 5.x
- **Database:** PostgreSQL with Prisma ORM 7.x (`@prisma/adapter-pg`)
- **Cache / Store:** Redis via `redis` client
- **Validation:** Zod
- **Security:** Helmet, CORS, express-rate-limit, bcrypt, jsonwebtoken
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

## API Health Check

Verify that the API and connected infrastructure are healthy:

```bash
curl -X GET http://localhost:5000/api/v1/health
```

### Response Example (`200 OK`)

```json
{
  "success": true,
  "message": "PulseBridge API is healthy and operational",
  "data": {
    "status": "healthy",
    "timestamp": "2026-11-18T12:00:00.000Z",
    "application": "PulseBridge",
    "services": {
      "database": "connected",
      "redis": "connected"
    }
  }
}
```

---

## Folder Structure

```
pulsebridge-backend/
├── docs/                   # Architecture, API spec, database & progress tracking
│   ├── api-specification.md
│   ├── architecture.md
│   ├── database.md
│   └── progress.md
├── prisma/                 # Prisma configuration, schemas & migrations
│   ├── migrations/         # PostgreSQL migration history
│   ├── schema/             # Modular Prisma schemas
│   └── seed.ts             # Safe development seed script
├── src/
│   ├── config/             # Environment, Database & Redis configurations
│   ├── generated/          # Generated Prisma Client
│   ├── middlewares/        # Error handler, 404, rate limiter, logger
│   ├── modules/            # Domain modules (auth, users, donors, requests, payments, admin)
│   ├── routes/             # API routing layer
│   ├── types/              # TypeScript interfaces & types
│   ├── utils/              # ApiResponse, ApiError, asyncHandler
│   ├── app.ts              # Express application configuration
│   └── server.ts           # Server bootstrap and lifecycle
├── tests/                  # Automated integration, unit and database tests
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Further Documentation

- [Database Architecture & ERD](docs/database.md)
- [System Architecture Guide](docs/architecture.md)
- [API Specification](docs/api-specification.md)
- [Project Progress](docs/progress.md)
