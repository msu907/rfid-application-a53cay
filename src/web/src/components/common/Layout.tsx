// @mui/material version: ^5.0.0
// react version: ^18.0.0
// react-router-dom version: ^6.0.0
// classnames version: ^2.3.2

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import classNames from 'classnames';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

// Type definitions
interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  theme?: 'light' | 'dark';
  direction?: 'ltr' | 'rtl';
}

/**
 * Enhanced Layout component providing core application structure with accessibility,
 * responsive design, and RTL support.
 */
const Layout: React.FC<LayoutProps> = ({
  children,
  className,
  theme = 'light',
  direction = 'ltr'
}) => {
  // State management
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(theme);
  const [currentDirection, setCurrentDirection] = useState(direction);

  // Hooks
  const location = useLocation();
  const navigate = useNavigate();
  const layoutRef = useRef<HTMLDivElement>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Memoized handlers
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
    localStorage.setItem('sidebar_collapsed', (!isSidebarCollapsed).toString());
  }, [isSidebarCollapsed]);

  const handleThemeToggle = useCallback(() => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setCurrentTheme(newTheme);
    localStorage.setItem('theme_preference', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, [currentTheme]);

  /**
   * Generates breadcrumb navigation based on current route
   */
  const generateBreadcrumbs = useCallback(() => {
    const paths = location.pathname.split('/').filter(Boolean);
    return paths.map((path, index) => ({
      label: path.charAt(0).toUpperCase() + path.slice(1),
      path: '/' + paths.slice(0, index + 1).join('/'),
    }));
  }, [location.pathname]);

  /**
   * Handles window resize with debouncing
   */
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (isMobile) {
          setIsSidebarCollapsed(true);
        }
      }, 250);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [isMobile]);

  /**
   * Initialize layout preferences from localStorage
   */
  useEffect(() => {
    const savedSidebarState = localStorage.getItem('sidebar_collapsed');
    const savedTheme = localStorage.getItem('theme_preference');
    const savedDirection = localStorage.getItem('text_direction');

    if (savedSidebarState) {
      setIsSidebarCollapsed(savedSidebarState === 'true');
    }
    if (savedTheme) {
      setCurrentTheme(savedTheme as 'light' | 'dark');
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
    if (savedDirection) {
      setCurrentDirection(savedDirection as 'ltr' | 'rtl');
      document.documentElement.setAttribute('dir', savedDirection);
    }
  }, []);

  /**
   * Handle touch gestures for sidebar
   */
  useEffect(() => {
    if (!isMobile) return;

    let touchStartX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const deltaX = touchEndX - touchStartX;

      if (Math.abs(deltaX) > 50) {
        if (deltaX > 0 && isSidebarCollapsed) {
          handleSidebarToggle();
        } else if (deltaX < 0 && !isSidebarCollapsed) {
          handleSidebarToggle();
        }
      }
    };

    const element = layoutRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart);
      element.addEventListener('touchend', handleTouchEnd);

      return () => {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isMobile, isSidebarCollapsed, handleSidebarToggle]);

  const breadcrumbs = generateBreadcrumbs();

  return (
    <div
      ref={layoutRef}
      className={classNames('layout', className, {
        'layout--collapsed': isSidebarCollapsed,
        'layout--rtl': currentDirection === 'rtl',
        [`layout--${currentTheme}`]: true,
      })}
      dir={currentDirection}
      role="main"
    >
      <Navbar
        className="layout__navbar"
        onThemeToggle={handleThemeToggle}
      />

      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={handleSidebarToggle}
        className="layout__sidebar"
        direction={currentDirection}
      />

      <div className="layout__content">
        {/* Breadcrumb navigation */}
        <nav aria-label="Breadcrumb" className="layout__breadcrumbs">
          <ol>
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.path}>
                {index === breadcrumbs.length - 1 ? (
                  <span aria-current="page">{crumb.label}</span>
                ) : (
                  <a
                    href={crumb.path}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(crumb.path);
                    }}
                  >
                    {crumb.label}
                  </a>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Main content area */}
        <main className="layout__main" role="main" aria-label="Main content">
          {children}
        </main>
      </div>

      <style jsx>{`
        .layout {
          display: grid;
          grid-template-areas:
            "navbar navbar"
            "sidebar main";
          grid-template-columns: auto 1fr;
          grid-template-rows: 64px 1fr;
          min-height: 100vh;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          transition: all 0.3s ease;
        }

        .layout--rtl {
          direction: rtl;
        }

        .layout__navbar {
          grid-area: navbar;
          z-index: 1100;
        }

        .layout__sidebar {
          grid-area: sidebar;
          z-index: 1000;
        }

        .layout__content {
          grid-area: main;
          padding: 24px;
          overflow-y: auto;
        }

        .layout__breadcrumbs {
          margin-bottom: 24px;
        }

        .layout__breadcrumbs ol {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .layout__breadcrumbs li:not(:last-child)::after {
          content: "/";
          margin-left: 8px;
          color: var(--text-secondary);
        }

        .layout__breadcrumbs a {
          color: var(--text-primary);
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .layout__breadcrumbs a:hover {
          color: var(--primary-color);
        }

        .layout__main {
          min-height: 0;
          padding: 16px;
          background-color: var(--bg-secondary);
          border-radius: 8px;
          box-shadow: var(--shadow-sm);
        }

        @media (max-width: 768px) {
          .layout {
            grid-template-columns: 1fr;
            grid-template-areas:
              "navbar"
              "main";
          }

          .layout__content {
            padding: 16px;
          }

          .layout__sidebar {
            position: fixed;
            height: 100%;
          }
        }

        @media (max-width: 480px) {
          .layout__content {
            padding: 8px;
          }

          .layout__breadcrumbs {
            margin-bottom: 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default Layout;