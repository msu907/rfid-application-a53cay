/**
 * API Utilities for handling requests, responses, error handling, and request transformations
 * Implements robust error handling, retry logic, and observability features
 * @version 1.0.0
 */

import axios, { AxiosError } from 'axios'; // ^1.4.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import { ApiResponse, ApiError } from '../types/api.types';
import { apiConfig } from '../config/api.config';

/**
 * HTTP Status codes for API responses
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  TIMEOUT: 408,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

/**
 * Status codes that trigger retry attempts
 */
export const RETRY_STATUS_CODES = [
  HTTP_STATUS.TIMEOUT,
  HTTP_STATUS.TOO_MANY_REQUESTS,
  HTTP_STATUS.INTERNAL_ERROR,
  HTTP_STATUS.BAD_GATEWAY,
  HTTP_STATUS.SERVICE_UNAVAILABLE,
  HTTP_STATUS.GATEWAY_TIMEOUT,
];

/**
 * Error severity levels for error handling and monitoring
 */
export const ERROR_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

/**
 * Options for error handling configuration
 */
interface ErrorHandlingOptions {
  logError?: boolean;
  notifyUser?: boolean;
  retryable?: boolean;
  correlationId?: string;
  context?: Record<string, unknown>;
}

/**
 * Options for query parameter formatting
 */
interface QueryFormatOptions {
  arrayFormat?: 'brackets' | 'indices' | 'repeat' | 'comma';
  skipNull?: boolean;
  skipEmptyString?: boolean;
  encodeValuesOnly?: boolean;
  customFormatters?: Record<string, (value: unknown) => string>;
}

/**
 * Options for request retry configuration
 */
interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  timeout?: number;
  onRetry?: (error: Error, attemptNumber: number) => void;
}

/**
 * Generates a correlation ID for request tracking
 * @returns Unique correlation ID
 */
const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Determines error severity based on status code and error type
 * @param status HTTP status code
 * @param errorType Type of error encountered
 * @returns Error severity level
 */
const determineErrorSeverity = (status: number, errorType: string): keyof typeof ERROR_SEVERITY => {
  if (status >= 500) return 'CRITICAL';
  if (status === 401 || status === 403) return 'WARNING';
  if (status === 404) return 'INFO';
  if (errorType === 'NETWORK_ERROR') return 'ERROR';
  return 'ERROR';
};

/**
 * Enhanced error handler for API errors with severity levels and correlation tracking
 * @param error Axios error object
 * @param options Error handling options
 * @returns Standardized API error object
 */
export const handleApiError = (
  error: AxiosError<ApiResponse<unknown>>,
  options: ErrorHandlingOptions = {}
): ApiError => {
  const correlationId = options.correlationId || generateCorrelationId();
  const status = error.response?.status || HTTP_STATUS.INTERNAL_ERROR;
  const errorType = error.code || 'UNKNOWN_ERROR';
  const severity = determineErrorSeverity(status, errorType);

  const apiError: ApiError = {
    code: errorType,
    message: error.response?.data?.message || error.message,
    details: {
      status,
      path: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      timestamp: new Date().toISOString(),
      ...options.context,
    },
    severity,
    correlationId,
  };

  if (options.logError) {
    console.error(`[${severity}] API Error:`, {
      ...apiError,
      stack: error.stack,
    });
  }

  return apiError;
};

/**
 * Advanced query parameter formatter with support for arrays and nested objects
 * @param params Parameters to format
 * @param options Formatting options
 * @returns Formatted query string
 */
export const formatQueryParams = (
  params: Record<string, unknown>,
  options: QueryFormatOptions = {}
): string => {
  const {
    arrayFormat = 'brackets',
    skipNull = true,
    skipEmptyString = true,
    encodeValuesOnly = true,
    customFormatters = {},
  } = options;

  const formatValue = (key: string, value: unknown): string => {
    if (customFormatters[key]) {
      return customFormatters[key](value);
    }

    if (Array.isArray(value)) {
      return formatArray(key, value, arrayFormat);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    return encodeURIComponent(String(value));
  };

  const formatArray = (key: string, arr: unknown[], format: string): string => {
    switch (format) {
      case 'brackets':
        return arr.map(v => `${key}[]=${formatValue(key, v)}`).join('&');
      case 'indices':
        return arr.map((v, i) => `${key}[${i}]=${formatValue(key, v)}`).join('&');
      case 'repeat':
        return arr.map(v => `${key}=${formatValue(key, v)}`).join('&');
      case 'comma':
        return `${key}=${arr.map(v => formatValue(key, v)).join(',')}`;
      default:
        return arr.map(v => `${key}[]=${formatValue(key, v)}`).join('&');
    }
  };

  return Object.entries(params)
    .filter(([_, value]) => {
      if (skipNull && value === null) return false;
      if (skipEmptyString && value === '') return false;
      return true;
    })
    .map(([key, value]) => {
      if (value === undefined) return '';
      return formatValue(key, value);
    })
    .filter(Boolean)
    .join('&');
};

/**
 * Advanced retry mechanism with exponential backoff and circuit breaker
 * @param requestFn Function to retry
 * @param options Retry options
 * @returns Promise resolving to the request result
 */
export const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const {
    maxAttempts = apiConfig.retryConfig.attempts,
    initialDelay = apiConfig.retryConfig.delay,
    maxDelay = apiConfig.retryConfig.maxRetryDelay,
    backoffFactor = apiConfig.retryConfig.backoffFactor,
    timeout = apiConfig.timeout,
    onRetry,
  } = options;

  const breaker = new CircuitBreaker(requestFn, {
    timeout,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
  });

  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await breaker.fire();
    } catch (error) {
      attempt++;
      
      if (attempt === maxAttempts || !RETRY_STATUS_CODES.includes((error as AxiosError).response?.status || 0)) {
        throw error;
      }

      const delay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt - 1),
        maxDelay
      );

      if (onRetry) {
        onRetry(error as Error, attempt);
      }

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error(`Failed after ${maxAttempts} attempts`);
};