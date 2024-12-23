import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { Auth0Client } from '@auth0/auth0-spa-js';
import { useAuth } from '../../hooks/useAuth';
import { LoginCredentials, UserRole, Permission } from '../../types/auth.types';

// Mock external dependencies
jest.mock('@auth0/auth0-spa-js');
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Test constants
const TEST_TOKEN = 'test.jwt.token';
const TEST_REFRESH_TOKEN = 'test.refresh.token';

// Mock user data
const testUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  role: UserRole.ADMIN,
  permissions: [Permission.READ_ASSETS, Permission.WRITE_ASSETS],
  lastLogin: new Date().toISOString(),
  profileImage: null,
  isActive: true
};

// Mock Auth0 client responses
const mockAuth0Client = {
  loginWithCredentials: jest.fn(),
  getIdTokenClaims: jest.fn(),
  isAuthenticated: jest.fn(),
  getTokenSilently: jest.fn(),
  logout: jest.fn()
};

// Mock navigation
const mockNavigate = jest.fn();

// Configure test store
const mockStore = configureStore({
  reducer: {
    auth: (state = {
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null
    }, action) => {
      switch (action.type) {
        case 'AUTH_LOGIN_SUCCESS':
          return {
            ...state,
            user: action.payload.user,
            isAuthenticated: true,
            loading: false,
            error: null
          };
        case 'AUTH_LOGIN_FAILURE':
          return {
            ...state,
            user: null,
            isAuthenticated: false,
            loading: false,
            error: action.payload.error
          };
        case 'AUTH_LOGOUT':
          return {
            ...state,
            user: null,
            isAuthenticated: false,
            loading: false,
            error: null
          };
        default:
          return state;
      }
    }
  }
});

// Test wrapper component
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={mockStore}>{children}</Provider>
);

describe('useAuth hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Authentication Flow', () => {
    it('should handle successful login', async () => {
      // Setup Auth0 mock responses
      mockAuth0Client.loginWithCredentials.mockResolvedValue({
        user: testUser,
        accessToken: TEST_TOKEN,
        refreshToken: TEST_REFRESH_TOKEN
      });
      mockAuth0Client.getIdTokenClaims.mockResolvedValue({
        sub: testUser.id,
        email: testUser.email,
        role: testUser.role,
        permissions: testUser.permissions,
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
        iss: 'https://test.auth0.com/',
        aud: 'test-audience'
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'Test123!',
        rememberMe: true
      };

      await act(async () => {
        await result.current.secureLogin(credentials);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(testUser);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      expect(localStorage.getItem('rfid_auth_token')).toBe(TEST_TOKEN);
    });

    it('should handle login failure with invalid credentials', async () => {
      mockAuth0Client.loginWithCredentials.mockRejectedValue(
        new Error('Invalid credentials')
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'wrong',
        rememberMe: false
      };

      await act(async () => {
        await result.current.secureLogin(credentials);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe('Invalid credentials');
      expect(result.current.user).toBeNull();
    });

    it('should enforce login attempt limits', async () => {
      mockAuth0Client.loginWithCredentials.mockRejectedValue(
        new Error('Invalid credentials')
      );

      const { result } = renderHook(() => useAuth(), { wrapper });
      const credentials: LoginCredentials = {
        email: 'test@example.com',
        password: 'wrong',
        rememberMe: false
      };

      // Attempt login multiple times
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.secureLogin(credentials);
        });
      }

      // Fourth attempt should trigger lockout
      await act(async () => {
        await result.current.secureLogin(credentials);
      });

      expect(result.current.error).toContain('Account temporarily locked');
      expect(result.current.securityContext.lockoutUntil).toBeTruthy();
    });

    it('should handle secure logout', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      // Set initial authenticated state
      mockStore.dispatch({
        type: 'AUTH_LOGIN_SUCCESS',
        payload: { user: testUser }
      });

      await act(async () => {
        await result.current.secureLogout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('rfid_auth_token')).toBeNull();
      expect(mockAuth0Client.logout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('Role-Based Access', () => {
    it('should correctly validate admin role hierarchy', () => {
      mockStore.dispatch({
        type: 'AUTH_LOGIN_SUCCESS',
        payload: { user: { ...testUser, role: UserRole.ADMIN } }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.checkRole(UserRole.ADMIN)).toBe(true);
      expect(result.current.checkRole(UserRole.ASSET_MANAGER)).toBe(true);
      expect(result.current.checkRole(UserRole.OPERATOR)).toBe(true);
      expect(result.current.checkRole(UserRole.VIEWER)).toBe(true);
    });

    it('should correctly validate operator role hierarchy', () => {
      mockStore.dispatch({
        type: 'AUTH_LOGIN_SUCCESS',
        payload: { user: { ...testUser, role: UserRole.OPERATOR } }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.checkRole(UserRole.ADMIN)).toBe(false);
      expect(result.current.checkRole(UserRole.ASSET_MANAGER)).toBe(false);
      expect(result.current.checkRole(UserRole.OPERATOR)).toBe(true);
      expect(result.current.checkRole(UserRole.VIEWER)).toBe(true);
    });

    it('should validate permissions correctly', () => {
      mockStore.dispatch({
        type: 'AUTH_LOGIN_SUCCESS',
        payload: { user: testUser }
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.checkPermission(Permission.READ_ASSETS)).toBe(true);
      expect(result.current.checkPermission(Permission.WRITE_ASSETS)).toBe(true);
      expect(result.current.checkPermission(Permission.MANAGE_USERS)).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should validate active sessions', async () => {
      mockAuth0Client.isAuthenticated.mockResolvedValue(true);
      localStorage.setItem('rfid_auth_token', TEST_TOKEN);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const isValid = await result.current.validateSession();
        expect(isValid).toBe(true);
      });
    });

    it('should handle expired sessions', async () => {
      mockAuth0Client.isAuthenticated.mockResolvedValue(false);
      localStorage.setItem('rfid_auth_token', TEST_TOKEN);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        const isValid = await result.current.validateSession();
        expect(isValid).toBe(false);
      });

      expect(localStorage.getItem('rfid_auth_token')).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });

    it('should refresh tokens periodically', async () => {
      mockAuth0Client.getTokenSilently.mockResolvedValue('new.test.token');
      mockStore.dispatch({
        type: 'AUTH_LOGIN_SUCCESS',
        payload: { user: testUser }
      });

      renderHook(() => useAuth(), { wrapper });

      // Fast-forward past token refresh interval
      jest.advanceTimersByTime(300000);

      expect(mockAuth0Client.getTokenSilently).toHaveBeenCalled();
      expect(localStorage.getItem('rfid_auth_token')).toBe('new.test.token');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during login', async () => {
      mockAuth0Client.loginWithCredentials.mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.secureLogin({
          email: 'test@example.com',
          password: 'test',
          rememberMe: false
        });
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('should handle invalid tokens', async () => {
      mockAuth0Client.getIdTokenClaims.mockResolvedValue({
        sub: 'invalid-format'
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.secureLogin({
          email: 'test@example.com',
          password: 'test',
          rememberMe: false
        });
      });

      expect(result.current.error).toBe('Invalid token payload');
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});