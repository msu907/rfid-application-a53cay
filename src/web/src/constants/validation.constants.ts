/**
 * Validation constants and rules for the RFID Asset Tracking System
 * Implements comprehensive form validation using Yup schema validation
 * @version 1.0.0
 */

import * as yup from 'yup'; // version ^1.0.0
import { AssetStatus } from '../types/asset.types';

/**
 * Validation schema definitions using Yup
 * Enforces data integrity and type safety across the application
 */
export const VALIDATION_SCHEMAS = {
  ASSET: {
    rfidTag: yup.string()
      .required('REQUIRED')
      .matches(/^[A-Z0-9]{8,32}$/, 'INVALID_FORMAT')
      .min(8, 'MIN_LENGTH')
      .max(32, 'MAX_LENGTH')
      .trim(),
    
    name: yup.string()
      .required('REQUIRED')
      .min(3, 'MIN_LENGTH')
      .max(100, 'MAX_LENGTH')
      .trim(),
    
    description: yup.string()
      .nullable()
      .max(500, 'MAX_LENGTH')
      .trim(),
    
    imageUrl: yup.string()
      .nullable()
      .matches(/^https?:\/\/.+\.(jpg|jpeg|png|gif)$/, 'INVALID_URL')
      .max(2048, 'MAX_LENGTH'),
    
    status: yup.string()
      .required('REQUIRED')
      .oneOf(Object.values(AssetStatus), 'INVALID_STATUS')
  },

  LOCATION: {
    name: yup.string()
      .required('REQUIRED')
      .min(2, 'MIN_LENGTH')
      .max(100, 'MAX_LENGTH')
      .trim(),
    
    zone: yup.string()
      .required('REQUIRED')
      .matches(/^[A-Z0-9-]+$/, 'INVALID_ZONE')
      .min(2, 'MIN_LENGTH')
      .max(50, 'MAX_LENGTH')
      .trim(),
    
    coordinates: yup.object({
      latitude: yup.number()
        .required('REQUIRED')
        .min(-90, 'MIN_VALUE')
        .max(90, 'MAX_VALUE')
        .test('precision', 'INVALID_COORDINATES', 
          val => val !== undefined && val.toString().split('.')[1]?.length <= 6),
      
      longitude: yup.number()
        .required('REQUIRED')
        .min(-180, 'MIN_VALUE')
        .max(180, 'MAX_VALUE')
        .test('precision', 'INVALID_COORDINATES', 
          val => val !== undefined && val.toString().split('.')[1]?.length <= 6)
    }),
    
    annotation: yup.string()
      .nullable()
      .max(500, 'MAX_LENGTH')
      .trim()
  },

  READER: {
    name: yup.string()
      .required('REQUIRED')
      .min(3, 'MIN_LENGTH')
      .max(100, 'MAX_LENGTH')
      .trim(),
    
    ipAddress: yup.string()
      .required('REQUIRED')
      .matches(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, 'INVALID_IP')
      .test('valid-ip', 'INVALID_IP', value => {
        if (!value) return false;
        return value.split('.').every(num => parseInt(num) <= 255);
      }),
    
    port: yup.number()
      .required('REQUIRED')
      .min(1024, 'MIN_VALUE')
      .max(65535, 'MAX_VALUE')
      .integer(),
    
    powerLevel: yup.number()
      .required('REQUIRED')
      .min(-70, 'MIN_VALUE')
      .max(-20, 'MAX_VALUE')
  }
};

/**
 * Validation rules for direct use in form validation
 * Provides configuration for validation without schema objects
 */
export const VALIDATION_RULES = {
  ASSET: {
    rfidTag: {
      required: true,
      format: '^[A-Z0-9]{8,32}$',
      minLength: 8,
      maxLength: 32,
      sanitize: true
    },
    name: {
      required: true,
      minLength: 3,
      maxLength: 100,
      sanitize: true
    },
    description: {
      required: false,
      maxLength: 500,
      sanitize: true
    },
    imageUrl: {
      required: false,
      format: '^https?://.+\\.(jpg|jpeg|png|gif)$',
      maxLength: 2048,
      sanitize: true
    },
    status: {
      required: true,
      values: Object.values(AssetStatus)
    }
  },

  LOCATION: {
    name: {
      required: true,
      minLength: 2,
      maxLength: 100,
      sanitize: true
    },
    zone: {
      required: true,
      minLength: 2,
      maxLength: 50,
      format: '^[A-Z0-9-]+$',
      sanitize: true
    },
    coordinates: {
      required: true,
      latitude: {
        min: -90,
        max: 90,
        precision: 6
      },
      longitude: {
        min: -180,
        max: 180,
        precision: 6
      }
    },
    annotation: {
      required: false,
      maxLength: 500,
      sanitize: true
    }
  },

  READER: {
    name: {
      required: true,
      minLength: 3,
      maxLength: 100,
      sanitize: true
    },
    ipAddress: {
      required: true,
      format: '^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$',
      sanitize: true
    },
    port: {
      required: true,
      min: 1024,
      max: 65535
    },
    powerLevel: {
      required: true,
      min: -70,
      max: -20,
      unit: 'dBm'
    }
  }
};

/**
 * Error message templates for validation failures
 * Supports parameterized messages with variable substitution
 */
export const ERROR_MESSAGES = {
  REQUIRED: "Field '${field}' is required",
  INVALID_FORMAT: "Invalid format for ${field}",
  MIN_LENGTH: "${field} must be at least ${min} characters",
  MAX_LENGTH: "${field} cannot exceed ${max} characters",
  MIN_VALUE: "${field} must be at least ${min}",
  MAX_VALUE: "${field} cannot exceed ${max}",
  INVALID_IP: "Invalid IP address format (e.g., 192.168.1.1)",
  INVALID_PORT: "Port must be between 1024 and 65535",
  INVALID_COORDINATES: "Coordinates must be valid latitude (-90 to 90) and longitude (-180 to 180)",
  INVALID_STATUS: "Status must be one of: ACTIVE, INACTIVE, MAINTENANCE",
  INVALID_URL: "Invalid URL format (must be HTTP/HTTPS and end with .jpg, .jpeg, .png, or .gif)",
  INVALID_POWER_LEVEL: "Power level must be between -70 dBm and -20 dBm",
  INVALID_ZONE: "Zone must contain only uppercase letters, numbers, and hyphens"
} as const;

/**
 * Helper function to format error messages with parameters
 * @param template Error message template
 * @param params Parameters to substitute in the template
 * @returns Formatted error message
 */
export function formatErrorMessage(
  template: keyof typeof ERROR_MESSAGES,
  params: Record<string, string | number>
): string {
  let message = ERROR_MESSAGES[template];
  Object.entries(params).forEach(([key, value]) => {
    message = message.replace(`\${${key}}`, value.toString());
  });
  return message;
}