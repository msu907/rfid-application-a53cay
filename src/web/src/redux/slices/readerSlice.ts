/**
 * Redux slice for managing RFID reader state with comprehensive monitoring
 * and real-time updates. Implements performance tracking and error handling
 * based on system requirements.
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5
import { debounce } from 'lodash'; // ^4.17.21
import { Reader, ReaderStatus } from '../../types/reader.types';
import { ReaderApi } from '../../api/reader.api';

// Performance thresholds based on technical specifications
const PERFORMANCE_THRESHOLDS = {
  READ_LATENCY_MS: 500,
  SIGNAL_STRENGTH_MIN_DBM: -70,
  SIGNAL_STRENGTH_MAX_DBM: -20,
  READ_RATE_MAX: 1000
} as const;

// Error codes for reader-specific issues
const READER_ERROR_CODES = {
  RDR_001: 'Reader connection lost',
  RDR_002: 'Configuration update failed',
  RDR_003: 'Performance threshold exceeded',
  RDR_004: 'Invalid reader data',
  RDR_005: 'Reader initialization failed'
} as const;

// Interface for reader filter criteria
interface ReaderFilterCriteria {
  status?: ReaderStatus[];
  location?: string;
  signalStrengthRange?: {
    min: number;
    max: number;
  };
  readRateThreshold?: number;
}

// Interface for reader performance metrics
interface ReaderMetrics {
  readLatency: number;
  signalStrength: number;
  readRate: number;
  successRate: number;
  lastUpdated: string;
}

// Interface for reader statistics
interface ReaderStatistics {
  totalReads: number;
  activeReaders: number;
  averageLatency: number;
  performanceAlerts: number;
}

// Interface for pending reader requests
interface PendingRequest {
  id: string;
  timestamp: number;
  retryCount: number;
}

// Interface for reader state
interface ReaderState {
  readers: Reader[];
  selectedReader: Reader | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number;
  filterCriteria: ReaderFilterCriteria;
  readerMetrics: Map<string, ReaderMetrics>;
  statistics: ReaderStatistics;
  pendingRequests: PendingRequest[];
}

// Initial state
const initialState: ReaderState = {
  readers: [],
  selectedReader: null,
  loading: false,
  error: null,
  lastUpdated: 0,
  filterCriteria: {},
  readerMetrics: new Map(),
  statistics: {
    totalReads: 0,
    activeReaders: 0,
    averageLatency: 0,
    performanceAlerts: 0
  },
  pendingRequests: []
};

// Create API instance
const readerApi = new ReaderApi();

/**
 * Async thunk for fetching readers with debouncing
 */
export const fetchReaders = createAsyncThunk(
  'readers/fetchReaders',
  async (_, { rejectWithValue, getState }) => {
    try {
      const response = await readerApi.getReaders();
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'RDR_001',
        message: error.message || READER_ERROR_CODES.RDR_001
      });
    }
  }
);

/**
 * Async thunk for updating reader configuration
 */
export const updateReaderConfig = createAsyncThunk(
  'readers/updateConfig',
  async ({ readerId, config }: { readerId: string; config: any }, { rejectWithValue }) => {
    try {
      const response = await readerApi.updateReaderConfig(readerId, config);
      return response.data;
    } catch (error: any) {
      return rejectWithValue({
        code: 'RDR_002',
        message: READER_ERROR_CODES.RDR_002
      });
    }
  }
);

// Create the reader slice
const readerSlice = createSlice({
  name: 'readers',
  initialState,
  reducers: {
    setSelectedReader: (state, action: PayloadAction<Reader | null>) => {
      state.selectedReader = action.payload;
    },
    updateReaderMetrics: (state, action: PayloadAction<{ readerId: string; metrics: ReaderMetrics }>) => {
      const { readerId, metrics } = action.payload;
      state.readerMetrics.set(readerId, {
        ...metrics,
        lastUpdated: new Date().toISOString()
      });

      // Check performance thresholds
      if (metrics.readLatency > PERFORMANCE_THRESHOLDS.READ_LATENCY_MS) {
        state.statistics.performanceAlerts++;
      }
    },
    setFilterCriteria: (state, action: PayloadAction<ReaderFilterCriteria>) => {
      state.filterCriteria = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateStatistics: (state, action: PayloadAction<Partial<ReaderStatistics>>) => {
      state.statistics = {
        ...state.statistics,
        ...action.payload
      };
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReaders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchReaders.fulfilled, (state, action) => {
        state.loading = false;
        state.readers = action.payload;
        state.lastUpdated = Date.now();
        state.statistics.activeReaders = action.payload.filter(
          reader => reader.status === ReaderStatus.ONLINE
        ).length;
      })
      .addCase(fetchReaders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || READER_ERROR_CODES.RDR_001;
      })
      .addCase(updateReaderConfig.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateReaderConfig.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.readers.findIndex(r => r.id === action.payload.id);
        if (index !== -1) {
          state.readers[index] = action.payload;
        }
      })
      .addCase(updateReaderConfig.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || READER_ERROR_CODES.RDR_002;
      });
  }
});

// Export actions
export const {
  setSelectedReader,
  updateReaderMetrics,
  setFilterCriteria,
  clearError,
  updateStatistics
} = readerSlice.actions;

// Memoized selectors
export const selectAllReaders = (state: { readers: ReaderState }) => state.readers.readers;
export const selectSelectedReader = (state: { readers: ReaderState }) => state.readers.selectedReader;
export const selectReaderMetrics = (state: { readers: ReaderState }) => state.readers.readerMetrics;
export const selectReaderStatistics = (state: { readers: ReaderState }) => state.readers.statistics;
export const selectFilteredReaders = (state: { readers: ReaderState }) => {
  const { readers, filterCriteria } = state.readers;
  return readers.filter(reader => {
    if (filterCriteria.status && !filterCriteria.status.includes(reader.status)) {
      return false;
    }
    if (filterCriteria.location && reader.location !== filterCriteria.location) {
      return false;
    }
    // Add more filter conditions as needed
    return true;
  });
};

// Export reducer
export default readerSlice.reducer;