from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# --- Sensor Schemas ---

class SensorLatestReading(BaseModel):
    device_id: str
    name: Optional[str] = None
    payload: Dict[str, Any]
    reading_ts: int
    received_ts: int


class SensorLatestResponse(BaseModel):
    count: int
    sensors: List[SensorLatestReading]


class SensorHistoryPoint(BaseModel):
    id: int
    payload: Dict[str, Any]
    reading_ts: int
    received_ts: int
    synced: int


class SensorHistoryResponse(BaseModel):
    device_id: str
    count: int
    readings: List[SensorHistoryPoint]


# --- Actuator Schemas ---

class ActuatorInfo(BaseModel):
    device_id: str
    name: Optional[str] = None
    is_active: bool = True
    last_action: Optional[str] = None
    last_command_payload: Optional[Dict[str, Any]] = None
    last_executed_ts: Optional[int] = None


class ActuatorCommandRequest(BaseModel):
    action: str = Field(..., description="Action to perform, e.g. 'on', 'off', 'toggle', 'pulse'")
    duration_s: Optional[int] = Field(None, description="Optional auto-off duration in seconds")
    extra_params: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ActuatorCommandResponse(BaseModel):
    status: str
    device_id: str
    command_sent: Dict[str, Any]
    timestamp: int


# --- Device Schemas ---

class DeviceRegisterRequest(BaseModel):
    device_id: str
    device_type: str = Field(..., description="'sensor' or 'actuator'")
    name: Optional[str] = None


class DeviceInfo(BaseModel):
    device_id: str
    device_type: str
    name: Optional[str] = None
    revoked: bool
    registered_ts: int


class DeviceListResponse(BaseModel):
    count: int
    devices: List[DeviceInfo]


# --- Rule Schemas ---

class RuleBase(BaseModel):
    name: Optional[str] = None
    sensor_device_id: str
    field: str = Field(..., description="JSON key in reading, e.g. 'temperature', 'soil_moisture'")
    condition: str = Field(..., description="'below', 'above', or 'equals'")
    threshold: float
    actuator_device_id: str
    command_payload: Dict[str, Any] = Field(..., description="Command to send, e.g. {'action': 'on', 'duration_s': 300}")
    is_active: bool = True


class RuleCreate(RuleBase):
    rule_id: Optional[str] = None


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    field: Optional[str] = None
    condition: Optional[str] = None
    threshold: Optional[float] = None
    actuator_device_id: Optional[str] = None
    command_payload: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class RuleResponse(RuleBase):
    id: int
    rule_id: str
    created_ts: int


# --- Cloud Sync Schemas ---

class SyncStatusResponse(BaseModel):
    unsynced_conditions_count: int
    unsynced_actions_count: int
    cloud_backend_url: str
    last_sync_ts: Optional[int] = None
    last_sync_status: str


class SyncTriggerResponse(BaseModel):
    status: str
    synced_conditions: int
    synced_actions: int
    message: str


# --- Hub Health Schemas ---

class HubHealthStatus(BaseModel):
    status: str
    node_id: str
    greenhouse_id: str
    uptime_seconds: float
    local_time: str
    database_connected: bool
    mqtt_connected: bool
    total_registered_devices: int
    active_sensors_count: int
    active_actuators_count: int
    unsynced_records: int
