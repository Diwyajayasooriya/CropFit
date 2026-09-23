import json
import time
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.database import get_db
from api.models.schemas import RuleCreate, RuleResponse, RuleUpdate
from models import Rule

router = APIRouter(prefix="/rules", tags=["Rules"])


@router.get("", response_model=List[RuleResponse])
def list_rules(db: Session = Depends(get_db)):
    """
    List all local automation rules cached in node_rules_cache.
    """
    rules = db.execute(select(Rule)).scalars().all()
    results: List[RuleResponse] = []
    for r in rules:
        cmd_payload = json.loads(r.command_payload) if isinstance(r.command_payload, str) else r.command_payload
        results.append(
            RuleResponse(
                id=r.id,
                rule_id=r.rule_id,
                name=r.name,
                sensor_device_id=r.sensor_device_id,
                field=r.field,
                condition=r.condition,
                threshold=r.threshold,
                actuator_device_id=r.actuator_device_id,
                command_payload=cmd_payload,
                is_active=r.is_active,
                created_ts=r.created_ts,
            )
        )
    return results


@router.post("", response_model=RuleResponse)
def create_rule(req: RuleCreate, db: Session = Depends(get_db)):
    """
    Create a new automation rule on the edge.
    """
    rule_id = req.rule_id or f"rule_{uuid.uuid4().hex[:8]}"

    existing = db.execute(select(Rule).where(Rule.rule_id == rule_id)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Rule with id '{rule_id}' already exists")

    new_rule = Rule(
        rule_id=rule_id,
        name=req.name or rule_id,
        sensor_device_id=req.sensor_device_id,
        field=req.field,
        condition=req.condition,
        threshold=req.threshold,
        actuator_device_id=req.actuator_device_id,
        command_payload=json.dumps(req.command_payload),
        is_active=req.is_active,
        created_ts=int(time.time()),
    )
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)

    return RuleResponse(
        id=new_rule.id,
        rule_id=new_rule.rule_id,
        name=new_rule.name,
        sensor_device_id=new_rule.sensor_device_id,
        field=new_rule.field,
        condition=new_rule.condition,
        threshold=new_rule.threshold,
        actuator_device_id=new_rule.actuator_device_id,
        command_payload=req.command_payload,
        is_active=new_rule.is_active,
        created_ts=new_rule.created_ts,
    )


@router.put("/{rule_id}", response_model=RuleResponse)
def update_rule(rule_id: str, req: RuleUpdate, db: Session = Depends(get_db)):
    """
    Update an existing automation rule.
    """
    rule = db.execute(select(Rule).where(Rule.rule_id == rule_id)).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_id}' not found")

    if req.name is not None:
        rule.name = req.name
    if req.field is not None:
        rule.field = req.field
    if req.condition is not None:
        rule.condition = req.condition
    if req.threshold is not None:
        rule.threshold = req.threshold
    if req.actuator_device_id is not None:
        rule.actuator_device_id = req.actuator_device_id
    if req.command_payload is not None:
        rule.command_payload = json.dumps(req.command_payload)
    if req.is_active is not None:
        rule.is_active = req.is_active

    db.commit()
    db.refresh(rule)

    cmd_payload = json.loads(rule.command_payload) if isinstance(rule.command_payload, str) else rule.command_payload
    return RuleResponse(
        id=rule.id,
        rule_id=rule.rule_id,
        name=rule.name,
        sensor_device_id=rule.sensor_device_id,
        field=rule.field,
        condition=rule.condition,
        threshold=rule.threshold,
        actuator_device_id=rule.actuator_device_id,
        command_payload=cmd_payload,
        is_active=rule.is_active,
        created_ts=rule.created_ts,
    )


@router.delete("/{rule_id}")
def delete_rule(rule_id: str, db: Session = Depends(get_db)):
    """
    Delete a rule from the cache.
    """
    rule = db.execute(select(Rule).where(Rule.rule_id == rule_id)).scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail=f"Rule '{rule_id}' not found")

    db.delete(rule)
    db.commit()
    return {"status": "deleted", "rule_id": rule_id}
