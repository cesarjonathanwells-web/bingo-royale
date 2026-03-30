# BingoVerse - Product Requirements Document

**Real-Time Multiplayer Bingo Platform**

| Field | Value |
|-------|-------|
| Document Type | PRD |
| Date | March 2026 |
| Version | 1.1 (Amended) |
| Status | Phase 0 Complete |
| Live URL | https://bingo-server-production-1959.up.railway.app |
| Repository | https://github.com/cesarjonathanwells-web/bingo-royale |

---

## 1. Executive Summary

BingoVerse is a real-time multiplayer bingo platform designed for the social gaming era. It reimagines the classic game of bingo with modern mechanics, social integration, and a rich progression system -- making it compelling for casual players, competitive gamers, and content creators alike.

**Phase 0 (Foundation) is complete.** The core game engine is live, supporting both 75-ball and 90-ball variants with real-time multiplayer rooms, automatic number calling, manual daubing, server-side win validation, bilingual support (EN/ES), and a modern mobile-first web experience deployed as a PWA.

### Core Bet
Social bingo is a largely untapped market. Existing apps are either too simplistic (solo auto-play) or too niche (cash gambling). BingoVerse occupies the middle ground: high-engagement, social, free-to-play with ethical monetization.

### Current State (Phase 0 -- Shipped)
- Web platform live on Railway (PWA-installable)
- Both 75-ball (American) and 90-ball (UK/European) variants
- Real-time multiplayer rooms with auto-caller
- Guest + optional registered accounts
- English and Spanish language support
- 20 win patterns for 75-ball, 3 win stages for 90-ball

### Target Launch (Phase 1): Q3 2026 -- Public launch with ranked play and power-ups
### Year-1 Revenue Target: $4.2M ARR
### Year-1 MAU Target: 500,000

---

## 2. Product Vision & Goals

### 2.1 Vision Statement

"To become the world's premier destination for live social bingo -- where every card is a shared moment, every win a community celebration, and every session leaves players wanting one more round."

### 2.2 Design Pillars

1. **Live-First**: All game modes are designed around real-time multiplayer as the default experience.
2. **Accessible Depth**: Instantly understandable to a bingo newcomer; deeply rewarding for a veteran.
3. **Social Core**: Players should feel the presence of others at every moment -- wins, near-misses, reactions.
4. **Ethical Monetization**: Revenue through cosmetics and convenience, never pay-to-win.
5. **Creator-Ready**: Built-in tools for streamers and event hosts to grow their audience inside the platform.

### 2.3 Business Goals

| Goal | Target |
|------|--------|
| DAU/MAU Ratio | >= 25% (benchmark: 18% for casual mobile games) |
| D30 Retention | >= 35% cohort retention at 30 days |
| ARPU | $0.85/month blended (free + paid users) |
| Payer Conversion | >= 6% of MAU make at least one purchase |
| App Store Rating | >= 4.5 stars on both iOS and Android |
| NPS Score | >= 55 within 6 months of launch |

---

## 3. Target Audience

### Persona 1 -- The Social Gamer ("Ria, 28")

| Field | Details |
|-------|---------|
| Demographics | Female, 24-35, urban, casual gamer |
| Motivations | Playing with friends, light competition, unwinding after work |
| Platform | Mobile-primary, web on weekends |
| Pain Points | Solo apps feel lonely; complex games feel like work |
| Wins with BingoVerse | Friend lobbies, emoji reactions, guilds, daily quests |

### Persona 2 -- The Competitive Grinder ("Marcus, 22")

| Field | Details |
|-------|---------|
| Demographics | Male, 18-28, gaming-native, achievement-oriented |
| Motivations | Ranked ladders, stat tracking, proving skill |
| Platform | Web-primary, Discord-integrated |
| Pain Points | Bingo feels luck-based; no real skill expression |
| Wins with BingoVerse | Power-up strategy, ranked leagues, leaderboards |

### Persona 3 -- The Community Host ("Dana, 34")

| Field | Details |
|-------|---------|
| Demographics | Female, 30-45, livestreamer or event organizer |
| Motivations | Entertaining an audience, building a community |
| Platform | Web (desktop), OBS-integrated |
| Pain Points | No good tool for hosting interactive bingo events live |
| Wins with BingoVerse | Host Mode, Stream Overlay, audience voting, custom boards |

