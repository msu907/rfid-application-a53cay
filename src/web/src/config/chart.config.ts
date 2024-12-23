/**
 * @fileoverview Chart Configuration Factory
 * @version 1.0.0
 * 
 * Provides factory functions and configuration objects for creating optimized chart
 * visualizations in the RFID asset tracking system. Implements performance-optimized,
 * accessible, and responsive chart configurations with real-time update support.
 */

import * as d3 from 'd3'; // v7.0+
import { debounce } from 'lodash'; // v4.17+
import {
  CHART_TYPES,
  CHART_COLORS,
  CHART_DEFAULTS,
  AXIS_CONFIG,
  TOOLTIP_CONFIG,
  ANIMATION_CONFIG,
  type ChartType,
  type StatusColor
} from '../constants/chart.constants';

// Performance thresholds for optimization
const PERFORMANCE_THRESHOLDS = {
  renderTime: 16, // Target 60fps (1000ms/60)
  updateDelay: 100, // Debounce delay for real-time updates
  maxDataPoints: 10000 // Threshold for data decimation
} as const;

// Animation settings following Material Design principles
const ANIMATION_SETTINGS = {
  duration: 300,
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
} as const;

// Accessibility configuration
const ACCESSIBILITY_CONFIG = {
  ariaLabels: true,
  keyboardNav: true,
  highContrast: true
} as const;

/**
 * Interface for chart configuration options
 */
interface ChartConfig {
  type: ChartType;
  container: HTMLElement;
  data: any[];
  dimensions?: {
    width?: number;
    height?: number;
  };
  options?: {
    animate?: boolean;
    responsive?: boolean;
    accessibility?: boolean;
  };
}

/**
 * Interface for line chart specific options
 */
interface LineChartOptions extends ChartConfig {
  timeField: string;
  valueField: string;
  smoothing?: boolean;
  realTime?: boolean;
}

/**
 * Interface for bar chart specific options
 */
interface BarChartOptions extends ChartConfig {
  categoryField: string;
  valueField: string;
  stacked?: boolean;
  groupBy?: string;
}

/**
 * Creates an optimized line chart configuration for time-series data
 * @param options - Line chart configuration options
 * @returns Optimized line chart configuration
 */
function createLineChartConfig(options: LineChartOptions): ChartConfig {
  // Validate required options
  if (!options.timeField || !options.valueField) {
    throw new Error('Time and value fields are required for line charts');
  }

  // Create scales with proper timezone handling
  const xScale = d3.scaleTime()
    .domain(d3.extent(options.data, d => new Date(d[options.timeField])) as [Date, Date])
    .range([0, options.dimensions?.width || CHART_DEFAULTS.dimensions.width]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(options.data, d => d[options.valueField]) as number])
    .range([options.dimensions?.height || CHART_DEFAULTS.dimensions.height, 0]);

  // Configure real-time updates with debouncing
  const updateHandler = options.realTime
    ? debounce((newData: any[]) => {
        // Implement WebGL rendering for large datasets
        if (newData.length > PERFORMANCE_THRESHOLDS.maxDataPoints) {
          return createWebGLLineChart(newData, xScale, yScale);
        }
        return createSVGLineChart(newData, xScale, yScale);
      }, PERFORMANCE_THRESHOLDS.updateDelay)
    : undefined;

  return {
    type: CHART_TYPES.LINE,
    scales: { x: xScale, y: yScale },
    updateHandler,
    accessibility: {
      ...ACCESSIBILITY_CONFIG,
      ariaLabel: `Time series chart of ${options.valueField} over time`,
      role: 'img'
    },
    animation: {
      ...ANIMATION_SETTINGS,
      enabled: options.options?.animate !== false
    },
    responsive: {
      enabled: options.options?.responsive !== false,
      breakpoints: CHART_DEFAULTS.responsive.breakpoints
    }
  };
}

/**
 * Creates an optimized bar chart configuration
 * @param options - Bar chart configuration options
 * @returns Optimized bar chart configuration
 */
function createBarChartConfig(options: BarChartOptions): ChartConfig {
  // Validate required options
  if (!options.categoryField || !options.valueField) {
    throw new Error('Category and value fields are required for bar charts');
  }

  // Create scales with dynamic domain calculation
  const xScale = d3.scaleBand()
    .domain(options.data.map(d => d[options.categoryField]))
    .range([0, options.dimensions?.width || CHART_DEFAULTS.dimensions.width])
    .padding(0.1);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(options.data, d => d[options.valueField]) as number])
    .range([options.dimensions?.height || CHART_DEFAULTS.dimensions.height, 0]);

  return {
    type: CHART_TYPES.BAR,
    scales: { x: xScale, y: yScale },
    accessibility: {
      ...ACCESSIBILITY_CONFIG,
      ariaLabel: `Bar chart of ${options.valueField} by ${options.categoryField}`,
      role: 'img'
    },
    animation: {
      ...ANIMATION_SETTINGS,
      enabled: options.options?.animate !== false
    },
    responsive: {
      enabled: options.options?.responsive !== false,
      breakpoints: CHART_DEFAULTS.responsive.breakpoints
    },
    layout: {
      stacked: options.stacked,
      groupBy: options.groupBy,
      barWidth: calculateResponsiveBarWidth(options)
    }
  };
}

/**
 * Factory function to create chart configurations based on type
 * @param options - Chart configuration options
 * @returns Optimized chart configuration
 */
export function createChartConfig(options: ChartConfig): ChartConfig {
  switch (options.type) {
    case CHART_TYPES.LINE:
      return createLineChartConfig(options as LineChartOptions);
    case CHART_TYPES.BAR:
      return createBarChartConfig(options as BarChartOptions);
    default:
      throw new Error(`Unsupported chart type: ${options.type}`);
  }
}

/**
 * Helper function to calculate responsive bar width
 * @param options - Bar chart options
 * @returns Calculated bar width
 */
function calculateResponsiveBarWidth(options: BarChartOptions): number {
  const containerWidth = options.dimensions?.width || CHART_DEFAULTS.dimensions.width;
  const dataLength = options.data.length;
  const minBarWidth = 20; // Minimum bar width for touch interaction
  
  return Math.max(
    minBarWidth,
    (containerWidth / dataLength) * CHART_DEFAULTS.responsive.scaling.factor
  );
}

/**
 * Helper function to create WebGL-accelerated line chart for large datasets
 * @param data - Chart data
 * @param xScale - X-axis scale
 * @param yScale - Y-axis scale
 * @returns WebGL line chart configuration
 */
function createWebGLLineChart(
  data: any[],
  xScale: d3.ScaleTime<number, number>,
  yScale: d3.ScaleLinear<number, number>
): ChartConfig {
  // Implement WebGL rendering configuration
  return {
    renderer: 'webgl',
    decimation: {
      enabled: true,
      algorithm: 'LTTB', // Largest-Triangle-Three-Buckets
      threshold: PERFORMANCE_THRESHOLDS.maxDataPoints
    },
    // Additional WebGL-specific configurations...
  } as ChartConfig;
}

/**
 * Helper function to create SVG-based line chart for smaller datasets
 * @param data - Chart data
 * @param xScale - X-axis scale
 * @param yScale - Y-axis scale
 * @returns SVG line chart configuration
 */
function createSVGLineChart(
  data: any[],
  xScale: d3.ScaleTime<number, number>,
  yScale: d3.ScaleLinear<number, number>
): ChartConfig {
  return {
    renderer: 'svg',
    line: d3.line()
      .x(d => xScale(new Date(d.time)))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX),
    // Additional SVG-specific configurations...
  } as ChartConfig;
}