import json
import logging
import time
from typing import Dict, Tuple

import httpx
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from api.config import settings
from api.database import SessionLocal
from models import ActionLog, Condition, ConnectedDevice


log = logging.getLogger("edge.sync_service")


class CloudSyncService:
    def __init__(self):
        self.last_sync_ts: int = 0
        self.last_sync_status: str = "never_run"
        self.last_error: str = ""

    def get_unsynced_counts(self, db: Session) -> Tuple[int, int]:
        """Returns (unsynced_conditions, unsynced_actions)"""
        cond_count = db.query(Condition).filter(Condition.synced == 0).count()
        act_count = db.query(ActionLog).filter(ActionLog.synced == 0).count()
        return cond_count, act_count

    def sync_batch(self, db: Session) -> Dict[str, int]:
        """
        Batches unsynced conditions and action logs and uploads them to the Cloud Django backend.
        Returns dict with counts of synced records.
        """
        results = {"conditions": 0, "actions": 0}
        self.last_error = ""

        # Check for network error cooldown (simple backoff)
        if self.last_sync_status == "network_error":
            # If failed recently, don't spam. Scheduler will call again.
            # Real exponential backoff would track attempt counts.
            pass

        # 1. Fetch unsynced conditions
        conditions = db.execute(
            select(Condition)
            .where(Condition.synced == 0)
            .limit(settings.SYNC_BATCH_SIZE)
        ).scalars().all()

        if conditions:
            condition_ids = [c.id for c in conditions]
            batch_payload = {
                "node_id": settings.NODE_ID,
                "greenhouse_id": settings.GREENHOUSE_ID,
                "readings": [
                    {
                        "device_id": c.device_id,
                        "payload": json.loads(c.payload) if isinstance(c.payload, str) else c.payload,
                        "reading_ts": c.reading_ts,
                        "received_ts": c.received_ts,
                    }
                    for c in conditions
                ]
            }

            headers = {"Content-Type": "application/json"}
            if settings.CLOUD_SYNC_TOKEN:
                headers["Authorization"] = f"Bearer {settings.CLOUD_SYNC_TOKEN}"

            url = f"{settings.CLOUD_BACKEND_URL.rstrip('/')}/api/v1/conditions/bulk-sync/"

            try:
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(url, json=batch_payload, headers=headers)
                
                if resp.status_code in (200, 201):
                    # Mark conditions as synced
                    db.execute(
                        update(Condition)
                        .where(Condition.id.in_(condition_ids))
                        .values(synced=1)
                    )
                    db.commit()
                    results["conditions"] = len(condition_ids)
                    log.info("Successfully synced %d condition rows to cloud", len(condition_ids))
                else:
                    self.last_sync_status = f"failed_http_{resp.status_code}"
                    self.last_error = resp.text[:200]
                    log.warning("Cloud sync rejected with HTTP %s: %s", resp.status_code, self.last_error)
            except Exception as e:
                self.last_sync_status = "network_error"
                self.last_error = str(e)
                log.warning("Cloud sync failed (offline or unreachable): %s", e)

        # 2. Fetch unsynced actions
        actions = db.execute(
            select(ActionLog)
            .where(ActionLog.synced == 0)
            .limit(settings.SYNC_BATCH_SIZE)
        ).scalars().all()

        if actions and self.last_sync_status not in ("network_error",):
            action_ids = [a.id for a in actions]
            actions_payload = {
                "node_id": settings.NODE_ID,
                "actions": [
                    {
                        "actuator_device_id": a.actuator_device_id,
                        "action": a.action,
                        "command_payload": json.loads(a.command_payload) if isinstance(a.command_payload, str) else a.command_payload,
                        "triggered_by": a.triggered_by,
                        "executed_ts": a.executed_ts,
                    }
                    for a in actions
                ]
            }

            headers = {"Content-Type": "application/json"}
            if settings.CLOUD_SYNC_TOKEN:
                headers["Authorization"] = f"Bearer {settings.CLOUD_SYNC_TOKEN}"

            url = f"{settings.CLOUD_BACKEND_URL.rstrip('/')}/api/v1/actions/bulk-sync/"

            try:
                with httpx.Client(timeout=10.0) as client:
                    resp = client.post(url, json=actions_payload, headers=headers)

                if resp.status_code in (200, 201):
                    db.execute(
                        update(ActionLog)
                        .where(ActionLog.id.in_(action_ids))
                        .values(synced=1)
                    )
                    db.commit()
                    results["actions"] = len(action_ids)
                    log.info("Successfully synced %d action logs to cloud", len(action_ids))
            except Exception as e:
                log.warning("Actions sync failed: %s", e)

        self.last_sync_ts = int(time.time())
        if self.last_sync_status != "network_error" and not self.last_sync_status.startswith("failed"):
            self.last_sync_status = "success"

        # 3. Pull latest device allowlist from Cloud (farmer added sensors/actuators via Web)
        try:
            self.sync_devices_from_cloud(db)
        except Exception as e:
            log.warning("Device configuration down-sync failed: %s", e)

        return results

    def sync_devices_from_cloud(self, db: Session) -> Dict[str, int]:
        """
        Pulls authorized sensors and actuators registered by the farmer on the CropFit Web Dashboard
        and registers/updates them in the local SQLite connected_devices table.
        """
        results = {"added_sensors": 0, "added_actuators": 0}
        headers = {"Content-Type": "application/json"}
        if settings.CLOUD_SYNC_TOKEN:
            headers["Authorization"] = f"Bearer {settings.CLOUD_SYNC_TOKEN}"

        url = f"{settings.CLOUD_BACKEND_URL.rstrip('/')}/api/v1/nodes/config/?node_id={settings.NODE_ID}"

        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.get(url, headers=headers)

            if resp.status_code != 200:
                log.debug("Cloud config endpoint returned %d: %s", resp.status_code, resp.text[:100])
                return results

            config_data = resp.json()
            sensors = config_data.get("sensors", [])
            actuators = config_data.get("actuators", [])
            now_ts = int(time.time())

            # Sync sensors
            for s in sensors:
                dev_id = s.get("sensor_id")
                if not dev_id:
                    continue
                existing = db.execute(
                    select(ConnectedDevice).where(ConnectedDevice.device_id == dev_id)
                ).scalar_one_or_none()

                if existing:
                    existing.revoked = not s.get("is_active", True)
                    existing.device_type = "sensor"
                else:
                    new_dev = ConnectedDevice(
                        device_id=dev_id,
                        device_type="sensor",
                        name=f"{s.get('sensor_type', 'Sensor')} ({s.get('unit', '')})",
                        revoked=not s.get("is_active", True),
                        registered_ts=now_ts,
                    )
                    db.add(new_dev)
                    results["added_sensors"] += 1

            # Sync actuators
            for a in actuators:
                dev_id = a.get("actuator_id")
                if not dev_id:
                    continue
                existing = db.execute(
                    select(ConnectedDevice).where(ConnectedDevice.device_id == dev_id)
                ).scalar_one_or_none()

                if existing:
                    existing.revoked = not a.get("is_active", True)
                    existing.device_type = "actuator"
                else:
                    new_dev = ConnectedDevice(
                        device_id=dev_id,
                        device_type="actuator",
                        name=a.get("actuator_type", "Actuator"),
                        revoked=not a.get("is_active", True),
                        registered_ts=now_ts,
                    )
                    db.add(new_dev)
                    results["added_actuators"] += 1

            db.commit()
            if results["added_sensors"] > 0 or results["added_actuators"] > 0:
                log.info("Synced devices from cloud: added %d sensors, %d actuators", 
                         results["added_sensors"], results["added_actuators"])
        except Exception as e:
            log.warning("Failed to sync device config from cloud: %s", e)

        return results



sync_service = CloudSyncService()
