# External imports with versions
from datetime import datetime, timezone  # Python 3.11
from typing import List, Dict, Optional  # Python 3.11
from dataclasses import dataclass  # Python 3.11
import threading  # Python 3.11
from prometheus_client import Counter, Gauge  # v0.16.0

# Internal imports
from ..models.read import Read

# Constants for default configuration
DEFAULT_TIME_WINDOW: float = 5.0  # seconds
DEFAULT_SIGNAL_THRESHOLD: float = 3.0  # dBm
DEFAULT_MAX_BUFFER_SIZE: int = 10000
METRICS_PREFIX: str = 'rfid_deduplicator'

@dataclass
class ReadDeduplicator:
    """
    Thread-safe handler for RFID tag read deduplication using time windows and signal strength comparison.
    
    This class implements a sophisticated deduplication strategy that considers both time windows
    and signal strength to eliminate duplicate reads while maintaining data quality. All operations
    are thread-safe and include comprehensive monitoring capabilities.
    
    Attributes:
        time_window_seconds (float): Time window for considering potential duplicates
        signal_threshold_dbm (float): Minimum signal strength difference to consider reads distinct
        _read_buffer (Dict[str, List[Read]]): Thread-safe buffer for storing recent reads
        _buffer_lock (threading.Lock): Lock for thread-safe buffer operations
        _max_buffer_size (int): Maximum number of reads to store in buffer
        _dedup_counter (Counter): Prometheus counter for duplicate detection metrics
        _buffer_size_gauge (Gauge): Prometheus gauge for buffer size monitoring
    """
    
    time_window_seconds: float
    signal_threshold_dbm: float
    _read_buffer: Dict[str, List[Read]]
    _buffer_lock: threading.Lock
    _max_buffer_size: int
    _dedup_counter: Counter
    _buffer_size_gauge: Gauge

    def __init__(
        self,
        time_window_seconds: float = DEFAULT_TIME_WINDOW,
        signal_threshold_dbm: float = DEFAULT_SIGNAL_THRESHOLD,
        max_buffer_size: int = DEFAULT_MAX_BUFFER_SIZE
    ) -> None:
        """
        Initialize the deduplicator with configurable parameters and monitoring setup.
        
        Args:
            time_window_seconds: Time window for considering potential duplicates
            signal_threshold_dbm: Minimum signal strength difference for distinct reads
            max_buffer_size: Maximum number of reads to store in buffer
            
        Raises:
            ValueError: If parameters are invalid
        """
        if time_window_seconds <= 0:
            raise ValueError("Time window must be positive")
        if signal_threshold_dbm < 0:
            raise ValueError("Signal threshold must be non-negative")
        if max_buffer_size <= 0:
            raise ValueError("Buffer size must be positive")

        self.time_window_seconds = time_window_seconds
        self.signal_threshold_dbm = signal_threshold_dbm
        self._max_buffer_size = max_buffer_size
        self._read_buffer = {}
        self._buffer_lock = threading.Lock()

        # Initialize Prometheus metrics
        self._dedup_counter = Counter(
            f'{METRICS_PREFIX}_duplicates_total',
            'Total number of duplicate reads detected'
        )
        self._buffer_size_gauge = Gauge(
            f'{METRICS_PREFIX}_buffer_size',
            'Current size of the read buffer'
        )

    def process_reads(self, reads: List[Read]) -> List[Read]:
        """
        Process a batch of reads with thread-safe deduplication.
        
        Args:
            reads: List of Read objects to process
            
        Returns:
            List[Read]: Deduplicated list of reads
            
        Thread Safety:
            This method is thread-safe through the use of buffer lock
        """
        if not reads:
            return []

        deduplicated_reads: List[Read] = []
        
        with self._buffer_lock:
            # Clean expired reads first
            self._clean_buffer()
            
            for read in reads:
                # Skip if buffer is full
                total_reads = sum(len(reads) for reads in self._read_buffer.values())
                if total_reads >= self._max_buffer_size:
                    break
                    
                tag_reads = self._read_buffer.get(read.rfid_tag, [])
                
                # Check for duplicates
                is_duplicate = False
                for existing_read in tag_reads:
                    if self._is_duplicate(read, existing_read):
                        is_duplicate = True
                        self._dedup_counter.inc()
                        break
                
                if not is_duplicate:
                    # Add to buffer and result list
                    if read.rfid_tag not in self._read_buffer:
                        self._read_buffer[read.rfid_tag] = []
                    self._read_buffer[read.rfid_tag].append(read)
                    deduplicated_reads.append(read)
            
            # Update buffer size metric
            self._buffer_size_gauge.set(
                sum(len(reads) for reads in self._read_buffer.values())
            )
            
        return deduplicated_reads

    def _clean_buffer(self) -> None:
        """
        Remove expired reads from the buffer.
        
        Thread Safety:
            This method must be called with _buffer_lock held
        """
        current_time = datetime.now(timezone.utc)
        cutoff_time = current_time.timestamp() - self.time_window_seconds
        
        # Remove expired reads
        for tag in list(self._read_buffer.keys()):
            self._read_buffer[tag] = [
                read for read in self._read_buffer[tag]
                if read.read_time.timestamp() > cutoff_time
            ]
            
            # Remove empty tag entries
            if not self._read_buffer[tag]:
                del self._read_buffer[tag]

    def _is_duplicate(self, read: Read, existing_read: Read) -> bool:
        """
        Determine if a read is a duplicate based on time window and signal strength.
        
        Args:
            read: New read to check
            existing_read: Existing read to compare against
            
        Returns:
            bool: True if the read is considered a duplicate
        """
        # Validate signal strengths
        valid, _ = Read.validate_signal_strength(read.signal_strength)
        if not valid:
            return False
        
        valid, _ = Read.validate_signal_strength(existing_read.signal_strength)
        if not valid:
            return False

        # Check time window
        time_diff = abs(
            read.read_time.timestamp() - existing_read.read_time.timestamp()
        )
        if time_diff > self.time_window_seconds:
            return False

        # Compare signal strengths
        signal_diff = abs(read.signal_strength - existing_read.signal_strength)
        return signal_diff < self.signal_threshold_dbm