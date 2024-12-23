/**
 * TypeScript type definitions for location-related data structures and interfaces.
 * Provides comprehensive type safety for location management in the RFID asset tracking system.
 * @version 1.0.0
 */

import { ApiResponse } from '../types/api.types';

/**
 * Geographic coordinates interface with optional elevation data
 */
export interface Coordinates {
  /** Latitude in decimal degrees */
  latitude: number;
  /** Longitude in decimal degrees */
  longitude: number;
  /** Optional elevation in meters above sea level */
  elevation?: number;
}

/**
 * Enumeration of location types in the hierarchical structure
 */
export enum LocationType {
  /** Top-level location type representing a building */
  BUILDING = 'BUILDING',
  /** Mid-level location type representing a floor within a building */
  FLOOR = 'FLOOR',
  /** Specific area within a floor for asset tracking */
  ZONE = 'ZONE',
  /** Smallest trackable area within a zone */
  AREA = 'AREA'
}

/**
 * Comprehensive interface for location information
 */
export interface Location {
  /** Unique identifier for the location */
  id: string;
  /** Human-readable name of the location */
  name: string;
  /** Type of location in the hierarchy */
  type: LocationType;
  /** Zone identifier for grouping related locations */
  zone: string;
  /** Geographic coordinates of the location */
  coordinates: Coordinates;
  /** Optional descriptive text or notes about the location */
  annotation: string;
  /** Indicates if the location is currently active */
  active: boolean;
  /** Maximum number of assets that can be stored in this location */
  capacity: number;
  /** Reference to parent location ID, null for top-level locations */
  parentId: string | null;
}

/**
 * Interface for location metadata including utilization metrics
 */
export interface LocationMetadata {
  /** Current number of assets in the location */
  assetCount: number;
  /** Current capacity utilization as a percentage */
  capacityUtilization: number;
  /** Timestamp of the last update to this location */
  lastUpdated: Date;
}

/**
 * Interface for representing hierarchical location structure
 */
export interface LocationHierarchyNode {
  /** Unique identifier for the location node */
  id: string;
  /** Human-readable name of the location */
  name: string;
  /** Type of location in the hierarchy */
  type: LocationType;
  /** Array of child locations */
  children: LocationHierarchyNode[];
  /** Additional metadata about the location */
  metadata: LocationMetadata;
}

/**
 * Type definition for location creation payload
 * Omits auto-generated fields like id and includes all required fields
 */
export type LocationCreatePayload = {
  /** Human-readable name of the location */
  name: string;
  /** Type of location in the hierarchy */
  type: LocationType;
  /** Zone identifier for grouping related locations */
  zone: string;
  /** Geographic coordinates of the location */
  coordinates: Coordinates;
  /** Optional descriptive text or notes about the location */
  annotation: string;
  /** Maximum number of assets that can be stored in this location */
  capacity: number;
  /** Reference to parent location ID, null for top-level locations */
  parentId: string | null;
};

/**
 * Type definition for location update payload
 * All fields are optional to allow partial updates
 */
export type LocationUpdatePayload = {
  /** Updated name of the location */
  name?: string;
  /** Updated type of location */
  type?: LocationType;
  /** Updated zone identifier */
  zone?: string;
  /** Updated geographic coordinates */
  coordinates?: Coordinates;
  /** Updated annotation text */
  annotation?: string;
  /** Updated active status */
  active?: boolean;
  /** Updated capacity value */
  capacity?: number;
};

/**
 * Type alias for API response containing location data
 */
export type LocationResponse = ApiResponse<Location>;

/**
 * Type alias for API response containing location hierarchy data
 */
export type LocationHierarchyResponse = ApiResponse<LocationHierarchyNode>;