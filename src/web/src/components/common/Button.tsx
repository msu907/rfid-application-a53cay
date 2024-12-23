import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.1
import '../../styles/components/_button.scss';

/**
 * Interface defining all possible props for the Button component
 * Implements Material Design principles and WCAG 2.1 Level AA compliance
 */
export interface ButtonProps {
  /** Content to be rendered inside the button */
  children: React.ReactNode;
  /** Visual style variant of the button */
  variant?: 'primary' | 'secondary' | 'outlined';
  /** Size variant affecting padding and font size */
  size?: 'small' | 'medium' | 'large';
  /** Disabled state of the button */
  disabled?: boolean;
  /** Loading state showing a spinner */
  loading?: boolean;
  /** Click handler function */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** HTML button type attribute */
  type?: 'button' | 'submit' | 'reset';
  /** Additional CSS classes */
  className?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** ARIA role override */
  role?: string;
  /** Tab order for keyboard navigation */
  tabIndex?: number;
  /** Unique identifier */
  id?: string;
}

/**
 * A highly accessible and customizable button component following Material Design principles.
 * Supports different variants, sizes, loading states, and follows WCAG 2.1 Level AA guidelines.
 *
 * @example
 * ```tsx
 * <Button
 *   variant="primary"
 *   size="medium"
 *   onClick={() => console.log('clicked')}
 *   ariaLabel="Save changes"
 * >
 *   Save
 * </Button>
 * ```
 */
const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className,
  ariaLabel,
  role = 'button',
  tabIndex = 0,
  id,
  ...restProps
}) => {
  // Combine class names based on props
  const buttonClasses = classNames(
    'btn',
    {
      [`btn--${variant}`]: variant,
      [`btn--${size}`]: size,
      'btn--loading': loading,
      'btn--disabled': disabled
    },
    className
  );

  /**
   * Handle button click events
   * Prevents click during loading state
   */
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      id={id}
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      aria-busy={loading}
      role={role}
      tabIndex={disabled ? -1 : tabIndex}
      {...restProps}
    >
      {/* Wrapper for content to support loading animation */}
      <span className="btn__content">
        {children}
      </span>
      
      {/* Loading spinner rendered conditionally */}
      {loading && (
        <span className="btn__spinner" role="status" aria-label="Loading">
          <span className="visually-hidden">Loading...</span>
        </span>
      )}
    </button>
  );
};

/**
 * Memoize the button component to prevent unnecessary re-renders
 * when parent components update with the same props
 */
export default React.memo(Button);