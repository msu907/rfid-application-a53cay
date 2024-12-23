import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { toast } from 'react-toastify';

import { Asset, AssetStatus } from '../../types/asset.types';
import { useAsset } from '../../hooks/useAsset';
import FileUpload from '../common/FileUpload';
import { Button } from '../common/Button';
import { validateAsset } from '../../utils/validation.utils';
import { VALIDATION_SCHEMAS } from '../../constants/validation.constants';

/**
 * Props interface for AssetForm component
 */
interface AssetFormProps {
  /** Initial asset data for edit mode */
  asset?: Asset | null;
  /** Form submission handler */
  onSubmit: (asset: Asset) => Promise<void>;
  /** Cancel handler */
  onCancel: () => void;
  /** Accessibility label */
  'aria-label'?: string;
  /** Accessibility description */
  'aria-describedby'?: string;
}

/**
 * Form data interface matching Asset type without readonly fields
 */
interface AssetFormData {
  rfidTag: string;
  name: string;
  description: string;
  status: AssetStatus;
  locationId: string;
  imageUrl?: string;
}

/**
 * Asset form component for creating and editing assets
 * Implements comprehensive validation, accessibility, and real-time feedback
 */
export const AssetForm: React.FC<AssetFormProps> = ({
  asset,
  onSubmit,
  onCancel,
  'aria-label': ariaLabel = 'Asset form',
  'aria-describedby': ariaDescribedBy
}) => {
  // State management
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Hook form setup with yup validation
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setValue,
    watch
  } = useForm<AssetFormData>({
    resolver: yupResolver(VALIDATION_SCHEMAS.ASSET),
    defaultValues: {
      rfidTag: asset?.rfidTag || '',
      name: asset?.name || '',
      description: asset?.description || '',
      status: asset?.status || AssetStatus.ACTIVE,
      locationId: asset?.locationId || '',
      imageUrl: asset?.imageUrl || ''
    }
  });

  // Custom hooks
  const { createAsset, updateAsset, uploadAssetImage } = useAsset();

  /**
   * Handles image upload with validation and compression
   */
  const handleImageUpload = useCallback(async (file: File) => {
    try {
      setImageFile(file);
      // Preview URL will be handled by FileUpload component
      setValue('imageUrl', URL.createObjectURL(file), { shouldDirty: true });
    } catch (error) {
      toast.error('Failed to process image. Please try again.');
      console.error('Image upload error:', error);
    }
  }, [setValue]);

  /**
   * Handles form submission with validation and API calls
   */
  const onFormSubmit = async (data: AssetFormData) => {
    try {
      setIsSubmitting(true);

      // Validate form data
      const validationResult = await validateAsset(data);
      if (!validationResult.isValid) {
        Object.entries(validationResult.errors).forEach(([field, message]) => {
          toast.error(message);
        });
        return;
      }

      // Handle image upload if new image selected
      let finalImageUrl = data.imageUrl;
      if (imageFile) {
        const uploadResult = await uploadAssetImage(
          asset?.id || 'temp',
          imageFile
        );
        finalImageUrl = uploadResult.imageUrl;
      }

      // Create or update asset
      const assetData = {
        ...data,
        imageUrl: finalImageUrl
      };

      if (asset) {
        // Update existing asset
        await updateAsset(asset.id, assetData);
        toast.success('Asset updated successfully');
      } else {
        // Create new asset
        await createAsset(assetData);
        toast.success('Asset created successfully');
        reset(); // Reset form for new entry
      }

      await onSubmit(assetData as Asset);

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save asset');
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset form when asset prop changes
  useEffect(() => {
    if (asset) {
      reset({
        rfidTag: asset.rfidTag,
        name: asset.name,
        description: asset.description,
        status: asset.status,
        locationId: asset.locationId,
        imageUrl: asset.imageUrl || ''
      });
    }
  }, [asset, reset]);

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit)}
      className="asset-form"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      <div className="asset-form__field">
        <label htmlFor="rfidTag" className="asset-form__label">
          RFID Tag *
        </label>
        <input
          id="rfidTag"
          type="text"
          {...register('rfidTag')}
          className="asset-form__input"
          aria-invalid={!!errors.rfidTag}
          aria-describedby="rfidTag-error"
          disabled={!!asset} // Disable in edit mode
        />
        {errors.rfidTag && (
          <span id="rfidTag-error" className="asset-form__error" role="alert">
            {errors.rfidTag.message}
          </span>
        )}
      </div>

      <div className="asset-form__field">
        <label htmlFor="name" className="asset-form__label">
          Name *
        </label>
        <input
          id="name"
          type="text"
          {...register('name')}
          className="asset-form__input"
          aria-invalid={!!errors.name}
          aria-describedby="name-error"
        />
        {errors.name && (
          <span id="name-error" className="asset-form__error" role="alert">
            {errors.name.message}
          </span>
        )}
      </div>

      <div className="asset-form__field">
        <label htmlFor="description" className="asset-form__label">
          Description
        </label>
        <textarea
          id="description"
          {...register('description')}
          className="asset-form__textarea"
          aria-invalid={!!errors.description}
          aria-describedby="description-error"
        />
        {errors.description && (
          <span id="description-error" className="asset-form__error" role="alert">
            {errors.description.message}
          </span>
        )}
      </div>

      <div className="asset-form__field">
        <label htmlFor="status" className="asset-form__label">
          Status *
        </label>
        <select
          id="status"
          {...register('status')}
          className="asset-form__select"
          aria-invalid={!!errors.status}
          aria-describedby="status-error"
        >
          {Object.values(AssetStatus).map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        {errors.status && (
          <span id="status-error" className="asset-form__error" role="alert">
            {errors.status.message}
          </span>
        )}
      </div>

      <div className="asset-form__field">
        <label htmlFor="image" className="asset-form__label">
          Asset Image
        </label>
        <FileUpload
          accept={['image/jpeg', 'image/png', 'image/webp']}
          maxSize={5 * 1024 * 1024} // 5MB
          onUpload={handleImageUpload}
          showPreview
          ariaLabel="Asset image upload"
        />
      </div>

      <div className="asset-form__actions">
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || !isDirty}
          loading={isSubmitting}
          ariaLabel="Save asset"
        >
          {asset ? 'Update Asset' : 'Create Asset'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
          ariaLabel="Cancel"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};

export type { AssetFormProps };
export default AssetForm;