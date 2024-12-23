/**
 * @fileoverview Central configuration file for the API Gateway
 * @version 1.0.0
 * @license MIT
 */

import dotenv from 'dotenv'; // ^16.0.0

// Load environment variables
dotenv.config();

/**
 * Environment types enumeration
 */
export const ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  STAGING: 'staging',
  TEST: 'test'
} as const;

/**
 * API version enumeration
 */
export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2'
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_TIMEOUT = 30000;
export const DEFAULT_PORT = 3000;

/**
 * Service configuration interface
 */
interface ServiceConfig {
  url: string;
  port: number;
  protocol: string;
  timeout: number;
  secure: boolean;
}

/**
 * Authentication configuration interface
 */
interface AuthConfig {
  domain: string;
  audience: string;
  clientId: string;
  clientSecret: string;
  tokenExpiration: number;
  requireHttps: boolean;
}

/**
 * Rate limiting configuration interface
 */
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  standardHeaders: boolean;
  message: string;
  enableDynamicThrottling: boolean;
}

/**
 * Validates service configuration
 * @param config - Service configuration object
 * @returns boolean indicating if configuration is valid
 */
function validateServiceConfig(config: ServiceConfig): boolean {
  return !!(
    config.url &&
    config.port > 0 &&
    config.port < 65536 &&
    config.protocol &&
    config.timeout > 0
  );
}

/**
 * Validates the complete configuration
 * @param config - Configuration object to validate
 * @throws Error if configuration is invalid
 */
function validateConfig(config: any): boolean {
  // Validate server configuration
  if (!config.server.port || !config.server.env) {
    throw new Error('Invalid server configuration');
  }

  // Validate services configuration
  Object.entries(config.services).forEach(([service, serviceConfig]) => {
    if (!validateServiceConfig(serviceConfig as ServiceConfig)) {
      throw new Error(`Invalid configuration for service: ${service}`);
    }
  });

  // Validate auth configuration
  if (!config.auth.domain || !config.auth.audience || !config.auth.clientId) {
    throw new Error('Invalid authentication configuration');
  }

  // Validate rate limit configuration
  if (config.rateLimit.windowMs <= 0 || config.rateLimit.maxRequests <= 0) {
    throw new Error('Invalid rate limit configuration');
  }

  return true;
}

/**
 * Loads and validates the configuration
 * @returns Validated configuration object
 * @throws Error if configuration is invalid
 */
function loadConfig() {
  const config = {
    server: {
      port: parseInt(process.env.PORT as string) || DEFAULT_PORT,
      env: process.env.NODE_ENV || ENV.DEVELOPMENT,
      corsOrigin: process.env.CORS_ORIGIN || '*',
      apiVersion: process.env.API_VERSION || API_VERSIONS.V1,
      trustProxy: process.env.TRUST_PROXY === 'true',
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT as string) || DEFAULT_TIMEOUT
    },

    services: {
      asset: {
        url: process.env.ASSET_SERVICE_URL,
        port: parseInt(process.env.ASSET_SERVICE_PORT as string),
        protocol: 'grpc',
        timeout: DEFAULT_TIMEOUT,
        secure: process.env.NODE_ENV === ENV.PRODUCTION
      },
      reader: {
        url: process.env.READER_SERVICE_URL,
        port: parseInt(process.env.READER_SERVICE_PORT as string),
        protocol: 'grpc',
        timeout: DEFAULT_TIMEOUT,
        secure: process.env.NODE_ENV === ENV.PRODUCTION
      },
      visualization: {
        url: process.env.VISUALIZATION_SERVICE_URL,
        port: parseInt(process.env.VISUALIZATION_SERVICE_PORT as string),
        protocol: 'grpc',
        timeout: DEFAULT_TIMEOUT,
        secure: process.env.NODE_ENV === ENV.PRODUCTION
      }
    },

    auth: {
      domain: process.env.AUTH0_DOMAIN,
      audience: process.env.AUTH0_AUDIENCE,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
      tokenExpiration: parseInt(process.env.TOKEN_EXPIRATION as string) || 3600,
      requireHttps: process.env.NODE_ENV === ENV.PRODUCTION
    },

    rateLimit: {
      windowMs: 60000, // 1 minute
      maxRequests: 1000,
      standardHeaders: true,
      message: 'Too many requests from this IP, please try again later',
      enableDynamicThrottling: process.env.ENABLE_DYNAMIC_THROTTLING === 'true'
    },

    security: {
      enableHelmet: true,
      enableXssFilter: true,
      enableHsts: process.env.NODE_ENV === ENV.PRODUCTION,
      dnsPrefetchControl: false,
      frameguard: true,
      contentSecurityPolicy: process.env.NODE_ENV === ENV.PRODUCTION
    }
  };

  // Validate the configuration
  validateConfig(config);

  return config;
}

// Export the configuration
export const config = loadConfig();

// Named exports for specific configuration sections
export const { server, services, auth, rateLimit, security } = config;

// Default export for the complete configuration
export default config;