/**
 * ReaderStats Component
 * Displays real-time performance metrics and statistics for RFID readers
 * with optimized rendering and accessibility features.
 * @version 1.0.0
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react'; // v18.0.0
import { debounce } from 'lodash'; // v4.17.21

import Chart from '../common/Chart';
import { useReader } from '../../hooks/useReader';
import { 
  ReaderStatus, 
  PowerLevel, 
  ReaderStatsResponse 
} from '../../types/reader.types';

// Constants for chart configuration and thresholds
const UPDATE_INTERVAL = 5000; // 5 seconds
const SIGNAL_STRENGTH_THRESHOLDS = {
  low: -70,
  medium: -45,
  high: -20
};

const READ_RATE_THRESHOLDS = {
  warning: 800,  // 80% of max 1000 reads/second
  critical: 950  // 95% of max 1000 reads/second
};

interface ReaderStatsProps {
  readerId: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * ReaderStats Component
 * Displays comprehensive performance metrics for RFID readers
 */
const ReaderStats: React.FC<ReaderStatsProps> = ({
  readerId,
  className = '',
  ariaLabel = 'Reader Statistics'
}) => {
  // Custom hook for reader operations
  const { 
    getReaderStatus, 
    selectedReader, 
    error 
  } = useReader(readerId, {
    autoConnect: true,
    enablePerformanceMonitoring: true
  });

  // Local state for stats management
  const [stats, setStats] = useState<ReaderStatsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  /**
   * Formats signal strength data for visualization
   */
  const formatSignalStrengthData = useMemo(() => {
    if (!stats) return [];

    return [{
      value: stats.averageSignalStrength,
      color: getSignalStrengthColor(stats.averageSignalStrength),
      label: 'Average Signal Strength (dBm)'
    }];
  }, [stats]);

  /**
   * Formats read rate data for visualization
   */
  const formatReadRateData = useMemo(() => {
    if (!stats) return [];

    return [{
      value: stats.readRate,
      color: getReadRateColor(stats.readRate),
      label: 'Reads per Second'
    }];
  }, [stats]);

  /**
   * Determines signal strength indicator color
   */
  const getSignalStrengthColor = (strength: number): string => {
    if (strength >= SIGNAL_STRENGTH_THRESHOLDS.high) return '#4CAF50';
    if (strength >= SIGNAL_STRENGTH_THRESHOLDS.medium) return '#FFA000';
    return '#F44336';
  };

  /**
   * Determines read rate indicator color
   */
  const getReadRateColor = (rate: number): string => {
    if (rate >= READ_RATE_THRESHOLDS.critical) return '#F44336';
    if (rate >= READ_RATE_THRESHOLDS.warning) return '#FFA000';
    return '#4CAF50';
  };

  /**
   * Debounced stats update function
   */
  const updateStats = useCallback(
    debounce(async () => {
      try {
        const response = await getReaderStatus(readerId);
        setStats(response);
        setLastUpdate(new Date());
      } catch (err) {
        console.error('Failed to update reader stats:', err);
      } finally {
        setLoading(false);
      }
    }, 300),
    [readerId, getReaderStatus]
  );

  // Set up polling interval for real-time updates
  useEffect(() => {
    updateStats();
    const interval = setInterval(updateStats, UPDATE_INTERVAL);

    return () => {
      clearInterval(interval);
      updateStats.cancel();
    };
  }, [updateStats]);

  // Error state rendering
  if (error) {
    return (
      <div 
        role="alert" 
        className="reader-stats-error"
        aria-label="Reader Statistics Error"
      >
        <p>Error loading reader statistics: {error.message}</p>
      </div>
    );
  }

  // Loading state rendering
  if (loading) {
    return (
      <div 
        role="status" 
        className="reader-stats-loading"
        aria-label="Loading Reader Statistics"
      >
        <p>Loading statistics...</p>
      </div>
    );
  }

  return (
    <div 
      className={`reader-stats ${className}`}
      aria-label={ariaLabel}
    >
      {/* Header Section */}
      <div className="reader-stats-header">
        <h2>Reader Performance Metrics</h2>
        <span className="last-update">
          Last Updated: {lastUpdate.toLocaleTimeString()}
        </span>
      </div>

      {/* Signal Strength Chart */}
      <div className="stats-section">
        <h3>Signal Strength</h3>
        <Chart
          type="gauge"
          data={formatSignalStrengthData}
          options={{
            min: SIGNAL_STRENGTH_THRESHOLDS.low,
            max: SIGNAL_STRENGTH_THRESHOLDS.high,
            thresholds: Object.values(SIGNAL_STRENGTH_THRESHOLDS),
            animate: true
          }}
          accessibility={{
            ariaLabel: 'Signal Strength Gauge',
            announceDataChanges: true
          }}
        />
      </div>

      {/* Read Rate Chart */}
      <div className="stats-section">
        <h3>Read Rate</h3>
        <Chart
          type="line"
          data={formatReadRateData}
          options={{
            yAxis: { min: 0, max: 1000 },
            thresholds: Object.values(READ_RATE_THRESHOLDS),
            animate: true
          }}
          accessibility={{
            ariaLabel: 'Read Rate Chart',
            announceDataChanges: true
          }}
        />
      </div>

      {/* Performance Metrics */}
      <div className="stats-grid">
        <div className="stat-item">
          <label>Total Reads</label>
          <span>{stats?.totalReads.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <label>Success Rate</label>
          <span>{((stats?.successfulReads || 0) / (stats?.totalReads || 1) * 100).toFixed(1)}%</span>
        </div>
        <div className="stat-item">
          <label>Error Rate</label>
          <span>{(stats?.errorRate || 0).toFixed(2)}%</span>
        </div>
        <div className="stat-item">
          <label>Uptime</label>
          <span>{formatUptime(stats?.uptime || 0)}</span>
        </div>
      </div>

      {/* System Health */}
      <div className="system-health">
        <h3>System Health</h3>
        <div className="health-indicators">
          <div className="health-item">
            <label>Memory Usage</label>
            <div 
              className="progress-bar"
              role="progressbar"
              aria-valuenow={stats?.memoryUsage || 0}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div 
                className="progress"
                style={{ width: `${stats?.memoryUsage || 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Formats uptime duration into human-readable string
 */
const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
};

export default React.memo(ReaderStats);