/**
 * TypeScript type definitions for authentication and authorization.
 * Provides comprehensive types for JWT-based authentication with Auth0 integration
 * and role-based access control (RBAC).
 * @version 1.0.0
 */

import { ApiResponse } from './api.types';

/**
 * User role enumeration for role-based access control
 * Defines strict access levels from highest (ADMIN) to lowest (VIEWER)
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  ASSET_MANAGER = 'ASSET_MANAGER',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER'
}

/**
 * Granular permissions for fine-grained access control
 * Each permission represents a specific system capability
 */
export enum Permission {
  READ_ASSETS = 'READ_ASSETS',
  WRITE_ASSETS = 'WRITE_ASSETS',
  MANAGE_USERS = 'MANAGE_USERS',
  CONFIGURE_SYSTEM = 'CONFIGURE_SYSTEM'
}

/**
 * Comprehensive user interface with profile information and access control
 */
export interface User {
  /** Unique user identifier */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** User's assigned role */
  role: UserRole;
  /** User's granted permissions */
  permissions: Permission[];
  /** Timestamp of last login */
  lastLogin: string;
  /** Optional profile image URL */
  profileImage: string | null;
  /** Account status */
  isActive: boolean;
}

/**
 * Login credentials interface with validation patterns
 */
export interface LoginCredentials {
  /** User email address */
  email: string;
  /** User password (never stored, only transmitted) */
  password: string;
  /** Remember user preference */
  rememberMe: boolean;
}

/**
 * Authentication response interface with token management
 */
export interface AuthResponse extends ApiResponse<{
  /** Authenticated user information */
  user: User;
  /** JWT access token */
  accessToken: string;
  /** JWT refresh token */
  refreshToken: string;
  /** Token expiration time in seconds */
  expiresIn: number;
  /** Token type (usually 'Bearer') */
  tokenType: string;
}> {}

/**
 * JWT token payload structure with standard and custom claims
 */
export interface JWTPayload {
  /** Subject (user ID) */
  sub: string;
  /** User email */
  email: string;
  /** User role */
  role: UserRole;
  /** User permissions */
  permissions: Permission[];
  /** Expiration timestamp */
  exp: number;
  /** Issued at timestamp */
  iat: number;
  /** Token issuer (Auth0 domain) */
  iss: string;
  /** Token audience (API identifier) */
  aud: string;
}

/**
 * Auth0 configuration interface
 */
export interface Auth0Config {
  /** Auth0 domain */
  domain: string;
  /** Auth0 client ID */
  clientId: string;
  /** API audience identifier */
  audience: string;
  /** OAuth scope */
  scope: string;
}

/**
 * Local storage keys for auth-related data
 */
export const AUTH_STORAGE_KEY = 'rfid_auth_user';
export const TOKEN_STORAGE_KEY = 'rfid_auth_token';
export const REFRESH_TOKEN_KEY = 'rfid_refresh_token';

/**
 * Type guard to check if a value is a valid User object
 */
export function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const user = value as Partial<User>;
  
  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    Object.values(UserRole).includes(user.role as UserRole) &&
    Array.isArray(user.permissions) &&
    user.permissions.every(p => Object.values(Permission).includes(p)) &&
    typeof user.lastLogin === 'string' &&
    (user.profileImage === null || typeof user.profileImage === 'string') &&
    typeof user.isActive === 'boolean'
  );
}

/**
 * Type guard to check if a value is a valid JWTPayload
 */
export function isJWTPayload(value: unknown): value is JWTPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Partial<JWTPayload>;
  
  return (
    typeof payload.sub === 'string' &&
    typeof payload.email === 'string' &&
    Object.values(UserRole).includes(payload.role as UserRole) &&
    Array.isArray(payload.permissions) &&
    payload.permissions.every(p => Object.values(Permission).includes(p)) &&
    typeof payload.exp === 'number' &&
    typeof payload.iat === 'number' &&
    typeof payload.iss === 'string' &&
    typeof payload.aud === 'string'
  );
}