/**
 * @fileoverview Chart Utility Functions
 * @version 1.0.0
 * 
 * Provides utility functions for data formatting, dimension calculations,
 * and chart transformations used across the RFID asset tracking visualization interface.
 * Implements performance-optimized, type-safe, and accessibility-compliant functions.
 */

import * as d3 from 'd3'; // v7.0+
import { format, formatInTimeZone } from 'date-fns'; // v2.29+
import {
  CHART_TYPES,
  CHART_COLORS,
  CHART_DEFAULTS,
  AXIS_CONFIG,
  TOOLTIP_CONFIG,
  type ChartType,
  type StatusColor
} from '../constants/chart.constants';

// Type definitions for function parameters and returns
export interface TimeSeriesPoint {
  x: Date;
  y: number;
  originalValue?: any;
}

export interface TimeSeriesOptions {
  smoothing?: boolean;
  smoothingWindow?: number;
  timezone?: string;
  excludeNulls?: boolean;
}

export interface ChartMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface DimensionOptions {
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  preserveAspectRatio?: boolean;
  rtl?: boolean;
}

export interface ChartDimensions {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  margins: ChartMargins;
}

// Cache for memoized functions
const memoCache = new Map<string, any>();
const CHART_CACHE_SIZE = 100;

/**
 * Memoization decorator for expensive calculations
 */
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const key = `${propertyKey}-${JSON.stringify(args)}`;
    if (memoCache.has(key)) {
      return memoCache.get(key);
    }
    
    const result = originalMethod.apply(this, args);
    if (memoCache.size >= CHART_CACHE_SIZE) {
      const firstKey = memoCache.keys().next().value;
      memoCache.delete(firstKey);
    }
    memoCache.set(key, result);
    return result;
  };
  return descriptor;
}

/**
 * Debounce decorator for resize calculations
 */
function debounce(delay: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    let timeoutId: NodeJS.Timeout;
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        originalMethod.apply(this, args);
      }, delay);
    };
    return descriptor;
  };
}

/**
 * Formats and validates time-series data for visualization with performance optimization
 * @param data Array of data points containing time and value information
 * @param timeKey Key in data object containing timestamp
 * @param valueKey Key in data object containing numeric value
 * @param options Configuration options for data processing
 * @returns Formatted array of TimeSeriesPoint objects
 */
@memoize
export function formatTimeSeriesData(
  data: Array<any>,
  timeKey: string,
  valueKey: string,
  options: TimeSeriesOptions = {}
): Array<TimeSeriesPoint> {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  // Filter and validate data points
  let validData = data.filter(point => {
    const timeValue = point[timeKey];
    const numericValue = Number(point[valueKey]);
    return timeValue && (!options.excludeNulls || !isNaN(numericValue));
  });

  // Sort data chronologically for proper visualization
  validData.sort((a, b) => new Date(a[timeKey]).getTime() - new Date(b[timeKey]).getTime());

  // Apply data smoothing if requested
  if (options.smoothing && options.smoothingWindow) {
    validData = applyMovingAverage(validData, valueKey, options.smoothingWindow);
  }

  // Format data points with timezone consideration
  return validData.map(point => ({
    x: options.timezone
      ? new Date(formatInTimeZone(point[timeKey], options.timezone, "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"))
      : new Date(point[timeKey]),
    y: Number(point[valueKey]),
    originalValue: point
  }));
}

/**
 * Calculates responsive chart dimensions with accessibility considerations
 * @param containerWidth Width of the container element
 * @param containerHeight Height of the container element
 * @param margins Chart margins configuration
 * @param options Additional dimension calculation options
 * @returns Calculated ChartDimensions object
 */
@debounce(150)
export function calculateChartDimensions(
  containerWidth: number,
  containerHeight: number,
  margins: ChartMargins = CHART_DEFAULTS.margins,
  options: DimensionOptions = {}
): ChartDimensions {
  // Apply minimum dimensions with accessibility considerations
  const minWidth = Math.max(
    options.minWidth || CHART_DEFAULTS.dimensions.minWidth,
    320 // Minimum touch target width
  );
  const minHeight = Math.max(
    options.minHeight || CHART_DEFAULTS.dimensions.minHeight,
    200 // Minimum touch target height
  );

  // Calculate responsive dimensions
  let width = Math.max(minWidth, containerWidth);
  let height = Math.max(minHeight, containerHeight);

  // Apply maximum constraints if specified
  if (options.maxWidth) {
    width = Math.min(width, options.maxWidth);
  }
  if (options.maxHeight) {
    height = Math.min(height, options.maxHeight);
  }

  // Adjust margins for RTL support
  const adjustedMargins = options.rtl
    ? { ...margins, left: margins.right, right: margins.left }
    : margins;

  // Calculate inner dimensions
  const innerWidth = width - adjustedMargins.left - adjustedMargins.right;
  const innerHeight = height - adjustedMargins.top - adjustedMargins.bottom;

  return {
    width,
    height,
    innerWidth,
    innerHeight,
    margins: adjustedMargins
  };
}

/**
 * Applies moving average smoothing to data series
 * @param data Array of data points
 * @param valueKey Key containing numeric values
 * @param window Moving average window size
 * @returns Smoothed data array
 */
function applyMovingAverage(data: Array<any>, valueKey: string, window: number): Array<any> {
  const result = [...data];
  const halfWindow = Math.floor(window / 2);

  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = Math.max(0, i - halfWindow); j < Math.min(data.length, i + halfWindow + 1); j++) {
      const value = Number(data[j][valueKey]);
      if (!isNaN(value)) {
        sum += value;
        count++;
      }
    }
    
    result[i] = {
      ...data[i],
      [valueKey]: count > 0 ? sum / count : data[i][valueKey]
    };
  }

  return result;
}

/**
 * Generates an accessible color scale for data visualization
 * @param dataLength Number of distinct colors needed
 * @param options Color scale configuration options
 * @returns Array of WCAG compliant colors
 */
export function generateAccessibleColorScale(
  dataLength: number,
  options: { colorBlindSafe?: boolean; status?: StatusColor } = {}
): string[] {
  if (options.status) {
    return [CHART_COLORS.status[options.status]];
  }

  const colorArray = options.colorBlindSafe
    ? CHART_COLORS.accessibility.colorBlind.safe
    : CHART_COLORS.primary;

  if (dataLength <= colorArray.length) {
    return colorArray.slice(0, dataLength);
  }

  // Generate additional colors using d3 interpolation
  return d3.quantize(
    d3.interpolateRgb(colorArray[0], colorArray[colorArray.length - 1]),
    dataLength
  );
}

/**
 * Formats date values according to application standards
 * @param date Date to format
 * @param formatType Type of date format to apply
 * @param timezone Optional timezone
 * @returns Formatted date string
 */
export function formatChartDate(
  date: Date,
  formatType: keyof typeof TOOLTIP_CONFIG.formatters.date = 'default',
  timezone?: string
): string {
  const formatString = TOOLTIP_CONFIG.formatters.date[formatType];
  return timezone
    ? formatInTimeZone(date, timezone, formatString)
    : format(date, formatString);
}