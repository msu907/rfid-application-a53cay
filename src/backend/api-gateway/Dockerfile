# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies and security tools
RUN apk add --no-cache python3 make g++ git

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies with exact versions
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Run security audit
RUN npm run security:audit

# Stage 2: Production
FROM node:18-alpine

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Create non-root user
RUN addgroup -g 1001 nodejs && \
    adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

# Set working directory
WORKDIR /app

# Set production environment
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=2048" \
    # Enable strict security headers
    SECURE_HEADERS=true \
    # Enable rate limiting
    RATE_LIMIT_ENABLED=true

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Copy configuration files
COPY --from=builder /app/tsconfig*.json ./

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/certs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose API port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set security-related configurations
RUN npm config set ignore-scripts true && \
    npm config set unsafe-perm false

# Use tini as entrypoint
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/app.js"]

# Labels for container metadata
LABEL maintainer="RFID Asset Tracking Team" \
      version="1.0.0" \
      description="API Gateway for RFID Asset Tracking System" \
      org.opencontainers.image.source="https://github.com/rfid-asset-tracking" \
      org.opencontainers.image.licenses="MIT"

# Volume configuration for persistent data
VOLUME ["/app/node_modules", "/app/certs", "/app/logs"]