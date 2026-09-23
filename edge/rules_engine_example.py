"""
Minimal rules engine example — closes the loop:
  latest sensor reading -> threshold rule -> actuator command

For now this assumes GreenNode already knows which control topic drives
which actuator (i.e. no dynamic device-capability discovery) — a rule is
just "if this sensor's latest reading crosses this threshold, send this
command to this device_id." Rule source (thresholds, which sensor maps
to which actuator) is read from `node_rules_cache`, matching the schema
already in place; this file assumes a simple row shape for that table
and should be reconciled against the real one the same way models.py
should be.

This would run on a schedule (APScheduler, per the AI/ML stack already
in use) rather than continuously — e.g. every 30-60s, well below sensor
publish frequency, so it's always acting on a reasonably fresh reading.
"""

import json
import logging

from sqlalchemy import desc, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

from models import Condition
from actuator_dispatcher import ActuatorDispatcher

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("rules")

DB_URL = "sqlite:///./greennode.db"
engine = create_engine(DB_URL)
Session = sessionmaker(bind=engine)


# Illustrative rule shape — replace with rows read from `node_rules_cache`.
# Each rule: which sensor's latest reading to check, which field in its
# JSON payload, the threshold, which actuator to command, and what
# command to send when the threshold is crossed.
RULES = [
    {
        "sensor_device_id": "esp32-soil-moisture-01",
        "field": "soil_moisture",
        "condition": "below",
        "threshold": 30.0,
        "actuator_device_id": "esp32-irrigation-valve-01",
        "command": {"action": "on", "duration_s": 300},
    },
]


def get_latest_reading(session, device_id: str) -> dict | None:
    row = session.execute(
        select(Condition)
        .where(Condition.device_id == device_id)
        .order_by(desc(Condition.received_ts))
        .limit(1)
    ).scalar_one_or_none()
    if row is None:
        return None
    return json.loads(row.payload)


def evaluate_rules(session, dispatcher: ActuatorDispatcher):
    for rule in RULES:
        reading = get_latest_reading(session, rule["sensor_device_id"])
        if reading is None or rule["field"] not in reading:
            log.info("No recent reading for %s, skipping rule", rule["sensor_device_id"])
            continue

        value = reading[rule["field"]]
        triggered = (
            value < rule["threshold"] if rule["condition"] == "below"
            else value > rule["threshold"]
        )

        if not triggered:
            continue

        sent = dispatcher.send_command(session, rule["actuator_device_id"], rule["command"])
        if sent:
            log.info(
                "Rule fired: %s=%.1f %s %.1f -> %s command to %s",
                rule["field"], value, rule["condition"], rule["threshold"],
                rule["command"], rule["actuator_device_id"],
            )
        else:
            log.warning(
                "Rule wanted to command %s but it's not a registered actuator",
                rule["actuator_device_id"],
            )


def main():
    dispatcher = ActuatorDispatcher()
    session = Session()
    try:
        evaluate_rules(session, dispatcher)
    finally:
        session.close()


if __name__ == "__main__":
    main()
