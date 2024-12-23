// @mui/material version: ^5.0.0
// react version: ^18.0.0
// react-redux version: ^8.0.0

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Slider,
  Select,
  MenuItem,
  TextField,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import Layout from '../components/common/Layout';
import Card from '../components/common/Card';
import { useAuth } from '../hooks/useAuth';
import { UserRole } from '../types/auth.types';

// Interface for theme settings
interface ThemeSettings {
  darkMode: boolean | 'system';
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  reducedMotion: boolean;
}

// Interface for notification settings
interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  alertTypes: string[];
  frequency: 'immediate' | 'hourly' | 'daily';
}

// Interface for display settings
interface DisplaySettings {
  defaultView: 'grid' | 'list';
  refreshInterval: number;
  density: 'comfortable' | 'compact';
  gridLayout: 'auto' | 'fixed';
}

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user, checkRole } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State management for settings
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>({
    darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'system' : false,
    fontSize: 'medium',
    highContrast: false,
    reducedMotion: false,
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    emailNotifications: true,
    pushNotifications: true,
    alertTypes: ['asset_movement', 'reader_offline', 'system_alerts'],
    frequency: 'immediate',
  });

  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>({
    defaultView: 'grid',
    refreshInterval: 30,
    density: 'comfortable',
    gridLayout: 'auto',
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadSettings = () => {
      const savedThemeSettings = localStorage.getItem('theme_settings');
      const savedNotificationSettings = localStorage.getItem('notification_settings');
      const savedDisplaySettings = localStorage.getItem('display_settings');

      if (savedThemeSettings) {
        setThemeSettings(JSON.parse(savedThemeSettings));
      }
      if (savedNotificationSettings) {
        setNotificationSettings(JSON.parse(savedNotificationSettings));
      }
      if (savedDisplaySettings) {
        setDisplaySettings(JSON.parse(savedDisplaySettings));
      }
    };

    loadSettings();
  }, []);

  // Memoized handlers for settings changes
  const handleThemeChange = useCallback((setting: keyof ThemeSettings, value: any) => {
    setThemeSettings(prev => {
      const newSettings = { ...prev, [setting]: value };
      localStorage.setItem('theme_settings', JSON.stringify(newSettings));
      
      // Apply theme changes immediately
      document.documentElement.setAttribute('data-theme', 
        newSettings.darkMode === 'system' 
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : newSettings.darkMode ? 'dark' : 'light'
      );
      
      // Apply high contrast if enabled
      document.documentElement.setAttribute('data-high-contrast', 
        newSettings.highContrast.toString()
      );
      
      return newSettings;
    });
  }, []);

  const handleNotificationChange = useCallback((setting: keyof NotificationSettings, value: any) => {
    setNotificationSettings(prev => {
      const newSettings = { ...prev, [setting]: value };
      localStorage.setItem('notification_settings', JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  const handleDisplayChange = useCallback((setting: keyof DisplaySettings, value: any) => {
    setDisplaySettings(prev => {
      const newSettings = { ...prev, [setting]: value };
      localStorage.setItem('display_settings', JSON.stringify(newSettings));
      return newSettings;
    });
  }, []);

  // Memoized refresh interval marks
  const refreshIntervalMarks = useMemo(() => [
    { value: 15, label: '15s' },
    { value: 30, label: '30s' },
    { value: 60, label: '1m' },
    { value: 300, label: '5m' },
  ], []);

  return (
    <Layout>
      <Box
        component="main"
        sx={{
          padding: theme.spacing(3),
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Settings
        </Typography>

        {/* Theme Settings */}
        <Card
          elevation="medium"
          className="settings-card"
          role="region"
          ariaLabel="Theme Settings"
        >
          <Typography variant="h6" gutterBottom>
            Theme & Accessibility
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={themeSettings.darkMode === true}
                  onChange={(e) => handleThemeChange('darkMode', e.target.checked)}
                  inputProps={{ 'aria-label': 'Dark Mode' }}
                />
              }
              label="Dark Mode"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={themeSettings.highContrast}
                  onChange={(e) => handleThemeChange('highContrast', e.target.checked)}
                  inputProps={{ 'aria-label': 'High Contrast' }}
                />
              }
              label="High Contrast"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={themeSettings.reducedMotion}
                  onChange={(e) => handleThemeChange('reducedMotion', e.target.checked)}
                  inputProps={{ 'aria-label': 'Reduced Motion' }}
                />
              }
              label="Reduced Motion"
            />
            <Box>
              <Typography id="font-size-label" gutterBottom>
                Font Size
              </Typography>
              <Select
                value={themeSettings.fontSize}
                onChange={(e) => handleThemeChange('fontSize', e.target.value)}
                fullWidth={isMobile}
                aria-labelledby="font-size-label"
              >
                <MenuItem value="small">Small</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="large">Large</MenuItem>
              </Select>
            </Box>
          </Box>
        </Card>

        <Divider sx={{ my: 3 }} />

        {/* Notification Settings */}
        <Card
          elevation="medium"
          className="settings-card"
          role="region"
          ariaLabel="Notification Settings"
        >
          <Typography variant="h6" gutterBottom>
            Notifications
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={notificationSettings.emailNotifications}
                  onChange={(e) => handleNotificationChange('emailNotifications', e.target.checked)}
                  inputProps={{ 'aria-label': 'Email Notifications' }}
                />
              }
              label="Email Notifications"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={notificationSettings.pushNotifications}
                  onChange={(e) => handleNotificationChange('pushNotifications', e.target.checked)}
                  inputProps={{ 'aria-label': 'Push Notifications' }}
                />
              }
              label="Push Notifications"
            />
            <Box>
              <Typography id="notification-frequency-label" gutterBottom>
                Notification Frequency
              </Typography>
              <Select
                value={notificationSettings.frequency}
                onChange={(e) => handleNotificationChange('frequency', e.target.value)}
                fullWidth={isMobile}
                aria-labelledby="notification-frequency-label"
              >
                <MenuItem value="immediate">Immediate</MenuItem>
                <MenuItem value="hourly">Hourly Digest</MenuItem>
                <MenuItem value="daily">Daily Digest</MenuItem>
              </Select>
            </Box>
          </Box>
        </Card>

        <Divider sx={{ my: 3 }} />

        {/* Display Settings */}
        <Card
          elevation="medium"
          className="settings-card"
          role="region"
          ariaLabel="Display Settings"
        >
          <Typography variant="h6" gutterBottom>
            Display & Performance
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography id="default-view-label" gutterBottom>
                Default View
              </Typography>
              <Select
                value={displaySettings.defaultView}
                onChange={(e) => handleDisplayChange('defaultView', e.target.value)}
                fullWidth={isMobile}
                aria-labelledby="default-view-label"
              >
                <MenuItem value="grid">Grid</MenuItem>
                <MenuItem value="list">List</MenuItem>
              </Select>
            </Box>
            <Box>
              <Typography id="refresh-interval-label" gutterBottom>
                Refresh Interval
              </Typography>
              <Slider
                value={displaySettings.refreshInterval}
                onChange={(_, value) => handleDisplayChange('refreshInterval', value)}
                aria-labelledby="refresh-interval-label"
                marks={refreshIntervalMarks}
                min={15}
                max={300}
                step={15}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}s`}
              />
            </Box>
            <Box>
              <Typography id="density-label" gutterBottom>
                Display Density
              </Typography>
              <Select
                value={displaySettings.density}
                onChange={(e) => handleDisplayChange('density', e.target.value)}
                fullWidth={isMobile}
                aria-labelledby="density-label"
              >
                <MenuItem value="comfortable">Comfortable</MenuItem>
                <MenuItem value="compact">Compact</MenuItem>
              </Select>
            </Box>
          </Box>
        </Card>

        {/* Admin-only System Settings */}
        {checkRole(UserRole.ADMIN) && (
          <>
            <Divider sx={{ my: 3 }} />
            <Card
              elevation="medium"
              className="settings-card"
              role="region"
              ariaLabel="System Settings"
            >
              <Typography variant="h6" gutterBottom>
                System Settings
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="System Name"
                  defaultValue="RFID Asset Tracking System"
                  fullWidth
                  variant="outlined"
                />
                <TextField
                  label="API Endpoint"
                  defaultValue={process.env.REACT_APP_API_URL}
                  fullWidth
                  variant="outlined"
                />
              </Box>
            </Card>
          </>
        )}
      </Box>
    </Layout>
  );
};

export default SettingsPage;