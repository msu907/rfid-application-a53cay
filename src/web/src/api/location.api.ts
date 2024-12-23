/**
 * @fileoverview Location API client module implementing comprehensive location management
 * functionality with support for hierarchical structures and real-time updates.
 * @version 1.0.0
 */

import { ApiService } from '../services/api.service';
import { apiConfig } from '../config/api.config';
import {
  Location,
  LocationHierarchyNode,
  LocationCreatePayload,
  LocationUpdatePayload,
  LocationResponse,
  LocationHierarchyResponse,
  LocationMetadata
} from '../types/location.types';
import { PaginatedResponse, PaginationParams } from '../types/api.types';

/**
 * Class handling all location-related API requests with comprehensive error handling
 * and support for hierarchical operations.
 */
export class LocationApi {
  private readonly apiService: ApiService;
  private readonly baseUrl: string;
  private hierarchyCache: LocationHierarchyNode[] | null = null;
  private readonly cacheDuration = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  constructor(apiService: ApiService) {
    this.apiService = apiService;
    this.baseUrl = apiConfig.endpoints.locations.base;
  }

  /**
   * Retrieves a paginated list of locations with optional filtering
   * @param params - Pagination and filtering parameters
   * @returns Promise resolving to paginated location data
   */
  public async getLocations(params?: PaginationParams): Promise<PaginatedResponse<Location>> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }

    const url = `${this.baseUrl}?${queryParams.toString()}`;
    return this.apiService.get<PaginatedResponse<Location>>(url);
  }

  /**
   * Retrieves a specific location by ID
   * @param locationId - Unique location identifier
   * @returns Promise resolving to location details
   */
  public async getLocationById(locationId: string): Promise<LocationResponse> {
    const url = apiConfig.endpoints.locations.detail(locationId);
    return this.apiService.get<Location>(url);
  }

  /**
   * Creates a new location
   * @param payload - Location creation data
   * @returns Promise resolving to created location
   */
  public async createLocation(payload: LocationCreatePayload): Promise<LocationResponse> {
    const response = await this.apiService.post<Location>(this.baseUrl, payload);
    this.invalidateHierarchyCache();
    return response;
  }

  /**
   * Updates an existing location
   * @param locationId - Location identifier
   * @param payload - Location update data
   * @returns Promise resolving to updated location
   */
  public async updateLocation(
    locationId: string,
    payload: LocationUpdatePayload
  ): Promise<LocationResponse> {
    const url = apiConfig.endpoints.locations.detail(locationId);
    const response = await this.apiService.put<Location>(url, payload);
    this.invalidateHierarchyCache();
    return response;
  }

  /**
   * Deletes a location
   * @param locationId - Location identifier
   * @returns Promise resolving to void
   */
  public async deleteLocation(locationId: string): Promise<void> {
    const url = apiConfig.endpoints.locations.detail(locationId);
    await this.apiService.delete(url);
    this.invalidateHierarchyCache();
  }

  /**
   * Retrieves complete location hierarchy with caching
   * @param forceRefresh - Force cache refresh
   * @returns Promise resolving to location hierarchy
   */
  public async getLocationHierarchy(forceRefresh = false): Promise<LocationHierarchyNode[]> {
    if (
      !forceRefresh &&
      this.hierarchyCache &&
      Date.now() - this.lastCacheUpdate < this.cacheDuration
    ) {
      return this.hierarchyCache;
    }

    const url = apiConfig.endpoints.locations.hierarchy;
    const response = await this.apiService.get<LocationHierarchyNode[]>(url);
    
    this.hierarchyCache = response.data;
    this.lastCacheUpdate = Date.now();
    
    return response.data;
  }

  /**
   * Updates location metadata
   * @param locationId - Location identifier
   * @param metadata - Updated metadata
   * @returns Promise resolving to updated location
   */
  public async updateLocationMetadata(
    locationId: string,
    metadata: Partial<LocationMetadata>
  ): Promise<LocationResponse> {
    const url = `${apiConfig.endpoints.locations.detail(locationId)}/metadata`;
    const response = await this.apiService.put<Location>(url, metadata);
    this.invalidateHierarchyCache();
    return response;
  }

  /**
   * Moves a location in the hierarchy
   * @param locationId - Location to move
   * @param newParentId - New parent location ID
   * @returns Promise resolving to updated location
   */
  public async moveLocation(
    locationId: string,
    newParentId: string | null
  ): Promise<LocationResponse> {
    // Validate move operation
    if (locationId === newParentId) {
      throw new Error('Cannot move location to itself');
    }

    if (newParentId) {
      const hierarchy = await this.getLocationHierarchy();
      if (this.wouldCreateCycle(hierarchy, locationId, newParentId)) {
        throw new Error('Move operation would create circular reference');
      }
    }

    const url = `${apiConfig.endpoints.locations.detail(locationId)}/move`;
    const response = await this.apiService.put<Location>(url, { parentId: newParentId });
    this.invalidateHierarchyCache();
    return response;
  }

  /**
   * Checks if moving a location would create a circular reference
   * @private
   */
  private wouldCreateCycle(
    hierarchy: LocationHierarchyNode[],
    sourceId: string,
    targetId: string
  ): boolean {
    const findNode = (nodes: LocationHierarchyNode[], id: string): LocationHierarchyNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = findNode(node.children, id);
        if (found) return found;
      }
      return null;
    };

    const targetNode = findNode(hierarchy, targetId);
    if (!targetNode) return false;

    const isDescendant = (node: LocationHierarchyNode): boolean => {
      if (node.id === sourceId) return true;
      return node.children.some(child => isDescendant(child));
    };

    return isDescendant(targetNode);
  }

  /**
   * Invalidates the hierarchy cache
   * @private
   */
  private invalidateHierarchyCache(): void {
    this.hierarchyCache = null;
    this.lastCacheUpdate = 0;
  }
}