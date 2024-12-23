import { z } from 'zod'; // v3.0.0
import type { Asset } from '../../../proto/asset.proto';
import type { ReadEvent } from '../../../proto/reader.proto';

/**
 * Enhanced enumeration of available dashboard widget types with comprehensive coverage
 * of all visualization requirements from the technical specification.
 */
export enum WidgetType {
  ASSET_MAP = 'ASSET_MAP',
  ASSET_LIST = 'ASSET_LIST',
  READ_HISTORY = 'READ_HISTORY',
  READER_STATUS = 'READER_STATUS',
  MOVEMENT_TRAIL = 'MOVEMENT_TRAIL',
  STATISTICS = 'STATISTICS',
  HEATMAP = 'HEATMAP',
  ALERT_PANEL = 'ALERT_PANEL',
  PERFORMANCE_METRICS = 'PERFORMANCE_METRICS'
}

/**
 * Enhanced enumeration of visualization data update types for real-time updates
 */
export enum DataType {
  LOCATION_UPDATE = 'LOCATION_UPDATE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  READ_EVENT = 'READ_EVENT',
  STATISTICS_UPDATE = 'STATISTICS_UPDATE',
  ALERT_NOTIFICATION = 'ALERT_NOTIFICATION',
  PERFORMANCE_UPDATE = 'PERFORMANCE_UPDATE',
  CONFIGURATION_CHANGE = 'CONFIGURATION_CHANGE'
}

/**
 * Enhanced interface for widget positioning with strict boundary validation
 */
export interface Position {
  row: number;
  column: number;
  width: number;
  height: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
}

/**
 * Configuration interface for data visualization settings
 */
export interface WidgetDataConfig {
  dataSource: string;
  refreshInterval: number;
  aggregationType?: 'raw' | 'hourly' | 'daily';
  filterCriteria?: Record<string, unknown>;
  transformations?: Array<{
    type: string;
    params: Record<string, unknown>;
  }>;
}

/**
 * Visual configuration for widget appearance and behavior
 */
export interface WidgetVisualConfig {
  colorScheme: string[];
  legendPosition?: 'top' | 'right' | 'bottom' | 'left';
  showAxes: boolean;
  showGrid: boolean;
  showTooltips: boolean;
  animations: boolean;
  responsiveConfig?: Record<string, unknown>;
}

/**
 * Enhanced configuration for individual dashboard visualization widgets
 */
export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  position: Position;
  dataConfig: WidgetDataConfig;
  visualConfig: WidgetVisualConfig;
  settings: Record<string, unknown>;
  isVisible: boolean;
  refreshRate: number;
}

/**
 * Dashboard theme configuration for consistent visualization styling
 */
export interface DashboardTheme {
  primary: string;
  secondary: string;
  background: string;
  text: string;
  accent: string[];
  fonts: {
    primary: string;
    secondary: string;
  };
}

/**
 * Dashboard permissions configuration for access control
 */
export interface DashboardPermissions {
  ownerUserId: string;
  sharedWith: Array<{
    userId: string;
    role: 'viewer' | 'editor' | 'admin';
  }>;
  public: boolean;
}

/**
 * Enhanced configuration interface for dashboard visualization
 */
export interface DashboardConfig {
  id: string;
  userId: string;
  widgets: WidgetConfig[];
  theme: DashboardTheme;
  preferences: Record<string, string>;
  permissions: DashboardPermissions;
  lastModified: Date;
}

/**
 * Error details interface for validation failures
 */
export interface ErrorDetails {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

/**
 * Validation status enumeration for data quality assessment
 */
export enum ValidationStatus {
  VALID = 'VALID',
  INVALID = 'INVALID',
  WARNING = 'WARNING'
}

/**
 * Enhanced interface for real-time visualization data updates
 */
export interface VisualizationData {
  widgetId: string;
  type: DataType;
  payload: unknown;
  timestamp: Date;
  source: string;
  status: ValidationStatus;
  errors?: ErrorDetails[];
}

/**
 * Configuration options for validation behavior
 */
export interface ValidationOptions {
  strict: boolean;
  abortEarly: boolean;
  maxErrors?: number;
  customValidators?: Record<string, (value: unknown) => boolean>;
}

/**
 * Enhanced Zod schema for comprehensive runtime validation of dashboard configuration
 */
export class DashboardSchema {
  private static readonly positionSchema = z.object({
    row: z.number().min(0),
    column: z.number().min(0),
    width: z.number().min(1),
    height: z.number().min(1),
    minWidth: z.number().min(1),
    maxWidth: z.number().min(1),
    minHeight: z.number().min(1),
    maxHeight: z.number().min(1)
  });

  private static readonly widgetSchema = z.object({
    id: z.string().uuid(),
    type: z.nativeEnum(WidgetType),
    title: z.string().min(1),
    position: DashboardSchema.positionSchema,
    dataConfig: z.object({
      dataSource: z.string(),
      refreshInterval: z.number().min(1000),
      aggregationType: z.enum(['raw', 'hourly', 'daily']).optional(),
      filterCriteria: z.record(z.unknown()).optional(),
      transformations: z.array(z.object({
        type: z.string(),
        params: z.record(z.unknown())
      })).optional()
    }),
    visualConfig: z.object({
      colorScheme: z.array(z.string()),
      legendPosition: z.enum(['top', 'right', 'bottom', 'left']).optional(),
      showAxes: z.boolean(),
      showGrid: z.boolean(),
      showTooltips: z.boolean(),
      animations: z.boolean(),
      responsiveConfig: z.record(z.unknown()).optional()
    }),
    settings: z.record(z.unknown()),
    isVisible: z.boolean(),
    refreshRate: z.number().min(1000)
  });

  public static readonly schema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    widgets: z.array(DashboardSchema.widgetSchema),
    theme: z.object({
      primary: z.string(),
      secondary: z.string(),
      background: z.string(),
      text: z.string(),
      accent: z.array(z.string()),
      fonts: z.object({
        primary: z.string(),
        secondary: z.string()
      })
    }),
    preferences: z.record(z.string()),
    permissions: z.object({
      ownerUserId: z.string().uuid(),
      sharedWith: z.array(z.object({
        userId: z.string().uuid(),
        role: z.enum(['viewer', 'editor', 'admin'])
      })),
      public: z.boolean()
    }),
    lastModified: z.date()
  });

  /**
   * Validates dashboard configuration with comprehensive error reporting
   * @param data - Configuration data to validate
   * @param options - Validation options
   * @returns Validated configuration or error details
   */
  public static validate(
    data: unknown,
    options: ValidationOptions = { strict: true, abortEarly: false }
  ): z.SafeParseReturnType<unknown, DashboardConfig> {
    return this.schema.safeParse(data, {
      strict: options.strict,
      errorMap: (error, ctx) => ({
        message: `Validation failed for ${ctx.path.join('.')}: ${error.message}`
      })
    });
  }
}

export type ValidationResult<T> = z.SafeParseReturnType<unknown, T>;