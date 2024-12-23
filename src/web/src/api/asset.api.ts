/**
 * Asset API Client Module
 * Provides type-safe methods for asset-related CRUD operations with enhanced error handling,
 * caching, and security features.
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // ^1.4.0
import { setupCache, buildMemoryStorage } from 'axios-cache-adapter'; // ^2.7.3
import axiosRetry from 'axios-retry'; // ^3.5.0
import { 
  ApiResponse, 
  ApiError, 
  PaginatedResponse,
  PaginationParams,
  API_ERROR_CODES 
} from '../types/api.types';

// Configuration Constants
const DEFAULT_RETRY_CONFIG = {
  retries: 3,
  backoffFactor: 2,
  statusCodes: [408, 429, 500, 502, 503, 504],
  retryDelay: (retryCount: number) => Math.pow(2, retryCount) * 1000,
};

const DEFAULT_CACHE_CONFIG = {
  maxAge: 5 * 60 * 1000, // 5 minutes
  exclude: { query: false },
  key: (req: AxiosRequestConfig) => {
    return `${req.method}-${req.url}-${JSON.stringify(req.params)}`;
  },
};

const CSRF_HEADER = 'X-CSRF-Token';
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api/v1';

// Asset Type Definitions
interface Asset {
  id: string;
  rfidTag: string;
  name: string;
  description: string;
  imageUrl?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

interface AssetCreateInput {
  rfidTag: string;
  name: string;
  description: string;
  location?: string;
}

interface AssetUpdateInput extends Partial<AssetCreateInput> {
  id: string;
}

interface AssetHistoryEntry {
  timestamp: string;
  location: string;
  readerId: string;
  signalStrength: number;
}

/**
 * Creates and configures an axios instance with retry, caching, and security features
 */
const createApiClient = (): AxiosInstance => {
  // Configure caching
  const cache = setupCache({
    storage: buildMemoryStorage(),
    ...DEFAULT_CACHE_CONFIG,
  });

  // Create axios instance
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    adapter: cache.adapter,
  });

  // Configure retry logic
  axiosRetry(client, {
    ...DEFAULT_RETRY_CONFIG,
    retryCondition: (error) => {
      return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.response?.status === 429;
    },
  });

  // Add request interceptor for CSRF token
  client.interceptors.request.use((config) => {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    if (token) {
      config.headers[CSRF_HEADER] = token;
    }
    return config;
  });

  // Add response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const apiError: ApiError = {
        code: API_ERROR_CODES.NETWORK_ERROR,
        message: error.message,
        details: {},
        timestamp: new Date().toISOString(),
      };

      if (error.response) {
        apiError.code = error.response.data?.code || API_ERROR_CODES.INTERNAL_ERROR;
        apiError.message = error.response.data?.message || 'An unexpected error occurred';
        apiError.details = error.response.data?.details || {};
      }

      return Promise.reject(apiError);
    }
  );

  return client;
};

// Create API client instance
const apiClient = createApiClient();

/**
 * Asset API client object containing all asset-related operations
 */
export const assetApi = {
  /**
   * Retrieves a paginated list of assets with optional filtering
   */
  getAssets: async (params: PaginationParams): Promise<ApiResponse<PaginatedResponse<Asset>>> => {
    const response = await apiClient.get('/assets', { params });
    return response.data;
  },

  /**
   * Retrieves a single asset by ID
   */
  getAssetById: async (id: string): Promise<ApiResponse<Asset>> => {
    const response = await apiClient.get(`/assets/${id}`);
    return response.data;
  },

  /**
   * Creates a new asset
   */
  createAsset: async (asset: AssetCreateInput): Promise<ApiResponse<Asset>> => {
    const response = await apiClient.post('/assets', asset);
    return response.data;
  },

  /**
   * Updates an existing asset
   */
  updateAsset: async (asset: AssetUpdateInput): Promise<ApiResponse<Asset>> => {
    const response = await apiClient.put(`/assets/${asset.id}`, asset);
    return response.data;
  },

  /**
   * Deletes an asset by ID
   */
  deleteAsset: async (id: string): Promise<ApiResponse<void>> => {
    const response = await apiClient.delete(`/assets/${id}`);
    return response.data;
  },

  /**
   * Uploads an image for an asset
   */
  uploadAssetImage: async (id: string, file: File): Promise<ApiResponse<{ imageUrl: string }>> => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await apiClient.post(`/assets/${id}/image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Retrieves the location history for an asset
   */
  getAssetHistory: async (
    id: string,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<AssetHistoryEntry[]>> => {
    const response = await apiClient.get(`/assets/${id}/history`, {
      params: {
        startDate,
        endDate,
      },
    });
    return response.data;
  },
};

// Type exports for consumers
export type {
  Asset,
  AssetCreateInput,
  AssetUpdateInput,
  AssetHistoryEntry,
};