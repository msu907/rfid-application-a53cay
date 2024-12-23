import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.11.2
import { Tabs, Tab, CircularProgress, Alert } from '@mui/material'; // ^5.13.2

// Internal components
import AssetList from '../components/assets/AssetList';
import AssetGrid from '../components/assets/AssetGrid';
import AssetStats from '../components/assets/AssetStats';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Hooks and services
import useAsset from '../hooks/useAsset';
import useWebSocket from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';

// Types
import { Asset } from '../types/asset.types';
import { Permission } from '../types/auth.types';

// View type enumeration
enum ViewType {
  LIST = 'list',
  GRID = 'grid',
  STATS = 'stats'
}

// Constants
const WEBSOCKET_WIDGET_ID = 'assets-page';
const VIEW_STORAGE_KEY = 'asset_view_preference';
const DEFAULT_ERROR_MESSAGE = 'An error occurred while loading assets';

interface AssetsPageProps {
  initialView?: ViewType;
}

/**
 * AssetsPage Component
 * Provides a comprehensive view of assets with multiple visualization options
 * and real-time updates.
 */
const AssetsPage: React.FC<AssetsPageProps> = ({ initialView = ViewType.LIST }) => {
  const navigate = useNavigate();
  const { checkPermission } = useAuth();
  
  // State management
  const [currentView, setCurrentView] = useState<ViewType>(() => {
    const savedView = localStorage.getItem(VIEW_STORAGE_KEY);
    return (savedView as ViewType) || initialView;
  });

  // Custom hooks
  const {
    assets,
    loadingStates,
    errorStates,
    fetchAssets,
    globalLoadingState,
    globalError
  } = useAsset();

  const {
    isConnected: wsConnected,
    subscribe: wsSubscribe,
    unsubscribe: wsUnsubscribe,
    data: wsData
  } = useWebSocket(WEBSOCKET_WIDGET_ID, {
    autoConnect: true,
    heartbeatInterval: 30000
  });

  // Check permissions
  const canEditAssets = useMemo(() => 
    checkPermission(Permission.WRITE_ASSETS),
    [checkPermission]
  );

  /**
   * Handles view type changes with persistence
   */
  const handleViewChange = useCallback((event: React.SyntheticEvent, newView: ViewType) => {
    setCurrentView(newView);
    localStorage.setItem(VIEW_STORAGE_KEY, newView);
  }, []);

  /**
   * Handles asset selection and navigation
   */
  const handleAssetSelect = useCallback((asset: Asset) => {
    if (canEditAssets) {
      navigate(`/assets/${asset.id}`);
    }
  }, [navigate, canEditAssets]);

  /**
   * Initializes data fetching and WebSocket subscription
   */
  useEffect(() => {
    fetchAssets();
    wsSubscribe();

    return () => {
      wsUnsubscribe();
    };
  }, [fetchAssets, wsSubscribe, wsUnsubscribe]);

  /**
   * Renders the current view based on selected type
   */
  const renderCurrentView = useCallback(() => {
    const assetArray = Object.values(assets);

    switch (currentView) {
      case ViewType.GRID:
        return (
          <AssetGrid
            onAssetClick={handleAssetSelect}
            virtualizationEnabled={true}
            errorBoundary={true}
            loadingBehavior="skeleton"
          />
        );

      case ViewType.STATS:
        return (
          <AssetStats
            className="assets-page__stats"
          />
        );

      case ViewType.LIST:
      default:
        return (
          <AssetList
            onAssetSelect={handleAssetSelect}
            className="assets-page__list"
            aria-label="Asset List View"
          />
        );
    }
  }, [currentView, handleAssetSelect, assets]);

  /**
   * Renders loading state
   */
  if (globalLoadingState && !Object.keys(assets).length) {
    return (
      <div className="assets-page__loading" role="status">
        <CircularProgress size={40} />
        <span className="visually-hidden">Loading assets...</span>
      </div>
    );
  }

  /**
   * Renders error state
   */
  if (globalError) {
    return (
      <Alert 
        severity="error"
        className="assets-page__error"
        role="alert"
      >
        {globalError.message || DEFAULT_ERROR_MESSAGE}
      </Alert>
    );
  }

  return (
    <ErrorBoundary>
      <div className="assets-page" role="main">
        {/* Page Header */}
        <header className="assets-page__header">
          <h1>Assets</h1>
          
          {/* View Selection Tabs */}
          <Tabs
            value={currentView}
            onChange={handleViewChange}
            aria-label="Asset view options"
            className="assets-page__tabs"
          >
            <Tab
              value={ViewType.LIST}
              label="List View"
              aria-controls="asset-list-view"
              data-testid="list-view-tab"
            />
            <Tab
              value={ViewType.GRID}
              label="Grid View"
              aria-controls="asset-grid-view"
              data-testid="grid-view-tab"
            />
            <Tab
              value={ViewType.STATS}
              label="Statistics"
              aria-controls="asset-stats-view"
              data-testid="stats-view-tab"
            />
          </Tabs>
        </header>

        {/* WebSocket Connection Status */}
        {!wsConnected && (
          <Alert 
            severity="warning"
            className="assets-page__ws-alert"
          >
            Real-time updates are currently unavailable
          </Alert>
        )}

        {/* Main Content */}
        <main 
          className="assets-page__content"
          role="region"
          aria-label={`Asset ${currentView} view`}
        >
          {renderCurrentView()}
        </main>
      </div>
    </ErrorBoundary>
  );
};

// Add display name for debugging
AssetsPage.displayName = 'AssetsPage';

export default React.memo(AssetsPage);