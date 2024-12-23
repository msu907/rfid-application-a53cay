import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Grid, Paper, CircularProgress, Alert } from '@mui/material'; // ^5.0.0
import LocationHierarchy from '../components/locations/LocationHierarchy';
import LocationMap from '../components/locations/LocationMap';
import LocationStats from '../components/locations/LocationStats';
import { useLocation } from '../../hooks/useLocation';
import { useWebSocket } from '../../hooks/useWebSocket';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Constants for performance optimization and configuration
const LOCATION_REFRESH_INTERVAL = 30000; // 30 seconds
const WS_RECONNECT_DELAY = 5000; // 5 seconds
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Interface for component state management
 */
interface LocationPageState {
  selectedLocationId: string | null;
  loading: boolean;
  error: string | null;
  wsConnected: boolean;
  lastUpdate: Date | null;
}

/**
 * Interface for WebSocket location update messages
 */
interface LocationUpdateMessage {
  type: string;
  locationId: string;
  data: any;
}

/**
 * LocationsPage Component
 * Main page component for managing and visualizing locations with real-time updates
 * and accessibility support.
 */
const LocationsPage: React.FC = () => {
  // State management
  const [state, setState] = useState<LocationPageState>({
    selectedLocationId: null,
    loading: true,
    error: null,
    wsConnected: false,
    lastUpdate: null
  });

  // Custom hooks for location management and WebSocket connectivity
  const { 
    locations, 
    loading: locationsLoading, 
    error: locationsError,
    refreshLocations 
  } = useLocation();

  const {
    isConnected,
    error: wsError,
    subscribe,
    unsubscribe
  } = useWebSocket('locations', {
    autoConnect: true,
    heartbeatInterval: LOCATION_REFRESH_INTERVAL,
    reconnectAttempts: MAX_RETRY_ATTEMPTS
  });

  /**
   * Handles location selection with accessibility announcements
   */
  const handleLocationSelect = useCallback((locationId: string) => {
    setState(prev => ({ ...prev, selectedLocationId: locationId }));

    // Update URL with selected location
    const url = new URL(window.location.href);
    url.searchParams.set('location', locationId);
    window.history.pushState({}, '', url.toString());

    // Announce selection to screen readers
    const location = locations.find(loc => loc.id === locationId);
    if (location) {
      const announcement = `Selected location: ${location.name} in zone ${location.zone}`;
      const liveRegion = document.getElementById('location-announcer');
      if (liveRegion) {
        liveRegion.textContent = announcement;
      }
    }
  }, [locations]);

  /**
   * Handles real-time location updates
   */
  const handleLocationUpdate = useCallback((message: LocationUpdateMessage) => {
    if (message.type === 'LOCATION_UPDATE') {
      refreshLocations();
      setState(prev => ({ 
        ...prev, 
        lastUpdate: new Date(),
        error: null 
      }));
    }
  }, [refreshLocations]);

  /**
   * Sets up WebSocket subscription and cleanup
   */
  useEffect(() => {
    const unsubscribeCallback = subscribe('location_updates', handleLocationUpdate);

    setState(prev => ({ ...prev, wsConnected: isConnected }));

    return () => {
      unsubscribeCallback();
      unsubscribe();
    };
  }, [subscribe, unsubscribe, isConnected, handleLocationUpdate]);

  /**
   * Initializes location from URL parameters
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locationId = params.get('location');
    if (locationId) {
      handleLocationSelect(locationId);
    }
  }, [handleLocationSelect]);

  /**
   * Memoized error message combining all error sources
   */
  const errorMessage = useMemo(() => {
    return locationsError || wsError || state.error;
  }, [locationsError, wsError, state.error]);

  /**
   * Loading state combining all loading conditions
   */
  const isLoading = useMemo(() => {
    return locationsLoading || state.loading;
  }, [locationsLoading, state.loading]);

  return (
    <ErrorBoundary>
      <div 
        className="locations-page"
        role="main"
        aria-label="Location Management"
      >
        {/* Accessibility live region for announcements */}
        <div 
          id="location-announcer" 
          className="sr-only" 
          aria-live="polite" 
        />

        {/* Error display */}
        {errorMessage && (
          <Alert 
            severity="error" 
            className="location-error"
            role="alert"
          >
            {errorMessage}
          </Alert>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="loading-container" role="status">
            <CircularProgress />
            <span className="sr-only">Loading locations...</span>
          </div>
        )}

        {/* Main content grid */}
        <Grid 
          container 
          spacing={3}
          className="location-content"
        >
          {/* Location hierarchy panel */}
          <Grid item xs={12} md={3}>
            <Paper 
              elevation={2}
              className="location-hierarchy-container"
            >
              <LocationHierarchy
                selectedLocationId={state.selectedLocationId}
                onLocationSelect={handleLocationSelect}
                enableRealTimeUpdates={state.wsConnected}
              />
            </Paper>
          </Grid>

          {/* Map visualization */}
          <Grid item xs={12} md={6}>
            <Paper 
              elevation={2}
              className="location-map-container"
            >
              <LocationMap
                selectedLocationId={state.selectedLocationId}
                onLocationSelect={handleLocationSelect}
                enableClustering={true}
              />
            </Paper>
          </Grid>

          {/* Statistics panel */}
          <Grid item xs={12} md={3}>
            <Paper 
              elevation={2}
              className="location-stats-container"
            >
              <LocationStats
                locationId={state.selectedLocationId}
                showCapacity={true}
                showDistribution={true}
                refreshInterval={LOCATION_REFRESH_INTERVAL}
              />
            </Paper>
          </Grid>
        </Grid>

        {/* Connection status indicator */}
        <div 
          className="connection-status"
          role="status"
          aria-live="polite"
        >
          {state.wsConnected ? (
            <span className="status-connected">
              Real-time updates active
              {state.lastUpdate && ` (Last update: ${state.lastUpdate.toLocaleTimeString()})`}
            </span>
          ) : (
            <span className="status-disconnected">
              Real-time updates unavailable
            </span>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default LocationsPage;