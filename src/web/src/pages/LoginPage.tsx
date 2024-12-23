import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form'; // ^7.0.0
import * as yup from 'yup'; // ^3.0.0
import { yupResolver } from '@hookform/resolvers/yup'; // ^3.0.0
import DOMPurify from 'dompurify'; // ^2.4.0
import { useAuth } from '../hooks/useAuth';
import Button from '../components/common/Button';
import AuthLayout from '../layouts/AuthLayout';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Interface for form data with validation
interface LoginFormData {
  email: string;
  password: string;
  csrfToken: string;
}

// Validation schema following security requirements
const validationSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Please enter a valid email address')
    .transform(value => value.toLowerCase()),
  password: yup
    .string()
    .required('Password is required')
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    ),
  csrfToken: yup
    .string()
    .required('Security token is missing')
});

/**
 * Secure login page component implementing JWT-based Auth0 authentication
 * with comprehensive form validation and security controls.
 */
const LoginPage: React.FC = () => {
  // Get authentication methods and state from useAuth hook
  const { secureLogin, loading, error, securityContext } = useAuth();
  
  // Initialize CSRF token
  const [csrfToken, setCsrfToken] = useState<string>('');

  // Initialize form with validation schema
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm<LoginFormData>({
    resolver: yupResolver(validationSchema),
    mode: 'onBlur'
  });

  // Generate CSRF token on component mount
  useEffect(() => {
    const generateToken = () => {
      const token = crypto.randomUUID();
      setCsrfToken(token);
      return token;
    };
    generateToken();
  }, []);

  // Check for account lockout
  const isLocked = securityContext?.lockoutUntil && 
    new Date() < new Date(securityContext.lockoutUntil);

  // Handle form submission with security measures
  const onSubmit = useCallback(async (data: LoginFormData) => {
    try {
      // Verify CSRF token
      if (data.csrfToken !== csrfToken) {
        setError('root', { 
          message: 'Invalid security token. Please refresh the page.' 
        });
        return;
      }

      // Check for account lockout
      if (isLocked) {
        setError('root', { 
          message: 'Account is temporarily locked. Please try again later.' 
        });
        return;
      }

      // Sanitize input data
      const sanitizedData = {
        email: DOMPurify.sanitize(data.email),
        password: data.password // Don't sanitize password to preserve special characters
      };

      // Attempt login
      await secureLogin(sanitizedData);

    } catch (err) {
      console.error('Login error:', err);
      setError('root', { 
        message: 'An error occurred during login. Please try again.' 
      });
    }
  }, [csrfToken, isLocked, secureLogin, setError]);

  return (
    <ErrorBoundary>
      <AuthLayout>
        <div className="login-container">
          <h1 className="text-2xl font-bold mb-6 text-center">
            Sign In to RFID Asset Tracking
          </h1>

          <form 
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6"
            noValidate
            aria-label="Login form"
          >
            {/* Hidden CSRF Token */}
            <input 
              type="hidden" 
              {...register('csrfToken')}
              value={csrfToken}
            />

            {/* Email Field */}
            <div className="form-group">
              <label 
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm
                  ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                {...register('email')}
                aria-invalid={errors.email ? 'true' : 'false'}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
              {errors.email && (
                <p 
                  id="email-error" 
                  className="mt-1 text-sm text-red-600"
                  role="alert"
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="form-group">
              <label 
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm
                  ${errors.password ? 'border-red-500' : 'border-gray-300'}`}
                {...register('password')}
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
              {errors.password && (
                <p 
                  id="password-error" 
                  className="mt-1 text-sm text-red-600"
                  role="alert"
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Error Messages */}
            {(error || errors.root) && (
              <div 
                className="p-3 bg-red-100 border border-red-400 rounded"
                role="alert"
              >
                <p className="text-sm text-red-700">
                  {errors.root?.message || error}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={loading}
              disabled={loading || isLocked}
              aria-label="Sign in to your account"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Account Lockout Message */}
          {isLocked && (
            <div 
              className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded"
              role="alert"
            >
              <p className="text-sm text-yellow-700">
                Account is temporarily locked due to multiple failed attempts.
                Please try again later.
              </p>
            </div>
          )}
        </div>
      </AuthLayout>
    </ErrorBoundary>
  );
};

export default LoginPage;