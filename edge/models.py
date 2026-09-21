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
