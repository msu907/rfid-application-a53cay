import { describe, expect, test, beforeEach, jest } from '@jest/globals'; // version 29.5.0
import { configureStore } from '@reduxjs/toolkit'; // version 1.9.5
import {
  reducer as assetReducer,
  addAsset,
  updateAsset,
  removeAsset,
  setAssetLoading,
  setAssetError,
  selectAsset,
  deselectAsset,
  clearSelection,
  handleRealTimeUpdate,
  invalidateAssetCache,
  selectAssetById,
  selectAssetLoadingState,
  selectAssetError,
  selectSelectedAssets,
  selectActiveAssets
} from '../../../redux/slices/assetSlice';

import { Asset, AssetStatus } from '../../../types/asset.types';
import { ApiError } from '../../../types/api.types';

// Mock data setup
const mockAsset: Asset = {
  id: 'test-asset-1',
  rfidTag: 'RF001',
  name: 'Test Asset',
  description: 'Test asset description',
  imageUrl: null,
  status: AssetStatus.ACTIVE,
  locationId: 'location-1',
  location: {
    id: 'location-1',
    name: 'Test Location',
    type: 'ZONE',
    zone: 'A',
    coordinates: { latitude: 0, longitude: 0 },
    annotation: '',
    active: true,
    capacity: 100,
    parentId: null
  },
  lastReadTime: new Date('2023-10-01T00:00:00Z'),
  createdAt: new Date('2023-10-01T00:00:00Z'),
  updatedAt: new Date('2023-10-01T00:00:00Z')
};

const mockApiError: ApiError = {
  code: 'NOT_FOUND',
  message: 'Asset not found',
  details: { assetId: 'test-asset-1' },
  timestamp: '2023-10-01T00:00:00Z'
};

describe('assetSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        assets: assetReducer
      }
    });
  });

  describe('reducer', () => {
    test('should return initial state', () => {
      const state = store.getState().assets;
      expect(state.assets).toEqual({});
      expect(state.loadingStates).toEqual({});
      expect(state.errors).toEqual({});
      expect(state.selectedAssets.size).toBe(0);
      expect(state.lastSync).toBeNull();
    });

    test('should handle addAsset', () => {
      store.dispatch(addAsset(mockAsset));
      const state = store.getState().assets;
      
      expect(state.assets[mockAsset.id]).toEqual(mockAsset);
      expect(state.loadingStates[mockAsset.id]).toEqual({ isLoading: false });
      expect(state.errors[mockAsset.id]).toBeUndefined();
    });

    test('should handle updateAsset', () => {
      store.dispatch(addAsset(mockAsset));
      const update = { id: mockAsset.id, name: 'Updated Asset' };
      store.dispatch(updateAsset(update));
      
      const state = store.getState().assets;
      expect(state.assets[mockAsset.id].name).toBe('Updated Asset');
      expect(state.cacheTimestamps[mockAsset.id]).toBeDefined();
    });

    test('should handle removeAsset', () => {
      store.dispatch(addAsset(mockAsset));
      store.dispatch(removeAsset(mockAsset.id));
      
      const state = store.getState().assets;
      expect(state.assets[mockAsset.id]).toBeUndefined();
      expect(state.loadingStates[mockAsset.id]).toBeUndefined();
      expect(state.errors[mockAsset.id]).toBeUndefined();
      expect(state.selectedAssets.has(mockAsset.id)).toBeFalsy();
    });

    test('should handle setAssetLoading', () => {
      store.dispatch(setAssetLoading({ id: mockAsset.id, isLoading: true }));
      
      const state = store.getState().assets;
      expect(state.loadingStates[mockAsset.id].isLoading).toBeTruthy();
    });

    test('should handle setAssetError', () => {
      store.dispatch(setAssetError({ id: mockAsset.id, error: mockApiError }));
      
      const state = store.getState().assets;
      expect(state.errors[mockAsset.id]).toEqual(mockApiError);
      expect(state.loadingStates[mockAsset.id].isLoading).toBeFalsy();
    });

    test('should handle selection actions', () => {
      store.dispatch(selectAsset(mockAsset.id));
      let state = store.getState().assets;
      expect(state.selectedAssets.has(mockAsset.id)).toBeTruthy();

      store.dispatch(deselectAsset(mockAsset.id));
      state = store.getState().assets;
      expect(state.selectedAssets.has(mockAsset.id)).toBeFalsy();

      store.dispatch(selectAsset(mockAsset.id));
      store.dispatch(clearSelection());
      state = store.getState().assets;
      expect(state.selectedAssets.size).toBe(0);
    });

    test('should handle real-time updates', () => {
      store.dispatch(addAsset(mockAsset));
      const updatedAsset = {
        ...mockAsset,
        name: 'Real-time Update',
        lastModified: new Date('2023-10-01T00:01:00Z')
      };
      
      store.dispatch(handleRealTimeUpdate(updatedAsset));
      const state = store.getState().assets;
      expect(state.assets[mockAsset.id].name).toBe('Real-time Update');
    });

    test('should handle cache invalidation', () => {
      store.dispatch(addAsset(mockAsset));
      store.dispatch(invalidateAssetCache({ id: mockAsset.id, force: true }));
      
      const state = store.getState().assets;
      expect(state.cacheTimestamps[mockAsset.id]).toBeUndefined();
      expect(state.loadingStates[mockAsset.id].isLoading).toBeTruthy();
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      store.dispatch(addAsset(mockAsset));
    });

    test('selectAssetById should return correct asset', () => {
      const asset = selectAssetById(store.getState(), mockAsset.id);
      expect(asset).toEqual(mockAsset);
    });

    test('selectAssetLoadingState should return loading state', () => {
      store.dispatch(setAssetLoading({ id: mockAsset.id, isLoading: true }));
      const isLoading = selectAssetLoadingState(store.getState(), mockAsset.id);
      expect(isLoading).toBeTruthy();
    });

    test('selectAssetError should return error state', () => {
      store.dispatch(setAssetError({ id: mockAsset.id, error: mockApiError }));
      const error = selectAssetError(store.getState(), mockAsset.id);
      expect(error).toEqual(mockApiError);
    });

    test('selectSelectedAssets should return selected assets', () => {
      store.dispatch(selectAsset(mockAsset.id));
      const selectedAssets = selectSelectedAssets(store.getState());
      expect(selectedAssets).toEqual([mockAsset]);
    });

    test('selectActiveAssets should return active assets', () => {
      const activeAssets = selectActiveAssets(store.getState());
      expect(activeAssets).toEqual([mockAsset]);
    });
  });

  describe('memoization', () => {
    test('selectors should maintain referential equality', () => {
      const result1 = selectActiveAssets(store.getState());
      const result2 = selectActiveAssets(store.getState());
      expect(result1).toBe(result2);
    });
  });

  describe('concurrent modifications', () => {
    test('should handle concurrent updates correctly', () => {
      store.dispatch(addAsset(mockAsset));
      
      // Simulate older update arriving after newer update
      const olderUpdate = {
        ...mockAsset,
        name: 'Older Update',
        lastModified: new Date('2023-10-01T00:00:00Z')
      };
      
      const newerUpdate = {
        ...mockAsset,
        name: 'Newer Update',
        lastModified: new Date('2023-10-01T00:01:00Z')
      };

      store.dispatch(handleRealTimeUpdate(newerUpdate));
      store.dispatch(handleRealTimeUpdate(olderUpdate));
      
      const state = store.getState().assets;
      expect(state.assets[mockAsset.id].name).toBe('Newer Update');
    });
  });
});