/**
 * Custom React hook for managing notifications with enhanced features including
 * rate limiting, priority queuing, and accessibility support.
 * @version 1.0.0
 */

import { useDispatch, useSelector } from 'react-redux'; // version ^8.1.1
import { useCallback, useEffect } from 'react'; // version ^18.2.0
import debounce from 'lodash/debounce'; // version ^4.17.21
import { 
  addNotification, 
  removeNotification,
  selectNotifications 
} from '../../redux/slices/uiSlice';
import type { RootState } from '../../types/redux.types';

/**
 * Notification type enumeration
 */
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Enhanced notification configuration options
 */
export interface NotificationOptions {
  /** Optional title for the notification */
  title?: string;
  /** Duration in milliseconds before auto-dismiss (default: 5000) */
  duration?: number;
  /** Whether to auto-dismiss the notification (default: true) */
  autoDismiss?: boolean;
  /** Priority level for queue ordering (higher = more important) */
  priority?: number;
  /** ARIA label for accessibility */
  ariaLabel?: string;
  /** Optional actions that can be performed on the notification */
  actions?: Array<{
    label: string;
    onClick: () => void;
    ariaLabel?: string;
  }>;
}

/**
 * Rate limiting configuration
 */
const RATE_LIMIT_CONFIG = {
  maxNotifications: 5,
  windowMs: 1000, // 1 second window
  debounceMs: 100 // Debounce time for rapid notifications
} as const;

/**
 * Custom hook for managing notifications with enhanced features
 */
export const useNotification = () => {
  const dispatch = useDispatch();
  const notifications = useSelector((state: RootState) => selectNotifications(state));

  /**
   * Debounced notification processor to handle rate limiting
   */
  const debouncedNotificationProcessor = useCallback(
    debounce((
      type: NotificationType,
      message: string,
      options: NotificationOptions
    ) => {
      const recentNotifications = notifications.filter(
        n => Date.now() - new Date(n.timestamp).getTime() < RATE_LIMIT_CONFIG.windowMs
      );

      if (recentNotifications.length >= RATE_LIMIT_CONFIG.maxNotifications) {
        console.warn('Notification rate limit exceeded');
        return;
      }

      const notificationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const defaultOptions: Required<NotificationOptions> = {
        title: '',
        duration: 5000,
        autoDismiss: true,
        priority: 0,
        ariaLabel: message,
        actions: []
      };

      const mergedOptions = { ...defaultOptions, ...options };

      dispatch(addNotification({
        type,
        message,
        duration: mergedOptions.duration,
        priority: mergedOptions.priority
      }));

      // Set up auto-dismiss timer if enabled
      if (mergedOptions.autoDismiss) {
        setTimeout(() => {
          dispatch(removeNotification(notificationId));
        }, mergedOptions.duration);
      }

      // Update ARIA live region for screen readers
      const liveRegion = document.getElementById('notification-live-region');
      if (liveRegion) {
        liveRegion.textContent = mergedOptions.ariaLabel || message;
      }
    }, RATE_LIMIT_CONFIG.debounceMs),
    [dispatch, notifications]
  );

  /**
   * Shows a notification with rate limiting and accessibility support
   */
  const showNotification = useCallback((
    type: NotificationType,
    message: string,
    options: NotificationOptions = {}
  ) => {
    debouncedNotificationProcessor(type, message, options);
  }, [debouncedNotificationProcessor]);

  /**
   * Clears a specific notification
   */
  const clearNotification = useCallback((id: string) => {
    dispatch(removeNotification(id));
  }, [dispatch]);

  /**
   * Clears all active notifications
   */
  const clearAllNotifications = useCallback(() => {
    notifications.forEach(notification => {
      dispatch(removeNotification(notification.id));
    });
  }, [dispatch, notifications]);

  /**
   * Cleanup effect for unmounting
   */
  useEffect(() => {
    return () => {
      debouncedNotificationProcessor.cancel();
    };
  }, [debouncedNotificationProcessor]);

  return {
    showNotification,
    clearNotification,
    clearAllNotifications,
    notifications
  };
};

export default useNotification;