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

Railway production uses the `master` branch, with deployments pinned to the merged commit.

The app is containerized with a multi-stage Docker build. In production, the Express server serves the client's built static files as a single service.


## Unreal-rendered artwork

The interface loads five ball surfaces and nine power-up/crown icons from `public/images/unreal-balls/` and `public/images/unreal-icons/`. These transparent PNGs use the existing HTML/CSS fallbacks, with no new runtime dependencies or WebGL requirement. Number labels remain live HTML.

The dedicated Unreal Engine 5.8.4 project is `assets-src/unreal-lookdev/BingoRoyaleLookdev.uproject`. Editable Blender source meshes remain in `assets-src/blender-balls/`; run `export_blender_icons.py` in Blender to export the nine beveled icons and smooth ball to `SourceMeshes/`. In Unreal, run `render_unreal.py` to rebuild the studio materials, maps, and sequences, then render through Movie Render Queue. Generated Unreal content and raw renders stay local and can be rebuilt from these scripts. `prepare_web_assets.py` downsamples the transparent renders to 256px ball textures and 192px icon textures.

The studio configuration uses software Lumen GI/reflections, a fixed manual exposure compensation of −5 EV, and a filmic tone curve. A 2100 lm / 5000 K upper-left rectangular key (120 × 180 cm, position 210, 170, 190 cm) establishes the shape; a broad 400 lm / 7000 K lower fill (300 × 300 cm, position 180, −130, −115 cm) lifts the shadows, and a 550 lm / 6500 K rim (140 × 160 cm, position −145, −95, 125 cm) separates the silhouette. Icons add a 750 lm / 5500 K frontal reflection card (300 × 250 cm, position 300, 100, 130 cm).

Resin uses metallic 0 with subtle roughness variation. Material Attributes control the balls' 0.28 clearcoat weight / 0.16 coat roughness and the enamel icons' 0.20 / 0.23 values. Gold uses metallic 1, roughness near 0.25, and no clearcoat. The ball mesh retains the smooth 96 × 64 Blender source topology (about 12,000 triangles). The final batch rendered all 14 assets as 1024px RGBA PNGs with 32 spatial samples and 64 warm-up frames; `render-manifest.json` records the verified outputs, delivery dimensions, and hashes.

Home, current-call, and history balls share one neutral shadow treatment. Only the current call receives a restrained accent halo; CSS shading remains an image-error fallback. Home floor shadows stay anchored as the balls float. Power-up controls use the authored artwork at 24px and dialogs at 28px, with emoji loading/error fallbacks. Decorative ball motion respects reduced-motion preferences. With the client dev server running, `/blender-review.html` retains its existing URL and displays the actual components, power-up bar, and dialog for local visual review without connecting to multiplayer.

## Board interaction

Both 75-ball and 90-ball boards share a short ink-stamp impact, six droplets, a fading ring, and a small number settle on newly confirmed marks. Seeded ink shapes stay consistent across renders. Existing marks, restored cards, and card switches do not replay the stamp. The daub sound follows confirmed marks, including auto-daub and power-ups, with one quiet pop per batch; invalid taps stay silent and the existing mute setting applies.

Called but unmarked numbers have a colored border and corner cue. A new call briefly accents its matching cell and 75-ball column. The closest enabled pattern receives a gold cue when one mark remains; newly completed patterns get a short light sweep, followed by a static outline. Progress uses confirmed marks and excludes active ink blocks. Claim eligibility and expiration remain server-authoritative.

All new effects respect the live `prefers-reduced-motion` setting. Reduced motion keeps the ink, called-number cues, and completed-pattern borders while removing splashes and movement. Run `node scripts/build-board-review.mjs` to create an offline interactive review at `/private/tmp/bingo-board-experience-20261105/review.html`, or open `/board-experience-review.html` on the client dev server. The fixture uses real board components and covers both variants, four cards, light/dark themes, blocked cells, and wildcard targeting.

## Mobile multi-card layout

The board chooses one to four columns from the usable width and height, giving wide screens larger cards instead of forcing every game into two columns. Single-card view measures one card independently and grows beyond the old 420px limit. Numbers, column letters, and the free-space icon scale with the card. Short screens scroll the card area at readable sizes while keeping the call strip and BINGO control available.

Pattern, progress, view selection, and host pause controls share a compact toolbar. Wide screens and landscape phones combine the header and calls, and use one action/BINGO footer row. The player/chat sidebar docks only on sufficiently wide, tall screens; other sizes use the existing drawers. Card selection moves into the toolbar where that saves a row, while portrait phones retain full-size tabs. Safe-area spacing and 44px control targets remain in place.

Use `/mobile-cards-review.html` on the client dev server to review four local cards at small portrait, tall portrait, and landscape sizes for either variant. This fixture uses the actual game components without a multiplayer connection. Run `pnpm --filter @bingo/client test` for the layout regression tests.

## Installable web app

Bingo Royale can be installed from the **Install app** button on Home or Settings. Supported Chromium browsers use their native install prompt; iPhone/iPad users get Safari's Share → Add to Home Screen instructions. The manifest launches the app at `/` in a standalone window, supports both orientations, and includes 192px/512px icons, a maskable icon, and an Apple touch icon.

The crowned blue B8 app icon is modeled in Blender and lit and rendered in Unreal Engine. Its 2048px master, install icons, and browser favicons share the same original artwork. Rebuildable geometry, Unreal studio settings, and export instructions are in `assets-src/unreal-lookdev/AppIcon/`; `render-manifest.json` records engine/version, render quality, and asset hashes.

Production builds generate a versioned `/sw.js` automatically. It precaches the built JavaScript/CSS, Unreal-rendered PNGs, install icons, and a small English/Spanish offline page. HTML navigation stays network-first; API/authentication responses, Socket.IO traffic, and voice recordings are never cached by the worker. Live multiplayer requires an internet connection. Offline launches show reconnect/retry controls instead of stale room state.

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
