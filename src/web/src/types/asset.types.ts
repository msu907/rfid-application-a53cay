/**
 * TypeScript type definitions for asset-related data structures and interfaces.
 * Provides comprehensive type safety for asset management in the RFID tracking system.
 * @version 1.0.0
 */

import { ApiResponse, PaginatedResponse } from '../types/api.types';
import { Location } from '../types/location.types';
import type { PayloadAction } from '@reduxjs/toolkit'; // version 1.9.5

/**
 * Enumeration of possible asset statuses
 */
export enum AssetStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE'
}

/**
 * Human-readable labels for asset statuses
 */
export const ASSET_STATUS_LABELS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  MAINTENANCE: 'Under Maintenance'
} as const;

/**
 * Default placeholder image for assets without custom images
 */
export const DEFAULT_ASSET_IMAGE = '/assets/images/placeholder.png' as const;

/**
 * Minimum signal strength threshold for valid RFID reads (in dBm)
 */
export const SIGNAL_STRENGTH_THRESHOLD = -70;

/**
 * Comprehensive interface for asset information
 */
export interface Asset {
  /** Unique identifier for the asset */
  id: string;
  /** RFID tag identifier */
  rfidTag: string;
  /** Human-readable name of the asset */
  name: string;
  /** Optional description of the asset */
  description: string | null;
  /** URL to the asset's image, if available */
  imageUrl: string | null;
  /** Current status of the asset */
  status: AssetStatus;
  /** ID of the asset's current location */
  locationId: string;
  /** Full location information */
  location: Location;
  /** Timestamp of the last RFID read */
  lastReadTime: Date | null;
  /** Asset creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Interface for asset location history entries
 */
export interface AssetHistory {
  /** Timestamp of the location record */
  timestamp: Date;
  /** ID of the location where the asset was detected */
  locationId: string;
  /** Full location information */
  location: Location;
  /** ID of the RFID reader that detected the asset */
  readerId: string;
  /** Signal strength of the RFID read in dBm */
  signalStrength: number;
  /** Duration spent at this location in seconds */
  duration: number;
}

/**
 * Interface for Redux state management of assets
 */
export interface AssetState {
  /** Map of asset IDs to asset objects */
  assets: Record<string, Asset>;
  /** Loading state indicator */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Currently selected asset ID */
  selectedAssetId: string | null;
  /** Map of operation IDs to their loading states */
  operationStatus: Record<string, boolean>;
}

/**
 * Type alias for paginated asset response
 */
export type PaginatedAssetResponse = PaginatedResponse<Asset>;

/**
 * Type alias for single asset response
 */
export type AssetResponse = ApiResponse<Asset>;

/**
 * Type alias for asset history response
 */
export type AssetHistoryResponse = ApiResponse<AssetHistory[]>;

/**
 * Interface for asset creation payload
 */
export interface CreateAssetPayload {
  rfidTag: string;
  name: string;
  description?: string;
  locationId: string;
  status?: AssetStatus;
}

/**
 * Interface for asset update payload
 */
export interface UpdateAssetPayload {
  id: string;
  name?: string;
  description?: string;
  status?: AssetStatus;
  locationId?: string;
  imageUrl?: string;
}

/**
 * Type guard to check if a value is a valid AssetStatus
 */
export function isAssetStatus(value: unknown): value is AssetStatus {
  return Object.values(AssetStatus).includes(value as AssetStatus);
}

/**
 * Type guard to check if an object is a valid Asset
 */
export function isAsset(value: unknown): value is Asset {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const asset = value as Partial<Asset>;
  
  return (
    typeof asset.id === 'string' &&
    typeof asset.rfidTag === 'string' &&
    typeof asset.name === 'string' &&
    isAssetStatus(asset.status) &&
    typeof asset.locationId === 'string' &&
    asset.location !== undefined &&
    asset.createdAt instanceof Date &&
    asset.updatedAt instanceof Date
  );
}