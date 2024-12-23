import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns'; // version 2.29.0
import { debounce } from 'lodash'; // version 4.17.21
import Card, { CardProps } from '../common/Card';
import { useAsset } from '../../hooks/useAsset';
import useWebSocket from '../../hooks/useWebSocket';
import ErrorBoundary from '../common/ErrorBoundary';

/**
 * Interface for RecentActivities component props
 */
interface RecentActivitiesProps {
  maxItems?: number;
  className?: string;
  updateInterval?: number;
}

/**
 * Interface for activity items with enhanced details
 */
interface Activity {
  id: string;
  type: 'MOVEMENT' | 'STATUS_CHANGE' | 'NEW_ASSET' | 'ERROR';
  assetId: string;
  timestamp: Date;
  details: ActivityDetails;
  status: 'pending' | 'success' | 'error';
}

/**
 * Interface for activity-specific details
 */
interface ActivityDetails {
  fromLocation?: string;
  toLocation?: string;
  oldStatus?: string;
  newStatus?: string;
  message?: string;
  errorCode?: string;
}

/**
 * Enhanced RecentActivities component for displaying real-time asset activities
 */
const RecentActivities: React.FC<RecentActivitiesProps> = ({
  maxItems = 5,
  className = '',
  updateInterval = 1000
}) => {
  // State management
  const [activities, setActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const activitiesRef = useRef<Activity[]>([]);

  // Custom hooks
  const { assets, loadingStates } = useAsset();
  const { 
    isConnected: wsConnected,
    data: wsData,
    error: wsError,
    connectionHealth
  } = useWebSocket('asset-activities', {
    autoConnect: true,
    enableCompression: true,
    heartbeatInterval: 30000
  });

  /**
   * Formats activity message with enhanced details
   */
  const formatActivityMessage = useCallback((activity: Activity): string => {
    const assetName = assets[activity.assetId]?.name || 'Unknown Asset';
    const timestamp = format(activity.timestamp, 'HH:mm:ss');

    switch (activity.type) {
      case 'MOVEMENT':
        return `${assetName} moved from ${activity.details.fromLocation} to ${activity.details.toLocation}`;
      case 'STATUS_CHANGE':
        return `${assetName} status changed from ${activity.details.oldStatus} to ${activity.details.newStatus}`;
      case 'NEW_ASSET':
        return `New asset ${assetName} registered at ${activity.details.toLocation}`;
      case 'ERROR':
        return `Error with ${assetName}: ${activity.details.message} (${activity.details.errorCode})`;
      default:
        return `Unknown activity for ${assetName}`;
    }
  }, [assets]);

  /**
   * Handles incoming WebSocket messages with error handling
   */
  const handleWebSocketMessage = useCallback((message: any) => {
    try {
      const newActivity: Activity = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: message.type,
        assetId: message.assetId,
        timestamp: new Date(message.timestamp),
        details: message.details,
        status: 'success'
      };

      setActivities(prev => {
        const updated = [newActivity, ...prev].slice(0, maxItems);
        activitiesRef.current = updated;
        return updated;
      });

      // Announce new activity for screen readers
      const announcement = formatActivityMessage(newActivity);
      const ariaLive = document.getElementById('activities-live-region');
      if (ariaLive) {
        ariaLive.textContent = announcement;
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      setError(error instanceof Error ? error : new Error('Failed to process message'));
    }
  }, [maxItems, formatActivityMessage]);

  // Debounced update handler for performance
  const debouncedUpdateHandler = useCallback(
    debounce(handleWebSocketMessage, 300, { maxWait: 1000 }),
    [handleWebSocketMessage]
  );

  // Effect for WebSocket data handling
  useEffect(() => {
    if (wsData) {
      debouncedUpdateHandler(wsData);
    }
  }, [wsData, debouncedUpdateHandler]);

  // Effect for error handling
  useEffect(() => {
    if (wsError) {
      setError(new Error(wsError.message));
    }
  }, [wsError]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      debouncedUpdateHandler.cancel();
    };
  }, [debouncedUpdateHandler]);

  /**
   * Renders activity list with enhanced accessibility
   */
  const renderActivities = () => {
    if (activities.length === 0) {
      return (
        <div className="activities-empty-state" role="status">
          <p>No recent activities</p>
        </div>
      );
    }

    return (
      <ul className="activities-list" role="log" aria-live="polite">
        {activities.map((activity) => (
          <li
            key={activity.id}
            className={`activity-item activity-${activity.type.toLowerCase()}`}
            data-status={activity.status}
          >
            <span className="activity-time">
              {format(activity.timestamp, 'HH:mm:ss')}
            </span>
            <span className="activity-message">
              {formatActivityMessage(activity)}
            </span>
            {activity.status === 'error' && (
              <span className="activity-error" role="alert">
                {activity.details.errorCode}
              </span>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <ErrorBoundary>
      <Card
        className={`recent-activities ${className}`}
        elevation="low"
        testId="recent-activities"
        isLoading={loadingStates.fetchAll}
        error={error}
      >
        <div className="activities-header">
          <h2>Recent Activities</h2>
          <div className="connection-status" aria-live="polite">
            {wsConnected ? (
              <span className="status-connected">Connected</span>
            ) : (
              <span className="status-disconnected">Disconnected</span>
            )}
          </div>
        </div>

        <div 
          id="activities-live-region" 
          className="sr-only" 
          aria-live="polite" 
          aria-atomic="true"
        />

        {renderActivities()}

        {connectionHealth.latency > 1000 && (
          <div className="connection-warning" role="alert">
            High latency detected ({connectionHealth.latency}ms)
          </div>
        )}
      </Card>
    </ErrorBoundary>
  );
};

export default React.memo(RecentActivities);

// Type exports
export type { RecentActivitiesProps, Activity };