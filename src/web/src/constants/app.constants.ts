/**
 * Core application constants for the RFID Asset Tracking System.
 * Defines system-wide configuration, UI specifications, role-based access controls,
 * and data formatting standards.
 * @version 1.0.0
 */

import { UserRole } from '../types/auth.types';

/**
 * Application metadata and core configuration
 */
export const APP_CONSTANTS = {
  APP_NAME: 'RFID Asset Tracking System',
  APP_VERSION: '1.0.0',
  COPYRIGHT: '© 2023 RFID Asset Tracking',
  SUPPORT_EMAIL: 'support@rfid-asset-tracking.com',
  API_VERSION: 'v1',
  DEFAULT_LOCALE: 'en-US'
} as const;

/**
 * UI design system constants based on Material Design specifications
 */
export const UI_CONSTANTS = {
  // Base grid spacing unit (8px)
  GRID_SPACING: 8,

  // Responsive breakpoints
  BREAKPOINTS: {
    MOBILE: 320,
    TABLET: 768,
    DESKTOP: 1024,
    LARGE: 1440
  },

  // Typography system
  TYPOGRAPHY: {
    FONT_FAMILY: 'Roboto, sans-serif',
    FONT_FAMILY_MONO: 'Roboto Mono, monospace',
    SCALE: {
      H1: 32,
      H2: 24,
      H3: 20,
      BODY: 16,
      SMALL: 14
    }
  },

  // Animation and transition timings
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 3000,
  TRANSITION_TIMING: 'cubic-bezier(0.4, 0, 0.2, 1)',

  // Color palette for status states
  STATUS_COLORS: {
    SUCCESS: '#4CAF50',
    ERROR: '#F44336',
    WARNING: '#FFC107',
    INFO: '#2196F3'
  }
} as const;

/**
 * Role-based access control mappings defining permissions per role
 */
export const ROLE_ACCESS_LEVELS = {
  [UserRole.ADMIN]: [
    'read',
    'write',
    'delete',
    'configure',
    'manage_users',
    'manage_roles',
    'view_reports',
    'export_data'
  ],
  [UserRole.ASSET_MANAGER]: [
    'read',
    'write',
    'delete',
    'view_reports',
    'export_data'
  ],
  [UserRole.OPERATOR]: [
    'read',
    'write',
    'view_reports'
  ],
  [UserRole.VIEWER]: [
    'read',
    'view_reports'
  ]
} as const;

/**
 * Pagination configuration for data tables and lists
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
  PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
  MAX_PAGES_SHOWN: 5
} as const;

/**
 * Date and time format specifications for consistency across the application
 */
export const DATE_FORMATS = {
  DISPLAY_DATE: 'YYYY-MM-DD',
  DISPLAY_TIME: 'HH:mm:ss',
  DISPLAY_DATETIME: 'YYYY-MM-DD HH:mm:ss',
  API_DATE: 'YYYY-MM-DD',
  API_DATETIME: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  TIMEZONE: 'UTC',
  RELATIVE_TIME_THRESHOLD: 7 // Days before switching to absolute dates
} as const;

/**
 * Asset-specific constants for consistent data presentation
 */
export const ASSET_CONSTANTS = {
  IMAGE: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    THUMBNAIL_SIZE: 150,
    PREVIEW_SIZE: 500
  },
  RFID: {
    TAG_PATTERN: /^[A-F0-9]{24}$/,
    READ_INTERVAL: 1000, // ms
    SIGNAL_STRENGTH_THRESHOLD: -70 // dBm
  }
} as const;

/**
 * Route configuration for application navigation
 */
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  ASSETS: '/assets',
  ASSET_DETAIL: '/assets/:id',
  LOCATIONS: '/locations',
  REPORTS: '/reports',
  SETTINGS: '/settings',
  PROFILE: '/profile',
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    FORGOT_PASSWORD: '/auth/forgot-password'
  }
} as const;

/**
 * API endpoint configuration
 */
export const API_ENDPOINTS = {
  AUTH: '/api/v1/auth',
  ASSETS: '/api/v1/assets',
  LOCATIONS: '/api/v1/locations',
  READERS: '/api/v1/readers',
  REPORTS: '/api/v1/reports',
  USERS: '/api/v1/users'
} as const;