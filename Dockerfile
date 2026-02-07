# =============================================================================
# ArcNexus Distributed Agent
# Multi-stage build for running autonomous job processors
# =============================================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY packages/agent/package*.json ./packages/agent/
COPY packages/sdk/package*.json ./packages/sdk/

# Install dependencies
RUN npm ci --workspace=packages/agent --workspace=packages/sdk

# Copy source
COPY packages/agent ./packages/agent
COPY packages/sdk ./packages/sdk
COPY tsconfig.json ./

# Build agent
WORKDIR /app/packages/agent
RUN npm run build

# =============================================================================
# Stage 2: Runtime
# =============================================================================
FROM node:20-alpine AS runtime

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache git bash curl

# Copy built agent
COPY --from=builder /app/packages/agent/dist ./packages/agent/dist
COPY --from=builder /app/packages/agent/package.json ./packages/agent/
COPY --from=builder /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=builder /app/packages/sdk/package.json ./packages/sdk/
COPY --from=builder /app/node_modules ./node_modules

# Create agent workspace directory
RUN mkdir -p /agent/workspace /agent/data

# Set environment defaults
ENV NODE_ENV=production
ENV AGENT_WORKSPACE=/agent/workspace
ENV AGENT_DATA_DIR=/agent/data

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${AGENT_HEALTH_PORT:-3001}/health || exit 1

WORKDIR /app/packages/agent

# Run agent
CMD ["node", "dist/main.js"]
