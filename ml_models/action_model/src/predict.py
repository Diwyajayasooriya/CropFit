"""
predict.py
----------
Runs the trained ONNX model on the Raspberry Pi hub (or any PC) and turns the output
into farmer instructions. Also importable from the FastAPI backend:

    from predict import ActionModel
    model = ActionModel()                      # loads models/greennode_action.onnx
    result = model.recommend(readings, thresholds)   # thresholds = node_rules_cache row

CLI example (the 40 °C case):
    python src/predict.py --air_temp 40 --rh 78 --soil_moisture 65 --soil_temp 22 \
        --co2 750 --outside_temp 30 --hour 12 --dli_so_far 5

Safety: the rule engine stays the "safety fallback" (pitch deck slide 4). If the model
ever says OFF while a CRITICAL rule (extreme heat, frost, dangerous CO2) says ON, the
rule wins, and the response says so in `overridden_by_rules`.
"""
from __future__ import annotations

import argparse
import json

import numpy as np

from greennode_rules import (ROOT, READING_KEYS, FAN_LEVELS, VENT_LEVELS, SWITCH_ACTUATORS,
                             DURATION_KEYS, load_thresholds, expert_policy, featurize,
                             farmer_message)


class ActionModel:
    def __init__(self, onnx_path=ROOT / "models" / "greennode_action.onnx",
                 meta_path=ROOT / "models" / "model_meta.json"):
        import onnxruntime as ort
        self.sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        self.input_name = self.sess.get_inputs()[0].name
        self.meta = json.loads(open(meta_path, encoding="utf-8").read())
        self.caps = np.array(self.meta["duration_caps_min"], dtype=np.float32)
        self.step = self.meta["round_to_min"]
        # map outputs by their width (4 = fan, 3 = vent, 5 = switches, 6 = durations)
        self.out_names = {o.shape[-1]: o.name for o in self.sess.get_outputs()}

    def raw(self, X: np.ndarray):
        outs = self.sess.run(None, {self.input_name: X.astype(np.float32)})
        by_width = {o.shape[-1]: o for o in outs}
        return by_width[4], by_width[3], by_width[len(SWITCH_ACTUATORS)], by_width[len(DURATION_KEYS)]

    def decode_batch(self, X: np.ndarray):
        fan_p, vent_p, sw_p, dur_p = self.raw(X)
        fan, vent = fan_p.argmax(1), vent_p.argmax(1)
        sw = (sw_p >= 0.5).astype(int)
        mins = np.round(dur_p * self.caps / self.step) * self.step
        on = np.concatenate([(fan > 0)[:, None], sw], axis=1)
        mins = np.where(on == 1, np.maximum(mins, self.step), 0).astype(int)
        return fan, vent, sw, mins, fan_p.max(1)

    def recommend(self, readings: dict, th: dict | None = None, safety: bool = True) -> dict:
        th = th or load_thresholds()
        X = featurize(readings, th)[None, :]
        fan, vent, sw, mins, conf = self.decode_batch(X)
        a = {"fan": int(fan[0]), "vent": int(vent[0]), "fan_min": int(mins[0, 0])}
        for i, k in enumerate(SWITCH_ACTUATORS):
            a[k] = int(sw[0, i])
        for i, k in enumerate(DURATION_KEYS[1:], start=1):
            a[k] = int(mins[0, i])

        rules = expert_policy(readings, th)
        a["alerts"] = rules["alerts"]          # alerts come from rules, not the model
        overridden = []
        if safety:
            at, co2 = th["air_temp"], th["co2"]
            critical = {
                "fan": readings["air_temp"] >= at["critical_high"] or readings["co2"] > co2["safety_high"],
                "heater": readings["air_temp"] < at["heat_trigger"],
            }
            for k, is_crit in critical.items():
                if is_crit and rules[k] and not a[k]:
                    a[k] = rules[k]
                    a[f"{k}_min"] = rules[f"{k}_min"]
                    if k == "fan":
                        a["vent"] = max(a["vent"], rules["vent"])
                    overridden.append(k)
        return {
            "actions": {
                "fan": {"speed": FAN_LEVELS[a["fan"]], "minutes": a["fan_min"]},
                "roof_vent": {"opening": VENT_LEVELS[a["vent"]]},
                **{k: {"on": bool(a[k]), "minutes": a[f"{k if k != 'co2_inject' else 'co2'}_min"]}
                   for k in SWITCH_ACTUATORS},
            },
            "farmer_message": farmer_message(readings, a, th),
            "model_confidence_fan": round(float(conf[0]), 3),
            "overridden_by_rules": overridden,
        }


def main():
    ap = argparse.ArgumentParser(description="GreenNode action recommendation")
    defaults = {"air_temp": 24, "rh": 78, "soil_moisture": 65, "soil_temp": 22, "co2": 750,
                "outside_temp": 22, "hour": 10, "dli_so_far": 4}
    for k in READING_KEYS:
        ap.add_argument(f"--{k}", type=float, default=defaults[k])
    args = ap.parse_args()
    r = {k: getattr(args, k) for k in READING_KEYS}
    r["hour"] = int(r["hour"])
    out = ActionModel().recommend(r)
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
