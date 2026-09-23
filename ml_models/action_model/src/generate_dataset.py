"""
generate_dataset.py
-------------------
Cold-start training data (Stage 3 of greennode-ml-rules-process.md).

We have no `actions_log` history yet, so we create realistic sensor situations and
label each one with the expert policy (greennode_rules.expert_policy), which encodes
the agronomic thresholds from the research table. The neural network learns to
imitate this policy. Later, real `actions_log` rows are appended to this CSV and the
model is re-trained (see README, "Retraining with real farm data").

Thresholds are randomly varied per row (e.g. cooling trigger 25-32 °C) so the model
learns to read the ACTIVE thresholds from node_rules_cache instead of memorising 28 °C.

Usage:
    python src/generate_dataset.py --rows 80000 --seed 42
Output:
    data/training_data.csv
"""
import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from greennode_rules import (ROOT, READING_KEYS, THRESHOLD_FEATURES, DURATION_KEYS,
                             load_thresholds, expert_policy, apply_threshold_overrides)

LABEL_KEYS = ["fan", "vent", "mister", "heater", "irrigation", "lights", "co2_inject"] + DURATION_KEYS


def sample_thresholds(rng, base, jitter=True):
    if not jitter:
        at, rh, sm, co2 = base["air_temp"], base["rh"], base["soil_moisture"], base["co2"]
        return {"cool_trigger": at["cool_trigger"], "cool_target": at["cool_target"],
                "heat_trigger": at["heat_trigger"], "rh_high": rh["high_trigger"],
                "rh_low": rh["low_trigger"], "sm_low": sm["low_trigger"],
                "co2_trigger": co2["enrich_trigger"]}
    ct = round(rng.uniform(25, 32), 1)
    return {"cool_trigger": ct, "cool_target": ct - 2.0,
            "heat_trigger": round(rng.uniform(8, 15), 1),
            "rh_high": round(rng.uniform(85, 93), 1),
            "rh_low": round(rng.uniform(55, 65), 1),
            "sm_low": round(rng.uniform(40, 60), 1),
            "co2_trigger": round(rng.uniform(600, 800), 0)}


def sample_reading(rng, tv):
    near = rng.random() < 0.35  # 35% of rows sit close to a threshold (hardest cases)
    hour = int(rng.integers(0, 24))
    if near:
        air = rng.normal(rng.choice([tv["cool_trigger"], tv["heat_trigger"]]), 2.0)
        rh = rng.normal(rng.choice([tv["rh_high"], tv["rh_low"]]), 3.0)
        sm = rng.normal(tv["sm_low"], 4.0)
        co2 = rng.normal(rng.choice([tv["co2_trigger"], 1500.0]), 60.0)
    else:
        air = rng.uniform(5, 45)
        rh = rng.uniform(35, 100)
        sm = rng.uniform(15, 98)
        co2 = rng.uniform(250, 1800) if rng.random() < 0.3 else rng.uniform(300, 1100)
    outside = air + rng.normal(-3, 4) if rng.random() < 0.8 else rng.uniform(15, 40)
    soil_t = rng.normal(22, 4) if rng.random() < 0.8 else rng.uniform(8, 32)
    day_frac = float(np.clip((hour - 6) / 12.0, 0, 1))
    dli = day_frac * rng.uniform(3, 20)
    return {"air_temp": round(float(np.clip(air, 0, 50)), 1),
            "rh": round(float(np.clip(rh, 20, 100)), 1),
            "soil_moisture": round(float(np.clip(sm, 5, 100)), 1),
            "soil_temp": round(float(np.clip(soil_t, 5, 35)), 1),
            "co2": round(float(np.clip(co2, 250, 2000)), 0),
            "outside_temp": round(float(np.clip(outside, 5, 45)), 1),
            "hour": hour,
            "dli_so_far": round(dli, 2)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--rows", type=int, default=80000)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--out", default=str(ROOT / "data" / "training_data.csv"))
    args = p.parse_args()

    rng = np.random.default_rng(args.seed)
    base = load_thresholds()
    rows = []
    for i in range(args.rows):
        tv = sample_thresholds(rng, base, jitter=rng.random() < 0.7)  # 30% use exact defaults
        r = sample_reading(rng, tv)
        th = apply_threshold_overrides(base, tv)
        a = expert_policy(r, th)
        rows.append({**r, **tv, **{k: a[k] for k in LABEL_KEYS}})
    df = pd.DataFrame(rows, columns=READING_KEYS + THRESHOLD_FEATURES + LABEL_KEYS)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(args.out, index=False)
    print(f"Saved {len(df):,} rows -> {args.out}")
    print("Share of rows where each actuator is ON:")
    for k in ["fan", "vent", "mister", "heater", "irrigation", "lights", "co2_inject"]:
        print(f"  {k:<11} {(df[k] > 0).mean():6.1%}")


if __name__ == "__main__":
    main()