---

## 4. Game Modes

### 4.1 Quick Play -- SHIPPED (Phase 0)

The bread-and-butter mode. Players create or join rooms with a shareable code. Standard 75-ball or 90-ball rules apply. First to complete a pattern wins.

- Match duration: 4-10 minutes
- Card count: 1 card per player (multi-card in Phase 2)
- Host configures: ball set (75/90), win patterns, call speed
- Chat: text chat in-room

**Current implementation:**
- Room creation with 6-character codes
- Configurable speed (1.5s to 8s between calls)
- 20 win patterns for 75-ball (rows, columns, diagonals, corners, blackout, X, T, L, cross, diamond, picture frame)
- 3 win stages for 90-ball (one line, two lines, full house)
- Server-side win validation (anti-cheat)
- 1-200 players per room

### 4.2 Private Rooms -- SHIPPED (Phase 0)

Players create a room with a shareable code. Host controls: ball set, win conditions, call speed, and player limit.

- Capacity: 1-200 players
- Room code sharing (6-character alphanumeric)
- Host can pause/resume the caller
- Host transfer on disconnect

**Not yet implemented:**
- Password protection / invite-only
- Custom themed boards
- Host manual ball draw override

### 4.3 Ranked League -- Phase 1 (Planned)

Competitive players climb through six tiers: Bronze, Silver, Gold, Platinum, Diamond, and Grandmaster. Each season (8 weeks) concludes with rewards based on peak rank.

- Ranking: Elo-based with placement matches
- Scoring: Points for finishing position, speed bonus, streak bonus
- End-of-season rewards: exclusive card skins, avatar frames, title badges

### 4.4 Live Event Mode -- Phase 2 (Planned)

A live human host runs a broadcast-quality event with voiceover, camera feed, and real-time audience interaction. Events can have virtual prize pools, sponsored themes, or charity tie-ins.

- Host Dashboard with auto-ball draw + manual override
- Synced host camera feed within the app
- Live polls, reactions, spotlights
- Up to 10,000 concurrent players per event

### 4.5 Blitz Bingo -- Phase 2 (Planned)

High-speed 30-ball variant. Numbers called every 2 seconds. Games last 90 seconds to 3 minutes.

---

## 5. Core Features

### 5.1 Real-Time Game Engine -- SHIPPED

| Feature | Description | Status |
|---------|-------------|--------|
| Ball Draw Engine | Server-side shuffled pool per room; numbers popped sequentially | **Shipped** |
| Manual Daub | Players tap to mark called numbers on their card | **Shipped** |
| Auto-Daub Mode | Optional: auto-marks called numbers | Phase 1 |
| Multi-Card Support | 1-4 cards per player | Phase 2 |
| Win Detection | Server-side instant win check; 20 pattern library + 3 win stages | **Shipped** |
| Replay System | Full game replay downloadable/shareable | Phase 2 |
| Spectator Mode | Join mid-game as spectator | **Partial** |

**Technical details (shipped):**
- WebSocket connections via Socket.IO with Redis adapter for horizontal scaling
- All game state authoritative server-side (cards generated server-side, win validated server-side)
- Automatic caller with configurable speed (1500ms - 8000ms)
- Reconnection handling with 5-minute AFK grace period
- Room state stored in Redis with 2-hour TTL auto-cleanup

### 5.2 Power-Up System -- Phase 1 (Planned)

Power-ups add strategic depth. Earned during gameplay (not purchased).

| Power-Up | Effect |
|----------|--------|
| Double Daub | Mark two numbers on next call |
| Number Peek | See the next 3 numbers before they are called |
| Wild Square | Place a wildcard on any unrevealed square |
| Shield | Protect your card from a Scramble attack |
| Scramble | Shuffle uncalled numbers on an opponent's card |
| Caller's Choice | Vote on one of three numbers to be called next |
| Ink Blot | Block one square on an opponent's card |
| Turbo Stamp | Auto-daub all remaining called numbers on one card |

### 5.3 Social & Communication

| Feature | Status |
|---------|--------|
| Text Chat (in-room) | **Shipped** |
| Emoji Reactions (24 game-aware emojis) | Phase 1 |
| Quick Chat (predefined phrases) | Phase 1 |
| Friend System (add, invite, block) | Phase 1 |
| Guilds (up to 50 players) | Phase 2 |
| Player Profiles (avatar, stats, history) | Phase 1 |
| Activity Feed | Phase 2 |

