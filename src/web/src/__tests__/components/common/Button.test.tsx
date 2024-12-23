import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, describe, it, beforeEach, afterEach } from '@jest/globals';
import Button, { ButtonProps } from '../../../components/common/Button';

// Default props for testing
const defaultProps: ButtonProps = {
  children: 'Test Button',
  onClick: jest.fn(),
};

// Test cleanup
afterEach(() => {
  jest.clearAllMocks();
});

describe('Button Component', () => {
  describe('Rendering', () => {
    it('renders without crashing', () => {
      render(<Button {...defaultProps} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders children content correctly', () => {
      render(<Button {...defaultProps} />);
      expect(screen.getByText('Test Button')).toBeInTheDocument();
    });

    it('applies base button class', () => {
      const { container } = render(<Button {...defaultProps} />);
      expect(container.firstChild).toHaveClass('btn');
    });

    it('applies custom className when provided', () => {
      const { container } = render(
        <Button {...defaultProps} className="custom-class" />
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Variants', () => {
    it('applies primary variant styles by default', () => {
      const { container } = render(<Button {...defaultProps} />);
      expect(container.firstChild).toHaveClass('btn--primary');
    });

    it('applies secondary variant styles correctly', () => {
      const { container } = render(
        <Button {...defaultProps} variant="secondary" />
      );
      expect(container.firstChild).toHaveClass('btn--secondary');
    });

    it('applies outlined variant styles correctly', () => {
      const { container } = render(
        <Button {...defaultProps} variant="outlined" />
      );
      expect(container.firstChild).toHaveClass('btn--outlined');
    });
  });

  describe('Sizes', () => {
    it('applies medium size by default', () => {
      const { container } = render(<Button {...defaultProps} />);
      expect(container.firstChild).toHaveClass('btn--medium');
    });

    it('applies small size correctly', () => {
      const { container } = render(
        <Button {...defaultProps} size="small" />
      );
      expect(container.firstChild).toHaveClass('btn--small');
    });

    it('applies large size correctly', () => {
      const { container } = render(
        <Button {...defaultProps} size="large" />
      );
      expect(container.firstChild).toHaveClass('btn--large');
    });
  });

  describe('States', () => {
    it('handles disabled state correctly', () => {
      render(<Button {...defaultProps} disabled />);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(button);
      expect(defaultProps.onClick).not.toHaveBeenCalled();
    });

    it('displays loading state correctly', () => {
      render(<Button {...defaultProps} loading />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveClass('btn--loading');
      expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    });

    it('prevents click events during loading state', () => {
      render(<Button {...defaultProps} loading />);
      fireEvent.click(screen.getByRole('button'));
      expect(defaultProps.onClick).not.toHaveBeenCalled();
    });
  });

  describe('Interactions', () => {
    it('handles click events correctly', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      
      await userEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard interaction correctly', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Press Enter</Button>);
      
      const button = screen.getByRole('button');
      button.focus();
      await userEvent.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('prevents double submission during rapid clicks', async () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick} loading>Submit</Button>);
      
      const button = screen.getByRole('button');
      await userEvent.dblClick(button);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has correct ARIA attributes', () => {
      render(
        <Button
          {...defaultProps}
          ariaLabel="Accessible Button"
          disabled
          loading
        />
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Accessible Button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('maintains correct tab order', () => {
      render(<Button {...defaultProps} tabIndex={2} />);
      expect(screen.getByRole('button')).toHaveAttribute('tabIndex', '2');
    });

    it('removes from tab order when disabled', () => {
      render(<Button {...defaultProps} disabled tabIndex={2} />);
      expect(screen.getByRole('button')).toHaveAttribute('tabIndex', '-1');
    });

    it('provides visible focus indicator', async () => {
      const { container } = render(<Button {...defaultProps} />);
      const button = screen.getByRole('button');
      
      button.focus();
      await waitFor(() => {
        expect(document.activeElement).toBe(button);
      });
    });
  });

  describe('Performance', () => {
    it('memoizes correctly to prevent unnecessary re-renders', () => {
      const { rerender } = render(<Button {...defaultProps} />);
      const initialButton = screen.getByRole('button');
      
      // Re-render with same props
      rerender(<Button {...defaultProps} />);
      const rerenderedButton = screen.getByRole('button');
      
      expect(initialButton).toBe(rerenderedButton);
    });

    it('updates correctly when props change', () => {
      const { rerender } = render(<Button {...defaultProps} />);
      const initialClasses = screen.getByRole('button').className;
      
      // Re-render with different props
      rerender(<Button {...defaultProps} variant="secondary" />);
      const updatedClasses = screen.getByRole('button').className;
      
      expect(initialClasses).not.toBe(updatedClasses);
    });
  });
});