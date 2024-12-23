import { defineConfig } from 'vite'; // v4.3.3
import react from '@vitejs/plugin-react'; // v4.0.0
import path from 'path';

// Vite configuration for RFID Asset Tracking frontend application
export default defineConfig({
  // React plugin configuration with fast refresh and automatic JSX runtime
  plugins: [
    react({
      fastRefresh: true,
      jsxRuntime: 'automatic'
    })
  ],

  // Path resolution aliases matching tsconfig.json paths
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@constants': path.resolve(__dirname, 'src/constants'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@assets': path.resolve(__dirname, 'public/assets')
    }
  },

  // Development server configuration
  server: {
    port: 3000,
    host: true, // Listen on all local IPs
    strictPort: true, // Fail if port is in use
    proxy: {
      // API proxy configuration
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      },
      // WebSocket proxy for real-time updates
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true
      }
    }
  },

  // Production build configuration
  build: {
    outDir: 'dist',
    sourcemap: true, // Enable source maps for debugging
    // Browser compatibility targets based on requirements
    target: [
      'chrome90',
      'firefox88',
      'safari14',
      'edge90'
    ],
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true // Remove console.log in production
      }
    },
    // Chunk splitting configuration for optimal loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor chunk
          vendor: [
            'react',
            'react-dom',
            '@mui/material'
          ],
          // State management chunk
          redux: [
            '@reduxjs/toolkit',
            'react-redux'
          ],
          // Visualization libraries chunk
          charts: [
            'd3',
            'react-leaflet'
          ]
        }
      }
    }
  },

  // Preview server configuration (for testing production builds)
  preview: {
    port: 3000,
    strictPort: true
  },

  // Enable type checking in development
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@reduxjs/toolkit',
      'react-redux',
      'd3',
      'react-leaflet'
    ]
  }
});