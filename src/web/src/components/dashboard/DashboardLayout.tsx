// @mui/material version: ^5.0.0
// react version: ^18.0.0

import React, { useCallback, useEffect, useState } from 'react';
import { Grid, Box, Paper } from '@mui/material';
import { useTheme, styled } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';

import Layout from '../common/Layout';
import DashboardStats from './DashboardStats';
import RecentActivities from './RecentActivities';
import StatusWidget from './StatusWidget';
import ErrorBoundary from '../common/ErrorBoundary';

// Styled components for enhanced layout management
const DashboardContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  minHeight: '100vh',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
}));

const MainContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(3),
  flexDirection: 'column',
  [theme.breakpoints.up('md')]: {
    flexDirection: 'row',
  },
}));

const MapSection = styled(Paper)(({ theme }) => ({
  flex: 1,
  minHeight: {
    xs: '300px',
    md: '500px',
  },
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
}));

const SidePanel = styled(Box)(({ theme }) => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  [theme.breakpoints.up('md')]: {
    width: '320px',
  },
  [theme.breakpoints.up('lg')]: {
    width: '400px',
  },
}));

// Interface for component props
interface DashboardLayoutProps {
  className?: string;
  refreshInterval?: number;
  initialData?: any;
}

/**
 * DashboardLayout component providing a responsive and accessible layout
 * for RFID asset tracking information with real-time updates
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  className,
  refreshInterval = 30000,
  initialData
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [error, setError] = useState<Error | null>(null);

  // Handle WebSocket connection status changes
  const handleConnectionStatus = useCallback((status: boolean) => {
    if (!status) {
      setError(new Error('Real-time connection lost. Attempting to reconnect...'));
    } else {
      setError(null);
    }
  }, []);

  // Effect for handling window resize events
  useEffect(() => {
    const handleResize = () => {
      // Trigger re-layout on window resize
      window.dispatchEvent(new Event('resize'));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <Layout>
      <ErrorBoundary
        fallback={<div>Error loading dashboard. Please refresh the page.</div>}
      >
        <DashboardContainer
          className={className}
          role="main"
          aria-label="Asset tracking dashboard"
        >
          {/* Stats Section */}
          <StatusWidget
            refreshInterval={refreshInterval}
            aria-label="System status overview"
          />

          <MainContent>
            {/* Main Content Area */}
            <Box
              flex={1}
              display="flex"
              flexDirection="column"
              gap={theme.spacing(3)}
            >
              {/* Asset Statistics */}
              <DashboardStats
                refreshInterval={refreshInterval}
                aria-label="Asset statistics"
              />

              {/* Asset Map (placeholder for map component) */}
              <MapSection
                role="region"
                aria-label="Asset location map"
                elevation={1}
              >
                {/* Map component will be rendered here */}
              </MapSection>
            </Box>

            {/* Side Panel */}
            <SidePanel>
              {/* Recent Activities Feed */}
              <RecentActivities
                maxItems={10}
                refreshInterval={refreshInterval}
                aria-label="Recent asset activities"
              />

              {/* Connection Status */}
              {error && (
                <Box
                  role="alert"
                  aria-live="polite"
                  className="connection-error"
                  p={2}
                  bgcolor="error.light"
                  color="error.contrastText"
                  borderRadius={1}
                >
                  {error.message}
                </Box>
              )}
            </SidePanel>
          </MainContent>
        </DashboardContainer>
      </ErrorBoundary>
    </Layout>
  );
};

// Add display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

export default React.memo(DashboardLayout);