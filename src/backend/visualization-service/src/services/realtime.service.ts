import { injectable } from 'inversify'; // v6.0.1
import { Subject, Observable, BehaviorSubject, ReplaySubject } from 'rxjs'; // v7.8.1
import { 
  debounceTime, 
  filter, 
  catchError, 
  retry, 
  bufferTime, 
  throttleTime 
} from 'rxjs/operators'; // v7.8.1

import { 
  DashboardConfig, 
  WidgetType, 
  ValidationStatus 
} from '../models/dashboard.model';
import { transformDashboardData } from '../utils/data-transformer';

/**
 * Priority levels for update processing
 */
export enum UpdatePriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

/**
 * Health status interface for monitoring
 */
export interface HealthStatus {
  healthy: boolean;
  memoryUsage: number;
  activeStreams: number;
  errorRate: number;
  lastUpdate: Date;
  metrics: {
    processedUpdates: number;
    averageLatency: number;
    backpressureEvents: number;
  };
}

/**
 * Service responsible for managing real-time data streams for dashboard visualization
 * with advanced features including backpressure handling and memory management
 */
@injectable()
export class RealTimeService {
  private readonly widgetStreams: Map<string, Subject<any>> = new Map();
  private readonly widgetSubscriptions: Map<string, Set<string>> = new Map();
  private readonly streamBufferSizes: Map<string, number> = new Map();
  private readonly lastActivityTimestamp: Map<string, Date> = new Map();
  private readonly healthStatus: BehaviorSubject<HealthStatus>;

  // Configuration constants
  private readonly MAX_BUFFER_SIZE = 1000;
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private readonly INACTIVITY_THRESHOLD = 1800000; // 30 minutes

  constructor() {
    // Initialize health monitoring
    this.healthStatus = new BehaviorSubject<HealthStatus>({
      healthy: true,
      memoryUsage: 0,
      activeStreams: 0,
      errorRate: 0,
      lastUpdate: new Date(),
      metrics: {
        processedUpdates: 0,
        averageLatency: 0,
        backpressureEvents: 0
      }
    });

    // Set up periodic cleanup
    setInterval(() => this.cleanupInactiveStreams(), this.CLEANUP_INTERVAL);
  }

  /**
   * Subscribes a client to a specific widget's data stream with advanced error handling
   * and backpressure management
   */
  public subscribeToWidget(
    clientId: string,
    widgetId: string,
    widgetType: WidgetType,
    options: { bufferSize?: number; debounceMs?: number } = {}
  ): Observable<any> {
    // Create or get widget stream
    if (!this.widgetStreams.has(widgetId)) {
      const subject = new ReplaySubject(
        options.bufferSize || Math.min(100, this.MAX_BUFFER_SIZE)
      );
      this.widgetStreams.set(widgetId, subject);
      this.streamBufferSizes.set(widgetId, 0);
    }

    // Track subscription
    if (!this.widgetSubscriptions.has(widgetId)) {
      this.widgetSubscriptions.set(widgetId, new Set());
    }
    this.widgetSubscriptions.get(widgetId)!.add(clientId);
    this.lastActivityTimestamp.set(`${widgetId}-${clientId}`, new Date());

    // Get stream with error handling and backpressure management
    const stream = this.widgetStreams.get(widgetId)!.pipe(
      debounceTime(options.debounceMs || 500),
      throttleTime(100), // Prevent overwhelming clients
      bufferTime(200, undefined, 50), // Buffer updates
      filter(updates => updates.length > 0),
      retry({
        count: 3,
        delay: 1000
      }),
      catchError(error => {
        console.error(`Stream error for widget ${widgetId}:`, error);
        this.updateHealthStatus({
          errorRate: this.healthStatus.value.errorRate + 1
        });
        throw error;
      })
    );

    // Update health metrics
    this.updateHealthStatus({
      activeStreams: this.calculateActiveStreams()
    });

    return stream;
  }

