// @ts-check
import React, { useCallback, useRef, useEffect } from 'react';
import classNames from 'classnames'; // v2.3.1 - Utility for conditional class name joining

// Interface for individual tab items with accessibility support
export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
  ariaControls?: string;
  ariaSelected?: boolean;
  tabIndex?: number;
}

// Props interface for the Tabs component with comprehensive configuration options
export interface TabsProps {
  items: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  defaultTabIndex?: number;
  animationDuration?: number;
}

// Keyboard navigation handler with accessibility support
const handleKeyDown = (
  event: React.KeyboardEvent,
  items: TabItem[],
  activeTab: string,
  onChange: (tabId: string) => void,
  orientation: 'horizontal' | 'vertical'
): void => {
  const isHorizontal = orientation === 'horizontal';
  const currentIndex = items.findIndex(item => item.id === activeTab);
  let nextIndex = currentIndex;

  switch (event.key) {
    case isHorizontal ? 'ArrowRight' : 'ArrowDown':
      event.preventDefault();
      nextIndex = currentIndex + 1;
      if (nextIndex >= items.length) nextIndex = 0;
      break;
    case isHorizontal ? 'ArrowLeft' : 'ArrowUp':
      event.preventDefault();
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) nextIndex = items.length - 1;
      break;
    case 'Home':
      event.preventDefault();
      nextIndex = 0;
      break;
    case 'End':
      event.preventDefault();
      nextIndex = items.length - 1;
      break;
    default:
      return;
  }

  // Skip disabled tabs
  while (items[nextIndex].disabled && nextIndex !== currentIndex) {
    nextIndex = nextIndex + 1 >= items.length ? 0 : nextIndex + 1;
  }

  if (!items[nextIndex].disabled) {
    onChange(items[nextIndex].id);
  }
};

/**
 * A fully accessible tab component implementing Material Design principles
 * Supports both horizontal and vertical orientations with keyboard navigation
 * Implements WCAG 2.1 Level AA compliance
 */
const Tabs: React.FC<TabsProps> = ({
  items,
  activeTab,
  onChange,
  className,
  orientation = 'horizontal',
  ariaLabel = 'Tab navigation',
  defaultTabIndex = 0,
  animationDuration = 200,
}) => {
  // Ref for the tab list container
  const tabListRef = useRef<HTMLDivElement>(null);
  // Ref for the active tab element
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Focus management effect
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.focus();
    }
  }, [activeTab]);

  // Memoized keyboard event handler
  const keyDownHandler = useCallback(
    (event: React.KeyboardEvent) => {
      handleKeyDown(event, items, activeTab, onChange, orientation);
    },
    [items, activeTab, onChange, orientation]
  );

  // Generate container classes based on orientation
  const containerClasses = classNames(
    'tabs-container',
    {
      'tabs-horizontal': orientation === 'horizontal',
      'tabs-vertical': orientation === 'vertical',
    },
    className
  );

  // Generate tab list classes
  const tabListClasses = classNames('tabs-list', {
    'tabs-list-horizontal': orientation === 'horizontal',
    'tabs-list-vertical': orientation === 'vertical',
  });

  return (
    <div className={containerClasses}>
      {/* Tab list container with ARIA role */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation={orientation}
        className={tabListClasses}
        onKeyDown={keyDownHandler}
      >
        {items.map((tab) => {
          const isActive = tab.id === activeTab;
          const tabClasses = classNames('tab', {
            'tab-active': isActive,
            'tab-disabled': tab.disabled,
          });

          return (
            <button
              key={tab.id}
              ref={isActive ? activeTabRef : null}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              aria-disabled={tab.disabled}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={tabClasses}
              onClick={() => !tab.disabled && onChange(tab.id)}
              disabled={tab.disabled}
              style={{
                transition: `all ${animationDuration}ms ease-in-out`,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels container */}
      <div className="tab-panels">
        {items.map((tab) => (
          <div
            key={tab.id}
            role="tabpanel"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            hidden={tab.id !== activeTab}
            className={classNames('tab-panel', {
              'tab-panel-active': tab.id === activeTab,
            })}
            style={{
              transition: `opacity ${animationDuration}ms ease-in-out`,
            }}
          >
            {tab.content}
          </div>
        ))}
      </div>

      <style jsx>{`
        .tabs-container {
          width: 100%;
          margin: 0;
          padding: 0;
        }

        .tabs-list {
          display: flex;
          border-bottom: 2px solid #e0e0e0;
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .tabs-list-horizontal {
          flex-direction: row;
        }

        .tabs-list-vertical {
          flex-direction: column;
          border-right: 2px solid #e0e0e0;
          border-bottom: none;
        }

        .tab {
          padding: 16px 24px;
          border: none;
          background: none;
          cursor: pointer;
          font-family: 'Roboto', sans-serif;
          font-size: 14px;
          color: #757575;
          position: relative;
          transition: all 200ms ease-in-out;
        }

        .tab-active {
          color: #1976d2;
          font-weight: 500;
        }

        .tab-active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 100%;
          height: 2px;
          background-color: #1976d2;
        }

        .tab-disabled {
          color: #bdbdbd;
          cursor: not-allowed;
        }

        .tab-panel {
          padding: 24px;
          opacity: 0;
        }

        .tab-panel-active {
          opacity: 1;
        }

        /* Ensure focus visibility for accessibility */
        .tab:focus {
          outline: 2px solid #1976d2;
          outline-offset: -2px;
        }

        /* Remove focus outline for mouse users */
        .tab:focus:not(:focus-visible) {
          outline: none;
        }
      `}</style>
    </div>
  );
};

export default Tabs;