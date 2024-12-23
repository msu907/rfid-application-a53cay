import React, { useRef, useEffect, useCallback } from 'react';
import classNames from 'classnames'; // ^2.3.1
import { Portal } from '@mui/base'; // ^5.0.0
import Button, { ButtonProps } from './Button';
import '../../styles/components/_modal.scss';

// Modal Props Interface
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'xs' | 'small' | 'medium' | 'large' | 'xl';
  className?: string;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  footer?: React.ReactNode;
  animationDuration?: number;
  initialFocusRef?: React.RefObject<HTMLElement>;
  ariaDescribedBy?: string;
  ariaLabelledBy?: string;
}

// Custom hook for focus trap management
const useFocusTrap = (
  isOpen: boolean,
  modalRef: React.RefObject<HTMLDivElement>,
  initialFocusRef?: React.RefObject<HTMLElement>
) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Set initial focus
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    } else {
      // Restore focus when modal closes
      previousActiveElement.current?.focus();
    }

    return () => {
      previousActiveElement.current?.focus();
    };
  }, [isOpen, initialFocusRef]);

  // Handle tab key navigation
  const handleTabKey = useCallback((e: KeyboardEvent) => {
    if (!modalRef.current || !isOpen) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }
  }, [isOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleTabKey);
    return () => document.removeEventListener('keydown', handleTabKey);
  }, [handleTabKey]);
};

// Custom hook for animation management
const useModalAnimation = (isOpen: boolean, duration: number = 300) => {
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsAnimating(true);
    } else {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsAnimating(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration]);

  const animationClasses = classNames({
    'modal-enter': isOpen && isAnimating,
    'modal-enter-active': isOpen && !isAnimating,
    'modal-exit': !isOpen && isAnimating,
    'modal-exit-active': !isOpen && !isAnimating,
  });

  return { shouldRender, animationClasses };
};

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  className,
  showCloseButton = true,
  closeOnOverlayClick = true,
  footer,
  animationDuration = 300,
  initialFocusRef,
  ariaDescribedBy,
  ariaLabelledBy,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).substr(2, 9)}`);
  const { shouldRender, animationClasses } = useModalAnimation(isOpen, animationDuration);

  // Set up focus trap
  useFocusTrap(isOpen, modalRef, initialFocusRef);

  // Handle escape key press
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Prevent scroll on body when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!shouldRender) return null;

  return (
    <Portal>
      <div
        className={classNames(
          'modal-overlay',
          animationClasses,
          className
        )}
        onClick={handleOverlayClick}
        aria-hidden="true"
      >
        <div
          ref={modalRef}
          className={classNames('modal', `modal--${size}`, animationClasses)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy || titleId.current}
          aria-describedby={ariaDescribedBy}
        >
          <header className="modal__header">
            <h2 id={titleId.current} className="modal__title">
              {title}
            </h2>
            {showCloseButton && (
              <Button
                variant="text"
                size="small"
                onClick={onClose}
                ariaLabel="Close modal"
                className="modal__close-button"
              >
                ×
              </Button>
            )}
          </header>
          
          <div className="modal__content">
            {children}
          </div>

          {footer && (
            <footer className="modal__footer">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default Modal;