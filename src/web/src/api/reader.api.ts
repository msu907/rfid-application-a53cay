/**
 * API client module for RFID reader operations providing comprehensive management,
 * monitoring, and configuration capabilities through the API gateway.
 * @version 1.0.0
 */

import { ApiService } from '../services/api.service';
import { apiConfig } from '../config/api.config';
import { 
  Reader, 
  ReaderConfig, 
  ReaderStatus, 
  ReaderQueryParams,
  ReaderStatsResponse,
  ReaderResponse,
  ReaderUpdatePayload
} from '../types/reader.types';
import { ApiResponse } from '../types/api.types';

// Cache configuration
const CACHE_TTL_MS = 300000; // 5 minutes
const HEALTH_CACHE_TTL_MS = 30000; // 30 seconds

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * API client class for RFID reader operations with comprehensive management capabilities
 */
export class ReaderApi {
  private readonly baseUrl: string;
  private cache: Map<string, CacheEntry<any>>;

  /**
   * Creates a new ReaderApi instance with caching capabilities
   * @param apiService - Core API service instance
   */
  constructor(private readonly apiService: ApiService) {
    this.baseUrl = apiConfig.endpoints.readers.base;
    this.cache = new Map();
  }

  /**
   * Retrieves a list of all RFID readers with optional filtering
   * @param params - Optional query parameters for filtering readers
   * @returns Promise resolving to reader list response
   */
  public async getReaders(params?: ReaderQueryParams): Promise<ApiResponse<Reader[]>> {
    const cacheKey = `readers-${JSON.stringify(params || {})}`;
    const cached = this.getCachedData<Reader[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await this.apiService.get<Reader[]>(this.baseUrl, { params });
    this.setCacheData(cacheKey, response, CACHE_TTL_MS);
    return response;
  }

  /**
   * Retrieves detailed information for a specific reader
   * @param id - Reader identifier
   * @returns Promise resolving to reader details
   */
  public async getReaderById(id: string): Promise<ApiResponse<ReaderResponse>> {
    const cacheKey = `reader-${id}`;
    const cached = this.getCachedData<ReaderResponse>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await this.apiService.get<ReaderResponse>(
      `${this.baseUrl}/${id}`
    );
    this.setCacheData(cacheKey, response, CACHE_TTL_MS);
    return response;
  }

  /**
   * Retrieves current status and health metrics for a reader
   * @param id - Reader identifier
   * @returns Promise resolving to reader health data
   */
  public async getReaderHealth(id: string): Promise<ApiResponse<ReaderStatsResponse>> {
    const cacheKey = `reader-health-${id}`;
    const cached = this.getCachedData<ReaderStatsResponse>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const response = await this.apiService.get<ReaderStatsResponse>(
      `${this.baseUrl}/${id}/health`
    );
    this.setCacheData(cacheKey, response, HEALTH_CACHE_TTL_MS);
    return response;
  }

  /**
   * Updates reader configuration with validation
   * @param id - Reader identifier
   * @param config - New reader configuration
   * @returns Promise resolving to updated reader details
   */
  public async updateReaderConfig(
    id: string,
    config: ReaderUpdatePayload
  ): Promise<ApiResponse<Reader>> {
    this.validateReaderConfig(config);
    
    const response = await this.apiService.put<Reader>(
      `${this.baseUrl}/${id}/config`,
      config
    );
    
    // Invalidate related cache entries
    this.invalidateReaderCache(id);
    return response;
  }

  /**
   * Initiates reader firmware update process
   * @param id - Reader identifier
   * @param firmwareVersion - Target firmware version
   * @returns Promise resolving to update status
   */
  public async updateReaderFirmware(
    id: string,
    firmwareVersion: string
  ): Promise<ApiResponse<void>> {
    const response = await this.apiService.post<void>(
      `${this.baseUrl}/${id}/firmware`,
      { version: firmwareVersion }
    );
    
    this.invalidateReaderCache(id);
    return response;
  }

  /**
   * Performs a soft reset of the specified reader
   * @param id - Reader identifier
   * @returns Promise resolving to reset confirmation
   */
  public async resetReader(id: string): Promise<ApiResponse<void>> {
    const response = await this.apiService.post<void>(
      `${this.baseUrl}/${id}/reset`
    );
    
    this.invalidateReaderCache(id);
    return response;
  }

  /**
   * Validates reader configuration parameters
   * @private
   */
  private validateReaderConfig(config: Partial<ReaderConfig>): void {
    if (config.readIntervalMs && (config.readIntervalMs < 100 || config.readIntervalMs > 10000)) {
      throw new Error('Read interval must be between 100ms and 10000ms');
    }

    if (config.signalStrengthThreshold && 
        (config.signalStrengthThreshold < -70 || config.signalStrengthThreshold > -20)) {
      throw new Error('Signal strength threshold must be between -70dBm and -20dBm');
    }
  }

  /**
   * Retrieves cached data if valid
   * @private
   */
  private getCachedData<T>(key: string): ApiResponse<T> | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Caches API response data
   * @private
   */
  private setCacheData<T>(key: string, data: ApiResponse<T>, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    });
  }

  /**
   * Invalidates all cache entries related to a specific reader
   * @private
   */
  private invalidateReaderCache(id: string): void {
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (key.includes(id) || key.startsWith('readers-')) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }
}

// Export singleton instance
export const readerApi = new ReaderApi(new ApiService());