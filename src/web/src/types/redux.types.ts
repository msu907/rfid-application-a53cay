/**
 * Redux type definitions for the RFID Asset Tracking System
 * Provides comprehensive type safety for state management, actions, and thunks
 * @version 1.0.0
 */

import { ThunkAction, Action, PayloadAction } from '@reduxjs/toolkit'; // version 1.9.5
import { Asset } from './asset.types';
import { Location } from './location.types';
import { Reader } from './reader.types';

/**
 * Interface for authentication state management
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    username: string;
    role: string;
  } | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Interface for asset state management
 */
export interface AssetState {
  items: Record<string, Asset>;
  selectedAssetId: string | null;
  loading: boolean;
  error: string | null;
  lastUpdate: Date | null;
  filters: {
    status: string[];
    location: string[];
    searchQuery: string;
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
  };
}

/**
 * Interface for location state management
 */
export interface LocationState {
  items: Record<string, Location>;
  hierarchy: Record<string, string[]>;
  selectedLocationId: string | null;
  loading: boolean;
  error: string | null;
  capacityAlerts: Record<string, boolean>;
}

/**
 * Interface for RFID reader state management
 */
export interface ReaderState {
  items: Record<string, Reader>;
  status: Record<string, boolean>;
  statistics: Record<string, {
    readCount: number;
    errorRate: number;
    signalStrength: number;
  }>;
  loading: boolean;
  error: string | null;
}

/**
 * Interface for UI state management
 */
export interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  activeModal: string | null;
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: Date;
  }>;
  loadingOperations: Record<string, boolean>;
}

/**
 * Interface for real-time updates state management
 */
export interface RealtimeState {
  connected: boolean;
  lastHeartbeat: Date | null;
  pendingUpdates: Array<{
    type: 'ASSET_MOVED' | 'READER_STATUS' | 'CAPACITY_ALERT';
    payload: unknown;
    timestamp: Date;
  }>;
  subscriptions: Set<string>;
}

/**
 * Comprehensive root state interface combining all feature states
 */
export interface RootState {
  assets: AssetState;
  auth: AuthState;
  locations: LocationState;
  readers: ReaderState;
  ui: UIState;
  realtime: RealtimeState;
}

/**
 * Type definition for standardized error responses
 */
export interface ErrorResponse {
  message: string;
  code: string;
  details?: Record<string, unknown>;
}

/**
 * Configuration type for async thunk actions with error handling
 */
export interface AsyncThunkConfig {
  state: RootState;
  dispatch: AppDispatch;
  rejectValue: ErrorResponse;
  extra: undefined;
}

/**
 * Type-safe dispatch function definition
 */
export type AppDispatch = typeof import('../redux/store').store.dispatch;

/**
 * Enhanced type definition for async thunk actions with error handling
 */
export type AppThunk<ReturnType = void> = ThunkAction<
  Promise<ReturnType>,
  RootState,
  undefined,
  Action<string>
>;

/**
 * Type guard to check if an error is an ErrorResponse
 */
export function isErrorResponse(error: unknown): error is ErrorResponse {
  if (!error || typeof error !== 'object') {
    return false;
  }
  
  const err = error as Partial<ErrorResponse>;
  return (
    typeof err.message === 'string' &&
    typeof err.code === 'string' &&
    (err.details === undefined || typeof err.details === 'object')
  );
}