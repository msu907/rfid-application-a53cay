import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next'; // ^11.0.0
import { formatDistanceToNow } from 'date-fns'; // ^2.29.0
import Table, { TableProps, TableColumn } from '../common/Table';
import { useReader } from '../../hooks/useReader';
import ErrorBoundary from '../common/ErrorBoundary';
import { ReaderStatus, PowerLevel } from '../../types/reader.types';

// Constants for performance optimization
const SIGNAL_STRENGTH_THRESHOLDS = {
  EXCELLENT: -35,
  GOOD: -50,
  FAIR: -65,
  POOR: -70
};

const REFRESH_INTERVAL = 5000; // 5 seconds for real-time updates

/**
 * Interface for ReaderList component props with accessibility support
 */
interface ReaderListProps {
  onReaderSelect?: (readerId: string, action: ReaderAction) => void;
  filterStatus?: ReaderStatus[];
  className?: string;
  virtualizeOptions?: {
    itemHeight: number;
    overscan: number;
  };
  accessibilityLabels?: {
    readerStatus: string;
    lastHeartbeat: string;
  };
}

/**
 * Enum for reader actions with type safety
 */
export enum ReaderAction {
  CONFIGURE = 'configure',
  RESET = 'reset',
  VIEW_STATS = 'viewStats'
}

/**
 * Returns appropriate color class for reader status with accessibility considerations
 */
const getStatusColor = (status: ReaderStatus, highContrast: boolean = false): string => {
  const colors = {
    [ReaderStatus.ONLINE]: highContrast ? 'text-green-800' : 'text-green-600',
    [ReaderStatus.OFFLINE]: highContrast ? 'text-red-800' : 'text-red-600',
    [ReaderStatus.ERROR]: highContrast ? 'text-amber-800' : 'text-amber-600',
    [ReaderStatus.MAINTENANCE]: highContrast ? 'text-blue-800' : 'text-blue-600'
  };
  return colors[status];
};

/**
 * Returns signal strength indicator with appropriate styling
 */
const getSignalStrengthIndicator = (strength: number): React.ReactNode => {
  const getBarCount = () => {
    if (strength >= SIGNAL_STRENGTH_THRESHOLDS.EXCELLENT) return 4;
    if (strength >= SIGNAL_STRENGTH_THRESHOLDS.GOOD) return 3;
    if (strength >= SIGNAL_STRENGTH_THRESHOLDS.FAIR) return 2;
    if (strength >= SIGNAL_STRENGTH_THRESHOLDS.POOR) return 1;
    return 0;
  };

  const bars = Array(4).fill(0).map((_, index) => (
    <div
      key={index}
      className={`h-${index + 1} w-1 mx-0.5 rounded ${
        index < getBarCount() ? 'bg-blue-600' : 'bg-gray-300'
      }`}
      role="presentation"
    />
  ));

  return (
    <div 
      className="flex items-end h-4" 
      role="meter" 
      aria-label={`Signal strength: ${strength}dBm`}
      aria-valuemin={-70}
      aria-valuemax={-20}
      aria-valuenow={strength}
    >
      {bars}
    </div>
  );
};

/**
 * Enhanced ReaderList component with accessibility and performance optimizations
 */
const ReaderList: React.FC<ReaderListProps> = ({
  onReaderSelect,
  filterStatus = [],
  className = '',
  virtualizeOptions = { itemHeight: 48, overscan: 5 },
  accessibilityLabels = {
    readerStatus: 'Reader Status:',
    lastHeartbeat: 'Last seen:'
  }
}) => {
  const { t } = useTranslation();
  const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' }>({
    key: 'name',
    order: 'asc'
  });

  // Initialize reader hook with auto-refresh
  const { readers, loading, error } = useReader(undefined, {
    autoConnect: true,
    enablePerformanceMonitoring: true,
    pollingInterval: REFRESH_INTERVAL
  });

  // Memoized table columns configuration
  const columns = useMemo<TableColumn<typeof readers[0]>[]>(() => [
    {
      key: 'id',
      title: t('readers.columns.id'),
      sortable: true,
      width: '120px'
    },
    {
      key: 'name',
      title: t('readers.columns.name'),
      sortable: true,
      width: '200px'
    },
    {
      key: 'status',
      title: t('readers.columns.status'),
      sortable: true,
      width: '120px',
      render: (value: ReaderStatus) => (
        <div className="flex items-center">
          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStatusColor(value)}`} />
          <span>{t(`readers.status.${value.toLowerCase()}`)}</span>
        </div>
      )
    },
    {
      key: 'signalStrength',
      title: t('readers.columns.signal'),
      sortable: true,
      width: '150px',
      render: (value: number) => getSignalStrengthIndicator(value)
    },
    {
      key: 'lastHeartbeat',
      title: t('readers.columns.lastHeartbeat'),
      sortable: true,
      width: '180px',
      render: (value: Date) => (
        <span title={value.toISOString()}>
          {formatDistanceToNow(value, { addSuffix: true })}
        </span>
      )
    },
    {
      key: 'actions',
      title: t('readers.columns.actions'),
      width: '120px',
      render: (_, reader) => (
        <div className="flex space-x-2">
          <button
            onClick={() => onReaderSelect?.(reader.id, ReaderAction.CONFIGURE)}
            className="p-2 hover:bg-gray-100 rounded"
            aria-label={t('readers.actions.configure')}
          >
            <span className="material-icons">settings</span>
          </button>
          <button
            onClick={() => onReaderSelect?.(reader.id, ReaderAction.VIEW_STATS)}
            className="p-2 hover:bg-gray-100 rounded"
            aria-label={t('readers.actions.viewStats')}
          >
            <span className="material-icons">analytics</span>
          </button>
        </div>
      )
    }
  ], [t, onReaderSelect]);

  // Filter and sort readers
  const filteredReaders = useMemo(() => {
    let result = Object.values(readers);

    if (filterStatus.length > 0) {
      result = result.filter(reader => filterStatus.includes(reader.status));
    }

    result.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue < bValue) return sortConfig.order === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.order === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [readers, filterStatus, sortConfig]);

  // Handle sort changes
  const handleSort = useCallback((column: string, order: 'asc' | 'desc') => {
    setSortConfig({ key: column, order });
  }, []);

  if (error) {
    return (
      <div role="alert" className="text-red-600 p-4">
        {t('readers.errors.loadFailed')}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={`reader-list ${className}`}>
        <Table
          data={filteredReaders}
          columns={columns}
          loading={loading}
          onSort={handleSort}
          virtualScroll={true}
          rowHeight={virtualizeOptions.itemHeight}
          aria-label={t('readers.tableAriaLabel')}
          keyboardNavigation={true}
        />
      </div>
    </ErrorBoundary>
  );
};

export default React.memo(ReaderList);