// External dependencies
import express, { json, urlencoded } from 'express'; // v4.18.2
import { Container } from 'inversify'; // v6.0.1
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v7.0.0
import morgan from 'morgan'; // v3.0.0
import winston from 'winston'; // v3.9.0
import compression from 'compression'; // v1.7.4
import * as promClient from 'prom-client'; // v14.0.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// Internal imports
import { serviceConfig, websocketConfig, securityConfig } from './config';
import { VisualizationController } from './controllers/visualization.controller';
import { WebSocketService } from './services/websocket.service';
import { RealTimeService } from './services/realtime.service';

// Initialize Express application
const app = express();

// Initialize dependency injection container
const container = new Container();

// Configure Winston logger
const logger = winston.createLogger({
  level: serviceConfig.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

/**
 * Configures comprehensive Express middleware stack
 */
function setupMiddleware(): void {
  // Security middleware
  app.use(helmet());
  app.use(cors(websocketConfig.cors));
  
  // Rate limiting
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
  }));

  // Compression and parsing
  app.use(compression());
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true }));

  // Request logging
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));

  // Request ID middleware
  app.use((req, res, next) => {
    req.id = uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
  });

  // Performance monitoring middleware
  app.use((req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds * 1000 + nanoseconds / 1e6;
      requestDurationHistogram.observe(duration);
    });
    next();
  });
}

/**
 * Configures dependency injection container
 */
function setupDependencyInjection(): void {
  // Bind configurations
  container.bind('Logger').toConstantValue(logger);
  container.bind('Config').toConstantValue(serviceConfig);

  // Bind services as singletons
  container.bind(WebSocketService).toSelf().inSingletonScope();
  container.bind(RealTimeService).toSelf().inSingletonScope();
  container.bind(VisualizationController).toSelf().inSingletonScope();

  // Bind error handler
  container.bind('ErrorHandler').toProvider((context) => {
    return (err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({ error: 'Internal server error' });
    };
  });
}

// Initialize Prometheus metrics
const requestDurationHistogram = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const activeConnectionsGauge = new promClient.Gauge({
  name: 'ws_active_connections',
  help: 'Number of active WebSocket connections'
});

/**
 * Configures API routes with authentication and validation
 */
function setupRoutes(): void {
  const visualizationController = container.get(VisualizationController);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date() });
  });

  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  });

  // API routes
  const apiRouter = express.Router();
  
  apiRouter.get('/dashboard/:userId', visualizationController.getDashboardConfig);
  apiRouter.post('/update/:widgetId', visualizationController.pushVisualizationUpdate);
  apiRouter.get('/metrics', visualizationController.getPerformanceMetrics);

  app.use('/api/v1', apiRouter);

  // Error handling middleware
  app.use(container.get('ErrorHandler'));
}

/**
 * Starts the Express and WebSocket servers
 */
async function startServer(): Promise<void> {
  try {
    // Initialize metrics collection
    promClient.collectDefaultMetrics();

    // Setup middleware and routes
    setupMiddleware();
    setupDependencyInjection();
    setupRoutes();

    // Start Express server
    const httpServer = app.listen(serviceConfig.port, () => {
      logger.info(`Visualization service started on port ${serviceConfig.port}`);
    });

    // Initialize and start WebSocket service
    const wsService = container.get(WebSocketService);
    await wsService.start();

    // Graceful shutdown handler
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  logger.error('Server startup error:', error);
  process.exit(1);
});

// Export app for testing
export { app };