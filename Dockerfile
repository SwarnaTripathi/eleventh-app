# ── Stage 1: Build React client ──────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install client deps and build
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# ── Stage 2: Production server ───────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Install server deps (production only)
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server code
COPY server/ ./server/

# Copy built React bundle from builder stage
COPY --from=builder /app/client/dist ./client/dist

# Cloud Run uses port 8080 by default
EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "server/index.js"]
