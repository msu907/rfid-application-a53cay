"""
RFID Reader Service Configuration Module
Version: 1.0
Description: Comprehensive configuration settings for RFID reader service with validation
"""

# External imports
import os
from typing import Tuple
from dotenv import load_dotenv  # version: 1.0.0
from pydantic import BaseSettings, Field, validator  # version: 2.0

# Load environment variables from .env file if present
load_dotenv()

# Default configuration values
DEFAULT_READ_INTERVAL_MS = 1000
DEFAULT_MAX_CONCURRENT_READERS = 15
DEFAULT_MIN_SIGNAL_STRENGTH_DBM = -70.0
DEFAULT_MAX_SIGNAL_STRENGTH_DBM = -20.0
DEFAULT_HEALTH_CHECK_INTERVAL_SEC = 60
DEFAULT_DEDUPLICATION_WINDOW_MS = 5000
DEFAULT_LOG_LEVEL = "INFO"
DEFAULT_METRICS_PORT = 9090
DEFAULT_MAX_READ_BATCH_SIZE = 1000
DEFAULT_READ_PROCESSING_TIMEOUT_MS = 500

class Settings(BaseSettings):
    """
    RFID Reader Service configuration settings with comprehensive validation.
    All settings can be overridden using environment variables with the same name.
    """
    
    # Reader Performance Settings
    READ_INTERVAL_MS: int = Field(
        default=DEFAULT_READ_INTERVAL_MS,
        ge=100,
        le=5000,
        description="Interval between RFID reads in milliseconds"
    )
    
    MAX_CONCURRENT_READERS: int = Field(
        default=DEFAULT_MAX_CONCURRENT_READERS,
        ge=1,
        le=100,
        description="Maximum number of concurrent RFID readers supported"
    )
    
    MIN_SIGNAL_STRENGTH_DBM: float = Field(
        default=DEFAULT_MIN_SIGNAL_STRENGTH_DBM,
        description="Minimum acceptable RFID signal strength in dBm"
    )
    
    MAX_SIGNAL_STRENGTH_DBM: float = Field(
        default=DEFAULT_MAX_SIGNAL_STRENGTH_DBM,
        description="Maximum acceptable RFID signal strength in dBm"
    )
    
    READER_HEALTH_CHECK_INTERVAL_SEC: int = Field(
        default=DEFAULT_HEALTH_CHECK_INTERVAL_SEC,
        ge=10,
        le=300,
        description="Interval between reader health checks in seconds"
    )
    
    READ_DEDUPLICATION_WINDOW_MS: int = Field(
        default=DEFAULT_DEDUPLICATION_WINDOW_MS,
        ge=1000,
        le=60000,
        description="Time window for deduplicating repeated reads in milliseconds"
    )
    
    # Logging and Monitoring
    LOG_LEVEL: str = Field(
        default=DEFAULT_LOG_LEVEL,
        regex="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$",
        description="Logging level for the service"
    )
    
    METRICS_PORT: int = Field(
        default=DEFAULT_METRICS_PORT,
        ge=1024,
        le=65535,
        description="Port for exposing Prometheus metrics"
    )
    
    # Performance Tuning
    MAX_READ_BATCH_SIZE: int = Field(
        default=DEFAULT_MAX_READ_BATCH_SIZE,
        ge=100,
        le=5000,
        description="Maximum number of reads to process in a single batch"
    )
    
    READ_PROCESSING_TIMEOUT_MS: int = Field(
        default=DEFAULT_READ_PROCESSING_TIMEOUT_MS,
        ge=100,
        le=2000,
        description="Timeout for processing a single read in milliseconds"
    )
    
    # Kafka Configuration
    KAFKA_BOOTSTRAP_SERVERS: str = Field(
        default="localhost:9092",
        regex="^[a-zA-Z0-9\-\.,]+:\d+$",
        description="Comma-separated list of Kafka bootstrap servers"
    )
    
    KAFKA_TOPIC_READS: str = Field(
        default="rfid.reads",
        regex="^[a-zA-Z0-9\-\.]+$",
        description="Kafka topic for publishing RFID reads"
    )
    
    KAFKA_SECURITY_PROTOCOL: str = Field(
        default="PLAINTEXT",
        regex="^(PLAINTEXT|SSL|SASL_PLAINTEXT|SASL_SSL)$",
        description="Kafka security protocol"
    )
    
    KAFKA_SASL_MECHANISM: str = Field(
        default="PLAIN",
        regex="^(PLAIN|SCRAM-SHA-256|SCRAM-SHA-512)$",
        description="Kafka SASL mechanism"
    )
    
    KAFKA_USERNAME: str = Field(
        default="",
        description="Kafka SASL username"
    )
    
    KAFKA_PASSWORD: str = Field(
        default="",
        description="Kafka SASL password"
    )
    
    @validator('MIN_SIGNAL_STRENGTH_DBM', 'MAX_SIGNAL_STRENGTH_DBM')
    def validate_signal_strength(cls, v: float, values: dict, field: str) -> float:
        """
        Validates signal strength values according to RFID specifications.
        
        Args:
            v (float): Signal strength value to validate
            values (dict): Previously validated values
            field (str): Field name being validated
        
        Returns:
            float: Validated signal strength value
        
        Raises:
            ValueError: If signal strength is outside valid range or min > max
        """
        if v < -70.0 or v > -20.0:
            raise ValueError(f"Signal strength must be between -70.0 and -20.0 dBm, got {v}")
            
        if field == 'MAX_SIGNAL_STRENGTH_DBM' and 'MIN_SIGNAL_STRENGTH_DBM' in values:
            if v <= values['MIN_SIGNAL_STRENGTH_DBM']:
                raise ValueError(
                    f"MAX_SIGNAL_STRENGTH_DBM ({v}) must be greater than "
                    f"MIN_SIGNAL_STRENGTH_DBM ({values['MIN_SIGNAL_STRENGTH_DBM']})"
                )
        
        return v
    
    class Config:
        """Pydantic model configuration"""
        case_sensitive = True
        env_file = '.env'
        validate_assignment = True

# Create singleton instance of settings
settings = Settings()

# Export all settings
__all__ = ['settings']