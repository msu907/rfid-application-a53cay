import React, { useCallback, useMemo, useRef } from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.1
import Button from './Button';
import { PaginationParams } from '../../types/api.types';

// Constants for pagination configuration
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const MAX_VISIBLE_PAGES = 7;
const KEYBOARD_NAVIGATION_KEYS = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
const ARIA_LABELS = {
  previous: 'Go to previous page',
  next: 'Go to next page',
  pageNumber: 'Go to page',
  pageSize: 'Select number of items per page'
};

/**
 * Enhanced props interface for Pagination component with accessibility support
 */
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  ariaLive?: 'polite' | 'assertive';
  onKeyDown?: (event: KeyboardEvent) => void;
  rtl?: boolean;
}

/**
 * Generates optimized array of page numbers with ellipsis for large datasets
 */
const getPageNumbers = (currentPage: number, totalPages: number, maxVisible: number): (number | string)[] => {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const sidePages = Math.floor((maxVisible - 3) / 2);
  const leftPages = Math.max(2, currentPage - sidePages);
  const rightPages = Math.min(totalPages - 1, currentPage + sidePages);

  const pages: (number | string)[] = [1];

  if (leftPages > 2) {
    pages.push('...');
  }

  for (let i = leftPages; i <= rightPages; i++) {
    pages.push(i);
  }

  if (rightPages < totalPages - 1) {
    pages.push('...');
  }

  pages.push(totalPages);
  return pages;
};

/**
 * Accessible pagination component with Material Design styling
 */
const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
  disabled = false,
  ariaLabel = 'Pagination navigation',
  ariaLive = 'polite',
  rtl = false,
}) => {
  const paginationRef = useRef<HTMLDivElement>(null);
  const pageNumbers = useMemo(() => 
    getPageNumbers(currentPage, totalPages, MAX_VISIBLE_PAGES),
    [currentPage, totalPages]
  );

  /**
   * Handles keyboard navigation through pages
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowLeft':
        if (currentPage > 1) {
          onPageChange(currentPage - 1);
          event.preventDefault();
        }
        break;
      case 'ArrowRight':
        if (currentPage < totalPages) {
          onPageChange(currentPage + 1);
          event.preventDefault();
        }
        break;
      case 'Home':
        if (currentPage !== 1) {
          onPageChange(1);
          event.preventDefault();
        }
        break;
      case 'End':
        if (currentPage !== totalPages) {
          onPageChange(totalPages);
          event.preventDefault();
        }
        break;
      default:
        if (/^[0-9]$/.test(event.key)) {
          const page = parseInt(event.key, 10);
          if (page > 0 && page <= totalPages) {
            onPageChange(page);
            event.preventDefault();
          }
        }
    }
  }, [currentPage, totalPages, onPageChange, disabled]);

  const containerClasses = classNames(
    'pagination',
    {
      'pagination--rtl': rtl,
      'pagination--disabled': disabled
    },
    className
  );

  return (
    <nav
      className={containerClasses}
      aria-label={ariaLabel}
      ref={paginationRef}
      onKeyDown={handleKeyDown}
    >
      <div className="pagination__controls" role="group">
        <Button
          variant="outlined"
          size="small"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || disabled}
          ariaLabel={ARIA_LABELS.previous}
          className="pagination__button"
        >
          {rtl ? '→' : '←'}
        </Button>

        <div className="pagination__pages" aria-live={ariaLive}>
          {pageNumbers.map((page, index) => (
            typeof page === 'number' ? (
              <Button
                key={`page-${page}`}
                variant={page === currentPage ? 'primary' : 'outlined'}
                size="small"
                onClick={() => onPageChange(page)}
                disabled={disabled}
                ariaLabel={`${ARIA_LABELS.pageNumber} ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
                className="pagination__page-button"
              >
                {page}
              </Button>
            ) : (
              <span
                key={`ellipsis-${index}`}
                className="pagination__ellipsis"
                aria-hidden="true"
              >
                •••
              </span>
            )
          ))}
        </div>

        <Button
          variant="outlined"
          size="small"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || disabled}
          ariaLabel={ARIA_LABELS.next}
          className="pagination__button"
        >
          {rtl ? '←' : '→'}
        </Button>
      </div>

      <div className="pagination__size-selector">
        <label
          htmlFor="pageSize"
          className="pagination__size-label"
        >
          Items per page:
        </label>
        <select
          id="pageSize"
          className="pagination__size-select"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          disabled={disabled}
          aria-label={ARIA_LABELS.pageSize}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="pagination__info">
          {`${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalItems)} of ${totalItems}`}
        </span>
      </div>
    </nav>
  );
};

export default React.memo(Pagination);