### 5.4 Progression System -- Phase 1 (Planned)

**Experience Points & Levels:** Levels 1-100 unlock cosmetic rewards, emote slots, and guild perks.

**Seasonal Battle Pass:** 8-week seasons, 50-tier free + premium track.
- Price: $4.99 per season (premium tier)
- Earn rate: ~3 tiers/week at 30 min/day play

### 5.5 Achievement System -- Phase 2 (Planned)

150+ achievements spanning game modes, social actions, and milestones. Tiered: Bronze / Silver / Gold / Legendary.

---

## 6. Host & Creator Tools -- Phase 2 (Planned)

### 6.1 Host Dashboard
Advanced controls beyond current room host: manual ball draw, eliminate player, highlight winner, trigger confetti, launch live polls.

### 6.2 Stream Overlay Kit
Browser-based OBS/Streamlabs overlay: current called number, history strip, active power-ups, live player count, animated win announcements.

### 6.3 Creator Program
Verified creators unlock: Creator Badge, 5% affiliate revenue, custom lobby URL, event scheduling priority, exclusive cosmetics, analytics dashboard.

---

## 7. Technical Architecture

### 7.1 Architecture Overview -- SHIPPED

BingoVerse runs on a real-time event-driven architecture. WebSocket connections maintain persistent state between client and server. All game logic is authoritative server-side.

#### Current Stack (Shipped)

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | Vite + React 19 + TanStack Router |
| State Management | Zustand |
| Styling | Tailwind CSS v4 + Radix UI |
| Real-Time | Socket.IO v4 (WebSocket + polling fallback) |
| Backend | Express 5 + Socket.IO |
| Database | PostgreSQL 16 (Railway) + Drizzle ORM |
| Cache / Pub-Sub | Redis (Railway) + @socket.io/redis-adapter |
| Auth | Guest UUID + optional email/password (bcrypt + JWT) |
| i18n | i18next + react-i18next (EN + ES) |
| Validation | Zod (shared schemas) |
| Language | TypeScript (strict) throughout |
| Deployment | Railway (Docker) + GitHub Actions CI/CD |

#### Planned Stack Additions (Phase 1-2)

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (iOS + Android) sharing @bingo/shared package |
| Media | Cloudflare Stream for host video (Live Events) |
| Voice | Agora.io SDK for in-room voice (Phase 2) |
| CDN / Edge | Cloudflare Workers for static assets + matchmaking routing |
| Game RNG | Upgrade to ChaCha20-based CSPRNG with auditable seeds |
| Analytics | TimescaleDB for event analytics |

### 7.2 Monorepo Structure (Shipped)

```
bingo/
  packages/
    shared/           # @bingo/shared - types, game logic, patterns, events
  apps/
    server/           # Express + Socket.IO backend
    client/           # Vite + React PWA frontend
  .github/workflows/  # CI + Railway deploy
```

### 7.3 Database Schema (Shipped)

- **users**: id, display_name, email, password_hash, is_guest, locale, timestamps
- **games**: id, room_code, host_id, variant, state, speed, patterns, called_numbers, winner, timestamps
- **game_players**: game_id, user_id, card, dab_state, is_winner
- **user_stats**: user_id, games_played, games_won, total_dabs

### 7.4 Scalability Requirements

| Requirement | Current | Target (Phase 1) | Target (Year 2) |
|-------------|---------|-------------------|------------------|
| Concurrent Players | ~200 (single Railway instance) | 10,000 | 100,000 |
| Game Server Latency | < 100ms (measured) | < 100ms P95 globally | < 100ms P95 globally |
| WebSocket Connections | ~200 per instance | 5,000 per node | 5,000 per node |
| Horizontal Scaling | Single instance + Redis adapter | Multiple Railway instances | Kubernetes with room affinity |
| Uptime SLA | Best-effort | 99.9% | 99.9% |

### 7.5 Security & Fair Play (Shipped)

- All game state validated server-side; client sends only daub intent
- Server-generated cards (client cannot manipulate)
- Anti-cheat win validation (marked cells verified against called numbers)
- JWT auth with 7-day expiry
- Speed and pattern validation against server-side constants

