# External imports with versions
from fastapi import FastAPI, HTTPException  # v0.95.0
import uvicorn  # v0.21.0
from prometheus_client import start_http_server  # v0.16.0
from opentelemetry import trace  # v1.15.0
from opentelemetry.trace import Status, StatusCode
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
import logging
import asyncio
import os
from typing import Dict, Optional
import signal

# Internal imports
from .controllers.reader_controller import ReaderController
from .services.llrp_service import LLRPService
from .services.read_processor import ReadProcessor

# Initialize FastAPI application with OpenAPI documentation
app = FastAPI(
    title="RFID Reader Service",
    version="1.0.0",
    description="Enterprise RFID reader management and data processing service",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Initialize OpenTelemetry tracing
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)
otlp_exporter = OTLPSpanExporter(
    endpoint=os.getenv("OTLP_ENDPOINT", "localhost:4317")
)
span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# Initialize core services with configuration from environment
read_processor = ReadProcessor(
    time_window_seconds=float(os.getenv('READ_WINDOW_SECONDS', '1.0')),
    signal_threshold_dbm=float(os.getenv('SIGNAL_THRESHOLD_DBM', '-70')),
    quality_threshold=float(os.getenv('QUALITY_THRESHOLD', '0.8')),
    queue_size_limit=int(os.getenv('QUEUE_SIZE_LIMIT', '10000'))
)

llrp_service = LLRPService(
    processor=read_processor,
    circuit_breaker=None  # Optional circuit breaker configuration
)

reader_controller = ReaderController(
    llrp_service=llrp_service,
    read_processor=read_processor
)

# Register controller routes
app.include_router(reader_controller.router)

@app.on_event("startup")
async def startup() -> None:
    """
    FastAPI startup event handler that initializes services with proper error handling
    and monitoring setup.
    """
    with tracer.start_as_current_span("app_startup") as span:
        try:
            # Start Prometheus metrics server
            metrics_port = int(os.getenv('METRICS_PORT', '9090'))
            start_http_server(metrics_port)
            logger.info(f"Prometheus metrics server started on port {metrics_port}")

            # Initialize and start services
            await read_processor.start()
            logger.info("Read processor service started successfully")

            # Configure graceful shutdown handlers
            for sig in (signal.SIGTERM, signal.SIGINT):
                asyncio.get_event_loop().add_signal_handler(
                    sig,
                    lambda s=sig: asyncio.create_task(shutdown(sig=s))
                )

            span.set_status(Status(StatusCode.OK))
            logger.info("Application startup completed successfully")

        except Exception as e:
            error_msg = f"Application startup failed: {str(e)}"
            logger.error(error_msg)
            span.set_status(Status(StatusCode.ERROR), error_msg)
            raise RuntimeError(error_msg)

@app.on_event("shutdown")
async def shutdown(sig: Optional[signal.Signals] = None) -> None:
    """
    FastAPI shutdown event handler that gracefully stops services with proper cleanup.
    
    Args:
        sig: Optional signal that triggered the shutdown
    """
    with tracer.start_as_current_span("app_shutdown") as span:
        try:
            if sig:
                logger.info(f"Received shutdown signal: {sig.name}")

            # Stop accepting new connections
            logger.info("Stopping services...")

            # Gracefully stop services
            await read_processor.stop()
            logger.info("Read processor stopped")

            # Cleanup tracing
            trace.get_tracer_provider().shutdown()
            logger.info("Tracing shutdown completed")

            span.set_status(Status(StatusCode.OK))
            logger.info("Application shutdown completed successfully")

        except Exception as e:
            error_msg = f"Error during shutdown: {str(e)}"
            logger.error(error_msg)
            span.set_status(Status(StatusCode.ERROR), error_msg)
            raise RuntimeError(error_msg)

def main() -> None:
    """
    Application entry point that starts the FastAPI server with production configurations.
    """
    try:
        # Load configuration from environment
        host = os.getenv('SERVICE_HOST', '0.0.0.0')
        port = int(os.getenv('SERVICE_PORT', '8000'))
        workers = int(os.getenv('WORKER_COUNT', '4'))
        
        # Configure uvicorn with production settings
        config = uvicorn.Config(
            app=app,
            host=host,
            port=port,
            workers=workers,
            loop="uvloop",
            log_level="info",
            proxy_headers=True,
            forwarded_allow_ips="*",
            access_log=True
        )
        
        server = uvicorn.Server(config)
        server.run()

    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}")
        raise

if __name__ == "__main__":
    main()