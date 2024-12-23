/**
 * @fileoverview Core API service implementing secure, performant HTTP request handling
 * with comprehensive error management, retry logic, request/response transformation,
 * and authentication integration.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.4.0
import axiosRetry from 'axios-retry'; // ^3.5.0
import CircuitBreaker from 'opossum'; // ^7.1.0
import CryptoJS from 'crypto-js'; // ^4.1.1

import { apiConfig } from '../config/api.config';
import { ApiResponse, ApiError, API_ERROR_CODES } from '../types/api.types';
import { AuthService } from './auth.service';

// Circuit breaker configuration
const CIRCUIT_BREAKER_CONFIG = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  rollingCountTimeout: 10000
};

// Cache configuration
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Core API service class implementing secure HTTP communications
 */
export class ApiService {
  private axiosInstance: AxiosInstance;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private cache: Map<string, CacheItem<any>>;
  private readonly authService: AuthService;

  /**
   * Creates a new ApiService instance with security and performance features
   * @param authService - Authentication service instance
   */
  constructor(authService: AuthService) {
    this.authService = authService;
    this.circuitBreakers = new Map();
    this.cache = new Map();

    // Initialize axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: apiConfig.baseURL,
      timeout: apiConfig.timeout,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Configure retry mechanism
    this.configureRetry();
    
    // Configure interceptors
    this.configureInterceptors();
  }

  /**
   * Performs a GET request with caching and circuit breaker pattern
   * @param url - Request URL
   * @param config - Optional axios config
   * @returns Promise resolving to typed API response
   */
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('GET', url, undefined, config);
  }

  /**
   * Performs a POST request with request signing
   * @param url - Request URL
   * @param data - Request payload
   * @param config - Optional axios config
   * @returns Promise resolving to typed API response
   */
  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('POST', url, data, config);
  }

  /**
   * Performs a PUT request with request signing
   * @param url - Request URL
   * @param data - Request payload
   * @param config - Optional axios config
   * @returns Promise resolving to typed API response
   */
  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('PUT', url, data, config);
  }

  /**
   * Performs a DELETE request
   * @param url - Request URL
   * @param config - Optional axios config
   * @returns Promise resolving to typed API response
   */
  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.executeRequest<T>('DELETE', url, undefined, config);
  }

  /**
   * Clears the request cache
   * @param url - Optional URL to clear specific cache entry
   */
  public clearCache(url?: string): void {
    if (url) {
      this.cache.delete(this.getCacheKey(url));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Configures axios retry mechanism
   * @private
   */
  private configureRetry(): void {
    axiosRetry(this.axiosInstance, {
      retries: apiConfig.retryConfig.attempts,
      retryDelay: (retryCount) => {
        return Math.min(
          apiConfig.retryConfig.delay * Math.pow(2, retryCount),
          apiConfig.retryConfig.maxRetryDelay
        );
      },
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
          apiConfig.retryConfig.statusCodes.includes(error.response?.status || 0);
      }
    });
  }

  /**
   * Configures request/response interceptors
   * @private
   */
  private configureInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Add authentication token
        const user = await this.authService.getCurrentUser();
        if (user) {
          config.headers.Authorization = `Bearer ${user.accessToken}`;
        }

        // Sign request if needed
        if (config.data) {
          config.headers['X-Request-Signature'] = this.signRequest(config.data);
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => this.handleResponse(response),
      (error) => this.handleError(error)
    );
  }

  /**
   * Executes HTTP request with circuit breaker and caching
   * @private
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    // Check cache for GET requests
    if (method === 'GET') {
      const cachedResponse = this.getCachedResponse<T>(url);
      if (cachedResponse) return cachedResponse;
    }

    // Get or create circuit breaker for the endpoint
    const breaker = this.getCircuitBreaker(url);

    try {
      const response = await breaker.fire(() => 
        this.axiosInstance.request<ApiResponse<T>>({
          method,
          url,
          data,
          ...config
        })
      );

      // Cache GET responses
      if (method === 'GET') {
        this.cacheResponse(url, response.data);
      }

      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Gets or creates a circuit breaker for an endpoint
   * @private
   */
  private getCircuitBreaker(url: string): CircuitBreaker {
    const key = new URL(url, apiConfig.baseURL).pathname;
    
    if (!this.circuitBreakers.has(key)) {
      const breaker = new CircuitBreaker(async (request: Promise<any>) => request, {
        ...CIRCUIT_BREAKER_CONFIG,
        name: key
      });

      breaker.on('open', () => {
        console.warn(`Circuit breaker opened for ${key}`);
      });

      this.circuitBreakers.set(key, breaker);
    }

    return this.circuitBreakers.get(key)!;
  }

  /**
   * Signs request data for integrity verification
   * @private
   */
  private signRequest(data: any): string {
    return CryptoJS.HmacSHA256(
      JSON.stringify(data),
      apiConfig.encryptionKey
    ).toString();
  }

  /**
   * Handles successful API response
   * @private
   */
  private handleResponse<T>(response: AxiosResponse): ApiResponse<T> {
    return {
      data: response.data.data,
      status: response.status,
      message: response.data.message || 'Success',
      timestamp: new Date().toISOString(),
      requestId: response.headers['x-request-id']
    };
  }

  /**
   * Normalizes and handles API errors
   * @private
   */
  private normalizeError(error: any): ApiError {
    const apiError: ApiError = {
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: {},
      timestamp: new Date().toISOString()
    };

    if (axios.isAxiosError(error)) {
      apiError.code = this.mapHttpErrorToCode(error.response?.status);
      apiError.message = error.response?.data?.message || error.message;
      apiError.details = error.response?.data?.details || {};
    }

    return apiError;
  }

  /**
   * Maps HTTP error status to API error code
   * @private
   */
  private mapHttpErrorToCode(status?: number): keyof typeof API_ERROR_CODES {
    switch (status) {
      case 401: return API_ERROR_CODES.UNAUTHORIZED;
      case 404: return API_ERROR_CODES.NOT_FOUND;
      case 429: return API_ERROR_CODES.RATE_LIMIT_EXCEEDED;
      case 400: return API_ERROR_CODES.VALIDATION_ERROR;
      default: return API_ERROR_CODES.INTERNAL_ERROR;
    }
  }

  /**
   * Generates cache key for URL
   * @private
   */
  private getCacheKey(url: string): string {
    return `${url}`;
  }

  /**
   * Retrieves cached response if valid
   * @private
   */
  private getCachedResponse<T>(url: string): ApiResponse<T> | null {
    const cacheKey = this.getCacheKey(url);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    this.cache.delete(cacheKey);
    return null;
  }

  /**
   * Caches API response
   * @private
   */
  private cacheResponse<T>(url: string, response: ApiResponse<T>): void {
    const cacheKey = this.getCacheKey(url);
    this.cache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
      expiresAt: Date.now() + apiConfig.cacheConfig.maxAge
    });
  }
}

// Export singleton instance
export const apiService = new ApiService(new AuthService());