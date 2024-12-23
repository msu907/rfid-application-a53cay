/**
 * Central routing configuration for the RFID Asset Tracking System.
 * Implements secure route protection, role-based access control, and navigation structure
 * with advanced features like code splitting, performance monitoring, and WebSocket management.
 * @version 1.0.0
 */

import React, { Suspense, useEffect } from 'react'; // ^18.0.0
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'; // ^6.0.0
import { useDispatch } from 'react-redux';
import PrivateRoute from './PrivateRoute';
import { Loading } from '../components/common/Loading';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { setLoading } from '../redux/slices/uiSlice';
import { UserRole } from '../types/auth.types';

// Lazy-loaded route components with TypeScript types
const LoginPage = React.lazy(() => import('../pages/LoginPage'));
const DashboardPage = React.lazy(() => import('../pages/DashboardPage'));
const AssetsPage = React.lazy(() => import('../pages/AssetsPage'));
const LocationsPage = React.lazy(() => import('../pages/LocationsPage'));
const ReadersPage = React.lazy(() => import('../pages/ReadersPage'));
const ReportsPage = React.lazy(() => import('../pages/ReportsPage'));
const SettingsPage = React.lazy(() => import('../pages/SettingsPage'));
const UnauthorizedPage = React.lazy(() => import('../pages/UnauthorizedPage'));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage'));

/**
 * Enhanced route configuration type with additional features
 */
interface RouteConfig {
  path: string;
  element: React.ReactNode;
  roles: UserRole[];
  isPublic: boolean;
  wsEnabled: boolean;
  auditLog: boolean;
  loadingFallback?: React.ReactNode;
}

/**
 * Route configuration with comprehensive security and feature settings
 */
const routes: RouteConfig[] = [
  {
    path: '/login',
    element: <LoginPage />,
    roles: [],
    isPublic: true,
    wsEnabled: false,
    auditLog: true
  },
  {
    path: '/',
    element: <DashboardPage />,
    roles: [UserRole.ADMIN, UserRole.ASSET_MANAGER, UserRole.OPERATOR, UserRole.VIEWER],
    isPublic: false,
    wsEnabled: true,
    auditLog: true
  },
  {
    path: '/assets',
    element: <AssetsPage />,
    roles: [UserRole.ADMIN, UserRole.ASSET_MANAGER, UserRole.OPERATOR, UserRole.VIEWER],
    isPublic: false,
    wsEnabled: true,
    auditLog: true
  },
  {
    path: '/locations',
    element: <LocationsPage />,
    roles: [UserRole.ADMIN, UserRole.ASSET_MANAGER, UserRole.OPERATOR, UserRole.VIEWER],
    isPublic: false,
    wsEnabled: true,
    auditLog: true
  },
  {
    path: '/readers',
    element: <ReadersPage />,
    roles: [UserRole.ADMIN],
    isPublic: false,
    wsEnabled: true,
    auditLog: true
  },
  {
    path: '/reports',
    element: <ReportsPage />,
    roles: [UserRole.ADMIN, UserRole.ASSET_MANAGER],
    isPublic: false,
    wsEnabled: false,
    auditLog: true
  },
  {
    path: '/settings',
    element: <SettingsPage />,
    roles: [UserRole.ADMIN],
    isPublic: false,
    wsEnabled: false,
    auditLog: true
  }
];

/**
 * Route change handler component for analytics and performance monitoring
 */
const RouteChangeHandler: React.FC = () => {
  const location = useLocation();
  const dispatch = useDispatch();

  useEffect(() => {
    // Start route transition loading
    dispatch(setLoading({ operation: 'routeChange', loading: true }));

    // Track page view
    const pageLoadStart = performance.now();
    
    return () => {
      // Calculate and report page load time
      const loadTime = performance.now() - pageLoadStart;
      // Log performance metrics
      console.debug(`Route change to ${location.pathname} took ${loadTime}ms`);
      
      // End route transition loading
      dispatch(setLoading({ operation: 'routeChange', loading: false }));
    };
  }, [location, dispatch]);

  return null;
};

/**
 * Enhanced router component with advanced features
 */
const AppRouter: React.FC = React.memo(() => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <RouteChangeHandler />
        <Suspense 
          fallback={
            <Loading 
              size="large"
              label="Loading page..."
              fullScreen={true}
            />
          }
        >
          <Routes>
            {/* Public routes */}
            {routes
              .filter(route => route.isPublic)
              .map(({ path, element }) => (
                <Route
                  key={path}
                  path={path}
                  element={element}
                />
              ))}

            {/* Protected routes */}
            {routes
              .filter(route => !route.isPublic)
              .map(({ path, element, roles, wsEnabled, auditLog }) => (
                <Route
                  key={path}
                  path={path}
                  element={
                    <PrivateRoute
                      requiredRoles={roles}
                      auditLog={auditLog}
                    >
                      {element}
                    </PrivateRoute>
                  }
                />
              ))}

            {/* Error routes */}
            <Route
              path="/unauthorized"
              element={<UnauthorizedPage />}
            />
            <Route
              path="*"
              element={<NotFoundPage />}
            />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
});

// Display name for debugging
AppRouter.displayName = 'AppRouter';

export default AppRouter;