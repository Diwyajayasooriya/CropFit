"""
evaluate.py
-----------
Checks the exported ONNX model against:
  1. the hand-written scenario table  (data/test_scenarios.csv, 33 best/average/worst cases)
  2. a fresh, unseen random dataset    (generated with a different seed)

A scenario PASSES when fan speed, vent opening and every on/off switch are exactly right
AND every duration is within ±TOL minutes (default 5) of the expected value.

Usage:
    python src/evaluate.py
    python src/evaluate.py --tol 5 --unseen 10000
    python src/evaluate.py --thresholds config/thresholds_cucumber.json \
        --scenarios data/test_scenarios_cucumber.csv --models-dir models_cucumber \
        --report-out docs/evaluation_report_cucumber.md
Output:
    docs/evaluation_report.md  (or --report-out; commit this so the team can see the accuracy)
"""
import argparse
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

from greennode_rules import (ROOT, READING_KEYS, THRESHOLD_FEATURES, SWITCH_ACTUATORS,
                             DURATION_KEYS, FAN_LEVELS, VENT_LEVELS, load_thresholds,
                             featurize, featurize_frame, expert_policy,
                             apply_threshold_overrides)
from generate_dataset import sample_thresholds, sample_reading, LABEL_KEYS
from predict import ActionModel

EXP_SW = {"mister": "exp_mister", "heater": "exp_heater", "irrigation": "exp_irrigation",
          "lights": "exp_lights", "co2_inject": "exp_co2_inject"}
EXP_DUR = ["exp_fan_min", "exp_mister_min", "exp_heater_min", "exp_irrigation_min",
           "exp_lights_min", "exp_co2_min"]


def compare(fan, vent, sw, mins, t_fan, t_vent, t_sw, t_mins, tol):
    ok_fan = fan == t_fan
    ok_vent = vent == t_vent
    ok_sw = sw == t_sw
    ok_dur = np.abs(mins - t_mins) <= tol
    return ok_fan, ok_vent, ok_sw, ok_dur, ok_fan & ok_vent & ok_sw.all(1) & ok_dur.all(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tol", type=int, default=5)
    ap.add_argument("--unseen", type=int, default=10000)
    ap.add_argument("--thresholds", default=None,
                   help="Path to a thresholds JSON. Defaults to config/thresholds.json when "
                        "omitted. Must match whatever the model in --models-dir was trained on.")
    ap.add_argument("--scenarios", default=str(ROOT / "data" / "test_scenarios.csv"),
                   help="Scenario CSV to check against, e.g. data/test_scenarios_cucumber.csv")
    ap.add_argument("--models-dir", default=str(ROOT / "models"),
                   help="Directory holding greennode_action.onnx + model_meta.json for the "
                        "crop being evaluated.")
    ap.add_argument("--report-out", default=str(ROOT / "docs" / "evaluation_report.md"))
    args = ap.parse_args()
    th = load_thresholds(args.thresholds) if args.thresholds else load_thresholds()
    models_dir = Path(args.models_dir)
    model = ActionModel(onnx_path=models_dir / "greennode_action.onnx",
                        meta_path=models_dir / "model_meta.json")

    # ---------------- 1. scenario table ----------------
    sc = pd.read_csv(args.scenarios)
    X = np.stack([featurize({k: (int(r[k]) if k == "hour" else r[k]) for k in READING_KEYS}, th)
                  for _, r in sc.iterrows()])
    fan, vent, sw, mins, _ = model.decode_batch(X)
    t_sw = sc[[EXP_SW[k] for k in SWITCH_ACTUATORS]].to_numpy()
    t_mins = sc[EXP_DUR].to_numpy()
    ok_fan, ok_vent, ok_sw, ok_dur, ok_all = compare(fan, vent, sw, mins, sc["exp_fan"].to_numpy(),
                                                     sc["exp_vent"].to_numpy(), t_sw, t_mins, args.tol)
    rows = []
    for i, r in sc.iterrows():
        pred = (f"fan {FAN_LEVELS[fan[i]]} {mins[i,0]}m, vent {VENT_LEVELS[vent[i]]}, "
                + ", ".join(f"{k} {mins[i,j+1]}m" for j, k in enumerate(SWITCH_ACTUATORS) if sw[i, j]))
        exp = (f"fan {FAN_LEVELS[r.exp_fan]} {r.exp_fan_min}m, vent {VENT_LEVELS[r.exp_vent]}, "
               + ", ".join(f"{k} {t_mins[i,j+1]}m" for j, k in enumerate(SWITCH_ACTUATORS) if t_sw[i, j]))
        rows.append((r.id, r.sensor, r.case, exp, pred, "PASS" if ok_all[i] else "FAIL"))
        print(f"{r.id:<5} {'PASS' if ok_all[i] else 'FAIL'}  expected: {exp}\n{'':<11}model:    {pred}")
    sc_acc = ok_all.mean()
    print(f"\nScenario table: {ok_all.sum()}/{len(sc)} passed ({sc_acc:.1%})")

    # ---------------- 2. unseen random data ----------------
    rng = np.random.default_rng(2026)
    recs = []
    for _ in range(args.unseen):
        tv = sample_thresholds(rng, th, jitter=rng.random() < 0.7)
        r = sample_reading(rng, tv)
        a = expert_policy(r, apply_threshold_overrides(th, tv))
        recs.append({**r, **tv, **{k: a[k] for k in LABEL_KEYS}})
    un = pd.DataFrame(recs)
    fan2, vent2, sw2, mins2, _ = model.decode_batch(featurize_frame(un, th))
    o_fan, o_vent, o_sw, o_dur, o_all = compare(
        fan2, vent2, sw2, mins2, un["fan"].to_numpy(), un["vent"].to_numpy(),
        un[SWITCH_ACTUATORS].to_numpy(), un[DURATION_KEYS].to_numpy(), args.tol)
    per = {"fan speed": o_fan.mean(), "roof vent": o_vent.mean()}
    for j, k in enumerate(SWITCH_ACTUATORS):
        per[f"{k} on/off"] = o_sw[:, j].mean()
    t_on = un[DURATION_KEYS].to_numpy() > 0
    for j, k in enumerate(DURATION_KEYS):
        per[f"{k} within ±{args.tol} min (when ON)"] = o_dur[t_on[:, j], j].mean() if t_on[:, j].any() else 1.0
    print(f"\nUnseen data ({args.unseen:,} rows): full-action match {o_all.mean():.1%}")
    for k, v in per.items():
        print(f"  {k:<40} {v:.1%}")

    # ---------------- report ----------------
    md = [f"# Evaluation report — {date.today()}", "",
          f"Model: `{models_dir / 'greennode_action.onnx'}` · tolerance for durations: ±{args.tol} min", "",
          "## 1. Scenario table (best / average / worst cases)", "",
          f"**{ok_all.sum()}/{len(sc)} scenarios passed ({sc_acc:.1%})**", "",
          "| ID | Sensor | Case | Expected | Model output | Result |", "|---|---|---|---|---|---|"]
    md += [f"| {a} | {b} | {c} | {d} | {e} | {f} |" for a, b, c, d, e, f in rows]
    md += ["", f"## 2. Unseen random data ({args.unseen:,} rows)", "",
           f"**Full-action match: {o_all.mean():.1%}** (every actuator and every duration correct)", "",
           "| Output | Accuracy |", "|---|---|"]
    md += [f"| {k} | {v:.1%} |" for k, v in per.items()]
    report_path = Path(args.report_out)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(md) + "\n", encoding="utf-8")
    print(f"\nSaved {report_path}")


if __name__ == "__main__":
    main()
