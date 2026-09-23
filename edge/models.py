"""
Illustrative SQLAlchemy models for `ingestion_service.py`.

These are shaped to match what's already known about the finalized edge
schema (conditions / connected_devices tables, partial index on
synced=0, node_identity for factory verification) but the exact column
names here are inferred, not copied from the real Alembic migration —
reconcile field names against your actual models module before using
this for real, then delete this file (import from the real one instead).
"""

from sqlalchemy import (
    Boolean,
    Column,
    Float,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class ConnectedDevice(Base):
    __tablename__ = "connected_devices"

    id = Column(Integer, primary_key=True)
    device_id = Column(String, unique=True, nullable=False, index=True)
    device_type = Column(String, nullable=False)   # "sensor" | "actuator"
    name = Column(String, nullable=True)
    revoked = Column(Boolean, default=False, nullable=False)
    registered_ts = Column(Integer, nullable=False)


class Condition(Base):
    __tablename__ = "conditions"

    id = Column(Integer, primary_key=True)
    device_id = Column(String, nullable=False, index=True)
    payload = Column(Text, nullable=False)       # JSON string, e.g. {"temperature": 60}
    reading_ts = Column(Integer, nullable=False)  # device-supplied or receipt-time fallback
    received_ts = Column(Integer, nullable=False)
    synced = Column(Integer, default=0, nullable=False)  # 0/1, matches partial index

    __table_args__ = (
        Index("ix_conditions_synced", "synced", sqlite_where=(synced == 0)),
    )


class Rule(Base):
    __tablename__ = "node_rules_cache"

    id = Column(Integer, primary_key=True)
    rule_id = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    sensor_device_id = Column(String, nullable=False)
    field = Column(String, nullable=False)              # e.g., "temperature", "soil_moisture"
    condition = Column(String, nullable=False)          # "below", "above", "equals"
    threshold = Column(Float, nullable=False)
    actuator_device_id = Column(String, nullable=False)
    command_payload = Column(Text, nullable=False)      # JSON string, e.g. {"action": "on", "duration_s": 300}
    is_active = Column(Boolean, default=True, nullable=False)
    created_ts = Column(Integer, nullable=False)


class ActionLog(Base):
    __tablename__ = "actions_log"

    id = Column(Integer, primary_key=True)
    actuator_device_id = Column(String, nullable=False, index=True)
    action = Column(String, nullable=False)
    command_payload = Column(Text, nullable=False)
    triggered_by = Column(String, nullable=True)        # e.g. "rule:<rule_id>" or "manual"
    executed_ts = Column(Integer, nullable=False)
    synced = Column(Integer, default=0, nullable=False)

    __table_args__ = (
        Index("ix_actions_synced", "synced", sqlite_where=(synced == 0)),
    )

