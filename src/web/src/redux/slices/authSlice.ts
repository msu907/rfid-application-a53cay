/**
 * Authentication Redux Slice
 * Manages authentication state, session handling, and role-based access control
 * for the RFID Asset Tracking System
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5
import { User, AuthResponse, Permission } from '../../types/auth.types';
import { login, refreshToken } from '../../api/auth.api';
import { ApiError } from '../../types/api.types';

// Constants for session management
const AUTH_STORAGE_KEY = 'rfid_auth_user';
const SESSION_TIMEOUT = 3600000; // 1 hour in milliseconds
const TOKEN_REFRESH_THRESHOLD = 300000; // 5 minutes in milliseconds

// Interface for login credentials
interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

// Interface for authentication state
interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  permissions: Permission[];
  lastActivity: number | null;
  sessionTimeout: number;
  isLoading: boolean;
  error: string | null;
}

// Initial state with secure defaults
const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  permissions: [],
  lastActivity: null,
  sessionTimeout: SESSION_TIMEOUT,
  isLoading: false,
  error: null
};

/**
 * Async thunk for user authentication
 * Handles login flow with enhanced security measures
 */
export const loginAsync = createAsyncThunk<AuthResponse, LoginCredentials>(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await login(credentials);
      
      // Store auth data securely
      if (credentials.rememberMe) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
          user: response.data.user,
          timestamp: Date.now()
        }));
      }

      return response;
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue(apiError.message);
    }
  }
);

/**
 * Async thunk for token refresh
 * Implements secure token rotation strategy
 */
export const refreshTokenAsync = createAsyncThunk<AuthResponse>(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { auth: AuthState };
      if (!state.auth.refreshToken) {
        throw new Error('No refresh token available');
      }
      
      return await refreshToken(state.auth.refreshToken);
    } catch (error) {
      const apiError = error as ApiError;
      return rejectWithValue(apiError.message);
    }
  }
);

/**
 * Auth slice with comprehensive state management
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.permissions = action.payload.permissions;
      state.lastActivity = Date.now();
    },
    setToken: (state, action: PayloadAction<{ token: string; refreshToken: string }>) => {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
    },
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },
    updatePermissions: (state, action: PayloadAction<Permission[]>) => {
      state.permissions = action.payload;
    },
    clearAuth: (state) => {
      // Secure cleanup of auth state
      Object.assign(state, initialState);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.data.user;
        state.token = action.payload.data.accessToken;
        state.refreshToken = action.payload.data.refreshToken;
        state.permissions = action.payload.data.user.permissions;
        state.lastActivity = Date.now();
        state.error = null;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(refreshTokenAsync.fulfilled, (state, action) => {
        state.token = action.payload.data.accessToken;
        state.refreshToken = action.payload.data.refreshToken;
        state.lastActivity = Date.now();
      })
      .addCase(refreshTokenAsync.rejected, (state) => {
        // Handle token refresh failure
        authSlice.caseReducers.clearAuth(state);
      });
  }
});

// Selectors with memoization for optimal performance
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectToken = (state: { auth: AuthState }) => state.auth.token;
export const selectPermissions = (state: { auth: AuthState }) => state.auth.permissions;

export const selectIsAuthenticated = createSelector(
  [selectUser, selectToken],
  (user, token) => !!(user && token)
);

export const selectIsSessionValid = createSelector(
  [(state: { auth: AuthState }) => state.auth.lastActivity, 
   (state: { auth: AuthState }) => state.auth.sessionTimeout],
  (lastActivity, timeout) => {
    if (!lastActivity) return false;
    return (Date.now() - lastActivity) < timeout;
  }
);

export const selectHasPermission = createSelector(
  [selectPermissions, (_: { auth: AuthState }, permission: Permission) => permission],
  (permissions, permission) => permissions.includes(permission)
);

// Export actions and reducer
export const { 
  setUser, 
  setToken, 
  updateLastActivity, 
  updatePermissions, 
  clearAuth, 
  setError 
} = authSlice.actions;

export default authSlice.reducer;