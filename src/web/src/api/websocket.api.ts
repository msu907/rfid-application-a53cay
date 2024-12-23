/**
 * WebSocket client API implementation for real-time data streaming and connection management
 * @version 1.0.0
 * Dependencies:
 * - socket.io-client: ^4.6.1
 */

import { io, Socket } from 'socket.io-client'; // ^4.6.1
import { ApiResponse } from '../types/api.types';

// Connection configuration constants
const RECONNECTION_DELAY = 1000;
const MAX_RECONNECTION_ATTEMPTS = 5;
const SUBSCRIPTION_TIMEOUT = 5000;

// WebSocket event types
const WEBSOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  DATA: 'data',
  ERROR: 'error',
  RECONNECT_ATTEMPT: 'reconnect_attempt',
  RECONNECT_FAILED: 'reconnect_failed',
} as const;

// Type definitions for enhanced type safety
type WidgetCallback<T> = (data: T) => void;
type MessageBuffer = { timestamp: number; data: unknown };

interface ConnectionOptions {
  url?: string;
  enableBatching?: boolean;
  batchInterval?: number;
  transportOptions?: {
    polling: boolean;
    websocket: boolean;
  };
}

interface SubscriptionOptions {
  batchSize?: number;
  debounceTime?: number;
  retryOnError?: boolean;
}

/**
 * Enhanced WebSocket client for managing real-time connections with improved performance
 * and error handling capabilities.
 */
export class WebSocketClient {
  private socket: Socket | null = null;
  private readonly token: string;
  private readonly subscriptionCallbacks: Map<string, Set<WidgetCallback<unknown>>>;
  private isConnected: boolean = false;
  private reconnectionAttempts: number = 0;
  private readonly messageBuffer: Map<string, MessageBuffer[]>;
  private readonly options: Required<ConnectionOptions>;

  /**
   * Initialize WebSocket client with enhanced configuration
   * @param token - Authentication token
   * @param options - Connection configuration options
   */
  constructor(
    token: string,
    options: ConnectionOptions = {}
  ) {
    this.token = token;
    this.subscriptionCallbacks = new Map();
    this.messageBuffer = new Map();
    
    // Default options with performance optimizations
    this.options = {
      url: options.url || window.location.origin,
      enableBatching: options.enableBatching ?? true,
      batchInterval: options.batchInterval ?? 100,
      transportOptions: {
        polling: options.transportOptions?.polling ?? true,
        websocket: options.transportOptions?.websocket ?? true,
      },
    };
  }

  /**
   * Establishes WebSocket connection with enhanced error handling and reconnection strategy
   * @throws Error if connection fails after maximum attempts
   */
  public async connect(): Promise<void> {
    try {
      this.socket = io(this.options.url, {
        auth: { token: this.token },
        reconnection: true,
        reconnectionDelay: RECONNECTION_DELAY,
        reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
        transports: this.getTransports(),
      });

      this.setupEventHandlers();
      
      await this.waitForConnection();
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      throw new Error('Failed to establish WebSocket connection');
    }
  }

