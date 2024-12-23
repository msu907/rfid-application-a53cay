/**
 * @fileoverview Reports Page Component
 * @version 1.0.0
 * 
 * A comprehensive React component for displaying RFID asset tracking reports
 * with real-time updates, data visualization, and filtering capabilities.
 * Implements performance optimizations and accessibility features.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Grid, Paper, Typography, CircularProgress, Alert } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { debounce } from 'lodash';
import { ErrorBoundary } from 'react-error-boundary';

import ReportChart from '../components/reports/ReportChart';
import ReportFilters from '../components/reports/ReportFilters';
import ReportTable from '../components/reports/ReportTable';
import useWebSocket from '../hooks/useWebSocket';
import { SortOrder } from '../types/api.types';

// Constants for component configuration
const DEBOUNCE_DELAY = 500;
const CHART_UPDATE_INTERVAL = 1000;
const DEFAULT_PAGE_SIZE = 10;

/**
 * Interface for report filter state
 */
interface ReportFilters {
  startDate: Date | null;
  endDate: Date | null;
  assetType: string | null;
  location: string | null;
  readerId: string | null;
}

/**
 * Reports page component providing comprehensive RFID asset tracking visualization
 */
const ReportsPage: React.FC = () => {
  // Redux state management
  const dispatch = useDispatch();
  const { reports, loading, error } = useSelector((state: any) => state.reports);

  // Local state management
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: null,
    endDate: null,
    assetType: null,
    location: null,
    readerId: null
  });

  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({
    column: 'timestamp',
    order: SortOrder.DESC
  });

  // WebSocket connection for real-time updates
  const { isConnected, data: wsData } = useWebSocket('report-updates', {
    autoConnect: true,
    heartbeatInterval: 30000,
    reconnectAttempts: 5
  });

  /**
   * Memoized chart options with performance optimization
   */
  const chartOptions = useMemo(() => ({
    height: 400,
    margins: { top: 20, right: 30, bottom: 40, left: 50 },
    animation: {
      duration: 300,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    },
    decimation: {
      enabled: true,
      threshold: 1000,
      algorithm: 'lttb'
    }
  }), []);

  /**
   * Handles filter changes with debouncing
   */
  const handleFilterChange = useCallback(
    debounce((newFilters: ReportFilters) => {
      setFilters(newFilters);
      setCurrentPage(1);
      dispatch({
        type: 'FETCH_REPORTS',
        payload: {
          filters: newFilters,
          page: 1,
          pageSize: DEFAULT_PAGE_SIZE,
          sortConfig
        }
      });
    }, DEBOUNCE_DELAY),
    [dispatch, sortConfig]
  );

  /**
   * Handles real-time data updates from WebSocket
   */
  const handleWebSocketUpdate = useCallback((wsData: any) => {
    if (!wsData) return;

    dispatch({
      type: 'UPDATE_REPORTS',
      payload: wsData
    });
  }, [dispatch]);

  /**
   * Handles sorting changes
   */
  const handleSort = useCallback((column: string, order: SortOrder) => {
    setSortConfig({ column, order });
    dispatch({
      type: 'FETCH_REPORTS',
      payload: {
        filters,
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
        sortConfig: { column, order }
      }
    });
  }, [dispatch, filters, currentPage]);

  /**
   * Handles page changes
   */
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    dispatch({
      type: 'FETCH_REPORTS',
      payload: {
        filters,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        sortConfig
      }
    });
  }, [dispatch, filters, sortConfig]);

  // Initialize reports data
  useEffect(() => {
    dispatch({
      type: 'FETCH_REPORTS',
      payload: {
        filters,
        page: currentPage,
        pageSize: DEFAULT_PAGE_SIZE,
        sortConfig
      }
    });
  }, [dispatch]);

  // Handle WebSocket updates
  useEffect(() => {
    if (wsData) {
      handleWebSocketUpdate(wsData);
    }
  }, [wsData, handleWebSocketUpdate]);

  /**
   * Error fallback component
   */
  const ErrorFallback = ({ error }: { error: Error }) => (
    <Alert 
      severity="error" 
      sx={{ mb: 2 }}
      role="alert"
    >
      <Typography variant="h6">Error Loading Reports</Typography>
      <Typography>{error.message}</Typography>
    </Alert>
  );

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        RFID Asset Reports
      </Typography>

      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Grid container spacing={3}>
          {/* Filters Section */}
          <Grid item xs={12}>
            <ReportFilters
              onFilterChange={handleFilterChange}
              isLoading={loading}
            />
          </Grid>

          {/* Chart Section */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, height: '450px' }} elevation={2}>
              {loading ? (
                <CircularProgress />
              ) : (
                <ReportChart
                  data={reports.chartData}
                  chartType={chartType}
                  options={chartOptions}
                  accessibilityLabel="Asset tracking visualization chart"
                />
              )}
            </Paper>
          </Grid>

          {/* Table Section */}
          <Grid item xs={12}>
            <ReportTable
              data={reports}
              loading={loading}
              onPageChange={handlePageChange}
              onSort={handleSort}
            />
          </Grid>

          {/* Real-time Status */}
          {isConnected && (
            <Grid item xs={12}>
              <Alert severity="info" icon={false}>
                <Typography variant="body2">
                  Real-time updates active
                </Typography>
              </Alert>
            </Grid>
          )}

          {/* Error Display */}
          {error && (
            <Grid item xs={12}>
              <Alert 
                severity="error"
                onClose={() => dispatch({ type: 'CLEAR_REPORTS_ERROR' })}
              >
                {error.message}
              </Alert>
            </Grid>
          )}
        </Grid>
      </ErrorBoundary>
    </Container>
  );
};

export default React.memo(ReportsPage);