/**
 * Custom React hook for managing asset-related operations and state management.
 * Provides a unified interface for asset CRUD operations, real-time updates,
 * and state synchronization with optimistic updates and caching.
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useMemo } from 'react'; // ^18.2.0
import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import debounce from 'lodash/debounce'; // ^4.17.21

import { Asset, AssetStatus } from '../types/asset.types';
import assetApi from '../api/asset.api';
import { 
  selectAssets, 
  selectAssetLoadingState, 
  selectAssetError 
} from '../redux/slices/assetSlice';
import useWebSocket from '../hooks/useWebSocket';

// Constants for configuration
const DEFAULT_PAGE_SIZE = 10;
const DEBOUNCE_DELAY = 300;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;
const WEBSOCKET_RECONNECT_DELAY = 1000;

/**
 * Interface for hook options
 */
interface UseAssetOptions {
  pageSize?: number;
  enableRealTimeUpdates?: boolean;
  cacheTimeout?: number;
  retryAttempts?: number;
  filters?: Record<string, unknown>;
}

/**
 * Interface for loading states
 */
interface LoadingStates {
  fetchAll: boolean;
  fetchOne: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  upload: boolean;
}

/**
 * Interface for error states
 */
interface ErrorStates {
  fetchAll: string | null;
  fetchOne: string | null;
  create: string | null;
  update: string | null;
  delete: string | null;
  upload: string | null;
}

/**
 * Custom hook for managing asset operations and state
 */
