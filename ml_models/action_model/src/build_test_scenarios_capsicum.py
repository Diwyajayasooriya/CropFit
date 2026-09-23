"""
build_test_scenarios_capsicum.py
----------------------------------
Same pattern as build_test_scenarios_cucumber.py -- a NORMAL baseline and scenario values tuned
to capsicum's own thresholds (config/thresholds_capsicum.json), not reused from tomato or
cucumber. Capsicum's optimal band is narrower on temperature (20-25C) than either other crop and
its RH/soil-moisture targets differ too, so reusing another crop's baseline would misrepresent
the "Best" case again, the same mistake avoided for cucumber.

Usage:
    python src/build_test_scenarios_capsicum.py
Output:
    data/test_scenarios_capsicum.csv
    docs/test_scenario_table_capsicum.md
"""
import pandas as pd

from greennode_rules import (ROOT, READING_KEYS, FAN_LEVELS, FAN_SPEED_PCT, VENT_LEVELS,
                             VENT_OPEN_PCT, load_thresholds, expert_policy, farmer_message)

CONFIG_PATH = ROOT / "config" / "thresholds_capsicum.json"

# A normal, healthy mid-morning capsicum greenhouse -- tuned to thresholds_capsicum.json
# (opt_min/opt_max 20-25C, RH opt 70-80%, soil moisture target 80%, soil temp target 20C).
NORMAL = {"air_temp": 22.0, "rh": 75.0, "soil_moisture": 80.0, "soil_temp": 20.0,
          "co2": 850.0, "outside_temp": 19.0, "hour": 10, "dli_so_far": 5.5}

