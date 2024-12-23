// @mui/material version: ^5.0.0
// @mui/material/styles version: ^5.0.0
// react version: ^18.0.0

import React, { useState, useCallback, useEffect, memo } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Interface for component props
interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
}

// Styled components with enterprise-ready styles
const LayoutContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  transition: theme.transitions.create('background-color', {
    duration: theme.transitions.duration.standard,
  }),
}));

const MainContent = styled('main', {
  shouldForwardProp: (prop) => prop !== 'isSidebarCollapsed' && prop !== 'isMobile',
})<{ isSidebarCollapsed: boolean; isMobile: boolean }>(({ theme, isSidebarCollapsed, isMobile }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  marginTop: 64, // Height of navbar
  marginLeft: isMobile ? 0 : (isSidebarCollapsed ? 64 : 240), // Sidebar width
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(2),
  },
  position: 'relative',
  overflow: 'auto',
  minHeight: 'calc(100vh - 64px)', // Full height minus navbar
}));

/**
 * Main layout component that provides the core structure for the RFID Asset Tracking System.
 * Implements responsive design, error handling, and accessibility features.
 */
const MainLayout: React.FC<MainLayoutProps> = memo(({ children, className }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    // Initialize from localStorage for desktop, default to collapsed on mobile
    return isMobile ? true : localStorage.getItem('sidebarCollapsed') === 'true';
  });

  /**
   * Handles sidebar toggle with proper state management and persistence
   */
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const newState = !prev;
      if (!isMobile) {
        localStorage.setItem('sidebarCollapsed', String(newState));
      }
      return newState;
    });
  }, [isMobile]);

  /**
   * Handles keyboard navigation for accessibility
   */
  const handleKeyboardNavigation = useCallback((event: KeyboardEvent) => {
    if (event.key === '/' && (event.metaKey || event.ctrlKey)) {
      // Quick search shortcut
      event.preventDefault();
      // Implement search functionality
    }
  }, []);

  /**
   * Effect for handling responsive behavior
   */
  useEffect(() => {
    // Update sidebar state when viewport changes
    if (isMobile) {
      setIsSidebarCollapsed(true);
    } else {
      const savedState = localStorage.getItem('sidebarCollapsed') === 'true';
      setIsSidebarCollapsed(savedState);
    }
  }, [isMobile]);

  /**
   * Effect for setting up keyboard listeners
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardNavigation);
    return () => {
      document.removeEventListener('keydown', handleKeyboardNavigation);
    };
  }, [handleKeyboardNavigation]);

  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="error-container">
          <h2>Something went wrong</h2>
          <p>Please try refreshing the page or contact support if the problem persists.</p>
        </div>
      }
    >
      <LayoutContainer className={className}>
        <Navbar
          onMenuClick={handleSidebarToggle}
          className="navbar"
        />
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={handleSidebarToggle}
          onKeyboardNavigation={handleKeyboardNavigation}
        />
        <MainContent
          role="main"
          id="main-content"
          isSidebarCollapsed={isSidebarCollapsed}
          isMobile={isMobile}
          aria-label="Main content"
        >
          {/* Skip to main content link for accessibility */}
          <a
            href="#main-content"
            className="skip-link"
            style={{
              position: 'absolute',
              top: -64,
              left: 0,
              padding: theme.spacing(1),
              backgroundColor: theme.palette.background.paper,
              zIndex: theme.zIndex.tooltip,
              transition: 'top 0.2s',
              '&:focus': {
                top: 0,
              },
            }}
          >
            Skip to main content
          </a>
          
          {/* Main content area */}
          <div role="region" aria-live="polite">
            {children}
          </div>

          {/* Notification live region for accessibility */}
          <div
            id="notification-live-region"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}
          />
        </MainContent>
      </LayoutContainer>
    </ErrorBoundary>
  );
});

// Display name for debugging
MainLayout.displayName = 'MainLayout';

export default MainLayout;