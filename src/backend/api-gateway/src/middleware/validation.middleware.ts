/**
 * @fileoverview Express middleware for request validation using protobuf schemas and custom validation rules
 * @version 1.0.0
 * @license MIT
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import * as Joi from 'joi'; // ^17.9.0
import * as protobuf from 'protobufjs'; // ^7.2.0
import debug from 'debug'; // ^4.3.4
import { server } from '../config';

// Initialize debug logger
const log = debug('api-gateway:validation');

/**
 * Validation options interface
 */
interface ValidationOptions {
  abortEarly: boolean;
  allowUnknown: boolean;
  stripUnknown: boolean;
  cache: boolean;
  contextual: boolean;
}

/**
 * Schema cache interface
 */
interface SchemaCache {
  proto: Map<string, protobuf.Type>;
  joi: Map<string, Joi.Schema>;
}

/**
 * Default validation options
 */
const DEFAULT_VALIDATION_OPTIONS: ValidationOptions = {
  abortEarly: false,
  allowUnknown: false,
  stripUnknown: true,
  cache: true,
  contextual: true
};

/**
 * Schema cache for improved performance
 */
const SCHEMA_CACHE: SchemaCache = {
  proto: new Map(),
  joi: new Map(),
};

/**
 * Validation metrics for monitoring
 */
const VALIDATION_METRICS = {
  totalValidations: 0,
  failedValidations: 0,
  averageLatency: 0
};

/**
 * Generic validation middleware factory
 * @param schema - Joi schema or Protobuf type for validation
 * @param options - Validation options
 */
export const validateRequest = (
  schema: Joi.Schema | protobuf.Type,
  options: Partial<ValidationOptions> = {}
) => {
  const validationOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    try {
      const data = {
        body: req.body,
        query: req.query,
        params: req.params
      };

      let validatedData;

      if (schema instanceof protobuf.Type) {
        // Protobuf validation
        const error = schema.verify(data.body);
        if (error) {
          throw new Error(error);
        }
        validatedData = schema.create(data.body);
      } else {
        // Joi validation
        const { error, value } = schema.validate(data, validationOptions);
        if (error) {
          throw error;
        }
        validatedData = value;
      }

      // Attach validated data to request
      req.validatedData = validatedData;

      // Update metrics
      VALIDATION_METRICS.totalValidations++;
      VALIDATION_METRICS.averageLatency = 
        (VALIDATION_METRICS.averageLatency * (VALIDATION_METRICS.totalValidations - 1) + 
        (Date.now() - startTime)) / VALIDATION_METRICS.totalValidations;

      next();
    } catch (error) {
      VALIDATION_METRICS.failedValidations++;
      log('Validation error:', error);
      
      res.status(400).json({
        status: 'error',
        message: 'Validation failed',
        details: error.details || error.message
      });
    }
  };
};

/**
 * Asset-specific validation middleware
 * @param options - Validation options
 */
export const validateAssetRequest = (options: Partial<ValidationOptions> = {}) => {
  const assetSchema = Joi.object({
    rfid_tag: Joi.string().required().pattern(/^[A-Z0-9]{12,24}$/),
    name: Joi.string().required().min(1).max(100),
    description: Joi.string().optional().max(500),
    image_url: Joi.string().uri().optional(),
    location_id: Joi.string().uuid().required(),
    metadata: Joi.object().optional(),
    active: Joi.boolean().default(true)
  });

  return validateRequest(assetSchema, options);
};

/**
 * RFID reader request validation middleware
 * @param options - Validation options
 */
export const validateReaderRequest = (options: Partial<ValidationOptions> = {}) => {
  const readerSchema = Joi.object({
    reader_id: Joi.string().required().pattern(/^RD-[0-9]{2,4}$/),
    timestamp: Joi.date().iso().required().max('now'),
    signal_strength: Joi.number().required().min(-70).max(-20),
    location_id: Joi.string().uuid().required(),
    reads: Joi.array().items(Joi.object({
      rfid_tag: Joi.string().required().pattern(/^[A-Z0-9]{12,24}$/),
      antenna: Joi.number().required().min(1).max(4),
      rssi: Joi.number().required().min(-70).max(-20)
    })).min(1).required()
  });

  return validateRequest(readerSchema, {
    ...options,
    contextual: true // Enable contextual validation for reader data
  });
};

/**
 * Get validation metrics
 * @returns Current validation metrics
 */
export const getValidationMetrics = () => ({
  ...VALIDATION_METRICS,
  cacheSize: {
    proto: SCHEMA_CACHE.proto.size,
    joi: SCHEMA_CACHE.joi.size
  }
});

// Export validation options and cache for testing
export const __test__ = {
  DEFAULT_VALIDATION_OPTIONS,
  SCHEMA_CACHE,
  VALIDATION_METRICS
};