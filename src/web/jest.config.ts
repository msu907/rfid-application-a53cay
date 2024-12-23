import type { Config } from '@jest/types'; // @version ^29.5.0
import { paths } from './tsconfig.json';

// Enterprise-grade Jest configuration for RFID Asset Tracking frontend
const config: Config.InitialOptions = {
  // Use TypeScript preset for Jest
  preset: 'ts-jest',
  
  // Use jsdom for browser environment simulation
  testEnvironment: 'jsdom',
  
  // Root directories for test discovery
  roots: ['<rootDir>/src'],
  modulePaths: ['<rootDir>'],
  
  // Module name mapping based on TypeScript path aliases
  moduleNameMapper: {
    // Path aliases synchronized with tsconfig.json
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',
    '^@assets/(.*)$': '<rootDir>/public/assets/$1',
    
    // Asset and style mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/src/__mocks__/fileMock.js',
    
    // Worker and WebSocket mocks
    '^worker-loader!(.+)$': '<rootDir>/src/__mocks__/workerMock.js',
    '^@websocket/(.*)$': '<rootDir>/src/__mocks__/websocketMock.js',
  },
  
  // Test setup files
  setupFilesAfterEnv: [
    '@testing-library/jest-dom/extend-expect',
    '<rootDir>/src/test/setup/websocket.setup.ts',
    '<rootDir>/src/test/setup/worker.setup.ts',
    '<rootDir>/src/test/setup/performance.setup.ts',
  ],
  
  // Test file patterns including performance and security tests
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
    '**/?(*.)+(perf|security).[jt]s?(x)',
  ],
  
  // Coverage collection configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/vite-env.d.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/**/__mocks__/**',
  ],
  
  // Coverage thresholds with elevated requirements for RFID services
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
    'src/services/rfid/**/*.{ts,tsx}': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  
  // File transformers
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.worker\\.(js|ts)$': '<rootDir>/src/test/transformers/worker-transformer.js',
  },
  
  // Supported file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Global configuration
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json',
    },
    'NODE_ENV': 'test',
  },
  
  // Performance optimization
  maxWorkers: '50%',
  testTimeout: 10000,
  
  // Test reporters for CI/CD integration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage/junit',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
    }],
    ['./src/test/reporters/performance-reporter.js', {
      maxDuration: 5000,
      outputFile: 'coverage/performance.json',
    }],
  ],
};

export default config;