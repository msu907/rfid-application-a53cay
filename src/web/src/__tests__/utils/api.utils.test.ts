import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.5.0
import axios from 'axios'; // ^1.4.0
import MockAdapter from 'axios-mock-adapter'; // ^1.21.5
import { handleApiError, formatQueryParams, retryRequest } from '../../utils/api.utils';
import { API_ERROR_CODES, ApiError } from '../../types/api.types';
import { apiConfig } from '../../config/api.config';

// Initialize mock axios instance
const mockAxios = new MockAdapter(axios);

// Test constants
const TEST_URL = 'https://api.example.com/test';
const TEST_TIMEOUT = 1000;
const CORRELATION_ID = '1234567890';

describe('handleApiError', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2023-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockAxios.reset();
  });

  test('Should format network errors with correlation IDs', () => {
    const networkError = new axios.AxiosError(
      'Network Error',
      'NETWORK_ERROR',
      { url: TEST_URL, method: 'GET' },
      {},
      { status: 0, data: null }
    );

    const error = handleApiError(networkError, { correlationId: CORRELATION_ID });

    expect(error).toMatchObject({
      code: 'NETWORK_ERROR',
      correlationId: CORRELATION_ID,
      severity: 'ERROR',
      details: {
        status: 500,
        path: TEST_URL,
        method: 'GET',
        timestamp: expect.any(String)
      }
    });
  });

  test('Should handle HTTP 400 errors with detailed validation messages', () => {
    const validationError = new axios.AxiosError(
      'Validation Error',
      'VALIDATION_ERROR',
      { url: TEST_URL, method: 'POST' },
      {},
      { 
        status: 400,
        data: { message: 'Invalid input', details: { field: 'name', error: 'Required' } }
      }
    );

    const error = handleApiError(validationError);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.severity).toBe('ERROR');
    expect(error.details.status).toBe(400);
  });

  test('Should map to standardized error codes (RDR-001, API-001)', () => {
    const readerError = new axios.AxiosError(
      'Reader Offline',
      'RDR-001',
      { url: TEST_URL, method: 'GET' },
      {},
      { status: 503, data: { message: 'Reader not responding' } }
    );

    const error = handleApiError(readerError);
    expect(error.severity).toBe('CRITICAL');
    expect(error.details.status).toBe(503);
  });

  test('Should include error monitoring metadata', () => {
    const error = new axios.AxiosError(
      'Server Error',
      'INTERNAL_ERROR',
      { url: TEST_URL, method: 'GET' },
      {},
      { status: 500, data: { message: 'Internal server error' } }
    );

    const result = handleApiError(error, { 
      logError: true,
      context: { 
        service: 'reader-service',
        operation: 'getData'
      }
    });

    expect(result.details).toMatchObject({
      service: 'reader-service',
      operation: 'getData'
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('formatQueryParams', () => {
  test('Should format basic key-value pairs correctly', () => {
    const params = {
      name: 'test',
      id: 123,
      active: true
    };

    const result = formatQueryParams(params);
    expect(result).toBe('name=test&id=123&active=true');
  });

  test('Should serialize array parameters with proper encoding', () => {
    const params = {
      ids: [1, 2, 3],
      tags: ['tag1', 'tag2']
    };

    const result = formatQueryParams(params, { arrayFormat: 'brackets' });
    expect(result).toBe('ids[]=1&ids[]=2&ids[]=3&tags[]=tag1&tags[]=tag2');
  });

  test('Should handle nested object parameters recursively', () => {
    const params = {
      filter: {
        status: 'active',
        range: { start: '2023-01-01', end: '2023-12-31' }
      }
    };

    const result = formatQueryParams(params);
    expect(result).toContain('filter[status]=active');
    expect(result).toContain('filter[range][start]=2023-01-01');
  });

  test('Should handle large parameter sets efficiently', () => {
    const largeParams = Array.from({ length: 1000 }, (_, i) => [`key${i}`, `value${i}`])
      .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

    const startTime = performance.now();
    const result = formatQueryParams(largeParams);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100); // Performance benchmark
    expect(result.split('&').length).toBe(1000);
  });
});

describe('retryRequest', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    mockAxios.reset();
  });

  test('Should resolve immediately on successful request', async () => {
    const mockFn = jest.fn().mockResolvedValue({ data: 'success' });
    const result = await retryRequest(mockFn);

    expect(result).toEqual({ data: 'success' });
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test('Should retry on network errors with backoff', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ data: 'success' });

    const onRetry = jest.fn();
    const result = await retryRequest(mockFn, {
      maxAttempts: 3,
      initialDelay: 100,
      onRetry
    });

    expect(result).toEqual({ data: 'success' });
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  test('Should maintain <500ms latency under normal conditions', async () => {
    const mockFn = jest.fn().mockResolvedValue({ data: 'success' });
    
    const startTime = performance.now();
    await retryRequest(mockFn, { timeout: 500 });
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(500);
  });

  test('Should handle concurrent retry attempts', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ data: 'success' });

    const requests = Array.from({ length: 5 }, () => 
      retryRequest(mockFn, { maxAttempts: 2, initialDelay: 100 })
    );

    const results = await Promise.all(requests);
    expect(results).toHaveLength(5);
    results.forEach(result => 
      expect(result).toEqual({ data: 'success' })
    );
  });

  test('Should activate circuit breaker after threshold', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Service unavailable'));

    await expect(retryRequest(mockFn, {
      maxAttempts: 3,
      initialDelay: 100
    })).rejects.toThrow('Service unavailable');

    expect(mockFn).toHaveBeenCalledTimes(3);
  });
});