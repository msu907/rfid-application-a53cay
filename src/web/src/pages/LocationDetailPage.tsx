import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Permission } from '../types/auth.types';
import { Location } from '../../types/location.types';
import LocationDetail from '../components/locations/LocationDetail';
import MainLayout from '../layouts/MainLayout';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { Toast } from '../components/common/Toast';

/**
 * LocationDetailPage component displays comprehensive information about a specific location
 * with real-time updates, error handling, and accessibility features.
 */
const LocationDetailPage: React.FC = React.memo(() => {
  // Router hooks
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Auth hook for permission checking
  const { checkPermission } = useAuth();

  // State management
  const [error, setError] = useState<Error | null>(null);

  /**
   * Handles navigation to location edit page
   * @param location - Location object to edit
   */
  const handleEdit = useCallback(async (location: Location) => {
    try {
      if (!checkPermission(Permission.WRITE_ASSETS)) {
        throw new Error('Insufficient permissions to edit location');
      }

      navigate(`/locations/${location.id}/edit`, {
        state: { location }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to navigate to edit page';
      setError(new Error(errorMessage));
      Toast.show({
        type: 'error',
        message: errorMessage,
        duration: 5000
      });
    }
  }, [navigate, checkPermission]);

  /**
   * Handles navigation to reader management page
   * @param locationId - ID of the location to add reader to
   */
  const handleAddReader = useCallback(async (locationId: string) => {
    try {
      if (!checkPermission(Permission.WRITE_ASSETS)) {
        throw new Error('Insufficient permissions to manage readers');
      }

      navigate(`/readers/new`, {
        state: { locationId }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to navigate to reader management';
      setError(new Error(errorMessage));
      Toast.show({
        type: 'error',
        message: errorMessage,
        duration: 5000
      });
    }
  }, [navigate, checkPermission]);

  /**
   * Handles errors from child components
   * @param error - Error object from child component
   */
  const handleError = useCallback((error: Error) => {
    setError(error);
    Toast.show({
      type: 'error',
      message: error.message,
      duration: 5000
    });
  }, []);

  // Update document title for accessibility
  useEffect(() => {
    document.title = 'Location Details - RFID Asset Tracking';
    return () => {
      document.title = 'RFID Asset Tracking';
    };
  }, []);

  return (
    <ErrorBoundary
      fallback={
        <MainLayout>
          <div role="alert" className="error-container">
            <h2>Error Loading Location Details</h2>
            <p>{error?.message || 'An unexpected error occurred'}</p>
            <button 
              onClick={() => navigate('/locations')}
              className="error-back-button"
            >
              Return to Locations
            </button>
          </div>
        </MainLayout>
      }
      onError={handleError}
    >
      <MainLayout>
        {/* Skip link for keyboard navigation */}
        <a 
          href="#location-detail"
          className="skip-link"
          style={{ 
            position: 'absolute',
            left: -9999,
            top: 'auto',
            width: 1,
            height: 1,
            overflow: 'hidden',
            ':focus': {
              position: 'fixed',
              top: 0,
              left: 0,
              width: 'auto',
              height: 'auto',
              padding: '1rem',
              background: '#fff',
              zIndex: 9999
            }
          }}
        >
          Skip to location details
        </a>

        {/* Main content */}
        <div 
          id="location-detail"
          role="main"
          aria-label="Location details"
        >
          <LocationDetail
            id={id}
            onEdit={handleEdit}
            onAddReader={handleAddReader}
            onError={handleError}
          />
        </div>

        {/* Live region for status updates */}
        <div
          aria-live="polite"
          aria-atomic="true"
          className="visually-hidden"
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}
        />
      </MainLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
LocationDetailPage.displayName = 'LocationDetailPage';

export default LocationDetailPage;