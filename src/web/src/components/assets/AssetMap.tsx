import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet'; // v4.2.1
import MarkerClusterGroup from '@changey/react-leaflet-markercluster'; // v4.0.0-rc1
import { LatLngBounds, Map as LeafletMap } from 'leaflet'; // v1.9.3

import { Asset } from '../../types/asset.types';
import { createMarker, calculateBounds, createClusterGroup } from '../../utils/map.utils';
import { MAP_DEFAULTS, TILE_LAYER_CONFIG, MARKER_COLORS } from '../../constants/map.constants';

/**
 * Props interface for the AssetMap component
 */
interface AssetMapProps {
  selectedAsset: Asset | null;
  onAssetSelect: (asset: Asset) => void;
  height?: string | number;
  width?: string | number;
  className?: string;
  accessibilityLabel?: string;
  clusterThreshold?: number;
  updateInterval?: number;
}

/**
 * MapController component for handling map viewport and updates
 */
const MapController: React.FC<{
  assets: Asset[];
  selectedAsset: Asset | null;
}> = ({ assets, selectedAsset }) => {
  const map = useMap();

  useEffect(() => {
    if (assets.length) {
      const bounds = calculateBounds(assets.map(asset => asset.location));
      if (bounds) {
        map.fitBounds(bounds);
      }
    }
  }, [assets, map]);

  useEffect(() => {
    if (selectedAsset?.location) {
      const position = {
        lat: selectedAsset.location.coordinates.latitude,
        lng: selectedAsset.location.coordinates.longitude
      };
      map.setView(position, MAP_DEFAULTS.zoom);
    }
  }, [selectedAsset, map]);

  return null;
};

/**
 * AssetMap component for displaying assets on an interactive map
 * with real-time updates and clustering support
 */
const AssetMap: React.FC<AssetMapProps> = ({
  selectedAsset,
  onAssetSelect,
  height = '600px',
  width = '100%',
  className = '',
  accessibilityLabel = 'Asset Location Map',
  clusterThreshold = MAP_DEFAULTS.clusterRadius,
  updateInterval = MAP_DEFAULTS.updateInterval
}) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const mapRef = useRef<LeafletMap | null>(null);
  const clusterRef = useRef<MarkerClusterGroup | null>(null);

  // Memoize the cluster group options
  const clusterOptions = useMemo(() => ({
    maxClusterRadius: clusterThreshold,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true,
    animate: true,
    animateAddingMarkers: true,
    disableClusteringAtZoom: 19,
    chunkedLoading: true,
    removeOutsideVisibleBounds: true
  }), [clusterThreshold]);

  // Handle marker interactions
  const handleMarkerClick = useCallback((asset: Asset) => {
    onAssetSelect(asset);
  }, [onAssetSelect]);

  // Update markers with new asset data
  const updateMarkers = useCallback(() => {
    if (!clusterRef.current) return;

    clusterRef.current.clearLayers();

    assets.forEach(asset => {
      const marker = createMarker(asset.location, {
        interactive: true,
        clusterGroup: clusterRef.current!,
        icon: {
          className: `asset-marker ${asset.id === selectedAsset?.id ? 'selected' : ''}`,
          html: `<div style="background-color: ${
            asset.id === selectedAsset?.id ? MARKER_COLORS.selected : MARKER_COLORS.active
          }"></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        }
      });

      marker.on('click', () => handleMarkerClick(asset));
      marker.bindTooltip(asset.name, {
        permanent: false,
        direction: 'top',
        className: 'asset-tooltip'
      });
    });
  }, [assets, selectedAsset, handleMarkerClick]);

  // Set up real-time updates
  useEffect(() => {
    const interval = setInterval(updateMarkers, updateInterval);
    return () => clearInterval(interval);
  }, [updateMarkers, updateInterval]);

  // Initialize cluster group
  useEffect(() => {
    if (mapRef.current && !clusterRef.current) {
      clusterRef.current = createClusterGroup();
      clusterRef.current.addTo(mapRef.current);
    }
  }, []);

  return (
    <div
      style={{ height, width }}
      className={`asset-map-container ${className}`}
      role="region"
      aria-label={accessibilityLabel}
    >
      <MapContainer
        ref={mapRef}
        center={MAP_DEFAULTS.center}
        zoom={MAP_DEFAULTS.zoom}
        minZoom={MAP_DEFAULTS.minZoom}
        maxZoom={MAP_DEFAULTS.maxZoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url={TILE_LAYER_CONFIG.url}
          attribution={TILE_LAYER_CONFIG.attribution}
          maxNativeZoom={TILE_LAYER_CONFIG.maxNativeZoom}
          tileSize={TILE_LAYER_CONFIG.tileSize}
          crossOrigin={TILE_LAYER_CONFIG.crossOrigin}
        />
        <MapController assets={assets} selectedAsset={selectedAsset} />
      </MapContainer>
    </div>
  );
};

export default React.memo(AssetMap);