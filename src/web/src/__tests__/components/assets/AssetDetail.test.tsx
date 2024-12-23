import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

import AssetDetail from '../../../components/assets/AssetDetail';
import { Asset, AssetStatus } from '../../../types/asset.types';
import { useAsset } from '../../../hooks/useAsset';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { useAuth } from '../../../hooks/useAuth';
import { Permission } from '../../../types/auth.types';

// Mock hooks
vi.mock('../../../hooks/useAsset');
vi.mock('../../../hooks/useWebSocket');
vi.mock('../../../hooks/useAuth');
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'test-asset-1' }),
  useNavigate: () => vi.fn()
}));

// Mock data
const mockAsset: Asset = {
  id: 'test-asset-1',
  rfidTag: 'RF001',
  name: 'Test Asset',
  description: 'Test asset description',
  imageUrl: '/test-image.jpg',
  status: AssetStatus.ACTIVE,
  locationId: 'loc-1',
  location: {
    id: 'loc-1',
    name: 'Test Location',
    zone: 'Zone A-1',
    coordinates: { latitude: 0, longitude: 0 },
    annotation: '',
    active: true,
    capacity: 100,
    parentId: null,
    type: 'ZONE'
  },
  lastReadTime: new Date('2023-01-01T00:00:00Z'),
  createdAt: new Date('2023-01-01T00:00:00Z'),
  updatedAt: new Date('2023-01-01T00:00:00Z'),
  locationHistory: [
    {
      timestamp: new Date('2023-01-01T00:00:00Z'),
      locationId: 'loc-1',
      location: {
        id: 'loc-1',
        name: 'Test Location',
        zone: 'Zone A-1',
        coordinates: { latitude: 0, longitude: 0 },
        annotation: '',
        active: true,
        capacity: 100,
        parentId: null,
        type: 'ZONE'
      },
      readerId: 'reader-1',
      signalStrength: -50,
      duration: 3600
    }
  ]
};

describe('AssetDetail', () => {
  // Setup before each test
  beforeEach(() => {
    // Mock useAsset hook
    (useAsset as jest.Mock).mockReturnValue({
      getAssetById: vi.fn().mockResolvedValue(mockAsset),
      updateAsset: vi.fn().mockResolvedValue(mockAsset),
      deleteAsset: vi.fn().mockResolvedValue(undefined),
      uploadAssetImage: vi.fn().mockResolvedValue({ data: { imageUrl: '/new-image.jpg' }}),
      loadingStates: { fetchOne: false, update: false, delete: false, upload: false },
      errorStates: { fetchOne: null, update: null, delete: null, upload: null }
    });

    // Mock useWebSocket hook
    (useWebSocket as jest.Mock).mockReturnValue({
      isConnected: true,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      data: null
    });

    // Mock useAuth hook with full permissions
    (useAuth as jest.Mock).mockReturnValue({
      checkPermission: (permission: Permission) => true
    });
  });

  // Test initial rendering
  it('renders asset details correctly', async () => {
    render(<AssetDetail onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Asset Details: Test Asset')).toBeInTheDocument();
      expect(screen.getByText('RF001')).toBeInTheDocument();
      expect(screen.getByText('Test Location')).toBeInTheDocument();
      expect(screen.getByText('Test asset description')).toBeInTheDocument();
    });
  });

  // Test loading state
  it('displays loading state', () => {
    (useAsset as jest.Mock).mockReturnValue({
      ...useAsset(),
      loadingStates: { fetchOne: true }
    });

    render(<AssetDetail onBack={vi.fn()} />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  // Test error state
  it('displays error message when asset fetch fails', async () => {
    (useAsset as jest.Mock).mockReturnValue({
      ...useAsset(),
      errorStates: { fetchOne: 'Failed to fetch asset' }
    });

    render(<AssetDetail onBack={vi.fn()} />);
    expect(await screen.findByText('Failed to fetch asset')).toBeInTheDocument();
  });

  // Test image upload
  it('handles image upload correctly', async () => {
    const { getAssetById, uploadAssetImage } = useAsset();
    render(<AssetDetail onBack={vi.fn()} />);

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText(/upload image/i);

    await userEvent.upload(input, file);

    expect(uploadAssetImage).toHaveBeenCalledWith('test-asset-1', file);
    expect(getAssetById).toHaveBeenCalledWith('test-asset-1');
  });

  // Test delete functionality
  it('handles asset deletion with confirmation', async () => {
    const { deleteAsset } = useAsset();
    const onBack = vi.fn();
    render(<AssetDetail onBack={onBack} />);

    // Click delete button
    const deleteButton = await screen.findByRole('button', { name: /delete asset/i });
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /delete$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteAsset).toHaveBeenCalledWith('test-asset-1');
      expect(onBack).toHaveBeenCalled();
    });
  });

  // Test real-time updates
  it('handles real-time updates correctly', async () => {
    const { subscribe, unsubscribe } = useWebSocket();
    render(<AssetDetail onBack={vi.fn()} />);

    await waitFor(() => {
      expect(subscribe).toHaveBeenCalled();
    });

    // Cleanup
    expect(unsubscribe).not.toHaveBeenCalled();
    cleanup();
    expect(unsubscribe).toHaveBeenCalled();
  });

  // Test permission-based rendering
  it('conditionally renders actions based on permissions', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      checkPermission: (permission: Permission) => permission === Permission.READ_ASSETS
    });

    render(<AssetDetail onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /edit asset/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /delete asset/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/upload image/i)).not.toBeInTheDocument();
    });
  });

  // Test location history export
  it('handles location history export', async () => {
    render(<AssetDetail onBack={vi.fn()} />);

    const exportButton = await screen.findByRole('button', { name: /export csv/i });
    
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockUrl = 'blob:test';
    global.URL.createObjectURL = vi.fn(() => mockUrl);
    global.URL.revokeObjectURL = vi.fn();

    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
    });
  });

  // Test accessibility
  it('meets accessibility standards', async () => {
    const { container } = render(<AssetDetail onBack={vi.fn()} />);
    expect(await toHaveNoViolations(container)).toBeTruthy();
  });
});