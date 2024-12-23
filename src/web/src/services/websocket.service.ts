import { io, Socket } from 'socket.io-client'; // ^4.6.1
import { ApiResponse } from '../types/api.types';
import apiConfig from '../config/api.config';

/**
 * Enum for WebSocket event types
 */
export enum WEBSOCKET_EVENTS {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  DATA = 'data',
  ERROR = 'error',
  RECONNECT = 'reconnect',
  RECONNECT_ATTEMPT = 'reconnect_attempt',
  SUBSCRIPTION_TIMEOUT = 'subscription_timeout',
  SUBSCRIPTION_ERROR = 'subscription_error',
  MESSAGE_ERROR = 'message_error'
}

/**
 * Configuration for reconnection attempts
 */
const RECONNECTION_CONFIG = {
  INITIAL_DELAY: 1000,
  MAX_DELAY: 30000,
  MULTIPLIER: 1.5,
  MAX_ATTEMPTS: 5
} as const;

/**
 * Configuration for subscription management
 */
const SUBSCRIPTION_CONFIG = {
  TIMEOUT: 5000,
  MAX_RETRIES: 3,
  BATCH_SIZE: 10,
  BATCH_INTERVAL: 100
} as const;

/**
 * Interface for subscription retry configuration
 */
interface RetryConfig {
  attempts: number;
  timeout: NodeJS.Timeout | null;
  lastAttempt: number;
}

/**
 * Interface for subscription options
 */
interface SubscriptionOptions {
  timeout?: number;
  retries?: number;
  batchSize?: number;
}

/**
 * WebSocket service for managing real-time connections and data streaming
 * Implements singleton pattern with enhanced error handling and reconnection logic
 */
