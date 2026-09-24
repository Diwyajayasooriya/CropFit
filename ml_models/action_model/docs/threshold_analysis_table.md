# Sensor threshold analysis (Stage 1 agronomic priors — tomato)

Source of every number: the Stage 1 table in `ml_models/greennode-ml-rules-process.md`
(tomato, Sri Lanka). Values live in `config/thresholds.json` — this file only documents them.
"Trigger" = the value at which the hub recommends an action. "Stop when" = when the farmer
(or the automation) switches the actuator back off.

| Sensor | Unit | Optimal range | Lower trigger | Upper trigger | Critical | Actuator(s) | Setting / how to operate | Stop when | How minutes are calculated |
|---|---|---|---|---|---|---|---|---|---|
| Air temperature | °C | 17 – 27 | < 12 (heat) | > 28 (cool) | ≥ 32 (critical heat) | Fan, roof vent, mister, heater | Fan LOW 40% if ≤3 °C above 26; MEDIUM 70% if 3–7 °C; HIGH 100% if >7 °C. Vent HALF (50%), FULL (100%) if >7 °C above. Mister on if RH < 80%. Heater set to 16 °C, vents closed. | Cooling: ≤ 26 °C. Heating: ≥ 16 °C | (T − 26) ÷ cooling rate (LOW 0.2, MED 0.4, HIGH 0.7 °C/min, reduced when outside air is hot). Heating: (16 − T) ÷ 0.25 °C/min. Rounded up to 5 min, 10–60 min (fan), max 90 (heater). |
| Soil (root-zone) temperature | °C | > 14 | < 14 | – | – | Root-zone / floor heater | Set to 18 °C | ≥ 18 °C | (18 − Tsoil) ÷ 0.1 °C/min, max 90 min |
| Relative humidity | % | 70 – 90 | < 60 (stress) | > 90 | ≥ 95 (fungal disease risk) | Mister (low); fan + roof vent (+ heater if < 17 °C) (high) | Low: mister ON. High: vent HALF, fan LOW (MEDIUM if ≥ 95%). | Low: RH ≥ 75%. High: RH ≤ 80% | Low: (75 − RH) ÷ 1.5 %/min, max 30. High: (RH − 80) ÷ 0.8 %/min, 10–60 min |
| Soil moisture | % (0 dry – 100 saturated) | 50 – 80 | < 50 (~ −30 kPa); < 35 critical | > 90 waterlogged | < 35 | Drip irrigation valve | ON. At night (19:00–06:00) only if < 35%, otherwise wait for morning. Never if > 90%. | ≥ 75% (~ −10 kPa field capacity) | (75 − SM) ÷ 1.2 %/min, 5–45 min |
| CO₂ | ppm | 700 – 900 (vents closed) / 340 – 370 ambient (vents open) | < 700, daytime 07–17, vents closed | > 1500 | > 1500 (worker safety) | CO₂ injector; fan + vent (high) | Inject ONLY when vents are closed. High: vent HALF + fan LOW 15 min. | ≥ 800 ppm | (800 − CO₂) ÷ 25 ppm/min, max 30 min |
| Light (daily light integral) | MJ/m²/day | ≥ 8.5 | < 8.5 by 16:00–18:00 | – | – | Grow lights | ON in the evening window | DLI ≥ 8.5 | (8.5 − DLI) ÷ 0.5 MJ/m²/h, 15–240 min |
| Internal air velocity | m/s | < 0.5 | – | 0.5 | – | Circulation fan | Never run circulation fans so hard that canopy air exceeds 0.5 m/s (hardware limit for HIGH speed) | – | Constraint, not a model output |
| External wind | m/s | < 2.0 | – | > 2.0 | – | Roof vent | Above 2 m/s wind drives air exchange; reduce vent opening | – | Constraint, not a model output (no wind sensor yet) |

**Important:** the actuator rates (°C/min, %/min…) are engineering estimates so the model has
something to learn from on day one. Measure the real ones in the Phase 3 field trial
(e.g. log how long the fan actually takes to bring 34 °C down to 26 °C) and update
`actuator_rates` in `config/thresholds.json`, then re-run the pipeline.
