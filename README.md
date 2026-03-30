# Bingo Royale

Real-time multiplayer bingo game with competitive gameplay mechanics.

## Tech Stack

- **Monorepo**: pnpm workspaces + Turborepo
- **Frontend**: React 19, Vite, TailwindCSS, Zustand, TanStack Router
- **Backend**: Express 5, Socket.IO, Drizzle ORM
- **Database**: PostgreSQL
- **Cache/Realtime**: Redis (Socket.IO adapter)
- **Language**: TypeScript throughout
- **Deployment**: Railway (Docker)

## Local Development

### Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL
- Redis

### Setup

```bash
git clone https://github.com/cesarjonathanwells-web/bingo-royale.git
cd bingo-royale
pnpm install
cp .env.example .env
pnpm dev
```

This starts both the server (port 3000) and the client dev server (port 5173) concurrently.

### Database

```bash
# Push schema to database
pnpm --filter @bingo/server db:push

# Generate a migration
pnpm --filter @bingo/server db:generate

# Run migrations
pnpm --filter @bingo/server db:migrate
```

## Environment Variables

| Variable       | Description                       | Default                  |
| -------------- | --------------------------------- | ------------------------ |
| `PORT`         | Server port                       | `3000`                   |
| `DATABASE_URL` | PostgreSQL connection string      | -                        |
| `REDIS_URL`    | Redis connection string           | -                        |
| `JWT_SECRET`   | Secret key for JWT signing        | -                        |
| `NODE_ENV`     | Environment (`development`/`production`) | `development`     |
| `CORS_ORIGIN`  | Allowed CORS origin               | `http://localhost:5173`  |

## Deployment

Push to `main` to auto-deploy to Railway via GitHub Actions.

The app is containerized with a multi-stage Docker build. In production, the Express server serves the client's built static files as a single service.
