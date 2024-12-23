// ESLint configuration for RFID Asset Tracking Frontend
// Dependencies:
// @typescript-eslint/parser@^5.59.0
// @typescript-eslint/eslint-plugin@^5.59.0
// eslint-plugin-react@^7.32.0
// eslint-plugin-react-hooks@^4.6.0
// eslint-config-prettier@^8.8.0

module.exports = {
  // Use TypeScript parser for ESLint
  parser: '@typescript-eslint/parser',

  // Parser options for TypeScript and React
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
    project: './tsconfig.json',
  },

  // Extend recommended configs and plugins
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier', // Must be last to override other formatting rules
  ],

  // Required plugins for TypeScript and React
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],

  // React-specific settings
  settings: {
    react: {
      version: 'detect',
    },
  },

  // Custom rules configuration
  rules: {
    // TypeScript-specific rules
    '@typescript-eslint/explicit-function-return-type': 'error', // Require return types on functions
    '@typescript-eslint/no-explicit-any': 'error', // Disallow usage of any type
    '@typescript-eslint/no-unused-vars': 'error', // Error on unused variables
    '@typescript-eslint/strict-boolean-expressions': 'error', // Strict boolean expressions

    // React-specific rules
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react-hooks/rules-of-hooks': 'error', // Enforce hooks rules
    'react-hooks/exhaustive-deps': 'warn', // Warn about missing dependencies

    // General rules
    'no-console': 'warn', // Warn on console.log usage
    'no-debugger': 'error', // Error on debugger statements
  },

  // Files to ignore
  ignorePatterns: [
    'dist',
    'build',
    'coverage',
    'node_modules',
    'vite.config.ts',
    'jest.config.ts',
  ],
};