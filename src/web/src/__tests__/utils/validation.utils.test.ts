/**
 * Comprehensive test suite for validation utility functions
 * Tests form validation, data integrity, and WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

import { describe, expect, test } from '@jest/globals'; // version ^29.0.0
import { 
  validateAsset,
  validateLocation,
  validateReader,
  sanitizeInput,
  formatErrorMessage
} from '../../utils/validation.utils';
import { VALIDATION_RULES, ERROR_MESSAGES } from '../../constants/validation.constants';
import { AssetStatus } from '../../types/asset.types';

describe('sanitizeInput', () => {
  test('should sanitize input with potential XSS content', async () => {
    const maliciousInput = '<script>alert("xss")</script>Test';
    const sanitized = sanitizeInput(maliciousInput);
    expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;Test');
  });

  test('should handle empty input', async () => {
    expect(sanitizeInput('')).toBe('');
    expect(sanitizeInput(null as unknown as string)).toBe('');
    expect(sanitizeInput(undefined as unknown as string)).toBe('');
  });

  test('should trim whitespace', async () => {
    expect(sanitizeInput('  test  ')).toBe('test');
  });
});

describe('formatErrorMessage', () => {
  test('should format error message with ARIA attributes', async () => {
    const message = formatErrorMessage('Field is required', 'name');
    expect(message).toContain('role="alert"');
    expect(message).toContain('aria-label="Error for name"');
  });

  test('should escape HTML in field names', async () => {
    const message = formatErrorMessage('Field is required', '<script>name</script>');
    expect(message).not.toContain('<script>');
  });
});

describe('validateAsset', () => {
  const validAssetData = {
    rfidTag: 'ABCD1234',
    name: 'Test Asset',
    description: 'Test Description',
    imageUrl: 'https://example.com/image.jpg',
    status: AssetStatus.ACTIVE
  };

  test('should validate valid asset data', async () => {
    const result = await validateAsset(validAssetData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  test('should validate required fields', async () => {
    const invalidData = { ...validAssetData, rfidTag: '' };
    const result = await validateAsset(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors.rfidTag).toBeDefined();
    expect(result.ariaDescriptions.rfidTag).toContain('role="alert"');
  });

  test('should validate RFID tag format', async () => {
    const invalidData = { ...validAssetData, rfidTag: 'invalid!' };
    const result = await validateAsset(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors.rfidTag).toContain('Invalid format');
  });

  test('should validate name length constraints', async () => {
    const tooShortName = { ...validAssetData, name: 'A' };
    const result = await validateAsset(tooShortName);
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toContain('must be at least');
  });

  test('should validate optional description', async () => {
    const longDescription = { ...validAssetData, description: 'A'.repeat(501) };
    const result = await validateAsset(longDescription);
    expect(result.isValid).toBe(false);
    expect(result.errors.description).toBeDefined();
  });

  test('should validate image URL format', async () => {
    const invalidUrl = { ...validAssetData, imageUrl: 'not-a-url' };
    const result = await validateAsset(invalidUrl);
    expect(result.isValid).toBe(false);
    expect(result.errors.imageUrl).toContain('Invalid');
  });

  test('should validate status enum values', async () => {
    const invalidStatus = { ...validAssetData, status: 'INVALID' };
    const result = await validateAsset(invalidStatus);
    expect(result.isValid).toBe(false);
    expect(result.errors.status).toBeDefined();
  });
});

describe('validateLocation', () => {
  const validLocationData = {
    name: 'Test Location',
    zone: 'ZONE-A1',
    coordinates: {
      latitude: 45.0,
      longitude: -75.0
    },
    annotation: 'Test Annotation'
  };

  test('should validate valid location data', async () => {
    const result = await validateLocation(validLocationData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  test('should validate required fields', async () => {
    const invalidData = { ...validLocationData, name: '' };
    const result = await validateLocation(invalidData);
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  test('should validate zone format', async () => {
    const invalidZone = { ...validLocationData, zone: 'invalid!' };
    const result = await validateLocation(invalidZone);
    expect(result.isValid).toBe(false);
    expect(result.errors.zone).toContain('Invalid');
  });

  test('should validate coordinate bounds', async () => {
    const invalidCoords = {
      ...validLocationData,
      coordinates: { latitude: 91, longitude: -181 }
    };
    const result = await validateLocation(invalidCoords);
    expect(result.isValid).toBe(false);
    expect(result.errors['coordinates.latitude']).toBeDefined();
    expect(result.errors['coordinates.longitude']).toBeDefined();
  });

  test('should validate coordinate precision', async () => {
    const invalidPrecision = {
      ...validLocationData,
      coordinates: { latitude: 45.1234567, longitude: -75.1234567 }
    };
    const result = await validateLocation(invalidPrecision);
    expect(result.isValid).toBe(false);
    expect(result.errors['coordinates.latitude']).toContain('Invalid');
  });
});

describe('validateReader', () => {
  const validReaderData = {
    name: 'Test Reader',
    ipAddress: '192.168.1.100',
    port: 5084,
    powerLevel: -50
  };

  test('should validate valid reader data', async () => {
    const result = await validateReader(validReaderData);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  test('should validate IP address format', async () => {
    const invalidIp = { ...validReaderData, ipAddress: '256.256.256.256' };
    const result = await validateReader(invalidIp);
    expect(result.isValid).toBe(false);
    expect(result.errors.ipAddress).toContain('Invalid IP');
  });

  test('should validate port range', async () => {
    const invalidPort = { ...validReaderData, port: 70000 };
    const result = await validateReader(invalidPort);
    expect(result.isValid).toBe(false);
    expect(result.errors.port).toContain('cannot exceed');
  });

  test('should validate power level range', async () => {
    const invalidPower = { ...validReaderData, powerLevel: -80 };
    const result = await validateReader(invalidPower);
    expect(result.isValid).toBe(false);
    expect(result.errors.powerLevel).toContain('must be at least');
  });

  test('should validate required fields', async () => {
    const missingFields = {
      name: 'Test Reader'
    };
    const result = await validateReader(missingFields);
    expect(result.isValid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThan(0);
  });

  test('should validate name length', async () => {
    const longName = { ...validReaderData, name: 'A'.repeat(101) };
    const result = await validateReader(longName);
    expect(result.isValid).toBe(false);
    expect(result.errors.name).toContain('cannot exceed');
  });
});