/**
 * ReaderConfig Component
 * Provides interface for configuring RFID reader settings with comprehensive validation
 * and real-time feedback following Material Design principles.
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form'; // v7.45.0
import { toast } from 'react-toastify'; // v9.1.3
import { debounce } from 'lodash'; // v4.17.21

import { useReader } from '../../hooks/useReader';
import { PowerLevel, ReaderConfig as IReaderConfig } from '../../types/reader.types';
import Button from '../common/Button';

// Constants for validation
const READ_INTERVAL_LIMITS = {
  MIN: 100,
  MAX: 5000,
  DEFAULT: 1000
};

const SIGNAL_STRENGTH_LIMITS = {
  MIN: -70,
  MAX: -20,
  DEFAULT: -35
};

export interface ReaderConfigProps {
  readerId: string;
  initialConfig: IReaderConfig;
  onConfigUpdate: (config: IReaderConfig) => void;
  onValidationError: (errors: ValidationError[]) => void;
  disabled?: boolean;
}

interface FormValues {
  powerLevel: PowerLevel;
  readIntervalMs: number;
  filteringEnabled: boolean;
  signalStrengthDbm: number;
}

/**
 * ReaderConfig component for managing RFID reader settings
 */
const ReaderConfig: React.FC<ReaderConfigProps> = React.memo(({
  readerId,
  initialConfig,
  onConfigUpdate,
  onValidationError,
  disabled = false
}) => {
  const { updateReaderConfig, validateConfig } = useReader();

  // Initialize form with validation rules
  const { control, handleSubmit, watch, formState: { errors, isDirty } } = useForm<FormValues>({
    defaultValues: {
      powerLevel: initialConfig.powerLevel,
      readIntervalMs: initialConfig.readIntervalMs,
      filteringEnabled: initialConfig.filteringEnabled,
      signalStrengthDbm: initialConfig.signalStrengthThreshold
    },
    mode: 'onChange'
  });

  // Watch form values for real-time validation
  const formValues = watch();

  /**
   * Debounced validation handler for real-time feedback
   */
  const validateConfiguration = useCallback(
    debounce(async (data: FormValues) => {
      try {
        const validationResult = await validateConfig({
          ...initialConfig,
          powerLevel: data.powerLevel,
          readIntervalMs: data.readIntervalMs,
          filteringEnabled: data.filteringEnabled,
          signalStrengthThreshold: data.signalStrengthDbm
        });

        if (!validationResult.isValid) {
          onValidationError(validationResult.errors);
        }
      } catch (error) {
        console.error('Configuration validation failed:', error);
      }
    }, 300),
    [initialConfig, validateConfig, onValidationError]
  );

  // Trigger validation on form value changes
  useEffect(() => {
    if (isDirty) {
      validateConfiguration(formValues);
    }
  }, [formValues, isDirty, validateConfiguration]);

  /**
   * Handle form submission with validation
   */
  const onSubmit = async (data: FormValues) => {
    try {
      const updatedConfig: IReaderConfig = {
        ...initialConfig,
        powerLevel: data.powerLevel,
        readIntervalMs: data.readIntervalMs,
        filteringEnabled: data.filteringEnabled,
        signalStrengthThreshold: data.signalStrengthDbm
      };

      await updateReaderConfig(readerId, updatedConfig);
      onConfigUpdate(updatedConfig);
      toast.success('Reader configuration updated successfully');
    } catch (error) {
      console.error('Failed to update reader configuration:', error);
      toast.error('Failed to update reader configuration');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="reader-config">
      <div className="reader-config__section">
        <h3>Power Settings</h3>
        
        <Controller
          name="powerLevel"
          control={control}
          rules={{ required: 'Power level is required' }}
          render={({ field }) => (
            <div className="form-field">
              <label htmlFor="powerLevel">Power Level</label>
              <select
                {...field}
                id="powerLevel"
                disabled={disabled}
                className={errors.powerLevel ? 'error' : ''}
              >
                <option value={PowerLevel.LOW}>Low (-70dBm to -55dBm)</option>
                <option value={PowerLevel.MEDIUM}>Medium (-55dBm to -35dBm)</option>
                <option value={PowerLevel.HIGH}>High (-35dBm to -20dBm)</option>
              </select>
              {errors.powerLevel && (
                <span className="error-message">{errors.powerLevel.message}</span>
              )}
            </div>
          )}
        />

        <Controller
          name="signalStrengthDbm"
          control={control}
          rules={{
            required: 'Signal strength threshold is required',
            min: {
              value: SIGNAL_STRENGTH_LIMITS.MIN,
              message: `Minimum signal strength is ${SIGNAL_STRENGTH_LIMITS.MIN}dBm`
            },
            max: {
              value: SIGNAL_STRENGTH_LIMITS.MAX,
              message: `Maximum signal strength is ${SIGNAL_STRENGTH_LIMITS.MAX}dBm`
            }
          }}
          render={({ field }) => (
            <div className="form-field">
              <label htmlFor="signalStrengthDbm">Signal Strength Threshold (dBm)</label>
              <input
                {...field}
                type="number"
                id="signalStrengthDbm"
                disabled={disabled}
                className={errors.signalStrengthDbm ? 'error' : ''}
              />
              {errors.signalStrengthDbm && (
                <span className="error-message">{errors.signalStrengthDbm.message}</span>
              )}
            </div>
          )}
        />
      </div>

      <div className="reader-config__section">
        <h3>Read Settings</h3>
        
        <Controller
          name="readIntervalMs"
          control={control}
          rules={{
            required: 'Read interval is required',
            min: {
              value: READ_INTERVAL_LIMITS.MIN,
              message: `Minimum interval is ${READ_INTERVAL_LIMITS.MIN}ms`
            },
            max: {
              value: READ_INTERVAL_LIMITS.MAX,
              message: `Maximum interval is ${READ_INTERVAL_LIMITS.MAX}ms`
            }
          }}
          render={({ field }) => (
            <div className="form-field">
              <label htmlFor="readIntervalMs">Read Interval (ms)</label>
              <input
                {...field}
                type="number"
                id="readIntervalMs"
                disabled={disabled}
                className={errors.readIntervalMs ? 'error' : ''}
              />
              {errors.readIntervalMs && (
                <span className="error-message">{errors.readIntervalMs.message}</span>
              )}
            </div>
          )}
        />

        <Controller
          name="filteringEnabled"
          control={control}
          render={({ field: { value, onChange } }) => (
            <div className="form-field">
              <label htmlFor="filteringEnabled">Enable Read Filtering</label>
              <input
                type="checkbox"
                id="filteringEnabled"
                checked={value}
                onChange={onChange}
                disabled={disabled}
              />
            </div>
          )}
        />
      </div>

      <div className="reader-config__actions">
        <Button
          type="submit"
          variant="primary"
          disabled={disabled || !isDirty}
          ariaLabel="Save reader configuration"
        >
          Save Configuration
        </Button>
      </div>
    </form>
  );
});

ReaderConfig.displayName = 'ReaderConfig';

export default ReaderConfig;