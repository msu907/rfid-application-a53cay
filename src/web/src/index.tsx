/**
 * Entry point for the RFID Asset Tracking System React application.
 * Initializes the app with Redux store, theme provider, error boundaries,
 * performance monitoring, and PWA support.
 * @version 1.0.0
 */

import React from 'react'; // ^18.2.0
import ReactDOM from 'react-dom/client'; // ^18.2.0
import { Provider } from 'react-redux'; // ^8.1.1
import * as Sentry from '@sentry/react'; // ^7.0.0
import { ErrorBoundary } from '@sentry/react'; // ^7.0.0
import { ThemeProvider } from '@mui/material'; // ^5.0.0
import { registerServiceWorker } from 'workbox-registration'; // ^6.5.4

import App from './App';
import { store } from './redux/store';

// Constants for browser compatibility
const MINIMUM_BROWSER_VERSIONS = {
  chrome: 90,
  firefox: 88,
  safari: 14,
  edge: 90
};

// Root element ID from index.html
const ROOT_ELEMENT_ID = 'root';

/**
 * Validates if current browser meets minimum version requirements
 * @returns Boolean indicating browser compatibility
 */
const checkBrowserCompatibility = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check Chrome version
  const chromeMatch = /chrome\/(\d+)/.exec(userAgent);
  if (chromeMatch && parseInt(chromeMatch[1]) < MINIMUM_BROWSER_VERSIONS.chrome) {
    return false;
  }

  // Check Firefox version
  const firefoxMatch = /firefox\/(\d+)/.exec(userAgent);
  if (firefoxMatch && parseInt(firefoxMatch[1]) < MINIMUM_BROWSER_VERSIONS.firefox) {
    return false;
  }

  // Check Safari version
  const safariMatch = /version\/(\d+).*safari/.exec(userAgent);
  if (safariMatch && parseInt(safariMatch[1]) < MINIMUM_BROWSER_VERSIONS.safari) {
    return false;
  }

  // Check Edge version
  const edgeMatch = /edg\/(\d+)/.exec(userAgent);
  if (edgeMatch && parseInt(edgeMatch[1]) < MINIMUM_BROWSER_VERSIONS.edge) {
    return false;
  }

  return true;
};

/**
 * Initializes monitoring and error tracking services
 */
const initializeMonitoring = (): void => {
  if (process.env.NODE_ENV === 'production') {
    // Initialize Sentry for error tracking
    Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.2,
      integrations: [
        new Sentry.BrowserTracing({
          tracingOrigins: ['localhost', /^\//],
        }),
      ],
    });

    // Initialize performance monitoring
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        // Report performance metrics to Sentry
        Sentry.addBreadcrumb({
          category: 'performance',
          message: `${entry.name}: ${entry.duration}ms`,
          level: 'info',
        });
      });
    });

    observer.observe({ entryTypes: ['navigation', 'resource', 'paint'] });
  }
};

/**
 * Renders the React application with all required providers
 */
const renderApp = (): void => {
  // Check browser compatibility
  if (!checkBrowserCompatibility()) {
    console.warn('Browser version not supported. Please upgrade to a newer version.');
  }

  // Initialize monitoring services
  initializeMonitoring();

  // Get root element
  const rootElement = document.getElementById(ROOT_ELEMENT_ID);
  if (!rootElement) {
    throw new Error(`Root element with id '${ROOT_ELEMENT_ID}' not found`);
  }

  // Create React root
  const root = ReactDOM.createRoot(rootElement);

  // Register service worker for PWA support
  if (process.env.NODE_ENV === 'production') {
    registerServiceWorker({
      onSuccess: () => console.log('Service Worker registered successfully'),
      onUpdate: () => console.log('New content available; please refresh'),
    });
  }

  // Render application with providers
  root.render(
    <React.StrictMode>
      <ErrorBoundary
        fallback={({ error }) => (
          <div role="alert">
            <h1>Application Error</h1>
            <pre>{error.message}</pre>
          </div>
        )}
      >
        <Provider store={store}>
          <App />
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );
};

// Initialize application
renderApp();

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}