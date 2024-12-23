import React from 'react'; // ^18.2.0
import { Toast } from './Toast';
import { Loading } from './Loading';

/**
 * Props interface for the ErrorBoundary component
 */
interface ErrorBoundaryProps {
  /** Child components to be rendered */
  children: React.ReactNode;
  /** Optional custom fallback UI to display during errors */
  fallback?: React.ReactNode;
  /** Optional error handler callback */
  onError?: (error: Error, errorInfo: React.ErrorInfo, errorCode: string) => void;
  /** Whether the error can be retried */
  retryable?: boolean;
}

/**
 * State interface for ErrorBoundary component
 */
interface ErrorBoundaryState {
  /** Indicates if an error has occurred */
  hasError: boolean;
  /** The caught error object */
  error: Error | null;
  /** React error information including component stack */
  errorInfo: React.ErrorInfo | null;
  /** System-specific error code (e.g., RDR-001) */
  errorCode: string | null;
  /** Indicates if error recovery is in progress */
  isRecovering: boolean;
  /** Number of retry attempts made */
  retryCount: number;
}

/**
 * A React error boundary component that provides comprehensive error handling,
 * accessibility features, and error reporting for the RFID Asset Tracking System.
 * 
 * Features:
 * - Catches JavaScript errors in child components
 * - Displays user-friendly error messages
 * - Supports retry functionality for recoverable errors
 * - Implements WCAG 2.1 Level AA accessibility standards
 * - Integrates with system-wide error reporting
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  /** Maximum number of retry attempts */
  private readonly maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCode: null,
      isRecovering: false,
      retryCount: 0
    };

    this.handleRetry = this.handleRetry.bind(this);
  }

  /**
   * Static lifecycle method called when an error occurs
   * Maps known errors to system error codes
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Map error types to system error codes
    let errorCode = 'SYS-001'; // Default system error code

    if (error.name === 'NetworkError') {
      errorCode = 'NET-001';
    } else if (error.name === 'AuthenticationError') {
      errorCode = 'SEC-001';
    } else if (error.message.includes('RFID Reader')) {
      errorCode = 'RDR-001';
    } else if (error.message.includes('API')) {
      errorCode = 'API-001';
    }

    return {
      hasError: true,
      error,
      errorCode
    };
  }

  /**
   * Lifecycle method called after an error has been thrown
   * Handles error reporting and notification
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const { onError } = this.props;
    const { errorCode } = this.state;

    // Update state with error details
    this.setState({
      errorInfo,
      isRecovering: false
    });

    // Show error notification
    Toast.show({
      type: 'error',
      message: `An error occurred: ${error.message}`,
      duration: 8000
    });

    // Call error handler if provided
    if (onError && errorCode) {
      onError(error, errorInfo, errorCode);
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', {
        error,
        errorInfo,
        errorCode
      });
    }
  }

  /**
   * Handles retry attempts for recoverable errors
   */
  private handleRetry(): void {
    const { retryCount } = this.state;

    if (retryCount >= this.maxRetries) {
      Toast.show({
        type: 'error',
        message: 'Maximum retry attempts reached. Please refresh the page.',
        duration: 5000
      });
      return;
    }

    this.setState({
      isRecovering: true
    });

    // Attempt recovery after a short delay
    setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorCode: null,
        isRecovering: false,
        retryCount: retryCount + 1
      });
    }, 1000);
  }

  /**
   * Renders the error boundary content
   */
  render(): React.ReactNode {
    const { children, fallback, retryable = true } = this.props;
    const { hasError, error, isRecovering } = this.state;

    // Show loading state during recovery
    if (isRecovering) {
      return (
        <Loading
          size="large"
          label="Attempting to recover..."
          fullScreen={true}
        />
      );
    }

    // Show error UI if an error occurred
    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI with accessibility support
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="error-boundary-container"
        >
          <div className="error-boundary-content">
            <h2>Something went wrong</h2>
            <p>{error?.message || 'An unexpected error occurred.'}</p>
            
            {retryable && (
              <button
                onClick={this.handleRetry}
                className="retry-button"
                aria-label="Retry operation"
              >
                Try Again
              </button>
            )}
            
            <p className="help-text">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    // Render children normally if no error
    return children;
  }
}

export default ErrorBoundary;