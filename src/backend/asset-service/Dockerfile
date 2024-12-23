# Stage 1: Build stage
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

# Set working directory
WORKDIR /build

# Optimize Maven build performance
ENV MAVEN_OPTS="-Xmx512m -XX:MaxMetaspaceSize=256m"

# Copy pom.xml first for better layer caching
COPY pom.xml .

# Download dependencies (cached if pom.xml doesn't change)
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build with production profile
RUN mvn clean package -DskipTests -P prod

# Stage 2: Runtime stage
FROM eclipse-temurin:17-jre-alpine

# Add metadata labels
LABEL maintainer="RFID Asset Tracking Team" \
      application="asset-service" \
      version="1.0.0" \
      description="RFID Asset Service for tracking and managing assets"

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install necessary runtime packages
RUN apk add --no-cache \
    curl \
    wget \
    tzdata

# Copy JAR from builder stage
COPY --from=builder /build/target/*.jar app.jar

# Set file permissions
RUN chown -R appuser:appgroup /app && \
    chmod 555 app.jar && \
    mkdir -p /tmp/heapdump && \
    chown -R appuser:appgroup /tmp/heapdump

# Set production environment variables
ENV SPRING_PROFILES_ACTIVE=prod \
    TZ=UTC \
    JAVA_OPTS="-XX:+UseContainerSupport \
               -XX:MaxRAMPercentage=75.0 \
               -XX:+UseG1GC \
               -XX:+HeapDumpOnOutOfMemoryError \
               -XX:HeapDumpPath=/tmp/heapdump/heapdump.hprof \
               -XX:+ExitOnOutOfMemoryError \
               -Djava.security.egd=file:/dev/./urandom \
               -Dfile.encoding=UTF-8"

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 8081

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=40s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/actuator/health || exit 1

# Volume for temporary files and heap dumps
VOLUME ["/tmp/heapdump"]

# Set entrypoint
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]