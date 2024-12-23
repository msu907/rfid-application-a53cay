import React from 'react'; // ^18.0.0
import classNames from 'classnames'; // ^2.3.2
import Card from '../components/common/Card';

/**
 * Props interface for the AuthLayout component
 */
interface AuthLayoutProps {
  /** Child components to render within the authentication card */
  children: React.ReactNode;
  /** Optional CSS class name for custom styling of the layout container */
  className?: string;
}

/**
 * Authentication layout component that provides a responsive, centered card layout
 * with consistent branding and security elements for the RFID Asset Tracking System.
 * Implements visual hierarchy and responsive design requirements.
 *
 * @param {AuthLayoutProps} props - Component props
 * @returns {JSX.Element} Rendered authentication layout
 */
const AuthLayout: React.FC<AuthLayoutProps> = ({ children, className }) => {
  // Combine container classes
  const containerClasses = classNames(
    'auth-layout',
    'min-h-screen',
    'flex',
    'items-center',
    'justify-center',
    'bg-cover',
    'bg-center',
    'px-4',
    'sm:px-6',
    'md:px-8',
    className
  );

  // Card container classes for proper spacing and width constraints
  const cardContainerClasses = classNames(
    'w-full',
    'max-w-[320px]',
    'sm:max-w-[400px]',
    'mx-auto'
  );

  return (
    <div 
      className={containerClasses}
      style={{
        backgroundImage: 'url("/assets/images/login-bg.jpg")',
      }}
    >
      <div className={cardContainerClasses}>
        {/* Company branding */}
        <div className="flex justify-center mb-6">
          <img
            src="/assets/images/logo.svg"
            alt="RFID Asset Tracking System"
            className="w-[100px] h-auto sm:w-[120px]"
          />
        </div>

        {/* Authentication card with elevation */}
        <Card
          elevation="medium"
          className="bg-white rounded-lg p-6 sm:p-8"
          role="main"
          aria-label="Authentication form"
        >
          {/* Security badge for trust indication */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center text-sm text-gray-600">
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span>Secure Authentication</span>
            </div>
          </div>

          {/* Main content area */}
          <div className="space-y-6">
            {children}
          </div>

          {/* Footer with additional security information */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-center text-xs text-gray-600">
              Protected by enterprise-grade security
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AuthLayout;