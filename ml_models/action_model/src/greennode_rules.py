"""
greennode_rules.py
------------------
Shared logic used by EVERY other script (dataset generation, training,
evaluation, and on-device prediction).

It contains three things:

1. load_thresholds()   -> reads config/thresholds.json (the Stage-1 agronomic priors
                          that go into node_rules_cache)
2. expert_policy()     -> the "teacher": turns sensor readings + thresholds into the
                          correct actuator actions. Used to LABEL the synthetic
                          training data (cold start, no actions_log yet) and to
                          produce the expected answers in the test-scenario table.
3. featurize()         -> converts raw readings + thresholds into the numeric vector
                          the neural network sees. Training and prediction MUST use
                          the same function, which is why it lives here.
4. farmer_message()    -> converts an action into simple instructions for the farmer.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "thresholds.json"

# ----------------------------------------------------------------------------
# Output vocabulary (what the model predicts)
# ----------------------------------------------------------------------------
FAN_LEVELS = ["OFF", "LOW", "MEDIUM", "HIGH"]          # fan speed class
FAN_SPEED_PCT = {"OFF": 0, "LOW": 40, "MEDIUM": 70, "HIGH": 100}
VENT_LEVELS = ["CLOSED", "HALF", "FULL"]               # roof vent opening
VENT_OPEN_PCT = {"CLOSED": 0, "HALF": 50, "FULL": 100}

# on/off actuators that also get a duration
SWITCH_ACTUATORS = ["mister", "heater", "irrigation", "lights", "co2_inject"]

# All duration outputs (minutes)
DURATION_KEYS = ["fan_min", "mister_min", "heater_min", "irrigation_min", "lights_min", "co2_min"]

# Raw sensor inputs expected from the edge DB `conditions` table
READING_KEYS = [
    "air_temp",      # °C inside greenhouse
    "rh",            # % relative humidity
    "soil_moisture", # % (calibrated capacitive sensor)
    "soil_temp",     # °C root zone
    "co2",           # ppm (µmol/mol)
    "outside_temp",  # °C (weather station / API)
    "hour",          # 0-23 local time
    "dli_so_far",    # MJ/m² of solar radiation received today so far
]


def load_thresholds(path: Path | str = CONFIG_PATH) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _ceil_to(x: float, step: int) -> int:
    """Round UP to the next multiple of `step` minutes (farmers read 5-min steps easily)."""
    if x <= 0:
        return 0
    return int(math.ceil(x / step) * step)


def _dur(x: float, th: dict, cap_key: str, minimum: int = 5) -> int:
    lim = th["limits"]
    return int(min(max(_ceil_to(x, lim["round_to_min"]), minimum), lim[cap_key]))


# ----------------------------------------------------------------------------
# 2. EXPERT POLICY (teacher)
# ----------------------------------------------------------------------------
def expert_policy(r: dict, th: dict) -> dict:
    """Return the correct action for one set of readings `r` under thresholds `th`.

    Output dict keys:
      fan (0-3 index into FAN_LEVELS), fan_min,
      vent (0-2 index into VENT_LEVELS),
      mister, heater, irrigation, lights, co2  (0/1),
      *_min durations, alerts (list[str], not learned by the model)
    """
    T, RH, SM, ST = r["air_temp"], r["rh"], r["soil_moisture"], r["soil_temp"]
    CO2, TOUT, HOUR, DLI = r["co2"], r["outside_temp"], int(r["hour"]), r["dli_so_far"]
    at, rh_t, sm_t = th["air_temp"], th["rh"], th["soil_moisture"]
    co2_t, li, rt = th["co2"], th["light"], th["actuator_rates"]

    a = {"fan": 0, "fan_min": 0, "vent": 0, "mister": 0, "mister_min": 0,
         "heater": 0, "heater_min": 0, "irrigation": 0, "irrigation_min": 0,
         "lights": 0, "lights_min": 0, "co2_inject": 0, "co2_min": 0, "alerts": []}

    cooling = False

    # ---- 1. Too hot -> fan + vent (+ misting if air is dry enough) --------
    if T > at["cool_trigger"]:
        cooling = True
        excess = T - at["cool_target"]
        speed = 1 if excess <= 3 else (2 if excess <= 7 else 3)
        if TOUT <= T - 2:                       # outside air can carry heat away
            a["vent"] = 2 if excess > 7 else 1
            eff = float(np.clip((T - TOUT) / 5.0, 0.4, 1.0))
        else:                                   # outside is as hot -> venting helps little
            a["vent"] = 1
            speed = max(speed, 2)
            eff = 0.4
            a["alerts"].append("Outside air is as hot as inside: pull the shade net over the roof.")
        rate = rt["fan_cool_c_per_min"][FAN_LEVELS[speed]] * eff
        a["fan"] = speed
        a["fan_min"] = _dur(excess / rate, th, "fan_max_min", minimum=10)
        if RH < 80:                             # evaporative cooling assist
            a["mister"] = 1
            a["mister_min"] = min(_ceil_to(a["fan_min"] / 2, 5), th["limits"]["mister_max_min"])
        if T >= at["critical_high"]:
            a["alerts"].append("CRITICAL heat: check plants for wilting and check again in 15 minutes.")

    # ---- 2. Too cold (air or root zone) -> heater, vents closed -----------
    heat_air = T < at["heat_trigger"]
    heat_soil = ST < th["soil_temp"]["heat_trigger"]
    if heat_air or heat_soil:
        m_air = (at["heat_target"] - T) / rt["heater_c_per_min"] if heat_air else 0
        m_soil = (th["soil_temp"]["heat_target"] - ST) / rt["soil_heater_c_per_min"] if heat_soil else 0
        a["heater"] = 1
        a["heater_min"] = _dur(max(m_air, m_soil), th, "heater_max_min", minimum=10)
        if not cooling:
            a["vent"], a["fan"], a["fan_min"] = 0, 0, 0

    # ---- 3. Too humid -> vent + fan (+ heat if cold) ----------------------
    if RH > rh_t["high_trigger"] and not cooling:
        need = _dur((RH - rh_t["high_target"]) / rt["dehumidify_rh_per_min"], th, "fan_max_min", minimum=10)
        a["vent"] = max(a["vent"], 1)
        a["fan"] = max(a["fan"], 2 if RH >= rh_t["disease_risk"] else 1)
        a["fan_min"] = max(a["fan_min"], need)
        if T < at["opt_min"]:                   # cold + humid: warm the air while venting
            a["heater"] = 1
            a["heater_min"] = max(a["heater_min"], need)
        if RH >= rh_t["disease_risk"]:
            a["alerts"].append("Very humid: risk of fungal disease. Check leaves for mould spots.")

    # ---- 4. Too dry air -> mister -----------------------------------------
    if RH < rh_t["low_trigger"]:
        m = _dur((rh_t["low_target"] - RH) / rt["mister_rh_per_min"], th, "mister_max_min")
        a["mister"] = 1
        a["mister_min"] = max(a["mister_min"], m)

    # ---- 5. Soil moisture -> irrigation -----------------------------------
    if SM > sm_t["waterlogged"]:
        a["alerts"].append("Soil is waterlogged: do NOT irrigate. Check drainage.")
    elif SM < sm_t["low_trigger"]:
        night = HOUR >= 19 or HOUR < 6
        if night and SM >= sm_t["critical_low"]:
            a["alerts"].append("Soil is getting dry: irrigate early tomorrow morning.")
        else:
            a["irrigation"] = 1
            a["irrigation_min"] = _dur((sm_t["target"] - SM) / rt["irrigation_pct_per_min"],
                                       th, "irrigation_max_min")

    # ---- 6. CO2 -------------------------------------------------------------
    if CO2 > co2_t["safety_high"]:
        a["vent"] = max(a["vent"], 1)
        a["fan"] = max(a["fan"], 1)
        a["fan_min"] = max(a["fan_min"], 15)
        a["alerts"].append("CO2 too high: do not stay inside the closed greenhouse for long.")
    elif 7 <= HOUR < 17 and a["vent"] == 0 and CO2 < co2_t["enrich_trigger"]:
        a["co2_inject"] = 1
        a["co2_min"] = _dur((co2_t["enrich_target"] - CO2) / rt["co2_ppm_per_min"], th, "co2_max_min")

    # ---- 7. Light -> grow lights in the evening window --------------------
    if li["supplement_window_start_hour"] <= HOUR <= li["supplement_window_end_hour"]:
        deficit = li["dli_min_mj"] - DLI
        if deficit >= 0.25:
            a["lights"] = 1
            a["lights_min"] = _dur(deficit / rt["grow_light_mj_per_hour"] * 60, th, "lights_max_min", minimum=15)

    return a


# ----------------------------------------------------------------------------
# 3. FEATURES (model input)
# ----------------------------------------------------------------------------
THRESHOLD_FEATURES = ["cool_trigger", "cool_target", "heat_trigger", "rh_high", "rh_low",
                      "sm_low", "co2_trigger"]


def threshold_vector(th: dict) -> dict:
    return {
        "cool_trigger": th["air_temp"]["cool_trigger"],
        "cool_target": th["air_temp"]["cool_target"],
        "heat_trigger": th["air_temp"]["heat_trigger"],
        "rh_high": th["rh"]["high_trigger"],
        "rh_low": th["rh"]["low_trigger"],
        "sm_low": th["soil_moisture"]["low_trigger"],
        "co2_trigger": th["co2"]["enrich_trigger"],
    }


FEATURE_NAMES = [
    # raw readings
    "air_temp", "rh", "soil_moisture", "soil_temp", "co2", "outside_temp", "dli_so_far",
    # time encoding
    "hour_sin", "hour_cos", "is_day", "is_night", "co2_window", "light_window",
    # distance to the ACTIVE thresholds (this is what lets the same model keep working
    # when Stage 2 changes node_rules_cache)
    "d_cool_trigger", "d_cool_target", "d_heat", "d_rh_high", "d_rh_low", "d_sm_low",
    "d_co2", "d_soil_heat", "d_inside_outside", "d_dli",
]


def featurize(r: dict, th: dict) -> np.ndarray:
    tv = threshold_vector(th)
    h = int(r["hour"])
    li = th["light"]
    f = [
        r["air_temp"], r["rh"], r["soil_moisture"], r["soil_temp"], r["co2"],
        r["outside_temp"], r["dli_so_far"],
        math.sin(2 * math.pi * h / 24), math.cos(2 * math.pi * h / 24),
        1.0 if 6 <= h < 18 else 0.0,
        1.0 if (h >= 19 or h < 6) else 0.0,
        1.0 if 7 <= h < 17 else 0.0,
        1.0 if li["supplement_window_start_hour"] <= h <= li["supplement_window_end_hour"] else 0.0,
        r["air_temp"] - tv["cool_trigger"],
        r["air_temp"] - tv["cool_target"],
        tv["heat_trigger"] - r["air_temp"],
        r["rh"] - tv["rh_high"],
        tv["rh_low"] - r["rh"],
        tv["sm_low"] - r["soil_moisture"],
        tv["co2_trigger"] - r["co2"],
        th["soil_temp"]["heat_trigger"] - r["soil_temp"],
        r["air_temp"] - r["outside_temp"],
        li["dli_min_mj"] - r["dli_so_far"],
    ]
    return np.asarray(f, dtype=np.float32)


# ----------------------------------------------------------------------------
# 4. FARMER MESSAGE
# ----------------------------------------------------------------------------
def farmer_message(r: dict, a: dict, th: dict) -> list[str]:
    """Plain-language instructions. One line per actuator that must be switched on."""
    at, rh_t = th["air_temp"], th["rh"]
    msgs = []
    if a["fan"] > 0:
        lvl = FAN_LEVELS[a["fan"]]
        why = (f"Too hot ({r['air_temp']:.1f}°C, should be below {at['cool_trigger']:.0f}°C)"
               if r["air_temp"] > at["cool_trigger"] else
               f"Too humid ({r['rh']:.0f}%, should be below {rh_t['high_trigger']:.0f}%)"
               if r["rh"] > rh_t["high_trigger"] else "Air needs to be refreshed")
        msgs.append(f"{why}. Turn ON the FAN at {lvl} speed ({FAN_SPEED_PCT[lvl]}%) "
                    f"for {a['fan_min']} minutes.")
    if a["vent"] > 0:
        v = VENT_LEVELS[a["vent"]]
        msgs.append(f"Open the ROOF VENT {v.lower()} ({VENT_OPEN_PCT[v]}% open).")
    if a["mister"]:
        if r["rh"] < rh_t["low_trigger"]:
            msgs.append(f"Air is too dry ({r['rh']:.0f}%, should be above {rh_t['low_trigger']:.0f}%). "
                        f"Turn ON the MISTER for {a['mister_min']} minutes.")
        else:
            msgs.append(f"Turn ON the MISTER for {a['mister_min']} minutes to help cool the air.")
    if a["heater"]:
        keep = " Keep the vents closed." if a["vent"] == 0 else ""
        if r["air_temp"] < at["opt_min"]:
            msgs.append(f"Too cold ({r['air_temp']:.1f}°C). Turn ON the HEATER, set it to "
                        f"{at['heat_target']:.0f}°C, for {a['heater_min']} minutes.{keep}")
        else:
            st = th["soil_temp"]
            msgs.append(f"Roots are too cold (soil {r['soil_temp']:.1f}°C, should be above "
                        f"{st['heat_trigger']:.0f}°C). Turn ON the ROOT-ZONE HEATER, set it to "
                        f"{st['heat_target']:.0f}°C, for {a['heater_min']} minutes.{keep}")
    if a["irrigation"]:
        msgs.append(f"Soil is dry ({r['soil_moisture']:.0f}%). Turn ON IRRIGATION "
                    f"for {a['irrigation_min']} minutes.")
    if a["co2_inject"]:
        msgs.append(f"Turn ON the CO2 supply for {a['co2_min']} minutes (vents must stay closed).")
    if a["lights"]:
        msgs.append(f"Not enough sunlight today. Turn ON the GROW LIGHTS for {a['lights_min']} minutes.")
    msgs.extend(a.get("alerts", []))
    if not msgs:
        msgs.append("All good. No action needed.")
    return msgs


def apply_threshold_overrides(base: dict, tv: dict) -> dict:
    """Build a full thresholds dict from the 7 key threshold values (one row of data).
    Dependent values (targets) are derived the same way everywhere."""
    th = json.loads(json.dumps(base))  # deep copy
    at, rh, sm, co2 = th["air_temp"], th["rh"], th["soil_moisture"], th["co2"]
    at["cool_trigger"] = tv["cool_trigger"]
    at["cool_target"] = tv["cool_target"]
    at["critical_high"] = tv["cool_trigger"] + (base["air_temp"]["critical_high"] - base["air_temp"]["cool_trigger"])
    at["heat_trigger"] = tv["heat_trigger"]
    at["heat_target"] = tv["heat_trigger"] + (base["air_temp"]["heat_target"] - base["air_temp"]["heat_trigger"])
    at["opt_min"] = tv["heat_trigger"] + (base["air_temp"]["opt_min"] - base["air_temp"]["heat_trigger"])
    rh["high_trigger"] = tv["rh_high"]
    rh["high_target"] = tv["rh_high"] - (base["rh"]["high_trigger"] - base["rh"]["high_target"])
    rh["low_trigger"] = tv["rh_low"]
    rh["low_target"] = tv["rh_low"] + (base["rh"]["low_target"] - base["rh"]["low_trigger"])
    sm["low_trigger"] = tv["sm_low"]
    sm["critical_low"] = tv["sm_low"] - (base["soil_moisture"]["low_trigger"] - base["soil_moisture"]["critical_low"])
    sm["target"] = min(tv["sm_low"] + (base["soil_moisture"]["target"] - base["soil_moisture"]["low_trigger"]), 85.0)
    co2["enrich_trigger"] = tv["co2_trigger"]
    co2["enrich_target"] = tv["co2_trigger"] + (base["co2"]["enrich_target"] - base["co2"]["enrich_trigger"])
    return th


def featurize_frame(df, base: dict) -> np.ndarray:
    """Vectorised featurize() for a whole DataFrame that has READING_KEYS + THRESHOLD_FEATURES
    columns. Gives exactly the same numbers as featurize() row by row (checked in tests)."""
    h = df["hour"].astype(int).to_numpy()
    li = base["light"]
    T, RH, SM, ST = (df[c].to_numpy(np.float64) for c in ["air_temp", "rh", "soil_moisture", "soil_temp"])
    CO2, TOUT, DLI = (df[c].to_numpy(np.float64) for c in ["co2", "outside_temp", "dli_so_far"])
    cols = [
        T, RH, SM, ST, CO2, TOUT, DLI,
        np.sin(2 * np.pi * h / 24), np.cos(2 * np.pi * h / 24),
        ((h >= 6) & (h < 18)).astype(float),
        ((h >= 19) | (h < 6)).astype(float),
        ((h >= 7) & (h < 17)).astype(float),
        ((h >= li["supplement_window_start_hour"]) & (h <= li["supplement_window_end_hour"])).astype(float),
        T - df["cool_trigger"].to_numpy(), T - df["cool_target"].to_numpy(),
        df["heat_trigger"].to_numpy() - T, RH - df["rh_high"].to_numpy(),
        df["rh_low"].to_numpy() - RH, df["sm_low"].to_numpy() - SM,
        df["co2_trigger"].to_numpy() - CO2, base["soil_temp"]["heat_trigger"] - ST,
        T - TOUT, li["dli_min_mj"] - DLI,
    ]
    return np.stack(cols, axis=1).astype(np.float32)
