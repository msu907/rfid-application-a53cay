# RFID Asset Tracking and Visualization System

A comprehensive enterprise solution for real-time asset tracking and visualization using fixed RFID readers. This system provides automated, accurate asset tracking by replacing manual methods with a digital solution that captures, processes, and visualizes asset movement and status information in real-time.

## 🚀 Features

- Real-time asset tracking and visualization
- Intelligent RFID read filtering and processing
- Interactive location mapping and visualization
- Comprehensive asset management and metadata
- Historical data analysis and reporting
- Role-based access control and security
- Scalable microservices architecture

## 🏗️ System Architecture

The system implements a modern microservices architecture deployed on Kubernetes:

- **Frontend**: React-based web application with TypeScript
- **Backend Services**: 
  - Asset Service (Java Spring Boot)
  - Reader Service (Python FastAPI)
  - Visualization Service (Node.js)
- **Data Storage**:
  - PostgreSQL for asset data
  - InfluxDB for time-series data
  - MinIO for object storage
  - Redis for caching

## 🛠️ Prerequisites

### Development Tools
- Node.js v18 LTS
- Java v17 LTS
- Python v3.11+
- Docker v20.10+
- Kubernetes v1.25+

### Infrastructure Requirements
- Azure Cloud subscription
- RFID reader infrastructure
- Network connectivity between readers and services

## 🚦 Quick Start

1. **Clone the Repository**
   ```bash
   git clone <repository_url>
   ```

2. **Install Dependencies**
   ```bash
   # Frontend
   cd src/web && npm install

   # Backend Services
   cd src/backend && npm install
   cd src/backend/asset-service && ./mvnw install
   cd src/backend/reader-service && pip install -r requirements.txt
   ```

3. **Configure Environment**
   - Copy example environment files:
     ```bash
     cp src/web/.env.example src/web/.env
     cp src/backend/asset-service/.env.example src/backend/asset-service/.env
     cp src/backend/reader-service/.env.example src/backend/reader-service/.env
     cp src/backend/visualization-service/.env.example src/backend/visualization-service/.env
     ```
   - Update configuration values in each .env file

4. **Start Development Environment**
   ```bash
   docker-compose up -d
   ```

## 📁 Project Structure

```
.
├── src/
│   ├── web/                 # React frontend application
│   └── backend/            # Microservices implementation
│       ├── asset-service/   # Java Spring Boot service
│       ├── reader-service/  # Python FastAPI service
│       └── visualization-service/ # Node.js service
├── infrastructure/         # Kubernetes and Terraform configs
├── .github/               # GitHub workflows and templates
└── docs/                  # Additional documentation
```

## 🔧 Development

### Local Development Setup
1. Ensure all prerequisites are installed
2. Configure local environment variables
3. Start required databases using Docker Compose
4. Run individual services in development mode

### Code Quality Standards
- TypeScript/JavaScript: ESLint + Prettier
- Java: Checkstyle + SpotBugs
- Python: Black + Pylint
- Pre-commit hooks for automated formatting
- Unit test coverage requirements: 80%+

## 🚀 Deployment

### Development Environment
```bash
kubectl apply -k infrastructure/overlays/development
```

### Production Environment
```bash
kubectl apply -k infrastructure/overlays/production
```

## 🔒 Security

- OAuth2/OIDC authentication via Auth0
- Role-based access control (RBAC)
- TLS 1.3 encryption in transit
- AES-256 encryption at rest
- Regular security scanning and updates
- Comprehensive audit logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

Please read [CONTRIBUTING.md](.github/CONTRIBUTING.md) for details on our code of conduct and development process.

## 📚 Documentation

- [Frontend Documentation](src/web/README.md)
- [Backend Documentation](src/backend/README.md)
- [API Documentation](src/backend/api-gateway/README.md)
- [Infrastructure Documentation](infrastructure/README.md)

## 🔧 Troubleshooting

Common issues and solutions can be found in our [Troubleshooting Guide](docs/troubleshooting.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Consult the documentation

## 🙏 Acknowledgments

- RFID reader hardware providers
- Open source community
- Project contributors