import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames'; // v2.3.1
import Card, { CardProps } from '../common/Card';
import useAsset from '../../hooks/useAsset';
import useWebSocket from '../../hooks/useWebSocket';
import { Asset, AssetStatus } from '../../types/asset.types';

// Icons for stats cards
import { 
  MdInventory, 
  MdRouter, 
  MdAnalytics, 
  MdWarning 
} from 'react-icons/md'; // v4.11.0

// Constants
const REFRESH_INTERVAL = 30000; // 30 seconds
const STATS_WEBSOCKET_TOPIC = 'dashboard-stats';

interface DashboardStatsProps {
  className?: string;
  refreshInterval?: number;
}

interface StatCardProps extends Omit<CardProps, 'children'> {
  title: string;
  value: number;
  loading: boolean;
  icon: React.ReactNode;
  ariaLabel: string;
}

interface StatsState {
  readerCount: number;
  activeReaderCount: number;
  todayReads: number;
  alertCount: number;
  loading: boolean;
  error: string | null;
}

// Memoized stat card component
const StatCard = React.memo<StatCardProps>(({
  title,
  value,
  loading,
  icon,
  ariaLabel,
  ...props
}) => (
  <Card
    elevation="medium"
    className={classNames('stat-card', props.className)}
    aria-label={ariaLabel}
    role="region"
    isLoading={loading}
  >
    <div className="stat-card__content">
      <div className="stat-card__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="stat-card__info">
        <h3 className="stat-card__title">{title}</h3>
        <p className="stat-card__value" aria-live="polite">
          {loading ? '-' : value.toLocaleString()}
        </p>
      </div>
    </div>
  </Card>
));

StatCard.displayName = 'StatCard';

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  className,
  refreshInterval = REFRESH_INTERVAL
}) => {
  // Initialize hooks
  const { assets, loadingStates: assetLoadingStates } = useAsset();
  const [stats, setStats] = useState<StatsState>({
    readerCount: 0,
    activeReaderCount: 0,
    todayReads: 0,
    alertCount: 0,
    loading: true,
    error: null
  });

  // Initialize WebSocket connection
  const { 
    isConnected,
    data: wsData,
    error: wsError,
    subscribe,
    unsubscribe
  } = useWebSocket(STATS_WEBSOCKET_TOPIC, {
    autoConnect: true,
    heartbeatInterval: refreshInterval
  });

  // Calculate total active assets
  const totalAssets = useMemo(() => {
    return Object.values(assets).filter(
      asset => asset.status === AssetStatus.ACTIVE
    ).length;
  }, [assets]);

  // Handle real-time updates
  const handleStatsUpdate = useCallback((data: any) => {
    setStats(prevStats => ({
      ...prevStats,
      ...data,
      loading: false,
      error: null
    }));
  }, []);

  // Subscribe to WebSocket updates
  useEffect(() => {
    if (isConnected) {
      subscribe();
    }

    return () => {
      unsubscribe();
    };
  }, [isConnected, subscribe, unsubscribe]);

  // Update stats when WebSocket data is received
  useEffect(() => {
    if (wsData) {
      handleStatsUpdate(wsData);
    }
  }, [wsData, handleStatsUpdate]);

  // Handle WebSocket errors
  useEffect(() => {
    if (wsError) {
      setStats(prev => ({
        ...prev,
        error: wsError.message,
        loading: false
      }));
    }
  }, [wsError]);

  return (
    <div 
      className={classNames('dashboard-stats', className)}
      aria-label="Dashboard Statistics"
      role="region"
    >
      <div className="dashboard-stats__grid">
        <StatCard
          title="Total Assets"
          value={totalAssets}
          loading={assetLoadingStates.fetchAll}
          icon={<MdInventory size={24} />}
          ariaLabel="Total number of active assets"
          className="dashboard-stats__card"
        />
        <StatCard
          title="Active Readers"
          value={stats.activeReaderCount}
          loading={stats.loading}
          icon={<MdRouter size={24} />}
          ariaLabel="Number of active RFID readers"
          className="dashboard-stats__card"
        />
        <StatCard
          title="Today's Reads"
          value={stats.todayReads}
          loading={stats.loading}
          icon={<MdAnalytics size={24} />}
          ariaLabel="Total RFID reads today"
          className="dashboard-stats__card"
        />
        <StatCard
          title="Alerts"
          value={stats.alertCount}
          loading={stats.loading}
          icon={<MdWarning size={24} />}
          ariaLabel="Number of active alerts"
          className="dashboard-stats__card"
        />
      </div>
      {stats.error && (
        <div 
          className="dashboard-stats__error" 
          role="alert"
          aria-live="polite"
        >
          {stats.error}
        </div>
      )}
    </div>
  );
};

// Add display name for debugging
DashboardStats.displayName = 'DashboardStats';

export default DashboardStats;