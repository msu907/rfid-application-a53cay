/**
 * Authentication API Module
 * Provides secure authentication endpoints and functions for the RFID Asset Tracking System
 * Implements JWT-based authentication with Auth0 integration and comprehensive security measures
 * @version 1.0.0
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios'; // v1.4.0
import jwtDecode from 'jwt-decode'; // v3.1.2
import { LoginCredentials, AuthResponse, JWTPayload, isJWTPayload } from '../types/auth.types';
import { AUTH_CONFIG } from '../config/auth.config';
import { API_ERROR_CODES, isApiError, ApiError } from '../types/api.types';

// Global Constants
const API_BASE_URL = `${AUTH_CONFIG.domain}/api/v1`;
const AUTH_ENDPOINTS = {
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  VALIDATE: '/auth/validate'
} as const;
const REQUEST_TIMEOUT = 5000;
const MAX_RETRY_ATTEMPTS = 3;

// Create secure axios instance
const secureAxios: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  withCredentials: true, // Enable secure cookie handling
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest' // CSRF protection
  }
});

/**
 * Configures axios interceptors for secure API communication
 * Implements request/response interceptors with comprehensive security measures
 */
function configureAxiosInterceptors(): void {
  // Request interceptor
  secureAxios.interceptors.request.use(
    (config: AxiosRequestConfig) => {
      const token = localStorage.getItem(AUTH_CONFIG.auth.storageKey);
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        };
      }
      // Enforce HTTPS in production
      if (process.env.NODE_ENV === 'production' && !config.url?.startsWith('https')) {
        config.url = `https://${config.url}`;
      }
      return config;
    },
    (error: AxiosError) => Promise.reject(error)
  );

  // Response interceptor
  secureAxios.interceptors.response.use(
    response => response,
    async (error: AxiosError) => {
      const originalRequest = error.config;
      
      // Handle token expiration
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const refreshToken = localStorage.getItem(AUTH_CONFIG.auth.refreshToken);
          if (refreshToken) {
            const newAuth = await refreshToken(refreshToken);
            originalRequest.headers['Authorization'] = `Bearer ${newAuth.data.accessToken}`;
            return secureAxios(originalRequest);
          }
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }

      // Implement retry logic for network errors
      if (error.message === 'Network Error' && originalRequest._retryCount < MAX_RETRY_ATTEMPTS) {
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        return new Promise(resolve => {
          setTimeout(() => resolve(secureAxios(originalRequest)), 1000 * originalRequest._retryCount);
        });
      }

      return Promise.reject(error);
    }
  );
}

/**
 * Authenticates user with provided credentials
 * @param credentials User login credentials
 * @returns Promise resolving to authentication response
 * @throws ApiError if authentication fails
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    // Input validation
    if (!credentials.email || !credentials.password) {
      throw new Error('Invalid credentials provided');
    }

    const response = await secureAxios.post<AuthResponse>(AUTH_ENDPOINTS.LOGIN, credentials);
    
    if (response.data.data.accessToken) {
      // Securely store tokens
      localStorage.setItem(AUTH_CONFIG.auth.storageKey, response.data.data.accessToken);
      localStorage.setItem(AUTH_CONFIG.auth.refreshToken, response.data.data.refreshToken);
    }

    return response.data;
  } catch (error) {
    handleAuthError(error as Error);
    throw error;
  }
}

/**
 * Securely logs out the current user
 * @returns Promise that resolves when logout is complete
 */
export async function logout(): Promise<void> {
  try {
    await secureAxios.post(AUTH_ENDPOINTS.LOGOUT);
    
    // Clean up stored tokens and session data
    localStorage.removeItem(AUTH_CONFIG.auth.storageKey);
    localStorage.removeItem(AUTH_CONFIG.auth.refreshToken);
    
    // Clear any secure cookies
    document.cookie.split(';').forEach(cookie => {
      document.cookie = cookie
        .replace(/^ +/, '')
        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Continue with local cleanup even if server request fails
    localStorage.clear();
  }
}

/**
 * Refreshes the current authentication token
 * @param currentToken Current refresh token
 * @returns Promise resolving to new authentication response
 * @throws ApiError if refresh fails
 */
export async function refreshToken(currentToken: string): Promise<AuthResponse> {
  try {
    const response = await secureAxios.post<AuthResponse>(
      AUTH_ENDPOINTS.REFRESH,
      { refreshToken: currentToken }
    );

    if (response.data.data.accessToken) {
      localStorage.setItem(AUTH_CONFIG.auth.storageKey, response.data.data.accessToken);
      localStorage.setItem(AUTH_CONFIG.auth.refreshToken, response.data.data.refreshToken);
    }

    return response.data;
  } catch (error) {
    handleAuthError(error as Error);
    throw error;
  }
}

/**
 * Validates the current authentication token
 * @param token JWT token to validate
 * @returns Promise resolving to boolean indicating token validity
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    // Decode and validate token locally first
    const decoded = jwtDecode<JWTPayload>(token);
    
    if (!isJWTPayload(decoded)) {
      return false;
    }

    // Check token expiration with buffer time
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp <= currentTime + AUTH_CONFIG.auth.expiryBuffer) {
      return false;
    }

    // Verify token with server
    const response = await secureAxios.post(AUTH_ENDPOINTS.VALIDATE, { token });
    return response.status === 200;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

/**
 * Handles authentication errors with proper error mapping
 * @param error Error object to handle
 * @throws ApiError with appropriate error code and message
 */
function handleAuthError(error: Error): never {
  if (axios.isAxiosError(error)) {
    const apiError: ApiError = {
      code: (error.response?.status === 401) ? API_ERROR_CODES.UNAUTHORIZED :
            (error.response?.status === 429) ? API_ERROR_CODES.RATE_LIMIT_EXCEEDED :
            API_ERROR_CODES.INTERNAL_ERROR,
      message: error.response?.data?.message || 'Authentication failed',
      details: error.response?.data || {},
      timestamp: new Date().toISOString()
    };
    throw apiError;
  }
  
  throw {
    code: API_ERROR_CODES.INTERNAL_ERROR,
    message: error.message,
    details: {},
    timestamp: new Date().toISOString()
  } as ApiError;
}

// Initialize secure axios configuration
configureAxiosInterceptors();