import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { jest } from '@jest/globals';

import { useAsset } from '../../hooks/useAsset';
import { Asset, AssetStatus } from '../../types/asset.types';
import assetApi from '../../api/asset.api';
import WebSocketService from '../../services/websocket.service';

// Mock dependencies
jest.mock('../../api/asset.api');
jest.mock('../../services/websocket.service');

// Test constants
const TEST_TIMEOUT = 5000;

// Mock asset data
const mockAssetData: Asset = {
  id: 'test-asset-1',
  rfidTag: 'RF001',
  name: 'Test Asset',
  description: 'Test asset description',
  imageUrl: 'https://example.com/image.jpg',
  status: AssetStatus.ACTIVE,
  locationId: 'loc-001',
  location: {
    id: 'loc-001',
    name: 'Test Location',
    type: 'ZONE',
    zone: 'A1',
    coordinates: { latitude: 0, longitude: 0 },
    annotation: '',
    active: true,
    capacity: 100,
    parentId: null
  },
  lastReadTime: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
};

// Configure mock store
const mockStore = configureStore({
  reducer: {
    assets: (state = { assets: {}, loading: false, error: null }, action) => {
      switch (action.type) {
        case 'assets/setAssets':
          return { ...state, assets: action.payload };
        case 'assets/addAsset':
          return { 
            ...state, 
            assets: { ...state.assets, [action.payload.id]: action.payload }
          };
        case 'assets/updateAsset':
          return {
            ...state,
            assets: { 
              ...state.assets, 
              [action.payload.id]: { ...state.assets[action.payload.id], ...action.payload }
            }
          };
        case 'assets/removeAsset':
          const { [action.payload]: removed, ...remaining } = state.assets;
          return { ...state, assets: remaining };
        default:
          return state;
      }
    }
  }
});

// Test wrapper component
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={mockStore}>{children}</Provider>
);

