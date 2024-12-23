/**
 * Central configuration file for frontend API settings
 * Manages endpoints, timeouts, retry policies, request configurations, and security settings
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // ^1.4.0
import { setupCache } from 'axios-cache-adapter'; // ^2.7.3
import axiosRetry from 'axios-retry'; // ^3.5.0
import { ApiResponse } from '../types/api.types';

// Global API Configuration Constants
export const API_VERSION = 'v1';
export const API_TIMEOUT = 2000;
export const API_CONNECTION_TIMEOUT = 1000;
export const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000';
export const API_RETRY_ATTEMPTS = 3;
export const API_RETRY_DELAY = 500;
export const API_CACHE_DURATION = 300000; // 5 minutes
export const API_MAX_RATE_LIMIT = 100;

/**
 * Constructs complete API URL for a given endpoint
 * @param endpoint - API endpoint path
 * @returns Fully qualified API URL
 */
export const getApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}/api/${API_VERSION}${endpoint}`;
};

/**
 * API Endpoints Configuration
 * Centralized definition of all available API endpoints
 */
export const endpoints = {
  assets: {
    base: '/assets',
    detail: (id: string) => `/assets/${id}`,
    reads: (id: string) => `/assets/${id}/reads`,
    upload: (id: string) => `/assets/${id}/image`,
  },
  locations: {
    base: '/locations',
    detail: (id: string) => `/locations/${id}`,
    hierarchy: '/locations/hierarchy',
  },
  readers: {
    base: '/readers',
    detail: (id: string) => `/readers/${id}`,
    status: '/readers/status',
    config: (id: string) => `/readers/${id}/config`,
  },
};

/**
 * Request/Response validation and sanitization functions
 */
const validateResponseStatus = (status: number): boolean => {
  return status >= 200 && status < 300;
};

const sanitizeRequestData = (data: unknown): unknown => {
  // Implement request data sanitization logic
  return data;
};

const validateResponseData = <T>(response: ApiResponse<T>): boolean => {
  return response.status >= 200 && response.status < 300 && !!response.data;
};

/**
 * CSRF Token management
 */
const getCsrfToken = (): string => {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
};

/**
 * Creates and configures axios instance with all necessary middleware
 * @param config - Additional axios configuration
 * @returns Configured axios instance
 */
export const createAxiosInstance = (config?: AxiosRequestConfig): AxiosInstance => {
  // Setup cache adapter
  const cache = setupCache({
    maxAge: API_CACHE_DURATION,
    exclude: {
      query: false,
      methods: ['post', 'patch', 'put', 'delete'],
      statusCodes: [400, 401, 403, 404, 500],
    },
    clearOnError: true,
    clearOnUpdate: true,
  });

  // Create axios instance with base configuration
  const instance = axios.create({
    baseURL: getApiUrl(''),
    timeout: API_TIMEOUT,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': getCsrfToken(),
    },
    adapter: cache.adapter,
    validateStatus,
    ...config,
  });

  // Configure retry strategy
  axiosRetry(instance, {
    retries: API_RETRY_ATTEMPTS,
    retryDelay: (retryCount) => {
      return Math.min(
        API_RETRY_DELAY * Math.pow(2, retryCount),
        5000
      ) * (0.8 + Math.random() * 0.4); // Randomized delay
    },
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        [408, 429, 500, 502, 503, 504].includes(error.response?.status || 0);
    },
  });

  // Request interceptor
  instance.interceptors.request.use(
    (config) => {
      config.data = sanitizeRequestData(config.data);
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response) => {
      if (!validateResponseData(response.data)) {
        return Promise.reject(new Error('Invalid response data'));
      }
      return response;
    },
    (error) => Promise.reject(error)
  );

  return instance;
};

/**
 * Export comprehensive API configuration
 */
export const apiConfig = {
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  connectionTimeout: API_CONNECTION_TIMEOUT,
  endpoints,
  retryConfig: {
    attempts: API_RETRY_ATTEMPTS,
    delay: API_RETRY_DELAY,
    statusCodes: [408, 429, 500, 502, 503, 504],
    backoffFactor: 2,
    maxRetryDelay: 5000,
    randomization: true,
  },
  cacheConfig: {
    maxAge: API_CACHE_DURATION,
    excludeStatus: [400, 401, 403, 404, 500],
    clearOnError: true,
    clearOnUpdate: true,
  },
  securityConfig: {
    validateStatus: validateResponseStatus,
    sanitizeRequest: sanitizeRequestData,
    validateResponse: validateResponseData,
    csrfEnabled: true,
    rateLimitConfig: {
      maxRequests: API_MAX_RATE_LIMIT,
      perWindow: 60000, // 1 minute
      enableRetry: true,
    },
  },
} as const;

export default apiConfig;