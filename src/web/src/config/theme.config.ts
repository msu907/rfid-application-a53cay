// @mui/material version: ^5.0.0
import { createTheme, ThemeOptions } from '@mui/material';

// Typography configuration with Roboto for UI and Monospace for RFID IDs
const TYPOGRAPHY_CONFIG = {
  fontFamily: 'Roboto, sans-serif',
  rfidId: {
    fontFamily: 'Roboto Mono, monospace',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  h1: {
    fontSize: '2.5rem',
    fontWeight: 500,
    letterSpacing: '-0.01562em',
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 500,
    letterSpacing: '-0.00833em',
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 500,
    letterSpacing: '0em',
  },
  h4: {
    fontSize: '1.5rem',
    fontWeight: 500,
    letterSpacing: '0.00735em',
  },
  body1: {
    fontSize: '1rem',
    fontWeight: 400,
    letterSpacing: '0.00938em',
  },
  body2: {
    fontSize: '0.875rem',
    fontWeight: 400,
    letterSpacing: '0.01071em',
  },
  statusText: {
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.02857em',
    textTransform: 'uppercase',
  },
};

// Component style overrides following 8px grid system
const COMPONENT_OVERRIDES = {
  MuiCard: {
    styleOverrides: {
      root: {
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  MuiButton: {
    styleOverrides: {
      root: {
        borderRadius: '4px',
        textTransform: 'none',
        padding: '8px 16px',
      },
    },
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        borderRadius: '4px',
        backgroundColor: 'transparent',
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: '16px',
        height: '24px',
      },
    },
  },
  MuiDataGrid: {
    styleOverrides: {
      root: {
        borderRadius: '8px',
        border: 'none',
        boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
      },
    },
  },
};

// Light theme configuration with WCAG 2.1 Level AA compliant colors
const lightThemeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2', // WCAG AA compliant
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9c27b0', // WCAG AA compliant
      light: '#ba68c8',
      dark: '#7b1fa2',
      contrastText: '#ffffff',
    },
    error: {
      main: '#d32f2f', // WCAG AA compliant
      light: '#ef5350',
      dark: '#c62828',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#ed6c02', // WCAG AA compliant
      light: '#ff9800',
      dark: '#e65100',
      contrastText: '#ffffff',
    },
    info: {
      main: '#0288d1', // WCAG AA compliant
      light: '#03a9f4',
      dark: '#01579b',
      contrastText: '#ffffff',
    },
    success: {
      main: '#2e7d32', // WCAG AA compliant
      light: '#4caf50',
      dark: '#1b5e20',
      contrastText: '#ffffff',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)', // WCAG AA compliant
      secondary: 'rgba(0, 0, 0, 0.6)', // WCAG AA compliant
    },
    // RFID-specific status colors
    grey: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
  },
  typography: TYPOGRAPHY_CONFIG,
  components: COMPONENT_OVERRIDES,
  spacing: 8, // Base spacing unit of 8px
};

// Dark theme configuration with WCAG 2.1 Level AA compliant colors
const darkThemeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9', // WCAG AA compliant
      light: '#e3f2fd',
      dark: '#42a5f5',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    secondary: {
      main: '#ce93d8', // WCAG AA compliant
      light: '#f3e5f5',
      dark: '#ab47bc',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    error: {
      main: '#f44336', // WCAG AA compliant
      light: '#e57373',
      dark: '#d32f2f',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#ffa726', // WCAG AA compliant
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    info: {
      main: '#29b6f6', // WCAG AA compliant
      light: '#4fc3f7',
      dark: '#0288d1',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    success: {
      main: '#66bb6a', // WCAG AA compliant
      light: '#81c784',
      dark: '#388e3c',
      contrastText: 'rgba(0, 0, 0, 0.87)',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff', // WCAG AA compliant
      secondary: 'rgba(255, 255, 255, 0.7)', // WCAG AA compliant
    },
    // RFID-specific status colors for dark mode
    grey: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
    },
  },
  typography: TYPOGRAPHY_CONFIG,
  components: COMPONENT_OVERRIDES,
  spacing: 8, // Base spacing unit of 8px
};

// Create and export themes
export const lightTheme = createTheme(lightThemeOptions);
export const darkTheme = createTheme(darkThemeOptions);

// Export theme-related types for type safety
export type AppTheme = typeof lightTheme;