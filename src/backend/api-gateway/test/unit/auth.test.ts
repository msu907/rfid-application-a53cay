/**
 * @fileoverview Unit tests for API Gateway authentication and authorization
 * @version 1.0.0
 * @license MIT
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import supertest from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { AuthService } from '../../src/services/auth.service';
import { authenticate, authorize } from '../../src/middleware/auth.middleware';

// Mock constants
const MOCK_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
const MOCK_USER_PROFILE = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'admin',
  permissions: ['read:assets', 'write:assets'],
  securityLevel: 'high',
  lastLogin: '2024-01-01T00:00:00Z'
};
const MOCK_TOKEN_PAYLOAD = {
  sub: 'test-user-id',
  email: 'test@example.com',
  role: 'admin',
  permissions: ['read:assets', 'write:assets'],
  securityLevel: 'high',
  exp: 1735689600,
  iat: 1704067200,
  jti: 'unique-token-id'
};
const MOCK_SECURITY_CONFIG = {
  rateLimit: 100,
  tokenExpirySeconds: 3600,
  maxFailedAttempts: 3,
  blacklistDuration: 300
};

// Mock setup
jest.mock('../../src/services/auth.service');
const mockAuthService = AuthService as jest.Mocked<typeof AuthService>;

// Test app setup
const app = express();
app.use(express.json());

describe('Authentication Middleware Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Token Verification Tests', () => {
    test('should successfully verify valid JWT token', async () => {
      // Setup
      mockAuthService.verifyToken.mockResolvedValueOnce(MOCK_TOKEN_PAYLOAD);
      mockAuthService.getUserProfile.mockResolvedValueOnce(MOCK_USER_PROFILE);
      mockAuthService.checkTokenBlacklist.mockResolvedValueOnce(false);

      const req = {
        headers: {
          authorization: `Bearer ${MOCK_TOKEN}`
        }
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      // Execute
      await authenticate(req, res, next);

      // Assert
      expect(mockAuthService.verifyToken).toHaveBeenCalledWith(MOCK_TOKEN);
      expect(mockAuthService.getUserProfile).toHaveBeenCalledWith(MOCK_TOKEN_PAYLOAD);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should reject blacklisted token', async () => {
      // Setup
      mockAuthService.checkTokenBlacklist.mockResolvedValueOnce(true);

      const req = {
        headers: {
          authorization: `Bearer ${MOCK_TOKEN}`
        }
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      // Execute
      await authenticate(req, res, next);

      // Assert
      expect(mockAuthService.checkTokenBlacklist).toHaveBeenCalledWith(MOCK_TOKEN);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String)
      }));
      expect(next).not.toHaveBeenCalled();
    });

    test('should handle missing authorization header', async () => {
      // Setup
      const req = {
        headers: {}
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      // Execute
      await authenticate(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String)
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Role-Based Authorization Tests', () => {
    test('should authorize user with valid role', async () => {
      // Setup
      const authorizeMiddleware = authorize(['admin', 'asset_manager']);
      const req = {
        user: {
          ...MOCK_USER_PROFILE,
          roles: ['admin']
        }
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      // Execute
      await authorizeMiddleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should reject user with insufficient permissions', async () => {
      // Setup
      const authorizeMiddleware = authorize(['admin']);
      const req = {
        user: {
          ...MOCK_USER_PROFILE,
          roles: ['viewer']
        }
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      // Execute
      await authorizeMiddleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.any(String)
      }));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting Tests', () => {
    test('should apply role-based rate limits', async () => {
      // Setup
      const roleConfig = {
        path: '/api/test',
        method: 'GET',
        roles: ['admin'],
        rateLimit: 1000
      };
      const authorizeMiddleware = authorize(['admin'], roleConfig);
      const req = {
        user: {
          ...MOCK_USER_PROFILE,
          roles: ['admin']
        },
        path: '/api/test'
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      // Execute
      await authorizeMiddleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Security Event Logging Tests', () => {
    test('should log security events for authentication attempts', async () => {
      // Setup
      const logSecurityEventSpy = jest.spyOn(mockAuthService, 'logSecurityEvent');
      mockAuthService.verifyToken.mockResolvedValueOnce(MOCK_TOKEN_PAYLOAD);
      mockAuthService.getUserProfile.mockResolvedValueOnce(MOCK_USER_PROFILE);
      mockAuthService.checkTokenBlacklist.mockResolvedValueOnce(false);

      const req = {
        headers: {
          authorization: `Bearer ${MOCK_TOKEN}`
        }
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as unknown as Response;
      const next = jest.fn() as NextFunction;

      // Execute
      await authenticate(req, res, next);

      // Assert
      expect(logSecurityEventSpy).toHaveBeenCalled();
    });
  });
});