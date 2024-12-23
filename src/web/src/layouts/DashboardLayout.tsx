// @mui/material version: ^5.0.0
// react version: ^18.0.0
// react-router-dom version: ^6.0.0
// classnames version: ^2.3.2

import React, { useEffect, useState, useCallback, memo } from 'react';
import { useLocation, Outlet, Navigate } from 'react-router-dom';
import classNames from 'classnames';
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import useWebSocket from '../hooks/useWebSocket';
import useAuth from '../hooks/useAuth';

// Constants for layout configuration
const LAYOUT_CONFIG = {
  MOBILE_BREAKPOINT: 768,
  SIDEBAR_COLLAPSED_WIDTH: 64,
  SIDEBAR_EXPANDED_WIDTH: 240,
  NAVBAR_HEIGHT: 64,
  LOCAL_STORAGE_SIDEBAR_KEY: 'rfid_sidebar_collapsed',
} as const;

// Interface for DashboardLayout props
interface DashboardLayoutProps {
  className?: string;
  requireAuth?: boolean;
}

/**
 * Enterprise-grade dashboard layout component with real-time capabilities
 * and security integration for the RFID Asset Tracking System
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = memo(({
  className,
  requireAuth = true
}) => {
  // State management
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem(LAYOUT_CONFIG.LOCAL_STORAGE_SIDEBAR_KEY) === 'true';
  });
  const [isMobile, setIsMobile] = useState(
    window.innerWidth < LAYOUT_CONFIG.MOBILE_BREAKPOINT
  );

  // Hooks
  const location = useLocation();
  const { user, isAuthenticated, validateSession } = useAuth();
  const { isConnected, error: wsError, reconnect } = useWebSocket('dashboard', {
    autoConnect: true,
    heartbeatInterval: 30000,
    reconnectAttempts: 5
  });

  /**
   * Handles sidebar toggle with state persistence
   */
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const newState = !prev;
      localStorage.setItem(LAYOUT_CONFIG.LOCAL_STORAGE_SIDEBAR_KEY, String(newState));
      return newState;
    });
  }, []);

  /**
   * Handles window resize events with debouncing
   */
  const handleResize = useCallback(() => {
    const timeoutId = setTimeout(() => {
      const newIsMobile = window.innerWidth < LAYOUT_CONFIG.MOBILE_BREAKPOINT;
      setIsMobile(newIsMobile);
      
      // Auto-collapse sidebar on mobile
      if (newIsMobile && !isSidebarCollapsed) {
        setIsSidebarCollapsed(true);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [isSidebarCollapsed]);

  /**
   * Sets up window resize listener
   */
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  /**
   * Validates session and WebSocket connection
   */
  useEffect(() => {
    const validateConnection = async () => {
      const isValid = await validateSession();
      if (!isValid) {
        return;
      }

      if (!isConnected && !wsError) {
        await reconnect();
      }
    };

    validateConnection();
  }, [validateSession, isConnected, wsError, reconnect]);

  // Redirect to login if authentication is required but not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div
      className={classNames('dashboard-layout', className, {
        'sidebar-collapsed': isSidebarCollapsed,
        'is-mobile': isMobile
      })}
      data-testid="dashboard-layout"
    >
      <Navbar
        className="dashboard-navbar"
        onMenuToggle={handleSidebarToggle}
      />
      
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={handleSidebarToggle}
        userRole={user?.role}
        className="dashboard-sidebar"
      />

      <main
        className="dashboard-content"
        role="main"
        aria-label="Main content"
      >
        <div className="content-wrapper">
          <Outlet />
        </div>
      </main>

      <style jsx>{`
        .dashboard-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
          background-color: var(--bg-primary);
        }

        .dashboard-navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
        }

        .dashboard-sidebar {
          position: fixed;
          top: ${LAYOUT_CONFIG.NAVBAR_HEIGHT}px;
          left: 0;
          bottom: 0;
          z-index: 900;
          transition: width 0.3s ease;
        }

        .dashboard-content {
          margin-left: ${LAYOUT_CONFIG.SIDEBAR_EXPANDED_WIDTH}px;
          margin-top: ${LAYOUT_CONFIG.NAVBAR_HEIGHT}px;
          padding: 24px;
          overflow-y: auto;
          flex: 1;
          transition: margin-left 0.3s ease;
        }

        .sidebar-collapsed .dashboard-content {
          margin-left: ${LAYOUT_CONFIG.SIDEBAR_COLLAPSED_WIDTH}px;
        }

        .content-wrapper {
          max-width: 1440px;
          margin: 0 auto;
          width: 100%;
        }

        /* Mobile Styles */
        @media (max-width: ${LAYOUT_CONFIG.MOBILE_BREAKPOINT}px) {
          .dashboard-content {
            margin-left: 0;
            padding: 16px;
          }

          .dashboard-sidebar {
            transform: translateX(-100%);
          }

          .sidebar-collapsed .dashboard-sidebar {
            transform: translateX(0);
          }
        }

        /* Dark Mode Support */
        @media (prefers-color-scheme: dark) {
          .dashboard-layout {
            background-color: var(--bg-primary-dark);
          }
        }

        /* High Contrast Mode */
        @media (forced-colors: active) {
          .dashboard-layout {
            border: 1px solid CanvasText;
          }
        }
      `}</style>
    </div>
  );
});

DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;