describe('useAsset hook', () => {
  // Setup before each test
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock API responses
    (assetApi.getAssets as jest.Mock).mockResolvedValue({ 
      data: [mockAssetData],
      status: 200,
      message: 'Success'
    });
    (assetApi.getAssetById as jest.Mock).mockResolvedValue({
      data: mockAssetData,
      status: 200,
      message: 'Success'
    });
    (assetApi.createAsset as jest.Mock).mockResolvedValue({
      data: mockAssetData,
      status: 201,
      message: 'Created'
    });
    (assetApi.updateAsset as jest.Mock).mockResolvedValue({
      data: { ...mockAssetData, name: 'Updated Asset' },
      status: 200,
      message: 'Updated'
    });
    (assetApi.deleteAsset as jest.Mock).mockResolvedValue({
      data: null,
      status: 204,
      message: 'Deleted'
    });
    (assetApi.uploadAssetImage as jest.Mock).mockResolvedValue({
      data: { imageUrl: 'https://example.com/new-image.jpg' },
      status: 200,
      message: 'Uploaded'
    });

    // Mock WebSocket service
    (WebSocketService.getInstance as jest.Mock).mockReturnValue({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    });
  });

  // Cleanup after each test
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should fetch assets successfully', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAsset(), { wrapper });

    expect(result.current.loadingStates.fetchAll).toBe(false);

    act(() => {
      result.current.fetchAssets();
    });

    expect(result.current.loadingStates.fetchAll).toBe(true);
    await waitForNextUpdate({ timeout: TEST_TIMEOUT });

    expect(result.current.assets).toEqual({ [mockAssetData.id]: mockAssetData });
    expect(result.current.loadingStates.fetchAll).toBe(false);
    expect(result.current.errorStates.fetchAll).toBeNull();
  });

  it('should handle fetch assets error', async () => {
    const errorMessage = 'Network error';
    (assetApi.getAssets as jest.Mock).mockRejectedValue(new Error(errorMessage));

    const { result, waitForNextUpdate } = renderHook(() => useAsset(), { wrapper });

    act(() => {
      result.current.fetchAssets();
    });

    await waitForNextUpdate({ timeout: TEST_TIMEOUT });

    expect(result.current.errorStates.fetchAll).toBe(errorMessage);
    expect(result.current.loadingStates.fetchAll).toBe(false);
  });

  it('should get asset by ID successfully', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAsset(), { wrapper });

    act(() => {
      result.current.getAssetById(mockAssetData.id);
    });

    expect(result.current.loadingStates.fetchOne).toBe(true);
    await waitForNextUpdate({ timeout: TEST_TIMEOUT });

    expect(result.current.assets[mockAssetData.id]).toEqual(mockAssetData);
    expect(result.current.loadingStates.fetchOne).toBe(false);
    expect(result.current.errorStates.fetchOne).toBeNull();
  });

  it('should create asset with optimistic update', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAsset(), { wrapper });

    const newAsset = {
      rfidTag: 'RF002',
      name: 'New Asset',
      description: 'New asset description',
      locationId: 'loc-001'
    };

    act(() => {
      result.current.createAsset(newAsset);
    });

    expect(result.current.loadingStates.create).toBe(true);
    await waitForNextUpdate({ timeout: TEST_TIMEOUT });

    expect(result.current.assets[mockAssetData.id]).toBeTruthy();
    expect(result.current.loadingStates.create).toBe(false);
    expect(result.current.errorStates.create).toBeNull();
  });

  it('should update asset with optimistic update', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAsset(), { wrapper });

    const updates = {
      name: 'Updated Asset',
      description: 'Updated description'
    };

    act(() => {
      result.current.updateAsset(mockAssetData.id, updates);
    });

    expect(result.current.loadingStates.update).toBe(true);
    await waitForNextUpdate({ timeout: TEST_TIMEOUT });

    expect(result.current.assets[mockAssetData.id].name).toBe('Updated Asset');
    expect(result.current.loadingStates.update).toBe(false);
    expect(result.current.errorStates.update).toBeNull();
  });

  it('should delete asset with optimistic update', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAsset(), { wrapper });

    // First add the asset to the store
    act(() => {
      mockStore.dispatch({ type: 'assets/addAsset', payload: mockAssetData });
    });

    act(() => {
      result.current.deleteAsset(mockAssetData.id);
    });

    expect(result.current.loadingStates.delete).toBe(true);
    await waitForNextUpdate({ timeout: TEST_TIMEOUT });

    expect(result.current.assets[mockAssetData.id]).toBeUndefined();
    expect(result.current.loadingStates.delete).toBe(false);
    expect(result.current.errorStates.delete).toBeNull();
  });

  it('should upload asset image successfully', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAsset(), { wrapper });
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    act(() => {
      result.current.uploadAssetImage(mockAssetData.id, mockFile);
    });

    expect(result.current.loadingStates.upload).toBe(true);
    await waitForNextUpdate({ timeout: TEST_TIMEOUT });

    expect(result.current.assets[mockAssetData.id].imageUrl).toBe('https://example.com/new-image.jpg');
    expect(result.current.loadingStates.upload).toBe(false);
    expect(result.current.errorStates.upload).toBeNull();
  });

  it('should handle WebSocket real-time updates', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAsset({
      enableRealTimeUpdates: true
    }), { wrapper });

    // Simulate WebSocket connection
    expect(result.current.isWebSocketConnected).toBe(false);
    
    // Simulate incoming WebSocket data
    const updatedAsset = { ...mockAssetData, location: { ...mockAssetData.location, zone: 'A2' } };
    
    act(() => {
      const wsInstance = WebSocketService.getInstance();
      wsInstance.onMessage?.(updatedAsset);
    });

    await waitForNextUpdate({ timeout: TEST_TIMEOUT });

    expect(result.current.assets[mockAssetData.id].location.zone).toBe('A2');
  });

  it('should handle WebSocket reconnection', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useAsset({
      enableRealTimeUpdates: true,
      retryAttempts: 3
    }), { wrapper });

    // Simulate WebSocket disconnection
    act(() => {
      const wsInstance = WebSocketService.getInstance();
      wsInstance.onDisconnect?.();
    });

    expect(result.current.isWebSocketConnected).toBe(false);

    // Simulate successful reconnection
    act(() => {
      const wsInstance = WebSocketService.getInstance();
      wsInstance.onConnect?.();
    });

    await waitForNextUpdate({ timeout: TEST_TIMEOUT });

    expect(result.current.isWebSocketConnected).toBe(true);
  });
});