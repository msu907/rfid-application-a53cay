/**
 * Type definitions for RFID reader entities, configurations, and events
 * Supporting LLRP v1.1 protocol and comprehensive monitoring capabilities
 * @version 1.0.0
 */

/**
 * Enumeration of possible reader operational states
 */
export enum ReaderStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  ERROR = 'ERROR',
  MAINTENANCE = 'MAINTENANCE'
}

/**
 * Enumeration of reader power level settings
 * Affects read range and signal strength (-70dBm to -20dBm)
 */
export enum PowerLevel {
  LOW = 'LOW',      // Typically -70dBm to -55dBm
  MEDIUM = 'MEDIUM', // Typically -55dBm to -35dBm
  HIGH = 'HIGH'     // Typically -35dBm to -20dBm
}

/**
 * Interface for comprehensive reader configuration including LLRP protocol settings
 */
export interface ReaderConfig {
  powerLevel: PowerLevel;
  readIntervalMs: number;           // Read rate interval in milliseconds
  filteringEnabled: boolean;        // Enable/disable read filtering
  signalStrengthThreshold: number;  // Minimum signal strength in dBm
  frequencyBand: string;           // e.g., '865-868 MHz (EU)'
  llrpVersion: string;             // LLRP protocol version (e.g., '1.1')
  additionalParams: Record<string, string>; // Additional configuration parameters
}

/**
 * Interface for RFID reader device data
 */
export interface Reader {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  status: ReaderStatus;
  config: ReaderConfig;
  lastHeartbeat: Date;
  location: string;
  firmwareVersion: string;
}

/**
 * Interface for RFID tag read events with detailed protocol information
 */
export interface ReadEvent {
  id: string;
  readerId: string;
  rfidTag: string;
  signalStrength: number;      // Signal strength in dBm
  readTime: Date;
  isFiltered: boolean;
  frequency: number;           // Operating frequency in MHz
  antennaPort: number;        // Physical antenna port number
}

/**
 * Interface for comprehensive reader statistics
 */
export interface ReaderStatsResponse {
  totalReads: number;
  successfulReads: number;
  filteredReads: number;
  averageSignalStrength: number;
  uptime: number;             // Uptime in seconds
  readRate: number;           // Reads per second
  errorRate: number;          // Error rate percentage
  lastMaintenanceDate: Date;
  peakSignalStrength: number;
  memoryUsage: number;        // Memory usage percentage
}

/**
 * Interface for reader query parameters
 */
export interface ReaderQueryParams {
  status?: ReaderStatus[];
  location?: string;
  powerLevel?: PowerLevel;
  minSignalStrength?: number;
  maxReadRate?: number;
  firmwareVersion?: string;
  lastMaintenanceAfter?: Date;
}

/**
 * Type for reader update request payload
 */
export type ReaderUpdatePayload = Pick<Reader, 'name' | 'config' | 'location'> & {
  maintenanceNote?: string;
};

/**
 * Type for comprehensive reader API response
 */
export type ReaderResponse = Reader & {
  stats: ReaderStatsResponse;
  healthStatus: {
    cpu: number;      // CPU usage percentage
    memory: number;   // Memory usage percentage
    temperature: number; // Temperature in Celsius
  };
};