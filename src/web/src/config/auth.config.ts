/**
 * Authentication and Authorization Configuration
 * Provides comprehensive security settings for the RFID Asset Tracking System
 * @version 1.0.0
 */

import { UserRole } from '../types/auth.types';

/**
 * Auth0 Configuration
 * Production-ready authentication settings with enhanced security parameters
 */
export const AUTH_CONFIG = {
  // Auth0 tenant domain
  domain: 'rfid-asset-tracking.auth0.com',
  // Auth0 application client ID
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID as string,
  // API identifier in Auth0
  audience: process.env.REACT_APP_AUTH0_AUDIENCE as string,
  // Geographic region for compliance
  region: 'us',
  // OAuth response type for enhanced security
  responseType: 'code',
  // Default authentication scope
  scope: getDefaultScope(),
  // Security-specific settings
  auth: {
    // Redirect URI for authentication callbacks
    redirectUri: `${window.location.origin}/callback`,
    // Required for enhanced security
    usePKCE: true,
    // Prevent token leaks in URLs
    usePostMessage: true,
    // Cookie configuration for XSS protection
    cookieOptions: {
      secure: true,
      sameSite: 'strict'
    }
  }
} as const;

/**
 * Token Management Configuration
 * Enhanced security settings for JWT token handling
 */
export const TOKEN_CONFIG = {
  // Local storage key for token
  storageKey: 'rfid_auth_token',
  // Buffer time before token expiry (in seconds)
  expiryBuffer: TOKEN_EXPIRY_BUFFER,
  // Threshold for token refresh (in seconds)
  refreshThreshold: TOKEN_REFRESH_THRESHOLD,
  // Token rotation interval (in seconds)
  rotationInterval: 3600,
  // Use secure storage methods
  secureStorage: true,
  // Cookie security settings
  cookieConfig: {
    secure: true,
    sameSite: 'strict',
    httpOnly: true,
    path: '/'
  }
} as const;

/**
 * Role-Based Access Control Configuration
 * Comprehensive permission mappings with hierarchical inheritance
 */
export const ROLE_PERMISSIONS = {
  [UserRole.ADMIN]: [
    'system.configure',
    'users.manage',
    'assets.create',
    'assets.update',
    'assets.delete',
    'assets.read',
    'locations.manage',
    'reports.generate',
    'settings.modify'
  ],
  [UserRole.ASSET_MANAGER]: [
    'assets.create',
    'assets.update',
    'assets.delete',
    'assets.read',
    'locations.manage',
    'reports.generate'
  ],
  [UserRole.OPERATOR]: [
    'assets.read',
    'assets.update',
    'locations.view',
    'reports.view'
  ],
  [UserRole.VIEWER]: [
    'assets.read',
    'locations.view'
  ]
} as const;

/**
 * Session Management Configuration
 * Security-focused session handling parameters
 */
export const SESSION_CONFIG = {
  // Session timeout (in seconds)
  timeout: SESSION_TIMEOUT,
  // Warning threshold before timeout (in seconds)
  warningThreshold: SESSION_WARNING,
  // Extend session on activity
  extendOnActivity: true,
  // Inactivity detection settings
  inactivity: {
    enabled: true,
    threshold: 900 // 15 minutes
  },
  // Concurrent session handling
  concurrent: {
    // Prevent multiple active sessions
    preventMultiple: true,
    // Action on new session detection
    action: 'terminate-oldest'
  }
} as const;

// Global constants
const AUTH_STORAGE_KEY = 'rfid_auth_user';
const TOKEN_EXPIRY_BUFFER = 300; // 5 minutes
const TOKEN_REFRESH_THRESHOLD = 600; // 10 minutes
const SESSION_TIMEOUT = 3600; // 1 hour
const SESSION_WARNING = 300; // 5 minutes

/**
 * Returns the default authentication scope string with enhanced security scopes
 * @returns Space-separated list of default scopes
 */
function getDefaultScope(): string {
  const baseScopes = ['openid', 'profile', 'email'];
  const systemScopes = ['offline_access', 'rfid:read', 'rfid:write'];
  const securityScopes = ['security:enhanced', 'mfa:required'];
  
  return [...baseScopes, ...systemScopes, ...securityScopes].join(' ');
}

/**
 * Validates permission strings against allowed patterns
 * @param permissions Array of permission strings to validate
 * @returns Boolean indicating if all permissions are valid
 */
function validatePermissions(permissions: string[]): boolean {
  const permissionPattern = /^[a-z]+\.[a-z]+$/;
  const uniquePermissions = new Set(permissions);
  
  // Check for duplicates
  if (uniquePermissions.size !== permissions.length) {
    return false;
  }
  
  // Validate each permission format
  return permissions.every(permission => 
    permissionPattern.test(permission) && 
    permission.split('.').length === 2
  );
}

// Validate all role permissions on initialization
Object.values(ROLE_PERMISSIONS).forEach(permissions => {
  if (!validatePermissions(permissions)) {
    throw new Error('Invalid permission configuration detected');
  }
});