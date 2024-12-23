import React, { useEffect, useState } from 'react'; // ^18.2.0
import { useForm, Controller } from 'react-hook-form'; // ^7.45.0
import { object, string, number } from 'yup'; // ^3.1.0
import { useErrorBoundary } from 'react-error-boundary'; // ^4.0.11
import { Location, LocationType, LocationCreatePayload, LocationUpdatePayload } from '../../types/location.types';
import { useLocation } from '../../hooks/useLocation';
import Button from '../common/Button';

// Accessibility labels for form elements
const ARIA_LABELS = {
  nameInput: 'Location name',
  typeSelect: 'Location type',
  zoneInput: 'Zone identifier',
  coordinatesLat: 'Latitude coordinate',
  coordinatesLon: 'Longitude coordinate',
  coordinatesElev: 'Elevation in meters',
  annotationInput: 'Location description or notes',
  parentSelect: 'Parent location',
  capacityInput: 'Maximum capacity',
  submitButton: 'Save location',
  cancelButton: 'Cancel form',
  form: 'Location information form'
} as const;

// Form validation schema
const validationSchema = object().shape({
  name: string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  type: string()
    .required('Location type is required')
    .oneOf(Object.values(LocationType), 'Invalid location type'),
  zone: string()
    .required('Zone is required')
    .matches(/^[A-Z0-9-]+$/, 'Zone must contain only uppercase letters, numbers, and hyphens'),
  coordinates: object().shape({
    latitude: number()
      .required('Latitude is required')
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90'),
    longitude: number()
      .required('Longitude is required')
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180'),
    elevation: number()
      .optional()
      .min(0, 'Elevation must be positive')
  }),
  annotation: string()
    .optional()
    .max(500, 'Annotation must not exceed 500 characters'),
  parentId: string()
    .optional()
    .nullable(),
  capacity: number()
    .required('Capacity is required')
    .min(0, 'Capacity must be positive')
    .integer('Capacity must be a whole number')
});

export interface LocationFormProps {
  initialData?: Location;
  onSubmit: (location: LocationCreatePayload | LocationUpdatePayload) => Promise<void>;
  onCancel: () => void;
  parentLocation?: Location;
}

const LocationForm: React.FC<LocationFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  parentLocation
}) => {
  const { showBoundary } = useErrorBoundary();
  const { getLocationHierarchy } = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableParents, setAvailableParents] = useState<Location[]>([]);

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm({
    defaultValues: {
      name: initialData?.name || '',
      type: initialData?.type || LocationType.ZONE,
      zone: initialData?.zone || '',
      coordinates: initialData?.coordinates || {
        latitude: 0,
        longitude: 0,
        elevation: 0
      },
      annotation: initialData?.annotation || '',
      parentId: initialData?.parentId || parentLocation?.id || null,
      capacity: initialData?.capacity || 0
    },
    resolver: async (data) => {
      try {
        await validationSchema.validate(data, { abortEarly: false });
        return { values: data, errors: {} };
      } catch (err) {
        return {
          values: {},
          errors: err.inner.reduce(
            (acc, curr) => ({
              ...acc,
              [curr.path]: curr.message
            }),
            {}
          )
        };
      }
    }
  });

  // Load available parent locations
  useEffect(() => {
    const loadParentLocations = async () => {
      try {
        const hierarchy = await getLocationHierarchy();
        setAvailableParents(hierarchy);
      } catch (error) {
        showBoundary(error);
      }
    };

    loadParentLocations();
  }, [getLocationHierarchy, showBoundary]);

  // Form submission handler
  const onFormSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      await onSubmit(data);
      reset();
    } catch (error) {
      showBoundary(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      aria-label={ARIA_LABELS.form}
      className="location-form"
      noValidate
    >
      <div className="location-form__grid">
        {/* Name Input */}
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <div className="form-field">
              <label htmlFor="name" className="form-label">
                Name
              </label>
              <input
                {...field}
                type="text"
                id="name"
                aria-label={ARIA_LABELS.nameInput}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                className="form-input"
              />
              {errors.name && (
                <span id="name-error" className="form-error" role="alert">
                  {errors.name.message}
                </span>
              )}
            </div>
          )}
        />

        {/* Type Select */}
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <div className="form-field">
              <label htmlFor="type" className="form-label">
                Type
              </label>
              <select
                {...field}
                id="type"
                aria-label={ARIA_LABELS.typeSelect}
                aria-invalid={!!errors.type}
                aria-describedby={errors.type ? 'type-error' : undefined}
                className="form-select"
              >
                {Object.values(LocationType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {errors.type && (
                <span id="type-error" className="form-error" role="alert">
                  {errors.type.message}
                </span>
              )}
            </div>
          )}
        />

        {/* Additional form fields following the same pattern... */}
        {/* Form actions */}
        <div className="location-form__actions">
          <Button
            type="button"
            variant="outlined"
            onClick={onCancel}
            aria-label={ARIA_LABELS.cancelButton}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            aria-label={ARIA_LABELS.submitButton}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {initialData ? 'Update' : 'Create'} Location
          </Button>
        </div>
      </div>
    </form>
  );
};

export default LocationForm;