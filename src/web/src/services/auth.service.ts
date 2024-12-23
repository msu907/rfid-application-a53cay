/**
 * @fileoverview Authentication service implementing secure JWT-based authentication with Auth0,
 * token management, and real-time user state for the RFID Asset Tracking System.
 * @version 1.0.0
 * @requires @auth0/auth0-spa-js@2.1.0
 * @requires jwt-decode@3.1.2
 * @requires rxjs@7.0.0
 */

import { Auth0Client, createAuth0Client } from '@auth0/auth0-spa-js'; // v2.1.0
import { jwtDecode } from 'jwt-decode'; // v3.1.2
import { BehaviorSubject } from 'rxjs'; // v7.0.0

import { 
  LoginCredentials, 
  AuthResponse, 
  User, 
  JWTPayload, 
  isUser, 
  isJWTPayload,
  AUTH_STORAGE_KEY 
} from '../types/auth.types';
import { StorageService } from './storage.service';
import { API_ERROR_CODES } from '../types/api.types';

// Authentication configuration constants
const AUTH0_CONFIG = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN!,
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID!,
  audience: process.env.REACT_APP_AUTH0_AUDIENCE!,
  scope: 'openid profile email offline_access',
  cacheLocation: 'localstorage',
  useRefreshTokens: true
};

// Security constants
const TOKEN_EXPIRY_BUFFER = 300; // 5 minutes buffer for token refresh
const MAX_LOGIN_ATTEMPTS = 3;
const LOGIN_ATTEMPT_TIMEOUT = 300000; // 5 minutes
const LOGIN_ATTEMPTS_KEY = 'login_attempts';

/**
 * Service class providing secure authentication and authorization functionality
 */
export class AuthService {
  private auth0Client: Auth0Client;
  private storageService: StorageService;
  private currentUser$ = new BehaviorSubject<User | null>(null);
  private refreshTokenTimeout?: NodeJS.Timeout;
  private loginAttempts: Map<string, number> = new Map();

  constructor() {
    this.storageService = new StorageService();
    this.initializeAuth0Client();
    this.checkExistingSession();
  }

  /**
   * Initialize Auth0 client with secure configuration
   * @private
   */
  private async initializeAuth0Client(): Promise<void> {
    try {
      this.auth0Client = await createAuth0Client({
        ...AUTH0_CONFIG,
        authorizationParams: {
          audience: AUTH0_CONFIG.audience,
          scope: AUTH0_CONFIG.scope
        }
      });
    } catch (error) {
      console.error('Auth0 initialization failed:', error);
      throw new Error('Authentication service initialization failed');
    }
  }

  /**
   * Authenticate user with provided credentials
   * @param credentials - User login credentials
   * @throws {Error} When authentication fails or rate limit exceeded
   */
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Check rate limiting
      if (this.isRateLimited(credentials.email)) {
        throw new Error(API_ERROR_CODES.RATE_LIMIT_EXCEEDED);
      }

      // Perform Auth0 authentication
      const { email, password } = credentials;
      await this.auth0Client.loginWithRedirect({
        authorizationParams: {
          login_hint: email
        }
      });

      // Handle authentication response
      const authResult = await this.auth0Client.handleRedirectCallback();
      const user = await this.processAuthResult(authResult);

      // Store authentication state
      const authResponse: AuthResponse = {
        data: {
          user,
          accessToken: authResult.access_token,
          refreshToken: authResult.refresh_token!,
          expiresIn: authResult.expires_in,
          tokenType: 'Bearer'
        },
        status: 200,
        message: 'Authentication successful',
        timestamp: new Date().toISOString()
      };

      // Set up token refresh and store session
      this.setupTokenRefresh(authResult.expires_in);
      this.storeAuthSession(authResponse, credentials.rememberMe);
      this.currentUser$.next(user);

