# ---- Stage 1: Base ----
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# ---- Stage 2: Install all dependencies ----
FROM base AS deps
WORKDIR /app

# Copy workspace config and all package.json files (for layer caching)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# ---- Stage 3: Build all packages ----
FROM deps AS build
WORKDIR /app

# Copy all source code on top of installed dependencies
COPY packages/shared/ packages/shared/
COPY apps/server/ apps/server/
COPY apps/client/ apps/client/

# Build everything via Turborepo (shared -> server + client)
RUN pnpm turbo run build

# Prune dev dependencies after build
RUN pnpm prune --prod

# ---- Stage 4: Runtime ----
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Copy package manifests (needed for Node.js module resolution)
COPY package.json pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/client/package.json apps/client/package.json
COPY packages/shared/package.json packages/shared/package.json

# Copy pruned production node_modules from the build stage
# (symlinks get dereferenced by COPY, which is fine for third-party deps)
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy built artifacts
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/client/dist ./apps/client/dist

# Fix workspace symlinks: Docker COPY dereferences symlinks, so @bingo/shared
# in node_modules is a stale copy. Replace with symlinks to the actual packages.
RUN rm -rf node_modules/@bingo/shared && \
    mkdir -p node_modules/@bingo && \
    ln -s ../../packages/shared node_modules/@bingo/shared

EXPOSE 3000

CMD ["node", "apps/server/dist/index.js"]
