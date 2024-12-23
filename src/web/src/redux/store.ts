/**
 * Redux store configuration for the RFID Asset Tracking System
 * Implements secure state management with TypeScript type safety,
 * performance optimizations, and real-time update capabilities
 * @version 1.0.0
 */

import { 
  configureStore, 
  combineReducers,
  getDefaultMiddleware
} from '@reduxjs/toolkit'; // version 1.9.5
import { persistStore, persistReducer } from 'redux-persist'; // version 6.0.0
import storage from 'redux-persist/lib/storage'; // version 6.0.0
import { runtimeCheck } from 'redux-typescript-check'; // version 1.0.0

// Import reducers from feature slices
import assetReducer from './slices/assetSlice';
import authReducer from './slices/authSlice';
import locationReducer from './slices/locationSlice';
import readerReducer from './slices/readerSlice';
import uiReducer from './slices/uiSlice';

// Persistence configuration
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'ui'], // Only persist authentication and UI state
  blacklist: ['assets', 'readers'], // Don't persist real-time data
  version: 1,
  migrate: (state: any) => Promise.resolve(state),
  timeout: 2000, // 2 seconds timeout for storage operations
  serialize: true,
  debug: process.env.NODE_ENV === 'development'
};

// Combine all reducers
const rootReducer = combineReducers({
  assets: assetReducer,
  auth: authReducer,
  locations: locationReducer,
  readers: readerReducer,
  ui: uiReducer
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Custom error handling middleware
const errorHandlingMiddleware = () => (next: any) => (action: any) => {
  try {
    return next(action);
  } catch (error) {
    console.error('Redux error:', error);
    // Report error to monitoring service
    throw error;
  }
};

// Performance monitoring middleware
const performanceMiddleware = () => (next: any) => (action: any) => {
  const start = performance.now();
  const result = next(action);
  const end = performance.now();
  
  if (end - start > 16) { // Monitor actions taking longer than one frame (16ms)
    console.warn(`Slow action ${action.type}: ${end - start}ms`);
  }
  
  return result;
};

// Configure store with middleware and dev tools
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: {
      ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      ignoredPaths: ['ui.notifications.timestamp']
    },
    thunk: {
      extraArgument: undefined
    },
    immutableCheck: true
  }).concat([
    errorHandlingMiddleware,
    performanceMiddleware,
    runtimeCheck({ // Add runtime type checking in development
      enabled: process.env.NODE_ENV === 'development'
    })
  ]),
  devTools: process.env.NODE_ENV === 'development',
  preloadedState: undefined,
  enhancers: []
});

// Create persistor for Redux persist
export const persistor = persistStore(store, {
  manualPersist: false,
  transforms: [] // Add any state transforms here
});

// Export store types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Type-safe hooks for dispatching actions and selecting state
export const useAppDispatch = () => store.dispatch as AppDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Handle hot module replacement for reducers
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./slices', () => {
    const newRootReducer = require('./slices').default;
    store.replaceReducer(
      persistReducer(persistConfig, newRootReducer)
    );
  });
}

// Export type-safe dispatch and selector hooks
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
export { useAppDispatch as dispatch, useAppSelector as selector };

// Export default store instance
export default store;