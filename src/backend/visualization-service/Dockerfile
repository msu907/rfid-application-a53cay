# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ wget

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with exact versions and security audit
RUN npm ci --ignore-scripts \
    && npm audit \
    && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build TypeScript with optimized settings
RUN npm run build:prod \
    && npm prune --production

# Stage 2: Production
FROM node:18-alpine

# Set labels
LABEL maintainer="DevOps Team <devops@company.com>" \
      version="${BUILD_VERSION}" \
      description="Visualization Service for RFID Asset Tracking"

# Install runtime dependencies and security updates
RUN apk add --no-cache \
    tini \
    wget \
    && apk upgrade --no-cache

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY --chown=nodejs:nodejs package*.json ./
RUN npm ci --ignore-scripts --only=production \
    && npm cache clean --force

# Copy built files from builder
COPY --chown=nodejs:nodejs --from=builder /app/dist ./dist

# Create log directory with correct permissions
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384" \
    TZ=UTC

# Set up volumes
VOLUME ["/app/logs", "/app/node_modules"]

# Switch to non-root user
USER nodejs

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Resource constraints
# Note: These are soft limits that can be overridden by orchestrator
ENV NODE_OPTIONS="$NODE_OPTIONS --max-old-space-size=2048"

# Expose port
EXPOSE 3000

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start application with proper signal handling
CMD ["node", "--enable-source-maps", "dist/app.js"]

# Security hardening
RUN chmod -R 550 /app/dist \
    && chmod -R 770 /app/logs

# Apply security headers
ENV SECURITY_HEADERS="true" \
    SECURE_HEAP="true" \
    DISABLE_DEBUGGER="true"

# Set Node.js security flags
ENV NODE_OPTIONS="$NODE_OPTIONS --no-deprecation --no-warnings --security-revert=CVE-2023-23918"

# Set up APM monitoring
ENV ELASTIC_APM_ACTIVE="true" \
    ELASTIC_APM_SERVICE_NAME="visualization-service" \
    ELASTIC_APM_ENVIRONMENT="production"

# Enable Prometheus metrics
ENV ENABLE_METRICS="true" \
    METRICS_PATH="/metrics"