/**
 * @fileoverview Integration tests for API Gateway routes
 * @version 1.0.0
 * @license MIT
 */

import request from 'supertest'; // ^6.3.0
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals'; // ^29.0.0
import MockRedis from 'ioredis-mock'; // ^8.0.0
import { grpc } from '@grpc/mock'; // ^1.0.0
import app from '../../src/app';
import { AuthService } from '../../src/services/auth.service';
import { ProxyService } from '../../src/services/proxy.service';

// Test constants
const API_VERSION = '/api/v1';
const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  roles: ['admin', 'asset_manager']
};
const TEST_ASSET = {
  id: 'test-asset-id',
  name: 'Test Asset',
  rfidTag: 'RF001',
  location: 'Zone-A',
  metadata: {
    category: 'Electronics',
    status: 'Active'
  }
};
const RATE_LIMIT = {
  window: 60000,
  max_requests: 1000
};

// Mock services
jest.mock('ioredis', () => MockRedis);
jest.mock('@grpc/grpc-js', () => grpc);

// Test setup and teardown
let authToken: string;
let mockRedis: MockRedis;
let mockGrpcServer: any;

beforeAll(async () => {
  // Initialize mock Redis
  mockRedis = new MockRedis({
    data: {
      'rate-limit:test': '0'
    }
  });

  // Initialize mock gRPC server
  mockGrpcServer = new grpc.Server();
  mockGrpcServer.addService('AssetService', {
    createAsset: jest.fn(),
    getAsset: jest.fn(),
    updateAsset: jest.fn(),
    deleteAsset: jest.fn(),
    listAssets: jest.fn()
  });

  // Generate test JWT token
  authToken = await AuthService.generateToken(TEST_USER);

  // Configure mock responses
  mockGrpcServer.getAsset.mockImplementation(() => TEST_ASSET);
  mockGrpcServer.listAssets.mockImplementation(() => ({
    assets: [TEST_ASSET],
    total: 1,
    hasMore: false
  }));
});

afterAll(async () => {
  await mockRedis.quit();
  await mockGrpcServer.stop();
});

describe('Asset Management API Integration Tests', () => {
  describe('Authentication and Authorization', () => {
    test('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get(`${API_VERSION}/assets`)
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Authentication required');
    });

    test('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get(`${API_VERSION}/assets`)
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });

    test('should allow access with valid token and roles', async () => {
      const response = await request(app)
        .get(`${API_VERSION}/assets`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
    });
  });

  describe('Asset CRUD Operations', () => {
    test('should create asset with valid data', async () => {
      const response = await request(app)
        .post(`${API_VERSION}/assets`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(TEST_ASSET)
        .expect(201);

      expect(response.body.data).toMatchObject({
        id: expect.any(String),
        name: TEST_ASSET.name,
        rfidTag: TEST_ASSET.rfidTag
      });
    });

    test('should validate required fields when creating asset', async () => {
      const response = await request(app)
        .post(`${API_VERSION}/assets`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    test('should retrieve asset by ID', async () => {
      const response = await request(app)
        .get(`${API_VERSION}/assets/${TEST_ASSET.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toMatchObject(TEST_ASSET);
    });

    test('should handle non-existent asset gracefully', async () => {
      const response = await request(app)
        .get(`${API_VERSION}/assets/non-existent`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Asset not found');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      // Make requests up to limit
      for (let i = 0; i < RATE_LIMIT.max_requests; i++) {
        await request(app)
          .get(`${API_VERSION}/assets`)
          .set('Authorization', `Bearer ${authToken}`);
      }

      // Next request should be rate limited
      const response = await request(app)
        .get(`${API_VERSION}/assets`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(429);

      expect(response.body).toHaveProperty('error', 'Rate limit exceeded');
    });

    test('should reset rate limit after window', async () => {
      // Wait for rate limit window to expire
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT.window));

      const response = await request(app)
        .get(`${API_VERSION}/assets`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'success');
    });
  });

  describe('Error Handling', () => {
    test('should handle service timeouts gracefully', async () => {
      // Mock service timeout
      mockGrpcServer.getAsset.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Service timeout')), 5000);
        });
      });

      const response = await request(app)
        .get(`${API_VERSION}/assets/${TEST_ASSET.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(503);

      expect(response.body).toHaveProperty('error', 'Service unavailable');
    });

    test('should handle validation errors with details', async () => {
      const response = await request(app)
        .post(`${API_VERSION}/assets`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '',
          rfidTag: 'invalid'
        })
        .expect(400);

      expect(response.body).toHaveProperty('details');
      expect(response.body.details).toHaveLength(2);
    });
  });

  describe('Performance and Metrics', () => {
    test('should maintain response time SLA', async () => {
      const start = Date.now();
      
      await request(app)
        .get(`${API_VERSION}/assets`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500); // 500ms SLA
    });

    test('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        request(app)
          .get(`${API_VERSION}/assets`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});