SCENARIOS = [
    # ---------------- Air temperature ----------------
    ("T-01", "Air temperature", "Best", "Comfortable day", {"air_temp": 22.0}),
    ("T-02", "Air temperature", "Average", "Slightly warm late morning", {"air_temp": 29.0, "outside_temp": 25.0}),
    ("T-03", "Air temperature", "Average", "Warm, above cool trigger", {"air_temp": 30.0, "outside_temp": 26.0}),
    ("T-04", "Air temperature", "Worst", "Very hot noon (40 C), outside 30 C", {"air_temp": 40.0, "outside_temp": 30.0, "hour": 12}),
    ("T-05", "Air temperature", "Worst", "Heatwave, at pollen-failure line (32 C), outside 31 C", {"air_temp": 32.0, "outside_temp": 31.0, "hour": 13}),
    ("T-06", "Air temperature", "Average", "Cool night (15 C), at heat trigger", {"air_temp": 15.0, "outside_temp": 13.0, "hour": 2, "dli_so_far": 0.0}),
    ("T-07", "Air temperature", "Worst", "Cold night (11 C), below the 13 C poor-growth line", {"air_temp": 11.0, "outside_temp": 9.0, "hour": 3, "dli_so_far": 0.0}),
    # ---------------- Relative humidity ----------------
    ("H-01", "Relative humidity", "Best", "Humidity in band (75%)", {"rh": 75.0}),
    ("H-02", "Relative humidity", "Average", "Humid morning (85%), above 80% ceiling", {"rh": 85.0}),
    ("H-03", "Relative humidity", "Worst", "Saturated, cool night (93%, 16 C)", {"rh": 93.0, "air_temp": 16.0, "outside_temp": 14.0, "hour": 5, "dli_so_far": 0.0}),
    ("H-04", "Relative humidity", "Average", "Slightly dry air (55%), below 60% floor", {"rh": 55.0}),
    ("H-05", "Relative humidity", "Worst", "Very dry air (40%)", {"rh": 40.0, "air_temp": 25.0}),
    # ---------------- Soil moisture ----------------
    ("S-01", "Soil moisture", "Best", "Moist soil at target (80%)", {"soil_moisture": 80.0}),
    ("S-02", "Soil moisture", "Average", "Drying soil, daytime (55%)", {"soil_moisture": 55.0}),
    ("S-03", "Soil moisture", "Worst", "Very dry soil, daytime (35%)", {"soil_moisture": 35.0}),
    ("S-04", "Soil moisture", "Average", "Drying soil at night (55%)", {"soil_moisture": 55.0, "hour": 22, "air_temp": 18.0, "outside_temp": 16.0, "dli_so_far": 0.0}),
    ("S-05", "Soil moisture", "Worst", "Very dry soil at night (40%)", {"soil_moisture": 40.0, "hour": 22, "air_temp": 18.0, "outside_temp": 16.0, "dli_so_far": 0.0}),
    ("S-06", "Soil moisture", "Worst", "Waterlogged soil (95%)", {"soil_moisture": 95.0}),
    # ---------------- Soil (root-zone) temperature ----------------
    ("R-01", "Soil temperature", "Best", "Warm root zone at target (20 C)", {"soil_temp": 20.0}),
    ("R-02", "Soil temperature", "Average", "Cool root zone (18 C), below 19 C trigger", {"soil_temp": 18.0}),
    ("R-03", "Soil temperature", "Worst", "Cold root zone (12 C)", {"soil_temp": 12.0}),
    # ---------------- CO2 ----------------
    ("C-01", "CO2", "Best", "Enriched, vents closed (900 ppm target)", {"co2": 900.0}),
    ("C-02", "CO2", "Average", "Slightly low CO2 (650 ppm)", {"co2": 650.0}),
    ("C-03", "CO2", "Worst", "Depleted CO2 (380 ppm)", {"co2": 380.0}),
    ("C-04", "CO2", "Average", "Low CO2 but vents open for cooling", {"co2": 650.0, "air_temp": 30.0, "outside_temp": 26.0}),
    ("C-05", "CO2", "Average", "Low CO2 at night (no photosynthesis)", {"co2": 480.0, "hour": 21, "air_temp": 18.0, "outside_temp": 16.0, "dli_so_far": 0.0}),
    ("C-06", "CO2", "Worst", "Dangerously high CO2 (1700 ppm)", {"co2": 1700.0}),
    # ---------------- Light (daily light integral) ----------------
    ("L-01", "Light (DLI)", "Best", "Sunny day, 10.5 MJ/m2 by 5 pm", {"hour": 17, "dli_so_far": 10.5}),
    ("L-02", "Light (DLI)", "Average", "Cloudy day, 8 MJ/m2 by 5 pm", {"hour": 17, "dli_so_far": 8.0}),
    ("L-03", "Light (DLI)", "Worst", "Monsoon day, 3.5 MJ/m2 by 5 pm", {"hour": 17, "dli_so_far": 3.5}),
    # ---------------- Combined ----------------
    ("X-01", "Combined", "Best", "Everything optimal", {}),
    ("X-02", "Combined", "Worst", "Hot + dry air + dry soil at noon", {"air_temp": 33.0, "outside_temp": 28.0, "rh": 58.0, "soil_moisture": 45.0, "hour": 12}),
    ("X-03", "Combined", "Worst", "Cold + saturated night", {"air_temp": 13.0, "outside_temp": 11.0, "rh": 92.0, "hour": 4, "dli_so_far": 0.0}),
]


def stop_when(r, a, th):
    at, rh, sm, co2 = th["air_temp"], th["rh"], th["soil_moisture"], th["co2"]
    s = []
    if a["fan"] and r["air_temp"] > at["cool_trigger"]:
        s.append(f"air temp <= {at['cool_target']:.0f}C")
    elif a["fan"] and r["rh"] > rh["high_trigger"]:
        s.append(f"RH <= {rh['high_target']:.0f}%")
    if a["heater"]:
        if r["air_temp"] < at["heat_trigger"]:
            s.append(f"air temp >= {at['heat_target']:.0f}C")
        if r["soil_temp"] < th["soil_temp"]["heat_trigger"]:
            s.append(f"soil temp >= {th['soil_temp']['heat_target']:.0f}C")
    if a["mister"] and r["rh"] < rh["low_trigger"]:
        s.append(f"RH >= {rh['low_target']:.0f}%")
    if a["irrigation"]:
        s.append(f"soil moisture >= {sm['target']:.0f}%")
    if a["co2_inject"]:
        s.append(f"CO2 >= {co2['enrich_target']:.0f} ppm")
    if a["lights"]:
        s.append(f"DLI >= {th['light']['dli_min_mj']} MJ/m2")
    return "; ".join(s) if s else "-"


