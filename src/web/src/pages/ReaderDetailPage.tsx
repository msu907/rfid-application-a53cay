import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import DashboardLayout from '../layouts/DashboardLayout';
import ReaderDetail from '../components/readers/ReaderDetail';
import ErrorBoundary from '../components/common/ErrorBoundary';
import useWebSocket from '../hooks/useWebSocket';
import { useReader } from '../hooks/useReader';
import { ReaderConfig, ReaderStatus, PowerLevel } from '../types/reader.types';

// Constants for validation based on technical specifications
const VALIDATION_LIMITS = {
  SIGNAL_STRENGTH: {
    MIN: -70, // -70dBm minimum as per A.1.1
    MAX: -20  // -20dBm maximum as per A.1.1
  },
  READ_INTERVAL: {
    MIN: 100,  // 100ms minimum
    MAX: 1000  // 1000ms maximum for sub-500ms latency requirement
  }
} as const;

/**
 * ReaderDetailPage component displaying comprehensive RFID reader information
 * with real-time updates and configuration capabilities.
 */
const ReaderDetailPage: React.FC = React.memo(() => {
  // Get reader ID from URL parameters
  const { readerId } = useParams<{ readerId: string }>();

  // Initialize reader hook with performance monitoring
  const {
    selectedReader,
    updateReaderConfig,
    getReaderStatus,
    error: readerError,
    clearError,
    performance
  } = useReader(readerId, {
    autoConnect: true,
    enablePerformanceMonitoring: true,
    pollingInterval: 5000
  });

  // WebSocket connection for real-time updates
  const {
    isConnected: wsConnected,
    error: wsError,
    connectionHealth,
    reconnect
  } = useWebSocket('reader-detail', {
    autoConnect: true,
    heartbeatInterval: 30000,
    reconnectAttempts: 5
  });

  // Local state for maintenance mode
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);

  /**
   * Validates reader configuration against technical specifications
   */
  const validateConfig = useCallback((config: ReaderConfig): boolean => {
    if (config.readIntervalMs < VALIDATION_LIMITS.READ_INTERVAL.MIN || 
        config.readIntervalMs > VALIDATION_LIMITS.READ_INTERVAL.MAX) {
      throw new Error(`Read interval must be between ${VALIDATION_LIMITS.READ_INTERVAL.MIN}ms and ${VALIDATION_LIMITS.READ_INTERVAL.MAX}ms`);
    }

    if (config.signalStrengthThreshold < VALIDATION_LIMITS.SIGNAL_STRENGTH.MIN || 
        config.signalStrengthThreshold > VALIDATION_LIMITS.SIGNAL_STRENGTH.MAX) {
      throw new Error(`Signal strength must be between ${VALIDATION_LIMITS.SIGNAL_STRENGTH.MIN}dBm and ${VALIDATION_LIMITS.SIGNAL_STRENGTH.MAX}dBm`);
    }

    return true;
  }, []);

  /**
   * Handles reader configuration updates with validation
   */
  const handleConfigUpdate = useCallback(async (config: ReaderConfig) => {
    try {
      if (!readerId) {
        throw new Error('Reader ID is required');
      }

      // Validate configuration against technical specifications
      validateConfig(config);

      await updateReaderConfig(readerId, config);
      toast.success('Reader configuration updated successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update reader configuration';
      toast.error(errorMessage);
      console.error('Configuration update error:', error);
    }
  }, [readerId, updateReaderConfig, validateConfig]);

  /**
   * Handles WebSocket reconnection
   */
  const handleReconnect = useCallback(async () => {
    try {
      await reconnect();
      toast.success('Reconnected to real-time updates');
    } catch (error) {
      toast.error('Failed to reconnect to real-time updates');
    }
  }, [reconnect]);

  /**
   * Effect to monitor WebSocket connection health
   */
  useEffect(() => {
    if (wsError) {
      toast.error('Lost connection to real-time updates. Attempting to reconnect...');
      handleReconnect();
    }
  }, [wsError, handleReconnect]);

  /**
   * Effect to handle maintenance mode based on reader status
   */
  useEffect(() => {
    if (selectedReader?.status === ReaderStatus.MAINTENANCE) {
      setIsMaintenanceMode(true);
      toast.warning('Reader is in maintenance mode. Configuration changes are disabled.');
    } else {
      setIsMaintenanceMode(false);
    }
  }, [selectedReader?.status]);

  /**
   * Computed connection status with health indicators
   */
  const connectionStatus = useMemo(() => ({
    connected: wsConnected,
    latency: connectionHealth.latency,
    lastHeartbeat: connectionHealth.lastHeartbeat,
    status: connectionHealth.status
  }), [wsConnected, connectionHealth]);

  return (
    <DashboardLayout>
      <ErrorBoundary
        onError={(error) => {
          console.error('Reader detail error:', error);
          toast.error('An error occurred while displaying reader details');
        }}
      >
        <div className="reader-detail-page">
          <header className="page-header">
            <h1>Reader Details</h1>
            {connectionStatus.connected && (
              <div className="connection-status" aria-live="polite">
                <span className="status-indicator online" />
                Connected
                <small>Latency: {connectionStatus.latency}ms</small>
              </div>
            )}
          </header>

          <ReaderDetail
            onConfigUpdate={handleConfigUpdate}
            onError={(error) => {
              toast.error(error.message);
              clearError();
            }}
            maintenanceMode={isMaintenanceMode}
          />
        </div>
      </ErrorBoundary>

      <style jsx>{`
        .reader-detail-page {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .connection-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: var(--text-secondary);
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .status-indicator.online {
          background-color: var(--success-color);
        }

        @media (max-width: 768px) {
          .reader-detail-page {
            padding: 16px;
          }

          .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
        }
      `}</style>
    </DashboardLayout>
  );
});

ReaderDetailPage.displayName = 'ReaderDetailPage';

export default ReaderDetailPage;