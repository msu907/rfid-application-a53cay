# External imports with versions
from fastapi import APIRouter, HTTPException, Depends  # v0.95.0
from grpc import StatusCode  # v1.51.0
from pydantic import BaseModel, ValidationError  # v2.0
from prometheus_client import Counter, Gauge, Histogram  # v0.16.0
from opentelemetry import trace  # v1.15.0
from opentelemetry.trace import Status, StatusCode as OTelStatusCode
from circuitbreaker import circuit  # v1.4.0
import logging
import asyncio
from typing import List, Dict, Optional
from datetime import datetime, timezone
from uuid import UUID

# Internal imports
from ..models.reader import Reader, ReaderStatus, PowerLevel
from ..services.llrp_service import LLRPService
from ..services.read_processor import ReadProcessor

# Global constants
BATCH_SIZE = 100
PROCESSING_TIMEOUT = 30  # seconds
HEALTH_CHECK_INTERVAL = 30  # seconds

# Initialize router with prefix
router = APIRouter(prefix="/api/v1")

# Initialize tracer
tracer = trace.get_tracer(__name__)

class ReaderController:
    """
    Enhanced controller for RFID reader management with comprehensive monitoring,
    batch processing, and reliability features.
    """

    def __init__(
        self,
        llrp_service: LLRPService,
        read_processor: ReadProcessor,
        metrics_client: Optional[object] = None,
        circuit_breaker: Optional[object] = None
    ):
        """
        Initialize controller with required services and monitoring setup.

        Args:
            llrp_service: Service for LLRP protocol communication
            read_processor: Service for processing read events
            metrics_client: Optional metrics collection client
            circuit_breaker: Optional circuit breaker for reliability
        """
        self._llrp_service = llrp_service
        self._read_processor = read_processor
        self._circuit_breaker = circuit_breaker
        self._logger = logging.getLogger(__name__)
        
        # Initialize metrics
        self._read_counter = Counter(
            'rfid_controller_reads_total',
            'Total number of RFID reads processed',
            ['reader_id', 'status']
        )
        self._active_readers = Gauge(
            'rfid_controller_active_readers',
            'Number of currently active RFID readers'
        )
        self._processing_latency = Histogram(
            'rfid_controller_processing_latency_seconds',
            'Time taken to process RFID reads',
            ['reader_id']
        )

        # Initialize reader state
        self._readers: Dict[str, Reader] = {}
        self._processing_tasks: Dict[str, asyncio.Task] = {}

    @router.post("/readers", response_model=Reader)
    @circuit(failure_threshold=5, recovery_timeout=30)
    async def register_reader(self, reader: Reader) -> Reader:
        """
        Register a new RFID reader with enhanced validation and monitoring.

        Args:
            reader: Reader configuration to register

        Returns:
            Registered Reader instance

        Raises:
            HTTPException: If registration fails
        """
        with tracer.start_as_current_span("register_reader") as span:
            span.set_attribute("reader_id", str(reader.id))
            
            try:
                # Validate reader health
                health_status = reader.is_healthy()
                if not health_status["heartbeat_ok"]:
                    raise HTTPException(
                        status_code=400,
                        detail="Reader failed health check"
                    )

                # Connect to reader
                success = await self._llrp_service.connect_reader(reader)
                if not success:
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to connect to reader"
                    )

                # Store reader reference
                self._readers[str(reader.id)] = reader
                self._active_readers.inc()

                # Start processing task
                self._processing_tasks[str(reader.id)] = asyncio.create_task(
                    self._process_reader_reads(reader)
                )

                span.set_status(Status(OTelStatusCode.OK))
                return reader

            except Exception as e:
                span.set_status(Status(OTelStatusCode.ERROR), str(e))
                self._logger.error(f"Reader registration failed: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Registration failed: {str(e)}"
                )

    @router.post("/readers/{reader_id}/batch")
    async def process_batch(self, reader_id: str, read_events: List[dict]) -> dict:
        """
        Process a batch of read events with optimized performance.

        Args:
            reader_id: ID of the reader that generated the reads
            read_events: List of read events to process

        Returns:
            Processing results summary

        Raises:
            HTTPException: If batch processing fails
        """
        with tracer.start_as_current_span("process_batch") as span:
            span.set_attribute("reader_id", reader_id)
            span.set_attribute("batch_size", len(read_events))

            try:
                reader = self._readers.get(reader_id)
                if not reader:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Reader {reader_id} not found"
                    )

                # Process batch with timeout
                with self._processing_latency.labels(reader_id=reader_id).time():
                    results = await asyncio.wait_for(
                        self._llrp_service.process_batch(reader_id, read_events),
                        timeout=PROCESSING_TIMEOUT
                    )

                # Update metrics
                self._read_counter.labels(
                    reader_id=reader_id,
                    status="success"
                ).inc(len(read_events))

                span.set_status(Status(OTelStatusCode.OK))
                return {
                    "processed": len(read_events),
                    "success": True,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

            except asyncio.TimeoutError:
                span.set_status(
                    Status(OTelStatusCode.ERROR),
                    "Batch processing timeout"
                )
                raise HTTPException(
                    status_code=408,
                    detail="Batch processing timeout"
                )
            except Exception as e:
                span.set_status(Status(OTelStatusCode.ERROR), str(e))
                self._logger.error(f"Batch processing error: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Processing failed: {str(e)}"
                )

    @router.get("/health")
    async def health_check(self) -> dict:
        """
        Perform comprehensive health check of reader system.

        Returns:
            System health status details
        """
        with tracer.start_as_current_span("health_check") as span:
            try:
                health_status = {
                    "status": "healthy",
                    "active_readers": len(self._readers),
                    "readers": {},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

                # Check each reader's health
                for reader_id, reader in self._readers.items():
                    reader_health = reader.is_healthy()
                    health_status["readers"][reader_id] = reader_health

                    if not reader_health["heartbeat_ok"]:
                        health_status["status"] = "degraded"

                span.set_status(Status(OTelStatusCode.OK))
                return health_status

            except Exception as e:
                span.set_status(Status(OTelStatusCode.ERROR), str(e))
                self._logger.error(f"Health check failed: {str(e)}")
                return {
                    "status": "unhealthy",
                    "error": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

    async def _process_reader_reads(self, reader: Reader) -> None:
        """
        Background task for continuous read processing from a reader.

        Args:
            reader: Reader instance to process reads from
        """
        try:
            while str(reader.id) in self._readers:
                # Process any available reads
                await self._llrp_service._handle_reads(reader)
                await asyncio.sleep(0.1)  # Prevent CPU spinning

        except Exception as e:
            self._logger.error(
                f"Read processing error for reader {reader.id}: {str(e)}"
            )
            await reader.update_status(
                ReaderStatus.ERROR,
                f"Processing error: {str(e)}"
            )
        finally:
            # Cleanup if task is stopping
            if str(reader.id) in self._processing_tasks:
                del self._processing_tasks[str(reader.id)]
            self._active_readers.dec()

# Export controller class
__all__ = ['ReaderController']