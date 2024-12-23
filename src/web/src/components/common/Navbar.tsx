// @mui/material version: ^5.0.0
// react version: ^18.0.0
// react-redux version: ^8.0.0
// classnames version: ^2.3.2

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import { 
  UserIcon, 
  NotificationIcon, 
  HelpIcon, 
  SettingsIcon, 
  MenuIcon 
} from './Icons';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth.types';

// Interface for Navbar props
interface NavbarProps {
  className?: string;
  onMenuToggle?: (isOpen: boolean) => void;
}

// Interface for Redux theme state
interface ThemeState {
  theme: {
    mode: 'light' | 'dark';
  };
}

// Interface for Redux notification state
interface NotificationState {
  notifications: {
    unread: number;
  };
}

/**
 * Main navigation bar component with responsive design and accessibility features
 * @param {NavbarProps} props - Component props
 * @returns {JSX.Element} Rendered navigation bar
 */
const Navbar: React.FC<NavbarProps> = React.memo(({ className, onMenuToggle }) => {
  // Redux hooks
  const dispatch = useDispatch();
  const theme = useSelector((state: ThemeState) => state.theme.mode);
  const unreadNotifications = useSelector(
    (state: NotificationState) => state.notifications.unread
  );

  // Auth hook
  const { user, secureLogout, validateSession } = useAuth();

  // Local state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Refs for dropdown menus
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  /**
   * Handles theme toggle with persistence
   */
  const handleThemeToggle = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme_preference', newTheme);
    dispatch({ type: 'SET_THEME', payload: newTheme });
    document.documentElement.classList.toggle('dark-theme');
  }, [theme, dispatch]);

  /**
   * Handles secure logout process
   */
  const handleLogout = useCallback(async () => {
    try {
      await secureLogout();
      dispatch({ type: 'CLEAR_ALL_STATE' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [secureLogout, dispatch]);

  /**
   * Handles mobile menu toggle
   */
  const handleMobileMenuToggle = useCallback(() => {
    const newState = !isMobileMenuOpen;
    setIsMobileMenuOpen(newState);
    onMenuToggle?.(newState);
  }, [isMobileMenuOpen, onMenuToggle]);

  /**
   * Handles click outside of dropdown menus
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current && 
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
      if (
        notificationsRef.current && 
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Validates session periodically
   */
  useEffect(() => {
    const interval = setInterval(validateSession, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [validateSession]);

  return (
    <nav
      className={classNames('navbar', className)}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="navbar-left">
        <button
          className="icon-button"
          onClick={handleMobileMenuToggle}
          aria-label="Toggle mobile menu"
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-menu"
        >
          <MenuIcon size="medium" />
        </button>

        <h1 className="navbar-title">RFID Asset Tracking</h1>
      </div>

      <div className="navbar-right">
        {/* Notifications */}
        <div ref={notificationsRef} className="notification-menu">
          <button
            className="icon-button"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            aria-label={`${unreadNotifications} unread notifications`}
            aria-expanded={isNotificationsOpen}
          >
            <NotificationIcon size="medium" />
            {unreadNotifications > 0 && (
              <span className="notification-badge" aria-hidden="true">
                {unreadNotifications}
              </span>
            )}
          </button>
          {isNotificationsOpen && (
            <div className="dropdown-menu" role="menu">
              {/* Notification items would be rendered here */}
            </div>
          )}
        </div>

        {/* Help */}
        <button
          className="icon-button"
          onClick={() => dispatch({ type: 'TOGGLE_HELP_MODAL' })}
          aria-label="Help"
        >
          <HelpIcon size="medium" />
        </button>

        {/* Settings (Admin only) */}
        {user?.role === UserRole.ADMIN && (
          <button
            className="icon-button"
            onClick={() => dispatch({ type: 'TOGGLE_SETTINGS_MODAL' })}
            aria-label="Settings"
          >
            <SettingsIcon size="medium" />
          </button>
        )}

        {/* Theme Toggle */}
        <button
          className="icon-button"
          onClick={handleThemeToggle}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          <span className="theme-icon" aria-hidden="true">
            {theme === 'light' ? '🌙' : '☀️'}
          </span>
        </button>

        {/* User Menu */}
        <div ref={userMenuRef} className="user-menu">
          <button
            className="user-menu-button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="true"
          >
            <UserIcon size="medium" />
            <span className="user-name">{user?.name}</span>
          </button>
          {isUserMenuOpen && (
            <div className="dropdown-menu" role="menu">
              <button
                className="dropdown-item"
                onClick={() => dispatch({ type: 'NAVIGATE_TO_PROFILE' })}
              >
                Profile
              </button>
              <button className="dropdown-item" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 64px;
          background-color: var(--bg-primary);
          border-bottom: 1px solid var(--border-color);
          z-index: 1000;
          display: flex;
          align-items: center;
          padding: 0 24px;
          justify-content: space-between;
          transition: all 0.3s ease;
        }

        @media (max-width: 768px) {
          .navbar {
            padding: 0 16px;
            height: 56px;
          }
        }

        .navbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .icon-button {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color 0.2s ease;
          background: transparent;
          border: none;
          color: var(--text-primary);
        }

        .icon-button:hover {
          background-color: var(--hover-bg);
        }

        .icon-button:focus {
          outline: 2px solid var(--focus-color);
          outline-offset: 2px;
        }

        .notification-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background-color: var(--error-color);
          color: white;
          border-radius: 50%;
          min-width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
        }

        .dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          min-width: 200px;
          z-index: 1001;
        }

        .dropdown-item {
          padding: 8px 16px;
          width: 100%;
          text-align: left;
          border: none;
          background: none;
          cursor: pointer;
          color: var(--text-primary);
        }

        .dropdown-item:hover {
          background-color: var(--hover-bg);
        }

        .user-menu-button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 12px;
          border: none;
          background: none;
          cursor: pointer;
          color: var(--text-primary);
        }

        .user-name {
          @media (max-width: 768px) {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;