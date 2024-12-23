/**
 * API Constants
 * Version: 1.0.0
 * 
 * Defines constant values for API endpoints, request configurations, error codes,
 * and version control used throughout the frontend application for communicating 
 * with backend services in a type-safe manner.
 */

/**
 * Base API configuration constants
 */
export const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
export const API_TIMEOUT = 30000; // 30 seconds
export const API_RETRY_ATTEMPTS = 3;
export const API_RETRY_DELAY = 1000; // 1 second

/**
 * API endpoint paths
 * Used for constructing API request URLs
 */
export const API_ENDPOINTS = {
    // Asset Management
    ASSETS: '/assets',
    ASSET_IMAGES: '/assets/images',
    
    // Location Management
    LOCATIONS: '/locations',
    LOCATION_HIERARCHY: '/locations/hierarchy',
    
    // Reader Management
    READERS: '/readers',
    READER_STATUS: '/readers/status',
    
    // Authentication
    AUTH: '/auth',
    AUTH_REFRESH: '/auth/refresh',
    AUTH_LOGOUT: '/auth/logout'
} as const;

/**
 * HTTP Methods
 * Type-safe HTTP method constants for API requests
 */
export const API_METHODS = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT',
    PATCH: 'PATCH',
    DELETE: 'DELETE'
} as const;

/**
 * API Versions
 * Constants for API version control
 */
export const API_VERSIONS = {
    V1: 'v1'
} as const;

/**
 * API Error Codes
 * Standardized error codes for API error handling
 */
export const API_ERROR_CODES = {
    // Authentication & Authorization
    UNAUTHORIZED: 'UNAUTHORIZED',      // 401 - Not authenticated
    FORBIDDEN: 'FORBIDDEN',           // 403 - Not authorized
    
    // Resource Errors
    NOT_FOUND: 'NOT_FOUND',          // 404 - Resource not found
    
    // Client Errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',  // 400 - Invalid input
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED', // 429 - Too many requests
    
    // Server Errors
    INTERNAL_ERROR: 'INTERNAL_ERROR',      // 500 - Server error
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE' // 503 - Service down
} as const;

/**
 * Type definitions for type safety and autocompletion
 */
export type ApiEndpoint = typeof API_ENDPOINTS[keyof typeof API_ENDPOINTS];
export type ApiMethod = typeof API_METHODS[keyof typeof API_METHODS];
export type ApiVersion = typeof API_VERSIONS[keyof typeof API_VERSIONS];
export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];

/**
 * Request configuration type
 * Used for typing API request configurations
 */
export interface ApiRequestConfig {
    endpoint: ApiEndpoint;
    method: ApiMethod;
    version: ApiVersion;
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
}