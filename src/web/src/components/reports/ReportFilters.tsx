/**
 * @fileoverview Advanced filtering component for RFID asset tracking reports
 * @version 1.0.0
 * @license MIT
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Grid, Paper, Button, CircularProgress } from '@mui/material'; // v5.0.0
import { debounce } from 'lodash'; // v4.17.21
import { DateRangePickerComponent } from '../common/DatePicker';
import { Dropdown } from '../common/Dropdown';
import { validateDateRange } from '../../utils/date.utils';

// Constants
const FILTER_UPDATE_DELAY = 500;
const MAX_DATE_RANGE_DAYS = 365;

// Interfaces
interface ReportFilters {
  startDate: Date | null;
  endDate: Date | null;
  assetType: string | null;
  location: string | null;
  readerId: string | null;
}

interface ReportFiltersProps {
  onFilterChange: (filters: ReportFilters) => void;
  initialFilters?: Partial<ReportFilters>;
  isLoading?: boolean;
  className?: string;
}

interface FilterOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// Asset type options based on system requirements
const assetTypeOptions: FilterOption[] = [
  { value: 'all', label: 'All Assets' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'inventory', label: 'Inventory' },
];

// Location options based on system zones
const locationOptions: FilterOption[] = [
  { value: 'all', label: 'All Locations' },
  { value: 'zone-a', label: 'Zone A' },
  { value: 'zone-b', label: 'Zone B' },
  { value: 'zone-c', label: 'Zone C' },
];

// Reader options based on infrastructure
const readerOptions: FilterOption[] = [
  { value: 'all', label: 'All Readers' },
  { value: 'reader-1', label: 'Reader RD-01' },
  { value: 'reader-2', label: 'Reader RD-02' },
  { value: 'reader-3', label: 'Reader RD-03' },
];

/**
 * ReportFilters component providing comprehensive filtering capabilities
 * for RFID asset tracking reports
 */
export const ReportFilters: React.FC<ReportFiltersProps> = ({
  onFilterChange,
  initialFilters = {},
  isLoading = false,
  className,
}) => {
  // State management
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: initialFilters.startDate || null,
    endDate: initialFilters.endDate || null,
    assetType: initialFilters.assetType || 'all',
    location: initialFilters.location || 'all',
    readerId: initialFilters.readerId || 'all',
  });

  const [error, setError] = useState<string | null>(null);

  // Memoized debounced filter update
  const debouncedFilterChange = useMemo(
    () => debounce(onFilterChange, FILTER_UPDATE_DELAY),
    [onFilterChange]
  );

  // Date range validation and handling
  const handleDateRangeChange = useCallback((startDate: Date | null, endDate: Date | null) => {
    if (startDate && endDate) {
      const validation = validateDateRange(startDate, endDate, {
        maxRange: MAX_DATE_RANGE_DAYS,
        allowFuture: false,
      });

      if (!validation.isValid) {
        setError(validation.error);
        return;
      }
    }

    setError(null);
    setFilters(prev => ({
      ...prev,
      startDate,
      endDate,
    }));
  }, []);

  // Asset type selection handler
  const handleAssetTypeChange = useCallback((value: string | number) => {
    setFilters(prev => ({
      ...prev,
      assetType: value as string,
    }));
  }, []);

  // Location selection handler
  const handleLocationChange = useCallback((value: string | number) => {
    setFilters(prev => ({
      ...prev,
      location: value as string,
    }));
  }, []);

  // Reader selection handler
  const handleReaderChange = useCallback((value: string | number) => {
    setFilters(prev => ({
      ...prev,
      readerId: value as string,
    }));
  }, []);

  // Reset filters handler
  const handleResetFilters = useCallback(() => {
    setFilters({
      startDate: null,
      endDate: null,
      assetType: 'all',
      location: 'all',
      readerId: 'all',
    });
    setError(null);
  }, []);

  // Trigger filter updates
  useEffect(() => {
    if (!error) {
      debouncedFilterChange(filters);
    }
    return () => {
      debouncedFilterChange.cancel();
    };
  }, [filters, error, debouncedFilterChange]);

  return (
    <Paper 
      className={className}
      elevation={2}
      sx={{ p: 2, mb: 2 }}
      role="region"
      aria-label="Report Filters"
    >
      <Grid container spacing={2}>
        {/* Date Range Selection */}
        <Grid item xs={12} md={6}>
          <DateRangePickerComponent
            startDate={filters.startDate}
            endDate={filters.endDate}
            onStartDateChange={(date) => handleDateRangeChange(date, filters.endDate)}
            onEndDateChange={(date) => handleDateRangeChange(filters.startDate, date)}
            error={!!error}
            helperText={error}
            disabled={isLoading}
            required
            startDateAriaLabel="Filter Start Date"
            endDateAriaLabel="Filter End Date"
          />
        </Grid>

        {/* Asset Type Filter */}
        <Grid item xs={12} md={6}>
          <Dropdown
            options={assetTypeOptions}
            value={filters.assetType || 'all'}
            onChange={handleAssetTypeChange}
            placeholder="Select Asset Type"
            disabled={isLoading}
            aria-label="Filter by Asset Type"
          />
        </Grid>

        {/* Location Filter */}
        <Grid item xs={12} md={6}>
          <Dropdown
            options={locationOptions}
            value={filters.location || 'all'}
            onChange={handleLocationChange}
            placeholder="Select Location"
            disabled={isLoading}
            aria-label="Filter by Location"
          />
        </Grid>

        {/* Reader Filter */}
        <Grid item xs={12} md={6}>
          <Dropdown
            options={readerOptions}
            value={filters.readerId || 'all'}
            onChange={handleReaderChange}
            placeholder="Select Reader"
            disabled={isLoading}
            aria-label="Filter by Reader"
          />
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12} container justifyContent="flex-end" spacing={1}>
          <Grid item>
            <Button
              variant="outlined"
              onClick={handleResetFilters}
              disabled={isLoading}
              aria-label="Reset Filters"
            >
              Reset
            </Button>
          </Grid>
          <Grid item>
            {isLoading && <CircularProgress size={24} sx={{ mr: 1 }} />}
            <Button
              variant="contained"
              color="primary"
              onClick={() => onFilterChange(filters)}
              disabled={isLoading || !!error}
              aria-label="Apply Filters"
            >
              Apply Filters
            </Button>
          </Grid>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default ReportFilters;