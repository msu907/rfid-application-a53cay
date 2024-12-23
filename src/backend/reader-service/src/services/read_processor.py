# External imports with versions
import asyncio  # Python 3.11
import logging  # Python 3.11
from typing import List, Dict, Optional, AsyncQueue  # Python 3.11
from dataclasses import dataclass  # Python 3.11
from prometheus_client import Counter, Gauge, Histogram  # v0.16.0

# Internal imports
from ..models.read import Read
from ..utils.deduplication import ReadDeduplicator
from ..utils.filtering import ReadFilter

# Global constants for configuration
BATCH_SIZE = 100
BATCH_TIMEOUT = 1.0  # seconds
PROCESSING_INTERVAL = 0.1  # seconds
MAX_QUEUE_SIZE = 10000
CIRCUIT_BREAKER_THRESHOLD = 0.15  # 15% error rate threshold
ERROR_WINDOW_SIZE = 300  # seconds

@dataclass
class ReadProcessor:
    """
    High-performance service class for processing RFID tag reads with deduplication,
    filtering, and comprehensive monitoring.

    This service implements batch processing, backpressure handling, and circuit breaker
    patterns for robust production operation.

    Attributes:
        _deduplicator (ReadDeduplicator): Handles read deduplication
        _filter (ReadFilter): Handles quality-based filtering
        _read_queue (AsyncQueue): Async queue for read processing
        _logger (Logger): Structured logging instance
        _running (bool): Service running state flag
        _metrics (Dict): Performance metrics collection
    """

    def __init__(
        self,
        time_window_seconds: float = 5.0,
        signal_threshold_dbm: float = 3.0,
        quality_threshold: float = 0.7,
        queue_size_limit: int = MAX_QUEUE_SIZE,
        batch_timeout: float = BATCH_TIMEOUT
    ) -> None:
        """
        Initialize the read processor with configurable parameters.

        Args:
            time_window_seconds: Time window for deduplication
            signal_threshold_dbm: Signal strength threshold for deduplication
            quality_threshold: Minimum quality score for reads
            queue_size_limit: Maximum queue size for backpressure
            batch_timeout: Maximum time to wait for batch completion
        """
        # Initialize components
        self._deduplicator = ReadDeduplicator(
            time_window_seconds=time_window_seconds,
            signal_threshold_dbm=signal_threshold_dbm
        )
        self._filter = ReadFilter(quality_threshold=quality_threshold)
        self._read_queue: AsyncQueue = asyncio.Queue(maxsize=queue_size_limit)
        
        # Setup logging
        self._logger = logging.getLogger(__name__)
        self._logger.setLevel(logging.INFO)
        
        # Initialize state
        self._running = False
        self._last_process_time = 0.0
        self._processed_count = 0
        self._error_counts: Dict[str, int] = {}
        
        # Initialize metrics
        self._setup_metrics()
        
        # Configuration
        self._batch_timeout = batch_timeout

    def _setup_metrics(self) -> None:
        """Initialize Prometheus metrics collectors."""
        self._metrics = {
            'reads_received': Counter(
                'rfid_processor_reads_received_total',
                'Total number of reads received'
            ),
            'reads_processed': Counter(
                'rfid_processor_reads_processed_total',
                'Total number of reads successfully processed'
            ),
            'processing_errors': Counter(
                'rfid_processor_errors_total',
                'Total number of processing errors',
                ['error_type']
            ),
            'queue_size': Gauge(
                'rfid_processor_queue_size',
                'Current size of the processing queue'
            ),
            'processing_time': Histogram(
                'rfid_processor_batch_duration_seconds',
                'Time taken to process a batch of reads',
                buckets=[0.1, 0.5, 1.0, 2.0, 5.0]
            )
        }

    async def start(self) -> None:
        """
        Start the read processor service with monitoring.
        
        Raises:
            RuntimeError: If service is already running
        """
        if self._running:
            raise RuntimeError("Service is already running")
            
        self._logger.info("Starting RFID read processor service")
        self._running = True
        
        # Start processing tasks
        asyncio.create_task(self._processing_loop())
        asyncio.create_task(self._monitor_health())
        
        self._logger.info("Read processor service started successfully")

    async def stop(self) -> None:
        """
        Gracefully stop the read processor service.
        """
        self._logger.info("Stopping read processor service")
        self._running = False
        
        # Process remaining items
        while not self._read_queue.empty():
            try:
                batch = []
                while not self._read_queue.empty() and len(batch) < BATCH_SIZE:
                    batch.append(await self._read_queue.get())
                await self._process_batch(batch)
            except Exception as e:
                self._logger.error(f"Error processing final batch: {str(e)}")
        
        self._logger.info(
            f"Service stopped. Final stats: Processed {self._processed_count} reads"
        )

    async def process_read(self, read: Read) -> bool:
        """
        Queue a read for processing with backpressure handling.

        Args:
            read: Read object to process

        Returns:
            bool: True if read was queued successfully

        Raises:
            ValueError: If read validation fails
        """
        try:
            # Validate read data
            valid, error_msg = read.validate_signal_strength(read.signal_strength)
            if not valid:
                raise ValueError(error_msg)
            
            self._metrics['reads_received'].inc()
            
            # Check queue capacity for backpressure
            if self._read_queue.qsize() >= self._read_queue.maxsize:
                self._logger.warning("Queue full - applying backpressure")
                return False
            
            # Add to processing queue
            await self._read_queue.put(read)
            self._metrics['queue_size'].set(self._read_queue.qsize())
            
            return True
            
        except Exception as e:
            self._logger.error(f"Error queueing read: {str(e)}")
            self._metrics['processing_errors'].labels(error_type='queue').inc()
            return False

    async def _process_batch(self, reads: List[Read]) -> None:
        """
        Process a batch of reads with comprehensive error handling.

        Args:
            reads: List of reads to process

        Raises:
            Exception: If batch processing fails
        """
        if not reads:
            return

        try:
            with self._metrics['processing_time'].time():
                # Apply quality filters
                filtered_reads = await self._filter.apply_filters(reads)
                
                # Perform deduplication
                deduplicated_reads = self._deduplicator.process_reads(filtered_reads)
                
                # Update metrics
                self._processed_count += len(deduplicated_reads)
                self._metrics['reads_processed'].inc(len(deduplicated_reads))
                
                self._logger.info(
                    f"Processed batch: {len(reads)} reads, "
                    f"{len(filtered_reads)} passed filters, "
                    f"{len(deduplicated_reads)} unique"
                )
                
        except Exception as e:
            self._logger.error(f"Batch processing error: {str(e)}")
            self._metrics['processing_errors'].labels(error_type='batch').inc()
            raise

    async def _processing_loop(self) -> None:
        """
        Main processing loop with batch optimization and error handling.
        """
        while self._running:
            try:
                batch = []
                # Start batch collection with timeout
                try:
                    while len(batch) < BATCH_SIZE:
                        read = await asyncio.wait_for(
                            self._read_queue.get(),
                            timeout=self._batch_timeout
                        )
                        batch.append(read)
                except asyncio.TimeoutError:
                    pass  # Process partial batch on timeout
                
                if batch:
                    await self._process_batch(batch)
                    
                # Update queue size metric
                self._metrics['queue_size'].set(self._read_queue.qsize())
                
                # Brief pause to prevent CPU spinning
                await asyncio.sleep(PROCESSING_INTERVAL)
                
            except Exception as e:
                self._logger.error(f"Processing loop error: {str(e)}")
                self._metrics['processing_errors'].labels(error_type='loop').inc()
                
                # Circuit breaker pattern
                if self._check_error_threshold():
                    self._logger.critical("Error threshold exceeded - circuit breaker triggered")
                    await asyncio.sleep(1.0)  # Brief pause before retry

    async def _monitor_health(self) -> None:
        """
        Monitor service health and performance metrics.
        """
        while self._running:
            try:
                queue_size = self._read_queue.qsize()
                queue_capacity = queue_size / self._read_queue.maxsize
                
                if queue_capacity > 0.9:  # 90% capacity warning
                    self._logger.warning(f"Queue near capacity: {queue_capacity:.1%}")
                
                # Log performance metrics
                self._logger.info(
                    f"Health check - Queue: {queue_size}, "
                    f"Processed: {self._processed_count}, "
                    f"Errors: {sum(self._error_counts.values())}"
                )
                
                await asyncio.sleep(5.0)  # Health check interval
                
            except Exception as e:
                self._logger.error(f"Health monitoring error: {str(e)}")

    def _check_error_threshold(self) -> bool:
        """
        Check if error rate exceeds circuit breaker threshold.

        Returns:
            bool: True if error threshold is exceeded
        """
        total_errors = sum(self._error_counts.values())
        total_processed = self._processed_count or 1  # Prevent division by zero
        error_rate = total_errors / total_processed
        
        return error_rate > CIRCUIT_BREAKER_THRESHOLD