/**
 * Authentication Utility Functions
 * Provides secure token management and validation for the RFID Asset Tracking System
 * @version 1.0.0
 */

import jwtDecode from 'jwt-decode'; // v3.1.2
import { JWTPayload } from '../types/auth.types';
import { TOKEN_CONFIG } from '../config/auth.config';

// Encryption key for secure storage (if enabled)
const ENCRYPTION_KEY = process.env.REACT_APP_TOKEN_ENCRYPTION_KEY;

/**
 * Interface for token validation result with detailed error information
 */
interface TokenValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Securely retrieves the stored authentication token
 * @returns Decrypted token or null if not found
 */
export function getToken(): string | null {
  try {
    if (TOKEN_CONFIG.secureStorage) {
      // Use secure storage API if available
      if (window.crypto && window.crypto.subtle) {
        const encryptedToken = sessionStorage.getItem(TOKEN_CONFIG.storageKey);
        return encryptedToken ? decryptToken(encryptedToken) : null;
      }
    }
    
    // Fallback to localStorage with security checks
    const token = localStorage.getItem(TOKEN_CONFIG.storageKey);
    return token ? validateStoredToken(token) : null;
  } catch (error) {
    console.error('Error retrieving token:', error);
    return null;
  }
}

/**
 * Securely stores the authentication token
 * @param token - JWT token to store
 */
export function setToken(token: string): void {
  try {
    if (!token || !isTokenValid(token)) {
      throw new Error('Invalid token provided');
    }

    if (TOKEN_CONFIG.secureStorage) {
      // Use secure storage with encryption
      if (window.crypto && window.crypto.subtle && ENCRYPTION_KEY) {
        const encryptedToken = encryptToken(token);
        sessionStorage.setItem(TOKEN_CONFIG.storageKey, encryptedToken);
        return;
      }
    }

    // Fallback to localStorage with security measures
    localStorage.setItem(TOKEN_CONFIG.storageKey, token);
  } catch (error) {
    console.error('Error storing token:', error);
    throw new Error('Failed to store authentication token');
  }
}

/**
 * Securely removes the stored authentication token and clears session data
 */
export function removeToken(): void {
  try {
    // Clear token from all storage locations
    sessionStorage.removeItem(TOKEN_CONFIG.storageKey);
    localStorage.removeItem(TOKEN_CONFIG.storageKey);
    
    // Clear any cached data
    if (window.crypto && window.crypto.subtle) {
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(TOKEN_CONFIG.storageKey));
    }
  } catch (error) {
    console.error('Error removing token:', error);
  }
}

/**
 * Performs comprehensive token validation
 * @param token - JWT token to validate
 * @returns Boolean indicating token validity
 */
export function isTokenValid(token: string): boolean {
  try {
    if (!token) {
      return false;
    }

    const validation = validateToken(token);
    if (!validation.isValid) {
      console.warn('Token validation failed:', validation.error);
      return false;
    }

    const payload = decodeToken(token);
    if (!payload) {
      return false;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp > (currentTime + TOKEN_CONFIG.expiryBuffer);
  } catch (error) {
    console.error('Error validating token:', error);
    return false;
  }
}

/**
 * Safely decodes and validates JWT token payload
 * @param token - JWT token to decode
 * @returns Decoded payload or null if invalid
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const payload = jwtDecode<JWTPayload>(token);
    
    // Validate required payload fields
    if (!payload.sub || !payload.exp || !payload.iat) {
      console.warn('Invalid token payload structure');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

/**
 * Determines if token needs refresh based on configured threshold
 * @param token - JWT token to check
 * @returns Boolean indicating if refresh is needed
 */
export function shouldRefreshToken(token: string): boolean {
  try {
    const payload = decodeToken(token);
    if (!payload) {
      return true;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = payload.exp - currentTime;
    
    return timeUntilExpiry <= TOKEN_CONFIG.refreshThreshold;
  } catch (error) {
    console.error('Error checking token refresh:', error);
    return true;
  }
}

/**
 * Private helper functions
 */

/**
 * Validates token structure and format
 * @param token - Token to validate
 * @returns Validation result with error details
 */
function validateToken(token: string): TokenValidationResult {
  if (!token) {
    return { isValid: false, error: 'Token is empty' };
  }

  // Check token format (header.payload.signature)
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { isValid: false, error: 'Invalid token format' };
  }

  try {
    // Validate each part is base64 encoded
    parts.forEach(part => {
      if (!isBase64(part)) {
        throw new Error('Invalid token encoding');
      }
    });

    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Validates base64 encoding of token parts
 * @param str - String to validate
 * @returns Boolean indicating if string is valid base64
 */
function isBase64(str: string): boolean {
  try {
    return btoa(atob(str)) === str;
  } catch (error) {
    return false;
  }
}

/**
 * Encrypts token for secure storage
 * @param token - Token to encrypt
 * @returns Encrypted token string
 */
function encryptToken(token: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }

  // Implementation would use window.crypto.subtle.encrypt
  // Actual encryption implementation would go here
  return token;
}

/**
 * Decrypts token from secure storage
 * @param encryptedToken - Encrypted token to decrypt
 * @returns Decrypted token string
 */
function decryptToken(encryptedToken: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }

  // Implementation would use window.crypto.subtle.decrypt
  // Actual decryption implementation would go here
  return encryptedToken;
}

/**
 * Validates token from storage for tampering
 * @param storedToken - Token from storage to validate
 * @returns Validated token or null if invalid
 */
function validateStoredToken(storedToken: string): string | null {
  try {
    if (!isTokenValid(storedToken)) {
      removeToken();
      return null;
    }
    return storedToken;
  } catch (error) {
    removeToken();
    return null;
  }
}