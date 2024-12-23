import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.11.2
import { format } from 'date-fns'; // ^2.29.3
import Table, { TableColumn, SortOrder } from '../common/Table';
import useWebSocket from '../../hooks/useWebSocket';
import { useAuth } from '../../hooks/useAuth';
import { PaginatedResponse, ApiResponse } from '../../types/api.types';
import { Permission } from '../../types/auth.types';

// Constants for component configuration
const DEFAULT_PAGE_SIZE = 10;
const WEBSOCKET_WIDGET_ID = 'asset-list';
const DATE_FORMAT = 'MMM dd, yyyy HH:mm:ss';

// Asset interface matching backend schema
interface Asset {
  id: string;
  rfid_tag: string;
  name: string;
  description: string;
  image_url: string | null;
  location: string;
  status: 'active' | 'inactive';
  lastSeen: string;
  created_at: string;
  updated_at: string;
}

// Props interface with accessibility and customization options
interface AssetListProps {
  className?: string;
  onAssetSelect?: (asset: Asset) => void;
  initialSort?: { column: string; order: SortOrder };
  pageSize?: number;
  'aria-label'?: string;
}

/**
 * AssetList Component
 * Displays a paginated, sortable list of assets with real-time updates
 * Implements WCAG 2.1 Level AA accessibility standards
 */
const AssetList: React.FC<AssetListProps> = ({
  className = '',
  onAssetSelect,
  initialSort = { column: 'name', order: SortOrder.ASC },
  pageSize = DEFAULT_PAGE_SIZE,
  'aria-label': ariaLabel = 'Asset List'
}) => {
  const navigate = useNavigate();
  const { checkPermission } = useAuth();
  const canEditAssets = checkPermission(Permission.WRITE_ASSETS);

  // State management
  const [assets, setAssets] = useState<PaginatedResponse<Asset>>({
    items: [],
    total: 0,
    page: 1,
    pageSize,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sortState, setSortState] = useState(initialSort);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // WebSocket integration for real-time updates
  const {
    data: wsData,
    error: wsError,
    subscribe,
    unsubscribe
  } = useWebSocket(WEBSOCKET_WIDGET_ID, {
    autoConnect: true,
    heartbeatInterval: 30000,
    reconnectAttempts: 5
  });

  // Table columns configuration with accessibility support
  const columns = useMemo<TableColumn<Asset>[]>(() => [
    {
      key: 'rfid_tag',
      title: 'RFID Tag',
      sortable: true,
      width: '150px'
    },
    {
      key: 'name',
      title: 'Name',
      sortable: true,
      width: '200px'
    },
    {
      key: 'location',
      title: 'Location',
      sortable: true,
      width: '150px'
    },
    {
      key: 'status',
      title: 'Status',
      sortable: true,
      width: '100px',
      render: (value) => (
        <span
          className={`status-badge status-badge--${value}`}
          aria-label={`Status: ${value}`}
        >
          {value}
        </span>
      )
    },
    {
      key: 'lastSeen',
      title: 'Last Seen',
      sortable: true,
      width: '200px',
      render: (value) => format(new Date(value), DATE_FORMAT)
    }
  ], []);

  /**
   * Fetches asset data with pagination and sorting
   */
  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      // API call would go here
      // For now, using mock data structure
      const response: ApiResponse<PaginatedResponse<Asset>> = {
        data: assets,
        status: 200,
        message: 'Success',
        timestamp: new Date().toISOString()
      };

      if (response.status === 200) {
        setAssets(response.data);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch assets');
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortState, pageSize]);

  /**
   * Handles real-time asset updates
   */
  useEffect(() => {
    if (wsData) {
      const updatedAsset = wsData as Asset;
      setAssets(prev => ({
        ...prev,
        items: prev.items.map(asset =>
          asset.id === updatedAsset.id ? updatedAsset : asset
        )
      }));
    }
  }, [wsData]);

  /**
   * Handles WebSocket error states
   */
  useEffect(() => {
    if (wsError) {
      setError(`Real-time update error: ${wsError.message}`);
    }
  }, [wsError]);

  /**
   * Initializes WebSocket subscription
   */
  useEffect(() => {
    subscribe();
    return () => {
      unsubscribe();
    };
  }, [subscribe, unsubscribe]);

  /**
   * Handles page changes with accessibility announcements
   */
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // Announce page change to screen readers
    const announcement = `Showing page ${page} of assets`;
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('role', 'status');
    ariaLive.setAttribute('aria-live', 'polite');
    ariaLive.className = 'visually-hidden';
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    setTimeout(() => document.body.removeChild(ariaLive), 1000);
  }, []);

  /**
   * Handles sort changes with optimistic updates
   */
  const handleSort = useCallback((column: string, order: SortOrder) => {
    setSortState({ column, order });
  }, []);

  /**
   * Handles asset selection with keyboard support
   */
  const handleAssetClick = useCallback((asset: Asset) => {
    if (onAssetSelect) {
      onAssetSelect(asset);
    } else {
      navigate(`/assets/${asset.id}`);
    }
  }, [onAssetSelect, navigate]);

  return (
    <div
      className={`asset-list ${className}`}
      role="region"
      aria-label={ariaLabel}
    >
      {error && (
        <div
          className="asset-list__error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}
      
      <Table
        data={assets.items}
        columns={columns}
        pagination={assets}
        onPageChange={handlePageChange}
        onPageSizeChange={pageSize => setCurrentPage(1)}
        onSort={handleSort}
        loading={loading}
        onRowClick={handleAssetClick}
        keyboardNavigation
        aria-label="Asset table"
        selectable={canEditAssets}
      />
    </div>
  );
};

export default React.memo(AssetList);