# RFID Asset Tracking System - Backend Services
![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Overview

Enterprise-grade RFID Asset Tracking System providing real-time visibility and management of assets through fixed RFID readers. The system is built on a microservices architecture with sub-500ms latency and 99.9% uptime guarantee.

## Architecture

### Microservices Components

- **API Gateway** (Node.js 18 LTS)
  - Request routing and authentication
  - Rate limiting and security
  - WebSocket management
  - Port: 3000

- **Asset Service** (Java 17 LTS)
  - Asset information management
  - Location tracking
  - Image storage handling
  - Port: 8081

- **Reader Service** (Python 3.11+)
  - RFID reader communication
  - Real-time data processing
  - Time-series data management
  - Ports: 8000 (API), 9090 (Metrics)

- **Visualization Service** (Node.js 18 LTS)
  - Real-time data visualization
  - Historical data views
  - WebSocket-based updates
  - Port: 3001

### Data Stores

- **PostgreSQL 14+**: Asset and location data
- **InfluxDB 2.6+**: Time-series read data
- **Redis 7.0+**: Caching and real-time updates
- **MinIO**: Asset image storage

## Getting Started

### Prerequisites

```bash
# Required software versions
Node.js >= 18.0.0
Java >= 17.0.0
Python >= 3.11.0
Docker >= 20.10.0
Docker Compose >= 2.0.0
```

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/rfid-asset-tracking/backend.git
cd backend
```

2. Copy environment template:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env` file:
```bash
# Core settings
NODE_ENV=development
LOG_LEVEL=debug

# Service ports
API_GATEWAY_PORT=3000
ASSET_SERVICE_PORT=8081
READER_SERVICE_PORT=8000
VISUALIZATION_SERVICE_PORT=3001
```

### Development Setup

1. Install dependencies for all services:
```bash
# API Gateway & Visualization Service
npm install

# Asset Service
cd asset-service
./mvnw install

# Reader Service
cd reader-service
poetry install
```

2. Start development environment:
```bash
docker-compose up -d
```

## Deployment

### Production Deployment

1. Build Docker images:
```bash
docker-compose -f docker-compose.yml build
```

2. Deploy to Kubernetes:
```bash
kubectl apply -f kubernetes/
```

### Resource Requirements

| Service | CPU | Memory | Storage |
|---------|-----|---------|----------|
| API Gateway | 0.5 CPU | 512MB | 1GB |
| Asset Service | 1.0 CPU | 1GB | 10GB |
| Reader Service | 0.5 CPU | 512MB | 5GB |
| Visualization | 0.5 CPU | 512MB | 1GB |

## Security

### Authentication

- OAuth 2.0 / JWT-based authentication
- Auth0 integration
- Role-based access control (RBAC)
- API key management for reader devices

### API Security

- Rate limiting
- CORS protection
- Helmet security headers
- Input validation
- SQL injection protection

### Network Security

- TLS 1.3 encryption
- Network isolation
- Service mesh integration
- WAF protection

## Monitoring

### Health Checks

```bash
# API Gateway
curl http://localhost:3000/health

# Asset Service
curl http://localhost:8081/actuator/health

# Reader Service
curl http://localhost:8000/health

# Visualization Service
curl http://localhost:3001/health
```

### Metrics

- Prometheus endpoints on `/metrics`
- Grafana dashboards
- Custom alerting rules
- Performance monitoring

### Logging

- Structured JSON logging
- ELK Stack integration
- Log rotation
- Audit logging

## Performance

### Optimization Targets

- Read processing latency: < 500ms
- System uptime: > 99.9%
- Concurrent users: 100+
- Read throughput: 1000 reads/second

### Caching Strategy

- Redis caching for API responses
- Asset metadata caching
- Image caching with MinIO
- Location data caching

## Development Guidelines

### Code Style

- TypeScript/Java/Python style guides
- ESLint/Checkstyle/Black formatting
- Pre-commit hooks
- Code review requirements

### Testing Requirements

- Unit test coverage > 80%
- Integration tests
- Performance tests
- Security tests

## Troubleshooting

### Common Issues

1. Service Dependencies
```bash
# Check service health
docker-compose ps
docker-compose logs [service_name]
```

2. Database Connectivity
```bash
# Verify database connections
docker-compose exec postgres psql -U postgres -d rfid_assets
docker-compose exec influxdb influx
```

3. Performance Issues
```bash
# Monitor resource usage
docker stats
kubectl top pods
```

## Support

- Documentation: `/docs`
- Issue Tracker: GitHub Issues
- Slack Channel: #rfid-support
- Email: support@rfid-tracking.com

## License

MIT License - see LICENSE file for details

## Contributors

- RFID Asset Tracking Team
- DevOps Team
- Security Team