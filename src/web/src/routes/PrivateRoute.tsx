/**
 * Enhanced PrivateRoute component providing secure route protection with role-based access control,
 * session validation, and audit logging for the RFID Asset Tracking application.
 * @version 1.0.0
 */

import React from 'react'; // ^18.0.0
import { Navigate, useLocation } from 'react-router-dom'; // ^6.0.0
import { useAuth } from '../hooks/useAuth';
import { Loading } from '../components/common/Loading';
import { ErrorBoundary } from '../components/common/ErrorBoundary';

/**
 * Type definition for role hierarchy in the system
 */
type UserRole = 'admin' | 'assetManager' | 'operator' | 'viewer';

/**
 * Interface for audit logging options
 */
interface AuditOptions {
  logAccess: boolean;
  logLevel: 'info' | 'warn' | 'error';
}

/**
 * Enhanced interface for PrivateRoute component props with strict role typing
 */
interface PrivateRouteProps {
  children: React.ReactNode;
  requiredRoles: UserRole[];
  fallbackPath?: string;
  auditOptions?: AuditOptions;
}

/**
 * Default audit options for route access logging
 */
const DEFAULT_AUDIT_OPTIONS: AuditOptions = {
  logAccess: true,
  logLevel: 'info'
};

/**
 * Enhanced PrivateRoute component with comprehensive security features
 */
const PrivateRoute: React.FC<PrivateRouteProps> = React.memo(({
  children,
  requiredRoles,
  fallbackPath = '/login',
  auditOptions = DEFAULT_AUDIT_OPTIONS
}) => {
  const location = useLocation();
  const { 
    isAuthenticated, 
    loading, 
    checkRole, 
    validateSession,
    logAccess 
  } = useAuth();

  // Early return for loading state with accessible indicator
  if (loading) {
    return (
      <Loading 
        size="large"
        overlay={true}
        ariaLabel="Validating authentication..."
      />
    );
  }

  /**
   * Validates user session and role permissions
   */
  const validateAccess = async (): Promise<boolean> => {
    try {
      // Validate current session
      const isSessionValid = await validateSession();
      if (!isSessionValid) {
        throw new Error('Invalid or expired session');
      }

      // Check role permissions
      const hasRequiredRole = requiredRoles.some(role => checkRole(role));
      if (!hasRequiredRole) {
        throw new Error('Insufficient permissions');
      }

      // Log successful access if enabled
      if (auditOptions.logAccess) {
        logAccess({
          path: location.pathname,
          requiredRoles,
          timestamp: new Date(),
          success: true
        });
      }

      return true;
    } catch (error) {
      // Log failed access attempt
      if (auditOptions.logAccess) {
        logAccess({
          path: location.pathname,
          requiredRoles,
          timestamp: new Date(),
          success: false,
          error: error instanceof Error ? error.message : 'Access validation failed'
        });
      }
      return false;
    }
  };

  // Handle unauthorized access
  if (!isAuthenticated) {
    return (
      <Navigate 
        to={fallbackPath}
        state={{ from: location }}
        replace
      />
    );
  }

  // Wrap protected content in error boundary with role validation
  return (
    <ErrorBoundary
      onError={(error) => {
        logAccess({
          path: location.pathname,
          requiredRoles,
          timestamp: new Date(),
          success: false,
          error: error.message
        });
      }}
    >
      {validateAccess() ? children : (
        <Navigate 
          to="/unauthorized"
          state={{ 
            from: location,
            requiredRoles 
          }}
          replace
        />
      )}
    </ErrorBoundary>
  );
});

// Display name for debugging
PrivateRoute.displayName = 'PrivateRoute';

export default PrivateRoute;