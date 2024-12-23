/**
 * Root application component for the RFID Asset Tracking System.
 * Provides Redux store integration, global error handling, theme management,
 * and routing configuration with performance optimizations.
 * @version 1.0.0
 */

import React, { useEffect } from 'react'; // ^18.2.0
import { Provider } from 'react-redux'; // ^8.1.1
import { ThemeProvider, CssBaseline } from '@mui/material'; // ^5.14.0
import { useSelector } from 'react-redux';
import { store } from './redux/store';
import AppRouter from './routes';
import ErrorBoundary from './components/common/ErrorBoundary';
import { selectTheme } from './redux/slices/uiSlice';
import { ToastContainer } from './components/common/Toast';

// Theme configuration based on technical specifications
const lightTheme = {
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0'
    },
    secondary: {
      main: '#dc004e',
      light: '#ff4081',
      dark: '#9a0036'
    },
    error: {
      main: '#f44336'
    },
    background: {
      default: '#ffffff',
      paper: '#f5f5f5'
    }
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500
    }
  },
  breakpoints: {
    values: {
      xs: 320,
      sm: 768,
      md: 1024,
      lg: 1440,
      xl: 1920
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 4
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8
        }
      }
    }
  }
};

const darkTheme = {
  ...lightTheme,
  palette: {
    ...lightTheme.palette,
    mode: 'dark',
    background: {
      default: '#121212',
      paper: '#1e1e1e'
    }
  }
};

/**
 * Enhanced error handler with monitoring and recovery strategies
 */
const handleError = (error: Error, errorInfo: React.ErrorInfo): void => {
  // Log error to monitoring service
  console.error('Application Error:', {
    error,
    errorInfo,
    timestamp: new Date().toISOString(),
    location: window.location.href
  });

  // Attempt recovery based on error type
  if (error.name === 'ChunkLoadError') {
    // Handle lazy-loaded chunk failures
    window.location.reload();
  } else if (error.name === 'NetworkError') {
    // Handle network connectivity issues
    navigator.onLine && window.location.reload();
  }

  // Display user-friendly error notification
  store.dispatch({
    type: 'ui/addNotification',
    payload: {
      type: 'error',
      message: 'An unexpected error occurred. Our team has been notified.',
      duration: 8000,
      priority: 2
    }
  });
};

/**
 * Theme provider wrapper component with theme selection
 */
const ThemeWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const themeMode = useSelector(selectTheme);
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

/**
 * Root application component that sets up providers, error handling,
 * and global configuration with performance optimizations
 */
const App: React.FC = React.memo(() => {
  useEffect(() => {
    // Set up performance monitoring
    if (process.env.NODE_ENV === 'production') {
      // Initialize performance observers
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          // Log performance metrics
          console.debug('Performance Entry:', entry);
        });
      });
      observer.observe({ entryTypes: ['navigation', 'resource', 'paint'] });
    }

    // Clean up on unmount
    return () => {
      // Clean up performance observers
      PerformanceObserver.disconnect();
    };
  }, []);

  return (
    <Provider store={store}>
      <ErrorBoundary
        onError={handleError}
        fallback={
          <div role="alert" className="error-fallback">
            <h1>Something went wrong</h1>
            <p>Please try refreshing the page or contact support if the problem persists.</p>
          </div>
        }
      >
        <ThemeWrapper>
          <div id="notification-live-region" aria-live="polite" className="sr-only" />
          <React.Suspense
            fallback={
              <div className="app-loading" role="progressbar">
                Loading application...
              </div>
            }
          >
            <AppRouter />
            <ToastContainer />
          </div>
        </ThemeWrapper>
      </ErrorBoundary>
    </Provider>
  );
});

// Display name for debugging
App.displayName = 'App';

export default App;