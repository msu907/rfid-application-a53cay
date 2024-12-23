import React, { useCallback, useMemo, useRef, useState } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.1
import Pagination from './Pagination';
import { PaginatedResponse, SortOrder } from '../../types/api.types';

// Constants for table configuration
const DEFAULT_PAGE_SIZE = 10;
const SORT_ICONS = {
  ASC: '↑',
  DESC: '↓',
  NONE: '↕'
};
const KEYBOARD_NAVIGATION_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Space'];
const VIRTUAL_SCROLL_BUFFER = 5;

/**
 * Interface for table column configuration
 */
export interface TableColumn<T> {
  key: string;
  title: string | React.ReactNode;
  sortable?: boolean;
  render?: (value: any, record: T) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  headerRender?: (title: string) => React.ReactNode;
  sortPriority?: number;
  filterEnabled?: boolean;
  onFilter?: (value: any) => void;
}

/**
 * Props interface for Table component
 */
export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  pagination: PaginatedResponse<T>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSort: (column: string, order: SortOrder) => void;
  loading?: boolean;
  className?: string;
  'aria-label'?: string;
  selectable?: boolean;
  onSelectionChange?: (selectedRows: T[]) => void;
  keyboardNavigation?: boolean;
  virtualScroll?: boolean;
  rowHeight?: number;
  onRowClick?: (row: T) => void;
}

/**
 * Enhanced table component with accessibility and performance optimizations
 */
