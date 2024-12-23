// External imports with versions
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // ^29.0.0
import now from 'performance-now'; // ^2.1.0

// Internal imports
import { 
  transformDashboardData,
  type TransformationOptions,
  type MetricsData,
  type ValidationRules
} from '../../src/utils/data-transformer';
import { WidgetType, ValidationStatus, DataType } from '../../src/models/dashboard.model';

// Mock data setup
const mockAssetData = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Asset 1',
    rfid_tag: 'RF001',
    current_location: {
      name: 'Zone A-1',
      coordinates: { latitude: 40.7128, longitude: -74.0060 }
    },
    status: 'ACTIVE',
    updated_at: '2023-10-01T12:00:00Z',
    metadata: { category: 'Electronics' }
  },
  {
    id: '223e4567-e89b-12d3-a456-426614174001',
    name: 'Test Asset 2',
    rfid_tag: 'RF002',
    current_location: {
      name: 'Zone A-1',
      coordinates: { latitude: 40.7128, longitude: -74.0060 }
    },
    status: 'ACTIVE',
    updated_at: '2023-10-01T12:01:00Z',
    metadata: { category: 'Electronics' }
  }
];

const mockReadData = [
  {
    id: '323e4567-e89b-12d3-a456-426614174002',
    reader_id: 'RD-01',
    rfid_tag: 'RF001',
    signal_strength: -65,
    quality: 'GOOD',
    read_time: '2023-10-01T12:00:00Z',
    metadata: { antenna_id: 1 }
  }
];

// Test configuration
const defaultTransformationOptions: TransformationOptions = {
  widgetId: 'widget-001',
  widgetType: WidgetType.ASSET_MAP,
  settings: {},
  enableCaching: true,
  cacheDuration: 60000,
  validationRules: {
    required: ['id', 'rfid_tag'],
    formats: {
      rfid_tag: /^RF\d{3}$/
    },
    ranges: {
      signal_strength: { min: -100, max: -20 }
    }
  },
  performanceSettings: {
    enableMetrics: true,
    samplingRate: 1,
    timeoutMs: 5000,
    batchSize: 100
  }
};

describe('Data Transformer Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Asset Map Transformation', () => {
    test('should correctly transform asset data for map visualization', async () => {
      const options = {
        ...defaultTransformationOptions,
        widgetType: WidgetType.ASSET_MAP
      };

      const result = await transformDashboardData(mockAssetData, options);

      expect(result).toMatchObject({
        widgetId: options.widgetId,
        type: DataType.LOCATION_UPDATE,
        validationStatus: ValidationStatus.VALID
      });

      expect(result.payload).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            count: 2,
            center: {
              latitude: 40.7128,
              longitude: -74.0060
            },
            assets: expect.arrayContaining([
              expect.objectContaining({
                id: mockAssetData[0].id,
                rfidTag: mockAssetData[0].rfid_tag
              })
            ])
          })
        ])
      );
    });
  });

  describe('Asset List Transformation', () => {
    test('should correctly transform asset data for list visualization', async () => {
      const options = {
        ...defaultTransformationOptions,
        widgetType: WidgetType.ASSET_LIST
      };

      const result = await transformDashboardData(mockAssetData, options);

      expect(result.payload).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: mockAssetData[0].id,
            name: mockAssetData[0].name,
            rfidTag: mockAssetData[0].rfid_tag,
            location: mockAssetData[0].current_location.name
          })
        ])
      );
    });
  });

  describe('Read History Transformation', () => {
    test('should correctly transform read history data', async () => {
      const options = {
        ...defaultTransformationOptions,
        widgetType: WidgetType.READ_HISTORY
      };

      const result = await transformDashboardData(mockReadData, options);

      expect(result.payload).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: mockReadData[0].id,
            readerId: mockReadData[0].reader_id,
            rfidTag: mockReadData[0].rfid_tag,
            signalStrength: mockReadData[0].signal_strength
          })
        ])
      );
    });
  });

  describe('Performance Tests', () => {
    test('should complete transformation within performance threshold', async () => {
      const startTime = now();
      const result = await transformDashboardData(mockAssetData, defaultTransformationOptions);
      const endTime = now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500); // 500ms threshold from requirements
      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics?.transformationTimeMs).toBeLessThan(500);
    });

    test('should effectively use caching for repeated transformations', async () => {
      const options = {
        ...defaultTransformationOptions,
        enableCaching: true,
        cacheDuration: 1000
      };

      // First call - should transform
      const startTime1 = now();
      await transformDashboardData(mockAssetData, options);
      const duration1 = now() - startTime1;

      // Second call - should use cache
      const startTime2 = now();
      await transformDashboardData(mockAssetData, options);
      const duration2 = now() - startTime2;

      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input data gracefully', async () => {
      const invalidData = [{ ...mockAssetData[0], rfid_tag: undefined }];
      const result = await transformDashboardData(invalidData, defaultTransformationOptions);

      expect(result.validationStatus).toBe(ValidationStatus.INVALID);
      expect(result.payload).toBeNull();
    });

    test('should validate data against provided rules', async () => {
      const invalidData = [{
        ...mockAssetData[0],
        rfid_tag: 'INVALID_FORMAT'
      }];

      const result = await transformDashboardData(invalidData, defaultTransformationOptions);
      expect(result.validationStatus).toBe(ValidationStatus.INVALID);
    });

    test('should handle unsupported widget types', async () => {
      const options = {
        ...defaultTransformationOptions,
        widgetType: 'UNSUPPORTED_TYPE' as WidgetType
      };

      const result = await transformDashboardData(mockAssetData, options);
      expect(result.validationStatus).toBe(ValidationStatus.INVALID);
    });
  });

  describe('Memory Management', () => {
    test('should handle large datasets without excessive memory usage', async () => {
      const largeDataset = Array(1000).fill(null).map((_, index) => ({
        ...mockAssetData[0],
        id: `id-${index}`,
        rfid_tag: `RF${String(index).padStart(3, '0')}`
      }));

      const initialMemory = process.memoryUsage().heapUsed;
      const result = await transformDashboardData(largeDataset, defaultTransformationOptions);
      const finalMemory = process.memoryUsage().heapUsed;

      const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;
      expect(memoryIncreaseMB).toBeLessThan(50); // 50MB threshold
      expect(result.performanceMetrics?.memoryUsageMb).toBeDefined();
    });
  });
});