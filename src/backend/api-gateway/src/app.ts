/**
 * @fileoverview Main application entry point for the API Gateway service
 * @version 1.0.0
 * @license MIT
 */

import express, { Request, Response, NextFunction } from 'express'; // ^4.18.0
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^6.0.0
import compression from 'compression'; // ^1.7.4
import morgan from 'morgan'; // ^1.10.0
import swaggerUi from 'swagger-ui-express'; // ^4.6.0
import winston from 'winston'; // ^3.8.0
import { server, rateLimit, cors as corsConfig } from './config';
import { authenticate } from './middleware/auth.middleware';
import { createRateLimiter } from './middleware/rateLimit.middleware';
import assetRouter from './routes/asset.routes';
import locationRouter from './routes/location.routes';
import registerReaderRoutes from './routes/reader.routes';
import ProxyService from './services/proxy.service';

// Initialize Express application
const app = express();

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'api-gateway.log' }),
    new winston.transports.Console()
  ]
});

// Initialize proxy service
const proxyService = new ProxyService(logger);

// Error messages
const ERROR_MESSAGES = {
  NOT_FOUND: 'Resource not found',
  INTERNAL_ERROR: 'Internal server error',
  VALIDATION_ERROR: 'Request validation failed',
  AUTHENTICATION_ERROR: 'Authentication failed',
  AUTHORIZATION_ERROR: 'Authorization failed',
  RATE_LIMIT_ERROR: 'Rate limit exceeded'
} as const;

/**
 * Configure Express middleware chain
 * @param app Express application instance
 */
const configureMiddleware = (app: express.Application): void => {
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: server.env === 'production',
    hsts: server.env === 'production',
    dnsPrefetchControl: false
  }));

  // CORS configuration
  app.use(cors({
    origin: corsConfig.origin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Compression
  app.use(compression());

  // Rate limiting
  app.use(createRateLimiter({
    enabled: true,
    windowMs: rateLimit.windowMs,
    maxRequests: rateLimit.maxRequests,
    bypassList: [],
    customHeaders: {},
    errorMessage: ERROR_MESSAGES.RATE_LIMIT_ERROR
  }));

  // Request logging
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim())
    }
  }));
};

/**
 * Configure API routes
 * @param app Express application instance
 */
const configureRoutes = (app: express.Application): void => {
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // API documentation
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(undefined, {
    swaggerOptions: {
      url: '/swagger.json'
    }
  }));

  // API routes with version prefix
  const apiRouter = express.Router();
  
  // Mount service routes
  apiRouter.use('/assets', authenticate, assetRouter);
  apiRouter.use('/locations', authenticate, locationRouter);
  apiRouter.use('/', authenticate, registerReaderRoutes(proxyService));

  // Mount versioned API router
  app.use(`/api/${server.apiVersion}`, apiRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      message: ERROR_MESSAGES.NOT_FOUND,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  });

  // Global error handler
  app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method
    });

    res.status(500).json({
      status: 'error',
      message: ERROR_MESSAGES.INTERNAL_ERROR,
      correlationId: req.correlationId,
      timestamp: new Date().toISOString()
    });
  });
};

/**
 * Start the Express server
 * @param app Express application instance
 */
const startServer = async (app: express.Application): Promise<void> => {
  try {
    const port = server.port;

    app.listen(port, () => {
      logger.info(`API Gateway started successfully`, {
        port,
        environment: server.env,
        version: server.apiVersion
      });
    });

    // Graceful shutdown handler
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Configure and start the application
configureMiddleware(app);
configureRoutes(app);
startServer(app);

// Export app for testing
export default app;