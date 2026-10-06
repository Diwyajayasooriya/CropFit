import sys
import os
import time
import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import select, desc

# Add the ml_models path to sys.path so we can import ActionModel
sys.path.append(os.path.join(os.getcwd(), 'ml_models', 'action_model', 'src'))

try:
    from predict import ActionModel
    from greennode_rules import READING_KEYS, expert_policy, load_thresholds, FAN_LEVELS, SWITCH_ACTUATORS
except ImportError as e:
    print(f"Error importing ML model components: {e}")
    sys.exit(1)

from models import Condition, Rule, ActionLog
from api.database import SessionLocal
from actuator_dispatcher import ActuatorDispatcher
from api.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("rules_engine")

class RulesEngine:
    def __init__(self, mock_mqtt=False):
        # Initialize ML model
        root_dir = os.path.join(os.getcwd(), 'ml_models', 'action_model')
        onnx_path = os.path.join(root_dir, 'models', 'greennode_action.onnx')
        meta_path = os.path.join(root_dir, 'models', 'model_meta.json')
        
        if not os.path.exists(onnx_path):
            log.warning(f"Model file not found at {onnx_path}. ML recommendations will be skipped.")
            self.model = None
        else:
            try:
                self.model = ActionModel(onnx_path=onnx_path, meta_path=meta_path)
                log.info("ML model loaded successfully.")
            except Exception as e:
                log.error(f"Failed to load ML model: {e}")
                self.model = None

        if mock_mqtt:
            self.dispatcher = MockDispatcher()
            log.info("Using mock MQTT dispatcher.")
        else:
            self.dispatcher = ActuatorDispatcher(
                mqtt_host=settings.MQTT_HOST,
                mqtt_port=settings.MQTT_PORT,
                mqtt_user=settings.MQTT_USER,
                mqtt_pass=settings.MQTT_PASS
            )

    def get_latest_readings(self, db: Session):
        readings = {}
        five_mins_ago = int(time.time()) - 300
        conditions = db.execute(
            select(Condition)
            .where(Condition.received_ts >= five_mins_ago)
            .order_by(desc(Condition.received_ts))
        ).scalars().all()

        for c in conditions:
            try:
                payload = json.loads(c.payload)
                for k in READING_KEYS:
                    if k in payload and k not in readings:
                        readings[k] = payload[k]
            except json.JSONDecodeError:
                continue
        
        defaults = {
            "air_temp": 25.0, "rh": 60.0, "soil_moisture": 50.0, 
            "soil_temp": 20.0, "co2": 400.0, "outside_temp": 25.0, 
            "hour": time.localtime().tm_hour, "dli_so_far": 5.0
        }
        for k in READING_KEYS:
            if k not in readings:
                readings[k] = defaults.get(k, 0.0)
        return readings

    def process(self):
        db = SessionLocal()
        try:
            readings = self.get_latest_readings(db)
            log.info(f"Current readings: {readings}")

            th = load_thresholds()
            rule_actions = expert_policy(readings, th)
            
            if self.model:
                recommendation = self.model.recommend(readings, th=th)
                actions = recommendation['actions']
                log.info(f"ML recommendation: {actions}")
                source = "ml_model"
            else:
                log.info("ML model not available. Using expert rules only.")
                actions = {
                    "fan": {"speed": FAN_LEVELS[rule_actions["fan"]], "minutes": rule_actions["fan_min"]},
                    "roof_vent": {"opening": ["CLOSED", "HALF", "FULL"][rule_actions["vent"]]},
                }
                for k in SWITCH_ACTUATORS:
                    actions[k] = {"on": bool(rule_actions[k]), "minutes": rule_actions[f"{k if k != 'co2_inject' else 'co2'}_min"]}
                source = "rules"

            executed_any = False
            mapping = {
                "fan": "fan-01",
                "roof_vent": "vent-01",
                "mister": "mister-01",
                "heater": "heater-01",
                "irrigation": "irrigation-01",
                "lights": "lights-01",
                "co2_inject": "co2-01"
            }

            for key, device_id in mapping.items():
                if key in actions:
                    act_data = actions[key]
                    if key == "fan":
                        cmd = {"action": "set_speed", "speed": act_data["speed"], "duration_m": act_data["minutes"]}
                        should_send = act_data["speed"] != "OFF"
                    elif key == "roof_vent":
                        cmd = {"action": "set_opening", "opening": act_data["opening"]}
                        should_send = act_data["opening"] != "CLOSED"
                    else:
                        cmd = {"action": "on" if act_data["on"] else "off", "duration_m": act_data["minutes"]}
                        should_send = act_data["on"]

                    if should_send:
                        if self.dispatcher.send_command(db, device_id, cmd):
                            self.log_action(db, device_id, cmd["action"], cmd, source)
                            executed_any = True

            if executed_any:
                db.commit()
            return True
        except Exception as e:
            log.exception(f"Error in rules engine process: {e}")
            db.rollback()
            return False
        finally:
            db.close()

    def log_action(self, db: Session, device_id: str, action: str, payload: dict, triggered_by: str):
        log_entry = ActionLog(
            actuator_device_id=device_id,
            action=action,
            command_payload=json.dumps(payload),
            triggered_by=triggered_by,
            executed_ts=int(time.time()),
            synced=0
        )
        db.add(log_entry)
        log.info(f"Logged action: {action} on {device_id} triggered by {triggered_by}")

class MockDispatcher:
    def send_command(self, session, device_id, command):
        from models import ConnectedDevice
        from sqlalchemy import select
        device = session.execute(
            select(ConnectedDevice).where(
                ConnectedDevice.device_id == device_id,
                ConnectedDevice.device_type == "actuator",
                ConnectedDevice.revoked == False,
            )
        ).scalar_one_or_none()
        if device:
            log.info(f"[MOCK MQTT] Sending to {device_id}: {command}")
            return True
        return False

def main():
    mock = "--mock" in sys.argv
    engine = RulesEngine(mock_mqtt=mock)
    if "--once" in sys.argv:
        engine.process()
        return
    log.info("Rules Engine Service started. Running every 60 seconds.")
    while True:
        engine.process()
        time.sleep(60)

if __name__ == "__main__":
    main()
