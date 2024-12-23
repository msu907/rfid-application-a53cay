# External imports with versions
import pytest  # v7.3.1
import pytest_asyncio  # v0.21.0
from unittest.mock import AsyncMock, MagicMock, patch  # Python 3.11
import asyncio  # Python 3.11
from datetime import datetime, timezone  # Python 3.11
from typing import List, Dict, Optional  # Python 3.11
from prometheus_client import Counter, Gauge, Histogram  # v0.17.1

# Internal imports
from ..src.services.read_processor import ReadProcessor
from ..src.models.read import Read
from ..src.utils.deduplication import ReadDeduplicator
from ..src.utils.filtering import ReadFilter

# Test constants
TEST_TIME_WINDOW = 5.0
TEST_SIGNAL_THRESHOLD = -50.0
TEST_QUALITY_THRESHOLD = 0.7
BATCH_SIZE = 100
PROCESSING_TIMEOUT = 1.0
PERFORMANCE_THRESHOLD = 0.5  # 500ms performance requirement
MAX_MEMORY_USAGE = 512  # MB
ERROR_THRESHOLD = 0.01  # 1% error rate threshold

@pytest.mark.asyncio
class TestReadProcessor:
    """
    Comprehensive test suite for ReadProcessor service including performance 
    and metrics validation.
    """

    async def setup_method(self):
        """Setup method run before each test."""
        # Initialize processor with test configuration
        self.processor = ReadProcessor(
            time_window_seconds=TEST_TIME_WINDOW,
            signal_threshold_dbm=TEST_SIGNAL_THRESHOLD,
            quality_threshold=TEST_QUALITY_THRESHOLD
        )
        
        # Mock metrics collectors
        self.mock_metrics = {
            'reads_received': MagicMock(spec=Counter),
            'reads_processed': MagicMock(spec=Counter),
            'processing_errors': MagicMock(spec=Counter),
            'queue_size': MagicMock(spec=Gauge),
            'processing_time': MagicMock(spec=Histogram)
        }
        self.processor._metrics = self.mock_metrics

    async def teardown_method(self):
        """Cleanup method run after each test."""
        if self.processor._running:
            await self.processor.stop()

    @pytest.mark.asyncio
    async def test_read_processor_initialization(self):
        """Tests the correct initialization of ReadProcessor with default parameters."""
        processor = ReadProcessor()
        
        # Verify component initialization
        assert isinstance(processor._deduplicator, ReadDeduplicator)
        assert isinstance(processor._filter, ReadFilter)
        assert isinstance(processor._read_queue, asyncio.Queue)
        assert not processor._running
        assert processor._processed_count == 0
        assert isinstance(processor._error_counts, dict)
        
        # Verify metrics setup
        assert all(metric in processor._metrics for metric in [
            'reads_received', 'reads_processed', 'processing_errors',
            'queue_size', 'processing_time'
        ])

    @pytest.mark.asyncio
    async def test_read_processor_start_stop(self):
        """Tests the start and stop functionality of ReadProcessor."""
        # Start processor
        await self.processor.start()
        assert self.processor._running
        assert self.processor._read_queue.empty()
        
        # Verify processing tasks are created
        tasks = [task for task in asyncio.all_tasks() 
                if 'processing_loop' in str(task) or 'monitor_health' in str(task)]
        assert len(tasks) == 2
        
        # Stop processor
        await self.processor.stop()
        assert not self.processor._running
        assert self.processor._read_queue.empty()
        
        # Verify tasks are cleaned up
        await asyncio.sleep(0.1)  # Allow tasks to complete
        tasks = [task for task in asyncio.all_tasks() 
                if 'processing_loop' in str(task) or 'monitor_health' in str(task)]
        assert len(tasks) == 0

    @pytest.mark.asyncio
    async def test_process_single_read(self, mock_read):
        """Tests processing of a single read event with performance validation."""
        await self.processor.start()
        
        # Record start time
        start_time = asyncio.get_event_loop().time()
        
        # Process read
        success = await self.processor.process_read(mock_read)
        assert success
        
        # Wait for processing to complete
        await asyncio.sleep(0.1)
        
        # Verify processing time
        end_time = asyncio.get_event_loop().time()
        processing_time = end_time - start_time
        assert processing_time < PERFORMANCE_THRESHOLD
        
        # Verify metrics
        self.mock_metrics['reads_received'].inc.assert_called_once()
        self.mock_metrics['queue_size'].set.assert_called()
        
        # Verify read was processed
        assert self.processor._processed_count > 0

    @pytest.mark.asyncio
    async def test_batch_processing(self, mock_read):
        """Tests processing of multiple reads in batch with deduplication."""
        await self.processor.start()
        
        # Generate test batch with duplicates
        test_reads = []
        for i in range(BATCH_SIZE):
            read = Read(
                rfid_tag=mock_read.rfid_tag,
                reader_id=mock_read.reader_id,
                signal_strength=TEST_SIGNAL_THRESHOLD
            )
            test_reads.append(read)
        
        # Process batch
        start_time = asyncio.get_event_loop().time()
        for read in test_reads:
            await self.processor.process_read(read)
        
        # Wait for batch processing
        await asyncio.sleep(PROCESSING_TIMEOUT)
        
        # Verify processing time for batch
        end_time = asyncio.get_event_loop().time()
        batch_processing_time = end_time - start_time
        assert batch_processing_time < PERFORMANCE_THRESHOLD * 2  # Allow extra time for batch
        
        # Verify deduplication
        assert self.processor._processed_count < len(test_reads)
        
        # Verify metrics
        assert self.mock_metrics['reads_received'].inc.call_count == len(test_reads)
        self.mock_metrics['processing_time'].time.assert_called()

    @pytest.mark.asyncio
    async def test_error_handling(self):
        """Tests comprehensive error handling scenarios."""
        await self.processor.start()
        
        # Test invalid read
        invalid_read = MagicMock(spec=Read)
        invalid_read.validate_signal_strength.return_value = (False, "Invalid signal")
        
        success = await self.processor.process_read(invalid_read)
        assert not success
        self.mock_metrics['processing_errors'].labels.assert_called_with(
            error_type='queue'
        )
        
        # Test queue overflow
        self.processor._read_queue = asyncio.Queue(maxsize=1)
        reads = [mock_read for _ in range(5)]
        
        for read in reads:
            await self.processor.process_read(read)
        
        # Verify backpressure handling
        assert self.processor._read_queue.full()
        
        # Test circuit breaker
        self.processor._error_counts = {'processing': int(1/ERROR_THRESHOLD) + 1}
        assert self.processor._check_error_threshold()
        
        # Verify error metrics
        assert self.mock_metrics['processing_errors'].labels.call_count > 0

    @pytest.mark.asyncio
    async def test_performance_under_load(self, mock_read):
        """Tests processor performance under high load conditions."""
        await self.processor.start()
        
        # Generate large batch of reads
        test_reads = [mock_read for _ in range(BATCH_SIZE * 2)]
        
        # Measure processing time under load
        start_time = asyncio.get_event_loop().time()
        
        tasks = []
        for read in test_reads:
            task = asyncio.create_task(self.processor.process_read(read))
            tasks.append(task)
        
        await asyncio.gather(*tasks)
        await asyncio.sleep(PROCESSING_TIMEOUT)
        
        end_time = asyncio.get_event_loop().time()
        total_time = end_time - start_time
        
        # Verify performance meets requirements
        reads_per_second = len(test_reads) / total_time
        assert reads_per_second > BATCH_SIZE  # Should process at least BATCH_SIZE reads per second
        
        # Verify memory usage
        import psutil
        process = psutil.Process()
        memory_usage = process.memory_info().rss / (1024 * 1024)  # Convert to MB
        assert memory_usage < MAX_MEMORY_USAGE

    @pytest.mark.asyncio
    async def test_metrics_accuracy(self, mock_read):
        """Tests accuracy of metrics collection and reporting."""
        await self.processor.start()
        
        # Process some reads
        test_reads = [mock_read for _ in range(10)]
        for read in test_reads:
            await self.processor.process_read(read)
        
        await asyncio.sleep(0.1)
        
        # Verify metrics accuracy
        assert self.mock_metrics['reads_received'].inc.call_count == len(test_reads)
        assert self.mock_metrics['queue_size'].set.call_count > 0
        assert self.mock_metrics['processing_time'].time.call_count > 0
        
        # Verify processed count matches metrics
        assert self.processor._processed_count > 0
        assert self.mock_metrics['reads_processed'].inc.call_count > 0