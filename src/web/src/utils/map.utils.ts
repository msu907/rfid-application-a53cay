/**
 * Map utility functions for RFID asset tracking system visualization
 * Provides comprehensive support for real-time location visualization,
 * coordinate transformations, marker management, and responsive features
 * @version 1.0.0
 */

import { LatLng, LatLngBounds, Marker, DivIcon, MarkerOptions } from 'leaflet'; // v1.9.3
import { MarkerClusterGroup, MarkerClusterGroupOptions } from 'leaflet.markercluster'; // v1.5.3
import { Location, Coordinates } from '../types/location.types';
import { MAP_DEFAULTS, MARKER_COLORS, ZONE_STYLES } from '../constants/map.constants';

// Constants for map utility operations
const MARKER_POPUP_OFFSET = { x: 0, y: -35 };
const BOUNDS_PADDING = 0.1;
const COORDINATE_PRECISION = 6;
const CLUSTER_OPTIONS: MarkerClusterGroupOptions = {
  maxClusterRadius: 50,
  spiderfyOnMaxZoom: true,
  zoomToBoundsOnClick: true,
  showCoverageOnHover: false,
  animate: true
};

/**
 * Interface for marker creation options
 */
interface EnhancedMarkerOptions extends MarkerOptions {
  showLabel?: boolean;
  interactive?: boolean;
  clusterGroup?: MarkerClusterGroup;
}

/**
 * Interface for bounds calculation options
 */
interface BoundsOptions {
  padding?: number;
  maxZoom?: number;
  includeInactive?: boolean;
}

/**
 * Creates an enhanced Leaflet marker with interactive features and status-based styling
 * @param location - Location object containing position and metadata
 * @param options - Enhanced marker options for customization
 * @returns Configured Leaflet marker instance
 */
export function createMarker(location: Location, options: EnhancedMarkerOptions = {}): Marker {
  // Validate location coordinates
  const position = convertToLatLng(location.coordinates);
  if (!position) {
    throw new Error(`Invalid coordinates for location: ${location.id}`);
  }

  // Create marker icon based on location status
  const icon = new DivIcon({
    className: `location-marker ${location.active ? 'active' : 'inactive'}`,
    html: `<div style="background-color: ${location.active ? MARKER_COLORS.active : MARKER_COLORS.inactive}"></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30]
  });

  // Configure marker with enhanced options
  const marker = new Marker(position, {
    icon,
    title: location.name,
    alt: `Location marker for ${location.name}`,
    riseOnHover: true,
    keyboard: true,
    ...options
  });

  // Add interactive popup if enabled
  if (options.interactive !== false) {
    marker.bindPopup(
      `<div class="marker-popup">
        <h3>${location.name}</h3>
        <p>Zone: ${location.zone}</p>
        <p>Status: ${location.active ? 'Active' : 'Inactive'}</p>
      </div>`,
      { offset: MARKER_POPUP_OFFSET }
    );
  }

  // Add to cluster group if provided
  if (options.clusterGroup) {
    options.clusterGroup.addLayer(marker);
  }

  // Add hover event handlers
  marker.on('mouseover', () => {
    marker.setZIndexOffset(1000);
    if (location.active) {
      marker.getElement()?.classList.add('marker-hover');
    }
  });

  marker.on('mouseout', () => {
    marker.setZIndexOffset(0);
    marker.getElement()?.classList.remove('marker-hover');
  });

  return marker;
}

/**
 * Calculates optimized map bounds with dynamic padding and viewport constraints
 * @param locations - Array of locations to include in bounds calculation
 * @param options - Options for bounds calculation
 * @returns Optimized LatLngBounds object
 */
export function calculateBounds(
  locations: Location[],
  options: BoundsOptions = {}
): LatLngBounds | null {
  // Handle empty location array
  if (!locations.length) {
    return null;
  }

  // Filter locations based on options
  const validLocations = locations.filter(
    loc => options.includeInactive || loc.active
  );

  if (!validLocations.length) {
    return null;
  }

  // Convert locations to LatLng array
  const points = validLocations
    .map(loc => convertToLatLng(loc.coordinates))
    .filter((point): point is LatLng => point !== null);

  // Create initial bounds
  const bounds = new LatLngBounds(points);

  // Apply padding with validation
  const padding = Math.max(0, Math.min(1, options.padding || BOUNDS_PADDING));
  const paddedBounds = bounds.pad(padding);

  // Apply zoom constraints
  if (options.maxZoom) {
    paddedBounds.maxZoom = Math.min(options.maxZoom, MAP_DEFAULTS.maxZoom);
  }

  return paddedBounds;
}

/**
 * Converts and validates location coordinates to Leaflet LatLng object
 * @param coordinates - Coordinates object to convert
 * @returns Validated LatLng instance or null if invalid
 */
export function convertToLatLng(coordinates: Coordinates): LatLng | null {
  try {
    // Validate coordinate values
    const { latitude, longitude } = coordinates;
    
    if (!isValidCoordinate(latitude, longitude)) {
      return null;
    }

    // Create and return precise LatLng instance
    return new LatLng(
      Number(latitude.toFixed(COORDINATE_PRECISION)),
      Number(longitude.toFixed(COORDINATE_PRECISION))
    );
  } catch (error) {
    console.error('Error converting coordinates:', error);
    return null;
  }
}

/**
 * Creates a marker cluster group with optimized settings
 * @returns Configured MarkerClusterGroup instance
 */
export function createClusterGroup(): MarkerClusterGroup {
  return new MarkerClusterGroup({
    ...CLUSTER_OPTIONS,
    iconCreateFunction: (cluster) => {
      const count = cluster.getChildCount();
      return new DivIcon({
        html: `<div class="cluster-icon">${count}</div>`,
        className: 'custom-cluster-icon',
        iconSize: [40, 40]
      });
    }
  });
}

/**
 * Validates latitude and longitude values
 * @param latitude - Latitude value to validate
 * @param longitude - Longitude value to validate
 * @returns Boolean indicating if coordinates are valid
 */
function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}