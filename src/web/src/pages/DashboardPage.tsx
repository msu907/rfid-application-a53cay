/**
 * Main dashboard page component for the RFID Asset Tracking System.
 * Implements real-time asset tracking, statistics, and monitoring features
 * with enhanced error handling, accessibility, and performance optimizations.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { debounce } from 'lodash';

// Internal components
import DashboardLayout from '../components/dashboard/DashboardLayout';
import ErrorBoundary from '../components/common/ErrorBoundary';
import StatusWidget from '../components/dashboard/StatusWidget';
import RecentActivities from '../components/dashboard/RecentActivities';

// Hooks and services
import useWebSocket from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';
import useAsset from '../hooks/useAsset';

// Types and interfaces
import { Asset, AssetStatus } from '../types/asset.types';
import { ReaderStatus } from '../types/reader.types';
import { ApiError } from '../types/api.types';

// Constants
const WEBSOCKET_TOPIC = 'dashboard-updates';
const UPDATE_INTERVAL = 30000; // 30 seconds
const DEBOUNCE_DELAY = 300; // 300ms

interface DashboardState {
  selectedAssetId: string | null;
  error: ApiError | null;
  lastUpdate: Date;
}

/**
 * Enhanced dashboard page component with real-time updates and accessibility
 */
const DashboardPage: React.FC = () => {
  const dispatch = useDispatch();
  const { user, checkPermission } = useAuth();
  
  // State management
  const [dashboardState, setDashboardState] = useState<DashboardState>({
    selectedAssetId: null,
    error: null,
    lastUpdate: new Date()
  });

  // Custom hooks
  const { 
    assets, 
    loadingStates, 
    fetchAssets, 
    updateAsset 
  } = useAsset();

  // WebSocket connection for real-time updates
  const { 
    isConnected: wsConnected,
    data: wsData,
    error: wsError,
    connectionHealth,
    subscribe,
    unsubscribe
  } = useWebSocket(WEBSOCKET_TOPIC, {
    autoConnect: true,
    enableCompression: true,
    heartbeatInterval: UPDATE_INTERVAL,
    reconnectAttempts: 3
  });

  /**
   * Handles real-time asset updates with debouncing
   */
  const handleAssetUpdate = useCallback(
    debounce(async (updatedAsset: Asset) => {
      try {
        await updateAsset(updatedAsset.id, updatedAsset);
        setDashboardState(prev => ({
          ...prev,
          lastUpdate: new Date()
        }));
      } catch (error) {
        setDashboardState(prev => ({
          ...prev,
          error: error as ApiError
        }));
      }
    }, DEBOUNCE_DELAY),
    [updateAsset]
  );

  /**
   * Handles WebSocket message processing
   */
  const handleWebSocketMessage = useCallback((message: any) => {
    if (message.type === 'ASSET_UPDATE') {
      handleAssetUpdate(message.data);
    }
  }, [handleAssetUpdate]);

  /**
   * Initializes dashboard data and WebSocket subscription
   */
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        await fetchAssets();
        if (wsConnected) {
          subscribe();
        }
      } catch (error) {
        setDashboardState(prev => ({
          ...prev,
          error: error as ApiError
        }));
      }
    };

    initializeDashboard();

    return () => {
      handleAssetUpdate.cancel();
      unsubscribe();
    };
  }, [fetchAssets, wsConnected, subscribe, unsubscribe]);

  /**
   * Handles WebSocket data updates
   */
  useEffect(() => {
    if (wsData) {
      handleWebSocketMessage(wsData);
    }
  }, [wsData, handleWebSocketMessage]);

  /**
   * Handles WebSocket errors
   */
  useEffect(() => {
    if (wsError) {
      setDashboardState(prev => ({
        ...prev,
        error: {
          code: 'WEBSOCKET_ERROR',
          message: wsError.message,
          details: {},
          timestamp: new Date().toISOString()
        }
      }));
    }
  }, [wsError]);

  /**
   * Memoized dashboard statistics
   */
  const dashboardStats = useMemo(() => ({
    totalAssets: Object.values(assets).length,
    activeAssets: Object.values(assets).filter(
      asset => asset.status === AssetStatus.ACTIVE
    ).length,
    alertCount: Object.values(assets).filter(
      asset => asset.status === AssetStatus.MAINTENANCE
    ).length
  }), [assets]);

  return (
    <ErrorBoundary
      fallback={<div>Error loading dashboard. Please refresh the page.</div>}
    >
      <DashboardLayout
        className="dashboard-page"
        refreshInterval={UPDATE_INTERVAL}
      >
        {/* Status Overview */}
        <StatusWidget
          className="dashboard-status"
          refreshInterval={UPDATE_INTERVAL}
        />

        {/* Main Content Area */}
        <div className="dashboard-content">
          <div className="dashboard-main">
            {/* Asset Statistics */}
            <div
              className="dashboard-stats"
              role="region"
              aria-label="Asset Statistics"
            >
              <h2>Asset Overview</h2>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Total Assets</span>
                  <span className="stat-value">{dashboardStats.totalAssets}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Active Assets</span>
                  <span className="stat-value">{dashboardStats.activeAssets}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Alerts</span>
                  <span className="stat-value">{dashboardStats.alertCount}</span>
                </div>
              </div>
            </div>

            {/* Recent Activities Feed */}
            <RecentActivities
              className="dashboard-activities"
              maxItems={10}
              refreshInterval={UPDATE_INTERVAL}
            />
          </div>
        </div>

        {/* Connection Status */}
        {!wsConnected && (
          <div
            className="connection-error"
            role="alert"
            aria-live="polite"
          >
            Real-time updates unavailable. Attempting to reconnect...
          </div>
        )}

        {/* High Latency Warning */}
        {connectionHealth.latency > 1000 && (
          <div
            className="latency-warning"
            role="alert"
            aria-live="polite"
          >
            High latency detected ({connectionHealth.latency}ms)
          </div>
        )}

        {/* ARIA Live Region for Updates */}
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          Last updated: {dashboardState.lastUpdate.toLocaleTimeString()}
        </div>
      </DashboardLayout>
    </ErrorBoundary>
  );
};

// Add display name for debugging
DashboardPage.displayName = 'DashboardPage';

export default React.memo(DashboardPage);