  /**
   * Subscribes to widget updates with improved type safety and error handling
   * @param widgetId - Unique identifier for the widget
   * @param callback - Callback function for handling widget updates
   * @param options - Subscription configuration options
   */
  public async subscribeToWidget<T>(
    widgetId: string,
    callback: WidgetCallback<T>,
    options: SubscriptionOptions = {}
  ): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    try {
      // Initialize callback set if not exists
      if (!this.subscriptionCallbacks.has(widgetId)) {
        this.subscriptionCallbacks.set(widgetId, new Set());
        this.messageBuffer.set(widgetId, []);
      }

      // Add callback to subscription set
      this.subscriptionCallbacks.get(widgetId)!.add(callback as WidgetCallback<unknown>);

      // Send subscription request
      await this.sendSubscriptionRequest(widgetId, options);

      // Set up message batching if enabled
      if (this.options.enableBatching) {
        this.initializeMessageBatching(widgetId, options.batchSize);
      }
    } catch (error) {
      console.error(`Failed to subscribe to widget ${widgetId}:`, error);
      throw new Error(`Subscription failed for widget ${widgetId}`);
    }
  }

  /**
   * Unsubscribes from widget updates
   * @param widgetId - Widget identifier
   * @param callback - Optional specific callback to remove
   */
  public async unsubscribeFromWidget(
    widgetId: string,
    callback?: WidgetCallback<unknown>
  ): Promise<void> {
    const callbacks = this.subscriptionCallbacks.get(widgetId);
    if (!callbacks) return;

    if (callback) {
      callbacks.delete(callback);
    } else {
      callbacks.clear();
    }

    if (callbacks.size === 0) {
      this.subscriptionCallbacks.delete(widgetId);
      this.messageBuffer.delete(widgetId);
      await this.sendUnsubscriptionRequest(widgetId);
    }
  }

  /**
   * Handles reconnection attempts with exponential backoff
   * @private
   */
  private async handleReconnection(): Promise<void> {
    this.reconnectionAttempts++;
    
    const backoffDelay = Math.min(
      RECONNECTION_DELAY * Math.pow(2, this.reconnectionAttempts - 1),
      5000
    );

    await new Promise(resolve => setTimeout(resolve, backoffDelay));

    try {
      await this.connect();
      this.reconnectionAttempts = 0;
      await this.restoreSubscriptions();
    } catch (error) {
      if (this.reconnectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
        this.emitError('Maximum reconnection attempts reached');
        throw new Error('WebSocket reconnection failed');
      }
      await this.handleReconnection();
    }
  }

  /**
   * Processes batched messages for improved performance
   * @private
   */
  private processMessageBatch(widgetId: string): void {
    const buffer = this.messageBuffer.get(widgetId);
    if (!buffer || buffer.length === 0) return;

    const callbacks = this.subscriptionCallbacks.get(widgetId);
    if (!callbacks) return;

    // Process and optimize batch
    const optimizedBatch = this.optimizeBatch(buffer);

    // Notify subscribers
    callbacks.forEach(callback => {
      try {
        callback(optimizedBatch);
      } catch (error) {
        console.error(`Error in widget callback for ${widgetId}:`, error);
      }
    });

    // Clear processed messages
    this.messageBuffer.set(widgetId, []);
  }

  /**
   * Sets up WebSocket event handlers
   * @private
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on(WEBSOCKET_EVENTS.CONNECT, () => {
      this.isConnected = true;
      this.reconnectionAttempts = 0;
    });

    this.socket.on(WEBSOCKET_EVENTS.DISCONNECT, () => {
      this.isConnected = false;
      this.handleReconnection().catch(console.error);
    });

    this.socket.on(WEBSOCKET_EVENTS.DATA, (response: ApiResponse<unknown>) => {
      this.handleDataMessage(response);
    });

    this.socket.on(WEBSOCKET_EVENTS.ERROR, (error: Error) => {
      this.emitError(error.message);
    });
  }

  // Helper methods
  private getTransports(): string[] {
    const transports: string[] = [];
    if (this.options.transportOptions.websocket) transports.push('websocket');
    if (this.options.transportOptions.polling) transports.push('polling');
    return transports;
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, SUBSCRIPTION_TIMEOUT);

      this.socket?.once(WEBSOCKET_EVENTS.CONNECT, () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private async sendSubscriptionRequest(
    widgetId: string,
    options: SubscriptionOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Subscription timeout'));
      }, SUBSCRIPTION_TIMEOUT);

      this.socket?.emit(WEBSOCKET_EVENTS.SUBSCRIBE, { widgetId, options }, () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private async sendUnsubscriptionRequest(widgetId: string): Promise<void> {
    this.socket?.emit(WEBSOCKET_EVENTS.UNSUBSCRIBE, { widgetId });
  }

  private handleDataMessage(response: ApiResponse<unknown>): void {
    const { data } = response;
    // Implementation of data message handling with batching
  }

  private optimizeBatch(buffer: MessageBuffer[]): unknown {
    // Implement batch optimization logic
    return buffer.map(item => item.data);
  }

  private emitError(message: string): void {
    console.error('WebSocket error:', message);
    // Implement error handling and notification
  }

  private async restoreSubscriptions(): Promise<void> {
    const subscriptions = Array.from(this.subscriptionCallbacks.keys());
    await Promise.all(
      subscriptions.map(widgetId => 
        this.sendSubscriptionRequest(widgetId, {})
      )
    );
  }

  private initializeMessageBatching(widgetId: string, batchSize = 10): void {
    setInterval(() => {
      const buffer = this.messageBuffer.get(widgetId);
      if (buffer && buffer.length >= batchSize) {
        this.processMessageBatch(widgetId);
      }
    }, this.options.batchInterval);
  }
}