import React from 'react'; // ^18.0.0
import styled, { keyframes } from 'styled-components'; // ^5.3.0

// Type definitions for component props
export type LoadingSize = 'small' | 'medium' | 'large';

export interface LoadingProps {
  size?: LoadingSize;
  color?: string;
  fullScreen?: boolean;
  label?: string;
}

// Utility function to convert size prop to pixel values
const getSize = (size?: LoadingSize): string => {
  switch (size) {
    case 'small':
      return '24px';
    case 'large':
      return '56px';
    case 'medium':
    default:
      return '40px';
  }
};

// Keyframe animation for spinner rotation
const spinAnimation = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

// Styled components
const LoadingContainer = styled.div<{ fullScreen?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: opacity 0.2s ease-in-out;

  ${({ fullScreen }) =>
    fullScreen &&
    `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(255, 255, 255, 0.9);
    z-index: 1000;
    backdrop-filter: blur(2px);
  `}
`;

const Spinner = styled.div<{ size: string; color: string }>`
  border: 3px solid rgba(0, 0, 0, 0.1);
  border-top-color: ${props => props.color};
  border-radius: 50%;
  width: ${props => props.size};
  height: ${props => props.size};
  animation: ${spinAnimation} 1s linear infinite;
  transform-origin: center center;
  will-change: transform;
`;

const LoadingLabel = styled.span`
  margin-left: 12px;
  color: rgba(0, 0, 0, 0.87);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
    'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
`;

/**
 * A Material Design compliant loading spinner component with accessibility support.
 * 
 * @param {LoadingProps} props - Component properties
 * @param {LoadingSize} [props.size='medium'] - Size of the spinner (small: 24px, medium: 40px, large: 56px)
 * @param {string} [props.color='#1976d2'] - Color of the spinner
 * @param {boolean} [props.fullScreen=false] - Whether to display the spinner in fullscreen mode
 * @param {string} [props.label] - Accessible label for the loading indicator
 * 
 * @example
 * // Basic usage
 * <Loading />
 * 
 * // With custom size and color
 * <Loading size="large" color="#f50057" />
 * 
 * // Fullscreen with label
 * <Loading fullScreen label="Loading data..." />
 */
const Loading: React.FC<LoadingProps> = React.memo(({
  size,
  color = '#1976d2',
  fullScreen = false,
  label,
}) => {
  const spinnerSize = getSize(size);
  const ariaLabel = label || 'Loading';

  return (
    <LoadingContainer
      fullScreen={fullScreen}
      role="alert"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner
        size={spinnerSize}
        color={color}
        aria-hidden="true"
      />
      {label && (
        <LoadingLabel aria-label={ariaLabel}>
          {label}
        </LoadingLabel>
      )}
    </LoadingContainer>
  );
});

// Display name for debugging purposes
Loading.displayName = 'Loading';

export default Loading;