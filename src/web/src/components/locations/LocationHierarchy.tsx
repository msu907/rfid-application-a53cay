import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TreeView, TreeItem } from '@mui/lab'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0
import { LocationHierarchyNode } from '../../types/location.types';
import { useLocation } from '../../hooks/useLocation';
import { useWebSocket } from '../../hooks/useWebSocket';
import ErrorBoundary from '../common/ErrorBoundary';

// Styled components for enhanced visual hierarchy
const StyledTreeView = styled(TreeView)(({ theme }) => ({
  padding: theme.spacing(1),
  maxHeight: '600px',
  overflowY: 'auto',
  scrollBehavior: 'smooth',
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  '& .MuiTreeItem-root': {
    marginBottom: theme.spacing(0.5),
  },
}));

const StyledTreeItem = styled(TreeItem)(({ theme }) => ({
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&.Mui-selected': {
    backgroundColor: theme.palette.primary.light,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

interface LocationHierarchyProps {
  selectedLocationId?: string | null;
  onLocationSelect?: (locationId: string) => void;
  expandedIds?: string[];
  virtualizeThreshold?: number;
  enableRealTimeUpdates?: boolean;
}

/**
 * LocationHierarchy component that renders a hierarchical tree view of locations
 * with real-time updates, virtualization, and accessibility support.
 */
const LocationHierarchy: React.FC<LocationHierarchyProps> = ({
  selectedLocationId,
  onLocationSelect,
  expandedIds: initialExpandedIds = [],
  virtualizeThreshold = 100,
  enableRealTimeUpdates = true,
}) => {
  // State management
  const [expandedNodes, setExpandedNodes] = useState<string[]>(initialExpandedIds);
  const [selected, setSelected] = useState<string | null>(selectedLocationId || null);
  
  // Custom hooks
  const { locations, locationTree, isLoading, error, refreshLocations } = useLocation();
  const { subscribe, unsubscribe } = useWebSocket();

  // Memoized hierarchy building
  const buildHierarchy = useCallback((locationList: LocationHierarchyNode[]): LocationHierarchyNode[] => {
    const locationMap = new Map<string, LocationHierarchyNode>();
    const rootNodes: LocationHierarchyNode[] = [];

    // Create lookup map for O(1) access
    locationList.forEach(location => {
      locationMap.set(location.id, {
        ...location,
        children: []
      });
    });

    // Build tree structure
    locationList.forEach(location => {
      const node = locationMap.get(location.id);
      if (node) {
        if (location.parentId && locationMap.has(location.parentId)) {
          const parent = locationMap.get(location.parentId);
          parent?.children.push(node);
        } else {
          rootNodes.push(node);
        }
      }
    });

    // Sort nodes by name
    return rootNodes.sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  // Virtualization setup for large hierarchies
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: locations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  // WebSocket update handler
  const handleWebSocketUpdate = useCallback((message: any) => {
    if (message.type === 'LOCATION_UPDATE') {
      refreshLocations();
    }
  }, [refreshLocations]);

  // Setup WebSocket subscription
  useEffect(() => {
    if (enableRealTimeUpdates) {
      const unsubscribeCallback = subscribe('location_updates', handleWebSocketUpdate);
      return () => {
        unsubscribeCallback();
      };
    }
  }, [enableRealTimeUpdates, subscribe, handleWebSocketUpdate]);

  // Handle node expansion
  const handleNodeToggle = useCallback((event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpandedNodes(nodeIds);
  }, []);

  // Handle node selection
  const handleNodeSelect = useCallback((event: React.SyntheticEvent, nodeId: string) => {
    setSelected(nodeId);
    onLocationSelect?.(nodeId);
  }, [onLocationSelect]);

  // Render tree items recursively
  const renderTreeItems = useCallback((nodes: LocationHierarchyNode[]): React.ReactNode => {
    return nodes.map(node => (
      <StyledTreeItem
        key={node.id}
        nodeId={node.id}
        label={node.name}
        aria-label={`Location ${node.name}`}
        data-location-id={node.id}
      >
        {node.children && node.children.length > 0 && renderTreeItems(node.children)}
      </StyledTreeItem>
    ));
  }, []);

  // Memoize hierarchy for performance
  const hierarchy = useMemo(() => buildHierarchy(locationTree), [buildHierarchy, locationTree]);

  if (error) {
    return (
      <div role="alert" className="error-message">
        Error loading locations: {error}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        ref={parentRef}
        role="tree"
        aria-label="Location hierarchy"
        className="location-hierarchy"
      >
        <StyledTreeView
          aria-label="Location navigation"
          defaultCollapseIcon={<span aria-hidden="true">▼</span>}
          defaultExpandIcon={<span aria-hidden="true">▶</span>}
          expanded={expandedNodes}
          selected={selected || ''}
          onNodeToggle={handleNodeToggle}
          onNodeSelect={handleNodeSelect}
        >
          {locations.length > virtualizeThreshold ? (
            rowVirtualizer.getVirtualItems().map(virtualRow => (
              <React.Fragment key={virtualRow.key}>
                {renderTreeItems([hierarchy[virtualRow.index]])}
              </React.Fragment>
            ))
          ) : (
            renderTreeItems(hierarchy)
          )}
        </StyledTreeView>
      </div>
    </ErrorBoundary>
  );
};

export default React.memo(LocationHierarchy);