**Planned:**
- Rate limiting on all API endpoints
- Anomaly detection for statistically improbable win rates
- Account linking to prevent multi-account abuse in ranked
- PCI-DSS compliance for payments via Stripe
- GDPR and CCPA compliance

### 7.6 Platform Support

| Platform | Status |
|----------|--------|
| Web (Chrome, Firefox, Safari, Edge) | **Shipped** |
| PWA (installable, standalone, portrait) | **Shipped** |
| iOS (React Native) | Phase 1 |
| Android (React Native) | Phase 1 |
| TV / Console | Not in scope |

---

## 8. UX & Design (Shipped)

### 8.1 Visual Identity

| Token | Value |
|-------|-------|
| Primary Background | Navy #0f172a (dark mode default) |
| Ball Colors | B=#2563eb, I=#dc2626, N=#9ca3af, G=#16a34a, O=#eab308 |
| Accent | Indigo #6366f1 |
| Typography | Inter (system-ui fallback) |
| Motion | Dab bounce, ball entrance spin, confetti fall, bingo glow |

### 8.2 Mobile-First Design (Shipped)

- 48px minimum touch targets on all bingo cells
- Safe-area-inset padding for notched phones
- Prevented zoom, pull-to-refresh, text selection during gameplay
- Portrait-locked PWA with standalone display
- Responsive: vertical stack on mobile, side-by-side on desktop
- Dark mode default, light mode toggle

### 8.3 Core Game Loop (Shipped)

1. Home -> Enter display name (guest) -> Create or Join Room
2. Room Lobby -> Host configures variant, speed, patterns -> Start Game
3. Numbers auto-called at configured speed -> Players tap to daub
4. Win detected -> Server validates -> Celebration screen with winner name
5. Host can start new round or players leave

### 8.4 Internationalization (Shipped)

- English (EN) and Spanish (ES) with complete translations
- Language detection from browser locale
- Switchable via header toggle
- All game text, pattern names, and UI labels translated with proper diacritical marks

### 8.5 Accessibility (Planned Improvements)

- [x] Min 48px touch targets
- [x] Dark/light theme toggle
- [ ] WCAG 2.1 AA compliance audit
- [ ] High-contrast mode
- [ ] Color-blind-safe dauber palette
- [ ] Screen reader support for number calls
- [ ] Auto-daub mode (accessibility)

---

## 9. KPIs & Success Metrics

### Phase 0 Success Criteria (EVALUATING)

| Criteria | Target | Status |
|----------|--------|--------|
| Core engine functional | Both variants playable | **Done** |
| Daub latency | < 100ms | **Done** |
| Critical bugs | 0 | **Done** |
| Deployment | Live on Railway | **Done** |
| Bilingual | EN + ES | **Done** |

### Growth Metrics (Post-Launch Targets)

| Metric | Month 3 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| MAU | 50,000 | 200,000 | 500,000 |
| DAU | 12,500 | 55,000 | 125,000 |
| New Registrations / Month | 20,000 | 45,000 | 60,000 |

### Revenue Metrics (Post-Launch Targets)

| Metric | Month 3 | Month 6 | Month 12 |
|--------|---------|---------|----------|
| MRR | $80K | $240K | $580K |
| ARPU (blended) | $0.40 | $0.70 | $1.00 |
| Payer Conversion | 3.5% | 5.5% | 7.0% |

---

## 10. Launch Roadmap

| Phase | Timeline | Deliverables | Status |
|-------|----------|-------------|--------|
| **Phase 0 (Foundation)** | Months 1-3 | Core engine, auth, Quick Play, Private Rooms, web PWA, bilingual | **COMPLETE** |
| **Phase 1 (Launch)** | Month 4-5 | Public launch, Ranked League S1, Power-ups, Battle Pass S1, React Native (iOS/Android), Creator Program beta, multi-card support, emoji reactions, friend system, player profiles | Planned |
| **Phase 2 (Social)** | Months 6-7 | Guilds, Activity Feed, Live Event Mode, Stream Overlay, voice chat, Blitz Bingo, Host Dashboard advanced, spectator mode full | Planned |
| **Phase 3 (Growth)** | Months 8-10 | Battle Pass S2, new power-up set, creator analytics, B2B pilot, custom board themes | Planned |
| **Phase 4 (Depth)** | Months 11-12 | Tournament mode, advanced stats, AI-generated boards, loyalty rewards, accessibility audit | Planned |

