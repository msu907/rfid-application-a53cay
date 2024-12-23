/**
 * @fileoverview Authentication middleware for API Gateway
 * @version 1.0.0
 * @license MIT
 */

import { Request, Response, NextFunction, RequestHandler } from 'express'; // ^4.18.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import helmet from 'helmet'; // ^7.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import { AuthService } from '../services/auth.service';
import { config } from '../config';
import winston from 'winston'; // ^3.8.0

// Constants
const BEARER_PREFIX = 'Bearer ';

const ERROR_MESSAGES = {
  NO_TOKEN: 'Authentication required - no token provided',
  INVALID_TOKEN: 'Authentication failed - invalid token',
  UNAUTHORIZED: 'Authentication failed - unauthorized access',
  FORBIDDEN: 'Authorization failed - insufficient permissions',
  RATE_LIMITED: 'Request rejected - rate limit exceeded',
  BLACKLISTED: 'Authentication failed - token blacklisted'
} as const;

const RATE_LIMITS = {
  ADMIN: 1000,
  ASSET_MANAGER: 500,
  OPERATOR: 200,
  VIEWER: 100
} as const;

// Interfaces
interface UserProfile {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}

interface AuthenticatedRequest extends Request {
  user?: UserProfile;
  token?: string;
  correlationId?: string;
}

interface RoleConfig {
  path: string;
  method: string;
  roles: string[];
  rateLimit: number;
}

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'auth.log' }),
    new winston.transports.Console()
  ]
});

/**
 * Authentication middleware
 * Validates JWT tokens and applies security measures
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Generate correlation ID for request tracking
    const correlationId = uuidv4();
    req.correlationId = correlationId;

    // Apply security headers
    helmet()(req, res, () => {});

    // Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith(BEARER_PREFIX)) {
      logger.warn('No token provided', { correlationId });
      res.status(401).json({ error: ERROR_MESSAGES.NO_TOKEN });
      return;
    }

    const token = authHeader.slice(BEARER_PREFIX.length);

    // Check token blacklist
    const isBlacklisted = await AuthService.checkTokenBlacklist(token);
    if (isBlacklisted) {
      logger.warn('Blacklisted token used', { correlationId, token: token.substring(0, 10) });
      res.status(401).json({ error: ERROR_MESSAGES.BLACKLISTED });
      return;
    }

    // Verify token
    const tokenPayload = await AuthService.verifyToken(token);
    if (!tokenPayload) {
      logger.warn('Invalid token', { correlationId, token: token.substring(0, 10) });
      res.status(401).json({ error: ERROR_MESSAGES.INVALID_TOKEN });
      return;
    }

    // Get user profile
    const userProfile = await AuthService.getUserProfile(tokenPayload);
    if (!userProfile) {
      logger.warn('User profile not found', { correlationId, token: token.substring(0, 10) });
      res.status(401).json({ error: ERROR_MESSAGES.UNAUTHORIZED });
      return;
    }

    // Attach user and token to request
    req.user = userProfile;
    req.token = token;

    logger.info('Authentication successful', {
      correlationId,
      userId: userProfile.id,
      roles: userProfile.roles
    });

    next();
  } catch (error) {
    logger.error('Authentication error', {
      correlationId: req.correlationId,
      error: error.message
    });
    res.status(401).json({ error: ERROR_MESSAGES.UNAUTHORIZED });
  }
};

/**
 * Authorization middleware factory
 * Creates role-based access control middleware
 */
export const authorize = (
  allowedRoles: string[],
  roleConfig?: RoleConfig
): RequestHandler => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        logger.warn('No user found in request', { correlationId: req.correlationId });
        res.status(401).json({ error: ERROR_MESSAGES.UNAUTHORIZED });
        return;
      }

      // Check user roles
      const hasValidRole = user.roles.some(role => 
        allowedRoles.includes(role) || role === 'ADMIN'
      );

      if (!hasValidRole) {
        logger.warn('Insufficient permissions', {
          correlationId: req.correlationId,
          userId: user.id,
          requiredRoles: allowedRoles,
          userRoles: user.roles
        });
        res.status(403).json({ error: ERROR_MESSAGES.FORBIDDEN });
        return;
      }

      // Apply role-based rate limiting
      if (roleConfig) {
        const limit = roleConfig.rateLimit || RATE_LIMITS[user.roles[0] as keyof typeof RATE_LIMITS];
        const rateLimiter = rateLimit({
          windowMs: 60 * 1000, // 1 minute
          max: limit,
          standardHeaders: true,
          message: ERROR_MESSAGES.RATE_LIMITED
        });

        rateLimiter(req, res, () => {
          logger.info('Authorization successful', {
            correlationId: req.correlationId,
            userId: user.id,
            roles: user.roles,
            path: req.path
          });
          next();
        });
      } else {
        logger.info('Authorization successful', {
          correlationId: req.correlationId,
          userId: user.id,
          roles: user.roles,
          path: req.path
        });
        next();
      }
    } catch (error) {
      logger.error('Authorization error', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(403).json({ error: ERROR_MESSAGES.FORBIDDEN });
    }
  };
};
```

This implementation provides a robust authentication and authorization middleware for the API Gateway with the following key features:

1. JWT Token Validation:
- Extracts and validates Bearer tokens
- Checks token blacklist
- Verifies token authenticity using Auth0
- Retrieves and validates user profiles

2. Role-Based Access Control:
- Supports hierarchical roles (Admin, Asset Manager, Operator, Viewer)
- Configurable role-based permissions
- Role-specific rate limiting

3. Security Features:
- Helmet security headers
- Rate limiting per role
- Request correlation IDs
- Token blacklist checking
- Comprehensive error handling

4. Monitoring and Logging:
- Detailed Winston logging
- Request tracking with correlation IDs
- Authentication and authorization audit logs
- Error tracking and reporting

5. Type Safety:
- TypeScript interfaces for type checking
- Extended Express Request type
- Proper error handling with types

The middleware can be used in the API Gateway routes like this:

```typescript
app.get('/api/assets', 
  authenticate, 
  authorize(['ASSET_MANAGER', 'ADMIN']), 
  assetsController.getAssets
);