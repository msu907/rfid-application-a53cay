import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import AssetCard from '../../../components/assets/AssetCard';
import { Asset, AssetStatus } from '../../../types/asset.types';
import { useAsset } from '../../../hooks/useAsset';
import { useWebSocket } from '../../../hooks/useWebSocket';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock hooks
jest.mock('../../../hooks/useAsset');
jest.mock('../../../hooks/useWebSocket');
jest.mock('date-fns', () => ({
  format: jest.fn((date, format) => '2 hours ago')
}));

// Helper function to create mock asset data
const createMockAsset = (overrides?: Partial<Asset>): Asset => ({
  id: 'test-asset-123',
  rfidTag: 'RF123456789',
  name: 'Test Asset',
  description: 'Test asset description',
  imageUrl: '/assets/test-image.jpg',
  status: AssetStatus.ACTIVE,
  locationId: 'loc-123',
  location: {
    id: 'loc-123',
    name: 'Test Location',
    zone: 'Zone A',
    coordinates: { latitude: 0, longitude: 0 },
    annotation: 'Test annotation',
    active: true,
    capacity: 100,
    parentId: null,
    type: 'ZONE'
  },
  lastReadTime: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// Helper function to render component with providers
const renderAssetCard = (props: {
  asset: Asset;
  className?: string;
  onClick?: (asset: Asset) => void;
  interactive?: boolean;
  showDetails?: boolean;
  animateChanges?: boolean;
  testId?: string;
}) => {
  return render(<AssetCard {...props} />);
};

describe('AssetCard Component', () => {
  // Mock hook implementations
  beforeEach(() => {
    (useAsset as jest.Mock).mockImplementation(() => ({
      updateAsset: jest.fn(),
      loadingStates: { update: false },
      errorStates: { update: null }
    }));

    (useWebSocket as jest.Mock).mockImplementation(() => ({
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      isConnected: true,
      data: null
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Visual Rendering', () => {
    it('renders with all asset information correctly', () => {
      const asset = createMockAsset();
      renderAssetCard({ asset });

      expect(screen.getByText(asset.name)).toBeInTheDocument();
      expect(screen.getByText(asset.status)).toBeInTheDocument();
      expect(screen.getByText(asset.location.name)).toBeInTheDocument();
      expect(screen.getByAltText(`${asset.name} asset`)).toBeInTheDocument();
    });

    it('applies proper spacing and layout based on 8px grid system', () => {
      const asset = createMockAsset();
      const { container } = renderAssetCard({ asset });
      
      const card = container.firstChild as HTMLElement;
      const computedStyle = window.getComputedStyle(card);
      
      expect(computedStyle.padding).toBe('16px'); // 8px * 2
      expect(computedStyle.marginBottom).toBe('16px'); // 8px * 2
    });

    it('displays status indicator with correct color', () => {
      const asset = createMockAsset({ status: AssetStatus.ACTIVE });
      renderAssetCard({ asset });

      const statusDot = screen.getByLabelText(`Status: ${asset.status}`);
      expect(statusDot).toHaveClass('bg-green-500');
    });

    it('handles missing image with fallback', async () => {
      const asset = createMockAsset({ imageUrl: null });
      renderAssetCard({ asset });

      const img = screen.getByAltText(`${asset.name} asset`) as HTMLImageElement;
      fireEvent.error(img);

      await waitFor(() => {
        expect(img.src).toContain('/assets/images/placeholder.png');
      });
    });
  });

  describe('Interactive Behavior', () => {
    it('responds to click events when interactive', async () => {
      const onClick = jest.fn();
      const asset = createMockAsset();
      renderAssetCard({ asset, interactive: true, onClick });

      const card = screen.getByRole('article');
      await userEvent.click(card);

      expect(onClick).toHaveBeenCalledWith(asset);
    });

    it('handles keyboard navigation correctly', async () => {
      const onClick = jest.fn();
      const asset = createMockAsset();
      renderAssetCard({ asset, interactive: true, onClick });

      const card = screen.getByRole('article');
      card.focus();
      await userEvent.keyboard('{Enter}');

      expect(onClick).toHaveBeenCalledWith(asset);
    });

    it('shows hover state with proper styling', async () => {
      const asset = createMockAsset();
      renderAssetCard({ asset, interactive: true });

      const card = screen.getByRole('article');
      await userEvent.hover(card);

      expect(card).toHaveClass('asset-card--interactive');
    });
  });

  describe('Real-time Updates', () => {
    it('updates status indicator in real-time', async () => {
      const asset = createMockAsset();
      const { rerender } = renderAssetCard({ asset });

      const updatedAsset = {
        ...asset,
        status: AssetStatus.MAINTENANCE
      };

      rerender(<AssetCard asset={updatedAsset} />);

      await waitFor(() => {
        const statusDot = screen.getByLabelText(`Status: ${AssetStatus.MAINTENANCE}`);
        expect(statusDot).toHaveClass('bg-yellow-500');
      });
    });

    it('shows update animation on data change', async () => {
      const asset = createMockAsset();
      const { rerender } = renderAssetCard({ asset, animateChanges: true });

      const updatedAsset = {
        ...asset,
        location: { ...asset.location, name: 'New Location' }
      };

      rerender(<AssetCard asset={updatedAsset} />);

      const card = screen.getByRole('article');
      expect(card).toHaveClass('asset-card--animate');
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA requirements', async () => {
      const asset = createMockAsset();
      const { container } = renderAssetCard({ asset });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA labels', () => {
      const asset = createMockAsset();
      renderAssetCard({ asset });

      const card = screen.getByRole('article');
      expect(card).toHaveAttribute('aria-label', `Asset: ${asset.name}`);
    });

    it('maintains proper focus management', async () => {
      const asset = createMockAsset();
      renderAssetCard({ asset, interactive: true });

      const card = screen.getByRole('article');
      card.focus();

      expect(document.activeElement).toBe(card);
    });
  });

  describe('Error Handling', () => {
    it('displays error state appropriately', () => {
      const asset = createMockAsset();
      (useAsset as jest.Mock).mockImplementation(() => ({
        errorStates: { update: 'Failed to update asset' }
      }));

      renderAssetCard({ asset });
      expect(screen.getByText('Failed to update asset')).toBeInTheDocument();
    });

    it('maintains usability during error states', async () => {
      const asset = createMockAsset();
      const onClick = jest.fn();
      (useAsset as jest.Mock).mockImplementation(() => ({
        errorStates: { update: 'Error state' }
      }));

      renderAssetCard({ asset, interactive: true, onClick });

      const card = screen.getByRole('article');
      await userEvent.click(card);

      expect(onClick).toHaveBeenCalled();
    });
  });
});