export function useAsset(options: UseAssetOptions = {}) {
  const dispatch = useDispatch();
  
  // Initialize state
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    fetchAll: false,
    fetchOne: false,
    create: false,
    update: false,
    delete: false,
    upload: false
  });

  const [errorStates, setErrorStates] = useState<ErrorStates>({
    fetchAll: null,
    fetchOne: null,
    create: null,
    update: null,
    delete: null,
    upload: null
  });

  // Get assets from Redux store
  const assets = useSelector(selectAssets);
  const globalLoadingState = useSelector(selectAssetLoadingState);
  const globalError = useSelector(selectAssetError);

  // Initialize WebSocket connection for real-time updates
  const { 
    isConnected: wsConnected,
    subscribe: wsSubscribe,
    unsubscribe: wsUnsubscribe,
    data: wsData
  } = useWebSocket('assets', {
    autoConnect: options.enableRealTimeUpdates !== false,
    reconnectAttempts: options.retryAttempts || MAX_RETRY_ATTEMPTS
  });

  /**
   * Handles real-time asset updates with debouncing
   */
  const handleRealTimeUpdate = useCallback(
    debounce((updatedAsset: Asset) => {
      dispatch({ type: 'assets/updateAsset', payload: updatedAsset });
    }, DEBOUNCE_DELAY),
    [dispatch]
  );

  /**
   * Fetches all assets with pagination and filtering
   */
  const fetchAssets = useCallback(async (page = 1) => {
    try {
      setLoadingStates(prev => ({ ...prev, fetchAll: true }));
      setErrorStates(prev => ({ ...prev, fetchAll: null }));

      const response = await assetApi.getAssets({
        page,
        pageSize: options.pageSize || DEFAULT_PAGE_SIZE,
        filters: options.filters || {}
      });

      dispatch({ type: 'assets/setAssets', payload: response.data });
      return response.data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch assets';
      setErrorStates(prev => ({ ...prev, fetchAll: errorMessage }));
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, fetchAll: false }));
    }
  }, [dispatch, options.pageSize, options.filters]);

  /**
   * Fetches a single asset by ID
   */
  const getAssetById = useCallback(async (id: string) => {
    try {
      setLoadingStates(prev => ({ ...prev, fetchOne: true }));
      setErrorStates(prev => ({ ...prev, fetchOne: null }));

      const response = await assetApi.getAssetById(id);
      dispatch({ type: 'assets/addAsset', payload: response.data });
      return response.data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch asset';
      setErrorStates(prev => ({ ...prev, fetchOne: errorMessage }));
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, fetchOne: false }));
    }
  }, [dispatch]);

  /**
   * Creates a new asset with optimistic update
   */
  const createAsset = useCallback(async (assetData: Partial<Asset>) => {
    try {
      setLoadingStates(prev => ({ ...prev, create: true }));
      setErrorStates(prev => ({ ...prev, create: null }));

      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const optimisticAsset = {
        ...assetData,
        id: tempId,
        status: AssetStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Asset;

      dispatch({ type: 'assets/addAsset', payload: optimisticAsset });

      const response = await assetApi.createAsset(assetData);
      dispatch({ type: 'assets/updateAsset', payload: response.data });
      return response.data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create asset';
      setErrorStates(prev => ({ ...prev, create: errorMessage }));
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, create: false }));
    }
  }, [dispatch]);

  /**
   * Updates an existing asset with optimistic update
   */
  const updateAsset = useCallback(async (id: string, updates: Partial<Asset>) => {
    try {
      setLoadingStates(prev => ({ ...prev, update: true }));
      setErrorStates(prev => ({ ...prev, update: null }));

      const currentAsset = assets[id];
      if (!currentAsset) throw new Error('Asset not found');

      // Optimistic update
      const optimisticAsset = {
        ...currentAsset,
        ...updates,
        updatedAt: new Date()
      };

      dispatch({ type: 'assets/updateAsset', payload: optimisticAsset });

      const response = await assetApi.updateAsset({ id, ...updates });
      dispatch({ type: 'assets/updateAsset', payload: response.data });
      return response.data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update asset';
      setErrorStates(prev => ({ ...prev, update: errorMessage }));
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, update: false }));
    }
  }, [dispatch, assets]);

  /**
   * Deletes an asset with optimistic update
   */
  const deleteAsset = useCallback(async (id: string) => {
    try {
      setLoadingStates(prev => ({ ...prev, delete: true }));
      setErrorStates(prev => ({ ...prev, delete: null }));

      // Optimistic update
      dispatch({ type: 'assets/removeAsset', payload: id });

      await assetApi.deleteAsset(id);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete asset';
      setErrorStates(prev => ({ ...prev, delete: errorMessage }));
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, delete: false }));
    }
  }, [dispatch]);

  /**
   * Uploads an asset image
   */
  const uploadAssetImage = useCallback(async (id: string, file: File) => {
    try {
      setLoadingStates(prev => ({ ...prev, upload: true }));
      setErrorStates(prev => ({ ...prev, upload: null }));

      const response = await assetApi.uploadAssetImage(id, file);
      dispatch({ 
        type: 'assets/updateAsset', 
        payload: { id, imageUrl: response.data.imageUrl } 
      });
      return response.data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload image';
      setErrorStates(prev => ({ ...prev, upload: errorMessage }));
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, upload: false }));
    }
  }, [dispatch]);

  // Handle WebSocket updates
  useEffect(() => {
    if (wsData) {
      handleRealTimeUpdate(wsData as Asset);
    }
  }, [wsData, handleRealTimeUpdate]);

  // Cleanup WebSocket subscription
  useEffect(() => {
    return () => {
      if (wsConnected) {
        wsUnsubscribe();
      }
    };
  }, [wsConnected, wsUnsubscribe]);

  // Return hook interface
  return {
    // State
    assets,
    loadingStates,
    errorStates,
    isWebSocketConnected: wsConnected,

    // CRUD operations
    fetchAssets,
    getAssetById,
    createAsset,
    updateAsset,
    deleteAsset,
    uploadAssetImage,

    // WebSocket operations
    subscribeToAssetUpdates: wsSubscribe,
    unsubscribeFromAssetUpdates: wsUnsubscribe,

    // Global states
    globalLoadingState,
    globalError
  };
}

export default useAsset;