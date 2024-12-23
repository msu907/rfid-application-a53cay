import React, { forwardRef, memo, useCallback } from 'react';
import classNames from 'classnames'; // v2.3.1
import styles from '../../styles/components/_card.scss';

// Type definitions for elevation levels
type CardElevation = 'low' | 'medium' | 'high';

// Interface for Card component props with comprehensive type safety
export interface CardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  elevation?: CardElevation;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onKeyPress?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  testId?: string;
  ariaLabel?: string;
  role?: string;
  isLoading?: boolean;
  error?: Error | null;
  ref?: React.Ref<HTMLDivElement>;
}

// Utility function to get elevation class
const getElevationClass = (elevation: CardElevation = 'low'): string => {
  const elevationMap: Record<CardElevation, string> = {
    low: styles['card--elevation-low'],
    medium: styles['card--elevation-medium'],
    high: styles['card--elevation-high']
  };
  return elevationMap[elevation];
};

// Keyboard event handler for accessibility
const handleKeyPress = (
  event: React.KeyboardEvent<HTMLDivElement>,
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
): void => {
  if (onClick && (event.key === 'Enter' || event.key === 'Space')) {
    event.preventDefault();
    onClick(event as unknown as React.MouseEvent<HTMLDivElement>);
  }
};

// Memoized Card component with ref forwarding for optimal performance
export const Card = memo(forwardRef<HTMLDivElement, CardProps>(({
  children,
  className,
  interactive = false,
  elevation = 'low',
  onClick,
  onKeyPress,
  testId = 'card',
  ariaLabel,
  role = 'article',
  isLoading = false,
  error = null,
  ...rest
}, ref) => {
  // Memoized keyboard handler
  const keyPressHandler = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (onKeyPress) {
      onKeyPress(event);
    }
    handleKeyPress(event, onClick);
  }, [onClick, onKeyPress]);

  // Compute component classes
  const cardClasses = classNames(
    styles.card,
    getElevationClass(elevation),
    {
      [styles['card--interactive']]: interactive,
      [styles['card--loading']]: isLoading,
      [styles['card--error']]: error,
    },
    className
  );

  // Compute ARIA attributes for accessibility
  const ariaAttributes = {
    role,
    'aria-label': ariaLabel,
    'aria-busy': isLoading,
    'aria-disabled': isLoading,
    tabIndex: interactive ? 0 : undefined,
  };

  // Loading state render
  if (isLoading) {
    return (
      <div
        className={cardClasses}
        data-testid={`${testId}-loading`}
        {...ariaAttributes}
        ref={ref}
        {...rest}
      >
        <div className={styles.card__content}>
          <div className={styles['card__loading-indicator']} />
        </div>
      </div>
    );
  }

  // Error state render
  if (error) {
    return (
      <div
        className={cardClasses}
        data-testid={`${testId}-error`}
        {...ariaAttributes}
        ref={ref}
        {...rest}
      >
        <div className={styles.card__content}>
          <div className={styles['card__error-message']}>
            {error.message}
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div
      className={cardClasses}
      onClick={onClick}
      onKeyPress={keyPressHandler}
      data-testid={testId}
      {...ariaAttributes}
      ref={ref}
      {...rest}
    >
      <div className={styles.card__content}>
        {children}
      </div>
    </div>
  );
}));

// Display name for debugging
Card.displayName = 'Card';

// Default export
export default Card;