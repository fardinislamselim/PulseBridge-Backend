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
- PostgreSQL instance
- Redis server
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
| `DATABASE_URL` | PostgreSQL connection string | *Required* |
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

### 4. Database Setup

Generate the Prisma client:

```bash
pnpm run prisma:generate
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
| `pnpm run build` | `tsc && tsc-alias` | Compiles TypeScript and resolves path aliases to `dist/` |
| `pnpm run start` | `node dist/server.js` | Runs the compiled production server |
| `pnpm run test` | `vitest run` | Executes the automated test suite |
| `pnpm run test:watch` | `vitest` | Runs tests in interactive watch mode |
| `pnpm run type-check` | `tsc --noEmit` | Performs strict TypeScript type checks |
| `pnpm run lint` | `tsc --noEmit && eslint . --no-error-on-unmatched-pattern` | Lints the codebase |
| `pnpm run format` | `prettier --write "src/**/*.ts"` | Formats TypeScript source files |
| `pnpm run format:check` | `prettier --check "src/**/*.ts"` | Validates Prettier formatting |
| `pnpm run prisma:generate` | `prisma generate` | Generates the typed Prisma Client |

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
├── docs/                   # Architecture, API spec & progress tracking
├── prisma/                 # Prisma database configuration & migrations
├── src/
│   ├── config/             # Environment, Database & Redis configurations
│   ├── middlewares/        # Error handler, 404, rate limiter, logger
│   ├── modules/            # Business domain modules (auth, users, donors, etc.)
│   ├── routes/             # API routing layer
│   ├── types/              # TypeScript interfaces & types
│   ├── utils/              # ApiResponse, ApiError, asyncHandler
│   ├── app.ts              # Express application configuration
│   └── server.ts           # Server bootstrap and lifecycle
├── tests/                  # Automated integration and unit tests
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Further Documentation

- [Architecture Guide](docs/architecture.md)
- [API Specification](docs/api-specification.md)
- [Project Progress](docs/progress.md)
