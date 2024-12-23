// @mui/material version: ^5.0.0
// @mui/material/styles version: ^5.0.0
// react version: ^18.0.0

import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';
import { styled } from '@mui/material/styles';

// Base interface for consistent icon props
interface IconProps extends SvgIconProps {
  size?: 'small' | 'medium' | 'large';
  titleAccess?: string;
}

// Styled wrapper component following 8px grid system
const StyledSvgIcon = styled(SvgIcon, {
  shouldForwardProp: (prop) => prop !== 'size',
})<{ size?: 'small' | 'medium' | 'large' }>(({ theme, size = 'medium' }) => ({
  ...(size === 'small' && {
    fontSize: '20px',
    padding: theme.spacing(0.5), // 4px
  }),
  ...(size === 'medium' && {
    fontSize: '24px',
    padding: theme.spacing(1), // 8px
  }),
  ...(size === 'large' && {
    fontSize: '32px',
    padding: theme.spacing(1.5), // 12px
  }),
  transition: theme.transitions.create(['color', 'transform'], {
    duration: theme.transitions.duration.shorter,
  }),
}));

/**
 * Asset icon component representing tracked items with RFID tags
 * @param {IconProps} props - Icon properties including size and accessibility attributes
 */
export const AssetIcon: React.FC<IconProps> = ({
  size = 'medium',
  color = 'inherit',
  titleAccess = 'Asset',
  ...props
}) => (
  <StyledSvgIcon
    size={size}
    color={color}
    titleAccess={titleAccess}
    role="img"
    aria-label={titleAccess}
    {...props}
  >
    {/* Custom RFID asset SVG path optimized for clarity */}
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
    <path d="M7 12h2v5H7zm4-3h2v8h-2zm4-3h2v11h-2z" />
    {/* RFID chip indicator */}
    <path d="M9 7h6v2H9z" />
  </StyledSvgIcon>
);

/**
 * Location icon component representing zones and storage areas
 * @param {IconProps} props - Icon properties including size and accessibility attributes
 */
export const LocationIcon: React.FC<IconProps> = ({
  size = 'medium',
  color = 'inherit',
  titleAccess = 'Location',
  ...props
}) => (
  <StyledSvgIcon
    size={size}
    color={color}
    titleAccess={titleAccess}
    role="img"
    aria-label={titleAccess}
    {...props}
  >
    {/* Location marker with zone indication */}
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
  </StyledSvgIcon>
);

/**
 * RFID Reader icon component with status indication capability
 * @param {IconProps} props - Icon properties including size and accessibility attributes
 */
export const ReaderIcon: React.FC<IconProps> = ({
  size = 'medium',
  color = 'inherit',
  titleAccess = 'RFID Reader',
  ...props
}) => (
  <StyledSvgIcon
    size={size}
    color={color}
    titleAccess={titleAccess}
    role="img"
    aria-label={titleAccess}
    {...props}
  >
    {/* RFID Reader device with antenna representation */}
    <path d="M2 16v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z" />
    <path d="M2 20v2c1.1 0 2 .9 2 2h2c0-2.21-1.79-4-4-4z" />
    <path d="M2 12v2c4.97 0 9 4.03 9 9h2c0-6.08-4.92-11-11-11z" />
    {/* Reader base */}
    <path d="M17 3H7c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12H7V5h10v10z" />
  </StyledSvgIcon>
);

/**
 * Status indicator icon with color-coded states
 * @param {IconProps & { status: 'online' | 'offline' | 'error' }} props - Icon properties including status state
 */
export const StatusIcon: React.FC<IconProps & { 
  status: 'online' | 'offline' | 'error' 
}> = ({
  size = 'medium',
  status,
  titleAccess,
  ...props
}) => {
  // Map status to Material Design colors
  const statusColors = {
    online: 'success',
    offline: 'error',
    error: 'warning',
  } as const;

  const statusTitles = {
    online: 'Online Status',
    offline: 'Offline Status',
    error: 'Error Status',
  };

  return (
    <StyledSvgIcon
      size={size}
      color={statusColors[status]}
      titleAccess={titleAccess || statusTitles[status]}
      role="status"
      aria-label={titleAccess || statusTitles[status]}
      {...props}
    >
      {/* Dynamic status indicator circle */}
      <circle cx="12" cy="12" r="8" />
      {status === 'online' && <path d="M9 12l2 2l4-4" fill="#fff" />}
      {status === 'offline' && <path d="M15 9l-6 6M9 9l6 6" stroke="#fff" strokeWidth="2" />}
      {status === 'error' && <path d="M12 8v5M12 15h.01" fill="#fff" />}
    </StyledSvgIcon>
  );
};

// Type exports for consuming components
export type { IconProps };