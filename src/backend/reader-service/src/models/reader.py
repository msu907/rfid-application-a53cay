# External imports with versions
from dataclasses import dataclass, field  # Python 3.11
from datetime import datetime, timezone  # Python 3.11
from enum import Enum  # Python 3.11
from pydantic import dataclasses  # v2.0
import re  # Python 3.11
from typing import Dict, List, Optional
from uuid import UUID, uuid4

# Internal imports
from .read import validate_signal_strength

# Global constants
DEFAULT_PORT = 5084
DEFAULT_READ_INTERVAL_MS = 1000
HEARTBEAT_THRESHOLD_SECONDS = 60
IP_ADDRESS_PATTERN = r'^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$'
STATUS_TRANSITION_MATRIX = {
    "OFFLINE": ["ONLINE", "MAINTENANCE"],
    "ONLINE": ["OFFLINE", "ERROR", "MAINTENANCE"],
    "ERROR": ["OFFLINE", "MAINTENANCE"],
    "MAINTENANCE": ["OFFLINE"]
}

class ReaderStatus(Enum):
    """
    Enumeration of possible RFID reader operational states.
    Transitions between states are governed by STATUS_TRANSITION_MATRIX.
    """
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    ERROR = "ERROR"
    MAINTENANCE = "MAINTENANCE"

class PowerLevel(Enum):
    """
    Enumeration of reader power level settings with corresponding dBm ranges.
    LOW: -70dBm to -55dBm
    MEDIUM: -55dBm to -35dBm
    HIGH: -35dBm to -20dBm
    """
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

    def get_dbm_range(self) -> tuple[float, float]:
        """Returns the dBm range for the power level."""
        ranges = {
            PowerLevel.LOW: (-70.0, -55.0),
            PowerLevel.MEDIUM: (-55.0, -35.0),
            PowerLevel.HIGH: (-35.0, -20.0)
        }
        return ranges[self]

