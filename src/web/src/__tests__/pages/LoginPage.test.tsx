import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import LoginPage from '../../pages/LoginPage';
import { useAuth } from '../../hooks/useAuth';
import uiReducer from '../../redux/slices/uiSlice';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useAuth hook
jest.mock('../../hooks/useAuth', () => ({
  useAuth: jest.fn()
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

// Test data
const validCredentials = {
  email: 'test@example.com',
  password: 'Password123!@#'
};

const invalidCredentials = {
  email: 'invalid',
  password: 'short'
};

// Create test store
const createTestStore = () => configureStore({
  reducer: {
    ui: uiReducer
  }
});

// Test component wrapper
const renderLoginPage = () => {
  const store = createTestStore();
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    </Provider>
  );
};

describe('LoginPage', () => {
  // Mock auth state
  let mockSecureLogin: jest.Mock;
  let mockAuthState: {
    loading: boolean;
    error: string | null;
    securityContext: {
      lockoutUntil: Date | null;
      loginAttempts: number;
    };
  };

  beforeEach(() => {
    // Reset mocks
    mockSecureLogin = jest.fn();
    mockAuthState = {
      loading: false,
      error: null,
      securityContext: {
        lockoutUntil: null,
        loginAttempts: 0
      }
    };

    // Configure useAuth mock
    (useAuth as jest.Mock).mockReturnValue({
      secureLogin: mockSecureLogin,
      ...mockAuthState
    });

    // Reset timers
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Accessibility', () => {
    it('should pass accessibility checks', async () => {
      const { container } = renderLoginPage();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      renderLoginPage();
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Check tab order
      expect(document.body).toHaveFocus();
      userEvent.tab();
      expect(emailInput).toHaveFocus();
      userEvent.tab();
      expect(passwordInput).toHaveFocus();
      userEvent.tab();
      expect(submitButton).toHaveFocus();
    });

    it('should announce form errors to screen readers', async () => {
      renderLoginPage();
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      userEvent.click(submitButton);
      
      const errorMessages = await screen.findAllByRole('alert');
      expect(errorMessages.length).toBeGreaterThan(0);
      errorMessages.forEach(message => {
        expect(message).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      renderLoginPage();
      mockSecureLogin.mockResolvedValueOnce(undefined);

      // Fill form
      await userEvent.type(
        screen.getByLabelText(/email/i),
        validCredentials.email
      );
      await userEvent.type(
        screen.getByLabelText(/password/i),
        validCredentials.password
      );

      // Submit form
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await userEvent.click(submitButton);

      // Verify loading state
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();

      // Verify login call
      await waitFor(() => {
        expect(mockSecureLogin).toHaveBeenCalledWith({
          email: validCredentials.email,
          password: validCredentials.password
        });
      });
    });

    it('should handle login errors', async () => {
      mockAuthState.error = 'Invalid credentials';
      renderLoginPage();

      // Fill form with invalid credentials
      await userEvent.type(
        screen.getByLabelText(/email/i),
        invalidCredentials.email
      );
      await userEvent.type(
        screen.getByLabelText(/password/i),
        invalidCredentials.password
      );

      // Submit form
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify error display
      expect(await screen.findByRole('alert')).toHaveTextContent(/invalid credentials/i);
    });

    it('should handle account lockout', async () => {
      mockAuthState.securityContext.lockoutUntil = new Date(Date.now() + 900000); // 15 minutes
      renderLoginPage();

      // Verify lockout message
      expect(screen.getByText(/account is temporarily locked/i)).toBeInTheDocument();

      // Verify submit button is disabled
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Security Controls', () => {
    it('should validate CSRF token', async () => {
      renderLoginPage();
      const csrfToken = screen.getByRole('button', { name: /sign in/i })
        .closest('form')
        ?.querySelector('input[name="csrfToken"]');

      expect(csrfToken).toBeInTheDocument();
      expect(csrfToken).toHaveAttribute('type', 'hidden');
    });

    it('should enforce password requirements', async () => {
      renderLoginPage();
      
      // Try weak password
      await userEvent.type(
        screen.getByLabelText(/password/i),
        'weak'
      );

      // Move focus to trigger validation
      await userEvent.tab();

      // Verify error message
      expect(await screen.findByText(/password must be at least 8 characters/i))
        .toBeInTheDocument();
    });

    it('should sanitize input data', async () => {
      renderLoginPage();
      mockSecureLogin.mockResolvedValueOnce(undefined);

      // Try XSS attack
      const maliciousEmail = '<script>alert("xss")</script>@example.com';
      await userEvent.type(
        screen.getByLabelText(/email/i),
        maliciousEmail
      );
      await userEvent.type(
        screen.getByLabelText(/password/i),
        validCredentials.password
      );

      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify sanitized input
      await waitFor(() => {
        expect(mockSecureLogin).toHaveBeenCalledWith(
          expect.objectContaining({
            email: expect.not.stringContaining('<script>')
          })
        );
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate email format', async () => {
      renderLoginPage();
      
      await userEvent.type(
        screen.getByLabelText(/email/i),
        'invalid-email'
      );
      await userEvent.tab();

      expect(await screen.findByText(/please enter a valid email address/i))
        .toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      renderLoginPage();
      
      // Submit empty form
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      // Verify required field errors
      expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
      expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    });
  });
});