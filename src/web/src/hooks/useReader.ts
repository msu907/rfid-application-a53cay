/**
 * Custom React hook for managing RFID reader operations with comprehensive monitoring,
 * performance tracking, and error handling capabilities.
 * @version 1.0.0
 */

import { useDispatch, useSelector } from 'react-redux'; // v8.1.0
import { useCallback, useEffect } from 'react'; // v18.0.0
import { debounce } from 'lodash'; // v4.17.21

import { ReaderApi } from '../api/reader.api';
import { 
  Reader, 
  ReaderConfig, 
  ReaderStatus,
  PowerLevel,
  ReaderStatsResponse 
} from '../types/reader.types';

// Constants for performance monitoring and error handling
const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_RETRY_ATTEMPTS = 3;
const DEBOUNCE_DELAY = 300;

// Error codes mapping
const ERROR_CODES = {
  'RDR-001': 'Reader connection lost',
  'RDR-002': 'Invalid tag format',
  'RDR-003': 'Configuration validation failed',
  'RDR-004': 'Performance threshold exceeded'
} as const;

// Performance thresholds based on technical specifications
const PERFORMANCE_THRESHOLDS = {
  MAX_LATENCY: 500, // 500ms max latency requirement
  MIN_SIGNAL_STRENGTH: -70, // -70dBm minimum signal strength
  MAX_SIGNAL_STRENGTH: -20, // -20dBm maximum signal strength
  MAX_READ_RATE: 1000 // 1000 tags/second maximum
} as const;

// Interface for hook options
interface ReaderOptions {
  autoConnect?: boolean;
  enablePerformanceMonitoring?: boolean;
  pollingInterval?: number;
}

// Interface for performance metrics
interface ReaderPerformance {
  latency: number;
  readRate: number;
  signalStrength: number;
  errorRate: number;
  lastUpdated: string;
}

// Interface for reader error state
interface ReaderError {
  code: keyof typeof ERROR_CODES;
  message: string;
  timestamp: string;
  retryCount: number;
}

/**
 * Custom hook for managing RFID reader operations
 * @param readerId - Optional specific reader ID to monitor
 * @param options - Configuration options for the hook
 */
