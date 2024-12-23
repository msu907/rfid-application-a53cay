import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Box, 
  Card, 
  CardContent, 
  Typography, 
  Button, 
  CircularProgress, 
  Alert, 
  TextField,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  Skeleton
} from '@mui/material'; // ^5.0.0
import { Edit as EditIcon, Add as AddIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { Location, LocationType } from '../../types/location.types';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../hooks/useAuth';
import { Permission } from '../../types/auth.types';

/**
 * Props interface for LocationDetail component
 */
interface LocationDetailProps {
  id?: string;
  onEdit: (location: Location) => Promise<void>;
  onAddReader: (locationId: string) => Promise<void>;
  onError: (error: Error) => void;
}

/**
 * LocationDetail component displays detailed information about a location
 * with real-time updates and accessibility features
 */
const LocationDetail: React.FC<LocationDetailProps> = ({
  id: propId,
  onEdit,
  onAddReader,
  onError
}) => {
  // URL parameter for location ID
  const { id: urlId } = useParams<{ id: string }>();
  const locationId = propId || urlId;

  // State management
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [annotation, setAnnotation] = useState('');

  // Refs for focus management
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const annotationInputRef = useRef<HTMLInputElement>(null);

  // Authentication and permissions
  const { checkPermission } = useAuth();
  const canEdit = checkPermission(Permission.WRITE_ASSETS);

  // WebSocket integration for real-time updates
  const {
    isConnected,
    data: wsData,
    error: wsError,
    subscribe,
    unsubscribe,
    connectionHealth
  } = useWebSocket(`location_${locationId}`, {
    autoConnect: true,
    enableCompression: true,
    heartbeatInterval: 30000
  });

  /**
   * Handles location data updates from WebSocket
   */
  useEffect(() => {
    if (wsData && 'location' in wsData) {
      setLocation(wsData.location as Location);
    }
  }, [wsData]);

  /**
   * Handles WebSocket errors
   */
  useEffect(() => {
    if (wsError) {
      setError(`Real-time update error: ${wsError.message}`);
      onError(new Error(wsError.message));
    }
  }, [wsError, onError]);

  /**
   * Manages WebSocket subscription
   */
  useEffect(() => {
    if (locationId) {
      subscribe();
      return () => {
        unsubscribe();
      };
    }
  }, [locationId, subscribe, unsubscribe]);

  /**
   * Handles edit mode toggling with accessibility focus management
   */
  const handleEditToggle = useCallback(() => {
    setIsEditing(prev => {
      const newState = !prev;
      if (newState) {
        // Focus annotation input when entering edit mode
        setTimeout(() => annotationInputRef.current?.focus(), 0);
      } else {
        // Return focus to edit button when exiting edit mode
        setTimeout(() => editButtonRef.current?.focus(), 0);
      }
      return newState;
    });
  }, []);

  /**
   * Handles annotation updates with optimistic UI updates
   */
  const handleAnnotationUpdate = async () => {
    if (!location) return;

    try {
      const updatedLocation = { ...location, annotation };
      await onEdit(updatedLocation);
      setLocation(updatedLocation);
      setIsEditing(false);
      editButtonRef.current?.focus();
    } catch (error) {
      setError(`Failed to update annotation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onError(error instanceof Error ? error : new Error('Failed to update annotation'));
    }
  };

  /**
   * Handles adding a new reader to the location
   */
  const handleAddReader = async () => {
    if (!locationId) return;

    try {
      await onAddReader(locationId);
    } catch (error) {
      setError(`Failed to add reader: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onError(error instanceof Error ? error : new Error('Failed to add reader'));
    }
  };

  /**
   * Renders loading skeleton
   */
  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="text" height={40} />
          <Skeleton variant="rectangular" height={100} />
          <Skeleton variant="text" height={30} />
          <Skeleton variant="text" height={30} />
        </CardContent>
      </Card>
    );
  }

  /**
   * Renders error state with retry option
   */
  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              setError(null);
              setLoading(true);
              subscribe();
            }}
          >
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  /**
   * Renders main location detail content
   */
  return (
    <ErrorBoundary
      fallback={
        <Alert severity="error">
          An error occurred while displaying location details.
          Please refresh the page.
        </Alert>
      }
      onError={onError}
    >
      <Card>
        <CardContent>
          <Grid container spacing={2}>
            {/* Location Header */}
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" component="h1">
                  {location?.name || 'Location Details'}
                </Typography>
                {!isConnected && (
                  <Tooltip title="Reconnecting to real-time updates">
                    <CircularProgress size={20} />
                  </Tooltip>
                )}
              </Box>
            </Grid>

            {/* Location Details */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Zone:</strong> {location?.zone}
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Type:</strong> {location?.type}
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Coordinates:</strong>{' '}
                {location?.coordinates ? (
                  `${location.coordinates.latitude}, ${location.coordinates.longitude}`
                ) : 'Not available'}
              </Typography>
            </Grid>

            {/* Location Status */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Status:</strong>{' '}
                <span style={{ color: location?.active ? 'green' : 'red' }}>
                  {location?.active ? 'Active' : 'Inactive'}
                </span>
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Last Updated:</strong>{' '}
                {connectionHealth.lastHeartbeat?.toLocaleString() || 'Never'}
              </Typography>
            </Grid>

            {/* Location Annotation */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="h6">Annotation</Typography>
                {canEdit && (
                  <IconButton
                    ref={editButtonRef}
                    onClick={handleEditToggle}
                    aria-label={isEditing ? "Cancel editing" : "Edit annotation"}
                    size="small"
                  >
                    <EditIcon />
                  </IconButton>
                )}
              </Box>
              {isEditing ? (
                <Box sx={{ mt: 1 }}>
                  <TextField
                    inputRef={annotationInputRef}
                    fullWidth
                    multiline
                    rows={3}
                    value={annotation}
                    onChange={(e) => setAnnotation(e.target.value)}
                    aria-label="Location annotation"
                  />
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <Button
                      variant="contained"
                      onClick={handleAnnotationUpdate}
                      disabled={!annotation}
                    >
                      Save
                    </Button>
                    <Button onClick={handleEditToggle}>
                      Cancel
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {location?.annotation || 'No annotation available'}
                </Typography>
              )}
            </Grid>

            {/* Action Buttons */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box display="flex" gap={1}>
                {canEdit && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddReader}
                    aria-label="Add new reader to location"
                  >
                    Add Reader
                  </Button>
                )}
                <Button
                  startIcon={<RefreshIcon />}
                  onClick={() => subscribe()}
                  aria-label="Refresh location data"
                >
                  Refresh
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </ErrorBoundary>
  );
};

export default LocationDetail;