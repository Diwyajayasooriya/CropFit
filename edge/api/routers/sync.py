from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.config import settings
from api.database import get_db
from api.models.schemas import SyncStatusResponse, SyncTriggerResponse
from api.services.sync_service import sync_service

router = APIRouter(prefix="/sync", tags=["Sync"])


@router.get("/status", response_model=SyncStatusResponse)
def get_sync_status(db: Session = Depends(get_db)):
    """
    Get current synchronization status with the Django Cloud Backend.
    """
    unsynced_conds, unsynced_acts = sync_service.get_unsynced_counts(db)
    return SyncStatusResponse(
        unsynced_conditions_count=unsynced_conds,
        unsynced_actions_count=unsynced_acts,
        cloud_backend_url=settings.CLOUD_BACKEND_URL,
        last_sync_ts=sync_service.last_sync_ts or None,
        last_sync_status=sync_service.last_sync_status,
    )


@router.post("/trigger", response_model=SyncTriggerResponse)
def trigger_sync(db: Session = Depends(get_db)):
    """
    Manually trigger an immediate batch synchronization with the Django Cloud Backend.
    """
    results = sync_service.sync_batch(db)
    synced_conds = results.get("conditions", 0)
    synced_acts = results.get("actions", 0)

    status_msg = f"Synced {synced_conds} conditions and {synced_acts} actions."
    if sync_service.last_sync_status != "success":
        status_msg += f" (Warning: {sync_service.last_sync_status}: {sync_service.last_error})"

    return SyncTriggerResponse(
        status=sync_service.last_sync_status,
        synced_conditions=synced_conds,
        synced_actions=synced_acts,
        message=status_msg,
    )
