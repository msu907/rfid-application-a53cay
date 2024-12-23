// react version: ^18.0.0
// lodash version: ^4.17.21
// @mui/material version: ^5.0.0

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { debounce } from 'lodash';
import { SearchIcon } from './Icons';
import { styled } from '@mui/material/styles';

// Interface for component props with comprehensive typing
interface SearchBarProps {
  placeholder: string;
  onSearch: (searchTerm: string) => void;
  onSearchStart?: () => void;
  onSearchEnd?: () => void;
  debounceTime?: number;
  className?: string;
  initialValue?: string;
  'aria-label'?: string;
  testId?: string;
  disabled?: boolean;
  loading?: boolean;
}

// Styled components following Material Design principles
const SearchContainer = styled('div')(({ theme }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  maxWidth: 400,
  margin: theme.spacing(2, 0),
}));

const SearchInput = styled('input')(({ theme }) => ({
  width: '100%',
  padding: `${theme.spacing(1)} ${theme.spacing(4.5)}`,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  fontSize: 14,
  transition: theme.transitions.create(['border-color', 'box-shadow']),
  outline: 'none',
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,

  '&:focus': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 2px ${theme.palette.primary.main}25`,
  },

  '&:disabled': {
    backgroundColor: theme.palette.action.disabledBackground,
    color: theme.palette.text.disabled,
    cursor: 'not-allowed',
  },

  '&::placeholder': {
    color: theme.palette.text.secondary,
  },
}));

const IconWrapper = styled('div')(({ theme }) => ({
  position: 'absolute',
  left: theme.spacing(1),
  top: '50%',
  transform: 'translateY(-50%)',
  color: theme.palette.text.secondary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const LoadingIndicator = styled('div')(({ theme }) => ({
  position: 'absolute',
  right: theme.spacing(1),
  top: '50%',
  transform: 'translateY(-50%)',
  width: 20,
  height: 20,
  borderRadius: '50%',
  border: `2px solid ${theme.palette.primary.main}`,
  borderTopColor: 'transparent',
  animation: 'spin 1s linear infinite',

  '@keyframes spin': {
    '0%': { transform: 'translateY(-50%) rotate(0deg)' },
    '100%': { transform: 'translateY(-50%) rotate(360deg)' },
  },
}));

/**
 * A reusable search bar component with real-time search functionality,
 * debouncing, and accessibility features.
 *
 * @param {SearchBarProps} props - Component props
 * @returns {JSX.Element} SearchBar component
 */
const SearchBar: React.FC<SearchBarProps> = ({
  placeholder,
  onSearch,
  onSearchStart,
  onSearchEnd,
  debounceTime = 300,
  className,
  initialValue = '',
  'aria-label': ariaLabel,
  testId = 'search-bar',
  disabled = false,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  // Memoized debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce((term: string) => {
        onSearch(term);
        onSearchEnd?.();
      }, debounceTime),
    [onSearch, onSearchEnd, debounceTime]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);

  // Handle input changes with validation
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const value = event.target.value;
    setSearchTerm(value);
    onSearchStart?.();
    debouncedSearch(value);
  };

  // Handle keyboard interactions for accessibility
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (event.key) {
      case 'Escape':
        setSearchTerm('');
        onSearch('');
        onSearchEnd?.();
        inputRef.current?.blur();
        break;
      case 'Enter':
        debouncedSearch.cancel();
        onSearch(searchTerm);
        onSearchEnd?.();
        break;
    }
  };

  // Clear search functionality
  const handleClear = () => {
    if (disabled) return;

    setSearchTerm('');
    onSearch('');
    onSearchEnd?.();
    inputRef.current?.focus();
  };

  return (
    <SearchContainer className={className}>
      <IconWrapper>
        <SearchIcon
          size="small"
          aria-hidden="true"
          titleAccess="Search"
        />
      </IconWrapper>

      <SearchInput
        ref={inputRef}
        type="search"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        aria-disabled={disabled}
        aria-busy={loading}
        role="searchbox"
        data-testid={testId}
        autoComplete="off"
      />

      {loading && (
        <LoadingIndicator
          role="progressbar"
          aria-label="Loading search results"
        />
      )}
    </SearchContainer>
  );
};

export default SearchBar;