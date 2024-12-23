/**
 * @fileoverview Chart Constants and Configurations
 * @version 1.0.0
 * 
 * Defines comprehensive constant values and configurations for chart visualizations
 * used throughout the RFID asset tracking application. Includes type-safe definitions
 * for chart types, accessibility-compliant color schemes, responsive configurations,
 * and internationalization-ready formatting options.
 */

// d3.js v7.0+ - Used for color scale and interpolation functions
import * as d3 from 'd3';

/**
 * Enumeration of available chart types for visualization components
 */
export enum CHART_TYPES {
    LINE = 'line',
    BAR = 'bar',
    PIE = 'pie',
    SCATTER = 'scatter'
}

/**
 * WCAG 2.1 compliant color schemes for different chart types and states
 * All colors have been tested for accessibility compliance
 */
export const CHART_COLORS = {
    // Primary color palette for sequential data visualization
    primary: [
        '#1976D2', // Blue
        '#388E3C', // Green
        '#D32F2F', // Red
        '#7B1FA2', // Purple
        '#FFA000'  // Amber
    ],

    // Status-specific colors with semantic meaning
    status: {
        active: '#4CAF50',    // Green - For active/success states
        inactive: '#F44336',  // Red - For inactive/error states
        warning: '#FFC107',   // Amber - For warning states
        neutral: '#9E9E9E'    // Grey - For neutral/unknown states
    },

    // Accessibility-focused color configurations
    accessibility: {
        contrast: {
            minimum: 4.5,     // WCAG 2.1 Level AA minimum contrast ratio
            enhanced: 7.0     // WCAG 2.1 Level AAA enhanced contrast ratio
        },
        colorBlind: {
            // Colorblind-safe palette based on research
            safe: [
                '#0077BB', // Blue
                '#EE7733', // Orange
                '#009988', // Teal
                '#CC3311'  // Red
            ]
        }
    }
} as const;

/**
 * Default chart configurations for responsive and performance-optimized rendering
 */
export const CHART_DEFAULTS = {
    dimensions: {
        width: 800,          // Default width in pixels
        height: 400,         // Default height in pixels
        minWidth: 320,       // Minimum width for mobile devices
        minHeight: 200       // Minimum height for mobile devices
    },
    margins: {
        top: 20,            // Top margin for title and legend
        right: 30,          // Right margin for y-axis labels
        bottom: 40,         // Bottom margin for x-axis labels
        left: 50            // Left margin for y-axis labels
    },
    animation: {
        duration: 300,      // Animation duration in milliseconds
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // Material Design easing
        performance: {
            threshold: 1000,  // Data point threshold for reduced animation
            reducedMotion: true // Respects user's reduced motion preferences
        }
    },
    responsive: {
        breakpoints: {
            mobile: 320,    // Mobile breakpoint
            tablet: 768,    // Tablet breakpoint
            desktop: 1024,  // Desktop breakpoint
            wide: 1440     // Wide desktop breakpoint
        },
        scaling: {
            factor: 0.8,   // Scale factor for responsive sizing
            minScale: 0.5  // Minimum scale factor
        }
    }
} as const;

/**
 * Axis configurations supporting internationalization and RTL layouts
 */
export const AXIS_CONFIG = {
    xAxis: {
        tickSize: 6,        // Size of axis ticks
        tickPadding: 8,     // Padding between tick and label
        tickRotation: 0,    // Default tick label rotation
        gridLines: true     // Show grid lines by default
    },
    yAxis: {
        tickSize: 6,        // Size of axis ticks
        tickPadding: 8,     // Padding between tick and label
        tickCount: 5,       // Suggested number of ticks
        gridLines: true     // Show grid lines by default
    },
    rtl: {
        enabled: false,     // RTL support flag
        reverseScale: true  // Reverse axis scales in RTL mode
    }
} as const;

/**
 * Tooltip configurations with accessibility and internationalization support
 */
export const TOOLTIP_CONFIG = {
    styles: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 4,
        padding: 8,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        fontSize: 14,
        maxWidth: 300
    },
    formatters: {
        date: {
            default: 'MM/DD/YYYY HH:mm',
            short: 'MM/DD/YY',
            time: 'HH:mm:ss'
        },
        number: {
            default: '0,0.00',    // General number format
            percentage: '0.0%',    // Percentage format
            compact: '0.0a'        // Compact number format
        }
    },
    i18n: {
        rtl: false,
        numberFormat: {
            decimal: '.',
            thousands: ','
        },
        dateFormat: 'ISO'
    }
} as const;

// Type definitions for better TypeScript support
export type ChartType = keyof typeof CHART_TYPES;
export type StatusColor = keyof typeof CHART_COLORS.status;
export type ColorBlindSafe = typeof CHART_COLORS.accessibility.colorBlind.safe[number];
export type DateFormatType = keyof typeof TOOLTIP_CONFIG.formatters.date;
export type NumberFormatType = keyof typeof TOOLTIP_CONFIG.formatters.number;