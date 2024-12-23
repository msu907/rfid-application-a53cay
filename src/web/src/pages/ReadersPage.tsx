import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify'; // v9.1.3

import ReaderList from '../components/readers/ReaderList';
import ReaderStats from '../components/readers/ReaderStats';
import ReaderConfig from '../components/readers/ReaderConfig';
import { useReader } from '../hooks/useReader';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { Reader, ReaderConfig as IReaderConfig } from '../types/reader.types';

// Constants for page configuration
const PAGE_TITLE = 'RFID Reader Management';
const UPDATE_INTERVAL = 5000; // 5 seconds for real-time updates

const TOAST_MESSAGES = {
  CONFIG_UPDATE_SUCCESS: 'Reader configuration updated successfully',
  CONFIG_UPDATE_ERROR: 'Failed to update reader configuration: ',
  READER_FETCH_ERROR: 'Failed to fetch reader details: ',
  WEBSOCKET_ERROR: 'Real-time updates disconnected, retrying...',
  RATE_LIMIT_ERROR: 'Too many configuration updates, please wait'
} as const;

const ARIA_LABELS = {
  READER_LIST: 'RFID Reader List',
  READER_STATS: 'Reader Performance Metrics',
  READER_CONFIG: 'Reader Configuration Panel',
  UPDATE_STATUS: 'Configuration Update Status'
} as const;

/**
 * ReadersPage component providing comprehensive RFID reader management interface
 */
const ReadersPage: React.FC = () => {
  // Initialize reader hook with real-time updates
  const {
    readers,
    selectedReader,
    loading,
    error,
    fetchReaders,
    fetchReaderById,
    updateReaderConfig,
    clearError
  } = useReader(undefined, {
    autoConnect: true,
    enablePerformanceMonitoring: true,
    pollingInterval: UPDATE_INTERVAL
  });

  // Local state management
  const [selectedReaderId, setSelectedReaderId] = useState<string | null>(null);
  const [configUpdateInProgress, setConfigUpdateInProgress] = useState(false);

  /**
   * Handles reader selection from the list
   */
  const handleReaderSelect = useCallback(async (readerId: string) => {
    try {
      setSelectedReaderId(readerId);
      await fetchReaderById(readerId);
      
      // Update ARIA live region
      const statusRegion = document.getElementById('reader-status-region');
      if (statusRegion) {
        statusRegion.textContent = `Selected reader: ${readers[readerId]?.name || readerId}`;
      }
    } catch (error) {
      console.error('Failed to fetch reader details:', error);
      toast.error(`${TOAST_MESSAGES.READER_FETCH_ERROR}${error.message}`);
    }
  }, [fetchReaderById, readers]);

  /**
   * Handles reader configuration updates with validation
   */
  const handleConfigUpdate = useCallback(async (config: IReaderConfig) => {
    if (!selectedReaderId || configUpdateInProgress) {
      return;
    }

    setConfigUpdateInProgress(true);
    try {
      await updateReaderConfig(selectedReaderId, config);
      toast.success(TOAST_MESSAGES.CONFIG_UPDATE_SUCCESS);
      
      // Update ARIA live region
      const statusRegion = document.getElementById('reader-status-region');
      if (statusRegion) {
        statusRegion.textContent = 'Configuration updated successfully';
      }
      
      // Refresh reader stats
      await fetchReaderById(selectedReaderId);
    } catch (error) {
      console.error('Failed to update reader configuration:', error);
      toast.error(`${TOAST_MESSAGES.CONFIG_UPDATE_ERROR}${error.message}`);
    } finally {
      setConfigUpdateInProgress(false);
    }
  }, [selectedReaderId, configUpdateInProgress, updateReaderConfig, fetchReaderById]);

  // Set up initial data fetch and cleanup
  useEffect(() => {
    fetchReaders();

    // Set up error handling for WebSocket disconnections
    const handleWebSocketError = () => {
      toast.warning(TOAST_MESSAGES.WEBSOCKET_ERROR);
    };

    window.addEventListener('websocket-error', handleWebSocketError);
    return () => {
      window.removeEventListener('websocket-error', handleWebSocketError);
      clearError();
    };
  }, [fetchReaders, clearError]);

  return (
    <ErrorBoundary>
      <div className="readers-page">
        <header className="readers-page__header">
          <h1>{PAGE_TITLE}</h1>
          {/* ARIA live region for status updates */}
          <div 
            id="reader-status-region"
            className="visually-hidden"
            role="status"
            aria-live="polite"
          />
        </header>

        <div className="readers-page__content">
          <section 
            className="readers-page__list"
            aria-label={ARIA_LABELS.READER_LIST}
          >
            <ReaderList
              onReaderSelect={handleReaderSelect}
              className="reader-list"
              virtualizeOptions={{
                itemHeight: 48,
                overscan: 5
              }}
              accessibilityLabels={{
                readerStatus: 'Reader Status:',
                lastHeartbeat: 'Last seen:'
              }}
            />
          </section>

          {selectedReader && (
            <div className="readers-page__details">
              <section 
                className="readers-page__stats"
                aria-label={ARIA_LABELS.READER_STATS}
              >
                <ReaderStats
                  readerId={selectedReader.id}
                  className="reader-stats"
                />
              </section>

              <section 
                className="readers-page__config"
                aria-label={ARIA_LABELS.READER_CONFIG}
              >
                <ReaderConfig
                  readerId={selectedReader.id}
                  initialConfig={selectedReader.config}
                  onConfigUpdate={handleConfigUpdate}
                  onValidationError={(errors) => {
                    errors.forEach(error => toast.error(error.message));
                  }}
                  disabled={configUpdateInProgress}
                />
              </section>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default ReadersPage;