/**
 * @fileoverview Rate limiting middleware for API Gateway with distributed capabilities
 * @version 1.0.0
 * @license MIT
 */

import rateLimit from 'express-rate-limit'; // ^6.7.0
import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { rateLimit as rateLimitConfig } from '../config';
import Redis from 'ioredis'; // ^5.3.0
import { RedisStore } from 'rate-limit-redis'; // ^3.0.0

// Constants for rate limiting configuration
const DEFAULT_WINDOW_MS = 60000; // 1 minute in milliseconds
const DEFAULT_MAX_REQUESTS = 1000;
const BYPASS_HEADER = 'X-RateLimit-Bypass';
const REDIS_PREFIX = 'rl:';

/**
 * Interface for Redis store options
 */
interface RedisOptions {
  host: string;
  port: number;
  password?: string;
  enableOfflineQueue: boolean;
}

/**
 * Interface for rate limit configuration
 */
interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  bypassList: string[];
  customHeaders: Record<string, string>;
  errorMessage: string;
  redisOptions?: RedisOptions;
}

/**
 * Interface for rate limit options
 */
interface RateLimitOptions {
  windowMs: number;
  max: number;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  message: string;
  skipFailedRequests: boolean;
  keyGenerator: (req: Request) => string;
  handler: (req: Request, res: Response) => void;
  skip: (req: Request) => boolean;
  store?: any;
}

/**
 * Creates a Redis store for distributed rate limiting
 * @param options Redis configuration options
 * @returns Configured Redis store instance
 */
const createRedisStore = (options: RedisOptions) => {
  const client = new Redis({
    host: options.host,
    port: options.port,
    password: options.password,
    enableOfflineQueue: options.enableOfflineQueue,
    keyPrefix: REDIS_PREFIX
  });

  return new RedisStore({
    sendCommand: (...args: string[]) => client.call(...args),
  });
};

/**
 * Extracts client IP from request considering proxy headers
 * @param req Express request object
 * @returns Client IP address
 */
const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

/**
 * Creates and configures the rate limiting middleware
 * @param config Rate limiting configuration
 * @returns Configured rate limiting middleware
 */
export const createRateLimiter = (config: RateLimitConfig = rateLimitConfig) => {
  const options: RateLimitOptions = {
    windowMs: config.windowMs || DEFAULT_WINDOW_MS,
    max: config.maxRequests || DEFAULT_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: config.errorMessage || 'Too many requests from this IP, please try again later',
    skipFailedRequests: false,

    // Custom key generator using client IP
    keyGenerator: (req: Request): string => {
      return getClientIp(req);
    },

    // Custom handler for rate limit exceeded
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: 'RateLimitExceededError',
        message: config.errorMessage,
        retryAfter: Math.ceil(options.windowMs / 1000),
        limit: options.max,
        current: parseInt(res.getHeader('X-RateLimit-Used') as string),
        remaining: parseInt(res.getHeader('X-RateLimit-Remaining') as string)
      });
    },

    // Skip rate limiting for whitelisted IPs
    skip: (req: Request): boolean => {
      const clientIp = getClientIp(req);
      return (
        config.bypassList?.includes(clientIp) ||
        req.headers[BYPASS_HEADER.toLowerCase()] === 'true'
      );
    }
  };

  // Configure distributed rate limiting if Redis options are provided
  if (config.redisOptions) {
    options.store = createRedisStore(config.redisOptions);
  }

  // Create the rate limiter middleware
  const limiter = rateLimit(options);

  // Return enhanced middleware with custom headers
  return (req: Request, res: Response, next: NextFunction) => {
    // Add custom headers if configured
    if (config.customHeaders) {
      Object.entries(config.customHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    // Apply rate limiting
    limiter(req, res, next);
  };
};

/**
 * Handle rate limit middleware with dynamic throttling support
 */
export const handleRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const rateLimiter = createRateLimiter({
    ...rateLimitConfig,
    maxRequests: rateLimitConfig.enableDynamicThrottling
      ? calculateDynamicThreshold()
      : rateLimitConfig.maxRequests
  });

  rateLimiter(req, res, next);
};

/**
 * Calculate dynamic rate limit threshold based on system load
 * @returns Adjusted request threshold
 */
const calculateDynamicThreshold = (): number => {
  // Default to configured max requests
  let threshold = rateLimitConfig.maxRequests;

  // Adjust threshold based on system metrics
  // This is a simplified example - in production, you would
  // integrate with your monitoring system
  const systemLoad = process.cpuUsage();
  const loadFactor = (systemLoad.user + systemLoad.system) / 1000000;

  if (loadFactor > 0.8) {
    threshold = Math.floor(threshold * 0.5); // Reduce by 50% under high load
  } else if (loadFactor > 0.6) {
    threshold = Math.floor(threshold * 0.75); // Reduce by 25% under moderate load
  }

  return Math.max(threshold, 100); // Ensure minimum threshold
};

export default createRateLimiter;