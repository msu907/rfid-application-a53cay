import React, { useCallback, useMemo } from 'react';
import { format } from 'date-fns'; // ^2.29.0
import { Paper, Tooltip } from '@mui/material'; // ^5.0.0
import Table, { TableProps, TableColumn, SortOrder } from '../common/Table';
import { PaginatedResponse } from '../../types/api.types';
import useWebSocket from '../../hooks/useWebSocket';

// Constants for signal strength visualization
const SIGNAL_STRENGTH = {
  EXCELLENT: { threshold: -50, color: '#4caf50', label: 'Excellent' },
  GOOD: { threshold: -70, color: '#8bc34a', label: 'Good' },
  FAIR: { threshold: -85, color: '#ffc107', label: 'Fair' },
  POOR: { threshold: -100, color: '#f44336', label: 'Poor' }
} as const;

/**
 * Interface for report data structure
 */
interface ReportData {
  assetId: string;
  assetName: string;
  locationId: string;
  locationName: string;
  readerId: string;
  timestamp: string;
  signalStrength: number;
}

/**
 * Props interface for ReportTable component
 */
interface ReportTableProps {
  data: PaginatedResponse<ReportData>;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onSort: (column: string, order: SortOrder) => void;
  timezone?: string;
}

/**
 * Enhanced report table component with real-time updates and accessibility features
 */
const ReportTable: React.FC<ReportTableProps> = ({
  data,
  loading = false,
  onPageChange,
  onSort,
  timezone = 'UTC'
}) => {
  // Initialize WebSocket connection for real-time updates
  const { isConnected } = useWebSocket('report-updates', {
    autoConnect: true,
    heartbeatInterval: 30000
  });

  /**
   * Formats timestamp with timezone support
   */
  const formatTimestamp = useCallback((timestamp: string): string => {
    try {
      return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: timezone });
    } catch (error) {
      console.error('Date formatting error:', error);
      return timestamp;
    }
  }, [timezone]);

  /**
   * Renders signal strength indicator with accessibility features
   */
  const renderSignalStrength = useCallback((strength: number): JSX.Element => {
    let category = SIGNAL_STRENGTH.POOR;
    if (strength >= SIGNAL_STRENGTH.EXCELLENT.threshold) {
      category = SIGNAL_STRENGTH.EXCELLENT;
    } else if (strength >= SIGNAL_STRENGTH.GOOD.threshold) {
      category = SIGNAL_STRENGTH.GOOD;
    } else if (strength >= SIGNAL_STRENGTH.FAIR.threshold) {
      category = SIGNAL_STRENGTH.FAIR;
    }

    return (
      <Tooltip 
        title={`${category.label} (${strength} dBm)`}
        aria-label={`Signal strength: ${category.label}, ${strength} decibel-milliwatts`}
      >
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: category.color,
            display: 'inline-block',
            marginRight: '8px',
            verticalAlign: 'middle'
          }}
          role="img"
          aria-hidden="true"
        />
      </Tooltip>
    );
  }, []);

  /**
   * Defines table columns with enhanced accessibility
   */
  const columns = useMemo((): TableColumn<ReportData>[] => [
    {
      key: 'assetId',
      title: 'Asset ID',
      sortable: true,
      width: '120px',
      headerRender: (title) => (
        <span role="columnheader" aria-sort="none">
          {title}
        </span>
      )
    },
    {
      key: 'assetName',
      title: 'Asset Name',
      sortable: true,
      width: '200px',
      headerRender: (title) => (
        <span role="columnheader" aria-sort="none">
          {title}
        </span>
      )
    },
    {
      key: 'locationName',
      title: 'Location',
      sortable: true,
      width: '200px',
      headerRender: (title) => (
        <span role="columnheader" aria-sort="none">
          {title}
        </span>
      )
    },
    {
      key: 'readerId',
      title: 'Reader ID',
      sortable: true,
      width: '120px',
      headerRender: (title) => (
        <span role="columnheader" aria-sort="none">
          {title}
        </span>
      )
    },
    {
      key: 'timestamp',
      title: 'Timestamp',
      sortable: true,
      width: '200px',
      render: (value) => formatTimestamp(value as string),
      headerRender: (title) => (
        <span role="columnheader" aria-sort="none">
          {title}
        </span>
      )
    },
    {
      key: 'signalStrength',
      title: 'Signal Strength',
      sortable: true,
      width: '150px',
      render: (value) => renderSignalStrength(value as number),
      headerRender: (title) => (
        <span role="columnheader" aria-sort="none">
          {title}
        </span>
      )
    }
  ], [formatTimestamp, renderSignalStrength]);

  return (
    <Paper 
      elevation={2}
      sx={{ padding: 2 }}
      role="region"
      aria-label="RFID Asset Reports"
    >
      <Table<ReportData>
        data={data.items}
        columns={columns}
        pagination={data}
        onPageChange={onPageChange}
        onSort={onSort}
        loading={loading}
        className="report-table"
        aria-label="Asset tracking report table"
        keyboardNavigation
        virtualScroll
        rowHeight={48}
      />
      {isConnected && (
        <div 
          role="status" 
          aria-live="polite" 
          className="connection-status"
        >
          Real-time updates active
        </div>
      )}
    </Paper>
  );
};

export default React.memo(ReportTable);