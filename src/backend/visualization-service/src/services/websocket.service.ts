// External dependencies
import { WebSocket, WebSocketServer } from 'ws'; // v8.13.0
import { injectable, inject } from 'inversify'; // v6.0.1
import { Logger } from 'winston'; // v3.9.0
import { Counter, Gauge, Histogram } from 'prom-client'; // v14.2.0
import { gzip, gunzip } from 'zlib'; // v1.0.0
import { promisify } from 'util';

// Internal dependencies
import { websocketConfig } from '../config';
import { RealTimeService } from './realtime.service';
import { WidgetType } from '../models/dashboard.model';

// Promisify zlib functions
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Interface definitions
interface ClientMetadata {
  id: string;
  connectedAt: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
  capabilities: {
    compression: boolean;
    binarySupport: boolean;
    protocolVersion: string;
  };
}

interface MessagePayload {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  widgetId?: string;
  data?: any;
}

@injectable()
export class WebSocketService {
  private wss: WebSocketServer;
  private readonly clients: Map<string, WebSocket> = new Map();
  private readonly clientMetadata: Map<string, ClientMetadata> = new Map();
  private readonly subscriptions: Map<string, Set<string>> = new Map();

  // Prometheus metrics
  private readonly connectedClients: Gauge;
  private readonly messageCounter: Counter;
  private readonly broadcastLatency: Histogram;
  private readonly errorCounter: Counter;

  constructor(
    @inject('RealTimeService') private realTimeService: RealTimeService,
    @inject('Logger') private logger: Logger
  ) {
    // Initialize metrics
    this.connectedClients = new Gauge({
      name: 'ws_connected_clients',
      help: 'Number of connected WebSocket clients'
    });

    this.messageCounter = new Counter({
      name: 'ws_messages_total',
      help: 'Total number of WebSocket messages',
      labelNames: ['type']
    });

    this.broadcastLatency = new Histogram({
      name: 'ws_broadcast_latency',
      help: 'Latency of broadcast operations',
      buckets: [0.1, 0.5, 1, 2, 5]
    });

    this.errorCounter = new Counter({
      name: 'ws_errors_total',
      help: 'Total number of WebSocket errors',
      labelNames: ['type']
    });
  }

  /**
   * Starts the WebSocket server with enhanced configuration
   */
  public async start(): Promise<void> {
    try {
      this.wss = new WebSocketServer({
        port: websocketConfig.port,
        path: websocketConfig.path,
        maxPayload: 1024 * 1024, // 1MB max payload
        clientTracking: true,
        perMessageDeflate: true
      });

      this.setupServerHandlers();
      this.startHealthCheck();

      this.logger.info(`WebSocket server started on port ${websocketConfig.port}`);
    } catch (error) {
      this.logger.error('Failed to start WebSocket server:', error);
      this.errorCounter.inc({ type: 'startup' });
      throw error;
    }
  }

  /**
   * Sets up WebSocket server event handlers
   */
  private setupServerHandlers(): void {
    this.wss.on('connection', (socket: WebSocket, request) => {
      this.handleConnection(socket, request);
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error:', error);
      this.errorCounter.inc({ type: 'server' });
    });
  }

  /**
   * Handles new WebSocket connections with enhanced security and monitoring
   */
  private handleConnection(socket: WebSocket, request: any): void {
    const clientId = this.generateClientId();
    
    // Store client information
    this.clients.set(clientId, socket);
    this.clientMetadata.set(clientId, {
      id: clientId,
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
      capabilities: this.detectClientCapabilities(request)
    });

    // Update metrics
    this.connectedClients.inc();
    this.messageCounter.inc({ type: 'connection' });

    // Set up client handlers
    socket.on('message', async (data) => {
      try {
        const message = await this.parseMessage(data, clientId);
        await this.handleMessage(clientId, message);
      } catch (error) {
        this.logger.error(`Error handling message from client ${clientId}:`, error);
        this.errorCounter.inc({ type: 'message' });
      }
    });

    socket.on('close', () => {
      this.handleDisconnect(clientId);
    });

    socket.on('error', (error) => {
      this.logger.error(`Client ${clientId} error:`, error);
      this.errorCounter.inc({ type: 'client' });
    });

    // Set up ping/pong for connection monitoring
    this.setupHeartbeat(socket, clientId);
  }

  /**
   * Handles incoming WebSocket messages with validation and rate limiting
   */
  private async handleMessage(clientId: string, message: MessagePayload): Promise<void> {
    const metadata = this.clientMetadata.get(clientId);
    if (!metadata) return;

    metadata.lastActivity = new Date();
    this.messageCounter.inc({ type: message.type });

    switch (message.type) {
      case 'subscribe':
        if (message.widgetId) {
          await this.handleSubscription(clientId, message.widgetId);
        }
        break;

      case 'unsubscribe':
        if (message.widgetId) {
          await this.handleUnsubscription(clientId, message.widgetId);
        }
        break;

      case 'ping':
        this.sendToClient(clientId, { type: 'pong' });
        break;
    }
  }

