# External imports with versions
import logging  # v3.11
from python_json_logger import jsonlogger  # v2.0.7
import os  # v3.11
from typing import Dict, Optional
from datetime import datetime, timezone
import threading
import psutil  # v5.9.5 for system metrics

# Internal imports
from .app import app
from .models.read import Read
from .models.reader import Reader, ReaderStatus, PowerLevel

# Package version
__version__ = "1.0.0"

# Global configuration
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
LOG_FORMAT = {
    "timestamp": "%(asctime)s",
    "level": "%(levelname)s",
    "correlation_id": "%(correlation_id)s",
    "service": "reader-service",
    "message": "%(message)s"
}

# Initialize package-level logger
logger = logging.getLogger(__name__)

class CorrelationIDFilter(logging.Filter):
    """Filter that adds correlation ID to log records."""
    def __init__(self):
        super().__init__()
        self._local = threading.local()

    def filter(self, record):
        """Add correlation_id from thread local storage to log record."""
        record.correlation_id = getattr(self._local, 'correlation_id', '-')
        return True

def configure_package_logging() -> None:
    """
    Configures enhanced package-level logging with JSON formatting, correlation IDs,
    and multiple handlers for comprehensive monitoring.
    """
    try:
        # Create JSON formatter
        formatter = jsonlogger.JsonFormatter(
            fmt=str(LOG_FORMAT),
            datefmt="%Y-%m-%d %H:%M:%S",
            json_ensure_ascii=False
        )

        # Configure console handler
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)

        # Configure file handler with rotation
        file_handler = logging.handlers.RotatingFileHandler(
            filename=os.getenv('LOG_FILE', 'reader-service.log'),
            maxBytes=10_000_000,  # 10MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setFormatter(formatter)

        # Set logging level from environment
        log_level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)
        logger.setLevel(log_level)

        # Add correlation ID filter
        correlation_filter = CorrelationIDFilter()
        logger.addFilter(correlation_filter)
        
        # Add handlers
        logger.addHandler(console_handler)
        logger.addHandler(file_handler)

        # Configure thread-safe logging
        logger.propagate = False

        logger.info(
            "Logging configured successfully",
            extra={"service_version": __version__}
        )

    except Exception as e:
        # Fallback to basic logging if configuration fails
        logging.basicConfig(level=logging.INFO)
        logging.error(f"Failed to configure logging: {str(e)}")
        raise

def get_service_status() -> Dict:
    """
    Returns comprehensive service status including version, uptime, and health metrics.

    Returns:
        Dict containing service status information
    """
    try:
        # Get process information
        process = psutil.Process()
        
        # Calculate uptime
        start_time = datetime.fromtimestamp(process.create_time(), tz=timezone.utc)
        uptime = (datetime.now(timezone.utc) - start_time).total_seconds()

        # Collect system metrics
        cpu_percent = process.cpu_percent()
        memory_info = process.memory_info()
        
        # Build status response
        status = {
            "service": "reader-service",
            "version": __version__,
            "status": "healthy",
            "uptime_seconds": uptime,
            "metrics": {
                "cpu_percent": cpu_percent,
                "memory_rss_bytes": memory_info.rss,
                "memory_vms_bytes": memory_info.vms,
                "thread_count": process.num_threads()
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        logger.info("Service status checked", extra={"status": status["status"]})
        return status

    except Exception as e:
        logger.error(f"Error getting service status: {str(e)}")
        return {
            "service": "reader-service",
            "version": __version__,
            "status": "error",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

# Configure logging on module import
configure_package_logging()

# Export public interface
__all__ = [
    'app',
    'Read',
    'Reader',
    'ReaderStatus',
    'PowerLevel',
    'get_service_status',
    '__version__'
]