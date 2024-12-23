/**
 * Comprehensive validation utilities for form validation and data integrity checks
 * Implements WCAG 2.1 Level AA compliant validation with enhanced security measures
 * @version 1.0.0
 */

import * as yup from 'yup'; // version ^1.0.0
import DOMPurify from 'dompurify'; // version ^3.0.0
import { VALIDATION_RULES, ERROR_MESSAGES } from '../constants/validation.constants';
import { AssetStatus } from '../types/asset.types';

/**
 * Interface for validation result with accessibility support
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  ariaDescriptions: Record<string, string>;
}

/**
 * Sanitizes input strings to prevent XSS attacks
 * @param input - String to sanitize
 * @returns Sanitized string safe for rendering
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Trim and sanitize the input
  const trimmed = input.trim();
  const sanitized = DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [], // Strip all HTML tags
    ALLOWED_ATTR: [] // Strip all attributes
  });
  
  // Encode special characters
  return sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats error messages with ARIA labels for accessibility
 * @param message - Error message template
 * @param fieldName - Name of the field with error
 * @returns Formatted error message with ARIA attributes
 */
export function formatErrorMessage(message: string, fieldName: string): string {
  const formattedMessage = message.replace('${field}', fieldName);
  return `<span role="alert" aria-label="Error for ${fieldName}">${formattedMessage}</span>`;
}

/**
 * Validates asset form data with enhanced security and accessibility
 * @param formData - Asset form data to validate
 * @returns Promise resolving to ValidationResult
 */
export async function validateAsset(formData: Record<string, unknown>): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: {},
    ariaDescriptions: {}
  };

  try {
    // Create validation schema
    const schema = yup.object().shape({
      rfidTag: yup.string()
        .required(ERROR_MESSAGES.REQUIRED)
        .matches(new RegExp(VALIDATION_RULES.ASSET.rfidTag.format), ERROR_MESSAGES.INVALID_FORMAT)
        .min(VALIDATION_RULES.ASSET.rfidTag.minLength, ERROR_MESSAGES.MIN_LENGTH)
        .max(VALIDATION_RULES.ASSET.rfidTag.maxLength, ERROR_MESSAGES.MAX_LENGTH),
      
      name: yup.string()
        .required(ERROR_MESSAGES.REQUIRED)
        .min(VALIDATION_RULES.ASSET.name.minLength, ERROR_MESSAGES.MIN_LENGTH)
        .max(VALIDATION_RULES.ASSET.name.maxLength, ERROR_MESSAGES.MAX_LENGTH)
        .transform(value => sanitizeInput(value)),
      
      description: yup.string()
        .nullable()
        .max(VALIDATION_RULES.ASSET.description.maxLength, ERROR_MESSAGES.MAX_LENGTH)
        .transform(value => value ? sanitizeInput(value) : null),
      
      imageUrl: yup.string()
        .nullable()
        .matches(new RegExp(VALIDATION_RULES.ASSET.imageUrl.format), ERROR_MESSAGES.INVALID_URL)
        .max(VALIDATION_RULES.ASSET.imageUrl.maxLength, ERROR_MESSAGES.MAX_LENGTH),
      
      status: yup.string()
        .required(ERROR_MESSAGES.REQUIRED)
        .oneOf(Object.values(AssetStatus), ERROR_MESSAGES.INVALID_STATUS)
    });

    await schema.validate(formData, { abortEarly: false });
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      result.isValid = false;
      err.inner.forEach(error => {
        if (error.path) {
          result.errors[error.path] = error.message;
          result.ariaDescriptions[error.path] = formatErrorMessage(error.message, error.path);
        }
      });
    }
  }

  return result;
}

/**
 * Validates location data with coordinate precision and security checks
 * @param formData - Location form data to validate
 * @returns Promise resolving to ValidationResult
 */
