// react-window version: ^1.8.8
// classnames version: ^2.3.1
// react version: ^18.0.0

import React, { useState, useRef, useCallback, useEffect } from 'react';
import classNames from 'classnames';
import { VariableSizeList as List } from 'react-window';
import { SettingsIcon } from '../common/Icons';

// Interfaces
interface DropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  dir?: 'ltr' | 'rtl';
  virtualizeOptions?: boolean;
}

// Constants
const ITEM_HEIGHT = 44; // Touch-friendly target size
const MENU_MAX_HEIGHT = 300;
const DEBOUNCE_DELAY = 150;
const ANIMATION_DURATION = 200;

// Utility function for debouncing
const debounce = (fn: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  error,
  className,
  dir = 'ltr',
  virtualizeOptions = false,
}) => {
  // State management
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<List>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Memoized filtered options
  const filteredOptions = React.useMemo(() => {
    return options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  // Event Handlers
  const handleClick = useCallback(debounce((event: React.MouseEvent) => {
    event.preventDefault();
    if (!disabled) {
      setIsOpen(prev => !prev);
      setHighlightedIndex(-1);
      setSearchTerm('');
    }
  }, DEBOUNCE_DELAY), [disabled]);

  const handleOptionSelect = useCallback((selectedValue: string | number) => {
    const option = options.find(opt => opt.value === selectedValue);
    if (option && !option.disabled) {
      onChange(selectedValue);
      setIsOpen(false);
      setSearchTerm('');
      triggerRef.current?.focus();
      
      // Announce selection to screen readers
      const announcement = `Selected ${option.label}`;
      announceToScreenReader(announcement);
    }
  }, [onChange, options]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (highlightedIndex >= 0) {
          handleOptionSelect(filteredOptions[highlightedIndex].value);
        }
        break;

      case 'Escape':
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        break;

      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setHighlightedIndex(prev => {
          const newIndex = prev + direction;
          const lastIndex = filteredOptions.length - 1;
          if (newIndex < 0) return lastIndex;
          if (newIndex > lastIndex) return 0;
          return newIndex;
        });
        break;

      case 'Home':
        event.preventDefault();
        setHighlightedIndex(0);
        break;

      case 'End':
        event.preventDefault();
        setHighlightedIndex(filteredOptions.length - 1);
        break;

      default:
        // Type-ahead search
        if (event.key.length === 1) {
          clearTimeout(searchTimeoutRef.current);
          setSearchTerm(prev => prev + event.key);
          searchTimeoutRef.current = setTimeout(() => setSearchTerm(''), 1000);
        }
    }
  }, [disabled, isOpen, highlightedIndex, filteredOptions, handleOptionSelect]);

  // Virtualization row renderer
  const ItemRenderer = useCallback(({ index, style }: { index: number, style: React.CSSProperties }) => {
    const option = filteredOptions[index];
    const isSelected = option.value === value;
    const isHighlighted = index === highlightedIndex;
    
    return (
      <div
        style={style}
        className={classNames('dropdown__option', {
          'dropdown__option--selected': isSelected,
          'dropdown__option--highlighted': isHighlighted,
          'dropdown__option--disabled': option.disabled
        })}
        onClick={() => handleOptionSelect(option.value)}
        role="option"
        aria-selected={isSelected}
        aria-disabled={option.disabled}
      >
        {option.label}
      </div>
    );
  }, [filteredOptions, value, highlightedIndex, handleOptionSelect]);

  // Screen reader announcements
  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement('div');
    announcement.className = 'sr-only';
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      listRef.current.scrollToItem(highlightedIndex, 'smart');
    }
  }, [highlightedIndex, isOpen]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div
      ref={dropdownRef}
      className={classNames('dropdown', className, {
        'dropdown--open': isOpen,
        'dropdown--error': !!error,
        'dropdown--rtl': dir === 'rtl'
      })}
      dir={dir}
    >
      <button
        ref={triggerRef}
        className="dropdown__trigger"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={!!error}
        aria-disabled={disabled}
        disabled={disabled}
      >
        <span className="dropdown__trigger-text">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <SettingsIcon
          className={classNames('dropdown__trigger-icon', {
            'dropdown__trigger-icon--open': isOpen
          })}
          size="small"
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div 
          className="dropdown__menu"
          role="listbox"
          aria-label={placeholder}
        >
          {virtualizeOptions ? (
            <List
              ref={listRef}
              height={Math.min(filteredOptions.length * ITEM_HEIGHT, MENU_MAX_HEIGHT)}
              itemCount={filteredOptions.length}
              itemSize={() => ITEM_HEIGHT}
              width="100%"
              className="dropdown__virtual-list"
            >
              {ItemRenderer}
            </List>
          ) : (
            filteredOptions.map((option, index) => (
              <ItemRenderer
                key={option.value}
                index={index}
                style={{ height: ITEM_HEIGHT }}
              />
            ))
          )}
        </div>
      )}

      {error && (
        <div className="dropdown__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default Dropdown;