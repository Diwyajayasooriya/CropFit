import json
import time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from api.database import get_db
from api.models.schemas import (
    SensorHistoryPoint,
    SensorHistoryResponse,
    SensorLatestReading,
    SensorLatestResponse,
)
from models import Condition, ConnectedDevice

router = APIRouter(prefix="/sensors", tags=["Sensors"])


@router.get("/latest", response_model=SensorLatestResponse)
def get_latest_sensors(db: Session = Depends(get_db)):
    """
    Get the latest telemetry reading for every registered sensor device.
    """
    # 1. Fetch all registered sensors
    sensors = db.execute(
        select(ConnectedDevice)
        .where(
            ConnectedDevice.device_type == "sensor",
            ConnectedDevice.revoked == False  # noqa: E712
        )
    ).scalars().all()

    results: List[SensorLatestReading] = []

    for s in sensors:
        # Find latest condition for this device
        latest = db.execute(
            select(Condition)
            .where(Condition.device_id == s.device_id)
            .order_by(desc(Condition.received_ts))
            .limit(1)
        ).scalar_one_or_none()

        if latest:
            payload_data = json.loads(latest.payload) if isinstance(latest.payload, str) else latest.payload
            results.append(
                SensorLatestReading(
                    device_id=s.device_id,
                    name=s.name,
                    payload=payload_data,
                    reading_ts=latest.reading_ts,
                    received_ts=latest.received_ts,
                )
            )

    return SensorLatestResponse(count=len(results), sensors=results)


@router.get("/{device_id}/latest", response_model=SensorLatestReading)
def get_sensor_latest(device_id: str, db: Session = Depends(get_db)):
    """
    Get the latest reading for a specific sensor device.
    """
    device = db.execute(
        select(ConnectedDevice).where(ConnectedDevice.device_id == device_id)
    ).scalar_one_or_none()

    latest = db.execute(
        select(Condition)
        .where(Condition.device_id == device_id)
        .order_by(desc(Condition.received_ts))
        .limit(1)
    ).scalar_one_or_none()

    if not latest:
        raise HTTPException(status_code=404, detail=f"No readings found for sensor '{device_id}'")

    payload_data = json.loads(latest.payload) if isinstance(latest.payload, str) else latest.payload
    return SensorLatestReading(
        device_id=device_id,
        name=device.name if device else None,
        payload=payload_data,
        reading_ts=latest.reading_ts,
        received_ts=latest.received_ts,
    )


@router.get("/{device_id}/history", response_model=SensorHistoryResponse)
def get_sensor_history(
    device_id: str,
    hours: Optional[int] = Query(24, ge=1, le=168, description="History window in hours"),
    limit: Optional[int] = Query(100, ge=1, le=1000, description="Max readings to return"),
    db: Session = Depends(get_db)
):
    """
    Get historical readings for a sensor within the last N hours.
    """
    cutoff_ts = int(time.time()) - (hours * 3600)

    rows = db.execute(
        select(Condition)
        .where(
            Condition.device_id == device_id,
            Condition.received_ts >= cutoff_ts
        )
        .order_by(desc(Condition.received_ts))
        .limit(limit)
    ).scalars().all()

    points: List[SensorHistoryPoint] = []
    for r in rows:
        payload_data = json.loads(r.payload) if isinstance(r.payload, str) else r.payload
        points.append(
            SensorHistoryPoint(
                id=r.id,
                payload=payload_data,
                reading_ts=r.reading_ts,
                received_ts=r.received_ts,
                synced=r.synced
            )
        )

    return SensorHistoryResponse(
        device_id=device_id,
        count=len(points),
        readings=points
    )