  /**
   * Unsubscribes a client from a widget's data stream and performs cleanup
   */
  public unsubscribeFromWidget(clientId: string, widgetId: string): void {
    const subscribers = this.widgetSubscriptions.get(widgetId);
    if (subscribers) {
      subscribers.delete(clientId);
      this.lastActivityTimestamp.delete(`${widgetId}-${clientId}`);

      // Cleanup if no subscribers left
      if (subscribers.size === 0) {
        this.widgetStreams.get(widgetId)?.complete();
        this.widgetStreams.delete(widgetId);
        this.widgetSubscriptions.delete(widgetId);
        this.streamBufferSizes.delete(widgetId);
      }

      // Update health metrics
      this.updateHealthStatus({
        activeStreams: this.calculateActiveStreams()
      });
    }
  }

  /**
   * Pushes new data updates to subscribed widget streams with backpressure handling
   */
  public async pushUpdate(
    widgetId: string,
    data: any,
    priority: UpdatePriority = UpdatePriority.MEDIUM
  ): Promise<void> {
    const stream = this.widgetStreams.get(widgetId);
    if (!stream) return;

    try {
      // Check buffer size for backpressure
      const currentSize = this.streamBufferSizes.get(widgetId) || 0;
      if (currentSize >= this.MAX_BUFFER_SIZE) {
        if (priority === UpdatePriority.LOW) {
          return; // Drop low priority updates under backpressure
        }
        this.updateHealthStatus({
          metrics: {
            ...this.healthStatus.value.metrics,
            backpressureEvents: this.healthStatus.value.metrics.backpressureEvents + 1
          }
        });
      }

      // Transform data for visualization
      const transformedData = await transformDashboardData(data, {
        widgetId,
        widgetType: WidgetType.ASSET_MAP,
        settings: {},
        enableCaching: true,
        cacheDuration: 5000
      });

      // Push update to stream
      const startTime = Date.now();
      stream.next(transformedData);
      
      // Update metrics
      this.streamBufferSizes.set(widgetId, currentSize + 1);
      this.updateHealthStatus({
        lastUpdate: new Date(),
        metrics: {
          ...this.healthStatus.value.metrics,
          processedUpdates: this.healthStatus.value.metrics.processedUpdates + 1,
          averageLatency: this.calculateAverageLatency(Date.now() - startTime)
        }
      });
    } catch (error) {
      console.error(`Error pushing update to widget ${widgetId}:`, error);
      this.updateHealthStatus({
        errorRate: this.healthStatus.value.errorRate + 1
      });
    }
  }

  /**
   * Monitors service health and performance metrics
   */
  public monitorHealth(): Observable<HealthStatus> {
    return this.healthStatus.asObservable();
  }

  /**
   * Cleans up inactive streams to prevent memory leaks
   */
  private cleanupInactiveStreams(): void {
    const now = new Date().getTime();
    for (const [key, timestamp] of this.lastActivityTimestamp.entries()) {
      if (now - timestamp.getTime() > this.INACTIVITY_THRESHOLD) {
        const [widgetId, clientId] = key.split('-');
        this.unsubscribeFromWidget(clientId, widgetId);
      }
    }
  }

  /**
   * Updates health status with new metrics
   */
  private updateHealthStatus(update: Partial<HealthStatus>): void {
    this.healthStatus.next({
      ...this.healthStatus.value,
      ...update,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
    });
  }

  /**
   * Calculates the current number of active streams
   */
  private calculateActiveStreams(): number {
    return Array.from(this.widgetSubscriptions.values())
      .reduce((total, subscribers) => total + subscribers.size, 0);
  }

  /**
   * Calculates average latency with exponential moving average
   */
  private calculateAverageLatency(newLatency: number): number {
    const alpha = 0.2; // Smoothing factor
    const currentAvg = this.healthStatus.value.metrics.averageLatency;
    return currentAvg * (1 - alpha) + newLatency * alpha;
  }
}