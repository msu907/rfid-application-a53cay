/**
 * Asset Detail Page Component
 * Displays comprehensive information about a single asset with real-time updates
 * and management capabilities.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import MainLayout from '../layouts/MainLayout';
import AssetDetail from '../components/assets/AssetDetail';
import useNotification from '../hooks/useNotification';
import useWebSocket from '../hooks/useWebSocket';
import type { WebSocketMessage } from '../hooks/useWebSocket';
import type { Asset } from '../types/asset.types';

// Constants for error handling and WebSocket configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;
const WS_RECONNECT_DELAY = 2000;

/**
 * Asset Detail Page component with real-time updates and error handling
 */
const AssetDetailPage: React.FC = React.memo(() => {
  // Hooks initialization
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // WebSocket connection for real-time updates
  const {
    isConnected: wsConnected,
    data: wsData,
    error: wsError,
    subscribe,
    unsubscribe,
    reconnect
  } = useWebSocket('assets', {
    autoConnect: true,
    reconnectAttempts: MAX_RETRY_ATTEMPTS,
    heartbeatInterval: 30000
  });

  /**
   * Handles navigation back to asset list with state preservation
   */
  const handleBack = useCallback(() => {
    const previousState = location.state as { from: string } | undefined;
    navigate(previousState?.from || '/assets', {
      state: {
        preserveFilters: true,
        scrollPosition: previousState?.scrollPosition
      }
    });
  }, [navigate, location.state]);

  /**
   * Handles WebSocket messages with type safety
   */
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    if (!id) return;

    try {
      const assetUpdate = message as Asset;
      if (assetUpdate.id === id) {
        showNotification('info', 'Asset information updated', {
          duration: 3000,
          priority: 1
        });
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  }, [id, showNotification]);

  /**
   * Handles errors with retry logic and user feedback
   */
  const handleError = useCallback((error: Error) => {
    setError(error);
    setLoading(false);

    if (retryCount < MAX_RETRY_ATTEMPTS) {
      setRetryCount(prev => prev + 1);
      showNotification('warning', `Retrying... Attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS}`, {
        duration: 3000
      });

      setTimeout(() => {
        setLoading(true);
        setError(null);
      }, RETRY_DELAY * Math.pow(2, retryCount));
    } else {
      showNotification('error', 'Failed to load asset details. Please try again later.', {
        duration: 5000,
        priority: 2
      });
      handleBack();
    }
  }, [retryCount, showNotification, handleBack]);

  /**
   * Effect for WebSocket connection management
   */
  useEffect(() => {
    if (wsConnected && id) {
      subscribe();
    }

    return () => {
      if (wsConnected) {
        unsubscribe();
      }
    };
  }, [wsConnected, id, subscribe, unsubscribe]);

  /**
   * Effect for WebSocket error handling
   */
  useEffect(() => {
    if (wsError) {
      showNotification('warning', 'Real-time updates temporarily unavailable', {
        duration: 5000
      });
      setTimeout(reconnect, WS_RECONNECT_DELAY);
    }
  }, [wsError, showNotification, reconnect]);

  /**
   * Memoized page title for Helmet
   */
  const pageTitle = useMemo(() => {
    return `Asset Details${id ? ` - ${id}` : ''}`;
  }, [id]);

  return (
    <MainLayout>
      <Helmet>
        <title>{pageTitle} | RFID Asset Tracking</title>
        <meta name="description" content="Detailed asset information and management" />
      </Helmet>

      <AssetDetail
        onBack={handleBack}
        onError={handleError}
        onWebSocketMessage={handleWebSocketMessage}
        loading={loading}
        error={error}
      />
    </MainLayout>
  );
});

// Display name for debugging
AssetDetailPage.displayName = 'AssetDetailPage';

export default AssetDetailPage;