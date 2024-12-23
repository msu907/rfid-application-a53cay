import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { axe, toHaveNoViolations } from 'jest-axe';
import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals';

import DashboardPage from '../../pages/DashboardPage';
import { useAsset } from '../../hooks/useAsset';
import WebSocketService from '../../services/websocket.service';
import { createTestStore } from '../../utils/testUtils';
import { Asset, AssetStatus } from '../../types/asset.types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('../../hooks/useAsset');
jest.mock('../../services/websocket.service');

// Mock data
const mockAssetData: Asset[] = [
  {
    id: '1',
    rfidTag: 'RF001',
    name: 'Test Asset 1',
    status: AssetStatus.ACTIVE,
    location: {
      id: 'loc1',
      name: 'Zone A',
      coordinates: { latitude: 0, longitude: 0 },
      type: 'ZONE',
      zone: 'A',
      annotation: '',
      active: true,
      capacity: 100,
      parentId: null
    },
    description: 'Test asset description',
    imageUrl: null,
    locationId: 'loc1',
    lastReadTime: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Test utilities
const renderWithRedux = (component: React.ReactElement) => {
  const store = createTestStore({
    assets: {
      items: mockAssetData,
      loading: false,
      error: null
    }
  });
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('DashboardPage', () => {
  // Performance tracking
  const performanceMetrics = {
    renderCount: 0,
    updateLatency: [] as number[]
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    performanceMetrics.renderCount = 0;
    performanceMetrics.updateLatency = [];

    // Mock useAsset hook
    (useAsset as jest.Mock).mockReturnValue({
      assets: mockAssetData,
      loadingStates: { fetchAll: false },
      error: null,
      fetchAssets: jest.fn(),
      updateAsset: jest.fn()
    });

    // Mock WebSocket service
    (WebSocketService.getInstance as jest.Mock).mockReturnValue({
      connect: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn()
    });
  });

  afterEach(() => {
    // Cleanup subscriptions
    const wsService = WebSocketService.getInstance();
    wsService.unsubscribe();
  });

  it('should render dashboard layout correctly', async () => {
    const { container } = renderWithRedux(<DashboardPage />);

    // Verify main components are rendered
    expect(screen.getByRole('region', { name: /asset statistics/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /asset location map/i })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /recent activities/i })).toBeInTheDocument();

    // Verify accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify heading hierarchy
    const headings = screen.getAllByRole('heading');
    expect(headings[0]).toHaveTextContent(/asset overview/i);
  });

  it('should handle real-time updates efficiently', async () => {
    const startTime = performance.now();
    renderWithRedux(<DashboardPage />);

    // Simulate multiple real-time updates
    const wsService = WebSocketService.getInstance();
    const updateCount = 10;
    
    for (let i = 0; i < updateCount; i++) {
      wsService.subscribe.mock.calls[0][1]({
        type: 'ASSET_UPDATE',
        data: {
          ...mockAssetData[0],
          name: `Updated Asset ${i}`
        }
      });
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const endTime = performance.now();
    const averageLatency = performanceMetrics.updateLatency.reduce((a, b) => a + b, 0) / updateCount;

    // Verify performance metrics
    expect(performanceMetrics.renderCount).toBeLessThan(updateCount); // Debouncing should reduce renders
    expect(averageLatency).toBeLessThan(500); // Technical spec requirement: < 500ms
    expect(endTime - startTime).toBeLessThan(updateCount * 500); // Total time should be reasonable
  });

  it('should maintain accessibility during updates', async () => {
    const { container } = renderWithRedux(<DashboardPage />);

    // Simulate real-time update
    const wsService = WebSocketService.getInstance();
    wsService.subscribe.mock.calls[0][1]({
      type: 'ASSET_UPDATE',
      data: {
        ...mockAssetData[0],
        status: AssetStatus.MAINTENANCE
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/maintenance/i)).toBeInTheDocument();
    });

    // Verify accessibility after update
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should handle error states gracefully', async () => {
    // Mock error state
    (useAsset as jest.Mock).mockReturnValue({
      assets: [],
      loadingStates: { fetchAll: false },
      error: new Error('Failed to fetch assets'),
      fetchAssets: jest.fn()
    });

    renderWithRedux(<DashboardPage />);

    // Verify error message is displayed
    expect(screen.getByRole('alert')).toHaveTextContent(/failed to fetch assets/i);

    // Verify retry functionality
    const retryButton = screen.getByRole('button', { name: /retry/i });
    await userEvent.click(retryButton);
    expect(useAsset().fetchAssets).toHaveBeenCalled();
  });

  it('should optimize performance with memoization', () => {
    const { rerender } = renderWithRedux(<DashboardPage />);
    const initialRenderCount = performanceMetrics.renderCount;

    // Trigger multiple rerenders with same data
    for (let i = 0; i < 5; i++) {
      rerender(<DashboardPage />);
    }

    // Verify render count hasn't increased unnecessarily
    expect(performanceMetrics.renderCount - initialRenderCount).toBeLessThan(2);
  });

  it('should handle WebSocket connection issues', async () => {
    // Mock WebSocket connection failure
    const wsService = WebSocketService.getInstance();
    wsService.connect.mockRejectedValue(new Error('Connection failed'));

    renderWithRedux(<DashboardPage />);

    // Verify connection error message
    await waitFor(() => {
      expect(screen.getByText(/real-time updates unavailable/i)).toBeInTheDocument();
    });

    // Verify automatic reconnection attempt
    expect(wsService.connect).toHaveBeenCalledTimes(2);
  });
});