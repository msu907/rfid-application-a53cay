/**
 * @fileoverview Enhanced date picker components for RFID Asset Tracking System
 * @version 1.0.0
 * @license MIT
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'; // v18.0+
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers'; // v6.0+
import { TextField, CircularProgress } from '@mui/material'; // v5.0+
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'; // v6.0+
import { formatDateTime, parseDate, validateDateRange } from '../../utils/date.utils';

// Constants
const DEBOUNCE_DELAY = 300;
const DEFAULT_LOCALE = 'en-US';
const DEFAULT_TIMEZONE = 'UTC';

// Interfaces
interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  label: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  className?: string;
  loading?: boolean;
  locale?: string;
  timezone?: string;
  ariaLabel?: string;
}

interface DateRangePickerProps {
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  className?: string;
  loading?: boolean;
  locale?: string;
  timezone?: string;
  startDateAriaLabel?: string;
  endDateAriaLabel?: string;
}

/**
 * Enhanced single date picker component with validation and accessibility
 */
const DatePickerComponent = memo(({
  value,
  onChange,
  label,
  minDate,
  maxDate,
  disabled = false,
  error = false,
  helperText,
  required = false,
  className,
  loading = false,
  locale = DEFAULT_LOCALE,
  timezone = DEFAULT_TIMEZONE,
  ariaLabel,
}: DatePickerProps) => {
  const [internalValue, setInternalValue] = useState<Date | null>(value);
  const [isValidating, setIsValidating] = useState(false);

  // Memoize date formatter with current locale
  const formatDate = useMemo(() => (date: Date | null) => {
    if (!date) return '';
    return formatDateTime(date, { locale, timezone });
  }, [locale, timezone]);

  // Handle date change with validation
  const handleDateChange = useCallback((newDate: Date | null) => {
    setInternalValue(newDate);
    setIsValidating(true);

    // Debounced validation
    const timeoutId = setTimeout(() => {
      if (newDate) {
        const isValid = validateDateRange(
          newDate,
          newDate,
          { timezone, allowFuture: true }
        ).isValid;

        if (isValid) {
          onChange(newDate);
        }
      } else {
        onChange(null);
      }
      setIsValidating(false);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timeoutId);
  }, [onChange, timezone]);

  // Cleanup effect
  useEffect(() => {
    return () => setIsValidating(false);
  }, []);

  // Accessibility props
  const accessibilityProps = {
    'aria-label': ariaLabel || label,
    'aria-required': required,
    'aria-invalid': error,
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
      <div className={className}>
        <DatePicker
          label={label}
          value={internalValue}
          onChange={handleDateChange}
          disabled={disabled || loading}
          minDate={minDate}
          maxDate={maxDate}
          renderInput={(params) => (
            <TextField
              {...params}
              {...accessibilityProps}
              error={error}
              helperText={helperText}
              required={required}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {(loading || isValidating) && (
                      <CircularProgress size={20} />
                    )}
                    {params.InputProps?.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </div>
    </LocalizationProvider>
  );
});

/**
 * Enhanced date range picker component with range validation
 */
export const DateRangePickerComponent = memo(({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  minDate,
  maxDate,
  disabled = false,
  error = false,
  helperText,
  required = false,
  className,
  loading = false,
  locale = DEFAULT_LOCALE,
  timezone = DEFAULT_TIMEZONE,
  startDateAriaLabel,
  endDateAriaLabel,
}: DateRangePickerProps) => {
  const [isValidating, setIsValidating] = useState(false);

  // Memoize date formatters
  const formatStartDate = useMemo(() => (date: Date | null) => {
    if (!date) return '';
    return formatDateTime(date, { locale, timezone });
  }, [locale, timezone]);

  const formatEndDate = useMemo(() => (date: Date | null) => {
    if (!date) return '';
    return formatDateTime(date, { locale, timezone });
  }, [locale, timezone]);

  // Handle range validation
  const validateRange = useCallback((start: Date | null, end: Date | null) => {
    if (!start || !end) return true;
    return validateDateRange(start, end, { timezone }).isValid;
  }, [timezone]);

  // Handle date changes with validation
  const handleStartDateChange = useCallback((date: Date | null) => {
    setIsValidating(true);
    const timeoutId = setTimeout(() => {
      if (validateRange(date, endDate)) {
        onStartDateChange(date);
      }
      setIsValidating(false);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timeoutId);
  }, [endDate, onStartDateChange, validateRange]);

  const handleEndDateChange = useCallback((date: Date | null) => {
    setIsValidating(true);
    const timeoutId = setTimeout(() => {
      if (validateRange(startDate, date)) {
        onEndDateChange(date);
      }
      setIsValidating(false);
    }, DEBOUNCE_DELAY);

    return () => clearTimeout(timeoutId);
  }, [startDate, onEndDateChange, validateRange]);

  // Cleanup effect
  useEffect(() => {
    return () => setIsValidating(false);
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={locale}>
      <div className={className}>
        <DatePicker
          label="Start Date"
          value={startDate}
          onChange={handleStartDateChange}
          disabled={disabled || loading}
          minDate={minDate}
          maxDate={endDate || maxDate}
          renderInput={(params) => (
            <TextField
              {...params}
              aria-label={startDateAriaLabel || "Start Date"}
              aria-required={required}
              error={error}
              helperText={helperText}
              required={required}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {(loading || isValidating) && (
                      <CircularProgress size={20} />
                    )}
                    {params.InputProps?.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
        <DatePicker
          label="End Date"
          value={endDate}
          onChange={handleEndDateChange}
          disabled={disabled || loading || !startDate}
          minDate={startDate || minDate}
          maxDate={maxDate}
          renderInput={(params) => (
            <TextField
              {...params}
              aria-label={endDateAriaLabel || "End Date"}
              aria-required={required}
              error={error}
              helperText={helperText}
              required={required}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {(loading || isValidating) && (
                      <CircularProgress size={20} />
                    )}
                    {params.InputProps?.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </div>
    </LocalizationProvider>
  );
});

// Display names for debugging
DatePickerComponent.displayName = 'DatePickerComponent';
DateRangePickerComponent.displayName = 'DateRangePickerComponent';

// Default export for single date picker
export default DatePickerComponent;