      return authResponse;
    } catch (error) {
      this.handleLoginFailure(credentials.email);
      throw error;
    }
  }

  /**
   * Process authentication result and extract user information
   * @private
   */
  private async processAuthResult(authResult: any): Promise<User> {
    const decodedToken = jwtDecode<JWTPayload>(authResult.access_token);
    if (!isJWTPayload(decodedToken)) {
      throw new Error('Invalid token payload');
    }

    const userInfo = await this.auth0Client.getUser();
    const user: User = {
      id: decodedToken.sub,
      email: decodedToken.email,
      name: userInfo?.name || '',
      role: decodedToken.role,
      permissions: decodedToken.permissions,
      lastLogin: new Date().toISOString(),
      profileImage: userInfo?.picture || null,
      isActive: true
    };

    if (!isUser(user)) {
      throw new Error('Invalid user data');
    }

    return user;
  }

  /**
   * Set up automatic token refresh
   * @private
   */
  private setupTokenRefresh(expiresIn: number): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    const refreshTime = (expiresIn - TOKEN_EXPIRY_BUFFER) * 1000;
    this.refreshTokenTimeout = setTimeout(() => this.refreshToken(), refreshTime);
  }

  /**
   * Refresh authentication token
   */
  public async refreshToken(): Promise<void> {
    try {
      const authResult = await this.auth0Client.getTokenSilently();
      const user = await this.processAuthResult(authResult);

      const authResponse: AuthResponse = {
        data: {
          user,
          accessToken: authResult.access_token,
          refreshToken: authResult.refresh_token!,
          expiresIn: authResult.expires_in,
          tokenType: 'Bearer'
        },
        status: 200,
        message: 'Token refreshed successfully',
        timestamp: new Date().toISOString()
      };

      this.setupTokenRefresh(authResult.expires_in);
      this.storeAuthSession(authResponse, true);
      this.currentUser$.next(user);
    } catch (error) {
      console.error('Token refresh failed:', error);
      await this.logout();
    }
  }

  /**
   * Store authentication session securely
   * @private
   */
  private storeAuthSession(authResponse: AuthResponse, rememberMe: boolean): void {
    const storage = rememberMe ? 'localStorage' : 'sessionStorage';
    this.storageService.setItem(AUTH_STORAGE_KEY, authResponse, storage);
  }

  /**
   * Check for existing authentication session
   * @private
   */
  private async checkExistingSession(): Promise<void> {
    try {
      const isAuthenticated = await this.auth0Client.isAuthenticated();
      if (isAuthenticated) {
        const authResult = await this.auth0Client.getTokenSilently();
        const user = await this.processAuthResult(authResult);
        this.currentUser$.next(user);
        this.setupTokenRefresh(authResult.expires_in);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      this.currentUser$.next(null);
    }
  }

  /**
   * Log out user and clear authentication state
   */
  public async logout(): Promise<void> {
    try {
      if (this.refreshTokenTimeout) {
        clearTimeout(this.refreshTokenTimeout);
      }

      await this.auth0Client.logout({
        logoutParams: {
          returnTo: window.location.origin
        }
      });

      this.storageService.removeItem(AUTH_STORAGE_KEY);
      this.currentUser$.next(null);
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Get current authenticated user as observable
   */
  public getCurrentUser() {
    return this.currentUser$.asObservable();
  }

  /**
   * Check if user is rate limited
   * @private
   */
  private isRateLimited(email: string): boolean {
    const attempts = this.loginAttempts.get(email) || 0;
    return attempts >= MAX_LOGIN_ATTEMPTS;
  }

  /**
   * Handle failed login attempt
   * @private
   */
  private handleLoginFailure(email: string): void {
    const attempts = (this.loginAttempts.get(email) || 0) + 1;
    this.loginAttempts.set(email, attempts);

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      setTimeout(() => this.loginAttempts.delete(email), LOGIN_ATTEMPT_TIMEOUT);
    }
  }
}

// Export singleton instance
export const authService = new AuthService();