export const useReader = (
  readerId?: string,
  options: ReaderOptions = {
    autoConnect: true,
    enablePerformanceMonitoring: true,
    pollingInterval: POLLING_INTERVAL
  }
) => {
  const dispatch = useDispatch();
  const readerApi = new ReaderApi();

  // State selectors
  const readers = useSelector((state: any) => state.readers.items);
  const selectedReader = useSelector((state: any) => 
    readerId ? state.readers.items[readerId] : null
  );
  const loading = useSelector((state: any) => state.readers.loading);
  const error = useSelector((state: any) => state.readers.error);
  const performance = useSelector((state: any) => state.readers.performance);

  /**
   * Validates reader configuration against technical specifications
   */
  const validateReaderConfig = (config: ReaderConfig): boolean => {
    if (config.readIntervalMs < 1 || config.readIntervalMs > 1000) {
      throw new Error('Read interval must be between 1-1000ms');
    }

    if (config.signalStrengthThreshold < PERFORMANCE_THRESHOLDS.MIN_SIGNAL_STRENGTH || 
        config.signalStrengthThreshold > PERFORMANCE_THRESHOLDS.MAX_SIGNAL_STRENGTH) {
      throw new Error(`Signal strength must be between ${PERFORMANCE_THRESHOLDS.MIN_SIGNAL_STRENGTH}dBm and ${PERFORMANCE_THRESHOLDS.MAX_SIGNAL_STRENGTH}dBm`);
    }

    return true;
  };

  /**
   * Fetches all readers with error handling and retry mechanism
   */
  const fetchReaders = useCallback(async () => {
    try {
      dispatch({ type: 'readers/setLoading', payload: true });
      const response = await readerApi.getReaders();
      dispatch({ type: 'readers/setReaders', payload: response.data });
    } catch (error: any) {
      dispatch({
        type: 'readers/setError',
        payload: {
          code: 'RDR-001',
          message: ERROR_CODES['RDR-001'],
          timestamp: new Date().toISOString(),
          retryCount: 0
        }
      });
    } finally {
      dispatch({ type: 'readers/setLoading', payload: false });
    }
  }, [dispatch]);

  /**
   * Fetches specific reader by ID with performance monitoring
   */
  const fetchReaderById = useCallback(async (id: string) => {
    const startTime = performance.now();
    try {
      const response = await readerApi.getReaderById(id);
      const latency = performance.now() - startTime;

      if (latency > PERFORMANCE_THRESHOLDS.MAX_LATENCY) {
        console.warn(`Reader response latency exceeded threshold: ${latency}ms`);
      }

      dispatch({ type: 'readers/setReader', payload: response.data });
      updatePerformanceMetrics(id, { latency });
    } catch (error: any) {
      handleReaderError(id, error);
    }
  }, []);

  /**
   * Updates reader configuration with validation
   */
  const updateReaderConfig = useCallback(async (
    id: string,
    config: ReaderConfig
  ) => {
    try {
      validateReaderConfig(config);
      const response = await readerApi.updateReaderConfig(id, config);
      dispatch({ type: 'readers/updateReader', payload: response.data });
    } catch (error: any) {
      dispatch({
        type: 'readers/setError',
        payload: {
          code: 'RDR-003',
          message: ERROR_CODES['RDR-003'],
          timestamp: new Date().toISOString(),
          retryCount: 0
        }
      });
    }
  }, [dispatch]);

  /**
   * Retrieves reader status with performance tracking
   */
  const getReaderStatus = useCallback(async (
    id: string
  ): Promise<ReaderStatsResponse> => {
    try {
      const response = await readerApi.getReaderStatus(id);
      
      // Monitor read rate against threshold
      if (response.readRate > PERFORMANCE_THRESHOLDS.MAX_READ_RATE) {
        console.warn(`Read rate exceeded threshold: ${response.readRate} reads/second`);
      }

      updatePerformanceMetrics(id, {
        readRate: response.readRate,
        signalStrength: response.averageSignalStrength,
        errorRate: response.errorRate
      });

      return response;
    } catch (error: any) {
      handleReaderError(id, error);
      throw error;
    }
  }, []);

  /**
   * Updates performance metrics for a reader
   */
  const updatePerformanceMetrics = debounce((
    id: string,
    metrics: Partial<ReaderPerformance>
  ) => {
    dispatch({
      type: 'readers/updatePerformance',
      payload: {
        readerId: id,
        metrics: {
          ...metrics,
          lastUpdated: new Date().toISOString()
        }
      }
    });
  }, DEBOUNCE_DELAY);

  /**
   * Handles reader errors with retry mechanism
   */
  const handleReaderError = (id: string, error: any) => {
    const currentError = error as ReaderError;
    if (currentError.retryCount < MAX_RETRY_ATTEMPTS) {
      setTimeout(() => {
        fetchReaderById(id);
      }, Math.pow(2, currentError.retryCount) * 1000);
    }

    dispatch({
      type: 'readers/setError',
      payload: {
        ...currentError,
        retryCount: (currentError.retryCount || 0) + 1
      }
    });
  };

  /**
   * Clears current error state
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'readers/clearError' });
  }, [dispatch]);

  /**
   * Resets performance metrics
   */
  const resetPerformance = useCallback(() => {
    dispatch({ type: 'readers/resetPerformance' });
  }, [dispatch]);

  // Set up polling interval for reader status updates
  useEffect(() => {
    if (!options.autoConnect) return;

    const pollInterval = setInterval(() => {
      if (readerId) {
        fetchReaderById(readerId);
      } else {
        fetchReaders();
      }
    }, options.pollingInterval || POLLING_INTERVAL);

    return () => clearInterval(pollInterval);
  }, [readerId, options.autoConnect, options.pollingInterval]);

  // Initial data fetch
  useEffect(() => {
    if (options.autoConnect) {
      if (readerId) {
        fetchReaderById(readerId);
      } else {
        fetchReaders();
      }
    }
  }, [readerId, options.autoConnect]);

  return {
    readers,
    selectedReader,
    loading,
    error,
    performance,
    fetchReaders,
    fetchReaderById,
    updateReaderConfig,
    getReaderStatus,
    clearError,
    resetPerformance
  };
};