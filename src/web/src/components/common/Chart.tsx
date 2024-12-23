/**
 * @fileoverview Enhanced Chart Component
 * @version 1.0.0
 * 
 * A highly optimized React component for rendering accessible, performant charts
 * supporting line, bar, pie, and scatter visualizations with WCAG 2.1 compliance,
 * RTL support, and virtual rendering for large datasets.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'; // v18.0+
import * as d3 from 'd3'; // v7.0+

import { 
  CHART_TYPES, 
  CHART_COLORS, 
  ACCESSIBILITY_LABELS 
} from '../constants/chart.constants';

import {
  virtualizeData,
  createScales
} from '../../utils/chart.utils';

// Constants for chart configuration
const TRANSITION_DURATION = 300;
const TOOLTIP_OFFSET = { x: 10, y: 10 };
const VIRTUALIZATION_THRESHOLD = 1000;
const WORKER_URL = '/workers/chart.worker.js';

// Type definitions
interface ChartProps {
  type: keyof typeof CHART_TYPES;
  data: Array<any>;
  options?: ChartOptions;
  accessibility?: AccessibilityConfig;
}

interface ChartOptions {
  width?: number;
  height?: number;
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  colors?: string[];
  animate?: boolean;
  rtl?: boolean;
  virtualizeThreshold?: number;
}

interface AccessibilityConfig {
  ariaLabel?: string;
  ariaDescription?: string;
  highContrastMode?: boolean;
  keyboardNavigation?: boolean;
  announceDataChanges?: boolean;
}

/**
 * Enhanced Chart component with accessibility and performance optimizations
 */
const Chart: React.FC<ChartProps> = ({
  type,
  data,
  options = {},
  accessibility = {}
}) => {
  // Refs for DOM elements and Web Worker
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const workerRef = useRef<Worker | null>(null);

  // State management
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [virtualizedData, setVirtualizedData] = useState(data);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Custom hook for responsive chart dimensions
   */
  const useChartDimensions = useCallback(() => {
    useEffect(() => {
      if (!containerRef.current) return;

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setDimensions({
            width: options.width || width,
            height: options.height || height
          });
        }
      });

      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }, [options.width, options.height]);

    return dimensions;
  }, [options.width, options.height]);

  /**
   * Initialize Web Worker for data processing
   */
  useEffect(() => {
    if (data.length > (options.virtualizeThreshold || VIRTUALIZATION_THRESHOLD)) {
      workerRef.current = new Worker(WORKER_URL);
      
      workerRef.current.onmessage = (event) => {
        setVirtualizedData(event.data);
        setIsLoading(false);
      };

      return () => workerRef.current?.terminate();
    }
  }, [data, options.virtualizeThreshold]);

  /**
   * Memoized chart scales and configurations
   */
  const chartConfig = useMemo(() => {
    const { width, height } = dimensions;
    const margins = options.margins || { top: 20, right: 20, bottom: 30, left: 40 };
    
    return createScales({
      type,
      data: virtualizedData,
      width,
      height,
      margins,
      rtl: options.rtl
    });
  }, [dimensions, virtualizedData, type, options.rtl]);

  /**
   * Render chart with accessibility features
   */
  const renderChart = useCallback(() => {
    if (!svgRef.current || !chartConfig || isLoading) return;

    const svg = d3.select(svgRef.current);
    
    // Clear previous content with smooth transition
    svg.selectAll('*').transition()
      .duration(options.animate ? TRANSITION_DURATION : 0)
      .style('opacity', 0)
      .remove();

    // Set up accessibility attributes
    svg.attr('role', 'img')
      .attr('aria-label', accessibility.ariaLabel || `${type} chart`)
      .attr('tabindex', accessibility.keyboardNavigation ? 0 : -1);

    // Add high contrast support
    if (accessibility.highContrastMode) {
      svg.classed('high-contrast', true);
    }

    // Render chart based on type
    switch (type) {
      case CHART_TYPES.LINE:
        renderLineChart(svg, chartConfig);
        break;
      case CHART_TYPES.BAR:
        renderBarChart(svg, chartConfig);
        break;
      case CHART_TYPES.PIE:
        renderPieChart(svg, chartConfig);
        break;
      case CHART_TYPES.SCATTER:
        renderScatterChart(svg, chartConfig);
        break;
    }

    // Initialize tooltips
    initializeTooltips(svg);

    // Set up keyboard navigation
    if (accessibility.keyboardNavigation) {
      setupKeyboardNavigation(svg);
    }
  }, [chartConfig, isLoading, type, options.animate, accessibility]);

  /**
   * Initialize accessible tooltips
   */
  const initializeTooltips = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    const tooltip = d3.select(containerRef.current)
      .append('div')
      .attr('class', 'chart-tooltip')
      .attr('role', 'tooltip')
      .style('opacity', 0);

    svg.selectAll('.data-element')
      .on('mouseover focus', (event, d) => {
        tooltip.transition()
          .duration(200)
          .style('opacity', 1);
        
        tooltip.html(getTooltipContent(d))
          .style('left', `${event.pageX + TOOLTIP_OFFSET.x}px`)
          .style('top', `${event.pageY + TOOLTIP_OFFSET.y}px`);
      })
      .on('mouseout blur', () => {
        tooltip.transition()
          .duration(200)
          .style('opacity', 0);
      });
  };

  /**
   * Set up keyboard navigation handlers
   */
  const setupKeyboardNavigation = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
    svg.on('keydown', (event) => {
      const currentElement = document.activeElement;
      if (!currentElement?.classList.contains('data-element')) return;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowLeft':
          navigateDataElements(event.key === 'ArrowRight' ? 1 : -1);
          break;
        case 'Enter':
        case ' ':
          showDataDetails(currentElement);
          break;
      }
    });
  };

  /**
   * Error boundary handler
   */
  if (error) {
    return (
      <div role="alert" className="chart-error">
        <p>Error loading chart: {error.message}</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`chart-container ${type}-chart`}
      style={{ width: '100%', height: '100%' }}
    >
      {isLoading ? (
        <div role="progressbar" className="chart-loading">
          Loading chart...
        </div>
      ) : (
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className={`chart ${options.rtl ? 'rtl' : 'ltr'}`}
          style={{ overflow: 'visible' }}
        />
      )}
    </div>
  );
};

export default Chart;