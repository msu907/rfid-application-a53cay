/**
 * Redux slice for managing UI state including modals, notifications, loading states, and theme preferences
 * Provides enhanced accessibility support and performance optimizations
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // version 1.9.5
import type { RootState } from '../../types/redux.types';

/**
 * Interface for notification object with enhanced type safety
 */
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  priority?: number;
  timestamp: Date;
}

/**
 * Interface for UI state with comprehensive type definitions
 */
interface UIState {
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  loading: {
    global: boolean;
    operations: Record<string, boolean>;
  };
  notifications: Notification[];
  modals: {
    assetDetail: boolean;
    locationDetail: boolean;
    readerConfig: boolean;
    settings: boolean;
    alerts: boolean;
  };
}

/**
 * Initial state with default values
 */
const initialState: UIState = {
  theme: localStorage.getItem('theme') as 'light' | 'dark' || 'light',
  sidebarOpen: true,
  loading: {
    global: false,
    operations: {},
  },
  notifications: [],
  modals: {
    assetDetail: false,
    locationDetail: false,
    readerConfig: false,
    settings: false,
    alerts: false,
  },
};

/**
 * UI slice with enhanced accessibility and performance features
 */
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    /**
     * Updates application theme with system preference persistence
     */
    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
      localStorage.setItem('theme', action.payload);
      document.documentElement.setAttribute('data-theme', action.payload);
      
      // Emit theme change event for system components
      window.dispatchEvent(new CustomEvent('themechange', { 
        detail: { theme: action.payload } 
      }));
    },

    /**
     * Toggles sidebar with responsive behavior and preference storage
     */
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
      
      // Store preference for current viewport
      if (window.innerWidth >= 1024) {
        localStorage.setItem('sidebarOpen', String(state.sidebarOpen));
      }

      // Trigger layout adjustment
      window.dispatchEvent(new Event('resize'));
    },

    /**
     * Sets loading state with granular operation tracking
     */
    setLoading: (state, action: PayloadAction<{ operation: string; loading: boolean }>) => {
      const { operation, loading } = action.payload;
      state.loading.operations[operation] = loading;

      // Update global loading state
      state.loading.global = Object.values(state.loading.operations).some(Boolean);

      // Update ARIA busy state
      document.body.setAttribute('aria-busy', String(state.loading.global));
    },

    /**
     * Adds notification with rate limiting and priority queue
     */
    addNotification: (state, action: PayloadAction<{
      type: 'success' | 'error' | 'warning' | 'info';
      message: string;
      duration?: number;
      priority?: number;
    }>) => {
      const { type, message, duration = 5000, priority = 1 } = action.payload;

      // Rate limiting check (max 5 notifications per second)
      const recentNotifications = state.notifications.filter(
        n => Date.now() - n.timestamp.getTime() < 1000
      ).length;
      
      if (recentNotifications >= 5) {
        return;
      }

      const notification: Notification = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        message,
        duration,
        priority,
        timestamp: new Date(),
      };

      // Priority queue implementation
      state.notifications = [...state.notifications, notification]
        .sort((a, b) => (b.priority || 1) - (a.priority || 1))
        .slice(0, 5); // Keep only top 5 notifications

      // Update ARIA live region
      const liveRegion = document.getElementById('notification-live-region');
      if (liveRegion) {
        liveRegion.textContent = message;
      }
    },

    /**
     * Removes notification with cleanup
     */
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
      
      // Clean up animation states
      const notificationElement = document.querySelector(
        `[data-notification-id="${action.payload}"]`
      );
      if (notificationElement) {
        notificationElement.classList.add('notification-exit');
      }
    },

    /**
     * Toggles modal with accessibility support
     */
    toggleModal: (state, action: PayloadAction<{
      modal: keyof UIState['modals'];
      open: boolean;
    }>) => {
      const { modal, open } = action.payload;

      if (modal in state.modals) {
        state.modals[modal] = open;

        // Manage focus trap and scroll locking
        if (open) {
          document.body.style.overflow = 'hidden';
          // Set focus to modal
          setTimeout(() => {
            const modalElement = document.querySelector(`[data-modal="${modal}"]`);
            if (modalElement instanceof HTMLElement) {
              modalElement.focus();
            }
          }, 0);
        } else {
          document.body.style.overflow = '';
          // Return focus to trigger element
          const triggerElement = document.querySelector(`[data-modal-trigger="${modal}"]`);
          if (triggerElement instanceof HTMLElement) {
            triggerElement.focus();
          }
        }

        // Update ARIA attributes
        document.body.setAttribute('aria-modal', String(open));
      }
    },
  },
});

// Export actions
export const {
  setTheme,
  toggleSidebar,
  setLoading,
  addNotification,
  removeNotification,
  toggleModal,
} = uiSlice.actions;

// Export selectors
export const selectTheme = (state: RootState) => state.ui.theme;
export const selectSidebarOpen = (state: RootState) => state.ui.sidebarOpen;
export const selectLoading = (state: RootState) => state.ui.loading;
export const selectNotifications = (state: RootState) => state.ui.notifications;
export const selectModals = (state: RootState) => state.ui.modals;

// Export reducer
export default uiSlice.reducer;