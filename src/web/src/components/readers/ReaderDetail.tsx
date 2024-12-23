import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom'; // v6.0.0
import useWebSocket from 'react-use-websocket'; // v4.0.0
import { debounce } from 'lodash'; // v4.17.21

import { Card } from '../common/Card';
import { useReader } from '../../hooks/useReader';
import { 
  ReaderConfig, 
  ReaderStatus, 
  PowerLevel, 
  ReaderStatsResponse,
  ReaderResponse 
} from '../../types/reader.types';

// Constants for performance thresholds
const SIGNAL_STRENGTH_THRESHOLDS = {
  MIN: -70, // -70dBm minimum
  MAX: -20  // -20dBm maximum
};

const READ_INTERVAL_LIMITS = {
  MIN: 100,  // 100ms minimum
  MAX: 1000  // 1000ms maximum
};

// Interface for component props
interface ReaderDetailProps {
  onConfigUpdate?: (config: ReaderConfig) => void;
  onError?: (error: Error) => void;
  maintenanceMode?: boolean;
}

// Interface for performance metrics
interface PerformanceMetrics {
  signalStrength: number;
  readRate: number;
  successRate: number;
  errorRate: number;
  memoryUsage: number;
  temperature: number;
}

/**
 * ReaderDetail component providing comprehensive RFID reader monitoring and configuration
 * @version 1.0.0
 */
