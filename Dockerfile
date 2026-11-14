
# ==========================================
# LOYCE DAIRIES PLATFORM
# REACT + EXPRESS + PRISMA
# STAGING CONTAINER
# ==========================================

# ==========================================
# STAGE 1 — BUILD APPLICATION
# ==========================================

FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y \
       --no-install-recommends \
       openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies using lockfiles.
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm ci --prefix server
RUN npm ci --prefix client

# Copy application source.
# Secrets and generated files are excluded
# by the root .dockerignore file.
COPY server/ ./server/
COPY client/ ./client/

# Generate Prisma Client and compile API.
# This placeholder is only for schema
# generation; no database is contacted.
RUN cd server \
    && DATABASE_URL="postgresql://build:build@localhost:5432/build" \
       npx prisma generate \
    && npm run build

# Build the web frontend against the
# same-origin Express API.
ARG VITE_API_BASE_URL=/api

RUN cd client \
    && VITE_API_BASE_URL="${VITE_API_BASE_URL}" \
       npm run build

# ==========================================
# STAGE 2 — RUNTIME
# ==========================================

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
    && apt-get install -y \
       --no-install-recommends \
       openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Keep Prisma CLI available for Railway's
# existing pre-deploy migration command.
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/server/node_modules ./server/node_modules

# Compiled Express API and Prisma Client.
COPY --from=builder /app/server/dist ./server/dist

# Prisma migrations and configuration.
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/prisma.config.ts ./server/prisma.config.ts

# Compiled React application.
COPY --from=builder /app/client/dist ./client/dist

WORKDIR /app/server

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "dist/index.js"]