def main():
    th = load_thresholds(CONFIG_PATH)
    rows = []
    for sid, sensor, case, desc, changes in SCENARIOS:
        r = {**NORMAL, **changes}
        a = expert_policy(r, th)
        fan_lvl = FAN_LEVELS[a["fan"]]
        vent_lvl = VENT_LEVELS[a["vent"]]
        rows.append({
            "id": sid, "sensor": sensor, "case": case, "description": desc,
            **{k: r[k] for k in READING_KEYS},
            "exp_fan": a["fan"], "exp_fan_min": a["fan_min"], "exp_vent": a["vent"],
            "exp_mister": a["mister"], "exp_mister_min": a["mister_min"],
            "exp_heater": a["heater"], "exp_heater_min": a["heater_min"],
            "exp_irrigation": a["irrigation"], "exp_irrigation_min": a["irrigation_min"],
            "exp_lights": a["lights"], "exp_lights_min": a["lights_min"],
            "exp_co2_inject": a["co2_inject"], "exp_co2_min": a["co2_min"],
            "fan_action": "OFF" if not a["fan"] else f"{fan_lvl} ({FAN_SPEED_PCT[fan_lvl]}%) {a['fan_min']} min",
            "vent_action": f"{vent_lvl} ({VENT_OPEN_PCT[vent_lvl]}%)",
            "mister_action": f"ON {a['mister_min']} min" if a["mister"] else "OFF",
            "heater_action": ("OFF" if not a["heater"] else
                              f"ON, air set {th['air_temp']['heat_target']:.0f}C, {a['heater_min']} min"
                              if r["air_temp"] < th["air_temp"]["opt_min"] else
                              f"ON, root-zone set {th['soil_temp']['heat_target']:.0f}C, {a['heater_min']} min"),
            "irrigation_action": f"ON {a['irrigation_min']} min" if a["irrigation"] else "OFF",
            "co2_action": f"ON {a['co2_min']} min" if a["co2_inject"] else "OFF",
            "lights_action": f"ON {a['lights_min']} min" if a["lights"] else "OFF",
            "stop_when": stop_when(r, a, th),
            "farmer_message": " | ".join(farmer_message(r, a, th)),
        })
    df = pd.DataFrame(rows)
    out_csv = ROOT / "data" / "test_scenarios_capsicum.csv"
    df.to_csv(out_csv, index=False, encoding="utf-8")

    reading_txt = lambda x: (f"T {x.air_temp}C, RH {x.rh:.0f}%, SM {x.soil_moisture:.0f}%, "
                             f"Tsoil {x.soil_temp}C, CO2 {x.co2:.0f}, Tout {x.outside_temp}C, "
                             f"{int(x.hour):02d}:00, DLI {x.dli_so_far}")
    lines = ["| ID | Sensor | Case | Scenario | Readings | Fan | Roof vent | Mister | Heater | Irrigation | CO2 | Grow lights | Stop when |",
             "|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for x in df.itertuples():
        lines.append(f"| {x.id} | {x.sensor} | {x.case} | {x.description} | {reading_txt(x)} | {x.fan_action} | "
                     f"{x.vent_action} | {x.mister_action} | {x.heater_action} | {x.irrigation_action} | "
                     f"{x.co2_action} | {x.lights_action} | {x.stop_when} |")
    lines += ["", "### Farmer messages", "", "| ID | What the app tells the farmer |", "|---|---|"]
    for x in df.itertuples():
        lines.append(f"| {x.id} | {x.farmer_message} |")
    out_md = ROOT / "docs" / "test_scenario_table_capsicum.md"
    out_md.write_text("# Capsicum test scenarios -- expected actuator actions\n\n"
                      "Generated by `src/build_test_scenarios_capsicum.py` from "
                      "`config/thresholds_capsicum.json`. Do not edit by hand -- edit the "
                      "scenario list or thresholds and re-run.\n\n"
                      + "\n".join(lines) + "\n", encoding="utf-8")
    print(f"Saved {len(df)} scenarios -> {out_csv}\n                   -> {out_md}")


if __name__ == "__main__":
    main()