export const ReaderDetail: React.FC<ReaderDetailProps> = ({
  onConfigUpdate,
  onError,
  maintenanceMode = false
}) => {
  // Get reader ID from URL params
  const { readerId } = useParams<{ readerId: string }>();

  // Initialize reader hook with performance monitoring
  const { 
    selectedReader,
    updateReaderConfig,
    getReaderStatus,
    error: readerError
  } = useReader(readerId, {
    autoConnect: true,
    enablePerformanceMonitoring: true,
    pollingInterval: 5000
  });

  // Local state management
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [configForm, setConfigForm] = useState<ReaderConfig | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [localError, setLocalError] = useState<Error | null>(null);

  // WebSocket connection for real-time updates
  const { lastMessage } = useWebSocket(
    `${process.env.REACT_APP_WS_URL}/readers/${readerId}`,
    {
      shouldReconnect: () => true,
      reconnectInterval: 3000,
      reconnectAttempts: 10
    }
  );

  // Initialize configuration form when reader data is loaded
  useEffect(() => {
    if (selectedReader?.config) {
      setConfigForm(selectedReader.config);
    }
  }, [selectedReader]);

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        if (data.type === 'METRICS_UPDATE') {
          setMetrics(data.metrics);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    }
  }, [lastMessage]);

  // Debounced configuration update handler
  const handleConfigUpdate = useCallback(
    debounce(async (config: ReaderConfig) => {
      try {
        setIsUpdating(true);
        
        // Validate configuration parameters
        if (config.readIntervalMs < READ_INTERVAL_LIMITS.MIN || 
            config.readIntervalMs > READ_INTERVAL_LIMITS.MAX) {
          throw new Error(`Read interval must be between ${READ_INTERVAL_LIMITS.MIN}ms and ${READ_INTERVAL_LIMITS.MAX}ms`);
        }

        if (config.signalStrengthThreshold < SIGNAL_STRENGTH_THRESHOLDS.MIN || 
            config.signalStrengthThreshold > SIGNAL_STRENGTH_THRESHOLDS.MAX) {
          throw new Error(`Signal strength must be between ${SIGNAL_STRENGTH_THRESHOLDS.MIN}dBm and ${SIGNAL_STRENGTH_THRESHOLDS.MAX}dBm`);
        }

        await updateReaderConfig(readerId!, config);
        onConfigUpdate?.(config);
        setLocalError(null);
      } catch (err) {
        const error = err as Error;
        setLocalError(error);
        onError?.(error);
      } finally {
        setIsUpdating(false);
      }
    }, 500),
    [readerId, updateReaderConfig, onConfigUpdate, onError]
  );

  // Handle form input changes
  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setConfigForm(prev => prev ? {
      ...prev,
      [name]: name === 'readIntervalMs' ? parseInt(value, 10) : value
    } : null);
  };

  // Compute status color based on reader state
  const statusColor = useMemo(() => {
    if (!selectedReader) return 'gray';
    switch (selectedReader.status) {
      case ReaderStatus.ONLINE: return 'green';
      case ReaderStatus.ERROR: return 'red';
      case ReaderStatus.MAINTENANCE: return 'yellow';
      default: return 'gray';
    }
  }, [selectedReader]);

  // Render loading state
  if (!selectedReader) {
    return (
      <Card isLoading testId="reader-detail-loading">
        Loading reader details...
      </Card>
    );
  }

  // Render error state
  if (readerError || localError) {
    return (
      <Card error={readerError || localError} testId="reader-detail-error">
        {(readerError || localError)?.message}
      </Card>
    );
  }

  return (
    <div className="reader-detail" data-testid="reader-detail">
      {/* Reader Status Section */}
      <Card className="reader-status" testId="reader-status">
        <div className="status-indicator" style={{ color: statusColor }}>
          <span className="status-dot" />
          {selectedReader.status}
        </div>
        <div className="reader-info">
          <h2>{selectedReader.name}</h2>
          <p>IP: {selectedReader.ipAddress}:{selectedReader.port}</p>
          <p>Location: {selectedReader.location}</p>
          <p>Firmware: {selectedReader.firmwareVersion}</p>
        </div>
      </Card>

      {/* Performance Metrics Section */}
      <Card className="performance-metrics" testId="performance-metrics">
        <h3>Performance Metrics</h3>
        {metrics && (
          <div className="metrics-grid">
            <div className="metric">
              <label>Signal Strength</label>
              <span>{metrics.signalStrength} dBm</span>
            </div>
            <div className="metric">
              <label>Read Rate</label>
              <span>{metrics.readRate} reads/sec</span>
            </div>
            <div className="metric">
              <label>Success Rate</label>
              <span>{metrics.successRate}%</span>
            </div>
            <div className="metric">
              <label>Error Rate</label>
              <span>{metrics.errorRate}%</span>
            </div>
          </div>
        )}
      </Card>

      {/* Configuration Section */}
      <Card 
        className="reader-config" 
        testId="reader-config"
        interactive={!maintenanceMode}
      >
        <h3>Reader Configuration</h3>
        {configForm && (
          <form onSubmit={(e) => {
            e.preventDefault();
            handleConfigUpdate(configForm);
          }}>
            <div className="form-group">
              <label htmlFor="powerLevel">Power Level</label>
              <select
                id="powerLevel"
                name="powerLevel"
                value={configForm.powerLevel}
                onChange={handleInputChange}
                disabled={maintenanceMode || isUpdating}
              >
                {Object.values(PowerLevel).map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="readIntervalMs">Read Interval (ms)</label>
              <input
                type="number"
                id="readIntervalMs"
                name="readIntervalMs"
                value={configForm.readIntervalMs}
                onChange={handleInputChange}
                min={READ_INTERVAL_LIMITS.MIN}
                max={READ_INTERVAL_LIMITS.MAX}
                disabled={maintenanceMode || isUpdating}
              />
            </div>

            <div className="form-group">
              <label htmlFor="signalStrengthThreshold">Signal Strength Threshold (dBm)</label>
              <input
                type="number"
                id="signalStrengthThreshold"
                name="signalStrengthThreshold"
                value={configForm.signalStrengthThreshold}
                onChange={handleInputChange}
                min={SIGNAL_STRENGTH_THRESHOLDS.MIN}
                max={SIGNAL_STRENGTH_THRESHOLDS.MAX}
                disabled={maintenanceMode || isUpdating}
              />
            </div>

            <div className="form-group">
              <label>
                <input
                  type="checkbox"
                  name="filteringEnabled"
                  checked={configForm.filteringEnabled}
                  onChange={(e) => handleInputChange({
                    ...e,
                    target: { ...e.target, value: e.target.checked.toString() }
                  })}
                  disabled={maintenanceMode || isUpdating}
                />
                Enable Filtering
              </label>
            </div>

            <button 
              type="submit"
              disabled={maintenanceMode || isUpdating}
              className={isUpdating ? 'updating' : ''}
            >
              {isUpdating ? 'Updating...' : 'Update Configuration'}
            </button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default ReaderDetail;