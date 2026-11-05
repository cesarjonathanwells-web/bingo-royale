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

The studio look uses deterministic Cycles CPU renders (64 samples, denoising, seed 21), transparent RGBA PNGs, and the same AgX / None / exposure 0 / gamma 1 color pipeline for balls and icons. The upper-left key is 350 W at 5000 K; cool fill is 40 W at 7000 K; the soft rim is 60 W at 6500 K. Icons add a broad 150 W frontal reflection card to keep gold readable at small sizes. Resin uses metallic 0 and procedural roughness 0.27–0.33, with a 0.28 clear coat on the balls; gold uses metallic 1 and roughness 0.25. These values are calibrated to the source scripts' studio dimensions.

Home, current-call, and history balls share one neutral shadow treatment. Only the current call receives a restrained accent halo; CSS shading remains an image-error fallback. Home floor shadows stay anchored as the balls float. Power-up controls use the authored artwork at 24px and dialogs at 28px, with emoji loading/error fallbacks. Decorative ball motion respects reduced-motion preferences. The review page includes the actual power-up bar and dialog for checking both native-size artwork and accessible control labels.

## Mobile multi-card layout

Multi-card play uses the same column count for sizing and rendering, with minimum readable card widths. Short screens scroll the card area while keeping the call strip and BINGO control available. Cards are labeled and can be enlarged individually; the single-card selector keeps marks and the selected card when the viewport resizes. Nine-column 90-ball tickets no longer force overflowing 48px-wide cells.

Use `/mobile-cards-review.html` on the client dev server to review four local cards at small portrait, tall portrait, and landscape sizes for either variant. This fixture uses the actual game components without a multiplayer connection. Run `pnpm --filter @bingo/client test` for the layout regression tests.

## Installable web app

Bingo Royale can be installed from the **Install app** button on Home or Settings. Supported Chromium browsers use their native install prompt; iPhone/iPad users get Safari's Share → Add to Home Screen instructions. The manifest launches the app at `/` in a standalone window, supports both orientations, and includes 192px/512px icons, a maskable icon, and an Apple touch icon derived from the existing favicon.

Production builds generate a versioned `/sw.js` automatically. It precaches the built JavaScript/CSS, Blender PNGs, install icons, and a small English/Spanish offline page. HTML navigation stays network-first; API/authentication responses, Socket.IO traffic, and voice recordings are never cached by the worker. Live multiplayer requires an internet connection. Offline launches show reconnect/retry controls instead of stale room state.

Updates wait until all existing app tabs/windows close; there is no forced reload during a game. Settings shows when an update is waiting. Production serves HTML, the manifest, and the worker with `Cache-Control: no-cache`; hashed build assets are immutable. Direct links such as `/room/ABC123` use the Express 5 SPA fallback, while missing API endpoints and assets remain 404s.

PWA registration runs only in production builds on HTTPS (or localhost for testing). Client tests cover worker cache boundaries, offline navigation, and icon dimensions; server tests cover deep links and caching headers. Run `pnpm --filter @bingo/client test` and `pnpm --filter @bingo/server test`. Browser QA should include install guidance, offline/reconnect, and a waiting service-worker update without a page reload.

## Power-ups

Each player receives two different, single-use power-ups per round. Tap a power-up to read its effect. Card-specific powers use the selected card; Wild Square also asks you to tap the number to mark. All eight work with both 75-ball and 90-ball cards.

| Power-up | Effect |
| --- | --- |
| Double Daub | On the next draw, mark up to two available numbered cells on the selected card. A matching drawn number takes priority; bonus marks may include uncalled numbers. |
| Number Peek | Privately reveal up to three upcoming numbers. Caller’s Choice can change their order afterward. |
| Wild Square | Choose an unmarked, unblocked numbered cell and mark it even if it has not been called. |
| Shield | Protect all your cards against Scramble and Ink Blot through the next two draws. Existing ink is not removed. |
| Scramble | Change eligible numbers on a random opponent’s card. Called numbers, marks, wildcards, blocked cells, column ranges, and valid ticket layouts are preserved. |
| Caller’s Choice | Preview up to three upcoming numbers and choose which is drawn next. Previewing or cancelling does not consume the power-up; submitting a valid selection does. Stale options refresh. |
| Ink Blot | Prevent a random unmarked numbered cell on an opponent’s card from being marked through the next two draws. |
| Turbo Stamp | Immediately mark every called, unblocked number on the selected card. |

Shield and ink are active immediately and through the next two draws, then disappear on the third. A shielded attack is spent and blocked. Invalid requests, unavailable targets, and effects with nothing to change do not spend a power-up. Spectators and paused games cannot activate powers.

Effects, changed cards, and power-up inventory are stored on the server. Only the card owner receives the authoritative `game:powerup_state` snapshot. Wild and bonus marks are explicitly authorized by the server for win validation; clients cannot create their own. Caller draws, marks, claims, and power-up mutations share a per-room queue in the current single-server deployment. Multiple app replicas would require a distributed queue or room affinity.

Power-up regression tests use fake sockets and the real game services without opening a network port. They run with the existing server and client test commands.
