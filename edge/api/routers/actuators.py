import json
import time
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from api.database import get_db
from api.models.schemas import (
    ActuatorCommandRequest,
    ActuatorCommandResponse,
    ActuatorInfo,
)
from api.services.mqtt_publisher import mqtt_publisher
from models import ActionLog, ConnectedDevice

router = APIRouter(prefix="/actuators", tags=["Actuators"])


@router.get("", response_model=List[ActuatorInfo])
def list_actuators(db: Session = Depends(get_db)):
    """
    List all registered actuators and their last executed command/state.
    """
    devices = db.execute(
        select(ConnectedDevice).where(
            ConnectedDevice.device_type == "actuator",
            ConnectedDevice.revoked == False  # noqa: E712
        )
    ).scalars().all()

    result: List[ActuatorInfo] = []

    for d in devices:
        last_log = db.execute(
            select(ActionLog)
            .where(ActionLog.actuator_device_id == d.device_id)
            .order_by(desc(ActionLog.executed_ts))
            .limit(1)
        ).scalar_one_or_none()

        last_payload = None
        if last_log and last_log.command_payload:
            last_payload = json.loads(last_log.command_payload) if isinstance(last_log.command_payload, str) else last_log.command_payload

        result.append(
            ActuatorInfo(
                device_id=d.device_id,
                name=d.name,
                is_active=not d.revoked,
                last_action=last_log.action if last_log else None,
                last_command_payload=last_payload,
                last_executed_ts=last_log.executed_ts if last_log else None,
            )
        )

    return result


@router.post("/{device_id}/command", response_model=ActuatorCommandResponse)
def dispatch_actuator_command(
    device_id: str,
    req: ActuatorCommandRequest,
    db: Session = Depends(get_db)
):
    """
    Dispatch a command to an actuator via MQTT.
    Example payload: {"action": "on", "duration_s": 300}
    """
    cmd_dict = {"action": req.action}
    if req.duration_s is not None:
        cmd_dict["duration_s"] = req.duration_s
    if req.extra_params:
        cmd_dict.update(req.extra_params)

    success = mqtt_publisher.send_command(
        db=db,
        device_id=device_id,
        command=cmd_dict,
        triggered_by="manual:api"
    )

    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Device '{device_id}' is not an authorized or active actuator."
        )

    return ActuatorCommandResponse(
        status="dispatched",
        device_id=device_id,
        command_sent=cmd_dict,
        timestamp=int(time.time()),
    )
