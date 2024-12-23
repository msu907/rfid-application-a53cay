// External dependencies
// zod@3.21.4 - Runtime configuration validation with type safety
import { z } from 'zod';
// dotenv@16.0.3 - Environment variable loading and management
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Environment variables with defaults
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '3003', 10);

// Zod schema for configuration validation
const configSchema = z.object({
  websocketConfig: z.object({
    port: z.number().min(1024).max(65535),
    path: z.string().startsWith('/'),
    pingInterval: z.number().positive(),
    pingTimeout: z.number().positive(),
    maxConnections: z.number().min(1).max(1000),
    cors: z.object({
      origin: z.string(),
      methods: z.array(z.string())
    })
  }),
  dashboardConfig: z.object({
    refreshIntervals: z.object({
      ASSET_COUNT: z.number().positive(),
      LOCATION_MAP: z.number().positive(),
      RECENT_READS: z.number().positive(),
      MOVEMENT_HISTORY: z.number().positive(),
      STATUS_SUMMARY: z.number().positive()
    }),
    maxWidgets: z.number().positive(),
    cacheTimeout: z.number().positive()
  }),
  serviceConfig: z.object({
    environment: z.enum(['development', 'test', 'production']),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']),
    metricsEnabled: z.boolean(),
    maxConcurrentUpdates: z.number().positive(),
    dataRetentionPeriod: z.number().positive()
  })
});

// Configuration object with type inference from schema
const config = {
  websocketConfig: {
    port: PORT,
    path: '/ws',
    pingInterval: 10000, // 10 seconds
    pingTimeout: 5000,   // 5 seconds
    maxConnections: 100, // Support for 100+ concurrent users
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  },
  dashboardConfig: {
    refreshIntervals: {
      ASSET_COUNT: 5000,     // 5 seconds
      LOCATION_MAP: 2000,    // 2 seconds
      RECENT_READS: 1000,    // 1 second
      MOVEMENT_HISTORY: 10000, // 10 seconds
      STATUS_SUMMARY: 5000   // 5 seconds
    },
    maxWidgets: 10,
    cacheTimeout: 60000 // 1 minute
  },
  serviceConfig: {
    environment: NODE_ENV as 'development' | 'test' | 'production',
    logLevel: process.env.LOG_LEVEL || 'info',
    metricsEnabled: true,
    maxConcurrentUpdates: 50,
    dataRetentionPeriod: 86400000 // 24 hours in milliseconds
  }
} as const;

/**
 * Validates the configuration against the defined schema
 * @param config Configuration object to validate
 * @returns True if valid, throws ZodError if invalid
 */
export function validateConfig(config: Record<string, any>): boolean {
  try {
    configSchema.parse(config);
    return true;
  } catch (error) {
    console.error('Configuration validation failed:', error);
    throw error;
  }
}

// Validate configuration on load
validateConfig(config);

// Type inference from the schema
type Config = z.infer<typeof configSchema>;

// Export validated configuration and types
export type { Config };
export const {
  websocketConfig,
  dashboardConfig,
  serviceConfig
} = config;

// Default export of the entire config object
export default config;