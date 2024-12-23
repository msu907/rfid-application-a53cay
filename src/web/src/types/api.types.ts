/**
 * Core TypeScript type definitions for API responses, pagination, error handling, and data management.
 * Provides type-safe interfaces for standardized API communication and data handling patterns.
 * @version 1.0.0
 */

/**
 * Default pagination configuration values
 */
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;

/**
 * Standardized API error codes with corresponding string literals
 */
export const API_ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  READER_ERROR: 'READER_ERROR'
} as const;

/**
 * Generic interface for standardized API responses with comprehensive error handling
 * @template T - The type of data contained in the response
 */
export interface ApiResponse<T> {
  /** The response payload */
  data: T;
  /** HTTP status code */
  status: number;
  /** Human-readable message */
  message: string;
  /** ISO timestamp of the response */
  timestamp: string;
  /** Optional error details */
  error?: ApiError;
}

/**
 * Enhanced interface for standardized error responses with development support
 */
export interface ApiError {
  /** Standardized error code from API_ERROR_CODES */
  code: keyof typeof API_ERROR_CODES;
  /** Human-readable error message */
  message: string;
  /** Additional error context and metadata */
  details: Record<string, unknown>;
  /** Optional stack trace for development */
  stack?: string;
  /** ISO timestamp when the error occurred */
  timestamp: string;
}

/**
 * Comprehensive interface for paginated API responses with navigation helpers
 * @template T - The type of items in the paginated response
 */
export interface PaginatedResponse<T> {
  /** Array of paginated items */
  items: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of available pages */
  totalPages: number;
  /** Indicates if there is a next page */
  hasNext: boolean;
  /** Indicates if there is a previous page */
  hasPrevious: boolean;
}

/**
 * Type-safe enumeration for sort order options
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * Enhanced interface for pagination request parameters with filtering support
 */
export interface PaginationParams {
  /** Page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Field to sort by */
  sortBy: string;
  /** Sort direction */
  sortOrder: SortOrder;
  /** Optional filtering criteria */
  filters: Record<string, unknown>;
}

/**
 * Type guard function to check if an unknown value is an ApiError
 * @param value - Value to check
 * @returns True if value is an ApiError, false otherwise
 */
export function isApiError(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const error = value as Partial<ApiError>;
  
  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.details === 'object' &&
    typeof error.timestamp === 'string' &&
    Object.keys(API_ERROR_CODES).includes(error.code) &&
    (error.stack === undefined || typeof error.stack === 'string')
  );
}