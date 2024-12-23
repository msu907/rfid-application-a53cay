import React, { useCallback, useRef, useState } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.1
import { useFocusRing } from '@react-aria/focus'; // ^3.0.0
import imageCompression from 'browser-image-compression'; // ^2.0.0

import { Button } from './Button';
import { validateAsset } from '../../utils/validation.utils';
import type { ApiResponse } from '../../types/api.types';

/**
 * Interface for image compression options
 */
interface ImageCompressionOptions {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  format: 'jpeg' | 'png' | 'webp';
}

/**
 * Interface for file upload error details
 */
interface FileUploadError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Props interface for FileUpload component
 */
interface FileUploadProps {
  /** Accepted file types */
  accept?: string[];
  /** Maximum file size in bytes */
  maxSize?: number;
  /** Minimum image dimensions */
  minDimensions?: { width: number; height: number };
  /** Maximum image dimensions */
  maxDimensions?: { width: number; height: number };
  /** Upload callback function */
  onUpload: (file: File, progress: number) => Promise<void>;
  /** Error callback function */
  onError?: (error: FileUploadError) => void;
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Allow multiple file selection */
  multiple?: boolean;
  /** Show image preview */
  showPreview?: boolean;
  /** Image compression options */
  compressionOptions?: ImageCompressionOptions;
  /** Accessible label */
  ariaLabel?: string;
  /** Number of retry attempts for failed uploads */
  retryAttempts?: number;
}

/**
 * A comprehensive file upload component with accessibility support,
 * image validation, compression, and preview capabilities.
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  accept = ['image/jpeg', 'image/png', 'image/webp'],
  maxSize = 5 * 1024 * 1024, // 5MB
  minDimensions = { width: 100, height: 100 },
  maxDimensions = { width: 4096, height: 4096 },
  onUpload,
  onError,
  className,
  disabled = false,
  multiple = false,
  showPreview = true,
  compressionOptions = {
    quality: 0.8,
    maxWidth: 1920,
    maxHeight: 1080,
    format: 'webp'
  },
  ariaLabel = 'File upload',
  retryAttempts = 3
}) => {
  // State management
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<FileUploadError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Accessibility
  const { isFocusVisible, focusProps } = useFocusRing();

  /**
   * Validates file dimensions
   */
  const validateDimensions = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve(
          img.width >= minDimensions.width &&
          img.height >= minDimensions.height &&
          img.width <= maxDimensions.width &&
          img.height <= maxDimensions.height
        );
      };
      img.onerror = () => resolve(false);
    });
  };

  /**
   * Compresses image file according to specified options
   */
  const compressImage = async (file: File): Promise<File> => {
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: maxSize / (1024 * 1024),
        maxWidthOrHeight: Math.max(compressionOptions.maxWidth, compressionOptions.maxHeight),
        useWebWorker: true,
        fileType: `image/${compressionOptions.format}`
      });
      return compressedFile;
    } catch (error) {
      throw new Error('Image compression failed');
    }
  };

  /**
   * Handles file processing including validation and compression
   */
  const processFile = async (file: File): Promise<void> => {
    try {
      // Validate file type
      if (!accept.includes(file.type)) {
        throw new Error(`Invalid file type. Accepted types: ${accept.join(', ')}`);
      }

      // Validate file size
      if (file.size > maxSize) {
        throw new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
      }

      // Validate dimensions
      const validDimensions = await validateDimensions(file);
      if (!validDimensions) {
        throw new Error('Image dimensions are outside allowed range');
      }

      // Compress image
      const compressedFile = await compressImage(file);

      // Generate preview
      if (showPreview) {
        const previewUrl = URL.createObjectURL(compressedFile);
        setPreview(previewUrl);
      }

      // Upload file with progress tracking
      await onUpload(compressedFile, 0);
      setUploadProgress(100);

      // Reset state
      setError(null);
      setRetryCount(0);

    } catch (err) {
      const uploadError: FileUploadError = {
        code: 'UPLOAD_ERROR',
        message: err instanceof Error ? err.message : 'Upload failed',
      };

      if (retryCount < retryAttempts) {
        setRetryCount(prev => prev + 1);
        await processFile(file);
      } else {
        setError(uploadError);
        onError?.(uploadError);
      }
    }
  };

  /**
   * Handles drag and drop events
   */
  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(event.dataTransfer.files);
    const validFiles = files.filter(file => accept.includes(file.type));

    if (validFiles.length) {
      processFile(validFiles[0]);
    }
  }, [disabled, accept]);

  /**
   * Handles file input change events
   */
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files?.length) {
      processFile(files[0]);
    }
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Drag event handlers
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  return (
    <div
      className={classNames(
        'file-upload',
        {
          'file-upload--dragging': isDragging,
          'file-upload--disabled': disabled,
          'file-upload--focus-visible': isFocusVisible,
        },
        className
      )}
      ref={dropZoneRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      {...focusProps}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept.join(',')}
        onChange={handleFileChange}
        disabled={disabled}
        multiple={multiple}
        className="file-upload__input"
        aria-label={ariaLabel}
        aria-describedby="file-upload-description"
        aria-invalid={!!error}
      />

      <div className="file-upload__content">
        {showPreview && preview && (
          <div className="file-upload__preview">
            <img
              src={preview}
              alt="Upload preview"
              className="file-upload__preview-image"
            />
          </div>
        )}

        <div className="file-upload__actions">
          <Button
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            ariaLabel="Choose file"
          >
            Choose File
          </Button>
          <p id="file-upload-description" className="file-upload__description">
            Drag and drop or click to select a file
          </p>
        </div>

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div
            className="file-upload__progress"
            role="progressbar"
            aria-valuenow={uploadProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="file-upload__progress-bar"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        {error && (
          <div
            className="file-upload__error"
            role="alert"
            aria-live="polite"
          >
            {error.message}
          </div>
        )}
      </div>
    </div>
  );
};

export type { FileUploadProps, FileUploadError, ImageCompressionOptions };
export default FileUpload;