import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'; // ^4.2.1
import MarkerClusterGroup from 'react-leaflet-cluster'; // ^2.1.0
import { debounce } from 'lodash'; // ^4.17.21
import { Map as LeafletMap, Marker as LeafletMarker, Icon } from 'leaflet'; // ^1.9.3
import { Location } from '../../types/location.types';
import { mapConfig } from '../../config/map.config';
import useWebSocket from '../../hooks/useWebSocket';

// Constants for performance optimization
const LOCATION_UPDATE_INTERVAL = 1000;
const DEFAULT_ZOOM_LEVEL = 13;
const MARKER_CHUNK_SIZE = 50;
const DEBOUNCE_DELAY = 150;
const WEBSOCKET_RETRY_DELAY = 3000;

// Custom marker icon with accessibility considerations
const locationIcon = new Icon({
  iconUrl: '/assets/location-marker.svg',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
  className: 'location-marker-icon',
});

interface LocationMapProps {
  onLocationSelect?: (location: Location) => void;
  selectedLocationId?: string | null;
  initialZoom?: number;
  enableClustering?: boolean;
}

/**
 * LocationMap Component
 * Renders an interactive map visualization of locations with real-time updates
 * and enhanced accessibility features
 */
export const LocationMap: React.FC<LocationMapProps> = ({
  onLocationSelect,
  selectedLocationId,
  initialZoom = DEFAULT_ZOOM_LEVEL,
  enableClustering = true,
}) => {
  // Refs for map instance and markers
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRefs = useRef<Map<string, LeafletMarker>>(new Map());
  
  // State management
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection for real-time updates
  const {
    data: locationUpdates,
    isConnected,
    error: wsError,
    subscribe,
    unsubscribe,
  } = useWebSocket('location-updates', {
    autoConnect: true,
    heartbeatInterval: LOCATION_UPDATE_INTERVAL,
    reconnectAttempts: 3,
  });

  /**
   * Handles real-time location updates with performance optimization
   */
  useEffect(() => {
    if (locationUpdates) {
      setLocations(prevLocations => {
        const updatedLocations = [...prevLocations];
        const updates = Array.isArray(locationUpdates) ? locationUpdates : [locationUpdates];
        
        updates.forEach(update => {
          const index = updatedLocations.findIndex(loc => loc.id === update.id);
          if (index !== -1) {
            updatedLocations[index] = { ...updatedLocations[index], ...update };
          } else {
            updatedLocations.push(update as Location);
          }
        });

        return updatedLocations;
      });
    }
  }, [locationUpdates]);

  /**
   * Handles marker click events with accessibility support
   */
  const handleMarkerClick = useCallback((location: Location, event: React.MouseEvent) => {
    event.stopPropagation();
    
    // Update ARIA live region for screen readers
    const liveRegion = document.getElementById('map-announcer');
    if (liveRegion) {
      liveRegion.textContent = `Selected location: ${location.name} in zone ${location.zone}`;
    }

    // Center map on selected location with animation
    if (mapRef.current) {
      mapRef.current.setView(
        [location.coordinates.latitude, location.coordinates.longitude],
        mapRef.current.getZoom(),
        { animate: true }
      );
    }

    onLocationSelect?.(location);
  }, [onLocationSelect]);

  /**
   * Optimized marker rendering with chunking for performance
   */
  const renderMarkers = useCallback(() => {
    const chunks: JSX.Element[][] = [];
    let currentChunk: JSX.Element[] = [];

    locations.forEach((location, index) => {
      const marker = (
        <Marker
          key={location.id}
          position={[location.coordinates.latitude, location.coordinates.longitude]}
          icon={locationIcon}
          ref={ref => {
            if (ref) {
              markerRefs.current.set(location.id, ref);
            }
          }}
          eventHandlers={{
            click: (e) => handleMarkerClick(location, e as unknown as React.MouseEvent),
            keypress: (e) => {
              if (e.originalEvent.key === 'Enter') {
                handleMarkerClick(location, e as unknown as React.MouseEvent);
              }
            },
          }}
          aria-label={`Location: ${location.name}, Zone: ${location.zone}`}
          tabIndex={0}
        />
      );

      currentChunk.push(marker);

      if (currentChunk.length === MARKER_CHUNK_SIZE || index === locations.length - 1) {
        chunks.push([...currentChunk]);
        currentChunk = [];
      }
    });

    return enableClustering ? (
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={mapConfig.clusterOptions.maxClusterRadius}
        spiderfyOnMaxZoom={mapConfig.clusterOptions.spiderfyOnMaxZoom}
        showCoverageOnHover={mapConfig.clusterOptions.showCoverageOnHover}
        zoomToBoundsOnClick={mapConfig.clusterOptions.zoomToBoundsOnClick}
        aria-label="Location clusters"
      >
        {chunks.flat()}
      </MarkerClusterGroup>
    ) : chunks.flat();
  }, [locations, enableClustering, handleMarkerClick]);

  /**
   * Map event handlers with debouncing for performance
   */
  const MapEventHandler: React.FC = () => {
    const map = useMap();

    useEffect(() => {
      if (!map) return;

      const handleMapMove = debounce(() => {
        // Update visible markers based on bounds
        const bounds = map.getBounds();
        markerRefs.current.forEach((marker, id) => {
          const isVisible = bounds.contains(marker.getLatLng());
          const element = marker.getElement();
          if (element) {
            element.style.visibility = isVisible ? 'visible' : 'hidden';
          }
        });
      }, DEBOUNCE_DELAY);

      map.on('move', handleMapMove);
      map.on('zoom', handleMapMove);

      return () => {
        map.off('move', handleMapMove);
        map.off('zoom', handleMapMove);
      };
    }, [map]);

    return null;
  };

  // Error handling and loading states
  if (error || wsError) {
    return (
      <div role="alert" className="map-error">
        Error loading map: {error || wsError}
      </div>
    );
  }

  return (
    <div className="location-map-container" role="region" aria-label="Location Map">
      {/* ARIA live region for announcements */}
      <div id="map-announcer" className="sr-only" aria-live="polite" />
      
      {isLoading && (
        <div className="map-loading" role="status">
          Loading map...
        </div>
      )}

      <MapContainer
        ref={mapRef}
        center={mapConfig.options.center}
        zoom={initialZoom}
        {...mapConfig.options}
        className="location-map"
      >
        <TileLayer {...mapConfig.tileLayer} />
        <MapEventHandler />
        {renderMarkers()}
      </MapContainer>

      {/* Accessibility controls */}
      <div className="map-controls" role="group" aria-label="Map controls">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in"
          className="map-control-button"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out"
          className="map-control-button"
        >
          -
        </button>
      </div>
    </div>
  );
};

export default LocationMap;