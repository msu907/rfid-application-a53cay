/**
 * Enterprise-grade Notification component for the RFID Asset Tracking System.
 * Provides real-time notifications with accessibility support, animations,
 * and mobile optimization.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef } from 'react';
import classNames from 'classnames'; // version ^2.3.2
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'; // version ^10.12.16
import { Toast } from './Toast';
import { useNotification } from '../../hooks/useNotification';

// Animation and timing constants
const ANIMATION_DURATION = 200;
const DEFAULT_NOTIFICATION_DURATION = 5000;
const NOTIFICATION_Z_INDEX = 1000;
const MOBILE_BREAKPOINT = 768;
const SWIPE_THRESHOLD = 50;
const REDUCED_MOTION_DURATION = 0;

/**
 * Props interface for the Notification component
 */
interface NotificationProps {
  /** Optional class name for custom styling */
  className?: string;
  /** Position of the notification stack */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Maximum number of notifications to show at once */
  maxNotifications?: number;
  /** Spacing between stacked notifications */
  stackSpacing?: number;
}

/**
 * Props interface for individual notification items
 */
interface NotificationItemProps {
  /** Unique identifier for the notification */
  id: string;
  /** Type of notification */
  type: 'success' | 'error' | 'warning' | 'info';
  /** Notification message content */
  message: string;
  /** Optional notification title */
  title?: string;
  /** Duration to show notification */
  duration?: number;
  /** Priority level for ordering */
  priority?: number;
}

/**
 * Main notification component with enhanced accessibility and animation support
 */
const Notification: React.FC<NotificationProps> = React.memo(({
  className,
  position = 'top-right',
  maxNotifications = 5,
  stackSpacing = 8
}) => {
  const { notifications, clearNotification } = useNotification();
  const shouldReduceMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  // Position-based animation variants
  const getAnimationVariants = useCallback(() => {
    const isTop = position.startsWith('top');
    const isRight = position.endsWith('right');
    
    return {
      initial: {
        opacity: 0,
        x: isRight ? 100 : -100,
        y: isTop ? -20 : 20
      },
      animate: {
        opacity: 1,
        x: 0,
        y: 0
      },
      exit: {
        opacity: 0,
        x: isRight ? 100 : -100
      }
    };
  }, [position]);

  // Handle container position styling
  const containerStyles = classNames(
    'fixed z-[1000] flex flex-col',
    {
      'top-4': position.startsWith('top'),
      'bottom-4': position.startsWith('bottom'),
      'right-4': position.endsWith('right'),
      'left-4': position.endsWith('left')
    },
    className
  );

  // Handle mobile viewport adjustments
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
        containerRef.current.style.maxWidth = isMobile ? '100%' : '400px';
        containerRef.current.style.width = isMobile ? 'calc(100% - 32px)' : 'auto';
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Notification item component with enhanced features
  const NotificationItem: React.FC<NotificationItemProps> = React.memo(({
    id,
    type,
    message,
    title,
    duration = DEFAULT_NOTIFICATION_DURATION,
    priority
  }) => {
    const itemRef = useRef<HTMLDivElement>(null);

    // Handle auto-dismiss
    useEffect(() => {
      if (duration > 0) {
        const timer = setTimeout(() => clearNotification(id), duration);
        return () => clearTimeout(timer);
      }
    }, [id, duration]);

    // Handle touch gestures for mobile
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      const touch = e.touches[0];
      const startX = touch.clientX;
      
      const handleTouchMove = (e: TouchEvent) => {
        const deltaX = e.touches[0].clientX - startX;
        if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
          clearNotification(id);
        }
      };

      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', () => {
        document.removeEventListener('touchmove', handleTouchMove);
      }, { once: true });
    }, [id]);

    return (
      <motion.div
        ref={itemRef}
        layout
        initial="initial"
        animate="animate"
        exit="exit"
        variants={getAnimationVariants()}
        transition={{
          duration: shouldReduceMotion ? REDUCED_MOTION_DURATION : ANIMATION_DURATION / 1000
        }}
        style={{ marginBottom: stackSpacing }}
        onTouchStart={handleTouchStart}
        className="notification-item"
      >
        <Toast
          id={id}
          type={type}
          message={message}
          title={title}
          onDismiss={() => clearNotification(id)}
          priority={priority}
        />
      </motion.div>
    );
  });

  return (
    <div
      ref={containerRef}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={containerStyles}
    >
      <AnimatePresence initial={false}>
        {notifications
          .slice(0, maxNotifications)
          .sort((a, b) => (b.priority || 0) - (a.priority || 0))
          .map((notification) => (
            <NotificationItem
              key={notification.id}
              id={notification.id}
              type={notification.type}
              message={notification.message}
              title={notification.title}
              duration={notification.duration}
              priority={notification.priority}
            />
          ))}
      </AnimatePresence>
    </div>
  );
});

// Display name for debugging
Notification.displayName = 'Notification';

export default Notification;