const Table = <T extends Record<string, any>>({
  data,
  columns,
  pagination,
  onPageChange,
  onPageSizeChange,
  onSort,
  loading = false,
  className = '',
  'aria-label': ariaLabel = 'Data table',
  selectable = false,
  onSelectionChange,
  keyboardNavigation = true,
  virtualScroll = false,
  rowHeight = 48,
  onRowClick
}: TableProps<T>): React.ReactElement => {
  const tableRef = useRef<HTMLTableElement>(null);
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortState, setSortState] = useState<{ column: string; order: SortOrder } | null>(null);

  // Calculate virtual scroll window
  const visibleRows = useMemo(() => {
    if (!virtualScroll) return data;

    const startIndex = Math.max(0, (pagination.page - 1) * pagination.pageSize - VIRTUAL_SCROLL_BUFFER);
    const endIndex = Math.min(data.length, pagination.page * pagination.pageSize + VIRTUAL_SCROLL_BUFFER);
    return data.slice(startIndex, endIndex);
  }, [data, pagination, virtualScroll]);

  /**
   * Handles sorting when a column header is clicked
   */
  const handleSort = useCallback((column: TableColumn<T>) => {
    if (!column.sortable) return;

    const newOrder = sortState?.column === column.key
      ? sortState.order === SortOrder.ASC ? SortOrder.DESC : SortOrder.ASC
      : SortOrder.ASC;

    setSortState({ column: column.key, order: newOrder });
    onSort(column.key, newOrder);

    // Announce sort change to screen readers
    const message = `Table sorted by ${column.title} in ${newOrder === SortOrder.ASC ? 'ascending' : 'descending'} order`;
    announceToScreenReader(message);
  }, [sortState, onSort]);

  /**
   * Handles keyboard navigation within the table
   */
  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    if (!keyboardNavigation || !focusedCell) return;

    const { key } = event;
    const { row, col } = focusedCell;
    let newRow = row;
    let newCol = col;

    switch (key) {
      case 'ArrowUp':
        newRow = Math.max(0, row - 1);
        break;
      case 'ArrowDown':
        newRow = Math.min(visibleRows.length - 1, row + 1);
        break;
      case 'ArrowLeft':
        newCol = Math.max(0, col - 1);
        break;
      case 'ArrowRight':
        newCol = Math.min(columns.length - 1, col + 1);
        break;
      case 'Enter':
      case ' ':
        if (selectable) {
          toggleRowSelection(visibleRows[row]);
        }
        if (onRowClick) {
          onRowClick(visibleRows[row]);
        }
        break;
      default:
        return;
    }

    if (newRow !== row || newCol !== col) {
      event.preventDefault();
      setFocusedCell({ row: newRow, col: newCol });
      focusCell(newRow, newCol);
    }
  }, [focusedCell, visibleRows, columns, selectable, onRowClick]);

  /**
   * Toggles row selection and updates selection state
   */
  const toggleRowSelection = useCallback((row: T) => {
    const rowKey = getRowKey(row);
    const newSelection = new Set(selectedRows);

    if (newSelection.has(rowKey)) {
      newSelection.delete(rowKey);
    } else {
      newSelection.add(rowKey);
    }

    setSelectedRows(newSelection);
    onSelectionChange?.(Array.from(newSelection).map(key => 
      data.find(row => getRowKey(row) === key)!
    ));
  }, [selectedRows, data, onSelectionChange]);

  /**
   * Helper function to get a unique key for a row
   */
  const getRowKey = (row: T): string => {
    return row.id?.toString() || JSON.stringify(row);
  };

  /**
   * Announces messages to screen readers
   */
  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'visually-hidden';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  /**
   * Focuses a specific cell in the table
   */
  const focusCell = (row: number, col: number) => {
    const cell = tableRef.current?.querySelector(
      `[data-row="${row}"][data-col="${col}"]`
    ) as HTMLElement;
    cell?.focus();
  };

  return (
    <div className={classNames('table-container', className)}>
      <table
        ref={tableRef}
        className="table"
        role="grid"
        aria-label={ariaLabel}
        aria-rowcount={pagination.total}
        aria-colcount={columns.length}
        onKeyDown={handleKeyboardNavigation}
      >
        <thead>
          <tr role="row">
            {selectable && (
              <th role="columnheader" aria-label="Selection column">
                <input
                  type="checkbox"
                  onChange={e => {
                    const newSelection = e.target.checked
                      ? new Set(data.map(getRowKey))
                      : new Set();
                    setSelectedRows(newSelection);
                    onSelectionChange?.(e.target.checked ? [...data] : []);
                  }}
                  checked={selectedRows.size === data.length}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {columns.map((column, index) => (
              <th
                key={column.key}
                role="columnheader"
                aria-sort={
                  sortState?.column === column.key
                    ? sortState.order === SortOrder.ASC
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                style={{ width: column.width }}
                className={classNames('table__header', {
                  'table__header--sortable': column.sortable,
                  [`table__header--align-${column.align || 'left'}`]: true
                })}
                onClick={() => column.sortable && handleSort(column)}
              >
                {column.headerRender?.(column.title as string) ?? column.title}
                {column.sortable && (
                  <span className="table__sort-icon" aria-hidden="true">
                    {sortState?.column === column.key
                      ? sortState.order === SortOrder.ASC
                        ? SORT_ICONS.ASC
                        : SORT_ICONS.DESC
                      : SORT_ICONS.NONE}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={selectable ? columns.length + 1 : columns.length}
                className="table__loading"
                role="status"
                aria-label="Loading data"
              >
                Loading...
              </td>
            </tr>
          ) : visibleRows.length === 0 ? (
            <tr>
              <td
                colSpan={selectable ? columns.length + 1 : columns.length}
                className="table__empty"
                role="status"
              >
                No data available
              </td>
            </tr>
          ) : (
            visibleRows.map((row, rowIndex) => (
              <tr
                key={getRowKey(row)}
                role="row"
                aria-rowindex={rowIndex + 1}
                className={classNames('table__row', {
                  'table__row--selected': selectedRows.has(getRowKey(row)),
                  'table__row--clickable': !!onRowClick
                })}
                onClick={() => onRowClick?.(row)}
              >
                {selectable && (
                  <td role="gridcell">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(getRowKey(row))}
                      onChange={() => toggleRowSelection(row)}
                      aria-label={`Select row ${rowIndex + 1}`}
                    />
                  </td>
                )}
                {columns.map((column, colIndex) => (
                  <td
                    key={`${getRowKey(row)}-${column.key}`}
                    role="gridcell"
                    data-row={rowIndex}
                    data-col={colIndex}
                    tabIndex={
                      focusedCell?.row === rowIndex && focusedCell?.col === colIndex
                        ? 0
                        : -1
                    }
                    className={classNames('table__cell', {
                      [`table__cell--align-${column.align || 'left'}`]: true
                    })}
                  >
                    {column.render
                      ? column.render(row[column.key], row)
                      : row[column.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        pageSize={pagination.pageSize}
        totalItems={pagination.total}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        className="table__pagination"
        ariaLabel="Table navigation"
      />
    </div>
  );
};

export default React.memo(Table) as typeof Table;