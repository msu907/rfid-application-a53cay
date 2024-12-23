/**
 * Redux slice for managing asset state in the RFID Asset Tracking System.
 * Handles CRUD operations, real-time updates, and granular loading states.
 * @version 1.0.0
 */

import { 
  createSlice, 
  createEntityAdapter,
  createSelector,
  PayloadAction 
} from '@reduxjs/toolkit'; // version 1.9.5

import { 
  Asset,
  AssetState,
  AssetStatus
} from '../../types/asset.types';

import { ApiError } from '../../types/api.types';

// Constants for cache and update management
const CACHE_INVALIDATION_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const OPTIMISTIC_UPDATE_TIMEOUT = 2000; // 2 seconds

// Create entity adapter for normalized state management
const assetAdapter = createEntityAdapter<Asset>({
  selectId: (asset) => asset.id,
  sortComparer: (a, b) => a.lastReadTime?.getTime() ?? 0 - (b.lastReadTime?.getTime() ?? 0)
});

// Define initial state with enhanced type safety
const initialState: AssetState = {
  assets: {},
  loadingStates: {},
  errors: {},
  selectedAssets: new Set<string>(),
  lastSync: null,
  cacheTimestamps: {},
  pendingUpdates: {}
};

/**
 * Asset management slice with comprehensive state handling
 */
const assetSlice = createSlice({
  name: 'assets',
  initialState,
  reducers: {
    // Asset CRUD operations
    addAsset: (state, action: PayloadAction<Asset>) => {
      const asset = action.payload;
      state.assets[asset.id] = asset;
      state.loadingStates[asset.id] = { isLoading: false };
      delete state.errors[asset.id];
    },

    updateAsset: (state, action: PayloadAction<Partial<Asset> & { id: string }>) => {
      const { id, ...changes } = action.payload;
      if (state.assets[id]) {
        state.assets[id] = { ...state.assets[id], ...changes };
        state.cacheTimestamps[id] = Date.now();
      }
    },

    removeAsset: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      delete state.assets[id];
      delete state.loadingStates[id];
      delete state.errors[id];
      state.selectedAssets.delete(id);
    },

    // Loading state management
    setAssetLoading: (state, action: PayloadAction<{ id: string; isLoading: boolean }>) => {
      const { id, isLoading } = action.payload;
      state.loadingStates[id] = { ...state.loadingStates[id], isLoading };
    },

    // Error handling
    setAssetError: (state, action: PayloadAction<{ id: string; error: ApiError }>) => {
      const { id, error } = action.payload;
      state.errors[id] = error;
      state.loadingStates[id] = { isLoading: false };
    },

    // Selection management
    selectAsset: (state, action: PayloadAction<string>) => {
      state.selectedAssets.add(action.payload);
    },

    deselectAsset: (state, action: PayloadAction<string>) => {
      state.selectedAssets.delete(action.payload);
    },

    clearSelection: (state) => {
      state.selectedAssets.clear();
    },

    // Real-time update handling
    handleRealTimeUpdate: (state, action: PayloadAction<Asset>) => {
      const asset = action.payload;
      const existingAsset = state.assets[asset.id];
      
      // Handle concurrent modifications
      if (existingAsset && existingAsset.lastModified > asset.lastModified) {
        // Keep local version if it's newer
        return;
      }

      // Apply optimistic update
      state.assets[asset.id] = {
        ...existingAsset,
        ...asset,
        lastModified: new Date()
      };

      // Update cache timestamp
      state.cacheTimestamps[asset.id] = Date.now();
    },

    // Cache invalidation
    invalidateAssetCache: (state, action: PayloadAction<{ id: string; force?: boolean }>) => {
      const { id, force } = action.payload;
      const timestamp = state.cacheTimestamps[id];
      
      if (force || !timestamp || Date.now() - timestamp > CACHE_INVALIDATION_THRESHOLD) {
        delete state.cacheTimestamps[id];
        state.loadingStates[id] = { isLoading: true };
      }
    }
  }
});

// Export actions
export const {
  addAsset,
  updateAsset,
  removeAsset,
  setAssetLoading,
  setAssetError,
  selectAsset,
  deselectAsset,
  clearSelection,
  handleRealTimeUpdate,
  invalidateAssetCache
} = assetSlice.actions;

// Memoized selectors
export const selectAssetById = createSelector(
  [(state: { assets: AssetState }) => state.assets.assets, 
   (_: { assets: AssetState }, id: string) => id],
  (assets, id) => assets[id]
);

export const selectAssetLoadingState = createSelector(
  [(state: { assets: AssetState }) => state.assets.loadingStates,
   (_: { assets: AssetState }, id: string) => id],
  (loadingStates, id) => loadingStates[id]?.isLoading ?? false
);

export const selectAssetError = createSelector(
  [(state: { assets: AssetState }) => state.assets.errors,
   (_: { assets: AssetState }, id: string) => id],
  (errors, id) => errors[id]
);

export const selectSelectedAssets = createSelector(
  [(state: { assets: AssetState }) => state.assets.assets,
   (state: { assets: AssetState }) => state.assets.selectedAssets],
  (assets, selectedIds) => 
    Array.from(selectedIds).map(id => assets[id]).filter(Boolean)
);

export const selectActiveAssets = createSelector(
  [(state: { assets: AssetState }) => state.assets.assets],
  (assets) => Object.values(assets).filter(asset => asset.status === AssetStatus.ACTIVE)
);

// Export reducer
export default assetSlice.reducer;