// @mui/material version: ^5.0.0
// @mui/material/styles version: ^5.0.0
// @mui/icons-material version: ^5.0.0
// react version: ^18.0.0
// react-router-dom version: ^6.0.0

import React, { useEffect, useCallback, memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { styled, useTheme, Theme } from '@mui/material/styles';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  IconButton,
  useMediaQuery,
} from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { AssetIcon, LocationIcon, ReaderIcon } from './Icons';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth.types';

// Interfaces
interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
  ariaLabel: string;
}

// Styled components with enterprise-ready styles
const StyledDrawer = styled(Drawer, {
  shouldForwardProp: (prop) => prop !== 'isCollapsed',
})<{ isCollapsed: boolean }>(({ theme, isCollapsed }) => ({
  width: isCollapsed ? 64 : 240,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  transition: theme.transitions.create(['width', 'transform'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
  borderRight: `1px solid ${theme.palette.divider}`,
  '& .MuiDrawer-paper': {
    width: isCollapsed ? 64 : 240,
    transition: theme.transitions.create(['width', 'transform'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
  [theme.breakpoints.down('md')]: {
    position: 'fixed',
    zIndex: theme.zIndex.drawer,
    transform: isCollapsed ? 'translateX(-100%)' : 'translateX(0)',
  },
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: theme.spacing(0, 1),
  minHeight: 64,
  ...theme.mixins.toolbar,
}));

const StyledListItem = styled(ListItem)(({ theme }) => ({
  marginBottom: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  margin: theme.spacing(0, 1),
  transition: theme.transitions.create(['background-color', 'color'], {
    duration: theme.transitions.duration.shorter,
  }),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&.active': {
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.main,
    '& .MuiListItemIcon-root': {
      color: theme.palette.primary.main,
    },
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

// Navigation items configuration with role-based access
const navigationItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Asset Dashboard',
    icon: <AssetIcon size="medium" ariaLabel="Asset Dashboard" />,
    roles: [UserRole.ADMIN, UserRole.ASSET_MANAGER, UserRole.OPERATOR, UserRole.VIEWER],
    ariaLabel: 'Navigate to Asset Dashboard',
  },
  {
    path: '/locations',
    label: 'Location Manager',
    icon: <LocationIcon size="medium" ariaLabel="Location Manager" />,
    roles: [UserRole.ADMIN, UserRole.ASSET_MANAGER, UserRole.OPERATOR],
    ariaLabel: 'Navigate to Location Manager',
  },
  {
    path: '/readers',
    label: 'RFID Readers',
    icon: <ReaderIcon size="medium" ariaLabel="RFID Readers" />,
    roles: [UserRole.ADMIN, UserRole.ASSET_MANAGER],
    ariaLabel: 'Navigate to RFID Readers',
  },
];

/**
 * Enterprise-grade Sidebar component with role-based access control,
 * accessibility features, and responsive design
 */
const Sidebar: React.FC<SidebarProps> = memo(({ isCollapsed, onToggle, className }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useMediaQuery((theme: Theme) => theme.breakpoints.down('md'));

  // Filter navigation items based on user role
  const authorizedItems = navigationItems.filter(
    (item) => user && item.roles.includes(user.role)
  );

  /**
   * Handles navigation with keyboard accessibility
   */
  const handleNavigation = useCallback(
    (path: string, event: React.KeyboardEvent | React.MouseEvent) => {
      event.preventDefault();

      if (
        event.type === 'keydown' &&
        ((event as React.KeyboardEvent).key !== 'Enter' &&
          (event as React.KeyboardEvent).key !== ' ')
      ) {
        return;
      }

      navigate(path);
      if (isMobile) {
        onToggle();
      }
    },
    [navigate, isMobile, onToggle]
  );

  // Update document title for screen readers
  useEffect(() => {
    const currentItem = authorizedItems.find((item) => item.path === location.pathname);
    if (currentItem) {
      document.title = `RFID Asset Tracking - ${currentItem.label}`;
    }
  }, [location.pathname, authorizedItems]);

  return (
    <StyledDrawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={!isCollapsed}
      isCollapsed={isCollapsed}
      className={className}
      role="navigation"
      aria-label="Main navigation"
    >
      <DrawerHeader>
        <IconButton
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          edge="end"
        >
          {theme.direction === 'ltr' ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>
      </DrawerHeader>
      <Divider />
      <List component="nav" aria-label="Navigation menu">
        {authorizedItems.map((item) => (
          <StyledListItem
            key={item.path}
            button
            component="a"
            href={item.path}
            onClick={(e) => handleNavigation(item.path, e)}
            onKeyDown={(e) => handleNavigation(item.path, e)}
            className={location.pathname === item.path ? 'active' : ''}
            aria-label={item.ariaLabel}
            aria-current={location.pathname === item.path ? 'page' : undefined}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              sx={{
                opacity: isCollapsed ? 0 : 1,
                transition: theme.transitions.create('opacity', {
                  duration: theme.transitions.duration.shorter,
                }),
              }}
            />
          </StyledListItem>
        ))}
      </List>
    </StyledDrawer>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;