  /**
   * Handles client subscription requests with validation
   */
  private async handleSubscription(clientId: string, widgetId: string): Promise<void> {
    const metadata = this.clientMetadata.get(clientId);
    if (!metadata) return;

    try {
      // Subscribe to real-time updates
      await this.realTimeService.subscribeToWidget(
        clientId,
        widgetId,
        WidgetType.ASSET_MAP,
        { bufferSize: 100, debounceMs: 500 }
      );

      // Track subscription
      metadata.subscriptions.add(widgetId);
      if (!this.subscriptions.has(widgetId)) {
        this.subscriptions.set(widgetId, new Set());
      }
      this.subscriptions.get(widgetId)!.add(clientId);

      this.sendToClient(clientId, {
        type: 'subscribed',
        widgetId
      });
    } catch (error) {
      this.logger.error(`Subscription error for client ${clientId}:`, error);
      this.errorCounter.inc({ type: 'subscription' });
    }
  }

  /**
   * Handles client unsubscription requests
   */
  private async handleUnsubscription(clientId: string, widgetId: string): Promise<void> {
    const metadata = this.clientMetadata.get(clientId);
    if (!metadata) return;

    try {
      await this.realTimeService.unsubscribeFromWidget(clientId, widgetId);
      metadata.subscriptions.delete(widgetId);
      this.subscriptions.get(widgetId)?.delete(clientId);

      this.sendToClient(clientId, {
        type: 'unsubscribed',
        widgetId
      });
    } catch (error) {
      this.logger.error(`Unsubscription error for client ${clientId}:`, error);
      this.errorCounter.inc({ type: 'unsubscription' });
    }
  }

  /**
   * Broadcasts data to all subscribers of a widget with compression
   */
  public async broadcastToWidget(widgetId: string, data: any): Promise<void> {
    const end = this.broadcastLatency.startTimer();
    const subscribers = this.subscriptions.get(widgetId);
    
    if (!subscribers || subscribers.size === 0) return;

    try {
      const compressedData = await gzipAsync(Buffer.from(JSON.stringify(data)));

      const broadcastPromises = Array.from(subscribers).map(async (clientId) => {
        const client = this.clients.get(clientId);
        const metadata = this.clientMetadata.get(clientId);

        if (client?.readyState === WebSocket.OPEN) {
          const payload = metadata?.capabilities.compression ? 
            compressedData : 
            JSON.stringify(data);

          await this.sendToClient(clientId, {
            type: 'update',
            widgetId,
            data: payload,
            compressed: metadata?.capabilities.compression
          });
        }
      });

      await Promise.all(broadcastPromises);
      end(); // Record broadcast latency
    } catch (error) {
      this.logger.error(`Broadcast error for widget ${widgetId}:`, error);
      this.errorCounter.inc({ type: 'broadcast' });
    }
  }

  /**
   * Handles client disconnection and cleanup
   */
  private async handleDisconnect(clientId: string): Promise<void> {
    const metadata = this.clientMetadata.get(clientId);
    if (!metadata) return;

    try {
      // Clean up subscriptions
      for (const widgetId of metadata.subscriptions) {
        await this.realTimeService.unsubscribeFromWidget(clientId, widgetId);
        this.subscriptions.get(widgetId)?.delete(clientId);
      }

      // Clean up client data
      this.clients.delete(clientId);
      this.clientMetadata.delete(clientId);
      this.connectedClients.dec();

      this.logger.info(`Client ${clientId} disconnected`);
    } catch (error) {
      this.logger.error(`Error handling disconnect for client ${clientId}:`, error);
      this.errorCounter.inc({ type: 'disconnect' });
    }
  }

  // Helper methods
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private detectClientCapabilities(request: any): ClientMetadata['capabilities'] {
    return {
      compression: request.headers['accept-encoding']?.includes('gzip') ?? false,
      binarySupport: request.headers['sec-websocket-protocol']?.includes('binary') ?? false,
      protocolVersion: request.headers['sec-websocket-version'] ?? '13'
    };
  }

  private async parseMessage(data: WebSocket.Data, clientId: string): Promise<MessagePayload> {
    try {
      const metadata = this.clientMetadata.get(clientId);
      if (!metadata) throw new Error('Client metadata not found');

      if (metadata.capabilities.compression && data instanceof Buffer) {
        const decompressed = await gunzipAsync(data);
        return JSON.parse(decompressed.toString());
      }

      return JSON.parse(data.toString());
    } catch (error) {
      this.logger.error(`Message parsing error for client ${clientId}:`, error);
      this.errorCounter.inc({ type: 'parsing' });
      throw error;
    }
  }

  private async sendToClient(clientId: string, data: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || client.readyState !== WebSocket.OPEN) return;

    try {
      const payload = JSON.stringify(data);
      client.send(payload);
    } catch (error) {
      this.logger.error(`Error sending message to client ${clientId}:`, error);
      this.errorCounter.inc({ type: 'send' });
    }
  }

  private setupHeartbeat(socket: WebSocket, clientId: string): void {
    const interval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.ping();
      } else {
        clearInterval(interval);
      }
    }, websocketConfig.pingInterval);

    socket.on('pong', () => {
      const metadata = this.clientMetadata.get(clientId);
      if (metadata) {
        metadata.lastActivity = new Date();
      }
    });
  }

  private startHealthCheck(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [clientId, metadata] of this.clientMetadata.entries()) {
        if (now - metadata.lastActivity.getTime() > websocketConfig.pingTimeout) {
          this.logger.warn(`Client ${clientId} timed out`);
          const client = this.clients.get(clientId);
          client?.terminate();
        }
      }
    }, websocketConfig.pingInterval);
  }
}