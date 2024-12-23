/**
 * Redux slice for managing location state in the RFID Asset Tracking System.
 * Implements real-time location tracking, hierarchical organization, and optimistic updates.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5
import { Location, LocationType, LocationHierarchyNode, LocationUpdatePayload } from '../../types/location.types';
import { LocationApi } from '../../api/location.api';
import WebSocketService, { WEBSOCKET_EVENTS } from '../../services/websocket.service';
import { ApiError } from '../../types/api.types';

// State interface
interface LocationState {
  locations: Record<string, Location>;
  hierarchy: LocationHierarchyNode[];
  isLoading: boolean;
  error: ApiError | null;
  lastUpdated: number | null;
  optimisticUpdates: Record<string, LocationUpdatePayload>;
  selectedLocationId: string | null;
  cacheValidity: number;
}

// Initial state
const initialState: LocationState = {
  locations: {},
  hierarchy: [],
  isLoading: false,
  error: null,
  lastUpdated: null,
  optimisticUpdates: {},
  selectedLocationId: null,
  cacheValidity: 5 * 60 * 1000 // 5 minutes
};

// Async thunks
export const fetchLocations = createAsyncThunk(
  'locations/fetchLocations',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { locations: LocationState };
      const now = Date.now();

      // Check cache validity
      if (
        state.locations.lastUpdated &&
        now - state.locations.lastUpdated < state.locations.cacheValidity
      ) {
        return { locations: Object.values(state.locations.locations) };
      }

      const response = await locationApi.getLocations();
      return { locations: response.data, timestamp: now };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchLocationHierarchy = createAsyncThunk(
  'locations/fetchHierarchy',
  async (_, { rejectWithValue }) => {
    try {
      const response = await locationApi.getLocationHierarchy();
      return { hierarchy: response };
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updateLocation = createAsyncThunk(
  'locations/updateLocation',
  async ({ locationId, payload }: { locationId: string; payload: LocationUpdatePayload }, 
    { rejectWithValue, dispatch }
  ) => {
    try {
      // Generate optimistic update ID
      const optimisticId = `${locationId}-${Date.now()}`;
      
      // Apply optimistic update
      dispatch(locationSlice.actions.applyOptimisticUpdate({
        locationId,
        updateId: optimisticId,
        payload
      }));

      const response = await locationApi.updateLocation(locationId, payload);
      
      // Clear optimistic update on success
      dispatch(locationSlice.actions.removeOptimisticUpdate(optimisticId));
      
      return { location: response.data };
    } catch (error) {
      // Revert optimistic update on failure
      dispatch(locationSlice.actions.revertOptimisticUpdate(locationId));
      return rejectWithValue(error);
    }
  }
);

// Location slice
const locationSlice = createSlice({
  name: 'locations',
  initialState,
  reducers: {
    setSelectedLocation(state, action: PayloadAction<string | null>) {
      state.selectedLocationId = action.payload;
    },
    applyOptimisticUpdate(state, action: PayloadAction<{
      locationId: string;
      updateId: string;
      payload: LocationUpdatePayload;
    }>) {
      const { locationId, updateId, payload } = action.payload;
      state.optimisticUpdates[updateId] = payload;
      
      if (state.locations[locationId]) {
        state.locations[locationId] = {
          ...state.locations[locationId],
          ...payload
        };
      }
    },
    removeOptimisticUpdate(state, action: PayloadAction<string>) {
      delete state.optimisticUpdates[action.payload];
    },
    revertOptimisticUpdate(state, action: PayloadAction<string>) {
      const locationId = action.payload;
      const updates = Object.entries(state.optimisticUpdates)
        .filter(([key]) => key.startsWith(locationId))
        .map(([key]) => key);
      
      updates.forEach(updateId => {
        delete state.optimisticUpdates[updateId];
      });
    },
    handleRealtimeUpdate(state, action: PayloadAction<Location>) {
      const location = action.payload;
      state.locations[location.id] = location;
      state.lastUpdated = Date.now();
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLocations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLocations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.locations = action.payload.locations.reduce((acc, location) => ({
          ...acc,
          [location.id]: location
        }), {});
        state.lastUpdated = action.payload.timestamp;
      })
      .addCase(fetchLocations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as ApiError;
      })
      .addCase(fetchLocationHierarchy.fulfilled, (state, action) => {
        state.hierarchy = action.payload.hierarchy;
      });
  }
});

// Selectors
export const selectLocations = (state: { locations: LocationState }) => 
  Object.values(state.locations.locations);

export const selectLocationById = (state: { locations: LocationState }, locationId: string) =>
  state.locations.locations[locationId];

export const selectLocationHierarchy = (state: { locations: LocationState }) =>
  state.locations.hierarchy;

export const selectLocationPath = createSelector(
  [selectLocationHierarchy, (_, locationId: string) => locationId],
  (hierarchy, locationId) => {
    const findPath = (nodes: LocationHierarchyNode[], id: string, path: string[] = []): string[] => {
      for (const node of nodes) {
        if (node.id === id) {
          return [...path, node.name];
        }
        const childPath = findPath(node.children, id, [...path, node.name]);
        if (childPath.length) {
          return childPath;
        }
      }
      return [];
    };
    return findPath(hierarchy, locationId);
  }
);

// Setup WebSocket subscription for real-time updates
WebSocketService.subscribeToWidget('locations', (data: Location) => {
  locationSlice.actions.handleRealtimeUpdate(data);
});

// Export actions and reducer
export const { 
  setSelectedLocation,
  applyOptimisticUpdate,
  removeOptimisticUpdate,
  revertOptimisticUpdate,
  handleRealtimeUpdate
} = locationSlice.actions;

export default locationSlice.reducer;