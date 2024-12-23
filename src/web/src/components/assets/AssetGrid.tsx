import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { debounce } from 'lodash'; // v4.17.21
import classNames from 'classnames'; // v2.3.1
import { AutoSizer, Grid } from 'react-virtualized'; // v9.22.3

import { Asset } from '../../types/asset.types';
import AssetCard from './AssetCard';
import { useAsset } from '../../hooks/useAsset';
import { useWebSocket } from '../../hooks/useWebSocket';

// Constants for grid layout and optimization
const DEFAULT_GRID_GAP = 16;
const DEFAULT_MIN_CARD_WIDTH = 280;
const RESIZE_DEBOUNCE_DELAY = 150;
const SCROLL_DEBOUNCE_DELAY = 100;
const ERROR_RETRY_DELAY = 3000;

/**
 * Props interface for AssetGrid component
 */
interface AssetGridProps {
  /** Optional CSS class name */
  className?: string;
  /** Click handler for asset cards */
  onAssetClick?: (asset: Asset) => void;
  /** Grid gap in pixels */
  gridGap?: number;
  /** Minimum card width in pixels */
  minCardWidth?: number;
  /** Enable/disable virtualization */
  virtualizationEnabled?: boolean;
  /** Enable/disable error boundary */
  errorBoundary?: boolean;
  /** Number of retry attempts on error */
  retryAttempts?: number;
  /** Loading behavior type */
  loadingBehavior?: 'skeleton' | 'spinner' | 'none';
}

/**
 * Memoized function to calculate optimal grid columns
 */
const calculateGridColumns = React.memo((
  containerWidth: number,
  minCardWidth: number,
  gridGap: number
): number => {
  const availableWidth = containerWidth - gridGap;
  const maxColumns = Math.floor((availableWidth + gridGap) / (minCardWidth + gridGap));
  return Math.max(1, maxColumns);
});

/**
 * AssetGrid component for displaying asset cards in a responsive grid layout
 * with virtualization and real-time updates
 */
export const AssetGrid: React.FC<AssetGridProps> = ({
  className,
  onAssetClick,
  gridGap = DEFAULT_GRID_GAP,
  minCardWidth = DEFAULT_MIN_CARD_WIDTH,
  virtualizationEnabled = true,
  errorBoundary = true,
  retryAttempts = 3,
  loadingBehavior = 'skeleton'
}) => {
  // Refs and state
  const gridRef = useRef<Grid | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  // Hooks
  const { assets, loadingStates, errorStates } = useAsset();
  const { 
    isConnected: wsConnected,
    subscribe,
    unsubscribe,
    data: wsData 
  } = useWebSocket('assets');

  /**
   * Handles real-time asset updates
   */
  const handleWebSocketUpdate = useCallback((update: Asset) => {
    if (!assets[update.id]) return;
    
    // Force grid recomputation if needed
    if (gridRef.current) {
      gridRef.current.recomputeGridSize();
    }
  }, [assets]);

  /**
   * Memoized grid item renderer
   */
  const cellRenderer = useCallback(({
    columnIndex,
    rowIndex,
    style
  }: {
    columnIndex: number;
    rowIndex: number;
    style: React.CSSProperties;
  }) => {
    const index = rowIndex * columns + columnIndex;
    const asset = Object.values(assets)[index];

    if (!asset) return null;

    return (
      <div
        style={{
          ...style,
          padding: gridGap / 2,
        }}
        key={asset.id}
      >
        <AssetCard
          asset={asset}
          onClick={onAssetClick}
          interactive={!!onAssetClick}
          animateChanges={true}
          testId={`asset-card-${asset.id}`}
        />
      </div>
    );
  }, [assets, columns, gridGap, onAssetClick]);

  /**
   * Handles window resize with debouncing
   */
  const handleResize = useMemo(() => debounce(() => {
    if (!containerRef.current) return;
    
    const newColumns = calculateGridColumns(
      containerRef.current.offsetWidth,
      minCardWidth,
      gridGap
    );
    
    setColumns(newColumns);
    
    if (gridRef.current) {
      gridRef.current.recomputeGridSize();
    }
  }, RESIZE_DEBOUNCE_DELAY), [minCardWidth, gridGap]);

  /**
   * Error retry handler
   */
  const handleRetry = useCallback(async () => {
    if (retryCount >= retryAttempts) {
      setError(new Error('Maximum retry attempts reached'));
      return;
    }

    try {
      setRetryCount(prev => prev + 1);
      await subscribe();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to reconnect'));
      setTimeout(handleRetry, ERROR_RETRY_DELAY);
    }
  }, [retryCount, retryAttempts, subscribe]);

  // Initialize WebSocket connection
  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  // Handle WebSocket updates
  useEffect(() => {
    if (wsData) {
      handleWebSocketUpdate(wsData as Asset);
    }
  }, [wsData, handleWebSocketUpdate]);

  // Set up resize observer
  useEffect(() => {
    const resizeObserver = new ResizeObserver(handleResize);
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [handleResize]);

  // Error boundary implementation
  if (errorBoundary && error) {
    return (
      <div className="asset-grid__error" data-testid="asset-grid-error">
        <p>Error: {error.message}</p>
        <button onClick={handleRetry}>Retry</button>
      </div>
    );
  }

  // Loading state implementation
  if (loadingBehavior !== 'none' && Object.values(loadingStates).some(state => state)) {
    return (
      <div className="asset-grid__loading" data-testid="asset-grid-loading">
        {loadingBehavior === 'skeleton' ? (
          // Implement skeleton loading UI
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="asset-grid__skeleton" />
          ))
        ) : (
          // Implement spinner loading UI
          <div className="asset-grid__spinner" />
        )}
      </div>
    );
  }

  const assetCount = Object.keys(assets).length;
  const rowCount = Math.ceil(assetCount / columns);

  return (
    <div
      ref={containerRef}
      className={classNames('asset-grid', className)}
      data-testid="asset-grid"
    >
      {virtualizationEnabled ? (
        <AutoSizer>
          {({ width, height }) => (
            <Grid
              ref={gridRef}
              width={width}
              height={height}
              columnCount={columns}
              rowCount={rowCount}
              columnWidth={width / columns}
              rowHeight={width / columns}
              cellRenderer={cellRenderer}
              overscanRowCount={2}
              overscanColumnCount={1}
              scrollToAlignment="start"
              className="asset-grid__virtualized"
            />
          )}
        </AutoSizer>
      ) : (
        <div
          className="asset-grid__static"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: gridGap,
          }}
        >
          {Object.values(assets).map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onClick={onAssetClick}
              interactive={!!onAssetClick}
              animateChanges={true}
              testId={`asset-card-${asset.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Display name for debugging
AssetGrid.displayName = 'AssetGrid';

// Default export
export default AssetGrid;