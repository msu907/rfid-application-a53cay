/**
 * AssetDetail Component
 * Displays detailed information about a single asset with real-time updates,
 * image management, and location history tracking.
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react'; // ^18.2.0
import { useParams } from 'react-router-dom'; // ^6.11.2
import { format } from 'date-fns'; // ^2.29.3
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Dialog,
  IconButton,
  Tooltip
} from '@mui/material'; // ^5.13.0
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material'; // ^5.13.0

import { Asset, AssetStatus, ASSET_STATUS_LABELS } from '../../types/asset.types';
import { useAsset } from '../../hooks/useAsset';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useAuth } from '../../hooks/useAuth';
import { Permission } from '../../types/auth.types';

// Constants
const IMAGE_UPLOAD_MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';

interface AssetDetailProps {
  className?: string;
  onBack: () => void;
  onUpdate?: (asset: Asset) => void;
}

export const AssetDetail: React.FC<AssetDetailProps> = ({
  className,
  onBack,
  onUpdate
}) => {
  // Get asset ID from URL params
  const { id } = useParams<{ id: string }>();

  // State management
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Custom hooks
  const { getAssetById, updateAsset, deleteAsset, uploadAssetImage } = useAsset();
  const { isConnected: wsConnected, subscribe, unsubscribe } = useWebSocket('assets');
  const { checkPermission } = useAuth();

  // Permission checks
  const canEdit = checkPermission(Permission.WRITE_ASSETS);
  const canDelete = checkPermission(Permission.WRITE_ASSETS);

  /**
   * Fetches asset data and initializes real-time updates
   */
  useEffect(() => {
    const fetchAsset = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const assetData = await getAssetById(id);
        setAsset(assetData);
        
        // Subscribe to real-time updates
        if (wsConnected) {
          subscribe();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch asset');
      } finally {
        setLoading(false);
      }
    };

    fetchAsset();

    // Cleanup subscription
    return () => {
      if (wsConnected) {
        unsubscribe();
      }
    };
  }, [id, getAssetById, wsConnected, subscribe, unsubscribe]);

  /**
   * Handles asset image upload with validation and optimization
   */
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !id) return;

    // Validate file type and size
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
      return;
    }

    if (file.size > IMAGE_UPLOAD_MAX_SIZE) {
      setError('File size exceeds 5MB limit.');
      return;
    }

    try {
      setUploadProgress(0);
      const response = await uploadAssetImage(id, file);
      
      setAsset(prev => prev ? {
        ...prev,
        imageUrl: response.data.imageUrl
      } : null);
      
      onUpdate?.(asset as Asset);
      setUploadProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadProgress(0);
    }
  }, [id, uploadAssetImage, onUpdate, asset]);

  /**
   * Handles asset deletion with confirmation
   */
  const handleDelete = useCallback(async () => {
    if (!id || !asset) return;

    try {
      await deleteAsset(id);
      setDeleteDialogOpen(false);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete asset');
    }
  }, [id, asset, deleteAsset, onBack]);

  /**
   * Exports asset location history to CSV
   */
  const handleExportHistory = useCallback(() => {
    if (!asset?.locationHistory) return;

    const headers = ['Timestamp', 'Location', 'Reader', 'Duration'];
    const rows = asset.locationHistory.map(history => [
      format(new Date(history.timestamp), DATE_FORMAT),
      history.location.name,
      history.readerId,
      `${history.duration} seconds`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `asset_${asset.id}_history.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  }, [asset]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!asset) {
    return <Alert severity="warning">Asset not found</Alert>;
  }

  return (
    <Box className={className}>
      {/* Header */}
      <Box display="flex" alignItems="center" mb={3}>
        <IconButton onClick={onBack}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" ml={2}>
          Asset Details: {asset.name}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Asset Image and Details */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardMedia
              component="img"
              height="300"
              image={asset.imageUrl || '/assets/images/placeholder.png'}
              alt={asset.name}
            />
            {canEdit && (
              <Box p={2}>
                <input
                  type="file"
                  accept={ALLOWED_IMAGE_TYPES.join(',')}
                  style={{ display: 'none' }}
                  id="image-upload"
                  onChange={handleImageUpload}
                />
                <label htmlFor="image-upload">
                  <Button
                    variant="contained"
                    component="span"
                    startIcon={<UploadIcon />}
                    fullWidth
                  >
                    Upload Image
                  </Button>
                </label>
                {uploadProgress > 0 && (
                  <Box mt={1}>
                    <CircularProgress variant="determinate" value={uploadProgress} />
                  </Box>
                )}
              </Box>
            )}
          </Card>
        </Grid>

        {/* Asset Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" mb={2}>
                <Typography variant="h6">Details</Typography>
                {canEdit && (
                  <Box>
                    <Tooltip title="Edit Asset">
                      <IconButton onClick={() => setIsEditing(true)}>
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    {canDelete && (
                      <Tooltip title="Delete Asset">
                        <IconButton onClick={() => setDeleteDialogOpen(true)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                )}
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">RFID Tag</Typography>
                  <Typography>{asset.rfidTag}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Status</Typography>
                  <Typography>{ASSET_STATUS_LABELS[asset.status]}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Description</Typography>
                  <Typography>{asset.description || 'No description'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Current Location</Typography>
                  <Typography>{asset.location.name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2">Last Read</Typography>
                  <Typography>
                    {asset.lastReadTime
                      ? format(new Date(asset.lastReadTime), DATE_FORMAT)
                      : 'Never'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Location History */}
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" mb={2}>
                <Typography variant="h6">Location History</Typography>
                <Button
                  startIcon={<DownloadIcon />}
                  onClick={handleExportHistory}
                >
                  Export CSV
                </Button>
              </Box>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Reader</TableCell>
                    <TableCell>Duration</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {asset.locationHistory?.map((history, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {format(new Date(history.timestamp), DATE_FORMAT)}
                      </TableCell>
                      <TableCell>{history.location.name}</TableCell>
                      <TableCell>{history.readerId}</TableCell>
                      <TableCell>{history.duration} seconds</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <Box p={3}>
          <Typography variant="h6" mb={2}>
            Confirm Delete
          </Typography>
          <Typography mb={3}>
            Are you sure you want to delete this asset? This action cannot be undone.
          </Typography>
          <Box display="flex" justifyContent="flex-end" gap={1}>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Dialog>
    </Box>
  );
};

export default AssetDetail;