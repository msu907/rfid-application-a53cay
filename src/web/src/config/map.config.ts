// @ts-check
import type { MapOptions } from 'leaflet'; // v1.9.3
import type { MarkerClusterGroupOptions } from 'leaflet.markercluster'; // v1.5.3
import { MAP_DEFAULTS } from '../constants/map.constants';

/**
 * Refresh interval for real-time updates (in milliseconds)
 * Optimized for sub-500ms latency requirement
 */
const REFRESH_INTERVAL = 5000;

/**
 * Optimal distance for clustering markers (in pixels)
 */
const CLUSTER_DISTANCE = 80;

/**
 * Maximum radius for marker clusters
 */
const MAX_CLUSTER_RADIUS = 100;

/**
 * Debounce time for wheel zoom events (in milliseconds)
 */
const WHEEL_DEBOUNCE_TIME = 40;

/**
 * Interval for processing marker chunks (in milliseconds)
 */
const CHUNK_INTERVAL = 100;

/**
 * Delay between chunk processing (in milliseconds)
 */
const CHUNK_DELAY = 50;

/**
 * Maximum bounds viscosity for map edge behavior
 */
const MAX_BOUNDS_VISCOSITY = 1.0;

/**
 * Fallback URL for error tiles
 */
const ERROR_TILE_URL = '/assets/error-tile.png';

/**
 * Interface for map performance optimization options
 */
interface MapPerformanceOptions {
  readonly refreshInterval: number;
  readonly maxMarkersPerFrame: number;
  readonly renderBuffer: number;
  readonly paneZIndices: Record<string, number>;
}

/**
 * Interface for tile layer options with error handling
 */
interface TileLayerOptions {
  readonly url: string;
  readonly attribution: string;
  readonly subdomains: string[];
  readonly crossOrigin: string;
  readonly errorTileUrl: string;
  readonly maxNativeZoom: number;
  readonly detectRetina: boolean;
}

/**
 * Comprehensive map configuration object
 * Implements requirements for real-time location display and interactive visualization
 */
export const mapConfig = {
  /**
   * Core map options with accessibility and performance optimizations
   */
  options: {
    center: MAP_DEFAULTS.center,
    zoom: MAP_DEFAULTS.zoom,
    maxZoom: 18,
    minZoom: 2,
    preferCanvas: true, // Better performance for many markers
    wheelDebounceTime: WHEEL_DEBOUNCE_TIME,
    tap: true, // Enable mobile tap handling
    maxBoundsViscosity: MAX_BOUNDS_VISCOSITY,
    keyboard: true, // Accessibility: Enable keyboard navigation
    dragging: true,
    zoomControl: true,
    attributionControl: true,
    fadeAnimation: true,
    zoomAnimation: true,
    markerZoomAnimation: true,
    // Responsive settings based on breakpoints
    minZoomDelta: window.innerWidth < 768 ? 1 : 0.5,
    bounceAtZoomLimits: false, // Prevent bounce effect at zoom limits
  } as MapOptions,

  /**
   * Marker clustering configuration for optimal performance
   */
  clusterOptions: {
    maxClusterRadius: MAX_CLUSTER_RADIUS,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: true,
    zoomToBoundsOnClick: true,
    chunkedLoading: true, // Enable chunked loading for better performance
    chunkInterval: CHUNK_INTERVAL,
    chunkDelay: CHUNK_DELAY,
    animate: true,
    // Additional clustering optimizations
    removeOutsideVisibleBounds: true,
    disableClusteringAtZoom: 18,
    spiderfyDistanceMultiplier: 1.5,
  } as MarkerClusterGroupOptions,

  /**
   * Tile layer configuration with error handling and load balancing
   */
  tileLayer: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    subdomains: ['a', 'b', 'c'], // Load balancing across subdomains
    crossOrigin: 'anonymous',
    errorTileUrl: ERROR_TILE_URL,
    maxNativeZoom: 19,
    detectRetina: true, // Support for high-DPI displays
    // Performance optimizations
    updateWhenIdle: true,
    updateWhenZooming: false,
    keepBuffer: 2,
  } as TileLayerOptions,

  /**
   * Performance optimization settings
   */
  performance: {
    refreshInterval: REFRESH_INTERVAL,
    maxMarkersPerFrame: 100, // Limit markers rendered per frame
    renderBuffer: 0.5, // Additional area to render beyond viewport
    paneZIndices: {
      markers: 600,
      clusters: 650,
      popups: 700,
      tooltips: 650,
      controls: 800,
    },
  } as MapPerformanceOptions,
} as const;

/**
 * Export type definition for type safety when importing
 */
export type MapConfiguration = typeof mapConfig;