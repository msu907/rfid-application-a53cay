/**
 * LocationStats Component
 * Displays statistical information and metrics about locations in the RFID asset tracking system
 * with real-time updates, accessibility support, and responsive design.
 * @version 1.0.0
 */

import React, { useEffect, useMemo, useCallback } from 'react'; // ^18.2.0
import { Location } from '../../types/location.types';
import { useLocation } from '../../hooks/useLocation';
import { Chart } from '../common/Chart';
import { CHART_TYPES, CHART_COLORS } from '../../constants/chart.constants';

// Constants for component configuration
const DEFAULT_REFRESH_INTERVAL = 5000;
const DEFAULT_CAPACITY = 60;
const CHART_OPTIONS = {
  height: 300,
  margins: {
    top: 20,
    right: 30,
    bottom: 40,
    left: 50
  },
  animate: true,
  responsive: true,
  maintainAspectRatio: false,
  a11y: {
    announceNewData: true,
    describedBy: 'location-stats-description'
  }
};

// Interface definitions
interface LocationStatsProps {
  locationId?: string;
  showCapacity?: boolean;
  showDistribution?: boolean;
  showHistory?: boolean;
  refreshInterval?: number;
  chartType?: keyof typeof CHART_TYPES;
  className?: string;
}

interface CapacityStats {
  totalCapacity: number;
  usedCapacity: number;
  utilizationPercentage: number;
  availableSpace: number;
}

/**
 * LocationStats Component
 * Displays comprehensive location statistics with real-time updates
 */
const LocationStats: React.FC<LocationStatsProps> = ({
  locationId,
  showCapacity = true,
  showDistribution = true,
  showHistory = false,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  chartType = CHART_TYPES.BAR,
  className = ''
}) => {
  // Custom hook for location data management
  const { 
    locations, 
    loading, 
    error, 
    subscribeToLocationUpdates 
  } = useLocation();

  /**
   * Calculate capacity statistics with memoization
   */
  const capacityStats = useMemo((): CapacityStats => {
    const activeLocations = locations.filter(loc => 
      !locationId || loc.id === locationId
    );

    const totalCapacity = activeLocations.reduce((sum, loc) => 
      sum + (loc.capacity || DEFAULT_CAPACITY), 0
    );

    const usedCapacity = activeLocations.reduce((sum, loc) => 
      sum + (loc.assetCount || 0), 0
    );

    const utilizationPercentage = totalCapacity > 0 
      ? (usedCapacity / totalCapacity) * 100 
      : 0;

    return {
      totalCapacity,
      usedCapacity,
      utilizationPercentage,
      availableSpace: totalCapacity - usedCapacity
    };
  }, [locations, locationId]);

  /**
   * Format location data for chart visualization
   */
  const chartData = useMemo(() => {
    const relevantLocations = locations.filter(loc => 
      !locationId || loc.id === locationId
    );

    // Group locations by zone for distribution view
    const zoneData = relevantLocations.reduce((acc, loc) => {
      const zone = loc.zone || 'Unassigned';
      if (!acc[zone]) {
        acc[zone] = {
          name: zone,
          assetCount: 0,
          capacity: 0
        };
      }
      acc[zone].assetCount += loc.assetCount || 0;
      acc[zone].capacity += loc.capacity || DEFAULT_CAPACITY;
      return acc;
    }, {} as Record<string, { name: string; assetCount: number; capacity: number }>);

    return Object.values(zoneData).map(zone => ({
      label: zone.name,
      value: zone.assetCount,
      capacity: zone.capacity,
      utilization: (zone.assetCount / zone.capacity) * 100
    }));
  }, [locations, locationId]);

  /**
   * Subscribe to real-time location updates
   */
  useEffect(() => {
    if (locationId) {
      const unsubscribe = subscribeToLocationUpdates(locationId, () => {
        // Updates will be handled automatically by the hook
      });
      return () => unsubscribe();
    }
  }, [locationId, subscribeToLocationUpdates]);

  /**
   * Render loading state with accessibility
   */
  if (loading) {
    return (
      <div 
        role="status" 
        aria-busy="true" 
        className={`location-stats-loading ${className}`}
      >
        <span className="sr-only">Loading location statistics...</span>
        <div className="loading-spinner" aria-hidden="true" />
      </div>
    );
  }

  /**
   * Render error state with accessibility
   */
  if (error) {
    return (
      <div 
        role="alert" 
        className={`location-stats-error ${className}`}
      >
        <p>Error loading location statistics: {error.message}</p>
      </div>
    );
  }

  return (
    <div 
      className={`location-stats ${className}`}
      aria-labelledby="location-stats-title"
    >
      <h2 id="location-stats-title" className="stats-title">
        Location Statistics
      </h2>
      
      {showCapacity && (
        <div className="capacity-overview" role="region" aria-label="Capacity Overview">
          <div className="stat-card">
            <h3>Total Capacity</h3>
            <p aria-label="Total capacity">{capacityStats.totalCapacity}</p>
          </div>
          <div className="stat-card">
            <h3>Used Space</h3>
            <p aria-label="Used space">{capacityStats.usedCapacity}</p>
          </div>
          <div className="stat-card">
            <h3>Utilization</h3>
            <p aria-label="Utilization percentage">
              {capacityStats.utilizationPercentage.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {showDistribution && (
        <div className="distribution-chart" role="region" aria-label="Zone Distribution">
          <h3>Zone Distribution</h3>
          <Chart
            type={chartType}
            data={chartData}
            options={{
              ...CHART_OPTIONS,
              colors: CHART_COLORS.primary
            }}
            accessibility={{
              ariaLabel: "Zone distribution chart",
              ariaDescription: "Chart showing asset distribution across zones",
              highContrastMode: true,
              keyboardNavigation: true
            }}
          />
        </div>
      )}

      <div 
        id="location-stats-description" 
        className="sr-only"
      >
        Location statistics showing capacity utilization of {capacityStats.utilizationPercentage.toFixed(1)}% 
        with {capacityStats.usedCapacity} assets out of {capacityStats.totalCapacity} total capacity.
      </div>
    </div>
  );
};

export default LocationStats;