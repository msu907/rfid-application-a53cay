/**
 * Enhanced authentication hook providing secure authentication functionality
 * with Auth0 integration, session management, and security validations.
 * @version 1.0.0
 */

import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Auth0Client } from '@auth0/auth0-spa-js';
import { 
  LoginCredentials, 
  User, 
  UserRole, 
  Permission,
  AUTH_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_KEY,
  isUser,
  isJWTPayload
} from '../types/auth.types';

// Security configuration constants
const SESSION_REFRESH_INTERVAL = 300000; // 5 minutes
const TOKEN_VALIDATION_INTERVAL = 60000; // 1 minute
const MAX_SESSION_DURATION = 28800000; // 8 hours
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION = 900000; // 15 minutes

// Security headers configuration
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
};

// Auth0 client configuration
const auth0Config = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN!,
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID!,
  audience: process.env.REACT_APP_AUTH0_AUDIENCE!,
  scope: 'openid profile email',
};

/**
 * Interface for authentication state and security context
 */
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  securityContext: SecurityContext;
}

/**
 * Interface for security context and session management
 */
interface SecurityContext {
  lastActivity: Date;
  loginAttempts: number;
  lockoutUntil: Date | null;
  sessionStart: Date;
  tokenRefreshTime: Date | null;
}

/**
 * Enhanced authentication hook with comprehensive security features
 */
export function useAuth() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [auth0Client] = useState(() => new Auth0Client(auth0Config));
  
  // Initialize security state
  const [securityContext, setSecurityContext] = useState<SecurityContext>({
    lastActivity: new Date(),
    loginAttempts: 0,
    lockoutUntil: null,
    sessionStart: new Date(),
    tokenRefreshTime: null,
  });

  // Get auth state from Redux store
  const authState = useSelector((state: { auth: AuthState }) => state.auth);

  /**
   * Validates and updates security headers
   */
  const validateSecurityHeaders = useCallback(() => {
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
      if (document.head.querySelector(`meta[http-equiv="${key}"]`)) {
        return;
      }
      const meta = document.createElement('meta');
      meta.httpEquiv = key;
      meta.content = value;
      document.head.appendChild(meta);
    });
  }, []);

  /**
   * Securely handles user login with enhanced validation
   */
  const handleSecureLogin = useCallback(async (credentials: LoginCredentials) => {
    try {
      // Check for account lockout
      if (securityContext.lockoutUntil && new Date() < securityContext.lockoutUntil) {
        throw new Error('Account temporarily locked. Please try again later.');
      }

      // Validate credentials format
      if (!credentials.email || !credentials.password) {
        throw new Error('Invalid credentials format');
      }

      // Attempt login with Auth0
      const authResult = await auth0Client.loginWithCredentials({
        username: credentials.email,
        password: credentials.password,
      });

      if (!authResult || !authResult.user) {
        // Update failed login attempts
        const newAttempts = securityContext.loginAttempts + 1;
        if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
          setSecurityContext({
            ...securityContext,
            loginAttempts: 0,
            lockoutUntil: new Date(Date.now() + LOCKOUT_DURATION),
          });
          throw new Error('Maximum login attempts exceeded. Account temporarily locked.');
        }
        
        setSecurityContext({
          ...securityContext,
          loginAttempts: newAttempts,
        });
        throw new Error('Invalid credentials');
      }

      // Validate JWT token payload
      const decodedToken = await auth0Client.getIdTokenClaims();
      if (!isJWTPayload(decodedToken)) {
        throw new Error('Invalid token payload');
      }

      // Create user object from token claims
      const user: User = {
        id: decodedToken.sub,
        email: decodedToken.email,
        role: decodedToken.role,
        permissions: decodedToken.permissions,
        lastLogin: new Date().toISOString(),
        name: decodedToken.name || '',
        profileImage: null,
        isActive: true,
      };

      // Validate user object
      if (!isUser(user)) {
        throw new Error('Invalid user data');
      }

      // Securely store tokens and user data
      localStorage.setItem(TOKEN_STORAGE_KEY, authResult.accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, authResult.refreshToken);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));

      // Reset security context and update state
      setSecurityContext({
        lastActivity: new Date(),
        loginAttempts: 0,
        lockoutUntil: null,
        sessionStart: new Date(),
        tokenRefreshTime: new Date(),
      });

      dispatch({ type: 'AUTH_LOGIN_SUCCESS', payload: { user } });
      navigate('/dashboard');

    } catch (error) {
      dispatch({ 
        type: 'AUTH_LOGIN_FAILURE', 
        payload: { error: error instanceof Error ? error.message : 'Login failed' } 
      });
    }
  }, [auth0Client, dispatch, navigate, securityContext]);

  /**
   * Securely handles user logout with session cleanup
   */
  const handleSecureLogout = useCallback(async () => {
    try {
      // Revoke refresh token
      await auth0Client.logout();

      // Clear secure storage
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY);

      // Reset security context
      setSecurityContext({
        lastActivity: new Date(),
        loginAttempts: 0,
        lockoutUntil: null,
        sessionStart: new Date(),
        tokenRefreshTime: null,
      });

      dispatch({ type: 'AUTH_LOGOUT' });
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [auth0Client, dispatch, navigate]);

  /**
   * Validates current session security and integrity
   */
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!token) return false;

      // Check session duration
      const sessionDuration = Date.now() - securityContext.sessionStart.getTime();
      if (sessionDuration > MAX_SESSION_DURATION) {
        await handleSecureLogout();
        return false;
      }

      // Validate token
      const isValid = await auth0Client.isAuthenticated();
      if (!isValid) {
        await handleSecureLogout();
        return false;
      }

      return true;
    } catch (error) {
      await handleSecureLogout();
      return false;
    }
  }, [auth0Client, handleSecureLogout, securityContext.sessionStart]);

  /**
   * Checks if user has required role
   */
  const checkRole = useCallback((requiredRole: UserRole): boolean => {
    if (!authState.user) return false;
    const roles = Object.values(UserRole);
    const userRoleIndex = roles.indexOf(authState.user.role);
    const requiredRoleIndex = roles.indexOf(requiredRole);
    return userRoleIndex <= requiredRoleIndex;
  }, [authState.user]);

  /**
   * Checks if user has required permission
   */
  const checkPermission = useCallback((requiredPermission: Permission): boolean => {
    return authState.user?.permissions.includes(requiredPermission) ?? false;
  }, [authState.user]);

  // Set up security monitoring and token refresh
  useEffect(() => {
    validateSecurityHeaders();

    const sessionValidator = setInterval(async () => {
      const isValid = await validateSession();
      if (!isValid) {
        clearInterval(sessionValidator);
      }
    }, TOKEN_VALIDATION_INTERVAL);

    const tokenRefresher = setInterval(async () => {
      if (authState.isAuthenticated) {
        try {
          const token = await auth0Client.getTokenSilently();
          localStorage.setItem(TOKEN_STORAGE_KEY, token);
          setSecurityContext(prev => ({
            ...prev,
            tokenRefreshTime: new Date(),
          }));
        } catch (error) {
          console.error('Token refresh error:', error);
        }
      }
    }, SESSION_REFRESH_INTERVAL);

    return () => {
      clearInterval(sessionValidator);
      clearInterval(tokenRefresher);
    };
  }, [auth0Client, authState.isAuthenticated, validateSession, validateSecurityHeaders]);

  return {
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    loading: authState.loading,
    error: authState.error,
    secureLogin: handleSecureLogin,
    secureLogout: handleSecureLogout,
    validateSession,
    checkRole,
    checkPermission,
    securityContext,
  };
}