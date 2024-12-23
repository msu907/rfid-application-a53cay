/**
 * @fileoverview Enhanced proxy service for routing requests between REST and gRPC services
 * @version 1.0.0
 * @license MIT
 */

import * as grpc from '@grpc/grpc-js'; // ^1.8.0
import * as protoLoader from '@grpc/proto-loader'; // ^0.7.0
import { Request } from 'express'; // ^4.18.0
import CircuitBreaker from 'circuit-breaker-js'; // ^0.5.0
import { Logger } from 'winston'; // ^3.8.0
import { services, timeouts } from '../config';
import path from 'path';

// Constants for error handling and configuration
const ERROR_CODES = {
  DEADLINE_EXCEEDED: 4,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  INTERNAL: 13,
  UNAVAILABLE: 14,
  CIRCUIT_OPEN: 100,
} as const;

const RETRY_OPTIONS = {
  maxRetries: 3,
  backoffMultiplier: 1.5,
  initialRetryDelay: 100,
} as const;

const CIRCUIT_BREAKER_OPTIONS = {
  failureThreshold: 5,
  resetTimeout: 30000,
} as const;

const PROTO_PATH = '../proto';

// Interfaces
interface ServiceClient {
  service: string;
  client: grpc.Client;
  metadata: grpc.Metadata;
  circuitBreaker: CircuitBreaker;
  healthCheck: HealthCheck;
}

interface ProxyRequest {
  service: string;
  method: string;
  data: any;
  metadata?: grpc.Metadata;
  timeout?: number;
}

interface ServiceError {
  code: number;
  message: string;
  details: any;
  timestamp: Date;
  service: string;
}

interface HealthCheck {
  status: boolean;
  lastCheck: Date;
  failures: number;
}

/**
 * Enhanced ProxyService class for handling service communication
 */
export class ProxyService {
  private clients: Map<string, ServiceClient>;
  private protos: Map<string, grpc.GrpcObject>;
  private logger: Logger;
  private connectionPool: Map<string, grpc.Client[]>;

  /**
   * Initialize the ProxyService with enhanced features
   * @param logger - Winston logger instance
   */
  constructor(logger: Logger) {
    this.logger = logger;
    this.clients = new Map();
    this.protos = new Map();
    this.connectionPool = new Map();

    this.initializeServices().catch(error => {
      this.logger.error('Failed to initialize proxy service:', error);
      throw error;
    });
  }

  /**
   * Initialize service connections and protocol buffers
   * @private
   */
  private async initializeServices(): Promise<void> {
    for (const [serviceName, serviceConfig] of Object.entries(services)) {
      try {
        // Load protocol buffer
        const protoPath = path.resolve(__dirname, PROTO_PATH, `${serviceName}.proto`);
        const packageDefinition = await protoLoader.load(protoPath, {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
        });

        const proto = grpc.loadPackageDefinition(packageDefinition);
        this.protos.set(serviceName, proto);

        // Initialize connection pool
        const pool = Array.from({ length: 5 }, () => 
          new grpc.Client(
            `${serviceConfig.url}:${serviceConfig.port}`,
            serviceConfig.secure ? grpc.credentials.createSsl() : grpc.credentials.createInsecure()
          )
        );
        this.connectionPool.set(serviceName, pool);

        // Create service client with circuit breaker
        const circuitBreaker = new CircuitBreaker({
          ...CIRCUIT_BREAKER_OPTIONS,
          onOpen: () => this.logger.warn(`Circuit breaker opened for service: ${serviceName}`),
          onClose: () => this.logger.info(`Circuit breaker closed for service: ${serviceName}`),
        });

        this.clients.set(serviceName, {
          service: serviceName,
          client: pool[0],
          metadata: new grpc.Metadata(),
          circuitBreaker,
          healthCheck: {
            status: true,
            lastCheck: new Date(),
            failures: 0,
          },
        });

        this.logger.info(`Initialized service: ${serviceName}`);
      } catch (error) {
        this.logger.error(`Failed to initialize service ${serviceName}:`, error);
        throw error;
      }
    }
  }

