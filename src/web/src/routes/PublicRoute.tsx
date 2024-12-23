/**
 * PublicRoute component that handles public route access control with enhanced security
 * and performance optimizations. Prevents authenticated users from accessing public pages
 * while allowing unauthenticated access.
 * @version 1.0.0
 */

import { FC, PropsWithChildren, memo, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Loading state component with accessibility considerations
 */
const LoadingIndicator: FC = () => (
  <div 
    role="status" 
    aria-live="polite" 
    className="loading-container"
  >
    <div className="loading-spinner" />
    <span className="sr-only">Loading authentication status...</span>
  </div>
);

/**
 * Error boundary component for handling authentication errors
 */
const AuthError: FC<{ error: string }> = ({ error }) => (
  <div 
    role="alert" 
    className="auth-error"
    aria-live="assertive"
  >
    <p>Authentication Error: {error}</p>
    <p>Please try refreshing the page or contact support if the issue persists.</p>
  </div>
);

/**
 * PublicRoute component that implements secure route protection
 * Redirects authenticated users to dashboard and allows public access
 * for unauthenticated users
 */
const PublicRoute: FC<PropsWithChildren<{}>> = memo(({ children }) => {
  const { 
    isAuthenticated, 
    isLoading, 
    error, 
    validateSession 
  } = useAuth();

  // Validate session on mount and route changes
  useEffect(() => {
    const validateRouteAccess = async () => {
      try {
        await validateSession();
      } catch (error) {
        console.error('Route validation error:', error);
      }
    };

    validateRouteAccess();
  }, [validateSession]);

  // Handle loading state
  if (isLoading) {
    return <LoadingIndicator />;
  }

  // Handle authentication errors
  if (error) {
    return <AuthError error={error} />;
  }

  // Redirect authenticated users to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Render children for public access
  return (
    <div className="public-route-container">
      {children}
    </div>
  );
});

// Display name for debugging
PublicRoute.displayName = 'PublicRoute';

// Export memoized component
export default PublicRoute;