import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Layout from '../components/common/Layout';
import Button from '../components/common/Button';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { addNotification } from '../redux/slices/uiSlice';

/**
 * Enhanced 404 error page component with analytics tracking, accessibility features,
 * and proper error boundary integration.
 */
const NotFoundPage: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  /**
   * Handles navigation back to dashboard with error tracking
   */
  const handleReturn = useCallback(() => {
    // Track 404 occurrence
    dispatch(addNotification({
      type: 'warning',
      message: `Page not found: ${window.location.pathname}`,
      duration: 5000,
      priority: 2
    }));

    // Navigate to dashboard
    navigate('/dashboard');
  }, [navigate, dispatch]);

  return (
    <ErrorBoundary>
      <Layout>
        <div className="not-found-container">
          <div className="not-found-content" role="alert" aria-live="polite">
            <h1 className="not-found-title">
              404 - Page Not Found
            </h1>
            
            <p className="not-found-message">
              The page you're looking for doesn't exist or has been moved.
              Please check the URL or return to the dashboard.
            </p>

            <Button
              variant="primary"
              size="large"
              onClick={handleReturn}
              ariaLabel="Return to dashboard"
              className="not-found-button"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>

        <style jsx>{`
          .not-found-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: calc(100vh - 64px);
            padding: 24px;
            margin: 0 auto;
            max-width: 600px;
          }

          .not-found-content {
            text-align: center;
            animation: fadeIn 0.3s ease-in-out;
          }

          .not-found-title {
            font-size: clamp(32px, 5vw, 48px);
            font-weight: bold;
            margin-bottom: 16px;
            color: var(--text-primary);
          }

          .not-found-message {
            font-size: clamp(16px, 2.5vw, 18px);
            margin-bottom: 32px;
            color: var(--text-secondary);
            line-height: 1.5;
          }

          .not-found-button {
            margin-top: 16px;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @media (max-width: 768px) {
            .not-found-container {
              padding: 16px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .not-found-content {
              animation: none;
            }
          }
        `}</style>
      </Layout>
    </ErrorBoundary>
  );
});

NotFoundPage.displayName = 'NotFoundPage';

export default NotFoundPage;