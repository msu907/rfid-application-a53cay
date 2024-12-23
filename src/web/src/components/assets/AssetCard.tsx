import React, { memo, useCallback, useEffect, useMemo } from 'react';
import classNames from 'classnames'; // v2.3.1
import { format } from 'date-fns'; // v2.29.0

import { Asset } from '../../types/asset.types';
import Card from '../common/Card';
import { useAsset } from '../../hooks/useAsset';
import { useWebSocket } from '../../hooks/useWebSocket';

// Constants for component configuration
const IMAGE_LOADING_STRATEGY = 'lazy';
const ANIMATION_DURATION = 300;
const STATUS_UPDATE_DEBOUNCE = 500;

/**
 * Props interface for AssetCard component with comprehensive type safety
 */
export interface AssetCardProps {
  /** Asset data object */
  asset: Asset;
  /** Optional CSS class name */
  className?: string;
  /** Click handler for the card */
  onClick?: (asset: Asset) => void;
  /** Flag to enable interactive features */
  interactive?: boolean;
  /** Flag to show detailed information */
  showDetails?: boolean;
  /** Flag to enable change animations */
  animateChanges?: boolean;
  /** Test ID for component testing */
  testId?: string;
}

/**
 * Maps asset status to corresponding color classes
 * Memoized for performance optimization
 */
const getStatusColor = memo((status: string): string => {
  const statusColorMap: Record<string, string> = {
    ACTIVE: 'bg-green-500',
    INACTIVE: 'bg-gray-500',
    MAINTENANCE: 'bg-yellow-500'
  };
  return statusColorMap[status] || 'bg-gray-500';
});

/**
 * Formats the last seen timestamp with relative time support
 * Memoized for performance optimization
 */
const formatLastSeen = memo((lastSeen: Date | null): string => {
  if (!lastSeen) return 'Never';
  
  const now = new Date();
  const diff = now.getTime() - lastSeen.getTime();
  
  if (diff < 24 * 60 * 60 * 1000) { // Less than 24 hours
    return format(lastSeen, "'Last seen' p");
  }
  return format(lastSeen, "'Last seen on' MMM d, yyyy");
});

/**
 * AssetCard component for displaying asset information in a Material Design card format
 * Implements real-time updates, accessibility features, and optimized performance
 */
export const AssetCard: React.FC<AssetCardProps> = memo(({
  asset,
  className,
  onClick,
  interactive = false,
  showDetails = true,
  animateChanges = true,
  testId = 'asset-card'
}) => {
  const { updateAsset } = useAsset();
  const { subscribe, unsubscribe } = useWebSocket('assets');

  // Memoized values for performance optimization
  const statusColor = useMemo(() => getStatusColor(asset.status), [asset.status]);
  const lastSeenFormatted = useMemo(() => formatLastSeen(asset.lastSeen), [asset.lastSeen]);
  
  // Handle real-time asset updates
  const handleAssetUpdate = useCallback((updatedAsset: Asset) => {
    if (updatedAsset.id === asset.id) {
      updateAsset(updatedAsset);
    }
  }, [asset.id, updateAsset]);

  // Subscribe to real-time updates on mount
  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  // Click handler with accessibility support
  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (interactive && onClick) {
      onClick(asset);
    }
  }, [interactive, onClick, asset]);

  // Keyboard handler for accessibility
  const handleKeyPress = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (interactive && onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick(asset);
    }
  }, [interactive, onClick, asset]);

  // Compute component classes
  const cardClasses = classNames(
    'asset-card',
    {
      'asset-card--interactive': interactive,
      'asset-card--animate': animateChanges,
    },
    className
  );

  return (
    <Card
      className={cardClasses}
      onClick={handleClick}
      onKeyPress={handleKeyPress}
      interactive={interactive}
      testId={testId}
      role="article"
      ariaLabel={`Asset: ${asset.name}`}
    >
      <div className="asset-card__content">
        {/* Asset Image */}
        <div className="asset-card__image">
          <img
            src={asset.imageUrl || '/assets/images/placeholder.png'}
            alt={`${asset.name} asset`}
            loading={IMAGE_LOADING_STRATEGY}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/images/placeholder.png';
            }}
          />
        </div>

        {/* Asset Information */}
        <div className="asset-card__info">
          <h3 className="asset-card__title">
            {asset.name}
          </h3>

          {/* Status Indicator */}
          <div className="asset-card__status">
            <span
              className={classNames(
                'asset-card__status-dot',
                statusColor
              )}
              aria-label={`Status: ${asset.status}`}
            />
            <span className="asset-card__status-text">
              {asset.status}
            </span>
          </div>

          {/* Location Information */}
          {showDetails && (
            <div className="asset-card__details">
              <p className="asset-card__location">
                <span className="asset-card__label">Location:</span>
                {asset.location?.name || 'Unknown'}
              </p>
              <p className="asset-card__last-seen">
                <span className="asset-card__label">Last Seen:</span>
                {lastSeenFormatted}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
});

// Display name for debugging
AssetCard.displayName = 'AssetCard';

// Default export
export default AssetCard;