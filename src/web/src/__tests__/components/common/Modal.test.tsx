import React from 'react';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import MatchMediaMock from 'jest-matchmedia-mock';
import Modal, { ModalProps } from '../../components/common/Modal';

// Initialize matchMedia mock
let matchMedia: MatchMediaMock;

// Default props for testing
const defaultProps: ModalProps = {
  isOpen: true,
  onClose: jest.fn(),
  title: 'Test Modal',
  children: <div>Modal Content</div>,
};

// Test setup and cleanup
describe('Modal Component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    matchMedia = new MatchMediaMock();
    user = userEvent.setup();
    document.body.style.overflow = '';
    jest.clearAllMocks();
  });

  afterEach(() => {
    matchMedia.clear();
    document.body.style.overflow = '';
  });

  // Rendering Tests
  describe('Rendering', () => {
    it('should render modal with correct structure when isOpen is true', () => {
      render(<Modal {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal Content')).toBeInTheDocument();
    });

    it('should not render modal content when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render with different sizes', () => {
      const sizes: Array<'xs' | 'small' | 'medium' | 'large' | 'xl'> = 
        ['xs', 'small', 'medium', 'large', 'xl'];
      
      sizes.forEach(size => {
        const { rerender } = render(<Modal {...defaultProps} size={size} />);
        expect(screen.getByRole('dialog')).toHaveClass(`modal--${size}`);
        rerender(<></>);
      });
    });

    it('should render footer content when provided', () => {
      const footerContent = <button>Save</button>;
      render(<Modal {...defaultProps} footer={footerContent} />);
      
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('should have correct ARIA attributes', () => {
      render(<Modal {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
    });

    it('should trap focus within modal when open', async () => {
      render(
        <Modal {...defaultProps}>
          <button>First</button>
          <button>Second</button>
          <button>Last</button>
        </Modal>
      );

      const buttons = screen.getAllByRole('button');
      const firstButton = buttons[0];
      const lastButton = buttons[buttons.length - 1];

      // Focus last button and press Tab
      lastButton.focus();
      await user.tab();
      expect(firstButton).toHaveFocus();

      // Focus first button and press Shift+Tab
      firstButton.focus();
      await user.tab({ shift: true });
      expect(lastButton).toHaveFocus();
    });

    it('should restore focus to trigger element when closed', async () => {
      const triggerButton = document.createElement('button');
      document.body.appendChild(triggerButton);
      triggerButton.focus();

      const { rerender } = render(<Modal {...defaultProps} />);
      
      // Close modal
      rerender(<Modal {...defaultProps} isOpen={false} />);
      
      await waitFor(() => {
        expect(triggerButton).toHaveFocus();
      });

      document.body.removeChild(triggerButton);
    });
  });

  // User Interaction Tests
  describe('User Interactions', () => {
    it('should close on overlay click when closeOnOverlayClick is true', async () => {
      render(<Modal {...defaultProps} closeOnOverlayClick={true} />);
      
      const overlay = screen.getByRole('dialog').parentElement;
      await user.click(overlay!);
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should not close on overlay click when closeOnOverlayClick is false', async () => {
      render(<Modal {...defaultProps} closeOnOverlayClick={false} />);
      
      const overlay = screen.getByRole('dialog').parentElement;
      await user.click(overlay!);
      
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('should close on ESC key press', async () => {
      render(<Modal {...defaultProps} />);
      
      await user.keyboard('{Escape}');
      
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('should prevent body scroll when open', () => {
      render(<Modal {...defaultProps} />);
      
      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  // Animation Tests
  describe('Animations', () => {
    it('should apply enter animation classes on open', () => {
      render(<Modal {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('modal-enter');
    });

    it('should apply exit animation classes on close', async () => {
      const { rerender } = render(<Modal {...defaultProps} />);
      
      rerender(<Modal {...defaultProps} isOpen={false} />);
      
      const overlay = document.querySelector('.modal-overlay');
      expect(overlay).toHaveClass('modal-exit');
    });

    it('should complete animation before cleanup', async () => {
      const { rerender } = render(<Modal {...defaultProps} animationDuration={300} />);
      
      rerender(<Modal {...defaultProps} isOpen={false} />);
      
      // Modal should still be in DOM during animation
      expect(screen.queryByRole('dialog')).toBeInTheDocument();
      
      // Wait for animation to complete
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      }, { timeout: 400 });
    });
  });

  // Responsive Behavior Tests
  describe('Responsive Behavior', () => {
    it('should adjust size based on viewport width', () => {
      // Mock mobile viewport
      matchMedia.useMediaQuery('(max-width: 768px)');
      const { rerender } = render(<Modal {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toHaveClass('modal--medium');
      
      // Mock desktop viewport
      matchMedia.useMediaQuery('(min-width: 1024px)');
      rerender(<Modal {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toHaveClass('modal--medium');
    });

    it('should handle touch events on mobile devices', async () => {
      matchMedia.useMediaQuery('(hover: none) and (pointer: coarse)');
      render(<Modal {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      fireEvent.touchStart(dialog);
      fireEvent.touchEnd(dialog);
      
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });
});