export class WebSocketService {
  private static instance: WebSocketService;
  private socket: Socket | null = null;
  private token: string = '';
  private subscriptionCallbacks: Map<string, Set<Function>> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private retryConfigs: Map<string, RetryConfig> = new Map();
  private pendingSubscriptions: Set<string> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    // Private constructor to enforce singleton pattern
    this.setupMemoryLeakPrevention();
  }

  /**
   * Gets the singleton instance of WebSocketService
   */
  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Initializes the WebSocket service with authentication and connection settings
   */
  public async initialize(token: string): Promise<void> {
    this.validateToken(token);
    this.token = token;
    await this.connect();
  }

  /**
   * Establishes WebSocket connection with comprehensive error handling
   */
  private async connect(): Promise<void> {
    try {
      this.socket = io(apiConfig.baseURL, {
        auth: { token: this.token },
        reconnection: false, // We'll handle reconnection manually
        timeout: apiConfig.connectionTimeout,
        transports: ['websocket'],
        secure: true
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      await this.handleReconnection();
    }
  }

  /**
   * Sets up WebSocket event listeners with error handling
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on(WEBSOCKET_EVENTS.CONNECT, () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.restoreSubscriptions();
    });

    this.socket.on(WEBSOCKET_EVENTS.DISCONNECT, () => {
      this.isConnected = false;
      this.handleReconnection();
    });

    this.socket.on(WEBSOCKET_EVENTS.ERROR, (error: Error) => {
      console.error('WebSocket error:', error);
      this.handleError(error);
    });

    // Handle incoming data with type safety
    this.socket.on(WEBSOCKET_EVENTS.DATA, (response: ApiResponse<unknown>) => {
      this.handleIncomingData(response);
    });
  }

  /**
   * Subscribes to real-time widget updates with enhanced reliability
   */
  public async subscribeToWidget(
    widgetId: string,
    callback: Function,
    options: SubscriptionOptions = {}
  ): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('WebSocket not connected');
    }

    const callbacks = this.subscriptionCallbacks.get(widgetId) || new Set();
    callbacks.add(callback);
    this.subscriptionCallbacks.set(widgetId, callbacks);

    const retryConfig: RetryConfig = {
      attempts: 0,
      timeout: null,
      lastAttempt: Date.now()
    };
    this.retryConfigs.set(widgetId, retryConfig);

    try {
      await this.sendSubscription(widgetId, options);
    } catch (error) {
      console.error(`Subscription error for widget ${widgetId}:`, error);
      await this.handleSubscriptionError(widgetId, error);
    }
  }

  /**
   * Unsubscribes from widget updates
   */
  public async unsubscribeFromWidget(widgetId: string, callback?: Function): Promise<void> {
    if (!this.socket) return;

    const callbacks = this.subscriptionCallbacks.get(widgetId);
    if (callbacks) {
      if (callback) {
        callbacks.delete(callback);
      } else {
        callbacks.clear();
      }

      if (callbacks.size === 0) {
        this.subscriptionCallbacks.delete(widgetId);
        this.socket.emit(WEBSOCKET_EVENTS.UNSUBSCRIBE, { widgetId });
      }
    }
  }

  /**
   * Handles reconnection with exponential backoff
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= RECONNECTION_CONFIG.MAX_ATTEMPTS) {
      this.handleFatalError(new Error('Max reconnection attempts reached'));
      return;
    }

    const delay = Math.min(
      RECONNECTION_CONFIG.INITIAL_DELAY * Math.pow(RECONNECTION_CONFIG.MULTIPLIER, this.reconnectAttempts),
      RECONNECTION_CONFIG.MAX_DELAY
    );

    this.reconnectAttempts++;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Reconnection failed:', error);
        await this.handleReconnection();
      }
    }, delay);
  }

  /**
   * Restores subscriptions after reconnection
   */
  private async restoreSubscriptions(): Promise<void> {
    for (const [widgetId] of this.subscriptionCallbacks) {
      try {
        await this.sendSubscription(widgetId);
      } catch (error) {
        console.error(`Failed to restore subscription for widget ${widgetId}:`, error);
      }
    }
  }

  /**
   * Handles incoming data and distributes to subscribers
   */
  private handleIncomingData(response: ApiResponse<unknown>): void {
    const { data, error } = response;
    if (error) {
      this.handleError(new Error(error.message));
      return;
    }

    // Distribute data to relevant subscribers
    for (const [widgetId, callbacks] of this.subscriptionCallbacks) {
      if (this.isRelevantData(data, widgetId)) {
        callbacks.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Callback error for widget ${widgetId}:`, error);
          }
        });
      }
    }
  }

  /**
   * Cleans up resources and prevents memory leaks
   */
  private setupMemoryLeakPrevention(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.disconnect();
      });
    }
  }

  /**
   * Disconnects the WebSocket connection and cleans up resources
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.subscriptionCallbacks.clear();
    this.retryConfigs.clear();
    this.pendingSubscriptions.clear();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
  }

  // Private helper methods
  private validateToken(token: string): void {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid authentication token');
    }
  }

  private async sendSubscription(
    widgetId: string,
    options: SubscriptionOptions = {}
  ): Promise<void> {
    if (!this.socket) return;

    const timeout = options.timeout || SUBSCRIPTION_CONFIG.TIMEOUT;
    const retries = options.retries || SUBSCRIPTION_CONFIG.MAX_RETRIES;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Subscription timeout for widget ${widgetId}`));
      }, timeout);

      this.socket!.emit(WEBSOCKET_EVENTS.SUBSCRIBE, { widgetId }, (response: any) => {
        clearTimeout(timeoutId);
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve();
        }
      });
    });
  }

  private isRelevantData(data: unknown, widgetId: string): boolean {
    // Implement relevancy check based on your data structure
    return true; // Placeholder implementation
  }

  private handleError(error: Error): void {
    console.error('WebSocket error:', error);
    // Implement error reporting logic
  }

  private handleFatalError(error: Error): void {
    console.error('Fatal WebSocket error:', error);
    this.disconnect();
    // Implement fatal error handling logic
  }

  private async handleSubscriptionError(widgetId: string, error: Error): Promise<void> {
    const retryConfig = this.retryConfigs.get(widgetId);
    if (retryConfig && retryConfig.attempts < SUBSCRIPTION_CONFIG.MAX_RETRIES) {
      retryConfig.attempts++;
      retryConfig.lastAttempt = Date.now();
      await this.sendSubscription(widgetId);
    } else {
      this.handleError(error);
    }
  }
}

export default WebSocketService.getInstance();