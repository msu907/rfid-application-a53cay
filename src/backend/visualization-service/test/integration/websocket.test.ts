// External dependencies
import WebSocket from 'ws'; // v8.13.0
import { describe, it, beforeEach, afterEach, jest, expect } from 'jest'; // v29.5.0

// Internal dependencies
import { WebSocketService } from '../../src/services/websocket.service';
import { RealTimeService } from '../../src/services/realtime.service';
import { WidgetType } from '../../src/models/dashboard.model';

// Test constants
const TEST_PORT = 8081;
const TEST_WS_URL = `ws://localhost:${TEST_PORT}`;
const TEST_TIMEOUT = 5000;
const MAX_CLIENTS = 100;

describe('WebSocket Service Integration Tests', () => {
  let webSocketService: WebSocketService;
  let realTimeService: RealTimeService;
  let testClients: WebSocket[] = [];

  // Helper function to create and connect a test client
  const createTestClient = async (options: { 
    headers?: Record<string, string> 
  } = {}): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const client = new WebSocket(TEST_WS_URL, {
        headers: {
          'accept-encoding': 'gzip',
          'sec-websocket-protocol': 'binary',
          ...options.headers
        }
      });

      client.on('open', () => resolve(client));
      client.on('error', reject);

      // Add to cleanup list
      testClients.push(client);
    });
  };

  // Helper function to wait for a specific message
  const waitForMessage = async (client: WebSocket, matcher: any): Promise<any> => {
    return new Promise((resolve) => {
      client.on('message', (data: WebSocket.Data) => {
        const message = JSON.parse(data.toString());
        if (matcher(message)) {
          resolve(message);
        }
      });
    });
  };

  beforeEach(async () => {
    // Create mock RealTimeService
    realTimeService = new RealTimeService();
    jest.spyOn(realTimeService, 'subscribeToWidget');
    jest.spyOn(realTimeService, 'unsubscribeFromWidget');
    jest.spyOn(realTimeService, 'pushUpdate');

    // Initialize WebSocket service with test configuration
    webSocketService = new WebSocketService(realTimeService, {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    });

    // Start server
    await webSocketService.start();
  });

  afterEach(async () => {
    // Cleanup all test clients
    for (const client of testClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    }
    testClients = [];

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should successfully establish client connections', async () => {
      const client = await createTestClient();
      expect(client.readyState).toBe(WebSocket.OPEN);
    }, TEST_TIMEOUT);

    it('should handle multiple concurrent connections', async () => {
      const clients = await Promise.all(
        Array(10).fill(null).map(() => createTestClient())
      );
      
      clients.forEach(client => {
        expect(client.readyState).toBe(WebSocket.OPEN);
      });
    }, TEST_TIMEOUT);

    it('should enforce connection limits', async () => {
      const connectPromises = Array(MAX_CLIENTS + 1)
        .fill(null)
        .map(() => createTestClient());

      await expect(Promise.all(connectPromises))
        .rejects
        .toThrow();
    }, TEST_TIMEOUT);

    it('should handle client disconnection cleanup', async () => {
      const client = await createTestClient();
      client.close();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify cleanup through a new connection attempt
      const newClient = await createTestClient();
      expect(newClient.readyState).toBe(WebSocket.OPEN);
    }, TEST_TIMEOUT);
  });

  describe('Widget Subscriptions', () => {
    it('should handle widget subscription requests', async () => {
      const client = await createTestClient();
      const widgetId = 'test-widget-1';

      client.send(JSON.stringify({
        type: 'subscribe',
        widgetId,
        widgetType: WidgetType.ASSET_MAP
      }));

      const response = await waitForMessage(client, 
        (msg: any) => msg.type === 'subscribed' && msg.widgetId === widgetId
      );

      expect(response).toBeDefined();
      expect(realTimeService.subscribeToWidget).toHaveBeenCalledWith(
        expect.any(String),
        widgetId,
        WidgetType.ASSET_MAP,
        expect.any(Object)
      );
    }, TEST_TIMEOUT);

    it('should handle multiple widget subscriptions per client', async () => {
      const client = await createTestClient();
      const widgets = ['widget-1', 'widget-2'];

      for (const widgetId of widgets) {
        client.send(JSON.stringify({
          type: 'subscribe',
          widgetId,
          widgetType: WidgetType.ASSET_MAP
        }));
      }

      const responses = await Promise.all(
        widgets.map(widgetId => 
          waitForMessage(client, 
            (msg: any) => msg.type === 'subscribed' && msg.widgetId === widgetId
          )
        )
      );

      expect(responses).toHaveLength(widgets.length);
    }, TEST_TIMEOUT);

    it('should handle unsubscribe requests', async () => {
      const client = await createTestClient();
      const widgetId = 'test-widget-1';

      // Subscribe first
      client.send(JSON.stringify({
        type: 'subscribe',
        widgetId,
        widgetType: WidgetType.ASSET_MAP
      }));

      await waitForMessage(client, 
        (msg: any) => msg.type === 'subscribed' && msg.widgetId === widgetId
      );

      // Then unsubscribe
      client.send(JSON.stringify({
        type: 'unsubscribe',
        widgetId
      }));

      const response = await waitForMessage(client, 
        (msg: any) => msg.type === 'unsubscribed' && msg.widgetId === widgetId
      );

      expect(response).toBeDefined();
      expect(realTimeService.unsubscribeFromWidget).toHaveBeenCalled();
    }, TEST_TIMEOUT);
  });

  describe('Data Distribution', () => {
    it('should broadcast updates to subscribed clients', async () => {
      const client = await createTestClient();
      const widgetId = 'test-widget-1';
      const testData = { location: 'Zone A', count: 5 };

      // Subscribe to widget
      client.send(JSON.stringify({
        type: 'subscribe',
        widgetId,
        widgetType: WidgetType.ASSET_MAP
      }));

      await waitForMessage(client, 
        (msg: any) => msg.type === 'subscribed'
      );

      // Broadcast update
      await webSocketService.broadcastToWidget(widgetId, testData);

      const update = await waitForMessage(client, 
        (msg: any) => msg.type === 'update' && msg.widgetId === widgetId
      );

      expect(update.data).toEqual(expect.objectContaining(testData));
    }, TEST_TIMEOUT);

    it('should handle compressed data distribution', async () => {
      const client = await createTestClient({
        headers: {
          'accept-encoding': 'gzip'
        }
      });

      const widgetId = 'test-widget-1';
      const largeData = Array(1000).fill({ location: 'Zone A', count: 5 });

      // Subscribe to widget
      client.send(JSON.stringify({
        type: 'subscribe',
        widgetId,
        widgetType: WidgetType.ASSET_MAP
      }));

      await waitForMessage(client, 
        (msg: any) => msg.type === 'subscribed'
      );

      // Broadcast update
      await webSocketService.broadcastToWidget(widgetId, largeData);

      const update = await waitForMessage(client, 
        (msg: any) => msg.type === 'update' && msg.compressed === true
      );

      expect(update).toBeDefined();
    }, TEST_TIMEOUT);
  });

  describe('Performance Requirements', () => {
    it('should handle high message throughput', async () => {
      const client = await createTestClient();
      const widgetId = 'test-widget-1';
      const messageCount = 1000;

      // Subscribe to widget
      client.send(JSON.stringify({
        type: 'subscribe',
        widgetId,
        widgetType: WidgetType.ASSET_MAP
      }));

      await waitForMessage(client, 
        (msg: any) => msg.type === 'subscribed'
      );

      // Send multiple updates rapidly
      const startTime = Date.now();
      const updates = Array(messageCount).fill(null).map((_, i) => ({
        id: i,
        data: `test-${i}`
      }));

      await Promise.all(
        updates.map(update => 
          webSocketService.broadcastToWidget(widgetId, update)
        )
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify performance requirements (500ms latency requirement)
      expect(duration).toBeLessThan(messageCount * 0.5); // 0.5ms per message
    }, TEST_TIMEOUT);

    it('should maintain performance with multiple subscribed clients', async () => {
      const clientCount = 50;
      const clients = await Promise.all(
        Array(clientCount).fill(null).map(() => createTestClient())
      );

      const widgetId = 'test-widget-1';
      const testData = { location: 'Zone A', count: 5 };

      // Subscribe all clients
      await Promise.all(
        clients.map(client => 
          new Promise<void>(resolve => {
            client.send(JSON.stringify({
              type: 'subscribe',
              widgetId,
              widgetType: WidgetType.ASSET_MAP
            }));

            client.once('message', () => resolve());
          })
        )
      );

      // Measure broadcast performance
      const startTime = Date.now();
      await webSocketService.broadcastToWidget(widgetId, testData);
      const endTime = Date.now();

      // Verify broadcast latency requirement (< 500ms)
      expect(endTime - startTime).toBeLessThan(500);
    }, TEST_TIMEOUT);
  });

  describe('Error Handling', () => {
    it('should handle invalid message formats', async () => {
      const client = await createTestClient();
      
      client.send('invalid json');

      const errorMessage = await waitForMessage(client, 
        (msg: any) => msg.type === 'error'
      );

      expect(errorMessage).toBeDefined();
      expect(errorMessage.error).toBeDefined();
    }, TEST_TIMEOUT);

    it('should handle connection timeouts', async () => {
      const client = await createTestClient();
      
      // Simulate network interruption
      // @ts-ignore - accessing private property for testing
      client._socket.destroy();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify connection is closed
      expect(client.readyState).toBe(WebSocket.CLOSED);
    }, TEST_TIMEOUT);

    it('should recover from service errors', async () => {
      const client = await createTestClient();
      const widgetId = 'test-widget-1';

      // Force an error in the real-time service
      jest.spyOn(realTimeService, 'subscribeToWidget')
        .mockRejectedValueOnce(new Error('Service error'));

      client.send(JSON.stringify({
        type: 'subscribe',
        widgetId,
        widgetType: WidgetType.ASSET_MAP
      }));

      const errorMessage = await waitForMessage(client, 
        (msg: any) => msg.type === 'error'
      );

      expect(errorMessage).toBeDefined();

      // Verify service recovers
      jest.spyOn(realTimeService, 'subscribeToWidget')
        .mockResolvedValueOnce(undefined);

      client.send(JSON.stringify({
        type: 'subscribe',
        widgetId: 'test-widget-2',
        widgetType: WidgetType.ASSET_MAP
      }));

      const successMessage = await waitForMessage(client, 
        (msg: any) => msg.type === 'subscribed'
      );

      expect(successMessage).toBeDefined();
    }, TEST_TIMEOUT);
  });
});