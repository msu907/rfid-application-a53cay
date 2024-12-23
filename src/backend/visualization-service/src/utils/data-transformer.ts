// External imports with versions
import { groupBy, map, memoize, merge } from 'lodash'; // v4.17.21
import { format, addMinutes, parseISO } from 'date-fns'; // v2.29.0

// Internal imports
import { 
  DashboardConfig, 
  WidgetType,
  DataType,
  ValidationStatus,
  type ValidationResult 
} from '../models/dashboard.model';

/**
 * Performance monitoring configuration interface
 */
interface PerformanceConfig {
  enableMetrics: boolean;
  samplingRate: number;
  timeoutMs: number;
  batchSize: number;
}

/**
 * Validation rules for data transformation
 */
interface ValidationRules {
  required: string[];
  formats: Record<string, RegExp>;
  ranges: Record<string, { min: number; max: number }>;
}

/**
 * Enhanced configuration options for data transformation
 */
export interface TransformationOptions {
  widgetId: string;
  widgetType: WidgetType;
  settings: Record<string, any>;
  enableCaching: boolean;
  cacheDuration: number;
  validationRules?: ValidationRules;
  performanceSettings?: PerformanceConfig;
}

/**
 * Performance metrics data structure
 */
interface MetricsData {
  transformationTimeMs: number;
  memoryUsageMb: number;
  inputSize: number;
  outputSize: number;
  timestamp: Date;
}

/**
 * Structure of transformed visualization data
 */
export interface TransformedData {
  widgetId: string;
  type: DataType;
  payload: any;
  timestamp: Date;
  performanceMetrics?: MetricsData;
  validationStatus: ValidationStatus;
}

/**
 * Cache configuration for transformed data
 */
interface CacheConfig {
  key: string;
  duration: number;
  data: TransformedData;
  timestamp: Date;
}

// In-memory cache store
const transformationCache = new Map<string, CacheConfig>();

/**
 * Performance monitoring decorator
 */
function performanceMonitor() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      const startMemory = process.memoryUsage().heapUsed;

      const result = await originalMethod.apply(this, args);

      const metrics: MetricsData = {
        transformationTimeMs: performance.now() - start,
        memoryUsageMb: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024,
        inputSize: JSON.stringify(args[0]).length,
        outputSize: JSON.stringify(result).length,
        timestamp: new Date()
      };

      return { ...result, performanceMetrics: metrics };
    };
    return descriptor;
  };
}

/**
 * Input validation decorator
 */
function validateInput() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (data: any, options: TransformationOptions) {
      if (!data || !options) {
        throw new Error('Invalid input: data and options are required');
      }

      if (options.validationRules) {
        const { required, formats, ranges } = options.validationRules;
        
        // Check required fields
        for (const field of required) {
          if (!data[field]) {
            throw new Error(`Missing required field: ${field}`);
          }
        }

        // Validate formats
        for (const [field, pattern] of Object.entries(formats)) {
          if (data[field] && !pattern.test(data[field])) {
            throw new Error(`Invalid format for field: ${field}`);
          }
        }

        // Validate ranges
        for (const [field, range] of Object.entries(ranges)) {
          if (data[field] && (data[field] < range.min || data[field] > range.max)) {
            throw new Error(`Value out of range for field: ${field}`);
          }
        }
      }

      return originalMethod.apply(this, [data, options]);
    };
    return descriptor;
  };
}

/**
 * Transforms raw RFID asset data into visualization-friendly format
 * with enhanced performance monitoring and caching
 */
@performanceMonitor()
@validateInput()
export async function transformDashboardData(
  rawData: any,
  options: TransformationOptions
): Promise<TransformedData> {
  try {
    // Check cache if enabled
    if (options.enableCaching) {
      const cacheKey = `${options.widgetId}-${JSON.stringify(rawData)}`;
      const cachedData = transformationCache.get(cacheKey);
      
      if (cachedData && 
          (new Date().getTime() - cachedData.timestamp.getTime()) < cachedData.duration) {
        return cachedData.data;
      }
    }

    let transformedData: any;
    
    // Apply widget-specific transformations
    switch (options.widgetType) {
      case WidgetType.ASSET_MAP:
        transformedData = await transformAssetMapData(rawData, options.settings);
        break;
      case WidgetType.ASSET_LIST:
        transformedData = transformAssetListData(rawData, options.settings);
        break;
      case WidgetType.READ_HISTORY:
        transformedData = transformReadHistoryData(rawData, options.settings);
        break;
      default:
        throw new Error(`Unsupported widget type: ${options.widgetType}`);
    }

    const result: TransformedData = {
      widgetId: options.widgetId,
      type: DataType.LOCATION_UPDATE,
      payload: transformedData,
      timestamp: new Date(),
      validationStatus: ValidationStatus.VALID
    };

    // Cache the result if enabled
    if (options.enableCaching) {
      const cacheKey = `${options.widgetId}-${JSON.stringify(rawData)}`;
      transformationCache.set(cacheKey, {
        key: cacheKey,
        duration: options.cacheDuration,
        data: result,
        timestamp: new Date()
      });
    }

    return result;
  } catch (error) {
    console.error('Data transformation error:', error);
    return {
      widgetId: options.widgetId,
      type: DataType.LOCATION_UPDATE,
      payload: null,
      timestamp: new Date(),
      validationStatus: ValidationStatus.INVALID
    };
  }
}

/**
 * Transforms asset data for map visualization with clustering
 */
const transformAssetMapData = memoize(async (
  assetData: any[],
  settings: Record<string, any>
) => {
  const clusters = groupBy(assetData, (asset) => {
    return `${Math.round(asset.current_location.coordinates.latitude * 100) / 100}-${
      Math.round(asset.current_location.coordinates.longitude * 100) / 100
    }`;
  });

  return map(clusters, (assets, key) => ({
    id: key,
    count: assets.length,
    center: {
      latitude: assets[0].current_location.coordinates.latitude,
      longitude: assets[0].current_location.coordinates.longitude
    },
    assets: assets.map(asset => ({
      id: asset.id,
      name: asset.name,
      rfidTag: asset.rfid_tag,
      status: asset.status,
      lastUpdated: asset.updated_at
    }))
  }));
});

/**
 * Transforms asset data for list visualization
 */
function transformAssetListData(
  assetData: any[],
  settings: Record<string, any>
): any[] {
  return assetData.map(asset => ({
    id: asset.id,
    name: asset.name,
    rfidTag: asset.rfid_tag,
    location: asset.current_location.name,
    status: asset.status,
    lastSeen: format(parseISO(asset.updated_at), 'yyyy-MM-dd HH:mm:ss'),
    metadata: asset.metadata
  }));
}

/**
 * Transforms read history data for timeline visualization
 */
function transformReadHistoryData(
  readData: any[],
  settings: Record<string, any>
): any[] {
  return readData.map(read => ({
    id: read.id,
    readerId: read.reader_id,
    rfidTag: read.rfid_tag,
    signalStrength: read.signal_strength,
    quality: read.quality,
    timestamp: format(parseISO(read.read_time), 'yyyy-MM-dd HH:mm:ss'),
    metadata: read.metadata
  }));
}

export {
  type PerformanceConfig,
  type ValidationRules,
  type MetricsData,
  type CacheConfig
};