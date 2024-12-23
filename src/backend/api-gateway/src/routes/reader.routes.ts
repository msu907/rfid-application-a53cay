/**
 * @fileoverview Enhanced RFID reader routes implementation for API Gateway
 * @version 1.0.0
 * @license MIT
 */

import { Router, Request, Response, NextFunction } from 'express'; // ^4.18.0
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateReaderRequest } from '../middleware/validation.middleware';
import { createRateLimiter } from '../middleware/rateLimit.middleware';
import { ProxyService } from '../services/proxy.service';
import winston from 'winston'; // ^3.8.0

// Constants for route configuration
const READER_ROLES = ['admin', 'operator', 'maintainer'] as const;

const ROUTES = {
  REGISTER: '/readers',
  GET_READER: '/readers/:id',
  UPDATE_CONFIG: '/readers/:id/config',
  LIST_READERS: '/readers',
  STREAM_READS: '/readers/:id/reads',
  PROCESS_READ: '/readers/:id/process',
  HEALTH_CHECK: '/readers/:id/health',
  METRICS: '/readers/:id/metrics'
} as const;

const RATE_LIMITS = {
  REGISTER: 10,
  CONFIG_UPDATE: 100,
  READ_PROCESSING: 1000
} as const;

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'reader-routes.log' }),
    new winston.transports.Console()
  ]
});

/**
 * Register RFID reader routes with enhanced security and monitoring
 * @param proxyService - Instance of ProxyService for routing requests
 * @returns Configured Express router
 */
export const registerReaderRoutes = (proxyService: ProxyService): Router => {
  const router = Router();

  // Reader registration endpoint
  router.post(
    ROUTES.REGISTER,
    authenticate,
    authorize(['admin']),
    createRateLimiter({ maxRequests: RATE_LIMITS.REGISTER }),
    validateReaderRequest(),
    handleRegisterReader(proxyService)
  );

  // Get reader details endpoint
  router.get(
    ROUTES.GET_READER,
    authenticate,
    authorize(READER_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const response = await proxyService.proxyRequest({
          service: 'reader',
          method: 'getReader',
          data: { readerId: req.params.id }
        });
        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update reader configuration endpoint
  router.put(
    ROUTES.UPDATE_CONFIG,
    authenticate,
    authorize(['admin', 'maintainer']),
    createRateLimiter({ maxRequests: RATE_LIMITS.CONFIG_UPDATE }),
    validateReaderRequest(),
    handleUpdateReaderConfig(proxyService)
  );

  // List readers endpoint
  router.get(
    ROUTES.LIST_READERS,
    authenticate,
    authorize(READER_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const response = await proxyService.proxyRequest({
          service: 'reader',
          method: 'listReaders',
          data: req.query
        });
        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // Process RFID read endpoint
  router.post(
    ROUTES.PROCESS_READ,
    authenticate,
    authorize(READER_ROLES),
    createRateLimiter({ maxRequests: RATE_LIMITS.READ_PROCESSING }),
    validateReaderRequest(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const response = await proxyService.proxyRequest({
          service: 'reader',
          method: 'processRead',
          data: {
            readerId: req.params.id,
            readData: req.body
          }
        });
        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // Reader health check endpoint
  router.get(
    ROUTES.HEALTH_CHECK,
    authenticate,
    authorize(READER_ROLES),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const health = await proxyService.healthCheck(req.params.id);
        res.json(health);
      } catch (error) {
        next(error);
      }
    }
  );

  // Reader metrics endpoint
  router.get(
    ROUTES.METRICS,
    authenticate,
    authorize(['admin', 'maintainer']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const response = await proxyService.proxyRequest({
          service: 'reader',
          method: 'getMetrics',
          data: { readerId: req.params.id }
        });
        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};

/**
 * Handle reader registration with enhanced validation
 * @param proxyService - ProxyService instance
 */
const handleRegisterReader = (proxyService: ProxyService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Processing reader registration request', {
        readerId: req.body.reader_id,
        location: req.body.location_id
      });

      const response = await proxyService.proxyRequest({
        service: 'reader',
        method: 'registerReader',
        data: req.body,
        metadata: proxyService.createMetadata(req.headers as any)
      });

      // Perform initial health check
      await proxyService.healthCheck(req.body.reader_id);

      logger.info('Reader registration successful', {
        readerId: req.body.reader_id,
        response
      });

      res.status(201).json(response);
    } catch (error) {
      logger.error('Reader registration failed', {
        readerId: req.body.reader_id,
        error
      });
      next(error);
    }
  };
};

/**
 * Handle reader configuration updates with validation
 * @param proxyService - ProxyService instance
 */
const handleUpdateReaderConfig = (proxyService: ProxyService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Processing reader configuration update', {
        readerId: req.params.id,
        config: req.body
      });

      // Validate reader health before update
      const health = await proxyService.healthCheck(req.params.id);
      if (!health.status) {
        throw new Error('Reader is not healthy');
      }

      const response = await proxyService.proxyRequest({
        service: 'reader',
        method: 'updateConfig',
        data: {
          readerId: req.params.id,
          config: req.body
        },
        metadata: proxyService.createMetadata(req.headers as any)
      });

      logger.info('Reader configuration update successful', {
        readerId: req.params.id,
        response
      });

      res.json(response);
    } catch (error) {
      logger.error('Reader configuration update failed', {
        readerId: req.params.id,
        error
      });
      next(error);
    }
  };
};

export default registerReaderRoutes;