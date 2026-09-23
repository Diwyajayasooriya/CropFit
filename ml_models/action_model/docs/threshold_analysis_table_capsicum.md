# Sensor threshold analysis (Stage 1 agronomic priors — capsicum / bell pepper)

Same format as `docs/threshold_analysis_table.md` (tomato) and `docs/threshold_analysis_table_cucumber.md`.
Full sourcing and confidence ratings are in `README_CAPSICUM.md` — this file documents the numbers
actually in `config/thresholds_capsicum.json`.

| Sensor | Unit | Optimal range | Lower trigger | Upper trigger | Critical | Actuator(s) | Setting / how to operate | Stop when | How minutes are calculated | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Air temperature | °C | 20 – 25 | < 15 (heat) | > 28 (cool) | ≥ 32 (pollen/fruit-set failure) | Fan, roof vent, mister, heater | Fan LOW/MEDIUM/HIGH scaling same as tomato/cucumber. Heater set to 20°C, vents closed. | Cooling: ≤ 25°C. Heating: ≥ 20°C | (T − 25) ÷ cooling rate; heating (20 − T) ÷ 0.25°C/min | **High** — critical_high is a direct figure from a dedicated government threshold study (DAF Qld) |
| Soil (root-zone) temperature | °C | 19 – 22 | < 19 | – (chlorosis risk >23°C, not represented in current schema) | – | Root-zone / floor heater | Set to 20°C | ≥ 20°C | (20 − Tsoil) ÷ 0.1°C/min, max 90 min | **Medium** — single extension source; high-end chlorosis warning can't be encoded with the current heat_trigger/heat_target-only schema |
| Relative humidity | % | 70 – 80 | < 60 (stress) | > 80 | ≥ 90 (disease risk, not capsicum-specific) | Mister (low); fan + roof vent (high) | Low: mister ON. High: vent HALF, fan LOW. | Low: RH ≥ 70%. High: RH ≤ 75% | Low: (70 − RH) ÷ 1.5%/min. High: (RH − 75) ÷ 0.8%/min | **Medium** — optimal band sourced (Alberta), disease ceiling generic |
| Soil moisture | % (0 dry – 100 saturated) | 60 – 90 (target 80) | < 60; < 45 critical | > 90 waterlogged | < 45 | Drip irrigation valve | ON, same night-deferral logic as tomato/cucumber. | ≥ 80% | (80 − SM) ÷ 1.2%/min, 5–45 min | **Low** — measurement-scale mismatch with source study (see README) |
| CO₂ | ppm | 700 – 1000 (vents closed) | < 700, daytime, vents closed | > 1500 | > 1500 (worker safety) | CO₂ injector; fan + vent (high) | Inject only when vents closed. | ≥ 900 ppm | (900 − CO₂) ÷ 25 ppm/min, max 30 min | **Medium** — single extension source (Alberta) |
| Light (daily light integral) | MJ/m²/day | ≥ 10.0 | < 10.0 by 16:00–18:00 | – | – | Grow lights | ON in the evening window | DLI ≥ 10.0 | (10.0 − DLI) ÷ 0.5 MJ/m²/h, 15–240 min | **Low** — converted from mol/m²/day PAR figures, unverified conversion |
| Fertigation EC | mS/cm | 0.8 – 1.8 | – | – | – | Not yet in the model schema | — | — | — | **Medium, disputed** — a 2025 peer-reviewed study found pepper tolerates up to 2.4 dS/m, the opposite ordering from this extension figure. See README section 7. |
| Fertigation pH | — | 5.5 – 6.0 | – | – | – | Same as above | — | — | — | **Medium** |
| Internal air velocity | m/s | < 0.5 | – | 0.5 | – | Circulation fan | Hardware constraint, not crop-specific | – | Constraint, not a model output | Not implemented in code (same as tomato/cucumber) |
| External wind | m/s | — | – | unverified | – | Roof vent | Same unverified figure question as the tomato/cucumber files — a hardware question, not researched per-crop | – | Constraint, not a model output | Unverified for all three crops |

**Reading this against the other two crops:** capsicum's `critical_high` (32°C) is nearly identical
to tomato's (32°C) — both driven by pollen/fruit-set failure at essentially the same temperature —
while cucumber's is notably higher (35°C, though lower-confidence). RH sits between the other two
(70–80% vs. tomato's 70–90% and cucumber's 60–75%). The fertigation section is the most important
one to re-check in the field: two real sources disagree on whether capsicum wants a *lower* EC
than tomato/cucumber (OSU) or actually tolerates a *higher* one (Adame-Adame et al. 2025).
