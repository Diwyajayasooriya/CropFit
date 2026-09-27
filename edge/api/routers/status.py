import datetime
import time

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.config import settings
from api.database import get_db
from api.models.schemas import HubHealthStatus
from api.services.mqtt_publisher import mqtt_publisher
from api.services.sync_service import sync_service
from models import ConnectedDevice

router = APIRouter(prefix="/status", tags=["Status"])

START_TIME = time.time()


@router.get("", response_model=HubHealthStatus)
def get_hub_status(db: Session = Depends(get_db)):
    """
    Get comprehensive edge gateway health, connectivity status, and telemetry metrics.
    """
    uptime = time.time() - START_TIME

    # Check SQLite DB connection
    db_ok = True
    try:
        db.execute(text("SELECT 1")).scalar()
    except Exception:
        db_ok = False

    # Device counts
    total_devices = db.query(ConnectedDevice).count()
    active_sensors = (
        db.query(ConnectedDevice)
        .filter(ConnectedDevice.device_type == "sensor", ConnectedDevice.revoked == False)  # noqa: E712
        .count()
    )
    active_actuators = (
        db.query(ConnectedDevice)
        .filter(ConnectedDevice.device_type == "actuator", ConnectedDevice.revoked == False)  # noqa: E712
        .count()
    )

    unsynced_conds, unsynced_acts = sync_service.get_unsynced_counts(db)

    return HubHealthStatus(
        status="healthy" if (db_ok and mqtt_publisher.connected) else "degraded",
        node_id=settings.NODE_ID,
        greenhouse_id=settings.GREENHOUSE_ID,
        uptime_seconds=round(uptime, 2),
        local_time=datetime.datetime.now().isoformat(),
        database_connected=db_ok,
        mqtt_connected=mqtt_publisher.connected,
        total_registered_devices=total_devices,
        active_sensors_count=active_sensors,
        active_actuators_count=active_actuators,
        unsynced_records=unsynced_conds + unsynced_acts,
    )
