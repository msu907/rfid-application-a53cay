/**
 * @fileoverview Date manipulation utilities for RFID Asset Tracking System
 * @version 1.0.0
 * @license MIT
 */

import {
  format,
  parse,
  isValid,
  isAfter,
  isBefore,
  startOfDay,
  endOfDay,
  subDays,
  addDays,
} from 'date-fns'; // v2.29+
import { enUS } from 'date-fns/locale'; // v2.29+

// Interfaces
export interface DateRange {
  startDate: Date;
  endDate: Date;
  timezone: string;
  isValid: boolean;
}

export interface DateFormatOptions {
  includeTime?: boolean;
  format?: string;
  timezone?: string;
  locale?: string;
}

export interface ValidationOptions {
  maxRange?: number;
  allowFuture?: boolean;
  timezone?: string;
}

export interface TimeAgoOptions {
  locale?: string;
  style?: 'long' | 'short' | 'narrow';
  granularity?: number;
}

// Constants
const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_LOCALE = 'en-US';
const MAX_DATE_RANGE_DAYS = 365;
const DATE_FORMAT_CACHE = new Map<string, string>();

/**
 * Formats a date object into a standardized string representation
 * @param date - The date to format
 * @param options - Formatting options
 * @returns Formatted date string
 * @throws {Error} If date is invalid
 */
export const formatDateTime = (
  date: Date,
  options: DateFormatOptions = {}
): string => {
  if (!isValid(date)) {
    throw new Error('Invalid date provided to formatDateTime');
  }

  const {
    includeTime = false,
    format: customFormat,
    timezone = DEFAULT_TIMEZONE,
    locale = DEFAULT_LOCALE,
  } = options;

  // Create cache key for memoization
  const cacheKey = `${date.getTime()}-${includeTime}-${customFormat}-${timezone}-${locale}`;
  
  if (DATE_FORMAT_CACHE.has(cacheKey)) {
    return DATE_FORMAT_CACHE.get(cacheKey)!;
  }

  try {
    const formatString = customFormat || (includeTime ? 'yyyy-MM-dd HH:mm:ss' : 'yyyy-MM-dd');
    const formattedDate = format(date, formatString, {
      locale: enUS,
      timeZone: timezone,
    });

    // Cache the result for future use
    DATE_FORMAT_CACHE.set(cacheKey, formattedDate);
    
    return formattedDate;
  } catch (error) {
    console.error('Error formatting date:', error);
    throw new Error('Failed to format date');
  }
};

/**
 * Parses a date string into a Date object
 * @param dateString - The string to parse
 * @param options - Parsing options
 * @returns Parsed Date object or null if invalid
 */
export const parseDate = (
  dateString: string,
  options: DateFormatOptions = {}
): Date | null => {
  if (!dateString) {
    return null;
  }

  const {
    format: dateFormat = 'yyyy-MM-dd',
    timezone = DEFAULT_TIMEZONE,
  } = options;

  try {
    // Sanitize input
    const sanitizedString = dateString.trim();
    
    const parsedDate = parse(sanitizedString, dateFormat, new Date());
    
    if (!isValid(parsedDate)) {
      return null;
    }

    // Adjust for timezone if needed
    if (timezone !== DEFAULT_TIMEZONE) {
      const offset = new Date().getTimezoneOffset();
      parsedDate.setMinutes(parsedDate.getMinutes() + offset);
    }

    return parsedDate;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};

/**
 * Calculates start and end dates for predefined time ranges
 * @param rangeType - Type of range to calculate
 * @param options - Range calculation options
 * @returns DateRange object
 */
export const getDateRange = (
  rangeType: 'today' | 'week' | 'month' | 'custom',
  options: ValidationOptions = {}
): DateRange => {
  const { timezone = DEFAULT_TIMEZONE } = options;
  const now = new Date();

  let startDate: Date;
  let endDate: Date;

  switch (rangeType) {
    case 'today':
      startDate = startOfDay(now);
      endDate = endOfDay(now);
      break;
    case 'week':
      startDate = startOfDay(subDays(now, 7));
      endDate = endOfDay(now);
      break;
    case 'month':
      startDate = startOfDay(subDays(now, 30));
      endDate = endOfDay(now);
      break;
    default:
      startDate = startOfDay(now);
      endDate = endOfDay(now);
  }

  return {
    startDate,
    endDate,
    timezone,
    isValid: true,
  };
};

/**
 * Validates a date range
 * @param startDate - Range start date
 * @param endDate - Range end date
 * @param options - Validation options
 * @returns Validation result
 */
export const validateDateRange = (
  startDate: Date,
  endDate: Date,
  options: ValidationOptions = {}
): { isValid: boolean; error?: string } => {
  const {
    maxRange = MAX_DATE_RANGE_DAYS,
    allowFuture = false,
    timezone = DEFAULT_TIMEZONE,
  } = options;

  if (!isValid(startDate) || !isValid(endDate)) {
    return { isValid: false, error: 'Invalid date provided' };
  }

  if (!isAfter(endDate, startDate)) {
    return { isValid: false, error: 'End date must be after start date' };
  }

  const now = new Date();
  if (!allowFuture && isAfter(endDate, now)) {
    return { isValid: false, error: 'Future dates not allowed' };
  }

  const daysDifference = Math.abs(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysDifference > maxRange) {
    return {
      isValid: false,
      error: `Date range cannot exceed ${maxRange} days`,
    };
  }

  return { isValid: true };
};

/**
 * Calculates relative time string from a given date
 * @param date - The date to calculate from
 * @param options - Formatting options
 * @returns Relative time string
 */
export const getTimeAgo = (
  date: Date,
  options: TimeAgoOptions = {}
): string => {
  const {
    locale = DEFAULT_LOCALE,
    style = 'long',
    granularity = 1,
  } = options;

  if (!isValid(date)) {
    throw new Error('Invalid date provided to getTimeAgo');
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Cache key for frequent calculations
  const cacheKey = `${date.getTime()}-${style}-${granularity}`;
  if (DATE_FORMAT_CACHE.has(cacheKey)) {
    return DATE_FORMAT_CACHE.get(cacheKey)!;
  }

  let timeAgo: string;
  if (diffInSeconds < 60) {
    timeAgo = 'just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    timeAgo = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    timeAgo = `${days} day${days > 1 ? 's' : ''} ago`;
  }

  // Cache the result
  DATE_FORMAT_CACHE.set(cacheKey, timeAgo);

  return timeAgo;
};

// Clear cache periodically to prevent memory leaks
setInterval(() => {
  DATE_FORMAT_CACHE.clear();
}, 3600000); // Clear every hour