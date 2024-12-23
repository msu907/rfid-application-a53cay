/**
 * @fileoverview Enhanced Authentication Service for API Gateway
 * @version 1.0.0
 * @license MIT
 */

import { auth } from '../config';
import jwt from 'jsonwebtoken'; // ^9.0.0
import jwksRsa from 'jwks-rsa'; // ^3.0.0
import { Auth0Client } from '@auth0/auth0-spa-js'; // ^2.1.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import winston from 'winston'; // ^3.8.0
import NodeCache from 'node-cache'; // ^5.1.2

// Interfaces
interface UserProfile {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  metadata: Record<string, unknown>;
  lastLogin: Date;
}

interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  permissions: string[];
  exp: number;
  iat: number;
  iss: string;
  aud: string;
}

interface JWTVerifyOptions {
  algorithms: string[];
  audience: string;
  issuer: string;
  clockTolerance: number;
}

// Constants
const ERROR_MESSAGES = {
  INVALID_TOKEN: 'Invalid token provided',
  EXPIRED_TOKEN: 'Token has expired',
  INVALID_SIGNATURE: 'Invalid token signature',
  MISSING_PROFILE: 'User profile not found',
  INVALID_ROLE: 'Invalid user role',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  AUTH0_ERROR: 'Auth0 service error',
  CACHE_ERROR: 'Cache operation failed'
} as const;

const JWT_ALGORITHMS = ['RS256'] as const;

const CACHE_TTL = {
  TOKEN: 3600, // 1 hour
  PROFILE: 1800, // 30 minutes
  JWKS: 86400 // 24 hours
} as const;

const RATE_LIMITS = {
  VERIFY_TOKEN: 100,
  GET_PROFILE: 50,
  VALIDATE_ROLE: 200
} as const;

/**
 * Enhanced Authentication Service Class
 * Handles JWT verification, user authentication, and authorization
 */
export class AuthService {
  private jwksClient: jwksRsa.JwksClient;
  private auth0Client: Auth0Client;
  private cache: NodeCache;
  private logger: winston.Logger;
  private readonly verifyOptions: JWTVerifyOptions;

  constructor() {
    // Initialize JWKS client with caching
    this.jwksClient = jwksRsa({
      cache: true,
      cacheMaxAge: CACHE_TTL.JWKS,
      rateLimit: true,
      jwksUri: `https://${auth.domain}/.well-known/jwks.json`,
      requestHeaders: {}, // Add custom headers if needed
      timeout: 10000 // 10 seconds
    });

    // Initialize Auth0 client
    this.auth0Client = new Auth0Client({
      domain: auth.domain,
      client_id: auth.clientId,
      audience: auth.audience,
      scope: 'openid profile email'
    });

    // Initialize cache
    this.cache = new NodeCache({
      stdTTL: CACHE_TTL.TOKEN,
      checkperiod: 120,
      useClones: false
    });

    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'auth-service.log' })
      ]
    });

    // Set JWT verification options
    this.verifyOptions = {
      algorithms: JWT_ALGORITHMS,
      audience: auth.audience,
      issuer: `https://${auth.domain}/`,
      clockTolerance: 5 // 5 seconds
    };
  }

  /**
   * Verifies JWT token with enhanced security checks
   * @param token - JWT token to verify
   * @returns Promise<TokenPayload>
   * @throws Error if token is invalid
   */
  public async verifyToken(token: string): Promise<TokenPayload> {
    try {
      // Check cache first
      const cachedPayload = this.cache.get<TokenPayload>(token);
      if (cachedPayload) {
        this.logger.debug('Token found in cache', { tokenId: token.substring(0, 10) });
        return cachedPayload;
      }

      // Get signing key
      const decodedToken = jwt.decode(token, { complete: true });
      if (!decodedToken || !decodedToken.header.kid) {
        throw new Error(ERROR_MESSAGES.INVALID_TOKEN);
      }

      const signingKey = await this.jwksClient.getSigningKey(decodedToken.header.kid);
      const publicKey = signingKey.getPublicKey();

      // Verify token
      const payload = jwt.verify(token, publicKey, this.verifyOptions) as TokenPayload;

      // Additional security checks
      if (Date.now() >= payload.exp * 1000) {
        throw new Error(ERROR_MESSAGES.EXPIRED_TOKEN);
      }

      // Cache the verified payload
      this.cache.set(token, payload, CACHE_TTL.TOKEN);

      // Log successful verification
      this.logger.info('Token verified successfully', {
        user: payload.sub,
        role: payload.role
      });

      return payload;
    } catch (error) {
      this.logger.error('Token verification failed', { error });
      throw error;
    }
  }

  /**
   * Retrieves enhanced user profile with caching
   * @param payload - Verified token payload
   * @returns Promise<UserProfile>
   * @throws Error if profile cannot be retrieved
   */
  public async getUserProfile(payload: TokenPayload): Promise<UserProfile> {
    try {
      // Check cache first
      const cacheKey = `profile_${payload.sub}`;
      const cachedProfile = this.cache.get<UserProfile>(cacheKey);
      if (cachedProfile) {
        return cachedProfile;
      }

      // Construct profile with additional metadata
      const profile: UserProfile = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions,
        metadata: {},
        lastLogin: new Date()
      };

      // Fetch additional metadata from Auth0
      try {
        const userInfo = await this.auth0Client.getUserInfo(payload.sub);
        profile.metadata = userInfo;
      } catch (error) {
        this.logger.warn('Failed to fetch additional user metadata', { error });
      }

      // Cache the profile
      this.cache.set(cacheKey, profile, CACHE_TTL.PROFILE);

      // Log profile retrieval
      this.logger.info('User profile retrieved', { userId: profile.id });

      return profile;
    } catch (error) {
      this.logger.error('Failed to get user profile', { error });
      throw new Error(ERROR_MESSAGES.MISSING_PROFILE);
    }
  }

  /**
   * Validates user role and permissions with hierarchy
   * @param user - User profile
   * @param allowedRoles - Array of allowed roles
   * @returns Promise<boolean>
   */
  public async validateRole(user: UserProfile, allowedRoles: string[]): Promise<boolean> {
    try {
      // Role hierarchy (higher index means higher privileges)
      const roleHierarchy = ['viewer', 'operator', 'asset_manager', 'admin'];
      
      // Get user role index
      const userRoleIndex = roleHierarchy.indexOf(user.role);
      if (userRoleIndex === -1) {
        throw new Error(ERROR_MESSAGES.INVALID_ROLE);
      }

      // Check if user has sufficient privileges
      const hasValidRole = allowedRoles.some(role => {
        const requiredRoleIndex = roleHierarchy.indexOf(role);
        return userRoleIndex >= requiredRoleIndex;
      });

      // Log validation result
      this.logger.info('Role validation', {
        userId: user.id,
        role: user.role,
        allowed: hasValidRole
      });

      return hasValidRole;
    } catch (error) {
      this.logger.error('Role validation failed', { error });
      throw error;
    }
  }
}

// Export singleton instance
export default new AuthService();