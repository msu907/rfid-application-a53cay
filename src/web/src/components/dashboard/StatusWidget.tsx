import React, { memo, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Grid, Typography, Tooltip, Skeleton } from '@mui/material';
import { 
  AssessmentOutlined as StatsIcon,
  RouterOutlined as ReaderIcon,
  BarChartOutlined as ReadsIcon,
  WarningAmberOutlined as AlertIcon 
} from '@mui/icons-material';

import Card from '../common/Card';
import ErrorBoundary from '../common/ErrorBoundary';
import { selectReaders } from '../../redux/slices/readerSlice';

// Interface for component props
interface StatusWidgetProps {
  className?: string;
  refreshInterval?: number;
}

// Interface for individual status card props
interface StatusCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  loading?: boolean;
  error?: Error | null;
  tooltip: string;
}

// Default refresh interval in milliseconds
const DEFAULT_REFRESH_INTERVAL = 5000;

// Memoized status card component
const StatusCard = memo<StatusCardProps>(({
  title,
  value,
  icon,
  loading = false,
  error = null,
  tooltip
}) => (
  <Tooltip title={tooltip} placement="top" arrow>
    <Card
      elevation="medium"
      className="status-card"
      isLoading={loading}
      error={error}
      aria-label={`${title}: ${value}`}
    >
      <div style={styles.card}>
        <div style={styles.icon} aria-hidden="true">
          {icon}
        </div>
        <Typography 
          variant="h4" 
          component="div" 
          style={styles.value}
          aria-live="polite"
        >
          {loading ? (
            <Skeleton width="80%" height={40} />
          ) : (
            value
          )}
        </Typography>
        <Typography 
          variant="subtitle2" 
          color="textSecondary" 
          style={styles.title}
        >
          {title}
        </Typography>
      </div>
    </Card>
  </Tooltip>
));

StatusCard.displayName = 'StatusCard';

// Main status widget component
const StatusWidget: React.FC<StatusWidgetProps> = ({
  className,
  refreshInterval = DEFAULT_REFRESH_INTERVAL
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const readers = useSelector(selectReaders);

  // Calculate metrics with memoization
  const calculateMetrics = useCallback(() => {
    try {
      const activeReaders = Object.values(readers).filter(
        reader => reader.status === 'ONLINE'
      ).length;
      const totalReaders = Object.keys(readers).length;
      const totalReads = Object.values(readers).reduce(
        (sum, reader) => sum + (reader.stats?.totalReads || 0), 
        0
      );
      const alerts = Object.values(readers).filter(
        reader => reader.status === 'ERROR'
      ).length;

      return {
        activeReaders: `${activeReaders}/${totalReaders}`,
        totalReads: totalReads.toLocaleString(),
        alerts
      };
    } catch (err) {
      setError(err as Error);
      return {
        activeReaders: '0/0',
        totalReads: '0',
        alerts: 0
      };
    }
  }, [readers]);

  // Set up refresh interval
  useEffect(() => {
    setLoading(true);
    const timer = setInterval(() => {
      setLoading(false);
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [refreshInterval]);

  const metrics = calculateMetrics();

  return (
    <ErrorBoundary>
      <Grid container spacing={2} className={className}>
        <Grid item xs={12} sm={6} md={3}>
          <StatusCard
            title="Total Assets"
            value={Object.keys(readers).length.toLocaleString()}
            icon={<StatsIcon />}
            loading={loading}
            error={error}
            tooltip="Total number of tracked assets in the system"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatusCard
            title="Active Readers"
            value={metrics.activeReaders}
            icon={<ReaderIcon />}
            loading={loading}
            error={error}
            tooltip="Number of online RFID readers / Total readers"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatusCard
            title="Today's Reads"
            value={metrics.totalReads}
            icon={<ReadsIcon />}
            loading={loading}
            error={error}
            tooltip="Total number of RFID reads today"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatusCard
            title="Alerts"
            value={metrics.alerts}
            icon={<AlertIcon />}
            loading={loading}
            error={error}
            tooltip="Number of active system alerts"
          />
        </Grid>
      </Grid>
    </ErrorBoundary>
  );
};

// Styles
const styles = {
  card: {
    height: '100%',
    minHeight: '120px',
    padding: '16px',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'flex-end' as const
  },
  icon: {
    position: 'absolute' as const,
    top: '16px',
    right: '16px',
    opacity: 0.5,
    color: 'inherit'
  },
  value: {
    fontSize: 'clamp(1.5rem, 2vw, 2rem)',
    fontWeight: 'bold',
    marginBottom: '8px',
    color: 'primary.main'
  },
  title: {
    fontSize: 'clamp(0.875rem, 1vw, 1rem)',
    color: 'text.secondary',
    fontWeight: 'medium'
  }
};

export default memo(StatusWidget);