@dataclass
@dataclasses.dataclass(frozen=False, config=dict(validate_assignment=True))
class Reader:
    """
    Represents a physical RFID reader device with comprehensive configuration,
    status management, and health monitoring capabilities.
    
    Implements LLRP Version 1.1 protocol support with configurable settings
    and real-time health monitoring.
    """
    
    # Required fields
    name: str
    ip_address: str
    port: int = field(default=DEFAULT_PORT)
    power_level: PowerLevel = field(default=PowerLevel.MEDIUM)
    read_interval_ms: int = field(default=DEFAULT_READ_INTERVAL_MS)
    
    # Auto-generated and managed fields
    id: UUID = field(default_factory=uuid4)
    status: ReaderStatus = field(default=ReaderStatus.OFFLINE)
    filtering_enabled: bool = field(default=True)
    last_heartbeat: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    additional_params: Dict = field(default_factory=dict)
    status_history: List[Dict] = field(default_factory=list)
    health_metrics: Dict = field(default_factory=lambda: {
        "read_success_rate": 100.0,
        "signal_strength_avg": -45.0,
        "network_latency_ms": 0.0,
        "error_count": 0,
        "total_reads": 0
    })

    def __post_init__(self):
        """
        Validates all fields after initialization and sets up the reader configuration.
        Raises ValueError if any validation fails.
        """
        # Validate IP address format
        if not re.match(IP_ADDRESS_PATTERN, self.ip_address):
            raise ValueError(f"Invalid IP address format: {self.ip_address}")
        
        # Validate port range
        if not 1 <= self.port <= 65535:
            raise ValueError(f"Port must be between 1 and 65535, got {self.port}")
        
        # Validate read interval
        if self.read_interval_ms < 100:
            raise ValueError(f"Read interval must be at least 100ms, got {self.read_interval_ms}")
        
        # Initialize status history
        self.status_history.append({
            "timestamp": datetime.now(timezone.utc),
            "status": self.status,
            "reason": "Initial configuration"
        })

    def update_status(self, new_status: ReaderStatus, reason: str) -> bool:
        """
        Updates the reader's operational status with validation and history tracking.
        
        Args:
            new_status: The new status to set
            reason: Reason for the status change
            
        Returns:
            bool: True if status was updated successfully
            
        Raises:
            ValueError: If the status transition is not allowed
        """
        if new_status.value not in STATUS_TRANSITION_MATRIX.get(self.status.value, []):
            raise ValueError(
                f"Invalid status transition from {self.status.value} to {new_status.value}"
            )
        
        # Update status and record in history
        old_status = self.status
        self.status = new_status
        self.last_heartbeat = datetime.now(timezone.utc)
        
        # Record status change
        self.status_history.append({
            "timestamp": self.last_heartbeat,
            "old_status": old_status,
            "new_status": new_status,
            "reason": reason
        })
        
        # Update health metrics
        if new_status == ReaderStatus.ERROR:
            self.health_metrics["error_count"] += 1
        
        return True

    def is_healthy(self) -> dict:
        """
        Performs comprehensive health check of reader operations.
        
        Returns:
            dict: Health check results including detailed metrics
        """
        current_time = datetime.now(timezone.utc)
        heartbeat_age = (current_time - self.last_heartbeat).total_seconds()
        
        health_status = {
            "status": self.status.value,
            "is_online": self.status == ReaderStatus.ONLINE,
            "heartbeat_age_seconds": heartbeat_age,
            "heartbeat_ok": heartbeat_age <= HEARTBEAT_THRESHOLD_SECONDS,
            "power_level": self.power_level.value,
            "metrics": self.health_metrics.copy(),
            "last_error": None if not self.status_history else next(
                (entry for entry in reversed(self.status_history)
                 if entry["new_status"] == ReaderStatus.ERROR),
                None
            )
        }
        
        # Validate current signal strength against power level range
        min_dbm, max_dbm = self.power_level.get_dbm_range()
        signal_valid, _ = validate_signal_strength(self.health_metrics["signal_strength_avg"])
        health_status["signal_strength_ok"] = signal_valid
        
        return health_status

    def to_proto(self) -> 'ReaderProto':
        """
        Converts reader instance to protobuf message.
        
        Returns:
            ReaderProto: Protobuf representation of reader
            
        Raises:
            ImportError: If protobuf module is not available
        """
        try:
            from ..protos.reader_pb2 import ReaderProto, ReaderStatusProto, PowerLevelProto
            
            proto_msg = ReaderProto()
            proto_msg.id = str(self.id)
            proto_msg.name = self.name
            proto_msg.ip_address = self.ip_address
            proto_msg.port = self.port
            proto_msg.status = ReaderStatusProto.Value(self.status.value)
            proto_msg.power_level = PowerLevelProto.Value(self.power_level.value)
            proto_msg.read_interval_ms = self.read_interval_ms
            proto_msg.filtering_enabled = self.filtering_enabled
            proto_msg.last_heartbeat.FromDatetime(self.last_heartbeat)
            
            # Convert complex fields
            for key, value in self.additional_params.items():
                proto_msg.additional_params[key] = str(value)
            
            for entry in self.status_history:
                history_entry = proto_msg.status_history.add()
                history_entry.timestamp.FromDatetime(entry["timestamp"])
                history_entry.status = ReaderStatusProto.Value(entry["new_status"].value)
                history_entry.reason = entry["reason"]
            
            return proto_msg
            
        except ImportError as e:
            raise ImportError("Protobuf support not available") from e

    @classmethod
    def from_proto(cls, proto_msg: 'ReaderProto') -> 'Reader':
        """
        Creates reader instance from protobuf message.
        
        Args:
            proto_msg: Protobuf message to convert
            
        Returns:
            Reader: New Reader instance
            
        Raises:
            ValueError: If protobuf message is invalid
        """
        try:
            reader = cls(
                name=proto_msg.name,
                ip_address=proto_msg.ip_address,
                port=proto_msg.port,
                power_level=PowerLevel(proto_msg.power_level.name),
                read_interval_ms=proto_msg.read_interval_ms
            )
            
            # Restore additional fields
            reader.id = UUID(proto_msg.id)
            reader.status = ReaderStatus(proto_msg.status.name)
            reader.filtering_enabled = proto_msg.filtering_enabled
            reader.last_heartbeat = proto_msg.last_heartbeat.ToDatetime()
            
            # Restore complex fields
            reader.additional_params = {
                key: value for key, value in proto_msg.additional_params.items()
            }
            
            # Clear and restore status history
            reader.status_history.clear()
            for entry in proto_msg.status_history:
                reader.status_history.append({
                    "timestamp": entry.timestamp.ToDatetime(),
                    "new_status": ReaderStatus(entry.status.name),
                    "reason": entry.reason
                })
            
            return reader
            
        except (ValueError, KeyError) as e:
            raise ValueError(f"Invalid protobuf message: {str(e)}") from e