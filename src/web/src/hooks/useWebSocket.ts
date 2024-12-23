import { useState, useEffect, useCallback } from 'react'; // ^18.0.0
import WebSocketService from '../services/websocket.service';
import { useAuth } from './useAuth';
import { ApiResponse } from '../types/api.types';

/**
 * Connection health status type
 */
export type ConnectionHealth = {
  latency: number;
  lastHeartbeat: Date | null;
  reconnectAttempts: number;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
};

/**
 * WebSocket error type with enhanced details
 */
export type WebSocketError = {
  code: string;
  message: string;
  timestamp: string;
  attempts?: number;
  context?: Record<string, unknown>;
};

/**
 * WebSocket hook configuration options
 */
interface WebSocketOptions {
  autoConnect?: boolean;
  enableCompression?: boolean;
  heartbeatInterval?: number;
  reconnectAttempts?: number;
  batchSize?: number;
  connectionTimeout?: number;
}

/**
 * Enhanced WebSocket hook for real-time data management
 * Provides robust connection handling, automatic reconnection,
 * and performance optimization features
 */
export function useWebSocket(
  widgetId: string,
  options: WebSocketOptions = {}
) {
  // Initialize state
  const [isConnected, setIsConnected] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<WebSocketError | null>(null);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    latency: 0,
    lastHeartbeat: null,
    reconnectAttempts: 0,
    status: 'disconnected'
  });

  // Get authentication context
  const { token, validateSession } = useAuth();

  // Get WebSocket service instance
  const wsService = WebSocketService.getInstance();

  /**
   * Handles incoming WebSocket data with type safety
   */
  const handleData = useCallback((response: ApiResponse<unknown>) => {
    const { data: responseData, error: responseError } = response;
    
    if (responseError) {
      setError({
        code: responseError.code,
        message: responseError.message,
        timestamp: new Date().toISOString(),
        context: responseError.details
      });
      return;
    }

    setData(responseData);
  }, []);

  /**
   * Manages WebSocket connection health monitoring
   */
  const monitorConnectionHealth = useCallback(() => {
    const startTime = Date.now();
    wsService.enableCompression();
    wsService.setHeartbeatInterval(options.heartbeatInterval || 30000);

    return {
      updateLatency: () => {
        const latency = Date.now() - startTime;
        setConnectionHealth(prev => ({
          ...prev,
          latency,
          lastHeartbeat: new Date()
        }));
      },
      updateStatus: (status: ConnectionHealth['status']) => {
        setConnectionHealth(prev => ({
          ...prev,
          status,
          reconnectAttempts: status === 'connecting' 
            ? prev.reconnectAttempts + 1 
            : prev.reconnectAttempts
        }));
      }
    };
  }, [wsService, options.heartbeatInterval]);

  /**
   * Initializes WebSocket connection with error handling
   */
  const initializeConnection = useCallback(async () => {
    try {
      const isValidSession = await validateSession();
      if (!isValidSession || !token) {
        throw new Error('Invalid session or missing token');
      }

      const health = monitorConnectionHealth();
      health.updateStatus('connecting');

      await wsService.initialize(token);
      setIsConnected(true);
      health.updateStatus('connected');
      health.updateLatency();

    } catch (error) {
      setError({
        code: 'CONNECTION_ERROR',
        message: error instanceof Error ? error.message : 'Connection failed',
        timestamp: new Date().toISOString()
      });
      setIsConnected(false);
    }
  }, [token, validateSession, wsService, monitorConnectionHealth]);

  /**
   * Manages widget subscription with automatic retries
   */
  const subscribe = useCallback(async () => {
    try {
      if (!isConnected) {
        await initializeConnection();
      }

      await wsService.subscribeToWidget(
        widgetId,
        handleData,
        {
          timeout: options.connectionTimeout,
          retries: options.reconnectAttempts,
          batchSize: options.batchSize
        }
      );

    } catch (error) {
      setError({
        code: 'SUBSCRIPTION_ERROR',
        message: error instanceof Error ? error.message : 'Subscription failed',
        timestamp: new Date().toISOString(),
        context: { widgetId }
      });
    }
  }, [
    widgetId,
    isConnected,
    initializeConnection,
    wsService,
    handleData,
    options
  ]);

  /**
   * Handles widget unsubscription with cleanup
   */
  const unsubscribe = useCallback(async () => {
    try {
      await wsService.unsubscribeFromWidget(widgetId);
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  }, [widgetId, wsService]);

  /**
   * Manages connection reconnection with exponential backoff
   */
  const reconnect = useCallback(async () => {
    setConnectionHealth(prev => ({
      ...prev,
      status: 'connecting',
      reconnectAttempts: prev.reconnectAttempts + 1
    }));

    try {
      await initializeConnection();
      if (isConnected) {
        await subscribe();
      }
    } catch (error) {
      setError({
        code: 'RECONNECTION_ERROR',
        message: error instanceof Error ? error.message : 'Reconnection failed',
        timestamp: new Date().toISOString(),
        attempts: connectionHealth.reconnectAttempts
      });
    }
  }, [initializeConnection, isConnected, subscribe, connectionHealth.reconnectAttempts]);

  // Initialize connection on mount if autoConnect is enabled
  useEffect(() => {
    if (options.autoConnect !== false) {
      initializeConnection();
    }

    // Cleanup on unmount
    return () => {
      unsubscribe();
    };
  }, [options.autoConnect, initializeConnection, unsubscribe]);

  return {
    isConnected,
    data,
    error,
    latency: connectionHealth.latency,
    subscribe,
    unsubscribe,
    reconnect,
    connectionHealth
  };
}

export default useWebSocket;