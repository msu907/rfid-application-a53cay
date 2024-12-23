import { useEffect, useState, useCallback } from 'react'; // ^18.2.0
import { debounce } from 'lodash'; // ^4.17.21
import { 
  Location, 
  LocationType, 
  LocationHierarchyNode,
  LocationCreatePayload,
  LocationUpdatePayload 
} from '../types/location.types';
import WebSocketService, { WEBSOCKET_EVENTS } from '../services/websocket.service';
import { createAxiosInstance, apiConfig } from '../config/api.config';
import { ApiResponse } from '../types/api.types';

/**
 * Interface for location cache entry with TTL
 */
interface LocationCacheEntry {
  data: Location;
  timestamp: number;
}

/**
 * Interface for hook return value
 */
interface UseLocationReturn {
  locations: Location[];
  locationTree: LocationHierarchyNode[];
  isLoading: boolean;
  error: Error | null;
  createLocation: (payload: LocationCreatePayload) => Promise<Location>;
  updateLocation: (id: string, payload: LocationUpdatePayload) => Promise<Location>;
  deleteLocation: (id: string) => Promise<void>;
  moveLocation: (locationId: string, newParentId: string) => Promise<void>;
  getLocationById: (id: string) => Location | undefined;
  getLocationChildren: (parentId: string) => Location[];
  subscribeToLocationUpdates: (locationId: string, callback: (location: Location) => void) => () => void;
  refreshLocations: () => Promise<void>;
}

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const locationCache = new Map<string, LocationCacheEntry>();

// API instance
const api = createAxiosInstance();

/**
 * Custom hook for managing location operations with real-time updates and hierarchy
 */
export const useLocation = (): UseLocationReturn => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationTree, setLocationTree] = useState<LocationHierarchyNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Builds location hierarchy tree from flat location array
   */
  const buildLocationTree = useCallback((locationList: Location[]): LocationHierarchyNode[] => {
    const locationMap = new Map<string, LocationHierarchyNode>();
    const rootNodes: LocationHierarchyNode[] = [];

    // Create nodes
    locationList.forEach(location => {
      locationMap.set(location.id, {
        id: location.id,
        name: location.name,
        type: location.type,
        children: [],
        metadata: {
          assetCount: 0,
          capacityUtilization: 0,
          lastUpdated: new Date()
        }
      });
    });

    // Build tree structure
    locationList.forEach(location => {
      const node = locationMap.get(location.id);
      if (node) {
        if (location.parentId && locationMap.has(location.parentId)) {
          const parent = locationMap.get(location.parentId);
          parent?.children.push(node);
        } else {
          rootNodes.push(node);
        }
      }
    });

    return rootNodes;
  }, []);

  /**
   * Fetches all locations and updates state
   */
  const fetchLocations = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await api.get<ApiResponse<Location[]>>(
        apiConfig.endpoints.locations.base
      );
      setLocations(response.data.data);
      setLocationTree(buildLocationTree(response.data.data));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch locations'));
    } finally {
      setIsLoading(false);
    }
  }, [buildLocationTree]);

  /**
   * Creates a new location
   */
  const createLocation = async (payload: LocationCreatePayload): Promise<Location> => {
    const response = await api.post<ApiResponse<Location>>(
      apiConfig.endpoints.locations.base,
      payload
    );
    const newLocation = response.data.data;
    setLocations(prev => [...prev, newLocation]);
    setLocationTree(buildLocationTree([...locations, newLocation]));
    return newLocation;
  };

  /**
   * Updates an existing location
   */
  const updateLocation = async (
    id: string,
    payload: LocationUpdatePayload
  ): Promise<Location> => {
    const response = await api.patch<ApiResponse<Location>>(
      apiConfig.endpoints.locations.detail(id),
      payload
    );
    const updatedLocation = response.data.data;
    setLocations(prev => 
      prev.map(loc => loc.id === id ? updatedLocation : loc)
    );
    setLocationTree(buildLocationTree(
      locations.map(loc => loc.id === id ? updatedLocation : loc)
    ));
    return updatedLocation;
  };

  /**
   * Deletes a location
   */
  const deleteLocation = async (id: string): Promise<void> => {
    await api.delete(apiConfig.endpoints.locations.detail(id));
    setLocations(prev => prev.filter(loc => loc.id !== id));
    setLocationTree(buildLocationTree(
      locations.filter(loc => loc.id !== id)
    ));
  };

  /**
   * Moves a location to a new parent
   */
  const moveLocation = async (locationId: string, newParentId: string): Promise<void> => {
    await api.patch(apiConfig.endpoints.locations.detail(locationId), {
      parentId: newParentId
    });
    
    // Optimistic update
    setLocations(prev => prev.map(loc => 
      loc.id === locationId ? { ...loc, parentId: newParentId } : loc
    ));
    setLocationTree(buildLocationTree(
      locations.map(loc => 
        loc.id === locationId ? { ...loc, parentId: newParentId } : loc
      )
    ));
  };

  /**
   * Gets a location by ID with caching
   */
  const getLocationById = (id: string): Location | undefined => {
    const cached = locationCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    const location = locations.find(loc => loc.id === id);
    if (location) {
      locationCache.set(id, {
        data: location,
        timestamp: Date.now()
      });
    }
    return location;
  };

  /**
   * Gets all children of a location
   */
  const getLocationChildren = (parentId: string): Location[] => {
    return locations.filter(loc => loc.parentId === parentId);
  };

  /**
   * Subscribes to real-time location updates
   */
  const subscribeToLocationUpdates = (
    locationId: string,
    callback: (location: Location) => void
  ): () => void => {
    const debouncedCallback = debounce(callback, 100);
    
    WebSocketService.subscribeToWidget(
      `location_${locationId}`,
      (data: Location) => {
        // Update local state
        setLocations(prev => 
          prev.map(loc => loc.id === locationId ? data : loc)
        );
        setLocationTree(buildLocationTree(
          locations.map(loc => loc.id === locationId ? data : loc)
        ));
        
        debouncedCallback(data);
      }
    );

    return () => {
      WebSocketService.unsubscribeFromWidget(`location_${locationId}`);
      debouncedCallback.cancel();
    };
  };

  /**
   * Initial setup and cleanup
   */
  useEffect(() => {
    fetchLocations();

    return () => {
      locationCache.clear();
    };
  }, [fetchLocations]);

  return {
    locations,
    locationTree,
    isLoading,
    error,
    createLocation,
    updateLocation,
    deleteLocation,
    moveLocation,
    getLocationById,
    getLocationChildren,
    subscribeToLocationUpdates,
    refreshLocations: fetchLocations
  };
};

export default useLocation;