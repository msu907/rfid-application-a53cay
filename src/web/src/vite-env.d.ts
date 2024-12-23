/// <reference types="vite/client" />
/// <reference types="react" />

/**
 * Type definitions for environment variables used in the RFID Asset Tracking System
 * @version 4.3.0 (Vite)
 * @version 18.0.0 (React)
 */

/**
 * Environment variable interface for the RFID Asset Tracking application
 * Defines type-safe access to configuration values
 */
interface ImportMetaEnv {
  /** Base URL for the API endpoints */
  readonly VITE_API_URL: string;
  
  /** Auth0 domain for authentication */
  readonly VITE_AUTH0_DOMAIN: string;
  
  /** Auth0 client ID for application identification */
  readonly VITE_AUTH0_CLIENT_ID: string;
  
  /** Auth0 audience for API access */
  readonly VITE_AUTH0_AUDIENCE: string;
  
  /** WebSocket server URL for real-time updates */
  readonly VITE_WEBSOCKET_URL: string;
}

/**
 * Extension of ImportMeta interface to include environment variables
 * Provides type safety for import.meta.env usage
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Module declarations for static assets
 * Enables TypeScript support for file imports
 */

/**
 * SVG file declaration supporting React component usage
 * Allows SVG files to be imported as React components
 */
declare module '*.svg' {
  import React from 'react';
  const content: React.FunctionComponent<React.SVGAttributes<SVGElement>>;
  export default content;
}

/**
 * PNG file declaration for image assets
 * Enables direct importing of PNG files
 */
declare module '*.png' {
  const content: string;
  export default content;
}

/**
 * JPG file declaration for image assets
 * Enables direct importing of JPG files
 */
declare module '*.jpg' {
  const content: string;
  export default content;
}

/**
 * SCSS module declaration with CSS modules support
 * Enables type-safe usage of SCSS modules
 */
declare module '*.scss' {
  const classes: { [className: string]: string };
  export default classes;
}