  /**
   * Proxy REST request to gRPC service with enhanced reliability
   * @param request - Proxy request parameters
   * @returns Promise resolving to service response
   */
  public async proxyRequest(request: ProxyRequest): Promise<any> {
    const { service, method, data, metadata, timeout } = request;
    
    if (!this.clients.has(service)) {
      throw this.handleError({
        code: ERROR_CODES.NOT_FOUND,
        message: `Service ${service} not found`,
        details: null,
        timestamp: new Date(),
        service,
      });
    }

    const serviceClient = this.clients.get(service)!;
    
    // Check circuit breaker status
    if (!serviceClient.circuitBreaker.isAvailable()) {
      throw this.handleError({
        code: ERROR_CODES.CIRCUIT_OPEN,
        message: `Service ${service} is temporarily unavailable`,
        details: null,
        timestamp: new Date(),
        service,
      });
    }

    return new Promise((resolve, reject) => {
      let attempts = 0;
      const makeRequest = async () => {
        try {
          const client = this.getClientFromPool(service);
          const enhancedMetadata = this.createMetadata(metadata || new grpc.Metadata());
          
          const deadline = new Date();
          deadline.setMilliseconds(deadline.getMilliseconds() + (timeout || timeouts.default));

          client.waitForReady(deadline, (error) => {
            if (error) {
              throw error;
            }

            client.makeUnaryRequest(
              `/${service}/${method}`,
              arg => arg,
              arg => arg,
              data,
              enhancedMetadata,
              { deadline },
              (error, response) => {
                if (error) {
                  if (attempts < RETRY_OPTIONS.maxRetries) {
                    attempts++;
                    const delay = RETRY_OPTIONS.initialRetryDelay * Math.pow(RETRY_OPTIONS.backoffMultiplier, attempts - 1);
                    setTimeout(makeRequest, delay);
                    return;
                  }
                  reject(this.handleError({
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    timestamp: new Date(),
                    service,
                  }));
                  return;
                }

                serviceClient.circuitBreaker.success();
                resolve(response);
              }
            );
          });
        } catch (error: any) {
          reject(this.handleError({
            code: ERROR_CODES.INTERNAL,
            message: error.message,
            details: error,
            timestamp: new Date(),
            service,
          }));
        }
      };

      makeRequest();
    });
  }

  /**
   * Get client from connection pool with load balancing
   * @private
   */
  private getClientFromPool(service: string): grpc.Client {
    const pool = this.connectionPool.get(service)!;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  /**
   * Create enhanced gRPC metadata with tracing
   * @param headers - Request headers
   * @returns Enhanced gRPC metadata
   */
  public createMetadata(headers: grpc.Metadata): grpc.Metadata {
    const metadata = new grpc.Metadata();
    
    // Copy authentication headers
    const authHeader = headers.get('authorization');
    if (authHeader) {
      metadata.set('authorization', authHeader[0]);
    }

    // Add tracing headers
    metadata.set('x-request-id', `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    metadata.set('x-timestamp', new Date().toISOString());
    
    return metadata;
  }

  /**
   * Enhanced error handling with monitoring
   * @param error - Service error details
   * @returns Formatted error object
   */
  public handleError(error: ServiceError): Error {
    const serviceClient = this.clients.get(error.service);
    
    if (serviceClient) {
      serviceClient.circuitBreaker.failure();
      serviceClient.healthCheck.failures++;
      
      if (serviceClient.healthCheck.failures >= CIRCUIT_BREAKER_OPTIONS.failureThreshold) {
        serviceClient.healthCheck.status = false;
      }
    }

    this.logger.error('Service error:', {
      service: error.service,
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      details: error.details,
    });

    return new Error(JSON.stringify({
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
    }));
  }
}

export default ProxyService;