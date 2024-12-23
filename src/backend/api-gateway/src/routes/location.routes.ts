/**
 * @fileoverview Location routes implementation for API Gateway
 * @version 1.0.0
 * @license MIT
 */

import express, { Request, Response } from 'express'; // ^4.18.0
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import * as grpc from '@grpc/grpc-js'; // ^1.8.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import rateLimit from 'express-rate-limit'; // ^6.0.0
import * as Joi from 'joi'; // ^17.9.0
import debug from 'debug'; // ^4.3.4
import { services } from '../config';

// Initialize debug logger
const log = debug('api-gateway:location-routes');

// Constants
export const ROLES = {
  ADMIN: 'admin',
  ASSET_MANAGER: 'asset_manager',
  OPERATOR: 'operator',
  VIEWER: 'viewer'
} as const;

export const RATE_LIMITS = {
  GET: 1000,
  POST: 100,
  PUT: 100,
  DELETE: 50
} as const;

// Validation Schemas
const locationSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  zone: Joi.string().required().min(1).max(50),
  coordinates: Joi.object({
    latitude: Joi.number().required().min(-90).max(90),
    longitude: Joi.number().required().min(-180).max(180),
    floor: Joi.number().required().min(0)
  }).required(),
  parent_id: Joi.string().uuid().allow(null),
  annotation: Joi.string().max(500),
  metadata: Joi.object().optional()
});

const querySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  zone: Joi.string(),
  parent_id: Joi.string().uuid(),
  search: Joi.string().max(100),
  include_hierarchy: Joi.boolean().default(false)
});

// Circuit Breaker Configuration
const breaker = new CircuitBreaker(async (method: string, request: any) => {
  return new Promise((resolve, reject) => {
    const client = new grpc.Client(
      `${services.asset.url}:${services.asset.port}`,
      grpc.credentials.createInsecure()
    );
    client[method](request, (error: Error | null, response: any) => {
      if (error) reject(error);
      else resolve(response);
    });
  });
}, {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000
});

// Create router
const router = express.Router();

/**
 * GET /locations
 * Retrieves locations with filtering, pagination and hierarchy support
 */
router.get('/locations',
  authenticate,
  authorize([ROLES.VIEWER]),
  rateLimit({ windowMs: 60000, max: RATE_LIMITS.GET }),
  validateRequest(querySchema),
  async (req: Request, res: Response) => {
    try {
      const { page, limit, zone, parent_id, search, include_hierarchy } = req.query;

      const request = {
        page: Number(page),
        limit: Number(limit),
        filters: {
          zone,
          parent_id,
          search
        },
        include_hierarchy: Boolean(include_hierarchy)
      };

      const response = await breaker.fire('GetLocations', request);

      log('Locations retrieved successfully', { 
        count: response.locations.length,
        page,
        limit
      });

      res.json({
        status: 'success',
        data: response.locations,
        metadata: {
          total: response.total,
          page: Number(page),
          limit: Number(limit),
          has_next: response.has_next
        }
      });
    } catch (error) {
      log('Error retrieving locations:', error);
      res.status(error.status || 500).json({
        status: 'error',
        message: error.message || 'Internal server error'
      });
    }
  }
);

/**
 * POST /locations
 * Creates a new location
 */
router.post('/locations',
  authenticate,
  authorize([ROLES.ASSET_MANAGER, ROLES.ADMIN]),
  rateLimit({ windowMs: 60000, max: RATE_LIMITS.POST }),
  validateRequest(locationSchema),
  async (req: Request, res: Response) => {
    try {
      const response = await breaker.fire('CreateLocation', req.body);

      log('Location created successfully', { locationId: response.id });

      res.status(201).json({
        status: 'success',
        data: response
      });
    } catch (error) {
      log('Error creating location:', error);
      res.status(error.status || 500).json({
        status: 'error',
        message: error.message || 'Internal server error'
      });
    }
  }
);

/**
 * PUT /locations/:id
 * Updates an existing location
 */
router.put('/locations/:id',
  authenticate,
  authorize([ROLES.ASSET_MANAGER, ROLES.ADMIN]),
  rateLimit({ windowMs: 60000, max: RATE_LIMITS.PUT }),
  validateRequest(locationSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const response = await breaker.fire('UpdateLocation', {
        id,
        ...req.body
      });

      log('Location updated successfully', { locationId: id });

      res.json({
        status: 'success',
        data: response
      });
    } catch (error) {
      log('Error updating location:', error);
      res.status(error.status || 500).json({
        status: 'error',
        message: error.message || 'Internal server error'
      });
    }
  }
);

/**
 * GET /locations/:id/assets
 * Retrieves assets in a specific location
 */
router.get('/locations/:id/assets',
  authenticate,
  authorize([ROLES.VIEWER]),
  rateLimit({ windowMs: 60000, max: RATE_LIMITS.GET }),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const response = await breaker.fire('GetLocationAssets', {
        location_id: id,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20
      });

      log('Location assets retrieved successfully', { 
        locationId: id,
        assetCount: response.assets.length
      });

      res.json({
        status: 'success',
        data: response.assets,
        metadata: {
          total: response.total,
          page: Number(req.query.page) || 1,
          limit: Number(req.query.limit) || 20
        }
      });
    } catch (error) {
      log('Error retrieving location assets:', error);
      res.status(error.status || 500).json({
        status: 'error',
        message: error.message || 'Internal server error'
      });
    }
  }
);

// Export router
export default router;