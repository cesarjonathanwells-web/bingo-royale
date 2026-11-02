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


## Blender visual enhancements

The existing interface uses Blender-rendered ball surfaces, eight power-up icons, a free-space star, and the winner crown. Original layout, palette, number labels, animation timing, and game behavior are retained. Artwork uses transparent PNGs and the existing HTML/CSS fallbacks, with no new runtime dependencies or WebGL requirement.

Editable sources and rebuild scripts are in `assets-src/blender-balls/`. Run `build.py` and `icons.py` from Blender to regenerate the artwork. With the client dev server running, `/blender-review.html` displays the actual enhanced components for local review; this page is separate from the production app entry and does not connect to multiplayer.

## Mobile multi-card layout

Multi-card play uses the same column count for sizing and rendering, with minimum readable card widths. Short screens scroll the card area while keeping the call strip and BINGO control available. Cards are labeled and can be enlarged individually; the single-card selector keeps marks and the selected card when the viewport resizes. Nine-column 90-ball tickets no longer force overflowing 48px-wide cells.

Use `/mobile-cards-review.html` on the client dev server to review four local cards at small portrait, tall portrait, and landscape sizes for either variant. This fixture uses the actual game components without a multiplayer connection. Run `pnpm --filter @bingo/client test` for the layout regression tests.

## Installable web app

Bingo Royale can be installed from the **Install app** button on Home or Settings. Supported Chromium browsers use their native install prompt; iPhone/iPad users get Safari's Share → Add to Home Screen instructions. The manifest launches the app at `/` in a standalone window, supports both orientations, and includes 192px/512px icons, a maskable icon, and an Apple touch icon derived from the existing favicon.

Production builds generate a versioned `/sw.js` automatically. It precaches the built JavaScript/CSS, Blender PNGs, install icons, and a small English/Spanish offline page. HTML navigation stays network-first; API/authentication responses, Socket.IO traffic, and voice recordings are never cached by the worker. Live multiplayer requires an internet connection. Offline launches show reconnect/retry controls instead of stale room state.

Updates wait until all existing app tabs/windows close; there is no forced reload during a game. Settings shows when an update is waiting. Production serves HTML, the manifest, and the worker with `Cache-Control: no-cache`; hashed build assets are immutable. Direct links such as `/room/ABC123` use the Express 5 SPA fallback, while missing API endpoints and assets remain 404s.

PWA registration runs only in production builds on HTTPS (or localhost for testing). Client tests cover worker cache boundaries, offline navigation, and icon dimensions; server tests cover deep links and caching headers. Run `pnpm --filter @bingo/client test` and `pnpm --filter @bingo/server test`. Browser QA should include install guidance, offline/reconnect, and a waiting service-worker update without a page reload.