export async function validateLocation(formData: Record<string, unknown>): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: {},
    ariaDescriptions: {}
  };

  try {
    const schema = yup.object().shape({
      name: yup.string()
        .required(ERROR_MESSAGES.REQUIRED)
        .min(VALIDATION_RULES.LOCATION.name.minLength, ERROR_MESSAGES.MIN_LENGTH)
        .max(VALIDATION_RULES.LOCATION.name.maxLength, ERROR_MESSAGES.MAX_LENGTH)
        .transform(value => sanitizeInput(value)),
      
      zone: yup.string()
        .required(ERROR_MESSAGES.REQUIRED)
        .matches(new RegExp(VALIDATION_RULES.LOCATION.zone.format), ERROR_MESSAGES.INVALID_ZONE)
        .min(VALIDATION_RULES.LOCATION.zone.minLength, ERROR_MESSAGES.MIN_LENGTH)
        .max(VALIDATION_RULES.LOCATION.zone.maxLength, ERROR_MESSAGES.MAX_LENGTH),
      
      coordinates: yup.object({
        latitude: yup.number()
          .required(ERROR_MESSAGES.REQUIRED)
          .min(VALIDATION_RULES.LOCATION.coordinates.latitude.min, ERROR_MESSAGES.MIN_VALUE)
          .max(VALIDATION_RULES.LOCATION.coordinates.latitude.max, ERROR_MESSAGES.MAX_VALUE)
          .test('precision', ERROR_MESSAGES.INVALID_COORDINATES, 
            val => val !== undefined && val.toString().split('.')[1]?.length <= VALIDATION_RULES.LOCATION.coordinates.latitude.precision),
        
        longitude: yup.number()
          .required(ERROR_MESSAGES.REQUIRED)
          .min(VALIDATION_RULES.LOCATION.coordinates.longitude.min, ERROR_MESSAGES.MIN_VALUE)
          .max(VALIDATION_RULES.LOCATION.coordinates.longitude.max, ERROR_MESSAGES.MAX_VALUE)
          .test('precision', ERROR_MESSAGES.INVALID_COORDINATES,
            val => val !== undefined && val.toString().split('.')[1]?.length <= VALIDATION_RULES.LOCATION.coordinates.longitude.precision)
      }),
      
      annotation: yup.string()
        .nullable()
        .max(VALIDATION_RULES.LOCATION.annotation.maxLength, ERROR_MESSAGES.MAX_LENGTH)
        .transform(value => value ? sanitizeInput(value) : null)
    });

    await schema.validate(formData, { abortEarly: false });
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      result.isValid = false;
      err.inner.forEach(error => {
        if (error.path) {
          result.errors[error.path] = error.message;
          result.ariaDescriptions[error.path] = formatErrorMessage(error.message, error.path);
        }
      });
    }
  }

  return result;
}

/**
 * Validates reader configuration with enhanced network validation
 * @param formData - Reader form data to validate
 * @returns Promise resolving to ValidationResult
 */
export async function validateReader(formData: Record<string, unknown>): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: {},
    ariaDescriptions: {}
  };

  try {
    const schema = yup.object().shape({
      name: yup.string()
        .required(ERROR_MESSAGES.REQUIRED)
        .min(VALIDATION_RULES.READER.name.minLength, ERROR_MESSAGES.MIN_LENGTH)
        .max(VALIDATION_RULES.READER.name.maxLength, ERROR_MESSAGES.MAX_LENGTH)
        .transform(value => sanitizeInput(value)),
      
      ipAddress: yup.string()
        .required(ERROR_MESSAGES.REQUIRED)
        .matches(new RegExp(VALIDATION_RULES.READER.ipAddress.format), ERROR_MESSAGES.INVALID_IP)
        .test('valid-ip', ERROR_MESSAGES.INVALID_IP, value => {
          if (!value) return false;
          return value.split('.').every(num => {
            const parsed = parseInt(num);
            return parsed >= 0 && parsed <= 255;
          });
        }),
      
      port: yup.number()
        .required(ERROR_MESSAGES.REQUIRED)
        .min(VALIDATION_RULES.READER.port.min, ERROR_MESSAGES.MIN_VALUE)
        .max(VALIDATION_RULES.READER.port.max, ERROR_MESSAGES.MAX_VALUE)
        .integer(),
      
      powerLevel: yup.number()
        .required(ERROR_MESSAGES.REQUIRED)
        .min(VALIDATION_RULES.READER.powerLevel.min, ERROR_MESSAGES.MIN_VALUE)
        .max(VALIDATION_RULES.READER.powerLevel.max, ERROR_MESSAGES.MAX_VALUE)
    });

    await schema.validate(formData, { abortEarly: false });
  } catch (err) {
    if (err instanceof yup.ValidationError) {
      result.isValid = false;
      err.inner.forEach(error => {
        if (error.path) {
          result.errors[error.path] = error.message;
          result.ariaDescriptions[error.path] = formatErrorMessage(error.message, error.path);
        }
      });
    }
  }

  return result;
}