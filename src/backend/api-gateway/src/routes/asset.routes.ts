/**
 * @fileoverview Asset management routes for API Gateway
 * @version 1.0.0
 * @license MIT
 */

import { Router, Request, Response } from 'express'; // ^4.18.0
import asyncHandler from 'express-async-handler'; // ^1.2.0
import compression from 'compression'; // ^1.7.4
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateAssetRequest } from '../middleware/validation.middleware';
import ProxyService from '../services/proxy.service';
import winston from 'winston'; // ^3.8.0
import { config } from '../config';

// Constants
const ASSET_SERVICE = 'asset-service';

const ROLES = {
  ADMIN: 'admin',
  ASSET_MANAGER: 'asset_manager',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
} as const;

const REQUEST_TIMEOUT = 30000;

const RATE_LIMITS = {
  ADMIN: 1000,
  ASSET_MANAGER: 500,
  OPERATOR: 200,
  VIEWER: 100
} as const;

// Initialize router and services
const router = Router();
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'asset-routes.log' }),
    new winston.transports.Console()
  ]
});

const proxyService = new ProxyService(logger);

// Apply compression to all routes
router.use(compression());

/**
 * Create new asset
 * @route POST /api/v1/assets
 * @access Private - Admin, Asset Manager
 */
router.post('/assets',
  authenticate,
  authorize([ROLES.ADMIN, ROLES.ASSET_MANAGER]),
  rateLimit({
    windowMs: 60 * 1000,
    max: (req: Request) => {
      const role = req.user?.roles[0];
      return RATE_LIMITS[role as keyof typeof RATE_LIMITS] || RATE_LIMITS.VIEWER;
    }
  }),
  validateAssetRequest(),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const response = await proxyService.proxyRequest({
        service: ASSET_SERVICE,
        method: 'CreateAsset',
        data: req.validatedData,
        metadata: proxyService.createMetadata(req.headers as any),
        timeout: REQUEST_TIMEOUT
      });

      logger.info('Asset created successfully', {
        correlationId: req.correlationId,
        userId: req.user?.id,
        assetId: response.id
      });

      res.status(201).json({
        status: 'success',
        data: response,
        correlationId: req.correlationId
      });
    } catch (error: any) {
      logger.error('Failed to create asset', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.code || 500).json({
        status: 'error',
        message: error.message,
        correlationId: req.correlationId
      });
    }
  })
);

/**
 * Get asset by ID
 * @route GET /api/v1/assets/:id
 * @access Private - All authenticated users
 */
router.get('/assets/:id',
  authenticate,
  authorize([ROLES.VIEWER, ROLES.OPERATOR, ROLES.ASSET_MANAGER, ROLES.ADMIN]),
  rateLimit({
    windowMs: 60 * 1000,
    max: (req: Request) => {
      const role = req.user?.roles[0];
      return RATE_LIMITS[role as keyof typeof RATE_LIMITS] || RATE_LIMITS.VIEWER;
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const response = await proxyService.proxyRequest({
        service: ASSET_SERVICE,
        method: 'GetAsset',
        data: { id: req.params.id },
        metadata: proxyService.createMetadata(req.headers as any),
        timeout: REQUEST_TIMEOUT
      });

      logger.info('Asset retrieved successfully', {
        correlationId: req.correlationId,
        userId: req.user?.id,
        assetId: req.params.id
      });

      res.json({
        status: 'success',
        data: response,
        correlationId: req.correlationId
      });
    } catch (error: any) {
      logger.error('Failed to retrieve asset', {
        correlationId: req.correlationId,
        assetId: req.params.id,
        error: error.message
      });
      res.status(error.code || 500).json({
        status: 'error',
        message: error.message,
        correlationId: req.correlationId
      });
    }
  })
);

/**
 * Update asset
 * @route PUT /api/v1/assets/:id
 * @access Private - Admin, Asset Manager
 */
router.put('/assets/:id',
  authenticate,
  authorize([ROLES.ADMIN, ROLES.ASSET_MANAGER]),
  rateLimit({
    windowMs: 60 * 1000,
    max: (req: Request) => {
      const role = req.user?.roles[0];
      return RATE_LIMITS[role as keyof typeof RATE_LIMITS] || RATE_LIMITS.VIEWER;
    }
  }),
  validateAssetRequest(),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const response = await proxyService.proxyRequest({
        service: ASSET_SERVICE,
        method: 'UpdateAsset',
        data: { id: req.params.id, ...req.validatedData },
        metadata: proxyService.createMetadata(req.headers as any),
        timeout: REQUEST_TIMEOUT
      });

      logger.info('Asset updated successfully', {
        correlationId: req.correlationId,
        userId: req.user?.id,
        assetId: req.params.id
      });

      res.json({
        status: 'success',
        data: response,
        correlationId: req.correlationId
      });
    } catch (error: any) {
      logger.error('Failed to update asset', {
        correlationId: req.correlationId,
        assetId: req.params.id,
        error: error.message
      });
      res.status(error.code || 500).json({
        status: 'error',
        message: error.message,
        correlationId: req.correlationId
      });
    }
  })
);

/**
 * Delete asset
 * @route DELETE /api/v1/assets/:id
 * @access Private - Admin only
 */
router.delete('/assets/:id',
  authenticate,
  authorize([ROLES.ADMIN]),
  rateLimit({
    windowMs: 60 * 1000,
    max: RATE_LIMITS.ADMIN
  }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      await proxyService.proxyRequest({
        service: ASSET_SERVICE,
        method: 'DeleteAsset',
        data: { id: req.params.id },
        metadata: proxyService.createMetadata(req.headers as any),
        timeout: REQUEST_TIMEOUT
      });

      logger.info('Asset deleted successfully', {
        correlationId: req.correlationId,
        userId: req.user?.id,
        assetId: req.params.id
      });

      res.status(204).send();
    } catch (error: any) {
      logger.error('Failed to delete asset', {
        correlationId: req.correlationId,
        assetId: req.params.id,
        error: error.message
      });
      res.status(error.code || 500).json({
        status: 'error',
        message: error.message,
        correlationId: req.correlationId
      });
    }
  })
);

/**
 * List assets with pagination and filtering
 * @route GET /api/v1/assets
 * @access Private - All authenticated users
 */
router.get('/assets',
  authenticate,
  authorize([ROLES.VIEWER, ROLES.OPERATOR, ROLES.ASSET_MANAGER, ROLES.ADMIN]),
  rateLimit({
    windowMs: 60 * 1000,
    max: (req: Request) => {
      const role = req.user?.roles[0];
      return RATE_LIMITS[role as keyof typeof RATE_LIMITS] || RATE_LIMITS.VIEWER;
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const response = await proxyService.proxyRequest({
        service: ASSET_SERVICE,
        method: 'ListAssets',
        data: {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 10,
          filters: req.query.filters
        },
        metadata: proxyService.createMetadata(req.headers as any),
        timeout: REQUEST_TIMEOUT
      });

      logger.info('Assets listed successfully', {
        correlationId: req.correlationId,
        userId: req.user?.id,
        filters: req.query.filters
      });

      res.json({
        status: 'success',
        data: response,
        correlationId: req.correlationId
      });
    } catch (error: any) {
      logger.error('Failed to list assets', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.code || 500).json({
        status: 'error',
        message: error.message,
        correlationId: req.correlationId
      });
    }
  })
);

export default router;