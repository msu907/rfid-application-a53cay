import { injectable, inject } from 'inversify'; // v6.0.1
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  UseGuards,
  HttpException,
  HttpStatus
} from '@nestjs/common'; // v10.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity 
} from '@nestjs/swagger'; // v7.0.0
import { RateLimit } from '@nestjs/throttler'; // v5.0.0

import { 
  DashboardConfig, 
  WidgetType, 
  ValidationStatus,
  type VisualizationData 
} from '../models/dashboard.model';
import { RealTimeService, UpdatePriority } from '../services/realtime.service';
import { transformDashboardData, type TransformationOptions } from '../utils/data-transformer';

/**
 * Enhanced controller for managing visualization endpoints with optimized real-time data distribution
 * and performance monitoring capabilities.
 */
@injectable()
@Controller('visualization')
@ApiTags('Visualization')
@ApiSecurity('bearer')
@UseGuards(AuthGuard, RateLimitGuard)
export class VisualizationController {
  private readonly CACHE_DURATION = 5000; // 5 seconds
  private readonly DEFAULT_BATCH_SIZE = 50;

  constructor(
    @inject(RealTimeService) private readonly realTimeService: RealTimeService,
    @inject(WebSocketService) private readonly webSocketService: WebSocketService,
    @inject(MetricsService) private readonly metricsService: MetricsService
  ) {
    this.initializeMetrics();
  }

  /**
   * Retrieves optimized dashboard configuration with caching
   */
  @Get('dashboard/:userId')
  @ApiOperation({ summary: 'Get dashboard configuration' })
  @ApiResponse({ 
    status: 200, 
    type: DashboardConfig,
    description: 'Dashboard configuration retrieved successfully'
  })
  @RateLimit({ limit: 100, ttl: 60000 })
  async getDashboardConfig(
    @Param('userId') userId: string
  ): Promise<DashboardConfig> {
    try {
      // Validate user access
      await this.validateUserAccess(userId);

      // Get dashboard configuration with performance monitoring
      const startTime = Date.now();
      const config = await this.dashboardService.getConfig(userId);

      // Track metrics
      this.metricsService.recordLatency('getDashboardConfig', Date.now() - startTime);
      this.metricsService.incrementCounter('dashboardConfigRequests');

      return config;
    } catch (error) {
      this.metricsService.incrementCounter('dashboardConfigErrors');
      throw new HttpException(
        'Failed to retrieve dashboard configuration',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Pushes real-time visualization updates with enhanced performance monitoring
   */
  @Post('update/:widgetId')
  @ApiOperation({ summary: 'Push visualization update' })
  @ApiResponse({ 
    status: 200,
    description: 'Update processed successfully'
  })
  @RateLimit({ limit: 1000, ttl: 60000 })
  async pushVisualizationUpdate(
    @Param('widgetId') widgetId: string,
    @Body() data: any
  ): Promise<void> {
    try {
      const startTime = Date.now();

      // Transform data for visualization
      const transformOptions: TransformationOptions = {
        widgetId,
        widgetType: WidgetType.ASSET_MAP,
        settings: {},
        enableCaching: true,
        cacheDuration: this.CACHE_DURATION,
        performanceSettings: {
          enableMetrics: true,
          samplingRate: 0.1,
          timeoutMs: 5000,
          batchSize: this.DEFAULT_BATCH_SIZE
        }
      };

      const transformedData = await transformDashboardData(data, transformOptions);

      // Push update with priority based on data type
      await this.realTimeService.pushUpdate(
        widgetId,
        transformedData,
        this.determineUpdatePriority(transformedData)
      );

      // Broadcast via WebSocket
      await this.webSocketService.broadcast(widgetId, transformedData);

      // Track metrics
      this.metricsService.recordLatency('pushUpdate', Date.now() - startTime);
      this.metricsService.incrementCounter('updatesProcessed');

      if (transformedData.validationStatus === ValidationStatus.INVALID) {
        this.metricsService.incrementCounter('invalidUpdates');
      }
    } catch (error) {
      this.metricsService.incrementCounter('updateErrors');
      throw new HttpException(
        'Failed to process visualization update',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Retrieves visualization performance metrics
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Get performance metrics' })
  @ApiResponse({ 
    status: 200,
    description: 'Performance metrics retrieved successfully'
  })
  async getPerformanceMetrics(): Promise<any> {
    try {
      const realTimeMetrics = await this.realTimeService.monitorHealth().toPromise();
      const wsMetrics = this.webSocketService.getMetrics();
      
      return {
        realTime: {
          activeStreams: realTimeMetrics.activeStreams,
          averageLatency: realTimeMetrics.metrics.averageLatency,
          errorRate: realTimeMetrics.errorRate,
          backpressureEvents: realTimeMetrics.metrics.backpressureEvents
        },
        webSocket: {
          activeConnections: wsMetrics.activeConnections,
          messageRate: wsMetrics.messageRate,
          errorRate: wsMetrics.errorRate
        },
        system: {
          memoryUsage: realTimeMetrics.memoryUsage,
          cpuUsage: await this.metricsService.getCPUUsage(),
          lastUpdate: realTimeMetrics.lastUpdate
        }
      };
    } catch (error) {
      this.metricsService.incrementCounter('metricsErrors');
      throw new HttpException(
        'Failed to retrieve performance metrics',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Initializes performance monitoring metrics
   */
  private initializeMetrics(): void {
    this.metricsService.registerGauge('activeStreams', 'Number of active data streams');
    this.metricsService.registerHistogram('updateLatency', 'Update processing latency');
    this.metricsService.registerCounter('updatesProcessed', 'Total updates processed');
    this.metricsService.registerCounter('updateErrors', 'Total update errors');
  }

  /**
   * Determines update priority based on data characteristics
   */
  private determineUpdatePriority(data: VisualizationData): UpdatePriority {
    if (data.type === 'ALERT_NOTIFICATION') {
      return UpdatePriority.HIGH;
    }
    if (data.type === 'STATISTICS_UPDATE') {
      return UpdatePriority.LOW;
    }
    return UpdatePriority.MEDIUM;
  }

  /**
   * Validates user access to dashboard
   */
  private async validateUserAccess(userId: string): Promise<void> {
    const hasAccess = await this.authService.validateDashboardAccess(userId);
    if (!hasAccess) {
      throw new HttpException(
        'Unauthorized access to dashboard',
        HttpStatus.UNAUTHORIZED
      );
    }
  }
}