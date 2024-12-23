# Stage 1: Builder
FROM python:3.11-slim AS builder

# Set build-time environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=1.5.0 \
    POETRY_HOME=/opt/poetry \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# Install system dependencies and security updates
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    python3-dev \
    libpcap-dev \
    netbase \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Poetry with version verification
RUN curl -sSL https://install.python-poetry.org | python3 - && \
    cd /usr/local/bin && \
    ln -s /opt/poetry/bin/poetry && \
    poetry --version

# Set up working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./
COPY requirements.txt ./

# Install dependencies
RUN poetry install --only main --no-root && \
    rm -rf $POETRY_CACHE_DIR

# Stage 2: Production
FROM python:3.11-slim

# Set production environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    PORT=8000

# Install runtime dependencies
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    libpcap0.8 \
    netbase \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd -g 1000 reader && \
    useradd -u 1000 -g reader -s /bin/bash -m reader && \
    mkdir -p /app /app/logs /tmp/reader-service && \
    chown -R reader:reader /app /tmp/reader-service

# Set working directory
WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder --chown=reader:reader /app/.venv ./.venv

# Copy application code
COPY --chown=reader:reader ./src ./src

# Set up volumes
VOLUME ["/app/logs", "/tmp/reader-service"]

# Expose ports for application and metrics
EXPOSE 8000 9090

# Set up healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Switch to non-root user
USER reader:reader

# Set security options
LABEL security.capabilities="CAP_NET_BIND_SERVICE,CAP_NET_RAW"
LABEL security.no-new-privileges="true"

# Set entrypoint with optimized uvicorn settings
ENTRYPOINT ["uvicorn", "src.app:app", \
    "--host", "0.0.0.0", \
    "--port", "8000", \
    "--workers", "4", \
    "--limit-max-requests", "10000", \
    "--timeout-keep-alive", "120", \
    "--log-config", "src/logging_config.json"]