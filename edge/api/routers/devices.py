import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.database import get_db
from api.models.schemas import DeviceInfo, DeviceListResponse, DeviceRegisterRequest
from models import ConnectedDevice

router = APIRouter(prefix="/devices", tags=["Devices"])


@router.get("", response_model=DeviceListResponse)
def list_devices(
    device_type: Optional[str] = Query(None, description="Filter by 'sensor' or 'actuator'"),
    include_revoked: bool = Query(False, description="Include revoked devices"),
    db: Session = Depends(get_db)
):
    """
    List all connected devices known to the edge gateway.
    """
    stmt = select(ConnectedDevice)
    if device_type:
        stmt = stmt.where(ConnectedDevice.device_type == device_type)
    if not include_revoked:
        stmt = stmt.where(ConnectedDevice.revoked == False)  # noqa: E712

    devices = db.execute(stmt).scalars().all()

    device_infos = [
        DeviceInfo(
            device_id=d.device_id,
            device_type=d.device_type,
            name=d.name,
            revoked=d.revoked,
            registered_ts=d.registered_ts,
        )
        for d in devices
    ]

    return DeviceListResponse(count=len(device_infos), devices=device_infos)


@router.post("/register", response_model=DeviceInfo)
def register_device(req: DeviceRegisterRequest, db: Session = Depends(get_db)):
    """
    Register a new device into the edge gateway's allowlist.
    """
    if req.device_type not in ("sensor", "actuator"):
        raise HTTPException(status_code=400, detail="device_type must be 'sensor' or 'actuator'")

    existing = db.execute(
        select(ConnectedDevice).where(ConnectedDevice.device_id == req.device_id)
    ).scalar_one_or_none()

    if existing:
        # Re-activate if was revoked
        existing.revoked = False
        existing.device_type = req.device_type
        if req.name:
            existing.name = req.name
        db.commit()
        db.refresh(existing)
        return DeviceInfo(
            device_id=existing.device_id,
            device_type=existing.device_type,
            name=existing.name,
            revoked=existing.revoked,
            registered_ts=existing.registered_ts,
        )

    new_device = ConnectedDevice(
        device_id=req.device_id,
        device_type=req.device_type,
        name=req.name or req.device_id,
        revoked=False,
        registered_ts=int(time.time()),
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)

    return DeviceInfo(
        device_id=new_device.device_id,
        device_type=new_device.device_type,
        name=new_device.name,
        revoked=new_device.revoked,
        registered_ts=new_device.registered_ts,
    )


@router.patch("/{device_id}/revoke", response_model=DeviceInfo)
def revoke_device(device_id: str, db: Session = Depends(get_db)):
    """
    Revoke a device so its telemetry will be dropped and commands blocked.
    """
    device = db.execute(
        select(ConnectedDevice).where(ConnectedDevice.device_id == device_id)
    ).scalar_one_or_none()

    if not device:
        raise HTTPException(status_code=404, detail=f"Device '{device_id}' not found")

    device.revoked = True
    db.commit()
    db.refresh(device)

    return DeviceInfo(
        device_id=device.device_id,
        device_type=device.device_type,
        name=device.name,
        revoked=device.revoked,
        registered_ts=device.registered_ts,
    )
