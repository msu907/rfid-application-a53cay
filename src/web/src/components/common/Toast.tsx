/**
 * Enterprise-grade Toast notification component with accessibility support,
 * animations, and real-time updates through Redux state management.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'; // version 10.12.16
import { debounce } from 'lodash'; // version 4.17.21
import { RootState } from '../../types/redux.types';
import { selectNotifications, removeNotification } from '../../redux/slices/uiSlice';

// Constants for configuration
const AUTO_DISMISS_DURATION = 5000;
const MAX_NOTIFICATIONS = 5;
const ANIMATION_DURATION = 300;

/**
 * Props interface for individual toast notifications
 */
interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  autoDismiss?: boolean;
  duration?: number;
  priority?: number;
  onDismiss?: () => void;
}

/**
 * Custom hook for handling toast dismissal logic
 */
const useToastDismiss = (
  autoDismiss: boolean,
  duration: number,
  id: string,
  dispatch: ReturnType<typeof useDispatch>
) => {
  const timerRef = useRef<NodeJS.Timeout>();
  const pausedRef = useRef(false);

  const dismiss = useCallback(() => {
    dispatch(removeNotification(id));
  }, [dispatch, id]);

  useEffect(() => {
    if (autoDismiss && !pausedRef.current) {
      timerRef.current = setTimeout(dismiss, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [autoDismiss, duration, dismiss]);

  const handleMouseEnter = () => {
    pausedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleMouseLeave = () => {
    pausedRef.current = false;
    if (autoDismiss) {
      timerRef.current = setTimeout(dismiss, duration);
    }
  };

  return { handleMouseEnter, handleMouseLeave, dismiss };
};

/**
 * Returns the appropriate icon component based on notification type
 */
const getToastIcon = (type: ToastProps['type']) => {
  switch (type) {
    case 'success':
      return (
        <svg aria-label="Success" role="img" className="toast-icon success" viewBox="0 0 24 24">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
        </svg>
      );
    case 'error':
      return (
        <svg aria-label="Error" role="img" className="toast-icon error" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
        </svg>
      );
    case 'warning':
      return (
        <svg aria-label="Warning" role="img" className="toast-icon warning" viewBox="0 0 24 24">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
        </svg>
      );
    case 'info':
      return (
        <svg aria-label="Information" role="img" className="toast-icon info" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
        </svg>
      );
  }
};

/**
 * Returns style classes based on notification type
 */
const getToastStyles = (type: ToastProps['type']) => {
  const baseClasses = 'toast-notification flex items-center p-4 rounded-lg shadow-lg';
  const typeClasses = {
    success: 'bg-green-50 text-green-800 border-green-500',
    error: 'bg-red-50 text-red-800 border-red-500',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-500',
    info: 'bg-blue-50 text-blue-800 border-blue-500'
  };
  return `${baseClasses} ${typeClasses[type]}`;
};

/**
 * Toast notification component with accessibility and animation support
 */
const Toast: React.FC<ToastProps> = ({
  id,
  type,
  message,
  autoDismiss = true,
  duration = AUTO_DISMISS_DURATION,
  onDismiss
}) => {
  const dispatch = useDispatch();
  const shouldReduceMotion = useReducedMotion();
  const { handleMouseEnter, handleMouseLeave, dismiss } = useToastDismiss(
    autoDismiss,
    duration,
    id,
    dispatch
  );

  // Animation variants with reduced motion support
  const variants = {
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 50 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, x: shouldReduceMotion ? 0 : 100 }
  };

  return (
    <motion.div
      role="alert"
      aria-live="polite"
      data-notification-id={id}
      className={getToastStyles(type)}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: ANIMATION_DURATION / 1000 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {getToastIcon(type)}
      <span className="toast-message ml-3 mr-8">{message}</span>
      <button
        type="button"
        aria-label="Close notification"
        onClick={() => {
          dismiss();
          onDismiss?.();
        }}
        className="toast-close-button ml-auto"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
        </svg>
      </button>
    </motion.div>
  );
};

/**
 * Container component that manages multiple toast notifications
 */
export const ToastContainer: React.FC = () => {
  const notifications = useSelector(selectNotifications);
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="toast-container fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      <AnimatePresence initial={false}>
        {notifications.slice(0, MAX_NOTIFICATIONS).map((notification) => (
          <Toast
            key={notification.id}
            id={notification.id}
            type={notification.type}
            message={notification.message}
            duration={notification.duration}
            priority={notification.priority}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Toast;