---

## 11. Phase 0 Shipped Inventory

### Packages
- `@bingo/shared` (7 files) -- Types, 75-ball + 90-ball card generation, 20 win patterns, Socket.IO event schemas, game constants
- `@bingo/server` (17 files) -- Express + Socket.IO, Drizzle ORM, Redis room store, auth, auto-caller, card generator, win validator, REST API
- `@bingo/client` (35 files) -- React 19, Tailwind v4, 6 bingo components, 5 UI primitives, 3 pages, Zustand stores, i18n, sound system, theme

### Infrastructure
- Multi-stage Dockerfile
- GitHub Actions CI + Railway deploy
- Railway: PostgreSQL + Redis + bingo-server (all running)

### Total: 69 source files, 7 commits, fully deployed

---

## 12. Risks & Mitigations

| Risk | Description | Mitigation | Priority |
|------|-------------|-----------|----------|
| Regulatory Risk | Bingo classified as gambling in some jurisdictions | No real-money prizes; legal review pre-launch | P0 |
| Cheating / Botting | Bots dominating ranked mode | Server-side state + anomaly detection + CAPTCHA | P0 |
| Retention Cliff | Novelty wears off without fresh content | 8-week seasonal cadence; creator events | P1 |
| Creator Dependency | Growth tied to few large creators | Creator diversification; in-house event team | P2 |
| Latency (Global) | High-latency regions degraded UX | Multi-region deployment; Cloudflare routing | P1 |
| App Store Policies | Virtual currency flagged as gambling | No loot boxes; cosmetic-only shop | P0 |
| Single-Server Risk | Current Railway deployment is single instance | Redis adapter already in place for horizontal scaling | P1 |

---

## 13. Open Questions

| ID | Question | Status |
|----|----------|--------|
| OQ-1 | Should chat in Live Events support text chat at 10K+ concurrent? How to moderate? | Open |
| OQ-2 | Optimal ball call interval for Quick Play -- 4s, 5s, or dynamic? | **Resolved: Configurable 1.5s-8s** |
| OQ-3 | Gate ranked mode behind minimum level (e.g., Level 5)? | Open |
| OQ-4 | Voice chat in private rooms Day-1 or Phase 2? | **Resolved: Phase 2** |
| OQ-5 | Randomized power-up deals vs. player-selected decks in ranked? | Open |
| OQ-6 | B2B (BingoVerse Pro) separate infrastructure or shared with white-label skin? | Open |
| OQ-7 | Should we rebrand from "Bingo Royale" to "BingoVerse" before public launch? | **New** |
| OQ-8 | Multi-card support: allow 1-4 cards or unlimited? Performance implications? | **New** |

---

## 14. Appendix

### 14.1 Glossary

| Term | Definition |
|------|-----------|
| Daub | To mark a called number on a bingo card |
| Full House | Completing all squares on a card (win condition in 90-ball) |
| Power-Up | A limited-use ability that modifies gameplay |
| BingoCoin (BC) | BingoVerse's premium virtual currency (Phase 1) |
| Live Event | A streamed, human-hosted game session (Phase 2) |
| Battle Pass | A seasonal reward track unlocked by XP (Phase 1) |
| Guild | A social group of up to 50 players (Phase 2) |
| Blitz Bingo | High-speed 30-ball variant (Phase 2) |
| Host Dashboard | Control panel for room creators (basic: shipped; advanced: Phase 2) |

### 14.2 Competitive Landscape

| Product | Summary |
|---------|---------|
| Bingo Blitz (Playtika) | Large player base, slot-machine monetization, weak social layer |
| Bingo Pop (Uken Games) | Casual mobile, solo focus, no live hosts |
| Jackpot Bingo (888) | Real-money gambling, heavy regulation, UK-primary |
| **BingoVerse** | Live multiplayer, creator-native, cosmetic monetization, cross-platform |

---

**Document Owner:** Product Team - BingoVerse
**Review Cycle:** Bi-weekly sprint reviews; major revision at each phase gate
**Last Updated:** March 2026 - Version 1.1 (Phase 0 Complete)
**Next Review:** Phase 1 Gate - Month 5
