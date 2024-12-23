// @ts-check
import type { LatLngLiteral } from 'leaflet'; // v1.9.3

/**
 * Default center coordinates for map initialization
 * @type {LatLngLiteral}
 */
const DEFAULT_CENTER: LatLngLiteral = { lat: 0, lng: 0 };

/**
 * Minimum allowed zoom level for map view
 * @constant
 */
const MIN_ZOOM_LEVEL = 2;

/**
 * Maximum allowed zoom level for map view
 * @constant
 */
const MAX_ZOOM_LEVEL = 18;

/**
 * Default zoom level for initial map view
 * @constant
 */
const DEFAULT_ZOOM = 13;

/**
 * Radius in pixels for clustering nearby markers
 * @constant
 */
const CLUSTER_RADIUS = 80;

/**
 * Interval in milliseconds for real-time updates (sub-500ms requirement)
 * @constant
 */
const UPDATE_INTERVAL = 500;

/**
 * Delay in milliseconds before showing hover effects
 * @constant
 */
const HOVER_DELAY = 200;

/**
 * Duration in milliseconds for animations
 * @constant
 */
const ANIMATION_DURATION = 300;

/**
 * Default map configuration values for initialization and behavior
 * @constant
 */
export const MAP_DEFAULTS = {
  center: DEFAULT_CENTER,
  zoom: DEFAULT_ZOOM,
  maxZoom: MAX_ZOOM_LEVEL,
  minZoom: MIN_ZOOM_LEVEL,
  clusterRadius: CLUSTER_RADIUS,
  updateInterval: UPDATE_INTERVAL
} as const;

/**
 * Color definitions for different marker states with accessibility considerations
 * Follows WCAG 2.1 Level AA contrast requirements
 * @constant
 */
export const MARKER_COLORS = {
  active: '#2E7D32',    // Green - Active assets
  inactive: '#757575',  // Gray - Inactive assets
  warning: '#F57C00',   // Orange - Warning state
  error: '#D32F2F',     // Red - Error state
  selected: '#1976D2',  // Blue - Selected assets
  hover: '#673AB7'      // Purple - Hover state
} as const;

/**
 * Configuration for map tile layer with performance optimizations
 * @constant
 */
export const TILE_LAYER_CONFIG = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap contributors',
  maxNativeZoom: MAX_ZOOM_LEVEL,
  tileSize: 256,
  crossOrigin: true
} as const;

/**
 * Style definitions for zone polygons with interactive states
 * @constant
 */
export const ZONE_STYLES = {
  fillColor: '#3F51B5',
  fillOpacity: 0.2,
  weight: 2,
  hoverFillOpacity: 0.4,
  selectedWeight: 3,
  dashArray: '5, 5'
} as const;