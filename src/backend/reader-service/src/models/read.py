# External imports with versions
from dataclasses import dataclass, field  # Python 3.11
from datetime import datetime, timezone  # Python 3.11
from uuid import UUID, uuid4  # Python 3.11
from pydantic import dataclasses, validator, Field  # v2.0
import re
from typing import Tuple, ClassVar

# Global constants for validation
MIN_SIGNAL_STRENGTH: float = -70.0  # Minimum acceptable signal strength in dBm
MAX_SIGNAL_STRENGTH: float = -20.0  # Maximum acceptable signal strength in dBm
RFID_TAG_PATTERN: str = r'^[A-Fa-f0-9]{24}$'  # Regex pattern for valid RFID tag format

@dataclass(frozen=True)
@dataclasses.dataclass(frozen=True, config=dict(validate_assignment=True))
class Read:
    """
    Represents a single RFID tag read event with comprehensive validation and processing capabilities.
    
    This class is immutable (frozen) to ensure thread-safety and data integrity.
    All fields are validated during instantiation using Pydantic.
    
    Attributes:
        id (UUID): Unique identifier for the read event
        rfid_tag (str): The RFID tag identifier in 24-character hex format
        reader_id (str): Identifier of the RFID reader that captured this read
        signal_strength (float): Signal strength in dBm, must be between -70 and -20
        read_time (datetime): UTC timestamp when the read occurred
        is_processed (bool): Flag indicating if the read has been processed
    """
    
    # Class attributes
    id: UUID = field(default_factory=uuid4)
    rfid_tag: str
    reader_id: str
    signal_strength: float
    read_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    is_processed: bool = field(default=False)
    
    # Class-level constants for validation
    _TAG_PATTERN: ClassVar[re.Pattern] = re.compile(RFID_TAG_PATTERN)
    
    def __post_init__(self):
        """
        Validates all fields after initialization.
        Raises ValueError if any validation fails.
        """
        # Validate RFID tag format
        if not self._TAG_PATTERN.match(self.rfid_tag):
            raise ValueError(f"Invalid RFID tag format: {self.rfid_tag}. Must be 24 hex characters.")
            
        # Validate signal strength
        valid, error_msg = self.validate_signal_strength(self.signal_strength)
        if not valid:
            raise ValueError(error_msg)
            
        # Validate reader_id is not empty
        if not self.reader_id.strip():
            raise ValueError("Reader ID cannot be empty")
            
        # Ensure read_time is in UTC
        if self.read_time.tzinfo != timezone.utc:
            object.__setattr__(self, 'read_time', 
                             self.read_time.replace(tzinfo=timezone.utc))

    @staticmethod
    def validate_signal_strength(signal_strength: float) -> Tuple[bool, str]:
        """
        Validates if the signal strength is within acceptable range.
        
        Args:
            signal_strength (float): The signal strength value to validate in dBm
            
        Returns:
            Tuple[bool, str]: (is_valid, error_message)
        """
        try:
            strength = float(signal_strength)
            if strength < MIN_SIGNAL_STRENGTH:
                return False, f"Signal strength {strength} dBm is below minimum {MIN_SIGNAL_STRENGTH} dBm"
            if strength > MAX_SIGNAL_STRENGTH:
                return False, f"Signal strength {strength} dBm exceeds maximum {MAX_SIGNAL_STRENGTH} dBm"
            return True, ""
        except (TypeError, ValueError):
            return False, f"Invalid signal strength value: {signal_strength}. Must be a number."

    def to_proto(self) -> 'ReadProto':
        """
        Converts the Read instance to a protobuf message.
        
        Returns:
            ReadProto: Protobuf representation of the read event
            
        Raises:
            ImportError: If protobuf module is not available
            ValueError: If conversion fails
        """
        try:
            from ..protos.read_pb2 import ReadProto
            
            proto_msg = ReadProto()
            proto_msg.id = str(self.id)
            proto_msg.rfid_tag = self.rfid_tag
            proto_msg.reader_id = self.reader_id
            proto_msg.signal_strength = self.signal_strength
            proto_msg.read_time.FromDatetime(self.read_time)
            proto_msg.is_processed = self.is_processed
            
            return proto_msg
        except ImportError as e:
            raise ImportError("Protobuf support not available") from e
        except Exception as e:
            raise ValueError(f"Failed to convert to protobuf: {str(e)}") from e

    @classmethod
    def from_proto(cls, proto_msg: 'ReadProto') -> 'Read':
        """
        Creates a Read instance from a protobuf message.
        
        Args:
            proto_msg (ReadProto): The protobuf message to convert
            
        Returns:
            Read: A new validated Read instance
            
        Raises:
            ValueError: If protobuf message is invalid or missing required fields
        """
        try:
            # Validate proto message has all required fields
            if not all([proto_msg.id, proto_msg.rfid_tag, proto_msg.reader_id,
                       proto_msg.HasField('signal_strength'),
                       proto_msg.HasField('read_time')]):
                raise ValueError("Protobuf message missing required fields")
            
            # Convert string UUID to UUID object
            read_id = UUID(proto_msg.id)
            
            # Create new Read instance with validated data
            read = cls(
                rfid_tag=proto_msg.rfid_tag,
                reader_id=proto_msg.reader_id,
                signal_strength=proto_msg.signal_strength
            )
            
            # Set the ID and processed flag from proto
            object.__setattr__(read, 'id', read_id)
            object.__setattr__(read, 'is_processed', proto_msg.is_processed)
            object.__setattr__(read, 'read_time', proto_msg.read_time.ToDatetime())
            
            return read
            
        except ValueError as e:
            raise ValueError(f"Invalid protobuf message: {str(e)}")
        except Exception as e:
            raise ValueError(f"Failed to create Read from protobuf: {str(e)}") from e