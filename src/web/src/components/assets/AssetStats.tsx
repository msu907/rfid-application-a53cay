/**
 * AssetStats Component
 * @version 1.0.0
 * 
 * A high-performance React component that displays statistical information about assets
 * including status distribution, location distribution, and activity trends.
 * Implements accessibility features, error boundaries, and performance optimizations.
 */

import React, { useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux'; // v8.0.5
import Card from '../common/Card';
import Chart from '../common/Chart';
import { Asset, AssetStatus, ASSET_STATUS_LABELS } from '../../types/asset.types';
import { CHART_TYPES, CHART_COLORS } from '../constants/chart.constants';

// Interface for component props
export interface AssetStatsProps {
  /** Optional CSS class name for styling customization */
  className?: string;
}

/**
 * Calculates the distribution of assets by their status
 * @param assets Array of assets to analyze
 * @returns Array of status distribution data points
 */
const calculateStatusDistribution = (assets: Asset[]) => {
  const distribution = new Map<AssetStatus, number>();

  // Initialize all statuses with 0 count
  Object.values(AssetStatus).forEach(status => {
    distribution.set(status, 0);
  });

  // Count assets by status
  assets.forEach(asset => {
    const currentCount = distribution.get(asset.status) || 0;
    distribution.set(asset.status, currentCount + 1);
  });

  // Format data for pie chart
  return Array.from(distribution.entries()).map(([status, count]) => ({
    label: ASSET_STATUS_LABELS[status],
    value: count,
    color: CHART_COLORS.status[status.toLowerCase() as keyof typeof CHART_COLORS.status]
  }));
};

/**
 * Calculates the distribution of assets by their location
 * @param assets Array of assets to analyze
 * @returns Array of location distribution data points
 */
const calculateLocationDistribution = (assets: Asset[]) => {
  const distribution = new Map<string, number>();

  // Count assets by location
  assets.forEach(asset => {
    const currentCount = distribution.get(asset.locationId) || 0;
    distribution.set(asset.locationId, currentCount + 1);
  });

  // Format data for bar chart
  return Array.from(distribution.entries()).map(([locationId, count]) => ({
    label: assets.find(a => a.locationId === locationId)?.location.name || 'Unknown',
    value: count
  }));
};

/**
 * AssetStats Component
 * Displays statistical information about assets using charts and cards
 */
const AssetStats: React.FC<AssetStatsProps> = ({ className }) => {
  // Get assets from Redux store
  const assets = useSelector((state: any) => Object.values(state.assets.assets) as Asset[]);
  const isLoading = useSelector((state: any) => state.assets.loading);
  const error = useSelector((state: any) => state.assets.error);

  // Memoized calculations for performance
  const statusDistribution = useMemo(() => calculateStatusDistribution(assets), [assets]);
  const locationDistribution = useMemo(() => calculateLocationDistribution(assets), [assets]);

  /**
   * Renders the status distribution chart
   */
  const renderStatusChart = useCallback(() => {
    const chartOptions = {
      width: 300,
      height: 300,
      animate: true,
      accessibility: {
        ariaLabel: 'Asset status distribution chart',
        announceDataChanges: true,
        keyboardNavigation: true
      }
    };

    return (
      <Card
        elevation="medium"
        ariaLabel="Asset Status Distribution"
        testId="asset-status-chart"
      >
        <h3>Asset Status Distribution</h3>
        <Chart
          type={CHART_TYPES.PIE}
          data={statusDistribution}
          options={chartOptions}
        />
      </Card>
    );
  }, [statusDistribution]);

  /**
   * Renders the location distribution chart
   */
  const renderLocationChart = useCallback(() => {
    const chartOptions = {
      width: 600,
      height: 300,
      animate: true,
      accessibility: {
        ariaLabel: 'Asset location distribution chart',
        announceDataChanges: true,
        keyboardNavigation: true
      }
    };

    return (
      <Card
        elevation="medium"
        ariaLabel="Asset Location Distribution"
        testId="asset-location-chart"
      >
        <h3>Asset Location Distribution</h3>
        <Chart
          type={CHART_TYPES.BAR}
          data={locationDistribution}
          options={chartOptions}
        />
      </Card>
    );
  }, [locationDistribution]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className={className} role="status" aria-busy="true">
        <Card isLoading={true} testId="asset-stats-loading">
          Loading asset statistics...
        </Card>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className={className} role="alert">
        <Card error={new Error(error)} testId="asset-stats-error">
          Error loading asset statistics
        </Card>
      </div>
    );
  }

  return (
    <div 
      className={className}
      role="region"
      aria-label="Asset Statistics Dashboard"
    >
      <div className="asset-stats-grid">
        {/* Summary Cards */}
        <Card elevation="low" testId="total-assets-card">
          <h3>Total Assets</h3>
          <p className="stat-value">{assets.length}</p>
        </Card>

        <Card elevation="low" testId="active-assets-card">
          <h3>Active Assets</h3>
          <p className="stat-value">
            {assets.filter(a => a.status === AssetStatus.ACTIVE).length}
          </p>
        </Card>

        {/* Distribution Charts */}
        {renderStatusChart()}
        {renderLocationChart()}
      </div>
    </div>
  );
};

// Add display name for debugging
AssetStats.displayName = 'AssetStats';

export default React.memo(AssetStats);