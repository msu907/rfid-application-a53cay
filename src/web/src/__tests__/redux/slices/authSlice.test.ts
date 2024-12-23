/**
 * Authentication Redux Slice Tests
 * Comprehensive test suite for authentication state management, session handling,
 * and role-based access control functionality
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit'; // v1.9.5
import { describe, test, expect, beforeEach, jest } from '@jest/globals'; // v29.5.0
import {
  reducer as authReducer,
  actions,
  loginAsync,
  logoutAsync,
  refreshTokenAsync,
  selectUser,
  selectIsAuthenticated,
  selectUserPermissions
} from '../../../redux/slices/authSlice';
import { UserRole } from '../../../types/auth.types';

// Mock API responses
jest.mock('../../../api/auth.api', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn()
}));

// Mock token service
jest.mock('../../../services/token.service', () => ({
  storeTokens: jest.fn(),
  clearTokens: jest.fn()
}));

/**
 * Creates a configured test store instance
 * @param initialState Optional initial state override
 */
const setupTestStore = (initialState = {}) => {
  return configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { ...initialState } },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
      serializableCheck: false
    })
  });
};

/**
 * Creates mock login credentials for different test scenarios
 */
const createMockCredentials = (scenario = 'valid') => {
  const base = {
    email: 'test@example.com',
    password: 'Test123!@#',
    rememberMe: false
  };

  switch (scenario) {
    case 'invalid':
      return { ...base, password: 'wrong' };
    case 'remember':
      return { ...base, rememberMe: true };
    default:
      return base;
  }
};

/**
 * Creates mock authentication response with role-specific data
 */
const createMockAuthResponse = (role: UserRole) => ({
  data: {
    user: {
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
      role,
      permissions: ['READ_ASSETS'],
      lastLogin: new Date().toISOString(),
      profileImage: null,
      isActive: true
    },
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
    tokenType: 'Bearer'
  },
  status: 200,
  message: 'Authentication successful',
  timestamp: new Date().toISOString()
});

describe('Auth Slice Tests', () => {
  describe('Initial State', () => {
    test('should have correct initial state', () => {
      const store = setupTestStore();
      const state = store.getState().auth;

      expect(state).toEqual({
        user: null,
        token: null,
        refreshToken: null,
        permissions: [],
        lastActivity: null,
        sessionTimeout: 3600000,
        isLoading: false,
        error: null
      });
    });
  });

  describe('Authentication Flow', () => {
    test('should handle successful login', async () => {
      const store = setupTestStore();
      const mockResponse = createMockAuthResponse(UserRole.ADMIN);
      const mockCredentials = createMockCredentials();

      // Mock API response
      require('../../../api/auth.api').login.mockResolvedValueOnce(mockResponse);

      // Dispatch login action
      await store.dispatch(loginAsync(mockCredentials));
      const state = store.getState().auth;

      expect(state.user).toEqual(mockResponse.data.user);
      expect(state.token).toBe(mockResponse.data.accessToken);
      expect(state.refreshToken).toBe(mockResponse.data.refreshToken);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    test('should handle login failure', async () => {
      const store = setupTestStore();
      const mockCredentials = createMockCredentials('invalid');
      const mockError = {
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
        details: {},
        timestamp: new Date().toISOString()
      };

      require('../../../api/auth.api').login.mockRejectedValueOnce(mockError);

      await store.dispatch(loginAsync(mockCredentials));
      const state = store.getState().auth;

      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(mockError.message);
    });

    test('should handle logout', async () => {
      const store = setupTestStore({
        user: createMockAuthResponse(UserRole.ADMIN).data.user,
        token: 'existing-token',
        refreshToken: 'existing-refresh'
      });

      await store.dispatch(logoutAsync());
      const state = store.getState().auth;

      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.permissions).toEqual([]);
    });
  });

  describe('Session Management', () => {
    test('should handle token refresh', async () => {
      const store = setupTestStore({
        refreshToken: 'existing-refresh'
      });

      const mockResponse = createMockAuthResponse(UserRole.OPERATOR);
      require('../../../api/auth.api').refreshToken.mockResolvedValueOnce(mockResponse);

      await store.dispatch(refreshTokenAsync());
      const state = store.getState().auth;

      expect(state.token).toBe(mockResponse.data.accessToken);
      expect(state.refreshToken).toBe(mockResponse.data.refreshToken);
      expect(state.lastActivity).toBeDefined();
    });

    test('should handle token refresh failure', async () => {
      const store = setupTestStore({
        user: createMockAuthResponse(UserRole.VIEWER).data.user,
        token: 'old-token',
        refreshToken: 'old-refresh'
      });

      require('../../../api/auth.api').refreshToken.mockRejectedValueOnce(new Error('Refresh failed'));

      await store.dispatch(refreshTokenAsync());
      const state = store.getState().auth;

      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
    });

    test('should update last activity timestamp', () => {
      const store = setupTestStore();
      store.dispatch(actions.updateLastActivity());
      const state = store.getState().auth;

      expect(state.lastActivity).toBeDefined();
      expect(typeof state.lastActivity).toBe('number');
    });
  });

  describe('Role-Based Access Control', () => {
    test('should handle permission updates', () => {
      const store = setupTestStore();
      const newPermissions = ['READ_ASSETS', 'WRITE_ASSETS'];

      store.dispatch(actions.updatePermissions(newPermissions));
      const state = store.getState().auth;

      expect(state.permissions).toEqual(newPermissions);
    });

    test('should select user permissions correctly', () => {
      const mockUser = createMockAuthResponse(UserRole.ASSET_MANAGER).data.user;
      const store = setupTestStore({ user: mockUser });

      const permissions = selectUserPermissions(store.getState());
      expect(permissions).toEqual(mockUser.permissions);
    });

    test('should determine authentication status correctly', () => {
      const store = setupTestStore({
        user: createMockAuthResponse(UserRole.ADMIN).data.user,
        token: 'valid-token'
      });

      const isAuthenticated = selectIsAuthenticated(store.getState());
      expect(isAuthenticated).toBe(true);
    });
  });

  describe('Selectors', () => {
    test('should select current user', () => {
      const mockUser = createMockAuthResponse(UserRole.OPERATOR).data.user;
      const store = setupTestStore({ user: mockUser });

      const user = selectUser(store.getState());
      expect(user).toEqual(mockUser);
    });

    test('should handle null user selection', () => {
      const store = setupTestStore();
      const user = selectUser(store.getState());
      expect(user).toBeNull();
    });
  });
});